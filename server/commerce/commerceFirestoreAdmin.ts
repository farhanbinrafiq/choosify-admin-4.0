/**
 * Commerce Firestore Admin adapter.
 * Fail-closed: all ops go through requireAdminFirestore (no silent memory fallback).
 */

import type { DocumentData } from 'firebase-admin/firestore';
import {
  deleteDocument,
  getDocumentById,
  listCollection,
  requireAdminFirestore,
  upsertDocument,
} from '../lib/firestore/queryHelpers';
import {
  COMMERCE_BOOKING_REQUESTS,
  COMMERCE_CARTS,
  COMMERCE_CHECKOUTS,
  COMMERCE_IDEMPOTENCY,
  COMMERCE_ORDERS,
  idempotencyDocId,
  type CommerceIdempotencyRecord,
} from './commerceCollections';
import type {
  CommerceBookingRequest,
  CommerceCart,
  CommerceCheckout,
  CommerceOrder,
} from './types';

export type CommerceCheckoutBundle = {
  checkout: CommerceCheckout;
  orders: CommerceOrder[];
  bookingRequests: CommerceBookingRequest[];
  idempotency?: Omit<CommerceIdempotencyRecord, 'id'>;
  clearedCart?: CommerceCart;
};

export const commerceFirestoreAdmin = {
  async getCart(id: string): Promise<CommerceCart | null> {
    return getDocumentById<CommerceCart>(COMMERCE_CARTS, id);
  },

  async getCartByConsumer(consumerId: string): Promise<CommerceCart | null> {
    const db = await requireAdminFirestore();
    const snap = await db
      .collection(COMMERCE_CARTS)
      .where('consumerId', '==', consumerId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CommerceCart;
  },

  async upsertCart(cart: CommerceCart): Promise<CommerceCart> {
    return upsertDocument(COMMERCE_CARTS, cart);
  },

  async deleteCart(id: string): Promise<void> {
    return deleteDocument(COMMERCE_CARTS, id);
  },

  async getCheckout(id: string): Promise<CommerceCheckout | null> {
    return getDocumentById<CommerceCheckout>(COMMERCE_CHECKOUTS, id);
  },

  async upsertCheckout(checkout: CommerceCheckout): Promise<CommerceCheckout> {
    return upsertDocument(COMMERCE_CHECKOUTS, checkout);
  },

  async getOrder(id: string): Promise<CommerceOrder | null> {
    return getDocumentById<CommerceOrder>(COMMERCE_ORDERS, id);
  },

  async listOrders(): Promise<CommerceOrder[]> {
    return listCollection<CommerceOrder>(COMMERCE_ORDERS);
  },

  async upsertOrder(order: CommerceOrder): Promise<CommerceOrder> {
    return upsertDocument(COMMERCE_ORDERS, order);
  },

  async getBookingRequest(id: string): Promise<CommerceBookingRequest | null> {
    return getDocumentById<CommerceBookingRequest>(COMMERCE_BOOKING_REQUESTS, id);
  },

  async listBookingRequests(): Promise<CommerceBookingRequest[]> {
    return listCollection<CommerceBookingRequest>(COMMERCE_BOOKING_REQUESTS);
  },

  async upsertBookingRequest(row: CommerceBookingRequest): Promise<CommerceBookingRequest> {
    return upsertDocument(COMMERCE_BOOKING_REQUESTS, row);
  },

  async getIdempotency(
    key: string,
    consumerId: string,
  ): Promise<CommerceIdempotencyRecord | null> {
    const id = idempotencyDocId(consumerId, key);
    return getDocumentById<CommerceIdempotencyRecord>(COMMERCE_IDEMPOTENCY, id);
  },

  async putIdempotency(
    row: Omit<CommerceIdempotencyRecord, 'id'>,
  ): Promise<CommerceIdempotencyRecord> {
    const id = idempotencyDocId(row.consumerId, row.key);
    const payload: CommerceIdempotencyRecord = { ...row, id };
    return upsertDocument(COMMERCE_IDEMPOTENCY, payload);
  },

  /**
   * Atomic checkout commit: checkout + split orders + booking requests +
   * idempotency + cleared cart in one Firestore batch (≤500 ops).
   */
  async commitCheckoutBundle(bundle: CommerceCheckoutBundle): Promise<void> {
    const db = await requireAdminFirestore();
    const batch = db.batch();
    let ops = 0;
    const set = (collection: string, id: string, data: DocumentData) => {
      batch.set(db.collection(collection).doc(id), data, { merge: true });
      ops += 1;
      if (ops >= 450) {
        throw new Error('Commerce checkout batch too large; reduce cart size');
      }
    };

    set(COMMERCE_CHECKOUTS, bundle.checkout.id, bundle.checkout);
    for (const order of bundle.orders) {
      set(COMMERCE_ORDERS, order.id, order);
    }
    for (const br of bundle.bookingRequests) {
      set(COMMERCE_BOOKING_REQUESTS, br.id, br);
    }
    if (bundle.idempotency) {
      const id = idempotencyDocId(bundle.idempotency.consumerId, bundle.idempotency.key);
      set(COMMERCE_IDEMPOTENCY, id, { ...bundle.idempotency, id });
    }
    if (bundle.clearedCart) {
      set(COMMERCE_CARTS, bundle.clearedCart.id, bundle.clearedCart);
    }

    await batch.commit();
  },
};
