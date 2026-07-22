const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(rawError || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
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
  subOrders: unknown[];
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  sourceMode?: 'retail';
  paymentMethod?: 'cod' | 'credit';
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region: string;
    deliveryNotes?: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
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

export type PermissionKey = 'content' | 'users' | 'finance' | 'brand' | 'system' | 'analytics';

export interface OpsShipment {
  id: string;
  orderId: string;
  buyerId: string;
  status: string;
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
  listOrders: async (): Promise<OpsStorefrontOrder[]> => {
    const result = await request<{ data: OpsStorefrontOrder[] }>('/operations/orders');
    return result.data;
  },
  createOrder: async (payload: Partial<OpsStorefrontOrder>): Promise<OpsStorefrontOrder> => {
    const result = await request<{ data: OpsStorefrontOrder }>('/operations/orders', 'POST', payload);
    return result.data;
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

  listReviews: async (): Promise<OpsReview[]> => {
    const result = await request<{ data: OpsReview[] }>('/operations/reviews');
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
};
