import { getStoredAccessToken, refreshAccessToken } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

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

function doFetch(path: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { headers });
}

async function request<T>(path: string): Promise<T> {
  const token = getStoredAccessToken();
  let response = await doFetch(path, token);
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await doFetch(path, refreshed);
  }
  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(parseErrorMessage(rawError, response.status));
  }
  return response.json() as Promise<T>;
}

export type MonetizationFilterParams = {
  from: string; // ISO
  to: string; // ISO
  source?: 'all' | 'commerce' | 'subscriptions';
  persona?: 'all' | 'seller' | 'creator';
  planId?: string;
  planVersionId?: string;
  billingInterval?: 'monthly' | 'annual';
  paymentStatus?: 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';
};

function buildQuery(f: MonetizationFilterParams): string {
  const params = new URLSearchParams();
  params.set('from', f.from);
  params.set('to', f.to);
  if (f.source) params.set('source', f.source);
  if (f.persona) params.set('persona', f.persona);
  if (f.planId) params.set('planId', f.planId);
  if (f.planVersionId) params.set('planVersionId', f.planVersionId);
  if (f.billingInterval) params.set('billingInterval', f.billingInterval);
  if (f.paymentStatus) params.set('paymentStatus', f.paymentStatus);
  return params.toString();
}

export type MonetizationSummary = {
  from: string;
  to: string;
  currency: string;
  platformRevenue: number | null;
  gmv: number | null;
  commissionRevenue: number | null;
  subscriptionRevenue: number | null;
  sellerNet: number | null;
};

export type MonetizationRevenueBreakdown = {
  currency: string;
  commerceCommission: number | null;
  subscriptionRevenue: number | null;
  platformRevenue: number | null;
};

export type MonetizationSubscriptionMetrics = {
  currency: string;
  activePaidSubscriptions: number;
  sellerRevenue: number;
  creatorRevenue: number;
  byPlan: Array<{ planId: string; planName: string; planVersionId: string; planVersion: number; billingInterval: string; revenue: number; count: number }>;
  byInterval: { monthly: number; annual: number };
  paymentCounts: { succeeded: number; pending: number; failed: number; cancelled: number };
  renewals: number;
  expirations: number;
  cancellations: number;
};

export type MonetizationRevenueTrend = {
  currency: string;
  granularity: 'day' | 'month';
  points: Array<{ date: string; subscriptionRevenue: number; commissionRevenue: number; gmv: number; platformRevenue: number }>;
};

export type MonetizationFilterOptions = {
  plans: Array<{ id: string; name: string; role: string }>;
  planVersions: Array<{ id: string; planId: string; version: number }>;
  billingIntervals: string[];
};

export const monetizationApi = {
  getSummary: (f: MonetizationFilterParams) => request<{ summary: MonetizationSummary }>(`/admin/monetization/summary?${buildQuery(f)}`),
  getRevenueBreakdown: (f: MonetizationFilterParams) => request<{ breakdown: MonetizationRevenueBreakdown }>(`/admin/monetization/revenue-breakdown?${buildQuery(f)}`),
  getSubscriptionMetrics: (f: MonetizationFilterParams) => request<{ metrics: MonetizationSubscriptionMetrics }>(`/admin/monetization/subscription-metrics?${buildQuery(f)}`),
  getCommissionMetrics: (f: MonetizationFilterParams) => request<{ metrics: { currency: string; totalCommission: number; settlementCount: number } }>(`/admin/monetization/commission-metrics?${buildQuery(f)}`),
  getGmvMetrics: (f: MonetizationFilterParams) => request<{ metrics: { currency: string; totalGmv: number; escrowCount: number } }>(`/admin/monetization/gmv-metrics?${buildQuery(f)}`),
  getRevenueTrend: (f: MonetizationFilterParams) => request<{ trend: MonetizationRevenueTrend }>(`/admin/monetization/revenue-trend?${buildQuery(f)}`),
  getFilterOptions: () => request<{ options: MonetizationFilterOptions }>('/admin/monetization/filters'),
};
