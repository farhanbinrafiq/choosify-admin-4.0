// Typed client for the Public Identity handle lifecycle API
// (server/publicHandles/publicHandlesRouter.ts). Reads are Admin + Super Admin,
// every write is Super Admin only and refused during impersonation — the server
// is the authority; this module only transports and never fabricates state.
// Reserve / release are deliberately not exposed here (API-only operations).
import { authedFetch } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
type HttpMethod = 'GET' | 'POST';

export type HandleEntityType = 'brand' | 'creator';

/** A failed handle API call: keeps the HTTP status, the server's error code and the validator reason. */
export class PublicHandlesApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly reason?: string;
  readonly marketplaceStatus?: string;

  constructor(message: string, status: number, code?: string, reason?: string, marketplaceStatus?: string) {
    super(message);
    this.name = 'PublicHandlesApiError';
    this.status = status;
    this.code = code;
    this.reason = reason;
    this.marketplaceStatus = marketplaceStatus;
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
    throw new PublicHandlesApiError(
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
      typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error : `Request failed (${response.status})`;
    throw new PublicHandlesApiError(
      message,
      response.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
      typeof parsed.reason === 'string' ? parsed.reason : undefined,
      typeof parsed.marketplaceStatus === 'string' ? parsed.marketplaceStatus : undefined,
    );
  }
  return parsed as T;
}

// ─── Error descriptions ─────────────────────────────────────────────────────

const VALIDATION_REASONS: Record<string, string> = {
  empty: 'Enter a handle.',
  too_short: 'A handle needs at least 3 characters.',
  too_long: 'A handle can have at most 30 characters.',
  non_ascii: 'Use only English letters (a–z), digits and hyphens.',
  invalid_characters: 'Use only lowercase letters, digits and single hyphens.',
  must_start_with_letter: 'A handle must start with a letter.',
  leading_or_trailing_hyphen: 'A handle cannot start or end with a hyphen.',
  consecutive_hyphens: 'A handle cannot contain two hyphens in a row.',
  reserved: 'That name is reserved by Choosify.',
  reserved_prefix: 'Handles cannot start with brand-, creator- or prod-.',
  current_handle: 'That is already the current handle.',
  namespace_conflict: 'That is already the URL of another profile.',
  taken: 'That handle belongs to another profile.',
  retired: 'That handle was used before and can never be reissued.',
  reserved_handle: 'That handle is reserved.',
  unavailable: 'That handle is not available.',
};

/** Human-readable explanation for an availability / validation reason. */
export function describeHandleReason(reason: string | undefined): string {
  if (!reason) return 'That handle is not available.';
  if (reason === 'reserved') return VALIDATION_REASONS.reserved;
  return VALIDATION_REASONS[reason] || 'That handle is not available.';
}

const CODE_MESSAGES: Record<string, string> = {
  HANDLE_REQUEST_NOT_PENDING: 'This request has already been decided (perhaps by another reviewer). Refresh to see its outcome.',
  HANDLE_REQUESTER_NOT_OWNER: 'The requester no longer owns this profile, so the request was closed as superseded. Nothing was changed.',
  HANDLE_OWNER_SUSPENDED:
    'This Brand’s marketplace access is suspended, revoked or restricted, so the request cannot be approved now. It stays pending.',
  HANDLE_UNAVAILABLE: 'That handle is not available (taken, retired or reserved). Nothing was changed.',
  HANDLE_NAMESPACE_CONFLICT: 'That handle is already the URL of another profile. Nothing was changed.',
  HANDLE_NO_CHANGE: 'That is already the current handle.',
  HANDLE_ENTITY_NOT_FOUND: 'This profile no longer exists in the catalog.',
  HANDLE_CONFLICT: 'The handle changed at the same time; nothing was saved. Refresh and try again.',
  HANDLES_UNAVAILABLE: 'Public handles are temporarily unavailable. Nothing was changed; please retry shortly.',
  HANDLE_NOTE_REQUIRED: 'A note explaining the rejection is required.',
  HANDLE_NOTE_TOO_LONG: 'The note can have at most 1000 characters.',
  HANDLE_REASON_REQUIRED: 'A reason is required.',
  HANDLE_ALREADY_ASSIGNED: 'This profile already has a handle — use Rename instead.',
  HANDLE_NOT_ASSIGNED: 'This profile has no active handle.',
  HANDLE_REQUEST_NOT_FOUND: 'This handle request no longer exists.',
  HANDLE_IMPERSONATION_NOT_ALLOWED: 'Handle management is not available while impersonating an account.',
  HANDLE_FORBIDDEN: 'You do not have permission for this profile’s handle.',
  HANDLE_PENDING_EXISTS: 'A handle request is already pending for this profile.',
  HANDLE_INVALID_ENTITY_TYPE: 'Only Brands and Creators have public handles.',
  HANDLE_INVALID_ENTITY_ID: 'This profile id is not valid.',
  HANDLE_INVALID_FILTER: 'That filter is not supported.',
  HANDLE_NOT_FOUND: 'Handle not found.',
  HANDLE_NOT_RESERVED: 'Only a reserved handle can be released.',
  HANDLE_SLUG_LOCKED: 'This profile has a public handle, so its slug can only be changed by a Super Admin.',
};

/** Human-readable message for a failed call; `subject` names what was being loaded or changed. */
export function describePublicHandlesError(error: unknown, subject: string): string {
  if (error instanceof PublicHandlesApiError) {
    if (error.code === 'HANDLE_INVALID') return describeHandleReason(error.reason);
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
    if (error.status === 401) return `Your session has expired. Sign in again to view ${subject}.`;
    if (error.status === 403) return `You do not have permission for ${subject}.`;
    if (error.status === 0) return `Could not reach the server for ${subject}. Check the connection and retry.`;
    if (error.status >= 500) return `${subject[0].toUpperCase()}${subject.slice(1)} is temporarily unavailable. Please retry shortly.`;
    return error.message;
  }
  return error instanceof Error ? error.message : `Failed to load ${subject}.`;
}

// ─── Types (mirror server/publicHandles/publicHandleStore.ts rows) ──────────

export type HandleRow = {
  id: string;
  handle: string;
  entityType: HandleEntityType | 'reserved';
  entityId: string | null;
  status: 'active' | 'retired' | 'reserved';
  createdAt: string;
  retiredAt: string | null;
  createdByUserId: string | null;
};

export type HandleRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'superseded';

export type HandleRequestRow = {
  id: string;
  entityType: HandleEntityType;
  entityId: string;
  requestedHandle: string;
  status: HandleRequestStatus;
  requestedByUserId: string;
  requestedRealActorUserId: string | null;
  decidedByUserId: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type HandleEventAction =
  | 'assigned'
  | 'renamed'
  | 'retired'
  | 'reserved'
  | 'reserved_assigned'
  | 'released'
  | 'request_submitted'
  | 'request_approved'
  | 'request_rejected'
  | 'request_cancelled'
  | 'request_superseded';

export type HandleEventRow = {
  id: string;
  action: HandleEventAction;
  entityType: HandleEntityType | null;
  entityId: string | null;
  fromHandle: string | null;
  toHandle: string | null;
  requestId: string | null;
  actorUserId: string | null;
  realActorUserId: string | null;
  reason: string | null;
  createdAt: string;
};

export type EntityHandleState = {
  entityType: HandleEntityType;
  entityId: string;
  activeHandle: HandleRow | null;
  handles: HandleRow[];
  pendingRequest: HandleRequestRow | null;
  requests: HandleRequestRow[];
  events: HandleEventRow[];
  entityExists: boolean;
};

export type HandleAvailability = {
  handle: string;
  available: boolean;
  reason?: string;
};

export type ApprovalResult = { request: HandleRequestRow; handle: HandleRow; previousHandle: string | null };
export type DirectSetResult = { handle: HandleRow; previousHandle: string | null };

type Envelope<T> = { success: boolean; data: T };
const q = (params: Record<string, string | number | undefined | null>) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  const s = usp.toString();
  return s ? `?${s}` : '';
};

export const publicHandlesAdminApi = {
  /** Active handle, every handle row, requests and history of one Brand / Creator (Admin read). */
  getEntityState: async (entityType: HandleEntityType, entityId: string): Promise<EntityHandleState> =>
    (await request<Envelope<EntityHandleState>>(`/public-handles/${entityType}/${encodeURIComponent(entityId)}`)).data,

  /** Request queue; `status: 'pending'` comes back oldest first. */
  listRequests: async (filter: { status?: HandleRequestStatus; entityType?: HandleEntityType; entityId?: string; limit?: number } = {}) =>
    (await request<Envelope<HandleRequestRow[]>>(`/public-handles/admin/requests${q(filter)}`)).data,

  listEvents: async (filter: { entityType?: HandleEntityType; entityId?: string; handle?: string; limit?: number } = {}) =>
    (await request<Envelope<HandleEventRow[]>>(`/public-handles/admin/events${q(filter)}`)).data,

  /** Availability for a specific profile (its own current handle / slug are recognised). */
  checkAvailability: async (entityType: HandleEntityType, handle: string, entityId?: string): Promise<HandleAvailability> =>
    (await request<Envelope<HandleAvailability>>(`/catalog/handles/availability${q({ type: entityType, handle, entityId })}`)).data,

  approveRequest: async (requestId: string, note?: string): Promise<ApprovalResult> =>
    (await request<Envelope<ApprovalResult>>(`/public-handles/admin/requests/${encodeURIComponent(requestId)}/approve`, 'POST', note ? { note } : {})).data,

  rejectRequest: async (requestId: string, note: string): Promise<HandleRequestRow> =>
    (await request<Envelope<HandleRequestRow>>(`/public-handles/admin/requests/${encodeURIComponent(requestId)}/reject`, 'POST', { note })).data,

  assign: async (input: { entityType: HandleEntityType; entityId: string; handle: string; reason: string }): Promise<DirectSetResult> =>
    (await request<Envelope<DirectSetResult>>('/public-handles/admin/assign', 'POST', input)).data,

  rename: async (input: { entityType: HandleEntityType; entityId: string; handle: string; reason: string }): Promise<DirectSetResult> =>
    (await request<Envelope<DirectSetResult>>('/public-handles/admin/rename', 'POST', input)).data,

  retire: async (input: { entityType: HandleEntityType; entityId: string; reason: string }): Promise<HandleRow> =>
    (await request<Envelope<HandleRow>>('/public-handles/admin/retire', 'POST', input)).data,
};
