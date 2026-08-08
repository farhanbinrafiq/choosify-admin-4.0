/**
 * Commerce API — IS-004 §59.
 * Cart / Checkout / Orders / Manual Orders.
 * Payments, returns, refunds, full lifecycle: out of scope (later sprints).
 */

import { Router } from 'express';
import { authenticateRequest } from './middleware/auth';
import {
  addCartItem,
  clearCart,
  CommerceError,
  computeCartTotals,
  getOrCreateCart,
  refreshCartPrices,
  removeCartItem,
  updateCartItemQuantity,
} from './commerce/cartService';
import {
  associateManualOrder,
  createManualOrder,
  executeCheckout,
  getCheckoutForConsumer,
  getOrderForActor,
  listOrdersForActor,
} from './commerce/checkoutService';
import { commerceStore, getCommercePersistenceMode } from './commerce/commerceStore';
import type { CommerceListingType, CommerceOrderSource } from './commerce/types';

export const commerceRouter = Router();

const requireAuth = [authenticateRequest];

function actorId(req: { userId?: string; user?: { uid?: string } }): string {
  return req.userId || req.user?.uid || '';
}

function actorRole(req: { userRole?: string; user?: { role?: string } }): string | undefined {
  return req.userRole || req.user?.role;
}

function handleCommerceError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
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
    const orders = await listOrdersForActor({
      userId: actorId(req),
      role: actorRole(req),
      as,
    });
    res.json({ success: true, data: orders });
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
    res.json({ success: true, data: order });
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
