/**
 * Cart service — IS-004 §5–§7.
 * Server-authoritative pricing; client prices ignored.
 */

import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import {
  brandIsMarketplaceVisible,
} from '../catalog/sellerWorkspace';
import {
  isProductPubliclyEligible,
  normalizeProductLifecycle,
} from '../catalog/productLifecycle';
import { getInventoryRecord, listInventoryForProduct } from '../catalog/inventoryStore';
import { getService } from '../catalog/serviceStore';
import { publishEvent } from '../events/eventBus';
import { commerceStore } from './commerceStore';
import type {
  CommerceCart,
  CommerceCartItem,
  CommerceCartTotals,
  CommerceListingType,
} from './types';

function emitCart(eventName: string, cartId: string, actor: string, payload: object) {
  publishEvent({
    eventName,
    domain: 'Commerce',
    producer: 'commerceCart',
    aggregateId: cartId,
    actor,
    payload,
  });
}

export class CommerceError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CommerceError';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_DELIVERY = 0; // Sprint 5: no invented delivery engine; flat 0 unless later configured

export function computeCartTotals(cart: CommerceCart): CommerceCartTotals {
  const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = 0;
  const deliveryTotal = cart.items.length ? DEFAULT_DELIVERY : 0;
  const taxTotal = 0;
  return {
    currency: cart.currency || 'BDT',
    itemCount: cart.items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    discountTotal,
    deliveryTotal,
    taxTotal,
    grandTotal: Math.max(0, subtotal - discountTotal + deliveryTotal + taxTotal),
  };
}

export async function getOrCreateCart(consumerId: string): Promise<CommerceCart> {
  const existing = await commerceStore.getCartByConsumer(consumerId);
  if (existing) return existing;
  const created: CommerceCart = {
    id: newId('cart'),
    consumerId,
    items: [],
    currency: 'BDT',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const saved = await commerceStore.upsertCart(created);
  emitCart('CartCreated', saved.id, consumerId, { cartId: saved.id, consumerId });
  return saved;
}

async function assertProductEligible(productId: string, variantId?: string) {
  const product = await catalogStore.getProduct(productId);
  if (!product) throw new CommerceError('Product not found', 404);

  const lifecycle = normalizeProductLifecycle(product.status);
  if (lifecycle === 'archived' || lifecycle === 'suspended') {
    throw new CommerceError(`Product is ${lifecycle} and cannot be added to cart`);
  }

  const brand = (await catalogStore.listBrands()).find((b) => b.id === product.brandId);
  if (!brand || !brandIsMarketplaceVisible(brand)) {
    throw new CommerceError('Brand Marketplace Access does not allow commerce for this product');
  }
  if (!isProductPubliclyEligible(product, brand)) {
    if (lifecycle !== 'active' && lifecycle !== 'out_of_stock') {
      throw new CommerceError('Product is not publicly eligible for commerce');
    }
  }
  if (!product.sellerId && brand.sellerId) {
    // ok — use brand seller
  }
  const sellerId = product.sellerId || brand.sellerId;
  if (!sellerId) {
    throw new CommerceError('Product has no owning seller');
  }

  if (variantId) {
    const detail = await catalogStore.getProductDetail(productId);
    const variant = detail?.productVariants?.find((v) => v.id === variantId);
    if (!variant) {
      throw new CommerceError('Variant does not belong to this product', 400);
    }
  }

  return { product, brand, sellerId: sellerId as string };
}

async function assertInventoryAvailable(
  productId: string,
  quantity: number,
  variantId?: string,
): Promise<void> {
  let record = await getInventoryRecord(productId, variantId);
  if (!record && !variantId) {
    const all = await listInventoryForProduct(productId);
    record = all.find((r) => !r.variantId) || all[0] || null;
  }
  const product = await catalogStore.getProduct(productId);
  const available = record?.availableQuantity ?? product?.stock ?? 0;
  if (quantity > available) {
    throw new CommerceError(`Insufficient stock: requested ${quantity}, available ${available}`);
  }
}

async function assertServiceEligible(serviceId: string) {
  const service = await getService(serviceId);
  if (!service) throw new CommerceError('Service not found', 404);
  const lifecycle = normalizeProductLifecycle(service.status);
  if (lifecycle === 'archived' || lifecycle === 'suspended') {
    throw new CommerceError(`Service is ${lifecycle} and cannot be added to cart`);
  }
  if (lifecycle !== 'active' && lifecycle !== 'out_of_stock') {
    throw new CommerceError('Service is not publicly eligible for commerce');
  }
  const brand = (await catalogStore.listBrands()).find((b) => b.id === service.brandId);
  if (!brand || !brandIsMarketplaceVisible(brand)) {
    throw new CommerceError('Brand Marketplace Access does not allow commerce for this service');
  }
  const sellerId = service.sellerId || brand.sellerId;
  if (!sellerId) throw new CommerceError('Service has no owning seller');
  return { service, brand, sellerId: sellerId as string };
}

export async function addCartItem(
  consumerId: string,
  input: {
    listingType: CommerceListingType;
    listingId: string;
    quantity?: number;
    variantId?: string;
    /** Ignored — server resolves price. */
    unitPrice?: number;
    sellerId?: string;
    requestedAt?: string;
    serviceArea?: string;
    notes?: string;
    selectedOptions?: Record<string, string>;
  },
): Promise<{ cart: CommerceCart; totals: CommerceCartTotals }> {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  const cart = await getOrCreateCart(consumerId);

  if (input.listingType === 'product') {
    const { product, brand, sellerId } = await assertProductEligible(
      input.listingId,
      input.variantId,
    );
    await assertInventoryAvailable(input.listingId, qty, input.variantId);

    const existing = cart.items.find(
      (i) =>
        i.listingType === 'product' &&
        i.listingId === product.id &&
        (i.variantId || '') === (input.variantId || ''),
    );
    if (existing) {
      const nextQty = existing.quantity + qty;
      await assertInventoryAvailable(product.id, nextQty, input.variantId);
      existing.quantity = nextQty;
      existing.unitPrice = product.price;
      existing.updatedAt = nowIso();
    } else {
      const item: CommerceCartItem = {
        id: newId('ci'),
        listingType: 'product',
        listingId: product.id,
        variantId: input.variantId,
        quantity: qty,
        title: product.title,
        brandId: product.brandId,
        brandName: brand.name || product.brandName,
        sellerId,
        unitPrice: product.price,
        currency: 'BDT',
        image: product.image,
        selectedOptions: input.selectedOptions,
        addedAt: nowIso(),
        updatedAt: nowIso(),
      };
      cart.items.push(item);
    }
  } else if (input.listingType === 'service') {
    const { service, brand, sellerId } = await assertServiceEligible(input.listingId);
    const existing = cart.items.find(
      (i) => i.listingType === 'service' && i.listingId === service.id,
    );
    if (existing) {
      existing.quantity += qty;
      existing.unitPrice = service.price;
      existing.updatedAt = nowIso();
      if (input.requestedAt) existing.requestedAt = input.requestedAt;
      if (input.serviceArea) existing.serviceArea = input.serviceArea;
      if (input.notes) existing.notes = input.notes;
    } else {
      cart.items.push({
        id: newId('ci'),
        listingType: 'service',
        listingId: service.id,
        quantity: qty,
        title: service.title,
        brandId: service.brandId,
        brandName: brand.name || service.brandName,
        sellerId,
        unitPrice: service.price,
        currency: service.currency || 'BDT',
        image: service.image,
        requestedAt: input.requestedAt,
        serviceArea: input.serviceArea || service.serviceArea,
        notes: input.notes,
        addedAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  } else {
    throw new CommerceError('Unsupported listing type');
  }

  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartItemAdded', saved.id, consumerId, {
    cartId: saved.id,
    listingType: input.listingType,
    listingId: input.listingId,
    quantity: qty,
  });
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id });
  return { cart: saved, totals: computeCartTotals(saved) };
}

export async function updateCartItemQuantity(
  consumerId: string,
  itemId: string,
  quantity: number,
): Promise<{ cart: CommerceCart; totals: CommerceCartTotals }> {
  const cart = await getOrCreateCart(consumerId);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new CommerceError('Cart item not found', 404);
  const qty = Math.floor(quantity);
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i.id !== itemId);
  } else {
    if (item.listingType === 'product') {
      await assertInventoryAvailable(item.listingId, qty, item.variantId);
    }
    item.quantity = qty;
    item.updatedAt = nowIso();
  }
  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id, itemId, quantity: qty });
  return { cart: saved, totals: computeCartTotals(saved) };
}

export async function removeCartItem(
  consumerId: string,
  itemId: string,
): Promise<{ cart: CommerceCart; totals: CommerceCartTotals }> {
  const cart = await getOrCreateCart(consumerId);
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.id !== itemId);
  if (cart.items.length === before) throw new CommerceError('Cart item not found', 404);
  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartItemRemoved', saved.id, consumerId, { cartId: saved.id, itemId });
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id });
  return { cart: saved, totals: computeCartTotals(saved) };
}

export async function clearCart(consumerId: string): Promise<CommerceCart> {
  const cart = await getOrCreateCart(consumerId);
  cart.items = [];
  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id, cleared: true });
  return saved;
}

/** Re-resolve live prices for all items (server authority). */
export async function refreshCartPrices(cart: CommerceCart): Promise<CommerceCart> {
  for (const item of cart.items) {
    if (item.listingType === 'product') {
      const product = await catalogStore.getProduct(item.listingId);
      if (product) item.unitPrice = product.price;
    } else {
      const service = await getService(item.listingId);
      if (service) item.unitPrice = service.price;
    }
    item.updatedAt = nowIso();
  }
  cart.updatedAt = nowIso();
  return commerceStore.upsertCart(cart);
}
