/**
 * Escrow persistence facade — mirrors payments/commerce store selection.
 */

import { hasFirebaseAdminCredentials } from '../firestoreAdmin';
import { ensureEscrowMemoryHydrated, escrowMemoryBackend } from './escrowMemoryBackend';
import type {
  CommerceEscrow,
  CommerceRefund,
  CommerceReturn,
  CommerceSettlement,
  SellerBalanceAccount,
  SellerBalanceLedgerEntry,
} from './types';

function isEscrowFirestoreRequested(): boolean {
  const raw = process.env.ESCROW_USE_FIRESTORE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const commerce = process.env.COMMERCE_USE_FIRESTORE?.trim().toLowerCase();
  if (commerce === 'true') return true;
  if (commerce === 'false') return false;
  return process.env.CATALOG_USE_FIRESTORE === 'true';
}

const firestoreRequested = isEscrowFirestoreRequested();
const credentialsOk = hasFirebaseAdminCredentials();
const useAdminFirestore = firestoreRequested && credentialsOk;

if (firestoreRequested && !credentialsOk) {
  console.error(
    '[Escrow] Firestore mode requested but FIREBASE_SERVICE_ACCOUNT_JSON is missing. Fail-closed.',
  );
}

export function getEscrowPersistenceMode():
  | 'firestore-admin'
  | 'memory-disk'
  | 'firestore-misconfigured' {
  if (firestoreRequested && !credentialsOk) return 'firestore-misconfigured';
  return useAdminFirestore ? 'firestore-admin' : 'memory-disk';
}

export function assertEscrowPersistenceReady(): void {
  if (getEscrowPersistenceMode() === 'firestore-misconfigured') {
    throw new Error(
      'Escrow persistence misconfigured: Firestore requested but FIREBASE_SERVICE_ACCOUNT_JSON is not set.',
    );
  }
}

if (!useAdminFirestore && getEscrowPersistenceMode() === 'memory-disk') {
  ensureEscrowMemoryHydrated();
}

console.log(`[Escrow] Persistence mode: ${getEscrowPersistenceMode()}`);

/** Firestore adapter deferred to same memory-disk path when not configured — fail-closed if requested. */
async function requireMemory(): Promise<typeof escrowMemoryBackend> {
  assertEscrowPersistenceReady();
  if (useAdminFirestore) {
    // Sprint 8: Firestore collections can be added; for now fail-closed means credentials present
    // but we still use memory backend only when firestore not selected. When selected, use dynamic import.
    const mod = await import('./escrowFirestoreAdmin');
    return mod.escrowFirestoreAdmin as unknown as typeof escrowMemoryBackend;
  }
  return escrowMemoryBackend;
}

export const escrowStore = {
  async getEscrow(escrowId: string): Promise<CommerceEscrow | null> {
    return (await requireMemory()).getEscrow(escrowId);
  },
  async getEscrowByPaymentOrder(
    paymentId: string,
    orderId: string,
  ): Promise<CommerceEscrow | null> {
    return (await requireMemory()).getEscrowByPaymentOrder(paymentId, orderId);
  },
  async listEscrowsByPayment(paymentId: string): Promise<CommerceEscrow[]> {
    return (await requireMemory()).listEscrowsByPayment(paymentId);
  },
  async listEscrowsByOrder(orderId: string): Promise<CommerceEscrow[]> {
    return (await requireMemory()).listEscrowsByOrder(orderId);
  },
  async listEscrowsBySeller(sellerId: string): Promise<CommerceEscrow[]> {
    return (await requireMemory()).listEscrowsBySeller(sellerId);
  },
  async upsertEscrow(row: CommerceEscrow): Promise<CommerceEscrow> {
    return (await requireMemory()).upsertEscrow(row);
  },
  async getSettlement(settlementId: string): Promise<CommerceSettlement | null> {
    return (await requireMemory()).getSettlement(settlementId);
  },
  async getSettlementByEscrow(escrowId: string): Promise<CommerceSettlement | null> {
    return (await requireMemory()).getSettlementByEscrow(escrowId);
  },
  async upsertSettlement(row: CommerceSettlement): Promise<CommerceSettlement> {
    return (await requireMemory()).upsertSettlement(row);
  },
  async getBalance(sellerId: string, currency: string): Promise<SellerBalanceAccount | null> {
    return (await requireMemory()).getBalance(sellerId, currency);
  },
  async upsertBalance(row: SellerBalanceAccount): Promise<SellerBalanceAccount> {
    return (await requireMemory()).upsertBalance(row);
  },
  async getBalanceEntryByIdempotency(
    key: string,
  ): Promise<SellerBalanceLedgerEntry | null> {
    return (await requireMemory()).getBalanceEntryByIdempotency(key);
  },
  async appendBalanceEntry(
    row: SellerBalanceLedgerEntry,
  ): Promise<SellerBalanceLedgerEntry> {
    return (await requireMemory()).appendBalanceEntry(row);
  },
  async getRefund(refundId: string): Promise<CommerceRefund | null> {
    return (await requireMemory()).getRefund(refundId);
  },
  async listRefundsByEscrow(escrowId: string): Promise<CommerceRefund[]> {
    return (await requireMemory()).listRefundsByEscrow(escrowId);
  },
  async upsertRefund(row: CommerceRefund): Promise<CommerceRefund> {
    return (await requireMemory()).upsertRefund(row);
  },
  async getReturn(returnId: string): Promise<CommerceReturn | null> {
    return (await requireMemory()).getReturn(returnId);
  },
  async listReturnsByOrder(orderId: string): Promise<CommerceReturn[]> {
    return (await requireMemory()).listReturnsByOrder(orderId);
  },
  async upsertReturn(row: CommerceReturn): Promise<CommerceReturn> {
    return (await requireMemory()).upsertReturn(row);
  },
  flushMemory(): void {
    if (!useAdminFirestore) escrowMemoryBackend.flush();
  },
};
