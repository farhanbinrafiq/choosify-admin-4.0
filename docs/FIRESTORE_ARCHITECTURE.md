# Firestore Architecture & Query Optimization

Sprint 4 documents and optimizes the existing Choosify Firestore layer without redesigning collections or API contracts.

## Current architecture

```
Express API
  -> catalogStore / firestoreAdminStore (catalog_* collections)
  -> operationsFirestore (ops_state, admin_users)
  -> omniStore (omni_* collections)
  -> Firebase Admin SDK (server/firebaseAdmin.ts)
  -> Firestore database (FIRESTORE_DATABASE_ID)
```

### Persistence modes

| Domain | Firestore flag | Collections |
|--------|----------------|-------------|
| Catalog | `CATALOG_USE_FIRESTORE=true` | `catalog_*`, `settings/catalog_*` |
| Operations | `OPERATIONS_USE_FIRESTORE=true` | `ops_state`, `admin_users` |
| Messaging | Auto when Admin SDK configured | `omni_conversations`, `omni_messages`, `omni_agents`, `omni_customers` |

Each domain falls back to in-memory stores when Firestore is unavailable.

---

## Firestore query audit

### Catalog (`lib/vercel-catalog/catalogFirestoreAdmin.ts`)

| Collection | Query type | Filters | orderBy | limit | Cursor | Notes |
|------------|------------|---------|---------|-------|--------|-------|
| `catalog_products` | Collection scan | None | None | None | No | Full read; filtered in API layer |
| `catalog_products` | Doc get | `id` | N/A | 1 | No | By document ID |
| `catalog_products` | Existence | None | None | 1 | No | Seed check |
| `catalog_categories` | Collection scan | None | None | None | No | Full read |
| `catalog_brands` | Collection scan | None | None | None | No | Full read |
| `catalog_deals` | Collection scan | None | None | None | No | Full read |
| `catalog_creators` | Collection scan | None | None | None | No | Full read |
| `catalog_guides` | Collection scan | None | None | None | No | Full read |
| `catalog_placements` | Collection scan | None | None | None | No | Full read |
| `catalog_product_details` | Collection scan / doc get | Optional `productId` | None | None | No | |
| `catalog_brand_posts` | Collection scan / doc get | Optional `id` | None | None | No | |
| `settings/catalog_homepage` | Doc get/set | Doc ID | N/A | 1 | No | Singleton config |
| `settings/catalog_site` | Doc get/set | Doc ID | N/A | 1 | No | Singleton config |

**Performance issues:** `/catalog/snapshot` and `/catalog/home` trigger multiple full collection reads. Acceptable at current scale; cursor pagination recommended for products at scale.

### Operations (`server/operations/operationsFirestore.ts`)

| Collection | Query type | Filters | orderBy | limit | Cursor | Notes |
|------------|------------|---------|---------|-------|--------|-------|
| `ops_state` | Doc get/set | `snapshot` doc | N/A | 1 | No | Entire ops state in one document |
| `admin_users` | Doc get | UID | N/A | 1 | No | Auth profile lookup |
| `admin_users` | Query | `email ==` | None | 1 | No | Auth fallback lookup |

**Performance issues:** `ops_state` snapshot grows with all orders/reviews; single-doc pattern limits query complexity but increases write contention.

### Messaging (`server/messaging/omniStore.ts`)

| Collection | Query type | Filters | orderBy | limit | Cursor | Notes |
|------------|------------|---------|---------|-------|--------|-------|
| `omni_conversations` | Ordered scan | None | `updatedAt desc` | Optional | Optional | Inbox list |
| `omni_conversations` | Doc get | `conversationId` | N/A | 1 | No | |
| `omni_conversations` | Existence | None | None | 1 | No | Seed check |
| `omni_messages` | Query | `conversationId ==` | `timestamp asc` | Optional | Optional | Thread history |
| `omni_messages` | Query | `conversationId ==`, `direction ==` | `timestamp desc` | 1 | No | WhatsApp 24h rule |
| `omni_messages` | Query | `platformMessageId ==` | None | 1 | No | Deduplication |
| `omni_agents` | Collection scan | None | None | None | No | Small collection |
| `omni_customers` | Doc write | `id` | N/A | 1 | No | Direct writes |

**Performance issues:** `listConversations()` without limit reads entire inbox. `listMessages()` without limit reads full thread history.

---

## Shared utilities (`server/lib/firestore/`)

| Module | Purpose |
|--------|---------|
| `queryHelpers.ts` | CRUD helpers, filtered/ordered lists, existence checks |
| `documentHelpers.ts` | Safe snapshot-to-data conversion |
| `pagination.ts` | Cursor encode/decode utilities for future adoption |
| `timestamps.ts` | Server timestamp and ISO helpers |
| `batchHelpers.ts` | Chunked batch write runner (500 ops per batch) |

### Duplication removed

- Catalog CRUD helpers were duplicated in `lib/vercel-catalog/catalogFirestoreAdmin.ts` and `server/catalogFirestoreAdmin.ts`
- Both now use shared `queryHelpers`
- Messaging query patterns consolidated into shared helpers

---

## Representative optimizations (Sprint 4)

| # | Query | Optimization | Breaking change |
|---|-------|--------------|-----------------|
| 1 | Catalog CRUD | Shared `queryHelpers` deduplication | No |
| 2 | `loadAdminUser` | Field projection via `.select('role', 'displayName', 'email')` | No |
| 3 | `loadAdminUserByEmail` | Field projection + existing `limit(1)` | No |
| 4 | `messageExistsByPlatformId` | Shared `existsWhere` with `limit(1)` | No |
| 5 | `getLatestInboundMessage` | Shared `getLatestWhere` with `limit(1)` | No |
| 6 | `listConversations` / `listMessages` | Optional `limit` + `cursor` params on store functions (default unchanged) | No |

---

## Pagination strategy

### Current state

- Catalog list API uses **offset pagination in memory** after full Firestore reads
- Messaging APIs return **full result sets**

### Recommendations (not implemented to preserve API contracts)

| Endpoint | Current | Recommended |
|----------|---------|-------------|
| `GET /api/v1/catalog/products` | Offset in memory | Firestore `limit` + cursor on `updatedAt` |
| `GET /api/conversations` | Full inbox | `?limit=50&cursor=` on `updatedAt` |
| `GET /api/messages/:conversationId` | Full thread | `?limit=100&cursor=` on `timestamp` |

Store-layer optional `limit`/`cursor` parameters are now available on `listConversations()` and `listMessages()` for future API extension without changing default behavior.

---

## Transaction review

| Operation | Current | Transaction candidate? | Recommendation |
|-----------|---------|------------------------|----------------|
| `saveOperationsSnapshot` | Single doc merge write | Yes, if concurrent writers | Document only; ops store is single-writer today |
| Coupon usage + order create | Separate memory writes | Yes | Document for Firestore migration |
| Message + conversation update | Sequential writes | Optional | Acceptable; failure leaves minor inconsistency |
| Catalog upsert | Single doc merge | No | Already atomic per document |

**Sprint 4 action:** Document only. No transaction rewrites.

---

## Batch write opportunities

| Scenario | Opportunity | Status |
|----------|-------------|--------|
| Catalog seed (`ensureCatalogSeedData`) | Batch default catalog docs | Documented; use `runBatchedWrites` in future seed script |
| Omnichannel seed | Batch agents/customers/conversations | Documented |
| Bulk product import | Batch upserts | Documented for admin tooling |

`batchHelpers.runBatchedWrites()` is available for future adoption.

---

## Performance audit

### Large reads

- `catalog_*` full collection scans (9 collections)
- `GET /catalog/snapshot` — parallel full scans
- `listConversations()` — full inbox when no limit
- `listMessages()` — full thread when no limit
- `ops_state/snapshot` — entire operations state in one document

### Repeated queries

- Auth flow may call `loadAdminUser` on every authenticated request (when middleware adopted)
- `/catalog/home` reads homepage + lists products/brands/deals/creators/guides

### N+1 patterns

- `/catalog/snapshot` — multiple collection reads (parallel, not sequential N+1)
- `/catalog/home` — filters featured IDs in memory after full reads

### Duplicate fetches

- `server/catalogFirestoreAdmin.ts` and `lib/vercel-catalog/catalogFirestoreAdmin.ts` were duplicate implementations (now share helpers)

### Cache candidates

| Data | TTL | Notes |
|------|-----|-------|
| `settings/catalog_homepage` | 60s | Changes infrequently |
| `settings/catalog_site` | 60s | Changes infrequently |
| `catalog_categories` | 5m | Small, stable |
| `admin_users` role lookup | Request-scoped | After auth middleware adoption |

**Sprint 4 action:** Document only. No cache layer added.

---

## Best practices

1. Use `limit(1)` for existence and lookup queries
2. Use field projection (`.select()`) when full documents are not needed
3. Prefer indexed `where` + `orderBy` over full scans
4. Use shared helpers in `server/lib/firestore/` for new queries
5. Add composite indexes before deploying filtered queries to production
6. Introduce cursor pagination on new endpoints; migrate existing endpoints gradually

---

## Optimization strategy

### Phase 1 (completed — Sprint 4)

- Audit all queries
- Shared utilities
- Field projection on auth lookups
- Consolidate messaging query helpers
- Document indexes and pagination path

### Phase 2 (future)

- Add optional cursor params to messaging list APIs
- Move catalog product filtering into Firestore queries
- Add in-memory TTL cache for homepage/site config

### Phase 3 (future)

- Split `ops_state` snapshot into subcollections
- Transactional coupon redemption
- Batch catalog seeding

---

## Migration recommendations

1. Create indexes in `docs/FIRESTORE_INDEXES.md` before heavy omnichannel usage
2. Extend list APIs with optional `limit`/`cursor` query params (backward compatible)
3. Migrate catalog filtering from `catalogRouter.ts` into Firestore queries one collection at a time
4. Monitor `ops_state` document size; split when approaching 1 MiB Firestore doc limit

---

## Technical debt

**Did Sprint 4 introduce technical debt?** **NO**

- Utilities are opt-in and thin
- Existing query behavior preserved by default
- Optional pagination parameters added without API exposure yet
- Documentation captures future work without forcing premature abstraction

---

## Performance summary

| Change | Expected impact |
|--------|-----------------|
| Admin user field projection | 10–40% less bytes per auth lookup |
| Shared query helpers | No runtime change; reduced maintenance risk |
| `existsWhere` / `getLatestWhere` | Equivalent query patterns, clearer code |
| Optional store pagination params | Zero impact until APIs adopt them |

Overall expected production impact: **modest improvement** on auth lookups and code maintainability; **no measurable regression** on existing endpoints.
