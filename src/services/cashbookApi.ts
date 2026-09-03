/**
 * Client wrapper for the real Cashbook / Finance backend.
 * Mounted at /api/v1 by server/cashbook/cashbookRouter.ts.
 *
 * Real-backend contract (Sprint 15 rebuild):
 * - Cashbooks are seller/creator-owned. Ownership is ALWAYS the authenticated
 *   actor; no request field widens it.
 * - Entries are `order_import` (immutable snapshot of a delivered/completed
 *   seller-owned order line, deduped globally per owner via `sourceImportKey`)
 *   OR `manual` (seller Cash In / Cash Out — editable).
 * - Seller/creator only: create/rename/delete book, add/edit/delete entry,
 *   import orders. All are 403 for admin/super_admin at the API layer.
 * - Staff get READ-ONLY oversight: `getCashbookOversight()` (owner index or one
 *   seller's books) and `getCashbookDetail(bookId, ownerUserId)` — no mutation.
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

async function request<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
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
  moneyIn: number;
  moneyOut: number;
  net: number;
  importedCount: number;
  manualCount: number;
  // kept for backward compatibility
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
  /** Signed: Cash In positive, Cash Out negative. */
  amount: number;
  currency: string;
  description: string;
  category?: string;
  // manual fields
  contact?: string;
  paymentMode?: string;
  docRef?: string;
  entryDate?: string;
  entryTime?: string;
  linkedOrderId?: string;
  // order-import fields (immutable)
  orderId?: string;
  orderItemKey?: string;
  sourceImportKey?: string;
  sourceType?: 'order';
  sourceSellerId?: string;
  sourceSubOrderId?: string;
  sourceOrderStatusAtImport?: string;
  listingId?: string;
  productTitle?: string;
  brandId?: string;
  brandName?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  orderDate?: string;
  orderStatus?: string;
  // read-time enrichment (never mutates the stored entry)
  liveOrderStatus?: string;
  orderFlags?: string[];
  orderChanged?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashbookDetail {
  book: CashbookBook;
  summary: CashbookSummary;
  entries: CashbookEntry[];
  /** true when the viewer is staff (oversight) — the UI must render no controls. */
  readOnly?: boolean;
}

export interface CashbookOversightOwner {
  ownerUserId: string;
  /** Headline label: the owner's brand name where one exists. */
  brandName?: string;
  brandNames?: string[];
  /** Seller / account identity — secondary label. */
  accountName?: string;
  displayName?: string;
  email?: string;
  choosifyUserId?: string;
  role?: string;
  bookCount: number;
  entryCount: number;
  moneyIn: number;
  moneyOut: number;
  updatedAt?: string;
}

export interface CashbookOversightIndex {
  owners: CashbookOversightOwner[];
}

export interface CashbookOversightSeller {
  sellerId: string;
  accountName?: string;
  brandName?: string;
  brandNames?: string[];
  books: CashbookListItem[];
}

export interface ManualEntryInput {
  direction: 'in' | 'out';
  amount: number;
  description?: string;
  category?: string;
  contact?: string;
  paymentMode?: string;
  docRef?: string;
  entryDate?: string;
  entryTime?: string;
  linkedOrderId?: string;
}

export interface CashbookImportDetailRow {
  orderId: string;
  orderItemKey: string;
  status: 'imported' | 'skipped' | 'failed';
  reason?: string;
}

export interface CashbookImportRejection {
  orderId: string;
  reason: string;
}

export interface CashbookImportResult {
  imported: number;
  skipped: number;
  failed: number;
  book: CashbookBook;
  details: CashbookImportDetailRow[];
  rejected?: CashbookImportRejection[];
  createdBook?: boolean;
  reused?: boolean;
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

  /** Rename a book you own. 403 for admin/super_admin. */
  renameCashbook: async (bookId: string, name: string): Promise<CashbookBook> => {
    const result = await request<{ data: CashbookBook }>(
      `/cashbooks/${encodeURIComponent(bookId)}`,
      'PATCH',
      { name },
    );
    return result.data;
  },

  /** Delete a book you own (cascades its entries). 403 for admin/super_admin. */
  deleteCashbook: async (bookId: string): Promise<{ deleted: boolean; removedEntries: number }> => {
    const result = await request<{ data: { deleted: boolean; removedEntries: number } }>(
      `/cashbooks/${encodeURIComponent(bookId)}`,
      'DELETE',
    );
    return result.data;
  },

  /** `ownerUserId` is honored only when the caller is staff (oversight). */
  getCashbookDetail: async (bookId: string, ownerUserId?: string): Promise<CashbookDetail> => {
    const q = ownerUserId ? `?ownerUserId=${encodeURIComponent(ownerUserId)}` : '';
    const result = await request<{ data: CashbookDetail }>(`/cashbooks/${encodeURIComponent(bookId)}${q}`);
    return result.data;
  },

  /** Staff-only READ-ONLY oversight. Without `sellerId` → owner index; with → that seller's books. */
  getCashbookOversight: async (
    sellerId?: string,
  ): Promise<CashbookOversightIndex | CashbookOversightSeller> => {
    const q = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : '';
    const result = await request<{ data: CashbookOversightIndex | CashbookOversightSeller }>(
      `/cashbooks/oversight${q}`,
    );
    return result.data;
  },

  /**
   * Imports the actor's own DELIVERED / COMPLETED order lines (server-enforced)
   * into a cashbook — existing `bookId`, or `newBookName` to create one
   * atomically. Blocked (403) for admin/super_admin. Pass a stable
   * `idempotencyKey` so a double-click / retry cannot create a duplicate book.
   */
  importOrdersToCashbook: async (payload: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    newBookColor?: string;
    idempotencyKey?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  }): Promise<CashbookImportResult> => {
    const { idempotencyKey, ...body } = payload;
    const result = await request<{ data: CashbookImportResult }>(
      '/cashbooks/import-orders',
      'POST',
      body,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    );
    return result.data;
  },

  /** Add a manual Cash In / Cash Out entry to a book you own. 403 for staff. */
  createManualEntry: async (bookId: string, input: ManualEntryInput): Promise<CashbookEntry> => {
    const result = await request<{ data: CashbookEntry }>(
      `/cashbooks/${encodeURIComponent(bookId)}/entries`,
      'POST',
      input,
    );
    return result.data;
  },

  /** Edit a MANUAL entry (imported entries are immutable → 409). 403 for staff. */
  updateEntry: async (
    entryId: string,
    input: Partial<ManualEntryInput>,
  ): Promise<CashbookEntry> => {
    const result = await request<{ data: CashbookEntry }>(
      `/cashbooks/entries/${encodeURIComponent(entryId)}`,
      'PATCH',
      input,
    );
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
