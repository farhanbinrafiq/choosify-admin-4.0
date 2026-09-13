import { getStoredAccessToken, refreshAccessToken } from './authRefresh';

/**
 * server/moderation/moderationRouter.ts is mounted at bare `/api` in
 * server/app.ts (`app.use("/api", moderationRouter)`), not `/api/v1` like
 * catalogRouter/operationsRouter -- this matches several other routers
 * mounted the same way (analytics, search, communication, ai, emi,
 * messaging, logistics). Every route below is defined with its own
 * `/admin/...` absolute path, so the real, callable URL is
 * `/api/admin/moderation/...`, never `/api/v1/admin/moderation/...`.
 */
const VERSIONED_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const API_BASE = VERSIONED_BASE.replace(/\/v1\/?$/, '');

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

export type ModerationQueueType = 'products' | 'brands' | 'sellers' | 'creators' | 'guides' | 'campaigns' | 'reviews' | 'reports' | 'media';
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'needs_review' | 'assigned' | 'archived';
export type ModerationReason =
  | 'policy_violation'
  | 'spam'
  | 'counterfeit'
  | 'misleading'
  | 'copyright'
  | 'fraud'
  | 'quality'
  | 'incomplete'
  | 'other';
export type ReportCategory = 'spam' | 'fake_product' | 'counterfeit' | 'abuse' | 'copyright' | 'incorrect_information' | 'fraud' | 'other';
export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export type ReportSource = 'storefront' | 'seller_dashboard' | 'creator_dashboard' | 'consumer_account' | 'admin';

export interface ModerationHistoryEntry {
  id: string;
  action: 'approve' | 'reject' | 'request_changes' | 'revoke' | 'assign';
  actorId?: string;
  actorName?: string;
  previousStatus: ModerationStatus;
  newStatus: ModerationStatus;
  reason?: ModerationReason;
  notes?: string;
  assignedToId?: string;
  assignedToName?: string;
  revokesEntryId?: string;
  timestamp: string;
}

export interface ModerationItem {
  id: string;
  queue: ModerationQueueType;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  status: ModerationStatus;
  priority: number;
  assignedModeratorId?: string;
  assignedModeratorName?: string;
  reason?: ModerationReason;
  notes?: string;
  history: ModerationHistoryEntry[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ReportItem {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  resourceOwnerId?: string;
  reporterId?: string;
  reporterRole?: string;
  source?: ReportSource;
  description?: string;
  assignedModeratorId?: string;
  assignedModeratorName?: string;
  internalNotes?: string;
  linkedModerationItemId?: string;
  resolution?: string;
  resolutionReason?: ModerationReason;
  resolutionNote?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ModerationSummary {
  queues: Record<ModerationQueueType, { pending: number; approved: number; rejected: number; needsReview: number; assigned: number; total: number }>;
  reports: { open: number; investigating: number; resolved: number; dismissed: number; total: number };
  verifications: { pending: number; verified: number; rejected: number; suspended: number; expired: number; total: number };
  fraudSignals: { unreviewed: number; total: number };
  generatedAt: string;
}

export interface TrustOverview {
  reputation: {
    avgSellerReputation: number | null;
    sellerCount: number;
    accountsBelowThreshold: number;
    avgCreatorReputation: number | null;
    creatorCount: number;
    threshold: number;
  };
  disputes: { open: number; total: number };
  moderation: { flaggedContent: number; openReports: number };
  performance: {
    cancellationRatePct: number | null;
    returnRatePct: number | null;
    warrantyClaimRatePct: number | null;
    totalOrders: number;
  };
  accountsRequiringAttention: Array<{
    sellerId: string;
    sellerName?: string;
    role: 'seller';
    reputationScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    reviewRating: number | null;
    mainIssue: string;
  }>;
  generatedAt: string;
}

export interface StaffMember {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export interface ReputationScore {
  sellerId: string;
  sellerName?: string;
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  reviewRating: number | null;
  complaintCount: number;
  approvalRate: number | null;
  responseTimeHours: number | null;
  orderSuccessRate: number | null;
  accountAgeDays: number | null;
  verificationStatus: string;
  components: Array<{ key: string; label: string; value: number; weight: number; weightedScore: number; source: 'computed' | 'placeholder'; notes?: string }>;
  calculatedAt: string;
}

export const moderationApi = {
  getSummary: async (): Promise<ModerationSummary> => {
    const result = await request<{ data: ModerationSummary }>('/admin/moderation/summary');
    return result.data;
  },

  listQueue: async (filter: {
    queue?: ModerationQueueType;
    status?: ModerationStatus;
    assignedModeratorId?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ModerationItem[]> => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    const result = await request<{ data: { items: ModerationItem[] } }>(`/admin/moderation/queue${qs ? `?${qs}` : ''}`);
    return result.data.items;
  },

  flag: async (input: {
    queue: ModerationQueueType;
    resourceType: string;
    resourceId: string;
    resourceLabel?: string;
    reason?: ModerationReason;
    notes?: string;
  }): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>('/admin/moderation/flag', 'POST', input);
    return result.data;
  },

  approve: async (id: string, reason?: ModerationReason, notes?: string): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>(`/admin/moderation/items/${id}/approve`, 'POST', { reason, notes });
    return result.data;
  },
  reject: async (id: string, reason?: ModerationReason, notes?: string): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>(`/admin/moderation/items/${id}/reject`, 'POST', { reason, notes });
    return result.data;
  },
  requestChanges: async (id: string, reason?: ModerationReason, notes?: string): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>(`/admin/moderation/items/${id}/request-changes`, 'POST', { reason, notes });
    return result.data;
  },
  assign: async (id: string, moderatorId?: string, moderatorName?: string, notes?: string): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>(`/admin/moderation/items/${id}/assign`, 'POST', { moderatorId, moderatorName, notes });
    return result.data;
  },
  revoke: async (id: string, reason?: ModerationReason, notes?: string): Promise<ModerationItem> => {
    const result = await request<{ data: ModerationItem }>(`/admin/moderation/items/${id}/revoke`, 'POST', { reason, notes });
    return result.data;
  },

  searchStaff: async (query: string): Promise<StaffMember[]> => {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ search: query.trim() });
    const result = await request<{ data: { staff: StaffMember[] } }>(`/admin/moderation/staff?${params.toString()}`);
    return result.data.staff;
  },

  listReports: async (filter: { status?: ReportStatus; category?: ReportCategory; resourceId?: string; limit?: number; offset?: number } = {}): Promise<ReportItem[]> => {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    const result = await request<{ data: { reports: ReportItem[] } }>(`/admin/moderation/reports${qs ? `?${qs}` : ''}`);
    return result.data.reports;
  },

  createReport: async (input: { category: ReportCategory; resourceType: string; resourceId: string; resourceLabel?: string; description?: string }): Promise<ReportItem> => {
    const result = await request<{ data: ReportItem }>('/admin/moderation/reports', 'POST', input);
    return result.data;
  },

  /**
   * Public report submission (POST /moderation/reports, no "admin" prefix) --
   * gated only by "any authenticated user" server-side, not requireModerationAccess.
   * This is what the Seller/Creator dashboard's own "Report" actions must call
   * (a seller/creator token is not a moderator token and would get a 403 from
   * createReport above, which hits the staff-only /admin/moderation/reports route).
   */
  submitReport: async (input: {
    category: ReportCategory;
    resourceType: string;
    resourceId: string;
    resourceLabel?: string;
    description?: string;
    source?: 'storefront' | 'seller_dashboard' | 'creator_dashboard' | 'consumer_account' | 'admin';
  }): Promise<ReportItem> => {
    const result = await request<{ data: ReportItem }>('/moderation/reports', 'POST', input);
    return result.data;
  },

  resolveReport: async (id: string, decision: 'approve' | 'reject' | 'request_changes' | 'escalate' | 'dismiss', reason?: ModerationReason, notes?: string): Promise<ReportItem> => {
    const result = await request<{ data: ReportItem }>(`/admin/moderation/reports/${id}/resolve`, 'POST', { decision, reason, notes });
    return result.data;
  },
  assignReport: async (id: string, moderatorId: string, moderatorName?: string): Promise<ReportItem> => {
    const result = await request<{ data: ReportItem }>(`/admin/moderation/reports/${id}/assign`, 'POST', { moderatorId, moderatorName });
    return result.data;
  },
  addReportNote: async (id: string, note: string): Promise<ReportItem> => {
    const result = await request<{ data: ReportItem }>(`/admin/moderation/reports/${id}/notes`, 'POST', { note });
    return result.data;
  },

  getReputation: async (entityId: string, entityType: 'seller' | 'brand' | 'creator' = 'seller', entityLabel?: string): Promise<ReputationScore> => {
    const params = new URLSearchParams({ entityId, entityType });
    if (entityLabel) params.set('entityLabel', entityLabel);
    const result = await request<{ data: ReputationScore }>(`/admin/reputation?${params.toString()}`);
    return result.data;
  },

  getTrustOverview: async (): Promise<TrustOverview> => {
    const result = await request<{ data: TrustOverview }>('/admin/trust/overview');
    return result.data;
  },
};
