import type { CatalogProduct } from '../../src/types/catalog';
import type { RankingWeights } from './rankingWeights';

export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating';

export type SearchFilter = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  status?: CatalogProduct['status'];
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  newArrivalsOnly?: boolean;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
};

export type SearchResultItem = {
  product: CatalogProduct;
  score: number;
  breakdown: Record<string, number>;
};

export type SearchResult = {
  items: SearchResultItem[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    query: string;
    sort: SearchSort;
    weights: RankingWeights;
  };
};

export type AutocompleteSuggestion = {
  id: string;
  label: string;
  type:
    | 'product'
    | 'brand'
    | 'category'
    | 'store'
    | 'popular_search'
    | 'trending_search';
};

export type AutocompleteResult = {
  query: string;
  products: AutocompleteSuggestion[];
  brands: AutocompleteSuggestion[];
  categories: AutocompleteSuggestion[];
  stores: AutocompleteSuggestion[];
  popularSearches: AutocompleteSuggestion[];
  trendingSearches: AutocompleteSuggestion[];
  recentSearches?: AutocompleteSuggestion[];
};

export type DiscoveryCollectionKey =
  | 'trendingProducts'
  | 'trendingBrands'
  | 'trendingCategories'
  | 'featuredProducts'
  | 'editorsChoice'
  | 'newArrivals'
  | 'recentlyUpdated'
  | 'mostCompared'
  | 'mostWishlisted'
  | 'mostViewed'
  | 'topRated';

export type DiscoveryItem = {
  id: string;
  label: string;
  type: 'product' | 'brand' | 'category';
  score?: number;
  count?: number;
  metadata?: Record<string, unknown>;
};

export type DiscoveryResult = {
  collections: Partial<Record<DiscoveryCollectionKey, DiscoveryItem[]>>;
  generatedAt: string;
};

export type TrendingSnapshot = {
  range: string;
  trendingSearches: Array<{ id: string; label: string; count: number }>;
  topProducts: Array<{ id: string; label: string; count: number }>;
  topBrands: Array<{ id: string; label: string; count: number }>;
  topCategories: Array<{ id: string; label: string; count: number }>;
  generatedAt: string;
};

export type SearchSuggestionSet = {
  didYouMean: string | null;
  relatedSearches: string[];
  popularInCategory: string[];
  popularBrands: string[];
  trendingKeywords: string[];
};
