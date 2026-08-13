import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireMarketplaceAccess } from '../entitlements/marketplaceAccessMiddleware';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import { Logger } from '../lib/logger';
import {
  applyFailedPayment,
  applySuccessfulPayment,
  findOrderForPayment,
  getLivePaymentProvider,
  isSslcommerzLiveConfigured,
  resolveChargeAmount,
} from './paymentService';
import { sslcommerzProvider } from './sslcommerzProvider';

export const paymentsRouter = Router();

const requireAuth = [authenticateRequest, requireMarketplaceAccess];

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

function userOwnsOrder(
  req: { userId?: string },
  order: { buyerId: string },
): boolean {
  return Boolean(req.userId && order.buyerId === req.userId);
}

/**
 * Public config probe — frontend only shows "Pay online (SSLCommerz)" when configured:true.
 * Credentials must be set; mock mode never flips this for real users.
 */
paymentsRouter.get('/operations/payments/sslcommerz/status', (_req, res) => {
  const configured = isSslcommerzLiveConfigured();
  res.json({
    data: {
      configured,
      provider: 'sslcommerz',
      mode: configured ? sslcommerzProvider.getMode() : null,
    },
  });
});

/**
 * Start an SSLCommerz session for an unpaid order owned by the caller.
 */
paymentsRouter.post('/operations/payments/sslcommerz/init', ...requireAuth, async (req, res) => {
  try {
    const provider = getLivePaymentProvider();
    if (!provider) {
      res.status(503).json({
        error: 'payment_gateway_unavailable',
        message: 'Payment gateway not available. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.',
      });
      return;
    }

    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }

    const order = operationsStore.getOrder(orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (!userOwnsOrder(req, order)) {
      res.status(403).json({ error: 'Not authorized to pay for this order' });
      return;
    }
    if (order.paymentStatus === 'paid' || order.paidAt) {
      res.status(409).json({
        error: 'already_paid',
        message: 'This order is already paid',
        data: { orderId: order.orderId, paymentStatus: order.paymentStatus },
      });
      return;
    }

    const amount = resolveChargeAmount(order);
    if (!(amount > 0)) {
      res.status(400).json({ error: 'Order has no payable amount' });
      return;
    }

    const apiBase = publicApiBase(req);
    const site = webBase();
    const tranId = `TXN-${order.orderId}-${Date.now()}`;

    const session = await provider.initiateSession({
      order,
      amount,
      currency: 'BDT',
      tranId,
      successUrl: `${apiBase}/operations/payments/sslcommerz/success`,
      failUrl: `${apiBase}/operations/payments/sslcommerz/fail`,
      cancelUrl: `${apiBase}/operations/payments/sslcommerz/cancel`,
      ipnUrl: `${apiBase}/operations/payments/sslcommerz/ipn`,
      customer: {
        name: order.shipping?.fullName || 'Customer',
        phone: order.shipping?.phone,
        address: order.shipping?.address,
        city: order.shipping?.region || 'Dhaka',
        email: typeof req.body?.customerEmail === 'string' ? req.body.customerEmail : undefined,
      },
    });

    operationsStore.updateOrder(order.orderId, {
      paymentProvider: 'sslcommerz',
      paymentMethod: 'online',
      paymentStatus: 'pending',
      paymentTranId: session.tranId,
      status: 'pending_payment',
    });
    scheduleOperationsPersist();

    Logger.info('SSLCommerz session initiated', {
      orderId: order.orderId,
      tranId: session.tranId,
      amount,
    });

    res.json({
      success: true,
      data: {
        redirectUrl: session.redirectUrl,
        tranId: session.tranId,
        orderId: order.orderId,
        amount,
      },
    });
  } catch (error) {
    Logger.error('SSLCommerz init failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to initiate payment',
    });
  }
});

/**
 * SSLCommerz IPN — unauthenticated by design. NEVER credit from payload alone;
 * always call Order Validation API, match amount, and enforce val_id idempotency.
 */
paymentsRouter.post('/operations/payments/sslcommerz/ipn', async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  Logger.info('SSLCommerz IPN received', {
    keys: Object.keys(body),
    status: body.status,
    tran_id: body.tran_id,
    val_id: body.val_id,
    amount: body.amount,
    value_a: body.value_a,
  });

  try {
    const provider = getLivePaymentProvider();
    if (!provider) {
      Logger.warn('SSLCommerz IPN ignored — gateway not configured');
      res.status(503).json({ error: 'payment_gateway_unavailable' });
      return;
    }

    const valId = String(body.val_id || '').trim();
    const tranId = String(body.tran_id || '').trim();
    const orderIdHint = String(body.value_a || body.orderId || '').trim();
    const ipnStatus = String(body.status || '').toUpperCase();

    const order = findOrderForPayment({ tranId, orderId: orderIdHint });
    if (!order) {
      Logger.warn('SSLCommerz IPN — order not found', { tranId, orderIdHint });
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (!valId) {
      if (ipnStatus === 'FAILED' || ipnStatus === 'CANCELLED' || ipnStatus === 'UNATTEMPTED') {
        applyFailedPayment(order, ipnStatus === 'CANCELLED' ? 'cancelled' : 'failed');
        Logger.info('SSLCommerz IPN recorded non-success without val_id', {
          orderId: order.orderId,
          ipnStatus,
        });
      }
      res.status(200).json({ received: true, credited: false, reason: 'no_val_id' });
      return;
    }

    // CRITICAL: independent server-to-server validation — never trust IPN fields alone.
    const validation = await provider.validateTransaction(valId);
    Logger.info('SSLCommerz Order Validation API result', {
      orderId: order.orderId,
      valId,
      valid: validation.valid,
      status: validation.status,
      amount: validation.amount,
      tranId: validation.tranId,
    });

    if (!validation.valid) {
      applyFailedPayment(order, 'failed');
      res.status(200).json({ received: true, credited: false, reason: 'validation_not_valid' });
      return;
    }

    const updated = applySuccessfulPayment({
      order,
      validation,
      source: 'ipn',
    });

    res.status(200).json({
      received: true,
      credited: Boolean(updated && updated.paymentStatus === 'paid'),
      orderId: order.orderId,
      paymentStatus: updated?.paymentStatus || order.paymentStatus,
    });
  } catch (error) {
    Logger.error('SSLCommerz IPN handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still 200 so SSLCommerz does not hammer retries for handler bugs —
    // ops can replay from logs once fixed.
    res.status(200).json({
      received: true,
      credited: false,
      error: error instanceof Error ? error.message : 'ipn_error',
    });
  }
});

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

/**
 * Browser return URLs — NOT proof of payment. Customer lands here; truth is IPN+validation.
 */
paymentsRouter.get('/operations/payments/sslcommerz/success', (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const order =
    findOrderForPayment({
      tranId,
      orderId: typeof req.query.value_a === 'string' ? req.query.value_a : undefined,
    }) ||
    (typeof req.query.orderId === 'string' ? operationsStore.getOrder(req.query.orderId) : null);

  Logger.info('SSLCommerz browser success redirect (untrusted)', {
    tranId,
    orderId: order?.orderId,
    paymentStatus: order?.paymentStatus,
  });

  redirectToWeb(res, '/payment/return', {
    outcome: 'success',
    orderId: order?.orderId,
    tran_id: tranId,
  });
});

paymentsRouter.get('/operations/payments/sslcommerz/fail', (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const order = findOrderForPayment({
    tranId,
    orderId: typeof req.query.value_a === 'string' ? req.query.value_a : undefined,
  });
  if (order) applyFailedPayment(order, 'failed');
  Logger.info('SSLCommerz browser fail redirect (untrusted)', {
    tranId,
    orderId: order?.orderId,
  });
  redirectToWeb(res, '/payment/return', {
    outcome: 'fail',
    orderId: order?.orderId,
    tran_id: tranId,
  });
});

paymentsRouter.get('/operations/payments/sslcommerz/cancel', (req, res) => {
  const tranId = typeof req.query.tran_id === 'string' ? req.query.tran_id : undefined;
  const order = findOrderForPayment({
    tranId,
    orderId: typeof req.query.value_a === 'string' ? req.query.value_a : undefined,
  });
  if (order) applyFailedPayment(order, 'cancelled');
  Logger.info('SSLCommerz browser cancel redirect (untrusted)', {
    tranId,
    orderId: order?.orderId,
  });
  redirectToWeb(res, '/payment/return', {
    outcome: 'cancel',
    orderId: order?.orderId,
    tran_id: tranId,
  });
});
