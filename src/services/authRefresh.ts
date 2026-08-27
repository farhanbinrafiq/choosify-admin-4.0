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
