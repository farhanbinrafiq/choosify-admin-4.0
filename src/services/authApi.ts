import { getStoredAccessToken, refreshAccessToken } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function doFetch(path: string, method: HttpMethod, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function request<T>(path: string, method: HttpMethod = 'GET', payload?: unknown): Promise<T> {
  // This module used to read its own token straight from localStorage and
  // never retried a 401 — every other service module (operationsApi.ts,
  // catalogApi.ts, mediaUpload.ts) already goes through authRefresh.ts's
  // shared silent-refresh-on-401 flow, so a long-lived dashboard tab's
  // expired access token surfaced here as a raw "Expired token" error
  // (misread as "Consumer Management has no data") while every other admin
  // page transparently refreshed and kept working. Aligned to the same
  // canonical pattern — no new refresh mechanism, no special-cased retry.
  const token = getStoredAccessToken();
  let response = await doFetch(path, method, token, payload);

  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch(path, method, refreshed, payload);
    }
  }

  const body = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  // GET /auth/me answers unwrapped; every other route wraps in { data }.
  return ('data' in body ? body.data : body) as T;
}

/** Row shape returned by GET /auth/users/directory — see server/authRouter.ts. */
export interface UserDirectoryEntry {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  choosifyUserId?: string | null;
  /** Real uploaded profile photo URL, or null/undefined if none — never a
   *  logo/placeholder. Directory UIs must derive their own initials/neutral
   *  placeholder when this is absent, not persist or expect one here. */
  avatarUrl?: string | null;
  /** Account lifecycle state, when the account is inactive / in deletion / anonymized. */
  lifecycleState?: 'inactive' | 'pending_deletion' | 'anonymized';
  deletionDueAt?: string | null;
  /** Real users.createdAt (registration timestamp) — canonical, not derived. */
  createdAt?: string;
}

/**
 * Detail shape returned by GET /auth/users/:userId — directory fields plus
 * createdAt and the accountStatusPayload() lifecycle/catalog facts (see
 * server/profileStatusFacts.ts). Most of the lifecycle fields only carry
 * meaningful values for partner roles (seller/creator); for a plain
 * consumer they resolve to lifecycle defaults (identityVerified: true,
 * marketplaceAccess: true, etc).
 */
export interface UserDetail extends UserDirectoryEntry {
  createdAt?: string;
  /** Primary account phone (E.164) — admin user-detail endpoint only. */
  phone?: string | null;
  /** Where `phone` came from: the account itself, or the user's partner application. */
  phoneSource?: 'account' | 'partner_application' | null;
  partnerApplicationStatus?: string | null;
  identityVerified?: boolean;
  marketplaceAccess?: boolean;
  partnerApplicationId?: string | null;
  resubmissionRequested?: boolean;
  marketplaceStatus?: string | null;
  verifiedStatus?: boolean;
  claimStatus?: string | null;
  creatorCatalogStatus?: string | null;
  profileStatus?: string;
  profileStatusPrimary?: string;
  profileStatusSecondary?: string | null;
  /** The shopper's saved storefront addresses (admin user-detail endpoint only). */
  addresses?: StoredCustomerAddress[];
  /** Account lifecycle (inactive / in deletion). */
  lifecycle?: AccountLifecycle;
}

export type AccountLifecycleState = 'inactive' | 'pending_deletion' | 'anonymized';
export type AccountLifecycle = {
  state?: AccountLifecycleState;
  reason?: string;
  internalNote?: string;
  requestedBy?: 'self' | 'admin';
  at?: string;
  deletionDueAt?: string;
  history: Array<{
    at: string;
    action: 'deactivated' | 'deletion_requested' | 'reactivated' | 'anonymized';
    by: 'self' | 'admin' | 'login' | 'system';
    actorId?: string;
    actorName?: string;
    reason?: string;
    internalNote?: string;
  }>;
};

/** A storefront address as saved on the account, with a readable summary for staff. */
export type StoredCustomerAddress = {
  id: string;
  label?: string;
  type?: string;
  isDefault?: boolean;
  recipientName?: string;
  phone?: string;
  landmark?: string;
  summary?: string;
  trail?: string;
  [key: string]: unknown;
};

/** Row shape returned by GET /auth/users/search — a single account by Choosify User ID / CF-##### string. */
export interface UserSearchResult {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  choosifyUserId: string;
  avatarUrl?: string | null;
}

export const authApi = {
  /** Admin directory of all registered accounts (uid/email/displayName/role/choosifyUserId only). */
  getUsersDirectory: async (): Promise<UserDirectoryEntry[]> => {
    return request<UserDirectoryEntry[]>('/auth/users/directory');
  },
  /** The signed-in account's own record (GET /auth/me) — e.g. its primary phone. */
  getMyAccount: async (): Promise<{ uid: string; email: string; displayName: string; role: string; choosifyUserId?: string | null; phone?: string | null }> => {
    return request('/auth/me');
  },
  /** Admin lookup of a single account by internal Auth UID. */
  getUserDetail: async (userId: string): Promise<UserDetail> => {
    return request<UserDetail>(`/auth/users/${encodeURIComponent(userId)}`);
  },
  /** Super Admin: account lifecycle (inactive / in deletion / reactivate). */
  deactivateUser: async (userId: string, payload: { reason: string; internalNote?: string }) =>
    request<AccountLifecycle>(`/auth/admin/users/${encodeURIComponent(userId)}/deactivate`, 'POST', payload),
  deleteUser: async (userId: string, payload: { reason: string; internalNote: string }) =>
    request<AccountLifecycle>(`/auth/admin/users/${encodeURIComponent(userId)}/delete`, 'POST', payload),
  reactivateUser: async (userId: string, payload: { note?: string }) =>
    request<AccountLifecycle>(`/auth/admin/users/${encodeURIComponent(userId)}/reactivate`, 'POST', payload),
  /** The signed-in owner: take a break (inactive) / ask to delete (90-day window). */
  deactivateMe: async (reason: string) => request<{ state: string }>('/auth/me/deactivate', 'POST', { reason }),
  requestMyDeletion: async (reason: string) =>
    request<{ state: string; deletionDueAt?: string }>('/auth/me/delete', 'POST', { reason }),
  /** Admin lookup of a single account by Choosify User ID (CF-##### or numeric). Throws if not found. */
  searchUser: async (q: string): Promise<UserSearchResult> => {
    return request<UserSearchResult>(`/auth/users/search?q=${encodeURIComponent(q)}`);
  },
};
