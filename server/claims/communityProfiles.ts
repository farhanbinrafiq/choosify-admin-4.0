import type { Request } from 'express';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../catalogContract';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { CREATOR_SOCIAL_PLATFORM_KEYS, creatorSocialLinkProblem, type CreatorSocialPlatform } from '../../shared/creatorProfileRules';
import type { CatalogBrand } from '../../src/types/catalog';
import type { CatalogCreator } from '../../lib/vercel-catalog/catalogEditorialTypes';
import { ClaimError, ownerOf, recordAudit, type ClaimEntityType } from './ownershipClaims';
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
        overview: input.location ? { address: String(input.location).trim() } : {},
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
