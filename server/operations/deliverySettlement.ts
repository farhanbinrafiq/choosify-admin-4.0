/**
 * Canonical delivery settlement (Sprint 14 — delivery synchronisation fix).
 *
 * Before this module the three "delivered" triggers wrote DISJOINT canonical
 * state:
 *   1. lifecycle "Mark delivered" CTA  → Commerce order only
 *   2. per-item "Mark Delivered"       → Operations item.deliveredAt (+ shipment
 *                                         once every item was done)
 *   3. courier webhook "delivered"     → OpsShipment.status only
 * …so a courier-delivered order could show Shipment=Delivered while the Commerce
 * order still read "shipped" (Hub-derived "Dispatched").
 *
 * `settleOrderItemDelivered` and `settleOrderDelivered` are the ONE convergence
 * point. All three triggers now call in here. Everything is idempotent:
 *   • a per-item call only settles that item; the whole order is settled only
 *     once EVERY applicable item has `deliveredAt` (partial delivery never
 *     prematurely settles the order),
 *   • re-invoking after full settlement is a no-op (no duplicate buyer message,
 *     no duplicate inventory consumption, no duplicate events).
 *
 * Inventory: stock is consumed exactly once, by whichever engine reserved it.
 *   • Commerce checkout orders reserve at checkout and CONSUME AT PACKED
 *     (`order.inventoryConsumed === true`) — settlement must NOT re-consume.
 *   • Operations-only orders (manual offer / booking) have no packed step;
 *     settlement performs the reserved→consumed conversion, guarded per item by
 *     `item.inventoryConsumed`.
 *
 * No new FSM. No new endpoint. No migration (additive JSON fields only).
 */
import { consumeInventoryQuantity } from '../catalog/inventoryStore';
import { COMMUNICATION_TYPES, DELIVERY_CHANNELS } from '../communication/communicationTypes';
import { notifyUser } from '../communication/systemNotify';
import { operationsStore } from './operationsStore';
import { scheduleOperationsPersist } from './operationsPersistence';
import { shipmentStore } from './shipmentStore';
import type { OpsStorefrontOrder } from './types';

const nowIso = () => new Date().toISOString();

export type DeliverySettlementSource =
  | 'per_item_manual' // seller / staff per-item "Mark Delivered"
  | 'lifecycle_cta' // Commerce transitionOrder → delivered
  | 'courier_webhook' // logistics webhook "delivered"
  | 'admin';

export interface SettleOptions {
  actorId?: string;
}

export interface SettleResult {
  ok: boolean;
  /** true when the call found nothing left to do (pure replay). */
  reused: boolean;
  /** true when EVERY applicable item on the order now has deliveredAt. */
  allDelivered: boolean;
  reason?: 'no_ops_order' | 'item_not_found';
}

type LooseItem = Record<string, unknown>;
type LooseSub = Record<string, unknown> & { items?: LooseItem[]; trackingStatus?: string };

function subOrdersOf(order: OpsStorefrontOrder): LooseSub[] {
  return ((order.subOrders || []) as unknown as LooseSub[]) ?? [];
}

function everyItemDelivered(subs: LooseSub[]): boolean {
  const items = subs.flatMap((s) => s.items || []);
  return items.length > 0 && items.every((it) => Boolean(it.deliveredAt));
}

async function loadCommerceOrder(orderNumber: string): Promise<{
  id?: string;
  status?: string;
  inventoryConsumed?: boolean;
} | null> {
  try {
    const { commerceStore } = await import('../commerce/commerceStore');
    const all = await commerceStore.listOrders();
    return (all.find((o) => o.orderNumber === orderNumber) as never) || null;
  } catch {
    return null;
  }
}

function withDeliveryStamp(it: LooseItem, deliveredAt: string): LooseItem {
  const productId = String(it.productId || '').trim();
  const consumedFlag = productId ? { inventoryConsumed: true } : {};
  const warrantyMonths = Number(it.warrantyMonthsAtPurchase) || 0;
  if (!warrantyMonths) return { ...it, ...consumedFlag, deliveredAt };
  const warrantyExpiresAt = new Date(
    Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    ...it,
    ...consumedFlag,
    deliveredAt,
    warrantyStartsAt: deliveredAt,
    warrantyExpiresAt,
  };
}

/** Consume reserved→consumed for one item — ONLY for Operations-only orders. */
async function consumeItemIfOperationsOwned(
  it: LooseItem,
  commerceConsumed: boolean,
): Promise<void> {
  const productId = String(it.productId || '').trim();
  if (!productId || it.inventoryConsumed || commerceConsumed) return;
  const variantId = typeof it.variantId === 'string' ? it.variantId : undefined;
  const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
  await consumeInventoryQuantity({ productId, variantId, quantity }).catch((err) => {
    console.error('[DeliverySettlement] inventory consume failed:', err);
  });
}

async function postDeliveredSystemCard(
  order: OpsStorefrontOrder,
  isPickup: boolean,
): Promise<void> {
  try {
    const { submitPlatformMessage } = await import('./platformMessagingBridge');
    const body = isPickup
      ? '✅ Your order has been collected\nThank you for shopping with Choosify.'
      : '📦 Your order has been delivered\nThank you for shopping with Choosify.';
    await submitPlatformMessage({
      buyerId: order.buyerId,
      userName: 'Choosify Platform',
      body,
      orderId: order.orderId,
      senderId: 'system',
      direction: 'outbound',
      // dedup — one card per order regardless of how many triggers fire
      platformMessageId: `sys_delivered_${order.orderId}`,
    });
  } catch (err) {
    console.warn('[DeliverySettlement] System-B delivered card failed (non-fatal):', err);
  }
}

async function notifyBuyerDelivered(
  order: OpsStorefrontOrder,
  isPickup: boolean,
): Promise<void> {
  if (!order.buyerId) return;
  try {
    await notifyUser(order.buyerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      priority: 'normal',
      title: isPickup ? 'Order collected' : 'Order delivered',
      summary: isPickup
        ? `Order ${order.orderId} has been collected.`
        : `Order ${order.orderId} has been delivered.`,
      actionUrl: '/profile/orders',
      channels: [DELIVERY_CHANNELS.IN_APP],
      metadata: { orderId: order.orderId, event: 'delivered' },
    });
  } catch (err) {
    console.warn('[DeliverySettlement] buyer delivered notification failed (non-fatal):', err);
  }
}

/**
 * Settle ONE order item as delivered (per-item "Mark Delivered"). Sets that
 * item's `deliveredAt` (+ warranty window), converts its reservation to consumed
 * stock for Operations-only orders, and marks the sub-order delivered once all
 * of its items are. If this was the LAST outstanding item on the whole order it
 * escalates to `settleOrderDelivered` so the shipment / Commerce order / buyer
 * notification all converge. Idempotent per item.
 */
export async function settleOrderItemDelivered(
  opsOrderId: string,
  itemId: string,
  source: DeliverySettlementSource,
  opts: SettleOptions = {},
): Promise<SettleResult> {
  const order = operationsStore.getOrder(opsOrderId);
  if (!order) return { ok: false, reused: false, allDelivered: false, reason: 'no_ops_order' };

  const subs = subOrdersOf(order);
  const target = subs
    .flatMap((s) => s.items || [])
    .find((it) => it.itemId === itemId);
  if (!target) {
    return { ok: false, reused: false, allDelivered: false, reason: 'item_not_found' };
  }

  const alreadyDelivered = Boolean(target.deliveredAt);
  const commerce = await loadCommerceOrder(opsOrderId);
  const commerceConsumed = Boolean(commerce?.inventoryConsumed);
  const deliveredAt = nowIso();

  if (!alreadyDelivered) {
    await consumeItemIfOperationsOwned(target, commerceConsumed);
    const nextSubs = subs.map((sub) => {
      const items = sub.items || [];
      if (!items.some((it) => it.itemId === itemId)) return sub;
      const newItems = items.map((it) =>
        it.itemId === itemId ? withDeliveryStamp(it, deliveredAt) : it,
      );
      // preserve the long-standing behaviour: this sub-order's trackingStatus
      // flips to 'delivered' as soon as an item in it is delivered (warranty
      // eligibility keys off it). The ORDER-level settlement (shipment flip /
      // Commerce advance / buyer card) still waits for every item.
      return { ...sub, trackingStatus: 'delivered', items: newItems };
    });
    operationsStore.updateOrder(opsOrderId, { subOrders: nextSubs as never });
    scheduleOperationsPersist();

    const allDelivered = everyItemDelivered(nextSubs as LooseSub[]);
    if (allDelivered) {
      await settleOrderDelivered(opsOrderId, source, opts);
      return { ok: true, reused: false, allDelivered: true };
    }
    // partial delivery — a single-item progress notification (no order-level card)
    if (order.buyerId) {
      try {
        await notifyUser(order.buyerId, {
          type: COMMUNICATION_TYPES.ORDER_UPDATE,
          category: 'buyer',
          title: 'Item delivered',
          summary: `${String(target.productTitle || 'Your item')} from order ${order.orderId} was delivered.`,
          actionUrl: '/profile/orders',
          metadata: { orderId: order.orderId, itemId },
        });
      } catch {
        /* best-effort */
      }
    }
    return { ok: true, reused: false, allDelivered: false };
  }

  // item was already delivered — still make sure a fully-delivered order is settled
  const allDelivered = everyItemDelivered(subs);
  if (allDelivered) {
    await settleOrderDelivered(opsOrderId, source, opts);
  }
  return { ok: true, reused: true, allDelivered };
}

/**
 * Settle the WHOLE order as delivered — invoked when every applicable item has
 * been delivered, or directly by the courier webhook / lifecycle CTA. Fills any
 * missing `item.deliveredAt`, flips the OpsShipment to `delivered` (with a
 * checkpoint), advances the Commerce order `shipped → delivered` (idempotent,
 * via `markCommerceOrderDeliveredExternal` — never re-enters `transitionOrder`),
 * and posts EXACTLY ONE buyer-facing "delivered" / "collected" event. Safe to
 * call repeatedly.
 */
export async function settleOrderDelivered(
  opsOrderId: string,
  source: DeliverySettlementSource,
  opts: SettleOptions = {},
): Promise<SettleResult> {
  const order = operationsStore.getOrder(opsOrderId);
  if (!order) return { ok: false, reused: false, allDelivered: false, reason: 'no_ops_order' };

  const actorId = opts.actorId || 'system';
  const commerce = await loadCommerceOrder(opsOrderId);
  const commerceConsumed = Boolean(commerce?.inventoryConsumed);
  const deliveredAt = nowIso();
  const subs = subOrdersOf(order);

  // 1) ensure every item carries deliveredAt (idempotent) ────────────────
  const pendingConsume: LooseItem[] = [];
  let itemsChanged = false;
  const nextSubs = subs.map((sub) => {
    const items = sub.items || [];
    const newItems = items.map((it) => {
      if (it.deliveredAt) return it;
      itemsChanged = true;
      pendingConsume.push(it);
      return withDeliveryStamp(it, deliveredAt);
    });
    const allSubDelivered = newItems.length > 0 && newItems.every((it) => Boolean(it.deliveredAt));
    return { ...sub, ...(allSubDelivered ? { trackingStatus: 'delivered' } : {}), items: newItems };
  });
  for (const it of pendingConsume) {
    await consumeItemIfOperationsOwned(it, commerceConsumed);
  }
  if (itemsChanged) {
    operationsStore.updateOrder(opsOrderId, { subOrders: nextSubs as never });
    scheduleOperationsPersist();
  }

  // 2) OpsShipment → delivered (+ checkpoint) — idempotent ───────────────
  const shipment = shipmentStore.getShipmentByOrderId(opsOrderId);
  const isPickup = shipment?.fulfillmentMethod === 'pickup';
  let shipmentChanged = false;
  if (shipment && shipment.status !== 'delivered') {
    shipmentStore.updateShipment(shipment.id, { status: 'delivered' });
    shipmentStore.appendTrackingEvent(shipment.id, {
      timestamp: deliveredAt,
      status: 'delivered',
      location: shipment.region || 'Dhaka',
      description: isPickup
        ? `Order ${opsOrderId} collected by customer`
        : `Order ${opsOrderId} delivered — settlement (${source})`,
    });
    shipmentChanged = true;
  }

  // 3) Commerce order shipped → delivered — idempotent, no FSM re-entry ──
  let commerceChanged = false;
  if (commerce?.status === 'shipped') {
    try {
      const { markCommerceOrderDeliveredExternal } = await import('../commerce/orderService');
      const r = await markCommerceOrderDeliveredExternal(opsOrderId, actorId);
      commerceChanged = r.changed;
    } catch (err) {
      console.warn('[DeliverySettlement] Commerce delivered advance failed (non-fatal):', err);
    }
  }

  // 4) ONE buyer-facing delivered event — only when this call actually
  //    transitioned something (pure replays post nothing) ───────────────
  if (itemsChanged || shipmentChanged || commerceChanged) {
    await postDeliveredSystemCard(order, isPickup);
    await notifyBuyerDelivered(order, isPickup);
  }

  return {
    ok: true,
    reused: !(itemsChanged || shipmentChanged || commerceChanged),
    allDelivered: true,
  };
}
