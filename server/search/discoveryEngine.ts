import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { getTrending, summarize } from '../analytics/analyticsService';
import { operationsStore } from '../operations/operationsStore';
import { moderationStore } from '../moderation/moderationStore';
import { MODERATION_STATUSES } from '../moderation/moderationTypes';
import type { CatalogProduct } from '../../src/types/catalog';
import type { DiscoveryCollectionKey, DiscoveryItem, DiscoveryResult, TrendingSnapshot } from './searchTypes';

function rejectedProductIds(): Set<string> {
  return new Set(
    moderationStore
      .listItems({ queue: 'products', status: MODERATION_STATUSES.REJECTED, limit: 5000 })
      .map((item) => item.resourceId),
  );
}

function liveProducts(products: CatalogProduct[], rejected: Set<string>): CatalogProduct[] {
  return products.filter((p) => p.status === 'live' && !rejected.has(p.id));
}

function toProductItems(products: CatalogProduct[], scoreKey?: 'count'): DiscoveryItem[] {
  return products.map((product) => ({
    id: product.id,
    label: product.title,
    type: 'product' as const,
    metadata: {
      brandName: product.brandName,
      categoryName: product.categoryName,
      price: product.price,
      image: product.image,
    },
    ...(scoreKey ? {} : {}),
  }));
}

function analyticsToItems(
  rows: Array<{ id: string; label: string; count: number; metadata?: Record<string, unknown> }>,
  type: DiscoveryItem['type'],
  rejected?: Set<string>,
): DiscoveryItem[] {
  return rows
    .filter((row) => !rejected || !rejected.has(row.id))
    .map((row) => ({
      id: row.id,
      label: row.label,
      type,
      count: row.count,
      metadata: row.metadata,
    }));
}

export async function getTrendingSnapshot(range = '7d'): Promise<TrendingSnapshot> {
  const trending = await getTrending(range);
  return {
    range,
    trendingSearches: trending.trendingSearches.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
    })),
    topProducts: trending.topProducts.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
    })),
    topBrands: trending.topBrands.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
    })),
    topCategories: trending.topCategories.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
    })),
    generatedAt: trending.generatedAt,
  };
}

export async function getDiscoveryCollections(
  sections?: DiscoveryCollectionKey[],
): Promise<DiscoveryResult> {
  const allSections: DiscoveryCollectionKey[] = sections?.length
    ? sections
    : [
        'trendingProducts',
        'trendingBrands',
        'trendingCategories',
        'featuredProducts',
        'editorsChoice',
        'newArrivals',
        'recentlyUpdated',
        'mostCompared',
        'mostWishlisted',
        'mostViewed',
        'topRated',
      ];

  const [products, brands, homepage, summary] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listBrands(),
    catalogStore.getHomepage().catch(() => null),
    summarize('30d'),
  ]);

  const rejected = rejectedProductIds();
  const live = liveProducts(products, rejected);
  const collections: DiscoveryResult['collections'] = {};

  for (const section of allSections) {
    switch (section) {
      case 'trendingProducts':
        collections.trendingProducts = analyticsToItems(summary.topProducts, 'product', rejected);
        break;
      case 'trendingBrands':
        collections.trendingBrands = analyticsToItems(summary.topBrands, 'brand');
        break;
      case 'trendingCategories':
        collections.trendingCategories = analyticsToItems(summary.topCategories, 'category');
        break;
      case 'featuredProducts':
        collections.featuredProducts = toProductItems(
          live.filter((p) => p.featuredFlag || homepage?.featuredProductIds.includes(p.id)),
        );
        break;
      case 'editorsChoice':
        collections.editorsChoice = toProductItems(
          live.filter((p) => homepage?.featuredProductIds.includes(p.id) || p.featuredFlag),
        );
        break;
      case 'newArrivals':
        collections.newArrivals = toProductItems(live.filter((p) => p.isNewArrival));
        break;
      case 'recentlyUpdated':
        collections.recentlyUpdated = toProductItems(
          [...live].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20),
        );
        break;
      case 'mostCompared':
        collections.mostCompared = analyticsToItems(summary.mostCompared, 'product', rejected);
        break;
      case 'mostWishlisted':
        collections.mostWishlisted = analyticsToItems(summary.mostWishlisted, 'product', rejected);
        break;
      case 'mostViewed':
        collections.mostViewed = analyticsToItems(summary.mostViewed, 'product', rejected);
        break;
      case 'topRated': {
        const ratings = new Map<string, { total: number; count: number; title: string }>();
        for (const review of operationsStore.listReviews()) {
          if (review.status !== 'approved' && review.status !== 'published') continue;
          if (rejected.has(review.productId)) continue;
          const row = ratings.get(review.productId) || {
            total: 0,
            count: 0,
            title: review.productTitle,
          };
          row.total += review.rating;
          row.count += 1;
          ratings.set(review.productId, row);
        }
        collections.topRated = [...ratings.entries()]
          .map(([id, data]) => ({
            id,
            label: data.title,
            type: 'product' as const,
            score: Number((data.total / data.count).toFixed(1)),
            count: data.count,
          }))
          .filter((item) => item.count > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 20);
        break;
      }
      default:
        break;
    }
  }

  if (allSections.includes('trendingBrands') && (!collections.trendingBrands || collections.trendingBrands.length === 0)) {
    collections.trendingBrands = brands
      .filter((b) => b.featuredFlag || b.sponsoredFlag)
      .slice(0, 10)
      .map((b) => ({ id: b.id, label: b.name, type: 'brand' as const }));
  }

  return {
    collections,
    generatedAt: new Date().toISOString(),
  };
}
