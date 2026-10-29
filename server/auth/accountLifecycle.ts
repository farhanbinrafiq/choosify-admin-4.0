/**
 * Account lifecycle: active → inactive (taking a break) or in deletion (90-day
 * window) → anonymized. Stored on the account extras (no migration); every
 * change is kept in `history` and in the account activity log.
 *
 * Rules (user decisions 2026-10-29):
 * - Only Super Admins change other people's lifecycle; owners can deactivate
 *   themselves or ask for deletion (which takes effect at once).
 * - Inactive / in deletion: all sessions are ended; a seller's brands and a
 *   creator's profile are taken off the marketplace (Marketplace Access must be
 *   granted again after they come back).
 * - Signing in again (before anonymization) reactivates the account.
 * - After 90 days in deletion the account is anonymized: personal data removed,
 *   login blocked; orders / payments / returns / reviews stay as anonymous records.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { userIdentities, users } from '../db/schema';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../catalogContract';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { recordKey, withRecordLocks } from '../catalog/recordLock';
import { Logger } from '../lib/logger';
import { getUserProfileExtras, upsertUserProfileExtras, listAllUserProfileExtras } from './userProfileExtras';
import { revokeAllRefreshTokensForUser } from './jwtTokens';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';

export const DELETION_WINDOW_DAYS = 90;
export const MIN_REASON_CHARS = 10;

export type AccountLifecycleState = 'inactive' | 'pending_deletion' | 'anonymized';
export type AccountLifecycleEvent = {
  at: string;
  action: 'deactivated' | 'deletion_requested' | 'reactivated' | 'anonymized';
  by: 'self' | 'admin' | 'login' | 'system';
  actorId?: string;
  actorName?: string;
  reason?: string;
  internalNote?: string;
};
export type AccountLifecycle = {
  state?: AccountLifecycleState;
  reason?: string;
  internalNote?: string;
  requestedBy?: 'self' | 'admin';
  at?: string;
  deletionDueAt?: string;
  history: AccountLifecycleEvent[];
};

export type LifecycleActor = { id: string; name?: string };

export class LifecycleError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function getAccountLifecycle(userId: string): AccountLifecycle {
  return (getUserProfileExtras(userId)?.lifecycle as AccountLifecycle | undefined) ?? { history: [] };
}

function save(userId: string, lifecycle: AccountLifecycle): AccountLifecycle {
  upsertUserProfileExtras({ userId, lifecycle });
  return lifecycle;
}

function cleanReason(raw: unknown, field = 'reason', min = MIN_REASON_CHARS): string {
  const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 1000) : '';
  if (text.length < min) throw new LifecycleError(400, 'REASON_REQUIRED', `A ${field} of at least ${min} characters is required.`);
  return text;
}

/** Takes a seller's brands and a creator's profile off the marketplace. */
async function hideFromMarketplace(userId: string, role: string): Promise<number> {
  let hidden = 0;
  if (role === 'creator') {
    for (const c of (await catalogStore.listCreators()).filter((x) => x.userId === userId && x.status === 'live')) {
      await withRecordLocks([recordKey('creator', c.id)], async () => {
        const cur = await catalogStore.getCreator(c.id);
        if (!cur) return;
        await catalogStore.upsertCreator({ ...normalizeCreatorInput({ ...cur, status: 'draft' }, cur), slug: cur.slug });
        hidden += 1;
      });
    }
    return hidden;
  }
  for (const b of (await catalogStore.listBrands()).filter((x) => x.sellerId === userId)) {
    if (b.marketplaceAccess === false && (b as { marketplaceStatus?: string }).marketplaceStatus === 'not_granted') continue;
    await withRecordLocks([recordKey('brand', b.id)], async () => {
      const cur = await catalogStore.getBrand(b.id);
      if (!cur) return;
      await catalogStore.upsertBrand({
        ...normalizeBrandInput({ ...cur, marketplaceAccess: false, marketplaceStatus: 'not_granted' }, cur),
        slug: cur.slug,
      });
      hidden += 1;
    });
  }
  return hidden;
}

async function loadUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new LifecycleError(404, 'USER_NOT_FOUND', 'Account not found');
  return user;
}

/** Inactive ("taking a break"): no sessions, off the marketplace; signing in reactivates. */
export async function deactivateAccount(
  userId: string,
  input: { reason: unknown; by: 'self' | 'admin'; actor: LifecycleActor; internalNote?: unknown },
): Promise<AccountLifecycle> {
  const user = await loadUser(userId);
  const current = getAccountLifecycle(userId);
  if (current.state === 'anonymized') throw new LifecycleError(409, 'ACCOUNT_DELETED', 'This account has already been deleted.');
  if (current.state === 'pending_deletion') throw new LifecycleError(409, 'IN_DELETION', 'This account is already in deletion.');
  const reason = cleanReason(input.reason);
  const internalNote = typeof input.internalNote === 'string' ? input.internalNote.trim().slice(0, 1000) : undefined;
  const at = new Date().toISOString();
  await revokeAllRefreshTokensForUser(userId);
  await hideFromMarketplace(userId, String(user.role || '').toLowerCase());
  return save(userId, {
    state: 'inactive',
    reason,
    ...(internalNote ? { internalNote } : {}),
    requestedBy: input.by,
    at,
    history: [...current.history, { at, action: 'deactivated', by: input.by, actorId: input.actor.id, actorName: input.actor.name, reason, ...(internalNote ? { internalNote } : {}) }],
  });
}

/** In deletion: inactive now, anonymized after the 90-day window unless they sign in again. */
export async function requestAccountDeletion(
  userId: string,
  input: { reason: unknown; by: 'self' | 'admin'; actor: LifecycleActor; internalNote?: unknown },
): Promise<AccountLifecycle> {
  const user = await loadUser(userId);
  const current = getAccountLifecycle(userId);
  if (current.state === 'anonymized') throw new LifecycleError(409, 'ACCOUNT_DELETED', 'This account has already been deleted.');
  const reason = cleanReason(input.reason);
  const internalNote = input.by === 'admin' ? cleanReason(input.internalNote, 'internal note', 5) : undefined;
  const at = new Date();
  const deletionDueAt = new Date(at.getTime() + DELETION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await revokeAllRefreshTokensForUser(userId);
  await hideFromMarketplace(userId, String(user.role || '').toLowerCase());
  return save(userId, {
    state: 'pending_deletion',
    reason,
    ...(internalNote ? { internalNote } : {}),
    requestedBy: input.by,
    at: at.toISOString(),
    deletionDueAt,
    history: [
      ...current.history,
      { at: at.toISOString(), action: 'deletion_requested', by: input.by, actorId: input.actor.id, actorName: input.actor.name, reason, ...(internalNote ? { internalNote } : {}) },
    ],
  });
}

/** Back to active (by signing in, or by a Super Admin). Marketplace Access is NOT restored. */
export function reactivateAccount(userId: string, input: { by: 'login' | 'admin'; actor: LifecycleActor; note?: unknown }): AccountLifecycle {
  const current = getAccountLifecycle(userId);
  if (current.state === 'anonymized') throw new LifecycleError(409, 'ACCOUNT_DELETED', 'This account has already been deleted.');
  if (!current.state) return current;
  const at = new Date().toISOString();
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) : undefined;
  return save(userId, {
    history: [...current.history, { at, action: 'reactivated', by: input.by, actorId: input.actor.id, actorName: input.actor.name, ...(note ? { reason: note } : {}) }],
  });
}

/** Removes personal data from accounts whose 90-day deletion window has passed. */
export async function anonymizeDueAccounts(now = Date.now()): Promise<string[]> {
  const done: string[] = [];
  for (const extras of listAllUserProfileExtras()) {
    const life = extras.lifecycle as AccountLifecycle | undefined;
    if (life?.state !== 'pending_deletion' || !life.deletionDueAt || Date.parse(life.deletionDueAt) > now) continue;
    const userId = extras.userId;
    try {
      const at = new Date(now).toISOString();
      await db
        .update(users)
        .set({
          email: `deleted+${userId}@deleted.choosify.invalid`,
          displayName: 'Deleted account',
          passwordHash: null,
          avatarUrl: null,
          avatarOriginalUrl: null,
          avatarCrop: null,
          updatedAt: new Date(now),
        } as never)
        .where(eq(users.id, userId));
      await db.delete(userIdentities).where(eq(userIdentities.userId, userId));
      await revokeAllRefreshTokensForUser(userId);
      operationsStore.removeShopperSignals(userId);
      scheduleOperationsPersist();
      upsertUserProfileExtras({
        userId,
        phone: undefined,
        addresses: [],
        username: undefined,
        bio: undefined,
        website: undefined,
        lifecycle: {
          state: 'anonymized',
          at,
          history: [...life.history, { at, action: 'anonymized', by: 'system' }],
        },
      });
      done.push(userId);
    } catch (error) {
      Logger.error('account anonymization failed', { userId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (done.length) Logger.info('accounts anonymized after the deletion window', { count: done.length });
  return done;
}
