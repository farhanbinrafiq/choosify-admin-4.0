/**
 * Commerce Payment HTTP API — Sprint 7 / IS-010 Sprint 10.
 * Paths under /api/v1/commerce/payments/*
 */

import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { CommerceError } from '../commerce/cartService';
import { Logger } from '../lib/logger';
import {
  applyCommercePaymentFailure,
  getPaymentForActor,
  harnessCompletePayment,
  harnessSimulateCaptureCrashBeforeConfirm,
  harnessSimulateFailureCrashBeforeRelease,
  initiateCommercePayment,
  listPaymentMethodsForApi,
  processCommerceIpn,
  resolveCommercePaymentProvider,
} from './commercePaymentService';
import { commercePaymentStore, getPaymentsPersistenceMode } from './commercePaymentStore';
import { mockPaymentProvider } from './mockProvider';
import { sslcommerzProvider } from './sslcommerzProvider';

export const commercePaymentsRouter = Router();

const requireAuth = [authenticateRequest];

function actorId(req: { userId?: string; user?: { uid?: string } }): string {
  return req.userId || req.user?.uid || '';
}

function actorRole(req: { userRole?: string; user?: { role?: string } }): string | undefined {
  return req.userRole || req.user?.role;
}

function publicApiBase(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const envBase = (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || '').replace(
    /\/$/,
    '',
  );
  if (envBase) return envBase;
  const host = req.get('host') || 'localhost:3001';
  return `${req.protocol}://${host}/api/v1`;
}

function webBase(): string {
  return (process.env.CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  Logger.error('Commerce payment error', {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Payment error',
  });
}

function redirectToWeb(
  res: { redirect: (code: number, url: string) => void },
  path: string,
  query: Record<string, string | undefined>,
) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs}` : '';
  res.redirect(302, `${webBase()}${path}${suffix}`);
}

/** GET /commerce/payments/persistence-mode */
commercePaymentsRouter.get('/commerce/payments/persistence-mode', (_req, res) => {
  res.json({
    success: true,
    data: { mode: getPaymentsPersistenceMode() },
  });
});

/** GET /commerce/payments/methods — platform-enabled methods only */
commercePaymentsRouter.get('/commerce/payments/methods', (_req, res) => {
  res.json({ success: true, data: listPaymentMethodsForApi() });
});

/** GET /commerce/payments/gateway-status — never exposes secrets */
commercePaymentsRouter.get('/commerce/payments/gateway-status', (_req, res) => {
  const ssl = sslcommerzProvider.isConfigured();
  const mock =
    (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true' &&
    mockPaymentProvider.isConfigured();
  res.json({
    success: true,
    data: {
      sslcommerzConfigured: ssl,
      mockEnabled: mock,
      mode: ssl ? sslcommerzProvider.getMode() : null,
      storeIdPresent: Boolean((process.env.SSLCOMMERZ_STORE_ID || '').trim()),
    },
  });
});

/** Refund capability probe — interface only, no Refund business workflow. */
commercePaymentsRouter.get('/commerce/payments/refund-capability', (_req, res) => {
  let provider;
  try {
    provider = resolveCommercePaymentProvider();
  } catch {
    provider = null;
  }
  res.json({
    success: true,
    data: {
      refundMethodAvailable: Boolean(provider && typeof provider.refundTransaction === 'function'),
      provider: provider?.id ?? null,
      businessRefundWorkflow: false,
    },
  });
});

/**
 * Harness-only: simulate provider capture/fail for automated tests.
 * Requires PAYMENT_GATEWAY_MOCK=true and non-production.
 */
commercePaymentsRouter.post(
  '/commerce/payments/harness/complete',
  ...requireAuth,
  async (req, res) => {
    try {
      const paymentId = String(req.body?.paymentId || '').trim();
      const outcome = String(req.body?.outcome || 'captured').trim() as
        | 'captured'
        | 'failed'
        | 'cancelled';
      if (!paymentId) {
        res.status(400).json({ success: false, error: 'paymentId is required' });
        return;
      }
      const updated = await harnessCompletePayment({
        paymentId,
        outcome,
        valId: typeof req.body?.valId === 'string' ? req.body.valId : undefined,
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * Harness crash simulation — capture persisted without full Order confirm.
 * Body: { paymentId, valId?, confirmFirstNOrders? }
 */
commercePaymentsRouter.post(
  '/commerce/payments/harness/simulate-capture-crash',
  ...requireAuth,
  async (req, res) => {
    try {
      const paymentId = String(req.body?.paymentId || '').trim();
      if (!paymentId) {
        res.status(400).json({ success: false, error: 'paymentId is required' });
        return;
      }
      const updated = await harnessSimulateCaptureCrashBeforeConfirm({
        paymentId,
        valId: typeof req.body?.valId === 'string' ? req.body.valId : undefined,
        confirmFirstNOrders:
          typeof req.body?.confirmFirstNOrders === 'number'
            ? req.body.confirmFirstNOrders
            : undefined,
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * Harness crash simulation — Failed persisted without reservation release.
 */
commercePaymentsRouter.post(
  '/commerce/payments/harness/simulate-failure-crash',
  ...requireAuth,
  async (req, res) => {
    try {
      const paymentId = String(req.body?.paymentId || '').trim();
      if (!paymentId) {
        res.status(400).json({ success: false, error: 'paymentId is required' });
        return;
      }
      const updated = await harnessSimulateFailureCrashBeforeRelease({
        paymentId,
        status: req.body?.status === 'cancelled' ? 'cancelled' : 'failed',
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * POST /commerce/payments/initiate
 * Body: { checkoutId, paymentMethod, idempotencyKey?, amount? (ignored), customer? }
 */
commercePaymentsRouter.post('/commerce/payments/initiate', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const checkoutId = String(body.checkoutId || '').trim();
    const paymentMethod = String(body.paymentMethod || body.method || 'full').trim();
    if (!checkoutId) {
      res.status(400).json({ success: false, error: 'checkoutId is required' });
      return;
    }

    const result = await initiateCommercePayment({
      checkoutId,
      consumerId: actorId(req),
      paymentMethod,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      amount: typeof body.amount === 'number' ? body.amount : undefined,
      customer: body.customer,
      actor: { userId: actorId(req), role: actorRole(req) },
      publicApiBase: publicApiBase(req),
      webBase: webBase(),
    });

    res.json({
      success: true,
      data: {
        payment: result.payment,
        redirectUrl: result.redirectUrl,
        chargeNow: result.chargeNow,
        reused: result.reused,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

/** GET /commerce/payments/:paymentId */
commercePaymentsRouter.get('/commerce/payments/:paymentId', ...requireAuth, async (req, res) => {
  try {
    const payment = await getPaymentForActor(req.params.paymentId, {
      userId: actorId(req),
      role: actorRole(req),
    });
    res.json({ success: true, data: payment });
  } catch (error) {
    handleError(res, error);
  }
});

/** GET /commerce/checkouts/:checkoutId/payments */
commercePaymentsRouter.get(
  '/commerce/checkouts/:checkoutId/payments',
  ...requireAuth,
  async (req, res) => {
    try {
      const list = await commercePaymentStore.listByCheckout(req.params.checkoutId);
      const uid = actorId(req);
      const role = String(actorRole(req) || '').toLowerCase();
      const visible = list.filter((p) => role.includes('admin') || p.consumerId === uid);
      if (list.length && !visible.length) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      res.json({ success: true, data: visible });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** POST /commerce/payments/:paymentId/cancel */
commercePaymentsRouter.post(
  '/commerce/payments/:paymentId/cancel',
  ...requireAuth,
  async (req, res) => {
    try {
      const payment = await getPaymentForActor(req.params.paymentId, {
        userId: actorId(req),
        role: actorRole(req),
      });
      if (payment.consumerId !== actorId(req)) {
        res.status(403).json({ success: false, error: 'Only the Consumer may cancel payment' });
        return;
      }
      const updated = await applyCommercePaymentFailure({
        payment,
        status: 'cancelled',
        failureCode: 'USER_CANCEL',
        failureMessage: 'Cancelled by consumer',
        actor: actorId(req),
        source: 'api',
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      handleError(res, error);
    }
  },
);
/** Commerce SSLCommerz IPN — untrusted until validateTransaction. */
commercePaymentsRouter.post('/commerce/payments/sslcommerz/ipn', async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  Logger.info('Commerce SSLCommerz IPN received', {
    keys: Object.keys(body),
    status: body.status,
    tran_id: body.tran_id,
    val_id: body.val_id,
  });
  try {
    const result = await processCommerceIpn(body);
    res.status(200).json(result);
  } catch (error) {
    Logger.error('Commerce IPN error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(200).json({
      received: true,
      credited: false,
      error: error instanceof Error ? error.message : 'ipn_error',
    });
  }
});

commercePaymentsRouter.get('/commerce/payments/sslcommerz/success', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const paymentId =
    typeof req.query.value_a === 'string'
      ? req.query.value_a
      : typeof req.query.paymentId === 'string'
        ? req.query.paymentId
        : undefined;
  const payment =
    (tranId ? await commercePaymentStore.getByTranId(tranId) : null) ||
    (paymentId ? await commercePaymentStore.getPayment(paymentId) : null);
  Logger.info('Commerce SSLCommerz browser success (untrusted)', {
    tranId,
    paymentId: payment?.paymentId,
    status: payment?.status,
  });
  redirectToWeb(res, '/payment/return', {
    outcome: 'success',
    paymentId: payment?.paymentId,
    checkoutId: payment?.checkoutId,
    tran_id: tranId,
  });
});

commercePaymentsRouter.get('/commerce/payments/sslcommerz/fail', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const payment = tranId ? await commercePaymentStore.getByTranId(tranId) : null;
  if (payment) {
    await applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: 'BROWSER_FAIL',
      source: 'browser_hint',
    });
  }
  redirectToWeb(res, '/payment/return', {
    outcome: 'fail',
    paymentId: payment?.paymentId,
    checkoutId: payment?.checkoutId,
    tran_id: tranId,
  });
});

commercePaymentsRouter.get('/commerce/payments/sslcommerz/cancel', async (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const payment = tranId ? await commercePaymentStore.getByTranId(tranId) : null;
  if (payment) {
    await applyCommercePaymentFailure({
      payment,
      status: 'cancelled',
      failureCode: 'BROWSER_CANCEL',
      source: 'browser_hint',
    });
  }
  redirectToWeb(res, '/payment/return', {
    outcome: 'cancel',
    paymentId: payment?.paymentId,
    checkoutId: payment?.checkoutId,
    tran_id: tranId,
  });
});

/** Probe helper — flush payments memory snapshot. */
commercePaymentsRouter.post('/commerce/payments/_flush', ...requireAuth, async (_req, res) => {
  try {
    commercePaymentStore.flushMemory();
    res.json({ success: true, mode: getPaymentsPersistenceMode() });
  } catch (error) {
    handleError(res, error);
  }
});
