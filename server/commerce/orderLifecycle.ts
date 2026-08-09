/**
 * Product Order lifecycle — ES-005 §27 / IS-004 §21.
 * Cancellation eligibility — ES-005 §33.
 * Payment-gated Confirm — Sprint 7 / IS-010 Sprint 10.
 */

import type { CommerceCancelActor, CommerceOrderStatus } from './types';

const PRODUCT_FORWARD: Record<string, CommerceOrderStatus> = {
  pending: 'confirmed',
  confirmed: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
  delivered: 'completed',
};

/** Normalize API/UI status strings to commerce canonical form. */
export function normalizeOrderStatus(raw: string | undefined | null): CommerceOrderStatus | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, CommerceOrderStatus> = {
    pending: 'pending',
    pending_payment: 'pending',
    confirmed: 'confirmed',
    packed: 'packed',
    shipped: 'shipped',
    in_transit: 'shipped',
    dispatched: 'shipped',
    delivered: 'delivered',
    completed: 'completed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  };
  return map[s] ?? null;
}

export function isTerminalOrderStatus(status: CommerceOrderStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export function orderHasProductLines(items: Array<{ listingType: string }>): boolean {
  return items.some((i) => i.listingType === 'product');
}

export function orderHasOnlyServices(items: Array<{ listingType: string }>): boolean {
  return items.length > 0 && items.every((i) => i.listingType === 'service');
}

/**
 * Valid next status for Product Order forward path (or service simplified path).
 * Service/hotel/tour: pending → confirmed → completed (no pack/ship).
 */
export function canTransitionOrder(
  from: CommerceOrderStatus,
  to: CommerceOrderStatus,
  opts?: { serviceOnly?: boolean },
): boolean {
  if (from === to) return true; // idempotent no-op
  if (isTerminalOrderStatus(from)) return false;
  if (to === 'cancelled') {
    return from === 'pending' || from === 'confirmed' || from === 'packed';
  }
  if (opts?.serviceOnly) {
    if (from === 'pending' && to === 'confirmed') return true;
    if (from === 'confirmed' && to === 'completed') return true;
    return false;
  }
  return PRODUCT_FORWARD[from] === to;
}

/** Who may request a forward transition (not cancel). */
export function canActorForwardTransition(
  actor: 'consumer' | 'seller' | 'admin',
  to: CommerceOrderStatus,
): boolean {
  if (actor === 'consumer') return false;
  if (actor === 'admin') return true;
  // Seller fulfilment path
  return (
    to === 'confirmed' ||
    to === 'packed' ||
    to === 'shipped' ||
    to === 'delivered' ||
    to === 'completed'
  );
}

/**
 * ES-005 §33:
 * Consumer: until Seller confirmation (pending only).
 * Seller: until dispatch (pending, confirmed, packed — not shipped+).
 * Admin: throughout when authorized.
 */
export function canActorCancel(
  actor: CommerceCancelActor,
  status: CommerceOrderStatus,
): boolean {
  if (status === 'cancelled' || status === 'completed') return false;
  if (actor === 'admin') return true;
  if (actor === 'consumer') return status === 'pending';
  if (actor === 'seller') {
    return status === 'pending' || status === 'confirmed' || status === 'packed';
  }
  return false;
}

export function nextForwardStatus(
  from: CommerceOrderStatus,
  opts?: { serviceOnly?: boolean },
): CommerceOrderStatus | null {
  if (opts?.serviceOnly) {
    if (from === 'pending') return 'confirmed';
    if (from === 'confirmed') return 'completed';
    return null;
  }
  return PRODUCT_FORWARD[from] ?? null;
}

export function eventNameForStatus(to: CommerceOrderStatus): string | null {
  switch (to) {
    case 'confirmed':
      return 'OrderConfirmed';
    case 'cancelled':
      return 'OrderCancelled';
    case 'packed':
      return 'OrderPacked';
    case 'shipped':
      return 'OrderShipped';
    case 'delivered':
      return 'OrderDelivered';
    case 'completed':
      return 'OrderCompleted';
    default:
      return null;
  }
}
