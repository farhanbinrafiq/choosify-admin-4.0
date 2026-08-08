/**
 * Commerce persistence facade — mirrors catalogStore selection.
 *
 * firestore-admin: when platform Firestore is configured
 *   (COMMERCE_USE_FIRESTORE=true OR CATALOG_USE_FIRESTORE=true) AND credentials present.
 * memory-disk: local/dev durable JSON under .data/commerce-memory-snapshot.json
 *
 * Fail-closed: if Firestore mode is requested but credentials are missing, OR if a
 * Firestore operation fails, errors propagate — never silently fall back to memory-disk.
 */

import { hasFirebaseAdminCredentials } from '../firestoreAdmin';
import { commerceMemoryBackend, ensureCommerceMemoryHydrated } from './commerceMemoryBackend';
import type { CommerceCheckoutBundle, CommerceOrderMutationBundle } from './commerceFirestoreAdmin';
import type { CommerceIdempotencyRecord } from './commerceCollections';
import type {
  CommerceBookingRequest,
  CommerceCart,
  CommerceCheckout,
  CommerceOrder,
  CommerceShipment,
} from './types';

/**
 * Explicit Firestore request for Commerce.
 * Defaults to following CATALOG_USE_FIRESTORE when COMMERCE_USE_FIRESTORE is unset.
 * Set COMMERCE_USE_FIRESTORE=false to force memory-disk even if catalog uses Firestore.
 */
function isCommerceFirestoreRequested(): boolean {
  const raw = process.env.COMMERCE_USE_FIRESTORE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.CATALOG_USE_FIRESTORE === 'true';
}

const firestoreRequested = isCommerceFirestoreRequested();
const credentialsOk = hasFirebaseAdminCredentials();
const useAdminFirestore = firestoreRequested && credentialsOk;

if (firestoreRequested && !credentialsOk) {
  console.error(
    '[Commerce] Firestore mode requested (COMMERCE_USE_FIRESTORE/CATALOG_USE_FIRESTORE) but FIREBASE_SERVICE_ACCOUNT_JSON is missing. Fail-closed: commerce writes will error until credentials are configured.',
  );
}

let adminPromise: Promise<typeof import('./commerceFirestoreAdmin').commerceFirestoreAdmin> | null =
  null;

async function getAdmin() {
  if (!useAdminFirestore) {
    throw new Error(
      'Commerce Firestore mode is requested but not available. Set FIREBASE_SERVICE_ACCOUNT_JSON or disable COMMERCE_USE_FIRESTORE.',
    );
  }
  if (!adminPromise) {
    adminPromise = import('./commerceFirestoreAdmin').then((m) => m.commerceFirestoreAdmin);
  }
  return adminPromise;
}

/**
 * firestore-admin: production persistent commerce.
 * memory-disk: local/dev adapter with JSON snapshot under `.data/` (survives restart).
 * firestore-misconfigured: Firestore requested without credentials — fail closed.
 */
export function getCommercePersistenceMode():
  | 'firestore-admin'
  | 'memory-disk'
  | 'firestore-misconfigured' {
  if (firestoreRequested && !credentialsOk) return 'firestore-misconfigured';
  return useAdminFirestore ? 'firestore-admin' : 'memory-disk';
}

export function assertCommercePersistenceReady(): void {
  if (getCommercePersistenceMode() === 'firestore-misconfigured') {
    throw new Error(
      'Commerce persistence misconfigured: Firestore requested but FIREBASE_SERVICE_ACCOUNT_JSON is not set.',
    );
  }
}

if (!useAdminFirestore && getCommercePersistenceMode() === 'memory-disk') {
  ensureCommerceMemoryHydrated();
}

console.log(`[Commerce] Persistence mode: ${getCommercePersistenceMode()}`);

export const commerceStore = {
  async getCartByConsumer(consumerId: string): Promise<CommerceCart | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getCartByConsumer(consumerId);
    return commerceMemoryBackend.getCartByConsumer(consumerId);
  },

  async getCart(id: string): Promise<CommerceCart | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getCart(id);
    return commerceMemoryBackend.getCart(id);
  },

  async upsertCart(cart: CommerceCart): Promise<CommerceCart> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertCart(cart);
    return commerceMemoryBackend.upsertCart(cart);
  },

  async deleteCart(id: string): Promise<void> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).deleteCart(id);
    commerceMemoryBackend.deleteCart(id);
  },

  async getCheckout(id: string): Promise<CommerceCheckout | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getCheckout(id);
    return commerceMemoryBackend.getCheckout(id);
  },

  async upsertCheckout(checkout: CommerceCheckout): Promise<CommerceCheckout> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertCheckout(checkout);
    return commerceMemoryBackend.upsertCheckout(checkout);
  },

  async getOrder(id: string): Promise<CommerceOrder | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getOrder(id);
    return commerceMemoryBackend.getOrder(id);
  },

  async listOrders(): Promise<CommerceOrder[]> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).listOrders();
    return commerceMemoryBackend.listOrders();
  },

  async upsertOrder(order: CommerceOrder): Promise<CommerceOrder> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertOrder(order);
    return commerceMemoryBackend.upsertOrder(order);
  },

  async getBookingRequest(id: string): Promise<CommerceBookingRequest | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getBookingRequest(id);
    return commerceMemoryBackend.getBookingRequest(id);
  },

  async listBookingRequests(): Promise<CommerceBookingRequest[]> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).listBookingRequests();
    return commerceMemoryBackend.listBookingRequests();
  },

  async upsertBookingRequest(row: CommerceBookingRequest): Promise<CommerceBookingRequest> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertBookingRequest(row);
    return commerceMemoryBackend.upsertBookingRequest(row);
  },

  async getShipment(id: string): Promise<CommerceShipment | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getShipment(id);
    return commerceMemoryBackend.getShipment(id);
  },

  async getShipmentByOrderId(orderId: string): Promise<CommerceShipment | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getShipmentByOrderId(orderId);
    return commerceMemoryBackend.getShipmentByOrderId(orderId);
  },

  async listShipments(): Promise<CommerceShipment[]> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).listShipments();
    return commerceMemoryBackend.listShipments();
  },

  async upsertShipment(row: CommerceShipment): Promise<CommerceShipment> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).upsertShipment(row);
    return commerceMemoryBackend.upsertShipment(row);
  },

  async getIdempotency(
    key: string,
    consumerId: string,
  ): Promise<CommerceIdempotencyRecord | null> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).getIdempotency(key, consumerId);
    return commerceMemoryBackend.getIdempotency(key, consumerId);
  },

  async putIdempotency(
    row: Omit<CommerceIdempotencyRecord, 'id'>,
  ): Promise<CommerceIdempotencyRecord> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) return (await getAdmin()).putIdempotency(row);
    return commerceMemoryBackend.putIdempotency(row);
  },

  async commitCheckoutBundle(bundle: CommerceCheckoutBundle): Promise<void> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) {
      await (await getAdmin()).commitCheckoutBundle(bundle);
      return;
    }
    commerceMemoryBackend.commitCheckoutBundle(bundle);
  },

  async commitOrderMutation(bundle: CommerceOrderMutationBundle): Promise<void> {
    assertCommercePersistenceReady();
    if (useAdminFirestore) {
      await (await getAdmin()).commitOrderMutation(bundle);
      return;
    }
    commerceMemoryBackend.commitOrderMutation(bundle);
  },

  async flushPersist(): Promise<void> {
    if (useAdminFirestore) return;
    commerceMemoryBackend.flushPersist();
  },
};
