/**
 * Sprint 12, Phase 7 — Monetization Center API surface. Super Admin only
 * (mirrors the exact requireAdmin gate the Plan-management routes in
 * server/subscriptions/subscriptionsRouter.ts already use — ADMIN role or
 * higher, never Seller/Creator). Every filter here selects WHICH rows to
 * aggregate; no filter or client input is ever trusted as an amount,
 * persona, or workspace identity — all of that is re-derived server-side
 * from the authoritative tables in monetizationService.
 */
import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { monetizationService, type MonetizationFilters, type MonetizationPersona, type MonetizationPaymentStatus, type MonetizationSource } from './monetizationService';

export const monetizationRouter = Router();

const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

const SOURCES: MonetizationSource[] = ['all', 'commerce', 'subscriptions'];
const PERSONAS: MonetizationPersona[] = ['all', 'seller', 'creator'];
const PAYMENT_STATUSES: MonetizationPaymentStatus[] = ['all', 'succeeded', 'pending', 'failed', 'cancelled'];

class MonetizationRequestError extends Error {
  status = 400;
}

/** Parses/validates every filter server-side — a malformed or out-of-range value is rejected outright rather than silently coerced. */
function parseFilters(query: Record<string, unknown>): MonetizationFilters {
  const toStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  const fromRaw = toStr(query.from);
  const toRaw = toStr(query.to);
  if (!fromRaw || !toRaw) throw new MonetizationRequestError('from and to (ISO dates) are required');
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new MonetizationRequestError('from/to must be valid dates');
  if (from.getTime() > to.getTime()) throw new MonetizationRequestError('from must not be after to');

  const source = toStr(query.source) as MonetizationSource | undefined;
  if (source && !SOURCES.includes(source)) throw new MonetizationRequestError(`source must be one of ${SOURCES.join(', ')}`);

  const persona = toStr(query.persona) as MonetizationPersona | undefined;
  if (persona && !PERSONAS.includes(persona)) throw new MonetizationRequestError(`persona must be one of ${PERSONAS.join(', ')}`);

  const paymentStatus = toStr(query.paymentStatus) as MonetizationPaymentStatus | undefined;
  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) throw new MonetizationRequestError(`paymentStatus must be one of ${PAYMENT_STATUSES.join(', ')}`);

  const billingInterval = toStr(query.billingInterval);
  if (billingInterval && billingInterval !== 'monthly' && billingInterval !== 'annual') {
    throw new MonetizationRequestError("billingInterval must be 'monthly' or 'annual'");
  }

  return {
    from,
    to,
    source,
    persona,
    paymentStatus,
    planId: toStr(query.planId),
    planVersionId: toStr(query.planVersionId),
    billingInterval: billingInterval as 'monthly' | 'annual' | undefined,
  };
}

function handleError(res: { status: (n: number) => { json: (b: unknown) => void } }, error: unknown) {
  if (error instanceof MonetizationRequestError) {
    res.status(error.status).json({ success: false, error: error.message });
    return;
  }
  console.error('[Monetization] Unexpected error:', error);
  res.status(500).json({ success: false, error: 'Internal error' });
}

monetizationRouter.get('/admin/monetization/summary', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const summary = await monetizationService.getSummary(filters);
    res.json({ success: true, summary });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/revenue-breakdown', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const breakdown = await monetizationService.getRevenueBreakdown(filters);
    res.json({ success: true, breakdown });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/subscription-metrics', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const metrics = await monetizationService.getSubscriptionMetrics(filters);
    res.json({ success: true, metrics });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/commission-metrics', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const metrics = await monetizationService.getCommissionMetrics(filters);
    res.json({ success: true, metrics });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/gmv-metrics', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const metrics = await monetizationService.getGmvMetrics(filters);
    res.json({ success: true, metrics });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/revenue-trend', ...requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const trend = await monetizationService.getRevenueTrend(filters);
    res.json({ success: true, trend });
  } catch (error) {
    handleError(res, error);
  }
});

monetizationRouter.get('/admin/monetization/filters', ...requireAdmin, async (_req, res) => {
  try {
    const options = await monetizationService.getFilterOptions();
    res.json({ success: true, options });
  } catch (error) {
    handleError(res, error);
  }
});
