import { z } from 'zod';
import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
  HomepageHeroBanner,
  HomepageSectionConfig,
} from './catalogTypes';

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
  image: z.string(),
  gallery: z.array(z.string()),
  modeType: z.enum(['retail', 'wholesale']),
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
  type: z.enum(['retail', 'wholesale']),
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
  sections: z.array(sectionSchema),
  featuredProductIds: z.array(z.string()),
  featuredBrandIds: z.array(z.string()),
  featuredDealIds: z.array(z.string()),
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

export const normalizeBrandInput = (payload: unknown, existing?: CatalogBrand): CatalogBrand => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Brand');
  const id = toString(raw.id, existing?.id ?? `brand-${Date.now()}`);
  const claimStatusRaw = toString(raw.claimStatus, existing?.claimStatus ?? 'community');
  const normalized: CatalogBrand = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
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
  existing?: CatalogProduct
): CatalogProduct => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title = toString(raw.title, toString(raw.name, existing?.title ?? 'Untitled Product'));
  const id = toString(raw.id, existing?.id ?? `prod-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? 'draft').toLowerCase();
  const modeRaw = toString(raw.modeType, toString(raw.mode_type, existing?.modeType ?? 'retail')).toLowerCase();
  const normalized: CatalogProduct = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(title || id)),
    title,
    description: toString(raw.description, existing?.description ?? ''),
    brandId: toString(raw.brandId, existing?.brandId ?? 'brand-generic'),
    brandName: toString(raw.brandName, toString(raw.brand, existing?.brandName ?? 'Generic')),
    categoryId: toString(raw.categoryId, existing?.categoryId ?? 'cat-general'),
    categoryName: toString(raw.categoryName, toString(raw.category, existing?.categoryName ?? 'General')),
    image: toString(raw.image, existing?.image ?? ''),
    gallery: toStringArray(raw.gallery).length > 0 ? toStringArray(raw.gallery) : existing?.gallery ?? [],
    modeType: modeRaw === 'wholesale' ? 'wholesale' : 'retail',
    price: toNumber(raw.price, existing?.price ?? 0),
    originalPrice:
      raw.originalPrice !== undefined
        ? toNumber(raw.originalPrice)
        : existing?.originalPrice,
    stock: Math.floor(toNumber(raw.stock, existing?.stock ?? 0)),
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
  const typeRaw = toString(raw.type, existing?.type ?? 'retail').toLowerCase();
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
    type: typeRaw === 'wholesale' ? 'wholesale' : 'retail',
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
  const sectionsInput = Array.isArray(raw.sections) ? raw.sections : existing?.sections ?? [];

  const normalized: HomepageConfig = {
    id: 'default',
    heroBanners: heroBannersInput.map(normalizeHeroBannerInput),
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
    updatedAt: nowIso(),
  };

  return homepageSchema.parse(normalized);
};
