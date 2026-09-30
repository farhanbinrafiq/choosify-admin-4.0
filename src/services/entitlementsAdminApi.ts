// Typed client for the Phase 2B entitlement control APIs
// (/api/v1/entitlements/admin/{accounts,platform-states,audit}). Reads are
// Admin + Super Admin, writes are Super Admin only — the server is the
// authority; this module only transports and never fabricates state.
import { authedFetch } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
type HttpMethod = 'GET' | 'PUT' | 'DELETE';

/** A failed entitlement admin call: keeps the HTTP status and the server's error code. */
export class EntitlementsAdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'EntitlementsAdminApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    // Refresh-aware: an expired access token is refreshed once and the call retried.
    response = await authedFetch(`${API_BASE}${path}`, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new EntitlementsAdminApiError(
      error instanceof Error ? `Network error: ${error.message}` : 'Network error',
      0,
      'NETWORK_ERROR',
    );
  }
  const raw = await response.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON body (proxy error page etc.) — handled below.
  }
  if (!response.ok) {
    const message =
      typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message
          : `Request failed (${response.status})`;
    throw new EntitlementsAdminApiError(message, response.status, typeof parsed.code === 'string' ? parsed.code : undefined);
  }
  return parsed as T;
}

/** Human-readable message for a failed call; `subject` names what was being loaded or changed. */
export function describeEntitlementsAdminError(error: unknown, subject: string): string {
  if (error instanceof EntitlementsAdminApiError) {
    if (error.status === 401) return `Your session has expired. Sign in again to view ${subject}.`;
    if (error.status === 403) return `You do not have permission for ${subject}.`;
    if (error.status === 503 || error.code === 'ENTITLEMENT_CHECK_UNAVAILABLE') {
      return `${subject[0].toUpperCase()}${subject.slice(1)} is temporarily unavailable. Please retry shortly.`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : `Failed to load ${subject}.`;
}

// ─── Types (mirror server/entitlements/entitlementAdminStore.ts responses) ───

export type EntitlementSource =
  | 'not_partner'
  | 'unknown'
  | 'deprecated'
  | 'role_ineligible'
  | 'core'
  | 'platform'
  | 'override'
  | 'plan'
  | 'role_default'
  | 'dependency';

export type OverrideEffect = 'grant' | 'revoke' | 'restrict';

export type EntitlementDecisionView = {
  enabled: boolean;
  source: EntitlementSource;
  detail?: Record<string, unknown>;
};

export type AccountEntitlementRow = EntitlementDecisionView & {
  featureKey: string;
  label: string;
  tier: string;
  planControlled: boolean;
};

export type AccountOverrideRow = {
  featureKey: string;
  effect: OverrideEffect;
  expiresAt: string | null;
  /** false for a temporary restriction whose expiry has passed (kept, but no longer applied). */
  active: boolean;
  reason: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
};

export type AccountEntitlementSummary = {
  account: {
    userId: string;
    email: string;
    displayName: string | null;
    choosifyUserId: string | null;
    role: string;
    partnerRole: 'seller' | 'creator' | null;
  };
  overrides: AccountOverrideRow[];
  entitlements: AccountEntitlementRow[];
  note?: string;
};

export type PlatformFeatureState = {
  featureKey: string;
  label: string;
  tier: string;
  planControlled: boolean;
  roles: string[];
  enabled: boolean;
  /** false = no stored row (reported as enabled). */
  explicit: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type AuditPerson = {
  userId: string;
  displayName?: string | null;
  choosifyUserId?: string | null;
  email?: string | null;
};

export type EntitlementAuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  source: string;
  targetScope: 'role' | 'account' | 'platform' | string;
  targetRole: string | null;
  featureKey: string | null;
  previousState: unknown;
  newState: unknown;
  reason: string | null;
  actor: AuditPerson | null;
  realActor: AuditPerson | null;
  target: AuditPerson | null;
};

export type EntitlementAuditPage = { events: EntitlementAuditEvent[]; nextBefore: string | null };

const enc = encodeURIComponent;

export const entitlementsAdminApi = {
  // ── Accounts (read: Admin+, write: Super Admin) ──
  getAccount: (userId: string) =>
    request<AccountEntitlementSummary & { success: boolean }>(`/entitlements/admin/accounts/${enc(userId)}`),
  setAccountOverride: (
    userId: string,
    featureKey: string,
    input: { effect: OverrideEffect; reason: string; expiresAt?: string | null },
  ) =>
    request<{
      success: boolean;
      changed: boolean;
      override: Omit<AccountOverrideRow, 'active' | 'createdAt' | 'createdByUserId' | 'updatedByUserId'> | null;
      decision: EntitlementDecisionView;
    }>(`/entitlements/admin/accounts/${enc(userId)}/overrides/${enc(featureKey)}`, 'PUT', input),
  removeAccountOverride: (userId: string, featureKey: string, reason: string) =>
    request<{ success: boolean; changed: boolean }>(
      `/entitlements/admin/accounts/${enc(userId)}/overrides/${enc(featureKey)}`,
      'DELETE',
      { reason },
    ),

  // ── Platform switches (read: Admin+, write: Super Admin) ──
  listPlatformStates: () => request<{ success: boolean; states: PlatformFeatureState[] }>('/entitlements/admin/platform-states'),
  getPlatformState: (featureKey: string) =>
    request<{ success: boolean; state: PlatformFeatureState }>(`/entitlements/admin/platform-states/${enc(featureKey)}`),
  setPlatformState: (featureKey: string, input: { enabled: boolean; reason?: string | null }) =>
    request<{ success: boolean; changed: boolean; state: PlatformFeatureState }>(
      `/entitlements/admin/platform-states/${enc(featureKey)}`,
      'PUT',
      input,
    ),

  // ── Audit history (read-only; there is no write route) ──
  listAudit: (filter: { userId?: string; featureKey?: string; before?: string | null; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (filter.userId) params.set('userId', filter.userId);
    if (filter.featureKey) params.set('featureKey', filter.featureKey);
    if (filter.before) params.set('before', filter.before);
    if (filter.limit) params.set('limit', String(filter.limit));
    const qs = params.toString();
    return request<EntitlementAuditPage & { success: boolean }>(`/entitlements/admin/audit${qs ? `?${qs}` : ''}`);
  },
};
