# Security Hardening — ES-005 Sprint 5

Production security layers added to the Choosify Admin backend (`choosify-admin-4.0`). All protections are environment-driven, modular, and backward compatible.

## Security Layers

| Layer | Module | Purpose |
|-------|--------|---------|
| Environment validation | `server/lib/env.ts` | Fail fast on missing production-critical env vars |
| Request ID | `server/middleware/requestId.ts` | Correlation for logs and error responses |
| Request timing | `server/middleware/requestTiming.ts` | Duration metrics in server logs (not exposed to clients) |
| Helmet headers | `server/lib/helmetConfig.ts` | HTTP security headers (CSP disabled for SPA compatibility) |
| Rate limiting | `server/middleware/rateLimit.ts` | Per-policy request throttling |
| Payload limits | `server/middleware/payloadLimits.ts` | JSON, URL-encoded, and raw body size caps |
| Log sanitization | `server/lib/sanitizeLog.ts` | Redact tokens, secrets, passwords, large payloads |
| Abuse protection | `server/lib/abuseProtection.ts` | In-memory failed-auth and suspicious-request tracking |
| Upload validation | `server/lib/uploadValidation.ts` | MIME, extension, and size checks for image uploads |
| Centralized errors | `server/middleware/errorHandler.ts` | Standardized 413/5xx responses |

## Rate Limiting

Configured via `express-rate-limit`. Window defaults to 15 minutes (`RATE_LIMIT_WINDOW_MS`).

| Policy | Env var | Default max | Applied to |
|--------|---------|-------------|------------|
| Health | `RATE_LIMIT_HEALTH_MAX` | 120 | `GET /health` |
| Auth | `RATE_LIMIT_AUTH_MAX` | 20 | `/api/v1/auth/*` |
| Messaging | `RATE_LIMIT_MESSAGING_MAX` | 100 | `/api/messaging`, `/api/conversations`, `/api/messages`, `/api/agents` |
| Catalog read | `RATE_LIMIT_CATALOG_READ_MAX` | 600 | `GET /api/v1/catalog/*` |
| Search | `RATE_LIMIT_SEARCH_MAX` | 120 | `GET /api/v1/catalog/products?q=...` |
| Admin | `RATE_LIMIT_ADMIN_MAX` | 200 | `/api/admin/*` |
| Public API | `RATE_LIMIT_PUBLIC_MAX` | 300 | All remaining `/api/*` routes |

Exceeded limits return:

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Rate-limit events also feed `recordSuspiciousRequest()` for abuse monitoring.

## Security Headers (Helmet)

Active headers (see `ACTIVE_SECURITY_HEADERS` in `server/lib/helmetConfig.ts`):

- **Cross-Origin-Opener-Policy**: `same-origin-allow-popups`
- **Cross-Origin-Resource-Policy**: `cross-origin`
- **Referrer-Policy**: `no-referrer`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `SAMEORIGIN`
- **X-Powered-By**: hidden
- **Strict-Transport-Security**: enabled by Helmet in production over HTTPS
- **Content-Security-Policy**: intentionally **disabled** (would break Vite SPA / third-party assets)
- **Cross-Origin-Embedder-Policy**: intentionally **disabled** (third-party embeds)

## Payload Protection

| Parser | Env var | Default | Notes |
|--------|---------|---------|-------|
| JSON | `JSON_BODY_LIMIT` | `1mb` | All standard API bodies |
| URL-encoded | `URLENCODED_BODY_LIMIT` | `1mb` | Form submissions |
| Raw (Meta webhook) | `RAW_BODY_LIMIT` | `256kb` | Signature verification path |

Oversized payloads return HTTP 413:

```json
{
  "success": false,
  "error": "Request payload too large",
  "code": "PAYLOAD_TOO_LARGE",
  "requestId": "<uuid>"
}
```

No multipart/form-data upload middleware is used; catalog uploads are JSON base64.

## Environment Validation

`validateEnvironment()` runs at startup (after `dotenv.config()`).

**Required in production:**

| Variable | Description |
|----------|-------------|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

**Warned in production:**

- `ALLOW_DEV_LOGIN=true` logs a startup warning.

Missing production-critical variables cause immediate process exit with a descriptive error (no secret values exposed).

## Sensitive Data Handling

`server/lib/logger.ts` passes all log metadata through `sanitizeLogMeta()`:

- Keys matching `authorization`, `password`, `token`, `secret`, `api_key`, `bearer`, `firebase`, etc. → `[REDACTED]`
- `payload`, `body`, `headers` objects → recursively sanitized
- Base64 `data` fields over 256 chars → `[REDACTED_BASE64 length=N]`
- Bearer token strings → `[REDACTED_BEARER_TOKEN]`

Deprecated `/api/products` endpoints log `payloadKeys` only (not full body).

Request timing (`durationMs`) is logged server-side only; not added to HTTP responses.

## Upload Security

### Audit findings

| Endpoint | Method | Input | Validation |
|----------|--------|-------|------------|
| `/api/v1/catalog/media/upload` | POST | JSON `{ data, mimeType?, fileName? }` | MIME whitelist, extension whitelist, size cap |

**Allowed MIME types:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`

**Allowed extensions:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

**Max size:** `UPLOAD_MAX_BYTES` (default 5 MB decoded)

No other file upload endpoints exist. Logistics and Meta webhooks accept JSON only.

### Future upload recommendations

- Add magic-byte (file signature) validation beyond MIME/extension trust
- Virus/malware scanning for production uploads
- Signed upload URLs (direct-to-Cloudinary) to reduce server payload size
- Per-user upload quotas when auth is enforced on upload route

## Abuse Protection

In-memory utilities in `server/lib/abuseProtection.ts` (no persistence):

| Utility | Trigger | Env vars |
|---------|---------|----------|
| `recordFailedAuthAttempt` | 401 from auth middleware / `/auth/me` | `ABUSE_FAILED_AUTH_WINDOW_MS`, `ABUSE_FAILED_AUTH_THRESHOLD` |
| `recordSuspiciousRequest` | Rate limit exceeded | `ABUSE_SUSPICIOUS_WINDOW_MS`, `ABUSE_SUSPICIOUS_THRESHOLD` |

When thresholds are exceeded, a `Logger.warn` entry is emitted. No automatic IP blocking yet.

### Future expansion

- Redis-backed counters for multi-instance deployments
- Progressive backoff / temporary IP bans
- Integration with WAF or CDN edge rate limits
- Alerting webhooks when abuse thresholds are exceeded

---

# Security Audit Report (ES-005)

## Current Protections

- Layered rate limiting by endpoint category
- Request body size limits (JSON, URL-encoded, raw)
- Helmet security headers (CSP-safe configuration)
- Startup environment validation
- Structured logging with sensitive field redaction
- Request duration logging
- Image upload MIME/extension/size validation
- In-memory abuse tracking framework
- Standardized error responses with `requestId`

## Protected Endpoints

| Category | Endpoints |
|----------|-----------|
| Health | `GET /health` |
| Auth | `GET /api/v1/auth/me`, `POST /api/v1/auth/dev-login` |
| Messaging | `/api/messaging/*`, `/api/conversations/*`, `/api/messages/*`, `/api/agents/*` |
| Catalog (read) | `GET /api/v1/catalog/*` |
| Search | `GET /api/v1/catalog/products?q=*` |
| Admin | `GET /api/admin/stats` |
| Public fallback | All other `/api/*` (logistics webhooks, operations, catalog writes, deprecated products) |

## Rate Limited Endpoints

All `/api/*` routes and `/health` are covered by at least one rate-limit policy.

## Endpoints Without Dedicated Limits

These rely on the **public API** fallback (`RATE_LIMIT_PUBLIC_MAX`):

- `POST /api/webhooks/meta` (also subject to `RAW_BODY_LIMIT`)
- `POST /api/webhooks/logistics/:courier`
- `POST /api/logistics/simulate-webhook`
- `GET/POST/PATCH /api/v1/operations/*`
- Catalog write endpoints (`POST/PUT/PATCH/DELETE /api/v1/catalog/*`)
- Deprecated `POST/PUT/PATCH /api/products`

Socket.IO connections are not rate-limited at the HTTP middleware layer.

## Upload Findings

- **One upload endpoint** exists: `POST /api/v1/catalog/media/upload`
- Now validates MIME type, file extension, and estimated decoded size
- Upload route is not separately rate-limited beyond public/catalog policies
- No authentication required on upload endpoint (pre-existing behavior; not changed in ES-005)

## Environment Variables Required

**Production-critical:**

- `ALLOWED_ORIGINS`

**Recommended (have sensible defaults):**

- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_*_MAX` (7 policy vars)
- `JSON_BODY_LIMIT`, `URLENCODED_BODY_LIMIT`, `RAW_BODY_LIMIT`
- `UPLOAD_MAX_BYTES`
- `ABUSE_FAILED_AUTH_WINDOW_MS`, `ABUSE_FAILED_AUTH_THRESHOLD`
- `ABUSE_SUSPICIOUS_WINDOW_MS`, `ABUSE_SUSPICIOUS_THRESHOLD`

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| In-memory rate limits / abuse counters | Medium | Not shared across multiple server instances |
| Upload auth not enforced | Medium | Pre-existing; anyone can call upload if URL is known |
| MIME/extension only validation | Low–Medium | No magic-byte verification |
| Socket.IO unrate-limited | Low | Separate from Express middleware stack |
| `ALLOW_DEV_LOGIN` in production | Medium | Warned at startup; not blocked |
| No CSP | Low | Intentional for SPA; relies on other XSS mitigations |
| Operations public endpoints | Low | `/operations/reviews/public` uses public rate limit only |

## Recommended Future Improvements

1. Redis (or similar) for distributed rate limiting and abuse counters
2. Authenticate catalog media upload endpoint
3. Magic-byte validation for uploads
4. WAF / CDN edge protection (Cloudflare, etc.)
5. Security event alerting (PagerDuty, Slack)
6. Periodic dependency vulnerability scanning (`npm audit`)
7. Separate rate policy for webhook endpoints
8. Socket.IO connection rate limiting
9. Optional CSP report-only mode once asset inventory is stable

## OWASP Alignment Summary

| OWASP Category | Coverage | Gap |
|----------------|----------|-----|
| A01 Broken Access Control | Partial | Auth framework unchanged; upload still open |
| A02 Cryptographic Failures | Partial | Secrets redacted in logs; HTTPS assumed in prod |
| A03 Injection | Partial | Existing validation framework; payload size capped |
| A04 Insecure Design | Improved | Abuse framework, env validation |
| A05 Security Misconfiguration | Improved | Helmet, env validation, dev-login warning |
| A06 Vulnerable Components | Unchanged | Recommend `npm audit` in CI |
| A07 Auth Failures | Improved | Rate limits on auth; failed-auth tracking |
| A08 Data Integrity Failures | Partial | Webhook raw body + existing signature checks |
| A09 Logging Failures | Improved | Sanitized logs, request timing, request IDs |
| A10 SSRF | Unchanged | No new SSRF vectors introduced |

## Performance Impact

Estimated per-request overhead:

- Rate limiting: ~0.1–0.5 ms (in-memory counter lookup)
- Request timing: ~0.05 ms (`Date.now()` + `finish` listener)
- Log sanitization: ~0.1–1 ms depending on metadata size
- Helmet: ~0.1 ms (header injection)
- **Total: ~0.5–2 ms** per request under normal load

No database or network calls added to the hot path.

## Technical Debt

**NO** — Sprint 5 did not introduce significant technical debt.

In-memory stores are documented as intentional for single-instance deployments with a clear upgrade path to Redis. No routes were rewritten, no breaking API changes, and all defaults preserve existing behavior.
