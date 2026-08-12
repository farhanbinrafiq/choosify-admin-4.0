/**
 * Commerce Payment Engine — Sprint 7 / IS-010 Sprint 10.
 * Connects Commerce Checkout + split Orders to SSLCommerz / mock providers.
 * Payment records are server SoT. Escrow creation is triggered after Capture (Sprint 8).
 */

import { randomUUID } from 'node:crypto';
import { commerceStore } from '../commerce/commerceStore';
import {
  applyPaymentFailureInventoryRelease,
  confirmOrdersForCapturedPayment,
} from '../commerce/orderService';
import { CommerceError } from '../commerce/cartService';
import type { CommerceOrder } from '../commerce/types';
import { publishEvent } from '../events/eventBus';
import { Logger } from '../lib/logger';
import {
  advanceToCaptured,
  canTransitionPayment,
  normalizePaymentStatus,
  transitionPayment,
  type PaymentLifecycleStatus,
} from './paymentLifecycle';
import {
  calculatePayable,
  getPlatformPaymentPolicy,
  listEnabledPaymentPolicies,
  type PlatformPaymentMethodId,
} from './paymentPolicy';
import { commercePaymentStore } from './commercePaymentStore';
import type {
  CommerceOrderPaymentStatus,
  CommercePayment,
  CommercePaymentInitInput,
} from './commercePaymentTypes';
import { mockPaymentProvider } from './mockProvider';
import { sslcommerzProvider } from './sslcommerzProvider';
import type { PaymentGatewayProvider, PaymentValidationResult } from './types';
import { amountsMatch } from './paymentService';

function nowIso(): string {
  return new Date().toISOString();
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CHOOSIFY_ENV === 'production'
  );
}

/**
 * Provider selection — fail closed in production if only mock is available.
 * Mock never powers customer-facing production checkout.
 */
export function resolveCommercePaymentProvider(): PaymentGatewayProvider {
  const mockOn =
    (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true';
  const sslOn = sslcommerzProvider.isConfigured();

  if (isProductionRuntime()) {
    if (mockOn && !sslOn) {
      throw new CommerceError(
        'Mock payment provider cannot run in production',
        503,
      );
    }
    if (!sslOn) {
      throw new CommerceError(
        'Payment gateway not available. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.',
        503,
      );
    }
    return sslcommerzProvider;
  }

  if (mockOn && mockPaymentProvider.isConfigured()) return mockPaymentProvider;
  if (sslOn) return sslcommerzProvider;
  if (mockOn) return mockPaymentProvider;
  throw new CommerceError(
    'Payment gateway not available. Set SSLCOMMERZ credentials or PAYMENT_GATEWAY_MOCK=true for local harness.',
    503,
  );
}

export function assertMockNotSilentInProduction(): void {
  if (
    isProductionRuntime() &&
    (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true' &&
    !sslcommerzProvider.isConfigured()
  ) {
    throw new CommerceError('Mock payment provider cannot run in production', 503);
  }
}

function emitPayment(
  name: string,
  payment: CommercePayment,
  actor: string,
  extra?: Record<string, unknown>,
): void {
  publishEvent({
    eventName: name,
    domain: 'Payments',
    producer: 'commercePaymentService',
    aggregateId: payment.paymentId,
    actor,
    payload: {
      paymentId: payment.paymentId,
      checkoutId: payment.checkoutId,
      orderIds: payment.orderIds,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      capturedAmount: payment.capturedAmount,
      outstandingAmount: payment.outstandingAmount,
      ...extra,
    },
  });
}

function mapOrderPaymentStatus(
  payment: CommercePayment,
): CommerceOrderPaymentStatus {
  if (payment.status === 'captured') {
    if (payment.outstandingAmount > 0.009) {
      return payment.paymentMethod === 'cod' ? 'cod_due' : 'partial';
    }
    return 'paid';
  }
  if (payment.status === 'failed') return 'failed';
  if (payment.status === 'cancelled') return 'cancelled';
  if (payment.paymentMethod === 'cod') {
    return payment.capturedAmount > 0 ? 'cod_due' : 'cod_due';
  }
  if (payment.status === 'pending' || payment.status === 'authorized') return 'pending';
  return 'unpaid';
}

function shouldConfirmAfterCapture(payment: CommercePayment): boolean {
  return (
    payment.paymentMethod === 'full' ||
    payment.paymentMethod === 'deposit' ||
    payment.paymentMethod === 'cod'
  );
}

async function checkoutHasCapturedSibling(
  checkoutId: string,
  excludePaymentId: string,
): Promise<boolean> {
  const siblings = await commercePaymentStore.listByCheckout(checkoutId);
  return siblings.some(
    (p) => p.paymentId !== excludePaymentId && p.status === 'captured',
  );
}

/**
 * Idempotent post-capture reconciliation — crash recovery for
 * Payment Captured before all Orders Confirmed / payment knowledge patched.
 * Does not re-charge provider. Emits PaymentCaptured at most once.
 */
export async function reconcileCapturedPaymentEffects(
  payment: CommercePayment,
  actor: string,
): Promise<CommercePayment> {
  if (payment.status !== 'captured') return payment;

  const shouldConfirm = shouldConfirmAfterCapture(payment);
  if (shouldConfirm) {
    await confirmOrdersForCapturedPayment({
      orderIds: payment.orderIds,
      actorId: actor,
      paymentId: payment.paymentId,
      reason: 'payment_captured',
    });
  }
  await patchOrdersPaymentKnowledge(payment, { confirmed: shouldConfirm });

  let next = payment;
  if (!next.paymentCapturedEmitted) {
    emitPayment('PaymentCaptured', next, actor, { source: 'reconcile' });
    next = { ...next, paymentCapturedEmitted: true, updatedAt: nowIso() };
    await commercePaymentStore.upsertPayment(next);
  }

  // Escrow Held from authoritative Capture only (idempotent; crash-recoverable).
  if (!next.escrowEffectsApplied) {
    try {
      const { reconcileEscrowEffectsForPayment } = await import('../escrow/escrowService');
      const result = await reconcileEscrowEffectsForPayment(next, actor);
      next = result.payment;
    } catch (error) {
      Logger.error('Escrow reconcile after capture failed (will retry on replay)', {
        paymentId: next.paymentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return next;
}

/**
 * Idempotent post-failure reconciliation — crash recovery when Failed/Cancelled
 * was persisted before reservation release completed.
 */
export async function reconcileFailedPaymentEffects(
  payment: CommercePayment,
  actor: string,
): Promise<CommercePayment> {
  if (payment.status !== 'failed' && payment.status !== 'cancelled') return payment;

  // Never release inventory if a later Captured sibling owns the Checkout.
  if (await checkoutHasCapturedSibling(payment.checkoutId, payment.paymentId)) {
    if (!payment.reservationReleased) {
      const patched = {
        ...payment,
        reservationReleased: true,
        updatedAt: nowIso(),
      };
      await commercePaymentStore.upsertPayment(patched);
      return patched;
    }
    return payment;
  }

  let next = payment;
  if (!next.reservationReleased) {
    await applyPaymentFailureInventoryRelease(next.orderIds);
    next = { ...next, reservationReleased: true, updatedAt: nowIso() };
    await commercePaymentStore.upsertPayment(next);
  }

  // Do not overwrite Orders that already show Captured sibling knowledge
  if (!(await checkoutHasCapturedSibling(payment.checkoutId, payment.paymentId))) {
    await patchOrdersPaymentKnowledge(next);
  }

  if (next.status === 'failed' && !next.paymentFailedEmitted) {
    emitPayment('PaymentFailed', next, actor, { source: 'reconcile' });
    next = { ...next, paymentFailedEmitted: true, updatedAt: nowIso() };
    await commercePaymentStore.upsertPayment(next);
  }
  if (next.status === 'cancelled' && !next.paymentCancelledEmitted) {
    emitPayment('PaymentCancelled', next, actor, { source: 'reconcile' });
    next = { ...next, paymentCancelledEmitted: true, updatedAt: nowIso() };
    await commercePaymentStore.upsertPayment(next);
  }
  return next;
}

async function patchOrdersPaymentKnowledge(
  payment: CommercePayment,
  opts?: { confirmed?: boolean },
): Promise<CommerceOrder[]> {
  const updated: CommerceOrder[] = [];
  const payStatus = mapOrderPaymentStatus(payment);
  const orders = (
    await Promise.all(payment.orderIds.map((id) => commerceStore.getOrder(id)))
  ).filter(Boolean) as CommerceOrder[];
  const checkoutTotal = orders.reduce((s, o) => s + (o.grandTotal || 0), 0) || 1;

  let allocatedCaptured = 0;
  let allocatedOutstanding = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const isLast = i === orders.length - 1;
    const share =
      checkoutTotal > 0 ? (order.grandTotal || 0) / checkoutTotal : 1 / Math.max(orders.length, 1);

    // Last Brand Order absorbs remainder so split sums exactly to Checkout-level amounts.
    const orderCaptured = isLast
      ? Math.round(((payment.capturedAmount || 0) - allocatedCaptured) * 100) / 100
      : Math.round((payment.capturedAmount || 0) * share * 100) / 100;
    const orderOutstanding = isLast
      ? Math.round(((payment.outstandingAmount || 0) - allocatedOutstanding) * 100) / 100
      : Math.round((payment.outstandingAmount || 0) * share * 100) / 100;
    allocatedCaptured += orderCaptured;
    allocatedOutstanding += orderOutstanding;

    let next: CommerceOrder = {
      ...order,
      paymentId: payment.paymentId,
      paymentMethod: payment.paymentMethod,
      paymentOption: payment.paymentOption,
      paymentStatus: payStatus,
      paymentProvider: payment.provider === 'none' ? undefined : payment.provider,
      paidAmount: orderCaptured,
      outstandingAmount: orderOutstanding,
      invoicePaymentStatus:
        payStatus === 'paid'
          ? 'Paid'
          : payStatus === 'partial' || payStatus === 'cod_due'
            ? 'Partial'
            : payStatus === 'failed'
              ? 'Unpaid'
              : 'Unpaid',
      updatedAt: nowIso(),
    };
    if (opts?.confirmed && next.status === 'pending') {
      next = { ...next, status: 'confirmed', updatedAt: nowIso() };
    }
    await commerceStore.upsertOrder(next);
    updated.push(next);
  }
  return updated;
}

export function listPaymentMethodsForApi() {
  return listEnabledPaymentPolicies().map((p) => ({
    id: p.id,
    option: p.option,
    label: p.label,
    depositPercent: p.depositPercent ?? null,
    requiresGatewayCapture: p.requiresGatewayCapture,
    codPrepaidDeliveryCharge: p.codPrepaidDeliveryCharge,
  }));
}

export async function initiateCommercePayment(
  input: CommercePaymentInitInput & {
    actor: { userId: string; role?: string };
    publicApiBase: string;
    webBase: string;
  },
): Promise<{
  payment: CommercePayment;
  redirectUrl: string | null;
  chargeNow: number;
  reused: boolean;
}> {
  assertMockNotSilentInProduction();

  const role = String(input.actor.role || '').toLowerCase();
  if (role === 'seller' && input.actor.userId !== input.consumerId) {
    // Seller must never initiate consumer payment
    throw new CommerceError('Sellers cannot initiate Consumer payment', 403);
  }
  if (role.includes('seller') && !role.includes('admin') && input.actor.userId !== input.consumerId) {
    throw new CommerceError('Sellers cannot initiate Consumer payment', 403);
  }

  const checkout = await commerceStore.getCheckout(input.checkoutId);
  if (!checkout) throw new CommerceError('Checkout not found', 404);
  if (checkout.consumerId !== input.actor.userId) {
    throw new CommerceError('Not authorized to pay for this checkout', 403);
  }

  const policy = getPlatformPaymentPolicy(input.paymentMethod);
  if (!policy || policy.deferred) {
    throw new CommerceError('Payment method not available', 400);
  }

  const idempotencyKey =
    (input.idempotencyKey || '').trim() ||
    `pay-${checkout.id}-${policy.id}-${Date.now()}`;

  const existing = await commercePaymentStore.getByIdempotency(
    checkout.consumerId,
    idempotencyKey,
  );
  if (existing && existing.status !== 'failed' && existing.status !== 'cancelled') {
    return {
      payment: existing,
      redirectUrl: null,
      chargeNow: existing.amount,
      reused: true,
    };
  }

  // Active captured payment for checkout blocks duplicate charge
  const prior = await commercePaymentStore.listByCheckout(checkout.id);
  const captured = prior.find((p) => p.status === 'captured' && p.outstandingAmount < 0.01);
  if (captured && policy.id === 'full') {
    throw new CommerceError('Checkout is already fully paid', 409);
  }

  const payable = calculatePayable({
    methodId: policy.id,
    grandTotal: checkout.grandTotal,
    deliveryTotal: checkout.deliveryTotal,
    currency: checkout.currency || 'BDT',
  });

  // Spoofed client amount must not change server charge
  if (typeof input.amount === 'number' && !amountsMatch(input.amount, payable.chargeNow)) {
    Logger.warn('Client amount ignored — server authoritative', {
      clientAmount: input.amount,
      serverAmount: payable.chargeNow,
      checkoutId: checkout.id,
    });
  }

  const orders = (
    await Promise.all(checkout.orderIds.map((id) => commerceStore.getOrder(id)))
  ).filter(Boolean) as CommerceOrder[];
  if (orders.length === 0) {
    throw new CommerceError('Checkout has no orders', 400);
  }

  const now = nowIso();
  let payment: CommercePayment = {
    paymentId: `pay_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    checkoutId: checkout.id,
    orderIds: checkout.orderIds.slice(),
    consumerId: checkout.consumerId,
    paymentMethod: policy.id as PlatformPaymentMethodId,
    paymentOption: payable.paymentOption,
    provider: 'none',
    amount: payable.chargeNow,
    currency: payable.currency,
    authorizedAmount: 0,
    capturedAmount: 0,
    outstandingAmount: payable.outstanding,
    status: 'initiated',
    idempotencyKey,
    initiatedAt: now,
    createdAt: now,
    updatedAt: now,
    processedValIds: [],
  };
  try {
    const { ensureEntityReferenceId } = await import('../referenceIds/referenceIdService');
    payment.paymentReferenceId = await ensureEntityReferenceId({
      entityType: 'payment',
      internalId: payment.paymentId,
    });
  } catch {
    /* backfill can repair */
  }

  emitPayment('PaymentInitiated', payment, input.actor.userId);
  payment = {
    ...payment,
    status: transitionPayment(payment.status, 'pending'),
    updatedAt: nowIso(),
  };
  await commercePaymentStore.upsertPayment(payment);
  await patchOrdersPaymentKnowledge(payment);

  // Pure COD with no prepaid delivery — no gateway session
  if (policy.id === 'cod' && payable.chargeNow <= 0) {
    payment = await applyCodWithoutGatewayCapture(payment, input.actor.userId);
    return {
      payment,
      redirectUrl: null,
      chargeNow: 0,
      reused: false,
    };
  }

  if (payable.chargeNow <= 0) {
    throw new CommerceError('Nothing to charge for selected payment method', 400);
  }

  const provider = resolveCommercePaymentProvider();
  const apiBase = input.publicApiBase.replace(/\/$/, '');
  const tranId = `CTXN-${payment.paymentId}-${Date.now()}`;

  const session = await provider.initiateSession({
    order: { orderId: payment.paymentId },
    amount: payable.chargeNow,
    currency: payable.currency,
    tranId,
    successUrl: `${apiBase}/commerce/payments/sslcommerz/success`,
    failUrl: `${apiBase}/commerce/payments/sslcommerz/fail`,
    cancelUrl: `${apiBase}/commerce/payments/sslcommerz/cancel`,
    ipnUrl: `${apiBase}/commerce/payments/sslcommerz/ipn`,
    customer: {
      name: input.customer?.name || orders[0]?.shipping?.fullName || 'Customer',
      email: input.customer?.email,
      phone: input.customer?.phone || orders[0]?.shipping?.phone,
      address: input.customer?.address || orders[0]?.shipping?.address,
      city: input.customer?.city || orders[0]?.shipping?.region || 'Dhaka',
    },
  });

  payment = {
    ...payment,
    provider: provider.id,
    providerTransactionId: session.tranId,
    providerSessionId: session.sessionKey,
    updatedAt: nowIso(),
  };
  await commercePaymentStore.upsertPayment(payment);
  await patchOrdersPaymentKnowledge(payment);

  Logger.info('Commerce payment session initiated', {
    paymentId: payment.paymentId,
    checkoutId: checkout.id,
    amount: payable.chargeNow,
    method: policy.id,
    provider: provider.id,
  });

  return {
    payment,
    redirectUrl: session.redirectUrl,
    chargeNow: payable.chargeNow,
    reused: false,
  };
}

/** COD with zero gateway charge — no fake capture; Confirm allowed by policy (seller/admin). */
async function applyCodWithoutGatewayCapture(
  payment: CommercePayment,
  actorId: string,
): Promise<CommercePayment> {
  const now = nowIso();
  const checkout = await commerceStore.getCheckout(payment.checkoutId);
  let next: CommercePayment = {
    ...payment,
    provider: 'none',
    status: 'authorized',
    authorizedAmount: 0,
    capturedAmount: 0,
    authorizedAt: now,
    updatedAt: now,
    amount: 0,
    outstandingAmount: checkout?.grandTotal ?? payment.outstandingAmount,
  };
  await commercePaymentStore.upsertPayment(next);
  await patchOrdersPaymentKnowledge(next);
  emitPayment('PaymentAuthorized', next, actorId, { cod: true, noGatewayCapture: true });
  return next;
}

export async function applyValidatedCommerceCapture(params: {
  payment: CommercePayment;
  validation: PaymentValidationResult;
  source: 'ipn' | 'harness' | 'browser_hint';
  actor?: string;
}): Promise<CommercePayment> {
  const { payment, validation, source } = params;
  const actor = params.actor || 'payment_provider';
  const valId = validation.valId;

  // Crash recovery: already Captured → reconcile Orders/events without re-charge.
  if (payment.status === 'captured') {
    Logger.info('Commerce payment already captured — reconcile idempotent', {
      paymentId: payment.paymentId,
      valId,
      source,
    });
    return reconcileCapturedPaymentEffects(payment, actor);
  }

  if (payment.status === 'failed' || payment.status === 'cancelled') {
    const laterCaptured = await checkoutHasCapturedSibling(
      payment.checkoutId,
      payment.paymentId,
    );
    if (laterCaptured) {
      Logger.warn('Ignoring capture on failed payment — later capture exists', {
        paymentId: payment.paymentId,
      });
      return payment;
    }
  }

  if (valId && (await commercePaymentStore.hasProcessedValId(valId))) {
    const fresh = await commercePaymentStore.getPayment(payment.paymentId);
    if (fresh?.status === 'captured' || fresh?.processedValIds?.includes(valId)) {
      return reconcileCapturedPaymentEffects(fresh || payment, actor);
    }
    // Same provider val_id already bound to another payment — do not attach twice.
    Logger.warn('Provider val_id already processed for another payment', {
      paymentId: payment.paymentId,
      valId,
    });
    throw new CommerceError('Provider transaction already processed', 409);
  }

  // Provider transaction uniqueness across Payments
  if (validation.tranId) {
    const byTran = await commercePaymentStore.getByTranId(validation.tranId);
    if (
      byTran &&
      byTran.paymentId !== payment.paymentId &&
      (byTran.status === 'captured' || byTran.providerValId)
    ) {
      throw new CommerceError(
        'Provider transaction already attached to another Payment',
        409,
      );
    }
  }

  if (!validation.valid) {
    return applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: validation.status || 'INVALID',
      failureMessage: 'Provider validation not VALID',
      actor,
      source,
    });
  }

  if (!amountsMatch(payment.amount, validation.amount)) {
    Logger.error('Commerce payment amount mismatch', {
      paymentId: payment.paymentId,
      expected: payment.amount,
      actual: validation.amount,
      source,
    });
    return applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: 'AMOUNT_MISMATCH',
      failureMessage: `Expected ${payment.amount}, got ${validation.amount}`,
      actor,
      source,
    });
  }

  if (
    validation.currency &&
    payment.currency &&
    String(validation.currency).toUpperCase() !== String(payment.currency).toUpperCase()
  ) {
    return applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: 'CURRENCY_MISMATCH',
      failureMessage: `Expected ${payment.currency}, got ${validation.currency}`,
      actor,
      source,
    });
  }

  if (
    validation.tranId &&
    payment.providerTransactionId &&
    validation.tranId !== payment.providerTransactionId
  ) {
    Logger.error('Commerce payment tran_id mismatch', {
      paymentId: payment.paymentId,
      expected: payment.providerTransactionId,
      actual: validation.tranId,
    });
    return applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: 'TRAN_ID_MISMATCH',
      failureMessage: 'Provider tran_id does not match payment session',
      actor,
      source,
    });
  }

  const now = nowIso();
  let next: CommercePayment = { ...payment };

  // Normalize lifecycle: Pending → Authorized → Captured
  if (next.status === 'initiated' || next.status === 'pending' || next.status === 'failed') {
    if (next.status === 'failed') {
      next = {
        ...next,
        status: 'pending',
        failedAt: undefined,
        failureCode: undefined,
        failureMessage: undefined,
      };
    }
    if (next.status === 'initiated') {
      next = { ...next, status: transitionPayment('initiated', 'pending') };
    }
    next = {
      ...next,
      status: transitionPayment(next.status, 'authorized'),
      authorizedAmount: validation.amount,
      authorizedAt: now,
      updatedAt: now,
    };
    emitPayment('PaymentAuthorized', next, actor);
  }

  next = {
    ...next,
    status: advanceToCaptured(next.status === 'authorized' ? 'authorized' : next.status),
    capturedAmount: validation.amount,
    capturedAt: now,
    providerValId: valId || next.providerValId,
    providerTransactionId: validation.tranId || next.providerTransactionId,
    processedValIds: [...new Set([...(next.processedValIds || []), valId].filter(Boolean))],
    paymentCapturedEmitted: false,
    updatedAt: now,
  };

  if (next.paymentMethod === 'full') {
    next.outstandingAmount = 0;
  }

  // Persist Captured BEFORE side-effects so crash recovery can reconcile via replay.
  if (valId) await commercePaymentStore.markValIdProcessed(valId);
  await commercePaymentStore.upsertPayment(next);

  // Confirm + patch + emit (idempotent via reconcileCapturedPaymentEffects)
  next = await reconcileCapturedPaymentEffects(next, actor);

  Logger.info('Commerce payment captured', {
    paymentId: next.paymentId,
    amount: next.capturedAmount,
    source,
  });

  return next;
}

export async function applyCommercePaymentFailure(params: {
  payment: CommercePayment;
  status: 'failed' | 'cancelled';
  failureCode?: string;
  failureMessage?: string;
  actor?: string;
  source?: string;
}): Promise<CommercePayment> {
  const { payment, status } = params;
  const actor = params.actor || 'payment_provider';

  // Stale Failed must never downgrade an already-Captured payment.
  if (payment.status === 'captured') {
    Logger.warn('Ignoring failure on already-captured payment', {
      paymentId: payment.paymentId,
    });
    return reconcileCapturedPaymentEffects(payment, actor);
  }

  // Stale Failed on attempt A after attempt B Captured — do not release B's reservation
  // or downgrade Checkout/Order payment knowledge.
  if (await checkoutHasCapturedSibling(payment.checkoutId, payment.paymentId)) {
    Logger.warn('Ignoring failure — sibling Captured payment owns checkout', {
      paymentId: payment.paymentId,
      checkoutId: payment.checkoutId,
    });
    if (payment.status === status) {
      return reconcileFailedPaymentEffects(
        { ...payment, reservationReleased: true },
        actor,
      );
    }
    const quarantined: CommercePayment = {
      ...payment,
      status,
      failureCode: params.failureCode || 'STALE_AFTER_CAPTURE',
      failureMessage: params.failureMessage || 'Superseded by later Captured payment',
      failedAt: status === 'failed' ? nowIso() : payment.failedAt,
      cancelledAt: status === 'cancelled' ? nowIso() : payment.cancelledAt,
      reservationReleased: true,
      updatedAt: nowIso(),
    };
    await commercePaymentStore.upsertPayment(quarantined);
    if (status === 'failed' && !quarantined.paymentFailedEmitted) {
      // Do not emit PaymentFailed for stale superseded attempts (avoid noise / double-signal)
    }
    return quarantined;
  }

  if (payment.status === status) {
    return reconcileFailedPaymentEffects(payment, actor);
  }

  const fromStatus = payment.status;
  const allowedFailFromAuthorized =
    (fromStatus === 'authorized' || fromStatus === 'initiated') &&
    (status === 'failed' || status === 'cancelled');
  if (!canTransitionPayment(fromStatus, status) && !allowedFailFromAuthorized) {
    throw new CommerceError(`Invalid payment transition ${fromStatus} → ${status}`);
  }

  const now = nowIso();
  // Persist Failed/Cancelled BEFORE release so crash recovery can finish release via replay.
  let next: CommercePayment = {
    ...payment,
    status,
    failureCode: params.failureCode,
    failureMessage: params.failureMessage,
    failedAt: status === 'failed' ? now : payment.failedAt,
    cancelledAt: status === 'cancelled' ? now : payment.cancelledAt,
    reservationReleased: false,
    updatedAt: now,
  };
  await commercePaymentStore.upsertPayment(next);

  next = await reconcileFailedPaymentEffects(next, actor);
  return next;
}

export async function processCommerceIpn(body: Record<string, unknown>): Promise<{
  received: boolean;
  credited: boolean;
  paymentId?: string;
  reason?: string;
}> {
  const provider = resolveCommercePaymentProvider();
  const valId = String(body.val_id || '').trim();
  const tranId = String(body.tran_id || '').trim();
  const paymentIdHint = String(body.value_a || body.paymentId || '').trim();
  const ipnStatus = String(body.status || '').toUpperCase();

  let payment =
    (tranId ? await commercePaymentStore.getByTranId(tranId) : null) ||
    (paymentIdHint ? await commercePaymentStore.getPayment(paymentIdHint) : null);

  if (!payment) {
    return { received: true, credited: false, reason: 'payment_not_found' };
  }

  if (!valId) {
    if (ipnStatus === 'FAILED' || ipnStatus === 'CANCELLED' || ipnStatus === 'UNATTEMPTED') {
      await applyCommercePaymentFailure({
        payment,
        status: ipnStatus === 'CANCELLED' ? 'cancelled' : 'failed',
        failureCode: ipnStatus,
        source: 'ipn',
      });
    }
    return { received: true, credited: false, paymentId: payment.paymentId, reason: 'no_val_id' };
  }

  const validation = await provider.validateTransaction(valId);
  if (!validation.valid) {
    await applyCommercePaymentFailure({
      payment,
      status: 'failed',
      failureCode: validation.status,
      failureMessage: 'Provider validation not VALID',
      source: 'ipn',
    });
    return { received: true, credited: false, paymentId: payment.paymentId, reason: 'validation_not_valid' };
  }

  const updated = await applyValidatedCommerceCapture({
    payment,
    validation,
    source: 'ipn',
  });

  return {
    received: true,
    credited: updated.status === 'captured',
    paymentId: updated.paymentId,
  };
}

/** Harness-only complete/fail for mock provider tests. */
export async function harnessCompletePayment(params: {
  paymentId: string;
  outcome: 'captured' | 'failed' | 'cancelled';
  valId?: string;
}): Promise<CommercePayment> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness endpoint requires PAYMENT_GATEWAY_MOCK=true', 403);
  }
  if (isProductionRuntime()) {
    throw new CommerceError('Harness forbidden in production', 403);
  }

  const payment = await commercePaymentStore.getPayment(params.paymentId);
  if (!payment) throw new CommerceError('Payment not found', 404);

  if (params.outcome === 'failed' || params.outcome === 'cancelled') {
    return applyCommercePaymentFailure({
      payment,
      status: params.outcome,
      failureCode: params.outcome.toUpperCase(),
      source: 'harness',
    });
  }

  const valId = params.valId || `mock_val_${payment.paymentId}_${Date.now()}`;
  mockPaymentProvider.seedValidation(valId, {
    valid: true,
    amount: payment.amount,
    currency: payment.currency || 'BDT',
    tranId: payment.providerTransactionId || `mock_tran_${payment.paymentId}`,
  });
  const validation = await mockPaymentProvider.validateTransaction(valId);
  return applyValidatedCommerceCapture({
    payment,
    validation,
    source: 'harness',
    actor: 'harness',
  });
}

/**
 * Harness: persist Captured + val_id WITHOUT confirming Orders / emitting capture.
 * Simulates crash after provider validation success, before Order confirm side-effects.
 * Replay via harnessCompletePayment / applyValidatedCommerceCapture must recover.
 */
export async function harnessSimulateCaptureCrashBeforeConfirm(params: {
  paymentId: string;
  valId?: string;
  /** Confirm only the first N orders then stop — multi-Brand interruption. */
  confirmFirstNOrders?: number;
}): Promise<CommercePayment> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness endpoint requires PAYMENT_GATEWAY_MOCK=true', 403);
  }
  if (isProductionRuntime()) {
    throw new CommerceError('Harness forbidden in production', 403);
  }
  const payment = await commercePaymentStore.getPayment(params.paymentId);
  if (!payment) throw new CommerceError('Payment not found', 404);
  if (payment.status === 'captured') {
    return payment;
  }

  const valId = params.valId || `crash_val_${payment.paymentId}`;
  const now = nowIso();
  let next: CommercePayment = {
    ...payment,
    status: 'captured',
    authorizedAmount: payment.amount,
    capturedAmount: payment.amount,
    authorizedAt: payment.authorizedAt || now,
    capturedAt: now,
    providerValId: valId,
    processedValIds: [...new Set([...(payment.processedValIds || []), valId])],
    paymentCapturedEmitted: false,
    updatedAt: now,
  };
  if (next.paymentMethod === 'full') next.outstandingAmount = 0;
  await commercePaymentStore.markValIdProcessed(valId);
  await commercePaymentStore.upsertPayment(next);

  if (typeof params.confirmFirstNOrders === 'number' && params.confirmFirstNOrders > 0) {
    const partialIds = next.orderIds.slice(0, params.confirmFirstNOrders);
    await confirmOrdersForCapturedPayment({
      orderIds: partialIds,
      actorId: 'harness_crash',
      paymentId: next.paymentId,
      reason: 'payment_captured',
    });
    // Leave remaining Orders Pending — crash mid multi-Brand apply
  }

  return next;
}

/**
 * Harness: persist Failed WITHOUT releasing reservation.
 * Simulates crash after Failed write, before inventory release.
 */
export async function harnessSimulateFailureCrashBeforeRelease(params: {
  paymentId: string;
  status?: 'failed' | 'cancelled';
}): Promise<CommercePayment> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness endpoint requires PAYMENT_GATEWAY_MOCK=true', 403);
  }
  if (isProductionRuntime()) {
    throw new CommerceError('Harness forbidden in production', 403);
  }
  const payment = await commercePaymentStore.getPayment(params.paymentId);
  if (!payment) throw new CommerceError('Payment not found', 404);
  if (payment.status === 'captured') {
    throw new CommerceError('Cannot simulate failure on Captured payment', 409);
  }
  const status = params.status || 'failed';
  const now = nowIso();
  const next: CommercePayment = {
    ...payment,
    status,
    failureCode: 'CRASH_SIM',
    failureMessage: 'Simulated crash before reservation release',
    failedAt: status === 'failed' ? now : payment.failedAt,
    cancelledAt: status === 'cancelled' ? now : payment.cancelledAt,
    reservationReleased: false,
    paymentFailedEmitted: false,
    paymentCancelledEmitted: false,
    updatedAt: now,
  };
  await commercePaymentStore.upsertPayment(next);
  return next;
}

export async function getPaymentForActor(
  paymentId: string,
  actor: { userId: string; role?: string },
): Promise<CommercePayment> {
  const payment = await commercePaymentStore.getPayment(paymentId);
  if (!payment) throw new CommerceError('Payment not found', 404);
  const role = String(actor.role || '').toLowerCase();
  if (role === 'admin' || role.includes('admin')) return payment;
  if (payment.consumerId === actor.userId) return payment;
  const orders = await Promise.all(
    payment.orderIds.map((id) => commerceStore.getOrder(id)),
  );
  if (orders.some((o) => o && o.sellerId === actor.userId)) return payment;
  throw new CommerceError('Not authorized', 403);
}

export {
  normalizePaymentStatus,
  canTransitionPayment,
  transitionPayment,
  advanceToCaptured,
};

export type { PaymentLifecycleStatus, CommercePayment };
