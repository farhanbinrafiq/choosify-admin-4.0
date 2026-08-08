/**
 * Commerce Firestore collection names — mirror catalog_* convention.
 */

export const COMMERCE_CARTS = 'commerce_carts';
export const COMMERCE_CHECKOUTS = 'commerce_checkouts';
export const COMMERCE_ORDERS = 'commerce_orders';
export const COMMERCE_BOOKING_REQUESTS = 'commerce_booking_requests';
export const COMMERCE_IDEMPOTENCY = 'commerce_idempotency';

export type CommerceIdempotencyRecord = {
  id: string;
  key: string;
  consumerId: string;
  checkoutId: string;
  createdAt: string;
};

/** Stable Firestore doc id for idempotency (consumer-scoped key). */
export function idempotencyDocId(consumerId: string, key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
  return `idem__${consumerId}__${safeKey}`.slice(0, 700);
}
