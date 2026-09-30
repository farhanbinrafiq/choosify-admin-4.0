/**
 * Entitlements Phase 2A — administrative entitlement writes + their audit trail.
 *
 * Every state change and its entitlement_audit_events row are written in the SAME
 * transaction: if the audit insert fails, the change is rolled back. A no-op
 * (nothing would change) writes nothing and records no audit row.
 *
 * Not audited here by design: lazy role-default seeding, restrictions lapsing
 * (derived from expires_at), plan/subscription changes (subscription_events) and
 * feature requests (their own review fields).
 *
 * Authorization (who may call these) is enforced by the HTTP layer; these
 * functions validate the change itself and record the acting user.
 */
import { and, desc, eq, lt, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import {
  accountEntitlementOverrides,
  entitlementAuditEvents,
  featureEntitlements,
  platformFeatureStates,
  users,
} from '../db/schema';
import {
  featureByKey,
  featureKeysForRole,
  isSwitchableFeature,
  type PartnerRole,
} from '../../shared/entitlements/registry';
import { entitlementStore, normalizePartnerRole, type RoleDefaults } from './entitlementStore';
import type { OverrideEffect } from './entitlementEvaluator';

export class EntitlementAdminError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'ENTITLEMENT_CHANGE_INVALID',
  ) {
    super(message);
    this.name = 'EntitlementAdminError';
  }
}

export type EntitlementActor = {
  /** The effective acting user (the impersonated identity when impersonating). */
  userId: string | null;
  /** The real admin behind an impersonation session, if any. */
  realActorUserId?: string | null;
  source?: 'admin_api' | 'system';
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeAudit(
  tx: Tx,
  actor: EntitlementActor,
  event: {
    action: 'role_default.set' | 'account_override.set' | 'account_override.removed' | 'platform_state.set';
    targetScope: 'role' | 'account' | 'platform';
    targetUserId?: string | null;
    targetRole?: string | null;
    featureKey: string;
    previousState: unknown;
    newState: unknown;
    reason?: string | null;
  },
) {
  await tx.insert(entitlementAuditEvents).values({
    action: event.action,
    source: actor.source ?? 'admin_api',
    actorUserId: actor.userId ?? null,
    realActorUserId: actor.realActorUserId ?? null,
    targetScope: event.targetScope,
    targetUserId: event.targetUserId ?? null,
    targetRole: event.targetRole ?? null,
    featureKey: event.featureKey,
    previousState: event.previousState ?? null,
    newState: event.newState ?? null,
    reason: event.reason ?? null,
  });
}

function requireReason(reason: unknown, what: string): string {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (!r) throw new EntitlementAdminError(`A reason is required to ${what}`, 400, 'ENTITLEMENT_REASON_REQUIRED');
  if (r.length > 1000) throw new EntitlementAdminError('Reason must be at most 1000 characters', 400, 'ENTITLEMENT_REASON_TOO_LONG');
  return r;
}

function requireSwitchable(featureKey: string) {
  const feature = featureByKey(featureKey);
  if (!feature) throw new EntitlementAdminError(`Unknown feature: ${featureKey}`, 400, 'ENTITLEMENT_UNKNOWN_FEATURE');
  if (!isSwitchableFeature(feature)) {
    throw new EntitlementAdminError(
      `${featureKey} is ${feature.deprecated ? 'deprecated' : feature.tier} and cannot be controlled`,
      400,
      'FEATURE_NOT_SWITCHABLE',
    );
  }
  return feature;
}

// ─── Role defaults ──────────────────────────────────────────────────────────

/**
 * Set one or more role defaults. `strict` rejects any unknown/ineligible/
 * non-switchable key (single-feature API); non-strict skips them (bulk API,
 * matching its previous behavior).
 */
export async function setRoleDefaults(input: {
  role: PartnerRole;
  changes: Record<string, boolean>;
  actor: EntitlementActor;
  reason?: string | null;
  strict?: boolean;
}): Promise<{ changed: string[]; roleDefaults: RoleDefaults }> {
  if (input.role !== 'seller' && input.role !== 'creator') {
    throw new EntitlementAdminError('role must be seller or creator');
  }
  const eligible = new Set<string>(featureKeysForRole(input.role));
  const valid: Array<[string, boolean]> = [];
  for (const [key, value] of Object.entries(input.changes)) {
    if (typeof value !== 'boolean') {
      if (input.strict) throw new EntitlementAdminError(`enabled must be a boolean for ${key}`);
      continue;
    }
    const ok = eligible.has(key) && isSwitchableFeature(featureByKey(key));
    if (!ok) {
      if (input.strict) {
        if (!eligible.has(key)) throw new EntitlementAdminError('Unknown feature for role', 400, 'ENTITLEMENT_UNKNOWN_FEATURE');
        requireSwitchable(key);
      }
      continue;
    }
    valid.push([key, value]);
  }
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 1000) : null;

  // Make sure every catalog key has its baseline row before comparing values.
  await entitlementStore.getRoleDefaults();
  const changed: string[] = [];
  await db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(featureEntitlements)
      .where(and(eq(featureEntitlements.scope, 'role'), eq(featureEntitlements.scopeKey, input.role)))
      .for('update');
    const byKey = new Map(current.map((r) => [r.featureKey, r.enabled]));
    for (const [featureKey, enabled] of valid) {
      const previous = byKey.has(featureKey) ? byKey.get(featureKey)! : null;
      if (previous === enabled) continue; // no-op: no write, no audit row
      await tx
        .insert(featureEntitlements)
        .values({ scope: 'role', scopeKey: input.role, featureKey, enabled })
        .onConflictDoUpdate({
          target: [featureEntitlements.scope, featureEntitlements.scopeKey, featureEntitlements.featureKey],
          set: { enabled, updatedAt: new Date() },
        });
      await writeAudit(tx, input.actor, {
        action: 'role_default.set',
        targetScope: 'role',
        targetRole: input.role,
        featureKey,
        previousState: previous === null ? null : { enabled: previous },
        newState: { enabled },
        reason,
      });
      byKey.set(featureKey, enabled);
      changed.push(featureKey);
    }
  });
  return { changed, roleDefaults: await entitlementStore.getRoleDefaults() };
}

// ─── Account overrides ──────────────────────────────────────────────────────

export type AccountOverrideInput = {
  userId: string;
  featureKey: string;
  effect: OverrideEffect;
  /** Required (and must be in the future) for 'restrict'; forbidden for grant/revoke. */
  expiresAt?: Date | string | null;
  reason: string;
};

function overrideState(row: { effect: string; expiresAt: Date | null; reason: string }) {
  return { effect: row.effect, expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null, reason: row.reason };
}

async function requirePartnerTarget(userId: string, featureKey: string) {
  const rows = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) throw new EntitlementAdminError('Account not found', 404, 'ENTITLEMENT_ACCOUNT_NOT_FOUND');
  const partnerRole = normalizePartnerRole(rows[0].role);
  if (!partnerRole) {
    throw new EntitlementAdminError('Overrides apply to Seller and Creator accounts only', 400, 'ENTITLEMENT_TARGET_NOT_PARTNER');
  }
  const feature = requireSwitchable(featureKey);
  if (!feature.roles.includes(partnerRole)) {
    throw new EntitlementAdminError(`${featureKey} is not available to ${partnerRole} accounts`, 400, 'ENTITLEMENT_ROLE_INELIGIBLE');
  }
  return partnerRole;
}

export async function setAccountOverride(
  input: AccountOverrideInput,
  actor: EntitlementActor,
  now: Date = new Date(),
): Promise<{ changed: boolean }> {
  if (!['grant', 'revoke', 'restrict'].includes(input.effect)) {
    throw new EntitlementAdminError('effect must be grant, revoke or restrict');
  }
  const reason = requireReason(input.reason, 'change an account override');
  let expiresAt: Date | null = null;
  if (input.effect === 'restrict') {
    if (input.expiresAt === undefined || input.expiresAt === null || input.expiresAt === '') {
      throw new EntitlementAdminError('A temporary restriction requires expiresAt', 400, 'ENTITLEMENT_EXPIRY_REQUIRED');
    }
    expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new EntitlementAdminError('expiresAt must be a valid timestamp');
    if (expiresAt.getTime() <= now.getTime()) {
      throw new EntitlementAdminError('expiresAt must be in the future', 400, 'ENTITLEMENT_EXPIRY_IN_PAST');
    }
  } else if (input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== '') {
    throw new EntitlementAdminError('Grants and permanent revocations cannot expire', 400, 'ENTITLEMENT_EXPIRY_NOT_ALLOWED');
  }
  await requirePartnerTarget(input.userId, input.featureKey);

  let changed = false;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(accountEntitlementOverrides)
      .where(and(eq(accountEntitlementOverrides.userId, input.userId), eq(accountEntitlementOverrides.featureKey, input.featureKey)))
      .for('update');
    const prev = existing[0];
    if (
      prev &&
      prev.effect === input.effect &&
      (prev.expiresAt?.getTime() ?? null) === (expiresAt?.getTime() ?? null) &&
      prev.reason === reason
    ) {
      return; // no-op
    }
    const nowTs = new Date();
    await tx
      .insert(accountEntitlementOverrides)
      .values({
        userId: input.userId,
        featureKey: input.featureKey,
        effect: input.effect,
        expiresAt,
        reason,
        createdByUserId: actor.userId ?? null,
        updatedByUserId: actor.userId ?? null,
      })
      .onConflictDoUpdate({
        target: [accountEntitlementOverrides.userId, accountEntitlementOverrides.featureKey],
        set: { effect: input.effect, expiresAt, reason, updatedByUserId: actor.userId ?? null, updatedAt: nowTs },
      });
    await writeAudit(tx, actor, {
      action: 'account_override.set',
      targetScope: 'account',
      targetUserId: input.userId,
      featureKey: input.featureKey,
      previousState: prev ? overrideState(prev) : null,
      newState: overrideState({ effect: input.effect, expiresAt, reason }),
      reason,
    });
    changed = true;
  });
  return { changed };
}

export async function removeAccountOverride(
  input: { userId: string; featureKey: string; reason: string },
  actor: EntitlementActor,
): Promise<{ changed: boolean }> {
  const reason = requireReason(input.reason, 'remove an account override');
  let changed = false;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(accountEntitlementOverrides)
      .where(and(eq(accountEntitlementOverrides.userId, input.userId), eq(accountEntitlementOverrides.featureKey, input.featureKey)))
      .for('update');
    if (!existing[0]) return; // no-op: nothing to remove
    await tx.delete(accountEntitlementOverrides).where(eq(accountEntitlementOverrides.id, existing[0].id));
    await writeAudit(tx, actor, {
      action: 'account_override.removed',
      targetScope: 'account',
      targetUserId: input.userId,
      featureKey: input.featureKey,
      previousState: overrideState(existing[0]),
      newState: null,
      reason,
    });
    changed = true;
  });
  return { changed };
}

// ─── Platform switches ──────────────────────────────────────────────────────

export async function setPlatformFeatureState(
  input: { featureKey: string; enabled: boolean; reason?: string | null },
  actor: EntitlementActor,
): Promise<{ changed: boolean }> {
  if (typeof input.enabled !== 'boolean') throw new EntitlementAdminError('enabled must be a boolean');
  requireSwitchable(input.featureKey);
  const reason = input.enabled
    ? typeof input.reason === 'string' && input.reason.trim()
      ? input.reason.trim().slice(0, 1000)
      : null
    : requireReason(input.reason, 'turn a feature off platform-wide');

  let changed = false;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(platformFeatureStates)
      .where(eq(platformFeatureStates.featureKey, input.featureKey))
      .for('update');
    const prev = existing[0];
    // A missing row means enabled: enabling a feature that has no row is a no-op.
    const prevEnabled = prev ? prev.enabled : true;
    if (prevEnabled === input.enabled && (prev ? prev.reason === reason : input.enabled)) return;
    await tx
      .insert(platformFeatureStates)
      .values({ featureKey: input.featureKey, enabled: input.enabled, reason, updatedByUserId: actor.userId ?? null })
      .onConflictDoUpdate({
        target: platformFeatureStates.featureKey,
        set: { enabled: input.enabled, reason, updatedByUserId: actor.userId ?? null, updatedAt: new Date() },
      });
    await writeAudit(tx, actor, {
      action: 'platform_state.set',
      targetScope: 'platform',
      featureKey: input.featureKey,
      previousState: prev ? { enabled: prev.enabled, reason: prev.reason } : null,
      newState: { enabled: input.enabled, reason },
      reason,
    });
    changed = true;
  });
  return { changed };
}

// ─── Audit history ──────────────────────────────────────────────────────────

export async function listEntitlementAuditEvents(filter: {
  targetUserId?: string;
  featureKey?: string;
  before?: Date;
  limit?: number;
}) {
  const conditions: SQL[] = [];
  if (filter.targetUserId) conditions.push(eq(entitlementAuditEvents.targetUserId, filter.targetUserId));
  if (filter.featureKey) conditions.push(eq(entitlementAuditEvents.featureKey, filter.featureKey));
  if (filter.before) conditions.push(lt(entitlementAuditEvents.createdAt, filter.before));
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  return db
    .select()
    .from(entitlementAuditEvents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(entitlementAuditEvents.createdAt))
    .limit(limit);
}
