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
  /**
   * Discriminator so a warranty return/redelivery shipment can reference the
   * original commercial Order ID without being mistaken for — or colliding
   * with — that order's own commercial shipment. Absent/'order' = the
   * original behavior (one shipment per commercial order, `id: ship_<orderId>`).
   * 'warranty_claim' shipments still carry the real `orderId` for traceability
   * but are never a new commercial order and never returned by
   * `getShipmentByOrderId` (which existing Order Hub / courier UI relies on
   * meaning "this order's own parcel").
   */
  sourceType?: 'order' | 'warranty_claim';
  /** Set only when sourceType === 'warranty_claim' — the OpsWarrantyClaim id. */
  sourceId?: string;
}

const nowIso = () => new Date().toISOString();

const state: OpsShipment[] = [];

export const shipmentStore = {
  listShipments: () => [...state].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getShipment: (id: string) =>
    state.find((row) => row.id === id) ??
    state.find((row) => (row.orderId === id && row.sourceType !== 'warranty_claim') || row.trackingNumber === id) ??
    null,
  /** The order's own commercial shipment only — never a warranty return/redelivery shipment for the same order. */
  getShipmentByOrderId: (orderId: string) =>
    state.find((row) => row.orderId === orderId && row.sourceType !== 'warranty_claim') ?? null,
  /** All warranty-logistics shipments (return pickup + redelivery) for one claim. */
  getShipmentsByWarrantyClaimId: (claimId: string) =>
    state.filter((row) => row.sourceType === 'warranty_claim' && row.sourceId === claimId),

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

  /**
   * A warranty return-pickup or redelivery shipment — references the
   * original commercial Order ID + a Warranty Claim ID, but is NOT a new
   * commercial order and never overwrites/duplicates the order's own
   * shipment (`createFromOrder`). `direction` distinguishes a return-to-
   * seller pickup from an outbound redelivery back to the buyer — both can
   * exist for the same claim over its lifetime (e.g. return pickup first,
   * then a separate redelivery once repaired).
   */
  createForWarrantyClaim: (params: {
    claimId: string;
    orderId: string;
    buyerId: string;
    direction: 'return_pickup' | 'redelivery';
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    region: string;
  }): OpsShipment => {
    const existing = state.find(
      (row) => row.sourceType === 'warranty_claim' && row.sourceId === params.claimId && row.id.endsWith(params.direction),
    );
    if (existing) return existing;

    const ts = nowIso();
    const shipment: OpsShipment = {
      id: `warranty_${params.claimId}_${params.direction}`,
      orderId: params.orderId,
      buyerId: params.buyerId,
      status: 'awaiting_dispatch',
      courier: '',
      trackingNumber: '',
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone,
      deliveryAddress: params.deliveryAddress,
      region: params.region || 'Dhaka',
      codAmount: 0,
      deliveryCharge: 0,
      createdAt: ts,
      updatedAt: ts,
      sourceType: 'warranty_claim',
      sourceId: params.claimId,
      trackingEvents: [
        {
          id: `evt_${Date.now()}`,
          timestamp: ts,
          status: 'awaiting_dispatch',
          location: params.region || 'Dhaka',
          description:
            params.direction === 'return_pickup'
              ? `Warranty claim ${params.claimId} — return pickup requested for order ${params.orderId}`
              : `Warranty claim ${params.claimId} — redelivery scheduled for order ${params.orderId}`,
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
