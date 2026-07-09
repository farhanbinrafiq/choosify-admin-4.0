# Trust, Safety & Reputation Platform — ES-009

Reusable moderation and reputation infrastructure for Choosify. This platform supports seller verification, product moderation, report management, trust scoring, fraud review, audit integration, and future AI moderation workflows.

## Architecture

```
Admin / Service Action
  -> moderationService (approve, reject, queue, resolve)
  -> moderationStore (in-memory queue, reports, verifications)
  -> reputationEngine (trust + seller reputation)
  -> eventHooks
       -> auditCatalogModeration (ES-006)
       -> recordEventAsync (ES-008)
  -> moderationRouter
       -> GET /api/admin/moderation/summary
       -> GET /api/admin/moderation/queue
       -> GET /api/admin/reputation
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Types | `server/moderation/moderationTypes.ts` | Trust models, enums, queue filters |
| Store | `server/moderation/moderationStore.ts` | In-memory persistence for queues, reports, verifications |
| Queue | `server/moderation/moderationQueue.ts` | Reusable queue abstraction and filtering |
| Service | `server/moderation/moderationService.ts` | Core moderation lifecycle methods |
| Reputation | `server/moderation/reputationEngine.ts` | Trust and seller reputation calculations |
| Bulk | `server/moderation/bulkModeration.ts` | Bulk approve/reject/assign/archive |
| Hooks | `server/moderation/eventHooks.ts` | Audit + analytics integration |
| API | `server/moderation/moderationRouter.ts` | Admin moderation endpoints |

## Queue Flow

1. **Enqueue** — `queueItem()` creates a `ModerationItem` in a named queue (`products`, `brands`, `sellers`, `reviews`, `reports`, `media`).
2. **Assign** — `assignModerator()` moves item to `assigned` status.
3. **Decide** — `approve()`, `reject()`, or `requestChanges()` updates status and writes audit + analytics events.
4. **Resolve reports** — `resolveReport()` closes `ReportItem` records with `resolved` or `dismissed`.
5. **Bulk** — `bulkApprove()`, `bulkReject()`, `bulkAssign()`, `bulkArchive()` for batch operations.

### Queue Filters

- `pending`
- `approved`
- `rejected`
- `needs_review`
- `assigned`
- `archived`

## Trust Score

`calculateTrustScore(entityType, entityId)` computes a 0–100 score with grade `A`–`F` from:

| Component | Weight | Source |
|-----------|--------|--------|
| Complaint Score | 40% | Computed from open reports |
| Approval Rate | 35% | Computed from moderation history |
| Policy Compliance | 25% | Computed from rejection history |

## Reputation Formula

`calculateSellerReputation(sellerId)` computes seller reputation from:

| Component | Weight | Source |
|-----------|--------|--------|
| Review Rating | 25% | Computed from `operationsStore` reviews |
| Complaint Score | 20% | Computed from moderation reports |
| Approval Rate | 15% | Computed from moderation decisions |
| Response Time | 10% | **Placeholder** — awaiting messaging SLA telemetry |
| Order Success | 15% | **Placeholder** — awaiting order fulfillment telemetry |
| Account Age | 10% | Computed when creation date available |
| Verification Status | 5% | Computed from seller verification record |

No fake values are injected. Placeholder components are explicitly marked with `source: 'placeholder'` and TODO comments in code.

## Moderation Lifecycle

```
Report Created -> queueItem (optional) -> assignModerator
  -> approve | reject | requestChanges
  -> auditCatalogModeration + analytics event
  -> reputation recalculated on demand
```

### Seller Verification States

- `pending`
- `verified`
- `rejected`
- `suspended`
- `expired`

Verification history is stored per seller in `SellerVerification.history`.

### Report Categories

- `spam`
- `fake_product`
- `counterfeit`
- `abuse`
- `copyright`
- `incorrect_information`
- `fraud`
- `other`

### Report Statuses

- `open`
- `investigating`
- `resolved`
- `dismissed`

## Audit Integration (ES-006)

Moderation actions call `auditCatalogModeration()` with:

- `requestId`
- `moderatorId` (from auth context)
- `timestamp` (via Logger.audit)
- `resource` / `resourceId`
- `decision`
- `reason`

Unrelated actions are not auto-logged.

## Analytics Integration (ES-008)

Representative events recorded via `eventHooks.ts`:

- `SELLER_VERIFIED`
- `SELLER_REJECTED`
- `PRODUCT_APPROVED`
- `PRODUCT_REJECTED`
- `REPORT_RESOLVED`
- `REPORT_CREATED`

## Admin API

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/admin/moderation/summary` | Moderator+ | Queue, report, verification, fraud counts |
| `GET /api/admin/moderation/queue` | Moderator+ | Filterable moderation queue items |
| `GET /api/admin/reputation` | Moderator+ | Seller reputation or generic trust score |

Query parameters for `/api/admin/reputation`:

- `sellerId` or `entityId` (required)
- `entityType` (default: `seller`)
- `entityLabel`, `accountCreatedAt` (optional)

## Future AI Moderation

The platform is designed for future AI workflows:

1. **Signal ingestion** — `moderationStore.addFraudSignal()` accepts structured fraud signals.
2. **Queue prioritization** — `ModerationItem.priority` supports AI-ranked ordering.
3. **Decision assistance** — Service methods return structured decisions without UI coupling.
4. **Training data** — Audit logs + analytics events provide labeled moderation outcomes.
5. **Content analysis** — No message or review body content is analyzed in ES-009; future AI modules can attach scores via `metadata`.

Recommended next steps:

- Wire `TrustContext` and `ReviewModeration` frontend contexts to these APIs.
- Persist moderation store to Firestore (new collection, not modifying existing production collections).
- Add AI confidence scores to `FraudSignal` and `ModerationItem.metadata`.
- Connect ES-008 analytics to seller reputation placeholders.

---

## Migration Report

### Current Moderation

| Area | Current State |
|------|---------------|
| Review CRUD | Server API at `/api/v1/operations/reviews` |
| Trust / reputation UI | `TrustContext.tsx`, `TrustCenter.tsx` — localStorage simulation |
| Review moderation UI | `ReviewModeration.tsx` — local state + operations API sync |
| Moderation hub | `Moderation.tsx` — monolithic UI with mock audit logs |
| Moderation V2 | `ModerationV2.tsx` — not routed (redirects to v1) |
| Brand verification | `BrandVerification.tsx` — frontend-only workflow |
| Server moderation | **New in ES-009** — `server/moderation/` |

### Future Moderation

| Capability | ES-009 Foundation |
|------------|-------------------|
| Unified queue | `moderationQueue` + `moderationStore` |
| Seller verification | `SellerVerification` with history |
| Report management | `ReportItem` with categories and statuses |
| Trust scoring | `calculateTrustScore()` |
| Seller reputation | `calculateSellerReputation()` |
| Bulk operations | `bulkModeration.ts` |
| Audit trail | ES-006 `auditCatalogModeration` hooks |
| Analytics | ES-008 trust event types |

### Existing Manual Workflows

1. **Reviews** — Admins use `Reviews.tsx`; approve/reject updates local state and calls `operationsApi.updateReview`.
2. **Trust events** — `ReviewModeration` dispatches `addTrustEvent()` to `TrustContext` localStorage ledger.
3. **Moderation hub** — `Moderation.tsx` tabs manage verification, disputes, reputation locally.
4. **Brand verification** — Manual document review in `BrandVerification.tsx`.

### Recommended Migration Strategy

**Phase 1 — Read path (low risk)**

- Point admin dashboards at `GET /api/admin/moderation/summary` and `GET /api/admin/reputation`.
- Keep existing UI; add API client methods alongside localStorage.

**Phase 2 — Write path (moderate risk)**

- Route `approveReview` / `rejectReview` through `moderationService.approve()` / `reject()` for audit + analytics.
- Sync `operationsStore` review status updates with moderation queue items.

**Phase 3 — Full migration**

- Replace `TrustContext` localStorage with server-backed verification and report stores.
- Enable `ModerationV2` or merge into `Moderation.tsx` using new APIs.
- Add Firestore persistence for moderation collections (new collections only).

**Phase 4 — AI augmentation**

- Ingest fraud signals from order, review, and catalog anomaly detectors.
- Add AI-suggested decisions to queue metadata without auto-executing.

### Backward Compatibility

- No existing routes modified.
- No Firestore collection changes.
- No authentication or authorization framework changes.
- No frontend navigation or admin page rewrites.
- Existing review API remains unchanged.
