import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import {
  accountEntitlementOverrides,
  featureEntitlements,
  planEntitlements,
  planVersionOffers,
  plans,
  platformFeatureStates,
  subscriptions,
  workspaces,
} from '../db/schema';
import { OPEN_SUBSCRIPTION_STATUSES } from '../subscriptions/types';
import {
  defaultRoleEntitlements,
  featureByKey,
  featureKeysForRole,
  featuresForApiRequest,
  isCoreFeature,
  pageKeysDisabledByFeatures,
  type PartnerFeatureKey,
  type PartnerRole,
  PARTNER_FEATURES,
} from '../../shared/entitlements/registry';
import {
  evaluateFeature,
  type EntitlementContext,
  type EntitlementDecision,
  type EntitlementOverride,
} from './entitlementEvaluator';

export type RoleDefaults = {
  seller: Record<string, boolean>;
  creator: Record<string, boolean>;
};

export type AccountOverrideView = {
  effect: EntitlementOverride['effect'];
  expiresAt: string | null;
  reason: string;
  updatedAt: string;
};

export type EntitlementState = {
  roleDefaults: RoleDefaults;
  accountOverrides: Record<string, Record<string, AccountOverrideView>>;
  platformStates: Record<string, { enabled: boolean; reason: string | null; updatedAt: string }>;
};

export function normalizePartnerRole(role: string | undefined | null): PartnerRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  return null;
}

/**
 * Role-default rows for the given roles, lazily seeding catalog defaults for any
 * missing keys (idempotent, conflict-safe). One SELECT in the common case; a
 * seed INSERT + re-SELECT only the first time a new catalog key is seen.
 */
async function loadRoleDefaultRows(roles: PartnerRole[]) {
  const read = () =>
    db
      .select()
      .from(featureEntitlements)
      .where(and(eq(featureEntitlements.scope, 'role'), inArray(featureEntitlements.scopeKey, roles)));
  const rows = await read();
  const missing: Array<{ scope: 'role'; scopeKey: PartnerRole; featureKey: string; enabled: boolean }> = [];
  for (const role of roles) {
    const have = new Set(rows.filter((r) => r.scopeKey === role).map((r) => r.featureKey));
    for (const [featureKey, enabled] of Object.entries(defaultRoleEntitlements(role))) {
      if (!have.has(featureKey)) missing.push({ scope: 'role', scopeKey: role, featureKey, enabled: Boolean(enabled) });
    }
  }
  if (missing.length === 0) return rows;
  await db.insert(featureEntitlements).values(missing).onConflictDoNothing();
  return read();
}

/** Plan-version feature rows for the account's OPEN subscription (one join), or an explicit plan preview. */
async function loadPlanEntitlements(params: {
  partnerRole: PartnerRole;
  userId: string | null;
  planId: string | null;
}): Promise<Map<string, boolean> | null> {
  if (params.planId) {
    // "Would this Plan grant X" preview: the plan's CURRENT PUBLISHED version.
    const rows = await db
      .select({ featureKey: planEntitlements.featureKey, enabled: planEntitlements.enabled })
      .from(plans)
      .innerJoin(planEntitlements, eq(planEntitlements.planVersionId, plans.currentPublishedVersionId))
      .where(eq(plans.id, params.planId));
    return new Map(rows.map((r) => [r.featureKey, r.enabled]));
  }
  if (!params.userId) return null;
  // workspace (owner + persona) -> open subscription -> offer -> plan version -> plan_entitlements.
  // No open subscription (or no rows for its version) yields an empty map, which the
  // evaluator treats exactly like "no plan": the role default applies.
  const rows = await db
    .select({ featureKey: planEntitlements.featureKey, enabled: planEntitlements.enabled })
    .from(workspaces)
    .innerJoin(
      subscriptions,
      and(eq(subscriptions.workspaceId, workspaces.id), inArray(subscriptions.status, OPEN_SUBSCRIPTION_STATUSES)),
    )
    .innerJoin(planVersionOffers, eq(planVersionOffers.id, subscriptions.planVersionOfferId))
    .innerJoin(planEntitlements, eq(planEntitlements.planVersionId, planVersionOffers.planVersionId))
    .where(and(eq(workspaces.ownerUserId, params.userId), eq(workspaces.type, params.partnerRole)));
  return new Map(rows.map((r) => [r.featureKey, r.enabled]));
}

/**
 * Loads everything the evaluator needs for one actor in at most 4 parallel
 * queries: role defaults, platform switches, the account's overrides and — only
 * when a plan-controlled feature will be evaluated — the open subscription's plan
 * rows. No in-memory cache: every request sees current database state, so
 * multiple backend instances always agree (Sprint 10 durability rule).
 */
export async function loadEntitlementContext(params: {
  role: string | undefined | null;
  userId?: string | null;
  planId?: string | null;
  needPlan: boolean;
}): Promise<EntitlementContext> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) {
    return { partnerRole: null, roleDefaults: new Map(), platformStates: new Map(), overrides: new Map(), planEntitlements: null };
  }
  const uid = params.userId?.trim() || null;
  const planId = params.planId?.trim() || null;
  const [roleRows, platformRows, overrideRows, plan] = await Promise.all([
    loadRoleDefaultRows([partnerRole]),
    db.select({ featureKey: platformFeatureStates.featureKey, enabled: platformFeatureStates.enabled }).from(platformFeatureStates),
    uid
      ? db
          .select({
            featureKey: accountEntitlementOverrides.featureKey,
            effect: accountEntitlementOverrides.effect,
            expiresAt: accountEntitlementOverrides.expiresAt,
          })
          .from(accountEntitlementOverrides)
          .where(eq(accountEntitlementOverrides.userId, uid))
      : Promise.resolve([]),
    params.needPlan ? loadPlanEntitlements({ partnerRole, userId: uid, planId }) : Promise.resolve(null),
  ]);
  return {
    partnerRole,
    roleDefaults: new Map(roleRows.filter((r) => r.scopeKey === partnerRole).map((r) => [r.featureKey, r.enabled])),
    platformStates: new Map(platformRows.map((r) => [r.featureKey, r.enabled])),
    overrides: new Map(overrideRows.map((r) => [r.featureKey, { effect: r.effect, expiresAt: r.expiresAt }])),
    planEntitlements: plan,
  };
}

/** True when evaluating these keys can reach a plan row (plan-controlled, directly or via a dependency). */
function needsPlan(keys: string[]): boolean {
  const seen = new Set<string>();
  const walk = (key: string): boolean => {
    if (seen.has(key)) return false;
    seen.add(key);
    const f = featureByKey(key);
    if (!f || f.deprecated) return false;
    return f.planControlled || (f.requires || []).some(walk);
  };
  return keys.some(walk);
}

/** Full decisions ({enabled, source, detail}) for the given keys, one context load. */
export async function getEntitlementDecisions(params: {
  role: string | undefined | null;
  userId?: string | null;
  planId?: string | null;
  featureKeys: string[];
  now?: Date;
}): Promise<Record<string, EntitlementDecision>> {
  const ctx = await loadEntitlementContext({ ...params, needPlan: needsPlan(params.featureKeys) });
  const now = params.now ?? new Date();
  return Object.fromEntries(params.featureKeys.map((key) => [key, evaluateFeature(key, ctx, now)]));
}

/**
 * Single-feature resolution (kept for existing callers). Partner roles are
 * fail-closed: unknown, deprecated and role-ineligible keys resolve false;
 * staff/admin/consumer always resolve true.
 */
export async function resolveFeatureEnabled(params: {
  role: string | undefined | null;
  featureKey: string;
  userId?: string | null;
  planId?: string | null;
}): Promise<boolean> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return true;
  const feature = featureByKey(params.featureKey);
  // Decided without any DB read: unknown/deprecated/ineligible deny, core allows.
  if (!feature || feature.deprecated || !feature.roles.includes(partnerRole) || (isCoreFeature(feature) && !feature.requires?.length)) {
    return evaluateFeature(params.featureKey, {
      partnerRole,
      roleDefaults: new Map(),
      platformStates: new Map(),
      overrides: new Map(),
      planEntitlements: null,
    }).enabled;
  }
  const decisions = await getEntitlementDecisions({ ...params, featureKeys: [params.featureKey] });
  return decisions[params.featureKey].enabled;
}

export async function isApiPathEntitled(params: {
  role: string | undefined | null;
  userId?: string | null;
  path: string;
  method?: string;
}): Promise<{ ok: boolean; featureKey?: string; source?: string }> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return { ok: true };

  // Segment-boundary prefix + ':param' pattern matching (shared/entitlements/registry).
  // The matcher only returns features available to this role, so a route that does
  // not apply to the role is never turned into an entitlement 403 (Phase 1 behavior).
  const gated = featuresForApiRequest(partnerRole, params.path, params.method).filter((f) => !isCoreFeature(f));
  if (gated.length === 0) return { ok: true }; // unmapped/core routes never touch the database
  const decisions = await getEntitlementDecisions({
    role: partnerRole,
    userId: params.userId,
    featureKeys: gated.map((f) => f.key),
  });
  for (const feature of gated) {
    const decision = decisions[feature.key];
    if (!decision.enabled) return { ok: false, featureKey: feature.key, source: decision.source };
  }
  return { ok: true };
}

export async function getEnabledMapForActor(params: {
  role: string | undefined | null;
  userId?: string | null;
  planId?: string | null;
}): Promise<Record<string, boolean>> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return {};
  const decisions = await getEntitlementDecisions({ ...params, role: partnerRole, featureKeys: featureKeysForRole(partnerRole) });
  return Object.fromEntries(Object.entries(decisions).map(([key, d]) => [key, d.enabled]));
}

export async function filterPageKeysForEntitlements(
  role: string | undefined | null,
  pageKeys: string[] | null,
  userId?: string | null,
): Promise<string[] | null> {
  if (!pageKeys) return pageKeys;
  const partnerRole = normalizePartnerRole(role);
  if (!partnerRole) return pageKeys;
  const enabled = await getEnabledMapForActor({ role: partnerRole, userId });
  const disabledPages = pageKeysDisabledByFeatures(partnerRole, enabled);
  if (!disabledPages.size) return pageKeys;
  return pageKeys.filter((k) => !disabledPages.has(k));
}

export const entitlementStore = {
  getRoleDefaults: async (): Promise<RoleDefaults> => {
    const rows = await loadRoleDefaultRows(['seller', 'creator']);
    const out: RoleDefaults = { seller: {}, creator: {} };
    for (const row of rows) {
      if (row.scopeKey === 'seller' || row.scopeKey === 'creator') {
        out[row.scopeKey][row.featureKey] = row.enabled;
      }
    }
    return out;
  },

  /** Admin snapshot. feature_entitlements 'plan'/'account' scopes are legacy and no longer read. */
  snapshot: async (): Promise<EntitlementState> => {
    const [roleDefaults, overrideRows, platformRows] = await Promise.all([
      entitlementStore.getRoleDefaults(),
      db.select().from(accountEntitlementOverrides),
      db.select().from(platformFeatureStates),
    ]);
    const accountOverrides: EntitlementState['accountOverrides'] = {};
    for (const row of overrideRows) {
      accountOverrides[row.userId] = {
        ...accountOverrides[row.userId],
        [row.featureKey]: {
          effect: row.effect,
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          reason: row.reason,
          updatedAt: row.updatedAt.toISOString(),
        },
      };
    }
    const platformStates: EntitlementState['platformStates'] = {};
    for (const row of platformRows) {
      platformStates[row.featureKey] = { enabled: row.enabled, reason: row.reason, updatedAt: row.updatedAt.toISOString() };
    }
    return { roleDefaults, accountOverrides, platformStates };
  },

  /** Non-destructive: toggles access only — never mutates cashbook/orders/etc. */
  catalog: () => PARTNER_FEATURES.map((f) => ({ ...f })),
};

export type { PartnerFeatureKey, PartnerRole };
