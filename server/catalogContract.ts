import { z } from 'zod';
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
  verifiedStatus: z.boolean(),
  claimStatus: z.enum(['community', 'pending', 'verified']),
  followers: z.number().nonnegative(),
  ratings: z.number().min(0).max(5),
  featuredFlag: z.boolean(),
  sponsoredFlag: z.boolean(),
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
  modeType: z.literal('retail'),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  stock: z.number().int(),
  status: z.enum(['draft', 'live', 'archived']),
  tags: z.array(z.string()),
  isDeal: z.boolean(),
  dealType: z.enum(['flash', 'seasonal', 'brand', 'promo', 'clearance']).optional(),
  discountPercent: z.number().nonnegative().optional(),
  promoCode: z.string().optional(),
  dealValidUntil: z.string().optional(),
  featuredFlag: z.boolean(),
  isNewArrival: z.boolean(),
  isBestseller: z.boolean(),
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
  const normalized: CatalogBrand = {
    id,
    slug,
    name,
    category: toString(raw.category, existing?.category ?? 'General'),
    description: toString(raw.description, existing?.description ?? ''),
    logo: toString(raw.logo, existing?.logo ?? ''),
    verifiedStatus: toBoolean(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    claimStatus: claimStatusRaw === 'verified' || claimStatusRaw === 'pending' ? claimStatusRaw : 'community',
    followers: toNumber(raw.followers, existing?.followers ?? 0),
    ratings: Math.max(0, Math.min(5, toNumber(raw.ratings, existing?.ratings ?? 0))),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    sponsoredFlag: toBoolean(raw.sponsoredFlag, existing?.sponsoredFlag ?? false),
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
  const statusRaw = toString(raw.status, existing?.status ?? 'draft').toLowerCase();

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
    modeType: 'retail',
    price: toNumber(raw.price, existing?.price ?? 0),
    originalPrice:
      raw.originalPrice !== undefined
        ? toNumber(raw.originalPrice)
        : existing?.originalPrice,
    stock,
    status: statusRaw === 'live' || statusRaw === 'archived' ? statusRaw : 'draft',
    tags: toStringArray(raw.tags).length > 0 ? toStringArray(raw.tags) : existing?.tags ?? [],
    isDeal: toBoolean(raw.isDeal, existing?.isDeal ?? false),
    dealType: toString(raw.dealType, existing?.dealType) as CatalogProduct['dealType'],
    discountPercent:
      raw.discountPercent !== undefined
        ? toNumber(raw.discountPercent)
        : existing?.discountPercent,
    promoCode: toString(raw.promoCode, existing?.promoCode),
    dealValidUntil: toString(raw.dealValidUntil, existing?.dealValidUntil),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    isNewArrival: toBoolean(raw.isNewArrival, existing?.isNewArrival ?? false),
    isBestseller: toBoolean(raw.isBestseller, existing?.isBestseller ?? false),
    createdAt: existingOrNow(existing?.createdAt),
    updatedAt: nowIso(),
  };
  return productSchema.parse(normalized);
};

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
