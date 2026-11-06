/**
 * Website Studio → storefront homepage bridge (Phase 2).
 *
 * The storefront already renders its homepage from GET /catalog/home (HomepageConfig). Once a
 * Website Studio "homepage" document is PUBLISHED, that endpoint serves the published version
 * (mapped here to the HomepageConfig shape); until then it keeps serving the catalog settings,
 * so nothing changes for shoppers before the first publish. Drafts are never read here — only
 * the token-gated preview session reads a draft.
 */
import type { HomepageConfig } from '../../src/types/catalog';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { getDocument, getPublished } from './websiteStore';
import { HOMEPAGE_SECTIONS, validateHomepage, type HomepageStudio } from './websiteContent';

/** HomepageConfig plus the Studio-only fields the storefront reads when present. */
export type StorefrontHomepage = HomepageConfig & {
  source?: 'website-studio' | 'catalog';
  topCategories?: Array<{ id: string; label: string; image: string; order: number }>;
};

/**
 * Maps Studio content onto the storefront shape. `base` (the catalog homepage) still supplies the
 * Deals Banners — they are managed in their own studio, not in the homepage document.
 */
export function studioToHomepageConfig(studio: HomepageStudio, base: HomepageConfig, updatedAt: string): StorefrontHomepage {
  const itemIdsFor = (id: string) =>
    id === 'trending' ? studio.featuredProductIds : id === 'featured-brands' ? studio.featuredBrandIds : id === 'recommended' ? studio.featuredGuideIds : [];
  return {
    id: 'default',
    source: 'website-studio',
    heroBanners: studio.slides.map((s, order) => ({
      id: s.id,
      headline: s.label,
      subtitle: '',
      ctaText: s.label,
      ctaUrl: s.linkUrl,
      buttonText: s.buttonText || '',
      backgroundImage: s.mediaType === 'image' ? s.mediaUrl : s.posterUrl,
      isActive: s.isActive,
      order,
      // Fields the storefront hero reads when present (Web useHomepageHeroSlides).
      mediaType: s.mediaType,
      mediaUrl: s.mediaUrl,
      mobileMediaUrl: s.mobileMediaUrl,
      posterUrl: s.posterUrl,
      alt: s.alt,
      focalX: s.focalX,
      focalY: s.focalY,
    })) as HomepageConfig['heroBanners'],
    // Today's Deals banners are part of the versioned homepage document (Phase 3).
    dealsBanners: studioDealsBanners(studio, updatedAt) as HomepageConfig['dealsBanners'],
    sections: [
      { id: 'hero', label: 'Hero', isVisible: studio.heroVisible, order: 0, itemIds: [] },
      ...studio.sections.map((s, i) => ({
        id: s.id,
        label: HOMEPAGE_SECTIONS.find((d) => d.id === s.id)?.name ?? s.id,
        isVisible: s.isVisible,
        order: i + 1,
        itemIds: itemIdsFor(s.id),
        title: s.title,
        subtitle: s.subtitle,
      })),
    ] as HomepageConfig['sections'],
    featuredProductIds: studio.featuredProductIds,
    featuredBrandIds: studio.featuredBrandIds,
    featuredDealIds: [],
    featuredCreatorIds: [],
    featuredGuideIds: studio.featuredGuideIds,
    topCategories: studio.topCategories.map((c, order) => ({ ...c, image: '', order })),
    updatedAt,
  };
}

/** Studio banners in the catalog CatalogDealsBanner shape the storefront already reads. */
export function studioDealsBanners(studio: HomepageStudio, at: string) {
  return studio.dealsBanners.map((b, order) => ({
    id: b.id,
    image: b.image,
    destinationType: b.destinationType,
    destinationRef: b.destinationRef,
    order,
    isActive: b.isActive,
    brandName: b.brandName || undefined,
    brandLogoUrl: b.brandLogoUrl || undefined,
    createdAt: at,
    updatedAt: at,
  }));
}

/** Published Studio deals banners, or null when the Studio does not own the homepage yet. */
export async function getPublishedDealsBanners() {
  let pub: Awaited<ReturnType<typeof publishedStudio>> = null;
  try {
    pub = await publishedStudio();
  } catch {
    pub = null;
  }
  return pub ? studioDealsBanners(pub.studio, pub.publishedAt) : null;
}

// Short memo so every storefront page view does not query the published version. Publishing or
// rolling back the homepage clears it at once (invalidateHomepageCache); the TTL only bounds how
// long another server process could serve the previous version.
const TTL_MS = 15_000;
let memo: { at: number; value: { studio: HomepageStudio; publishedAt: string } | null } | null = null;

export function invalidateHomepageCache() {
  memo = null;
}

async function publishedStudio(): Promise<{ studio: HomepageStudio; publishedAt: string } | null> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.value;
  const pub = await getPublished('homepage');
  // Content was validated on publish; re-validate so legacy-shaped rollbacks map safely too.
  const value = pub ? { studio: validateHomepage(pub.version.content), publishedAt: new Date(pub.version.publishedAt).toISOString() } : null;
  memo = { at: Date.now(), value };
  return value;
}

/** What GET /catalog/home serves: the published Studio homepage, else the catalog homepage. */
export async function getStorefrontHomepage(): Promise<StorefrontHomepage> {
  const base = await catalogStore.getHomepage();
  let pub: Awaited<ReturnType<typeof publishedStudio>> = null;
  try {
    pub = await publishedStudio();
  } catch {
    pub = null; // Website Studio tables unavailable → keep serving the catalog homepage
  }
  return pub ? studioToHomepageConfig(pub.studio, base, pub.publishedAt) : { ...base, source: 'catalog' };
}

/** Draft homepage for the token-gated preview session (never public). */
export async function getDraftStorefrontHomepage(): Promise<StorefrontHomepage | null> {
  const doc = await getDocument('homepage');
  if (!doc) return null;
  const base = await catalogStore.getHomepage();
  const content = doc.draft ?? (doc.publishedVersion ? (await getPublished('homepage'))?.version.content : null);
  if (!content) return null;
  return studioToHomepageConfig(validateHomepage(content), base, new Date().toISOString());
}

export async function isHomepageManagedByStudio(): Promise<boolean> {
  try {
    return Boolean((await getDocument('homepage'))?.publishedVersion);
  } catch {
    return false;
  }
}

/**
 * Publish-time reference check: every picked product, brand, guide and category must exist in
 * the live catalog. Returns human-readable problems (empty = OK).
 */
export async function checkHomepageReferences(studio: HomepageStudio): Promise<string[]> {
  const [products, brands, guides, categories] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listBrands(),
    catalogStore.listGuides(),
    catalogStore.listCategories(),
  ]);
  const problems: string[] = [];
  const has = (list: Array<{ id: string }>, id: string) => list.some((x) => String(x.id) === id);
  const missing = (label: string, ids: string[], list: Array<{ id: string }>) => {
    const gone = ids.filter((id) => !has(list, id));
    if (gone.length) problems.push(`${label}: ${gone.length} picked item(s) no longer exist (${gone.slice(0, 5).join(', ')})`);
  };
  missing('Popular Products', studio.featuredProductIds, products as Array<{ id: string }>);
  missing('Featured Brands', studio.featuredBrandIds, brands as Array<{ id: string }>);
  missing('Top Buying Guides', studio.featuredGuideIds, guides as Array<{ id: string }>);
  missing('Top Categories', studio.topCategories.map((c) => c.id), categories as Array<{ id: string }>);
  const live = studio.dealsBanners.filter((b) => b.isActive);
  missing("Today's Deals banner links (products)", live.filter((b) => b.destinationType === 'product').map((b) => b.destinationRef), products as Array<{ id: string }>);
  missing("Today's Deals banner links (brands)", live.filter((b) => b.destinationType === 'brand').map((b) => b.destinationRef), brands as Array<{ id: string }>);
  return problems;
}
