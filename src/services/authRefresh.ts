// Shared silent-refresh helper for admin service modules. The access token
// lives in localStorage and a long-lived dashboard tab can outlive it; on a
// 401 we try one refresh via the httpOnly refresh cookie and retry before
// surfacing a raw "expired token" error the user has no way to act on -- the
// fix from their side is always just "log in again", so do that part for
// them when possible. Mirrors the equivalent fix already applied to
// choosify-web/src/services/operationsApi.ts.
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
export const AUTH_TOKEN_KEY = 'choosify_auth_token';

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function persistAccessToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

// Refresh is reactive only: call after a 401, never proactively/on a timer.
export async function refreshAccessToken(): Promise<string | null> {
  console.info('[Auth] 401 received — attempting token refresh');
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      console.warn('[Auth] Refresh failed', { status: response.status });
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as { accessToken?: string };
    if (!data.accessToken) {
      console.warn('[Auth] Refresh response missing accessToken');
      return null;
    }
    persistAccessToken(data.accessToken);
    console.info('[Auth] Token refreshed successfully');
    return data.accessToken;
  } catch (error) {
    console.warn('[Auth] Refresh request threw', error);
    return null;
  }
}

/**
 * Window event fired when any API answers 403 FEATURE_ENTITLEMENT_DENIED.
 * EntitlementsContext listens and refetches /entitlements/me so the UI can show
 * the FeatureUnavailable state instead of silently redirecting.
 */
export const FEATURE_ENTITLEMENT_DENIED_EVENT = 'choosify:feature-entitlement-denied';

export type FeatureEntitlementDeniedDetail = { featureKey?: string };

export function reportFeatureEntitlementDenied(status: number, rawBody: string): void {
  if (status !== 403 || !rawBody || typeof window === 'undefined') return;
  try {
    const parsed = JSON.parse(rawBody) as { code?: string; featureKey?: string };
    if (parsed.code !== 'FEATURE_ENTITLEMENT_DENIED') return;
    window.dispatchEvent(
      new CustomEvent<FeatureEntitlementDeniedDetail>(FEATURE_ENTITLEMENT_DENIED_EVENT, {
        detail: { featureKey: parsed.featureKey },
      }),
    );
  } catch {
    // Not JSON — not an entitlement denial.
  }
}

/**
 * fetch() with the stored access token and one silent refresh-and-retry on 401.
 * For callers that need the raw Response (status + body) rather than a
 * service-module request<T>() helper.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const withToken = (token: string | null): RequestInit => {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
  };
  const token = getStoredAccessToken();
  let response = await fetch(url, withToken(token));
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await fetch(url, withToken(refreshed));
  }
  if (response.status === 403) {
    reportFeatureEntitlementDenied(403, await response.clone().text().catch(() => ''));
  }
  return response;
}
