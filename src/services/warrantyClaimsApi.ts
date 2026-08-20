const API_BASE =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL as
    | string
    | undefined) || '/api/v1';

export type WarrantyClaimIssueType =
  | 'not_powering_on'
  | 'manufacturing_defect'
  | 'physical_damage'
  | 'battery_charging'
  | 'performance_software'
  | 'missing_damaged_accessory'
  | 'other';

export type WarrantyClaimStatus =
  | 'submitted'
  | 'acknowledged'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'service_in_progress'
  | 'resolved'
  | 'cancelled';

export interface WarrantyClaim {
  id: string;
  referenceId?: string;
  orderId: string;
  orderItemId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  productId: string;
  warrantyMonthsAtPurchase?: number;
  warrantyTypeAtPurchase?: string;
  warrantyProviderAtPurchase?: string;
  warrantyTermsSnapshot?: string;
  warrantyStartsAt?: string;
  warrantyExpiresAt?: string;
  issueType: WarrantyClaimIssueType;
  description: string;
  attachmentMediaIds: string[];
  status: WarrantyClaimStatus;
  sellerResponse?: string;
  resolutionNotes?: string;
  conversationId?: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('choosify_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(),
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

export const warrantyClaimsApi = {
  list: async (params?: { sellerId?: string; consumerId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const result = await request<{ data: WarrantyClaim[] }>(`/operations/warranty-claims${qs ? `?${qs}` : ''}`, 'GET');
    return result.data;
  },
  get: async (id: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}`, 'GET');
    return result.data;
  },
  create: async (payload: {
    orderId: string;
    orderItemId: string;
    issueType: WarrantyClaimIssueType;
    description: string;
    attachmentMediaIds?: string[];
  }) => {
    const result = await request<{ data: WarrantyClaim; reused?: boolean }>('/operations/warranty-claims', 'POST', payload);
    return result;
  },
  acknowledge: async (id: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/acknowledge`, 'PATCH');
    return result.data;
  },
  requestInfo: async (id: string, sellerResponse: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/request-info`, 'PATCH', { sellerResponse });
    return result.data;
  },
  approve: async (id: string, sellerResponse?: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/approve`, 'PATCH', { sellerResponse });
    return result.data;
  },
  reject: async (id: string, sellerResponse: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/reject`, 'PATCH', { sellerResponse });
    return result.data;
  },
  serviceStatus: async (id: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/service-status`, 'PATCH');
    return result.data;
  },
  resolve: async (id: string, resolutionNotes: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/resolve`, 'PATCH', { resolutionNotes });
    return result.data;
  },
  cancel: async (id: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/cancel`, 'PATCH');
    return result.data;
  },
};
