import type { CatalogProduct } from '../../src/types/catalog';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { summarize } from '../analytics/analyticsService';
import { moderationStore } from '../moderation/moderationStore';
import { calculateSellerReputation, calculateTrustScore } from '../moderation/reputationEngine';
import { operationsStore } from '../operations/operationsStore';
import { MODERATION_STATUSES } from '../moderation/moderationTypes';
import type { RankingContext } from './rankingEngine';
import { rankProducts } from './rankingEngine';
import { getRankingWeights } from './rankingWeights';
import type {
  AutocompleteResult,
  SearchFilter,
  SearchResult,
  SearchSort,
  SearchSuggestionSet,
} from './searchTypes';

function parseLimit(value: unknown, fallback = 20, max = 100): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

function parseOffset(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

async function buildRankingContext(query?: string): Promise<RankingContext> {
  const summary = await summarize('30d');
  const views = new Map(summary.mostViewed.map((item) => [item.id, item.count]));
  const wishlists = new Map(summary.mostWishlisted.map((item) => [item.id, item.count]));
  const compares = new Map(summary.mostCompared.map((item) => [item.id, item.count]));

  const reviewStats = new Map<string, { average: number; count: number }>();
  for (const review of operationsStore.listReviews()) {
    if (review.status !== 'approved' && review.status !== 'published') continue;
    const existing = reviewStats.get(review.productId) || { average: 0, count: 0, total: 0 };
    const total = existing.average * existing.count + review.rating;
    const count = existing.count + 1;
    reviewStats.set(review.productId, { average: total / count, count });
  }

  const rejectedItems = moderationStore.listItems({
    queue: 'products',
    status: MODERATION_STATUSES.REJECTED,
    limit: 5000,
  });
  const rejectedProductIds = new Set(rejectedItems.map((item) => item.resourceId));

  const brands = await catalogStore.listBrands();
  const sponsoredBrandIds = new Set(
    brands.filter((brand) => brand.sponsoredFlag).map((brand) => brand.id),
  );

  const trustScores = new Map<string, number>();
  const brandTrustScores = new Map<string, number>();
  const sellerReputations = new Map<string, number>();
  const brandVerified = new Map<string, boolean>();

  for (const brand of brands) {
    brandVerified.set(brand.id, brand.verifiedStatus || brand.claimStatus === 'verified');
    try {
      const brandTrust = calculateTrustScore('brand', brand.id, brand.name);
      brandTrustScores.set(brand.id, brandTrust.score);
      const reputation = calculateSellerReputation(brand.id, brand.name, brand.createdAt);
      sellerReputations.set(brand.id, reputation.score);
    } catch {
      // Trust data unavailable for this brand — skip without fabricating values.
    }
  }

  const products = await catalogStore.listProducts();
  for (const product of products) {
    try {
      const trust = calculateTrustScore('product', product.id, product.title);
      trustScores.set(product.id, trust.score);
    } catch {
      // Skip products without trust data.
    }
  }

  return {
    query,
    weights: getRankingWeights(),
    sponsoredBrandIds,
    rejectedProductIds,
    analyticsCounts: { views, wishlists, compares },
    reviewStats,
    trustScores,
    brandTrustScores,
    sellerReputations,
    sellerHealthScores: new Map(),
    brandVerified,
  };
}

function applyFilters(products: CatalogProduct[], filter: SearchFilter): CatalogProduct[] {
  return products.filter((product) => {
    if (filter.categoryId && product.categoryId !== filter.categoryId) return false;
    if (filter.brandId && product.brandId !== filter.brandId) return false;
    if (filter.status && product.status !== filter.status) return false;
    if (filter.inStockOnly && product.stock <= 0) return false;
    if (filter.featuredOnly && !product.featuredFlag) return false;
    if (filter.newArrivalsOnly && !product.isNewArrival) return false;
    return true;
  });
}

function sortRanked(
  ranked: ReturnType<typeof rankProducts>,
  sort: SearchSort = 'relevance',
): ReturnType<typeof rankProducts> {
  if (sort === 'relevance') return ranked;
  if (sort === 'price_asc') {
    return [...ranked].sort((a, b) => a.product.price - b.product.price);
  }
  if (sort === 'price_desc') {
    return [...ranked].sort((a, b) => b.product.price - a.product.price);
  }
  if (sort === 'newest') {
    return [...ranked].sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt));
  }
  if (sort === 'rating') {
    return [...ranked].sort(
      (a, b) => (b.signals.reviewScore ?? 0) - (a.signals.reviewScore ?? 0),
    );
  }
  return ranked;
}

export async function search(filter: SearchFilter = {}): Promise<SearchResult> {
  const [products, brands] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listBrands(),
  ]);

  const ctx = await buildRankingContext(filter.q);
  const filtered = applyFilters(products, filter);
  const ranked = sortRanked(rankProducts(filtered, brands, ctx), filter.sort);

  const limit = parseLimit(filter.limit, 20);
  const offset = parseOffset(filter.offset);
  const page = ranked.slice(offset, offset + limit);

  return {
    items: page.map((item) => ({
      product: item.product,
      score: item.score,
      breakdown: item.breakdown,
    })),
    meta: {
      total: ranked.length,
      limit,
      offset,
      query: filter.q || '',
      sort: filter.sort || 'relevance',
      weights: ctx.weights ?? getRankingWeights(),
    },
  };
}

export async function autocomplete(query: string, limit = 10): Promise<AutocompleteResult> {
  const q = query.trim().toLowerCase();
  const [products, brands, categories, siteConfig, summary] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listBrands(),
    catalogStore.listCategories(),
    catalogStore.getSiteConfig().catch(() => null),
    summarize('30d'),
  ]);

  const matchesPrefix = (value: string) => !q || value.toLowerCase().includes(q);

  const productSuggestions = products
    .filter((p) => p.status === 'live' && matchesPrefix(`${p.title} ${p.brandName}`))
    .slice(0, limit)
    .map((p) => ({ id: p.id, label: p.title, type: 'product' as const }));

  const brandSuggestions = brands
    .filter((b) => matchesPrefix(b.name))
    .slice(0, limit)
    .map((b) => ({ id: b.id, label: b.name, type: 'brand' as const }));

  const categorySuggestions = categories
    .filter((c) => c.enabled && matchesPrefix(c.name))
    .slice(0, limit)
    .map((c) => ({ id: c.id, label: c.name, type: 'category' as const }));

  const storeSuggestions = brands
    .filter((b) => matchesPrefix(b.name))
    .slice(0, Math.min(5, limit))
    .map((b) => ({ id: b.id, label: b.name, type: 'store' as const }));

  const popularSearches = (siteConfig?.popularSearches || [])
    .filter((item) => item.isActive !== false && matchesPrefix(item.term))
    .slice(0, limit)
    .map((item) => ({ id: item.id, label: item.term, type: 'popular_search' as const }));

  const trendingSearches = summary.trendingSearches
    .filter((item) => matchesPrefix(item.label || ''))
    .slice(0, limit)
    .map((item) => ({ id: item.id, label: item.label || item.id, type: 'trending_search' as const }));

  return {
    query,
    products: productSuggestions,
    brands: brandSuggestions,
    categories: categorySuggestions,
    stores: storeSuggestions,
    popularSearches,
    trendingSearches,
  };
}

export async function recommend(
  productId: string,
  limit = 10,
): Promise<SearchResult['items']> {
  const product = await catalogStore.getProduct(productId);
  if (!product) return [];

  const result = await search({
    categoryId: product.categoryId,
    brandId: product.brandId,
    limit: limit + 1,
  });

  return result.items.filter((item) => item.product.id !== productId).slice(0, limit);
}

export async function buildSuggestions(query: string, categoryId?: string): Promise<SearchSuggestionSet> {
  const q = query.trim().toLowerCase();
  const summary = await summarize('30d');
  const siteConfig = await catalogStore.getSiteConfig().catch(() => null);

  const popularTerms = [
    ...(siteConfig?.popularSearches || []).filter((s) => s.isActive !== false).map((s) => s.term),
    ...summary.trendingSearches.map((s) => s.label || '').filter(Boolean),
  ];

  const didYouMean =
    q.length > 2
      ? popularTerms.find((term) => {
          const t = term.toLowerCase();
          return t !== q && (t.startsWith(q.slice(0, 3)) || q.startsWith(t.slice(0, 3)));
        }) || null
      : null;

  const relatedSearches = summary.trendingSearches
    .map((s) => s.label || '')
    .filter((term) => term && term.toLowerCase() !== q)
    .slice(0, 5);

  const popularInCategory = categoryId
    ? summary.topProducts
        .filter((p) => (p.metadata as { categoryName?: string } | undefined)?.categoryName)
        .map((p) => p.label)
        .slice(0, 5)
    : [];

  const popularBrands = summary.topBrands.slice(0, 5).map((b) => b.label);
  const trendingKeywords = summary.trendingSearches.slice(0, 5).map((s) => s.label || s.id);

  return {
    didYouMean,
    relatedSearches,
    popularInCategory,
    popularBrands,
    trendingKeywords,
  };
}

export { filterProducts, sortProducts } from './searchFilters';
export { getDiscoveryCollections, getTrendingSnapshot } from './discoveryEngine';
