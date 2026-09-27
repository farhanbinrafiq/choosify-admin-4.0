import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { featureByKey, isCoreFeature, type PartnerRole } from '../../shared/entitlements/registry';
import {
  deniedAllForRole,
  filterRolePageKeysByEntitlements,
  type EntitlementNavStatus,
} from '../../shared/entitlements/navFilter';
import {
  authedFetch,
  FEATURE_ENTITLEMENT_DENIED_EVENT,
  getStoredAccessToken,
  type FeatureEntitlementDeniedDetail,
} from '../services/authRefresh';

const API_BASE = '/api/v1';
/** Window-focus refetch is skipped when the map is younger than this (no polling). */
const FOCUS_REFETCH_MIN_AGE_MS = 60_000;

type EntitlementsContextValue = {
  loading: boolean;
  /** How the current entitlement map was obtained — drives nav vs route fail-closed. */
  status: EntitlementNavStatus;
  entitlements: Record<string, boolean>;
  /** Feature key from the most recent FEATURE_ENTITLEMENT_DENIED API response, if any. */
  lastDeniedFeatureKey: string | null;
  refresh: () => Promise<void>;
  isFeatureEnabled: (featureKey: string) => boolean;
  /** Role allowlist ∩ entitlement-disabled pages. null = unrestricted (admin). */
  filterAllowedPageKeys: (roleKeys: string[] | null) => string[] | null;
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
  loading: false,
  status: 'idle',
  entitlements: {},
  lastDeniedFeatureKey: null,
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
  const [lastDeniedFeatureKey, setLastDeniedFeatureKey] = useState<string | null>(null);
  const lastLoadedAt = useRef(0);
  const loadedFor = useRef('');
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    const partnerRole = partnerRoleOf(profile?.role);
    if (!partnerRole) {
      setEntitlements({});
      setStatus('ready');
      setLoading(false);
      return;
    }
    if (!getStoredAccessToken()) {
      // No partner JWT (unauthenticated / pre-login): no entitlement payload.
      // Do NOT persist deny-all — APIs still 401 without a bearer token.
      setEntitlements({});
      setStatus('mock');
      setLoading(false);
      return;
    }
    const identity = `${partnerRole}:${profile?.id || ''}`;
    setLoading(true);
    // Background refetch (focus / denied event) keeps the current map on screen;
    // a new identity (login, account switch) starts from 'loading'.
    if (loadedFor.current !== identity) setStatus('loading');
    try {
      // Refresh-aware: an expired access token is silently refreshed and retried.
      const res = await authedFetch(`${API_BASE}/entitlements/me`);
      const body = (await res.json().catch(() => ({}))) as {
        entitlements?: Record<string, boolean>;
      };
      if (res.ok && body.entitlements) {
        setEntitlements(body.entitlements);
        setStatus('ready');
        lastLoadedAt.current = Date.now();
        loadedFor.current = identity;
      } else {
        // Real partner JWT but resolver failed — fail-closed gated pages/APIs only.
        setEntitlements(deniedAllForRole(partnerRole));
        setStatus('failed');
        loadedFor.current = '';
      }
    } catch {
      setEntitlements(deniedAllForRole(partnerRole));
      setStatus('failed');
      loadedFor.current = '';
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profile?.id]);

  // Coalesce concurrent triggers (focus + denied event + mount) into one request.
  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const p = load().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = p;
    return p;
  }, [load]);

  // Login / logout / role change (profile identity) → refetch.
  useEffect(() => {
    setLastDeniedFeatureKey(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!partnerRoleOf(profile?.role)) return undefined;
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      if (status === 'failed' || Date.now() - lastLoadedAt.current > FOCUS_REFETCH_MIN_AGE_MS) {
        void refresh();
      }
    };
    const onDenied = (event: Event) => {
      const detail = (event as CustomEvent<FeatureEntitlementDeniedDetail>).detail;
      setLastDeniedFeatureKey(detail?.featureKey || null);
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener(FEATURE_ENTITLEMENT_DENIED_EVENT, onDenied);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener(FEATURE_ENTITLEMENT_DENIED_EVENT, onDenied);
    };
  }, [profile?.role, refresh, status]);

  const isFeatureEnabled = useCallback(
    (featureKey: string) => {
      const partnerRole = partnerRoleOf(profile?.role);
      if (!partnerRole) return true;
      // Core capabilities are never switchable, whatever the fetch state.
      if (isCoreFeature(featureByKey(featureKey))) return true;
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
      lastDeniedFeatureKey,
      refresh,
      isFeatureEnabled,
      filterAllowedPageKeys,
    }),
    [loading, status, entitlements, lastDeniedFeatureKey, refresh, isFeatureEnabled, filterAllowedPageKeys],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
};
