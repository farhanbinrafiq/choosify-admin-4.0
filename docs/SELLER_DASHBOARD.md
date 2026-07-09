# Seller Dashboard — ES-007 Wave 2

Business Intelligence layer for the Choosify Seller Dashboard. Enhances the existing **Commerce & Visibility Panel** without replacing navigation, tabs, or the Sponsor Hub.

## Architecture

```
SellerDashboard.tsx (existing layout + tabs)
  └── SellerBusinessIntelligence (new BI section)
        └── useSellerDashboard hook
              └── sellerDashboardApi.fetchSellerDashboard()
                    └── GET /api/v1/operations/seller-dashboard
                          └── sellerIntelligenceService.ts (server calculations)
```

| Layer | Location | Responsibility |
|-------|----------|----------------|
| UI widgets | `src/components/seller-dashboard/` | Presentation, empty/loading/error states |
| Data hook | `src/hooks/useSellerDashboard.ts` | Fetch, range selection, refresh |
| API client | `src/services/sellerDashboardApi.ts` | HTTP transport only |
| Types | `src/types/sellerDashboard.ts` | Shared frontend contracts |
| Business logic | `server/operations/sellerIntelligenceService.ts` | Metrics, scoring, insights |
| API route | `GET /operations/seller-dashboard` | New endpoint (non-breaking) |

Business calculations live **only** in `sellerIntelligenceService.ts`. React components do not compute scores or aggregates.

## API

### `GET /api/v1/operations/seller-dashboard`

Query parameters:

| Param | Required | Description |
|-------|----------|-------------|
| `sellerId` | Yes | Seller user ID |
| `sellerName` | No | Improves review/store matching |
| `storeName` | No | Improves deal/product association |
| `range` | No | `7d` (default), `30d`, `90d` |

Response shape: `{ data: SellerDashboardPayload }`

## Widgets

| Module | Component | Data source |
|--------|-----------|-------------|
| Overview cards | `SellerOverviewCards` | `overview` |
| Performance charts | `SellerPerformancePanel` | `performance` |
| Product intelligence | `SellerProductIntelligenceTable` | `products[]` |
| Health score | `SellerHealthScoreCard` | `healthScore` |
| Action center | `SellerActionCenter` | `actionCenter[]` |
| Inventory alerts | `SellerInventoryAlerts` | `inventoryAlerts[]` |
| Notifications | `SellerNotificationWidget` | `notifications[]` |
| Insights | `SellerInsightsPanel` | `insights[]` |
| Shell states | `WidgetShell` | loading / error / empty / skeleton |

## Health Score (0–100)

Weighted composite of:

- Profile completion (15%)
- Verified status (10%)
- Response time (15%)
- Active listings (20%)
- Average rating (20%)
- Pending complaints (10%)
- Rejected products (5%)
- Missing information (5%)

Grades: `excellent` (85+), `good` (70+), `fair` (50+), `needs_attention` (<50).

Partial estimation is flagged when real telemetry is unavailable.

## Performance Metrics

### Implemented (real or derived)

- Product counts by status (live/draft/archived)
- Stock status (in stock / low / out)
- Review averages from operations reviews
- Order-derived weekly/monthly series (seller-scoped subOrders)
- Deal click attribution per product
- Category and brand rollups

### Placeholder / estimated (TODO in service)

- Product views, wishlist, compare counts
- Traffic source breakdown
- Profile completion percentage
- Unread message count (messaging integration pending)
- Support ticket count (ticket store pending)

Search for `TODO:` in `sellerIntelligenceService.ts` for upgrade points.

## Empty States

Every widget uses `WidgetShell` with:

- **Loading** — spinner + skeleton rows
- **Error** — message + optional retry
- **Empty** — contextual title and guidance
- **Success** — widget content

## Responsive Design

- Overview cards: 1 → 2 → 4 columns (`sm` / `xl`)
- Performance charts: stacked on mobile, 2-column on `xl`
- Product table: horizontal scroll on small screens
- Sidebar widgets (health, actions, alerts, notifications): single column, stacks below main content on mobile

Uses existing Tailwind tokens: `bg-app-card`, `border-app-border`, `text-app-accent`, rounded `[2rem]` cards.

## Future AI Integration

Recommended next steps:

1. **LLM insight generation** — feed `SellerProductIntelligence[]` + reviews into a prompt for natural-language recommendations
2. **Predictive restock** — ML model on order velocity vs stock
3. **Price optimization** — compare performance score vs category benchmarks
4. **Review sentiment** — NLP on `OpsReview.comment` for action center priorities
5. **Real telemetry pipeline** — replace estimated views/wishlist/compare with event stream (BigQuery, Segment, or internal analytics)

AI should consume the existing `SellerDashboardPayload` contract; no UI changes required.

## Seller Product Association

Products are matched to a seller via:

1. Catalog deal `seller` field
2. Brand ID / brand name overlap
3. Order `subOrders[].sellerId`
4. Fallback: first N catalog products if no match (demo/dev)

## Non-Goals (by design)

- No Firestore collection changes
- No auth/authorization changes
- No modification of existing API routes
- No replacement of Sponsor Hub or Intelligence Center tab
