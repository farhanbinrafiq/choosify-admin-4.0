/**
 * Commerce API — IS-004 §59.
 * Cart / Checkout / Orders / Manual Orders / Order lifecycle (Sprint 6).
 * Payments, Escrow, Returns, Refunds: Sprint 7–8 surfaces under commerce/payments + commerce/escrow.
 */

import { Router } from 'express';
import { authenticateRequest } from './middleware/auth';
import { requireMarketplaceAccess } from './entitlements/marketplaceAccessMiddleware';
import {
  addCartItem,
  clearCart,
  CommerceError,
  computeCartTotals,
  getOrCreateCart,
  refreshCartPrices,
  removeCartItem,
  updateCartItemAddons,
  updateCartItemQuantity,
} from './commerce/cartService';
import {
  associateManualOrder,
  createManualOrder,
  executeCheckout,
  getCheckoutForConsumer,
  getOrderByNumberForActor,
  getOrderForActor,
  listOrdersForActor,
} from './commerce/checkoutService';
import {
  adminCorrectOrderStatus,
  cancelOrder,
  dispatchOrder,
  getShipmentForActor,
  listOrdersGroupedByCheckout,
  returnOrderToPending,
  transitionOrder,
} from './commerce/orderService';
import { commerceStore, getCommercePersistenceMode } from './commerce/commerceStore';
import type { CommerceListingType, CommerceOrderSource } from './commerce/types';
import { getRecentPublishedEvents } from './events/eventBus';

export const commerceRouter = Router();

const requireAuth = [authenticateRequest, requireMarketplaceAccess];

function actorId(req: { userId?: string; user?: { uid?: string } }): string {
  return req.userId || req.user?.uid || '';
}

function actorRole(req: { userRole?: string; user?: { role?: string } }): string | undefined {
  return req.userRole || req.user?.role;
}

function handleCommerceError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  console.error('[Commerce]', error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Commerce error',
  });
}


/** GET /api/v1/commerce/persistence-mode */
commerceRouter.get('/commerce/persistence-mode', (_req, res) => {
  res.json({
    success: true,
    data: {
      mode: getCommercePersistenceMode(),
      firestoreRequested:
        process.env.COMMERCE_USE_FIRESTORE === 'true' ||
        (process.env.COMMERCE_USE_FIRESTORE !== 'false' &&
          process.env.CATALOG_USE_FIRESTORE === 'true'),
    },
  });
});

/** GET /api/v1/cart — current consumer cart (creates empty if needed). */
commerceRouter.get('/cart', ...requireAuth, async (req, res) => {
  try {
    const consumerId = actorId(req);
    let cart = await getOrCreateCart(consumerId);
    cart = await refreshCartPrices(cart);
    res.json({ success: true, data: cart, totals: computeCartTotals(cart) });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/cart/items */
commerceRouter.post('/cart/items', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const listingType = String(body.listingType || body.type || 'product') as CommerceListingType;
    const listingId = String(body.listingId || body.productId || body.serviceId || '');
    if (!listingId) {
      res.status(400).json({ success: false, error: 'listingId is required' });
      return;
    }
    const result = await addCartItem(actorId(req), {
      listingType: listingType === 'service' ? 'service' : 'product',
      listingId,
      quantity: body.quantity,
      variantId: body.variantId ? String(body.variantId) : undefined,
      unitPrice: body.unitPrice, // ignored by service
      sellerId: body.sellerId, // ignored by service
      requestedAt: body.requestedAt ? String(body.requestedAt) : undefined,
      serviceArea: body.serviceArea ? String(body.serviceArea) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      selectedOptions: body.selectedOptions,
      addons: Array.isArray(body.addons) ? body.addons : undefined,
      guideOfferRef:
        body.guideOfferRef && typeof body.guideOfferRef === 'object'
          ? {
              guideId: String(body.guideOfferRef.guideId || ''),
              productId: String(body.guideOfferRef.productId || listingId),
            }
          : undefined,
      expectedUnitPrice:
        typeof body.expectedUnitPrice === 'number' ? body.expectedUnitPrice : undefined,
    });
    res.status(201).json({ success: true, data: result.cart, totals: result.totals });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** PATCH /api/v1/cart/items/:id */
commerceRouter.patch('/cart/items/:id', ...requireAuth, async (req, res) => {
  try {
    const quantity = Number(req.body?.quantity);
    if (!Number.isFinite(quantity)) {
      res.status(400).json({ success: false, error: 'quantity is required' });
      return;
    }
    const result = await updateCartItemQuantity(actorId(req), req.params.id, quantity);
    res.json({ success: true, data: result.cart, totals: result.totals });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** PATCH /api/v1/cart/items/:id/addons — replace the add-on selection on a line.
 *  Body: { addons: Array<{ id, quantity? }> }. Empty array clears add-ons. */
commerceRouter.patch('/cart/items/:id/addons', ...requireAuth, async (req, res) => {
  try {
    const addons = Array.isArray(req.body?.addons) ? req.body.addons : [];
    const result = await updateCartItemAddons(actorId(req), req.params.id, addons);
    res.json({ success: true, data: result.cart, totals: result.totals });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** DELETE /api/v1/cart/items/:id */
commerceRouter.delete('/cart/items/:id', ...requireAuth, async (req, res) => {
  try {
    const result = await removeCartItem(actorId(req), req.params.id);
    res.json({ success: true, data: result.cart, totals: result.totals });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/cart/clear — clear cart (documented convenience). */
commerceRouter.post('/cart/clear', ...requireAuth, async (req, res) => {
  try {
    const cart = await clearCart(actorId(req));
    res.json({ success: true, data: cart, totals: computeCartTotals(cart) });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/checkout — idempotent via Idempotency-Key header or body.idempotencyKey */
commerceRouter.post('/checkout', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const headerKey =
      typeof req.headers['idempotency-key'] === 'string'
        ? req.headers['idempotency-key']
        : undefined;
    const result = await executeCheckout({
      consumerId: actorId(req),
      idempotencyKey: headerKey || (body.idempotencyKey ? String(body.idempotencyKey) : undefined),
      shipping: body.shipping,
    });
    res.status(result.reused ? 200 : 201).json({
      success: true,
      data: {
        checkout: result.checkout,
        orders: result.orders,
        bookingRequests: result.bookingRequests,
        reused: result.reused,
      },
    });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** GET /api/v1/checkout/:id */
commerceRouter.get('/checkout/:id', ...requireAuth, async (req, res) => {
  try {
    const checkout = await getCheckoutForConsumer(req.params.id, actorId(req), actorRole(req));
    const orders = (
      await Promise.all(checkout.orderIds.map((id) => commerceStore.getOrder(id)))
    ).filter(Boolean);
    res.json({ success: true, data: { checkout, orders } });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** GET /api/v1/orders */
commerceRouter.get('/orders', ...requireAuth, async (req, res) => {
  try {
    const as =
      req.query.as === 'seller' ? 'seller' : req.query.as === 'consumer' ? 'consumer' : undefined;
    const brandId = req.query.brandId ? String(req.query.brandId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const byCheckout = req.query.byCheckout === '1' || req.query.byCheckout === 'true';
    if (byCheckout) {
      const grouped = await listOrdersGroupedByCheckout({
        userId: actorId(req),
        role: actorRole(req),
        as,
        brandId,
        status,
      });
      res.json({ success: true, data: grouped.orders, byCheckout: grouped.byCheckout });
      return;
    }
    const orders = await listOrdersForActor({
      userId: actorId(req),
      role: actorRole(req),
      as,
      brandId,
      status,
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/**
 * GET /api/v1/orders/by-number/:orderNumber — resolve the canonical Commerce
 * order (rich lifecycle FSM) behind an Operations `orderId`. Read-only,
 * actor-scoped. 404 when the Operations order has no Commerce counterpart
 * (pure booking / legacy) — the Order Hub then hides its lifecycle panel.
 */
commerceRouter.get('/orders/by-number/:orderNumber', ...requireAuth, async (req, res) => {
  try {
    const order = await getOrderByNumberForActor(req.params.orderNumber, {
      userId: actorId(req),
      role: actorRole(req),
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'No commerce order for this number' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/orders/:id/transition — Confirm/Pack/Ship/Deliver/Complete */
commerceRouter.post('/orders/:id/transition', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await transitionOrder({
      orderId: req.params.id,
      toStatus: String(body.status || body.toStatus || ''),
      actor: {
        userId: actorId(req),
        role: actorRole(req),
        brandId: body.brandId ? String(body.brandId) : undefined,
      },
      fulfilmentMethod: body.fulfilmentMethod,
      courierProvider: body.courierProvider ? String(body.courierProvider) : undefined,
      trackingNumber: body.trackingNumber ? String(body.trackingNumber) : undefined,
    });
    res.status(result.reused ? 200 : 200).json({
      success: true,
      data: { order: result.order, shipment: result.shipment, reused: result.reused },
    });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/**
 * POST /api/v1/orders/:id/dispatch — Processing/Packed → Dispatched, gated by
 * a Dispatch Details payload. Writes the canonical OpsShipment FIRST, then
 * advances the lifecycle; on failure nothing advances. Idempotent (a replay
 * returns the current state with no side effects). DISPATCHED ≠ IN TRANSIT.
 * Body: { fulfillmentMethod, courier?, trackingNumber?, trackingUrl?,
 *         estimatedDelivery?, dispatchNote? }
 */
commerceRouter.post('/orders/:id/dispatch', ...requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const result = await dispatchOrder({
      orderId: req.params.id,
      actor: { userId: actorId(req), role: actorRole(req), brandId: b.brandId ? String(b.brandId) : undefined },
      fulfillmentMethod: b.fulfillmentMethod,
      courier: b.courier ? String(b.courier) : undefined,
      trackingNumber: b.trackingNumber ? String(b.trackingNumber) : undefined,
      trackingUrl: b.trackingUrl ? String(b.trackingUrl) : undefined,
      estimatedDelivery: b.estimatedDelivery ? String(b.estimatedDelivery) : undefined,
      dispatchNote: b.dispatchNote ? String(b.dispatchNote) : undefined,
      idempotencyKey:
        typeof req.headers['idempotency-key'] === 'string'
          ? (req.headers['idempotency-key'] as string)
          : b.idempotencyKey
            ? String(b.idempotencyKey)
            : undefined,
    });
    res.json({ success: true, data: { order: result.order, shipment: result.shipment, reused: result.reused } });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/**
 * POST /api/v1/orders/:id/admin-correct — Administrative Status Correction.
 * Staff-only. Allowed ONLY: confirmed→pending, packed→confirmed|pending,
 * shipped→packed (before proven courier movement). Reason required. Preserves
 * history + emits OrderStatusCorrected. 409 + zero mutation when the
 * inventory/shipment side-effects cannot be made consistent.
 * Body: { toStatus: 'pending'|'confirmed'|'packed', reason: string }
 */
commerceRouter.post('/orders/:id/admin-correct', ...requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const result = await adminCorrectOrderStatus({
      orderId: req.params.id,
      toStatus: b.toStatus,
      reason: String(b.reason || ''),
      actor: { userId: actorId(req), role: actorRole(req) },
    });
    res.json({ success: true, data: { order: result.order, from: result.from, to: result.to } });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/**
 * POST /api/v1/orders/:id/return-to-pending — controlled "undo acceptance".
 * confirmed → pending ONLY, server-validated eligibility. NOT a generic setter.
 */
commerceRouter.post('/orders/:id/return-to-pending', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await returnOrderToPending({
      orderId: req.params.id,
      reason: body.reason ? String(body.reason) : undefined,
      actor: {
        userId: actorId(req),
        role: actorRole(req),
        brandId: body.brandId ? String(body.brandId) : undefined,
      },
    });
    res.json({ success: true, data: result.order });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/orders/:id/cancel */
commerceRouter.post('/orders/:id/cancel', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await cancelOrder({
      orderId: req.params.id,
      reason: String(body.reason || ''),
      actor: {
        userId: actorId(req),
        role: actorRole(req),
        brandId: body.brandId ? String(body.brandId) : undefined,
      },
    });
    res.json({ success: true, data: result.order, reused: result.reused });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** GET /api/v1/shipments/:id */
commerceRouter.get('/shipments/:id', ...requireAuth, async (req, res) => {
  try {
    const shipment = await getShipmentForActor(req.params.id, {
      userId: actorId(req),
      role: actorRole(req),
    });
    res.json({ success: true, data: shipment });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** GET /api/v1/orders/:id/shipment */
commerceRouter.get('/orders/:id/shipment', ...requireAuth, async (req, res) => {
  try {
    const order = await getOrderForActor(req.params.id, {
      userId: actorId(req),
      role: actorRole(req),
    });
    const shipment = order.shipmentId
      ? await commerceStore.getShipment(order.shipmentId)
      : await commerceStore.getShipmentByOrderId(order.id);
    if (!shipment) {
      res.status(404).json({ success: false, error: 'Shipment not found' });
      return;
    }
    res.json({ success: true, data: shipment });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** GET /api/v1/orders/:id — must be registered after /orders/manual */
commerceRouter.get('/orders/:id', ...requireAuth, async (req, res) => {
  try {
    if (req.params.id === 'manual') {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const order = await getOrderForActor(req.params.id, {
      userId: actorId(req),
      role: actorRole(req),
    });
    let financial: {
      escrows: unknown[];
      settlementIds: string[];
    } | null = null;
    try {
      const { escrowStore } = await import('./escrow/escrowStore');
      const escrows = await escrowStore.listEscrowsByOrder(order.id);
      financial = {
        escrows: escrows.map((e) => ({
          escrowId: e.escrowId,
          status: e.status,
          heldAmount: e.heldAmount,
          refundedAmount: e.refundedAmount,
          settledAmount: e.settledAmount,
          sellerNetAmount: e.sellerNetAmount,
          settlementId: e.settlementId,
        })),
        settlementIds: escrows.map((e) => e.settlementId).filter(Boolean) as string[],
      };
    } catch {
      financial = null;
    }
    res.json({ success: true, data: order, financial });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/orders/manual */
commerceRouter.post('/orders/manual', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const sellerId = String(body.sellerId || actorId(req));
    const brandId = String(body.brandId || '');
    const listingId = String(body.listingId || body.productId || body.serviceId || '');
    const listingType = (body.listingType === 'service' ? 'service' : 'product') as CommerceListingType;
    if (!brandId || !listingId) {
      res.status(400).json({ success: false, error: 'brandId and listingId are required' });
      return;
    }
    const allowedSources: CommerceOrderSource[] = [
      'manual',
      'external_whatsapp',
      'external_facebook',
      'external_instagram',
      'external_offline',
    ];
    const sourceRaw = String(body.source || 'manual') as CommerceOrderSource;
    const source = allowedSources.includes(sourceRaw) ? sourceRaw : 'manual';

    const result = await createManualOrder({
      actorId: actorId(req),
      actorRole: actorRole(req),
      sellerId,
      brandId,
      consumerId: body.consumerId ? String(body.consumerId) : undefined,
      listingType,
      listingId,
      quantity: Number(body.quantity) || 1,
      source,
      shipping: body.shipping,
      notes: body.notes ? String(body.notes) : undefined,
    });
    res.status(201).json({
      success: true,
      data: result.order,
      claimToken: result.claimToken,
    });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** POST /api/v1/orders/manual/:token/associate */
commerceRouter.post('/orders/manual/:token/associate', ...requireAuth, async (req, res) => {
  try {
    const order = await associateManualOrder({
      token: req.params.token,
      consumerId: actorId(req),
    });
    res.json({ success: true, data: order });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** Probe helper — flush commerce memory snapshot (dev only; no-op on Firestore). */
commerceRouter.post('/commerce/_flush', ...requireAuth, async (_req, res) => {
  try {
    await commerceStore.flushPersist();
    res.json({ success: true, mode: getCommercePersistenceMode() });
  } catch (error) {
    handleCommerceError(res, error);
  }
});

/** Probe helper — recent Commerce + Payments domain events (auth required). */
commerceRouter.get('/commerce/_recent-events', ...requireAuth, async (req, res) => {
  try {
    const commerce = getRecentPublishedEvents({ domain: 'Commerce', limit: 200 });
    const payments = getRecentPublishedEvents({ domain: 'Payments', limit: 200 });
    const events = [...commerce, ...payments];
    res.json({
      success: true,
      data: events.map((e) => ({
        eventName: e.eventName,
        aggregateId: e.aggregateId,
        actor: e.actor,
        domain: e.domain,
        timestamp: e.timestamp,
      })),
    });
  } catch (error) {
    handleCommerceError(res, error);
  }
});
