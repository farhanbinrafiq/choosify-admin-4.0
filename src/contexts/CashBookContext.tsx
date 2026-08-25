import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  cashbookApi,
  type CashbookListItem,
  type CashbookDetail,
  type CashbookBook,
  type CashbookImportResult,
  type FinanceSummary,
} from '../services/cashbookApi';

/**
 * CashBookContext — real API-backed cashbook + finance data.
 *
 * The backend (server/cashbook/cashbookRouter.ts) is strictly seller/creator
 * payout-oriented: a cashbook only ever contains entries imported from
 * authoritative Order lines. There is NO endpoint to create an arbitrary
 * manual entry, edit an entry, lock a book, or delete a whole book — so this
 * context does not expose those actions. Anything it exposes maps 1:1 to a
 * real endpoint; nothing here is computed/estimated on the client.
 */

interface CashBookContextType {
  // My cashbooks (owned by the authenticated actor — no cross-user listing exists)
  cashbooks: CashbookListItem[];
  cashbooksLoading: boolean;
  cashbooksError: string | null;
  refreshCashbooks: () => Promise<void>;

  // Detail of one book, loaded on demand
  bookDetail: CashbookDetail | null;
  bookDetailLoading: boolean;
  bookDetailError: string | null;
  loadCashbookDetail: (bookId: string, ownerUserId?: string) => Promise<void>;
  clearCashbookDetail: () => void;

  // Mutations — all throw on failure; callers must catch and report.
  createCashbook: (name: string, icon?: string, color?: string) => Promise<CashbookBook>;
  importOrders: (params: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  }) => Promise<CashbookImportResult>;
  deleteEntry: (entryId: string) => Promise<void>;

  // Finance summary (admin may pass sellerId to inspect a specific seller/creator)
  financeSummary: FinanceSummary | null;
  financeSummaryLoading: boolean;
  financeSummaryError: string | null;
  loadFinanceSummary: (sellerId?: string) => Promise<void>;
}

const CashBookContext = createContext<CashBookContextType | undefined>(undefined);

export const useCashBook = () => {
  const context = useContext(CashBookContext);
  if (!context) throw new Error('useCashBook must be used within a CashBookProvider');
  return context;
};

export const CashBookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAuth(); // kept for parity with other providers / future actor-aware calls

  const [cashbooks, setCashbooks] = useState<CashbookListItem[]>([]);
  const [cashbooksLoading, setCashbooksLoading] = useState(false);
  const [cashbooksError, setCashbooksError] = useState<string | null>(null);

  const [bookDetail, setBookDetail] = useState<CashbookDetail | null>(null);
  const [bookDetailLoading, setBookDetailLoading] = useState(false);
  const [bookDetailError, setBookDetailError] = useState<string | null>(null);

  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(false);
  const [financeSummaryError, setFinanceSummaryError] = useState<string | null>(null);

  const refreshCashbooks = useCallback(async () => {
    setCashbooksLoading(true);
    setCashbooksError(null);
    try {
      const rows = await cashbookApi.listCashbooks();
      setCashbooks(rows);
    } catch (error) {
      setCashbooksError(error instanceof Error ? error.message : 'Failed to load cashbooks');
    } finally {
      setCashbooksLoading(false);
    }
  }, []);

  const loadCashbookDetail = useCallback(async (bookId: string, ownerUserId?: string) => {
    setBookDetailLoading(true);
    setBookDetailError(null);
    try {
      const detail = await cashbookApi.getCashbookDetail(bookId, ownerUserId);
      setBookDetail(detail);
    } catch (error) {
      setBookDetail(null);
      setBookDetailError(error instanceof Error ? error.message : 'Failed to load cashbook');
    } finally {
      setBookDetailLoading(false);
    }
  }, []);

  const clearCashbookDetail = useCallback(() => {
    setBookDetail(null);
    setBookDetailError(null);
  }, []);

  const createCashbook = useCallback(async (name: string, icon?: string, color?: string) => {
    const book = await cashbookApi.createCashbook({ name, icon, color });
    setCashbooks((prev) => [{ ...book, summary: { totalSales: 0, totalRevenue: 0, netRevenue: 0, totalItems: 0, averageOrderValue: 0, entryCount: 0 } }, ...prev]);
    return book;
  }, []);

  const importOrders = useCallback(
    async (params: {
      bookId?: string;
      newBookName?: string;
      newBookIcon?: string;
      items: Array<{ orderId: string; orderItemKey?: string }>;
    }) => {
      const result = await cashbookApi.importOrdersToCashbook(params);
      // Refresh the list so summaries reflect the newly imported lines.
      await refreshCashbooks();
      if (bookDetail && bookDetail.book.id === result.book.id) {
        await loadCashbookDetail(result.book.id);
      }
      return result;
    },
    [refreshCashbooks, loadCashbookDetail, bookDetail],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await cashbookApi.deleteCashbookEntry(entryId);
      setBookDetail((prev) => {
        if (!prev) return prev;
        const entries = prev.entries.filter((e) => e.entryId !== entryId);
        const sales = entries.filter((e) => e.amount > 0);
        const totalRevenue = sales.reduce((a, e) => a + e.amount, 0);
        const totalItems = sales.reduce((a, e) => a + (e.quantity || 1), 0);
        const orderIds = new Set(sales.map((e) => e.orderId).filter(Boolean));
        return {
          ...prev,
          entries,
          summary: {
            totalSales: orderIds.size,
            totalRevenue,
            netRevenue: totalRevenue,
            totalItems,
            averageOrderValue: orderIds.size ? Math.round(totalRevenue / orderIds.size) : 0,
            entryCount: entries.length,
          },
        };
      });
      // Book-level totals in the dashboard list are also stale now.
      refreshCashbooks().catch(() => {});
    },
    [refreshCashbooks],
  );

  const loadFinanceSummary = useCallback(async (sellerId?: string) => {
    setFinanceSummaryLoading(true);
    setFinanceSummaryError(null);
    try {
      const summary = await cashbookApi.getFinanceSummary(sellerId);
      setFinanceSummary(summary);
    } catch (error) {
      setFinanceSummary(null);
      setFinanceSummaryError(error instanceof Error ? error.message : 'Failed to load finance summary');
    } finally {
      setFinanceSummaryLoading(false);
    }
  }, []);

  return (
    <CashBookContext.Provider
      value={{
        cashbooks,
        cashbooksLoading,
        cashbooksError,
        refreshCashbooks,
        bookDetail,
        bookDetailLoading,
        bookDetailError,
        loadCashbookDetail,
        clearCashbookDetail,
        createCashbook,
        importOrders,
        deleteEntry,
        financeSummary,
        financeSummaryLoading,
        financeSummaryError,
        loadFinanceSummary,
      }}
    >
      {children}
    </CashBookContext.Provider>
  );
};
