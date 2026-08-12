/**
 * Seller/Creator Cashbook — internal management books (not Commerce/Payment/Escrow SoT).
 * Memory-disk persistence (escrow/ads pattern).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type CashbookEntrySource = 'manual' | 'order_import';

export type CashbookOrderImportEntry = {
  entryId: string;
  bookId: string;
  ownerUserId: string;
  source: CashbookEntrySource;
  /** Signed amount: sales positive for reporting revenue. */
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
};

export type CashbookBook = {
  id: string;
  ownerUserId: string;
  name: string;
  /** Permanent Choosify Cashbook Reference ID (CB-#####). */
  cashbookReferenceId?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

type Snapshot = {
  version: 1;
  savedAt: string;
  books: CashbookBook[];
  entries: CashbookOrderImportEntry[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'cashbook-memory-snapshot.json');

function snapshotPath(): string {
  return process.env.CASHBOOK_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

const state: { books: CashbookBook[]; entries: CashbookOrderImportEntry[] } = {
  books: [],
  entries: [],
};

let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const path = snapshotPath();
      mkdirSync(dirname(path), { recursive: true });
      const snap: Snapshot = {
        version: 1,
        savedAt: nowIso(),
        books: state.books,
        entries: state.entries,
      };
      writeFileSync(path, JSON.stringify(snap), 'utf8');
    } catch (error) {
      console.error('[CashbookMemoryPersist] Failed to save:', error);
    }
  }, 250);
}

export function ensureCashbookHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  const path = snapshotPath();
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
    if (parsed?.version !== 1) return;
    state.books = Array.isArray(parsed.books) ? parsed.books : [];
    state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    console.log(
      `[CashbookMemoryPersist] Hydrated (${state.books.length} books, ${state.entries.length} entries).`,
    );
  } catch (error) {
    console.warn('[CashbookMemoryPersist] Failed to load snapshot:', error);
  }
}

export function listCashbooksForOwner(ownerUserId: string): CashbookBook[] {
  ensureCashbookHydrated();
  return state.books
    .filter((b) => b.ownerUserId === ownerUserId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCashbookForOwner(bookId: string, ownerUserId: string): CashbookBook | null {
  ensureCashbookHydrated();
  const book = state.books.find((b) => b.id === bookId) || null;
  if (!book || book.ownerUserId !== ownerUserId) return null;
  return book;
}

export function createCashbook(input: {
  ownerUserId: string;
  name: string;
  icon?: string;
  color?: string;
}): CashbookBook {
  ensureCashbookHydrated();
  const name = input.name.trim();
  if (!name) throw new Error('Book Name is required');
  const book: CashbookBook = {
    id: `cb_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    ownerUserId: input.ownerUserId,
    name,
    icon: (input.icon || '📒').trim() || '📒',
    color: input.color || '#EF3C23',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.books.unshift(book);
  schedulePersist();
  return book;
}

export function touchCashbookPersist(): void {
  ensureCashbookHydrated();
  schedulePersist();
}

export function listEntriesForBook(bookId: string, ownerUserId: string): CashbookOrderImportEntry[] {
  ensureCashbookHydrated();
  const book = getCashbookForOwner(bookId, ownerUserId);
  if (!book) return [];
  return state.entries
    .filter((e) => e.bookId === bookId && e.ownerUserId === ownerUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cashbookSummary(bookId: string, ownerUserId: string) {
  const entries = listEntriesForBook(bookId, ownerUserId);
  const sales = entries.filter((e) => e.amount > 0);
  const totalRevenue = sales.reduce((a, e) => a + e.amount, 0);
  const totalItems = sales.reduce((a, e) => a + (e.quantity || 1), 0);
  const orderIds = new Set(sales.map((e) => e.orderId).filter(Boolean));
  return {
    totalSales: orderIds.size,
    totalRevenue,
    netRevenue: totalRevenue,
    totalItems,
    averageOrderValue: orderIds.size ? Math.round(totalRevenue / orderIds.size) : 0,
    entryCount: entries.length,
  };
}

export function removeCashbookEntry(entryId: string, ownerUserId: string): boolean {
  ensureCashbookHydrated();
  const idx = state.entries.findIndex((e) => e.entryId === entryId && e.ownerUserId === ownerUserId);
  if (idx < 0) return false;
  const bookId = state.entries[idx].bookId;
  state.entries.splice(idx, 1);
  const book = state.books.find((b) => b.id === bookId);
  if (book) book.updatedAt = nowIso();
  schedulePersist();
  return true;
}

export type ImportOrderItemInput = {
  orderId: string;
  orderItemKey?: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  book: CashbookBook;
  details: Array<{ orderId: string; orderItemKey: string; status: 'imported' | 'skipped' | 'failed'; reason?: string }>;
};

type ResolvableLine = {
  orderId: string;
  orderItemKey: string;
  listingId: string;
  productTitle: string;
  brandId: string;
  brandName: string;
  sellerId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderDate: string;
  orderStatus: string;
  category?: string;
};

/**
 * Import authoritative order lines into a cashbook.
 * Caller must resolve lines server-side; this only persists + dedupes.
 */
export function importResolvedLines(
  bookId: string,
  ownerUserId: string,
  lines: ResolvableLine[],
): ImportResult {
  ensureCashbookHydrated();
  const book = getCashbookForOwner(bookId, ownerUserId);
  if (!book) throw new Error('Cashbook not found');

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    book,
    details: [],
  };

  for (const line of lines) {
    if (line.sellerId !== ownerUserId) {
      result.failed += 1;
      result.details.push({
        orderId: line.orderId,
        orderItemKey: line.orderItemKey,
        status: 'failed',
        reason: 'Not authorized for this order item',
      });
      continue;
    }
    const exists = state.entries.some(
      (e) =>
        e.bookId === bookId &&
        e.ownerUserId === ownerUserId &&
        e.orderId === line.orderId &&
        e.orderItemKey === line.orderItemKey,
    );
    if (exists) {
      result.skipped += 1;
      result.details.push({
        orderId: line.orderId,
        orderItemKey: line.orderItemKey,
        status: 'skipped',
        reason: 'Already imported',
      });
      continue;
    }
    const entry: CashbookOrderImportEntry = {
      entryId: `cbe_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      bookId,
      ownerUserId,
      source: 'order_import',
      amount: line.lineTotal,
      currency: 'BDT',
      description: `${line.productTitle} × ${line.quantity}`,
      category: line.category,
      orderId: line.orderId,
      orderItemKey: line.orderItemKey,
      listingId: line.listingId,
      productTitle: line.productTitle,
      brandId: line.brandId,
      brandName: line.brandName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      orderDate: line.orderDate,
      orderStatus: line.orderStatus,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.entries.unshift(entry);
    result.imported += 1;
    result.details.push({
      orderId: line.orderId,
      orderItemKey: line.orderItemKey,
      status: 'imported',
    });
  }

  book.updatedAt = nowIso();
  schedulePersist();
  return result;
}
