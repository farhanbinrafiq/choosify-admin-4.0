/**
 * Payments memory-disk backend (local/dev fallback only).
 */

import {
  flushPaymentsMemoryPersist,
  loadPaymentsMemorySnapshot,
  schedulePaymentsMemoryPersist,
  type PaymentsMemorySnapshot,
} from './commercePaymentPersistence';
import type { CommercePayment } from './commercePaymentTypes';

const state: {
  payments: CommercePayment[];
  processedValIds: Set<string>;
} = {
  payments: [],
  processedValIds: new Set(),
};

let hydrated = false;

function buildSnapshot(): PaymentsMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    payments: state.payments,
    processedValIds: [...state.processedValIds],
  };
}

function schedulePersist(): void {
  schedulePaymentsMemoryPersist(buildSnapshot);
}

export function ensurePaymentsMemoryHydrated(): boolean {
  if (hydrated) return true;
  hydrated = true;
  const snapshot = loadPaymentsMemorySnapshot();
  if (!snapshot) return false;
  state.payments = (snapshot.payments as CommercePayment[]) || [];
  state.processedValIds = new Set(snapshot.processedValIds || []);
  console.log(
    `[PaymentsMemoryPersist] Hydrated (${state.payments.length} payments).`,
  );
  return true;
}

export const paymentsMemoryBackend = {
  getPayment(paymentId: string): CommercePayment | null {
    ensurePaymentsMemoryHydrated();
    return state.payments.find((p) => p.paymentId === paymentId) ?? null;
  },

  getByTranId(tranId: string): CommercePayment | null {
    ensurePaymentsMemoryHydrated();
    return (
      state.payments.find((p) => p.providerTransactionId === tranId) ?? null
    );
  },

  getByIdempotency(consumerId: string, key: string): CommercePayment | null {
    ensurePaymentsMemoryHydrated();
    return (
      state.payments.find(
        (p) => p.consumerId === consumerId && p.idempotencyKey === key,
      ) ?? null
    );
  },

  listByCheckout(checkoutId: string): CommercePayment[] {
    ensurePaymentsMemoryHydrated();
    return state.payments.filter((p) => p.checkoutId === checkoutId);
  },

  listPayments(): CommercePayment[] {
    ensurePaymentsMemoryHydrated();
    return [...state.payments];
  },

  upsertPayment(payment: CommercePayment): CommercePayment {
    ensurePaymentsMemoryHydrated();
    const idx = state.payments.findIndex((p) => p.paymentId === payment.paymentId);
    if (idx >= 0) state.payments[idx] = payment;
    else state.payments.push(payment);
    schedulePersist();
    return payment;
  },

  hasProcessedValId(valId: string): boolean {
    ensurePaymentsMemoryHydrated();
    if (state.processedValIds.has(valId)) return true;
    return state.payments.some(
      (p) =>
        (p.providerValId === valId || p.processedValIds?.includes(valId)) &&
        p.status === 'captured',
    );
  },

  markValIdProcessed(valId: string): void {
    ensurePaymentsMemoryHydrated();
    if (!valId) return;
    state.processedValIds.add(valId);
    schedulePersist();
  },

  flush(): void {
    ensurePaymentsMemoryHydrated();
    schedulePaymentsMemoryPersist(buildSnapshot);
    flushPaymentsMemoryPersist();
  },

  /** Test helper — clear in-memory state (does not delete disk until flush). */
  __resetForTests(): void {
    state.payments = [];
    state.processedValIds.clear();
    hydrated = true;
    schedulePersist();
  },
};
