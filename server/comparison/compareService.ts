/**
 * Product & Brand Quick Comparison — server-side candidate search, ranking,
 * and tiered fallback. Computation happens here (against the already-loaded
 * catalogStore, never re-fetched client-side); the client only ever receives
 * the current item + top N ranked candidates.
 */
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { operationsStore } from '../operations/operationsStore';
import { isProductPubliclyEligible } from '../catalog/productLifecycle';
import { brandIsMarketplaceVisible } from '../catalog/sellerWorkspace';
import { getCompareConfig } from './compareConfig';
import type { CatalogBrand, CatalogProduct } from '../../src/types/catalog';

export type ProductComparisonCard = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  brandName: string;
  image: string;
  price: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  isCurrent: boolean;
};

export type ProductComparisonResult = {
  current: ProductComparisonCard;
  candidates: ProductComparisonCard[];
  filter: {
    categoryId: string;
    categoryName: string;
    minPrice: number;
    maxPrice: number;
    priceTolerancePercent: number;
    fallbackTier: 'primary' | 'category-25' | 'parent-20' | 'closest-price' | 'none';
  };
};

export type BrandComparisonCard = {
  id: string;
  slug: string;
  name: string;
  logo: string;
  coverImage?: string;
  verifiedStatus: boolean;
  category: string;
  overallRating: number;
  qualityScore: number;
  valueScore: number;
  supportScore: number;
  productCount: number;
  /** Real min/max price across this brand's currently eligible products; omitted when the brand has none. */
  minPrice?: number;
  maxPrice?: number;
  isCurrent: boolean;
};

export type BrandComparisonResult = {
  current: BrandComparisonCard;
  candidates: BrandComparisonCard[];
  filter: {
    category: string;
    ratingTolerance: number;
    fallbackTier: 'primary' | 'tier-0.5' | 'parent-category' | 'none';
  };
};

function productRatingAndReviews(productId: string): { rating: number; reviewCount: number } {
  const reviews = operationsStore.listReviews({ productId, status: 'published' });
  if (!reviews.length) return { rating: 0, reviewCount: 0 };
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
  return { rating: sum / reviews.length, reviewCount: reviews.length };
}

function toProductCard(product: CatalogProduct, isCurrent: boolean): ProductComparisonCard {
  const { rating, reviewCount } = productRatingAndReviews(product.id);
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brandId: product.brandId,
    brandName: product.brandName,
    image: product.image,
    price: product.price,
    rating,
    reviewCount,
    inStock: product.stock > 0 && product.status !== 'out_of_stock',
    isCurrent,
  };
}

async function eligibleProducts(excludeId: string): Promise<CatalogProduct[]> {
  const [products, brands] = await Promise.all([catalogStore.listProducts(), catalogStore.listBrands()]);
  const brandsById = new Map(brands.map((b) => [b.id, b]));
  return products.filter((p) => {
    if (p.id === excludeId) return false;
    const brand = brandsById.get(p.brandId);
    if (!brand) return false;
    return isProductPubliclyEligible(p, brand);
  });
}

function rankProductCandidates(
  current: CatalogProduct,
  pool: CatalogProduct[],
  max: number,
): CatalogProduct[] {
  const currentStats = productRatingAndReviews(current.id);
  const scored = pool.map((p) => {
    const stats = productRatingAndReviews(p.id);
    const priceProximity = Math.abs(p.price - current.price);
    const ratingProximity = Math.abs(stats.rating - currentStats.rating);
    const inStock = p.stock > 0 && p.status !== 'out_of_stock' ? 0 : 1;
    return { product: p, priceProximity, ratingProximity, reviewCount: stats.reviewCount, inStock };
  });
  scored.sort((a, b) => {
    if (a.priceProximity !== b.priceProximity) return a.priceProximity - b.priceProximity;
    if (a.ratingProximity !== b.ratingProximity) return a.ratingProximity - b.ratingProximity;
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
    return a.inStock - b.inStock;
  });
  const seen = new Set<string>([current.id]);
  const result: CatalogProduct[] = [];
  for (const row of scored) {
    if (seen.has(row.product.id)) continue;
    seen.add(row.product.id);
    result.push(row.product);
    if (result.length >= max) break;
  }
  return result;
}

/**
 * Product Quick Comparison — same category, price within tolerance,
 * marketplace-visible seller/brand only. Falls back through progressively
 * wider tiers if fewer than 3 candidates are found, per spec:
 *   same category ±25% -> parent category ±20% -> same category closest-price.
 */
export async function getProductComparison(productId: string): Promise<ProductComparisonResult | null> {
  const config = getCompareConfig();
  const current = await catalogStore.getProduct(productId);
  if (!current) return null;

  const pool = await eligibleProducts(current.id);
  const sameCategory = pool.filter((p) => p.categoryId === current.categoryId);

  const withinRange = (p: CatalogProduct, tolerancePercent: number) => {
    const min = current.price * (1 - tolerancePercent / 100);
    const max = current.price * (1 + tolerancePercent / 100);
    return p.price >= min && p.price <= max;
  };

  let fallbackTier: ProductComparisonResult['filter']['fallbackTier'] = 'primary';
  let matched = sameCategory.filter((p) => withinRange(p, config.productPriceTolerancePercent));
  let minPrice = current.price * (1 - config.productPriceTolerancePercent / 100);
  let maxPrice = current.price * (1 + config.productPriceTolerancePercent / 100);
  let tolerance = config.productPriceTolerancePercent;

  if (matched.length < 3) {
    const wider = sameCategory.filter((p) => withinRange(p, 25));
    if (wider.length > matched.length) {
      matched = wider;
      fallbackTier = 'category-25';
      tolerance = 25;
      minPrice = current.price * 0.75;
      maxPrice = current.price * 1.25;
    }
  }

  if (matched.length < 3) {
    const categories = await catalogStore.listCategories();
    const currentCategory = categories?.find((c) => c.id === current.categoryId);
    if (currentCategory?.parentId) {
      const siblings = pool.filter((p) => {
        const cat = categories?.find((c) => c.id === p.categoryId);
        return cat?.parentId === currentCategory.parentId;
      });
      const withinParent = siblings.filter((p) => withinRange(p, 20));
      if (withinParent.length > matched.length) {
        matched = withinParent;
        fallbackTier = 'parent-20';
        tolerance = 20;
        minPrice = current.price * 0.8;
        maxPrice = current.price * 1.2;
      }
    }
  }

  if (matched.length < 3) {
    // Final fallback: same category, closest price, no tolerance bound.
    if (sameCategory.length > matched.length) {
      matched = sameCategory;
      fallbackTier = 'closest-price';
    }
  }

  const candidates = rankProductCandidates(current, matched, config.maxComparisonCards - 1);

  return {
    current: toProductCard(current, true),
    candidates: candidates.map((p) => toProductCard(p, false)),
    filter: {
      categoryId: current.categoryId,
      categoryName: current.categoryName,
      minPrice,
      maxPrice,
      priceTolerancePercent: tolerance,
      fallbackTier: candidates.length ? fallbackTier : 'none',
    },
  };
}

function toBrandCard(
  brand: CatalogBrand,
  productCount: number,
  priceRange: { min: number; max: number } | undefined,
  isCurrent: boolean,
): BrandComparisonCard {
  const overall = brand.ratings ?? 0;
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    logo: brand.logo,
    coverImage: brand.coverImage,
    verifiedStatus: brand.verifiedStatus,
    category: brand.category,
    overallRating: overall,
    qualityScore: brand.qualityScore ?? overall,
    valueScore: brand.valueScore ?? overall,
    supportScore: brand.supportScore ?? overall,
    productCount,
    minPrice: priceRange?.min,
    maxPrice: priceRange?.max,
    isCurrent,
  };
}

async function brandProductCounts(): Promise<Map<string, number>> {
  const products = await catalogStore.listProducts();
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.brandId, (counts.get(p.brandId) || 0) + 1);
  }
  return counts;
}

/** Real per-brand min/max price derived from that brand's actual catalog products (never invented). */
async function brandPriceRanges(): Promise<Map<string, { min: number; max: number }>> {
  const products = await catalogStore.listProducts();
  const ranges = new Map<string, { min: number; max: number }>();
  for (const p of products) {
    if (typeof p.price !== 'number') continue;
    const existing = ranges.get(p.brandId);
    if (!existing) {
      ranges.set(p.brandId, { min: p.price, max: p.price });
    } else {
      existing.min = Math.min(existing.min, p.price);
      existing.max = Math.max(existing.max, p.price);
    }
  }
  return ranges;
}

function rankBrandCandidates(
  current: CatalogBrand,
  pool: CatalogBrand[],
  productCounts: Map<string, number>,
  max: number,
): CatalogBrand[] {
  const currentCount = productCounts.get(current.id) || 0;
  const scored = pool.map((b) => {
    const overlap = b.category === current.category ? 0 : 1;
    const ratingProximity = Math.abs((b.ratings ?? 0) - (current.ratings ?? 0));
    const count = productCounts.get(b.id) || 0;
    const countSimilarity = Math.abs(count - currentCount);
    return { brand: b, overlap, ratingProximity, count, countSimilarity };
  });
  scored.sort((a, b) => {
    if (a.overlap !== b.overlap) return a.overlap - b.overlap;
    if (a.ratingProximity !== b.ratingProximity) return a.ratingProximity - b.ratingProximity;
    if (a.count !== b.count) return b.count - a.count;
    return a.countSimilarity - b.countSimilarity;
  });
  const seen = new Set<string>([current.id]);
  const result: CatalogBrand[] = [];
  for (const row of scored) {
    if (seen.has(row.brand.id)) continue;
    seen.add(row.brand.id);
    result.push(row.brand);
    if (result.length >= max) break;
  }
  return result;
}

/**
 * Brand Quick Comparison — overlapping category, rating within tolerance,
 * marketplace-visible only. Falls back ±0.3 -> ±0.5 -> same/shared parent
 * category, closest rating, per spec.
 */
export async function getBrandComparison(brandId: string): Promise<BrandComparisonResult | null> {
  const config = getCompareConfig();
  const brands = await catalogStore.listBrands();
  const current = brands.find((b) => b.id === brandId);
  if (!current) return null;

  const pool = brands.filter((b) => b.id !== current.id && brandIsMarketplaceVisible(b));
  const productCounts = await brandProductCounts();
  const priceRanges = await brandPriceRanges();

  const withinRating = (b: CatalogBrand, tolerance: number) =>
    Math.abs((b.ratings ?? 0) - (current.ratings ?? 0)) <= tolerance;

  let fallbackTier: BrandComparisonResult['filter']['fallbackTier'] = 'primary';
  const sameCategory = pool.filter((b) => b.category === current.category);
  let matched = sameCategory.filter((b) => withinRating(b, config.brandRatingTolerance));
  let tolerance = config.brandRatingTolerance;

  if (matched.length < 3) {
    const wider = sameCategory.filter((b) => withinRating(b, 0.5));
    if (wider.length > matched.length) {
      matched = wider;
      fallbackTier = 'tier-0.5';
      tolerance = 0.5;
    }
  }

  if (matched.length < 3) {
    // Parent/shared-category tier: any marketplace-visible brand, closest rating.
    if (pool.length > matched.length) {
      matched = pool;
      fallbackTier = 'parent-category';
    }
  }

  const candidates = rankBrandCandidates(current, matched, productCounts, config.maxComparisonCards - 1);

  return {
    current: toBrandCard(current, productCounts.get(current.id) || 0, priceRanges.get(current.id), true),
    candidates: candidates.map((b) =>
      toBrandCard(b, productCounts.get(b.id) || 0, priceRanges.get(b.id), false),
    ),
    filter: {
      category: current.category,
      ratingTolerance: tolerance,
      fallbackTier: candidates.length ? fallbackTier : 'none',
    },
  };
}
