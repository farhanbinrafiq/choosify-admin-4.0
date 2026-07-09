# Marketplace Analytics Engine — ES-008

Reusable event-driven analytics infrastructure for Choosify marketplace telemetry. The engine is designed to become a source for seller dashboards, admin dashboards, search ranking, recommendations, trending products, marketing, and future Emi AI workflows.

## Architecture

```
Request / UI Action
  -> Representative hook (product view, search, wishlist, compare, login)
  -> recordEventAsync()
  -> analyticsService.recordEvent()
  -> analyticsStorage (in-memory now, analytics_events schema documented)
  -> aggregationUtils
  -> /api/analytics/summary, /api/analytics/trending, /api/admin/analytics
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Event constants | `server/analytics/analyticsEvents.ts` | Central event definitions, no hardcoded strings |
| Types | `server/analytics/analyticsTypes.ts` | `AnalyticsEvent`, `AnalyticsPayload`, `AnalyticsSummary`, `TrendResult`, `TimeRange` |
| Service | `server/analytics/analyticsService.ts` | `recordEvent`, `batchRecord`, `aggregateEvents`, `summarize` |
| Storage | `server/analytics/analyticsStorage.ts` | Minimal in-memory storage and future collection name |
| Aggregations | `server/analytics/aggregationUtils.ts` | Top/trending/growth-ready utilities |
| Ranges | `server/analytics/timeRanges.ts` | Today, 7d, 30d, 90d, 12m, custom |
| Hooks | `server/analytics/eventHooks.ts` | Product view, search, wishlist, compare, login helpers |
| API | `server/analytics/analyticsRouter.ts` | Generic analytics endpoints |

## Event Model

Supported event constants:

- `PRODUCT_VIEW`
- `PRODUCT_COMPARE`
- `PRODUCT_WISHLIST`
- `PRODUCT_SHARE`
- `PRODUCT_CLICK`
- `PRODUCT_SEARCH`
- `PRODUCT_PURCHASE`
- `PRODUCT_REVIEW`
- `PRODUCT_REPORT`
- `SELLER_PROFILE_VIEW`
- `SELLER_FOLLOW`
- `STORE_VISIT`
- `CATEGORY_VIEW`
- `BRAND_VIEW`
- `LOGIN`
- `REGISTER`
- `SEARCH`
- `FILTER`
- `NOTIFICATION_CLICK`

Use `ANALYTICS_EVENTS` from `analyticsEvents.ts`; do not hardcode strings.

## Schema

### `AnalyticsEvent`

```ts
type AnalyticsEvent = {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  productId?: string;
  productTitle?: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  sellerId?: string;
  sellerName?: string;
  searchQuery?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};
```

### Storage

Current mode: in-memory bounded array.

Future collection name: `analytics_events`.

Minimal document fields should match `AnalyticsEvent`. For future partitioning, add derived fields such as:

- `dayKey` (`YYYY-MM-DD`)
- `monthKey` (`YYYY-MM`)
- `eventType`
- `entityType`

No existing Firestore collection is changed.

## Event Flow

### Fire-and-forget hooks

Representative hooks are intentionally limited:

- Product detail view (`GET /api/v1/catalog/products/:id`)
- Catalog search (`GET /api/v1/catalog/products?q=...`)
- Wishlist (`POST /api/analytics/hooks/wishlist`)
- Compare (`POST /api/analytics/hooks/compare`)
- Login (`/api/v1/auth/me`, `/api/v1/auth/dev-login`)

These use `recordEventAsync()` so event recording does not block the response.

### Direct recording APIs

`POST /api/analytics/events`

`POST /api/analytics/events/batch`

These return `202 Accepted` when events are accepted.

## Analytics API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/analytics/events` | Record a single analytics event |
| `POST /api/analytics/events/batch` | Record multiple events |
| `POST /api/analytics/hooks/wishlist` | Representative wishlist hook |
| `POST /api/analytics/hooks/compare` | Representative compare hook |
| `GET /api/analytics/summary` | Generic marketplace analytics summary |
| `GET /api/analytics/trending` | Trending products/categories/brands/searches |
| `GET /api/analytics/events/types` | Event constants registry |
| `GET /api/analytics/storage` | Storage status |
| `GET /api/admin/analytics` | Admin aggregate payload |

## Time Ranges

Supported query values:

- `today`
- `7d`
- `30d`
- `90d`
- `12m`
- `custom&from=<iso>&to=<iso>`

Example:

```text
GET /api/analytics/summary?range=30d
GET /api/analytics/summary?range=custom&from=2026-07-01T00:00:00Z&to=2026-07-09T00:00:00Z
```

## Aggregation

Implemented utilities:

- Top Products
- Top Categories
- Top Brands
- Trending Searches
- Top Sellers
- Most Compared
- Most Wishlisted
- Most Viewed
- Growth Rate helper
- Event counts by type

Aggregations operate on the current event snapshot for the requested time range.

## Performance

Recording hooks use `setTimeout(..., 0)` and do not block route responses. Trade-off: if the process exits immediately after a request, an in-flight fire-and-forget event can be lost. Direct `POST /analytics/events` waits until the in-memory append completes.

Expected overhead:

- Fire-and-forget hook scheduling: ~0.02–0.1 ms
- Direct event append: ~0.05–0.2 ms
- Aggregation: O(n) over retained in-memory events

`ANALYTICS_MAX_IN_MEMORY_EVENTS` can cap retained event count (default: 25,000).

## Migration Guide

### Current estimated metrics

ES-007 Seller Intelligence still estimates product views, wishlist count, compare count, profile completion, and traffic sources where telemetry is missing.

### Future real metrics

Replace estimates with analytics aggregations:

| Current estimate | Future event source |
|------------------|---------------------|
| Product views | `PRODUCT_VIEW` |
| Wishlist count | `PRODUCT_WISHLIST` |
| Compare count | `PRODUCT_COMPARE` |
| Traffic sources | `source` field on events |
| Search popularity | `SEARCH` / `PRODUCT_SEARCH` |
| Seller popularity | `SELLER_PROFILE_VIEW`, `STORE_VISIT`, `SELLER_FOLLOW` |

### Replacement strategy

1. Keep ES-007 payload shape stable.
2. Add reads from `analyticsService.summarize()` or a seller-scoped aggregation helper.
3. Prefer real events when counts are available.
4. Fall back to estimates only when event volume is zero.
5. Remove fallback TODOs after telemetry reaches production coverage.

## Telemetry Roadmap

1. Add frontend event client for product cards, wishlist, compare, share, and filters.
2. Persist events to `analytics_events` with daily/monthly partition keys.
3. Add scheduled rollups for high-volume dashboards.
4. Feed trend outputs into search ranking and recommendations.
5. Export event summaries to future Emi AI feature pipelines.

## Future AI Integration

Future Emi AI can consume:

- Trending search terms
- Product engagement deltas
- Seller/store visit trends
- Category momentum
- Wishlist/compare intent signals
- Review/report signals

Potential use cases:

- AI product ranking explanations
- Seller action recommendations
- Automated merchandising suggestions
- Anomaly detection for abuse or sudden demand
- Personalized recommendation features
