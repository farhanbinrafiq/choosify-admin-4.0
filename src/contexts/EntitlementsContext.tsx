import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  featureKeysForRole,
  pageKeysDisabledByFeatures,
  type PartnerRole,
} from '../../shared/entitlements/registry';

const AUTH_TOKEN_KEY = 'choosify_auth_token';
const API_BASE = '/api/v1';

type EntitlementsContextValue = {
  loading: boolean;
  entitlements: Record<string, boolean>;
  refresh: () => Promise<void>;
  isFeatureEnabled: (featureKey: string) => boolean;
  /** Role allowlist ∩ entitlement-disabled pages. null = unrestricted (admin). */
  filterAllowedPageKeys: (roleKeys: string[] | null) => string[] | null;
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
  loading: false,
  entitlements: {},
  refresh: async () => {},
  isFeatureEnabled: () => true,
  filterAllowedPageKeys: (keys) => keys,
});

export function useEntitlements() {
  return useContext(EntitlementsContext);
}

function partnerRoleOf(role: string | undefined | null): PartnerRole | null {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  return null;
}

/** Fail-closed placeholder when /entitlements/me cannot be loaded for a partner. */
function deniedAllForRole(role: PartnerRole): Record<string, boolean> {
  return Object.fromEntries(featureKeysForRole(role).map((k) => [k, false]));
}

export const EntitlementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entitlements, setEntitlements] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const partnerRole = partnerRoleOf(profile?.role);
    if (!partnerRole) {
      setEntitlements({});
      return;
    }
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setEntitlements({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/entitlements/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        entitlements?: Record<string, boolean>;
      };
      if (res.ok && body.entitlements) {
        setEntitlements(body.entitlements);
      } else {
        // Do not fail-open (empty {}) — that re-shows disabled nav items.
        setEntitlements(deniedAllForRole(partnerRole));
      }
    } catch {
      setEntitlements(deniedAllForRole(partnerRole));
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFeatureEnabled = useCallback(
    (featureKey: string) => {
      const partnerRole = partnerRoleOf(profile?.role);
      if (!partnerRole) return true;
      if (!(featureKey in entitlements)) return false;
      return Boolean(entitlements[featureKey]);
    },
    [entitlements, profile?.role],
  );

  const filterAllowedPageKeys = useCallback(
    (roleKeys: string[] | null) => {
      if (!roleKeys) return roleKeys;
      const partnerRole = partnerRoleOf(profile?.role);
      if (!partnerRole) return roleKeys;
      // Until first successful entitlement payload, withhold gated pages (fail closed).
      if (!Object.keys(entitlements).length) {
        const disabled = pageKeysDisabledByFeatures(partnerRole, deniedAllForRole(partnerRole));
        return roleKeys.filter((k) => !disabled.has(k));
      }
      const disabled = pageKeysDisabledByFeatures(partnerRole, entitlements);
      if (!disabled.size) return roleKeys;
      return roleKeys.filter((k) => !disabled.has(k));
    },
    [entitlements, profile?.role],
  );

  const value = useMemo(
    () => ({
      loading,
      entitlements,
      refresh,
      isFeatureEnabled,
      filterAllowedPageKeys,
    }),
    [loading, entitlements, refresh, isFeatureEnabled, filterAllowedPageKeys],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};
