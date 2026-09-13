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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const token = getStoredAccessToken();
  let response = await doFetch(path, method, body, token);
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doFetch(path, method, body, refreshed);
  }
  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(parseErrorMessage(rawError, response.status));
  }
  return response.json() as Promise<T>;
}

export type DisputeSourceType = 'return' | 'warranty_claim' | 'order';
export type DisputeStatus =
  | 'raised'
  | 'evidence_collection'
  | 'under_review'
  | 'awaiting_buyer'
  | 'awaiting_seller'
  | 'decision_pending'
  | 'resolved'
  | 'closed';
export type DisputeDecision = 'uphold_seller' | 'uphold_buyer' | 'partial' | 'refund_approved' | 'replacement' | 'dismissed';

export interface DisputeEvidenceItem {
  id: string;
  submittedBy: 'buyer' | 'seller' | 'admin';
  submittedByUserId?: string;
  description: string;
  mediaUrl?: string;
  createdAt: string;
}

export interface DisputeTimelineEntry {
  id: string;
  type: 'status_change' | 'note' | 'evidence' | 'decision' | 'raised';
  fromStatus?: DisputeStatus;
  toStatus?: DisputeStatus;
  actorId?: string;
  actorRole?: string;
  text?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  sourceType: DisputeSourceType;
  sourceId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  amount?: number;
  buyerStatement?: string;
  sellerStatement?: string;
  status: DisputeStatus;
  evidence: DisputeEvidenceItem[];
  timeline: DisputeTimelineEntry[];
  adminNotes: string[];
  decision?: DisputeDecision;
  decisionNotes?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export const disputesApi = {
  list: async (filter: { status?: DisputeStatus; sourceType?: DisputeSourceType; sellerId?: string; buyerId?: string; orderId?: string } = {}): Promise<Dispute[]> => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    const qs = params.toString();
    const result = await request<{ data: Dispute[] }>(`/operations/disputes${qs ? `?${qs}` : ''}`);
    return result.data;
  },

  get: async (id: string): Promise<Dispute> => {
    const result = await request<{ data: Dispute }>(`/operations/disputes/${encodeURIComponent(id)}`);
    return result.data;
  },

  raise: async (input: { sourceType: DisputeSourceType; sourceId: string; reason: string; amount?: number; statement?: string; sellerId?: string }): Promise<Dispute> => {
    const result = await request<{ data: Dispute }>('/operations/disputes', 'POST', input);
    return result.data;
  },

  setStatus: async (id: string, status: DisputeStatus, note?: string): Promise<Dispute> => {
    const result = await request<{ data: Dispute }>(`/operations/disputes/${encodeURIComponent(id)}/status`, 'PATCH', { status, note });
    return result.data;
  },

  addEvidence: async (id: string, description: string, mediaUrl?: string): Promise<Dispute> => {
    const result = await request<{ data: Dispute }>(`/operations/disputes/${encodeURIComponent(id)}/evidence`, 'POST', { description, mediaUrl });
    return result.data;
  },

  addNote: async (id: string, note: string): Promise<Dispute> => {
    const result = await request<{ data: Dispute }>(`/operations/disputes/${encodeURIComponent(id)}/notes`, 'POST', { note });
    return result.data;
  },

  decide: async (id: string, decision: DisputeDecision, decisionNotes?: string): Promise<{ data: Dispute; note?: string }> => {
    return request<{ data: Dispute; note?: string }>(`/operations/disputes/${encodeURIComponent(id)}/decision`, 'POST', { decision, decisionNotes });
  },
};
