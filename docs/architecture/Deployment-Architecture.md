# Deployment Architecture

## Purpose
Describes how the two Choosify applications are deployed and how requests
are routed between them on the production Hostinger VPS.

## Version
0.1.0

## Status
Active

## Last Updated
2026-08-23

## Author
Ops

## Table of Contents
1. [Overview](#overview)
2. [Request routing](#request-routing)
3. [Why same-origin proxying, not a cross-origin API base](#why-same-origin-proxying-not-a-cross-origin-api-base)

---

## Overview

Two independently deployed Node/Express apps run behind Nginx on a single
VPS, each managed by its own PM2 process:

- **Web** (`choosify-web`, port 3000) — the customer-facing storefront
  (`choosify.bd`, `www.choosify.bd`). Serves the built SPA plus a small
  amount of server-side rendering (OG images, crawler share pages). It
  has no direct database access and holds no application secrets.
- **Admin** (`choosify-admin`, port 3001) — the shared backend/API
  (`dashboard.choosify.bd`), and also the seller/creator/staff dashboard
  UI. Owns PostgreSQL access and mounts the full `/api/v1` surface
  (catalog, auth, operations, messaging, payments, escrow, ads, etc. —
  see `server/app.ts`).

## Request routing

All of Web's frontend code calls a **relative** `/api/v1/...` path (see
`web/src/services/*.ts`, `web/src/lib/authApi.ts`) — there is no separate
API implementation in Web itself. In production, Nginx makes this work
with a scoped same-origin proxy:

```
choosify.bd/api/v1/*        ─┐
www.choosify.bd/api/v1/*     ├─► Nginx location /api/v1 ─► 127.0.0.1:3001 (Admin)
dashboard.choosify.bd/api/v1/* (native, unchanged) ─────────► 127.0.0.1:3001 (Admin)
```

Configured in `/etc/nginx/sites-available/choosify`: the Web HTTPS server
block (`choosify.bd www.choosify.bd`) has a `location /api/v1 { ... }`
block placed before its catch-all `location /`, proxying to the same
Admin backend the dashboard block already uses — same proxy headers
(`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`), and its own
`client_max_body_size 12m;` scoped to that location only, matching the
dashboard block's limit so upload-sized requests aren't bottlenecked by
the Web host's otherwise-default ~1MB ceiling.

Everything else on the Web host (the SPA, its static assets, OG images,
crawler share pages) is untouched by this — the proxy only intercepts
paths under `/api/v1`.

## Why same-origin proxying, not a cross-origin API base

The alternative would have been pointing Web's build at an absolute API
base (`VITE_API_BASE_URL=https://dashboard.choosify.bd`) and relying on
CORS. Two things ruled that out:

1. **Auth cookie scoping.** Admin's refresh cookie
   (`server/auth/jwtTokens.ts`) is set with no explicit `Domain`
   attribute, so it's host-scoped to whichever origin actually issued it.
   Under same-origin proxying, the browser sees the response as coming
   from `choosify.bd` itself, so the cookie is scoped correctly with zero
   code changes. A cross-origin base would need the cookie's domain
   handling reworked — a change to security-sensitive auth code, not a
   routing change.
2. **Zero code changes either side.** Every Web API client already
   assumes a relative same-origin path as its default. Same-origin
   proxying makes that assumption true instead of requiring every client
   (and a rebuild) to be pointed somewhere else.

CORS is not a factor for this proxied traffic — from the browser's
perspective these are same-origin requests. Client IP resolution and
Express's `trust proxy: "loopback"` setting are unaffected, since Nginx
remains the loopback peer regardless of which server block relayed the
request. Authentication middleware is unchanged — a request without a
token is rejected by the same Express-side check either way.
