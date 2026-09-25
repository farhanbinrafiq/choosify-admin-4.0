/**
 * Minimal Ads & Deals service — pre-Sprint-9 stabilization.
 */

import { randomUUID } from 'node:crypto';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { publishEvent } from '../events/eventBus';
import { Logger } from '../lib/logger';
import {
  assertFormatPlacementCompatible,
  assertRoleCanUsePlacement,
  getPlacementDef,
} from '../../shared/ads/placementRegistry';
import {
  assertSafeMediaUrl,
  inferHeroMediaType,
  type HeroMediaType,
} from '../../shared/ads/heroMedia';
import {
  computeDealPrice,
  deriveDealTimeState,
  derivePromotionRunState,
  dealFilterKey,
  isDealListingType,
  isDealPricingMode,
  isLegacyDeal,
  isPromotionType,
  parseIsoTimestamp,
  REJECTION_REASON_MAX,
  SELLER_NOTE_MAX,
  validateDealSchedule,
  windowsOverlap,
  type DealFilterKey,
  type DealListingType,
  type DealPricingMode,
  type DealTimeState,
  type PromotionRunState,
  type PromotionType,
} from '../../shared/deals/dealPricing';
import { isProductActive } from '../catalog/productLifecycle';
import { getService, listServices } from '../catalog/serviceStore';
import { operationsStore } from '../operations/operationsStore';
import { adsStore } from './adsStore';
import {
  isDealPromotionRequest,
  type AdRecord,
  type AdsKind,
  type AdsOwnerRole,
  type AdsStatus,
  type CreateAdInput,
  type PromotionRequestRecord,
} from './types';

export class AdsError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AdsError';
  }
}

export type AdsActor = {
  userId: string;
  role?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function isPlatformAdmin(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin';
}

function toOwnerRole(role?: string): AdsOwnerRole {
  const r = (role || '').toLowerCase();
  if (r === 'creator') return 'creator';
  if (r === 'admin' || r === 'super_admin') return 'admin';
  return 'seller';
}

function emitMarketplace(
  eventName: string,
  aggregateId: string,
  actor: string,
  payload: Record<string, unknown>,
): void {
  publishEvent({
    eventName,
    domain: 'Marketplace',
    producer: 'adsService',
    aggregateId,
    actor,
    payload,
  });
}

/** Reject javascript: and other non-http(s) schemes for external creatives. */
export function assertSafeExternalUrl(url: string | undefined): string | undefined {
  if (url === undefined || url === null || String(url).trim() === '') return undefined;
  const trimmed = String(url).trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new AdsError('externalUrl must not use javascript: or unsafe schemes', 400);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AdsError('externalUrl must be http(s)', 400);
    }
  } catch (error) {
    if (error instanceof AdsError) throw error;
    throw new AdsError('externalUrl is invalid', 400);
  }
  return trimmed;
}

/** Normalize + validate Hero creative media (image/gif upload URLs or hosted video URL). */
export function normalizeCreativeMedia(
  creative: CreateAdInput['creative'],
  formatId?: string,
): CreateAdInput['creative'] {
  if (!creative) return creative;
  try {
    const imageUrl = assertSafeMediaUrl(
      typeof creative.imageUrl === 'string' ? creative.imageUrl : undefined,
      'imageUrl',
    );
    const videoUrl = assertSafeMediaUrl(
      typeof creative.videoUrl === 'string' ? creative.videoUrl : undefined,
      'videoUrl',
    );
    const posterUrl = assertSafeMediaUrl(
      typeof creative.posterUrl === 'string' ? creative.posterUrl : undefined,
      'posterUrl',
    );
    let mediaType: HeroMediaType | undefined =
      creative.mediaType === 'image' || creative.mediaType === 'gif' || creative.mediaType === 'video'
        ? creative.mediaType
        : undefined;
    if (formatId === 'hero_banner') {
      mediaType = inferHeroMediaType(videoUrl || imageUrl, mediaType);
      if (mediaType === 'video' && !videoUrl) {
        throw new AdsError('Hero video creatives require a hosted videoUrl (mp4/webm https URL)', 400);
      }
      if ((mediaType === 'image' || mediaType === 'gif') && videoUrl && !imageUrl) {
        // Treat accidental video URL in image field gracefully via inference above.
      }
    }
    return {
      ...creative,
      imageUrl,
      videoUrl,
      posterUrl,
      mediaType,
    };
  } catch (error) {
    if (error instanceof AdsError) throw error;
    throw new AdsError(error instanceof Error ? error.message : 'Invalid creative media URL', 400);
  }
}

function assertCanView(ad: AdRecord, actor: AdsActor): void {
  if (isPlatformAdmin(actor.role)) return;
  if (ad.ownerId === actor.userId) return;
  throw new AdsError('Not authorized', 403);
}

function assertAdminNotOwner(ad: AdRecord, actor: AdsActor): void {
  if (!isPlatformAdmin(actor.role)) {
    throw new AdsError('Admin role required', 403);
  }
  if (ad.ownerId === actor.userId) {
    throw new AdsError('Cannot approve or reject your own ads', 403);
  }
}

function validateBannerPlacement(input: CreateAdInput, actorRole?: string, requirePlacement = false): void {
  // Deals/promotions may omit format registry (legacy listing flows).
  if (input.kind === 'deal' || input.kind === 'promotion') return;
  if (!input.formatId && !input.placementId) {
    if (requirePlacement) throw new AdsError('formatId and placementId are required', 400);
    return;
  }
  const compat = assertFormatPlacementCompatible(input.formatId, input.placementId);
  if (compat.ok === false) {
    throw new AdsError(compat.error, 400);
  }
  const roleOk = assertRoleCanUsePlacement(input.placementId!, actorRole);
  if (roleOk.ok === false) {
    throw new AdsError(roleOk.error, 403);
  }
  if (input.pageKey && compat.placement.pageKey !== input.pageKey) {
    throw new AdsError('pageKey does not match placement', 400);
  }
}

type CatalogCategoryRow = {
  id: string;
  name: string;
  parentId?: string | null;
  enabled?: boolean;
  displayOrder?: number;
};

/**
 * Category Promoted Slot must reference an existing enabled Choosify category.
 * Labels/subcategory chips are derived from catalog — client strings are not authoritative.
 */
async function resolveCategoryPromotedCreative(
  formatId: string | undefined,
  creative: CreateAdInput['creative'],
): Promise<CreateAdInput['creative']> {
  if (formatId !== 'category_promoted_slot') return creative;

  const rawId =
    typeof creative?.categoryId === 'string'
      ? creative.categoryId.trim()
      : typeof (creative as { category_id?: unknown } | undefined)?.category_id === 'string'
        ? String((creative as { category_id?: string }).category_id).trim()
        : '';
  if (!rawId) {
    throw new AdsError(
      'categoryId is required for Category Promoted Slot and must reference an existing Choosify category',
      400,
    );
  }

  const category = (await catalogStore.getCategory(rawId)) as CatalogCategoryRow | null;
  if (!category || !category.id) {
    throw new AdsError('categoryId does not resolve to an existing Choosify category', 400);
  }
  if (category.enabled === false) {
    throw new AdsError('Selected category is not eligible for storefront placement', 400);
  }

  const all = (await catalogStore.listCategories()) as CatalogCategoryRow[];
  const children = all
    .filter((c) => c.parentId === category.id && c.enabled !== false)
    .sort(
      (a, b) =>
        (a.displayOrder || 0) - (b.displayOrder || 0) ||
        String(a.name).localeCompare(String(b.name)),
    )
    .map((c) => c.name)
    .slice(0, 6);

  const hostImage =
    typeof creative?.hostCategoryImageUrl === 'string' && creative.hostCategoryImageUrl.trim()
      ? creative.hostCategoryImageUrl.trim()
      : undefined;

  return {
    ...(creative || {}),
    categoryId: category.id,
    categoryName: category.name,
    hostCategoryName: category.name,
    hostCategoryImageUrl: hostImage,
    hostSubcategories: children.length ? children : undefined,
  };
}

function moneyLabel(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return undefined;
  return `৳${Number(n).toLocaleString('en-BD')}`;
}

/** Authoritative listing fields for Deal-of-the-Day / product-linked creatives. */
async function hydrateListingCreative(
  listingId: string | undefined,
  creative: CreateAdInput['creative'],
  actor: AdsActor,
): Promise<CreateAdInput['creative']> {
  if (!listingId) return creative;
  const product = await assertListingOwned(listingId, actor);
  const price = Number((product as { price?: number }).price);
  const originalRaw =
    Number((product as { originalPrice?: number }).originalPrice) ||
    Number((product as { compareAtPrice?: number }).compareAtPrice) ||
    0;
  const original = originalRaw > 0 ? originalRaw : undefined;
  const discountPercent =
    original && price && original > price
      ? Math.round(((original - price) / original) * 100)
      : (product as { discountPercent?: number }).discountPercent;
  // Pricing is authoritative from the listing — never trust client overrides while linked.
  return {
    ...(creative || {}),
    imageUrl: creative?.imageUrl || product.image,
    headline: creative?.headline || product.title,
    productTitle: product.title || creative?.productTitle,
    salePriceLabel: moneyLabel(price) || undefined,
    previousPriceLabel: moneyLabel(original) || undefined,
    discountLabel:
      discountPercent && discountPercent > 0 ? `-${discountPercent}%` : undefined,
    advertiserName:
      creative?.advertiserName ||
      (product as { brandName?: string }).brandName ||
      product.brandId,
  };
}

async function createBase(
  input: CreateAdInput,
  status: AdsStatus,
  actorRole?: string,
  opts?: { requirePlacement?: boolean },
): Promise<AdRecord> {
  const title = String(input.title || '').trim();
  if (!title) throw new AdsError('title is required', 400);
  if (!input.ownerId) throw new AdsError('ownerId is required', 400);

  validateBannerPlacement(input, actorRole, opts?.requirePlacement === true);

  const externalUrl = assertSafeExternalUrl(input.externalUrl);
  const now = nowIso();
  const kind = input.kind;
  const prefix =
    kind === 'deal' ? 'deal' : kind === 'promotion' ? 'promo' : kind === 'external' ? 'extad' : 'banner';

  const pageKey = input.pageKey || (input.placementId
    ? getPlacementDef(input.placementId)?.pageKey
    : undefined);

  const row: AdRecord = {
    id: newId(prefix),
    ownerId: input.ownerId,
    ownerRole: input.ownerRole,
    listingId: input.listingId,
    brandId: input.brandId,
    title,
    status,
    kind,
    formatId: input.formatId,
    placementId: input.placementId,
    pageKey,
    creative: input.creative,
    cta: input.cta,
    externalUrl,
    placement: input.placement || input.placementId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
    ...(kind === 'deal' ? { listingType: input.listingType, dealTerms: input.dealTerms } : {}),
    ...(kind === 'promotion' && input.dealId
      ? {
          dealId: input.dealId,
          listingType: input.listingType,
          promotionType: input.promotionType,
          sellerNote: input.sellerNote,
          review: input.review,
        }
      : {}),
  };
  try {
    const { ensureEntityReferenceId } = await import('../referenceIds/referenceIdService');
    if (kind === 'deal') {
      row.dealReferenceId = await ensureEntityReferenceId({
        entityType: 'deal',
        internalId: row.id,
      });
    } else {
      row.advertisementReferenceId = await ensureEntityReferenceId({
        entityType: 'advertisement',
        internalId: row.id,
      });
    }
  } catch {
    /* backfill can repair */
  }
  return adsStore.upsertAd(row);
}

// ── Canonical seller Deals ──────────────────────────────────────────────────
//
// A Deal is an AdRecord (kind 'deal') attached to an existing product/service
// the seller owns. Deals are OPEN marketplace inventory: no approval. A valid
// Deal is stored `active` (= enabled) and its time state (Scheduled / Active /
// Expired) is derived from startsAt/endsAt and the server clock. Pause /
// Resume / Disable are exceptional admin moderation, not an approval gate.
// It stores pricing TERMS; the deal price is derived from the listing's base
// price on the server. There is no customer-facing pricing effect yet —
// product.price / service.price are never written here.
//
// Promotion is the controlled layer: a seller may request Featured/Sponsored
// visibility for an Active Deal (AdRecord kind 'promotion' + dealId), which a
// Super Admin approves or rejects. The Deal is unaffected by that decision.

/** Client-supplied deal fields. Owner, status, prices and review are never read from the client. */
export type DealSubmission = {
  listingType?: unknown;
  listingId?: unknown;
  pricingMode?: unknown;
  pricingValue?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  title?: unknown;
};

export type DealListingSummary = {
  id: string;
  listingType: DealListingType;
  name: string;
  image?: string;
  category?: string;
  brandId?: string;
  brandName?: string;
  slug?: string;
  basePrice: number;
  status: string;
  sellerId?: string;
};

function isSellerRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'seller' || r === 'verified_seller';
}

/** Version 1: only sellers create Deals. No creator path, no platform/admin-created Deals. */
function assertCanCreateDeal(actor: AdsActor): void {
  if (isSellerRole(actor.role)) return;
  if (isPlatformAdmin(actor.role)) {
    throw new AdsError('Platform-created deals are not supported in v1', 403);
  }
  if ((actor.role || '').toLowerCase() === 'creator') {
    throw new AdsError('Creators cannot create deals in v1', 403);
  }
  throw new AdsError('Only sellers can create deals', 403);
}

async function loadDealListing(
  listingType: DealListingType,
  listingId: string,
): Promise<DealListingSummary | null> {
  if (listingType === 'product') {
    const p = await catalogStore.getProduct(listingId);
    if (!p) return null;
    return {
      id: p.id,
      listingType,
      name: p.title || p.id,
      image: p.image,
      category: (p as { categoryName?: string }).categoryName,
      brandId: p.brandId,
      brandName: (p as { brandName?: string }).brandName,
      slug: p.slug,
      basePrice: Number((p as { price?: number }).price),
      status: String((p as { status?: string }).status || ''),
      sellerId: p.sellerId,
    };
  }
  const s = await getService(listingId);
  if (!s) return null;
  return {
    id: s.id,
    listingType,
    name: s.title || s.id,
    image: s.image || s.media?.[0],
    category: s.categoryName,
    brandId: s.brandId,
    brandName: s.brandName,
    slug: s.slug,
    basePrice: Number(s.price),
    status: String(s.status || ''),
    sellerId: s.sellerId,
  };
}

/**
 * Ownership + availability gate for Deals. `ownerId` is always server-derived
 * (the authenticated seller at create/edit, the stored owner at approval).
 */
async function assertDealListingOwned(
  listingType: DealListingType,
  listingId: string,
  ownerId: string,
): Promise<DealListingSummary> {
  const listing = await loadDealListing(listingType, listingId);
  if (!listing) throw new AdsError('Listing not found', 404);
  if (!listing.sellerId || listing.sellerId !== ownerId) {
    throw new AdsError('Not authorized for this listing', 403);
  }
  if (!isProductActive(listing.status)) {
    throw new AdsError('Listing is not available (must be live)', 400);
  }
  return listing;
}

type ParsedDealSubmission = {
  listingType: DealListingType;
  listingId: string;
  mode: DealPricingMode;
  value: number;
  startsAt: string;
  endsAt: string;
  title?: string;
};

function parseDealSubmission(input: DealSubmission): ParsedDealSubmission {
  if (!isDealListingType(input.listingType)) {
    throw new AdsError('listingType must be "product" or "service"', 400);
  }
  const listingId = typeof input.listingId === 'string' ? input.listingId.trim() : '';
  if (!listingId) throw new AdsError('listingId is required', 400);
  if (!isDealPricingMode(input.pricingMode)) {
    throw new AdsError('pricingMode must be "percentage", "amount" or "special_price"', 400);
  }
  const value = typeof input.pricingValue === 'number' ? input.pricingValue : Number.NaN;
  if (!Number.isFinite(value)) throw new AdsError('pricingValue must be a finite number', 400);
  const schedule = validateDealSchedule(input.startsAt, input.endsAt);
  if (schedule.ok === false) throw new AdsError(schedule.error, 400);
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : '';
  return {
    listingType: input.listingType,
    listingId,
    mode: input.pricingMode,
    value,
    startsAt: schedule.value.startsAt,
    endsAt: schedule.value.endsAt,
    title: title || undefined,
  };
}

function priceOrThrow(mode: DealPricingMode, value: number, basePrice: number, status = 400): number {
  const priced = computeDealPrice(mode, value, basePrice);
  if (priced.ok === false) throw new AdsError(priced.error, status);
  return priced.value;
}

/** True when a request carries none of the Deal pricing/schedule fields (legacy listing-only callers). */
function isIncompleteDealRequest(input: DealSubmission): boolean {
  return (
    input.pricingMode === undefined ||
    input.pricingValue === undefined ||
    input.startsAt === undefined ||
    input.endsAt === undefined ||
    input.listingType === undefined
  );
}

const INCOMPLETE_DEAL_MESSAGE =
  'Deal pricing and schedule are required. Create deals from Ads & Deals Studio → Deals → Create Deal.';

/**
 * One unambiguous deal price per listing: at most one enabled-or-paused,
 * non-expired canonical Deal may occupy an overlapping window on a listing.
 * (Paused deals count because Resume would otherwise re-create the overlap.)
 */
async function assertNoOverlappingDeal(
  listingType: DealListingType,
  listingId: string,
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): Promise<void> {
  const now = Date.now();
  const rows = await adsStore.listAds({ kind: 'deal' });
  const clash = rows.find(
    (d) =>
      d.id !== excludeId &&
      !isLegacyDeal(d) &&
      d.listingId === listingId &&
      d.listingType === listingType &&
      (d.status === 'active' || d.status === 'paused') &&
      Date.parse(d.endsAt as string) > now &&
      windowsOverlap(startsAt, endsAt, d.startsAt as string, d.endsAt as string),
  );
  if (clash) {
    throw new AdsError(
      `Another deal (${clash.dealReferenceId || clash.id}) already occupies this listing for an overlapping period. End it or choose non-overlapping dates.`,
      409,
    );
  }
}

/** Create a canonical seller Deal — stored `active` immediately (no approval). */
export async function createDeal(input: DealSubmission, actor: AdsActor): Promise<AdRecord> {
  assertCanCreateDeal(actor);
  if (isIncompleteDealRequest(input)) throw new AdsError(INCOMPLETE_DEAL_MESSAGE, 400);
  const sub = parseDealSubmission(input);
  const listing = await assertDealListingOwned(sub.listingType, sub.listingId, actor.userId);
  const dealPrice = priceOrThrow(sub.mode, sub.value, listing.basePrice);
  await assertNoOverlappingDeal(listing.listingType, listing.id, sub.startsAt, sub.endsAt);

  const row = await createBase(
    {
      ownerId: actor.userId,
      ownerRole: 'seller',
      kind: 'deal',
      listingId: listing.id,
      listingType: listing.listingType,
      brandId: listing.brandId,
      title: sub.title || listing.name,
      creative: listing.image ? { imageUrl: listing.image, headline: listing.name } : undefined,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      dealTerms: {
        mode: sub.mode,
        value: sub.value,
        basePriceAtSubmit: listing.basePrice,
        dealPriceAtSubmit: dealPrice,
      },
      metadata: { source: 'seller-deal-composer' },
    },
    'active',
    actor.role,
  );
  emitMarketplace('DealCreated', row.id, actor.userId, {
    dealId: row.id,
    ownerId: row.ownerId,
    listingId: row.listingId,
    listingType: row.listingType,
    brandId: row.brandId,
    title: row.title,
    status: row.status,
  });
  Logger.audit('deals.create', { dealId: row.id, actorId: actor.userId, listingId: row.listingId });
  return row;
}

function loadDealOr404(ad: AdRecord | null): AdRecord {
  if (!ad || ad.kind !== 'deal') throw new AdsError('Deal not found', 404);
  return ad;
}

/** Loads a canonical Deal owned by the acting seller (403/404 otherwise). */
async function loadOwnCanonicalDeal(id: string, actor: AdsActor): Promise<AdRecord> {
  const ad = loadDealOr404(await adsStore.getAd(id));
  if (ad.ownerId !== actor.userId || !isSellerRole(actor.role)) {
    throw new AdsError('Only the owning seller can manage this deal', 403);
  }
  if (isLegacyDeal(ad)) throw new AdsError('Legacy deals are read-only', 403);
  return ad;
}

const differs = (next: unknown, current: unknown) => next !== undefined && next !== current;

/**
 * Seller edits by time state:
 *  Scheduled → pricing + start/end editable (listing/ownership fixed); everything re-validated.
 *  Active    → price, start and listing locked; only the end may be moved EARLIER (or End Now).
 *  Expired / Paused / Disabled → read-only.
 */
export async function updateOwnDeal(id: string, actor: AdsActor, input: DealSubmission & { status?: unknown }): Promise<AdRecord> {
  const ad = await loadOwnCanonicalDeal(id, actor);
  if (input.status !== undefined) throw new AdsError('Cannot set status directly', 403);
  if (differs(input.listingId, ad.listingId) || differs(input.listingType, ad.listingType)) {
    throw new AdsError('The listing of a deal cannot be changed — withdraw or end it and create a new deal', 403);
  }
  if (ad.status !== 'active') throw new AdsError(`A ${ad.status} deal is read-only`, 403);
  const state = deriveDealTimeState(ad);

  if (state === 'scheduled') {
    const sub = parseDealSubmission({
      listingType: ad.listingType,
      listingId: ad.listingId,
      pricingMode: input.pricingMode !== undefined ? input.pricingMode : ad.dealTerms?.mode,
      pricingValue: input.pricingValue !== undefined ? input.pricingValue : ad.dealTerms?.value,
      startsAt: input.startsAt !== undefined ? input.startsAt : ad.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : ad.endsAt,
      title: input.title !== undefined ? input.title : ad.title,
    });
    const listing = await assertDealListingOwned(sub.listingType, sub.listingId, actor.userId);
    const dealPrice = priceOrThrow(sub.mode, sub.value, listing.basePrice);
    await assertNoOverlappingDeal(sub.listingType, sub.listingId, sub.startsAt, sub.endsAt, ad.id);
    const updated: AdRecord = {
      ...ad,
      title: sub.title || listing.name,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      dealTerms: {
        mode: sub.mode,
        value: sub.value,
        basePriceAtSubmit: listing.basePrice,
        dealPriceAtSubmit: dealPrice,
      },
      updatedAt: nowIso(),
    };
    await adsStore.upsertAd(updated);
    Logger.audit('deals.update', { dealId: id, actorId: actor.userId, state });
    return updated;
  }

  if (state === 'active') {
    if (
      differs(input.pricingMode, ad.dealTerms?.mode) ||
      differs(input.pricingValue, ad.dealTerms?.value) ||
      differs(input.startsAt, ad.startsAt)
    ) {
      throw new AdsError('An active deal cannot change its price or start. Use End Now, or move the end date earlier.', 403);
    }
    if (input.endsAt === undefined) return ad;
    const end = parseIsoTimestamp(input.endsAt);
    if (end === null) throw new AdsError('endsAt must be a valid ISO timestamp', 400);
    if (end <= Date.now()) throw new AdsError('endsAt must be in the future — use End Now to stop immediately', 400);
    if (end >= Date.parse(ad.endsAt as string)) {
      throw new AdsError('An active deal can only move its end date earlier', 403);
    }
    const updated: AdRecord = { ...ad, endsAt: new Date(end).toISOString(), updatedAt: nowIso() };
    await adsStore.upsertAd(updated);
    Logger.audit('deals.shorten', { dealId: id, actorId: actor.userId });
    return updated;
  }

  throw new AdsError('An expired deal is read-only', 403);
}

/**
 * End Now (owner): Scheduled or Active → Expired, keeping the record.
 * A Scheduled deal gets startsAt = endsAt = now so it can never start later.
 */
export async function endDeal(id: string, actor: AdsActor): Promise<AdRecord> {
  const ad = await loadOwnCanonicalDeal(id, actor);
  const state = deriveDealTimeState(ad);
  if (state !== 'scheduled' && state !== 'active') {
    throw new AdsError('Only scheduled or active deals can be ended', 409);
  }
  const now = nowIso();
  const updated: AdRecord = {
    ...ad,
    ...(state === 'scheduled' ? { startsAt: now } : {}),
    endsAt: now,
    updatedAt: now,
    metadata: { ...(ad.metadata || {}), endedBy: actor.userId, endedAt: now },
  };
  await adsStore.upsertAd(updated);
  Logger.audit('deals.end', { dealId: id, actorId: actor.userId, fromState: state });
  return updated;
}

/**
 * Exceptional admin moderation for Deals (never an approval gate; never
 * recreate a Deal to change its state):
 *  Pause   active → paused      (canonical only)
 *  Resume  paused → active      (dates then decide Scheduled / Active / Expired)
 *  Disable any → disabled       (final; the only action on legacy deals)
 */
function assertDealTransition(ad: AdRecord, action: 'pause' | 'resume' | 'disable'): void {
  if (action === 'disable') {
    if (ad.status === 'disabled') throw new AdsError('Deal is already disabled', 409);
    return;
  }
  if (isLegacyDeal(ad)) throw new AdsError('Legacy deals can only be disabled', 409);
  if (action === 'pause' && ad.status !== 'active') {
    throw new AdsError(`Only enabled deals can be paused (current: ${ad.status})`, 409);
  }
  if (action === 'resume' && ad.status !== 'paused') {
    throw new AdsError(`Only paused deals can be resumed (current: ${ad.status})`, 409);
  }
}

/** Resume: paused → active; the stored schedule then decides Scheduled / Active / Expired. */
export async function resumeDeal(id: string, actor: AdsActor): Promise<AdRecord> {
  if (!isPlatformAdmin(actor.role)) throw new AdsError('Admin role required', 403);
  const ad = loadDealOr404(await adsStore.getAd(id));
  assertDealTransition(ad, 'resume');
  if (Date.parse(ad.endsAt as string) > Date.now()) {
    await assertNoOverlappingDeal(ad.listingType as DealListingType, ad.listingId as string, ad.startsAt as string, ad.endsAt as string, ad.id);
  }
  const updated: AdRecord = {
    ...ad,
    status: 'active',
    updatedAt: nowIso(),
    metadata: { ...(ad.metadata || {}), resumedBy: actor.userId, resumedAt: nowIso() },
  };
  await adsStore.upsertAd(updated);
  Logger.audit('ads.resume', { adId: id, actorId: actor.userId });
  return updated;
}

export type DealView = AdRecord & {
  legacy: boolean;
  timeState: DealTimeState | null;
  filterKey: DealFilterKey;
  listing?: {
    name: string;
    image?: string;
    category?: string;
    brandName?: string;
    status: string;
    currentBasePrice: number;
    exists: boolean;
  };
  /** Derived from the CURRENT base price (display only — no customer-facing pricing effect yet). */
  currentDealPrice?: number | null;
  currentPriceInvalidReason?: string;
  /** Latest Promotion Request for this deal + whether a promotion is running right now. */
  promotion?: {
    latest?: PromotionSummary;
    promotedNow: boolean;
  };
};

export type PromotionSummary = {
  id: string;
  reference?: string;
  promotionType?: PromotionType;
  status: string;
  runState: PromotionRunState | null;
  startsAt?: string;
  endsAt?: string;
  rejectionReason?: string;
};

function isDealLiveForPromotion(view: Pick<DealView, 'timeState' | 'currentPriceInvalidReason' | 'listing'>): boolean {
  return view.timeState === 'active' && !view.currentPriceInvalidReason && view.listing?.exists !== false;
}

function summarizePromotion(req: AdRecord, dealLive: boolean, now: number): PromotionSummary {
  return {
    id: req.id,
    reference: req.advertisementReferenceId,
    promotionType: req.promotionType,
    status: req.status,
    runState: derivePromotionRunState(req, dealLive, now),
    startsAt: req.startsAt,
    endsAt: req.endsAt,
    rejectionReason: req.review?.rejectionReason,
  };
}

async function listDealPromotionRequests(): Promise<PromotionRequestRecord[]> {
  return (await adsStore.listAds({ kind: 'promotion' })).filter(isDealPromotionRequest);
}

async function toDealView(ad: AdRecord, now: number, promos: AdRecord[] = []): Promise<DealView> {
  const legacy = isLegacyDeal(ad);
  const view: DealView = {
    ...ad,
    legacy,
    timeState: deriveDealTimeState(ad, now),
    filterKey: dealFilterKey(ad, now),
  };
  if (ad.listingId) {
    const type: DealListingType = ad.listingType || 'product';
    const listing = await loadDealListing(type, ad.listingId).catch(() => null);
    if (listing) {
      view.listing = {
        name: listing.name,
        image: listing.image,
        category: listing.category,
        brandName: listing.brandName,
        status: listing.status,
        currentBasePrice: listing.basePrice,
        exists: true,
      };
      if (ad.dealTerms) {
        const priced = computeDealPrice(ad.dealTerms.mode, ad.dealTerms.value, listing.basePrice);
        view.currentDealPrice = priced.ok ? priced.value : null;
        if (priced.ok === false) view.currentPriceInvalidReason = priced.error;
      }
    } else {
      view.listing = { name: ad.title, status: 'missing', currentBasePrice: 0, exists: false };
    }
  }
  if (!legacy) {
    const mine = promos
      .filter((p) => p.dealId === ad.id)
      .sort((a, b) => (b.review?.submittedAt || b.createdAt).localeCompare(a.review?.submittedAt || a.createdAt));
    const live = isDealLiveForPromotion(view);
    view.promotion = {
      latest: mine[0] ? summarizePromotion(mine[0], live, now) : undefined,
      promotedNow: mine.some((p) => derivePromotionRunState(p, live, now) === 'running'),
    };
  }
  return view;
}

export async function listDealViews(actor: AdsActor): Promise<DealView[]> {
  const [rows, promos] = await Promise.all([listDeals(actor), listDealPromotionRequests()]);
  const now = Date.now();
  const views = await Promise.all(rows.map((r) => toDealView(r, now, promos)));
  return views.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ── Promotion Requests (the only admin-reviewed Deal workflow) ──────────────

/** Client-supplied promotion-request fields; everything else is derived from the Deal. */
export type PromotionRequestSubmission = {
  promotionType?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  sellerNote?: unknown;
};

function loadPromotionRequestOr404(ad: AdRecord | null): PromotionRequestRecord {
  if (!ad || !isDealPromotionRequest(ad)) throw new AdsError('Promotion request not found', 404);
  return ad;
}

/**
 * The Deal must be canonical, enabled, currently Active (by the server clock),
 * on a still-owned live listing with a price that is valid vs the CURRENT base.
 */
async function assertDealPromotable(deal: AdRecord, status = 409): Promise<void> {
  if (isLegacyDeal(deal)) throw new AdsError('Legacy deals cannot be promoted', status);
  if (deal.status !== 'active') throw new AdsError(`A ${deal.status} deal cannot be promoted`, status);
  const state = deriveDealTimeState(deal);
  if (state !== 'active') {
    throw new AdsError(`Only a currently active deal can be promoted (this deal is ${state})`, status);
  }
  const listing = await assertDealListingOwned(deal.listingType as DealListingType, deal.listingId as string, deal.ownerId);
  const terms = deal.dealTerms!;
  priceOrThrow(terms.mode, terms.value, listing.basePrice, status);
}

function assertWithinDeal(deal: AdRecord, startsAt: string, endsAt: string, status = 400): void {
  if (Date.parse(startsAt) < Date.parse(deal.startsAt as string) || Date.parse(endsAt) > Date.parse(deal.endsAt as string)) {
    throw new AdsError('The promotion period must fall within the deal period', status);
  }
}

function assertNoApprovedPromotionOverlap(
  requests: AdRecord[],
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): void {
  const clash = requests.find(
    (r) =>
      r.id !== excludeId &&
      r.status === 'approved' &&
      windowsOverlap(startsAt, endsAt, r.startsAt as string, r.endsAt as string),
  );
  if (clash) {
    throw new AdsError(
      `This deal already has an approved promotion (${clash.advertisementReferenceId || clash.id}) for an overlapping period`,
      409,
    );
  }
}

/** Seller requests Featured/Sponsored visibility for their own currently Active Deal. */
export async function createPromotionRequest(
  dealId: string,
  input: PromotionRequestSubmission,
  actor: AdsActor,
): Promise<AdRecord> {
  if (!isSellerRole(actor.role)) throw new AdsError('Only sellers can request promotion', 403);
  const deal = loadDealOr404(await adsStore.getAd(dealId));
  if (deal.ownerId !== actor.userId) throw new AdsError('You can only request promotion for your own deals', 403);
  await assertDealPromotable(deal);

  if (!isPromotionType(input.promotionType)) {
    throw new AdsError('promotionType must be "featured" or "sponsored"', 400);
  }
  const schedule = validateDealSchedule(input.startsAt, input.endsAt);
  if (schedule.ok === false) throw new AdsError(schedule.error.replace('startsAt', 'Promotion start').replace('endsAt', 'Promotion end'), 400);
  const { startsAt, endsAt } = schedule.value;
  assertWithinDeal(deal, startsAt, endsAt);
  if (input.sellerNote !== undefined && input.sellerNote !== null && typeof input.sellerNote !== 'string') {
    throw new AdsError('sellerNote must be text', 400);
  }
  const sellerNote = typeof input.sellerNote === 'string' ? input.sellerNote.trim() : '';
  if (sellerNote.length > SELLER_NOTE_MAX) {
    throw new AdsError(`sellerNote must be at most ${SELLER_NOTE_MAX} characters`, 400);
  }

  const existing = (await listDealPromotionRequests()).filter((r) => r.dealId === deal.id);
  const open = existing.find((r) => r.status === 'pending');
  if (open) {
    throw new AdsError(
      `This deal already has a pending promotion request (${open.advertisementReferenceId || open.id}). Cancel it first to submit a different one.`,
      409,
    );
  }
  assertNoApprovedPromotionOverlap(existing, startsAt, endsAt);

  const row = await createBase(
    {
      ownerId: deal.ownerId,
      ownerRole: 'seller',
      kind: 'promotion',
      dealId: deal.id,
      listingId: deal.listingId,
      listingType: deal.listingType,
      brandId: deal.brandId,
      title: deal.title,
      startsAt,
      endsAt,
      promotionType: input.promotionType,
      sellerNote: sellerNote || undefined,
      review: { submittedAt: nowIso() },
      metadata: { source: 'deal-promotion-request' },
    },
    'pending',
    actor.role,
  );
  emitMarketplace('PromotionRequested', row.id, actor.userId, {
    promotionId: row.id,
    dealId: deal.id,
    ownerId: row.ownerId,
    promotionType: row.promotionType,
    status: row.status,
  });
  Logger.audit('deals.promotion.request', { promotionId: row.id, dealId: deal.id, actorId: actor.userId });
  return row;
}

/** Seller withdraws their own PENDING request (kept for history as `cancelled`). */
export async function cancelPromotionRequest(id: string, actor: AdsActor): Promise<AdRecord> {
  const req = loadPromotionRequestOr404(await adsStore.getAd(id));
  if (req.ownerId !== actor.userId || !isSellerRole(actor.role)) {
    throw new AdsError('Only the requesting seller can cancel this request', 403);
  }
  if (req.status !== 'pending') throw new AdsError(`Only pending requests can be cancelled (current: ${req.status})`, 409);
  const now = nowIso();
  const updated: AdRecord = { ...req, status: 'cancelled', review: { ...(req.review || {}), cancelledAt: now }, updatedAt: now };
  await adsStore.upsertAd(updated);
  Logger.audit('deals.promotion.cancel', { promotionId: id, actorId: actor.userId });
  return updated;
}

/**
 * Super Admin approval of a PROMOTION REQUEST (never of a Deal). Re-validates
 * against the current Deal: still active, still priced validly, period still
 * inside the (possibly shortened) deal window, no overlapping approved promotion.
 * Sponsored approval does NOT imply payment — it stays "awaiting fulfillment".
 */
export async function approvePromotionRequest(id: string, actor: AdsActor): Promise<AdRecord> {
  const req = loadPromotionRequestOr404(await adsStore.getAd(id));
  assertAdminNotOwner(req, actor);
  if (req.status !== 'pending') throw new AdsError(`Only pending requests can be approved (current: ${req.status})`, 409);
  const deal = await adsStore.getAd(req.dealId);
  if (!deal || deal.kind !== 'deal') throw new AdsError('The deal for this request no longer exists', 409);
  await assertDealPromotable(deal, 409);
  if (Date.parse(req.endsAt as string) <= Date.now()) throw new AdsError('The requested promotion period has already ended', 409);
  assertWithinDeal(deal, req.startsAt as string, req.endsAt as string, 409);
  const siblings = (await listDealPromotionRequests()).filter((r) => r.dealId === deal.id);
  assertNoApprovedPromotionOverlap(siblings, req.startsAt as string, req.endsAt as string, req.id);
  return approveAd(id, actor, {
    publish: false,
    allowDealPromotion: true,
    extra: { review: { ...(req.review || {}), decidedBy: actor.userId, decidedAt: nowIso() } },
  });
}

/** Rejection affects ONLY the request — the Deal stays exactly as it is. */
export async function rejectPromotionRequest(id: string, actor: AdsActor, reasonRaw: unknown): Promise<AdRecord> {
  const req = loadPromotionRequestOr404(await adsStore.getAd(id));
  assertAdminNotOwner(req, actor);
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (!reason) throw new AdsError('A rejection reason is required', 400);
  if (reason.length > REJECTION_REASON_MAX) {
    throw new AdsError(`Rejection reason must be at most ${REJECTION_REASON_MAX} characters`, 400);
  }
  if (req.status !== 'pending') throw new AdsError(`Only pending requests can be rejected (current: ${req.status})`, 409);
  return rejectAd(id, actor, reason, {
    allowDealPromotion: true,
    extra: {
      review: { ...(req.review || {}), decidedBy: actor.userId, decidedAt: nowIso(), rejectionReason: reason },
    },
  });
}

export type PromotionRequestView = AdRecord & {
  runState: PromotionRunState | null;
  deal?: DealView;
  /** Listing rating from real reviews (null when there are none). */
  listingRating: { average: number; count: number } | null;
};

function listingRatingFor(listingId: string | undefined): { average: number; count: number } | null {
  if (!listingId) return null;
  const ratings = operationsStore
    .listReviews()
    .filter((r) => r.productId === listingId && Number.isFinite(Number(r.rating)))
    .map((r) => Number(r.rating));
  if (ratings.length === 0) return null;
  return { average: Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)), count: ratings.length };
}

/** Admin: every deal-linked request. Seller: only their own. */
export async function listPromotionRequestViews(actor: AdsActor): Promise<PromotionRequestView[]> {
  const all = await listDealPromotionRequests();
  const rows = isPlatformAdmin(actor.role) ? all : all.filter((r) => r.ownerId === actor.userId);
  const now = Date.now();
  const views = await Promise.all(
    rows.map(async (r) => {
      const dealRow = await adsStore.getAd(r.dealId);
      const deal = dealRow && dealRow.kind === 'deal' ? await toDealView(dealRow, now, all) : undefined;
      return {
        ...r,
        runState: derivePromotionRunState(r, deal ? isDealLiveForPromotion(deal) : false, now),
        deal,
        listingRating: listingRatingFor(r.listingId),
      } as PromotionRequestView;
    }),
  );
  return views.sort((a, b) => (b.review?.submittedAt || b.createdAt).localeCompare(a.review?.submittedAt || a.createdAt));
}

export type DealEligibleListing = {
  id: string;
  listingType: DealListingType;
  title: string;
  image?: string;
  category?: string;
  brandName?: string;
  basePrice: number;
  status: string;
  selectable: boolean;
  reason?: string;
};

/** The seller's own real products + services for the Create Deal picker. */
export async function listDealEligibleListings(actor: AdsActor): Promise<DealEligibleListing[]> {
  if (!isSellerRole(actor.role)) return [];
  const uid = actor.userId;
  const [products, services] = await Promise.all([
    catalogStore.listProducts(),
    listServices(),
  ]);
  const shape = (
    listingType: DealListingType,
    row: { id: string; title?: string; image?: string; categoryName?: string; brandName?: string; price?: number; status?: string; media?: string[] },
  ): DealEligibleListing => {
    const basePrice = Number(row.price);
    const status = String(row.status || '');
    let reason: string | undefined;
    if (!isProductActive(status)) reason = 'Listing is not live';
    else if (!Number.isFinite(basePrice) || basePrice <= 1) reason = 'Listing has no valid base price';
    return {
      id: row.id,
      listingType,
      title: row.title || row.id,
      image: row.image || row.media?.[0],
      category: row.categoryName,
      brandName: row.brandName,
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
      status,
      selectable: !reason,
      reason,
    };
  };
  return [
    ...products.filter((p) => p.sellerId && p.sellerId === uid).map((p) => shape('product', p as never)),
    ...services.filter((s) => s.sellerId && s.sellerId === uid).map((s) => shape('service', s as never)),
  ];
}

async function assertListingOwned(listingId: string, actor: AdsActor): Promise<{
  id: string;
  title?: string;
  brandId?: string;
  image?: string;
  slug?: string;
  sellerId?: string;
  creatorId?: string;
}> {
  const product = await catalogStore.getProduct(listingId);
  if (!product) throw new AdsError('Listing not found', 404);
  if (isPlatformAdmin(actor.role)) return product;
  const uid = actor.userId;
  const sellerOwned = product.sellerId && product.sellerId === uid;
  const creatorOwned =
    (product as { creatorId?: string }).creatorId &&
    (product as { creatorId?: string }).creatorId === uid;
  if (!sellerOwned && !creatorOwned) {
    throw new AdsError('Not authorized for this listing', 403);
  }
  return product;
}

/**
 * Listing-first entry point. Same canonical path as createDeal: a request
 * carrying only a listing id (the legacy cms-mirror button) is rejected with
 * 400 before anything is written — no incomplete / unpriced / auto-approved Deal.
 */
export async function createDealFromListing(input: DealSubmission, actor: AdsActor): Promise<AdRecord> {
  return createDeal(input, actor);
}

export async function listOwnedEligibleListings(actor: AdsActor): Promise<
  Array<{ id: string; title: string; brandId?: string; image?: string; status?: string }>
> {
  const products = await catalogStore.listProducts();
  if (isPlatformAdmin(actor.role)) {
    return products.map((p) => ({
      id: p.id,
      title: p.title || p.id,
      brandId: p.brandId,
      image: p.image,
      status: (p as { status?: string }).status,
    }));
  }
  const uid = actor.userId;
  return products
    .filter((p) => {
      if (p.sellerId && p.sellerId === uid) return true;
      if ((p as { creatorId?: string }).creatorId === uid) return true;
      return false;
    })
    .map((p) => ({
      id: p.id,
      title: p.title || p.id,
      brandId: p.brandId,
      image: p.image,
      status: (p as { status?: string }).status,
    }));
}

const OWNER_EDITABLE_STATUSES = new Set<AdsStatus>(['draft', 'pending']);

export async function updateOwnAd(
  id: string,
  actor: AdsActor,
  patch: Partial<
    Pick<
      AdRecord,
      | 'title'
      | 'creative'
      | 'cta'
      | 'externalUrl'
      | 'placement'
      | 'placementId'
      | 'formatId'
      | 'pageKey'
      | 'listingId'
      | 'brandId'
      | 'startsAt'
      | 'endsAt'
      | 'metadata'
    >
  > & { status?: AdsStatus },
): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  if (ad.kind === 'deal') {
    // Deals have their own validated edit path (ownership, pricing, schedule; no status/metadata).
    throw new AdsError('Edit deals via PATCH /ads/deals/:id', 400);
  }
  if (isDealPromotionRequest(ad)) {
    throw new AdsError('Deal promotion requests cannot be edited; cancel and submit a new request', 400);
  }
  if (!isPlatformAdmin(actor.role) && ad.ownerId !== actor.userId) {
    throw new AdsError('Not authorized', 403);
  }
  if (!isPlatformAdmin(actor.role) && !OWNER_EDITABLE_STATUSES.has(ad.status)) {
    throw new AdsError('Only draft or pending requests can be edited', 403);
  }
  // Clients cannot force active/approved status via PATCH
  if (patch.status !== undefined && !isPlatformAdmin(actor.role)) {
    throw new AdsError('Cannot set status directly', 403);
  }
  if (patch.status === 'active' || patch.status === 'approved') {
    if (!isPlatformAdmin(actor.role)) {
      throw new AdsError('Cannot force active status', 403);
    }
  }

  const nextFormat = patch.formatId !== undefined ? patch.formatId : ad.formatId;
  const nextPlacement = patch.placementId !== undefined ? patch.placementId : ad.placementId;
  const nextPage = patch.pageKey !== undefined ? patch.pageKey : ad.pageKey;
  if (ad.kind === 'banner' || ad.kind === 'external') {
    validateBannerPlacement(
      {
        ownerId: ad.ownerId,
        ownerRole: ad.ownerRole,
        title: ad.title,
        kind: ad.kind,
        formatId: nextFormat,
        placementId: nextPlacement,
        pageKey: nextPage,
      },
      actor.role,
      true,
    );
  }

  if (patch.externalUrl !== undefined) {
    assertSafeExternalUrl(patch.externalUrl);
  }

  let creative = patch.creative !== undefined ? patch.creative : ad.creative;
  const listingId = patch.listingId !== undefined ? patch.listingId : ad.listingId;
  if (listingId && (nextFormat === 'deal_of_the_day' || patch.listingId)) {
    creative = await hydrateListingCreative(listingId, creative, actor);
  }
  if (
    nextFormat === 'category_promoted_slot' &&
    (patch.creative !== undefined || patch.formatId !== undefined || !ad.creative?.categoryId)
  ) {
    creative = await resolveCategoryPromotedCreative(nextFormat, creative);
  }
  if (patch.creative !== undefined || nextFormat === 'hero_banner') {
    creative = normalizeCreativeMedia(creative, nextFormat);
  }

  const updated: AdRecord = {
    ...ad,
    title: patch.title !== undefined ? String(patch.title).trim() || ad.title : ad.title,
    creative,
    cta: patch.cta !== undefined ? patch.cta : ad.cta,
    externalUrl:
      patch.externalUrl !== undefined ? assertSafeExternalUrl(patch.externalUrl) : ad.externalUrl,
    placement:
      patch.placement !== undefined
        ? patch.placement
        : patch.placementId !== undefined
          ? patch.placementId
          : ad.placement,
    placementId: nextPlacement,
    formatId: nextFormat,
    pageKey: nextPage || getPlacementDef(nextPlacement || '')?.pageKey || ad.pageKey,
    listingId,
    brandId: patch.brandId !== undefined ? patch.brandId : ad.brandId,
    startsAt: patch.startsAt !== undefined ? patch.startsAt : ad.startsAt,
    endsAt: patch.endsAt !== undefined ? patch.endsAt : ad.endsAt,
    metadata: patch.metadata !== undefined ? patch.metadata : ad.metadata,
    // Non-admins never change status via this path
    status: isPlatformAdmin(actor.role) && patch.status ? patch.status : ad.status,
    updatedAt: nowIso(),
  };
  await adsStore.upsertAd(updated);
  Logger.audit('ads.update', {
    adId: updated.id,
    actorId: actor.userId,
    status: updated.status,
  });
  return updated;
}

export async function deleteOwnAd(id: string, actor: AdsActor): Promise<{ id: string }> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  if (ad.kind === 'deal') {
    // Deals are never deleted by admins (disable instead). The owning seller may
    // withdraw a deal only before it starts; active deals use End Now (history kept).
    if (ad.ownerId !== actor.userId || !isSellerRole(actor.role)) {
      throw new AdsError('Deals cannot be deleted; disable instead', 403);
    }
    if (isLegacyDeal(ad)) throw new AdsError('Legacy deals are read-only', 403);
    if (deriveDealTimeState(ad) !== 'scheduled') {
      throw new AdsError('Only scheduled deals can be withdrawn — use End Now for an active deal', 403);
    }
    // A Scheduled deal is stored `active` (enabled), so skip the generic
    // draft/pending-only rule below — the deal rules above are authoritative.
    await adsStore.deleteAd(id);
    Logger.audit('deals.withdraw', { dealId: id, actorId: actor.userId });
    return { id };
  }
  if (isDealPromotionRequest(ad)) {
    throw new AdsError('Cancel promotion requests via POST /ads/promotion-requests/:id/cancel', 400);
  }
  if (!isPlatformAdmin(actor.role) && ad.ownerId !== actor.userId) {
    throw new AdsError('Not authorized', 403);
  }
  if (!isPlatformAdmin(actor.role) && !OWNER_EDITABLE_STATUSES.has(ad.status)) {
    throw new AdsError('Only draft or pending requests can be cancelled', 403);
  }
  await adsStore.deleteAd(id);
  Logger.audit('ads.delete', {
    adId: id,
    actorId: actor.userId,
    previousStatus: ad.status,
  });
  return { id };
}

export async function createPromotion(
  input: Omit<CreateAdInput, 'kind'> & { kind?: 'promotion' },
  actor: AdsActor,
): Promise<AdRecord> {
  const status: AdsStatus = input.asDraft ? 'draft' : 'pending';
  const row = await createBase(
    {
      ...input,
      ownerId: input.ownerId || actor.userId,
      ownerRole: input.ownerRole || toOwnerRole(actor.role),
      kind: 'promotion',
    },
    status,
    actor.role,
  );
  if (status === 'pending') {
    emitMarketplace('PromotionRequested', row.id, actor.userId, {
      promotionId: row.id,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
    });
  }
  return row;
}

export async function createBanner(
  input: Omit<CreateAdInput, 'kind'> & { kind?: AdsKind },
  actor: AdsActor,
): Promise<AdRecord> {
  const kind: AdsKind =
    input.kind === 'external' || input.externalUrl ? 'external' : 'banner';

  // Sellers/creators cannot self-publish; admin may publishNow.
  let status: AdsStatus = input.asDraft ? 'draft' : 'pending';
  if (input.publishNow) {
    if (!isPlatformAdmin(actor.role)) {
      throw new AdsError('Only admin can publish ads directly', 403);
    }
    status = 'active';
  }

  let creative = await hydrateListingCreative(input.listingId, input.creative, actor);
  creative = await resolveCategoryPromotedCreative(input.formatId, creative);
  const pageKey = input.pageKey || getPlacementDef(input.placementId || '')?.pageKey;

  const row = await createBase(
    {
      ...input,
      ownerId: input.ownerId || actor.userId,
      ownerRole: input.ownerRole || toOwnerRole(actor.role),
      kind,
      creative: normalizeCreativeMedia(creative, input.formatId),
      pageKey,
    },
    status,
    actor.role,
    { requirePlacement: true },
  );
  if (status === 'pending') {
    emitMarketplace('AdSubmitted', row.id, actor.userId, {
      adId: row.id,
      kind: row.kind,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
      formatId: row.formatId,
      placementId: row.placementId,
    });
  }
  if (status === 'active') {
    emitMarketplace('AdPublished', row.id, actor.userId, {
      adId: row.id,
      kind: row.kind,
      status: row.status,
      ownerId: row.ownerId,
      formatId: row.formatId,
      placementId: row.placementId,
    });
  }
  return row;
}

export async function submitAdForApproval(id: string, actor: AdsActor): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  if (!isPlatformAdmin(actor.role) && ad.ownerId !== actor.userId) {
    throw new AdsError('Not authorized', 403);
  }
  if (ad.kind === 'deal') {
    throw new AdsError('Deals do not require approval', 400);
  }
  if (isDealPromotionRequest(ad)) {
    throw new AdsError('Deal promotion requests are submitted when created', 400);
  }
  if (ad.status !== 'draft') {
    throw new AdsError('Only draft ads can be submitted for approval', 400);
  }
  if (ad.kind === 'banner' || ad.kind === 'external') {
    validateBannerPlacement(
      {
        ownerId: ad.ownerId,
        ownerRole: ad.ownerRole,
        title: ad.title,
        kind: ad.kind,
        formatId: ad.formatId,
        placementId: ad.placementId,
        pageKey: ad.pageKey,
      },
      actor.role,
      true,
    );
    if (ad.formatId === 'category_promoted_slot') {
      await resolveCategoryPromotedCreative(ad.formatId, ad.creative);
    }
  }
  const updated: AdRecord = { ...ad, status: 'pending', updatedAt: nowIso() };
  await adsStore.upsertAd(updated);
  emitMarketplace('AdSubmitted', updated.id, actor.userId, {
    adId: updated.id,
    kind: updated.kind,
    ownerId: updated.ownerId,
    title: updated.title,
    status: updated.status,
  });
  return updated;
}

export async function pauseAd(id: string, actor: AdsActor): Promise<AdRecord> {
  if (!isPlatformAdmin(actor.role)) throw new AdsError('Admin role required', 403);
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  if (ad.kind === 'deal') assertDealTransition(ad, 'pause');
  if (isDealPromotionRequest(ad)) throw new AdsError('Deal promotion requests cannot be paused', 400);
  const updated: AdRecord = { ...ad, status: 'paused', updatedAt: nowIso() };
  await adsStore.upsertAd(updated);
  Logger.audit('ads.pause', { adId: id, actorId: actor.userId });
  return updated;
}

export async function archiveAd(id: string, actor: AdsActor): Promise<AdRecord> {
  if (!isPlatformAdmin(actor.role)) throw new AdsError('Admin role required', 403);
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  if (ad.kind === 'deal') assertDealTransition(ad, 'disable');
  if (isDealPromotionRequest(ad)) throw new AdsError('Deal promotion requests cannot be disabled; reject or cancel them', 400);
  const updated: AdRecord = { ...ad, status: 'disabled', updatedAt: nowIso() };
  await adsStore.upsertAd(updated);
  Logger.audit('ads.archive', { adId: id, actorId: actor.userId });
  return updated;
}

export async function listDeals(actor: AdsActor): Promise<AdRecord[]> {
  const rows = await adsStore.listAds({ kind: 'deal' });
  if (isPlatformAdmin(actor.role)) return rows;
  return rows.filter((r) => r.ownerId === actor.userId);
}

export async function listPromotions(actor: AdsActor): Promise<AdRecord[]> {
  const rows = await adsStore.listAds({ kind: 'promotion' });
  if (isPlatformAdmin(actor.role)) return rows;
  return rows.filter((r) => r.ownerId === actor.userId);
}

export async function listBanners(actor: AdsActor): Promise<AdRecord[]> {
  const rows = await adsStore.listAds();
  const banners = rows.filter((r) => r.kind === 'banner' || r.kind === 'external');
  if (isPlatformAdmin(actor.role)) return banners;
  return banners.filter((r) => r.ownerId === actor.userId);
}

export async function listAdminQueue(actor: AdsActor): Promise<AdRecord[]> {
  if (!isPlatformAdmin(actor.role)) throw new AdsError('Admin role required', 403);
  return adsStore.listAds({ statuses: ['pending', 'draft'] });
}

export async function approveAd(
  id: string,
  actor: AdsActor,
  opts?: { publish?: boolean; allowDealPromotion?: boolean; extra?: Partial<AdRecord> },
): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  assertAdminNotOwner(ad, actor);
  // Deals are open marketplace inventory — they are never approved.
  if (ad.kind === 'deal') throw new AdsError('Deals do not require approval', 400);
  // Deal-linked promotion requests are decided only via approvePromotionRequest (re-validation).
  if (isDealPromotionRequest(ad) && !opts?.allowDealPromotion) {
    throw new AdsError('Approve deal promotion requests via POST /ads/promotion-requests/:id/approve', 400);
  }

  const publish = opts?.publish !== false;
  const nextStatus: AdsStatus = publish ? 'active' : 'approved';
  const updated: AdRecord = {
    ...ad,
    ...(opts?.extra || {}),
    status: nextStatus,
    updatedAt: nowIso(),
    metadata: {
      ...(ad.metadata || {}),
      approvedBy: actor.userId,
      approvedAt: nowIso(),
    },
  };
  await adsStore.upsertAd(updated);

  Logger.audit('ads.approve', {
    adId: updated.id,
    kind: updated.kind,
    actorId: actor.userId,
    ownerId: updated.ownerId,
    status: updated.status,
  });

  emitMarketplace('AdApproved', updated.id, actor.userId, {
    adId: updated.id,
    kind: updated.kind,
    status: updated.status,
    ownerId: updated.ownerId,
  });

  if (publish) {
    emitMarketplace('AdPublished', updated.id, actor.userId, {
      adId: updated.id,
      kind: updated.kind,
      status: updated.status,
      ownerId: updated.ownerId,
    });
  }

  return updated;
}

export async function rejectAd(
  id: string,
  actor: AdsActor,
  reason?: string,
  opts?: { allowDealPromotion?: boolean; extra?: Partial<AdRecord> },
): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  assertAdminNotOwner(ad, actor);
  if (ad.kind === 'deal') throw new AdsError('Deals do not require approval', 400);
  if (isDealPromotionRequest(ad) && !opts?.allowDealPromotion) {
    throw new AdsError('Reject deal promotion requests via POST /ads/promotion-requests/:id/reject', 400);
  }

  const updated: AdRecord = {
    ...ad,
    ...(opts?.extra || {}),
    status: 'rejected',
    updatedAt: nowIso(),
    metadata: {
      ...(ad.metadata || {}),
      rejectedBy: actor.userId,
      rejectedAt: nowIso(),
      rejectReason: reason || '',
    },
  };
  await adsStore.upsertAd(updated);

  Logger.audit('ads.reject', {
    adId: updated.id,
    kind: updated.kind,
    actorId: actor.userId,
    ownerId: updated.ownerId,
    reason: reason || '',
  });

  emitMarketplace('AdRejected', updated.id, actor.userId, {
    adId: updated.id,
    kind: updated.kind,
    status: updated.status,
    ownerId: updated.ownerId,
    reason: reason || '',
  });

  return updated;
}

export async function getAdForActor(id: string, actor: AdsActor): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  assertCanView(ad, actor);
  return ad;
}
