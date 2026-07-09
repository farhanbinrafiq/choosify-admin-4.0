import type { DiscoveryCollectionKey, SearchSort } from './searchTypes';

const SEARCH_SORTS: SearchSort[] = ['relevance', 'price_asc', 'price_desc', 'newest', 'rating'];

const DISCOVERY_KEYS: DiscoveryCollectionKey[] = [
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

export function isSearchSort(value: unknown): value is SearchSort {
  return typeof value === 'string' && SEARCH_SORTS.includes(value as SearchSort);
}

export function isDiscoveryCollectionKey(value: unknown): value is DiscoveryCollectionKey {
  return typeof value === 'string' && DISCOVERY_KEYS.includes(value as DiscoveryCollectionKey);
}
