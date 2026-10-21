/**
 * Account details (display name / username / phone) — PATCH /auth/profile.
 * Self-edit omits `userId`; staff editing another account passes `userId`
 * (the server allows it for admin roles only, enforces the 90-day name lock
 * unless `adminOverride`, normalizes phone, and records activity + audit).
 */
const API_BASE = ((import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

export type AccountDetailsPatch = {
  displayName?: string;
  username?: string;
  phone?: string | null;
};

export type AccountDetails = {
  displayName: string;
  username: string;
  phone: string;
};

function headers(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; data?: T } & Record<string, unknown>;
  if (!res.ok) throw new Error(body.error || body.message || fallback);
  return (body.data ?? body) as T;
}

export const profileApi = {
  /** Current values: the signed-in account (no userId) or, for staff, another account. */
  getAccountDetails: async (userId?: string): Promise<AccountDetails> => {
    const res = userId
      ? await fetch(`${API_BASE}/auth/users/${encodeURIComponent(userId)}`, { headers: headers(), credentials: 'include' })
      : await fetch(`${API_BASE}/auth/me`, { headers: headers(), credentials: 'include' });
    const d = await parse<{ displayName?: string; username?: string; phone?: string | null }>(res, 'Could not load account details');
    return { displayName: d.displayName || '', username: d.username || '', phone: d.phone || '' };
  },

  updateAccountDetails: async (patch: AccountDetailsPatch, opts?: { userId?: string; adminOverride?: boolean }) => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PATCH',
      headers: headers(),
      credentials: 'include',
      body: JSON.stringify({
        ...patch,
        ...(opts?.userId ? { userId: opts.userId } : {}),
        ...(opts?.adminOverride ? { adminOverride: true } : {}),
      }),
    });
    return parse<Record<string, unknown>>(res, 'Could not save account details');
  },
};
