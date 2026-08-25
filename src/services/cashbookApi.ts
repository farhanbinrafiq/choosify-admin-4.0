/**
 * Client wrapper for the real Cashbook / Finance backend.
 * Mounted at /api/v1 by server/cashbook/cashbookRouter.ts.
 *
 * Important real-backend constraints (do not build UI that assumes otherwise):
 * - Cashbooks are seller/creator-owned. `listCashbooks` always returns books
 *   owned by the *authenticated actor* — there is no "list all sellers'
 *   cashbooks" endpoint for admins.
 * - Entries only ever come from importing authoritative Order lines
 *   (`importOrdersToCashbook`). There is NO endpoint to create an arbitrary
 *   manual entry, edit an entry, lock/unlock a book, or delete a whole book.
 * - `createCashbook` / `importOrdersToCashbook` are blocked server-side for
 *   admin/super_admin actors (403) — those actions are seller/creator only.
 * - Admins may inspect a specific seller/creator's data via the `sellerId`
 *   (finance endpoints) or `ownerUserId` (cashbook detail) query params, but
 *   cannot delete another user's entries — deletion is always scoped to the
 *   authenticated actor's own userId server-side.
 */

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

export interface CashbookBook {
  id: string;
  ownerUserId: string;
  name: string;
  /** Permanent Choosify Cashbook Reference ID (CB-#####), assigned best-effort. */
  cashbookReferenceId?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashbookSummary {
  totalSales: number;
  totalRevenue: number;
  netRevenue: number;
  totalItems: number;
  averageOrderValue: number;
  entryCount: number;
}

export interface CashbookListItem extends CashbookBook {
  summary: CashbookSummary;
}

export type CashbookEntrySource = 'manual' | 'order_import';

export interface CashbookEntry {
  entryId: string;
  bookId: string;
  ownerUserId: string;
  source: CashbookEntrySource;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  orderId?: string;
  orderItemKey?: string;
  listingId?: string;
  productTitle?: string;
  brandId?: string;
  brandName?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  orderDate?: string;
  orderStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashbookDetail {
  book: CashbookBook;
  summary: CashbookSummary;
  entries: CashbookEntry[];
}

export interface CashbookImportDetailRow {
  orderId: string;
  orderItemKey: string;
  status: 'imported' | 'skipped' | 'failed';
  reason?: string;
}

export interface CashbookImportResult {
  imported: number;
  skipped: number;
  failed: number;
  book: CashbookBook;
  details: CashbookImportDetailRow[];
}

export interface CashbookDeleteEntryResult {
  deleted: boolean;
  mutatedOrder: boolean;
  mutatedPayment: boolean;
  mutatedEscrow: boolean;
}

export interface FinanceAdjustmentRow {
  id: string;
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
}

export interface FinanceSummary {
  currency: string;
  lifetimeEarnings: number;
  availableBalance: number;
  pendingApproval: number;
  escrowHeld: number;
  choosifyCommission: number;
  choosifyCommissionPercent: number;
  commissionPolicySource: 'env' | 'default_zero';
  commissionNote: string;
  otherAdjustments: number;
  netWithdrawable: number;
  grossEligibleAmount: number;
  adjustments: FinanceAdjustmentRow[];
}

export const cashbookApi = {
  /** Cashbooks owned by the authenticated actor. No cross-user listing exists. */
  listCashbooks: async (): Promise<CashbookListItem[]> => {
    const result = await request<{ data: CashbookListItem[] }>('/cashbooks');
    return result.data;
  },

  /** Blocked server-side (403) for admin/super_admin actors. */
  createCashbook: async (payload: { name: string; icon?: string; color?: string }): Promise<CashbookBook> => {
    const result = await request<{ data: CashbookBook }>('/cashbooks', 'POST', payload);
    return result.data;
  },

  /** `ownerUserId` is honored only when the caller is staff (admin inspecting a seller/creator). */
  getCashbookDetail: async (bookId: string, ownerUserId?: string): Promise<CashbookDetail> => {
    const q = ownerUserId ? `?ownerUserId=${encodeURIComponent(ownerUserId)}` : '';
    const result = await request<{ data: CashbookDetail }>(`/cashbooks/${encodeURIComponent(bookId)}${q}`);
    return result.data;
  },

  /**
   * Imports authoritative Order lines the actor owns as seller into a cashbook
   * (existing `bookId`, or a `newBookName` to create one). Blocked server-side
   * (403) for admin/super_admin actors. Items not owned by the actor are
   * reported back as "failed" in `details` rather than silently dropped.
   */
  importOrdersToCashbook: async (payload: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  }): Promise<CashbookImportResult> => {
    const result = await request<{ data: CashbookImportResult }>('/cashbooks/import-orders', 'POST', payload);
    return result.data;
  },

  /** Always scoped to the authenticated actor's own entries server-side (no admin override). */
  deleteCashbookEntry: async (entryId: string): Promise<CashbookDeleteEntryResult> => {
    const result = await request<{ data: CashbookDeleteEntryResult }>(
      `/cashbooks/entries/${encodeURIComponent(entryId)}`,
      'DELETE',
    );
    return result.data;
  },

  /** Admins may pass `sellerId` to inspect a specific seller/creator; otherwise defaults to self. */
  getFinanceSummary: async (sellerId?: string, currency = 'BDT'): Promise<FinanceSummary> => {
    const q = new URLSearchParams();
    if (sellerId) q.set('sellerId', sellerId);
    if (currency) q.set('currency', currency);
    const qs = q.toString();
    const result = await request<{ data: FinanceSummary }>(`/finance/summary${qs ? `?${qs}` : ''}`);
    return result.data;
  },

  getFinanceAdjustments: async (sellerId?: string): Promise<FinanceAdjustmentRow[]> => {
    const q = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : '';
    const result = await request<{ data: FinanceAdjustmentRow[] }>(`/finance/adjustments${q}`);
    return result.data;
  },
};
