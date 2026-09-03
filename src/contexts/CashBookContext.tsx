import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  cashbookApi,
  type CashbookBook,
  type CashbookDetail,
  type CashbookImportResult,
  type CashbookListItem,
  type CashbookOversightIndex,
  type CashbookOversightSeller,
  type FinanceSummary,
  type ManualEntryInput,
} from '../services/cashbookApi';

/**
 * CashBookContext — real API-backed cashbook data. Every action maps 1:1 to a
 * canonical endpoint (server/cashbook/cashbookRouter.ts); nothing here is
 * computed/estimated on the client. No localStorage, no mock.
 *
 * Sprint 15: adds manual Cash In/Out + edit, rename/delete book, staff
 * read-only oversight, and idempotent Order-Hub import. Admin/Super Admin are
 * blocked from every mutation at the API layer — the UI simply never renders
 * those controls in the oversight view.
 */

interface CashBookContextType {
  cashbooks: CashbookListItem[];
  cashbooksLoading: boolean;
  cashbooksError: string | null;
  refreshCashbooks: () => Promise<void>;

  bookDetail: CashbookDetail | null;
  bookDetailLoading: boolean;
  bookDetailError: string | null;
  loadCashbookDetail: (bookId: string, ownerUserId?: string) => Promise<void>;
  clearCashbookDetail: () => void;

  // seller/creator mutations — all throw on failure; callers catch + report
  createCashbook: (name: string, icon?: string, color?: string) => Promise<CashbookBook>;
  renameCashbook: (bookId: string, name: string) => Promise<CashbookBook>;
  deleteCashbook: (bookId: string) => Promise<void>;
  addManualEntry: (bookId: string, input: ManualEntryInput) => Promise<void>;
  updateEntry: (entryId: string, input: Partial<ManualEntryInput>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  importOrders: (params: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    newBookColor?: string;
    idempotencyKey?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  }) => Promise<CashbookImportResult>;

  // staff read-only oversight
  oversight: CashbookOversightIndex | null;
  oversightLoading: boolean;
  oversightError: string | null;
  loadOversight: (sellerId?: string) => Promise<void>;
  oversightSeller: CashbookOversightSeller | null;
  loadOversightSeller: (sellerId: string) => Promise<void>;

  // finance summary (Escrow-derived payout breakdown — separate concern)
  financeSummary: FinanceSummary | null;
  financeSummaryLoading: boolean;
  financeSummaryError: string | null;
  loadFinanceSummary: (sellerId?: string) => Promise<void>;
}

const CashBookContext = createContext<CashBookContextType | undefined>(undefined);

export const useCashBook = () => {
  const ctx = useContext(CashBookContext);
  if (!ctx) throw new Error('useCashBook must be used within a CashBookProvider');
  return ctx;
};

export const CashBookProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cashbooks, setCashbooks] = useState<CashbookListItem[]>([]);
  const [cashbooksLoading, setCashbooksLoading] = useState(false);
  const [cashbooksError, setCashbooksError] = useState<string | null>(null);

  const [bookDetail, setBookDetail] = useState<CashbookDetail | null>(null);
  const [bookDetailLoading, setBookDetailLoading] = useState(false);
  const [bookDetailError, setBookDetailError] = useState<string | null>(null);

  const [oversight, setOversight] = useState<CashbookOversightIndex | null>(null);
  const [oversightLoading, setOversightLoading] = useState(false);
  const [oversightError, setOversightError] = useState<string | null>(null);
  const [oversightSeller, setOversightSeller] = useState<CashbookOversightSeller | null>(null);

  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeSummaryLoading, setFinanceSummaryLoading] = useState(false);
  const [financeSummaryError, setFinanceSummaryError] = useState<string | null>(null);

  const refreshCashbooks = useCallback(async () => {
    setCashbooksLoading(true);
    setCashbooksError(null);
    try {
      setCashbooks(await cashbookApi.listCashbooks());
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
      setBookDetail(await cashbookApi.getCashbookDetail(bookId, ownerUserId));
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
    await refreshCashbooks();
    return book;
  }, [refreshCashbooks]);

  const renameCashbook = useCallback(
    async (bookId: string, name: string) => {
      const book = await cashbookApi.renameCashbook(bookId, name);
      await refreshCashbooks();
      setBookDetail((prev) => (prev && prev.book.id === bookId ? { ...prev, book } : prev));
      return book;
    },
    [refreshCashbooks],
  );

  const deleteCashbook = useCallback(
    async (bookId: string) => {
      await cashbookApi.deleteCashbook(bookId);
      setBookDetail((prev) => (prev && prev.book.id === bookId ? null : prev));
      await refreshCashbooks();
    },
    [refreshCashbooks],
  );

  const reloadDetailAndList = useCallback(
    async (bookId: string) => {
      await Promise.allSettled([
        cashbookApi.getCashbookDetail(bookId).then(setBookDetail).catch(() => {}),
        refreshCashbooks(),
      ]);
    },
    [refreshCashbooks],
  );

  const addManualEntry = useCallback(
    async (bookId: string, input: ManualEntryInput) => {
      await cashbookApi.createManualEntry(bookId, input);
      await reloadDetailAndList(bookId);
    },
    [reloadDetailAndList],
  );

  const updateEntry = useCallback(
    async (entryId: string, input: Partial<ManualEntryInput>) => {
      const updated = await cashbookApi.updateEntry(entryId, input);
      await reloadDetailAndList(updated.bookId);
    },
    [reloadDetailAndList],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await cashbookApi.deleteCashbookEntry(entryId);
      const bookId = bookDetail?.book.id;
      if (bookId) await reloadDetailAndList(bookId);
      else await refreshCashbooks();
    },
    [bookDetail?.book.id, reloadDetailAndList, refreshCashbooks],
  );

  const importOrders = useCallback(
    async (params: {
      bookId?: string;
      newBookName?: string;
      newBookIcon?: string;
      newBookColor?: string;
      idempotencyKey?: string;
      items: Array<{ orderId: string; orderItemKey?: string }>;
    }) => {
      const result = await cashbookApi.importOrdersToCashbook(params);
      await refreshCashbooks();
      if (bookDetail && bookDetail.book.id === result.book.id) {
        await loadCashbookDetail(result.book.id);
      }
      return result;
    },
    [refreshCashbooks, loadCashbookDetail, bookDetail],
  );

  const loadOversight = useCallback(async (sellerId?: string) => {
    setOversightLoading(true);
    setOversightError(null);
    try {
      const data = await cashbookApi.getCashbookOversight(sellerId);
      if ('owners' in data) setOversight(data);
    } catch (error) {
      setOversight(null);
      setOversightError(error instanceof Error ? error.message : 'Failed to load oversight');
    } finally {
      setOversightLoading(false);
    }
  }, []);

  const loadOversightSeller = useCallback(async (sellerId: string) => {
    setOversightLoading(true);
    setOversightError(null);
    try {
      const data = await cashbookApi.getCashbookOversight(sellerId);
      if ('books' in data) setOversightSeller(data);
    } catch (error) {
      setOversightSeller(null);
      setOversightError(error instanceof Error ? error.message : 'Failed to load seller cashbooks');
    } finally {
      setOversightLoading(false);
    }
  }, []);

  const loadFinanceSummary = useCallback(async (sellerId?: string) => {
    setFinanceSummaryLoading(true);
    setFinanceSummaryError(null);
    try {
      setFinanceSummary(await cashbookApi.getFinanceSummary(sellerId));
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
        renameCashbook,
        deleteCashbook,
        addManualEntry,
        updateEntry,
        deleteEntry,
        importOrders,
        oversight,
        oversightLoading,
        oversightError,
        loadOversight,
        oversightSeller,
        loadOversightSeller,
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
