/**
 * Cashbook import service — resolves authoritative Commerce Order lines.
 * Does not mutate Orders / Payments / Escrow.
 */
import { CommerceError } from '../commerce/cartService';
import { commerceStore } from '../commerce/commerceStore';
import { operationsStore } from '../operations/operationsStore';
import {
  createCashbook,
  getCashbookForOwner,
  importResolvedLines,
  listCashbooksForOwner,
  listEntriesForBook,
  cashbookSummary,
  removeCashbookEntry,
  touchCashbookPersist,
  type ImportResult,
  type CashbookBook,
} from './cashbookStore';
import { ensureEntityReferenceId } from '../referenceIds/referenceIdService';

function isStaff(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin';
}

function assertOwnerAccess(ownerUserId: string, actor: { userId: string; role?: string }): void {
  if (isStaff(actor.role)) return;
  if (!actor.userId || actor.userId !== ownerUserId) {
    throw new CommerceError('Not authorized for this cashbook', 403);
  }
}

type SubLike = {
  sellerId?: string;
  brandId?: string;
  brandName?: string;
  title?: string;
  productTitle?: string;
  productId?: string;
  listingId?: string;
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  lineTotal?: number;
  total?: number;
  category?: string;
  categoryId?: string;
  categoryName?: string;
};

function linesFromCommerceOrder(order: {
  id: string;
  orderNumber?: string;
  sellerId?: string;
  brandId?: string;
  status: string;
  createdAt: string;
  items?: Array<{
    listingId: string;
    title: string;
    brandId: string;
    brandName: string;
    sellerId: string;
    quantity: number;
    unitPrice: number;
    finalUnitPrice?: number;
    lineTotal: number;
  }>;
}, ownerUserId: string) {
  const items = order.items || [];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.sellerId !== ownerUserId) continue;
    out.push({
      orderId: order.id,
      orderItemKey: `${order.id}:${it.listingId}:${i}`,
      listingId: it.listingId,
      productTitle: it.title,
      brandId: it.brandId,
      brandName: it.brandName,
      sellerId: it.sellerId,
      quantity: it.quantity,
      unitPrice: it.finalUnitPrice ?? it.unitPrice,
      lineTotal: it.lineTotal,
      orderDate: order.createdAt,
      orderStatus: order.status,
      category: undefined as string | undefined,
    });
  }
  return out;
}

function linesFromOpsOrder(
  order: {
    orderId: string;
    buyerId?: string;
    status: string;
    createdAt: string;
    overallTotal?: number;
    subOrders?: unknown[];
  },
  ownerUserId: string,
) {
  const subs = (order.subOrders || []) as SubLike[];
  const owned = subs.filter((s) => s.sellerId === ownerUserId);
  if (!owned.length) return [];
  return owned.map((s, i) => {
    const qty = Number(s.quantity ?? s.qty ?? 1) || 1;
    const unit = Number(s.unitPrice ?? s.price ?? 0) || 0;
    const line = Number(s.lineTotal ?? s.total ?? unit * qty) || 0;
    const listingId = String(s.listingId || s.productId || `line_${i}`);
    return {
      orderId: order.orderId,
      orderItemKey: `${order.orderId}:${listingId}:${i}`,
      listingId,
      productTitle: String(s.title || s.productTitle || 'Order item'),
      brandId: String(s.brandId || ''),
      brandName: String(s.brandName || ''),
      sellerId: ownerUserId,
      quantity: qty,
      unitPrice: unit,
      lineTotal: line > 0 ? line : Number(order.overallTotal || 0) / Math.max(1, owned.length),
      orderDate: order.createdAt,
      orderStatus: order.status,
      category: String(s.categoryName || s.category || s.categoryId || '') || undefined,
    };
  });
}

async function resolveOwnedLines(
  ownerUserId: string,
  refs: Array<{ orderId: string; orderItemKey?: string }>,
) {
  const resolved = [];
  for (const ref of refs) {
    const commerce = await commerceStore.getOrder(ref.orderId);
    let lines = commerce ? linesFromCommerceOrder(commerce as any, ownerUserId) : [];
    if (!lines.length) {
      const ops = operationsStore.getOrder(ref.orderId);
      if (ops) lines = linesFromOpsOrder(ops as any, ownerUserId);
    }
    if (ref.orderItemKey) {
      lines = lines.filter((l) => l.orderItemKey === ref.orderItemKey);
    }
    resolved.push(...lines);
  }
  return resolved;
}

export async function listMyCashbooks(actor: { userId: string; role?: string }) {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  return listCashbooksForOwner(actor.userId).map((b) => ({
    ...b,
    summary: cashbookSummary(b.id, actor.userId),
  }));
}

export async function createMyCashbook(
  actor: { userId: string; role?: string },
  input: { name: string; icon?: string; color?: string },
) {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  if (isStaff(actor.role) && (actor.role || '').toLowerCase() !== 'seller') {
    // Admins may inspect but should not create personal books via this path unless seller role.
    // Staff creating for themselves is unused; block pure admin create.
    const r = (actor.role || '').toLowerCase();
    if (r === 'admin' || r === 'super_admin' || r === 'superadmin') {
      throw new CommerceError('Admins track Seller & Creator cashbooks — create is not available', 403);
    }
  }
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

export async function getMyCashbookDetail(
  actor: { userId: string; role?: string },
  bookId: string,
  opts?: { ownerUserId?: string },
) {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  const ownerId = isStaff(actor.role) && opts?.ownerUserId ? opts.ownerUserId : actor.userId;
  assertOwnerAccess(ownerId, actor);
  const book = getCashbookForOwner(bookId, ownerId);
  if (!book) throw new CommerceError('Cashbook not found', 404);
  return {
    book,
    summary: cashbookSummary(bookId, ownerId),
    entries: listEntriesForBook(bookId, ownerId),
  };
}

export async function importOrdersToCashbook(
  actor: { userId: string; role?: string },
  params: {
    bookId?: string;
    newBookName?: string;
    newBookIcon?: string;
    items: Array<{ orderId: string; orderItemKey?: string }>;
  },
): Promise<ImportResult> {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  const r = (actor.role || '').toLowerCase();
  if (r === 'admin' || r === 'super_admin' || r === 'superadmin') {
    throw new CommerceError('Admins cannot import into Cashbooks', 403);
  }
  if (!Array.isArray(params.items) || !params.items.length) {
    throw new CommerceError('Select at least one order item', 400);
  }

  let bookId = params.bookId;
  if (!bookId) {
    const name = String(params.newBookName || '').trim();
    if (!name) throw new CommerceError('Book Name is required', 400);
    const book = createCashbook({
      ownerUserId: actor.userId,
      name,
      icon: params.newBookIcon,
    });
    bookId = book.id;
  } else {
    const book = getCashbookForOwner(bookId, actor.userId);
    if (!book) throw new CommerceError('Cashbook not found', 404);
  }

  const lines = await resolveOwnedLines(actor.userId, params.items);
  if (!lines.length) {
    throw new CommerceError('No owned order items found for import', 403);
  }
  return importResolvedLines(bookId, actor.userId, lines);
}

export async function deleteMyCashbookEntry(
  actor: { userId: string; role?: string },
  entryId: string,
) {
  if (!actor.userId) throw new CommerceError('Authentication required', 401);
  const ok = removeCashbookEntry(entryId, actor.userId);
  if (!ok) throw new CommerceError('Entry not found', 404);
  // Explicit: does NOT touch Order / Payment / Escrow / Settlement.
  return { deleted: true, mutatedOrder: false, mutatedPayment: false, mutatedEscrow: false };
}
