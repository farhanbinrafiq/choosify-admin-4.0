import type { OpsStorefrontOrder } from './types';

export type OpsShipmentStatus =
  /** New orders — no courier / tracking assigned yet. Distinct from a real pickup wait. */
  | 'awaiting_dispatch'
  /** Seller/staff submitted Dispatch Details; parcel handed to courier — NOT yet moving. */
  | 'dispatched'
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

/** Statuses that are canonical evidence the parcel has physically progressed. */
export const SHIPMENT_MOVEMENT_STATUSES: ReadonlySet<string> = new Set([
  'picked_up',
  'in_transit',
  'delivered',
  'failed_delivery',
  'returned',
]);

export interface OpsTrackingEvent {
  id: string;
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export interface OpsShipment {
  id: string;
  orderId: string;
  buyerId: string;
  status: OpsShipmentStatus;
  courier: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  region: string;
  codAmount: number;
  deliveryCharge: number;
  createdAt: string;
  updatedAt: string;
  trackingEvents: OpsTrackingEvent[];
  /** Dispatch Details (Sprint 14) — set only on a real successful dispatch. */
  fulfillmentMethod?: 'courier' | 'seller_delivery' | 'pickup';
  dispatchedAt?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  dispatchNote?: string;
}

const nowIso = () => new Date().toISOString();

const state: OpsShipment[] = [];

export const shipmentStore = {
  listShipments: () => [...state].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getShipment: (id: string) =>
    state.find((row) => row.id === id || row.orderId === id || row.trackingNumber === id) ?? null,
  getShipmentByOrderId: (orderId: string) => state.find((row) => row.orderId === orderId) ?? null,

  /**
   * Sprint 14: a shipment record is now created EMPTY — no courier, no tracking
   * number, status `awaiting_dispatch` — until the seller/staff submits real
   * Dispatch Details. Previously it was seeded with `courier: 'pathao'` and an
   * auto `TRK-…`, which made every fresh order falsely look courier-assigned.
   * Existing (hydrated) shipments are untouched; a legacy synthetic `TRK-…` is
   * NOT treated as proof of courier handover anywhere.
   */
  createFromOrder: (order: OpsStorefrontOrder): OpsShipment => {
    const existing = state.find((row) => row.orderId === order.orderId);
    if (existing) return existing;

    const ts = nowIso();
    const shipment: OpsShipment = {
      id: `ship_${order.orderId}`,
      orderId: order.orderId,
      buyerId: order.buyerId,
      status: 'awaiting_dispatch',
      courier: '',
      trackingNumber: '',
      recipientName: order.shipping?.fullName || order.buyerId,
      recipientPhone: order.shipping?.phone || '',
      deliveryAddress: order.shipping?.address || '',
      region: order.shipping?.region || 'Dhaka',
      codAmount: order.isCOD ? Number(order.overallTotal || 0) : 0,
      deliveryCharge: Number(order.deliveryTotal || 120),
      createdAt: ts,
      updatedAt: ts,
      trackingEvents: [
        {
          id: `evt_${Date.now()}`,
          timestamp: ts,
          status: 'awaiting_dispatch',
          location: order.shipping?.region || 'Dhaka',
          description: `Order ${order.orderId} received — awaiting dispatch (no courier assigned yet)`,
        },
      ],
    };
    state.unshift(shipment);
    return shipment;
  },

  /** Append a checkpoint event without changing status (history-preserving). */
  appendTrackingEvent: (id: string, event: Omit<OpsTrackingEvent, 'id'>) => {
    const idx = state.findIndex((row) => row.id === id || row.orderId === id);
    if (idx < 0) return null;
    state[idx] = {
      ...state[idx],
      trackingEvents: [{ ...event, id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, ...state[idx].trackingEvents],
      updatedAt: nowIso(),
    };
    return state[idx];
  },

  hydrate: (rows: OpsShipment[]) => {
    state.length = 0;
    state.push(...rows);
  },

  updateShipment: (id: string, patch: Partial<OpsShipment>) => {
    const idx = state.findIndex((row) => row.id === id || row.orderId === id);
    if (idx < 0) return null;
    state[idx] = { ...state[idx], ...patch, updatedAt: nowIso() };
    return state[idx];
  },

  updateFromWebhook: (
    trackingNumber: string,
    status: OpsShipmentStatus,
    event: Omit<OpsTrackingEvent, 'id'>,
  ) => {
    const idx = state.findIndex((row) => row.trackingNumber === trackingNumber);
    if (idx < 0) return null;
    const trackingEvents = [
      { ...event, id: `evt_${Date.now()}` },
      ...state[idx].trackingEvents,
    ];
    state[idx] = {
      ...state[idx],
      status,
      trackingEvents,
      updatedAt: nowIso(),
    };
    return state[idx];
  },
};
