# Discovery, Search & Ranking Engine — ES-010

Intelligent search and discovery infrastructure for Choosify. Combines keyword relevance, popularity, trust, seller reputation, product quality, freshness, availability, and analytics signals into a configurable weighted ranking engine.

## Architecture

```
GET /api/search
  -> searchEngine.search()
  -> buildRankingContext()  (analytics, trust, reviews, moderation)
  -> rankingEngine.rankProducts()
  -> searchAnalytics hooks (ES-008)
  -> response with scores + suggestions

GET /api/search/discovery
  -> discoveryEngine.getDiscoveryCollections()
  -> analytics summarize + catalog flags (no fabricated metrics)

GET /api/search/autocomplete
  -> catalog + site config + analytics trending
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Types | `server/search/searchTypes.ts` | Search, autocomplete, discovery types |
| Weights | `server/search/rankingWeights.ts` | Configurable ranking weights (env override) |
| Ranking | `server/search/rankingEngine.ts` | Weighted scoring, signal assembly |
| Search | `server/search/searchEngine.ts` | Search, rank, filter, sort, recommend, autocomplete |
| Discovery | `server/search/discoveryEngine.ts` | Trending, featured, top-rated collections |
| Filters | `server/search/searchFilters.ts` | Reusable filter/sort helpers |
| Analytics | `server/search/searchAnalytics.ts` | ES-008 search event hooks |
| API | `server/search/searchRouter.ts` | `/api/search/*` endpoints |

## Ranking Formula

Final score (0–100) is the sum of weighted components plus boosts:

| Component | Default Weight | Signals |
|-----------|----------------|---------|
| Keyword | 40% | Title, brand, category, tags, description match |
| Popularity | 15% | Views, wishlists, compares (ES-008 analytics) |
| Trust | 15% | ES-009 `calculateTrustScore` (product/brand) |
| Seller | 10% | ES-009 `calculateSellerReputation` (brand proxy) |
| Freshness | 5% | `isNewArrival`, `updatedAt` recency |
| Reviews | 10% | Average rating + review count (operations store) |
| Inventory | 5% | In-stock vs out-of-stock |
| Sponsored boost | +15 | Brand `sponsoredFlag` or placement |
| Admin boost | +5–10 | `featuredFlag`, `isBestseller` |

Weights are defined in `rankingWeights.ts` and overrideable via environment variables (`RANKING_WEIGHT_KEYWORD`, etc.).

### Trust Gating

- Products with `status !== 'live'` are excluded
- Products rejected in ES-009 moderation queue never rank
- No fake trust or reputation values — placeholders use neutral defaults only when data is unavailable

## Search Flow

1. Client calls `GET /api/search?q=...&sort=relevance`
2. Products loaded from catalog store
3. Ranking context built (analytics counts, reviews, trust, rejected IDs)
4. Products filtered and ranked
5. Analytics recorded: `SEARCH`, `SEARCH_NO_RESULT`
6. Suggestions returned: did-you-mean, related, trending

### Existing Search Preserved

`GET /api/v1/catalog/products` remains unchanged with substring filtering and `recordSearch` hook.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/search` | Ranked search with filters, sort, suggestions |
| `GET /api/search/autocomplete` | Products, brands, categories, stores, popular/trending |
| `GET /api/search/trending` | Analytics trending snapshot |
| `GET /api/search/discovery` | Discovery collections (optional `sections` param) |
| `GET /api/search/recommend/:productId` | Related products |
| `POST /api/search/analytics/click` | Record search result click |
| `POST /api/search/analytics/autocomplete` | Record autocomplete selection |
| `POST /api/search/analytics/suggestion` | Record suggestion selection |

## Discovery Collections

| Collection | Data Source |
|------------|-------------|
| `trendingProducts` | ES-008 `topProducts` |
| `trendingBrands` | ES-008 `topBrands` (fallback: featured/sponsored brands) |
| `trendingCategories` | ES-008 `topCategories` |
| `featuredProducts` | `featuredFlag` + homepage config |
| `editorsChoice` | Homepage featured IDs |
| `newArrivals` | `isNewArrival` catalog flag |
| `recentlyUpdated` | `updatedAt` sort |
| `mostCompared` | ES-008 analytics |
| `mostWishlisted` | ES-008 analytics |
| `mostViewed` | ES-008 analytics |
| `topRated` | Operations review ratings |

Empty analytics collections return empty arrays — no fabricated counts.

## Integrations

### ES-008 Analytics

- Ranking uses `summarize('30d')` for view/wishlist/compare counts
- Search records `SEARCH`, `SEARCH_CLICK`, `SEARCH_NO_RESULT`, `SEARCH_AUTOCOMPLETE_SELECT`, `SEARCH_SUGGESTION_SELECT`

### ES-009 Trust

- `calculateTrustScore('product' | 'brand', id)`
- `calculateSellerReputation(brandId)` as seller proxy
- Rejected moderation items excluded

### ES-007 Seller Intelligence

- Seller health scores reserved via `sellerHealthScores` map (framework ready)
- Not wired per-product yet — brand-level reputation used where available

## Future AI Ranking

1. **Personalization** — User/session affinity vectors from click streams
2. **Learning-to-rank** — Train on `SEARCH_CLICK` vs `SEARCH_NO_RESULT` outcomes
3. **Semantic search** — Embedding-based keyword relevance beyond substring match
4. **Query understanding** — Intent classification (navigational, transactional, informational)
5. **Real-time signals** — Stream processing for trending instead of in-memory batch

---

## Migration Report

### Current Search

| Area | State |
|------|-------|
| Public API | `GET /api/v1/catalog/products` — substring filter, no ranking |
| Admin client | `catalogApi.listProducts()` — no query params, client-side filter |
| Analytics | `recordSearch` on catalog route when `q` present |
| Rate limit | Search limiter on catalog products with `q` |

### Future Search

| Capability | ES-010 |
|------------|--------|
| Weighted ranking | `rankingEngine.ts` with configurable weights |
| Trust-aware results | ES-009 integration, rejected product exclusion |
| Discovery feeds | `/api/search/discovery` with real analytics |
| Autocomplete | `/api/search/autocomplete` |
| Search analytics | Dedicated event types + hooks |
| Suggestions | Did-you-mean, related, trending frameworks |

### Current Limitations

- In-memory full-catalog scan (no search index)
- Analytics ring buffer resets on restart
- Seller linkage via brand proxy (no `sellerId` on products)
- Seller health not per-product wired
- Recent searches framework only (no persistence)

### Future Personalization

- Session-based recent searches (client-side or Redis)
- User affinity from click/conversion history
- Category-aware boosting from browse patterns
- A/B testing weight profiles via config service
