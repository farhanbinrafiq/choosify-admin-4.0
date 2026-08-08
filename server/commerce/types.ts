/**
 * Commerce domain types — IS-004 / Sprint 5–6 (IS-010 Sprint 8–9).
 * Split Order Engine splits by Brand (IS-004 §9, §335).
 * Product lifecycle: ES-005 §27. Cancellation: ES-005 §33. Shipping: ES-005 §39.
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

/** Product Order lifecycle (ES-005 §27) + cancelled branch (ES-005 §33). */
export type CommerceOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type CommerceOrderSource =
  | 'checkout'
  | 'manual'
  | 'external_whatsapp'
  | 'external_facebook'
  | 'external_instagram'
  | 'external_offline';

export type CommerceCancelActor = 'consumer' | 'seller' | 'admin';

export type CommerceFulfilmentMethod =
  | 'self_delivery'
  | 'pickup'
  | 'third_party_courier'
  | 'platform_courier';

/** ES-005 §39 shipping lifecycle (normalized snake_case). */
export type CommerceShipmentStatus =
  | 'pending_fulfilment'
  | 'packed'
  | 'courier_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned_to_seller'
  | 'cancelled';

export type CommerceShipment = {
  id: string;
  orderId: string;
  checkoutId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  fulfilmentMethod: CommerceFulfilmentMethod;
  courierProvider?: string | null;
  trackingNumber?: string | null;
  status: CommerceShipmentStatus;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
};

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
  shipmentId?: string;
  /** Product lines reserved at checkout (ADR-003). */
  inventoryReserved?: boolean;
  /** Product stock consumed at Packed (Sprint 6). */
  inventoryConsumed?: boolean;
  cancelledBy?: CommerceCancelActor;
  cancelReason?: string;
  cancelledAt?: string;
  statusBeforeCancel?: CommerceOrderStatus;
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
