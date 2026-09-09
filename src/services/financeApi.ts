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

export type FinanceFilterParams = {
  from: string;
  to: string;
  paymentStatus?: 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';
  persona?: 'all' | 'seller' | 'creator';
  page?: number;
  pageSize?: number;
};

function buildQuery(f: FinanceFilterParams): string {
  const params = new URLSearchParams();
  params.set('from', f.from);
  params.set('to', f.to);
  if (f.paymentStatus) params.set('paymentStatus', f.paymentStatus);
  if (f.persona) params.set('persona', f.persona);
  if (f.page) params.set('page', String(f.page));
  if (f.pageSize) params.set('pageSize', String(f.pageSize));
  return params.toString();
}

export type FinanceOverview = {
  currency: string;
  totalSuccessfulSubscriptionPaymentValue: number;
  successfulSubscriptionPaymentCount: number;
  pendingSubscriptionPaymentCount: number;
  failedSubscriptionPaymentCount: number;
  cancelledSubscriptionPaymentCount: number;
  commerceSettlementCount: number;
  totalCommissionRecorded: number;
  totalSellerNetRecorded: number;
  billingDocumentCount: number;
};

export type FinanceTransactionRow = {
  id: string;
  createdAt: string;
  purpose: string;
  amount: number;
  currency: string;
  result: string;
  planName: string;
  planVersion: number;
  billingInterval: string;
  workspaceType: string;
};

export type FinanceSettlementRow = {
  settlementId: string;
  createdAt: string;
  sellerId: string;
  sellerName: string | null;
  grossAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  currency: string;
  orderId: string;
};

export type FinanceBillingDocumentRow = {
  referenceId: string;
  issuedAt: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string | null;
  status: string;
  workspaceType: string;
};

type Paginated<T> = { rows: T[]; total: number; page: number; pageSize: number };

export const financeApi = {
  getOverview: (f: FinanceFilterParams) => request<{ overview: FinanceOverview }>(`/admin/finance/overview?${buildQuery(f)}`),
  listTransactions: (f: FinanceFilterParams) => request<Paginated<FinanceTransactionRow>>(`/admin/finance/transactions?${buildQuery(f)}`),
  listSettlements: (f: FinanceFilterParams) => request<Paginated<FinanceSettlementRow>>(`/admin/finance/settlements?${buildQuery(f)}`),
  listBillingDocuments: (f: FinanceFilterParams) => request<Paginated<FinanceBillingDocumentRow>>(`/admin/finance/billing-documents?${buildQuery(f)}`),
};
