import { z } from 'zod';
/**
 * Authoritative write-side catalog contract for runtime (used by server/catalogRouter).
 * lib/vercel-catalog/catalogContract.ts remains for site-config helpers and must not
 * silently diverge for Product/Brand ownership or lifecycle fields — prefer this module.
 */
import type {
  CatalogBrand,
  CatalogBrandPost,
  CatalogCategory,
  CatalogDeal,
  CatalogDealsBanner,
  CatalogProduct,
  HomepageConfig,
  HomepageHeroBanner,
  HomepageSectionConfig,
} from '../src/types/catalog';
import { parseProductStatusInput } from './catalog/productLifecycle';

const nonEmpty = z.string().trim().min(1);
const isoDate = z.string().datetime();

const nowIso = () => new Date().toISOString();

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/** Append a short unique suffix when `base` already exists in `takenSlugs`. */
export const ensureUniqueSlug = (base: string, takenSlugs: Iterable<string>): string => {
  const normalized = slugify(base) || 'item';
  const taken = new Set(takenSlugs);
  if (!taken.has(normalized)) return normalized;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix =
      attempt === 0
        ? Date.now().toString(36).slice(-5)
        : Math.random().toString(36).slice(2, 7);
    const candidate = `${normalized}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${normalized}-${Date.now().toString(36)}`;
};

export type ProductNormalizeContext = {
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  /** Slugs already used by other products (exclude the product being updated). */
  existingProductSlugs?: string[];
};

export type BrandNormalizeContext = {
  /** Slugs already used by other brands (exclude the brand being updated). */
  existingBrandSlugs?: string[];
};

const toString = (value: unknown, fallback?: string): string =>
  typeof value === 'string' ? value : fallback ?? '';

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(normalized)) return normalized;
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

/**
 * A product video is one canonical source. Accepts:
 *  - an app-owned upload path (`/media/...`, produced by POST /catalog/media/upload),
 *  - a YouTube URL (youtube.com / youtu.be / *.youtube-nocookie.com),
 *  - a direct HTTPS video file URL (.mp4 / .webm / .mov / .m4v).
 * Anything else is rejected so the storefront never gets a link it cannot render.
 * `undefined` in the payload keeps the existing value; an empty string clears it.
 */
export const normalizeProductVideoUrl = (raw: unknown, existing?: string): string | undefined => {
  if (raw === undefined || raw === null) return existing || undefined;
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return undefined;
  if (s.startsWith('/media/')) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error('Product video must be a valid absolute URL or an uploaded /media path.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Product video URL must use https.');
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const isYouTube =
    host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com';
  const isDirectFile = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname);
  if (!isYouTube && !isDirectFile) {
    throw new Error('Unsupported product video URL. Use a YouTube link or a direct .mp4/.webm/.mov URL.');
  }
  return url.toString();
};

const categorySchema = z.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  description: z.string(),
  icon: z.string(),
  parentId: z.string().nullable(),
  enabled: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const brandSchema = z.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  category: z.string(),
  description: z.string(),
  logo: z.string(),
  coverImage: z.string().optional(),
  tagline: z.string().optional(),
  website: z.string().optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      youtube: z.string().optional(),
      tiktok: z.string().optional(),
      linkedin: z.string().optional(),
      custom: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
    })
    .optional(),
  story: z.string().optional(),
  storyBlocks: z
    .array(
      z.object({
        id: z.string(),
        heading: z.string(),
        body: z.string(),
        kind: z.enum(['text', 'link', 'content']).optional(),
        url: z.string().optional(),
        thumbnail: z.string().optional(),
        contentId: z.string().optional(),
        mediaKind: z
          .enum([
            'youtube',
            'youtube_shorts',
            'instagram_reel',
            'instagram_post',
            'tiktok',
            'facebook',
            'other',
          ])
          .optional(),
      }),
    )
    .optional(),
  pinnedStoryContentIds: z.array(z.string()).optional(),
  /** HTTPS URL for brand story / creator-review embed on storefront */
  storyVideoUrl: z.string().optional(),
  credentials: z.string().optional(),
  overview: z
    .object({
      address: z.string().optional(),
      mapLink: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      priceRange: z.string().optional(),
      ageFocus: z.string().optional(),
      audience: z.string().optional(),
      services: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  stores: z
    .object({
      authorized: z.array(z.object({ name: z.string(), sub: z.string().optional() })).optional(),
      distributors: z.array(z.object({ name: z.string(), sub: z.string().optional() })).optional(),
      serviceCenters: z
        .array(z.object({ name: z.string(), sub: z.string().optional(), hours: z.string().optional() }))
        .optional(),
    })
    .optional(),
  promoCodes: z
    .array(
      z.object({
        id: nonEmpty,
        code: z.string(),
        discountType: z.enum(['Percentage', 'Flat']),
        discountValue: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        usageLimit: z.number(),
        enabled: z.boolean(),
      }),
    )
    .optional(),
  pinnedProductIds: z.array(z.string()).optional(),
  pinnedShowcaseProductIds: z.array(z.string()).optional(),
  verifiedStatus: z.boolean(),
  claimStatus: z.enum(['community', 'pending', 'verified']),
  followers: z.number().nonnegative(),
  ratings: z.number().min(0).max(5),
  qualityScore: z.number().min(0).max(5).optional(),
  valueScore: z.number().min(0).max(5).optional(),
  supportScore: z.number().min(0).max(5).optional(),
  featuredFlag: z.boolean(),
  sponsoredFlag: z.boolean(),
  /** Owning seller user id when brand is seller-managed; omitted for platform/legacy rows. */
  sellerId: z.string().optional(),
  /** Public storefront visibility. Seller drafts default false. */
  marketplaceAccess: z.boolean().optional(),
  /** ES-005 Marketplace Access lifecycle state; marketplaceAccess is kept in sync with it. */
  marketplaceStatus: z
    .enum(['not_granted', 'granted', 'restricted', 'suspended', 'restored', 'revoked'])
    .optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const productSchema = z.object({
  id: nonEmpty,
  slug: nonEmpty,
  title: nonEmpty,
  description: z.string(),
  brandId: nonEmpty,
  brandName: z.string(),
  categoryId: nonEmpty,
  categoryName: z.string(),
  image: nonEmpty,
  gallery: z.array(z.string()),
  videoUrl: z.string().optional(),
  modeType: z.literal('retail'),
  productType: z.enum(['physical', 'service']).optional(),
  serviceCategory: z
    .enum([
      'hotels',
      'restaurants',
      'travel',
      'doctors',
      'education',
      'beauty',
      'real_estate',
      'transport',
      'events',
      'tickets',
      'home_services',
      'gov_services',
      'recruitment',
      'b2b',
      'rental',
      'donation',
    ])
    .optional(),
  relatedInfoType: z.enum(['price_across_stores', 'whats_nearby', 'before_your_visit']).optional(),
  priceAcrossStoresEnabled: z.boolean().optional(),
  partialPaymentEnabled: z.boolean().optional(),
  depositPercent: z.number().optional(),
  requiredBookingFieldKeys: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  stock: z.number().int(),
  /** Optional seller-supplied product code / SKU / article number. Free-form. */
  sku: z.string().optional(),
  /** `live` = legacy Active; also accepts ES-005 states. */
  status: z.enum(['draft', 'live', 'active', 'out_of_stock', 'suspended', 'archived']),
  warrantyMonths: z.number().int().nonnegative().optional(),
  warrantyType: z.string().optional(),
  warrantyProvider: z.string().optional(),
  warrantyTerms: z.string().optional(),
  tags: z.array(z.string()),
  isDeal: z.boolean(),
  dealType: z.enum(['flash', 'seasonal', 'brand', 'promo', 'clearance']).optional(),
  discountPercent: z.number().nonnegative().optional(),
  promoCode: z.string().optional(),
  dealValidUntil: z.string().optional(),
  featuredFlag: z.boolean(),
  isNewArrival: z.boolean(),
  isBestseller: z.boolean(),
  /** Firebase uid of owning seller when listing is seller-managed; omitted for legacy/admin rows. */
  sellerId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const dealSchema = z.object({
  id: nonEmpty,
  slug: nonEmpty,
  name: nonEmpty,
  seller: z.string(),
  category: z.string(),
  status: z.enum(['live', 'pending', 'expiring', 'expired', 'rejected', 'draft']),
  type: z.literal('retail'),
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.number().nonnegative(),
  promoCode: z.string().optional(),
  productId: z.string().optional(),
  brandId: z.string().optional(),
  clicks: z.number().nonnegative(),
  validFrom: isoDate,
  validUntil: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const heroBannerSchema = z.object({
  id: nonEmpty,
  headline: z.string(),
  subtitle: z.string(),
  ctaText: z.string(),
  ctaUrl: z.string(),
  backgroundImage: z.string(),
  isActive: z.boolean(),
  order: z.number().int(),
});

const dealsBannerSchema = z.object({
  id: nonEmpty,
  image: z.string(),
  destinationType: z.enum(['product', 'brand', 'custom-url']),
  destinationRef: z.string(),
  order: z.number().int(),
  isActive: z.boolean(),
  brandName: z.string().optional(),
  brandLogoUrl: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const sectionSchema = z.object({
  id: nonEmpty,
  label: z.string(),
  isVisible: z.boolean(),
  order: z.number().int(),
  itemIds: z.array(z.string()),
});

const homepageSchema = z.object({
  id: z.literal('default'),
  heroBanners: z.array(heroBannerSchema),
  dealsBanners: z.array(dealsBannerSchema).default([]),
  sections: z.array(sectionSchema),
  featuredProductIds: z.array(z.string()),
  featuredBrandIds: z.array(z.string()),
  featuredDealIds: z.array(z.string()),
  featuredCreatorIds: z.array(z.string()),
  featuredGuideIds: z.array(z.string()),
  updatedAt: isoDate,
});

const existingOrNow = (existingDate?: string) => (existingDate ? existingDate : nowIso());

export const normalizeCategoryInput = (
  payload: unknown,
  existing?: CatalogCategory
): CatalogCategory => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Category');
  const id = toString(raw.id, existing?.id ?? `cat-${Date.now()}`);
  const normalized = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    description: toString(raw.description, existing?.description ?? ''),
    icon: toString(raw.icon, existing?.icon ?? 'Folder'),
    parentId:
      raw.parentId === null
        ? null
        : toString(raw.parentId, existing?.parentId ?? '') || null,
    enabled: toBoolean(raw.enabled, existing?.enabled ?? true),
    displayOrder: Math.floor(toNumber(raw.displayOrder, existing?.displayOrder ?? 0)),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  return categorySchema.parse(normalized) as CatalogCategory;
};

export const normalizeBrandInput = (
  payload: unknown,
  existing?: CatalogBrand,
  context?: BrandNormalizeContext,
): CatalogBrand => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Brand');
  const id = toString(raw.id, existing?.id ?? `brand-${Date.now()}`);
  const claimStatusRaw = toString(raw.claimStatus, existing?.claimStatus ?? 'community');
  const requestedSlug = toString(raw.slug, existing?.slug ?? slugify(name || id));
  const takenSlugs = (context?.existingBrandSlugs ?? []).filter(
    (slug) => !existing || slug !== existing.slug,
  );
  const slug = ensureUniqueSlug(requestedSlug, takenSlugs);
  const socialRaw =
    raw.socialLinks && typeof raw.socialLinks === 'object'
      ? (raw.socialLinks as Record<string, unknown>)
      : null;
  const overviewRaw =
    raw.overview && typeof raw.overview === 'object' ? (raw.overview as Record<string, unknown>) : null;
  const normalized: CatalogBrand = {
    id,
    slug,
    name,
    category: toString(raw.category, existing?.category ?? 'General'),
    description: toString(raw.description, existing?.description ?? ''),
    logo: toString(raw.logo, existing?.logo ?? ''),
    coverImage: toString(raw.coverImage, existing?.coverImage ?? '') || undefined,
    tagline: toString(raw.tagline, existing?.tagline ?? '') || undefined,
    website: toString(raw.website, existing?.website ?? '') || undefined,
    socialLinks:
      socialRaw || existing?.socialLinks
        ? {
            facebook: toString(socialRaw?.facebook, existing?.socialLinks?.facebook ?? '') || undefined,
            instagram: toString(socialRaw?.instagram, existing?.socialLinks?.instagram ?? '') || undefined,
            youtube: toString(socialRaw?.youtube, existing?.socialLinks?.youtube ?? '') || undefined,
            tiktok: toString(socialRaw?.tiktok, existing?.socialLinks?.tiktok ?? '') || undefined,
            linkedin: toString(socialRaw?.linkedin, existing?.socialLinks?.linkedin ?? '') || undefined,
            custom: (() => {
              const src = Array.isArray(socialRaw?.custom)
                ? (socialRaw!.custom as unknown[])
                : socialRaw && 'custom' in socialRaw
                  ? [] // explicit empty from client ⇒ clear
                  : existing?.socialLinks?.custom;
              if (!Array.isArray(src)) return undefined;
              const rows = src
                .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
                .map((r) => ({
                  label: toString(r.label).trim().slice(0, 40),
                  url: toString(r.url).trim().slice(0, 500),
                }))
                .filter((r) => r.label && r.url)
                .slice(0, 10);
              return rows.length ? rows : undefined;
            })(),
          }
        : undefined,
    story: toString(raw.story, existing?.story ?? '') || undefined,
    storyBlocks: (() => {
      if (!Array.isArray(raw.storyBlocks)) return existing?.storyBlocks;
      return (raw.storyBlocks as unknown[])
        .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
        .map((b, i) => {
          const kindRaw = toString(b.kind);
          const kind: 'text' | 'link' | 'content' =
            kindRaw === 'link' || kindRaw === 'content' ? kindRaw : 'text';
          const url = toString(b.url).trim().slice(0, 500);
          const thumbnail = toString(b.thumbnail).trim().slice(0, 500);
          const contentId = toString(b.contentId).trim().slice(0, 80);
          const mkRaw = toString(b.mediaKind);
          const MK = new Set([
            'youtube',
            'youtube_shorts',
            'instagram_reel',
            'instagram_post',
            'tiktok',
            'facebook',
            'other',
          ]);
          return {
            id: toString(b.id) || `sb-${i}`,
            heading: toString(b.heading).trim().slice(0, 120),
            body: toString(b.body).trim().slice(0, 4000),
            kind,
            ...(kind === 'link' && url ? { url } : {}),
            ...(kind === 'link' && thumbnail ? { thumbnail } : {}),
            ...(kind === 'content' && contentId ? { contentId } : {}),
            ...(MK.has(mkRaw) ? { mediaKind: mkRaw as 'youtube' } : {}),
          };
        })
        .filter(
          (b) =>
            (b.kind === 'text' && (b.heading || b.body)) ||
            (b.kind === 'link' && b.url) ||
            (b.kind === 'content' && b.contentId),
        )
        .slice(0, 16);
    })(),
    pinnedStoryContentIds: (() => {
      // Seller-pinned published content in the Brand Story section — the union of
      // any explicit pin list and every `content` story section's contentId.
      const hasBlocks = Array.isArray(raw.storyBlocks);
      const hasExplicit = Array.isArray(raw.pinnedStoryContentIds);
      if (!hasBlocks && !hasExplicit) return existing?.pinnedStoryContentIds;
      const explicit = hasExplicit
        ? (raw.pinnedStoryContentIds as unknown[]).map((v) => toString(v).trim()).filter(Boolean)
        : [];
      const fromBlocks = hasBlocks
        ? (raw.storyBlocks as unknown[])
            .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
            .filter((b) => toString(b.kind) === 'content')
            .map((b) => toString(b.contentId).trim())
            .filter(Boolean)
        : [];
      return Array.from(new Set([...explicit, ...fromBlocks])).slice(0, 16);
    })(),
    storyVideoUrl: toString(raw.storyVideoUrl, existing?.storyVideoUrl ?? '') || undefined,
    credentials: toString(raw.credentials, existing?.credentials ?? '') || undefined,
    overview:
      overviewRaw || existing?.overview
        ? {
            address: toString(overviewRaw?.address, existing?.overview?.address ?? '') || undefined,
            mapLink: toString(overviewRaw?.mapLink, existing?.overview?.mapLink ?? '') || undefined,
            email: toString(overviewRaw?.email, existing?.overview?.email ?? '') || undefined,
            phone: toString(overviewRaw?.phone, existing?.overview?.phone ?? '') || undefined,
            priceRange: toString(overviewRaw?.priceRange, existing?.overview?.priceRange ?? '') || undefined,
            ageFocus: toString(overviewRaw?.ageFocus, existing?.overview?.ageFocus ?? '') || undefined,
            audience: toString(overviewRaw?.audience, existing?.overview?.audience ?? '') || undefined,
            services: toStringArray(overviewRaw?.services).length
              ? toStringArray(overviewRaw?.services)
              : existing?.overview?.services,
            tags: toStringArray(overviewRaw?.tags).length
              ? toStringArray(overviewRaw?.tags)
              : existing?.overview?.tags,
          }
        : undefined,
    faq: Array.isArray(raw.faq) ? (raw.faq as CatalogBrand['faq']) : existing?.faq,
    stores:
      raw.stores && typeof raw.stores === 'object'
        ? (raw.stores as CatalogBrand['stores'])
        : existing?.stores,
    promoCodes: Array.isArray(raw.promoCodes)
      ? (raw.promoCodes as CatalogBrand['promoCodes'])
      : existing?.promoCodes,
    pinnedProductIds: Array.isArray(raw.pinnedProductIds)
      ? Array.from(
          new Set(
            (raw.pinnedProductIds as unknown[])
              .map((v) => toString(v).trim())
              .filter(Boolean),
          ),
        ).slice(0, 12)
      : existing?.pinnedProductIds,
    pinnedShowcaseProductIds: Array.isArray(raw.pinnedShowcaseProductIds)
      ? Array.from(
          new Set(
            (raw.pinnedShowcaseProductIds as unknown[]).map((v) => toString(v).trim()).filter(Boolean),
          ),
        ).slice(0, 24)
      : existing?.pinnedShowcaseProductIds,
    verifiedStatus: toBoolean(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    claimStatus: claimStatusRaw === 'verified' || claimStatusRaw === 'pending' ? claimStatusRaw : 'community',
    followers: toNumber(raw.followers, existing?.followers ?? 0),
    ratings: Math.max(0, Math.min(5, toNumber(raw.ratings, existing?.ratings ?? 0))),
    qualityScore:
      raw.qualityScore !== undefined
        ? Math.max(0, Math.min(5, toNumber(raw.qualityScore, existing?.qualityScore ?? 0)))
        : existing?.qualityScore,
    valueScore:
      raw.valueScore !== undefined
        ? Math.max(0, Math.min(5, toNumber(raw.valueScore, existing?.valueScore ?? 0)))
        : existing?.valueScore,
    supportScore:
      raw.supportScore !== undefined
        ? Math.max(0, Math.min(5, toNumber(raw.supportScore, existing?.supportScore ?? 0)))
        : existing?.supportScore,
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    sponsoredFlag: toBoolean(raw.sponsoredFlag, existing?.sponsoredFlag ?? false),
    sellerId: toString(raw.sellerId, existing?.sellerId ?? '') || undefined,
    marketplaceAccess:
      typeof raw.marketplaceAccess === 'boolean'
        ? raw.marketplaceAccess
        : typeof existing?.marketplaceAccess === 'boolean'
          ? existing.marketplaceAccess
          : undefined,
    marketplaceStatus:
      typeof raw.marketplaceStatus === 'string'
        ? (raw.marketplaceStatus as CatalogBrand['marketplaceStatus'])
        : existing?.marketplaceStatus,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  return brandSchema.parse(normalized);
};

export const normalizeProductInput = (
  payload: unknown,
  existing?: CatalogProduct,
  context?: ProductNormalizeContext,
): CatalogProduct => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title = toString(raw.title, toString(raw.name, existing?.title ?? 'Untitled Product'));
  const id = toString(raw.id, existing?.id ?? `prod-${Date.now()}`);
  const status = parseProductStatusInput(raw.status, existing?.status);

  const brandId = toString(raw.brandId, existing?.brandId ?? '');
  const categoryId = toString(raw.categoryId, existing?.categoryId ?? '');

  if (!brandId) {
    throw new Error('brandId is required and must reference an existing brand.');
  }
  if (!categoryId) {
    throw new Error('categoryId is required and must reference an existing category.');
  }

  const brands = context?.brands ?? [];
  const categories = context?.categories ?? [];
  const matchedBrand = brands.find((brand) => brand.id === brandId);
  const matchedCategory = categories.find((category) => category.id === categoryId);

  if (context && !matchedBrand) {
    throw new Error(`brandId "${brandId}" does not match an existing brand.`);
  }
  if (context && !matchedCategory) {
    throw new Error(`categoryId "${categoryId}" does not match an existing category.`);
  }

  const brandName = matchedBrand
    ? matchedBrand.name
    : toString(raw.brandName, toString(raw.brand, existing?.brandName ?? ''));
  const categoryName = matchedCategory
    ? matchedCategory.name
    : toString(raw.categoryName, toString(raw.category, existing?.categoryName ?? ''));

  const hasVariants =
    (Array.isArray(raw.productVariants) && raw.productVariants.length > 0) ||
    (Array.isArray(raw.variants) && raw.variants.length > 0) ||
    raw.hasVariants === true;

  const stockExplicitlyProvided =
    raw.stock !== undefined && raw.stock !== null && String(raw.stock).trim() !== '';

  let stock: number;
  if (stockExplicitlyProvided) {
    stock = Math.floor(toNumber(raw.stock, 0));
  } else if (existing?.stock !== undefined) {
    stock = existing.stock;
  } else if (!hasVariants) {
    throw new Error(
      'STOCK_REQUIRED: Provide an explicit stock value when the product has no variants. Stock was not defaulted to 0.',
    );
  } else {
    stock = 0;
  }

  const requestedSlug = toString(raw.slug, existing?.slug ?? slugify(title || id));
  const takenSlugs = (context?.existingProductSlugs ?? []).filter(
    (slug) => !existing || slug !== existing.slug,
  );
  const slug = ensureUniqueSlug(requestedSlug, takenSlugs);

  const normalized: CatalogProduct = {
    id,
    slug,
    title,
    description: toString(raw.description, existing?.description ?? ''),
    brandId,
    brandName,
    categoryId,
    categoryName,
    image: toString(raw.image, existing?.image ?? ''),
    gallery: toStringArray(raw.gallery).length > 0 ? toStringArray(raw.gallery) : existing?.gallery ?? [],
    videoUrl: normalizeProductVideoUrl(raw.videoUrl, existing?.videoUrl),
    modeType: 'retail',
    productType: (() => {
      const v = toString(raw.productType, existing?.productType);
      return v === 'physical' || v === 'service' ? v : undefined;
    })(),
    serviceCategory: (() => {
      const allowed = new Set([
        'hotels',
        'restaurants',
        'travel',
        'doctors',
        'education',
        'beauty',
        'real_estate',
        'transport',
        'events',
        'tickets',
        'home_services',
        'gov_services',
        'recruitment',
        'b2b',
        'rental',
        'donation',
      ]);
      const v = toString(raw.serviceCategory, existing?.serviceCategory);
      return allowed.has(v) ? (v as CatalogProduct['serviceCategory']) : undefined;
    })(),
    relatedInfoType: (() => {
      const v = toString(raw.relatedInfoType, existing?.relatedInfoType);
      return v === 'price_across_stores' || v === 'whats_nearby' || v === 'before_your_visit'
        ? v
        : undefined;
    })(),
    priceAcrossStoresEnabled:
      raw.priceAcrossStoresEnabled !== undefined
        ? toBoolean(raw.priceAcrossStoresEnabled)
        : existing?.priceAcrossStoresEnabled,
    partialPaymentEnabled:
      raw.partialPaymentEnabled !== undefined
        ? toBoolean(raw.partialPaymentEnabled)
        : existing?.partialPaymentEnabled,
    depositPercent:
      raw.depositPercent !== undefined ? toNumber(raw.depositPercent) : existing?.depositPercent,
    requiredBookingFieldKeys: toStringArray(raw.requiredBookingFieldKeys).length
      ? toStringArray(raw.requiredBookingFieldKeys)
      : existing?.requiredBookingFieldKeys,
    requiresApproval:
      raw.requiresApproval !== undefined ? toBoolean(raw.requiresApproval) : existing?.requiresApproval,
    price: toNumber(raw.price, existing?.price ?? 0),
    originalPrice:
      raw.originalPrice !== undefined
        ? toNumber(raw.originalPrice)
        : existing?.originalPrice,
    stock,
    status,
    sku: toString(raw.sku, existing?.sku) || undefined,
    warrantyMonths:
      raw.warrantyMonths !== undefined ? toNumber(raw.warrantyMonths) : existing?.warrantyMonths,
    warrantyType: toString(raw.warrantyType, existing?.warrantyType) || undefined,
    warrantyProvider: toString(raw.warrantyProvider, existing?.warrantyProvider) || undefined,
    warrantyTerms: toString(raw.warrantyTerms, existing?.warrantyTerms) || undefined,
    tags: toStringArray(raw.tags).length > 0 ? toStringArray(raw.tags) : existing?.tags ?? [],
    isDeal: toBoolean(raw.isDeal, existing?.isDeal ?? false),
    dealType: (() => {
      const v = toString(raw.dealType, existing?.dealType);
      return v === 'flash' || v === 'seasonal' || v === 'brand' || v === 'promo' || v === 'clearance'
        ? v
        : undefined;
    })(),
    discountPercent:
      raw.discountPercent !== undefined
        ? toNumber(raw.discountPercent)
        : existing?.discountPercent,
    promoCode: toString(raw.promoCode, existing?.promoCode),
    dealValidUntil: toString(raw.dealValidUntil, existing?.dealValidUntil),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    isNewArrival: toBoolean(raw.isNewArrival, existing?.isNewArrival ?? false),
    isBestseller: toBoolean(raw.isBestseller, existing?.isBestseller ?? false),
    sellerId: toString(raw.sellerId, existing?.sellerId) || undefined,
    attributes: (() => {
      if (raw.attributes && typeof raw.attributes === 'object' && !Array.isArray(raw.attributes)) {
        return raw.attributes as Record<string, unknown>;
      }
      return existing?.attributes;
    })(),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  assertOriginalPriceNotBelowPrice(normalized.originalPrice, normalized.price, 'Product');
  return productSchema.parse(normalized);
};

/**
 * Canonical pricing rule (variants sprint): a supplied MRP / strike price
 * (`originalPrice`) must be >= the selling `price`. Absent / null / 0 means "no
 * MRP" and is left alone — this only rejects a genuinely inconsistent pair so the
 * storefront never has to silently hide a negative discount.
 */
export function assertOriginalPriceNotBelowPrice(
  originalPrice: number | undefined | null,
  price: number | undefined | null,
  label = 'Listing',
): void {
  const op = typeof originalPrice === 'number' ? originalPrice : NaN;
  const p = typeof price === 'number' ? price : NaN;
  if (Number.isFinite(op) && op > 0 && Number.isFinite(p) && op < p) {
    throw new Error(
      `${label} originalPrice (${op}) cannot be lower than price (${p}). Leave it blank for no MRP.`,
    );
  }
}

export const normalizeDealInput = (payload: unknown, existing?: CatalogDeal): CatalogDeal => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Deal');
  const id = toString(raw.id, existing?.id ?? `deal-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? 'draft').toLowerCase();
  const discountTypeRaw = toString(raw.discountType, existing?.discountType ?? 'percentage').toLowerCase();
  const validUntil = toString(raw.validUntil, toString(raw.expiry, existing?.validUntil ?? nowIso()));
  const normalized: CatalogDeal = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    seller: toString(raw.seller, existing?.seller ?? 'Platform'),
    category: toString(raw.category, existing?.category ?? 'General'),
    status:
      statusRaw === 'live' ||
      statusRaw === 'pending' ||
      statusRaw === 'expiring' ||
      statusRaw === 'expired' ||
      statusRaw === 'rejected'
        ? statusRaw
        : 'draft',
    type: 'retail',
    discountType: discountTypeRaw === 'flat' ? 'flat' : 'percentage',
    discountValue: toNumber(raw.discountValue, toNumber(raw.discount, existing?.discountValue ?? 0)),
    promoCode: toString(raw.promoCode, existing?.promoCode),
    productId: toString(raw.productId, existing?.productId),
    brandId: toString(raw.brandId, existing?.brandId),
    clicks: toNumber(raw.clicks, existing?.clicks ?? 0),
    validFrom: toString(raw.validFrom, existing?.validFrom ?? nowIso()),
    validUntil,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  return dealSchema.parse(normalized);
};

const normalizeHeroBannerInput = (payload: unknown, idx: number): HomepageHeroBanner => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, `hero-${idx + 1}`);
  return heroBannerSchema.parse({
    id,
    headline: toString(raw.headline),
    subtitle: toString(raw.subtitle),
    ctaText: toString(raw.ctaText),
    ctaUrl: toString(raw.ctaUrl, '/products'),
    backgroundImage: toString(raw.backgroundImage),
    isActive: toBoolean(raw.isActive, true),
    order: Math.floor(toNumber(raw.order, idx)),
  });
};

export const normalizeDealsBannerInput = (
  payload: unknown,
  idx: number,
  existing?: CatalogDealsBanner,
): CatalogDealsBanner => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, existing?.id ?? `deals-banner-${Date.now()}-${idx}`);
  const typeRaw = toString(raw.destinationType, existing?.destinationType ?? 'custom-url').toLowerCase();
  const destinationType =
    typeRaw === 'product' || typeRaw === 'brand' || typeRaw === 'custom-url' ? typeRaw : 'custom-url';
  return dealsBannerSchema.parse({
    id,
    image: toString(raw.image, existing?.image ?? ''),
    destinationType,
    destinationRef: toString(raw.destinationRef, existing?.destinationRef ?? ''),
    order: Math.floor(toNumber(raw.order, existing?.order ?? idx)),
    isActive: toBoolean(raw.isActive, existing?.isActive ?? true),
    brandName: toString(raw.brandName, existing?.brandName ?? '') || undefined,
    brandLogoUrl: toString(raw.brandLogoUrl, existing?.brandLogoUrl ?? '') || undefined,
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  });
};

const normalizeSectionInput = (payload: unknown, idx: number): HomepageSectionConfig => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, `section-${idx + 1}`);
  return sectionSchema.parse({
    id,
    label: toString(raw.label, id),
    isVisible: toBoolean(raw.isVisible, true),
    order: Math.floor(toNumber(raw.order, idx)),
    itemIds: toStringArray(raw.itemIds),
  });
};

export const normalizeHomepageInput = (
  payload: unknown,
  existing?: HomepageConfig
): HomepageConfig => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const heroBannersInput = Array.isArray(raw.heroBanners) ? raw.heroBanners : existing?.heroBanners ?? [];
  const dealsBannersInput = Array.isArray(raw.dealsBanners)
    ? raw.dealsBanners
    : existing?.dealsBanners ?? [];
  const sectionsInput = Array.isArray(raw.sections) ? raw.sections : existing?.sections ?? [];

  const normalized: HomepageConfig = {
    id: 'default',
    heroBanners: heroBannersInput.map(normalizeHeroBannerInput),
    dealsBanners: dealsBannersInput.map((item, idx) => {
      const existingBanner = existing?.dealsBanners?.find(
        (b) => b.id === toString((item as Record<string, unknown>)?.id),
      );
      return normalizeDealsBannerInput(item, idx, existingBanner);
    }),
    sections: sectionsInput.map(normalizeSectionInput),
    featuredProductIds:
      toStringArray(raw.featuredProductIds).length > 0
        ? toStringArray(raw.featuredProductIds)
        : existing?.featuredProductIds ?? [],
    featuredBrandIds:
      toStringArray(raw.featuredBrandIds).length > 0
        ? toStringArray(raw.featuredBrandIds)
        : existing?.featuredBrandIds ?? [],
    featuredDealIds:
      toStringArray(raw.featuredDealIds).length > 0
        ? toStringArray(raw.featuredDealIds)
        : existing?.featuredDealIds ?? [],
    featuredCreatorIds:
      toStringArray(raw.featuredCreatorIds).length > 0
        ? toStringArray(raw.featuredCreatorIds)
        : existing?.featuredCreatorIds ?? [],
    featuredGuideIds:
      toStringArray(raw.featuredGuideIds).length > 0
        ? toStringArray(raw.featuredGuideIds)
        : existing?.featuredGuideIds ?? [],
    updatedAt: nowIso(),
  };

  return homepageSchema.parse(normalized);
};

const brandPostKindSchema = z.enum(['event', 'launch', 'festival', 'campaign', 'store_moment']);
const brandPostStatusSchema = z.enum(['scheduled', 'live', 'expired']);

const brandPostSchema = z.object({
  id: nonEmpty,
  slug: nonEmpty,
  brandId: nonEmpty,
  brandName: nonEmpty,
  brandLogo: z.string().optional(),
  kind: brandPostKindSchema,
  title: nonEmpty,
  excerpt: z.string(),
  heroImage: nonEmpty,
  bannerImages: z.array(z.string()).optional(),
  body: z.array(z.string()),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  linkedProductIds: z.array(z.string()).optional(),
  sponsored: z.boolean(),
  status: brandPostStatusSchema,
  publishedAt: z.string(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const normalizeBrandPostInput = (
  payload: unknown,
  existing?: CatalogBrandPost,
): CatalogBrandPost => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title = toString(raw.title, existing?.title ?? 'Untitled Post');
  const id = toString(raw.id, existing?.id ?? `bp-${Date.now()}`);
  const kindRaw = toString(raw.kind, existing?.kind ?? 'campaign');
  const statusRaw = toString(raw.status, existing?.status ?? 'scheduled');
  const kindParsed = brandPostKindSchema.safeParse(kindRaw);
  const statusParsed = brandPostStatusSchema.safeParse(statusRaw);
  const normalized = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(title || id)),
    brandId: toString(raw.brandId, existing?.brandId ?? ''),
    brandName: toString(raw.brandName, existing?.brandName ?? ''),
    brandLogo: toString(raw.brandLogo, existing?.brandLogo ?? '') || undefined,
    kind: kindParsed.success ? kindParsed.data : 'campaign',
    title,
    excerpt: toString(raw.excerpt, existing?.excerpt ?? ''),
    heroImage: toString(raw.heroImage, existing?.heroImage ?? ''),
    bannerImages: toStringArray(raw.bannerImages).length > 0 ? toStringArray(raw.bannerImages) : existing?.bannerImages,
    body: toStringArray(raw.body).length > 0 ? toStringArray(raw.body) : existing?.body ?? [],
    startDate: toString(raw.startDate, existing?.startDate ?? '') || undefined,
    endDate: toString(raw.endDate, existing?.endDate ?? '') || undefined,
    location: toString(raw.location, existing?.location ?? '') || undefined,
    ctaLabel: toString(raw.ctaLabel, existing?.ctaLabel ?? '') || undefined,
    ctaUrl: toString(raw.ctaUrl, existing?.ctaUrl ?? '') || undefined,
    linkedProductIds:
      toStringArray(raw.linkedProductIds).length > 0
        ? toStringArray(raw.linkedProductIds)
        : existing?.linkedProductIds,
    sponsored: toBoolean(raw.sponsored, existing?.sponsored ?? false),
    status: statusParsed.success ? statusParsed.data : 'scheduled',
    publishedAt: toString(raw.publishedAt, existing?.publishedAt ?? nowIso().slice(0, 10)),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  return brandPostSchema.parse(normalized) as CatalogBrandPost;
};
