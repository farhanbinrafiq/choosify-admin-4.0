/**
 * Commerce domain types — IS-004 §5–§14 / Sprint 5 (IS-010 Sprint 8).
 * Split Order Engine splits by Brand (IS-004 §9, §335).
 */

export type CommerceListingType = 'product' | 'service';

export type CommerceCartItem = {
  id: string;
  listingType: CommerceListingType;
  listingId: string;
  variantId?: string;
  quantity: number;
  /** Resolved server-side for display; never trusted from client on mutate. */
  title: string;
  brandId: string;
  brandName: string;
  sellerId: string;
  unitPrice: number;
  currency: string;
  image?: string;
  selectedOptions?: Record<string, string>;
  /** Service booking hints (minimal). */
  requestedAt?: string;
  serviceArea?: string;
  notes?: string;
  addedAt: string;
  updatedAt: string;
};

export type CommerceCart = {
  id: string;
  consumerId: string;
  items: CommerceCartItem[];
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type CommerceOrderItemSnapshot = {
  listingType: CommerceListingType;
  listingId: string;
  variantId?: string;
  sku?: string;
  title: string;
  brandId: string;
  brandName: string;
  sellerId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  finalUnitPrice: number;
  lineTotal: number;
  currency: string;
  selectedOptions?: Record<string, string>;
  taxAmount?: number;
  deliveryShare?: number;
};

/** Initial commerce order state only (full lifecycle = next sprint). */
export type CommerceOrderStatus = 'pending';

export type CommerceOrderSource =
  | 'checkout'
  | 'manual'
  | 'external_whatsapp'
  | 'external_facebook'
  | 'external_instagram'
  | 'external_offline';

export type CommerceOrder = {
  id: string;
  orderNumber: string;
  checkoutId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  brandName: string;
  status: CommerceOrderStatus;
  source: CommerceOrderSource;
  currency: string;
  items: CommerceOrderItemSnapshot[];
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  taxTotal: number;
  grandTotal: number;
  bookingRequestId?: string;
  claimToken?: string;
  claimTokenExpiresAt?: string;
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region?: string;
    deliveryNotes?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CommerceCheckout = {
  id: string;
  consumerId: string;
  cartId: string;
  idempotencyKey: string;
  status: 'completed';
  orderIds: string[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Minimal Service → Commerce booking bridge (IS-004 §12).
 * Full calendar/counter-offer deferred.
 */
export type CommerceBookingRequestStatus = 'pending_seller_review';

export type CommerceBookingRequest = {
  id: string;
  checkoutId: string;
  orderId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  serviceId: string;
  quantity: number;
  requestedAt?: string;
  serviceArea?: string;
  notes?: string;
  unitPrice: number;
  currency: string;
  title: string;
  status: CommerceBookingRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type CommerceCartTotals = {
  currency: string;
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  taxTotal: number;
  grandTotal: number;
};
