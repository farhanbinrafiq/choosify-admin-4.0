/**
 * Brand Studio editor model — pure mappers, no React.
 *
 * Mirrors productEditorModel.ts: a single source of truth for
 *   CatalogBrand + catalog products/deals  ⇄  BrandCMSModel (presentation model)
 * and the ONE canonical write path (`brandModelToCanonicalPatch`) that every
 * inline section save goes through.
 *
 * The prior Brand Studio only PATCHed { name, category, description, logo, faq,
 * stores, promoCodes } — so coverImage / tagline / website / socialLinks /
 * story / storyVideoUrl / overview / credentials never persisted. This module
 * sends the full canonical set; `normalizeBrandInput` + the PATCH route already
 * merge-and-preserve everything else, and `preserveBrandPrivilegedFieldsOnUpdate`
 * keeps verifiedStatus / claimStatus / marketplaceAccess / followers / ratings /
 * featured / sponsored owned by the platform.
 */
import type {
  BrandCMSModel,
  BrandServiceCenterEntry,
  BrandStoreEntry,
} from './brandSeeds';
import type { CatalogBrand, CatalogProduct } from '../../types/catalog';

/** Storefront-parity Brand Studio editable sections (canonically backed). */
export type BrandEditSection =
  | 'identity' // name, category, tagline, website, social links
  | 'cover' // coverImage
  | 'logo' // logo
  | 'deals' // pinnedProductIds — seller-curated spotlight products for the Deals section
  | 'products' // pinnedShowcaseProductIds — seller-curated order for the Products grid
  // Brand Overview — each storefront card is its own inline-editable box:
  | 'brandAbout' // description
  | 'brandAddress' // overview.address + website + overview.mapLink
  | 'brandContact' // overview.email + overview.phone
  | 'brandAudience' // overview.priceRange + ageFocus + audience
  | 'brandServices' // overview.services[]
  | 'brandTags' // overview.tags[]
  | 'credentials' // credentials (guarantees / certifications)
  | 'stores' // stores{authorized,distributors,serviceCenters}
  | 'faq' // faq[]
  | 'story'; // storyBlocks + storyVideoUrl + pinnedStoryContentIds

/** Every section the storefront renders — editable ones plus preview-only ones. */
export type BrandProfileSectionKey =
  | BrandEditSection
  | 'products'
  | 'deals'
  | 'creators'
  | 'reviews';

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export type StoryMediaKind =
  | 'youtube'
  | 'youtube_shorts'
  | 'instagram_reel'
  | 'instagram_post'
  | 'tiktok'
  | 'facebook'
  | 'other';

/** Auto-detect the media/platform of a story link from its URL. */
export function detectStoryMediaKind(url: string): StoryMediaKind {
  const u = (url || '').toLowerCase();
  if (!u) return 'other';
  if (/\/shorts\//.test(u)) return 'youtube_shorts';
  if (/(?:^|\.)youtube\.com|youtu\.be|youtube-nocookie\.com/.test(u)) return 'youtube';
  if (/instagram\.com\/reels?\//.test(u)) return 'instagram_reel';
  if (/instagram\.com\/(?:p|tv)\//.test(u)) return 'instagram_post';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook';
  return 'other';
}

/** Aspect the storefront should render a story card's media in. */
export function storyMediaAspect(kind: StoryMediaKind): 'landscape' | 'portrait' | 'square' {
  if (kind === 'youtube_shorts' || kind === 'instagram_reel' || kind === 'tiktok') return 'portrait';
  if (kind === 'instagram_post') return 'square';
  return 'landscape';
}

/** Resolve the effective media kind + aspect for a story block (explicit override wins over URL auto-detect). */
export function resolveStoryMedia(
  block: { url?: string; mediaKind?: StoryMediaKind },
): { kind: StoryMediaKind; aspect: 'landscape' | 'portrait' | 'square' } {
  const kind = block.mediaKind || detectStoryMediaKind(block.url || '');
  return { kind, aspect: storyMediaAspect(kind) };
}

export function createBlankBrandModel(id: string, name: string, category: string): BrandCMSModel {
  return {
    id,
    brandName: name,
    slug: '',
    logo: '',
    coverImage: '',
    tagline: '',
    category,
    socialFbUrl: '',
    socialInstaUrl: '',
    socialTiktokUrl: '',
    socialYtUrl: '',
    customSocials: [],
    website: '',
    description: '',
    missionStatement: '',
    brandStory: '',
    storyBlocks: [],
    pinnedStoryContentIds: [],
    marketplaceAccess: true,
    marketplaceStatus: undefined,
    claimState: 'community',
    verifiedOwner: false,
    storyVideoUrl: '',
    credentials: '',
    values: '',
    verificationStatus: 'Standard',
    status: 'DRAFT',
    choosifyScore: 0,
    qualityScore: 0,
    serviceScore: 0,
    deliveryScore: 0,
    packagingScore: 0,
    recommendationScore: 0,
    verifiedPurchasePercentage: 0,
    returnRate: '0%',
    complaintRate: '0%',
    responseTime: 'N/A',
    followersCount: 0,
    logoUrl: '',
    recentTrustAlerts: [],
    products: [],
    deals: [],
    promoCodes: [],
    pinnedProductIds: [],
    pinnedShowcaseProductIds: [],
    creators: [],
    reviews: [],
    team: [],
    stores: { authorized: [], distributors: [], serviceCenters: [] },
    faq: [],
    address: '',
    contactEmail: '',
    phone: '',
    mapLink: '',
    audienceType: '',
    ageRange: '',
    genderFocus: '',
    priceRange: '',
    services: [],
    specialties: [],
    bestForTags: [],
    returnPolicy: '',
    warrantyInfo: '',
    deliveryCoverage: '',
    customerServiceHours: '',
    visibility: {
      overview: true,
      products: true,
      featuredProducts: true,
      deals: true,
      promoCodes: true,
      creatorReviews: true,
      publicReviews: true,
      trustSection: true,
      brandInformation: true,
    },
  };
}

export function mapCatalogBrandToModel(brand: CatalogBrand): BrandCMSModel {
  const blank = createBlankBrandModel(brand.id, brand.name || '', brand.category || '');
  const ov = brand.overview || {};
  const social = brand.socialLinks || {};
  const stores = brand.stores || {};
  const withId = <T extends { name: string }>(rows: T[] | undefined, prefix: string) =>
    (rows || []).map((row, i) => ({
      id: `${prefix}-${i}`,
      name: row.name,
      sub: ('sub' in row ? String((row as { sub?: string }).sub || '') : '') as string,
      ...('hours' in row ? { hours: String((row as { hours?: string }).hours || '') } : {}),
    }));

  return {
    ...blank,
    brandName: brand.name || '',
    slug: brand.slug || '',
    logo: brand.logo || '',
    logoUrl: brand.logo || '',
    coverImage: brand.coverImage || '',
    tagline: brand.tagline || '',
    category: brand.category || '',
    website: brand.website || '',
    description: brand.description || '',
    brandStory: brand.story || '',
    // Brand Story sections are curated links + your own published content only —
    // narrative prose lives in the "About This Brand" overview box. Legacy
    // free-text blocks / the old single `story` string are not surfaced for
    // editing (the storefront still renders `story` as a fallback paragraph).
    storyBlocks: Array.isArray(brand.storyBlocks)
      ? brand.storyBlocks
          .filter((b) => b && (b.kind === 'link' || b.kind === 'content'))
          .map((b, i) => ({
            id: b.id || `sb-${i}`,
            heading: b.heading || '',
            body: b.body || '',
            kind: (b.kind === 'content' ? 'content' : 'link') as 'link' | 'content',
            ...(b.url ? { url: b.url } : {}),
            ...(b.thumbnail ? { thumbnail: b.thumbnail } : {}),
            ...(b.contentId ? { contentId: b.contentId } : {}),
            ...(b.mediaKind ? { mediaKind: b.mediaKind } : {}),
          }))
      : [],
    // The editor's "pinned stories" quick-list = pinned content ids that aren't
    // already authored as a `content` story section (those are edited as blocks).
    pinnedStoryContentIds: (() => {
      const blockIds = new Set(
        (Array.isArray(brand.storyBlocks) ? brand.storyBlocks : [])
          .filter((b) => b && b.kind === 'content' && b.contentId)
          .map((b) => String(b.contentId)),
      );
      return (Array.isArray(brand.pinnedStoryContentIds) ? brand.pinnedStoryContentIds : [])
        .map(String)
        .filter((id) => id && !blockIds.has(id));
    })(),
    storyVideoUrl: brand.storyVideoUrl || '',
    credentials: brand.credentials || '',
    socialFbUrl: social.facebook || '',
    socialInstaUrl: social.instagram || '',
    socialTiktokUrl: social.tiktok || '',
    socialYtUrl: social.youtube || '',
    customSocials: Array.isArray(social.custom)
      ? social.custom
          .filter((c) => c && (c.label || c.url))
          .map((c, i) => ({ id: `soc-${i}`, label: c.label || '', url: c.url || '' }))
      : [],
    verificationStatus: brand.verifiedStatus
      ? 'Verified'
      : brand.claimStatus === 'pending'
        ? 'Suspended'
        : 'Standard',
    status: brand.marketplaceAccess ? 'LIVE' : 'DRAFT',
    // Preview-only platform state — drives the seller-only Studio status strip;
    // never rendered on the public storefront and never written back.
    marketplaceAccess: brand.marketplaceAccess ?? true,
    marketplaceStatus: brand.marketplaceStatus,
    claimState: brand.claimStatus,
    verifiedOwner: !!brand.verifiedStatus,
    choosifyScore: typeof brand.ratings === 'number' && brand.ratings > 0 ? brand.ratings : 0,
    followersCount: typeof brand.followers === 'number' ? brand.followers : 0,
    address: ov.address || '',
    mapLink: ov.mapLink || '',
    contactEmail: ov.email || '',
    phone: ov.phone || '',
    priceRange: ov.priceRange || '',
    ageRange: ov.ageFocus || '',
    audienceType: ov.audience || '',
    services: Array.isArray(ov.services) ? ov.services : [],
    bestForTags: Array.isArray(ov.tags) ? ov.tags : [],
    faq: (brand.faq || []).map((f, i) => ({ id: `faq-${i}`, q: f.q || '', a: f.a || '' })),
    stores: {
      authorized: withId(stores.authorized, 'auth') as BrandStoreEntry[],
      distributors: withId(stores.distributors, 'dist') as BrandStoreEntry[],
      serviceCenters: withId(stores.serviceCenters, 'svc') as BrandServiceCenterEntry[],
    },
    promoCodes: (brand.promoCodes || []).map((p) => ({
      id: p.id,
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startDate: p.startDate,
      endDate: p.endDate,
      usageLimit: p.usageLimit,
      enabled: p.enabled,
    })),
    pinnedProductIds: Array.isArray(brand.pinnedProductIds)
      ? brand.pinnedProductIds.map(String).filter(Boolean)
      : [],
    pinnedShowcaseProductIds: Array.isArray(brand.pinnedShowcaseProductIds)
      ? brand.pinnedShowcaseProductIds.map(String).filter(Boolean)
      : [],
  };
}

export function mapCatalogProductToItem(p: CatalogProduct): BrandCMSModel['products'][number] {
  const statusRaw = String(p.status || '').toLowerCase();
  const status =
    statusRaw === 'live' || statusRaw === 'active'
      ? 'Live'
      : statusRaw === 'archived' || statusRaw === 'hidden'
        ? 'Hidden'
        : 'Draft';
  return {
    id: p.id,
    name: p.title || 'Untitled',
    sku: (p as { sku?: string }).sku || p.id,
    category: p.categoryName || '',
    price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
    stock: typeof p.stock === 'number' ? p.stock : Number(p.stock) || 0,
    featured: Boolean(p.featuredFlag),
    status,
    thumbnail: p.image || (Array.isArray(p.gallery) && p.gallery[0] ? p.gallery[0] : ''),
  };
}

/**
 * The ONE canonical write path for a Brand Studio save.
 *
 * Only SELLER-owned fields are emitted; the platform-owned fields
 * (verifiedStatus / claimStatus / marketplaceAccess / followers / ratings /
 * featuredFlag / sponsoredFlag / promoCodes) are intentionally omitted so the
 * PATCH route's merge + `preserveBrandPrivilegedFieldsOnUpdate` keep them.
 *
 * Empty strings are sent for cleared optional fields — `normalizeBrandInput`
 * collapses `'' || undefined` so an explicit clear works, while an OMITTED key
 * is preserved from `existing`. `name` is only sent when non-empty (a brand
 * must always have a name).
 */
export function brandModelToCanonicalPatch(m: BrandCMSModel): Partial<CatalogBrand> {
  const rows = (list: BrandStoreEntry[] | undefined) =>
    (list || [])
      .filter((r) => s(r.name))
      .map((r) => ({ name: s(r.name), ...(s(r.sub) ? { sub: s(r.sub) } : {}) }));
  const svcRows = (list: BrandServiceCenterEntry[] | undefined) =>
    (list || [])
      .filter((r) => s(r.name))
      .map((r) => ({
        name: s(r.name),
        ...(s(r.sub) ? { sub: s(r.sub) } : {}),
        ...(s(r.hours) ? { hours: s(r.hours) } : {}),
      }));

  const patch: Partial<CatalogBrand> = {
    category: s(m.category),
    description: s(m.description),
    logo: s(m.logo || m.logoUrl || ''),
    coverImage: s(m.coverImage),
    tagline: s(m.tagline),
    website: s(m.website),
    socialLinks: {
      facebook: s(m.socialFbUrl),
      instagram: s(m.socialInstaUrl),
      youtube: s(m.socialYtUrl),
      tiktok: s(m.socialTiktokUrl),
      custom: (m.customSocials || [])
        .map((c) => ({ label: s(c.label), url: s(c.url) }))
        .filter((c) => c.label && c.url),
    },
    storyBlocks: (m.storyBlocks || [])
      .map((b, i) => {
        const kind: 'text' | 'link' | 'content' =
          b.kind === 'link' || b.kind === 'content' ? b.kind : 'text';
        return {
          id: b.id || `sb-${i}`,
          heading: s(b.heading),
          body: s(b.body),
          kind,
          ...(kind === 'link' && s(b.url) ? { url: s(b.url) } : {}),
          ...(kind === 'link' && s(b.thumbnail) ? { thumbnail: s(b.thumbnail) } : {}),
          ...(kind === 'content' && s(b.contentId) ? { contentId: s(b.contentId) } : {}),
          ...(b.mediaKind ? { mediaKind: b.mediaKind } : {}),
        };
      })
      .filter(
        (b) =>
          (b.kind === 'text' && (b.heading || b.body)) ||
          (b.kind === 'link' && b.url) ||
          (b.kind === 'content' && b.contentId),
      ),
    // Legacy single `story` — first text section's body so non-adopting readers show content.
    story: s(
      (m.storyBlocks || []).find((b) => (b.kind || 'text') === 'text')?.body || m.brandStory,
    ),
    // Seller-pinned published content — explicit pin list ∪ every `content` story
    // section's contentId (server recomputes the same union).
    pinnedStoryContentIds: Array.from(
      new Set([
        ...(m.pinnedStoryContentIds || []).map((x) => s(x)).filter(Boolean),
        ...(m.storyBlocks || [])
          .filter((b) => b.kind === 'content' && s(b.contentId))
          .map((b) => s(b.contentId)),
      ]),
    ).slice(0, 16),
    storyVideoUrl: s(m.storyVideoUrl),
    credentials: s(m.credentials),
    overview: {
      address: s(m.address),
      mapLink: s(m.mapLink),
      email: s(m.contactEmail),
      phone: s(m.phone),
      priceRange: s(m.priceRange),
      ageFocus: s(m.ageRange),
      audience: s(m.audienceType),
      services: (m.services || []).map(s).filter(Boolean),
      tags: (m.bestForTags || []).map(s).filter(Boolean),
    },
    faq: (m.faq || [])
      .filter((f) => s(f.q) || s(f.a))
      .map((f) => ({ q: s(f.q), a: s(f.a) })),
    pinnedProductIds: Array.from(new Set((m.pinnedProductIds || []).map((x) => s(x)).filter(Boolean))).slice(0, 12),
    pinnedShowcaseProductIds: Array.from(
      new Set((m.pinnedShowcaseProductIds || []).map((x) => s(x)).filter(Boolean)),
    ).slice(0, 24),
    stores: {
      authorized: rows(m.stores?.authorized),
      distributors: rows(m.stores?.distributors),
      serviceCenters: svcRows(m.stores?.serviceCenters),
    },
  };
  const name = s(m.brandName);
  if (name) patch.name = name;
  return patch;
}
