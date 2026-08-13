/**
 * Role allowlist ∩ entitlement state for partner navigation.
 *
 * Classification:
 * - CORE role nav: page keys with no PARTNER_FEATURES mapping — never hidden by entitlements
 * - ENTITLEMENT-CONTROLLED nav: hidden only when enabled[featureKey] === false
 *
 * Missing / undefined entitlement keys are NOT treated as false (that previously
 * wiped unrelated sidebar items). Fail-closed applies only after a real partner
 * JWT fetch fails — never during loading or mock (no-token) QA sessions.
 */

import {
  featureKeysForRole,
  pageKeysDisabledByFeatures,
  type PartnerRole,
} from './registry';

export type EntitlementNavStatus = 'idle' | 'mock' | 'loading' | 'ready' | 'failed';

export function deniedAllForRole(role: PartnerRole): Record<string, boolean> {
  return Object.fromEntries(featureKeysForRole(role).map((k) => [k, false]));
}

export function filterRolePageKeysByEntitlements(params: {
  roleKeys: string[] | null;
  partnerRole: PartnerRole | null;
  entitlements: Record<string, boolean>;
  status: EntitlementNavStatus;
}): string[] | null {
  const { roleKeys, partnerRole, entitlements, status } = params;
  if (!roleKeys) return roleKeys;
  if (!partnerRole) return roleKeys;

  // Mock (TempRoleSwitcher, no JWT) and in-flight fetch: keep the role tree.
  // APIs remain 401/fail-closed without a partner token.
  if (status === 'idle' || status === 'mock' || status === 'loading') {
    return roleKeys;
  }

  const map = status === 'failed' ? deniedAllForRole(partnerRole) : entitlements;
  const disabled = pageKeysDisabledByFeatures(partnerRole, map);
  if (!disabled.size) return roleKeys;
  return roleKeys.filter((k) => !disabled.has(k));
}
