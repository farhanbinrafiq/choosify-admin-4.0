# Changelog

All notable engineering program deliveries for Choosify Admin.

## ES-010 — Discovery, Search & Ranking Engine

### Added

- `server/search/` module with search engine, ranking engine, discovery engine, and analytics hooks
- Configurable ranking weights in `rankingWeights.ts` (env override support)
- Admin search APIs: `/api/search`, `/api/search/autocomplete`, `/api/search/trending`, `/api/search/discovery`
- ES-008 search analytics events: `SEARCH_CLICK`, `SEARCH_NO_RESULT`, `SEARCH_AUTOCOMPLETE_SELECT`, `SEARCH_SUGGESTION_SELECT`
- Trust-aware ranking via ES-009 (rejected products excluded, trust/reputation scoring)
- Discovery collections powered by real analytics and catalog flags
- Documentation: `docs/DISCOVERY_ENGINE.md`

### Changed

- `server.ts` — mounted `searchRouter` at `/api`
- `server/analytics/analyticsEvents.ts` — added search-specific event types

### Notes

- Existing `GET /api/v1/catalog/products` search preserved without modification
- No frontend changes; new APIs are additive
- Seller health integration framework ready; brand-level reputation used as proxy
- Not committed — awaiting review approval

## ES-009 — Trust, Safety & Reputation Platform

### Added

- Moderation platform (`server/moderation/`), reputation engine, bulk operations
- Admin APIs: `/api/admin/moderation/summary`, `/api/admin/moderation/queue`, `/api/admin/reputation`
- Documentation: `docs/TRUST_PLATFORM.md`

## ES-008 — Marketplace Analytics Engine

### Added

- Analytics service, storage, aggregation, and API routes
- Documentation: `docs/MARKETPLACE_ANALYTICS.md`

## ES-007 — Seller Experience & Seller Intelligence Platform

### Added

- Seller dashboard intelligence backend and widgets
- Documentation: `docs/SELLER_DASHBOARD.md`

## ES-006 — Observability, Audit Logging & Production Operations

### Added

- Audit logging, diagnostics, health/readiness enhancements
- Documentation: `docs/OBSERVABILITY.md`
