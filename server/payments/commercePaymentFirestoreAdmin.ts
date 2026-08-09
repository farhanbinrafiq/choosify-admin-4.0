/**
 * Commerce Payments Firestore Admin adapter.
 */

import {
  getDocumentById,
  requireAdminFirestore,
  upsertDocumentById,
} from '../lib/firestore/queryHelpers';
import type { CommercePayment } from './commercePaymentTypes';

export const COMMERCE_PAYMENTS = 'commerce_payments';
export const COMMERCE_PAYMENT_VAL_IDS = 'commerce_payment_val_ids';

export const commercePaymentFirestoreAdmin = {
  async getPayment(paymentId: string): Promise<CommercePayment | null> {
    return getDocumentById<CommercePayment>(COMMERCE_PAYMENTS, paymentId);
  },

  async getByTranId(tranId: string): Promise<CommercePayment | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(COMMERCE_PAYMENTS)
      .where('providerTransactionId', '==', tranId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommercePayment;
  },

  async getByIdempotency(
    consumerId: string,
    key: string,
  ): Promise<CommercePayment | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(COMMERCE_PAYMENTS)
      .where('consumerId', '==', consumerId)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommercePayment;
  },

  async listByCheckout(checkoutId: string): Promise<CommercePayment[]> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(COMMERCE_PAYMENTS)
      .where('checkoutId', '==', checkoutId)
      .get();
    return snap.docs.map((d) => d.data() as CommercePayment);
  },

  async upsertPayment(payment: CommercePayment): Promise<CommercePayment> {
    await upsertDocumentById(COMMERCE_PAYMENTS, payment.paymentId, payment);
    return payment;
  },

  async hasProcessedValId(valId: string): Promise<boolean> {
    if (!valId) return false;
    const existing = await getDocumentById<{ processedAt: string }>(
      COMMERCE_PAYMENT_VAL_IDS,
      valId,
    );
    return Boolean(existing);
  },

  async markValIdProcessed(valId: string): Promise<void> {
    if (!valId) return;
    await upsertDocumentById(COMMERCE_PAYMENT_VAL_IDS, valId, {
      processedAt: new Date().toISOString(),
    });
  },
};
