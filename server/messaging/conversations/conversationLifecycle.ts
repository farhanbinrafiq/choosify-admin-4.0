/**
 * Conversation lifecycle — IS-005 §18–§20.
 * Product: active until Delivered / Cancelled / Refunded / Closed → Read-Only.
 * Service: active until completed / cancelled / counter-offer expired / closed.
 */

import type { CommerceOrderStatus } from '../../commerce/types';
import {
  CONVERSATION_CONTEXT_TYPES,
  CONVERSATION_STATUSES,
  type CommerceConversation,
  type ConversationContextType,
} from './types';

const PRODUCT_READ_ONLY_ORDER_STATUSES = new Set<CommerceOrderStatus | string>([
  'delivered',
  'completed',
  'cancelled',
  'refunded',
  'closed',
]);

const SERVICE_READ_ONLY_TRIGGERS = new Set([
  'completed',
  'cancelled',
  'canceled',
  'counter_offer_expired',
  'closed',
]);

export function isProductLikeContext(contextType: ConversationContextType): boolean {
  return (
    contextType === CONVERSATION_CONTEXT_TYPES.ORDER ||
    contextType === CONVERSATION_CONTEXT_TYPES.MANUAL_ORDER ||
    contextType === CONVERSATION_CONTEXT_TYPES.EXTERNAL_SOCIAL ||
    contextType === CONVERSATION_CONTEXT_TYPES.PRODUCT_INQUIRY
  );
}

export function isServiceLikeContext(contextType: ConversationContextType): boolean {
  return (
    contextType === CONVERSATION_CONTEXT_TYPES.BOOKING ||
    contextType === CONVERSATION_CONTEXT_TYPES.SERVICE_REQUEST
  );
}

export function shouldBecomeReadOnlyForOrderStatus(
  contextType: ConversationContextType,
  orderStatus: string,
): boolean {
  const normalized = String(orderStatus).trim().toLowerCase();
  if (isServiceLikeContext(contextType)) {
    return SERVICE_READ_ONLY_TRIGGERS.has(normalized);
  }
  // Product / manual / inquiry that later gained an order
  return PRODUCT_READ_ONLY_ORDER_STATUSES.has(normalized);
}

export function markReadOnly(
  conv: CommerceConversation,
  at = new Date().toISOString(),
): CommerceConversation {
  if (conv.status === CONVERSATION_STATUSES.READ_ONLY) {
    return { ...conv, readOnlyAt: conv.readOnlyAt || at, updatedAt: at };
  }
  return {
    ...conv,
    status: CONVERSATION_STATUSES.READ_ONLY,
    readOnlyAt: at,
    updatedAt: at,
  };
}

export function markClosed(
  conv: CommerceConversation,
  at = new Date().toISOString(),
): CommerceConversation {
  return {
    ...conv,
    status: CONVERSATION_STATUSES.CLOSED,
    closedAt: at,
    readOnlyAt: conv.readOnlyAt || at,
    updatedAt: at,
  };
}

export function isWritable(conv: CommerceConversation): boolean {
  return conv.status === CONVERSATION_STATUSES.ACTIVE;
}
