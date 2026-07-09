import { Router } from 'express';
import { success } from '../lib/apiResponse';
import {
  autocomplete,
  buildSuggestions,
  getDiscoveryCollections,
  getTrendingSnapshot,
  recommend,
  search,
} from './searchEngine';
import {
  recordAutocompleteSelection,
  recordSearchClick,
  recordSearchNoResult,
  recordSearchQuery,
  recordSuggestionSelection,
} from './searchAnalytics';
import type { DiscoveryCollectionKey, SearchFilter } from './searchTypes';
import { isDiscoveryCollectionKey, isSearchSort } from './searchValidation';

export const searchRouter = Router();

function parseQueryNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

searchRouter.get('/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const filter: SearchFilter = {
      q,
      categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
      brandId: typeof req.query.brandId === 'string' ? req.query.brandId : undefined,
      status: typeof req.query.status === 'string' ? (req.query.status as 'live') : undefined,
      inStockOnly: req.query.inStockOnly === 'true',
      featuredOnly: req.query.featuredOnly === 'true',
      newArrivalsOnly: req.query.newArrivalsOnly === 'true',
      sort: isSearchSort(req.query.sort) ? req.query.sort : 'relevance',
      limit: parseQueryNumber(req.query.limit),
      offset: parseQueryNumber(req.query.offset),
    };

    const result = await search(filter);

    if (q) {
      if (result.meta.total === 0) {
        recordSearchNoResult(req, { searchQuery: q, source: 'search_api' });
      } else {
        recordSearchQuery(req, {
          searchQuery: q,
          resultCount: result.meta.total,
          source: 'search_api',
        });
      }
    }

    const suggestions = q ? await buildSuggestions(q, filter.categoryId) : undefined;
    return success(res, { ...result, suggestions });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    });
  }
});

searchRouter.get('/search/autocomplete', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Number(req.query.limit) || 10;
  const data = await autocomplete(q, limit);
  return success(res, data);
});

searchRouter.get('/search/trending', async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '7d';
  const data = await getTrendingSnapshot(range);
  return success(res, data);
});

searchRouter.get('/search/discovery', async (req, res) => {
  const sectionsParam = typeof req.query.sections === 'string' ? req.query.sections : '';
  const sections = sectionsParam
    .split(',')
    .map((value) => value.trim())
    .filter(isDiscoveryCollectionKey) as DiscoveryCollectionKey[];
  const data = await getDiscoveryCollections(sections.length ? sections : undefined);
  return success(res, data);
});

searchRouter.get('/search/recommend/:productId', async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const items = await recommend(req.params.productId, limit);
  return success(res, { items });
});

searchRouter.post('/search/analytics/click', (req, res) => {
  const body = req.body || {};
  if (typeof body.productId !== 'string') {
    return res.status(400).json({ success: false, error: 'productId is required' });
  }
  recordSearchClick(req, {
    productId: body.productId,
    productTitle: body.productTitle,
    searchQuery: body.searchQuery,
    source: 'search_click_hook',
    metadata: body.metadata,
  });
  return res.status(202).json({ success: true });
});

searchRouter.post('/search/analytics/autocomplete', (req, res) => {
  const body = req.body || {};
  if (typeof body.searchQuery !== 'string') {
    return res.status(400).json({ success: false, error: 'searchQuery is required' });
  }
  recordAutocompleteSelection(req, {
    searchQuery: body.searchQuery,
    source: 'autocomplete_hook',
    metadata: body.metadata,
  });
  return res.status(202).json({ success: true });
});

searchRouter.post('/search/analytics/suggestion', (req, res) => {
  const body = req.body || {};
  if (typeof body.searchQuery !== 'string') {
    return res.status(400).json({ success: false, error: 'searchQuery is required' });
  }
  recordSuggestionSelection(req, {
    searchQuery: body.searchQuery,
    source: 'suggestion_hook',
    metadata: body.metadata,
  });
  return res.status(202).json({ success: true });
});
