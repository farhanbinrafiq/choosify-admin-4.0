# Observability — ES-006 Sprint 6

Enterprise-grade observability infrastructure for the Choosify Admin backend (`choosify-admin-4.0`). All components are in-memory, modular, and backward compatible.

## Architecture

```
Request
  → requestId
  → requestTiming (structured request log + metrics)
  → routers / handlers
  → errorHandler

Parallel infrastructure (opt-in usage):
  → auditLogger (explicit auditLog calls)
  → operationalEvents (startup, shutdown, security, auth failures)
  → metrics (in-memory counters)
```

| Layer | Module | Purpose |
|-------|--------|---------|
| Structured logging | `server/lib/logger.ts` | JSON logs with sanitization |
| Request logging | `server/middleware/requestTiming.ts` | Per-request completion logs + metrics |
| Audit logging | `server/logging/auditLogger.ts` | Reusable audit event infrastructure |
| Operational events | `server/logging/operationalEvents.ts` | Startup, shutdown, security, auth helpers |
| Metrics | `server/lib/metrics.ts` | In-memory request/error counters |
| Runtime info | `server/lib/runtimeInfo.ts` | Memory, CPU, version helpers |
| Readiness | `server/lib/readiness.ts` | Application ready state |
| Startup diagnostics | `server/lib/startupDiagnostics.ts` | Boot-time logging |
| Health | `server/routes/health.ts` | Public liveness/readiness probe |
| Diagnostics | `server/routes/diagnostics.ts` | Admin-only operational dashboard |

## Logging Levels

Standardized levels in `server/lib/logger.ts`:

| Level | Usage |
|-------|-------|
| `INFO` | Normal operations, request completion |
| `WARN` | Configuration warnings, validation issues |
| `ERROR` | Unhandled failures |
| `SECURITY` | Authentication failures, security warnings |
| `AUDIT` | Audit trail events |
| `DEBUG` | Development diagnostics (suppressed in production) |

All metadata passes through `sanitizeLogMeta()` — tokens, secrets, and passwords are never logged.

## Structured Request Logging

Every completed HTTP request logs:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `ip`
- `userAgent`
- `environment`

Example:

```json
{
  "level": "INFO",
  "message": "HTTP request completed",
  "requestId": "…",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "durationMs": 3,
  "ip": "127.0.0.1",
  "userAgent": "curl/8.0",
  "environment": "development"
}
```

## Audit Events

Infrastructure in `server/logging/auditLogger.ts`. **Not auto-wired to every endpoint** — call explicitly when needed.

### Categories

| Category | Helper | Use case |
|----------|--------|----------|
| `admin_action` | `auditAdminAction()` | Admin panel changes |
| `authentication` | `auditAuthenticationEvent()` | Login, token validation |
| `seller_action` | `auditSellerAction()` | Seller operations |
| `catalog_moderation` | `auditCatalogModeration()` | Product/content moderation |
| `permission_change` | `auditPermissionChange()` | Role/permission updates |
| `security_event` | `auditSecurityEvent()` | Rate limits, abuse detection |
| `system_event` | `auditSystemEvent()` | Internal system actions |

### Audit fields

Each audit log includes:

- `requestId`, `timestamp`, `userId`, `userRole`
- `action`, `resource`, `resourceId`
- `ip`, `userAgent`, `result`, `metadata`

### Example usage

```typescript
import { auditAdminAction } from '../logging/auditLogger';

auditAdminAction('update_feature_flag', 'feature_flags', 'success', {
  resourceId: flagId,
  metadata: { enabled: true },
}, req);
```

## Metrics

In-memory counters in `server/lib/metrics.ts`:

| Metric | Description |
|--------|-------------|
| `totalRequests` | All completed HTTP requests |
| `errors` | 5xx responses |
| `clientErrors4xx` | 4xx responses |
| `serverErrors5xx` | 5xx responses |
| `averageResponseTimeMs` | Rolling average response time |
| `healthChecks` | `/health` probe count |
| `authenticatedRequests` | Requests with authenticated user |
| `rejectedRequests` | 401, 403, 429 responses |

Access snapshot via `getMetricsSnapshot()` or `GET /diagnostics` (admin only).

Metrics reset on process restart. No external persistence.

## Health Endpoint

`GET /health` — public, rate-limited.

Returns (inside `success` wrapper):

| Field | Description |
|-------|-------------|
| `status` | `"ok"` |
| `timestamp` | ISO timestamp |
| `uptime` | Process uptime (seconds) |
| `environment` | `NODE_ENV` |
| `version` | Application version |
| `nodeVersion` | Node.js version |
| `app` | Application name |
| `readiness` | `"ready"` or `"starting"` |
| `memory` | RSS, heap, external bytes |
| `startedAt` | Server boot timestamp |

No secrets exposed.

## Diagnostics Endpoint

`GET /diagnostics` — **admin only** (requires Bearer token + admin role).

Returns:

- Application version, environment, Node version, uptime
- Memory usage, CPU usage, system summary
- Active in-memory metrics
- Rate limit configuration summary
- Health/readiness summary

No secrets, tokens, or environment variable values exposed.

## Operational Events

Helpers in `server/logging/operationalEvents.ts`:

| Event | Trigger |
|-------|---------|
| `applicationStarted` | Server listen callback |
| `applicationShutdown` | SIGINT / SIGTERM graceful shutdown |
| `configurationWarning` | Startup config issues |
| `securityWarning` | Security-related warnings |
| `validationFailure` | Available for validation middleware |
| `authenticationFailure` | Auth middleware catch block |

## Startup Diagnostics

On server boot, logs:

- Environment, version, Node version
- Port, configured CORS origins
- Loaded modules list
- Configuration warnings

Secrets are never printed.

---

# Operational Audit Report (ES-006)

## Current Monitoring

| Capability | Status |
|------------|--------|
| In-memory request metrics | Active |
| Health probe with readiness | Active |
| Admin diagnostics endpoint | Active |
| Structured JSON request logs | Active |
| Request duration tracking | Active |
| Rate limit config summary | Active (via diagnostics) |
| Abuse protection counters | Active (via diagnostics) |

## Current Logging

| Log type | Destination | Retention |
|----------|-------------|-----------|
| Request completion | stdout (JSON) | Process lifetime |
| Audit events | stdout (JSON, AUDIT level) | Process lifetime |
| Operational events | stdout (JSON) | Process lifetime |
| Security events | stdout (JSON, SECURITY level) | Process lifetime |
| Errors | stderr (JSON) | Process lifetime |

## Current Diagnostics

| Endpoint | Access | Data |
|----------|--------|------|
| `GET /health` | Public | Liveness, readiness, memory, version |
| `GET /diagnostics` | Admin only | Full runtime + metrics + rate limits |

## Missing Production Monitoring

| Gap | Impact |
|-----|--------|
| No log aggregation | Logs lost on container restart |
| No metrics persistence | Counters reset on deploy |
| No distributed tracing | Cannot trace cross-service requests |
| No alerting | Manual log inspection required |
| No error tracking | No automatic crash grouping |
| Audit logs not persisted | Compliance gaps for long-term audit trail |

## Recommended Future Integrations

| Tool | Purpose | Notes |
|------|---------|-------|
| **OpenTelemetry** | Distributed tracing + metrics export | Instrument Express middleware |
| **Prometheus** | Metrics scraping | Export `getMetricsSnapshot()` via `/metrics` |
| **Grafana** | Dashboards + alerting | Visualize Prometheus data |
| **Google Cloud Logging** | Centralized log aggregation | Structured JSON logs are ready |
| **Sentry** | Error tracking + performance | Hook into `errorHandler` |
| **Datadog / New Relic** | Full APM | Alternative to OTel stack |

None of these are installed in Sprint 6 by design.

## Operational Recommendations

1. **Wire audit calls** in high-value routes (permissions, catalog moderation, admin mutations) as those features are touched.
2. **Scrape `/diagnostics`** from an internal monitoring agent (admin token required).
3. **Alert on** `readiness !== 'ready'`, elevated `serverErrors5xx`, and `rejectedRequests` spikes.
4. **Ship logs** to Cloud Logging or ELK in production.
5. **Add Prometheus exporter** when moving to multi-instance deployment.
6. **Persist audit events** to Firestore or a dedicated audit collection when compliance requires it.

## Performance Impact

Estimated per-request overhead:

- Metrics recording: ~0.05 ms
- Structured request log: ~0.1–0.5 ms
- **Total added by Sprint 6: ~0.15–0.6 ms** per request

Diagnostics and health endpoints add negligible overhead (simple memory reads).

## Technical Debt

**NO** — Sprint 6 did not introduce significant technical debt.

In-memory metrics and audit infrastructure are intentional for single-instance deployments with documented upgrade paths to Prometheus, OpenTelemetry, and persistent audit storage.
