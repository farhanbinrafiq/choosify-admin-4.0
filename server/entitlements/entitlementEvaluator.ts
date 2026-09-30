/**
 * Entitlements Phase 2A — pure feature evaluator. No I/O: every input is in the
 * EntitlementContext, which entitlementStore loads once per request. That keeps
 * precedence testable offline and lets one request evaluate any number of
 * features without re-querying.
 *
 * Precedence (first match wins; dependencies are applied last to anything allowed):
 *  0. not a partner role (staff/admin/consumer)     → allowed   (not partner-gated)
 *  1. unknown or deprecated feature                  → denied
 *  2. feature not available to the partner's role    → denied
 *  3. core feature                                   → allowed   (platform/override ignored)
 *  4. platform switch OFF (switchable features only) → denied
 *  5. override revoke                                → denied
 *  6. override restrict, expires_at in the future    → denied    (expired: ignored)
 *  7. override grant                                 → allowed
 *  8. planControlled + open subscription whose plan version has a row → that row
 *  9. role default row                               → its value (missing row → denied)
 * 10. dependencies (feature.requires) must also evaluate allowed
 *
 * Core is checked before the platform switch so a core capability can never be
 * turned off (writes are rejected too). Reserved features ignore platform and
 * override controls and resolve from the role default. A plan-controlled feature
 * with no open subscription falls back to the role default.
 */
import {
  featureByKey,
  isCoreFeature,
  isSwitchableFeature,
  type PartnerFeatureDef,
  type PartnerRole,
} from '../../shared/entitlements/registry';

export type OverrideEffect = 'grant' | 'revoke' | 'restrict';

export type EntitlementOverride = {
  effect: OverrideEffect;
  expiresAt: Date | null;
};

export type EntitlementContext = {
  /** null = not a partner (staff / admin / consumer) — never partner-gated. */
  partnerRole: PartnerRole | null;
  /** Role-default baseline (feature_entitlements scope='role'). */
  roleDefaults: ReadonlyMap<string, boolean>;
  /** Platform switches; a missing key means enabled. */
  platformStates: ReadonlyMap<string, boolean>;
  /** The account's overrides by feature key. */
  overrides: ReadonlyMap<string, EntitlementOverride>;
  /**
   * Feature rows of the plan version behind the account's OPEN subscription.
   * null = no open subscription (or plan data not loaded because no
   * plan-controlled feature is being evaluated).
   */
  planEntitlements: ReadonlyMap<string, boolean> | null;
};

export type EntitlementSource =
  | 'not_partner'
  | 'unknown'
  | 'deprecated'
  | 'role_ineligible'
  | 'core'
  | 'platform'
  | 'override'
  | 'plan'
  | 'role_default'
  | 'dependency';

export type EntitlementDecision = {
  enabled: boolean;
  source: EntitlementSource;
  detail?: Record<string, unknown>;
};

function evaluateBase(feature: PartnerFeatureDef, ctx: EntitlementContext, now: Date): EntitlementDecision {
  const role = ctx.partnerRole as PartnerRole;
  if (!feature.roles.includes(role)) return { enabled: false, source: 'role_ineligible', detail: { role } };
  if (isCoreFeature(feature)) return { enabled: true, source: 'core' };

  if (isSwitchableFeature(feature)) {
    if (ctx.platformStates.get(feature.key) === false) return { enabled: false, source: 'platform' };

    const override = ctx.overrides.get(feature.key);
    if (override?.effect === 'revoke') return { enabled: false, source: 'override', detail: { effect: 'revoke' } };
    if (override?.effect === 'restrict' && override.expiresAt && override.expiresAt.getTime() > now.getTime()) {
      return { enabled: false, source: 'override', detail: { effect: 'restrict', expiresAt: override.expiresAt.toISOString() } };
    }
    if (override?.effect === 'grant') return { enabled: true, source: 'override', detail: { effect: 'grant' } };
  }

  if (feature.planControlled && ctx.planEntitlements) {
    const planValue = ctx.planEntitlements.get(feature.key);
    if (planValue !== undefined) return { enabled: planValue, source: 'plan' };
  }

  const roleValue = ctx.roleDefaults.get(feature.key);
  if (roleValue === undefined) return { enabled: false, source: 'role_default', detail: { missing: true } };
  return { enabled: roleValue, source: 'role_default' };
}

function evaluateWithDependencies(
  featureKey: string,
  ctx: EntitlementContext,
  now: Date,
  visiting: Set<string>,
): EntitlementDecision {
  if (ctx.partnerRole === null) return { enabled: true, source: 'not_partner' };
  const feature = featureByKey(featureKey);
  if (!feature) return { enabled: false, source: 'unknown' };
  if (feature.deprecated) return { enabled: false, source: 'deprecated', detail: { replacedBy: feature.deprecated.replacedBy } };

  const base = evaluateBase(feature, ctx, now);
  if (!base.enabled || !feature.requires?.length) return base;

  visiting.add(featureKey);
  for (const dep of feature.requires) {
    // The registry graph is acyclic (asserted by the probes); the guard only
    // keeps a future mistake from recursing forever — a cycle denies.
    if (visiting.has(dep)) return { enabled: false, source: 'dependency', detail: { requires: dep, cycle: true } };
    const depDecision = evaluateWithDependencies(dep, ctx, now, visiting);
    if (!depDecision.enabled) {
      return { enabled: false, source: 'dependency', detail: { requires: dep, dependencySource: depDecision.source } };
    }
  }
  visiting.delete(featureKey);
  return base;
}

export function evaluateFeature(featureKey: string, ctx: EntitlementContext, now: Date = new Date()): EntitlementDecision {
  return evaluateWithDependencies(featureKey, ctx, now, new Set());
}
