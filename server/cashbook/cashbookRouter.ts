import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requirePartnerEntitlement } from '../entitlements/entitlementMiddleware';
import { requireMarketplaceAccess } from '../entitlements/marketplaceAccessMiddleware';
import { CommerceError } from '../commerce/cartService';
import { Logger } from '../lib/logger';
import {
  createManualCashbookEntry,
  createMyCashbook,
  deleteMyCashbook,
  deleteMyCashbookEntry,
  getMyCashbookDetail,
  importOrdersToCashbook,
  listCashbookOversight,
  listMyCashbooks,
  renameMyCashbook,
  updateManualCashbookEntry,
} from './cashbookService';
import { getFinanceSummaryForActor } from './financeSummaryService';

export const cashbookRouter = Router();
/** Auth + partner entitlement (admins/staff pass through; disable = access only, never deletes data). */
const requireAuth = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess];

function actorOf(req: {
  userId?: string;
  user?: { uid?: string; role?: string };
  userRole?: string;
}) {
  return {
    userId: req.userId || req.user?.uid || '',
    role: req.userRole || req.user?.role,
  };
}

function isAdminRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin';
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    const body: Record<string, unknown> = { success: false, error: error.message };
    const details = (error as { details?: unknown }).details;
    if (details !== undefined) body.details = details;
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') body.code = code;
    res.status(error.statusCode).json(body);
    return;
  }
  if (error instanceof Error && error.message === 'Book Name is required') {
    res.status(400).json({ success: false, error: error.message });
    return;
  }
  Logger.error('Cashbook/Finance API error', {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Cashbook error',
  });
}

// ── finance summary (Escrow-derived payout breakdown — separate concern) ──

cashbookRouter.get('/finance/summary', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const sellerId =
      isAdminRole(actor.role) && typeof req.query.sellerId === 'string' && req.query.sellerId.trim()
        ? req.query.sellerId.trim()
        : actor.userId;
    const currency = typeof req.query.currency === 'string' ? req.query.currency : 'BDT';
    const data = await getFinanceSummaryForActor(sellerId, actor, currency);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.get('/finance/adjustments', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const sellerId =
      isAdminRole(actor.role) && typeof req.query.sellerId === 'string' && req.query.sellerId.trim()
        ? req.query.sellerId.trim()
        : actor.userId;
    const summary = await getFinanceSummaryForActor(sellerId, actor, 'BDT');
    res.json({ success: true, data: summary.adjustments });
  } catch (error) {
    handleError(res, error);
  }
});

// ── staff READ-ONLY oversight — MUST be declared before /cashbooks/:bookId ──

cashbookRouter.get('/cashbooks/oversight', ...requireAuth, async (req, res) => {
  try {
    const sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
    const data = await listCashbookOversight(actorOf(req), sellerId);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// ── seller/creator cashbooks ──────────────────────────────────────────

cashbookRouter.get('/cashbooks', ...requireAuth, async (req, res) => {
  try {
    const data = await listMyCashbooks(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.post('/cashbooks', ...requireAuth, async (req, res) => {
  try {
    const book = await createMyCashbook(actorOf(req), {
      name: String(req.body?.name || ''),
      icon: typeof req.body?.icon === 'string' ? req.body.icon : undefined,
      color: typeof req.body?.color === 'string' ? req.body.color : undefined,
    });
    res.status(201).json({ success: true, data: book });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.post('/cashbooks/import-orders', ...requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const headerKey = req.headers['idempotency-key'];
    const data = await importOrdersToCashbook(actorOf(req), {
      bookId: typeof req.body?.bookId === 'string' ? req.body.bookId : undefined,
      newBookName: typeof req.body?.newBookName === 'string' ? req.body.newBookName : undefined,
      newBookIcon: typeof req.body?.newBookIcon === 'string' ? req.body.newBookIcon : undefined,
      newBookColor: typeof req.body?.newBookColor === 'string' ? req.body.newBookColor : undefined,
      idempotencyKey:
        (typeof headerKey === 'string' && headerKey) ||
        (typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined) ||
        undefined,
      items: items
        .map((it: { orderId?: string; orderItemKey?: string }) => ({
          orderId: String(it.orderId || ''),
          orderItemKey: it.orderItemKey ? String(it.orderItemKey) : undefined,
        }))
        .filter((it: { orderId: string }) => Boolean(it.orderId)),
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.get('/cashbooks/:bookId', ...requireAuth, async (req, res) => {
  try {
    const ownerUserId =
      typeof req.query.ownerUserId === 'string' ? req.query.ownerUserId : undefined;
    const data = await getMyCashbookDetail(actorOf(req), req.params.bookId, { ownerUserId });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.patch('/cashbooks/:bookId', ...requireAuth, async (req, res) => {
  try {
    const book = await renameMyCashbook(actorOf(req), req.params.bookId, String(req.body?.name || ''));
    res.json({ success: true, data: book });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.delete('/cashbooks/:bookId', ...requireAuth, async (req, res) => {
  try {
    const data = await deleteMyCashbook(actorOf(req), req.params.bookId);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// ── manual entries ───────────────────────────────────────────────────

cashbookRouter.post('/cashbooks/:bookId/entries', ...requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const data = await createManualCashbookEntry(actorOf(req), req.params.bookId, {
      direction: b.direction === 'out' ? 'out' : 'in',
      amount: Number(b.amount),
      description: typeof b.description === 'string' ? b.description : b.remarks,
      category: typeof b.category === 'string' ? b.category : undefined,
      contact: typeof b.contact === 'string' ? b.contact : undefined,
      paymentMode: typeof b.paymentMode === 'string' ? b.paymentMode : undefined,
      docRef: typeof b.docRef === 'string' ? b.docRef : b.doc,
      entryDate: typeof b.entryDate === 'string' ? b.entryDate : undefined,
      entryTime: typeof b.entryTime === 'string' ? b.entryTime : undefined,
      linkedOrderId: typeof b.linkedOrderId === 'string' ? b.linkedOrderId : undefined,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.patch('/cashbooks/entries/:entryId', ...requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const data = await updateManualCashbookEntry(actorOf(req), req.params.entryId, {
      direction: b.direction === 'out' ? 'out' : b.direction === 'in' ? 'in' : undefined,
      amount: b.amount !== undefined ? Number(b.amount) : undefined,
      description: typeof b.description === 'string' ? b.description : b.remarks,
      category: typeof b.category === 'string' ? b.category : undefined,
      contact: typeof b.contact === 'string' ? b.contact : undefined,
      paymentMode: typeof b.paymentMode === 'string' ? b.paymentMode : undefined,
      docRef: typeof b.docRef === 'string' ? b.docRef : b.doc,
      entryDate: typeof b.entryDate === 'string' ? b.entryDate : undefined,
      entryTime: typeof b.entryTime === 'string' ? b.entryTime : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

cashbookRouter.delete('/cashbooks/entries/:entryId', ...requireAuth, async (req, res) => {
  try {
    const data = await deleteMyCashbookEntry(actorOf(req), req.params.entryId);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});
