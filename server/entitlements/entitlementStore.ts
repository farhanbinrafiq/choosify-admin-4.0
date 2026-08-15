import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { featureEntitlements } from '../db/schema';
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
  roleDefaults: {
    seller: Record<string, boolean>;
    creator: Record<string, boolean>;
  };
  planDefaults: Record<string, Partial<Record<string, boolean>>>;
  accountOverrides: Record<string, Partial<Record<string, boolean>>>;
};

function normalizePartnerRole(role: string | undefined | null): PartnerRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  return null;
}

/** Row lookup helper — 'role' scope keys are seeded with catalog defaults on first read of a role. */
async function getScopeRows(scope: 'role' | 'plan' | 'account', scopeKeys: string[]) {
  if (scopeKeys.length === 0) return [];
  return db
    .select()
    .from(featureEntitlements)
    .where(and(eq(featureEntitlements.scope, scope), inArray(featureEntitlements.scopeKey, scopeKeys)));
}

/** Ensures a role's catalog defaults exist as rows (idempotent — only inserts missing keys). */
async function ensureRoleDefaultsSeeded(role: PartnerRole): Promise<void> {
  const existing = await getScopeRows('role', [role]);
  const existingKeys = new Set(existing.map((r) => r.featureKey));
  const defaults = defaultRoleEntitlements(role);
  const missing = Object.entries(defaults).filter(([key]) => !existingKeys.has(key));
  if (missing.length === 0) return;
  await db
    .insert(featureEntitlements)
    .values(missing.map(([featureKey, enabled]) => ({ scope: 'role' as const, scopeKey: role, featureKey, enabled: Boolean(enabled) })))
    .onConflictDoNothing();
}

/**
 * Precedence: account override -> plan entitlement -> role default.
 * Known partner features without an explicit role-default record are DENIED (fail-closed).
 * Sprint 10 durability migration: reads directly from PostgreSQL on every call (no
 * per-process cache), so a second backend instance always sees the same state.
 */
export async function resolveFeatureEnabled(params: {
  role: string | undefined | null;
  featureKey: string;
  userId?: string | null;
  planId?: string | null;
}): Promise<boolean> {
  const partnerRole = normalizePartnerRole(params.role);
  if (!partnerRole) return true; // Admin / staff / consumer — not gated by partner entitlements

  const feature = featureByKey(params.featureKey);
  if (!feature || !feature.roles.includes(partnerRole)) return true;

  await ensureRoleDefaultsSeeded(partnerRole);

  const uid = params.userId?.trim();
  if (uid) {
    const rows = await getScopeRows('account', [uid]);
    const hit = rows.find((r) => r.featureKey === params.featureKey);
    if (hit) return hit.enabled;
  }

  const planId = params.planId?.trim();
  if (planId) {
    const rows = await getScopeRows('plan', [planId]);
    const hit = rows.find((r) => r.featureKey === params.featureKey);
    if (hit) return hit.enabled;
  }

  const roleRows = await getScopeRows('role', [partnerRole]);
  const roleHit = roleRows.find((r) => r.featureKey === params.featureKey);
  return roleHit ? roleHit.enabled : false;
}

export async function isApiPathEntitled(params: {
  role: string | undefined | null;
  userId?: string | null;
  path: string;
  method?: string;
}): Promise<{ ok: boolean; featureKey?: string }> {
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
    const enabled = await resolveFeatureEnabled({
      role: partnerRole,
      featureKey: feature.key,
      userId: params.userId,
    });
    if (!enabled) return { ok: false, featureKey: feature.key };
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
  const out: Record<string, boolean> = {};
  for (const key of featureKeysForRole(partnerRole)) {
    out[key] = await resolveFeatureEnabled({
      role: partnerRole,
      featureKey: key,
      userId: params.userId,
      planId: params.planId,
    });
  }
  return out;
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
  getRoleDefaults: async (): Promise<EntitlementState['roleDefaults']> => {
    await ensureRoleDefaultsSeeded('seller');
    await ensureRoleDefaultsSeeded('creator');
    const rows = await getScopeRows('role', ['seller', 'creator']);
    const out: EntitlementState['roleDefaults'] = { seller: {}, creator: {} };
    for (const row of rows) {
      if (row.scopeKey === 'seller' || row.scopeKey === 'creator') {
        out[row.scopeKey][row.featureKey] = row.enabled;
      }
    }
    return out;
  },

  setRoleDefault: async (role: PartnerRole, featureKey: PartnerFeatureKey, enabled: boolean): Promise<EntitlementState['roleDefaults']> => {
    if (!featureKeysForRole(role).includes(featureKey)) {
      throw new Error(`Feature ${featureKey} is not available for role ${role}`);
    }
    await ensureRoleDefaultsSeeded(role);
    await db
      .insert(featureEntitlements)
      .values({ scope: 'role', scopeKey: role, featureKey, enabled })
      .onConflictDoUpdate({
        target: [featureEntitlements.scope, featureEntitlements.scopeKey, featureEntitlements.featureKey],
        set: { enabled, updatedAt: new Date() },
      });
    return entitlementStore.getRoleDefaults();
  },

  setRoleDefaultsBulk: async (role: PartnerRole, map: Record<string, boolean>): Promise<EntitlementState['roleDefaults']> => {
    const allowed = new Set(featureKeysForRole(role));
    await ensureRoleDefaultsSeeded(role);
    for (const [k, v] of Object.entries(map)) {
      if (!allowed.has(k as PartnerFeatureKey)) continue;
      await db
        .insert(featureEntitlements)
        .values({ scope: 'role', scopeKey: role, featureKey: k, enabled: Boolean(v) })
        .onConflictDoUpdate({
          target: [featureEntitlements.scope, featureEntitlements.scopeKey, featureEntitlements.featureKey],
          set: { enabled: Boolean(v), updatedAt: new Date() },
        });
    }
    return entitlementStore.getRoleDefaults();
  },

  snapshot: async (): Promise<EntitlementState> => {
    const roleDefaults = await entitlementStore.getRoleDefaults();
    const allRows = await db.select().from(featureEntitlements);
    const planDefaults: EntitlementState['planDefaults'] = {};
    const accountOverrides: EntitlementState['accountOverrides'] = {};
    for (const row of allRows) {
      if (row.scope === 'plan') {
        planDefaults[row.scopeKey] = { ...planDefaults[row.scopeKey], [row.featureKey]: row.enabled };
      } else if (row.scope === 'account') {
        accountOverrides[row.scopeKey] = { ...accountOverrides[row.scopeKey], [row.featureKey]: row.enabled };
      }
    }
    return { roleDefaults, planDefaults, accountOverrides };
  },

  /** Non-destructive: toggles access only — never mutates cashbook/orders/etc. */
  catalog: () => PARTNER_FEATURES.map((f) => ({ ...f })),
};

export type { PartnerFeatureKey, PartnerRole };
