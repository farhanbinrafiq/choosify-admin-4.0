import type { CatalogBrand, CatalogProduct } from '../../src/types/catalog';
import type { RankingWeights } from './rankingWeights';
import { getRankingWeights } from './rankingWeights';

export type ProductRankingSignals = {
  productId: string;
  keywordRelevance: number;
  viewCount: number;
  wishlistCount: number;
  compareCount: number;
  reviewScore: number | null;
  reviewCount: number;
  trustScore: number | null;
  sellerReputation: number | null;
  sellerHealthScore: number | null;
  verified: boolean;
  freshnessScore: number;
  inStock: boolean;
  sponsoredBoost: number;
  adminBoost: number;
  isRejected: boolean;
};

export type RankedProduct = {
  product: CatalogProduct;
  score: number;
  maxScore: number;
  signals: ProductRankingSignals;
  breakdown: Record<string, number>;
};

export type RankingContext = {
  query?: string;
  weights?: RankingWeights;
  sponsoredBrandIds?: Set<string>;
  rejectedProductIds?: Set<string>;
  analyticsCounts?: {
    views: Map<string, number>;
    wishlists: Map<string, number>;
    compares: Map<string, number>;
  };
  reviewStats?: Map<string, { average: number; count: number }>;
  trustScores?: Map<string, number>;
  brandTrustScores?: Map<string, number>;
  sellerReputations?: Map<string, number>;
  sellerHealthScores?: Map<string, number>;
  brandVerified?: Map<string, boolean>;
};

function normalizeCount(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(100, Math.round((value / cap) * 100));
}

export function computeKeywordRelevance(product: CatalogProduct, query?: string): number {
  if (!query || !query.trim()) return 50;

  const q = query.trim().toLowerCase();
  const title = product.title.toLowerCase();
  const description = product.description.toLowerCase();
  const brand = product.brandName.toLowerCase();
  const category = product.categoryName.toLowerCase();
  const tags = (product.tags || []).join(' ').toLowerCase();

  if (title === q) return 100;
  if (title.startsWith(q)) return 95;
  if (brand === q || category === q) return 90;
  if (title.includes(q)) return 85;
  if (brand.includes(q) || category.includes(q)) return 70;
  if (tags.includes(q)) return 65;
  if (description.includes(q)) return 55;
  return 0;
}

export function computeFreshnessScore(product: CatalogProduct): number {
  if (product.isNewArrival) return 100;

  const updatedMs = Date.now() - new Date(product.updatedAt).getTime();
  const days = updatedMs / (1000 * 60 * 60 * 24);
  if (days <= 7) return 90;
  if (days <= 30) return 75;
  if (days <= 90) return 55;
  if (days <= 180) return 35;
  return 20;
}

export function buildProductSignals(
  product: CatalogProduct,
  brand: CatalogBrand | undefined,
  ctx: RankingContext,
): ProductRankingSignals {
  const analytics = ctx.analyticsCounts;
  const reviews = ctx.reviewStats?.get(product.id);
  const viewCount = analytics?.views.get(product.id) ?? 0;
  const wishlistCount = analytics?.wishlists.get(product.id) ?? 0;
  const compareCount = analytics?.compares.get(product.id) ?? 0;

  const trustScore =
    ctx.trustScores?.get(product.id) ??
    ctx.brandTrustScores?.get(product.brandId) ??
    null;

  const sellerKey = product.brandId;
  const sellerReputation = ctx.sellerReputations?.get(sellerKey) ?? null;
  const sellerHealthScore = ctx.sellerHealthScores?.get(sellerKey) ?? null;

  const verified =
    brand?.verifiedStatus === true ||
    brand?.claimStatus === 'verified' ||
    ctx.brandVerified?.get(product.brandId) === true;

  const sponsoredBoost =
    brand?.sponsoredFlag || ctx.sponsoredBrandIds?.has(product.brandId) ? 15 : 0;
  const adminBoost = product.featuredFlag ? 10 : product.isBestseller ? 5 : 0;

  return {
    productId: product.id,
    keywordRelevance: computeKeywordRelevance(product, ctx.query),
    viewCount,
    wishlistCount,
    compareCount,
    reviewScore: reviews && reviews.count > 0 ? reviews.average : null,
    reviewCount: reviews?.count ?? 0,
    trustScore,
    sellerReputation,
    sellerHealthScore,
    verified,
    freshnessScore: computeFreshnessScore(product),
    inStock: product.stock > 0,
    sponsoredBoost,
    adminBoost,
    isRejected: ctx.rejectedProductIds?.has(product.id) ?? false,
  };
}

export function rankProduct(
  product: CatalogProduct,
  brand: CatalogBrand | undefined,
  ctx: RankingContext,
): RankedProduct | null {
  const signals = buildProductSignals(product, brand, ctx);

  if (signals.isRejected) return null;
  if (product.status !== 'live') return null;
  if (ctx.query && signals.keywordRelevance <= 0) return null;

  const weights = ctx.weights ?? getRankingWeights();
  const maxPopularity = Math.max(
    1,
    ...[signals.viewCount, signals.wishlistCount, signals.compareCount],
  );

  const popularityScore = Math.round(
    (normalizeCount(signals.viewCount, maxPopularity) * 0.5 +
      normalizeCount(signals.wishlistCount, maxPopularity) * 0.3 +
      normalizeCount(signals.compareCount, maxPopularity) * 0.2),
  );

  const trustComponent = signals.trustScore ?? (signals.verified ? 70 : 40);
  const sellerComponent =
    signals.sellerReputation ?? signals.sellerHealthScore ?? (signals.verified ? 60 : 35);
  const reviewComponent =
    signals.reviewScore !== null
      ? Math.min(100, Math.round((signals.reviewScore / 5) * 80 + Math.min(signals.reviewCount, 10) * 2))
      : 40;
  const inventoryComponent = signals.inStock ? 100 : 0;

  const breakdown = {
    keyword: (signals.keywordRelevance * weights.keyword) / 100,
    popularity: (popularityScore * weights.popularity) / 100,
    trust: (trustComponent * weights.trust) / 100,
    seller: (sellerComponent * weights.seller) / 100,
    freshness: (signals.freshnessScore * weights.freshness) / 100,
    reviews: (reviewComponent * weights.reviews) / 100,
    inventory: (inventoryComponent * weights.inventory) / 100,
    sponsoredBoost: signals.sponsoredBoost,
    adminBoost: signals.adminBoost,
  };

  const score = Math.round(
    Math.min(
      100,
      Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    ),
  );

  return {
    product,
    score,
    maxScore: 100,
    signals,
    breakdown,
  };
}

export function rankProducts(
  products: CatalogProduct[],
  brands: CatalogBrand[],
  ctx: RankingContext,
): RankedProduct[] {
  const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
  const ranked: RankedProduct[] = [];

  for (const product of products) {
    const result = rankProduct(product, brandMap.get(product.brandId), ctx);
    if (result) ranked.push(result);
  }

  return ranked.sort((a, b) => b.score - a.score);
}
