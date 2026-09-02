import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import type { PartnerRole } from '../../shared/entitlements/registry';
import {
  deniedAllForRole,
  filterRolePageKeysByEntitlements,
  type EntitlementNavStatus,
} from '../../shared/entitlements/navFilter';

const AUTH_TOKEN_KEY = 'choosify_auth_token';
const API_BASE = '/api/v1';

type EntitlementsContextValue = {
  loading: boolean;
  /** How the current entitlement map was obtained — drives nav vs route fail-closed. */
  status: EntitlementNavStatus;
  entitlements: Record<string, boolean>;
  refresh: () => Promise<void>;
  isFeatureEnabled: (featureKey: string) => boolean;
  /** Role allowlist ∩ entitlement-disabled pages. null = unrestricted (admin). */
  filterAllowedPageKeys: (roleKeys: string[] | null) => string[] | null;
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
  loading: false,
  status: 'idle',
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

export const EntitlementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<EntitlementNavStatus>('idle');
  const [entitlements, setEntitlements] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const partnerRole = partnerRoleOf(profile?.role);
    if (!partnerRole) {
      setEntitlements({});
      setStatus('ready');
      setLoading(false);
      return;
    }
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      // No partner JWT (unauthenticated / pre-login): no entitlement payload.
      // Do NOT persist deny-all — APIs still 401 without a bearer token.
      setEntitlements({});
      setStatus('mock');
      setLoading(false);
      return;
    }
    setLoading(true);
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/entitlements/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        entitlements?: Record<string, boolean>;
      };
      if (res.ok && body.entitlements) {
        setEntitlements(body.entitlements);
        setStatus('ready');
      } else {
        // Real partner JWT but resolver failed — fail-closed gated pages/APIs only.
        setEntitlements(deniedAllForRole(partnerRole));
        setStatus('failed');
      }
    } catch {
      setEntitlements(deniedAllForRole(partnerRole));
      setStatus('failed');
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
      if (status === 'idle' || status === 'mock' || status === 'loading') {
        if (featureKey in entitlements) return Boolean(entitlements[featureKey]);
        return true;
      }
      if (status === 'failed') return false;
      // Successful map: missing key ≠ disabled (core / unmapped features stay on).
      if (!(featureKey in entitlements)) return true;
      return Boolean(entitlements[featureKey]);
    },
    [entitlements, profile?.role, status],
  );

  const filterAllowedPageKeys = useCallback(
    (roleKeys: string[] | null) =>
      filterRolePageKeysByEntitlements({
        roleKeys,
        partnerRole: partnerRoleOf(profile?.role),
        entitlements,
        status,
      }),
    [entitlements, profile?.role, status],
  );

  const value = useMemo(
    () => ({
      loading,
      status,
      entitlements,
      refresh,
      isFeatureEnabled,
      filterAllowedPageKeys,
    }),
    [loading, status, entitlements, refresh, isFeatureEnabled, filterAllowedPageKeys],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};
