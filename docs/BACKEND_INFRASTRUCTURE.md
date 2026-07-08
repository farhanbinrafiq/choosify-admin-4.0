# Backend Infrastructure (Sprint 1)

This document describes the production-hardening middleware added to the Express server in `server.ts`.

## Middleware order

1. `requestIdMiddleware` — assigns/propagates `X-Request-ID`
2. `helmet` — secure HTTP headers (CSP disabled to avoid breaking Vite/admin UI)
3. `compression` — gzip-compatible response compression
4. `healthRouter` — `GET /health`
5. Meta webhook raw body route — `/api/webhooks/meta`
6. `express.json()`
7. `createCorsMiddleware()` — environment-driven CORS
8. Existing API routers and legacy routes
9. Vite dev middleware or production static SPA fallback
10. `errorHandler` — centralized JSON error responses

## Logger

Path: `server/lib/logger.ts`

Structured JSON logs with levels:

- `INFO`
- `WARN`
- `ERROR`
- `DEBUG` (suppressed in production)

Used for server bootstrap, graceful shutdown, centralized errors, and deprecated endpoint logging.

## API response helpers

Path: `server/lib/apiResponse.ts`

Reusable helpers:

- `success()`
- `created()`
- `error()`
- `notFound()`
- `validationError()`

These are used by the health endpoint and are available for incremental adoption in routes without rewriting existing handlers.

## Health endpoint

`GET /health`

Example response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-08T19:40:00.000Z",
    "uptime": 42,
    "environment": "development",
    "version": "0.0.0",
    "startedAt": "2026-07-08T19:39:18.000Z",
    "app": "Choosify Admin"
  },
  "requestId": "..."
}
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `APP_NAME` | Application name in logs and health output |
| `APP_VERSION` | Application version in logs and health output |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist for API and Socket.IO |
| `PORT` | Server port (default `3001`) |

### CORS defaults

If `ALLOWED_ORIGINS` is not set, local development origins are allowed:

- `http://localhost:3000`
- `http://localhost:3001`

Production domains must be provided via `ALLOWED_ORIGINS`. They are not hardcoded in source.

## Graceful shutdown

`setupGracefulShutdown()` handles:

- `SIGINT`
- `SIGTERM`

The HTTP server stops accepting new connections and exits after active requests complete, with a 10-second timeout failsafe.

## Request IDs

Every request receives a request ID:

- Stored on `req.requestId`
- Returned in the `X-Request-ID` response header
- Included in structured error responses when available

Clients may pass an existing `X-Request-ID` header to preserve trace continuity.
