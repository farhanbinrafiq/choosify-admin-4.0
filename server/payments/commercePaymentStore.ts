/**
 * Commerce Payments persistence facade — mirrors commerceStore selection.
 *
 * firestore-admin: when platform Firestore is configured
 * memory-disk: local/dev durable JSON under .data/payments-memory-snapshot.json
 */

import { hasFirebaseAdminCredentials } from '../firestoreAdmin';
import {
  ensurePaymentsMemoryHydrated,
  paymentsMemoryBackend,
} from './commercePaymentMemoryBackend';
import type { CommercePayment } from './commercePaymentTypes';

function isPaymentsFirestoreRequested(): boolean {
  const raw = process.env.PAYMENTS_USE_FIRESTORE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const commerce = process.env.COMMERCE_USE_FIRESTORE?.trim().toLowerCase();
  if (commerce === 'true') return true;
  if (commerce === 'false') return false;
  return process.env.CATALOG_USE_FIRESTORE === 'true';
}

const firestoreRequested = isPaymentsFirestoreRequested();
const credentialsOk = hasFirebaseAdminCredentials();
const useAdminFirestore = firestoreRequested && credentialsOk;

if (firestoreRequested && !credentialsOk) {
  console.error(
    '[Payments] Firestore mode requested but FIREBASE_SERVICE_ACCOUNT_JSON is missing. Fail-closed.',
  );
}

let adminPromise: Promise<typeof import('./commercePaymentFirestoreAdmin').commercePaymentFirestoreAdmin> | null =
  null;

async function getAdmin() {
  if (!useAdminFirestore) {
    throw new Error(
      'Payments Firestore mode is requested but not available. Set FIREBASE_SERVICE_ACCOUNT_JSON or disable PAYMENTS_USE_FIRESTORE.',
    );
  }
  if (!adminPromise) {
    adminPromise = import('./commercePaymentFirestoreAdmin').then(
      (m) => m.commercePaymentFirestoreAdmin,
    );
  }
  return adminPromise;
}

export function getPaymentsPersistenceMode():
  | 'firestore-admin'
  | 'memory-disk'
  | 'firestore-misconfigured' {
  if (firestoreRequested && !credentialsOk) return 'firestore-misconfigured';
  return useAdminFirestore ? 'firestore-admin' : 'memory-disk';
}

export function assertPaymentsPersistenceReady(): void {
  if (getPaymentsPersistenceMode() === 'firestore-misconfigured') {
    throw new Error(
      'Payments persistence misconfigured: Firestore requested but FIREBASE_SERVICE_ACCOUNT_JSON is not set.',
    );
  }
}

if (!useAdminFirestore && getPaymentsPersistenceMode() === 'memory-disk') {
  ensurePaymentsMemoryHydrated();
}

console.log(`[Payments] Persistence mode: ${getPaymentsPersistenceMode()}`);

export const commercePaymentStore = {
  async getPayment(paymentId: string): Promise<CommercePayment | null> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getPayment(paymentId);
    return paymentsMemoryBackend.getPayment(paymentId);
  },

  async getByTranId(tranId: string): Promise<CommercePayment | null> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getByTranId(tranId);
    return paymentsMemoryBackend.getByTranId(tranId);
  },

  async getByIdempotency(
    consumerId: string,
    key: string,
  ): Promise<CommercePayment | null> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getByIdempotency(consumerId, key);
    return paymentsMemoryBackend.getByIdempotency(consumerId, key);
  },

  async listByCheckout(checkoutId: string): Promise<CommercePayment[]> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).listByCheckout(checkoutId);
    return paymentsMemoryBackend.listByCheckout(checkoutId);
  },

  async upsertPayment(payment: CommercePayment): Promise<CommercePayment> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertPayment(payment);
    return paymentsMemoryBackend.upsertPayment(payment);
  },

  async hasProcessedValId(valId: string): Promise<boolean> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).hasProcessedValId(valId);
    return paymentsMemoryBackend.hasProcessedValId(valId);
  },

  async markValIdProcessed(valId: string): Promise<void> {
    assertPaymentsPersistenceReady();
    if (useAdminFirestore) {
      await (await getAdmin()).markValIdProcessed(valId);
      return;
    }
    paymentsMemoryBackend.markValIdProcessed(valId);
  },

  flushMemory(): void {
    if (!useAdminFirestore) paymentsMemoryBackend.flush();
  },
};
