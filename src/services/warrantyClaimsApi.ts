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
  | 'cancelled'
  | 'disputed';

/** Granular progress WITHIN 'service_in_progress' — see server/operations/types.ts. */
export type WarrantyClaimServiceStage =
  | 'return_requested'
  | 'in_transit'
  | 'received'
  | 'under_review'
  | 'repair_in_progress'
  | 'replacement_in_progress'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered';

export type WarrantyClaimResolutionType = 'repaired' | 'replaced' | 'refunded' | 'rejected' | 'no_fault_found' | 'other';

/** The four proof categories a warranty claim's evidence is collected under — each its own upload section on the storefront. */
export type WarrantyClaimAttachmentCategory = 'warrantyCard' | 'productPhoto' | 'box' | 'receipt';

export interface WarrantyClaimTimelineEntry {
  id: string;
  status: WarrantyClaimStatus;
  serviceStage?: WarrantyClaimServiceStage;
  note?: string;
  at: string;
  by?: string;
}

export interface WarrantyClaimInternalNote {
  id: string;
  note: string;
  by: string;
  at: string;
}

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
  attachmentCategories?: Partial<Record<WarrantyClaimAttachmentCategory, string[]>>;
  status: WarrantyClaimStatus;
  serviceStage?: WarrantyClaimServiceStage;
  sellerResponse?: string;
  resolutionNotes?: string;
  resolutionType?: WarrantyClaimResolutionType;
  estimatedCompletionDate?: string;
  timeline?: WarrantyClaimTimelineEntry[];
  /** Never populated for a consumer-scoped response — filtered server-side. */
  internalNotes?: WarrantyClaimInternalNote[];
  conversationId?: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  disputeId?: string;
}

export interface WarrantyClaimShipment {
  id: string;
  orderId: string;
  status: string;
  courier: string;
  trackingNumber: string;
  sourceType?: 'order' | 'warranty_claim';
  sourceId?: string;
  trackingEvents: Array<{ id: string; timestamp: string; status: string; location: string; description: string }>;
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
  provideInfo: async (id: string, description: string, attachmentMediaIds?: string[]) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/provide-info`, 'PATCH', {
      description,
      attachmentMediaIds,
    });
    return result.data;
  },
  approve: async (id: string, sellerResponse?: string, estimatedCompletionDate?: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/approve`, 'PATCH', {
      sellerResponse,
      estimatedCompletionDate,
    });
    return result.data;
  },
  reject: async (id: string, sellerResponse: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/reject`, 'PATCH', { sellerResponse });
    return result.data;
  },
  serviceStatus: async (id: string, serviceStage?: WarrantyClaimServiceStage, estimatedCompletionDate?: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/service-status`, 'PATCH', {
      serviceStage,
      estimatedCompletionDate,
    });
    return result.data;
  },
  advanceServiceStage: async (id: string, serviceStage: WarrantyClaimServiceStage, note?: string, estimatedCompletionDate?: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/service-stage`, 'PATCH', {
      serviceStage,
      note,
      estimatedCompletionDate,
    });
    return result.data;
  },
  /** resolutionType 'refunded' requires refundAmount — routed through the real escrow refund engine. */
  resolve: async (id: string, resolutionNotes: string, resolutionType: WarrantyClaimResolutionType, refundAmount?: number) => {
    const result = await request<{ data: WarrantyClaim; refund?: unknown }>(`/operations/warranty-claims/${id}/resolve`, 'PATCH', {
      resolutionNotes,
      resolutionType,
      refundAmount,
    });
    return result.data;
  },
  cancel: async (id: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/cancel`, 'PATCH');
    return result.data;
  },
  escalateToDispute: async (id: string, reason?: string) => {
    const result = await request<{ data: WarrantyClaim; dispute: { id: string } }>(`/operations/warranty-claims/${id}/dispute`, 'PATCH', { reason });
    return result;
  },
  /** Customer-visible status note, optionally with an estimated completion date — never an internal note. */
  addNote: async (id: string, note?: string, estimatedCompletionDate?: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/note`, 'PATCH', { note, estimatedCompletionDate });
    return result.data;
  },
  /** Staff/seller-only — never shown to the buyer. */
  addInternalNote: async (id: string, note: string) => {
    const result = await request<{ data: WarrantyClaim }>(`/operations/warranty-claims/${id}/internal-note`, 'PATCH', { note });
    return result.data;
  },
  createShipment: async (id: string, direction: 'return_pickup' | 'redelivery') => {
    const result = await request<{ data: { shipment: WarrantyClaimShipment; claim: WarrantyClaim } }>(
      `/operations/warranty-claims/${id}/shipments`,
      'POST',
      { direction },
    );
    return result.data;
  },
  listShipments: async (id: string) => {
    const result = await request<{ data: WarrantyClaimShipment[] }>(`/operations/warranty-claims/${id}/shipments`, 'GET');
    return result.data;
  },
  getDocument: async (id: string) => {
    const result = await request<{
      data: {
        claim: WarrantyClaim;
        buyer: { name: string; choosifyUserId: string | null; email: string } | null;
        seller: { name: string; choosifyUserId: string | null; email: string } | null;
        product: { title?: string; variant?: string; serialNumber?: string } | null;
      };
    }>(`/operations/warranty-claims/${id}/document`, 'GET');
    return result.data;
  },
};
