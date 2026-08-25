const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(path: string, method: HttpMethod = 'GET'): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { method, headers });
  const body = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body.data as T;
}

/** Row shape returned by GET /auth/users/directory — see server/authRouter.ts. */
export interface UserDirectoryEntry {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  choosifyUserId?: string | null;
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
}

export const authApi = {
  /** Admin directory of all registered accounts (uid/email/displayName/role/choosifyUserId only). */
  getUsersDirectory: async (): Promise<UserDirectoryEntry[]> => {
    return request<UserDirectoryEntry[]>('/auth/users/directory');
  },
  /** Admin lookup of a single account by internal Auth UID. */
  getUserDetail: async (userId: string): Promise<UserDetail> => {
    return request<UserDetail>(`/auth/users/${encodeURIComponent(userId)}`);
  },
};
