/**
 * Escrow Firestore Admin adapter — same shape as memory backend.
 */

import {
  getDocumentById,
  requireAdminFirestore,
  upsertDocumentById,
} from '../lib/firestore/queryHelpers';
import type {
  CommerceEscrow,
  CommerceRefund,
  CommerceReturn,
  CommerceSettlement,
  SellerBalanceAccount,
  SellerBalanceLedgerEntry,
} from './types';

const ESCROWS = 'commerce_escrows';
const SETTLEMENTS = 'commerce_settlements';
const BALANCES = 'commerce_seller_balances';
const BALANCE_ENTRIES = 'commerce_seller_balance_entries';
const REFUNDS = 'commerce_refunds';
const RETURNS = 'commerce_returns';

function balanceDocId(sellerId: string, currency: string): string {
  return `${sellerId}__${currency}`;
}

export const escrowFirestoreAdmin = {
  async getEscrow(escrowId: string): Promise<CommerceEscrow | null> {
    return getDocumentById<CommerceEscrow>(ESCROWS, escrowId);
  },
  async getEscrowByPaymentOrder(
    paymentId: string,
    orderId: string,
  ): Promise<CommerceEscrow | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(ESCROWS)
      .where('paymentId', '==', paymentId)
      .where('orderId', '==', orderId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommerceEscrow;
  },
  async listEscrowsByPayment(paymentId: string): Promise<CommerceEscrow[]> {
    const db = await requireAdminFirestore();
    const snap = await db.collection(ESCROWS).where('paymentId', '==', paymentId).get();
    return snap.docs.map((d) => d.data() as CommerceEscrow);
  },
  async listEscrowsByOrder(orderId: string): Promise<CommerceEscrow[]> {
    const db = await requireAdminFirestore();
    const snap = await db.collection(ESCROWS).where('orderId', '==', orderId).get();
    return snap.docs.map((d) => d.data() as CommerceEscrow);
  },
  async listEscrowsBySeller(sellerId: string): Promise<CommerceEscrow[]> {
    const db = await requireAdminFirestore();
    const snap = await db.collection(ESCROWS).where('sellerId', '==', sellerId).get();
    return snap.docs.map((d) => d.data() as CommerceEscrow);
  },
  async upsertEscrow(row: CommerceEscrow): Promise<CommerceEscrow> {
    await upsertDocumentById(ESCROWS, row.escrowId, row);
    return row;
  },
  async getSettlement(settlementId: string): Promise<CommerceSettlement | null> {
    return getDocumentById<CommerceSettlement>(SETTLEMENTS, settlementId);
  },
  async getSettlementByEscrow(escrowId: string): Promise<CommerceSettlement | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(SETTLEMENTS)
      .where('escrowId', '==', escrowId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommerceSettlement;
  },
  async upsertSettlement(row: CommerceSettlement): Promise<CommerceSettlement> {
    await upsertDocumentById(SETTLEMENTS, row.settlementId, row);
    return row;
  },
  async getBalance(sellerId: string, currency: string): Promise<SellerBalanceAccount | null> {
    return getDocumentById<SellerBalanceAccount>(BALANCES, balanceDocId(sellerId, currency));
  },
  async upsertBalance(row: SellerBalanceAccount): Promise<SellerBalanceAccount> {
    await upsertDocumentById(BALANCES, balanceDocId(row.sellerId, row.currency), row);
    return row;
  },
  async getBalanceEntryByIdempotency(
    key: string,
  ): Promise<SellerBalanceLedgerEntry | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(BALANCE_ENTRIES)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as SellerBalanceLedgerEntry;
  },
  async appendBalanceEntry(row: SellerBalanceLedgerEntry): Promise<SellerBalanceLedgerEntry> {
    const existing = await this.getBalanceEntryByIdempotency(row.idempotencyKey);
    if (existing) return existing;
    await upsertDocumentById(BALANCE_ENTRIES, row.entryId, row);
    return row;
  },
  async getRefund(refundId: string): Promise<CommerceRefund | null> {
    return getDocumentById<CommerceRefund>(REFUNDS, refundId);
  },
  async listRefundsByEscrow(escrowId: string): Promise<CommerceRefund[]> {
    const db = await requireAdminFirestore();
    const snap = await db.collection(REFUNDS).where('escrowId', '==', escrowId).get();
    return snap.docs.map((d) => d.data() as CommerceRefund);
  },
  async upsertRefund(row: CommerceRefund): Promise<CommerceRefund> {
    await upsertDocumentById(REFUNDS, row.refundId, row);
    return row;
  },
  async getReturn(returnId: string): Promise<CommerceReturn | null> {
    return getDocumentById<CommerceReturn>(RETURNS, returnId);
  },
  async listReturnsByOrder(orderId: string): Promise<CommerceReturn[]> {
    const db = await requireAdminFirestore();
    const snap = await db.collection(RETURNS).where('orderId', '==', orderId).get();
    return snap.docs.map((d) => d.data() as CommerceReturn);
  },
  async upsertReturn(row: CommerceReturn): Promise<CommerceReturn> {
    await upsertDocumentById(RETURNS, row.returnId, row);
    return row;
  },
};
