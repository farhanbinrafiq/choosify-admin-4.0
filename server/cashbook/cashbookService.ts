/**
 * Cashbook service — private seller/creator ledgers.
 *
 * Authorization rules (Sprint 15):
 *  - Every write (create/rename/delete book, manual entry add/edit, delete
 *    entry, import) is SELLER/CREATOR-ONLY. Admin / Super Admin are refused at
 *    THIS layer (403) — never merely hidden in the UI.
 *  - Ownership is ALWAYS the authenticated `actor.userId`; no request field can
 *    choose or widen it.
 *  - Staff get READ-ONLY oversight: list a seller's books, open one book's
 *    ledger. No mutation path exists for them.
 *  - Import: only `delivered` / `completed` Commerce orders; only the seller's
 *    own canonical item `lineTotal` (no delivery / COD / tax / whole-order
 *    total, no estimation). Global per-owner dedupe via `sourceImportKey`.
 *  - This service NEVER mutates Orders / Payments / Escrow / Settlement.
 */
import { CommerceError } from '../commerce/cartService';
import { commerceStore } from '../commerce/commerceStore';
import type { CommerceOrder } from '../commerce/types';
import { operationsStore } from '../operations/operationsStore';
import { ensureEntityReferenceId } from '../referenceIds/referenceIdService';
import {
  addManualEntry,
  cashbookSummary,
  createCashbook,
  deleteCashbook,
  findImportIdempotency,
  getCashbookForOwner,
  getEntryForOwner,
  importResolvedLines,
  listCashbookOwnerIds,
  listCashbooksForOwner,
  listEntriesForBook,
  recordImportIdempotency,
  removeCashbookEntry,
  renameCashbook,
  touchCashbookPersist,
  updateManualEntry,
  type CashbookBook,
  type CashbookEntry,
  type ImportResult,
  type ResolvableLine,
} from './cashbookStore';

function isStaff(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin';
}

/** Cashbooks belong to sellers & creators (decision #6 keeps creator === seller). */
function isPartnerRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'seller' || r === 'verified_seller' || r === 'creator';
}

type Actor = { userId: string; role?: string };

function assertAuthed(actor: Actor): void {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
}

/** Any Cashbook access (read or write) — seller / creator / staff only. */
function assertCashbookActor(actor: Actor): void {
  assertAuthed(actor);
  if (isStaff(actor.role) || isPartnerRole(actor.role)) return;
  throw new CommerceError('Cashbooks are available to sellers and creators only', 403);
}

/** Every Cashbook mutation is seller/creator-only — never staff. */
function assertSellerActor(actor: Actor): void {
  assertAuthed(actor);
  if (isStaff(actor.role)) {
    throw new CommerceError(
      'Cashbook Oversight is read-only — Admins cannot modify seller/creator cashbooks',
      403,
    );
  }
  if (!isPartnerRole(actor.role)) {
    throw new CommerceError('Cashbooks are available to sellers and creators only', 403);
  }
}

function assertOwnerAccess(ownerUserId: string, actor: Actor): void {
  if (isStaff(actor.role)) return; // staff READ oversight
  if (!actor.userId || actor.userId !== ownerUserId) {
    throw new CommerceError('Not authorized for this cashbook', 403);
  }
}

// ── order resolution + eligibility ─────────────────────────────────────

/** Commerce statuses that represent a real, importable accounting event. */
const ELIGIBLE_COMMERCE_STATUS = new Set(['delivered', 'completed']);

type SubLike = Record<string, unknown> & { items?: Array<Record<string, unknown>> };

async function commerceOrderByRef(ref: string): Promise<CommerceOrder | null> {
  if (!ref) return null;
  const direct = await commerceStore.getOrder(ref);
  if (direct) return direct;
  const all = await commerceStore.listOrders();
  return all.find((o) => o.orderNumber === ref) || null;
}

export type LineRejection = { orderId: string; reason: string };

/**
 * Resolve `{ orderId, orderItemKey? }` refs into importable, seller-scoped lines.
 * Refuses (never estimates) a line with no canonical seller amount, and gates
 * on order eligibility. `orderId` in a ref may be a Commerce internal id OR an
 * order number.
 */
async function resolveOwnedLines(
  ownerUserId: string,
  refs: Array<{ orderId: string; orderItemKey?: string }>,
): Promise<{ lines: ResolvableLine[]; rejected: LineRejection[] }> {
  const lines: ResolvableLine[] = [];
  const rejected: LineRejection[] = [];

  for (const ref of refs) {
    const commerce = await commerceOrderByRef(ref.orderId);

    if (commerce) {
      const orderNumber = commerce.orderNumber || commerce.id;
      if (!ELIGIBLE_COMMERCE_STATUS.has(commerce.status)) {
        rejected.push({
          orderId: orderNumber,
          reason: `Order is "${commerce.status}" — only delivered or completed orders can be imported`,
        });
        continue;
      }
      const items = commerce.items || [];
      let matched = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.sellerId !== ownerUserId) continue;
        matched += 1;
        const orderItemKey = `${orderNumber}:${it.listingId}:${i}`;
        if (ref.orderItemKey && ref.orderItemKey !== orderItemKey) continue;
        const lineTotal = Number(it.lineTotal);
        if (!Number.isFinite(lineTotal) || lineTotal <= 0) {
          rejected.push({
            orderId: orderNumber,
            reason: `Line "${it.title}" has no resolvable seller amount`,
          });
          continue;
        }
        lines.push({
          orderId: orderNumber,
          orderItemKey,
          sourceImportKey: `order:${orderNumber}:${it.sellerId}:${it.listingId}:${i}`,
          listingId: it.listingId,
          productTitle: it.title,
          brandId: it.brandId,
          brandName: it.brandName,
          sellerId: it.sellerId,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.finalUnitPrice ?? it.unitPrice) || 0,
          lineTotal,
          orderDate: commerce.createdAt,
          orderStatus: commerce.status,
          category: undefined,
        });
      }
      if (matched === 0) {
        rejected.push({ orderId: orderNumber, reason: 'No line items you sold on this order' });
      }
      continue;
    }

    // Operations-only order (manual offer / booking — never had a Commerce order)
    const ops = operationsStore.getOrder(ref.orderId);
    if (!ops) {
      rejected.push({ orderId: ref.orderId, reason: 'Order not found' });
      continue;
    }
    const opsCompleted = ops.status === 'completed';
    const subs = (ops.subOrders || []) as SubLike[];
    let matched = 0;
    subs.forEach((sub, subIdx) => {
      if (sub.sellerId !== ownerUserId) return;
      const subItems = (sub.items || []) as Array<Record<string, unknown>>;
      subItems.forEach((it, i) => {
        matched += 1;
        const delivered = Boolean(it.deliveredAt);
        if (!opsCompleted && !delivered) {
          rejected.push({
            orderId: ops.orderId,
            reason: 'Order line is not delivered/completed yet',
          });
          return;
        }
        const listingId = String(it.listingId || it.productId || `line_${subIdx}_${i}`);
        const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
        const unit = Number(it.unitPrice ?? it.price ?? 0) || 0;
        const lineTotal = Number(it.lineTotal ?? it.total ?? unit * qty);
        if (!Number.isFinite(lineTotal) || lineTotal <= 0) {
          rejected.push({
            orderId: ops.orderId,
            reason: `Line "${String(it.productTitle || it.title || listingId)}" has no resolvable seller amount`,
          });
          return;
        }
        const itemId = String(it.itemId || `${listingId}:${i}`);
        const orderItemKey = `${ops.orderId}:${listingId}:${subIdx}:${i}`;
        if (ref.orderItemKey && ref.orderItemKey !== orderItemKey) return;
        lines.push({
          orderId: ops.orderId,
          orderItemKey,
          sourceImportKey: `order:${ops.orderId}:${ownerUserId}:${itemId}`,
          sourceSubOrderId: String(sub.subOrderId || sub.id || subIdx),
          listingId,
          productTitle: String(it.productTitle || it.title || 'Order item'),
          brandId: String(sub.brandId || it.brandId || ''),
          brandName: String(sub.brandName || it.brandName || ''),
          sellerId: ownerUserId,
          quantity: qty,
          unitPrice: unit,
          lineTotal,
          orderDate: ops.createdAt,
          orderStatus: ops.status,
          category: String(it.categoryName || it.category || '') || undefined,
        });
      });
    });
    if (matched === 0) {
      rejected.push({ orderId: ops.orderId, reason: 'No line items you sold on this order' });
    }
  }

  return { lines, rejected };
}

// ── refund / return enrichment (read-time, best-effort, never mutates) ──

export type EntryOrderState = {
  liveOrderStatus?: string;
  orderFlags: string[]; // e.g. ['cancelled'] | ['returned'] | ['status_changed']
  orderChanged: boolean;
};

async function enrichEntriesWithOrderState(
  entries: CashbookEntry[],
  ownerUserId: string,
): Promise<Array<CashbookEntry & Partial<EntryOrderState>>> {
  const importRefs = [
    ...new Set(entries.filter((e) => e.source === 'order_import' && e.orderId).map((e) => e.orderId!)),
  ];
  if (!importRefs.length) return entries.map((e) => ({ ...e, orderFlags: [], orderChanged: false }));

  let allCommerce: CommerceOrder[] = [];
  try {
    allCommerce = await commerceStore.listOrders();
  } catch {
    /* best-effort */
  }
  const byNumber = new Map<string, CommerceOrder>();
  const byId = new Map<string, CommerceOrder>();
  for (const o of allCommerce) {
    byNumber.set(o.orderNumber, o);
    byId.set(o.id, o);
  }

  return entries.map((e) => {
    if (e.source !== 'order_import' || !e.orderId) {
      return { ...e, orderFlags: [], orderChanged: false };
    }
    const commerce = byNumber.get(e.orderId) || byId.get(e.orderId) || null;
    const flags: string[] = [];
    let liveOrderStatus: string | undefined;
    if (commerce) {
      liveOrderStatus = commerce.status;
      if (commerce.status === 'cancelled') flags.push('cancelled');
      const snap = e.sourceOrderStatusAtImport || e.orderStatus;
      if (
        snap &&
        commerce.status !== snap &&
        !ELIGIBLE_COMMERCE_STATUS.has(commerce.status)
      ) {
        flags.push('status_changed');
      }
      const opsId = commerce.orderNumber;
      try {
        const rets = operationsStore.listReturns({ orderId: opsId, sellerId: ownerUserId });
        if (rets.length) flags.push('returned');
      } catch {
        /* ignore */
      }
    } else {
      try {
        const rets = operationsStore.listReturns({ orderId: e.orderId, sellerId: ownerUserId });
        if (rets.length) flags.push('returned');
        const ops = operationsStore.getOrder(e.orderId);
        if (ops) {
          liveOrderStatus = ops.status;
          if (ops.status === 'cancelled') flags.push('cancelled');
        }
      } catch {
        /* ignore */
      }
    }
    const uniqueFlags = [...new Set(flags)];
    return {
      ...e,
      liveOrderStatus,
      orderFlags: uniqueFlags,
      orderChanged: uniqueFlags.length > 0,
    };
  });
}

// ── read APIs ─────────────────────────────────────────────────────────

export async function listMyCashbooks(actor: Actor) {
  assertCashbookActor(actor);
  return listCashbooksForOwner(actor.userId).map((b) => ({
    ...b,
    summary: cashbookSummary(b.id, actor.userId),
  }));
}

export async function getMyCashbookDetail(
  actor: Actor,
  bookId: string,
  opts?: { ownerUserId?: string },
) {
  assertCashbookActor(actor);
  const ownerId = isStaff(actor.role) && opts?.ownerUserId ? opts.ownerUserId : actor.userId;
  assertOwnerAccess(ownerId, actor);
  const book = getCashbookForOwner(bookId, ownerId);
  if (!book) throw new CommerceError('Cashbook not found', 404);
  const entries = await enrichEntriesWithOrderState(
    listEntriesForBook(bookId, ownerId),
    ownerId,
  );
  return {
    book,
    summary: cashbookSummary(bookId, ownerId),
    entries,
    readOnly: isStaff(actor.role),
  };
}

// ── staff oversight (READ-ONLY) ───────────────────────────────────────

export async function listCashbookOversight(actor: Actor, sellerId?: string) {
  assertAuthed(actor);
  if (!isStaff(actor.role)) {
    throw new CommerceError('Cashbook Oversight is staff-only', 403);
  }

  if (sellerId && sellerId.trim()) {
    const owner = sellerId.trim();
    const books = listCashbooksForOwner(owner).map((b) => ({
      ...b,
      summary: cashbookSummary(b.id, owner),
    }));
    let accountName: string | undefined;
    let brandName: string | undefined;
    let brandNames: string[] = [];
    try {
      const { db } = await import('../db/client');
      const { users } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      const [u] = await db
        .select({ displayName: users.displayName, email: users.email })
        .from(users)
        .where(eq(users.id, owner));
      accountName = u?.displayName || u?.email || `Account ${owner.slice(0, 8)}…`;
    } catch {
      /* best-effort */
    }
    try {
      const { catalogStore } = await import('../../lib/vercel-catalog/catalogStore');
      const brands = (await catalogStore.listBrands()) as Array<{ sellerId?: string; name?: string }>;
      brandNames = brands.filter((b) => String(b.sellerId || '') === owner && b.name).map((b) => String(b.name));
      brandName = brandNames[0];
    } catch {
      /* best-effort */
    }
    return { sellerId: owner, accountName, brandName, brandNames, books };
  }

  const ownerIds = listCashbookOwnerIds();
  let profiles: Record<string, { displayName?: string; email?: string; choosifyUserId?: string; role?: string }> = {};
  try {
    const { db } = await import('../db/client');
    const { users } = await import('../db/schema');
    const { inArray } = await import('drizzle-orm');
    if (ownerIds.length) {
      const rows = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          choosifyUserId: users.choosifyUserId,
          role: users.role,
        })
        .from(users)
        .where(inArray(users.id, ownerIds));
      profiles = Object.fromEntries(
        rows.map((r) => [
          r.id,
          {
            displayName: r.displayName || undefined,
            email: r.email || undefined,
            choosifyUserId: r.choosifyUserId || undefined,
            role: (r.role as string) || undefined,
          },
        ]),
      );
    }
  } catch {
    /* best-effort — the raw id is still returned */
  }

  // Primary folder label = the owner's brand name where one exists (a seller may
  // manage more than one brand → keep them all, first is the headline).
  const brandsByOwner: Record<string, string[]> = {};
  try {
    const { catalogStore } = await import('../../lib/vercel-catalog/catalogStore');
    const brands = (await catalogStore.listBrands()) as Array<{ sellerId?: string; name?: string }>;
    for (const b of brands) {
      const sid = String(b.sellerId || '').trim();
      if (!sid || !b.name) continue;
      (brandsByOwner[sid] ||= []).push(String(b.name));
    }
  } catch {
    /* best-effort — fall back to account name */
  }

  const owners = ownerIds.map((ownerUserId) => {
    const books = listCashbooksForOwner(ownerUserId);
    const summaries = books.map((b) => cashbookSummary(b.id, ownerUserId));
    const brandNames = brandsByOwner[ownerUserId] || [];
    const p = profiles[ownerUserId];
    return {
      ownerUserId,
      /** Headline label: brand → display name → email → short id. */
      brandName: brandNames[0],
      brandNames,
      accountName: p?.displayName || p?.email || `Account ${ownerUserId.slice(0, 8)}…`,
      displayName: p?.displayName,
      email: p?.email,
      choosifyUserId: p?.choosifyUserId,
      role: p?.role,
      bookCount: books.length,
      entryCount: summaries.reduce((a, s) => a + s.entryCount, 0),
      moneyIn: summaries.reduce((a, s) => a + s.moneyIn, 0),
      moneyOut: summaries.reduce((a, s) => a + s.moneyOut, 0),
      updatedAt: books[0]?.updatedAt,
    };
  });
  owners.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return { owners };
}

// ── book mutations (seller/creator only) ──────────────────────────────

export async function createMyCashbook(
  actor: Actor,
  input: { name: string; icon?: string; color?: string },
) {
  assertSellerActor(actor);
  const name = String(input.name || '').trim();
  if (!name) throw new CommerceError('Book Name is required', 400);
  const book = createCashbook({
    ownerUserId: actor.userId,
    name,
    icon: input.icon,
    color: input.color,
  });
  try {
    book.cashbookReferenceId = await ensureEntityReferenceId({
      entityType: 'cashbook',
      internalId: book.id,
      current: book.cashbookReferenceId,
    });
    touchCashbookPersist();
  } catch {
    /* allocation failure should not block create; backfill can repair */
  }
  return book as CashbookBook;
}

export async function renameMyCashbook(actor: Actor, bookId: string, name: string) {
  assertSellerActor(actor);
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new CommerceError('Book Name is required', 400);
  const book = renameCashbook(bookId, actor.userId, trimmed);
  if (!book) throw new CommerceError('Cashbook not found', 404);
  return book;
}

export async function deleteMyCashbook(actor: Actor, bookId: string) {
  assertSellerActor(actor);
  const res = deleteCashbook(bookId, actor.userId);
  if (!res.deleted) throw new CommerceError('Cashbook not found', 404);
  return { ...res, mutatedOrder: false, mutatedPayment: false, mutatedEscrow: false };
}

// ── entry mutations (seller/creator only) ─────────────────────────────

export async function createManualCashbookEntry(
  actor: Actor,
  bookId: string,
  input: {
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
  },
) {
  assertSellerActor(actor);
  const book = getCashbookForOwner(bookId, actor.userId);
  if (!book) throw new CommerceError('Cashbook not found', 404);
  const magnitude = Math.abs(Number(input.amount));
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new CommerceError('Enter a valid amount', 400);
  }
  const signed = input.direction === 'out' ? -magnitude : magnitude;
  try {
    return addManualEntry({
      bookId,
      ownerUserId: actor.userId,
      amount: signed,
      description: input.description || '',
      category: input.category,
      contact: input.contact,
      paymentMode: input.paymentMode,
      docRef: input.docRef,
      entryDate: input.entryDate,
      entryTime: input.entryTime,
      linkedOrderId: input.linkedOrderId,
    });
  } catch (err) {
    throw new CommerceError(err instanceof Error ? err.message : 'Failed to add entry', 400);
  }
}

export async function updateManualCashbookEntry(
  actor: Actor,
  entryId: string,
  input: {
    direction?: 'in' | 'out';
    amount?: number;
    description?: string;
    category?: string;
    contact?: string;
    paymentMode?: string;
    docRef?: string;
    entryDate?: string;
    entryTime?: string;
  },
) {
  assertSellerActor(actor);
  const existing = getEntryForOwner(entryId, actor.userId);
  if (!existing) throw new CommerceError('Entry not found', 404);
  if (existing.source !== 'manual') {
    throw new CommerceError('Imported order entries are immutable history and cannot be edited', 409);
  }
  let amount: number | undefined;
  if (input.amount !== undefined || input.direction !== undefined) {
    const magnitude = Math.abs(Number(input.amount ?? Math.abs(existing.amount)));
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new CommerceError('Enter a valid amount', 400);
    }
    const dir = input.direction || (existing.amount < 0 ? 'out' : 'in');
    amount = dir === 'out' ? -magnitude : magnitude;
  }
  try {
    const updated = updateManualEntry(entryId, actor.userId, {
      amount,
      description: input.description,
      category: input.category,
      contact: input.contact,
      paymentMode: input.paymentMode,
      docRef: input.docRef,
      entryDate: input.entryDate,
      entryTime: input.entryTime,
    });
    if (!updated) throw new CommerceError('Entry not found', 404);
    return updated;
  } catch (err) {
    if (err instanceof CommerceError) throw err;
    throw new CommerceError(err instanceof Error ? err.message : 'Failed to update entry', 400);
  }
}

export async function deleteMyCashbookEntry(actor: Actor, entryId: string) {
  assertSellerActor(actor);
  const ok = removeCashbookEntry(entryId, actor.userId);
  if (!ok) throw new CommerceError('Entry not found', 404);
  // Explicit: does NOT touch Order / Payment / Escrow / Settlement.
  return { deleted: true, mutatedOrder: false, mutatedPayment: false, mutatedEscrow: false };
}

// ── order import (seller/creator only) ────────────────────────────────

export async function importOrdersToCashbook(
  actor: Actor,
  params: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    newBookColor?: string;
    idempotencyKey?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  },
): Promise<ImportResult & { rejected: LineRejection[]; createdBook: boolean; reused?: boolean }> {
  assertSellerActor(actor);
  if (!Array.isArray(params.items) || !params.items.length) {
    throw new CommerceError('Select at least one order item', 400);
  }

  const idemKey = (params.idempotencyKey || '').trim();
  if (idemKey) {
    const prior = findImportIdempotency<
      ImportResult & { rejected: LineRejection[]; createdBook: boolean }
    >(actor.userId, idemKey);
    if (prior) return { ...prior, reused: true };
  }

  // Resolve BEFORE creating anything — an all-ineligible batch must not leave
  // an orphan empty book.
  const { lines, rejected } = await resolveOwnedLines(actor.userId, params.items);

  let bookId = params.bookId;
  let createdBookId: string | null = null;

  if (!bookId) {
    const name = String(params.newBookName || '').trim();
    if (!name) throw new CommerceError('Book Name is required', 400);
    if (!lines.length) {
      throw new CommerceError(
        'None of the selected orders can be imported (only delivered / completed orders with a resolvable seller amount are eligible).',
        422,
        { code: 'IMPORT_NOTHING_ELIGIBLE', details: { rejected } },
      );
    }
    const book = createCashbook({
      ownerUserId: actor.userId,
      name,
      icon: params.newBookIcon,
      color: params.newBookColor,
    });
    bookId = book.id;
    createdBookId = book.id;
    try {
      book.cashbookReferenceId = await ensureEntityReferenceId({
        entityType: 'cashbook',
        internalId: book.id,
        current: book.cashbookReferenceId,
      });
      touchCashbookPersist();
    } catch {
      /* non-fatal */
    }
  } else {
    const book = getCashbookForOwner(bookId, actor.userId);
    if (!book) throw new CommerceError('Cashbook not found', 404);
  }

  let result: ImportResult;
  try {
    result = importResolvedLines(bookId, actor.userId, lines);
  } catch (err) {
    if (createdBookId) deleteCashbook(createdBookId, actor.userId); // rollback orphan
    throw err instanceof CommerceError
      ? err
      : new CommerceError(err instanceof Error ? err.message : 'Import failed', 500);
  }

  // Created a fresh book but nothing new landed (all dupes / failed) → roll it
  // back and tell the truth rather than leaving an empty book behind.
  if (createdBookId && result.imported === 0) {
    deleteCashbook(createdBookId, actor.userId);
    throw new CommerceError(
      'No new entries were imported, so no cashbook was created.',
      422,
      { code: 'IMPORT_NOTHING_NEW', details: { rows: result.details, rejected } },
    );
  }

  const payload = { ...result, rejected, createdBook: Boolean(createdBookId) };
  if (idemKey) recordImportIdempotency(actor.userId, idemKey, payload);
  return payload;
}
