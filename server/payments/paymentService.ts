import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import type { OpsStorefrontOrder } from '../operations/types';
import { Logger } from '../lib/logger';
import { mockPaymentProvider } from './mockProvider';
import { sslcommerzProvider } from './sslcommerzProvider';
import type { PaymentGatewayProvider, PaymentValidationResult } from './types';

/** In-memory + order-field idempotency for processed SSLCommerz val_ids. */
const processedValIds = new Set<string>();

export function isSslcommerzLiveConfigured(): boolean {
  return sslcommerzProvider.isConfigured();
}

/**
 * Provider used for real HTTP payment routes.
 * Only SSLCommerz with real credentials — mock never powers customer-facing checkout.
 */
export function getLivePaymentProvider(): PaymentGatewayProvider | null {
  if (sslcommerzProvider.isConfigured()) return sslcommerzProvider;
  return null;
}

/** Harness-only provider (PAYMENT_GATEWAY_MOCK=true). */
export function getMockPaymentProvider(): PaymentGatewayProvider | null {
  if (mockPaymentProvider.isConfigured()) return mockPaymentProvider;
  return null;
}

export function resolveChargeAmount(order: OpsStorefrontOrder): number {
  if (order.isPartialPayment && typeof order.depositAmount === 'number' && order.depositAmount > 0) {
    return Number(order.depositAmount);
  }
  return Number(order.overallTotal) || 0;
}

export function amountsMatch(expected: number, actual: number, tolerance = 0.01): boolean {
  return Math.abs(Number(expected) - Number(actual)) <= tolerance;
}

export function hasProcessedValId(valId: string): boolean {
  if (!valId) return false;
  if (processedValIds.has(valId)) return true;
  const orders = operationsStore.listOrders();
  return orders.some(
    (o) => o.paymentValId === valId && (o.paymentStatus === 'paid' || Boolean(o.paidAt)),
  );
}

export function markValIdProcessed(valId: string): void {
  if (valId) processedValIds.add(valId);
}

export function findOrderForPayment(params: {
  tranId?: string;
  orderId?: string;
}): OpsStorefrontOrder | null {
  const tranId = params.tranId?.trim();
  const orderId = params.orderId?.trim();
  if (tranId) {
    const byTran = operationsStore
      .listOrders()
      .find((o) => o.paymentTranId === tranId);
    if (byTran) return byTran;
  }
  if (orderId) {
    return operationsStore.getOrder(orderId);
  }
  return null;
}

export function applySuccessfulPayment(params: {
  order: OpsStorefrontOrder;
  validation: PaymentValidationResult;
  source: 'ipn' | 'harness';
}): OpsStorefrontOrder | null {
  const { order, validation, source } = params;
  const valId = validation.valId;

  if (hasProcessedValId(valId) || order.paymentStatus === 'paid') {
    Logger.info('Payment already processed — idempotent skip', {
      orderId: order.orderId,
      valId,
      source,
    });
    return order;
  }

  const expected = resolveChargeAmount(order);
  if (!validation.valid) {
    Logger.warn('Payment validation not VALID — not crediting order', {
      orderId: order.orderId,
      status: validation.status,
      source,
    });
    return null;
  }
  if (!amountsMatch(expected, validation.amount)) {
    Logger.error('Payment amount mismatch — not crediting order', {
      orderId: order.orderId,
      expected,
      actual: validation.amount,
      source,
    });
    return null;
  }
  if (validation.tranId && order.paymentTranId && validation.tranId !== order.paymentTranId) {
    Logger.error('Payment tran_id mismatch — not crediting order', {
      orderId: order.orderId,
      expectedTranId: order.paymentTranId,
      actualTranId: validation.tranId,
      source,
    });
    return null;
  }

  const now = new Date().toISOString();
  const updated = operationsStore.updateOrder(order.orderId, {
    paymentStatus: 'paid',
    paymentValId: valId,
    paidAmount: validation.amount,
    paymentValidatedAt: now,
    paidAt: now,
    invoiceGeneratedAt: order.invoiceGeneratedAt || now,
    // pending_payment → confirmed once independently validated
    status: order.status === 'pending_payment' ? 'confirmed' : order.status,
  });
  if (updated) {
    markValIdProcessed(valId);
    scheduleOperationsPersist();
    Logger.info('Order credited after independent payment validation', {
      orderId: order.orderId,
      valId,
      amount: validation.amount,
      source,
    });
  }
  return updated;
}

export function applyFailedPayment(order: OpsStorefrontOrder, status: 'failed' | 'cancelled'): void {
  if (order.paymentStatus === 'paid') return;
  operationsStore.updateOrder(order.orderId, { paymentStatus: status });
  scheduleOperationsPersist();
}

/** Exported for harness only — clears processed set between tests. */
export function __resetProcessedValIdsForTests(): void {
  processedValIds.clear();
}
