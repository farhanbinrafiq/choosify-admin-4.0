/**
 * Checkout + Split Order Engine — IS-004 §8–§12, §9 (split by Brand).
 * Inventory reservation at checkout (reservedQuantity); payment capture deferred to Sprint 10.
 */

import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { brandIsMarketplaceVisible } from '../catalog/sellerWorkspace';
import {
  isProductPubliclyEligible,
  normalizeProductLifecycle,
} from '../catalog/productLifecycle';
import {
  getInventoryRecord,
  listInventoryForProduct,
  reserveInventoryQuantity,
  releaseInventoryQuantity,
} from '../catalog/inventoryStore';
import { getService } from '../catalog/serviceStore';
import { resolveActiveGuideOffer } from '../catalog/guideOfferService';
import { operationsStore } from '../operations/operationsStore';
import { shipmentStore } from '../operations/shipmentStore';
import { publishEvent } from '../events/eventBus';
import { commerceStore } from './commerceStore';
import {
  CommerceError,
  computeCartTotals,
  getOrCreateCart,
  refreshCartPrices,
  resolveAddonsForProduct,
  resolveVariantPricing,
  sumAddonLines,
  variantIsActive,
} from './cartService';
import { listOrdersGroupedByCheckout } from './orderService';
import type {
  CommerceBookingRequest,
  CommerceCart,
  CommerceCartItem,
  CommerceCheckout,
  CommerceOrder,
  CommerceOrderItemSnapshot,
  CommerceOrderSource,
} from './types';

export { listOrdersGroupedByCheckout };

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function orderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function revalidateCartItem(item: CommerceCartItem): Promise<void> {
  if (item.listingType === 'product') {
    const product = await catalogStore.getProduct(item.listingId);
    if (!product) throw new CommerceError(`Product ${item.listingId} no longer exists`);
    const lifecycle = normalizeProductLifecycle(product.status);
    if (lifecycle === 'archived' || lifecycle === 'suspended') {
      throw new CommerceError(`Product "${product.title}" is ${lifecycle}`);
    }
    const brand = (await catalogStore.listBrands()).find((b) => b.id === product.brandId);
    if (!brand || !brandIsMarketplaceVisible(brand)) {
      throw new CommerceError(`Brand for "${product.title}" is not marketplace-visible`);
    }
    if (!isProductPubliclyEligible(product, brand) && lifecycle !== 'active') {
      throw new CommerceError(`Product "${product.title}" is not eligible for checkout`);
    }

    // Server-authoritative pricing — variant price when a variant is selected.
    item.unitPrice = product.price;
    item.originalUnitPrice = product.originalPrice;
    if (item.variantId) {
      const rv = await resolveVariantPricing(
        product.id,
        item.variantId,
        product.price,
        product.originalPrice,
      );
      if (!rv) throw new CommerceError(`Variant no longer exists for "${product.title}"`);
      if (!rv.active) {
        throw new CommerceError(`Selected variant of "${product.title}" is no longer available`);
      }
      item.unitPrice = rv.unitPrice;
      item.originalUnitPrice = rv.originalUnitPrice;
      item.variantSku = rv.sku;
    }

    // ── Guide LIVE offer (guide-scoped temporary price) ──────────────────
    // Server-authoritative + server clock. The base product price above is
    // never mutated; we only override this line's unitPrice while the offer is
    // active, and snapshot the base for history.
    const canonicalUnitPrice = item.unitPrice;
    item.guideOfferApplied = undefined;
    if (item.guideOfferRef?.guideId && item.guideOfferRef.productId === item.listingId) {
      const resolved = await resolveActiveGuideOffer(
        item.guideOfferRef.guideId,
        item.listingId,
        canonicalUnitPrice,
        Date.now(),
        Boolean(item.variantId),
      );
      if (resolved) {
        item.unitPrice = resolved.unitPrice;
        item.guideOfferApplied = {
          guideId: resolved.guideId,
          offerId: resolved.offerId,
          basePrice: resolved.basePrice,
        };
      } else {
        // Offer expired / disabled / changed — drop the ref, keep canonical price.
        item.guideOfferRef = undefined;
      }
    }
    // Price-change guard: if the buyer last saw a different price for this line
    // (offer expired between add-to-cart and checkout, or a promo changed),
    // stop and make them review — never silently charge a new amount.
    if (
      typeof item.expectedUnitPrice === 'number' &&
      Math.abs(item.expectedUnitPrice - item.unitPrice) > 0.001
    ) {
      throw new CommerceError(
        `The price for "${product.title}" changed since you added it. Please review the updated total.`,
        409,
        {
          code: 'GUIDE_OFFER_PRICE_CHANGED',
          details: {
            productId: item.listingId,
            expectedUnitPrice: item.expectedUnitPrice,
            actualUnitPrice: item.unitPrice,
            guideOfferActive: Boolean(item.guideOfferApplied),
          },
        },
      );
    }

    // Re-resolve add-ons from canonical config — a since-disabled/removed add-on
    // must NOT check out (never trust the client-carried price/title).
    if (item.addons?.length) {
      item.addons = await resolveAddonsForProduct(
        product.id,
        item.addons.map((a) => ({ id: a.id, quantity: a.quantity })),
      );
    }

    // Physical inventory only — a service-type product's variants configure
    // price, not stock.
    if (product.productType !== 'service') {
      let record = await getInventoryRecord(product.id, item.variantId);
      if (!record) {
        const all = await listInventoryForProduct(product.id);
        record = all.find((r) => !r.variantId) || null;
      }
      const available = record?.availableQuantity ?? product.stock ?? 0;
      if (item.quantity > available) {
        throw new CommerceError(
          `Insufficient stock for "${product.title}": need ${item.quantity}, available ${available}`,
        );
      }
    }
    item.sellerId = product.sellerId || brand.sellerId || item.sellerId;
    item.brandId = product.brandId;
    item.brandName = brand.name || product.brandName;
    item.title = product.title;
  } else {
    const service = await getService(item.listingId);
    if (!service) throw new CommerceError(`Service ${item.listingId} no longer exists`);
    const lifecycle = normalizeProductLifecycle(service.status);
    if (lifecycle !== 'active') {
      throw new CommerceError(`Service "${service.title}" is not eligible for checkout`);
    }
    const brand = (await catalogStore.listBrands()).find((b) => b.id === service.brandId);
    if (!brand || !brandIsMarketplaceVisible(brand)) {
      throw new CommerceError(`Brand for "${service.title}" is not marketplace-visible`);
    }
    item.unitPrice = service.price;
    item.sellerId = service.sellerId || brand.sellerId || item.sellerId;
    item.brandId = service.brandId;
    item.brandName = brand.name || service.brandName;
    item.title = service.title;
  }
}

function toSnapshot(item: CommerceCartItem): CommerceOrderItemSnapshot {
  const finalUnitPrice = item.unitPrice;
  const addons = item.addons?.length ? item.addons.map((a) => ({ ...a })) : undefined;
  const addonsTot = sumAddonLines(addons);
  // A Guide LIVE offer counts as the reference "was" price when it beats the MRP.
  const offerBase = item.guideOfferApplied?.basePrice;
  const mrp =
    typeof item.originalUnitPrice === 'number' && item.originalUnitPrice > item.unitPrice
      ? item.originalUnitPrice
      : undefined;
  const original =
    typeof offerBase === 'number' && offerBase > item.unitPrice
      ? Math.max(offerBase, mrp ?? 0)
      : mrp;
  return {
    listingType: item.listingType,
    listingId: item.listingId,
    variantId: item.variantId,
    sku: item.variantSku,
    title: item.title,
    brandId: item.brandId,
    brandName: item.brandName,
    sellerId: item.sellerId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    originalUnitPrice: original,
    // `discount` = (reference price − charged price) for display only.
    discount: original ? Math.max(0, original - item.unitPrice) : 0,
    finalUnitPrice,
    ...(item.guideOfferApplied ? { guideOffer: item.guideOfferApplied } : {}),
    addons,
    addonsTotal: addons ? addonsTot : undefined,
    lineTotal: finalUnitPrice * item.quantity + addonsTot,
    currency: item.currency || 'BDT',
    selectedOptions: item.selectedOptions,
  };
}

/** Split by Brand (IS-004 §9 / §335). */
function groupByBrand(items: CommerceCartItem[]): Map<string, CommerceCartItem[]> {
  const map = new Map<string, CommerceCartItem[]>();
  for (const item of items) {
    const key = item.brandId;
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

/**
 * Sprint 6 (QA3-001 follow-up): previously did its own read-then-write
 * (getInventoryRecord then a separate adjustInventory), the same TOCTOU gap
 * closed on the legacy /operations/orders path in Sprint 5 -- two
 * concurrent checkouts for the same product could both read the same
 * "available" value before either wrote back. Delegates to
 * reserveInventoryQuantity(), the canonical mutex-protected primitive, so
 * there is exactly one reservation implementation instead of two. Preserves
 * this function's existing external contract (same return shape, same
 * throw-on-failure -- executeCheckout's catch block already expects a thrown
 * CommerceError, not a result object).
 */
async function reserveProductInventory(item: CommerceCartItem): Promise<{
  productId: string;
  variantId?: string;
  quantity: number;
}> {
  const result = await reserveInventoryQuantity({
    productId: item.listingId,
    variantId: item.variantId,
    quantity: item.quantity,
  });
  if (!result.ok) {
    throw new CommerceError(`Cannot reserve inventory for "${item.title}"`);
  }
  return {
    productId: item.listingId,
    variantId: item.variantId,
    quantity: item.quantity,
  };
}

async function releaseReservations(
  reservations: Array<{ productId: string; variantId?: string; quantity: number }>,
): Promise<void> {
  for (const r of reservations) {
    try {
      await releaseInventoryQuantity(r);
    } catch (error) {
      console.error('[Commerce] Failed to release inventory reservation after checkout failure:', error);
    }
  }
}

function emitCommerce(eventName: string, aggregateId: string, actor: string, payload: object) {
  publishEvent({
    eventName,
    domain: 'Commerce',
    producer: 'commerceCheckout',
    aggregateId,
    actor,
    payload,
  });
}

function mirrorToOperations(order: CommerceOrder, consumerId: string): void {
  try {
    const mirrored = operationsStore.createOrder({
      orderId: order.orderNumber,
      buyerId: consumerId,
      isCOD: false,
      isSplit: true,
      overallTotal: order.grandTotal,
      subtotal: order.subtotal,
      deliveryTotal: order.deliveryTotal,
      subOrders: [
        {
          sellerId: order.sellerId,
          brandId: order.brandId,
          // Sprint 14: give every mirrored line a STABLE itemId so the per-item
          // "Mark Delivered" endpoint works for real storefront-checkout orders
          // (previously only manual-offer orders carried one). A CommerceOrder's
          // `items` array is written once at checkout and never mutated by any
          // lifecycle transition, so `${orderNumber}-i${index}` is immutable for
          // the life of the order.
          items: order.items.map((it, index) => ({
            ...it,
            itemId: `${order.orderNumber}-i${index}`,
          })),
          total: order.grandTotal,
        },
      ],
      sourceMode: 'retail',
      paymentMethod: 'online',
      shipping: order.shipping
        ? {
            fullName: order.shipping.fullName,
            phone: order.shipping.phone,
            address: order.shipping.address,
            region: order.shipping.region || 'Dhaka',
            deliveryNotes: order.shipping.deliveryNotes,
          }
        : undefined,
      status: 'pending_payment',
      bookingRequestId: order.bookingRequestId,
      isManual: order.source === 'manual' || order.source.startsWith('external_'),
      platformSource:
        order.source === 'external_whatsapp'
          ? 'WhatsApp'
          : order.source === 'external_facebook'
            ? 'Facebook'
            : order.source === 'external_instagram'
              ? 'Instagram'
              : order.source === 'external_offline' || order.source === 'manual'
                ? 'Offline'
                : undefined,
      claimToken: order.claimToken,
      claimTokenExpiresAt: order.claimTokenExpiresAt,
      createdAt: order.createdAt,
    });
    // Sprint 14: every real order gets a canonical Operations shipment record
    // at creation — status `awaiting_dispatch`, NO courier / tracking — so the
    // Order Hub / buyer tracking read one consistent record and the dispatch
    // flow has something to write. (Manual-offer + claim paths already do this.)
    if (mirrored) shipmentStore.createFromOrder(mirrored);
  } catch (error) {
    console.warn('[Commerce] Failed to mirror order into operationsStore:', error);
  }
}

export type CheckoutInput = {
  consumerId: string;
  idempotencyKey?: string;
  shipping?: CommerceOrder['shipping'];
};

export type CheckoutResult = {
  checkout: CommerceCheckout;
  orders: CommerceOrder[];
  bookingRequests: CommerceBookingRequest[];
  reused: boolean;
};

export async function executeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const { consumerId } = input;
  if (!consumerId) throw new CommerceError('Authentication required', 401);

  const idemKey = (input.idempotencyKey || '').trim();
  if (idemKey) {
    const existing = await commerceStore.getIdempotency(idemKey, consumerId);
    if (existing) {
      const checkout = await commerceStore.getCheckout(existing.checkoutId);
      if (checkout) {
        const orders = (
          await Promise.all(checkout.orderIds.map((id) => commerceStore.getOrder(id)))
        ).filter((o): o is CommerceOrder => Boolean(o));
        const bookingRequests = (
          await Promise.all(
            orders.map((o) =>
              o.bookingRequestId
                ? commerceStore.getBookingRequest(o.bookingRequestId)
                : Promise.resolve(null),
            ),
          )
        ).filter((b): b is CommerceBookingRequest => Boolean(b));
        return { checkout, orders, bookingRequests, reused: true };
      }
    }
  }

  let cart = await getOrCreateCart(consumerId);
  if (!cart.items.length) throw new CommerceError('Cart is empty');

  cart = await refreshCartPrices(cart);
  for (const item of cart.items) {
    await revalidateCartItem(item);
  }
  cart = await commerceStore.upsertCart(cart);

  if (!input.shipping?.fullName || !input.shipping?.phone || !input.shipping?.address) {
    throw new CommerceError('Checkout requires shipping fullName, phone, and address');
  }

  const totals = computeCartTotals(cart);
  const checkoutId = newId('chk');
  const brandGroups = groupByBrand(cart.items);
  const orders: CommerceOrder[] = [];
  const bookingRequests: CommerceBookingRequest[] = [];
  const reservations: Array<{ productId: string; variantId?: string; quantity: number }> = [];

  emitCommerce('CheckoutStarted', checkoutId, consumerId, {
    checkoutId,
    cartId: cart.id,
    brandCount: brandGroups.size,
  });

  try {
    for (const [brandId, items] of brandGroups) {
      const snapshots = items.map(toSnapshot);
      const subtotal = snapshots.reduce((s, i) => s + i.lineTotal, 0);
      const sellerId = items[0].sellerId;
      const brandName = items[0].brandName;
      const hasService = items.some((i) => i.listingType === 'service');

      let reservedAnyPhysical = false;
      for (const item of items.filter((i) => i.listingType === 'product')) {
        // Service-type products carry configurable variants but no physical stock.
        const p = await catalogStore.getProduct(item.listingId);
        if (p?.productType === 'service') continue;
        reservations.push(await reserveProductInventory(item));
        reservedAnyPhysical = true;
      }

      const order: CommerceOrder = {
        id: newId('cord'),
        orderNumber: orderNumber(),
        checkoutId,
        consumerId,
        sellerId,
        brandId,
        brandName,
        status: 'pending',
        source: 'checkout',
        currency: totals.currency,
        items: snapshots,
        subtotal,
        discountTotal: 0,
        deliveryTotal: 0,
        taxTotal: 0,
        grandTotal: subtotal,
        shipping: input.shipping,
        inventoryReserved: reservedAnyPhysical,
        inventoryConsumed: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      try {
        const { ensureEntityReferenceId } = await import('../referenceIds/referenceIdService');
        order.orderReferenceId = await ensureEntityReferenceId({
          entityType: 'order',
          internalId: order.id,
        });
        order.invoiceReferenceId = await ensureEntityReferenceId({
          entityType: 'invoice',
          internalId: order.id,
        });
      } catch {
        /* backfill can repair */
      }

      if (hasService) {
        for (const item of items.filter((i) => i.listingType === 'service')) {
          const br: CommerceBookingRequest = {
            id: newId('cbr'),
            checkoutId,
            orderId: order.id,
            consumerId,
            sellerId: item.sellerId,
            brandId: item.brandId,
            serviceId: item.listingId,
            quantity: item.quantity,
            requestedAt: item.requestedAt,
            serviceArea: item.serviceArea,
            notes: item.notes,
            unitPrice: item.unitPrice,
            currency: item.currency || 'BDT',
            title: item.title,
            status: 'pending_seller_review',
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          bookingRequests.push(br);
          order.bookingRequestId = br.id;
        }
      }

      orders.push(order);
    }

    const checkout: CommerceCheckout = {
      id: checkoutId,
      consumerId,
      cartId: cart.id,
      idempotencyKey: idemKey || checkoutId,
      status: 'completed',
      orderIds: orders.map((o) => o.id),
      currency: totals.currency,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      deliveryTotal: totals.deliveryTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const clearedCart: CommerceCart = {
      ...cart,
      items: [],
      updatedAt: nowIso(),
    };

    // Atomic commerce commit (checkout + orders + bookings + idempotency + cleared cart).
    await commerceStore.commitCheckoutBundle({
      checkout,
      orders,
      bookingRequests,
      idempotency: idemKey
        ? { key: idemKey, consumerId, checkoutId, createdAt: nowIso() }
        : undefined,
      clearedCart,
    });

    for (const order of orders) {
      mirrorToOperations(order, consumerId);
      emitCommerce('OrderCreated', order.id, consumerId, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutId,
        sellerId: order.sellerId,
        brandId: order.brandId,
        consumerId,
        source: order.source,
        grandTotal: order.grandTotal,
      });
    }
    for (const br of bookingRequests) {
      emitCommerce('BookingRequestCreated', br.id, consumerId, {
        bookingRequestId: br.id,
        orderId: br.orderId,
        serviceId: br.serviceId,
        sellerId: br.sellerId,
        brandId: br.brandId,
        consumerId,
      });
    }

    emitCommerce('CheckoutCompleted', checkoutId, consumerId, {
      checkoutId,
      orderIds: checkout.orderIds,
      grandTotal: checkout.grandTotal,
    });
    emitCommerce('CartUpdated', cart.id, consumerId, { cartId: cart.id, cleared: true });

    return { checkout, orders, bookingRequests, reused: false };
  } catch (error) {
    // Compensate inventory if commerce durable write failed after reservation.
    await releaseReservations(reservations);
    throw error;
  }
}

export async function createManualOrder(input: {
  actorId: string;
  actorRole?: string;
  sellerId: string;
  brandId: string;
  consumerId?: string;
  listingType: 'product' | 'service';
  listingId: string;
  quantity: number;
  source?: CommerceOrderSource;
  shipping?: CommerceOrder['shipping'];
  notes?: string;
}): Promise<{ order: CommerceOrder; claimToken?: string }> {
  const isAdmin =
    input.actorRole === 'admin' ||
    input.actorRole === 'super_admin' ||
    input.actorRole === 'moderator';
  if (!isAdmin && input.actorId !== input.sellerId) {
    throw new CommerceError('Not authorized to create manual order for this seller', 403);
  }

  const brand = (await catalogStore.listBrands()).find((b) => b.id === input.brandId);
  if (!brand) throw new CommerceError('Brand not found', 404);
  if (!isAdmin && brand.sellerId !== input.sellerId) {
    throw new CommerceError('Brand does not belong to seller', 403);
  }

  let snapshot: CommerceOrderItemSnapshot;
  if (input.listingType === 'product') {
    const product = await catalogStore.getProduct(input.listingId);
    if (!product) throw new CommerceError('Product not found', 404);
    if (product.brandId !== input.brandId) {
      throw new CommerceError('Product does not belong to brand');
    }
    snapshot = {
      listingType: 'product',
      listingId: product.id,
      title: product.title,
      brandId: product.brandId,
      brandName: brand.name,
      sellerId: input.sellerId,
      quantity: Math.max(1, Math.floor(input.quantity)),
      unitPrice: product.price,
      discount: 0,
      finalUnitPrice: product.price,
      lineTotal: product.price * Math.max(1, Math.floor(input.quantity)),
      currency: 'BDT',
    };
  } else {
    const service = await getService(input.listingId);
    if (!service) throw new CommerceError('Service not found', 404);
    if (service.brandId !== input.brandId) {
      throw new CommerceError('Service does not belong to brand');
    }
    snapshot = {
      listingType: 'service',
      listingId: service.id,
      title: service.title,
      brandId: service.brandId,
      brandName: brand.name,
      sellerId: input.sellerId,
      quantity: Math.max(1, Math.floor(input.quantity)),
      unitPrice: service.price,
      discount: 0,
      finalUnitPrice: service.price,
      lineTotal: service.price * Math.max(1, Math.floor(input.quantity)),
      currency: service.currency || 'BDT',
    };
  }

  const claimToken = newId('claim');
  const checkoutId = newId('chk-manual');
  const consumerId = input.consumerId || `pending:${claimToken}`;
  const source: CommerceOrderSource = input.source || 'manual';

  const order: CommerceOrder = {
    id: newId('cord'),
    orderNumber: orderNumber(),
    checkoutId,
    consumerId,
    sellerId: input.sellerId,
    brandId: input.brandId,
    brandName: brand.name,
    status: 'pending',
    source,
    currency: snapshot.currency,
    items: [snapshot],
    subtotal: snapshot.lineTotal,
    discountTotal: 0,
    deliveryTotal: 0,
    taxTotal: 0,
    grandTotal: snapshot.lineTotal,
    claimToken,
    claimTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    shipping: input.shipping,
    inventoryReserved: false,
    inventoryConsumed: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (snapshot.listingType === 'service') {
    const br: CommerceBookingRequest = {
      id: newId('cbr'),
      checkoutId,
      orderId: order.id,
      consumerId,
      sellerId: order.sellerId,
      brandId: order.brandId,
      serviceId: snapshot.listingId,
      quantity: snapshot.quantity,
      notes: input.notes,
      unitPrice: snapshot.unitPrice,
      currency: snapshot.currency,
      title: snapshot.title,
      status: 'pending_seller_review',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await commerceStore.upsertBookingRequest(br);
    order.bookingRequestId = br.id;
  }

  await commerceStore.upsertOrder(order);
  await commerceStore.upsertCheckout({
    id: checkoutId,
    consumerId,
    cartId: '',
    idempotencyKey: order.id,
    status: 'completed',
    orderIds: [order.id],
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: 0,
    deliveryTotal: 0,
    taxTotal: 0,
    grandTotal: order.grandTotal,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  mirrorToOperations(order, consumerId);
  emitCommerce('ManualOrderCreated', order.id, input.actorId, {
    orderId: order.id,
    sellerId: order.sellerId,
    source: order.source,
  });
  emitCommerce('OrderCreated', order.id, input.actorId, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    checkoutId: order.checkoutId,
    sellerId: order.sellerId,
    brandId: order.brandId,
    consumerId: order.consumerId || input.actorId,
    source: order.source,
    manual: true,
  });

  // Sprint 11: the OrderCreated event subscriber (conversationEvents.ts) also
  // calls ensureOrderConversation, but eventBus.publishEvent fires handlers via
  // `void handler(event)` — fire-and-forget, not awaited. That left a real race:
  // a client polling for the order's conversation immediately after this request
  // returns could find nothing yet. ensureOrderConversation is idempotent (keyed
  // by orderReconcileKey), so calling it synchronously here as well is safe and
  // guarantees the conversation exists by the time this response is sent.
  try {
    const { ensureOrderConversation, mapOrderSourceChannel } = await import(
      '../messaging/conversations/conversationService'
    );
    const { CONVERSATION_CONTEXT_TYPES } = await import('../messaging/conversations/types');
    await ensureOrderConversation({
      orderId: order.id,
      consumerId: order.consumerId,
      sellerId: order.sellerId,
      brandId: order.brandId,
      checkoutId: order.checkoutId,
      sourceChannel: mapOrderSourceChannel(order.source),
      contextType:
        order.source !== 'checkout'
          ? CONVERSATION_CONTEXT_TYPES.MANUAL_ORDER
          : CONVERSATION_CONTEXT_TYPES.ORDER,
      metadata: { orderNumber: order.orderNumber, orderSource: order.source },
      actor: input.actorId,
    });
  } catch (error) {
    console.error('[Commerce] Failed to synchronously ensure manual order conversation:', error);
  }

  return { order, claimToken };
}

export async function associateManualOrder(input: {
  token: string;
  consumerId: string;
}): Promise<CommerceOrder> {
  const orders = await commerceStore.listOrders();
  const order = orders.find((o) => o.claimToken === input.token);
  if (!order) throw new CommerceError('Manual order claim token not found', 404);
  if (order.claimTokenExpiresAt && new Date(order.claimTokenExpiresAt).getTime() < Date.now()) {
    throw new CommerceError('Claim token expired', 400);
  }
  if (order.consumerId && !order.consumerId.startsWith('pending:')) {
    if (order.consumerId !== input.consumerId) {
      throw new CommerceError('Order already associated with another consumer', 403);
    }
    return order;
  }
  order.consumerId = input.consumerId;
  order.claimToken = undefined;
  order.updatedAt = nowIso();
  const saved = await commerceStore.upsertOrder(order);
  try {
    const { ensureOrderConversation } = await import(
      '../messaging/conversations/conversationService'
    );
    await ensureOrderConversation({
      orderId: saved.id,
      consumerId: saved.consumerId,
      sellerId: saved.sellerId,
      brandId: saved.brandId,
      checkoutId: saved.checkoutId,
      sourceChannel:
        saved.source === 'external_whatsapp'
          ? 'external_whatsapp'
          : saved.source === 'external_facebook'
            ? 'facebook'
            : saved.source === 'external_instagram'
              ? 'instagram'
              : saved.source === 'checkout'
                ? 'platform'
                : 'manual',
      contextType: saved.source === 'checkout' ? 'order' : 'manual_order',
      actor: input.consumerId,
    });
  } catch (error) {
    console.error('[Commerce] Failed to ensure conversation after manual order associate:', error);
  }
  return saved;
}

export async function getOrderForActor(
  orderId: string,
  actor: { userId: string; role?: string },
): Promise<CommerceOrder> {
  const order = await commerceStore.getOrder(orderId);
  if (!order) throw new CommerceError('Order not found', 404);
  const isAdmin =
    actor.role === 'admin' || actor.role === 'super_admin' || actor.role === 'moderator';
  if (isAdmin) return order;
  if (order.consumerId === actor.userId) return order;
  if (order.sellerId === actor.userId) return order;
  throw new CommerceError('Not authorized to view this order', 403);
}

/**
 * Sprint 14 — resolve the canonical Commerce order behind an Operations
 * `orderId` (== CommerceOrder.orderNumber, set 1:1 by mirrorToOperations at
 * checkout / manual-order creation). READ-ONLY; same actor-scoping as
 * getOrderForActor (admin/moderator → any; otherwise consumer or seller of
 * that order). Returns null when no Commerce order carries that number
 * (e.g. a pure booking / legacy Operations-only order) so the caller can show
 * an honest "lifecycle not available for this order type" state.
 */
export async function getOrderByNumberForActor(
  orderNumber: string,
  actor: { userId: string; role?: string },
): Promise<CommerceOrder | null> {
  const wanted = String(orderNumber || '').trim();
  if (!wanted) return null;
  const all = await commerceStore.listOrders();
  const order = all.find((o) => o.orderNumber === wanted) || null;
  if (!order) return null;
  const isAdmin =
    actor.role === 'admin' || actor.role === 'super_admin' || actor.role === 'moderator';
  if (isAdmin) return order;
  if (order.consumerId === actor.userId) return order;
  if (order.sellerId === actor.userId) return order;
  throw new CommerceError('Not authorized to view this order', 403);
}

export async function listOrdersForActor(actor: {
  userId: string;
  role?: string;
  as?: 'consumer' | 'seller';
  brandId?: string;
  status?: string;
}): Promise<CommerceOrder[]> {
  const grouped = await listOrdersGroupedByCheckout(actor);
  return grouped.orders;
}

export async function getCheckoutForConsumer(
  checkoutId: string,
  consumerId: string,
  role?: string,
): Promise<CommerceCheckout> {
  const checkout = await commerceStore.getCheckout(checkoutId);
  if (!checkout) throw new CommerceError('Checkout not found', 404);
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'moderator';
  if (!isAdmin && checkout.consumerId !== consumerId) {
    throw new CommerceError('Not authorized to view this checkout', 403);
  }
  return checkout;
}
