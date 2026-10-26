import type { Request } from 'express';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../catalogContract';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { CREATOR_SOCIAL_PLATFORM_KEYS, creatorSocialLinkProblem, type CreatorSocialPlatform } from '../../shared/creatorProfileRules';
import type { CatalogBrand } from '../../src/types/catalog';
import type { CatalogCreator } from '../../lib/vercel-catalog/catalogEditorialTypes';
import { ClaimError, activeOwnershipClaims, entityLockKeys, loadEntity, ownerOf, recordAudit, type ClaimEntityType } from './ownershipClaims';
import { withRecordLocks } from '../catalog/recordLock';
import { slugForAutomatedCreation } from '../publicHandles/publicHandleCatalog';

/**
 * Community profiles — public-information discovery profiles for real brands /
 * creators that have not joined Choosify yet. Created only by staff, with no
 * owner, no seller/creator account, no CF-ID, no representative and no
 * Marketplace (selling) access. Claimable by the real owner.
 */

export function isCommunityOwnerlessBrand(b: Pick<CatalogBrand, 'origin' | 'sellerId'> | null | undefined): boolean {
  return Boolean(b && b.origin === 'community' && !b.sellerId);
}

const normName = (v: string) => v.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

export function websiteDomain(raw: string | undefined | null): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** host + first path segment, lower-cased (facebook.com/abcbrand). */
function socialKey(raw: string | undefined | null): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    const seg = u.pathname.split('/').filter(Boolean)[0] || '';
    return `${u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')}/${seg.toLowerCase()}`;
  } catch {
    return '';
  }
}

function socialKeysOf(links: Record<string, unknown> | undefined): string[] {
  if (!links) return [];
  const keys: string[] = [];
  for (const k of CREATOR_SOCIAL_PLATFORM_KEYS) {
    const key = socialKey(links[k] as string);
    if (key && key.split('/')[1]) keys.push(key);
  }
  return keys;
}

/** Same normalized name, or one contains the other and covers most of it ("abc" vs "abc bd"). */
function namesLookAlike(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short) && short.length / long.length >= 0.6;
}

/**
 * Public DISCOVERY visibility of a brand profile. A claimed community profile
 * stays discoverable at the same URL until staff make an explicit Marketplace
 * Access decision — but that does NOT make its products public or publishable
 * (products keep using brandIsMarketplaceVisible).
 */
export function brandProfileIsDiscoverable(b: CatalogBrand, marketplaceVisible: (b: CatalogBrand) => boolean): boolean {
  if (marketplaceVisible(b)) return true;
  return b.origin === 'community' && !b.marketplaceStatus && b.marketplaceAccess !== false;
}

export type DuplicateMatch = { id: string; name: string; slug: string; matchedOn: Array<'name' | 'website' | 'social'>; owned: boolean };

/** Possible duplicates — warnings only; nothing is ever merged automatically. */
export async function findCommunityDuplicates(input: {
  type: ClaimEntityType;
  name?: string;
  website?: string;
  socialLinks?: Record<string, unknown>;
  excludeId?: string;
}): Promise<DuplicateMatch[]> {
  const name = normName(String(input.name || ''));
  const domain = websiteDomain(input.website);
  const socials = new Set(socialKeysOf(input.socialLinks));
  const rows: Array<CatalogBrand | CatalogCreator> = input.type === 'brand' ? await catalogStore.listBrands() : await catalogStore.listCreators();
  const out: DuplicateMatch[] = [];
  for (const r of rows) {
    if (r.id === input.excludeId) continue;
    const matchedOn: DuplicateMatch['matchedOn'] = [];
    const rn = normName(r.name || '');
    if (name && rn && namesLookAlike(name, rn)) matchedOn.push('name');
    const rWebsite = input.type === 'brand' ? (r as CatalogBrand).website : '';
    if (domain && websiteDomain(rWebsite) === domain) matchedOn.push('website');
    if (socials.size && socialKeysOf(r.socialLinks as Record<string, unknown> | undefined).some((k) => socials.has(k))) matchedOn.push('social');
    if (matchedOn.length) out.push({ id: r.id, name: r.name, slug: r.slug, matchedOn, owned: Boolean(ownerOf(input.type, r)) });
  }
  return out.slice(0, 20);
}

export type CommunityProfileInput = {
  type: ClaimEntityType;
  name: string;
  categoryId?: string;
  description?: string;
  overview?: string;
  logo?: string;
  coverImage?: string;
  website?: string;
  socialLinks?: Record<string, unknown>;
  location?: string;
  /** "Best for #tags" — brand overview.tags / creator bestForTags. */
  tags?: unknown;
  /** Brand price range text (overview.priceRange), e.g. "৳1,000 – ৳20,000". Brands only. */
  priceRange?: string;
  publish?: boolean;
  acknowledgeDuplicates?: boolean;
};

function cleanSocialLinks(raw: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CREATOR_SOCIAL_PLATFORM_KEYS) {
    const v = String(raw?.[k] || '').trim();
    if (!v) continue;
    const problem = creatorSocialLinkProblem(k as CreatorSocialPlatform, v);
    if (problem) throw new ClaimError(400, 'INVALID_SOCIAL_LINK', `${k}: ${problem}`);
    out[k] = v;
  }
  return out;
}

/** Trimmed, "#"-free, de-duplicated tags (max 15, 40 chars each). */
function cleanTags(raw: unknown): string[] {
  const out: string[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    const v = String(t ?? '').replace(/\s+/g, ' ').trim().replace(/^#+/, '').trim().slice(0, 40);
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out.slice(0, 15);
}

/** Short single-line price range text (max 60 chars). */
const cleanPriceRange = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

const httpUrl = (v: string | undefined, field: string): string => {
  const t = String(v || '').trim();
  if (!t) return '';
  if (!/^https?:\/\//i.test(t) && !t.startsWith('/')) throw new ClaimError(400, 'INVALID_URL', `${field} must be an http(s) URL`);
  return t;
};

/**
 * Create a community profile (staff only — caller checks cms:edit). Returns the
 * duplicate list instead of creating when likely duplicates exist and the
 * admin has not acknowledged them.
 */
export async function createCommunityProfile(
  req: Request,
  input: CommunityProfileInput,
): Promise<{ created: CatalogBrand | CatalogCreator | null; duplicates: DuplicateMatch[] }> {
  const name = String(input.name || '').trim();
  if (name.length < 2) throw new ClaimError(400, 'NAME_REQUIRED', 'A name is required');
  const socialLinks = cleanSocialLinks(input.socialLinks);
  const website = httpUrl(input.website, 'Website');
  const duplicates = await findCommunityDuplicates({ type: input.type, name, website, socialLinks });
  if (duplicates.length && !input.acknowledgeDuplicates) return { created: null, duplicates };

  let categoryLabel = '';
  if (input.categoryId) {
    const cat = (await catalogStore.listCategories()).find((c) => c.id === input.categoryId);
    if (!cat) throw new ClaimError(400, 'INVALID_CATEGORY', 'Choose a category from Category Management');
    categoryLabel = cat.name;
  } else if (input.type === 'brand') {
    throw new ClaimError(400, 'CATEGORY_REQUIRED', 'Choose the brand category');
  }

  const provenance = { origin: 'community' as const, createdByStaffId: req.userId, claimStatus: 'community' as const, verifiedStatus: false };
  if (input.type === 'brand') {
    const existingSlugs = (await catalogStore.listBrands()).map((b) => b.slug);
    const brand = normalizeBrandInput(
      {
        name,
        category: categoryLabel,
        categoryId: input.categoryId,
        description: String(input.description || '').trim(),
        tagline: '',
        logo: httpUrl(input.logo, 'Logo'),
        coverImage: httpUrl(input.coverImage, 'Cover image'),
        website,
        socialLinks,
        story: String(input.overview || '').trim(),
        overview: {
          ...(input.location ? { address: String(input.location).trim() } : {}),
          ...(cleanPriceRange(input.priceRange) ? { priceRange: cleanPriceRange(input.priceRange) } : {}),
          tags: cleanTags(input.tags),
        },
        followers: 0,
        ratings: 0,
        featuredFlag: false,
        sponsoredFlag: false,
        promoCodes: [],
        faq: [],
        ...provenance,
      },
      undefined,
      { existingBrandSlugs: existingSlugs },
    );
    // Public Identity: never reuse another profile's public handle as the slug.
    brand.slug = await slugForAutomatedCreation('brand', brand.slug, brand.id);
    const saved = await catalogStore.upsertBrand({ ...brand, sellerId: undefined });
    recordAudit(req, {
      action: 'community_profile_created',
      targetType: 'brand',
      targetId: saved.id,
      targetName: saved.name,
      refs: { via: 'community_form', ...(duplicates.length ? { acknowledgedDuplicates: duplicates.map((d) => d.id).join(',') } : {}) },
    });
    return { created: saved, duplicates };
  }

  const id = `creator-${Date.now()}`;
  const creator = normalizeCreatorInput({
    id,
    name,
    category: categoryLabel || undefined,
    bio: String(input.description || '').trim(),
    avatar: httpUrl(input.logo, 'Profile photo'),
    coverImage: httpUrl(input.coverImage, 'Cover image'),
    socialLinks,
    location: String(input.location || '').trim() || undefined,
    bestForTags: cleanTags(input.tags),
    status: input.publish === false ? 'draft' : 'live',
    followers: {},
    score: 0,
    ...provenance,
  });
  creator.slug = await slugForAutomatedCreation('creator', creator.slug, creator.id);
  const saved = await catalogStore.upsertCreator({ ...creator, userId: undefined });
  recordAudit(req, {
    action: 'community_profile_created',
    targetType: 'creator',
    targetId: saved.id,
    targetName: saved.name,
    refs: { via: 'community_form', ...(duplicates.length ? { acknowledgedDuplicates: duplicates.map((d) => d.id).join(',') } : {}) },
  });
  return { created: saved, duplicates };
}

/** A staff-editable community profile: created by staff and still without an owner. */
function assertStaffManaged(type: ClaimEntityType, entity: CatalogBrand | CatalogCreator | null): CatalogBrand | CatalogCreator {
  if (!entity) throw new ClaimError(404, 'PROFILE_NOT_FOUND', 'This profile does not exist.');
  if (entity.origin !== 'community') throw new ClaimError(409, 'NOT_COMMUNITY_PROFILE', 'Only community profiles can be managed here.');
  if (ownerOf(type, entity)) {
    throw new ClaimError(409, 'PROFILE_OWNED', 'This profile has been claimed — its owner manages it now. Use the regular Brand / Creator tools.');
  }
  return entity;
}

/** Edit a community profile (staff only — caller checks cms:edit). Only the fields sent change; the public slug never does. */
export async function updateCommunityProfile(
  req: Request,
  type: ClaimEntityType,
  id: string,
  input: Omit<CommunityProfileInput, 'type' | 'publish' | 'acknowledgeDuplicates'>,
): Promise<CatalogBrand | CatalogCreator> {
  return withRecordLocks(entityLockKeys(type, id), async () => {
    const existing = assertStaffManaged(type, await loadEntity(type, id));
    const sent = (k: keyof typeof input) => input[k] !== undefined;
    const name = sent('name') ? String(input.name || '').trim() : existing.name;
    if (name.length < 2) throw new ClaimError(400, 'NAME_REQUIRED', 'A name is required');
    const socialLinks = sent('socialLinks') ? cleanSocialLinks(input.socialLinks) : (existing.socialLinks as Record<string, string>) || {};
    let saved: CatalogBrand | CatalogCreator;
    if (type === 'brand') {
      const brand = existing as CatalogBrand;
      let category = brand.category;
      let categoryId = brand.categoryId;
      if (input.categoryId && input.categoryId !== brand.categoryId) {
        const cat = (await catalogStore.listCategories()).find((c) => c.id === input.categoryId);
        if (!cat) throw new ClaimError(400, 'INVALID_CATEGORY', 'Choose a category from Category Management');
        category = cat.name;
        categoryId = cat.id;
      }
      const next = normalizeBrandInput(
        {
          ...brand,
          name,
          category,
          categoryId,
          description: sent('description') ? String(input.description || '').trim() : brand.description,
          logo: sent('logo') ? httpUrl(input.logo, 'Logo') : brand.logo,
          coverImage: sent('coverImage') ? httpUrl(input.coverImage, 'Cover image') : brand.coverImage,
          website: sent('website') ? httpUrl(input.website, 'Website') : brand.website,
          socialLinks,
          overview: sent('location') ? { ...(brand.overview || {}), address: String(input.location || '').trim() } : brand.overview,
        },
        brand,
      );
      // The brand normalizer keeps the old tags when given an empty list, so set the edited list explicitly.
      if (sent('tags')) next.overview = { ...(next.overview || {}), tags: cleanTags(input.tags) } as typeof next.overview;
      // Same for the price range: an empty value clears it.
      if (sent('priceRange')) {
        const { priceRange: _old, ...rest } = (next.overview || {}) as Record<string, unknown>;
        const pr = cleanPriceRange(input.priceRange);
        next.overview = (pr ? { ...rest, priceRange: pr } : rest) as typeof next.overview;
      }
      saved = await catalogStore.upsertBrand({ ...next, slug: brand.slug, sellerId: undefined });
    } else {
      const creator = existing as CatalogCreator;
      const next = normalizeCreatorInput(
        {
          ...creator,
          name,
          bio: sent('description') ? String(input.description || '').trim() : creator.bio,
          avatar: sent('logo') ? httpUrl(input.logo, 'Profile photo') : creator.avatar,
          coverImage: sent('coverImage') ? httpUrl(input.coverImage, 'Cover image') : creator.coverImage,
          socialLinks,
          location: sent('location') ? String(input.location || '').trim() || undefined : creator.location,
          bestForTags: sent('tags') ? cleanTags(input.tags) : creator.bestForTags,
        },
        creator,
      );
      saved = await catalogStore.upsertCreator({ ...next, slug: creator.slug, userId: undefined });
    }
    recordAudit(req, { action: 'community_profile_updated', targetType: type, targetId: id, targetName: name, refs: { via: 'community_form' } });
    return saved;
  });
}

/** Delete an unclaimed community profile (staff only). Refused while it has an owner or an open claim. */
export async function deleteCommunityProfile(req: Request, type: ClaimEntityType, id: string): Promise<{ name: string }> {
  return withRecordLocks(entityLockKeys(type, id), async () => {
    const existing = assertStaffManaged(type, await loadEntity(type, id));
    if (activeOwnershipClaims(type, id).length) {
      throw new ClaimError(409, 'CLAIM_IN_PROGRESS', 'An ownership claim for this profile is open. Close or decide the claim before deleting the profile.');
    }
    if (type === 'brand') await catalogStore.deleteBrand(id);
    else await catalogStore.deleteCreator(id);
    recordAudit(req, { action: 'community_profile_deleted', targetType: type, targetId: id, targetName: existing.name, refs: { via: 'community_form' } });
    return { name: existing.name };
  });
}
