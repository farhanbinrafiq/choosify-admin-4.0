import type { OpsStorefrontOrder } from './types';

export type OpsShipmentStatus =
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

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
}

const nowIso = () => new Date().toISOString();

const state: OpsShipment[] = [];

export const shipmentStore = {
  listShipments: () => [...state].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getShipment: (id: string) =>
    state.find((row) => row.id === id || row.orderId === id || row.trackingNumber === id) ?? null,
  getShipmentByOrderId: (orderId: string) => state.find((row) => row.orderId === orderId) ?? null,

  createFromOrder: (order: OpsStorefrontOrder): OpsShipment => {
    const existing = state.find((row) => row.orderId === order.orderId);
    if (existing) return existing;

    const ts = nowIso();
    const trackingNumber = `TRK-${order.orderId.replace(/\W/g, '').slice(-10).toUpperCase()}`;
    const shipment: OpsShipment = {
      id: `ship_${order.orderId}`,
      orderId: order.orderId,
      buyerId: order.buyerId,
      status: 'pending_pickup',
      courier: 'pathao',
      trackingNumber,
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
          status: 'pending_pickup',
          location: order.shipping?.region || 'Dhaka',
          description: `Shipment created for order ${order.orderId}`,
        },
      ],
    };
    state.unshift(shipment);
    return shipment;
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
