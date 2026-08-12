/**
 * Escrow / Settlement / Seller Balance / Refund service — Sprint 8 (IS-010 Sprint 11).
 * Finance-domain records; only PaymentCaptured creates Escrow.
 */

import { randomUUID } from 'node:crypto';
import { CommerceError } from '../commerce/cartService';
import { commerceStore } from '../commerce/commerceStore';
import type { CommerceOrder } from '../commerce/types';
import { publishEvent } from '../events/eventBus';
import { Logger } from '../lib/logger';
import { commercePaymentStore } from '../payments/commercePaymentStore';
import type { CommercePayment } from '../payments/commercePaymentTypes';
import { mockPaymentProvider } from '../payments/mockProvider';
import { sslcommerzProvider } from '../payments/sslcommerzProvider';
import type { PaymentGatewayProvider } from '../payments/types';
import { resolveSettlementCommission } from './commissionPolicy';
import { blocksSettlement, canRefundFromStatus, canSettleFromStatus } from './escrowLifecycle';
import { escrowStore } from './escrowStore';
import { addMajor, amountsEqual, subMajor, toMinor } from './money';
import type {
  CommerceEscrow,
  CommerceRefund,
  CommerceReturn,
  CommerceSettlement,
  EscrowStatus,
  SellerBalanceAccount,
  SellerBalanceLedgerEntry,
} from './types';
import { ensureEntityReferenceId } from '../referenceIds/referenceIdService';

function nowIso(): string {
  return new Date().toISOString();
}

function resolveRefundProvider(): PaymentGatewayProvider {
  const mockOn =
    (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true';
  const sslOn = sslcommerzProvider.isConfigured();
  if (mockOn && mockPaymentProvider.isConfigured()) return mockPaymentProvider;
  if (sslOn) return sslcommerzProvider;
  if (mockOn) return mockPaymentProvider;
  return sslcommerzProvider;
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function emitFinance(
  eventName: string,
  aggregateId: string,
  actor: string,
  payload: Record<string, unknown>,
): void {
  publishEvent({
    eventName,
    domain: 'Finance',
    producer: 'escrowService',
    aggregateId,
    actor,
    payload,
  });
}

export type AllocationShare = {
  order: CommerceOrder;
  capturedAmount: number;
};

/**
 * Same Payment×Order allocation rule as Sprint 7 payment knowledge patching.
 * Last Brand Order absorbs remainder so shares sum exactly.
 */
export function allocateCapturedToOrders(
  payment: CommercePayment,
  orders: CommerceOrder[],
): AllocationShare[] {
  const checkoutTotal = orders.reduce((s, o) => s + (o.grandTotal || 0), 0) || 1;
  let allocatedCaptured = 0;
  const shares: AllocationShare[] = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const isLast = i === orders.length - 1;
    const share =
      checkoutTotal > 0 ? (order.grandTotal || 0) / checkoutTotal : 1 / Math.max(orders.length, 1);
    const orderCaptured = isLast
      ? Math.round(((payment.capturedAmount || 0) - allocatedCaptured) * 100) / 100
      : Math.round((payment.capturedAmount || 0) * share * 100) / 100;
    allocatedCaptured += orderCaptured;
    shares.push({ order, capturedAmount: orderCaptured });
  }
  return shares;
}

function emptyBalance(sellerId: string, currency: string): SellerBalanceAccount {
  return {
    sellerId,
    currency,
    escrowBalance: 0,
    pendingSettlement: 0,
    availableBalance: 0,
    updatedAt: nowIso(),
  };
}

async function bumpEscrowBalanceAggregate(
  sellerId: string,
  currency: string,
  deltaHeld: number,
): Promise<void> {
  const bal = (await escrowStore.getBalance(sellerId, currency)) || emptyBalance(sellerId, currency);
  await escrowStore.upsertBalance({
    ...bal,
    escrowBalance: addMajor(bal.escrowBalance, deltaHeld),
    updatedAt: nowIso(),
  });
}

/**
 * Create Escrow Held for each Payment×Order allocation with capturedAmount > 0.
 * Idempotent on paymentId + orderId. Emits EscrowCreated once per allocation.
 */
export async function createEscrowsForCapturedPayment(
  payment: CommercePayment,
  actor: string,
): Promise<CommerceEscrow[]> {
  if (payment.status !== 'captured') {
    return [];
  }
  if (!payment.capturedAmount || payment.capturedAmount <= 0) {
    return [];
  }

  const orders = (
    await Promise.all(payment.orderIds.map((id) => commerceStore.getOrder(id)))
  ).filter(Boolean) as CommerceOrder[];

  const shares = allocateCapturedToOrders(payment, orders);
  const created: CommerceEscrow[] = [];

  for (const share of shares) {
    if (share.capturedAmount <= 0) continue;

    const existing = await escrowStore.getEscrowByPaymentOrder(
      payment.paymentId,
      share.order.id,
    );
    if (existing) {
      created.push(existing);
      if (!existing.escrowCreatedEmitted) {
        emitFinance('EscrowCreated', existing.escrowId, actor, {
          escrowId: existing.escrowId,
          paymentId: existing.paymentId,
          orderId: existing.orderId,
          amount: existing.capturedAmount,
          currency: existing.currency,
          source: 'reconcile',
        });
        const patched = {
          ...existing,
          escrowCreatedEmitted: true,
          updatedAt: nowIso(),
        };
        await escrowStore.upsertEscrow(patched);
        created[created.length - 1] = patched;
      }
      continue;
    }

    const now = nowIso();
    const escrow: CommerceEscrow = {
      escrowId: newId('esc'),
      paymentId: payment.paymentId,
      checkoutId: payment.checkoutId,
      orderId: share.order.id,
      consumerId: share.order.consumerId,
      sellerId: share.order.sellerId,
      brandId: share.order.brandId,
      currency: payment.currency || share.order.currency || 'BDT',
      capturedAmount: share.capturedAmount,
      heldAmount: share.capturedAmount,
      refundedAmount: 0,
      settledAmount: 0,
      commissionAmount: 0,
      sellerNetAmount: 0,
      status: 'held',
      escrowCreatedEmitted: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      escrow.escrowReferenceId = await ensureEntityReferenceId({
        entityType: 'escrow',
        internalId: escrow.escrowId,
        current: escrow.escrowReferenceId,
      });
    } catch {
      /* backfill can repair */
    }
    await escrowStore.upsertEscrow(escrow);
    await bumpEscrowBalanceAggregate(escrow.sellerId, escrow.currency, escrow.heldAmount);
    emitFinance('EscrowCreated', escrow.escrowId, actor, {
      escrowId: escrow.escrowId,
      paymentId: escrow.paymentId,
      orderId: escrow.orderId,
      amount: escrow.capturedAmount,
      currency: escrow.currency,
    });
    created.push(escrow);
  }

  return created;
}

/**
 * Crash recovery: Payment Captured → missing Escrow.
 * Does not re-charge. Safe to replay.
 */
export async function reconcileEscrowEffectsForPayment(
  payment: CommercePayment,
  actor: string,
): Promise<{ payment: CommercePayment; escrows: CommerceEscrow[] }> {
  if (payment.status !== 'captured') {
    return { payment, escrows: [] };
  }

  const escrows = await createEscrowsForCapturedPayment(payment, actor);
  let next = payment;
  if (!next.escrowEffectsApplied) {
    next = { ...next, escrowEffectsApplied: true, updatedAt: nowIso() };
    await commercePaymentStore.upsertPayment(next);
  }
  return { payment: next, escrows };
}

/**
 * Settle Escrow for an Order that reached Successful Completion (OrderCompleted).
 * OrderDelivered must NOT call this.
 */
export async function settleEscrowForOrder(
  orderId: string,
  actor: string,
): Promise<{ escrow: CommerceEscrow; settlement: CommerceSettlement } | null> {
  const escrows = await escrowStore.listEscrowsByOrder(orderId);
  if (!escrows.length) return null;

  // One Escrow per Payment×Order — settle all held for this order
  let last: { escrow: CommerceEscrow; settlement: CommerceSettlement } | null = null;
  for (const escrow of escrows) {
    last = await settleOneEscrow(escrow, actor);
  }
  return last;
}

async function settleOneEscrow(
  escrow: CommerceEscrow,
  actor: string,
): Promise<{ escrow: CommerceEscrow; settlement: CommerceSettlement }> {
  if (escrow.status === 'settled' && escrow.settlementId) {
    const existing = await escrowStore.getSettlement(escrow.settlementId);
    if (existing) {
      await creditSellerBalanceFromSettlement(existing, actor);
      return { escrow, settlement: existing };
    }
  }

  if (blocksSettlement(escrow.status) && escrow.status !== 'settled') {
    throw new CommerceError(`Escrow cannot settle while status is ${escrow.status}`, 409);
  }
  if (!canSettleFromStatus(escrow.status)) {
    throw new CommerceError(`Escrow status ${escrow.status} is not settlement-eligible`, 409);
  }

  const settleable = escrow.heldAmount;
  if (settleable <= 0) {
    throw new CommerceError('No settleable Escrow amount remaining', 400);
  }

  const existingByEscrow = await escrowStore.getSettlementByEscrow(escrow.escrowId);
  if (existingByEscrow) {
    let e = escrow;
    if (e.status !== 'settled') {
      e = {
        ...e,
        status: 'settled',
        settledAmount: settleable,
        heldAmount: 0,
        commissionAmount: existingByEscrow.commissionAmount,
        sellerNetAmount: existingByEscrow.sellerNetAmount,
        settlementId: existingByEscrow.settlementId,
        releasedAt: e.releasedAt || nowIso(),
        updatedAt: nowIso(),
      };
      if (!e.escrowReleasedEmitted) {
        emitFinance('EscrowReleased', e.escrowId, actor, {
          escrowId: e.escrowId,
          settlementId: existingByEscrow.settlementId,
          sellerNetAmount: existingByEscrow.sellerNetAmount,
          source: 'reconcile',
        });
        e = { ...e, escrowReleasedEmitted: true };
      }
      await escrowStore.upsertEscrow(e);
      await bumpEscrowBalanceAggregate(e.sellerId, e.currency, -settleable);
    }
    await creditSellerBalanceFromSettlement(existingByEscrow, actor);
    return { escrow: e, settlement: existingByEscrow };
  }

  const commission = resolveSettlementCommission(settleable);
  const now = nowIso();
  const settlement: CommerceSettlement = {
    settlementId: newId('stl'),
    escrowId: escrow.escrowId,
    paymentId: escrow.paymentId,
    orderId: escrow.orderId,
    checkoutId: escrow.checkoutId,
    sellerId: escrow.sellerId,
    brandId: escrow.brandId,
    currency: escrow.currency,
    grossAmount: settleable,
    commissionAmount: commission.commissionAmount,
    sellerNetAmount: commission.sellerNetAmount,
    sellerBalanceCredited: false,
    createdAt: now,
    updatedAt: now,
  };

  // Persist settlement first (crash boundary B/C recoverable)
  await escrowStore.upsertSettlement(settlement);

  let nextEscrow: CommerceEscrow = {
    ...escrow,
    status: 'settled',
    settledAmount: settleable,
    heldAmount: 0,
    commissionAmount: commission.commissionAmount,
    sellerNetAmount: commission.sellerNetAmount,
    settlementId: settlement.settlementId,
    releasedAt: now,
    updatedAt: now,
  };

  if (!nextEscrow.escrowReleasedEmitted) {
    emitFinance('EscrowReleased', nextEscrow.escrowId, actor, {
      escrowId: nextEscrow.escrowId,
      settlementId: settlement.settlementId,
      sellerNetAmount: commission.sellerNetAmount,
      commissionAmount: commission.commissionAmount,
      grossAmount: settleable,
    });
    nextEscrow = { ...nextEscrow, escrowReleasedEmitted: true };
  }
  await escrowStore.upsertEscrow(nextEscrow);
  await bumpEscrowBalanceAggregate(nextEscrow.sellerId, nextEscrow.currency, -settleable);

  const credited = await creditSellerBalanceFromSettlement(settlement, actor);
  return { escrow: nextEscrow, settlement: credited };
}

/**
 * Idempotent Seller Balance credit from Settlement.
 * Crash recovery: Settlement → missing balance credit.
 */
export async function creditSellerBalanceFromSettlement(
  settlement: CommerceSettlement,
  actor: string,
): Promise<CommerceSettlement> {
  const idempotencyKey = `settlement_credit:${settlement.settlementId}`;
  const existingEntry = await escrowStore.getBalanceEntryByIdempotency(idempotencyKey);
  if (existingEntry || settlement.sellerBalanceCredited) {
    if (!settlement.sellerBalanceCredited) {
      const patched = {
        ...settlement,
        sellerBalanceCredited: true,
        updatedAt: nowIso(),
      };
      await escrowStore.upsertSettlement(patched);
      return patched;
    }
    return settlement;
  }

  const bal =
    (await escrowStore.getBalance(settlement.sellerId, settlement.currency)) ||
    emptyBalance(settlement.sellerId, settlement.currency);

  // Move: Escrow → Pending was conceptual; Available receives net.
  const nextBal: SellerBalanceAccount = {
    ...bal,
    pendingSettlement: Math.max(0, subMajor(bal.pendingSettlement, settlement.sellerNetAmount)),
    availableBalance: addMajor(bal.availableBalance, settlement.sellerNetAmount),
    updatedAt: nowIso(),
  };
  await escrowStore.upsertBalance(nextBal);

  const entry: SellerBalanceLedgerEntry = {
    entryId: newId('sbe'),
    sellerId: settlement.sellerId,
    currency: settlement.currency,
    amount: settlement.sellerNetAmount,
    kind: 'settlement_credit',
    settlementId: settlement.settlementId,
    escrowId: settlement.escrowId,
    orderId: settlement.orderId,
    idempotencyKey,
    createdAt: nowIso(),
  };
  await escrowStore.appendBalanceEntry(entry);

  const patched: CommerceSettlement = {
    ...settlement,
    sellerBalanceCredited: true,
    updatedAt: nowIso(),
  };
  await escrowStore.upsertSettlement(patched);

  Logger.info('Seller Balance credited from Settlement', {
    settlementId: settlement.settlementId,
    sellerId: settlement.sellerId,
    amount: settlement.sellerNetAmount,
    actor,
  });

  return patched;
}

export async function reconcileSettlementBalanceCredit(
  settlementId: string,
  actor: string,
): Promise<CommerceSettlement | null> {
  const settlement = await escrowStore.getSettlement(settlementId);
  if (!settlement) return null;
  return creditSellerBalanceFromSettlement(settlement, actor);
}

function refundableAmount(escrow: CommerceEscrow): number {
  if (!canRefundFromStatus(escrow.status)) return 0;
  return Math.max(0, escrow.heldAmount);
}

export type ProcessRefundInput = {
  escrowId: string;
  amount?: number; // omit = full refundable
  reason: string;
  actor: { userId: string; role?: string };
  skipProvider?: boolean; // harness / already-done provider
  /** Set when Order cancel already authorized ownership — allow Escrow reverse. */
  authorizedCancelPath?: boolean;
};

/**
 * Full or Partial Refund against Held Escrow.
 * Provider refund first (when applicable), then local Escrow reversal.
 * Refund after Settlement → requires_financial_adjustment (Sprint 17 Finance clawback).
 */
export async function processEscrowRefund(
  input: ProcessRefundInput,
): Promise<CommerceRefund> {
  const reason = (input.reason || '').trim();
  if (!reason) throw new CommerceError('Refund reason is required');

  const escrow = await escrowStore.getEscrow(input.escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);

  if (!input.authorizedCancelPath) {
    await assertEscrowAccess(escrow, input.actor, 'refund');
  }

  // Idempotent replay: already fully refunded
  const prior = await escrowStore.listRefundsByEscrow(escrow.escrowId);
  if (escrow.status === 'full_refund') {
    const completed = prior.find((r) => r.status === 'completed');
    if (completed) return completed;
    throw new CommerceError('Escrow already fully refunded', 409);
  }

  if (escrow.status === 'settled') {
    const now = nowIso();
    const blocked: CommerceRefund = {
      refundId: newId('ref'),
      paymentId: escrow.paymentId,
      escrowId: escrow.escrowId,
      checkoutId: escrow.checkoutId,
      orderId: escrow.orderId,
      amount: input.amount ?? escrow.settledAmount,
      currency: escrow.currency,
      reason,
      requestedBy: input.actor.userId,
      status: 'requires_financial_adjustment',
      createdAt: now,
      updatedAt: now,
    };
    try {
      blocked.refundReferenceId = await ensureEntityReferenceId({
        entityType: 'refund',
        internalId: blocked.refundId,
        current: blocked.refundReferenceId,
      });
    } catch {
      /* backfill can repair */
    }
    await escrowStore.upsertRefund(blocked);
    return blocked;
  }

  const maxRefundable = refundableAmount(escrow);
  if (maxRefundable <= 0) {
    throw new CommerceError('Escrow is not refundable in current status', 409);
  }

  const amount =
    input.amount === undefined || input.amount === null
      ? maxRefundable
      : Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CommerceError('Invalid refund amount');
  }
  if (toMinor(amount) > toMinor(maxRefundable)) {
    throw new CommerceError('Refund amount exceeds refundable Escrow hold', 400);
  }

  // Idempotency: identical completed refund for same escrow+amount+reason
  const duplicate = prior.find(
    (r) =>
      r.status === 'completed' &&
      amountsEqual(r.amount, amount) &&
      r.reason === reason,
  );
  if (duplicate) return duplicate;

  // Resume in-flight refund with provider done but local reverse pending
  const inFlight = prior.find(
    (r) =>
      r.providerRefundDone &&
      r.status !== 'completed' &&
      amountsEqual(r.amount, amount),
  );
  if (inFlight) {
    return finalizeLocalRefundReversal(inFlight, escrow, input.actor.userId);
  }

  const now = nowIso();
  let refund: CommerceRefund = {
    refundId: newId('ref'),
    paymentId: escrow.paymentId,
    escrowId: escrow.escrowId,
    checkoutId: escrow.checkoutId,
    orderId: escrow.orderId,
    amount,
    currency: escrow.currency,
    reason,
    requestedBy: input.actor.userId,
    status: 'processing',
    createdAt: now,
    updatedAt: now,
  };
  try {
    refund.refundReferenceId = await ensureEntityReferenceId({
      entityType: 'refund',
      internalId: refund.refundId,
      current: refund.refundReferenceId,
    });
  } catch {
    /* backfill can repair */
  }
  await escrowStore.upsertRefund(refund);

  // Provider boundary — persist provider success before local reverse (crash D)
  if (!input.skipProvider) {
    const payment = await commercePaymentStore.getPayment(escrow.paymentId);
    if (payment && payment.provider !== 'none' && payment.capturedAmount > 0) {
      try {
        const provider = resolveRefundProvider();
        if (typeof provider.refundTransaction === 'function') {
          const bankTranId =
            payment.providerTransactionId ||
            payment.providerValId ||
            payment.paymentId;
          const result = await provider.refundTransaction({
            bankTranId,
            refundAmount: amount,
            refundRemarks: reason,
            refeId: refund.refundId,
          });
          if (!result.success) {
            refund = {
              ...refund,
              status: 'failed',
              updatedAt: nowIso(),
            };
            await escrowStore.upsertRefund(refund);
            throw new CommerceError(result.message || 'Provider refund failed', 502);
          }
          refund = {
            ...refund,
            providerRefundDone: true,
            providerRefundRefId: result.refundRefId,
            updatedAt: nowIso(),
          };
          await escrowStore.upsertRefund(refund);
        } else {
          refund = { ...refund, providerRefundDone: true, updatedAt: nowIso() };
          await escrowStore.upsertRefund(refund);
        }
      } catch (error) {
        if (error instanceof CommerceError) throw error;
        refund = {
          ...refund,
          status: 'failed',
          updatedAt: nowIso(),
        };
        await escrowStore.upsertRefund(refund);
        throw new CommerceError(
          error instanceof Error ? error.message : 'Provider refund error',
          502,
        );
      }
    } else {
      refund = { ...refund, providerRefundDone: true, updatedAt: nowIso() };
      await escrowStore.upsertRefund(refund);
    }
  } else {
    refund = {
      ...refund,
      providerRefundDone: true,
      providerRefundRefId: `skip_${refund.refundId}`,
      updatedAt: nowIso(),
    };
    await escrowStore.upsertRefund(refund);
  }

  return finalizeLocalRefundReversal(refund, escrow, input.actor.userId);
}

async function finalizeLocalRefundReversal(
  refund: CommerceRefund,
  escrowIn: CommerceEscrow,
  actor: string,
): Promise<CommerceRefund> {
  if (refund.status === 'completed') return refund;

  let escrow = (await escrowStore.getEscrow(escrowIn.escrowId)) || escrowIn;
  const amount = refund.amount;
  const remaining = subMajor(escrow.heldAmount, amount);
  const isFull = remaining <= 0 || amountsEqual(amount, escrow.heldAmount);

  const nextStatus: EscrowStatus = isFull ? 'full_refund' : 'partial_refund_remaining';
  let nextEscrow: CommerceEscrow = {
    ...escrow,
    heldAmount: Math.max(0, remaining),
    refundedAmount: addMajor(escrow.refundedAmount, amount),
    status: nextStatus,
    cancelledAt: isFull ? nowIso() : escrow.cancelledAt,
    updatedAt: nowIso(),
  };

  if (isFull && !nextEscrow.escrowCancelledEmitted) {
    emitFinance('EscrowCancelled', nextEscrow.escrowId, actor, {
      escrowId: nextEscrow.escrowId,
      refundId: refund.refundId,
      amount,
      reason: refund.reason,
    });
    nextEscrow = { ...nextEscrow, escrowCancelledEmitted: true };
  }

  await escrowStore.upsertEscrow(nextEscrow);
  await bumpEscrowBalanceAggregate(nextEscrow.sellerId, nextEscrow.currency, -amount);

  let nextRefund: CommerceRefund = {
    ...refund,
    status: 'completed',
    completedAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!nextRefund.paymentRefundedEmitted) {
    emitFinance('PaymentRefunded', nextRefund.paymentId, actor, {
      refundId: nextRefund.refundId,
      paymentId: nextRefund.paymentId,
      escrowId: nextRefund.escrowId,
      orderId: nextRefund.orderId,
      amount: nextRefund.amount,
      currency: nextRefund.currency,
    });
    nextRefund = { ...nextRefund, paymentRefundedEmitted: true };
  }
  if (isFull && !nextRefund.escrowCancelledEmitted) {
    nextRefund = { ...nextRefund, escrowCancelledEmitted: true };
  }

  await escrowStore.upsertRefund(nextRefund);
  return nextRefund;
}

/**
 * Reconcile provider-success / local-crash refunds.
 */
export async function reconcileRefundLocalEffects(
  refundId: string,
  actor: string,
): Promise<CommerceRefund | null> {
  const refund = await escrowStore.getRefund(refundId);
  if (!refund) return null;
  if (refund.status === 'completed') return refund;
  if (!refund.providerRefundDone) return refund;
  const escrow = await escrowStore.getEscrow(refund.escrowId);
  if (!escrow) return refund;
  return finalizeLocalRefundReversal(refund, escrow, actor);
}

export async function placeDisputeHold(params: {
  escrowId: string;
  reason: string;
  actor: { userId: string; role?: string };
}): Promise<CommerceEscrow> {
  const reason = (params.reason || '').trim();
  if (!reason) throw new CommerceError('Dispute hold reason is required');
  const escrow = await escrowStore.getEscrow(params.escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);
  await assertEscrowAccess(escrow, params.actor, 'admin');
  if (escrow.status === 'settled' || escrow.status === 'full_refund') {
    throw new CommerceError(`Cannot dispute-hold Escrow in status ${escrow.status}`, 409);
  }
  if (escrow.status === 'dispute_hold') return escrow;
  const next: CommerceEscrow = {
    ...escrow,
    status: 'dispute_hold',
    disputeHoldReason: reason,
    disputeHoldAt: nowIso(),
    updatedAt: nowIso(),
  };
  await escrowStore.upsertEscrow(next);
  return next;
}

export async function applyAdministrativeAdjustment(params: {
  escrowId: string;
  note: string;
  heldAmount?: number;
  actor: { userId: string; role?: string };
}): Promise<CommerceEscrow> {
  const note = (params.note || '').trim();
  if (!note) throw new CommerceError('Adjustment note is required');
  const role = (params.actor.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
    throw new CommerceError('Administrative adjustment requires Admin', 403);
  }
  const escrow = await escrowStore.getEscrow(params.escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);
  if (escrow.status === 'settled' || escrow.status === 'full_refund') {
    throw new CommerceError('Cannot adjust settled/refunded Escrow', 409);
  }

  const prevHeld = escrow.heldAmount;
  let nextHeld = prevHeld;
  if (params.heldAmount !== undefined) {
    nextHeld = Number(params.heldAmount);
    if (!Number.isFinite(nextHeld) || nextHeld < 0) {
      throw new CommerceError('Invalid heldAmount');
    }
    if (toMinor(nextHeld) > toMinor(escrow.capturedAmount)) {
      throw new CommerceError('heldAmount cannot exceed capturedAmount');
    }
  }

  const delta = subMajor(nextHeld, prevHeld);
  const next: CommerceEscrow = {
    ...escrow,
    heldAmount: nextHeld,
    status: 'administrative_adjustment',
    adminAdjustmentNote: note,
    updatedAt: nowIso(),
  };
  await escrowStore.upsertEscrow(next);
  if (delta !== 0) {
    await bumpEscrowBalanceAggregate(next.sellerId, next.currency, delta);
  }

  const entry: SellerBalanceLedgerEntry = {
    entryId: newId('sbe'),
    sellerId: next.sellerId,
    currency: next.currency,
    amount: 0,
    kind: 'admin_adjustment',
    escrowId: next.escrowId,
    orderId: next.orderId,
    idempotencyKey: `admin_adj:${next.escrowId}:${nowIso()}`,
    createdAt: nowIso(),
  };
  await escrowStore.appendBalanceEntry(entry);

  Logger.audit('escrow.administrative_adjustment', {
    escrowId: next.escrowId,
    actor: params.actor.userId,
    note,
    previousHeld: prevHeld,
    newHeld: nextHeld,
  });

  return next;
}

export async function requestReturn(params: {
  orderId: string;
  reason: string;
  actor: { userId: string; role?: string };
}): Promise<CommerceReturn> {
  const reason = (params.reason || '').trim();
  if (!reason) throw new CommerceError('Return reason is required');
  const order = await commerceStore.getOrder(params.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const role = (params.actor.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
  if (!isAdmin && order.consumerId !== params.actor.userId) {
    throw new CommerceError('Only the Consumer may request a Return', 403);
  }

  if (order.status !== 'delivered' && order.status !== 'completed') {
    throw new CommerceError('Return only eligible after Delivery/Completion', 409);
  }

  const existing = await escrowStore.listReturnsByOrder(order.id);
  const open = existing.find((r) => r.status === 'requested' || r.status === 'approved');
  if (open) return open;

  const row: CommerceReturn = {
    returnId: newId('rtn'),
    orderId: order.id,
    consumerId: order.consumerId,
    sellerId: order.sellerId,
    brandId: order.brandId,
    reason,
    status: 'requested',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    row.returnReferenceId = await ensureEntityReferenceId({
      entityType: 'return',
      internalId: row.returnId,
      current: row.returnReferenceId,
    });
  } catch {
    /* backfill can repair */
  }
  await escrowStore.upsertReturn(row);
  return row;
}

export async function decideReturn(params: {
  returnId: string;
  decision: 'approved' | 'rejected';
  actor: { userId: string; role?: string };
  refundAmount?: number;
}): Promise<{ returnRow: CommerceReturn; refund?: CommerceRefund }> {
  const row = await escrowStore.getReturn(params.returnId);
  if (!row) throw new CommerceError('Return not found', 404);
  const order = await commerceStore.getOrder(row.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const role = (params.actor.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
  const isSeller = order.sellerId === params.actor.userId;
  if (!isAdmin && !isSeller) {
    throw new CommerceError('Not authorized to decide Return', 403);
  }

  if (row.status !== 'requested') {
    return { returnRow: row };
  }

  if (params.decision === 'rejected') {
    const rejected: CommerceReturn = {
      ...row,
      status: 'rejected',
      updatedAt: nowIso(),
    };
    await escrowStore.upsertReturn(rejected);
    return { returnRow: rejected };
  }

  const escrows = await escrowStore.listEscrowsByOrder(row.orderId);
  const escrow = escrows.find((e) => canRefundFromStatus(e.status));
  if (!escrow) {
    throw new CommerceError('No refundable Escrow for this Return', 409);
  }

  const refund = await processEscrowRefund({
    escrowId: escrow.escrowId,
    amount: params.refundAmount,
    reason: `Return approved: ${row.reason}`,
    actor: params.actor,
  });

  const approved: CommerceReturn = {
    ...row,
    status: refund.status === 'completed' ? 'closed' : 'refund_processing',
    refundId: refund.refundId,
    updatedAt: nowIso(),
  };
  await escrowStore.upsertReturn(approved);
  return { returnRow: approved, refund };
}

/**
 * Cancel-after-capture: refund Held Escrow for the Order before/with cancel.
 */
export async function refundEscrowsForCancelledOrder(params: {
  orderId: string;
  reason: string;
  actor: { userId: string; role?: string };
}): Promise<CommerceRefund[]> {
  const escrows = await escrowStore.listEscrowsByOrder(params.orderId);
  const refunds: CommerceRefund[] = [];
  for (const escrow of escrows) {
    if (!canRefundFromStatus(escrow.status)) continue;
    if (escrow.heldAmount <= 0) continue;
    const refund = await processEscrowRefund({
      escrowId: escrow.escrowId,
      reason: params.reason,
      actor: params.actor,
      authorizedCancelPath: true,
    });
    refunds.push(refund);
  }
  return refunds;
}

async function assertEscrowAccess(
  escrow: CommerceEscrow,
  actor: { userId: string; role?: string },
  action: 'read' | 'refund' | 'admin' | 'release',
): Promise<void> {
  const role = (actor.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
  if (isAdmin) return;

  if (action === 'admin' || action === 'release') {
    throw new CommerceError('Not authorized for this Escrow action', 403);
  }

  if (action === 'refund') {
    // Seller of Brand Order or Admin (already handled); Consumer cannot invent refund amounts via direct API
    if (escrow.sellerId === actor.userId || escrow.consumerId === actor.userId) {
      // Consumer refund must go through Return approval path for amount control —
      // direct refund by consumer is denied unless admin/seller
      if (escrow.consumerId === actor.userId && escrow.sellerId !== actor.userId) {
        throw new CommerceError('Consumers cannot directly process Refunds', 403);
      }
      return;
    }
    throw new CommerceError('Not authorized for this Escrow', 403);
  }

  // read
  if (
    escrow.sellerId === actor.userId ||
    escrow.consumerId === actor.userId
  ) {
    return;
  }
  throw new CommerceError('Not authorized for this Escrow', 403);
}

export async function getEscrowForActor(
  escrowId: string,
  actor: { userId: string; role?: string },
): Promise<CommerceEscrow> {
  const escrow = await escrowStore.getEscrow(escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);
  await assertEscrowAccess(escrow, actor, 'read');
  return escrow;
}

export async function getSellerBalanceForActor(
  sellerId: string,
  currency: string,
  actor: { userId: string; role?: string },
): Promise<SellerBalanceAccount> {
  const role = (actor.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
  if (!isAdmin && actor.userId !== sellerId) {
    throw new CommerceError('Not authorized to view this Seller Balance', 403);
  }
  return (
    (await escrowStore.getBalance(sellerId, currency)) || emptyBalance(sellerId, currency)
  );
}

/** Capture persisted without Escrow creation (crash A). */
export async function harnessMarkCapturedWithoutEscrow(params: {
  paymentId: string;
}): Promise<CommercePayment> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness requires PAYMENT_GATEWAY_MOCK', 403);
  }
  const payment = await commercePaymentStore.getPayment(params.paymentId);
  if (!payment) throw new CommerceError('Payment not found', 404);

  const now = nowIso();
  const next: CommercePayment = {
    ...payment,
    status: 'captured',
    capturedAmount: payment.amount,
    outstandingAmount: Math.max(0, payment.outstandingAmount ?? 0),
    capturedAt: payment.capturedAt || now,
    paymentCapturedEmitted: true,
    escrowEffectsApplied: false,
    updatedAt: now,
  };
  await commercePaymentStore.upsertPayment(next);
  return next;
}

/**
 * Settlement + Escrow Released without Seller Balance credit (crash C).
 * Does not credit available balance; reconcileSettlementBalanceCredit repairs.
 */
export async function harnessSettleWithoutBalanceCredit(params: {
  escrowId: string;
  actor: string;
}): Promise<{ escrow: CommerceEscrow; settlement: CommerceSettlement }> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness requires PAYMENT_GATEWAY_MOCK', 403);
  }
  const escrow = await escrowStore.getEscrow(params.escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);
  if (!canSettleFromStatus(escrow.status)) {
    throw new CommerceError(`Escrow not settleable: ${escrow.status}`, 409);
  }

  const existing = await escrowStore.getSettlementByEscrow(escrow.escrowId);
  if (existing) {
    const patched = {
      ...existing,
      sellerBalanceCredited: false,
      updatedAt: nowIso(),
    };
    await escrowStore.upsertSettlement(patched);
    return { escrow, settlement: patched };
  }

  const settleable = escrow.heldAmount;
  const commission = resolveSettlementCommission(settleable);
  const now = nowIso();
  const settlement: CommerceSettlement = {
    settlementId: newId('stl'),
    escrowId: escrow.escrowId,
    paymentId: escrow.paymentId,
    orderId: escrow.orderId,
    checkoutId: escrow.checkoutId,
    sellerId: escrow.sellerId,
    brandId: escrow.brandId,
    currency: escrow.currency,
    grossAmount: settleable,
    commissionAmount: commission.commissionAmount,
    sellerNetAmount: commission.sellerNetAmount,
    sellerBalanceCredited: false,
    createdAt: now,
    updatedAt: now,
  };
  await escrowStore.upsertSettlement(settlement);

  const nextEscrow: CommerceEscrow = {
    ...escrow,
    status: 'settled',
    settledAmount: settleable,
    heldAmount: 0,
    commissionAmount: commission.commissionAmount,
    sellerNetAmount: commission.sellerNetAmount,
    settlementId: settlement.settlementId,
    releasedAt: now,
    escrowReleasedEmitted: true,
    updatedAt: now,
  };
  await escrowStore.upsertEscrow(nextEscrow);
  await bumpEscrowBalanceAggregate(nextEscrow.sellerId, nextEscrow.currency, -settleable);
  emitFinance('EscrowReleased', nextEscrow.escrowId, params.actor, {
    escrowId: nextEscrow.escrowId,
    settlementId: settlement.settlementId,
    source: 'harness_skip_balance',
  });
  return { escrow: nextEscrow, settlement };
}

/** Harness: Settlement created without Seller Balance credit (crash C). */
export async function harnessSimulateSettlementWithoutBalanceCredit(params: {
  settlementId: string;
}): Promise<CommerceSettlement> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness requires PAYMENT_GATEWAY_MOCK', 403);
  }
  const settlement = await escrowStore.getSettlement(params.settlementId);
  if (!settlement) throw new CommerceError('Settlement not found', 404);
  const patched = {
    ...settlement,
    sellerBalanceCredited: false,
    updatedAt: nowIso(),
  };
  await escrowStore.upsertSettlement(patched);
  return patched;
}

/** Harness: provider refund done, local Escrow reverse not applied (crash D). */
export async function harnessSimulateProviderRefundWithoutLocalReverse(params: {
  escrowId: string;
  amount: number;
  reason: string;
  actorUserId: string;
}): Promise<CommerceRefund> {
  if ((process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() !== 'true') {
    throw new CommerceError('Harness requires PAYMENT_GATEWAY_MOCK', 403);
  }
  const escrow = await escrowStore.getEscrow(params.escrowId);
  if (!escrow) throw new CommerceError('Escrow not found', 404);
  const now = nowIso();
  const refund: CommerceRefund = {
    refundId: newId('ref'),
    paymentId: escrow.paymentId,
    escrowId: escrow.escrowId,
    checkoutId: escrow.checkoutId,
    orderId: escrow.orderId,
    amount: params.amount,
    currency: escrow.currency,
    reason: params.reason,
    requestedBy: params.actorUserId,
    status: 'processing',
    providerRefundDone: true,
    providerRefundRefId: `harness_provider_${now}`,
    createdAt: now,
    updatedAt: now,
  };
  await escrowStore.upsertRefund(refund);
  return refund;
}

