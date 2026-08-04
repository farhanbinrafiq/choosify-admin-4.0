# Choosify Backend Inventory

This document is a factual inventory of the Express backend inside `choosify-admin-4.0` as it exists today. It records what currently exists — no recommendations, no proposed changes.

## Table of Contents

1. [Backend Overview](#1-backend-overview)
2. [Route Inventory](#2-route-inventory)
3. [Database Inventory](#3-database-inventory)
4. [Services](#4-services)
5. [Middleware](#5-middleware)
6. [External Integrations](#6-external-integrations)
7. [Feature Inventory](#7-feature-inventory)
8. [Current Technical Debt](#8-current-technical-debt)

---

## 1. Backend Overview

The backend is an Express.js application defined in `server/app.ts`, created via a `createApp()` factory function.

- Entry points: `server.ts` (local/dev, mounts Vite middleware for the admin SPA in the same process) and `api/index.ts` (Vercel serverless function, re-exports the same `createApp()` app).
- All routers are mounted in `server/app.ts` under either `/api` or `/api/v1`.
- Middleware order in `server/app.ts`: request ID → request timing → Helmet → compression → health/diagnostics routers → Meta webhook raw-body handler → JSON/urlencoded body parsers → payload-too-large handler → CORS → per-path rate limiters → feature routers → legacy inline routes → error handler.
- Fifteen routers are mounted, plus two standalone route modules (`health`, `diagnostics`) and three legacy inline routes defined directly in `app.ts`.

---

## 2. Route Inventory

| Router | File | Purpose | Approx. Endpoints | Dependencies |
|---|---|---|---|---|
| Auth | `server/authRouter.ts` | Login, registration, token refresh, logout, session profile, dev-login | 7 | `server/auth/jwtTokens.ts`, `server/auth/authProfile.ts`, `server/db/client.ts`, `server/db/schema.ts` (Drizzle/Postgres), `server/validation/auth/*` |
| Catalog | `server/catalogRouter.ts` | Products, categories, brands, deals, deals-banners, site config, creators, guides, placements, media upload, product-details, brand-posts, home snapshot | 55 | `server/catalogStore.ts`, `server/catalogFirestoreAdmin.ts`, `server/catalogMemoryStore.ts`, `server/catalogDefaults.ts`, `server/catalogContract.ts`, Cloudinary, `lib/vercel-catalog/*` |
| Operations | `server/operationsRouter.ts` | Orders, returns, coupons, fee-charges, payment-options, reviews, leads, jobs, job-applications, permissions, analytics, seller-dashboard, shipments, platform-messages, conversation-expiry, feature-flags, users, seller-offers, verifications | 72 | `server/operations/operationsDb.ts`, `operationsStore.ts`, `operationsPersistence.ts`, `sellerIntelligenceService.ts`, `couponValidator.ts`, `shipmentStore.ts`, `platformMessagingBridge.ts` |
| Payments | `server/payments/paymentsRouter.ts` | SSLCommerz status, init, IPN, success, fail, cancel | 6 | `server/payments/paymentService.ts`, `sslcommerzProvider.ts`, `mockProvider.ts` |
| Booking | `server/booking/bookingRouter.ts` | Field config, seller settings, booking requests (accept/decline/counter/buyer-accept/buyer-decline/mark-paid), expiry | 14 | `server/booking/bookingService.ts`, `bookingStore.ts`, `shared/booking/*` |
| Analytics | `server/analytics/analyticsRouter.ts` | Event ingestion (single/batch), wishlist/compare hooks, summary, trending, event types, storage, admin analytics | 9 | `server/analytics/analyticsService.ts`, `analyticsStorage.ts`, `aggregationUtils.ts`, `eventHooks.ts` |
| Moderation | `server/moderation/moderationRouter.ts` | Admin moderation summary, moderation queue, reputation | 3 | `server/moderation/moderationService.ts`, `moderationStore.ts`, `moderationQueue.ts`, `reputationEngine.ts`, `bulkModeration.ts` |
| Search | `server/search/searchRouter.ts` | Search, autocomplete, trending, discovery, recommend, click/autocomplete/suggestion analytics | 8 | `server/search/searchEngine.ts`, `discoveryEngine.ts`, `rankingEngine.ts`, `rankingWeights.ts`, `searchAnalytics.ts`, `searchFilters.ts` |
| Communication | `server/communication/communicationRouter.ts` | Notifications CRUD, notification preferences, admin notifications, admin broadcasts (+send), admin communication | 18 | `server/communication/communicationService.ts`, `notificationService.ts`, `broadcastService.ts`, `preferenceService.ts`, `deliveryChannels.ts` |
| Messaging | `server/messagingHub.ts` | Messaging status, Meta webhook (verify + receive), conversations, messages, conversation status/assign-agent, agents | 10 | `server/messaging/adapters/*`, `omniStore.ts`, `omniStaff.ts`, `webhookJobs.ts`, `webhookVerify.ts`, `normalizeWebhook.ts`, Firestore |
| Logistics | `server/logisticsRouter.ts` | Courier webhook receiver, simulate-webhook | 2 | `src/services/logistics/*` courier adapters |
| AI | `server/ai/aiRouter.ts` | AI status, chat, recommend, summarize, compare, explain (all behind `requireAuth`) | 6 | `server/ai/aiService.ts`, `providers/{claude,gemini,openai,local}Provider.ts`, `providerFactory.ts`, `promptRegistry.ts`, `safety/*`, `skills/*` |
| EMI | `server/emi/emiRouter.ts` | EMI shopping-assistant chat | 1 | Gemini provider (`@google/genai`) |
| Health | `server/routes/health.ts` | Liveness check | 1 | none |
| Diagnostics | `server/routes/diagnostics.ts` | Startup/runtime diagnostics | 1 | `server/lib/startupDiagnostics.ts`, `runtimeInfo.ts` |
| Legacy inline routes | `server/app.ts` (lines ~100–160) | `GET /api/admin/stats` (hardcoded response values); deprecated `POST/PUT/PATCH /api/products[/:id]` shims that log and return canned responses | 4 | none — self-contained in `app.ts` |

Total measured endpoint definitions across all routers: **213** (counted directly from route-registration calls in each router file).

---

## 3. Database Inventory

**Primary relational database:** PostgreSQL, accessed via Drizzle ORM.

Schema file: `server/db/schema.ts`. Client: `server/db/client.ts`. Migrations directory: `server/db/migrations/` (one migration: `0000_sloppy_red_ghost.sql`, plus a `meta/` folder of Drizzle snapshots).

| Table | Columns | Relationships |
|---|---|---|
| `users` | `id` (uuid, PK), `email` (unique), `password_hash`, `display_name`, `role` (enum `user_role`), `email_verified`, `created_at`, `updated_at` | Referenced by `seller_profiles.user_id` and `refresh_tokens.user_id` |
| `seller_profiles` | `user_id` (uuid, PK, FK → `users.id`, cascade delete), `store_name`, `phone`, `category`, `city`, `website`, `created_at` | 1:1 with `users` |
| `refresh_tokens` | `id` (uuid, PK), `user_id` (FK → `users.id`, cascade delete), `token_hash`, `expires_at`, `revoked_at`, `created_at` | Many-to-1 with `users` |

`user_role` enum values: `user`, `seller`, `verified_seller`, `moderator`, `admin`, `super_admin`, `creator`, `finance_manager`, `support_agent`, `marketing_manager`.

**Secondary data store:** Firestore (via `firebase-admin`), used for operations/catalog/messaging data outside of the three Postgres tables above. No Drizzle schema or SQL migration governs this data; it is read/written directly through the Firestore Admin SDK in `server/firestoreAdmin.ts`, `server/catalogFirestoreAdmin.ts`, `server/operations/operationsDb.ts`, and `server/messaging/{omniStaff,omniStore,webhookJobs}.ts`.

**In-memory fallback store:** `server/catalogMemoryStore.ts` and an in-process operations snapshot are used when Firestore Admin credentials are not configured (`hasFirebaseAdminCredentials()` returns false), or when `CATALOG_USE_FIRESTORE`/`OPERATIONS_USE_FIRESTORE` env flags are unset.

**Parallel/duplicate catalog data layer:** `lib/vercel-catalog/` contains its own `catalogStore.ts`, `catalogFirestoreAdmin.ts`, `catalogMemoryStore.ts`, `catalogTypes.ts`, `draftStore.ts` — a second implementation of the same catalog persistence concern that exists alongside `server/catalog*.ts`.

---

## 4. Services

| Folder/Module | Purpose |
|---|---|
| `server/ai/` | AI assistant service: `aiService.ts` orchestration, `providers/` (Claude, Gemini, OpenAI, local), `providerFactory.ts`, `promptRegistry.ts`, `context/`, `conversation/`, `safety/`, `skills/` |
| `server/analytics/` | Event ingestion, aggregation, storage, and time-range utilities for analytics data |
| `server/booking/` | Service-booking domain: request lifecycle (accept/decline/counter/mark-paid), field config, seller settings |
| `server/communication/` | Notification and broadcast service: delivery channel abstraction, preferences, notification/broadcast services |
| `server/emi/` | Single-purpose EMI chat assistant router (no separate service file; logic lives in the router) |
| `server/logistics*` | Courier webhook handling (`server/logisticsRouter.ts`); courier-specific adapters live in `src/services/logistics/` on the frontend side |
| `server/messaging/` | Omnichannel messaging: channel adapters, Meta webhook normalization/verification, Firestore-backed job queue (`webhookJobs.ts`), staff allowlist (`omniStaff.ts`) |
| `server/moderation/` | Moderation queue, bulk moderation actions, reputation scoring engine |
| `server/operations/` | Orders/returns/coupons/shipments/seller-intelligence/platform-messaging-bridge — the largest single service domain, backing `operationsRouter.ts` |
| `server/payments/` | Payment provider abstraction: `paymentService.ts`, `sslcommerzProvider.ts` (live), `mockProvider.ts` (test/dev) |
| `server/search/` | Search/discovery/ranking engines and search analytics |
| `lib/vercel-catalog/` | Parallel catalog service layer (see §3) — types, store, Firestore admin, draft store, editorial content defaults, media upload helpers |
| `src/services/` (frontend-side, called by admin SPA) | `catalogApi.ts`, `operationsApi.ts`, `sellerDashboardApi.ts`, `mediaUpload.ts`, `prdServices.ts`, and a `logistics/` subfolder of courier adapters |
| `shared/` | Cross-cutting types/utilities used by more than one server module: `booking/`, `messaging/` (conversation expiry) |

---

## 5. Middleware

All defined under `server/middleware/`:

| File | Purpose |
|---|---|
| `auth.ts` | `authenticateRequest` — verifies the JWT access token and attaches the authenticated user to the request; backs `requireAuth` |
| `authorization.ts` | Role/permission-based authorization checks, used alongside `server/permissions/` |
| `requireAdmin.ts` | Restricts a route to `admin`/`super_admin` roles |
| `requireModerator.ts` | Restricts a route to moderator-level roles |
| `requireSeller.ts` | Restricts a route to seller-role users |
| `requireVerifiedSeller.ts` | Restricts a route to the `verified_seller` role specifically |
| `requireSuperAdmin.ts` | Restricts a route to `super_admin` only |
| `validate.ts` | Zod-schema request validation middleware, used with per-domain schemas under `server/validation/{auth,catalog,common,messaging,operations,seller,shared}/` |
| `rateLimit.ts` | `express-rate-limit`-based policies: health, auth, public, catalogRead, search, messaging, admin, AI — each with its own env-overridable max and shared window |
| `cors.ts` | CORS middleware — explicit `ALLOWED_ORIGINS` allow-list, `credentials: true` |
| `payloadLimits.ts` | JSON/urlencoded/raw body size limits and the base64 upload size cap |
| `errorHandler.ts` | Centralized Express error handler, mounted last |
| `requestId.ts` | Assigns a request ID for tracing |
| `requestTiming.ts` | Records request duration |
| `gracefulShutdown.ts` | Coordinates in-flight request draining on process shutdown |

Additional cross-cutting authorization logic lives in `server/permissions/` (`authorization.ts`, `permissions.ts`, `roles.ts`), separate from the `server/middleware/require*.ts` role gates.

Supporting infrastructure in `server/lib/`: `abuseProtection.ts` (in-memory failed-auth/suspicious-request counters), `helmetConfig.ts` (security headers), `env.ts` (`validateEnvironment()` startup check), `uploadValidation.ts`, `sanitizeLog.ts`, `logger.ts`, `metrics.ts`, `readiness.ts`, `startupDiagnostics.ts`, `runtimeInfo.ts`, `apiErrorCodes.ts`, `apiResponse.ts`.

---

## 6. External Integrations

| Integration | Where used | Notes as found in code |
|---|---|---|
| **Cloudinary** | `server/catalogRouter.ts`, `server/operationsRouter.ts`, `src/services/mediaUpload.ts`, `src/pages/admin/creatorSeeds.ts` | Media/image upload target |
| **Firebase (Admin SDK / Firestore)** | `server/firestoreAdmin.ts`, `server/catalogFirestoreAdmin.ts`, `server/lib/firestore/*`, `server/operations/operationsDb.ts`, `server/messaging/{omniStaff,webhookJobs}.ts`, `server/auth/{authErrors,authProfile}.ts`, `server/middleware/auth.ts`, `lib/vercel-catalog/firebaseAdmin.ts` | Secondary datastore and (per client-side code) legacy auth surface; gated by `hasFirebaseAdminCredentials()` and `CATALOG_USE_FIRESTORE`/`OPERATIONS_USE_FIRESTORE` flags |
| **SSLCommerz** | `server/payments/sslcommerzProvider.ts`, `paymentService.ts`, `paymentsRouter.ts` | Live payment gateway provider; `mockProvider.ts` exists alongside it for non-production use |
| **Email** | `server/communication/deliveryChannels.ts` | No email provider package (no nodemailer/SendGrid/SES/Resend in `package.json`); the `EMAIL` delivery channel is wired to a `FrameworkChannelProvider` whose `isConfigured()` returns `false` and whose `dispatch()` returns `status: 'unsupported', message: "Provider for email is not configured. Framework only."` |
| **SMS / Push / WhatsApp / Webhook (notification channels)** | `server/communication/deliveryChannels.ts` | Same `FrameworkChannelProvider` pattern as email — framework/interface exists, no configured provider behind any of them. Only the `IN_APP` channel is functionally implemented |
| **AI providers** | `server/ai/providers/{claudeProvider,geminiProvider,openaiProvider,localProvider}.ts`, `providerFactory.ts` | Multi-provider abstraction covering Claude, Gemini (`@google/genai`), OpenAI, and a local provider; selected via `providerFactory.ts` |
| **Meta (WhatsApp/Messenger) webhooks** | `server/messagingHub.ts`, `server/messaging/{normalizeWebhook,webhookVerify,adapters}.ts` | Inbound webhook receiver with raw-body signature verification, wired directly in `server/app.ts` before the JSON body parser |
| **Courier/logistics webhooks** | `server/logisticsRouter.ts` | Generic `/webhooks/logistics/:courier` receiver plus a `/logistics/simulate-webhook` test endpoint; specific courier adapters live client-side in `src/services/logistics/` |

---

## 7. Feature Inventory

| Feature | Status | Basis |
|---|---|---|
| Authentication (server-side) | **Implemented** | JWT + Argon2 + Postgres-backed `authRouter.ts`, `jwtTokens.ts`, `authProfile.ts` are functionally complete end to end |
| Orders | **Implemented** | Full CRUD + claim/confirm/cancel flow in `operationsRouter.ts` / `operationsStore.ts` |
| Products / Catalog | **Implemented** | ~55 endpoints in `catalogRouter.ts` covering products, categories, brands, media |
| Brands | **Implemented** | Endpoints present in `catalogRouter.ts`; brand-posts endpoints also present |
| Search | **Implemented** | Dedicated `searchRouter.ts` with ranking/discovery engines |
| Notifications | **Partial** | CRUD and preferences implemented; only the `IN_APP` delivery channel is functionally configured — email/SMS/push/WhatsApp/webhook channels are framework stubs (see §6) |
| Messaging | **Implemented** | Conversations/messages/agent-assignment endpoints, Meta webhook ingestion with retrying job queue (`webhookJobs.ts`) |
| Reviews | **Implemented** | Public + authenticated review endpoints in `operationsRouter.ts` |
| Recommendations | **Partial** | `/ai/recommend` and `/search/recommend/:productId` endpoints exist; underlying ranking/recommendation logic is present but not independently verified against production data in this inventory |
| CMS | **Implemented** | Catalog "site", "placements", "home/snapshot" endpoints plus the separate `src/cms-mirror/` preview tree |
| Analytics | **Partial** | Event ingestion, summary, and trending endpoints implemented; `server/moderation/reputationEngine.ts` and `server/operations/sellerIntelligenceService.ts` contain `TODO` markers indicating specific metrics (response-time, order-success, product-view, wishlist, compare, unread-message, support-ticket, profile-completeness telemetry) are placeholder/estimated rather than sourced from real telemetry |
| Booking | **Implemented** | Full request lifecycle (`bookingRouter.ts`, `bookingService.ts`) including a scheduled expiry job (referenced by `vercel.json` cron) |
| AI | **Implemented** | Multi-provider chat/recommend/summarize/compare/explain endpoints behind `requireAuth` |
| Payments | **Implemented** | SSLCommerz provider wired for init/status/IPN/success/fail/cancel; a mock provider exists alongside it |
| Verification (seller/KYC) | **Implemented** | `/operations/verifications` submit + review endpoints present in `operationsRouter.ts` |
| Moderation | **Implemented** | Queue, summary, and reputation endpoints in `moderationRouter.ts`, with bulk-action support in `bulkModeration.ts` |
| Legacy `/api/products` routes | **Placeholder** | Deprecated shim endpoints in `app.ts` that log the call and return a canned success response redirecting callers to `/api/v1/catalog/products` |
| `/api/admin/stats` | **Placeholder** | Returns hardcoded response values (e.g. a fixed `totalUsers` figure) rather than a live query |

---

## 8. Current Technical Debt

- Two parallel catalog implementations exist side by side: `server/catalog*.ts` and `lib/vercel-catalog/*.ts`, with overlapping type definitions, stores, and Firestore-admin wrappers.
- Three coexisting persistence layers (Postgres via Drizzle, Firestore via Admin SDK, and an in-memory fallback store) with no formal relationship between Postgres user records and Firestore-held operational data — they are joined only by matching string IDs in application code.
- `server/auth/authProfile.ts` contains a function still named `verifyFirebaseToken` whose implementation is pure JWT verification (`verifyAccessToken`); `server/auth/authErrors.ts` similarly contains `isExpiredFirebaseTokenError`, which no longer relates to Firebase.
- Notification delivery channels for email, SMS, push, and WhatsApp are defined in the type system and routing layer but have no configured provider behind them (`FrameworkChannelProvider`, `isConfigured() => false`).
- `TODO` markers present in `server/moderation/reputationEngine.ts` (2) and `server/operations/sellerIntelligenceService.ts` (6), each marking a specific metric currently backed by placeholder/estimated data rather than real telemetry.
- Legacy inline routes remain mounted in `server/app.ts`: deprecated `/api/products` shim endpoints and a hardcoded `/api/admin/stats` response.
- Root-level files `lint-errors.txt` and `lint-errors2.txt` contain a captured `tsc --noEmit` run (133 combined errors) checked into the repository.
- `CATALOG_USE_FIRESTORE` and `OPERATIONS_USE_FIRESTORE` env flags mean the active persistence backend (Firestore vs. in-memory) depends on environment configuration rather than being fixed by the codebase itself.

---

**Backend Inventory Complete**
