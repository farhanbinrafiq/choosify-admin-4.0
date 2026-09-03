/**
 * Seller/Creator Cashbook — private management books (NOT the Commerce/Payment/
 * Escrow source of truth). Memory-disk persistence (escrow/ads pattern).
 *
 * Sprint 15 rebuild:
 *  - entries are `order_import` (immutable snapshot of a seller-owned Commerce
 *    order line) OR `manual` (seller-authored Cash In / Cash Out).
 *  - imported lines carry an IMMUTABLE `sourceImportKey`, unique per owner across
 *    ALL of their books — the same order line can never be counted twice by
 *    importing it into a second book. A legacy `bookId+orderId+orderItemKey`
 *    guard is kept as a secondary check for pre-Sprint-15 rows.
 *  - manual entries (and only manual entries) can be edited; imported entries
 *    are frozen history. Refund/return reconciliation is a SEPARATE compensating
 *    manual entry, never a rewrite of the original.
 *  - Admin/Super Admin have NO write path here (enforced in cashbookService).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type CashbookEntrySource = 'manual' | 'order_import';

export type CashbookEntry = {
  entryId: string;
  bookId: string;
  ownerUserId: string;
  source: CashbookEntrySource;
  /** Signed: Cash In positive, Cash Out negative. */
  amount: number;
  currency: string;
  /** Free-text remarks / description. */
  description: string;
  category?: string;

  // ── manual-entry fields (source === 'manual') ─────────────────────────
  contact?: string;
  paymentMode?: string;
  docRef?: string;
  /** User-declared date/time for a manual entry. */
  entryDate?: string;
  entryTime?: string;
  /** Optional link to a Commerce order this manual adjustment compensates. */
  linkedOrderId?: string;

  // ── order-import fields (source === 'order_import') — IMMUTABLE ────────
  orderId?: string;
  orderItemKey?: string;
  /** Global immutable dedupe key — unique per owner across ALL their books. */
  sourceImportKey?: string;
  sourceType?: 'order';
  sourceSellerId?: string;
  sourceSubOrderId?: string;
  /** Commerce order status captured at import time (frozen). */
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

  createdAt: string;
  updatedAt: string;
};

/** @deprecated legacy alias — kept so external imports keep compiling. */
export type CashbookOrderImportEntry = CashbookEntry;

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
  entries: CashbookEntry[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'cashbook-memory-snapshot.json');

function snapshotPath(): string {
  return process.env.CASHBOOK_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

const state: { books: CashbookBook[]; entries: CashbookEntry[] } = {
  books: [],
  entries: [],
};

/** Not persisted — a short-lived idempotency guard for create-book + import. */
const importIdempotency = new Map<string, { result: unknown; at: number }>();
const IMPORT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

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

// ── books ──────────────────────────────────────────────────────────────

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

export function renameCashbook(
  bookId: string,
  ownerUserId: string,
  name: string,
): CashbookBook | null {
  ensureCashbookHydrated();
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Book Name is required');
  const book = getCashbookForOwner(bookId, ownerUserId);
  if (!book) return null;
  book.name = trimmed;
  book.updatedAt = nowIso();
  schedulePersist();
  return book;
}

export function deleteCashbook(
  bookId: string,
  ownerUserId: string,
): { deleted: boolean; removedEntries: number } {
  ensureCashbookHydrated();
  const idx = state.books.findIndex((b) => b.id === bookId && b.ownerUserId === ownerUserId);
  if (idx < 0) return { deleted: false, removedEntries: 0 };
  state.books.splice(idx, 1);
  const before = state.entries.length;
  state.entries = state.entries.filter(
    (e) => !(e.bookId === bookId && e.ownerUserId === ownerUserId),
  );
  schedulePersist();
  return { deleted: true, removedEntries: before - state.entries.length };
}

export function touchCashbookPersist(): void {
  ensureCashbookHydrated();
  schedulePersist();
}

/** Distinct owner userIds that have at least one book (staff oversight index). */
export function listCashbookOwnerIds(): string[] {
  ensureCashbookHydrated();
  return [...new Set(state.books.map((b) => b.ownerUserId))];
}

// ── entries ────────────────────────────────────────────────────────────

export function listEntriesForBook(bookId: string, ownerUserId: string): CashbookEntry[] {
  ensureCashbookHydrated();
  const book = getCashbookForOwner(bookId, ownerUserId);
  if (!book) return [];
  return state.entries
    .filter((e) => e.bookId === bookId && e.ownerUserId === ownerUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getEntryForOwner(entryId: string, ownerUserId: string): CashbookEntry | null {
  ensureCashbookHydrated();
  return (
    state.entries.find((e) => e.entryId === entryId && e.ownerUserId === ownerUserId) || null
  );
}

export function cashbookSummary(bookId: string, ownerUserId: string) {
  const entries = listEntriesForBook(bookId, ownerUserId);
  const moneyIn = entries.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const moneyOut = entries
    .filter((e) => e.amount < 0)
    .reduce((a, e) => a + Math.abs(e.amount), 0);
  const net = moneyIn - moneyOut;
  const imported = entries.filter((e) => e.source === 'order_import');
  const manual = entries.filter((e) => e.source === 'manual');
  const orderIds = new Set(imported.map((e) => e.orderId).filter(Boolean));
  const totalItems = imported.reduce((a, e) => a + (e.quantity || 1), 0);
  return {
    moneyIn,
    moneyOut,
    net,
    importedCount: imported.length,
    manualCount: manual.length,
    // kept for backward compatibility with existing callers / probes
    totalSales: orderIds.size,
    totalRevenue: moneyIn,
    netRevenue: net,
    totalItems,
    averageOrderValue: orderIds.size ? Math.round(moneyIn / orderIds.size) : 0,
    entryCount: entries.length,
  };
}

export function addManualEntry(input: {
  bookId: string;
  ownerUserId: string;
  /** Signed: Cash In > 0, Cash Out < 0. */
  amount: number;
  description: string;
  category?: string;
  contact?: string;
  paymentMode?: string;
  docRef?: string;
  entryDate?: string;
  entryTime?: string;
  linkedOrderId?: string;
  currency?: string;
}): CashbookEntry {
  ensureCashbookHydrated();
  const book = getCashbookForOwner(input.bookId, input.ownerUserId);
  if (!book) throw new Error('Cashbook not found');
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Enter a non-zero amount');
  }
  const entry: CashbookEntry = {
    entryId: `cbe_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    bookId: input.bookId,
    ownerUserId: input.ownerUserId,
    source: 'manual',
    amount: input.amount,
    currency: input.currency || 'BDT',
    description: (input.description || '').trim(),
    category: input.category?.trim() || undefined,
    contact: input.contact?.trim() || undefined,
    paymentMode: input.paymentMode?.trim() || undefined,
    docRef: input.docRef?.trim() || undefined,
    entryDate: input.entryDate?.trim() || undefined,
    entryTime: input.entryTime?.trim() || undefined,
    linkedOrderId: input.linkedOrderId?.trim() || undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.entries.unshift(entry);
  book.updatedAt = nowIso();
  schedulePersist();
  return entry;
}

/** Edit a MANUAL entry only. Imported entries are immutable → returns null. */
export function updateManualEntry(
  entryId: string,
  ownerUserId: string,
  patch: {
    amount?: number;
    description?: string;
    category?: string;
    contact?: string;
    paymentMode?: string;
    docRef?: string;
    entryDate?: string;
    entryTime?: string;
  },
): CashbookEntry | null {
  ensureCashbookHydrated();
  const entry = state.entries.find(
    (e) => e.entryId === entryId && e.ownerUserId === ownerUserId,
  );
  if (!entry || entry.source !== 'manual') return null;
  if (patch.amount !== undefined) {
    if (!Number.isFinite(patch.amount) || patch.amount === 0) {
      throw new Error('Enter a non-zero amount');
    }
    entry.amount = patch.amount;
  }
  if (patch.description !== undefined) entry.description = patch.description.trim();
  if (patch.category !== undefined) entry.category = patch.category.trim() || undefined;
  if (patch.contact !== undefined) entry.contact = patch.contact.trim() || undefined;
  if (patch.paymentMode !== undefined) entry.paymentMode = patch.paymentMode.trim() || undefined;
  if (patch.docRef !== undefined) entry.docRef = patch.docRef.trim() || undefined;
  if (patch.entryDate !== undefined) entry.entryDate = patch.entryDate.trim() || undefined;
  if (patch.entryTime !== undefined) entry.entryTime = patch.entryTime.trim() || undefined;
  entry.updatedAt = nowIso();
  const book = state.books.find((b) => b.id === entry.bookId);
  if (book) book.updatedAt = nowIso();
  schedulePersist();
  return entry;
}

export function removeCashbookEntry(entryId: string, ownerUserId: string): boolean {
  ensureCashbookHydrated();
  const idx = state.entries.findIndex(
    (e) => e.entryId === entryId && e.ownerUserId === ownerUserId,
  );
  if (idx < 0) return false;
  const bookId = state.entries[idx].bookId;
  state.entries.splice(idx, 1);
  const book = state.books.find((b) => b.id === bookId);
  if (book) book.updatedAt = nowIso();
  schedulePersist();
  return true;
}

// ── order import ───────────────────────────────────────────────────────

export type ResolvableLine = {
  orderId: string;
  orderItemKey: string;
  /** Immutable, owner-global dedupe key. */
  sourceImportKey: string;
  sourceSubOrderId?: string;
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

export type ImportDetailRow = {
  orderId: string;
  orderItemKey: string;
  status: 'imported' | 'skipped' | 'failed';
  reason?: string;
  /** For a skip, the book that already holds this line. */
  existingBookId?: string;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  book: CashbookBook;
  details: ImportDetailRow[];
};

/** True if this owner already imported the line into ANY of their books. */
export function findEntryBySourceImportKey(
  ownerUserId: string,
  sourceImportKey: string,
): CashbookEntry | null {
  ensureCashbookHydrated();
  if (!sourceImportKey) return null;
  return (
    state.entries.find(
      (e) => e.ownerUserId === ownerUserId && e.sourceImportKey === sourceImportKey,
    ) || null
  );
}

/**
 * Persist resolved lines into a book. The caller has already verified book
 * ownership and resolved each line SERVER-side. Dedupe is:
 *   1) GLOBAL per owner via `sourceImportKey` (primary), and
 *   2) legacy per-book `orderId + orderItemKey` (secondary, for old rows).
 */
export function importResolvedLines(
  bookId: string,
  ownerUserId: string,
  lines: ResolvableLine[],
): ImportResult {
  ensureCashbookHydrated();
  const book = getCashbookForOwner(bookId, ownerUserId);
  if (!book) throw new Error('Cashbook not found');

  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, book, details: [] };

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
    if (!Number.isFinite(line.lineTotal) || line.lineTotal <= 0) {
      result.failed += 1;
      result.details.push({
        orderId: line.orderId,
        orderItemKey: line.orderItemKey,
        status: 'failed',
        reason: 'No resolvable seller-attributable amount for this line',
      });
      continue;
    }
    const dupGlobal = findEntryBySourceImportKey(ownerUserId, line.sourceImportKey);
    const dupLegacy = state.entries.find(
      (e) =>
        e.bookId === bookId &&
        e.ownerUserId === ownerUserId &&
        e.orderId === line.orderId &&
        e.orderItemKey === line.orderItemKey,
    );
    const dup = dupGlobal || dupLegacy;
    if (dup) {
      result.skipped += 1;
      result.details.push({
        orderId: line.orderId,
        orderItemKey: line.orderItemKey,
        status: 'skipped',
        reason:
          dup.bookId === bookId ? 'Already imported into this book' : 'Already imported',
        existingBookId: dup.bookId,
      });
      continue;
    }
    const entry: CashbookEntry = {
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
      sourceImportKey: line.sourceImportKey,
      sourceType: 'order',
      sourceSellerId: line.sellerId,
      sourceSubOrderId: line.sourceSubOrderId,
      sourceOrderStatusAtImport: line.orderStatus,
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

// ── import idempotency (create-book + import double-click guard) ─────────

export function findImportIdempotency<T = unknown>(
  ownerUserId: string,
  key: string,
): T | null {
  if (!key) return null;
  const hit = importIdempotency.get(`${ownerUserId}::${key}`);
  if (!hit) return null;
  if (Date.now() - hit.at > IMPORT_IDEMPOTENCY_TTL_MS) {
    importIdempotency.delete(`${ownerUserId}::${key}`);
    return null;
  }
  return hit.result as T;
}

export function recordImportIdempotency(
  ownerUserId: string,
  key: string,
  result: unknown,
): void {
  if (!key) return;
  importIdempotency.set(`${ownerUserId}::${key}`, { result, at: Date.now() });
}
