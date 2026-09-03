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
import {
  shipmentStore,
  SHIPMENT_MOVEMENT_STATUSES,
  type OpsShipment,
} from '../operations/shipmentStore';
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

  // Canonical delivery settlement — the lifecycle "Mark delivered" CTA is one of
  // THREE delivery triggers; converge them so Operations items, the OpsShipment
  // and the buyer notification all agree with the Commerce order. Commerce is
  // already `delivered` here, so settleOrderDelivered's Commerce step is a no-op
  // (no re-entry): it only fills in the Operations item.deliveredAt, flips the
  // OpsShipment to delivered and posts the single buyer "delivered" event.
  if (to === 'delivered') {
    try {
      const { settleOrderDelivered } = await import('../operations/deliverySettlement');
      await settleOrderDelivered(next.orderNumber, 'lifecycle_cta', {
        actorId: input.actor.userId,
      });
    } catch (error) {
      const { Logger } = await import('../lib/logger');
      Logger.error('settleOrderDelivered after lifecycle "delivered" failed', {
        orderId: next.orderNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

export type ReturnToPendingInput = {
  orderId: string;
  actor: { userId: string; role?: string; brandId?: string };
  reason?: string;
};

/**
 * Sprint 14 — controlled "undo an accidental acceptance": confirmed → pending,
 * ONLY. A dedicated, server-validated correction — it does NOT generalise the
 * forward FSM and there is no packed/shipped/delivered → pending path here.
 *
 * Eligibility (ALL must hold, else 409):
 *   - actor owns the order (seller) or is admin/staff  (consumer → 403)
 *   - status is EXACTLY 'confirmed'
 *   - inventory not yet consumed (that happens at Packed)
 *   - no shipment beyond 'pending_fulfilment'
 *   - no order item already delivered (checked on the mirrored Operations order)
 *
 * Inventory: a confirmed order still only holds a *reservation* (taken at
 * checkout, before acceptance) — returning to pending keeps that reservation,
 * so no stock movement. Payment: any captured funds stay captured; the order
 * simply needs re-acceptance (re-confirm does not re-charge). The prior
 * OrderConfirmed event is left intact; who/when/why is recorded on the order
 * and a new OrderReturnedToPending event is emitted.
 */
export async function returnOrderToPending(
  input: ReturnToPendingInput,
): Promise<{ order: CommerceOrder }> {
  const order = await commerceStore.getOrder(input.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const roleKind = resolveActorRole(input.actor.role);
  let effective: CommerceCancelActor;
  if (roleKind === 'admin') {
    effective = 'admin';
  } else if (order.sellerId === input.actor.userId) {
    effective = 'seller';
    if (input.actor.brandId && input.actor.brandId !== order.brandId) {
      throw new CommerceError('Not authorized for this Brand Order', 403);
    }
  } else {
    throw new CommerceError('Not authorized to correct this order', 403);
  }

  if (order.status !== 'confirmed') {
    throw new CommerceError(
      `Only a confirmed order can be returned to pending (this order is ${order.status})`,
      409,
    );
  }
  if (order.inventoryConsumed) {
    throw new CommerceError('Order has already consumed stock — cannot return to pending', 409);
  }

  const shipment = await commerceStore.getShipmentByOrderId(order.id);
  if (shipment && shipment.status !== 'pending_fulfilment') {
    throw new CommerceError('A shipment has already been created — cannot return to pending', 409);
  }

  const opsMirror = operationsStore.getOrder(order.orderNumber);
  const anyDelivered = ((opsMirror?.subOrders || []) as Array<{ items?: Array<{ deliveredAt?: string }> }>)
    .some((s) => (s.items || []).some((it) => Boolean(it.deliveredAt)));
  if (anyDelivered) {
    throw new CommerceError('An item on this order is already delivered — cannot return to pending', 409);
  }

  const now = nowIso();
  const reason = (input.reason || '').trim();
  const next: CommerceOrder = {
    ...order,
    status: 'pending',
    returnedToPendingAt: now,
    returnedToPendingBy: effective,
    returnedToPendingReason: reason || undefined,
    updatedAt: now,
  };

  await commerceStore.commitOrderMutation({ order: next });
  mirrorOpsStatus(next);
  emitOrder('OrderReturnedToPending', next.id, input.actor.userId, {
    orderId: next.id,
    from: 'confirmed',
    to: 'pending',
    by: effective,
    reason: reason || undefined,
  });

  return { order: next };
}

// ════════════════════════════════════════════════════════════════════════
// Dispatch Details gate (Sprint 14) — Processing/Packed → Dispatched
// ════════════════════════════════════════════════════════════════════════
//
// A single blind "Mark Dispatched" click is not allowed. The seller/staff must
// submit real Dispatch Details; the canonical OpsShipment record is written
// FIRST, then the Commerce lifecycle advances packed → shipped, then the
// canonical state is mirrored, then a single System-B dispatch card + one
// buyer notification are produced. DISPATCHED ≠ IN TRANSIT: the shipment goes
// to status 'dispatched' — courier checkpoint webhooks are what later move it
// to 'in_transit'.

export type DispatchFulfillmentMethod = 'courier' | 'seller_delivery' | 'pickup';

export type DispatchInput = {
  orderId: string; // commerce order id
  actor: { userId: string; role?: string; brandId?: string };
  fulfillmentMethod: DispatchFulfillmentMethod;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  dispatchNote?: string;
  idempotencyKey?: string;
};

/**
 * Providers Choosify KNOWS do not issue a tracking number. EMPTY by default —
 * so a courier dispatch ALWAYS requires a tracking/consignment number. There is
 * deliberately no seller-controlled "provider issues no tracking" checkbox.
 */
const COURIERS_WITHOUT_TRACKING: ReadonlySet<string> = new Set<string>();

type NormalizedDispatch = {
  method: DispatchFulfillmentMethod;
  courier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  dispatchNote?: string;
};

function validateDispatchDetails(
  input: DispatchInput,
): { errors: Record<string, string>; normalized: NormalizedDispatch | null } {
  const errors: Record<string, string> = {};
  const method = input.fulfillmentMethod;
  if (method !== 'courier' && method !== 'seller_delivery' && method !== 'pickup') {
    return { errors: { fulfillmentMethod: 'Select a fulfillment method' }, normalized: null };
  }
  const courier = String(input.courier || '').trim();
  const tracking = String(input.trackingNumber || '').trim();

  if (method === 'courier') {
    if (!courier) errors.courier = 'Courier / logistics provider is required';
    const knownNoTracking = COURIERS_WITHOUT_TRACKING.has(courier.toLowerCase());
    if (!knownNoTracking && !tracking) {
      errors.trackingNumber = 'Tracking / consignment number is required for courier dispatch';
    }
  } else if (method === 'seller_delivery') {
    if (!courier && !tracking) {
      errors.courier = 'A delivery method or reference is required for own delivery';
    }
  }
  // pickup: no courier / tracking required

  const eta = String(input.estimatedDelivery || '').trim();
  if (eta && Number.isNaN(Date.parse(eta))) errors.estimatedDelivery = 'Estimated delivery date is invalid';

  if (Object.keys(errors).length > 0) return { errors, normalized: null };
  return {
    errors,
    normalized: {
      method,
      courier,
      trackingNumber: tracking,
      trackingUrl: String(input.trackingUrl || '').trim() || undefined,
      estimatedDelivery: eta || undefined,
      dispatchNote: String(input.dispatchNote || '').trim() || undefined,
    },
  };
}

async function postDispatchSystemCard(
  order: CommerceOrder,
  shipment: OpsShipment,
  n: NormalizedDispatch,
): Promise<void> {
  const { submitPlatformMessage } = await import('../operations/platformMessagingBridge');
  const lines = ['📦 Your order has been dispatched'];
  if (n.method === 'courier') lines.push(`Courier: ${n.courier}`);
  else if (n.method === 'seller_delivery') lines.push(`Delivery: ${n.courier || 'Seller delivery'}`);
  else lines.push('Ready for pickup');
  if (n.trackingNumber) lines.push(`Tracking: ${n.trackingNumber}`);
  if (n.estimatedDelivery) lines.push(`Estimated delivery: ${n.estimatedDelivery}`);
  await submitPlatformMessage({
    buyerId: order.consumerId,
    userName: 'Choosify Platform',
    body: lines.join('\n'),
    orderId: order.orderNumber,
    senderId: 'system',
    direction: 'outbound',
    platformMessageId: `sys_dispatch_${order.orderNumber}`,
    dispatchEvent: {
      orderId: order.orderNumber,
      fulfillmentMethod: n.method,
      courier: n.courier || undefined,
      trackingNumber: n.trackingNumber || undefined,
      trackingUrl: n.trackingUrl,
      estimatedDelivery: n.estimatedDelivery,
      dispatchedAt: shipment.dispatchedAt || nowIso(),
    },
  });
}

async function notifyBuyerDispatched(order: CommerceOrder): Promise<void> {
  try {
    const { notifyUser } = await import('../communication/systemNotify');
    const { COMMUNICATION_TYPES, DELIVERY_CHANNELS } = await import('../communication/communicationTypes');
    await notifyUser(order.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      priority: 'normal',
      title: 'Order dispatched',
      summary: `Order ${order.orderNumber} has been dispatched.`,
      actionUrl: '/profile/orders',
      channels: [DELIVERY_CHANNELS.IN_APP],
      metadata: { orderId: order.orderNumber, event: 'dispatched' },
    });
  } catch (err) {
    // best-effort — the lifecycle event + System-B card are the primary signals
    const { Logger } = await import('../lib/logger');
    Logger.error('notifyBuyerDispatched failed', { orderId: order.orderNumber, error: String(err) });
  }
}

export async function dispatchOrder(
  input: DispatchInput,
): Promise<{ order: CommerceOrder; shipment: OpsShipment; reused: boolean }> {
  const order = await commerceStore.getOrder(input.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const actorKind = await assertOrderAccess(order, input.actor, true);
  if (actorKind === 'consumer') throw new CommerceError('Consumers cannot dispatch orders', 403);

  const opsOrderId = order.orderNumber;
  // Lazily create the canonical shipment for any legacy order that predates the
  // create-on-order behaviour (new orders always have one).
  let shipment = shipmentStore.getShipmentByOrderId(opsOrderId);
  if (!shipment) {
    const opsOrder = operationsStore.getOrder(opsOrderId);
    if (opsOrder) shipment = shipmentStore.createFromOrder(opsOrder);
  }
  if (!shipment) throw new CommerceError('Shipment record not found for this order', 404);

  // ── idempotency (BEFORE the state guard) — a replay of a successful
  //    dispatch returns the current state with NO side effects. ─────────
  if (shipment.dispatchedAt || String(order.status) === 'shipped') {
    return { order, shipment, reused: true };
  }

  if (order.status !== 'packed') {
    throw new CommerceError(
      `Only a processing order can be dispatched (this order is ${order.status})`,
      409,
    );
  }

  // ── validate BEFORE any mutation ────────────────────────────────────
  const { errors, normalized } = validateDispatchDetails(input);
  if (!normalized) {
    throw new CommerceError('Dispatch details are incomplete', 400, {
      code: 'DISPATCH_VALIDATION',
      details: errors,
    });
  }

  // ── 1) canonical OpsShipment → DISPATCHED (never in_transit here) ───
  const snapshot: OpsShipment = JSON.parse(JSON.stringify(shipment));
  const now = nowIso();
  const dispatched = shipmentStore.updateShipment(shipment.id, {
    status: 'dispatched',
    courier: normalized.courier || shipment.courier || '',
    trackingNumber: normalized.trackingNumber || '',
    trackingUrl: normalized.trackingUrl,
    estimatedDelivery: normalized.estimatedDelivery,
    dispatchNote: normalized.dispatchNote,
    fulfillmentMethod: normalized.method,
    dispatchedAt: now,
  });
  shipmentStore.appendTrackingEvent(shipment.id, {
    timestamp: now,
    status: 'dispatched',
    location: shipment.region || 'Dhaka',
    description:
      normalized.method === 'courier'
        ? `Dispatched via ${normalized.courier}${normalized.trackingNumber ? ` — ${normalized.trackingNumber}` : ''}`
        : normalized.method === 'seller_delivery'
          ? `Dispatched — seller delivery${normalized.courier ? ` (${normalized.courier})` : ''}`
          : 'Ready for customer pickup',
  });

  // ── 2) Commerce lifecycle packed → shipped (single atomic commit) ──
  let advanced: { order: CommerceOrder; shipment?: CommerceShipment; reused: boolean };
  try {
    advanced = await transitionOrder({
      orderId: order.id,
      toStatus: 'shipped',
      actor: input.actor,
      fulfilmentMethod:
        normalized.method === 'courier'
          ? 'third_party_courier'
          : normalized.method === 'pickup'
            ? 'pickup'
            : 'self_delivery',
      courierProvider: normalized.courier || undefined,
      trackingNumber: normalized.trackingNumber || undefined,
    });
  } catch (err) {
    // roll back the OpsShipment — never leave a half-dispatched order
    shipmentStore.updateShipment(shipment.id, {
      status: snapshot.status,
      courier: snapshot.courier,
      trackingNumber: snapshot.trackingNumber,
      trackingUrl: snapshot.trackingUrl,
      estimatedDelivery: snapshot.estimatedDelivery,
      dispatchNote: snapshot.dispatchNote,
      fulfillmentMethod: snapshot.fulfillmentMethod,
      dispatchedAt: snapshot.dispatchedAt,
      trackingEvents: snapshot.trackingEvents,
    });
    throw err;
  }

  // ── 3) one System-B structured dispatch card (dedup by platformMessageId) ──
  await postDispatchSystemCard(order, dispatched || shipment, normalized).catch((e) =>
    console.warn('[Dispatch] System-B card failed (non-fatal):', e),
  );

  // ── 4) one buyer notification (no pre-existing OrderShipped notifier) ──
  await notifyBuyerDispatched(order);

  // ── 5) domain event ───────────────────────────────────────────────
  emitOrder('OrderDispatched', order.id, input.actor.userId, {
    orderId: order.id,
    orderNumber: opsOrderId,
    fulfillmentMethod: normalized.method,
    courier: normalized.courier || undefined,
    trackingNumber: normalized.trackingNumber || undefined,
    dispatchedAt: now,
  });

  return {
    order: advanced.order,
    shipment: shipmentStore.getShipmentByOrderId(opsOrderId) || dispatched || shipment,
    reused: false,
  };
}

/**
 * Advance a Commerce order shipped → delivered as a SIDE EFFECT of canonical
 * delivery settlement (courier webhook "delivered", or the final per-item
 * "Mark Delivered" on an operations order). This is the ONLY backward-compatible
 * way the two non-lifecycle-CTA delivery triggers reach the Commerce FSM.
 *
 * Idempotent: a no-op unless the order is EXACTLY `shipped` (so replays, and
 * the lifecycle-CTA path where transitionOrder already set `delivered`, do
 * nothing here). Emits the same ShipmentDelivered + OrderDelivered events the
 * normal transition emits, and mirrors the Operations order status. No new FSM
 * edge — `canTransitionOrder('shipped','delivered')` is already legal.
 */
export async function markCommerceOrderDeliveredExternal(
  orderNumber: string,
  actorId: string,
): Promise<{ changed: boolean; status: CommerceOrderStatus | null }> {
  const all = await commerceStore.listOrders();
  const order = all.find((o) => o.orderNumber === orderNumber) || null;
  if (!order) return { changed: false, status: null };
  if (order.status !== 'shipped') return { changed: false, status: order.status };

  const existing = await commerceStore.getShipmentByOrderId(order.id);
  const now = nowIso();
  const next: CommerceOrder = { ...order, status: 'delivered', updatedAt: now };
  const shipment: CommerceShipment | undefined =
    existing && existing.status !== 'delivered'
      ? {
          ...existing,
          status: 'delivered' as CommerceShipmentStatus,
          deliveredAt: now,
          shippedAt: existing.shippedAt || now,
          updatedAt: now,
        }
      : undefined;

  await commerceStore.commitOrderMutation({ order: next, shipment });
  mirrorOpsStatus(next);
  emitOrder('ShipmentDelivered', next.id, actorId, {
    orderId: next.id,
    shipmentId: existing?.id,
  });
  emitOrder('OrderDelivered', next.id, actorId, {
    orderId: next.id,
    from: 'shipped',
    to: 'delivered',
    sellerId: next.sellerId,
    brandId: next.brandId,
  });
  return { changed: true, status: 'delivered' };
}

// ════════════════════════════════════════════════════════════════════════
// Administrative Status Correction (Sprint 14) — controlled, NOT a setter
// ════════════════════════════════════════════════════════════════════════
//
// APPROVED corrective paths ONLY:
//   confirmed              → pending
//   packed / processing    → confirmed | pending   (reverses inventory consumption)
//   shipped / dispatched   → packed                (ONLY before proven physical movement)
// Every correction: staff-authorised, reason required, previous lifecycle event
// preserved, a new OrderStatusCorrected event records actor+role+reason+from/to,
// all side-effects performed consistently — or 409 with zero mutation.

export type AdminCorrectionTarget = 'pending' | 'confirmed' | 'packed';

export type AdminCorrectionInput = {
  orderId: string; // commerce order id
  toStatus: AdminCorrectionTarget;
  actor: { userId: string; role?: string };
  reason: string;
};

function isCorrectionActor(role?: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** Inverse of consumeOrderInventory: put consumed stock back and re-hold the reservation. */
async function reverseConsumeToReserved(order: CommerceOrder): Promise<CommerceOrder> {
  if (!order.inventoryConsumed || !orderHasProductLines(order.items)) {
    return { ...order, inventoryConsumed: false, inventoryReserved: true };
  }
  for (const item of order.items.filter((i) => i.listingType === 'product')) {
    const key = inventoryRecordId(item.listingId, item.variantId);
    await withInventoryLock(key, async () => {
      const record = await getInventoryRecord(item.listingId, item.variantId);
      if (!record) return;
      await adjustInventory({
        productId: item.listingId,
        variantId: item.variantId,
        quantity: record.quantity + item.quantity,
        // symmetric with consume: reserved was only decremented if the order held a reservation
        reservedQuantity: order.inventoryReserved
          ? record.reservedQuantity + item.quantity
          : record.reservedQuantity,
      });
      await syncProductStockFromInventory(item.listingId);
    });
  }
  return { ...order, inventoryConsumed: false, inventoryReserved: true };
}

/** Canonical evidence the parcel physically progressed → correction back is refused. */
function shipmentHasMoved(shipment: OpsShipment | null): boolean {
  if (!shipment) return false;
  if (SHIPMENT_MOVEMENT_STATUSES.has(shipment.status)) return true;
  return (shipment.trackingEvents || []).some((e) => SHIPMENT_MOVEMENT_STATUSES.has(e.status));
}

export async function adminCorrectOrderStatus(
  input: AdminCorrectionInput,
): Promise<{ order: CommerceOrder; from: CommerceOrderStatus; to: CommerceOrderStatus }> {
  if (!isCorrectionActor(input.actor.role)) {
    throw new CommerceError('Administrative status correction is staff-only', 403);
  }
  const reason = String(input.reason || '').trim();
  if (!reason) throw new CommerceError('A correction reason is required', 400);

  const order = await commerceStore.getOrder(input.orderId);
  if (!order) throw new CommerceError('Order not found', 404);

  const from = order.status;
  const to = input.toStatus;
  const opsOrderId = order.orderNumber;
  const opsShipment = shipmentStore.getShipmentByOrderId(opsOrderId);

  // ── allow-list + per-transition consistency ────────────────────────
  const ALLOWED: Record<string, AdminCorrectionTarget[]> = {
    confirmed: ['pending'],
    packed: ['confirmed', 'pending'],
    shipped: ['packed'],
  };
  if (!(ALLOWED[from] || []).includes(to)) {
    throw new CommerceError(
      `No administrative correction from "${from}" to "${to}" (allowed: ${(ALLOWED[from] || []).join(', ') || 'none'})`,
      409,
    );
  }

  const anyDelivered = ((operationsStore.getOrder(opsOrderId)?.subOrders || []) as Array<{
    items?: Array<{ deliveredAt?: string }>;
  }>).some((s) => (s.items || []).some((it) => Boolean(it.deliveredAt)));
  if (anyDelivered) {
    throw new CommerceError('An item on this order is already delivered — cannot correct backward', 409);
  }

  let next: CommerceOrder = { ...order, status: to, updatedAt: nowIso() };
  let shipmentUpdate: CommerceShipment | undefined;

  if (from === 'confirmed' && to === 'pending') {
    // confirmed still only HOLDS a reservation — no consumption to reverse.
    if (order.inventoryConsumed) {
      throw new CommerceError('Order has already consumed stock — cannot return to pending', 409);
    }
  } else if (from === 'packed' && (to === 'confirmed' || to === 'pending')) {
    // reverse the Packed inventory consumption, void the Commerce shipment created at Packed
    next = await reverseConsumeToReserved(next);
    const cShip = await commerceStore.getShipmentByOrderId(order.id);
    if (cShip && cShip.status !== 'delivered') {
      shipmentUpdate = { ...cShip, status: 'cancelled', updatedAt: nowIso() };
    }
    // OpsShipment at Packed has NOT been dispatched (awaiting_dispatch) — nothing to undo there.
  } else if (from === 'shipped' && to === 'packed') {
    if (shipmentHasMoved(opsShipment)) {
      throw new CommerceError(
        'Canonical courier movement is recorded for this shipment — dispatch cannot be retracted (use a return / support workflow)',
        409,
      );
    }
    // retract the dispatch: OpsShipment back to awaiting_dispatch, clear courier/tracking,
    // append a history-preserving checkpoint (previous events are NOT deleted).
    if (opsShipment) {
      shipmentStore.updateShipment(opsShipment.id, {
        status: 'awaiting_dispatch',
        courier: '',
        trackingNumber: '',
        trackingUrl: undefined,
        estimatedDelivery: undefined,
        dispatchNote: undefined,
        fulfillmentMethod: undefined,
        dispatchedAt: undefined,
      });
      shipmentStore.appendTrackingEvent(opsShipment.id, {
        timestamp: nowIso(),
        status: 'awaiting_dispatch',
        location: opsShipment.region || 'Dhaka',
        description: `Dispatch retracted by platform staff — ${reason}`,
      });
    }
    const cShip = await commerceStore.getShipmentByOrderId(order.id);
    if (cShip) shipmentUpdate = { ...cShip, status: 'packed', updatedAt: nowIso() };
  }

  await commerceStore.commitOrderMutation({ order: next, shipment: shipmentUpdate });
  mirrorOpsStatus(next);

  // history preserved — the original lifecycle event stays; this ADDS a record.
  emitOrder('OrderStatusCorrected', next.id, input.actor.userId, {
    orderId: next.id,
    orderNumber: opsOrderId,
    fromState: from,
    toState: to,
    actorId: input.actor.userId,
    actorRole: input.actor.role || 'staff',
    reason,
    correctedAt: nowIso(),
  });

  return { order: next, from, to };
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
