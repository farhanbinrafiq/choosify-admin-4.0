/**
 * Commerce domain types — IS-004 / Sprint 5–6 (IS-010 Sprint 8–9).
 * Split Order Engine splits by Brand (IS-004 §9, §335).
 * Product lifecycle: ES-005 §27. Cancellation: ES-005 §33. Shipping: ES-005 §39.
 */

export type CommerceListingType = 'product' | 'service';

/**
 * A resolved add-on line on a cart item / order snapshot. The client only ever
 * sends `{ id, quantity }`; `title`/`unitPrice`/`lineTotal` are resolved
 * server-side from the canonical listing configuration and are the historical
 * truth even if the seller later renames / reprices / deletes the add-on.
 */
export type CommerceAddonLine = {
  id: string;
  title: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type CommerceCartItem = {
  id: string;
  listingType: CommerceListingType;
  listingId: string;
  variantId?: string;
  /** Resolved variant SKU (server-side), for display + snapshot. */
  variantSku?: string;
  quantity: number;
  /** Resolved server-side for display; never trusted from client on mutate. */
  title: string;
  brandId: string;
  brandName: string;
  sellerId: string;
  /** Server-resolved: variant price when a variant is selected, else base price. */
  unitPrice: number;
  /** Server-resolved MRP / strike price at add-to-cart time (variant or base). */
  originalUnitPrice?: number;
  /** Server-resolved add-on selections. */
  addons?: CommerceAddonLine[];
  /**
   * Optional reference to a Guide LIVE offer the buyer added this line under.
   * Checkout revalidates it with server time; the base Product price is never
   * mutated. If the offer expired / changed, checkout returns an explicit
   * GUIDE_OFFER_PRICE_CHANGED response rather than silently charging.
   */
  guideOfferRef?: { guideId: string; productId: string };
  /** The unit price the buyer last saw for this line — used only for the price-change guard. */
  expectedUnitPrice?: number;
  /** Set server-side when an active Guide offer was applied to this line. */
  guideOfferApplied?: { guideId: string; offerId: string; basePrice: number };
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
  /** MRP / strike price at purchase time (variant or base). For historical
   *  discount display — a later seller reprice must not change it. */
  originalUnitPrice?: number;
  discount: number;
  finalUnitPrice: number;
  /** Purchase-time snapshot of an applied Guide LIVE offer (id + base price). */
  guideOffer?: { guideId: string; offerId: string; basePrice: number };
  /**
   * Purchase-time snapshot of every add-on bought on this line. Self-sufficient:
   * id + title + unitPrice + quantity + lineTotal, so the order stays truthful
   * even if the add-on is later renamed / repriced / deleted / disabled.
   */
  addons?: CommerceAddonLine[];
  /** Sum of `addons[].lineTotal`; already included in `lineTotal`. */
  addonsTotal?: number;
  /** `finalUnitPrice * quantity + addonsTotal`. */
  lineTotal: number;
  currency: string;
  selectedOptions?: Record<string, string>;
  taxAmount?: number;
  deliveryShare?: number;
  /**
   * Warranty terms snapshotted from the product AT THE MOMENT OF PURCHASE.
   * Immutable afterward — a seller later editing the product's warranty
   * config must never change what a past buyer is entitled to. Absent when
   * the product had no warranty configured at purchase time.
   */
  warrantyMonthsAtPurchase?: number;
  warrantyTypeAtPurchase?: string;
  warrantyProviderAtPurchase?: string;
  warrantyTermsSnapshot?: string;
  /** Set once, at delivery (see order fulfillment); ISO date. */
  warrantyStartsAt?: string;
  /** Derived from warrantyStartsAt + warrantyMonthsAtPurchase; ISO date. */
  warrantyExpiresAt?: string;
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
  /** Permanent Choosify Order Reference ID (OR-#####). Coexists with orderNumber. */
  orderReferenceId?: string;
  /** Permanent Choosify Invoice Reference ID (INV-#####). Coexists with any legal invoice number. */
  invoiceReferenceId?: string;
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
  /** Sprint 7 / IS-010 Sprint 10 — payment knowledge (server SoT via Payment record). */
  paymentId?: string;
  paymentMethod?: string;
  paymentOption?: string;
  paymentStatus?:
    | 'unpaid'
    | 'pending'
    | 'paid'
    | 'partial'
    | 'failed'
    | 'cancelled'
    | 'cod_due';
  paymentProvider?: string;
  paidAmount?: number;
  outstandingAmount?: number;
  invoicePaymentStatus?: 'Paid' | 'Unpaid' | 'Partial';
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
