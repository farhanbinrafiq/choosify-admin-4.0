/**
 * Public Identity Phase C2 — public handle lifecycle API (mounted at /api/v1).
 *
 * Public reads (rate-limited by the existing /api/v1/catalog + /api buckets):
 *   GET  /catalog/handles/availability?handle=&type=brand|creator[&entityId=]
 *   GET  /catalog/handles/:handle/resolve[?type=brand|creator]
 *
 * Owner (signed in; owner of the Brand / Creator; mutations never while impersonating):
 *   GET  /public-handles/:entityType/:entityId              (owner or Admin)
 *   PUT  /public-handles/:entityType/:entityId/handle       { handle }   set / change at once (no approval)
 *   POST /public-handles/:entityType/:entityId/requests     410 HANDLE_REQUESTS_DISABLED (retired request flow)
 *   POST /public-handles/requests/:requestId/cancel         410 HANDLE_REQUESTS_DISABLED
 *
 * Admin read (admin + super_admin):
 *   GET  /public-handles/admin/requests | /admin/handles | /admin/events
 *
 * Super Admin only, never while impersonating:
 *   POST /public-handles/admin/requests/:requestId/approve  { note? }
 *   POST /public-handles/admin/requests/:requestId/reject   { note }
 *   POST /public-handles/admin/assign | /admin/rename       { entityType, entityId, handle, reason, convertReserved? }
 *   POST /public-handles/admin/retire                       { entityType, entityId, reason }
 *   POST /public-handles/admin/reserve | /admin/release     { handle, reason }
 *
 * Errors: { success: false, error, code[, reason] } with HANDLE_* codes. Database
 * failures are logged and answered with 503 HANDLES_UNAVAILABLE — internal
 * errors are never sent to the client.
 */
import { Router, type Request, type Response } from 'express';
import { softAuthenticateRequest } from '../middleware/auth';
import {
  handleActorOf,
  isEntityOwner,
  isHandleReader,
  requireHandleOwnerAction,
  requireHandleReader,
  requireHandleSession,
  requireHandleSuperAdmin,
} from './publicHandleAuth';
import {
  PublicHandleError,
  approveHandleRequest,
  checkHandleAvailability,
  setOwnerHandle,
  getEntityHandleState,
  isHandleEntityType,
  isRequestId,
  listHandleEvents,
  listHandleRequests,
  listHandles,
  loadHandleEntity,
  rejectHandleRequest,
  releaseHandle,
  requireValidHandle,
  reserveHandle,
  resolveHandle,
  retireHandle,
  setHandleDirect,
  type HandleEntityType,
} from './publicHandleStore';

export const publicHandlesRouter = Router();

function sendHandleError(res: Response, error: unknown, context: string) {
  if (res.headersSent) return;
  if (error instanceof PublicHandleError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, ...error.details });
    return;
  }
  console.error(`[PublicHandles] ${context} failed:`, error instanceof Error ? error.message : error);
  res.status(503).json({
    success: false,
    error: 'Public handles are unavailable right now. Please try again shortly.',
    code: 'HANDLES_UNAVAILABLE',
  });
}

function entityTypeParam(value: unknown): HandleEntityType {
  if (!isHandleEntityType(value)) throw new PublicHandleError('entityType must be brand or creator', 400, 'HANDLE_INVALID_ENTITY_TYPE');
  return value;
}

function entityIdParam(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 128) throw new PublicHandleError('entityId is required', 400, 'HANDLE_INVALID_ENTITY_ID');
  return id;
}

function requestIdParam(value: unknown): string {
  if (!isRequestId(value)) throw new PublicHandleError('Handle request not found', 404, 'HANDLE_REQUEST_NOT_FOUND');
  return value;
}

const query = (req: Request, key: string): string | undefined => {
  const v = req.query[key];
  return typeof v === 'string' ? v : undefined;
};
const body = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};

// ─── Public reads ───────────────────────────────────────────────────────────

publicHandlesRouter.get('/catalog/handles/availability', softAuthenticateRequest, async (req, res) => {
  try {
    const entityType = entityTypeParam(query(req, 'type'));
    const entityIdRaw = query(req, 'entityId');
    const entityId = entityIdRaw ? entityIdParam(entityIdRaw) : null;
    const handle = query(req, 'handle');
    if (handle === undefined) throw new PublicHandleError('handle is required', 400, 'HANDLE_INVALID', { reason: 'empty' });
    const data = await checkHandleAvailability({ handle, entityType, entityId, detailed: isHandleReader(req) });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'availability');
  }
});

publicHandlesRouter.get('/catalog/handles/:handle/resolve', async (req, res) => {
  try {
    const typeRaw = query(req, 'type');
    const entityType = typeRaw === undefined ? null : entityTypeParam(typeRaw);
    let handle: string;
    try {
      handle = requireValidHandle(req.params.handle);
    } catch (error) {
      // A reserved name or prefix can never resolve; anything else is malformed input.
      const reason = error instanceof PublicHandleError ? error.details.reason : null;
      if (reason === 'reserved' || reason === 'reserved_prefix') {
        throw new PublicHandleError('Handle not found', 404, 'HANDLE_NOT_FOUND');
      }
      throw error;
    }
    const data = await resolveHandle(handle, entityType);
    if (!data) throw new PublicHandleError('Handle not found', 404, 'HANDLE_NOT_FOUND');
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'resolve');
  }
});

// ─── Admin reads (declared before /:entityType/:entityId) ───────────────────

publicHandlesRouter.get('/public-handles/admin/requests', ...requireHandleReader, async (req, res) => {
  try {
    const data = await listHandleRequests({
      status: query(req, 'status'),
      entityType: query(req, 'entityType'),
      entityId: query(req, 'entityId'),
      limit: query(req, 'limit'),
    });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'list requests');
  }
});

publicHandlesRouter.get('/public-handles/admin/handles', ...requireHandleReader, async (req, res) => {
  try {
    const data = await listHandles({
      status: query(req, 'status'),
      entityType: query(req, 'entityType'),
      q: query(req, 'q'),
      limit: query(req, 'limit'),
    });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'list handles');
  }
});

publicHandlesRouter.get('/public-handles/admin/events', ...requireHandleReader, async (req, res) => {
  try {
    const data = await listHandleEvents({
      entityType: query(req, 'entityType'),
      entityId: query(req, 'entityId'),
      handle: query(req, 'handle'),
      limit: query(req, 'limit'),
    });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'list events');
  }
});

// ─── Super Admin decisions ──────────────────────────────────────────────────

publicHandlesRouter.post('/public-handles/admin/requests/:requestId/approve', ...requireHandleSuperAdmin, async (req, res) => {
  try {
    const data = await approveHandleRequest({ requestId: requestIdParam(req.params.requestId), actor: handleActorOf(req), note: body(req).note });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'approve');
  }
});

publicHandlesRouter.post('/public-handles/admin/requests/:requestId/reject', ...requireHandleSuperAdmin, async (req, res) => {
  try {
    const data = await rejectHandleRequest({ requestId: requestIdParam(req.params.requestId), actor: handleActorOf(req), note: body(req).note });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'reject');
  }
});

for (const mode of ['assign', 'rename'] as const) {
  publicHandlesRouter.post(`/public-handles/admin/${mode}`, ...requireHandleSuperAdmin, async (req, res) => {
    try {
      const b = body(req);
      const data = await setHandleDirect({
        mode,
        entityType: entityTypeParam(b.entityType),
        entityId: entityIdParam(b.entityId),
        handle: b.handle,
        reason: b.reason,
        convertReserved: b.convertReserved === true,
        actor: handleActorOf(req),
      });
      res.json({ success: true, data });
    } catch (error) {
      sendHandleError(res, error, mode);
    }
  });
}

publicHandlesRouter.post('/public-handles/admin/retire', ...requireHandleSuperAdmin, async (req, res) => {
  try {
    const b = body(req);
    const data = await retireHandle({
      entityType: entityTypeParam(b.entityType),
      entityId: entityIdParam(b.entityId),
      reason: b.reason,
      actor: handleActorOf(req),
    });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'retire');
  }
});

publicHandlesRouter.post('/public-handles/admin/reserve', ...requireHandleSuperAdmin, async (req, res) => {
  try {
    const b = body(req);
    const data = await reserveHandle({ handle: b.handle, reason: b.reason, actor: handleActorOf(req) });
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'reserve');
  }
});

publicHandlesRouter.post('/public-handles/admin/release', ...requireHandleSuperAdmin, async (req, res) => {
  try {
    const b = body(req);
    const data = await releaseHandle({ handle: b.handle, reason: b.reason, actor: handleActorOf(req) });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'release');
  }
});

// ─── Owner routes ───────────────────────────────────────────────────────────

/**
 * Retired owner request flow: owners save their username directly (PUT …/handle).
 * Signed-in, non-impersonated callers get 410 — nothing is read or written; legacy
 * request records stay for Super Admin inspection and decision.
 */
function legacyRequestsDisabled(_req: Request, res: Response) {
  res.status(410).json({
    success: false,
    error: 'Username requests are no longer used: owners save their username directly.',
    code: 'HANDLE_REQUESTS_DISABLED',
  });
}

publicHandlesRouter.post('/public-handles/requests/:requestId/cancel', ...requireHandleOwnerAction, legacyRequestsDisabled);

publicHandlesRouter.get('/public-handles/:entityType/:entityId', ...requireHandleSession, async (req, res) => {
  try {
    const entityType = entityTypeParam(req.params.entityType);
    const entityId = entityIdParam(req.params.entityId);
    const entity = await loadHandleEntity(entityType, entityId);
    const reader = isHandleReader(req);
    if (!reader && (!entity || !isEntityOwner(entity, req.userId))) {
      // Same answer for "not yours" and "does not exist": no profile probing.
      throw new PublicHandleError('Not authorized for this profile', 403, 'HANDLE_FORBIDDEN');
    }
    const data = await getEntityHandleState(entityType, entityId);
    res.json({ success: true, data: { ...data, entityExists: Boolean(entity) } });
  } catch (error) {
    sendHandleError(res, error, 'entity state');
  }
});

publicHandlesRouter.post('/public-handles/:entityType/:entityId/requests', ...requireHandleOwnerAction, legacyRequestsDisabled);

/**
 * The owner sets or changes the username directly (no approval). Ownership and
 * suspension are checked inside the transaction (setOwnerHandle), after the locks.
 */
publicHandlesRouter.put('/public-handles/:entityType/:entityId/handle', ...requireHandleOwnerAction, async (req, res) => {
  try {
    const entityType = entityTypeParam(req.params.entityType);
    const entityId = entityIdParam(req.params.entityId);
    const data = await setOwnerHandle({ entityType, entityId, handle: body(req).handle, actor: handleActorOf(req) });
    res.json({ success: true, data });
  } catch (error) {
    sendHandleError(res, error, 'set username');
  }
});
