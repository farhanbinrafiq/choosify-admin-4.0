/**
 * Escrow memory-disk backend (local/dev).
 */

import {
  flushEscrowMemoryPersist,
  loadEscrowMemorySnapshot,
  scheduleEscrowMemoryPersist,
  type EscrowMemorySnapshot,
} from './escrowPersistence';
import type {
  CommerceEscrow,
  CommerceRefund,
  CommerceReturn,
  CommerceSettlement,
  SellerBalanceAccount,
  SellerBalanceLedgerEntry,
} from './types';

const state: {
  escrows: CommerceEscrow[];
  settlements: CommerceSettlement[];
  balances: SellerBalanceAccount[];
  balanceEntries: SellerBalanceLedgerEntry[];
  refunds: CommerceRefund[];
  returns: CommerceReturn[];
} = {
  escrows: [],
  settlements: [],
  balances: [],
  balanceEntries: [],
  refunds: [],
  returns: [],
};

let hydrated = false;

function buildSnapshot(): EscrowMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    escrows: state.escrows,
    settlements: state.settlements,
    balances: state.balances,
    balanceEntries: state.balanceEntries,
    refunds: state.refunds,
    returns: state.returns,
  };
}

function schedulePersist(): void {
  scheduleEscrowMemoryPersist(buildSnapshot);
}

function upsertById<T>(arr: T[], row: T, idOf: (r: T) => string): T {
  const id = idOf(row);
  const idx = arr.findIndex((r) => idOf(r) === id);
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);
  schedulePersist();
  return row;
}

export function ensureEscrowMemoryHydrated(): boolean {
  if (hydrated) return true;
  hydrated = true;
  const snapshot = loadEscrowMemorySnapshot();
  if (!snapshot) return false;
  state.escrows = (snapshot.escrows as CommerceEscrow[]) || [];
  state.settlements = (snapshot.settlements as CommerceSettlement[]) || [];
  state.balances = (snapshot.balances as SellerBalanceAccount[]) || [];
  state.balanceEntries = (snapshot.balanceEntries as SellerBalanceLedgerEntry[]) || [];
  state.refunds = (snapshot.refunds as CommerceRefund[]) || [];
  state.returns = (snapshot.returns as CommerceReturn[]) || [];
  console.log(
    `[EscrowMemoryPersist] Hydrated (${state.escrows.length} escrows, ${state.settlements.length} settlements).`,
  );
  return true;
}

export const escrowMemoryBackend = {
  getEscrow(escrowId: string): CommerceEscrow | null {
    ensureEscrowMemoryHydrated();
    return state.escrows.find((e) => e.escrowId === escrowId) ?? null;
  },
  getEscrowByPaymentOrder(paymentId: string, orderId: string): CommerceEscrow | null {
    ensureEscrowMemoryHydrated();
    return (
      state.escrows.find((e) => e.paymentId === paymentId && e.orderId === orderId) ?? null
    );
  },
  listEscrowsByPayment(paymentId: string): CommerceEscrow[] {
    ensureEscrowMemoryHydrated();
    return state.escrows.filter((e) => e.paymentId === paymentId);
  },
  listEscrowsByOrder(orderId: string): CommerceEscrow[] {
    ensureEscrowMemoryHydrated();
    return state.escrows.filter((e) => e.orderId === orderId);
  },
  listEscrowsBySeller(sellerId: string): CommerceEscrow[] {
    ensureEscrowMemoryHydrated();
    return state.escrows.filter((e) => e.sellerId === sellerId);
  },
  upsertEscrow(row: CommerceEscrow): CommerceEscrow {
    ensureEscrowMemoryHydrated();
    return upsertById(state.escrows, row, (r) => r.escrowId);
  },
  getSettlement(settlementId: string): CommerceSettlement | null {
    ensureEscrowMemoryHydrated();
    return state.settlements.find((s) => s.settlementId === settlementId) ?? null;
  },
  getSettlementByEscrow(escrowId: string): CommerceSettlement | null {
    ensureEscrowMemoryHydrated();
    return state.settlements.find((s) => s.escrowId === escrowId) ?? null;
  },
  upsertSettlement(row: CommerceSettlement): CommerceSettlement {
    ensureEscrowMemoryHydrated();
    return upsertById(state.settlements, row, (r) => r.settlementId);
  },
  getBalance(sellerId: string, currency: string): SellerBalanceAccount | null {
    ensureEscrowMemoryHydrated();
    return (
      state.balances.find((b) => b.sellerId === sellerId && b.currency === currency) ?? null
    );
  },
  upsertBalance(row: SellerBalanceAccount): SellerBalanceAccount {
    ensureEscrowMemoryHydrated();
    const idx = state.balances.findIndex(
      (b) => b.sellerId === row.sellerId && b.currency === row.currency,
    );
    if (idx >= 0) state.balances[idx] = row;
    else state.balances.push(row);
    schedulePersist();
    return row;
  },
  getBalanceEntryByIdempotency(key: string): SellerBalanceLedgerEntry | null {
    ensureEscrowMemoryHydrated();
    return state.balanceEntries.find((e) => e.idempotencyKey === key) ?? null;
  },
  appendBalanceEntry(row: SellerBalanceLedgerEntry): SellerBalanceLedgerEntry {
    ensureEscrowMemoryHydrated();
    const existing = state.balanceEntries.find((e) => e.idempotencyKey === row.idempotencyKey);
    if (existing) return existing;
    state.balanceEntries.push(row);
    schedulePersist();
    return row;
  },
  getRefund(refundId: string): CommerceRefund | null {
    ensureEscrowMemoryHydrated();
    return state.refunds.find((r) => r.refundId === refundId) ?? null;
  },
  listRefundsByEscrow(escrowId: string): CommerceRefund[] {
    ensureEscrowMemoryHydrated();
    return state.refunds.filter((r) => r.escrowId === escrowId);
  },
  upsertRefund(row: CommerceRefund): CommerceRefund {
    ensureEscrowMemoryHydrated();
    return upsertById(state.refunds, row, (r) => r.refundId);
  },
  getReturn(returnId: string): CommerceReturn | null {
    ensureEscrowMemoryHydrated();
    return state.returns.find((r) => r.returnId === returnId) ?? null;
  },
  listReturnsByOrder(orderId: string): CommerceReturn[] {
    ensureEscrowMemoryHydrated();
    return state.returns.filter((r) => r.orderId === orderId);
  },
  upsertReturn(row: CommerceReturn): CommerceReturn {
    ensureEscrowMemoryHydrated();
    return upsertById(state.returns, row, (r) => r.returnId);
  },
  flush(): void {
    ensureEscrowMemoryHydrated();
    scheduleEscrowMemoryPersist(buildSnapshot);
    flushEscrowMemoryPersist();
  },
};
