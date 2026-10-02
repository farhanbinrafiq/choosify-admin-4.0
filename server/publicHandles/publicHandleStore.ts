/**
 * Public Identity Phase C2 — public handle lifecycle (Brands + Creators only).
 *
 * Tables (migrations 0012 + 0013): public_handles, public_handle_requests,
 * public_handle_events. Every state change and its history rows are written in
 * the SAME transaction: if any statement fails, nothing is kept — no retired
 * handle, no replacement, no decided request, no success event.
 *
 * Rules enforced here (authorization — who may call — is the HTTP layer's job):
 *  - Handles follow the shared contract (shared/publicHandles/rules.ts): format,
 *    reserved names and reserved catalog-id prefixes.
 *  - One global namespace: a handle row is never re-pointed. A rename RETIRES the
 *    old row and INSERTS a new one; a retired handle is never issued again, not
 *    even to the entity that held it. Only a bare reserved row may become active
 *    (explicit Super Admin conversion) or be released (deleted).
 *  - A handle may not equal another same-type entity's catalog id, slug or (for
 *    Brands) name alias: those are live storefront URLs (lib/publicUrls.ts).
 *  - A Brand handle belongs to the Brand id, never to its seller: ownership
 *    transfer does not touch public_handles.
 *  - public_handle_events is APPEND-ONLY BY CODE CONTRACT: this module only ever
 *    inserts into it. (One database role, no triggers: the database itself cannot
 *    forbid an update or delete.)
 *
 * Locking: pg_advisory_xact_lock(hashtext(key)) as entitlementAdminStore, always
 * taken in the order request → entity → handle, plus row locks (FOR UPDATE).
 * The unique indexes stay the final arbiter; a violation rolls the whole
 * transaction back and is reported as a controlled conflict.
 */
import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { publicHandleEvents, publicHandleRequests, publicHandles } from '../db/schema';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { brandIsMarketplaceVisible } from '../catalog/sellerWorkspace';
import { validateHandle, type HandleRejection } from '../../shared/publicHandles/rules';

export type HandleEntityType = 'brand' | 'creator';
export const HANDLE_ENTITY_TYPES: readonly HandleEntityType[] = ['brand', 'creator'];

export function isHandleEntityType(value: unknown): value is HandleEntityType {
  return value === 'brand' || value === 'creator';
}

/** Effective session actor plus, during impersonation, the real admin behind it. */
export type HandleActor = { userId: string; realActorUserId: string | null };

export class PublicHandleError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'HANDLE_INVALID',
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PublicHandleError';
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;
type HandleRow = typeof publicHandles.$inferSelect;
type RequestRow = typeof publicHandleRequests.$inferSelect;
type EventAction = (typeof publicHandleEvents.$inferInsert)['action'];

const BRAND_BLOCKED_MARKETPLACE_STATUSES = new Set(['suspended', 'revoked', 'restricted']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 1000;

export function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// ─── Catalog view of a Brand / Creator ──────────────────────────────────────

export type HandleEntity = {
  entityType: HandleEntityType;
  entityId: string;
  /** brand.sellerId / creator.userId — the only owner identity handles accept. */
  ownerUserId: string | null;
  /**
   * Brand: marketplaceStatus suspended / revoked / restricted.
   * Creator: always false — creators have no explicit suspension state; their
   * `archived` status is also used for voluntary archiving and is not a block.
   */
  ownerBlocked: boolean;
  marketplaceStatus: string | null;
  /**
   * Publicly available, by the SAME rule the anonymous catalog lists apply
   * (server/catalogRouter.ts scopeBrandsForRequest / scopeCreatorsForRequest):
   * Brand → brandIsMarketplaceVisible(); Creator → status === 'live'.
   */
  publiclyVisible: boolean;
};

export async function loadHandleEntity(entityType: HandleEntityType, entityId: string): Promise<HandleEntity | null> {
  if (entityType === 'brand') {
    const brand = await catalogStore.getBrand(entityId);
    if (!brand) return null;
    const marketplaceStatus = (brand as { marketplaceStatus?: unknown }).marketplaceStatus;
    const status = typeof marketplaceStatus === 'string' ? marketplaceStatus : null;
    return {
      entityType,
      entityId: brand.id,
      ownerUserId: brand.sellerId || null,
      ownerBlocked: status !== null && BRAND_BLOCKED_MARKETPLACE_STATUSES.has(status),
      marketplaceStatus: status,
      publiclyVisible: brandIsMarketplaceVisible(brand as Parameters<typeof brandIsMarketplaceVisible>[0]),
    };
  }
  const creator = await catalogStore.getCreator(entityId);
  if (!creator) return null;
  return {
    entityType,
    entityId: creator.id,
    ownerUserId: creator.userId || null,
    ownerBlocked: false,
    marketplaceStatus: null,
    publiclyVisible: creator.status === 'live',
  };
}

/**
 * A same-type catalog entity (other than `selfId`) already reachable at this key:
 * its catalog id, its slug or — for Brands — its name alias. These are the keys
 * the storefront resolver accepts (lib/publicUrls.ts), so a handle equal to one
 * would take over another entity's live URL.
 */
export async function findCatalogConflict(
  entityType: HandleEntityType,
  handle: string,
  selfId: string | null,
): Promise<{ entityId: string; matchedBy: 'id' | 'slug' | 'name' } | null> {
  const key = handle.toLowerCase();
  const list: Array<{ id: string; slug?: string | null; name?: string | null }> =
    entityType === 'brand' ? await catalogStore.listBrands() : await catalogStore.listCreators();
  for (const e of list) {
    if (!e?.id || e.id === selfId) continue;
    if (String(e.id).trim().toLowerCase() === key) return { entityId: e.id, matchedBy: 'id' };
    if (typeof e.slug === 'string' && e.slug.trim().toLowerCase() === key) return { entityId: e.id, matchedBy: 'slug' };
    if (entityType === 'brand') {
      const name = String(e.name || '').toLowerCase();
      if (name && (name.replace(/\s+/g, '-') === key || name === key)) return { entityId: e.id, matchedBy: 'name' };
    }
  }
  return null;
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** Normalized handle, or HANDLE_INVALID carrying the shared validator's reason. */
export function requireValidHandle(input: unknown, status = 400): string {
  const raw = typeof input === 'string' ? input : '';
  if (raw.length > 100) throw new PublicHandleError('Handle is too long', status, 'HANDLE_INVALID', { reason: 'too_long' });
  const result = validateHandle(raw);
  if ('reason' in result) {
    throw new PublicHandleError(`Handle is not allowed (${result.reason})`, status, 'HANDLE_INVALID', {
      reason: result.reason,
      handle: result.handle,
    });
  }
  return result.handle;
}

function requireText(value: unknown, code: string, what: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new PublicHandleError(`A ${what} is required`, 400, code);
  if (text.length > MAX_TEXT) throw new PublicHandleError(`The ${what} must be at most ${MAX_TEXT} characters`, 400, code);
  return text;
}

function optionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > MAX_TEXT) throw new PublicHandleError(`The note must be at most ${MAX_TEXT} characters`, 400, 'HANDLE_NOTE_TOO_LONG');
  return text;
}

// ─── Database helpers ───────────────────────────────────────────────────────

async function lockKey(tx: Tx, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}
const requestLockKey = (id: string) => `public_handles:request:${id}`;
const entityLockKey = (type: HandleEntityType, id: string) => `public_handles:entity:${type}:${id}`;
const handleLockKey = (handle: string) => `public_handles:handle:${handle}`;

async function writeEvent(
  tx: Tx,
  actor: HandleActor,
  event: {
    action: EventAction;
    entityType?: HandleEntityType | null;
    entityId?: string | null;
    fromHandle?: string | null;
    toHandle?: string | null;
    requestId?: string | null;
    reason?: string | null;
  },
) {
  await tx.insert(publicHandleEvents).values({
    // Wall-clock time of the write (not transaction start), as entitlement audit.
    createdAt: sql`clock_timestamp()`,
    action: event.action,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    fromHandle: event.fromHandle ?? null,
    toHandle: event.toHandle ?? null,
    requestId: event.requestId ?? null,
    actorUserId: actor.userId,
    realActorUserId: actor.realActorUserId,
    reason: event.reason ?? null,
  });
}

function pgErrorOf(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const e = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
      return { code: e.code, constraint: typeof e.constraint === 'string' ? e.constraint : undefined };
    }
    current = e.cause;
  }
  return {};
}

/** Runs a transaction; database constraint violations become controlled conflicts. */
async function inTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(work);
  } catch (error) {
    if (error instanceof PublicHandleError) throw error;
    const pg = pgErrorOf(error);
    if (pg.code === '23505') {
      if (pg.constraint === 'public_handle_requests_one_pending') {
        throw new PublicHandleError('A handle request is already pending for this profile', 409, 'HANDLE_PENDING_EXISTS');
      }
      if (pg.constraint === 'public_handles_handle_unique') {
        throw new PublicHandleError('That handle is not available', 409, 'HANDLE_UNAVAILABLE');
      }
      throw new PublicHandleError('The handle changed at the same time; nothing was saved. Try again.', 409, 'HANDLE_CONFLICT');
    }
    if (pg.code === '23514') {
      throw new PublicHandleError('The handle change was rejected by a database rule; nothing was saved.', 409, 'HANDLE_CONFLICT');
    }
    throw error;
  }
}

async function activeHandleFor(ex: Executor, entityType: HandleEntityType, entityId: string, forUpdate: boolean): Promise<HandleRow | null> {
  const query = ex
    .select()
    .from(publicHandles)
    .where(and(eq(publicHandles.entityType, entityType), eq(publicHandles.entityId, entityId), eq(publicHandles.status, 'active')));
  const rows = forUpdate ? await query.for('update') : await query;
  return rows[0] ?? null;
}

async function handleRow(ex: Executor, handle: string, forUpdate: boolean): Promise<HandleRow | null> {
  const query = ex.select().from(publicHandles).where(eq(publicHandles.handle, handle));
  const rows = forUpdate ? await query.for('update') : await query;
  return rows[0] ?? null;
}

async function pendingRequestFor(ex: Executor, entityType: HandleEntityType, entityId: string): Promise<RequestRow | null> {
  const rows = await ex
    .select()
    .from(publicHandleRequests)
    .where(
      and(
        eq(publicHandleRequests.entityType, entityType),
        eq(publicHandleRequests.entityId, entityId),
        eq(publicHandleRequests.status, 'pending'),
      ),
    );
  return rows[0] ?? null;
}

/**
 * Why `handle` cannot become `entityType/entityId`'s active handle, or null when
 * it can. Table checks cover every status (active, retired, reserved), so a
 * retired handle is refused even for the entity that once held it.
 */
async function availabilityProblem(
  ex: Executor,
  entityType: HandleEntityType,
  entityId: string | null,
  handle: string,
  options: { allowReservedConversion?: boolean; lockRow?: boolean } = {},
): Promise<{ status: number; code: string; reason: string; message: string; row?: HandleRow } | null> {
  const row = await handleRow(ex, handle, Boolean(options.lockRow));
  if (row) {
    if (row.status === 'active' && row.entityType === entityType && row.entityId === entityId) {
      return { status: 409, code: 'HANDLE_NO_CHANGE', reason: 'current_handle', message: 'This is already the current handle', row };
    }
    if (row.status === 'reserved' && options.allowReservedConversion) return null;
    const reason = row.status === 'active' ? 'taken' : row.status;
    return { status: 409, code: 'HANDLE_UNAVAILABLE', reason, message: 'That handle is not available', row };
  }
  const conflict = await findCatalogConflict(entityType, handle, entityId);
  if (conflict) {
    return {
      status: 409,
      code: 'HANDLE_NAMESPACE_CONFLICT',
      reason: 'namespace_conflict',
      message: `That handle is already the ${conflict.matchedBy === 'name' ? 'name' : conflict.matchedBy} of another ${entityType}`,
    };
  }
  return null;
}

function throwProblem(problem: { status: number; code: string; reason: string; message: string }): never {
  throw new PublicHandleError(problem.message, problem.status, problem.code, { reason: problem.reason });
}

async function supersedePendingFor(tx: Tx, actor: HandleActor, entityType: HandleEntityType, entityId: string, why: string) {
  const pending = await tx
    .select()
    .from(publicHandleRequests)
    .where(
      and(
        eq(publicHandleRequests.entityType, entityType),
        eq(publicHandleRequests.entityId, entityId),
        eq(publicHandleRequests.status, 'pending'),
      ),
    )
    .for('update');
  for (const request of pending) {
    await tx
      .update(publicHandleRequests)
      .set({ status: 'superseded', decidedAt: sql`clock_timestamp()`, decidedByUserId: actor.userId, decisionNote: why })
      .where(eq(publicHandleRequests.id, request.id));
    await writeEvent(tx, actor, {
      action: 'request_superseded',
      entityType,
      entityId,
      toHandle: request.requestedHandle,
      requestId: request.id,
      reason: why,
    });
  }
}

// ─── Owner operations ───────────────────────────────────────────────────────

export async function submitHandleRequest(input: {
  entity: HandleEntity;
  handle: unknown;
  actor: HandleActor;
}): Promise<RequestRow> {
  const { entity, actor } = input;
  const handle = requireValidHandle(input.handle);
  const problem = await availabilityProblem(db, entity.entityType, entity.entityId, handle);
  if (problem) throwProblem(problem);
  if (await pendingRequestFor(db, entity.entityType, entity.entityId)) {
    throw new PublicHandleError('A handle request is already pending for this profile', 409, 'HANDLE_PENDING_EXISTS');
  }
  return inTransaction(async (tx) => {
    await lockKey(tx, entityLockKey(entity.entityType, entity.entityId));
    const [created] = await tx
      .insert(publicHandleRequests)
      .values({
        entityType: entity.entityType,
        entityId: entity.entityId,
        requestedHandle: handle,
        status: 'pending',
        requestedByUserId: actor.userId,
        requestedRealActorUserId: actor.realActorUserId,
        createdAt: sql`clock_timestamp()`,
      })
      .returning();
    await writeEvent(tx, actor, {
      action: 'request_submitted',
      entityType: entity.entityType,
      entityId: entity.entityId,
      toHandle: handle,
      requestId: created.id,
    });
    return created;
  });
}

/** The requester withdraws their own pending request. */
export async function cancelHandleRequest(input: { requestId: string; actor: HandleActor }): Promise<RequestRow> {
  const { requestId, actor } = input;
  return inTransaction(async (tx) => {
    await lockKey(tx, requestLockKey(requestId));
    const [request] = await tx.select().from(publicHandleRequests).where(eq(publicHandleRequests.id, requestId)).for('update');
    if (!request) throw new PublicHandleError('Handle request not found', 404, 'HANDLE_REQUEST_NOT_FOUND');
    if (request.requestedByUserId !== actor.userId) {
      throw new PublicHandleError('Only the person who submitted this request can cancel it', 403, 'HANDLE_FORBIDDEN');
    }
    if (request.status !== 'pending') throw new PublicHandleError('This request has already been decided', 409, 'HANDLE_REQUEST_NOT_PENDING');
    const [updated] = await tx
      .update(publicHandleRequests)
      .set({ status: 'cancelled', decidedAt: sql`clock_timestamp()`, decidedByUserId: actor.userId })
      .where(eq(publicHandleRequests.id, requestId))
      .returning();
    await writeEvent(tx, actor, {
      action: 'request_cancelled',
      entityType: request.entityType,
      entityId: request.entityId,
      toHandle: request.requestedHandle,
      requestId,
    });
    return updated;
  });
}

// ─── Super Admin decisions ──────────────────────────────────────────────────

export type ApprovalResult = { request: RequestRow; handle: HandleRow; previousHandle: string | null };

export async function approveHandleRequest(input: { requestId: string; actor: HandleActor; note?: unknown }): Promise<ApprovalResult> {
  const { requestId, actor } = input;
  const note = optionalText(input.note);
  const outcome = await inTransaction(async (tx): Promise<ApprovalResult | { superseded: RequestRow }> => {
    await lockKey(tx, requestLockKey(requestId));
    const [request] = await tx.select().from(publicHandleRequests).where(eq(publicHandleRequests.id, requestId)).for('update');
    if (!request) throw new PublicHandleError('Handle request not found', 404, 'HANDLE_REQUEST_NOT_FOUND');
    if (request.status !== 'pending') throw new PublicHandleError('This request has already been decided', 409, 'HANDLE_REQUEST_NOT_PENDING');
    await lockKey(tx, entityLockKey(request.entityType, request.entityId));

    const entity = await loadHandleEntity(request.entityType, request.entityId);
    if (!entity) throw new PublicHandleError('The profile for this request no longer exists', 404, 'HANDLE_ENTITY_NOT_FOUND');
    if (entity.ownerUserId !== request.requestedByUserId) {
      // Deliberate exception to "a failed approval leaves the request pending":
      // the requester can never be approved for this profile again.
      const why = 'Requester no longer owns this profile';
      const [superseded] = await tx
        .update(publicHandleRequests)
        .set({ status: 'superseded', decidedAt: sql`clock_timestamp()`, decidedByUserId: actor.userId, decisionNote: why })
        .where(eq(publicHandleRequests.id, requestId))
        .returning();
      await writeEvent(tx, actor, {
        action: 'request_superseded',
        entityType: request.entityType,
        entityId: request.entityId,
        toHandle: request.requestedHandle,
        requestId,
        reason: why,
      });
      return { superseded };
    }
    // Suspension is re-read here, not trusted from submission time. Refusing
    // throws, so the whole transaction rolls back: the request stays pending, the
    // current handle stays active, and no event is kept. (Creators: never set.)
    if (entity.ownerBlocked) {
      throw new PublicHandleError(
        'This Brand’s marketplace access is suspended, revoked or restricted; the request stays pending',
        409,
        'HANDLE_OWNER_SUSPENDED',
        { marketplaceStatus: entity.marketplaceStatus },
      );
    }

    const handle = requireValidHandle(request.requestedHandle, 409);
    const problem = await availabilityProblem(tx, request.entityType, request.entityId, handle, { lockRow: true });
    if (problem) throwProblem(problem);

    const previous = await activeHandleFor(tx, request.entityType, request.entityId, true);
    if (previous) {
      await tx
        .update(publicHandles)
        .set({ status: 'retired', retiredAt: sql`clock_timestamp()` })
        .where(eq(publicHandles.id, previous.id));
    }
    const [created] = await tx
      .insert(publicHandles)
      .values({
        handle,
        entityType: request.entityType,
        entityId: request.entityId,
        status: 'active',
        createdByUserId: actor.userId,
        createdAt: sql`clock_timestamp()`,
      })
      .returning();
    const [approved] = await tx
      .update(publicHandleRequests)
      .set({ status: 'approved', decidedAt: sql`clock_timestamp()`, decidedByUserId: actor.userId, decisionNote: note })
      .where(eq(publicHandleRequests.id, requestId))
      .returning();
    await writeEvent(tx, actor, {
      action: 'request_approved',
      entityType: request.entityType,
      entityId: request.entityId,
      fromHandle: previous?.handle ?? null,
      toHandle: handle,
      requestId,
      reason: note,
    });
    await writeEvent(tx, actor, {
      action: previous ? 'renamed' : 'assigned',
      entityType: request.entityType,
      entityId: request.entityId,
      fromHandle: previous?.handle ?? null,
      toHandle: handle,
      requestId,
      reason: note,
    });
    return { request: approved, handle: created, previousHandle: previous?.handle ?? null };
  });
  if ('superseded' in outcome) {
    throw new PublicHandleError(
      'The requester no longer owns this profile; the request was closed as superseded',
      409,
      'HANDLE_REQUESTER_NOT_OWNER',
      { requestStatus: outcome.superseded.status },
    );
  }
  return outcome;
}

export async function rejectHandleRequest(input: { requestId: string; actor: HandleActor; note: unknown }): Promise<RequestRow> {
  const { requestId, actor } = input;
  const note = requireText(input.note, 'HANDLE_NOTE_REQUIRED', 'note explaining the rejection');
  return inTransaction(async (tx) => {
    await lockKey(tx, requestLockKey(requestId));
    const [request] = await tx.select().from(publicHandleRequests).where(eq(publicHandleRequests.id, requestId)).for('update');
    if (!request) throw new PublicHandleError('Handle request not found', 404, 'HANDLE_REQUEST_NOT_FOUND');
    if (request.status !== 'pending') throw new PublicHandleError('This request has already been decided', 409, 'HANDLE_REQUEST_NOT_PENDING');
    const [rejected] = await tx
      .update(publicHandleRequests)
      .set({ status: 'rejected', decidedAt: sql`clock_timestamp()`, decidedByUserId: actor.userId, decisionNote: note })
      .where(eq(publicHandleRequests.id, requestId))
      .returning();
    await writeEvent(tx, actor, {
      action: 'request_rejected',
      entityType: request.entityType,
      entityId: request.entityId,
      toHandle: request.requestedHandle,
      requestId,
      reason: note,
    });
    return rejected;
  });
}

/**
 * Direct Super Admin assignment ('assign': the entity has no active handle) or
 * rename ('rename': it has one, which is retired). A bare reserved row becomes
 * the active handle only when `convertReserved` is set. Any pending owner request
 * for the entity is closed as superseded by this decision.
 */
export async function setHandleDirect(input: {
  mode: 'assign' | 'rename';
  entityType: HandleEntityType;
  entityId: string;
  handle: unknown;
  reason: unknown;
  convertReserved?: boolean;
  actor: HandleActor;
}): Promise<{ handle: HandleRow; previousHandle: string | null }> {
  const { mode, entityType, entityId, actor } = input;
  const handle = requireValidHandle(input.handle);
  const reason = requireText(input.reason, 'HANDLE_REASON_REQUIRED', 'reason');
  const entity = await loadHandleEntity(entityType, entityId);
  if (!entity) throw new PublicHandleError('Profile not found', 404, 'HANDLE_ENTITY_NOT_FOUND');
  return inTransaction(async (tx) => {
    await lockKey(tx, entityLockKey(entityType, entityId));
    await lockKey(tx, handleLockKey(handle));
    const previous = await activeHandleFor(tx, entityType, entityId, true);
    if (mode === 'assign' && previous) {
      throw new PublicHandleError('This profile already has a handle; rename it instead', 409, 'HANDLE_ALREADY_ASSIGNED', {
        currentHandle: previous.handle,
      });
    }
    if (mode === 'rename' && !previous) throw new PublicHandleError('This profile has no handle to rename', 404, 'HANDLE_NOT_ASSIGNED');
    const problem = await availabilityProblem(tx, entityType, entityId, handle, {
      allowReservedConversion: Boolean(input.convertReserved),
      lockRow: true,
    });
    if (problem) throwProblem(problem);
    const reservedRow = await handleRow(tx, handle, true);
    if (reservedRow && reservedRow.status === 'reserved' && !input.convertReserved) {
      throw new PublicHandleError('That handle is reserved', 409, 'HANDLE_UNAVAILABLE', { reason: 'reserved' });
    }
    if (input.convertReserved && reservedRow?.status === 'reserved') {
      // Conversion needs the same catalog check a fresh handle gets.
      const conflict = await findCatalogConflict(entityType, handle, entityId);
      if (conflict) {
        throw new PublicHandleError(`That handle is already the ${conflict.matchedBy} of another ${entityType}`, 409, 'HANDLE_NAMESPACE_CONFLICT', {
          reason: 'namespace_conflict',
        });
      }
    }

    if (previous) {
      await tx
        .update(publicHandles)
        .set({ status: 'retired', retiredAt: sql`clock_timestamp()` })
        .where(eq(publicHandles.id, previous.id));
    }
    let created: HandleRow;
    if (reservedRow && reservedRow.status === 'reserved') {
      // The only in-place change a handle row ever receives: a bare reserved name
      // (never pointed at any entity) becomes this entity's active handle.
      [created] = await tx
        .update(publicHandles)
        .set({ entityType, entityId, status: 'active' })
        .where(and(eq(publicHandles.id, reservedRow.id), eq(publicHandles.status, 'reserved')))
        .returning();
    } else {
      [created] = await tx
        .insert(publicHandles)
        .values({ handle, entityType, entityId, status: 'active', createdByUserId: actor.userId, createdAt: sql`clock_timestamp()` })
        .returning();
    }
    await writeEvent(tx, actor, {
      action: reservedRow && reservedRow.status === 'reserved' ? 'reserved_assigned' : previous ? 'renamed' : 'assigned',
      entityType,
      entityId,
      fromHandle: previous?.handle ?? null,
      toHandle: handle,
      reason,
    });
    await supersedePendingFor(tx, actor, entityType, entityId, `Superseded by a direct Super Admin ${mode}`);
    return { handle: created, previousHandle: previous?.handle ?? null };
  });
}

/** The entity keeps no handle; the retired handle is never issued again. */
export async function retireHandle(input: {
  entityType: HandleEntityType;
  entityId: string;
  reason: unknown;
  actor: HandleActor;
}): Promise<HandleRow> {
  const { entityType, entityId, actor } = input;
  const reason = requireText(input.reason, 'HANDLE_REASON_REQUIRED', 'reason');
  return inTransaction(async (tx) => {
    await lockKey(tx, entityLockKey(entityType, entityId));
    const previous = await activeHandleFor(tx, entityType, entityId, true);
    if (!previous) throw new PublicHandleError('This profile has no active handle', 404, 'HANDLE_NOT_ASSIGNED');
    const [retired] = await tx
      .update(publicHandles)
      .set({ status: 'retired', retiredAt: sql`clock_timestamp()` })
      .where(eq(publicHandles.id, previous.id))
      .returning();
    await writeEvent(tx, actor, { action: 'retired', entityType, entityId, fromHandle: previous.handle, reason });
    return retired;
  });
}

/**
 * Catalog deletion side effect (Phase C3). Runs only AFTER the caller's existing,
 * already-authorized catalog delete; it grants no handle-management authority of
 * its own. The deleted entity's active handle is retired (never reissued) and its
 * pending requests are superseded. Idempotent: no active handle and no pending
 * request is a no-op that writes nothing.
 */
export async function retireHandlesForDeletedEntity(input: {
  entityType: HandleEntityType;
  entityId: string;
  actor: HandleActor;
}): Promise<{ retiredHandle: string | null }> {
  const { entityType, entityId, actor } = input;
  const reason = `${entityType === 'brand' ? 'Brand' : 'Creator'} deleted from the catalog`;
  return inTransaction(async (tx) => {
    await lockKey(tx, entityLockKey(entityType, entityId));
    const active = await activeHandleFor(tx, entityType, entityId, true);
    if (active) {
      await tx
        .update(publicHandles)
        .set({ status: 'retired', retiredAt: sql`clock_timestamp()` })
        .where(eq(publicHandles.id, active.id));
      await writeEvent(tx, actor, { action: 'retired', entityType, entityId, fromHandle: active.handle, reason });
    }
    await supersedePendingFor(tx, actor, entityType, entityId, reason);
    return { retiredHandle: active?.handle ?? null };
  });
}

/** Hold a name no profile may claim (bare reserved row, no entity). */
export async function reserveHandle(input: { handle: unknown; reason: unknown; actor: HandleActor }): Promise<HandleRow> {
  const handle = requireValidHandle(input.handle);
  const reason = requireText(input.reason, 'HANDLE_REASON_REQUIRED', 'reason');
  return inTransaction(async (tx) => {
    await lockKey(tx, handleLockKey(handle));
    const existing = await handleRow(tx, handle, true);
    if (existing) {
      throw new PublicHandleError('That handle is not available', 409, 'HANDLE_UNAVAILABLE', {
        reason: existing.status === 'active' ? 'taken' : existing.status,
      });
    }
    const [created] = await tx
      .insert(publicHandles)
      .values({
        handle,
        entityType: 'reserved',
        entityId: null,
        status: 'reserved',
        createdByUserId: input.actor.userId,
        createdAt: sql`clock_timestamp()`,
      })
      .returning();
    await writeEvent(tx, input.actor, { action: 'reserved', toHandle: handle, reason });
    return created;
  });
}

/** Release a bare reserved name (the only row ever deleted: it never pointed at a profile). */
export async function releaseHandle(input: { handle: unknown; reason: unknown; actor: HandleActor }): Promise<{ handle: string }> {
  const handle = requireValidHandle(input.handle);
  const reason = requireText(input.reason, 'HANDLE_REASON_REQUIRED', 'reason');
  return inTransaction(async (tx) => {
    await lockKey(tx, handleLockKey(handle));
    const existing = await handleRow(tx, handle, true);
    if (!existing) throw new PublicHandleError('Handle not found', 404, 'HANDLE_NOT_FOUND');
    if (existing.status !== 'reserved') {
      throw new PublicHandleError('Only a reserved handle can be released', 409, 'HANDLE_NOT_RESERVED', { status: existing.status });
    }
    await tx.delete(publicHandles).where(and(eq(publicHandles.id, existing.id), eq(publicHandles.status, 'reserved')));
    await writeEvent(tx, input.actor, { action: 'released', fromHandle: handle, reason });
    return { handle };
  });
}

// ─── Reads ──────────────────────────────────────────────────────────────────

const clampLimit = (value: unknown, fallback = 50) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 200) : fallback;
};

export async function getEntityHandleState(entityType: HandleEntityType, entityId: string) {
  const [handles, requests, events] = await Promise.all([
    db
      .select()
      .from(publicHandles)
      .where(and(eq(publicHandles.entityType, entityType), eq(publicHandles.entityId, entityId)))
      .orderBy(asc(publicHandles.createdAt)),
    db
      .select()
      .from(publicHandleRequests)
      .where(and(eq(publicHandleRequests.entityType, entityType), eq(publicHandleRequests.entityId, entityId)))
      .orderBy(desc(publicHandleRequests.createdAt)),
    db
      .select()
      .from(publicHandleEvents)
      .where(and(eq(publicHandleEvents.entityType, entityType), eq(publicHandleEvents.entityId, entityId)))
      .orderBy(asc(publicHandleEvents.createdAt)),
  ]);
  return {
    entityType,
    entityId,
    activeHandle: handles.find((h) => h.status === 'active') ?? null,
    handles,
    pendingRequest: requests.find((r) => r.status === 'pending') ?? null,
    requests,
    events,
  };
}

export async function listHandleRequests(filter: { status?: unknown; entityType?: unknown; entityId?: unknown; limit?: unknown }) {
  const where: SQL[] = [];
  const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'superseded'] as const;
  const status = statuses.find((s) => s === filter.status);
  if (filter.status !== undefined && !status) throw new PublicHandleError('Unknown request status', 400, 'HANDLE_INVALID_FILTER');
  if (status) where.push(eq(publicHandleRequests.status, status));
  if (filter.entityType !== undefined) {
    if (!isHandleEntityType(filter.entityType)) throw new PublicHandleError('entityType must be brand or creator', 400, 'HANDLE_INVALID_ENTITY_TYPE');
    where.push(eq(publicHandleRequests.entityType, filter.entityType));
  }
  if (typeof filter.entityId === 'string' && filter.entityId) where.push(eq(publicHandleRequests.entityId, filter.entityId));
  return db
    .select()
    .from(publicHandleRequests)
    .where(where.length ? and(...where) : undefined)
    // The pending queue reads oldest first; history newest first.
    .orderBy(status === 'pending' ? asc(publicHandleRequests.createdAt) : desc(publicHandleRequests.createdAt))
    .limit(clampLimit(filter.limit));
}

export async function listHandles(filter: { status?: unknown; entityType?: unknown; q?: unknown; limit?: unknown }) {
  const where: SQL[] = [];
  const statuses = ['active', 'retired', 'reserved'] as const;
  const status = statuses.find((s) => s === filter.status);
  if (filter.status !== undefined && !status) throw new PublicHandleError('Unknown handle status', 400, 'HANDLE_INVALID_FILTER');
  if (status) where.push(eq(publicHandles.status, status));
  if (filter.entityType !== undefined) {
    if (!isHandleEntityType(filter.entityType) && filter.entityType !== 'reserved') {
      throw new PublicHandleError('entityType must be brand, creator or reserved', 400, 'HANDLE_INVALID_ENTITY_TYPE');
    }
    where.push(eq(publicHandles.entityType, filter.entityType as 'brand' | 'creator' | 'reserved'));
  }
  if (typeof filter.q === 'string' && filter.q.trim()) {
    const q = `%${filter.q.trim().toLowerCase().replace(/[%_\\]/g, '')}%`;
    where.push(or(sql`${publicHandles.handle} like ${q}`, sql`lower(${publicHandles.entityId}) like ${q}`)!);
  }
  return db
    .select()
    .from(publicHandles)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(publicHandles.createdAt))
    .limit(clampLimit(filter.limit));
}

export async function listHandleEvents(filter: { entityType?: unknown; entityId?: unknown; handle?: unknown; limit?: unknown }) {
  const where: SQL[] = [];
  if (filter.entityType !== undefined) {
    if (!isHandleEntityType(filter.entityType)) throw new PublicHandleError('entityType must be brand or creator', 400, 'HANDLE_INVALID_ENTITY_TYPE');
    where.push(eq(publicHandleEvents.entityType, filter.entityType));
  }
  if (typeof filter.entityId === 'string' && filter.entityId) where.push(eq(publicHandleEvents.entityId, filter.entityId));
  if (typeof filter.handle === 'string' && filter.handle.trim()) {
    const h = filter.handle.trim().replace(/^@/, '').toLowerCase();
    where.push(or(eq(publicHandleEvents.toHandle, h), eq(publicHandleEvents.fromHandle, h))!);
  }
  return db
    .select()
    .from(publicHandleEvents)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(publicHandleEvents.createdAt))
    .limit(clampLimit(filter.limit, 100));
}

/**
 * Public resolution. Active → the entity. Retired → the entity plus its current
 * handle (null when it has none: the storefront then links by slug). Reserved,
 * unknown, wrong-type, an entity that no longer exists, or one that is not
 * publicly available (unpublished Brand, non-live Creator) → null, answered
 * exactly like an unknown handle. The response carries only the routing fields
 * (type, catalog id, handle, status, current handle) — never catalog content.
 */
export async function resolveHandle(handle: string, entityType: HandleEntityType | null) {
  const row = await handleRow(db, handle, false);
  if (!row || row.status === 'reserved' || !isHandleEntityType(row.entityType) || !row.entityId) return null;
  if (entityType && row.entityType !== entityType) return null;
  const entity = await loadHandleEntity(row.entityType, row.entityId);
  if (!entity || !entity.publiclyVisible) return null;
  if (row.status === 'active') {
    return { entityType: row.entityType, entityId: row.entityId, handle: row.handle, status: 'active' as const, currentHandle: row.handle };
  }
  const current = await activeHandleFor(db, row.entityType, row.entityId, false);
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    handle: row.handle,
    status: 'retired' as const,
    currentHandle: current?.handle ?? null,
  };
}

export type AvailabilityResult = {
  handle: string;
  available: boolean;
  /** Validator reason, 'current_handle', 'namespace_conflict', or the table state (detail only for Admin readers). */
  reason?: HandleRejection | 'current_handle' | 'namespace_conflict' | 'unavailable' | 'taken' | 'retired' | 'reserved';
};

export async function checkHandleAvailability(input: {
  handle: unknown;
  entityType: HandleEntityType;
  entityId: string | null;
  detailed: boolean;
}): Promise<AvailabilityResult> {
  const raw = typeof input.handle === 'string' ? input.handle : '';
  if (raw.length > 100) return { handle: raw.slice(0, 100), available: false, reason: 'too_long' };
  const validation = validateHandle(raw);
  if ('reason' in validation) return { handle: validation.handle, available: false, reason: validation.reason };
  const problem = await availabilityProblem(db, input.entityType, input.entityId, validation.handle);
  if (!problem) return { handle: validation.handle, available: true };
  if (problem.reason === 'current_handle' || problem.reason === 'namespace_conflict') {
    return { handle: validation.handle, available: false, reason: problem.reason };
  }
  return {
    handle: validation.handle,
    available: false,
    reason: input.detailed ? (problem.reason as 'taken' | 'retired' | 'reserved') : 'unavailable',
  };
}
