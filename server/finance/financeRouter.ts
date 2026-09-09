/**
 * Sprint 12, Phase 8 — Finance API surface. Super Admin only (mirrors the
 * exact requireAdmin gate Monetization Center and Plan-management already
 * use). View-only: every route here is a GET — no financial record can be
 * created, edited, or deleted through this router, matching the Super
 * Admin view-only-by-default principle (Part 17).
 */
import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { getFinanceOverview, listFinanceTransactions, listFinanceSettlements, listFinanceBillingDocuments, type FinanceFilters, type Pagination } from './financeService';

export const financeRouter = Router();

const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

class FinanceRequestError extends Error {
  status = 400;
}

const PAYMENT_STATUSES = ['all', 'succeeded', 'pending', 'failed', 'cancelled'] as const;
const PERSONAS = ['all', 'seller', 'creator'] as const;

function parseFilters(query: Record<string, unknown>): FinanceFilters {
  const toStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const fromRaw = toStr(query.from);
  const toRaw = toStr(query.to);
  if (!fromRaw || !toRaw) throw new FinanceRequestError('from and to (ISO dates) are required');
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new FinanceRequestError('from/to must be valid dates');
  if (from.getTime() > to.getTime()) throw new FinanceRequestError('from must not be after to');

  const paymentStatus = toStr(query.paymentStatus) as FinanceFilters['paymentStatus'];
  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) throw new FinanceRequestError(`paymentStatus must be one of ${PAYMENT_STATUSES.join(', ')}`);
  const persona = toStr(query.persona) as FinanceFilters['persona'];
  if (persona && !PERSONAS.includes(persona)) throw new FinanceRequestError(`persona must be one of ${PERSONAS.join(', ')}`);

  return { from, to, paymentStatus, persona };
}

function parsePagination(query: Record<string, unknown>): Partial<Pagination> {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : undefined,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : undefined,
  };
}

function handleError(res: { status: (n: number) => { json: (b: unknown) => void } }, error: unknown) {
  if (error instanceof FinanceRequestError) {
    res.status(error.status).json({ success: false, error: error.message });
    return;
  }
  console.error('[Finance] Unexpected error:', error);
  res.status(500).json({ success: false, error: 'Internal error' });
}

financeRouter.get('/admin/finance/overview', ...requireAdmin, async (req, res) => {
  try {
    const overview = await getFinanceOverview(parseFilters(req.query as Record<string, unknown>));
    res.json({ success: true, overview });
  } catch (error) {
    handleError(res, error);
  }
});

financeRouter.get('/admin/finance/transactions', ...requireAdmin, async (req, res) => {
  try {
    const result = await listFinanceTransactions(parseFilters(req.query as Record<string, unknown>), parsePagination(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
});

financeRouter.get('/admin/finance/settlements', ...requireAdmin, async (req, res) => {
  try {
    const result = await listFinanceSettlements(parseFilters(req.query as Record<string, unknown>), parsePagination(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
});

financeRouter.get('/admin/finance/billing-documents', ...requireAdmin, async (req, res) => {
  try {
    const result = await listFinanceBillingDocuments(parseFilters(req.query as Record<string, unknown>), parsePagination(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
});
