/**
 * Commerce memory-disk backend (local/dev fallback only).
 */

import {
  flushCommerceMemoryPersist,
  loadCommerceMemorySnapshot,
  scheduleCommerceMemoryPersist,
  type CommerceMemorySnapshot,
} from './commercePersistence';
import {
  idempotencyDocId,
  type CommerceIdempotencyRecord,
} from './commerceCollections';
import type {
  CommerceBookingRequest,
  CommerceCart,
  CommerceCheckout,
  CommerceOrder,
  CommerceShipment,
} from './types';
import type { CommerceCheckoutBundle, CommerceOrderMutationBundle } from './commerceFirestoreAdmin';

const state: {
  carts: CommerceCart[];
  checkouts: CommerceCheckout[];
  orders: CommerceOrder[];
  bookingRequests: CommerceBookingRequest[];
  idempotency: CommerceIdempotencyRecord[];
  shipments: CommerceShipment[];
} = {
  carts: [],
  checkouts: [],
  orders: [],
  bookingRequests: [],
  idempotency: [],
  shipments: [],
};

let hydrated = false;

function buildSnapshot(): CommerceMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    carts: state.carts,
    checkouts: state.checkouts,
    orders: state.orders,
    bookingRequests: state.bookingRequests,
    idempotency: state.idempotency,
    shipments: state.shipments,
  };
}

function schedulePersist(): void {
  scheduleCommerceMemoryPersist(buildSnapshot);
}

function upsertById<T extends { id: string }>(arr: T[], row: T): T {
  const idx = arr.findIndex((r) => r.id === row.id);
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);
  schedulePersist();
  return row;
}

export function ensureCommerceMemoryHydrated(): boolean {
  if (hydrated) return true;
  hydrated = true;
  const snapshot = loadCommerceMemorySnapshot();
  if (!snapshot) return false;
  state.carts = (snapshot.carts as CommerceCart[]) || [];
  state.checkouts = (snapshot.checkouts as CommerceCheckout[]) || [];
  state.orders = (snapshot.orders as CommerceOrder[]) || [];
  state.bookingRequests = (snapshot.bookingRequests as CommerceBookingRequest[]) || [];
  state.idempotency = (snapshot.idempotency as CommerceIdempotencyRecord[]) || [];
  state.shipments = (snapshot.shipments as CommerceShipment[]) || [];
  console.log(
    `[CommerceMemoryPersist] Hydrated (${state.carts.length} carts, ${state.orders.length} orders, ${state.shipments.length} shipments).`,
  );
  return true;
}

export const commerceMemoryBackend = {
  getCartByConsumer(consumerId: string): CommerceCart | null {
    ensureCommerceMemoryHydrated();
    return state.carts.find((c) => c.consumerId === consumerId) ?? null;
  },
  getCart(id: string): CommerceCart | null {
    ensureCommerceMemoryHydrated();
    return state.carts.find((c) => c.id === id) ?? null;
  },
  upsertCart(cart: CommerceCart): CommerceCart {
    ensureCommerceMemoryHydrated();
    return upsertById(state.carts, cart);
  },
  deleteCart(id: string): void {
    ensureCommerceMemoryHydrated();
    state.carts = state.carts.filter((c) => c.id !== id);
    schedulePersist();
  },
  getCheckout(id: string): CommerceCheckout | null {
    ensureCommerceMemoryHydrated();
    return state.checkouts.find((c) => c.id === id) ?? null;
  },
  upsertCheckout(checkout: CommerceCheckout): CommerceCheckout {
    ensureCommerceMemoryHydrated();
    return upsertById(state.checkouts, checkout);
  },
  getOrder(id: string): CommerceOrder | null {
    ensureCommerceMemoryHydrated();
    return state.orders.find((o) => o.id === id) ?? null;
  },
  listOrders(): CommerceOrder[] {
    ensureCommerceMemoryHydrated();
    return [...state.orders];
  },
  upsertOrder(order: CommerceOrder): CommerceOrder {
    ensureCommerceMemoryHydrated();
    return upsertById(state.orders, order);
  },
  getBookingRequest(id: string): CommerceBookingRequest | null {
    ensureCommerceMemoryHydrated();
    return state.bookingRequests.find((b) => b.id === id) ?? null;
  },
  listBookingRequests(): CommerceBookingRequest[] {
    ensureCommerceMemoryHydrated();
    return [...state.bookingRequests];
  },
  upsertBookingRequest(row: CommerceBookingRequest): CommerceBookingRequest {
    ensureCommerceMemoryHydrated();
    return upsertById(state.bookingRequests, row);
  },
  getShipment(id: string): CommerceShipment | null {
    ensureCommerceMemoryHydrated();
    return state.shipments.find((s) => s.id === id) ?? null;
  },
  getShipmentByOrderId(orderId: string): CommerceShipment | null {
    ensureCommerceMemoryHydrated();
    return state.shipments.find((s) => s.orderId === orderId) ?? null;
  },
  listShipments(): CommerceShipment[] {
    ensureCommerceMemoryHydrated();
    return [...state.shipments];
  },
  upsertShipment(row: CommerceShipment): CommerceShipment {
    ensureCommerceMemoryHydrated();
    return upsertById(state.shipments, row);
  },
  getIdempotency(key: string, consumerId: string): CommerceIdempotencyRecord | null {
    ensureCommerceMemoryHydrated();
    return (
      state.idempotency.find((r) => r.key === key && r.consumerId === consumerId) ?? null
    );
  },
  putIdempotency(row: Omit<CommerceIdempotencyRecord, 'id'>): CommerceIdempotencyRecord {
    ensureCommerceMemoryHydrated();
    const id = idempotencyDocId(row.consumerId, row.key);
    const payload: CommerceIdempotencyRecord = { ...row, id };
    const idx = state.idempotency.findIndex(
      (r) => r.key === row.key && r.consumerId === row.consumerId,
    );
    if (idx >= 0) state.idempotency[idx] = payload;
    else state.idempotency.push(payload);
    schedulePersist();
    return payload;
  },
  commitCheckoutBundle(bundle: CommerceCheckoutBundle): void {
    ensureCommerceMemoryHydrated();
    upsertById(state.checkouts, bundle.checkout);
    for (const order of bundle.orders) upsertById(state.orders, order);
    for (const br of bundle.bookingRequests) upsertById(state.bookingRequests, br);
    if (bundle.idempotency) {
      this.putIdempotency(bundle.idempotency);
    }
    if (bundle.clearedCart) {
      upsertById(state.carts, bundle.clearedCart);
    }
  },
  commitOrderMutation(bundle: CommerceOrderMutationBundle): void {
    ensureCommerceMemoryHydrated();
    upsertById(state.orders, bundle.order);
    if (bundle.shipment) upsertById(state.shipments, bundle.shipment);
  },
  flushPersist(): void {
    flushCommerceMemoryPersist();
  },
};
