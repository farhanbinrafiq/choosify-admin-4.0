import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { CommerceError } from '../commerce/cartService';
import { Logger } from '../lib/logger';
import {
  createMyCashbook,
  deleteMyCashbookEntry,
  getMyCashbookDetail,
  importOrdersToCashbook,
  listMyCashbooks,
} from './cashbookService';
import { getFinanceSummaryForActor } from './financeSummaryService';

export const cashbookRouter = Router();
const requireAuth = [authenticateRequest];

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

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
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

/** Current payout breakdown for authenticated Seller/Creator (or Admin inspecting sellerId). */
cashbookRouter.get('/finance/summary', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const role = (actor.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
    const sellerId =
      isAdmin && typeof req.query.sellerId === 'string' && req.query.sellerId.trim()
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
    const role = (actor.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
    const sellerId =
      isAdmin && typeof req.query.sellerId === 'string' && req.query.sellerId.trim()
        ? req.query.sellerId.trim()
        : actor.userId;
    const summary = await getFinanceSummaryForActor(sellerId, actor, 'BDT');
    res.json({ success: true, data: summary.adjustments });
  } catch (error) {
    handleError(res, error);
  }
});

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

cashbookRouter.post('/cashbooks/import-orders', ...requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = await importOrdersToCashbook(actorOf(req), {
      bookId: typeof req.body?.bookId === 'string' ? req.body.bookId : undefined,
      newBookName: typeof req.body?.newBookName === 'string' ? req.body.newBookName : undefined,
      newBookIcon: typeof req.body?.newBookIcon === 'string' ? req.body.newBookIcon : undefined,
      items: items.map((it: { orderId?: string; orderItemKey?: string }) => ({
        orderId: String(it.orderId || ''),
        orderItemKey: it.orderItemKey ? String(it.orderItemKey) : undefined,
      })).filter((it: { orderId: string }) => Boolean(it.orderId)),
    });
    res.status(201).json({ success: true, data });
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
