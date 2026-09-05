/**
 * Conversation permission gate — IS-005 §17 (two-branch Seller rule).
 */

import { sellerOwnsBrand } from '../../catalog/brandOwnership';
import { CommerceError } from '../../commerce/cartService';
import { ROLES, type UserRole } from '../../permissions/roles';
import type { CommerceConversation, SenderRole, SupportAudience } from './types';
import { CONVERSATION_CONTEXT_TYPES, CONVERSATION_STATUSES } from './types';

export type MessagingActor = {
  userId: string;
  role?: string;
};

const ADMIN_ENTER_ROLES = new Set<string>([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.SUPPORT_AGENT,
]);

export function isAdminEnterRole(role?: string): boolean {
  return Boolean(role && ADMIN_ENTER_ROLES.has(role));
}

export function isPlatformAdminRole(role?: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.MODERATOR;
}

export function resolveSenderRole(role?: string): SenderRole {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) return 'admin';
  if (role === ROLES.MODERATOR || role === ROLES.SUPPORT_AGENT) return 'admin';
  if (role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER || role?.includes('seller')) {
    return role === 'seller_staff' ? 'seller_staff' : 'seller';
  }
  // Creator is a first-class messaging identity (support-only in V1) — no longer
  // silently coerced to 'consumer'.
  if (role === ROLES.CREATOR) return 'creator';
  return 'consumer';
}

/** Support audience = which side opened/owns a Choosify Support conversation. */
export function resolveSupportAudience(role?: string): SupportAudience {
  const sr = resolveSenderRole(role);
  if (sr === 'seller' || sr === 'seller_staff') return 'seller';
  if (sr === 'creator') return 'creator';
  return 'consumer';
}

const SUPPORT_AUDIENCE_ALLOWLIST = new Set<string>(['consumer', 'seller', 'creator']);

/** Validates a client-supplied support audience against the allowlist. Any
 *  other value (including undefined/garbage) returns null so callers fall
 *  back to role-derived resolution instead of trusting it. */
export function parseSupportAudience(value: unknown): SupportAudience | null {
  return typeof value === 'string' && SUPPORT_AUDIENCE_ALLOWLIST.has(value)
    ? (value as SupportAudience)
    : null;
}

/**
 * Which audiences an Admin may address for a given target account's current
 * role — this is a product capability rule (persona choice), not a recovery
 * of historical role data. Verified Seller/Seller: Consumer or Seller.
 * Creator: Consumer or Creator. Everyone else: Consumer only.
 */
export function allowedAudiencesForTarget(role?: string): SupportAudience[] {
  const sr = resolveSenderRole(role);
  if (sr === 'seller' || sr === 'seller_staff') return ['consumer', 'seller'];
  if (sr === 'creator') return ['consumer', 'creator'];
  return ['consumer'];
}

/**
 * Self-service (non-admin) support-audience resolution. Every account can act
 * as a Consumer regardless of its current role, so an explicit `'consumer'`
 * request is always honoured — this is what lets a Seller/Creator account
 * reach its own Consumer-persona thread from the storefront. Any other
 * requested audience is honoured only when it equals the account's own
 * role-derived audience (a no-op confirmation, not an escalation). Anything
 * else — omitted, invalid, or a persona the account doesn't actually have —
 * falls back to the existing role-derived behaviour.
 */
export function resolveSelfServiceSupportAudience(
  actor: MessagingActor,
  requestedAudience?: unknown,
): SupportAudience {
  const roleDerived = resolveSupportAudience(actor.role);
  const requested = parseSupportAudience(requestedAudience);
  if (requested === 'consumer') return 'consumer';
  if (requested && requested === roleDerived) return requested;
  return roleDerived;
}

/** Contexts an Admin/Support actor may read without an explicit audited enter. */
const ADMIN_AUTO_READ_CONTEXTS = new Set<string>([
  CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
  CONVERSATION_CONTEXT_TYPES.EXTERNAL_SOCIAL,
]);

/**
 * Rollback hatch: set MESSAGING_ADMIN_BLANKET_READ=true to restore the legacy
 * behaviour where any Admin/Moderator/Support role could read EVERY canonical
 * conversation (including private Buyer↔Seller commerce). Default is the safer
 * scoped behaviour — support/external-social auto, commerce only after an
 * audited AdminConversationEntry.
 */
function adminBlanketReadEnabled(): boolean {
  return String(process.env.MESSAGING_ADMIN_BLANKET_READ || '').trim().toLowerCase() === 'true';
}

async function adminHasEnteredConversation(conversationId: string, adminId: string): Promise<boolean> {
  try {
    const { listAdminEntries } = await import('./conversationStore');
    const entries = await listAdminEntries(conversationId);
    return entries.some((e) => e.adminId === adminId);
  } catch {
    return false;
  }
}

/** Forbidden marketplace pairs — IS-005 / BP-007. */
export function assertAllowedParticipantPair(
  a: SenderRole,
  b: SenderRole,
): void {
  const pair = new Set([a, b]);
  if (pair.size === 1 && (a === 'consumer' || a === 'seller')) {
    // consumer↔consumer or seller↔seller as only pair types in a DM create path
    if (a === 'consumer') {
      throw new CommerceError('Consumer ↔ Consumer messaging is forbidden', 403);
    }
    throw new CommerceError('Seller ↔ Seller marketplace DM is forbidden', 403);
  }
  // Creator↔Consumer / Creator↔Brand are blocked by not offering creator DM create paths.
  if ((a === 'consumer' && b === 'consumer') || (a === 'seller' && b === 'seller')) {
    throw new CommerceError('Forbidden marketplace messaging relationship', 403);
  }
}

export function conversationHasActiveCommercialLink(conv: CommerceConversation): boolean {
  if (conv.orderId) return true;
  if (conv.bookingRequestId) return true;
  if (conv.contextType === CONVERSATION_CONTEXT_TYPES.PRODUCT_INQUIRY) return true;
  if (conv.contextType === CONVERSATION_CONTEXT_TYPES.SERVICE_REQUEST) return true;
  if (conv.contextType === CONVERSATION_CONTEXT_TYPES.BOOKING) return true;
  return false;
}

export function consumerInitiated(conv: CommerceConversation): boolean {
  return (
    conv.contextType === CONVERSATION_CONTEXT_TYPES.PRODUCT_INQUIRY ||
    conv.contextType === CONVERSATION_CONTEXT_TYPES.SERVICE_REQUEST ||
    Boolean(conv.metadata?.consumerInitiated)
  );
}

/**
 * Read access: participant, Brand owner/staff, or platform admin/support.
 *
 * Admin/Support auto-read is now SCOPED (IS-005 §7 fix): support_ticket and
 * external_social only. Private commerce (order / manual_order / product_inquiry
 * / service_request / booking) is readable by staff ONLY after an audited
 * enterConversationAsAdmin — the deliberate dispute/investigation path. The
 * MESSAGING_ADMIN_BLANKET_READ flag restores the old behaviour for rollback.
 */
export async function assertCanReadConversation(
  conv: CommerceConversation,
  actor: MessagingActor,
): Promise<void> {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);

  const isStaff = isPlatformAdminRole(actor.role) || isAdminEnterRole(actor.role);
  if (isStaff) {
    if (adminBlanketReadEnabled()) return;
    if (ADMIN_AUTO_READ_CONTEXTS.has(conv.contextType)) return;
    if (await adminHasEnteredConversation(conv.id, actor.userId)) return;
    throw new CommerceError(
      'Private commerce conversation — enter the conversation (dispute/investigation) to read it',
      403,
    );
  }

  if (conv.consumerId === actor.userId) return;
  if (conv.sellerId === actor.userId) return;
  if (conv.participants.some((p) => p.userId === actor.userId)) return;
  if (await sellerOwnsBrand(actor.userId, conv.brandId)) return;
  throw new CommerceError('Not authorized for this conversation', 403);
}

/**
 * Write access: conversation must be writable + participant rules + Seller two-branch.
 */
export async function assertCanSendMessage(
  conv: CommerceConversation,
  actor: MessagingActor,
): Promise<SenderRole> {
  await assertCanReadConversation(conv, actor);

  if (conv.status === CONVERSATION_STATUSES.READ_ONLY) {
    throw new CommerceError('Conversation is read-only', 409);
  }
  if (conv.status === CONVERSATION_STATUSES.CLOSED) {
    throw new CommerceError('Conversation is closed', 409);
  }

  const senderRole = resolveSenderRole(actor.role);

  if (senderRole === 'admin') {
    // Admin must have entered (audited) — checked by caller via adminEntries when required.
    return senderRole;
  }

  if (conv.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET) {
    const isOpener =
      conv.consumerId === actor.userId ||
      conv.participants.some((p) => p.userId === actor.userId);
    if (isOpener) return senderRole;
    throw new CommerceError('Not authorized for this support conversation', 403);
  }

  if (senderRole === 'consumer') {
    if (conv.consumerId !== actor.userId) {
      throw new CommerceError('Consumers may only message in their own conversations', 403);
    }
    return senderRole;
  }

  if (senderRole === 'creator') {
    // V1: Creators only participate in their own Choosify Support thread (handled
    // by the SUPPORT_TICKET branch above). No Buyer/Seller/Brand↔Creator messaging.
    throw new CommerceError('Creators can only message Choosify Support in V1', 403);
  }

  // Seller / seller_staff
  const owns =
    conv.sellerId === actor.userId || (await sellerOwnsBrand(actor.userId, conv.brandId));
  if (!owns) {
    throw new CommerceError('Not authorized for this Brand conversation', 403);
  }

  // Two-branch Seller rule (IS-005 §17)
  if (!consumerInitiated(conv) && !conversationHasActiveCommercialLink(conv)) {
    throw new CommerceError(
      'Sellers may only message Consumers when the Consumer initiated the conversation or an active Order/Booking exists',
      403,
    );
  }

  return senderRole;
}

export function assertNotForbiddenDmCreate(opts: {
  initiatorRole: SenderRole;
  counterpartRole: SenderRole;
  contextType: string;
}): void {
  if (opts.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET) return;
  assertAllowedParticipantPair(opts.initiatorRole, opts.counterpartRole);
  // Creator roles are not first-class messaging initiators in Sprint 9.
  if (opts.initiatorRole === 'consumer' && opts.counterpartRole === 'consumer') {
    throw new CommerceError('Consumer ↔ Consumer messaging is forbidden', 403);
  }
}
