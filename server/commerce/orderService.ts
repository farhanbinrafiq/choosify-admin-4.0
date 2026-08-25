/**
 * Order lifecycle service — Sprint 6–7 / IS-010 Sprint 9–10.
 * Product: ES-005 §27. Cancel: ES-005 §33. Ship: ES-005 §39.
 * Prepaid Confirm requires PaymentCaptured; COD follows COD policy (Sprint 7).
 */

import {
  getInventoryRecord,
  releaseInventoryQuantity,
  restockInventoryQuantity,
  syncProductStockFromInventory,
  withInventoryLock,
  adjustInventory,
  inventoryRecordId,
} from '../catalog/inventoryStore';
import { publishEvent } from '../events/eventBus';
import { operationsStore } from '../operations/operationsStore';
import { CommerceError } from './cartService';
import { commerceStore } from './commerceStore';
import {
  canActorCancel,
  canActorForwardTransition,
  canTransitionOrder,
  eventNameForStatus,
  normalizeOrderStatus,
  orderHasOnlyServices,
  orderHasProductLines,
} from './orderLifecycle';
import type {
  CommerceCancelActor,
  CommerceFulfilmentMethod,
  CommerceOrder,
  CommerceOrderStatus,
  CommerceShipment,
  CommerceShipmentStatus,
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitOrder(eventName: string, orderId: string, actor: string, payload: object) {
  publishEvent({
    eventName,
    domain: 'Commerce',
    producer: 'commerceOrderLifecycle',
    aggregateId: orderId,
    actor,
    payload,
  });
}

function resolveActorRole(role?: string): 'consumer' | 'seller' | 'admin' {
  if (role === 'admin' || role === 'super_admin') return 'admin';
  if (role?.includes('seller')) return 'seller';
  return 'consumer';
}

function isPlatformReader(role?: string): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'moderator';
}

async function assertOrderAccess(
  order: CommerceOrder,
  actor: { userId: string; role?: string; brandId?: string },
  mutate: boolean,
): Promise<'consumer' | 'seller' | 'admin'> {
  if (mutate) {
    if (resolveActorRole(actor.role) === 'admin') return 'admin';
  } else if (isPlatformReader(actor.role)) {
    return 'admin';
  }
  if (order.sellerId === actor.userId) {
    if (actor.brandId && actor.brandId !== order.brandId) {
      throw new CommerceError('Not authorized for this Brand Order', 403);
    }
    return 'seller';
  }
  if (order.consumerId === actor.userId) {
    return 'consumer';
  }
  throw new CommerceError('Not authorized to access this order', 403);
}

/** Release reserved qty on cancel / payment failure (idempotent via inventoryReserved flag). */
/**
 * Sprint 7: per-item body delegates to the canonical mutex-protected
 * releaseInventoryQuantity() (same TOCTOU close as checkoutService.ts's
 * reserveProductInventory()/releaseReservations() in Sprint 6) -- this
 * function's own order.inventoryReserved/inventoryConsumed idempotency
 * guard above the loop is unchanged, since it's order-level business logic
 * distinct from the per-record mutation.
 */
export async function releaseOrderReservations(order: CommerceOrder): Promise<CommerceOrder> {
  if (!order.inventoryReserved || order.inventoryConsumed) {
    return { ...order, inventoryReserved: false };
  }
  for (const item of order.items.filter((i) => i.listingType === 'product')) {
    await releaseInventoryQuantity({
      productId: item.listingId,
      variantId: item.variantId,
      quantity: item.quantity,
    });
  }
  return { ...order, inventoryReserved: false };
}

/**
 * ADR-003 Sprint 7: release reservations for orders under a failed/cancelled payment.
 * Idempotent per-order via inventoryReserved.
 */
export async function applyPaymentFailureInventoryRelease(orderIds: string[]): Promise<void> {
  for (const orderId of orderIds) {
    const order = await commerceStore.getOrder(orderId);
    if (!order) continue;
    if (!order.inventoryReserved || order.inventoryConsumed) continue;
    const next = await releaseOrderReservations(order);
    await commerceStore.upsertOrder({ ...next, updatedAt: new Date().toISOString() });
  }
}

/**
 * After PaymentCaptured (prepaid) or COD policy acceptance — confirm pending orders.
 * Emits OrderConfirmed. Does not release inventory.
 */
export async function confirmOrdersForCapturedPayment(params: {
  orderIds: string[];
  actorId: string;
  paymentId: string;
  reason: 'payment_captured' | 'cod_policy';
}): Promise<CommerceOrder[]> {
  const out: CommerceOrder[] = [];
  for (const orderId of params.orderIds) {
    const order = await commerceStore.getOrder(orderId);
    if (!order) continue;
    if (order.status !== 'pending') {
      out.push(order);
      continue;
    }
    const next: CommerceOrder = {
      ...order,
      status: 'confirmed',
      updatedAt: new Date().toISOString(),
    };
    await commerceStore.upsertOrder(next);
    mirrorOpsStatus(next);
    emitOrder('OrderConfirmed', next.id, params.actorId, {
      orderId: next.id,
      paymentId: params.paymentId,
      reason: params.reason,
      from: 'pending',
      to: 'confirmed',
    });
    out.push(next);
  }
  return out;
}

/** Prepaid checkout Orders cannot Confirm until Payment Captured. COD / manual paths differ. */
function assertPaymentAllowsConfirm(order: CommerceOrder): void {
  // Manual / external social: Confirm may precede payment (IS-004 §15–§16)
  if (order.source === 'manual' || String(order.source).startsWith('external_')) {
    return;
  }

  const method = String(order.paymentMethod || '').toLowerCase();
  const payStatus = String(order.paymentStatus || '').toLowerCase();

  if (method === 'cod') {
    if (payStatus === 'failed' || payStatus === 'cancelled') {
      throw new CommerceError('COD Order cannot be Confirmed after payment failure', 409);
    }
    return;
  }

  if (method === 'wallet' || method === 'installment') {
    throw new CommerceError('Payment method not available for Confirm in this sprint', 409);
  }

  if (payStatus !== 'paid' && payStatus !== 'partial') {
    throw new CommerceError(
      'Prepaid Order cannot be Confirmed until Payment is Captured',
      409,
    );
  }
}

/**
 * Restock after cancel when inventory was already consumed at Packed.
 * Sprint 7: per-item body delegates to the canonical restockInventoryQuantity().
 */
async function restockConsumedInventory(order: CommerceOrder): Promise<CommerceOrder> {
  if (!order.inventoryConsumed) return order;
  for (const item of order.items.filter((i) => i.listingType === 'product')) {
    await restockInventoryQuantity({
      productId: item.listingId,
      variantId: item.variantId,
      quantity: item.quantity,
    });
  }
  return { ...order, inventoryConsumed: false, inventoryReserved: false };
}

/**
 * At Packed: convert reservation into sold stock (qty -= n, reserved -= n).
 * Idempotent via inventoryConsumed.
 *
 * Sprint 7: the reservedQuantity delta is conditional on order.inventoryReserved
 * (an order that skipped reservation -- e.g. manual/staff-created -- must not
 * decrement reservedQuantity it never added, which could belong to a
 * completely different order's reservation on the same product). That
 * conditional isn't a clean match for consumeInventoryQuantity()'s
 * unconditional contract, so rather than force it or leave the race open,
 * this wraps the existing per-item logic directly in the same canonical
 * withInventoryLock() mutex reserve/release/consume/restock all share --
 * one lock, still no second implementation of it.
 */
async function consumeOrderInventory(order: CommerceOrder): Promise<CommerceOrder> {
  if (order.inventoryConsumed || !orderHasProductLines(order.items)) {
    return { ...order, inventoryConsumed: true, inventoryReserved: false };
  }
  for (const item of order.items.filter((i) => i.listingType === 'product')) {
    const key = inventoryRecordId(item.listingId, item.variantId);
    await withInventoryLock(key, async () => {
      const record = await getInventoryRecord(item.listingId, item.variantId);
      if (!record) return;
      const nextQty = Math.max(0, record.quantity - item.quantity);
      const nextReserved = order.inventoryReserved
        ? Math.max(0, record.reservedQuantity - item.quantity)
        : record.reservedQuantity;
      await adjustInventory({
        productId: item.listingId,
        variantId: item.variantId,
        quantity: nextQty,
        reservedQuantity: Math.min(nextReserved, nextQty),
      });
      await syncProductStockFromInventory(item.listingId);
    });
  }
  return { ...order, inventoryConsumed: true, inventoryReserved: false };
}

function mirrorOpsStatus(order: CommerceOrder): void {
  try {
    const map: Record<CommerceOrderStatus, string> = {
      pending: 'pending_payment',
      confirmed: 'confirmed',
      packed: 'active',
      shipped: 'active',
      delivered: 'active',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    operationsStore.updateOrder(order.orderNumber, {
      status: map[order.status] as
        | 'pending_payment'
        | 'active'
        | 'confirmed'
        | 'cancelled'
        | 'completed',
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      cancelledBy:
        order.cancelledBy === 'consumer'
          ? 'buyer'
          : order.cancelledBy === 'seller' || order.cancelledBy === 'admin'
            ? order.cancelledBy
            : undefined,
    });
  } catch {
    /* best-effort mirror */
  }
}

function ensureShipment(
  order: CommerceOrder,
  existing: CommerceShipment | null,
  fulfilmentMethod: CommerceFulfilmentMethod,
  patch?: Partial<CommerceShipment>,
): CommerceShipment {
  const ts = nowIso();
  if (existing) {
    return {
      ...existing,
      ...patch,
      fulfilmentMethod: patch?.fulfilmentMethod || existing.fulfilmentMethod || fulfilmentMethod,
      updatedAt: ts,
    };
  }
  return {
    id: newId('cship'),
    orderId: order.id,
    checkoutId: order.checkoutId,
    consumerId: order.consumerId,
    sellerId: order.sellerId,
    brandId: order.brandId,
    fulfilmentMethod,
    courierProvider: patch?.courierProvider ?? null,
    trackingNumber: patch?.trackingNumber ?? null,
    status: patch?.status || 'pending_fulfilment',
    shippedAt: patch?.shippedAt,
    deliveredAt: patch?.deliveredAt,
    createdAt: ts,
    updatedAt: ts,
  };
}

function shipmentEvent(status: CommerceShipmentStatus): string | null {
  switch (status) {
    case 'pending_fulfilment':
      return 'ShipmentCreated';
    case 'courier_assigned':
      return 'ShipmentAssigned';
    case 'in_transit':
    case 'picked_up':
    case 'out_for_delivery':
      return 'ShipmentShipped';
    case 'delivered':
      return 'ShipmentDelivered';
    case 'packed':
      return 'ShipmentCreated';
    default:
      return null;
  }
}

export type TransitionInput = {
  orderId: string;
  toStatus: string;
  actor: { userId: string; role?: string; brandId?: string };
  fulfilmentMethod?: CommerceFulfilmentMethod;
  courierProvider?: string;
  trackingNumber?: string;
};

export async function transitionOrder(
  input: TransitionInput,
): Promise<{ order: CommerceOrder; shipment?: CommerceShipment; reused: boolean }> {
  const order = await commerceStore.getOrder(input.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const actorKind = await assertOrderAccess(order, input.actor, true);
  if (actorKind === 'consumer') {
    throw new CommerceError('Consumers cannot advance fulfilment status', 403);
  }

  const to = normalizeOrderStatus(input.toStatus);
  if (!to || to === 'cancelled') {
    throw new CommerceError('Invalid target status (use cancel endpoint for cancellation)');
  }

  if (order.status === to) {
    const shipment = order.shipmentId
      ? await commerceStore.getShipment(order.shipmentId)
      : await commerceStore.getShipmentByOrderId(order.id);
    return { order, shipment: shipment || undefined, reused: true };
  }

  const serviceOnly = orderHasOnlyServices(order.items);
  if (!canTransitionOrder(order.status, to, { serviceOnly })) {
    throw new CommerceError(`Invalid transition ${order.status} → ${to}`);
  }
  if (!canActorForwardTransition(actorKind, to)) {
    throw new CommerceError('Not authorized for this transition', 403);
  }

  // Sprint 7: gate prepaid Confirm on payment capture (server-authoritative)
  if (to === 'confirmed' && order.status === 'pending') {
    assertPaymentAllowsConfirm(order);
  }

  let next: CommerceOrder = {
    ...order,
    status: to,
    updatedAt: nowIso(),
  };
  let shipment: CommerceShipment | undefined;
  const method = input.fulfilmentMethod || 'self_delivery';

  if (!serviceOnly) {
    if (to === 'packed') {
      next = await consumeOrderInventory(next);
      const existing = await commerceStore.getShipmentByOrderId(order.id);
      const created = !existing;
      shipment = ensureShipment(next, existing, method, {
        status: 'packed',
        courierProvider: input.courierProvider,
        trackingNumber: input.trackingNumber,
      });
      next.shipmentId = shipment.id;
      if (created) {
        emitOrder('ShipmentCreated', next.id, input.actor.userId, {
          orderId: next.id,
          shipmentId: shipment.id,
          status: shipment.status,
        });
      }
    }
    if (to === 'shipped') {
      const existing = await commerceStore.getShipmentByOrderId(order.id);
      if (!existing && !next.shipmentId) {
        throw new CommerceError('Order must be packed before shipping');
      }
      const hadCourier =
        !!existing?.courierProvider || existing?.status === 'courier_assigned' || existing?.status === 'in_transit';
      shipment = ensureShipment(next, existing, method, {
        status: 'in_transit',
        courierProvider: input.courierProvider ?? existing?.courierProvider ?? null,
        trackingNumber: input.trackingNumber ?? existing?.trackingNumber ?? null,
        shippedAt: existing?.shippedAt || nowIso(),
      });
      next.shipmentId = shipment.id;
      if (!hadCourier || input.courierProvider) {
        emitOrder('ShipmentAssigned', next.id, input.actor.userId, {
          orderId: next.id,
          shipmentId: shipment.id,
          courierProvider: shipment.courierProvider,
        });
      }
      emitOrder('ShipmentShipped', next.id, input.actor.userId, {
        orderId: next.id,
        shipmentId: shipment.id,
      });
    }
    if (to === 'delivered') {
      const existing = await commerceStore.getShipmentByOrderId(order.id);
      if (
        existing &&
        (existing.status === 'packed' || existing.status === 'pending_fulfilment')
      ) {
        throw new CommerceError('Shipment must be shipped before Order can be Delivered');
      }
      shipment = ensureShipment(next, existing, method, {
        status: 'delivered',
        deliveredAt: nowIso(),
        shippedAt: existing?.shippedAt || nowIso(),
      });
      next.shipmentId = shipment.id;
      emitOrder('ShipmentDelivered', next.id, input.actor.userId, {
        orderId: next.id,
        shipmentId: shipment.id,
      });
    }
  }

  await commerceStore.commitOrderMutation({ order: next, shipment });
  mirrorOpsStatus(next);

  const evt = eventNameForStatus(to);
  if (evt) {
    emitOrder(evt, next.id, input.actor.userId, {
      orderId: next.id,
      from: order.status,
      to,
      sellerId: next.sellerId,
      brandId: next.brandId,
    });
  }

  // Product Escrow release gate: OrderCompleted only (NOT OrderDelivered).
  if (to === 'completed') {
    try {
      const { settleEscrowForOrder } = await import('../escrow/escrowService');
      await settleEscrowForOrder(next.id, input.actor.userId);
    } catch (error) {
      // Settlement eligibility may fail (dispute hold, etc.) — surface on next reconcile/API.
      const { Logger } = await import('../lib/logger');
      Logger.error('Escrow settlement after OrderCompleted failed', {
        orderId: next.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { order: next, shipment, reused: false };
}

export type CancelInput = {
  orderId: string;
  actor: { userId: string; role?: string; brandId?: string };
  reason: string;
};

export async function cancelOrder(
  input: CancelInput,
): Promise<{ order: CommerceOrder; reused: boolean }> {
  const reason = (input.reason || '').trim();
  if (!reason) throw new CommerceError('Cancellation reason is required');

  const order = await commerceStore.getOrder(input.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  if (order.status === 'cancelled') {
    return { order, reused: true };
  }

  const roleKind = resolveActorRole(input.actor.role);
  let effective: CommerceCancelActor;
  if (roleKind === 'admin') {
    effective = 'admin';
  } else if (order.sellerId === input.actor.userId) {
    effective = 'seller';
    if (input.actor.brandId && input.actor.brandId !== order.brandId) {
      throw new CommerceError('Not authorized for this Brand Order', 403);
    }
  } else if (order.consumerId === input.actor.userId) {
    effective = 'consumer';
  } else {
    throw new CommerceError('Not authorized to cancel this order', 403);
  }

  if (!canActorCancel(effective, order.status)) {
    throw new CommerceError(
      `Cancellation not allowed for ${effective} while order is ${order.status}`,
      403,
    );
  }

  let next: CommerceOrder = {
    ...order,
    status: 'cancelled',
    cancelledBy: effective,
    cancelReason: reason,
    cancelledAt: nowIso(),
    statusBeforeCancel: order.status,
    updatedAt: nowIso(),
  };

  if (next.inventoryConsumed) {
    next = await restockConsumedInventory(next);
  } else if (next.inventoryReserved) {
    next = await releaseOrderReservations(next);
  }

  const shipment = await commerceStore.getShipmentByOrderId(order.id);
  let shipmentUpdate: CommerceShipment | undefined;
  if (shipment && shipment.status !== 'delivered') {
    shipmentUpdate = { ...shipment, status: 'cancelled', updatedAt: nowIso() };
  }

  // Captured funds must enter Refund/Escrow reversal — do not forget money.
  const hadCapturedFunds =
    (order.paymentStatus === 'paid' || order.paymentStatus === 'partial') &&
    (order.paidAmount || 0) > 0;
  if (hadCapturedFunds) {
    try {
      if (order.paymentId) {
        const { commercePaymentStore } = await import('../payments/commercePaymentStore');
        const { reconcileEscrowEffectsForPayment, refundEscrowsForCancelledOrder } =
          await import('../escrow/escrowService');
        const payment = await commercePaymentStore.getPayment(order.paymentId);
        if (payment?.status === 'captured') {
          await reconcileEscrowEffectsForPayment(payment, input.actor.userId);
        }
        await refundEscrowsForCancelledOrder({
          orderId: order.id,
          reason: `Order cancelled: ${reason}`,
          actor: input.actor,
        });
      } else {
        const { refundEscrowsForCancelledOrder } = await import('../escrow/escrowService');
        await refundEscrowsForCancelledOrder({
          orderId: order.id,
          reason: `Order cancelled: ${reason}`,
          actor: input.actor,
        });
      }
    } catch (error) {
      const { Logger } = await import('../lib/logger');
      Logger.error('Escrow refund on cancel failed', {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof Error
        ? error
        : new CommerceError('Escrow refund on cancel failed', 500);
    }
  }

  await commerceStore.commitOrderMutation({ order: next, shipment: shipmentUpdate });
  mirrorOpsStatus(next);
  emitOrder('OrderCancelled', next.id, input.actor.userId, {
    orderId: next.id,
    cancelledBy: effective,
    reason,
    previousStatus: order.status,
  });

  return { order: next, reused: false };
}

export async function getShipmentForActor(
  shipmentId: string,
  actor: { userId: string; role?: string },
): Promise<CommerceShipment> {
  const shipment = await commerceStore.getShipment(shipmentId);
  if (!shipment) throw new CommerceError('Shipment not found', 404);
  const order = await commerceStore.getOrder(shipment.orderId);
  if (!order) throw new CommerceError('Order not found', 404);
  await assertOrderAccess(order, actor, false);
  return shipment;
}

export async function listOrdersGroupedByCheckout(actor: {
  userId: string;
  role?: string;
  as?: 'consumer' | 'seller';
  brandId?: string;
  status?: string;
}): Promise<{
  orders: CommerceOrder[];
  byCheckout: Record<string, CommerceOrder[]>;
}> {
  const all = await commerceStore.listOrders();
  const kind = resolveActorRole(actor.role);
  const platformReader = isPlatformReader(actor.role);
  let filtered = all;
  if (platformReader && !actor.as) {
    filtered = all;
  } else if (actor.as === 'seller' || (!actor.as && kind === 'seller')) {
    filtered = all.filter((o) => o.sellerId === actor.userId);
    if (actor.brandId) filtered = filtered.filter((o) => o.brandId === actor.brandId);
  } else {
    filtered = all.filter((o) => o.consumerId === actor.userId);
  }
  if (actor.brandId && platformReader && !actor.as) {
    filtered = filtered.filter((o) => o.brandId === actor.brandId);
  }
  if (actor.status) {
    const st = normalizeOrderStatus(actor.status);
    if (st) filtered = filtered.filter((o) => o.status === st);
  }
  const byCheckout: Record<string, CommerceOrder[]> = {};
  for (const o of filtered) {
    const key = o.checkoutId || 'unknown';
    if (!byCheckout[key]) byCheckout[key] = [];
    byCheckout[key].push(o);
  }
  return { orders: filtered, byCheckout };
}

export { normalizeOrderStatus, shipmentEvent };
