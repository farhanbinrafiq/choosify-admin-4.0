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
  CommerceAddonLine,
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
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  constructor(
    message: string,
    statusCode = 400,
    opts?: { code?: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = opts?.code;
    this.details = opts?.details;
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

// ── Canonical variant + add-on resolution (server authority) ──────────────────

/** Back-compat: a variant with no explicit `status` is active unless `enabled === false`. */
export function variantIsActive(v: { enabled?: boolean; status?: 'active' | 'inactive' }): boolean {
  if (v.status) return v.status === 'active';
  return v.enabled !== false;
}

export type ResolvedVariantPricing = {
  variantId: string;
  sku?: string;
  unitPrice: number;
  originalUnitPrice?: number;
  active: boolean;
  options?: Record<string, string>;
  images?: string[];
};

/**
 * Resolve a variant's canonical pricing/status against the product detail.
 * Returns null when `variantId` is not a variant of this product (caller rejects
 * — this is how forged / cross-product variant ids are stopped).
 */
export async function resolveVariantPricing(
  productId: string,
  variantId: string,
  basePrice: number,
  baseOriginalPrice?: number,
): Promise<ResolvedVariantPricing | null> {
  const detail = await catalogStore.getProductDetail(productId);
  const v = detail?.productVariants?.find((x) => x.id === variantId);
  if (!v) return null;
  return {
    variantId,
    sku: v.sku || undefined,
    unitPrice: typeof v.price === 'number' && v.price >= 0 ? v.price : basePrice,
    originalUnitPrice:
      typeof v.originalPrice === 'number' && v.originalPrice > 0 ? v.originalPrice : baseOriginalPrice,
    active: variantIsActive(v),
    options: v.options,
    images: Array.isArray(v.images) && v.images.length ? v.images : undefined,
  };
}

/**
 * Server-authoritative add-on resolution. The client sends only `{ id, quantity }`
 * — title / price / limits all come from the canonical listing. Rejects forged,
 * disabled, cross-product, duplicate, and over-`maxQuantity` add-ons.
 */
export async function resolveAddonsForProduct(
  productId: string,
  requested: Array<{ id?: unknown; quantity?: unknown }> | undefined | null,
): Promise<CommerceAddonLine[]> {
  if (!Array.isArray(requested) || requested.length === 0) return [];
  const detail = await catalogStore.getProductDetail(productId);
  const defs = detail?.addonItems ?? [];
  const out: CommerceAddonLine[] = [];
  const seen = new Set<string>();
  for (const r of requested) {
    const id = String(r?.id ?? '').trim();
    if (!id) throw new CommerceError('Add-on id is required', 400);
    if (seen.has(id)) throw new CommerceError(`Duplicate add-on "${id}"`, 400);
    seen.add(id);
    const def = defs.find((a) => a.id === id);
    if (!def) throw new CommerceError('Add-on does not belong to this product', 400);
    if (def.enabled === false) throw new CommerceError(`Add-on "${def.title}" is not available`, 400);
    const maxQ =
      typeof def.maxQuantity === 'number' && def.maxQuantity >= 1 ? Math.floor(def.maxQuantity) : 1;
    const q = Math.max(1, Math.floor(Number(r?.quantity ?? 1) || 1));
    if (q > maxQ) {
      throw new CommerceError(`Add-on "${def.title}" allows at most ${maxQ} per order`, 400);
    }
    const unitPrice = Math.max(0, typeof def.price === 'number' ? def.price : 0);
    out.push({ id: def.id, title: def.title, unitPrice, quantity: q, lineTotal: unitPrice * q });
  }
  return out;
}

export function sumAddonLines(addons: CommerceAddonLine[] | undefined): number {
  return (addons ?? []).reduce((s, a) => s + a.lineTotal, 0);
}

export function computeCartTotals(cart: CommerceCart): CommerceCartTotals {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity + sumAddonLines(item.addons),
    0,
  );
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
    if (!variantIsActive(variant)) {
      throw new CommerceError('Selected variant is not available for purchase', 400);
    }
  }

  return { product, brand, sellerId: sellerId as string };
}

/** True for a CatalogProduct that models a service/booking — never gets physical
 *  inventory reservation even when it carries configurable variants. */
function usesPhysicalInventory(product: { productType?: string }): boolean {
  return product.productType !== 'service';
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
    /** Client sends only { id, quantity } — everything else is resolved server-side. */
    addons?: Array<{ id?: unknown; quantity?: unknown }>;
    /** Optional Guide LIVE offer this line was added under (revalidated at checkout). */
    guideOfferRef?: { guideId: string; productId: string };
    /** The unit price the buyer last saw — used only for the checkout price-change guard. */
    expectedUnitPrice?: number;
  },
): Promise<{ cart: CommerceCart; totals: CommerceCartTotals }> {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  const cart = await getOrCreateCart(consumerId);

  if (input.listingType === 'product') {
    const { product, brand, sellerId } = await assertProductEligible(
      input.listingId,
      input.variantId,
    );

    // Server-authoritative pricing: variant price when a variant is selected.
    let unitPrice = product.price;
    let originalUnitPrice = product.originalPrice;
    let variantSku: string | undefined;
    if (input.variantId) {
      const rv = await resolveVariantPricing(
        product.id,
        input.variantId,
        product.price,
        product.originalPrice,
      );
      if (!rv) throw new CommerceError('Variant does not belong to this product', 400);
      if (!rv.active) throw new CommerceError('Selected variant is not available for purchase', 400);
      unitPrice = rv.unitPrice;
      originalUnitPrice = rv.originalUnitPrice;
      variantSku = rv.sku;
    }

    const resolvedAddons = await resolveAddonsForProduct(product.id, input.addons);
    const physical = usesPhysicalInventory(product);
    if (physical) {
      await assertInventoryAvailable(input.listingId, qty, input.variantId);
    }

    const existing = cart.items.find(
      (i) =>
        i.listingType === 'product' &&
        i.listingId === product.id &&
        (i.variantId || '') === (input.variantId || ''),
    );
    if (existing) {
      const nextQty = existing.quantity + qty;
      if (physical) await assertInventoryAvailable(product.id, nextQty, input.variantId);
      existing.quantity = nextQty;
      existing.unitPrice = unitPrice;
      existing.originalUnitPrice = originalUnitPrice;
      existing.variantSku = variantSku;
      // Add-ons: last selection wins for this line (a re-add restates the config).
      if (Array.isArray(input.addons)) existing.addons = resolvedAddons;
      if (input.guideOfferRef?.guideId) {
        existing.guideOfferRef = {
          guideId: input.guideOfferRef.guideId,
          productId: input.guideOfferRef.productId || product.id,
        };
      }
      if (typeof input.expectedUnitPrice === 'number') existing.expectedUnitPrice = input.expectedUnitPrice;
      existing.updatedAt = nowIso();
    } else {
      const item: CommerceCartItem = {
        id: newId('ci'),
        listingType: 'product',
        listingId: product.id,
        variantId: input.variantId,
        variantSku,
        quantity: qty,
        title: product.title,
        brandId: product.brandId,
        brandName: brand.name || product.brandName,
        sellerId,
        unitPrice,
        originalUnitPrice,
        addons: resolvedAddons.length ? resolvedAddons : undefined,
        ...(input.guideOfferRef?.guideId
          ? {
              guideOfferRef: {
                guideId: input.guideOfferRef.guideId,
                productId: input.guideOfferRef.productId || product.id,
              },
            }
          : {}),
        ...(typeof input.expectedUnitPrice === 'number'
          ? { expectedUnitPrice: input.expectedUnitPrice }
          : {}),
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
      const product = await catalogStore.getProduct(item.listingId);
      if (!product || usesPhysicalInventory(product)) {
        await assertInventoryAvailable(item.listingId, qty, item.variantId);
      }
    }
    item.quantity = qty;
    item.updatedAt = nowIso();
  }
  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id, itemId, quantity: qty });
  return { cart: saved, totals: computeCartTotals(saved) };
}

/**
 * Replace the add-on selection on one cart item. Client sends `{ id, quantity }[]`;
 * everything is re-resolved server-side (forged / disabled / cross-product /
 * over-limit add-ons are rejected). An empty array clears the line's add-ons.
 */
export async function updateCartItemAddons(
  consumerId: string,
  itemId: string,
  addons: Array<{ id?: unknown; quantity?: unknown }>,
): Promise<{ cart: CommerceCart; totals: CommerceCartTotals }> {
  const cart = await getOrCreateCart(consumerId);
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new CommerceError('Cart item not found', 404);
  if (item.listingType !== 'product') {
    throw new CommerceError('Add-ons apply to product cart items only', 400);
  }
  const resolved = await resolveAddonsForProduct(item.listingId, addons);
  item.addons = resolved.length ? resolved : undefined;
  item.updatedAt = nowIso();
  cart.updatedAt = nowIso();
  const saved = await commerceStore.upsertCart(cart);
  emitCart('CartUpdated', saved.id, consumerId, { cartId: saved.id, itemId, addons: resolved.length });
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

/**
 * Re-resolve live prices for all items (server authority): base or variant price,
 * MRP, variant SKU, and each add-on line re-priced from the canonical listing.
 * Add-ons that have since been disabled / deleted are dropped from the line so
 * the cart never shows a stale/unpurchasable extra (checkout re-checks too).
 */
export async function refreshCartPrices(cart: CommerceCart): Promise<CommerceCart> {
  for (const item of cart.items) {
    if (item.listingType === 'product') {
      const product = await catalogStore.getProduct(item.listingId);
      if (product) {
        item.unitPrice = product.price;
        item.originalUnitPrice = product.originalPrice;
        if (item.variantId) {
          const rv = await resolveVariantPricing(
            product.id,
            item.variantId,
            product.price,
            product.originalPrice,
          );
          if (rv) {
            item.unitPrice = rv.unitPrice;
            item.originalUnitPrice = rv.originalUnitPrice;
            item.variantSku = rv.sku;
          }
        }
        if (item.addons?.length) {
          const still: CommerceAddonLine[] = [];
          for (const a of item.addons) {
            try {
              const [re] = await resolveAddonsForProduct(product.id, [
                { id: a.id, quantity: a.quantity },
              ]);
              if (re) still.push(re);
            } catch {
              /* add-on gone / disabled / over-limit — drop it from the cart line */
            }
          }
          item.addons = still.length ? still : undefined;
        }
      }
    } else {
      const service = await getService(item.listingId);
      if (service) item.unitPrice = service.price;
    }
    item.updatedAt = nowIso();
  }
  cart.updatedAt = nowIso();
  return commerceStore.upsertCart(cart);
}
