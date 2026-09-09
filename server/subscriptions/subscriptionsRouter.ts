/**
 * Sprint 12 — Subscription Plans + Monetization Center API surface.
 * Super Admin plan-management/inspection routes are strictly separate from
 * the Seller/Creator self-service routes below — no Super Admin control is
 * reachable from the partner-facing routes, and every partner-facing route
 * resolves its Workspace from the AUTHENTICATED caller only (never from a
 * client-supplied workspaceId), so there is no cross-workspace leakage
 * surface at all on those endpoints.
 */
import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { subscriptionPayments } from '../db/schema';
import { planService, PlanServiceError } from './planService';
import { subscriptionService, SubscriptionServiceError } from './subscriptionService';
import { workspaceService, normalizeWorkspaceType } from './workspaceService';
import {
  initiateSubscriptionCheckout,
  processSubscriptionIpn,
  applyUntrustedSubscriptionPaymentOutcome,
  resolveSubscriptionPaymentIdForReturn,
  SubscriptionPaymentError,
} from './subscriptionPaymentService';
import { Logger } from '../lib/logger';

export const subscriptionsRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

function actorId(req: { userId?: string; user?: { uid?: string } }): string {
  return req.userId || req.user?.uid || 'unknown';
}

function publicApiBase(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const envBase = (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (envBase) return envBase;
  const host = req.get('host') || 'localhost:3001';
  return `${req.protocol}://${host}/api/v1`;
}

function webBase(): string {
  return (process.env.CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function redirectToWeb(res: { redirect: (code: number, url: string) => void }, path: string, query: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
  const suffix = qs.toString() ? `?${qs}` : '';
  res.redirect(302, `${webBase()}${path}${suffix}`);
}

function handleServiceError(res: { status: (n: number) => { json: (b: unknown) => void } }, error: unknown) {
  if (error instanceof PlanServiceError || error instanceof SubscriptionServiceError || error instanceof SubscriptionPaymentError) {
    res.status(error.status).json({ success: false, error: error.message });
    return;
  }
  console.error('[Subscriptions] Unexpected error:', error);
  res.status(500).json({ success: false, error: 'Internal error' });
}

// ── Super Admin: Plan management ──────────────────────────────────────────

subscriptionsRouter.get('/admin/subscription-plans', ...requireAdmin, async (req, res) => {
  const role = typeof req.query.role === 'string' ? (req.query.role as 'seller' | 'creator') : undefined;
  const list = await planService.listPlansWithSummary(role ? { role } : undefined);
  res.json({ success: true, plans: list });
});

subscriptionsRouter.post('/admin/subscription-plans', ...requireAdmin, async (req, res) => {
  const body = req.body as { role?: string; name?: string; internalCode?: string; description?: string; badge?: string; sortOrder?: number };
  const role = normalizeWorkspaceType(body.role);
  if (!role) {
    res.status(400).json({ success: false, error: 'role must be seller or creator' });
    return;
  }
  try {
    const created = await planService.createPlan({
      role,
      name: String(body.name || ''),
      internalCode: body.internalCode,
      description: body.description,
      badge: body.badge,
      sortOrder: body.sortOrder,
      actorUserId: actorId(req),
    });
    res.status(201).json({ success: true, plan: created });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.get('/admin/subscription-plans/:planId', ...requireAdmin, async (req, res) => {
  try {
    const detail = await planService.getPlanDetail(req.params.planId);
    res.json({ success: true, ...detail });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.patch('/admin/subscription-plans/:planId', ...requireAdmin, async (req, res) => {
  try {
    const updated = await planService.updatePlanMetadata(req.params.planId, req.body || {}, actorId(req));
    res.json({ success: true, plan: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.post('/admin/subscription-plans/:planId/archive', ...requireAdmin, async (req, res) => {
  try {
    const updated = await planService.archivePlan(req.params.planId, actorId(req));
    res.json({ success: true, plan: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.post('/admin/subscription-plans/:planId/versions', ...requireAdmin, async (req, res) => {
  const body = req.body as { nameSnapshot?: string; descriptionSnapshot?: string; trialDays?: number };
  try {
    const created = await planService.createDraftVersion(
      req.params.planId,
      { nameSnapshot: String(body.nameSnapshot || ''), descriptionSnapshot: body.descriptionSnapshot, trialDays: body.trialDays },
      actorId(req),
    );
    res.status(201).json({ success: true, version: created });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.patch('/admin/subscription-plans/:planId/versions/:versionId', ...requireAdmin, async (req, res) => {
  try {
    const updated = await planService.updateDraftVersion(req.params.planId, req.params.versionId, req.body || {});
    res.json({ success: true, version: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.put('/admin/subscription-plans/:planId/versions/:versionId/offers', ...requireAdmin, async (req, res) => {
  const offers = (req.body as { offers?: unknown })?.offers;
  if (!Array.isArray(offers)) {
    res.status(400).json({ success: false, error: 'offers array is required' });
    return;
  }
  try {
    const saved = await planService.setDraftOffers(req.params.planId, req.params.versionId, offers);
    res.json({ success: true, offers: saved });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.put('/admin/subscription-plans/:planId/versions/:versionId/entitlements', ...requireAdmin, async (req, res) => {
  const entitlements = (req.body as { entitlements?: unknown })?.entitlements;
  if (!Array.isArray(entitlements)) {
    res.status(400).json({ success: false, error: 'entitlements array is required' });
    return;
  }
  try {
    const saved = await planService.setDraftEntitlements(req.params.planId, req.params.versionId, entitlements);
    res.json({ success: true, entitlements: saved });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.put('/admin/subscription-plans/:planId/versions/:versionId/limits', ...requireAdmin, async (req, res) => {
  const limits = (req.body as { limits?: unknown })?.limits;
  if (!Array.isArray(limits)) {
    res.status(400).json({ success: false, error: 'limits array is required' });
    return;
  }
  try {
    const saved = await planService.setDraftLimits(req.params.planId, req.params.versionId, limits);
    res.json({ success: true, limits: saved });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.post('/admin/subscription-plans/:planId/versions/:versionId/publish', ...requireAdmin, async (req, res) => {
  try {
    const plan = await planService.publishVersion(req.params.planId, req.params.versionId, actorId(req));
    res.json({ success: true, plan });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.get('/admin/subscription-plans/:planId/subscribers', ...requireAdmin, async (req, res) => {
  const subscribers = await planService.getSubscribersForPlan(req.params.planId);
  res.json({ success: true, subscribers });
});

/** Smallest role-protected read the Manual Grant UI needs — workspace lookup only, NOT Team & Access. */
subscriptionsRouter.get('/admin/workspaces', ...requireAdmin, async (req, res) => {
  const type = req.query.type === 'seller' || req.query.type === 'creator' ? req.query.type : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  const list = await workspaceService.listWorkspaces({ type, search });
  res.json({ success: true, workspaces: list });
});

// ── Super Admin: subscription operations ───────────────────────────────────

subscriptionsRouter.post('/admin/subscriptions/manual-grant', ...requireAdmin, async (req, res) => {
  const body = req.body as { workspaceId?: string; planVersionOfferId?: string; reason?: string; startDate?: string; endDate?: string | null };
  if (!body.workspaceId || !body.planVersionOfferId) {
    res.status(400).json({ success: false, error: 'workspaceId and planVersionOfferId are required' });
    return;
  }
  try {
    const created = await subscriptionService.manualGrant({
      workspaceId: body.workspaceId,
      planVersionOfferId: body.planVersionOfferId,
      actorUserId: actorId(req),
      reason: String(body.reason || ''),
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : null,
    });
    res.status(201).json({ success: true, subscription: created });
  } catch (error) {
    handleServiceError(res, error);
  }
});

subscriptionsRouter.get('/admin/workspaces/:workspaceId/subscription', ...requireAdmin, async (req, res) => {
  const resolved = await subscriptionService.getCurrentSubscription(req.params.workspaceId);
  res.json({ success: true, current: resolved });
});

subscriptionsRouter.get('/admin/workspaces/:workspaceId/subscription-history', ...requireAdmin, async (req, res) => {
  const history = await subscriptionService.getSubscriptionHistory(req.params.workspaceId);
  res.json({ success: true, ...history });
});

/** Local/test invocation only — no production cron wired in this phase. Idempotent. */
subscriptionsRouter.post('/admin/subscriptions/process-expirations', ...requireAdmin, async (_req, res) => {
  const result = await subscriptionService.processExpirations();
  res.json({ success: true, ...result });
});

/** Super Admin replaces/changes an existing manual grant — separate from customer upgrade/downgrade billing. No payment/revenue is ever created here. */
subscriptionsRouter.post('/admin/subscriptions/:subscriptionId/replace-manual-grant', ...requireAdmin, async (req, res) => {
  const body = req.body as { toPlanVersionOfferId?: string; reason?: string };
  if (!body.toPlanVersionOfferId) {
    res.status(400).json({ success: false, error: 'toPlanVersionOfferId is required' });
    return;
  }
  try {
    const updated = await subscriptionService.replaceManualGrant({
      subscriptionId: req.params.subscriptionId,
      toPlanVersionOfferId: body.toPlanVersionOfferId,
      actorUserId: actorId(req),
      reason: String(body.reason || ''),
    });
    res.json({ success: true, subscription: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

// ── Seller/Creator: self-service (Workspace always resolved from the caller) ──

async function requireOwnWorkspace(req: { userId?: string; userRole?: string; user?: { uid?: string; role?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const userId = req.userId || req.user?.uid;
  const role = req.userRole || req.user?.role;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  const workspace = await workspaceService.resolveWorkspaceForUser(userId, role);
  if (!workspace) {
    res.status(403).json({ success: false, error: 'No Seller/Creator Workspace for this account' });
    return null;
  }
  return workspace;
}

/** Resolves any real Plan Version Offer id to its Plan/Version/Offer — e.g. to display a pending downgrade target that isn't necessarily the plan's current published version. Catalog data only, not workspace-scoped. */
subscriptionsRouter.get('/subscriptions/offers/:offerId', ...requireAuth, async (req, res) => {
  const detail = await planService.getOfferDetail(req.params.offerId);
  if (!detail) {
    res.status(404).json({ success: false, error: 'Offer not found' });
    return;
  }
  res.json({ success: true, ...detail });
});

subscriptionsRouter.get('/subscriptions/available-plans', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  const plansForPersona = await planService.listPublishedPlansForPersona(workspace.type);
  res.json({ success: true, plans: plansForPersona });
});

subscriptionsRouter.get('/subscriptions/current', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  const current = await subscriptionService.getCurrentSubscription(workspace.id);
  res.json({ success: true, workspace, current });
});

subscriptionsRouter.get('/subscriptions/history', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  const history = await subscriptionService.getSubscriptionHistory(workspace.id);
  res.json({ success: true, ...history });
});

subscriptionsRouter.post('/subscriptions/cancel', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  try {
    const updated = await subscriptionService.requestCancellation(workspace.id, actorId(req));
    res.json({ success: true, subscription: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

/**
 * Explicit upgrade/downgrade operations (Phase 3C correction — the client
 * states which operation it wants; the server never infers direction from
 * price). Both resolve the subscription to act on strictly from the
 * authenticated caller's OWN current subscription — one Seller can never
 * target another Seller's (or a Creator's) subscription this way.
 */
async function resolveOwnCurrentSubscription(req: Parameters<typeof requireOwnWorkspace>[0], res: Parameters<typeof requireOwnWorkspace>[1]) {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return null;
  const current = await subscriptionService.getCurrentSubscription(workspace.id);
  if (!current) {
    res.status(404).json({ success: false, error: 'No open subscription for this Workspace' });
    return null;
  }
  return current;
}

/** Validates + quotes only — NEVER switches the Plan. Activation happens exclusively via activateUpgrade() after a validated Phase 6 payment. */
subscriptionsRouter.post('/subscriptions/request-upgrade', ...requireAuth, async (req, res) => {
  const body = req.body as { toPlanVersionOfferId?: string };
  if (!body.toPlanVersionOfferId) {
    res.status(400).json({ success: false, error: 'toPlanVersionOfferId is required' });
    return;
  }
  const current = await resolveOwnCurrentSubscription(req, res);
  if (!current) return;
  try {
    const result = await subscriptionService.requestUpgrade({
      subscriptionId: current.subscription.id,
      toPlanVersionOfferId: body.toPlanVersionOfferId,
      actorUserId: actorId(req),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(res, error);
  }
});

/** Schedules a downgrade for period end. Current Plan/entitlements/limits are untouched by this call. */
subscriptionsRouter.post('/subscriptions/request-downgrade', ...requireAuth, async (req, res) => {
  const body = req.body as { toPlanVersionOfferId?: string };
  if (!body.toPlanVersionOfferId) {
    res.status(400).json({ success: false, error: 'toPlanVersionOfferId is required' });
    return;
  }
  const current = await resolveOwnCurrentSubscription(req, res);
  if (!current) return;
  try {
    const updated = await subscriptionService.requestDowngrade({
      subscriptionId: current.subscription.id,
      toPlanVersionOfferId: body.toPlanVersionOfferId,
      actorUserId: actorId(req),
    });
    res.json({ success: true, subscription: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

/** Cancels a pending downgrade only. */
subscriptionsRouter.post('/subscriptions/cancel-pending-downgrade', ...requireAuth, async (req, res) => {
  const current = await resolveOwnCurrentSubscription(req, res);
  if (!current) return;
  try {
    const updated = await subscriptionService.cancelPendingDowngrade(current.subscription.id, actorId(req));
    res.json({ success: true, subscription: updated });
  } catch (error) {
    handleServiceError(res, error);
  }
});

// ── Phase 6: SSLCommerz subscription checkout ──────────────────────────────
// Mirrors server/payments/paymentsRouter.ts's exact security shape: init is
// authenticated + workspace-derived; ipn is the ONLY path that can credit a
// payment (unauthenticated by design — SSLCommerz calls it server-to-server,
// and it independently re-validates via the provider, never trusting the
// payload); success/fail/cancel are browser redirects and are NEVER treated
// as proof of payment.

/** Server resolves everything from the offer + authenticated caller — never trusts a client-supplied amount/currency/persona/workspace. */
subscriptionsRouter.post('/subscriptions/checkout/initiate', ...requireAuth, async (req, res) => {
  const body = req.body as { offerId?: string; purpose?: string };
  const purpose = body.purpose;
  if (!body.offerId || !purpose || !['initial', 'renewal', 'upgrade', 'downgrade'].includes(purpose)) {
    res.status(400).json({ success: false, error: 'offerId and a valid purpose (initial|renewal|upgrade|downgrade) are required' });
    return;
  }
  try {
    const result = await initiateSubscriptionCheckout({
      actorUserId: req.userId || req.user?.uid || '',
      actorRole: req.userRole || req.user?.role,
      offerId: body.offerId,
      purpose: purpose as 'initial' | 'renewal' | 'upgrade' | 'downgrade',
      publicApiBase: publicApiBase(req),
      webBase: webBase(),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleServiceError(res, error);
  }
});

/**
 * SSLCommerz IPN — unauthenticated by design. NEVER credits from the payload
 * alone; always independently calls provider.validateTransaction() and
 * checks amount/currency/tran_id before crediting. See processSubscriptionIpn.
 */
subscriptionsRouter.post('/subscriptions/payments/sslcommerz/ipn', async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  Logger.info('Subscription SSLCommerz IPN received', { tran_id: body.tran_id, val_id: body.val_id, status: body.status });
  try {
    const result = await processSubscriptionIpn(body);
    res.status(200).json(result);
  } catch (error) {
    Logger.error('Subscription SSLCommerz IPN handler error', { error: error instanceof Error ? error.message : String(error) });
    // Still 200 so the provider does not hammer retries for a handler bug — safe to replay from logs.
    res.status(200).json({ received: true, credited: false, error: error instanceof Error ? error.message : 'ipn_error' });
  }
});

/**
 * Browser return — NOT proof of payment. Truth is the IPN handler above.
 * The paymentId echoed back to the web app is always resolved server-side
 * from tran_id (falling back to a client-hinted id) — never trusted as-is
 * from the gateway's own query params, which may or may not include it.
 */
subscriptionsRouter.get('/subscriptions/payments/sslcommerz/success', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const hint = typeof req.query.value_a === 'string' ? req.query.value_a : (typeof req.query.orderId === 'string' ? req.query.orderId : undefined);
  const paymentId = (await resolveSubscriptionPaymentIdForReturn({ tranId, paymentId: hint })) ?? undefined;
  Logger.info('Subscription SSLCommerz browser success redirect (untrusted)', { tranId, paymentId });
  redirectToWeb(res, '/admin/plan-billing', { paymentOutcome: 'success', paymentId, tran_id: tranId });
});

/** Fail/cancel MAY be applied from the browser redirect — you cannot forge a "failure" to steal value the way you could forge a "success". */
subscriptionsRouter.get('/subscriptions/payments/sslcommerz/fail', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const hint = typeof req.query.value_a === 'string' ? req.query.value_a : (typeof req.query.orderId === 'string' ? req.query.orderId : undefined);
  const paymentId = (await applyUntrustedSubscriptionPaymentOutcome({ tranId, paymentId: hint, status: 'failed' })) ?? undefined;
  Logger.info('Subscription SSLCommerz browser fail redirect', { tranId, paymentId });
  redirectToWeb(res, '/admin/plan-billing', { paymentOutcome: 'failed', paymentId, tran_id: tranId });
});

subscriptionsRouter.get('/subscriptions/payments/sslcommerz/cancel', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const hint = typeof req.query.value_a === 'string' ? req.query.value_a : (typeof req.query.orderId === 'string' ? req.query.orderId : undefined);
  const paymentId = (await applyUntrustedSubscriptionPaymentOutcome({ tranId, paymentId: hint, status: 'cancelled' })) ?? undefined;
  Logger.info('Subscription SSLCommerz browser cancel redirect', { tranId, paymentId });
  redirectToWeb(res, '/admin/plan-billing', { paymentOutcome: 'cancelled', paymentId, tran_id: tranId });
});

/** Self-service: real-time status for the frontend to poll after returning from checkout — never invented, always the current DB row. */
subscriptionsRouter.get('/subscriptions/payments/:paymentId/status', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  const rows = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, req.params.paymentId)).limit(1);
  const payment = rows[0];
  if (!payment || payment.workspaceId !== workspace.id) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }
  res.json({
    success: true,
    payment: {
      id: payment.id,
      planVersionOfferId: payment.planVersionOfferId,
      purpose: payment.purpose,
      amount: payment.amount,
      currency: payment.currency,
      result: payment.result,
      createdAt: payment.createdAt.toISOString(),
    },
  });
});

/** Self-service payment history — real subscription_payments rows for this workspace only. */
subscriptionsRouter.get('/subscriptions/payments/history', ...requireAuth, async (req, res) => {
  const workspace = await requireOwnWorkspace(req, res);
  if (!workspace) return;
  const rows = await db
    .select()
    .from(subscriptionPayments)
    .where(and(eq(subscriptionPayments.workspaceId, workspace.id)))
    .orderBy(desc(subscriptionPayments.createdAt));
  res.json({
    success: true,
    payments: rows.map((p) => ({
      id: p.id,
      planVersionOfferId: p.planVersionOfferId,
      purpose: p.purpose,
      amount: p.amount,
      currency: p.currency,
      result: p.result,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});
