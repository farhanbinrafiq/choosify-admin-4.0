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
import { adsStore } from './adsStore';
import type {
  AdRecord,
  AdsKind,
  AdsOwnerRole,
  AdsStatus,
  CreateAdInput,
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

/** Deals are auto-approved (and activated) on seller/creator submit. */
export async function createDeal(
  input: Omit<CreateAdInput, 'kind'> & { kind?: 'deal' },
  actor: AdsActor,
): Promise<AdRecord> {
  const ownerRole = input.ownerRole || toOwnerRole(actor.role);
  const row = await createBase(
    {
      ...input,
      ownerId: input.ownerId || actor.userId,
      ownerRole,
      kind: 'deal',
    },
    'approved',
    actor.role,
  );
  // Auto-publish after approval
  const active: AdRecord = { ...row, status: 'active', updatedAt: nowIso() };
  await adsStore.upsertAd(active);
  emitMarketplace('DealCreated', active.id, actor.userId, {
    dealId: active.id,
    ownerId: active.ownerId,
    listingId: active.listingId,
    brandId: active.brandId,
    title: active.title,
    status: active.status,
  });
  return active;
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

export async function createDealFromListing(
  listingId: string,
  actor: AdsActor,
  extras?: { title?: string; metadata?: Record<string, unknown> },
): Promise<AdRecord> {
  const product = await assertListingOwned(listingId, actor);
  return createDeal(
    {
      ownerId: actor.userId,
      ownerRole: toOwnerRole(actor.role),
      listingId: product.id,
      brandId: product.brandId,
      title: (extras?.title || product.title || 'Deal').trim(),
      creative: product.image ? { imageUrl: product.image, headline: product.title } : undefined,
      metadata: {
        ...(extras?.metadata || {}),
        source: 'from-listing',
        productSlug: product.slug,
      },
    },
    actor,
  );
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
  const updated: AdRecord = { ...ad, status: 'paused', updatedAt: nowIso() };
  await adsStore.upsertAd(updated);
  Logger.audit('ads.pause', { adId: id, actorId: actor.userId });
  return updated;
}

export async function archiveAd(id: string, actor: AdsActor): Promise<AdRecord> {
  if (!isPlatformAdmin(actor.role)) throw new AdsError('Admin role required', 403);
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
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
  opts?: { publish?: boolean },
): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  assertAdminNotOwner(ad, actor);

  const publish = opts?.publish !== false;
  const nextStatus: AdsStatus = publish ? 'active' : 'approved';
  const updated: AdRecord = {
    ...ad,
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
): Promise<AdRecord> {
  const ad = await adsStore.getAd(id);
  if (!ad) throw new AdsError('Ad not found', 404);
  assertAdminNotOwner(ad, actor);

  const updated: AdRecord = {
    ...ad,
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
