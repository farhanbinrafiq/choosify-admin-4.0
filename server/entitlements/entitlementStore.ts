import { randomUUID } from 'node:crypto';
import {
  defaultRoleEntitlements,
  featureByKey,
  featureKeysForRole,
  pageKeysDisabledByFeatures,
  type PartnerFeatureKey,
  type PartnerRole,
  PARTNER_FEATURES,
} from '../../shared/entitlements/registry';

export type EntitlementState = {
  /** Role-level defaults (commercial partners only). */
  roleDefaults: {
    seller: Record<string, boolean>;
    creator: Record<string, boolean>;
  };
  /**
   * Future: subscription/plan defaults keyed by planId.
   * Present now so the model does not need replacement when billing ships.
   */
  planDefaults: Record<string, Partial<Record<string, boolean>>>;
  /**
   * Future: per-account overrides (true/false) keyed by userId.
   * Precedence: account override → plan → role default.
   */
  accountOverrides: Record<string, Partial<Record<string, boolean>>>;
};

function buildDefaults(): EntitlementState {
  return {
    roleDefaults: {
      seller: { ...defaultRoleEntitlements('seller') },
      creator: { ...defaultRoleEntitlements('creator') },
    },
    planDefaults: {},
    accountOverrides: {},
  };
}

let state: EntitlementState = buildDefaults();
let persistHook: (() => void) | null = null;

const touch = () => persistHook?.();

function normalizePartnerRole(role: string | undefined | null): PartnerRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  return null;
}

/**
 * Precedence: account override → plan entitlement → role default.
 * Known partner features without an explicit role-default record are DENIED (fail-closed).
 * Hydration always merges catalog defaults first so role maps stay complete.
 */
export function resolveFeatureEnabled(params: {
  role: string | undefined | null;
  featureKey: string;
  userId?: string | null;
  planId?: string | null;
}): boolean {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return true; // Admin / staff / consumer — not gated by partner entitlements

  const feature = featureByKey(params.featureKey);
  if (!feature || !feature.roles.includes(partnerRole)) return true;

  const uid = params.userId?.trim();
  if (uid && state.accountOverrides[uid] && params.featureKey in state.accountOverrides[uid]) {
    return Boolean(state.accountOverrides[uid][params.featureKey]);
  }

  const planId = params.planId?.trim();
  if (planId && state.planDefaults[planId] && params.featureKey in state.planDefaults[planId]) {
    return Boolean(state.planDefaults[planId][params.featureKey]);
  }

  const roleMap = state.roleDefaults[partnerRole];
  if (params.featureKey in roleMap) return Boolean(roleMap[params.featureKey]);
  return false;
}

export function isApiPathEntitled(params: {
  role: string | undefined | null;
  userId?: string | null;
  path: string;
  method?: string;
}): { ok: boolean; featureKey?: string } {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return { ok: true };

  const path = params.path.split('?')[0] || '';
  const method = String(params.method || 'GET').toUpperCase();
  for (const feature of PARTNER_FEATURES) {
    if (!feature.roles.includes(partnerRole)) continue;
    if (!feature.apiPrefixes.length) continue;
    if (feature.apiMethods?.length && !feature.apiMethods.includes(method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')) {
      continue;
    }
    const hit = feature.apiPrefixes.some(
      (prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix),
    );
    if (!hit) continue;
    const enabled = resolveFeatureEnabled({
      role: partnerRole,
      featureKey: feature.key,
      userId: params.userId,
    });
    if (!enabled) return { ok: false, featureKey: feature.key };
  }
  return { ok: true };
}

export function getEnabledMapForActor(params: {
  role: string | undefined | null;
  userId?: string | null;
  planId?: string | null;
}): Record<string, boolean> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return {};
  const out: Record<string, boolean> = {};
  for (const key of featureKeysForRole(partnerRole)) {
    out[key] = resolveFeatureEnabled({
      role: partnerRole,
      featureKey: key,
      userId: params.userId,
      planId: params.planId,
    });
  }
  return out;
}

export function filterPageKeysForEntitlements(
  role: string | undefined | null,
  pageKeys: string[] | null,
  userId?: string | null,
): string[] | null {
  if (!pageKeys) return pageKeys;
  const partnerRole = normalizePartnerRole(role);
  if (!partnerRole) return pageKeys;
  const enabled = getEnabledMapForActor({ role: partnerRole, userId });
  const disabledPages = pageKeysDisabledByFeatures(partnerRole, enabled);
  if (!disabledPages.size) return pageKeys;
  return pageKeys.filter((k) => !disabledPages.has(k));
}

export const entitlementStore = {
  setPersistHook: (hook: (() => void) | null) => {
    persistHook = hook;
  },

  hydrate: (snapshot: Partial<EntitlementState> | null | undefined) => {
    if (!snapshot) return;
    const next = buildDefaults();
    if (snapshot.roleDefaults?.seller) {
      next.roleDefaults.seller = { ...next.roleDefaults.seller, ...snapshot.roleDefaults.seller };
    }
    if (snapshot.roleDefaults?.creator) {
      next.roleDefaults.creator = { ...next.roleDefaults.creator, ...snapshot.roleDefaults.creator };
    }
    if (snapshot.planDefaults) next.planDefaults = { ...snapshot.planDefaults };
    if (snapshot.accountOverrides) next.accountOverrides = { ...snapshot.accountOverrides };
    state = next;
  },

  snapshot: (): EntitlementState => structuredClone(state),

  getRoleDefaults: () => structuredClone(state.roleDefaults),

  setRoleDefault: (role: PartnerRole, featureKey: PartnerFeatureKey, enabled: boolean) => {
    if (!featureKeysForRole(role).includes(featureKey)) {
      throw new Error(`Feature ${featureKey} is not available for role ${role}`);
    }
    state.roleDefaults[role] = { ...state.roleDefaults[role], [featureKey]: enabled };
    touch();
    return structuredClone(state.roleDefaults);
  },

  setRoleDefaultsBulk: (role: PartnerRole, map: Record<string, boolean>) => {
    const allowed = new Set(featureKeysForRole(role));
    const next = { ...state.roleDefaults[role] };
    for (const [k, v] of Object.entries(map)) {
      if (allowed.has(k as PartnerFeatureKey)) next[k] = Boolean(v);
    }
    state.roleDefaults[role] = next;
    touch();
    return structuredClone(state.roleDefaults);
  },

  /** Non-destructive: toggles access only — never mutates cashbook/orders/etc. */
  catalog: () => PARTNER_FEATURES.map((f) => ({ ...f })),
};

export type { PartnerFeatureKey, PartnerRole };
