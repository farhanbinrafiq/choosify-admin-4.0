import { getStoredAccessToken, refreshAccessToken } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseErrorMessage(rawError: string, status: number): string {
  if (!rawError) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(rawError) as { error?: string; message?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // keep raw text
  }
  return rawError;
}

function doFetch(path: string, method: HttpMethod, body: unknown, token: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  // Write routes require Firebase Bearer (authenticateRequest). Attach whenever
  // present — public GETs/validate ignore it. An unauthenticated caller has no
  // token and must fail loudly on protected writes.
  const token = getStoredAccessToken();
  let response = await doFetch(path, method, body, token);

  // A dashboard tab left open across a long session can outlive its access
  // token. Try one silent refresh via the httpOnly refresh cookie and retry
  // before surfacing a raw 'expired token' error the user has no way to act on.
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch(path, method, body, refreshed);
    }
  }

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(parseErrorMessage(rawError, response.status));
  }
  return response.json() as Promise<T>;
}

/**
 * A single line item within a sub-order. Mirrors what
 * server/operationsRouter.ts's recomputeOrderPricingServerSide (checkout path)
 * and server/booking/bookingService.ts's buildOrderFromRequest (booking path)
 * actually persist — see also findOrderItem/mark-delivered in
 * server/operationsRouter.ts for the fields that get set post-creation
 * (deliveredAt, inventoryConsumed, warrantyStartsAt/warrantyExpiresAt).
 */
export interface OpsOrderItem {
  itemId: string;
  productId?: string;
  serviceId?: string;
  variantId?: string;
  productTitle: string;
  quantity: number;
  price: number;
  productType?: 'physical' | 'service';
  serviceCategory?: string;
  serviceDetails?: Record<string, string | number>;
  /** Warranty terms snapshotted from the product at purchase time (never re-derived live). */
  warrantyMonthsAtPurchase?: number;
  warrantyTypeAtPurchase?: string;
  warrantyProviderAtPurchase?: string;
  warrantyTermsSnapshot?: string;
  warrantyStartsAt?: string;
  warrantyExpiresAt?: string;
  /** Set exactly once, server-side, by POST .../items/:itemId/mark-delivered. */
  deliveredAt?: string;
  /** True once this item's reserved stock has been converted to consumed (mark-delivered, idempotent). */
  inventoryConsumed?: boolean;
}

/** One seller's slice of a (possibly multi-seller/split) order. */
export interface OpsSubOrder {
  sellerId: string;
  sellerBusinessName?: string;
  /** Brand the seller fulfilled this slice under (set by the checkout mirror). */
  brandId?: string;
  invoiceId?: string;
  deliveryFee: number;
  /**
   * Free-form; 'pending' is the implicit default when unset (see
   * operationsRouter.ts cancel-order handler). Only ever set to 'delivered'
   * server-side by mark-delivered — no other admin-settable states exist.
   */
  trackingStatus?: string;
  items: OpsOrderItem[];
}

export interface OpsStorefrontOrder {
  id: string;
  orderId: string;
  buyerId: string;
  isCOD: boolean;
  isSplit: boolean;
  overallTotal: number;
  subtotal?: number;
  deliveryTotal?: number;
  subOrders: OpsSubOrder[];
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  sourceMode?: 'retail';
  paymentMethod?: 'cod' | 'credit' | 'online';
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region: string;
    deliveryNotes?: string;
  };
  /** Booking / service orders use pending_payment until paid, then confirmed. */
  status: 'pending_payment' | 'active' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: 'buyer' | 'seller' | 'admin';
  isManual?: boolean;
  platformSource?: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
  claimToken?: string;
  claimTokenExpiresAt?: string;
  claimedAt?: string;
  claimedByName?: string;
  paymentProvider?: 'sslcommerz';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentTranId?: string;
  paymentValId?: string;
  paidAmount?: number;
  paymentValidatedAt?: string;
  paidAt?: string;
  paymentDueAt?: string;
  /** COD orders only -- delivery fee prepaid online at checkout; product amount stays due at the doorstep. */
  codDeliveryFeePaid?: boolean;
}

/** Staff-only internal note on an order (GET/POST /operations/orders/:id/notes). */
export interface OpsOrderInternalNote {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

/**
 * The canonical Commerce order behind an Operations orderId (1:1 by
 * orderNumber). Only the fields the Order Hub lifecycle panel needs — the full
 * shape lives in server/commerce/types.ts CommerceOrder.
 */
export interface CommerceOrderLite {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  sellerId: string;
  consumerId: string;
  brandId?: string;
  source?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  statusBeforeCancel?: string;
  updatedAt?: string;
  items?: Array<{ listingType?: string }>;
}

export interface OpsCouponRule {
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsages?: number;
  maxUsagesPerUser?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  applicableBrands?: string[];
  excludeCategories?: string[];
  excludeProducts?: string[];
  excludeBrands?: string[];
  buyQuantity?: number;
  getQuantity?: number;
}

export interface OpsCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';
  discountTarget: string;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  deleted?: boolean;
  rules: OpsCouponRule;
  description: string;
  totalUsages: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  createdAt: string;
  updatedAt: string;
}

export type OpsFeeChargeType = 'service_charge' | 'platform_fee' | 'tax' | 'delivery';
export type OpsFeeRateType = 'percentage' | 'flat';
export type OpsFeeScopeType = 'platform' | 'brand' | 'category' | 'product';

export interface OpsFeeCharge {
  id: string;
  name: string;
  type: OpsFeeChargeType;
  rateType: OpsFeeRateType;
  rateValue: number;
  scopeType: OpsFeeScopeType;
  scopeBrandIds?: string[];
  scopeCategoryIds?: string[];
  scopeProductIds?: string[];
  active: boolean;
  deleted?: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpsPaymentOptionsConfig {
  partialPaymentEnabled: boolean;
  minDepositPercent: number;
  maxDepositPercent: number;
  updatedAt: string;
}

export interface OpsReview {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  brandName: string;
  storeName: string;
  rating: number;
  comment: string;
  status: string;
  reports: number;
  flags?: string[];
  response?: { id: string; author: string; comment: string; timestamp: string };
  isAuthentic?: boolean;
  authenticityScore?: number;
  authenticityReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpsLead {
  id: string;
  source: string;
  brandName: string;
  contactPerson?: string;
  email: string;
  budget?: string;
  placementInterest?: string;
  message?: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export type OpsJobEmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type OpsJobStatus = 'open' | 'closed' | 'draft';

export interface OpsJobPosting {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: OpsJobEmploymentType;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  status: OpsJobStatus;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsJobApplicationStatus = 'new' | 'reviewed' | 'interviewing' | 'rejected' | 'hired';

export interface OpsJobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl: string;
  resumeFileName?: string;
  coverLetter: string;
  status: OpsJobApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export type PermissionKey =
  | 'content'
  | 'users'
  | 'finance'
  | 'brand'
  | 'system'
  | 'analytics'
  | 'taxonomy'
  | 'impersonate';

// Mirrors server/operations/shipmentStore.ts OpsShipmentStatus exactly.
export type OpsShipmentStatus =
  | 'awaiting_dispatch'
  | 'dispatched'
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

/** Shipment statuses that are canonical evidence the parcel physically progressed. */
export const SHIPMENT_MOVEMENT_STATUSES: readonly OpsShipmentStatus[] = [
  'picked_up',
  'in_transit',
  'delivered',
  'failed_delivery',
  'returned',
];

export interface OpsShipment {
  id: string;
  orderId: string;
  buyerId: string;
  status: OpsShipmentStatus;
  courier: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  region: string;
  codAmount: number;
  deliveryCharge: number;
  createdAt: string;
  updatedAt: string;
  trackingEvents: {
    id: string;
    timestamp: string;
    status: string;
    location: string;
    description: string;
  }[];
  /** Dispatch Details (Sprint 14) — set only on a real successful dispatch. */
  fulfillmentMethod?: 'courier' | 'seller_delivery' | 'pickup';
  dispatchedAt?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  dispatchNote?: string;
}

/**
 * Fields PATCH /operations/shipments/:id accepts. Server enforces a strict
 * allowlist (see SHIPMENT_PATCH_ALLOWED_KEYS in server/operationsRouter.ts) —
 * status/tracking history are webhook-driven only and cannot be set here.
 */
export interface OpsShipmentPatch {
  courier?: string;
  trackingNumber?: string;
}

export interface AnalyticsSummary {
  range: string;
  generatedAt: string;
  orders: {
    total: number;
    revenue: number;
    promoDiscount: number;
    cod: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
  };
  reviews: {
    total: number;
    pending: number;
    published: number;
  };
  shipments: {
    total: number;
    pending: number;
    delivered: number;
  };
  coupons: {
    active: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
  };
  daily: { date: string; orders: number; revenue: number; leads: number }[];
}

export interface RoleAnalyticsPayload {
  role: string;
  cards: { label: string; value: string; sub?: string }[];
  quickLinks: { label: string; path: string }[];
  summary: AnalyticsSummary;
}

/**
 * GET /operations/analytics is role-polymorphic: admin/staff get an
 * AnalyticsSummary directly, seller/creator get a RoleAnalyticsPayload
 * wrapper. Narrow on the discriminating `cards` array.
 */
export function isRoleAnalyticsPayload(
  value: AnalyticsSummary | RoleAnalyticsPayload,
): value is RoleAnalyticsPayload {
  return Array.isArray((value as RoleAnalyticsPayload).cards);
}

/** Collapse the role-dependent analytics result down to the AnalyticsSummary. */
export function toAnalyticsSummary(
  value: AnalyticsSummary | RoleAnalyticsPayload,
): AnalyticsSummary {
  return isRoleAnalyticsPayload(value) ? value.summary : value;
}

/**
 * Embedded structured-offer snapshots persisted on the System-B platform
 * message (UnifiedMessage.bookingOffer / .orderOffer) and returned verbatim
 * by GET /operations/platform-messages. The admin DTO previously dropped
 * these fields — they are the same records the Buyer storefront renders.
 * Kept as loose records: the canonical typed shape lives in the booking /
 * manual-order stores; live status is re-resolved via listBookingRequests.
 */
export type OpsBookingOfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'buyer_accepted'
  | 'buyer_declined'
  | 'expired'
  | 'payment_expired'
  | 'paid';

export interface OpsBookingOffer {
  kind?: 'booking_offer';
  requestId?: string;
  version?: number;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingHref?: string;
  sellerId?: string;
  sellerName?: string;
  buyerId?: string;
  isService?: boolean;
  serviceCategory?: string;
  fields?: Record<string, string | number>;
  notes?: string;
  price?: number;
  originalPrice?: number;
  status?: OpsBookingOfferStatus;
  createdAt?: string;
  sellerRespondBy?: string;
  buyerPayBy?: string;
  declineReason?: string;
  orderId?: string;
}

export interface OpsManualOrderOffer {
  kind?: 'manual_order_offer';
  offerId?: string;
  orderId?: string;
  status?: string;
  sellerId?: string;
  buyerId?: string;
  overallTotal?: number;
  currency?: string;
  notes?: string;
  rejectReason?: string;
  items?: Array<{ name?: string; quantity?: number; price?: number; image?: string }>;
  createdAt?: string;
  expiresAt?: string;
}

export interface OpsPlatformMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: { type: 'text' | 'image' | 'file'; body: string; mediaUrl?: string };
  direction: 'inbound' | 'outbound';
  timestamp: string;
  /** Structured booking/product/service/counter card snapshot (see above). */
  bookingOffer?: OpsBookingOffer;
  /** Structured manual product-order offer card snapshot. */
  orderOffer?: OpsManualOrderOffer;
}

export interface OpsPlatformConversation {
  conversationId: string;
  senderName: string;
  lastMessage?: string;
  status: 'open' | 'pending' | 'resolved';
  updatedAt: string;
}

export const operationsApi = {
  /** No params, called by staff, returns every real order (server auto-scopes non-staff callers). */
  listOrders: async (params?: {
    buyerId?: string;
    sellerId?: string;
    status?: string;
  }): Promise<OpsStorefrontOrder[]> => {
    const qs = new URLSearchParams();
    if (params?.buyerId) qs.set('buyerId', params.buyerId);
    if (params?.sellerId) qs.set('sellerId', params.sellerId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    const result = await request<{ data: OpsStorefrontOrder[] }>(`/operations/orders${suffix}`);
    return result.data;
  },
  getOrder: async (orderId: string): Promise<OpsStorefrontOrder> => {
    const result = await request<{ data: OpsStorefrontOrder }>(
      `/operations/orders/${encodeURIComponent(orderId)}`,
    );
    return result.data;
  },
  markOrderItemDelivered: async (orderId: string, itemId: string): Promise<OpsStorefrontOrder> => {
    const result = await request<{ data: OpsStorefrontOrder }>(
      `/operations/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/mark-delivered`,
      'POST',
    );
    return result.data;
  },

  /** Staff-only order internal notes. A seller call 403s (surfaces as an error). */
  listOrderNotes: async (orderId: string): Promise<OpsOrderInternalNote[]> => {
    const result = await request<{ data: OpsOrderInternalNote[] }>(
      `/operations/orders/${encodeURIComponent(orderId)}/notes`,
    );
    return result.data;
  },
  addOrderNote: async (
    orderId: string,
    body: string,
    authorName?: string,
  ): Promise<OpsOrderInternalNote[]> => {
    const result = await request<{ data: OpsOrderInternalNote[] }>(
      `/operations/orders/${encodeURIComponent(orderId)}/notes`,
      'POST',
      { body, authorName },
    );
    return result.data;
  },

  // ── Canonical order lifecycle (Commerce FSM) ────────────────────────────
  // The rich order lifecycle (pending → confirmed → packed → shipped →
  // delivered → completed, + cancel) lives in the Commerce engine
  // (server/commerce/orderService.ts). Operations orders mirror its status.
  // These resolve + drive that canonical FSM; the server owns every
  // transition/role/ownership/idempotency rule.
  /**
   * The role-scoped Commerce order list (rich lifecycle status), joined to the
   * Operations orders by orderNumber for the Order Hub workflow tabs. Server
   * scopes: admin/staff → platform-wide; seller → its own (`as=seller`). A
   * forged `as`/id cannot widen — same boundary as GET /operations/orders.
   */
  listCommerceOrders: async (mode: 'admin' | 'seller'): Promise<CommerceOrderLite[]> => {
    const path = mode === 'seller' ? '/orders?as=seller' : '/orders';
    try {
      const result = await request<{ data: CommerceOrderLite[] }>(path);
      return Array.isArray(result.data) ? result.data : [];
    } catch {
      return [];
    }
  },
  getCommerceOrderByNumber: async (orderId: string): Promise<CommerceOrderLite | null> => {
    try {
      const result = await request<{ data: CommerceOrderLite }>(
        `/orders/by-number/${encodeURIComponent(orderId)}`,
      );
      return result.data;
    } catch (err) {
      // 404 = this Operations order has no Commerce lifecycle record (booking / legacy).
      if (err instanceof Error && /\(404\)|not found|No commerce order/i.test(err.message)) return null;
      throw err;
    }
  },
  transitionCommerceOrder: async (
    commerceOrderId: string,
    status: CommerceOrderLite['status'],
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: { order: CommerceOrderLite } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/transition`,
      'POST',
      { status },
    );
    return result.data.order;
  },
  cancelCommerceOrder: async (
    commerceOrderId: string,
    reason: string,
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: CommerceOrderLite }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/cancel`,
      'POST',
      { reason },
    );
    return result.data;
  },
  /** Controlled correction: confirmed → pending only. Server validates eligibility. */
  returnCommerceOrderToPending: async (
    commerceOrderId: string,
    reason: string,
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: CommerceOrderLite }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/return-to-pending`,
      'POST',
      { reason },
    );
    return result.data;
  },

  /**
   * Dispatch Details gate: Processing/Packed → Dispatched. Writes the canonical
   * OpsShipment then advances the lifecycle. A 400 with { code:'DISPATCH_VALIDATION',
   * details:{field:msg} } means the form is incomplete and the order did NOT move.
   */
  dispatchCommerceOrder: async (
    commerceOrderId: string,
    body: {
      fulfillmentMethod: 'courier' | 'seller_delivery' | 'pickup';
      courier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedDelivery?: string;
      dispatchNote?: string;
    },
  ): Promise<{ order: CommerceOrderLite; shipment: OpsShipment; reused: boolean }> => {
    const result = await request<{ data: { order: CommerceOrderLite; shipment: OpsShipment; reused: boolean } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/dispatch`,
      'POST',
      body,
    );
    return result.data;
  },

  /**
   * Administrative Status Correction (staff-only). Allowed targets per state:
   * confirmed→pending · packed→confirmed|pending · shipped→packed (pre-movement).
   */
  adminCorrectCommerceOrder: async (
    commerceOrderId: string,
    toStatus: 'pending' | 'confirmed' | 'packed',
    reason: string,
  ): Promise<{ order: CommerceOrderLite; from: string; to: string }> => {
    const result = await request<{ data: { order: CommerceOrderLite; from: string; to: string } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/admin-correct`,
      'POST',
      { toStatus, reason },
    );
    return result.data;
  },
  createOrder: async (
    payload: Partial<OpsStorefrontOrder>,
  ): Promise<OpsStorefrontOrder & { confirmOrderUrl?: string }> => {
    const result = await request<{ data: OpsStorefrontOrder; confirmOrderUrl?: string }>(
      '/operations/orders',
      'POST',
      payload,
    );
    return { ...result.data, confirmOrderUrl: result.confirmOrderUrl };
  },

  listCoupons: async (): Promise<OpsCoupon[]> => {
    const result = await request<{ data: OpsCoupon[] }>('/operations/coupons');
    return result.data;
  },
  upsertCoupon: async (payload: Partial<OpsCoupon>): Promise<OpsCoupon> => {
    if (payload.id) {
      const result = await request<{ data: OpsCoupon }>(`/operations/coupons/${payload.id}`, 'PATCH', payload);
      return result.data;
    }
    const result = await request<{ data: OpsCoupon }>('/operations/coupons', 'POST', payload);
    return result.data;
  },
  validateCoupon: async (payload: {
    code: string;
    cartTotal: number;
    userId?: string;
    cartItems?: { id: string; price: number; category?: string; brand?: string; quantity?: number }[];
  }): Promise<{ valid: boolean; discount: number; type?: string; code?: string; reason?: string }> =>
    request('/operations/coupons/validate', 'POST', payload),

  deleteCoupon: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/coupons/${id}`, 'DELETE');
  },

  listFeeCharges: async (): Promise<OpsFeeCharge[]> => {
    const result = await request<{ data: OpsFeeCharge[] }>('/operations/fee-charges');
    return result.data;
  },
  upsertFeeCharge: async (payload: Partial<OpsFeeCharge>): Promise<OpsFeeCharge> => {
    if (payload.id) {
      const result = await request<{ data: OpsFeeCharge }>(`/operations/fee-charges/${payload.id}`, 'PATCH', payload);
      return result.data;
    }
    const result = await request<{ data: OpsFeeCharge }>('/operations/fee-charges', 'POST', payload);
    return result.data;
  },
  deleteFeeCharge: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/fee-charges/${id}`, 'DELETE');
  },

  getPaymentOptionsConfig: async (): Promise<OpsPaymentOptionsConfig> => {
    const result = await request<{ data: OpsPaymentOptionsConfig }>('/operations/payment-options');
    return result.data;
  },
  updatePaymentOptionsConfig: async (payload: Partial<OpsPaymentOptionsConfig>): Promise<OpsPaymentOptionsConfig> => {
    const result = await request<{ data: OpsPaymentOptionsConfig }>('/operations/payment-options', 'PUT', payload);
    return result.data;
  },

  listReviews: async (filter?: { sellerId?: string }): Promise<OpsReview[]> => {
    const qs = filter?.sellerId ? `?sellerId=${encodeURIComponent(filter.sellerId)}` : '';
    const result = await request<{ data: OpsReview[] }>(`/operations/reviews${qs}`);
    return result.data;
  },
  updateReview: async (id: string, payload: Partial<OpsReview>): Promise<OpsReview> => {
    const result = await request<{ data: OpsReview }>(`/operations/reviews/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteReview: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/reviews/${id}`, 'DELETE');
  },

  listLeads: async (): Promise<OpsLead[]> => {
    const result = await request<{ data: OpsLead[] }>('/operations/leads');
    return result.data;
  },
  updateLead: async (id: string, payload: Partial<OpsLead>): Promise<OpsLead> => {
    const result = await request<{ data: OpsLead }>(`/operations/leads/${id}`, 'PATCH', payload);
    return result.data;
  },

  listJobs: async (): Promise<OpsJobPosting[]> => {
    const result = await request<{ data: OpsJobPosting[] }>('/operations/jobs');
    return result.data;
  },
  createJob: async (
    payload: Omit<OpsJobPosting, 'id' | 'postedAt' | 'createdAt' | 'updatedAt'> & { slug?: string },
  ): Promise<OpsJobPosting> => {
    const result = await request<{ data: OpsJobPosting }>('/operations/jobs', 'POST', payload);
    return result.data;
  },
  updateJob: async (id: string, payload: Partial<OpsJobPosting>): Promise<OpsJobPosting> => {
    const result = await request<{ data: OpsJobPosting }>(`/operations/jobs/${id}`, 'PATCH', payload);
    return result.data;
  },
  listJobApplications: async (jobId?: string): Promise<OpsJobApplication[]> => {
    const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
    const result = await request<{ data: OpsJobApplication[] }>(`/operations/job-applications${qs}`);
    return result.data;
  },
  updateJobApplication: async (
    id: string,
    payload: Partial<OpsJobApplication>,
  ): Promise<OpsJobApplication> => {
    const result = await request<{ data: OpsJobApplication }>(
      `/operations/job-applications/${id}`,
      'PATCH',
      payload,
    );
    return result.data;
  },

  getPermissions: async (): Promise<Record<string, Record<PermissionKey, boolean>>> => {
    const result = await request<{ permissions: Record<string, Record<PermissionKey, boolean>> }>(
      '/operations/permissions',
    );
    return result.permissions;
  },
  updatePermissions: async (
    permissions: Record<string, Record<PermissionKey, boolean>>,
  ): Promise<Record<string, Record<PermissionKey, boolean>>> => {
    const result = await request<{ permissions: Record<string, Record<PermissionKey, boolean>> }>(
      '/operations/permissions',
      'PUT',
      { permissions },
    );
    return result.permissions;
  },

  /**
   * GET /operations/analytics returns the admin-shaped AnalyticsSummary
   * directly for admin/staff, but for seller/creator callers the server
   * returns the role-scoped RoleAnalyticsPayload instead (cards/quickLinks/
   * summary) -- same endpoint, role-dependent shape. Callers must narrow
   * on 'cards' in result before assuming either shape.
   */
  getAnalytics: async (range = '30d'): Promise<AnalyticsSummary | RoleAnalyticsPayload> => {
    const result = await request<{ data: AnalyticsSummary | RoleAnalyticsPayload }>(
      `/operations/analytics?range=${range}`,
    );
    return result.data;
  },

  getRoleAnalytics: async (role: string, range = '30d'): Promise<RoleAnalyticsPayload> => {
    const result = await request<{ data: RoleAnalyticsPayload }>(
      `/operations/analytics/role/${encodeURIComponent(role)}?range=${range}`,
    );
    return result.data;
  },

  listShipments: async (): Promise<OpsShipment[]> => {
    const result = await request<{ data: OpsShipment[] }>('/operations/shipments');
    return result.data;
  },
  /** Matches by shipment id, orderId, or trackingNumber — server-side lookup (shipmentStore.getShipment). */
  getShipment: async (idOrOrderIdOrTrackingNumber: string): Promise<OpsShipment> => {
    const result = await request<{ data: OpsShipment }>(
      `/operations/shipments/${encodeURIComponent(idOrOrderIdOrTrackingNumber)}`,
    );
    return result.data;
  },
  /** Only courier/trackingNumber are updatable — see OpsShipmentPatch. */
  updateShipment: async (id: string, patch: OpsShipmentPatch): Promise<OpsShipment> => {
    const result = await request<{ data: OpsShipment }>(
      `/operations/shipments/${encodeURIComponent(id)}`,
      'PATCH',
      patch,
    );
    return result.data;
  },

  // ── Canonical booking requests (/api/v1/booking/*) ────────────────────
  // Seller-scoped: the accept/counter/decline routes derive sellerId from
  // the authenticated session; GET filters by the sellerId/buyerId query.
  // Used to re-resolve the *current* status of a bookingOffer snapshot
  // embedded on a System-B platform message — no state is duplicated.
  listBookingRequests: async (params: {
    sellerId?: string;
    buyerId?: string;
    conversationId?: string;
    status?: string;
  }): Promise<OpsBookingOffer[]> => {
    const qs = new URLSearchParams();
    if (params.sellerId) qs.set('sellerId', params.sellerId);
    if (params.buyerId) qs.set('buyerId', params.buyerId);
    if (params.conversationId) qs.set('conversationId', params.conversationId);
    if (params.status) qs.set('status', params.status);
    const result = await request<{ data: OpsBookingOffer[] }>(
      `/booking/requests?${qs.toString()}`,
    );
    return result.data;
  },
  getBookingRequest: async (requestId: string): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}`,
    );
    return result.data;
  },
  acceptBookingRequest: async (
    requestId: string,
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/accept`,
      'POST',
      { sellerName },
    );
    return result.data;
  },
  declineBookingRequest: async (
    requestId: string,
    declineReason: string,
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/decline`,
      'POST',
      { declineReason, sellerName },
    );
    return result.data;
  },
  counterBookingRequest: async (
    requestId: string,
    patch: { price?: number; fields?: Record<string, string | number>; notes?: string },
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/counter`,
      'POST',
      { ...patch, sellerName },
    );
    return result.data;
  },

  /**
   * Canonical Seller Manual Order — POST /operations/manual-offers.
   * Native mode: pass `buyerId` (existing Choosify Buyer) → Offer Card in
   * their Messages. External mode: omit buyerId, pass customerName + email +
   * phone → server returns a secure `claim.url` for the customer.
   */
  createManualOffer: async (input: {
    buyerId?: string;
    customerName?: string;
    email?: string;
    phone?: string;
    addressHint?: string;
    conversationId?: string;
    provenanceSource?:
      | 'manual'
      | 'external_whatsapp'
      | 'external_facebook'
      | 'external_instagram'
      | 'external_offline';
    deliveryTotal?: number;
    notes?: string;
    sellerName?: string;
    buyerName?: string;
    items: Array<{ productId: string; quantity: number; price: number; variantId?: string }>;
  }): Promise<{
    data: OpsManualOrderOffer;
    claim?: { token: string; url: string; expiresAt?: string };
  }> => {
    const result = await request<{
      success: boolean;
      data: OpsManualOrderOffer;
      claim?: { token: string; url: string; expiresAt?: string };
    }>('/operations/manual-offers', 'POST', input);
    return { data: result.data, claim: result.claim };
  },

  getFeatureFlags: async (): Promise<Record<string, boolean>> => {
    const result = await request<{ flags: Record<string, boolean> }>('/operations/feature-flags');
    return result.flags;
  },
  updateFeatureFlags: async (flags: Record<string, boolean>): Promise<Record<string, boolean>> => {
    const result = await request<{ flags: Record<string, boolean> }>('/operations/feature-flags', 'PUT', { flags });
    return result.flags;
  },
  listUsers: async () => {
    const result = await request<{ data: unknown[] }>('/operations/users');
    return result.data;
  },
  listSellerOffers: async () => {
    const result = await request<{ data: unknown[] }>('/operations/seller-offers');
    return result.data;
  },
  updateSellerOffer: async (id: string, payload: Record<string, unknown>) => {
    const result = await request<{ data: unknown }>(`/operations/seller-offers/${id}`, 'PATCH', payload);
    return result.data;
  },

  listReturns: async (filter?: {
    buyerId?: string;
    sellerId?: string;
    status?: string;
    orderId?: string;
  }): Promise<import('../contexts/ReturnsContext').ReturnRequest[]> => {
    const params = new URLSearchParams();
    if (filter?.buyerId) params.set('buyerId', filter.buyerId);
    if (filter?.sellerId) params.set('sellerId', filter.sellerId);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.orderId) params.set('orderId', filter.orderId);
    const qs = params.toString();
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest[] }>(
      `/operations/returns${qs ? `?${qs}` : ''}`,
    );
    return result.data;
  },
  createReturn: async (
    payload: Partial<import('../contexts/ReturnsContext').ReturnRequest>,
  ): Promise<import('../contexts/ReturnsContext').ReturnRequest> => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      '/operations/returns',
      'POST',
      payload,
    );
    return result.data;
  },
  approveReturn: async (id: string, refundAmount: number, note?: string, approvedBy?: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/approve`,
      'PATCH',
      { refundAmount, note, approvedBy },
    );
    return result.data;
  },
  rejectReturn: async (id: string, reason: string, approvedBy?: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/reject`,
      'PATCH',
      { reason, approvedBy },
    );
    return result.data;
  },
  processReturnRefund: async (id: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/refund`,
      'PATCH',
      {},
    );
    return result.data;
  },
  updateReturnStatus: async (
    id: string,
    status: import('../contexts/ReturnsContext').ReturnRequest['status'],
  ) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/status`,
      'PATCH',
      { status },
    );
    return result.data;
  },
  addReturnNote: async (id: string, note: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/note`,
      'PATCH',
      { note },
    );
    return result.data;
  },
  generateReturnLabel: async (id: string) => {
    const result = await request<{
      data: import('../contexts/ReturnsContext').ReturnRequest;
      labelUrl: string;
      trackingId: string;
      courier: string;
    }>(`/operations/returns/${encodeURIComponent(id)}/label`, 'POST', {});
    return result;
  },
  linkReturnToDispute: async (id: string, disputeId: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/dispute`,
      'PATCH',
      { disputeId },
    );
    return result.data;
  },

  listVerifications: async (params?: { status?: string; entityType?: string; entityId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.entityId) qs.set('entityId', params.entityId);
    const suffix = qs.toString() ? `?${qs}` : '';
    const result = await request<{ data: unknown[] }>(`/operations/verifications${suffix}`);
    return result.data;
  },
  getVerification: async (id: string) => {
    const result = await request<{ data: unknown }>(`/operations/verifications/${encodeURIComponent(id)}`);
    return result.data;
  },
  createVerification: async (payload: Record<string, unknown>) => {
    const result = await request<{ data: unknown }>('/operations/verifications', 'POST', payload);
    return result.data;
  },
  submitVerification: async (id: string) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/submit`,
      'PATCH',
      {},
    );
    return result.data;
  },
  updateVerificationDocument: async (
    id: string,
    docId: string,
    payload: { status: 'approved' | 'rejected'; notes?: string },
  ) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/document/${encodeURIComponent(docId)}`,
      'PATCH',
      payload,
    );
    return result.data;
  },
  /** Owner (or Admin) replace/re-upload — resets document to pending. */
  replaceVerificationDocument: async (
    id: string,
    docId: string,
    payload: { doc_url: string; name?: string },
  ) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/document/${encodeURIComponent(docId)}/replace`,
      'PUT',
      payload,
    );
    return result.data;
  },
  reviewVerification: async (
    id: string,
    payload: { status: 'approved' | 'rejected' | 'request_info'; feedback: string; reviewer_name?: string },
  ) => {
    const result = await request<{ data: unknown; catalogSideEffect?: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/review`,
      'PATCH',
      payload,
    );
    return result;
  },

  /**
   * Real buyer<->seller conversation thread (one per buyer, id
   * conv_platform_<buyerId>) -- the same backend choosify-web's buyer
   * inbox reads/writes. A seller/creator may read/reply to any buyer
   * they have a real order/booking/manual-offer relationship with
   * (enforced server-side); passing userId=<buyerId> resolves that
   * buyer's conversation for the caller.
   */
  listPlatformMessages: async (userId: string): Promise<{ data: OpsPlatformMessage[]; conversationId: string }> => {
    return request<{ data: OpsPlatformMessage[]; conversationId: string }>(
      `/operations/platform-messages?userId=${encodeURIComponent(userId)}`,
    );
  },
  sendPlatformMessage: async (payload: {
    buyerId: string;
    userName: string;
    body: string;
    orderId?: string;
  }): Promise<{ conversation: OpsPlatformConversation; message: OpsPlatformMessage }> => {
    const result = await request<{ success: boolean; data: { conversation: OpsPlatformConversation; message: OpsPlatformMessage } }>(
      '/operations/platform-messages',
      'POST',
      payload,
    );
    return result.data;
  },
};
