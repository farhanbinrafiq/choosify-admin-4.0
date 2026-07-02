import type {
  CatalogCreator,
  CatalogGuide,
  CatalogPlacement,
  CatalogProductDetail,
  SiteSeoEntry,
} from './catalogEditorialTypes';

const nowIso = () => new Date().toISOString();

const toString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};
const toBoolean = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const normalizeCreatorInput = (payload: unknown, existing?: CatalogCreator): CatalogCreator => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Creator');
  const id = toString(raw.id, existing?.id ?? `creator-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? 'live').toLowerCase();
  return {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    handle: toString(raw.handle, existing?.handle ?? `@${slugify(name)}`),
    avatar: toString(raw.avatar, existing?.avatar ?? ''),
    score: toNumber(raw.score, existing?.score ?? 0),
    bestFor: toString(raw.bestFor, existing?.bestFor ?? 'General'),
    bestForTags: toStringArray(raw.bestForTags).length ? toStringArray(raw.bestForTags) : existing?.bestForTags ?? [],
    platforms: toStringArray(raw.platforms).length ? toStringArray(raw.platforms) : existing?.platforms ?? [],
    bio: toString(raw.bio, existing?.bio ?? ''),
    followers:
      raw.followers && typeof raw.followers === 'object'
        ? (raw.followers as Record<string, string>)
        : existing?.followers ?? {},
    email: toString(raw.email, existing?.email),
    phone: toString(raw.phone, existing?.phone),
    category: toString(raw.category, existing?.category),
    verifiedStatus: toBoolean(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    videos: Array.isArray(raw.videos) ? (raw.videos as CatalogCreator['videos']) : existing?.videos ?? [],
    reels: Array.isArray(raw.reels) ? (raw.reels as CatalogCreator['reels']) : existing?.reels ?? [],
    blogs: Array.isArray(raw.blogs) ? (raw.blogs as CatalogCreator['blogs']) : existing?.blogs ?? [],
    status: statusRaw === 'draft' || statusRaw === 'archived' ? statusRaw : 'live',
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

export const normalizeGuideInput = (payload: unknown, existing?: CatalogGuide): CatalogGuide => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title = toString(raw.title, existing?.title ?? 'Untitled Guide');
  const id = toString(raw.id, existing?.id ?? `guide-${Date.now()}`);
  const typeRaw = toString(raw.type, existing?.type ?? 'article').toLowerCase();
  const statusRaw = toString(raw.status, existing?.status ?? 'live').toLowerCase();
  return {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(title || id)),
    title,
    author: toString(raw.author, existing?.author ?? 'Choosify Editorial'),
    authorAvatar: toString(raw.authorAvatar, existing?.authorAvatar),
    category: toString(raw.category, existing?.category ?? 'General'),
    excerpt: toString(raw.excerpt, existing?.excerpt),
    image: toString(raw.image, existing?.image ?? ''),
    videoUrl: toString(raw.videoUrl, existing?.videoUrl),
    duration: toString(raw.duration, existing?.duration),
    type: typeRaw === 'reels' || typeRaw === 'video' || typeRaw === 'shorts' ? typeRaw : 'article',
    readTime: toString(raw.readTime, existing?.readTime ?? '5 MIN READ'),
    views: toString(raw.views, existing?.views ?? '0'),
    shares: toString(raw.shares, existing?.shares),
    tags: toStringArray(raw.tags).length ? toStringArray(raw.tags) : existing?.tags ?? [],
    creatorId: toString(raw.creatorId, existing?.creatorId),
    productIds: toStringArray(raw.productIds).length ? toStringArray(raw.productIds) : existing?.productIds ?? [],
    verdict: toString(raw.verdict, existing?.verdict),
    whatWeLike: toStringArray(raw.whatWeLike).length ? toStringArray(raw.whatWeLike) : existing?.whatWeLike ?? [],
    whatToConsider: toStringArray(raw.whatToConsider).length
      ? toStringArray(raw.whatToConsider)
      : existing?.whatToConsider ?? [],
    seoTitle: toString(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString(raw.seoKeywords, existing?.seoKeywords),
    seoOgImage: toString(raw.seoOgImage, existing?.seoOgImage),
    seoCanonicalUrl: toString(raw.seoCanonicalUrl, existing?.seoCanonicalUrl),
    status: statusRaw === 'draft' || statusRaw === 'archived' ? statusRaw : 'live',
    publishedAt: toString(raw.publishedAt, existing?.publishedAt ?? nowIso()),
    updatedAt: nowIso(),
  };
};

export const normalizePlacementInput = (payload: unknown, existing?: CatalogPlacement): CatalogPlacement => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, existing?.id ?? `placement-${Date.now()}`);
  const entityTypeRaw = toString(raw.entityType, existing?.entityType ?? 'product').toLowerCase();
  const sponsorTypeRaw = toString(raw.sponsorType, existing?.sponsorType ?? 'sponsored_product');
  return {
    id,
    entityType:
      entityTypeRaw === 'brand' ||
      entityTypeRaw === 'deal' ||
      entityTypeRaw === 'guide' ||
      entityTypeRaw === 'creator'
        ? entityTypeRaw
        : 'product',
    entityId: toString(raw.entityId, existing?.entityId ?? ''),
    sponsorType:
      sponsorTypeRaw === 'sponsored_brand' ||
      sponsorTypeRaw === 'spotlight_brand' ||
      sponsorTypeRaw === 'sponsored_deal' ||
      sponsorTypeRaw === 'sponsored_recommendation'
        ? sponsorTypeRaw
        : 'sponsored_product',
    placement: toString(raw.placement, existing?.placement ?? 'homepage_sponsored_ads'),
    title: toString(raw.title, existing?.title),
    image: toString(raw.image, existing?.image),
    startDate: toString(raw.startDate, existing?.startDate ?? nowIso()),
    endDate: toString(raw.endDate, existing?.endDate ?? nowIso()),
    hasCountdown: toBoolean(raw.hasCountdown, existing?.hasCountdown ?? false),
    dealPrice: raw.dealPrice !== undefined ? toNumber(raw.dealPrice) : existing?.dealPrice,
    originalPrice: raw.originalPrice !== undefined ? toNumber(raw.originalPrice) : existing?.originalPrice,
    priority: Math.floor(toNumber(raw.priority, existing?.priority ?? 0)),
    isActive: toBoolean(raw.isActive, existing?.isActive ?? true),
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

export const normalizeProductDetailInput = (
  payload: unknown,
  productId: string,
  existing?: CatalogProductDetail,
): CatalogProductDetail => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    productId,
    about: toString(raw.about, existing?.about),
    specs: Array.isArray(raw.specs) ? (raw.specs as CatalogProductDetail['specs']) : existing?.specs ?? [],
    pros: toStringArray(raw.pros).length ? toStringArray(raw.pros) : existing?.pros ?? [],
    cons: toStringArray(raw.cons).length ? toStringArray(raw.cons) : existing?.cons ?? [],
    bestForTags: toStringArray(raw.bestForTags).length ? toStringArray(raw.bestForTags) : existing?.bestForTags ?? [],
    storeComparisonList: Array.isArray(raw.storeComparisonList)
      ? (raw.storeComparisonList as CatalogProductDetail['storeComparisonList'])
      : existing?.storeComparisonList ?? [],
    physicalStores: Array.isArray(raw.physicalStores)
      ? (raw.physicalStores as CatalogProductDetail['physicalStores'])
      : existing?.physicalStores ?? [],
    overviewBlocks: Array.isArray(raw.overviewBlocks)
      ? (raw.overviewBlocks as CatalogProductDetail['overviewBlocks'])
      : existing?.overviewBlocks ?? [],
    optionGroups: Array.isArray(raw.optionGroups)
      ? (raw.optionGroups as CatalogProductDetail['optionGroups'])
      : existing?.optionGroups ?? [],
    productVariants: Array.isArray(raw.productVariants)
      ? (raw.productVariants as CatalogProductDetail['productVariants'])
      : existing?.productVariants ?? [],
    creatorContent: Array.isArray(raw.creatorContent)
      ? (raw.creatorContent as CatalogProductDetail['creatorContent'])
      : existing?.creatorContent ?? [],
    seoTitle: toString(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString(raw.seoKeywords, existing?.seoKeywords),
    updatedAt: nowIso(),
  };
};

export const normalizeSeoEntryInput = (payload: unknown, idx: number): SiteSeoEntry => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    pageId: toString(raw.pageId, `page-${idx + 1}`),
    pageLabel: toString(raw.pageLabel, 'Page'),
    title: toString(raw.title),
    metaDescription: toString(raw.metaDescription),
    keywords: toString(raw.keywords),
    ogImage: toString(raw.ogImage),
    canonicalUrl: toString(raw.canonicalUrl),
  };
};
