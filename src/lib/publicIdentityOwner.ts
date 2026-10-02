// Public Identity — owner-facing (Brand Studio / Creator Studio) presentation
// logic. Pure: no React, no network. Validation is the shared contract
// (shared/publicHandles/rules.ts) — this module only turns its reasons and the
// lifecycle API's states and error codes into the words an owner reads.
import { validateHandle, HANDLE_MIN_LENGTH, HANDLE_MAX_LENGTH, type HandleRejection } from '../../shared/publicHandles/rules';

export type OwnerEntityType = 'brand' | 'creator';

/** One request row as returned by GET /public-handles/:type/:id (server publicHandleStore). */
export type OwnerHandleRequest = {
  id: string;
  entityType: OwnerEntityType;
  entityId: string;
  requestedHandle: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'superseded';
  requestedByUserId: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type OwnerHandleState = {
  entityType: OwnerEntityType;
  entityId: string;
  activeHandle: { handle: string } | null;
  pendingRequest: OwnerHandleRequest | null;
  requests: OwnerHandleRequest[];
  entityExists: boolean;
};

/** Availability answer of GET /catalog/handles/availability (owners get `unavailable`, never taken/retired detail). */
export type OwnerAvailability = { handle: string; available: boolean; reason?: string };

export type AvailabilityVerdict = 'available' | 'current' | 'reserved' | 'invalid' | 'unavailable';

export const USERNAME_RULES_TEXT = `${HANDLE_MIN_LENGTH}–${HANDLE_MAX_LENGTH} characters: lowercase English letters (a–z), digits and single hyphens between words; must start with a letter.`;

const INVALID_TEXT: Record<Exclude<HandleRejection, 'reserved' | 'reserved_prefix'>, string> = {
  empty: 'Enter a username.',
  too_short: `A username needs at least ${HANDLE_MIN_LENGTH} characters.`,
  too_long: `A username can have at most ${HANDLE_MAX_LENGTH} characters.`,
  non_ascii: 'Usernames use only English letters (a–z), digits and hyphens. Your display name can still use Bangla or any language.',
  invalid_characters: 'Use only lowercase letters, digits and single hyphens — no spaces or symbols.',
  must_start_with_letter: 'A username must start with a letter.',
  leading_or_trailing_hyphen: 'A username cannot start or end with a hyphen.',
  consecutive_hyphens: 'A username cannot contain two hyphens in a row.',
};

/** Words for a validation / availability reason (shared reasons + the server's availability reasons). */
export function describeUsernameReason(reason: string | undefined): string {
  if (!reason) return 'That username is not available.';
  if (reason === 'reserved') return 'That username is reserved by Choosify.';
  if (reason === 'reserved_prefix') return 'Usernames cannot start with brand-, creator- or prod-.';
  if (reason === 'current_handle') return 'This is already your username.';
  if (reason === 'namespace_conflict') return 'That name is already the web address of another profile.';
  if (reason in INVALID_TEXT) return INVALID_TEXT[reason as keyof typeof INVALID_TEXT];
  return 'That username is not available.';
}

/** Instant local check with the shared rules — the same checks the server runs first. */
export type LocalUsernameCheck = { ok: boolean; handle: string; reason?: HandleRejection; message?: string };

export function checkUsernameLocally(input: string): LocalUsernameCheck {
  const v = validateHandle(input);
  if ('reason' in v) return { ok: false, handle: v.handle, reason: v.reason, message: describeUsernameReason(v.reason) };
  return { ok: true, handle: v.handle };
}

export function availabilityVerdict(a: OwnerAvailability): AvailabilityVerdict {
  if (a.available) return 'available';
  if (a.reason === 'current_handle') return 'current';
  if (a.reason === 'reserved' || a.reason === 'reserved_prefix') return 'reserved';
  if (a.reason && a.reason in INVALID_TEXT) return 'invalid';
  return 'unavailable';
}

export const VERDICT_LABEL: Record<AvailabilityVerdict, string> = {
  available: 'Available',
  current: 'Current username',
  reserved: 'Reserved',
  invalid: 'Invalid',
  unavailable: 'Unavailable',
};

/** Error envelope fields of a failed lifecycle call: { status, code?, reason? }. */
export type OwnerApiFailure = { status: number; code?: string; reason?: string; message?: string };

const CODE_TEXT: Record<string, string> = {
  HANDLE_PENDING_EXISTS: 'A username request is already waiting for review. Cancel it first to request a different username.',
  HANDLE_UNAVAILABLE: 'That username is not available. Nothing was submitted.',
  HANDLE_NAMESPACE_CONFLICT: 'That name is already the web address of another profile. Nothing was submitted.',
  HANDLE_NO_CHANGE: 'This is already your username.',
  HANDLE_OWNER_SUSPENDED: 'Username requests are unavailable while this Brand’s marketplace access is suspended or restricted.',
  HANDLE_IMPERSONATION_NOT_ALLOWED: 'Username changes are not available while impersonating an account.',
  HANDLE_FORBIDDEN: 'Only the owner of this profile can view or change its username.',
  HANDLE_REQUEST_NOT_PENDING: 'That request has already been reviewed, so it can no longer be cancelled.',
  HANDLE_REQUEST_NOT_FOUND: 'That request no longer exists.',
  HANDLE_CONFLICT: 'The username changed at the same moment; nothing was saved. Please try again.',
  HANDLES_UNAVAILABLE: 'Usernames are temporarily unavailable. Nothing was changed — please try again shortly.',
};

/** Human-readable message for a failed owner call; never a generic "success". */
export function describeOwnerFailure(f: OwnerApiFailure): string {
  if (f.code === 'HANDLE_INVALID') return describeUsernameReason(f.reason);
  if (f.code && CODE_TEXT[f.code]) return CODE_TEXT[f.code];
  if (f.status === 0) return 'Could not reach Choosify. Check your connection and try again.';
  if (f.status === 401) return 'Your session has expired. Sign in again to manage your username.';
  if (f.status === 403) return 'You do not have permission to change this username.';
  if (f.status >= 500) return 'Usernames are temporarily unavailable. Please try again shortly.';
  return f.message || 'Something went wrong. Nothing was changed.';
}

/** The latest reviewed request, for showing an approval or a rejection reason. Pending / owner-cancelled are excluded. */
export function latestDecidedRequest(state: OwnerHandleState): OwnerHandleRequest | null {
  const decided = state.requests.filter((r) => r.status === 'approved' || r.status === 'rejected' || r.status === 'superseded');
  if (!decided.length) return null;
  return [...decided].sort((a, b) => String(b.decidedAt || b.createdAt).localeCompare(String(a.decidedAt || a.createdAt)))[0];
}
