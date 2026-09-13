import { z } from 'zod';
import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogDealsBanner,
  CatalogProduct,
  CtaAudienceRule,
  CtaBannerItem,
  CtaDestinationType,
  CtaPageKey,
  HomepageConfig,
  HomepageHeroBanner,
  HomepageSectionConfig,
  SiteConfig,
  SiteFooterColumn,
  SiteNavItem,
  SitePopularSearch,
  SiteSocialLink,
} from './catalogTypes';
import { normalizeSeoEntryInput } from './catalogEditorialContract';
import { isDealsBannerDestinationType } from './dealsBannerUtils';

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
    })
    .optional(),
  story: z.string().optional(),
  storyVideoUrl: z.string().optional(),
  credentials: z.string().optional(),
  overview: z
    .object({
      address: z.string().optional(),
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
  _context?: { existingBrandSlugs?: string[] },
): CatalogBrand => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Brand');
  const id = toString(raw.id, existing?.id ?? `brand-${Date.now()}`);
  const claimStatusRaw = toString(raw.claimStatus, existing?.claimStatus ?? 'community');
  const socialRaw =
    raw.socialLinks && typeof raw.socialLinks === 'object'
      ? (raw.socialLinks as Record<string, unknown>)
      : null;
  const overviewRaw =
    raw.overview && typeof raw.overview === 'object' ? (raw.overview as Record<string, unknown>) : null;
  const normalized: CatalogBrand = {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
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
          }
        : undefined,
    story: toString(raw.story, existing?.story ?? '') || undefined,
    storyVideoUrl: toString(raw.storyVideoUrl, existing?.storyVideoUrl ?? '') || undefined,
    credentials: toString(raw.credentials, existing?.credentials ?? '') || undefined,
    overview:
      overviewRaw || existing?.overview
        ? {
            address: toString(overviewRaw?.address, existing?.overview?.address ?? '') || undefined,
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
    modeType: 'retail',
    productType:
      toString(raw.productType, existing?.productType ?? 'physical').toLowerCase() === 'service'
        ? 'service'
        : 'physical',
    serviceCategory: (() => {
      const value = toString(raw.serviceCategory, existing?.serviceCategory ?? '');
      const allowed = [
        'hotels',
        'restaurants',
        'travel',
        'doctors',
        'education',
        'beauty',
        'real_estate',
        'transport',
      ] as const;
      return (allowed as readonly string[]).includes(value)
        ? (value as CatalogProduct['serviceCategory'])
        : undefined;
    })(),
    relatedInfoType: (() => {
      const value = toString(raw.relatedInfoType, existing?.relatedInfoType ?? '');
      return value === 'price_across_stores' || value === 'whats_nearby' || value === 'before_your_visit'
        ? value
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
    requiredBookingFieldKeys:
      toStringArray(raw.requiredBookingFieldKeys).length > 0
        ? toStringArray(raw.requiredBookingFieldKeys)
        : existing?.requiredBookingFieldKeys,
    requiresApproval:
      raw.requiresApproval !== undefined ? toBoolean(raw.requiresApproval) : existing?.requiresApproval,
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
  const destinationType = isDealsBannerDestinationType(typeRaw) ? typeRaw : 'custom-url';
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

const normalizeNavItem = (payload: unknown, idx: number): SiteNavItem => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, `nav-${idx + 1}`);
  return {
    id,
    label: toString(raw.label, 'Link'),
    path: toString(raw.path, '/'),
    order: Math.floor(toNumber(raw.order, idx)),
  };
};

const normalizeFooterColumn = (payload: unknown, idx: number): SiteFooterColumn => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const links = Array.isArray(raw.links) ? raw.links : [];
  return {
    id: toString(raw.id, `footer-col-${idx + 1}`),
    title: toString(raw.title, 'Links'),
    links: links
      .map((link) => {
        const item = (link ?? {}) as Record<string, unknown>;
        return {
          label: toString(item.label),
          url: toString(item.url, '/'),
        };
      })
      .filter((link) => link.label.length > 0),
  };
};

const normalizeSocialLink = (payload: unknown, idx: number): SiteSocialLink => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    id: toString(raw.id, `social-${idx + 1}`),
    platform: toString(raw.platform, 'Facebook'),
    url: toString(raw.url, '#'),
    isVisible: toBoolean(raw.isVisible, true),
    order: Math.floor(toNumber(raw.order, idx)),
  };
};

const normalizePopularSearch = (payload: unknown, idx: number): SitePopularSearch => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    id: toString(raw.id, `search-${idx + 1}`),
    term: toString(raw.term, ''),
    order: Math.floor(toNumber(raw.order, idx)),
    isActive: toBoolean(raw.isActive, true),
  };
};

const normalizeProductBadge = (raw: Record<string, unknown>, idx: number) => ({
  id: toString(raw.id, `badge-${idx + 1}`),
  label: toString(raw.label, ''),
  color: toString(raw.color, '#F97316'),
  icon: toString(raw.icon, ''),
  priority: Math.floor(toNumber(raw.priority, idx + 1)),
  isActive: toBoolean(raw.isActive, true),
});

const normalizeWebsiteAssets = (
  raw: Record<string, unknown> | undefined,
  existing?: SiteConfig['websiteAssets'],
): NonNullable<SiteConfig['websiteAssets']> => ({
  navbarLogo: toString(raw?.navbarLogo, existing?.navbarLogo ?? ''),
  footerLogo: toString(raw?.footerLogo, existing?.footerLogo ?? ''),
  favicon: toString(raw?.favicon, existing?.favicon ?? ''),
  pwaIcon: toString(raw?.pwaIcon, existing?.pwaIcon ?? ''),
  defaultProductImage: toString(raw?.defaultProductImage, existing?.defaultProductImage ?? ''),
});

/**
 * Editorial CTA/banner placements (Storefront Curation -> CTA & Banners).
 * Seed defaults mirror the real hardcoded storefront copy at the time this
 * model was introduced -- a placement id missing from the saved config still
 * renders (falls back to this default) so content never disappears just
 * because Admin hasn't saved a config yet.
 */
const defaultCtaBanners = (): CtaBannerItem[] => [
  {
    id: 'creators.join_cta',
    page: 'creators',
    section: 'creators-grid',
    position: 'after',
    title: 'Are you a creator?',
    subtitle: 'Join Choosify and grow your audience by sharing honest reviews.',
    buttonLabel: 'JOIN AS CREATOR',
    destinationType: 'creator_signup',
    destinationValue: '',
    openInNewTab: true,
    enabled: true,
    order: 0,
    style: 'navy',
    audienceRule: 'hide_if_has_creator_account',
  },
  {
    id: 'deals.subscribe_cta',
    page: 'deals',
    section: 'deals-subscribe-banner',
    position: 'after',
    title: '\u{1F381} NEVER MISS A DEAL!',
    subtitle: 'Subscribe and get top deals straight to your inbox.',
    buttonLabel: 'SUBSCRIBE',
    destinationType: 'none',
    destinationValue: '',
    openInNewTab: false,
    enabled: true,
    order: 0,
    style: 'navy',
    audienceRule: 'none',
  },
];

/**
 * The shared placement registry (mirrors src/lib/ctaPlacementRegistry.ts on
 * both the storefront and admin frontends -- this is the third, server-side
 * copy, used only for validation so a saved CTA can never reference a
 * (page, section, position) combination that has no matching <CtaBannerSlot/>
 * anywhere on the real storefront). Every section here corresponds to a real,
 * hand-wired anchor in a real storefront page component.
 */
const CTA_PLACEMENT_REGISTRY: Record<string, Record<string, Array<'before' | 'after'>>> = {
  home: {
    'home-deals': ['before', 'after'],
    'home-featured-brands': ['before', 'after'],
    'home-end': ['after'],
  },
  brands: {
    'brands-grid': ['before', 'after'],
    'brands-follow-cta-strip': ['before', 'after'],
  },
  deals: {
    'deals-flash-dotd': ['before', 'after'],
    'deals-subscribe-banner': ['before', 'after'],
  },
  categories: {
    'categories-feed-header': ['before', 'after'],
    'categories-browse-body': ['after'],
  },
  products: {
    'products-grid': ['before', 'after'],
    'products-end': ['after'],
  },
  search: {
    'search-pill-tabs': ['before', 'after'],
    'search-end': ['after'],
  },
  creators: {
    'creators-feed-header': ['before', 'after'],
    'creators-grid': ['before', 'after'],
  },
};

function defaultPlacementFor(page: string): { section: string; position: 'before' | 'after' } {
  const sections = CTA_PLACEMENT_REGISTRY[page] ?? CTA_PLACEMENT_REGISTRY.home;
  const [section, positions] = Object.entries(sections)[0];
  return { section, position: positions[0] };
}

/**
 * Internal routes recognized as valid destinations -- mirrors the
 * storefront's own real, live route list (PRIMARY_NAV_ITEMS in
 * src/lib/navigation.ts) plus the other known-real static pages already
 * referenced elsewhere in SiteConfig (footer links, Website Manager pages),
 * so this dropdown/validator can never point a CTA at a dead route.
 */
const CTA_ALLOWED_INTERNAL_ROUTES = new Set([
  '/',
  '/categories',
  '/products',
  '/brands',
  '/spotlight',
  '/deals',
  '/creators',
  '/compare',
  '/search',
  '/suggest-brand',
  '/advertise',
  '/partnership',
  '/post-offer',
  '/login',
  '/contact',
  '/about',
  '/terms',
  '/privacy',
  '/guides',
]);
const CTA_PAGE_KEYS = new Set(Object.keys(CTA_PLACEMENT_REGISTRY));
const CTA_DESTINATION_TYPES = new Set<CtaDestinationType>(['internal', 'creator_signup', 'seller_signup', 'external', 'none']);
const CTA_STYLES = new Set(['navy', 'purple', 'orange', 'light']);
const CTA_AUDIENCE_RULES = new Set<CtaAudienceRule>([
  'none',
  'guests_only',
  'logged_in_only',
  'hide_if_has_creator_account',
  'hide_if_has_seller_account',
]);

/**
 * Migrates the pre-placement-registry shape (destinationType: "external"
 * with destinationValue "creator_signup"/"seller_signup" as a magic
 * sentinel, and no section/position/openInNewTab fields at all) to the
 * current schema -- without this, old persisted records would silently
 * resolve to a dead destination the first time they're saved through the
 * new normalizer.
 */
const migrateLegacyCtaRow = (row: Record<string, unknown>): Record<string, unknown> => {
  if (row.destinationType === 'external' && (row.destinationValue === 'creator_signup' || row.destinationValue === 'seller_signup')) {
    return { ...row, destinationType: row.destinationValue, destinationValue: '' };
  }
  return row;
};

/**
 * Rejects anything javascript:/data:/file:/etc. by construction -- only
 * https:// (external) or a same-origin "/..." path (internal) ever survive.
 */
const normalizeCtaDestination = (
  destinationType: CtaDestinationType,
  destinationValue: string,
): { destinationType: CtaDestinationType; destinationValue: string } => {
  if (destinationType === 'none' || destinationType === 'creator_signup' || destinationType === 'seller_signup') {
    return { destinationType, destinationValue: '' };
  }
  if (destinationType === 'internal') {
    // Falls back to "no action" rather than accepting an arbitrary/unknown
    // path -- keeps an Admin from silently pointing a CTA at a dead route.
    if (CTA_ALLOWED_INTERNAL_ROUTES.has(destinationValue) || /^\/[a-z0-9/_-]*$/i.test(destinationValue)) {
      return { destinationType, destinationValue };
    }
    return { destinationType: 'none', destinationValue: '' };
  }
  // external -- https:// only; javascript:/data:/file:/etc. never match and fall through to "none"
  if (/^https:\/\/[^\s<>"']+$/i.test(destinationValue)) {
    return { destinationType, destinationValue };
  }
  return { destinationType: 'none', destinationValue: '' };
};

/** Resolves page/section/position, falling back to that page's registry default if the combination isn't real (stale data, or a section since removed from the registry). Never lets a CTA silently render nowhere. */
const normalizeCtaPlacement = (
  rawPage: unknown,
  rawSection: unknown,
  rawPosition: unknown,
  fallback: { page: CtaPageKey; section: string; position: 'before' | 'after' },
): { page: CtaPageKey; section: string; position: 'before' | 'after' } => {
  const page = CTA_PAGE_KEYS.has(rawPage as string) ? (rawPage as CtaPageKey) : fallback.page;
  const section = toString(rawSection, fallback.section);
  const position: 'before' | 'after' = rawPosition === 'before' || rawPosition === 'after' ? rawPosition : fallback.position;
  const allowedPositions = CTA_PLACEMENT_REGISTRY[page]?.[section];
  if (allowedPositions && allowedPositions.includes(position)) return { page, section, position };
  return { page, ...defaultPlacementFor(page) };
};

const normalizeCtaBannerItem = (raw: Record<string, unknown>, fallback: CtaBannerItem, idx: number): CtaBannerItem => {
  const requestedType = CTA_DESTINATION_TYPES.has(raw.destinationType as CtaDestinationType)
    ? (raw.destinationType as CtaDestinationType)
    : fallback.destinationType;
  const requestedValue = toString(raw.destinationValue, fallback.destinationValue);
  const destination = normalizeCtaDestination(requestedType, requestedValue);
  const placement = normalizeCtaPlacement(raw.page, raw.section, raw.position, fallback);
  return {
    id: fallback.id,
    ...placement,
    title: toString(raw.title, fallback.title),
    subtitle: toString(raw.subtitle, fallback.subtitle),
    buttonLabel: toString(raw.buttonLabel, fallback.buttonLabel),
    destinationType: destination.destinationType,
    destinationValue: destination.destinationValue,
    openInNewTab: destination.destinationType === 'none' ? false : toBoolean(raw.openInNewTab, fallback.openInNewTab),
    enabled: toBoolean(raw.enabled, fallback.enabled),
    order: Math.floor(toNumber(raw.order, fallback.order ?? idx)),
    style: CTA_STYLES.has(raw.style as string) ? (raw.style as CtaBannerItem['style']) : fallback.style,
    icon: toString(raw.icon, fallback.icon ?? '') || undefined,
    startDate: typeof raw.startDate === 'string' ? raw.startDate : fallback.startDate,
    endDate: typeof raw.endDate === 'string' ? raw.endDate : fallback.endDate,
    audienceRule: CTA_AUDIENCE_RULES.has(raw.audienceRule as CtaAudienceRule)
      ? (raw.audienceRule as CtaAudienceRule)
      : fallback.audienceRule ?? 'none',
  };
};

export const normalizeCtaBanners = (payload: unknown, existing?: CtaBannerItem[] | null): CtaBannerItem[] => {
  const defaults = defaultCtaBanners();
  const raw = Array.isArray(payload) ? payload : existing ?? [];

  // Reject outright rather than silently deduping -- an Admin who submits two
  // rows with the same internal name/id should see an error, not have one
  // vanish without explanation.
  const seenIds = new Set<string>();
  for (const item of raw) {
    const id = (item as Record<string, unknown> | null)?.id;
    if (typeof id === 'string' && id) {
      if (seenIds.has(id)) throw new Error(`Duplicate CTA internal name: "${id}"`);
      seenIds.add(id);
    }
  }

  const byId = new Map<string, Record<string, unknown>>();
  raw.forEach((item) => {
    const row = migrateLegacyCtaRow((item ?? {}) as Record<string, unknown>);
    if (typeof row.id === 'string' && row.id) byId.set(row.id, row);
  });

  const merged = defaults.map((fb, idx) => {
    const row = byId.get(fb.id);
    byId.delete(fb.id);
    return row ? normalizeCtaBannerItem(row, fb, idx) : fb;
  });

  const extras = Array.from(byId.entries()).map(([id, row], idx) => {
    const page = CTA_PAGE_KEYS.has(row.page as string) ? (row.page as CtaPageKey) : 'home';
    return normalizeCtaBannerItem(
      row,
      {
        id,
        page,
        ...defaultPlacementFor(page),
        title: '',
        subtitle: '',
        buttonLabel: '',
        destinationType: 'none',
        destinationValue: '',
        openInNewTab: true,
        enabled: true,
        order: defaults.length + idx,
        style: 'navy',
        audienceRule: 'none',
      },
      defaults.length + idx,
    );
  });

  return [...merged, ...extras];
};

export const normalizeSiteInput = (payload: unknown, existing?: SiteConfig): SiteConfig => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const footerRaw = (raw.footer ?? existing?.footer ?? {}) as Record<string, unknown>;
  const columnsInput = Array.isArray(footerRaw.columns) ? footerRaw.columns : existing?.footer.columns ?? [];

  return {
    id: 'default',
    navigation: (Array.isArray(raw.navigation) ? raw.navigation : existing?.navigation ?? []).map(normalizeNavItem),
    footer: {
      description: toString(footerRaw.description, existing?.footer.description ?? ''),
      copyrightText: toString(footerRaw.copyrightText, existing?.footer.copyrightText ?? ''),
      columns: columnsInput.map(normalizeFooterColumn),
      newsletterEnabled: toBoolean(footerRaw.newsletterEnabled, existing?.footer.newsletterEnabled ?? true),
    },
    socialLinks: (Array.isArray(raw.socialLinks) ? raw.socialLinks : existing?.socialLinks ?? []).map(
      normalizeSocialLink,
    ),
    popularSearches: (Array.isArray(raw.popularSearches) ? raw.popularSearches : existing?.popularSearches ?? []).map(
      normalizePopularSearch,
    ),
    seoEntries: (Array.isArray(raw.seoEntries) ? raw.seoEntries : existing?.seoEntries ?? []).map(normalizeSeoEntryInput),
    announcementBarText: toString(raw.announcementBarText, existing?.announcementBarText ?? ''),
    announcementBarEnabled: toBoolean(raw.announcementBarEnabled, existing?.announcementBarEnabled ?? false),
    productBadges: (Array.isArray(raw.productBadges) ? raw.productBadges : existing?.productBadges ?? []).map(
      (item, idx) => normalizeProductBadge((item ?? {}) as Record<string, unknown>, idx),
    ),
    websiteAssets: normalizeWebsiteAssets(
      (raw.websiteAssets ?? existing?.websiteAssets) as Record<string, unknown> | undefined,
      existing?.websiteAssets,
    ),
    websiteName: toString(raw.websiteName, existing?.websiteName ?? ''),
    supportEmail: toString(raw.supportEmail, existing?.supportEmail ?? ''),
    supportPhone: toString(raw.supportPhone, existing?.supportPhone ?? ''),
    ctaBanners: normalizeCtaBanners(raw.ctaBanners, existing?.ctaBanners ?? null),
    updatedAt: nowIso(),
  };
};
