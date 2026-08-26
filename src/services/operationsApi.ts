const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

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

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Write routes require Firebase Bearer (authenticateRequest). Attach whenever
  // present — public GETs/validate ignore it. Mock TempRoleSwitcher login has no
  // token and must fail loudly on protected writes.
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

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

  getAnalytics: async (range = '30d'): Promise<AnalyticsSummary> => {
    const result = await request<{ data: AnalyticsSummary }>(`/operations/analytics?range=${range}`);
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
  }): Promise<import('../contexts/ReturnsContext').ReturnRequest[]> => {
    const params = new URLSearchParams();
    if (filter?.buyerId) params.set('buyerId', filter.buyerId);
    if (filter?.sellerId) params.set('sellerId', filter.sellerId);
    if (filter?.status) params.set('status', filter.status);
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
};
