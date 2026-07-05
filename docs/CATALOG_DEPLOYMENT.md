# Catalog deployment alignment (Phase 1)

This document explains how CMS changes reach the public Choosify storefront.

## Architecture

| Component | Port / URL | Role |
|-----------|------------|------|
| **Choosify-Web** | `http://localhost:3000` | Public storefront |
| **choosify-admin-4.0** | `http://localhost:3001` | Admin CMS + catalog API at `/api/v1` |
| **Production API** | `https://dashboard.choosify.bd/api/v1` | Live catalog (proxied from choosify.bd via `vercel.json`) |

## Local development

1. Start the admin server (catalog API + CMS):

   ```bash
   cd choosify-admin-4.0
   npm run dev
   ```

2. Point the storefront at the admin API:

   ```bash
   cd Choosify-Web
   # .env.local
   VITE_API_BASE_URL=http://localhost:3001/api/v1
   npm run dev
   ```

3. Open CMS at `http://localhost:3001/admin/cms-studio` (legacy `/admin/cms` redirects here).

## Persistence modes

| Variable | Values | Effect |
|----------|--------|--------|
| `CATALOG_USE_FIRESTORE` | `false` (default) | In-memory catalog; resets when the admin server restarts |
| `CATALOG_USE_FIRESTORE` | `true` | Writes to Firestore via Firebase Admin |

When using Firestore, set:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — service account JSON string
- `FIRESTORE_DATABASE_ID` — optional database id (defaults in code)

## Phase 1 — wired to catalog API

- **Category Taxonomy** (`/admin/categories`) — create/update/delete/import syncs to `/catalog/categories`
- **Products bulk actions** — approve/archive/delete call `/catalog/products/:id`
- **What's On / Brand Posts** (`/admin/brand-posts`) — CRUD at `/catalog/brand-posts`; storefront hydrates on load
- **Website CMS Studio** — primary CMS; legacy CMS route redirects to `/admin/cms-studio`

## Production checklist

1. Deploy `choosify-admin-4.0` with `CATALOG_USE_FIRESTORE=true` and Firebase credentials.
2. Ensure `dashboard.choosify.bd/api/v1` serves the same catalog router.
3. Keep `Choosify-Web` `VITE_API_BASE_URL=/api/v1` so Vercel proxies to dashboard.
4. After CMS edits, storefront refreshes catalog every 60s (and on window focus).

## Phase 2 — Operations API (`/api/v1/operations/*`)

| Endpoint | Purpose |
|----------|---------|
| `POST /operations/orders` | Persist storefront checkout orders |
| `GET /operations/orders` | Admin **Platform Orders** view |
| `POST /operations/coupons/validate` | Checkout promo validation |
| `GET/POST/PATCH /operations/coupons` | Admin coupon sync |
| `POST /operations/reviews` | Storefront review submission |
| `GET/PATCH /operations/reviews` | Admin review moderation pipeline |
| `POST /operations/leads` | Advertise page lead capture |
| `GET/PATCH /operations/leads` | Admin **Lead Inbox** |
| `GET/PUT /operations/permissions` | RBAC matrix (enforced in sidebar + routes) |

Admin pages: `/admin/platform-orders`, `/admin/leads`

Local dev: point Choosify-Web `VITE_API_BASE_URL=http://localhost:3001/api/v1` so checkout, reviews, and leads hit the admin operations API.

## Phase 3 — Growth & support (`/api/v1/operations/*` + messaging)

| Feature | Endpoint / path | Notes |
|---------|-----------------|-------|
| Live analytics | `GET /operations/analytics?range=7d\|30d\|90d` | Aggregates orders, leads, reviews, shipments, coupons |
| Role dashboards | `GET /operations/analytics/role/:role` | Powers `/admin/dashboard` for admin, moderator, finance, support, marketing |
| Shipments from orders | Auto on `POST /operations/orders` | Creates shipment + shows in **Shipment Console** via `GET /operations/shipments` |
| Platform messaging bridge | `POST /operations/platform-messages` | Storefront `/messages` syncs to admin **Messages** (platform tab) |
| Meta omnichannel | `GET/POST /api/webhooks/meta`, `/api/messaging/*` | Set `MESSAGING_MODE=live` + Meta credentials for WhatsApp/Messenger/Instagram |

Env vars for live Meta messaging:
- `MESSAGING_MODE=live`
- `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `WEBHOOK_PUBLIC_URL`

## Tier 1–3 production checklist

### Tier 1 — Production blockers
| Item | Env / endpoint |
|------|----------------|
| Catalog persistence | `CATALOG_USE_FIRESTORE=true` + `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Operations persistence | `OPERATIONS_USE_FIRESTORE=true` (same Firebase credentials) |
| Firebase Auth login | `VITE_AUTH_MODE=live` + Firebase users in `admin_users` Firestore collection |
| Published reviews on PDP | `GET /operations/reviews/public?productId=` |
| Unified CMS orders | `OrdersContext` hydrates from `GET /operations/orders` |
| Deploy admin API | Push latest `choosify-admin-4.0` to `dashboard.choosify.bd` |

### Tier 2 — Business operations
| Item | Admin path / API |
|------|------------------|
| Post Offer queue | `/admin/seller-offers` · `POST /operations/seller-offers` |
| Order tracking | `GET /operations/shipments/track/:orderId` |
| Brand publish → catalog | Brand Edit Studio publish → `PATCH /catalog/brands/:id` |
| Lead forms | Advertise, Suggest Brand, Partnership → `POST /operations/leads` |

### Tier 3 — Polish
| Item | Notes |
|------|-------|
| Feature flags | `GET/PUT /operations/feature-flags` · storefront reads on load |
| Finance tie-in | Payouts + Analytics show live storefront revenue |
| CMS rollback | Website CMS Studio rollback still requires version backend (future) |
