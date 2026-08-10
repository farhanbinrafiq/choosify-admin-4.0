/**
 * Conversation permission gate — IS-005 §17 (two-branch Seller rule).
 */

import { sellerOwnsBrand } from '../../catalog/brandOwnership';
import { CommerceError } from '../../commerce/cartService';
import { ROLES, type UserRole } from '../../permissions/roles';
import type { CommerceConversation, SenderRole } from './types';
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
  return 'consumer';
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
 * Read access: participant, Brand owner/staff, or platform admin/moderator.
 */
export async function assertCanReadConversation(
  conv: CommerceConversation,
  actor: MessagingActor,
): Promise<void> {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  if (isPlatformAdminRole(actor.role) || isAdminEnterRole(actor.role)) return;
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

  if (senderRole === 'consumer') {
    if (conv.consumerId !== actor.userId) {
      throw new CommerceError('Consumers may only message in their own conversations', 403);
    }
    return senderRole;
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
