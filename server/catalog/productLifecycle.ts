/**
 * Product lifecycle compatibility layer (ES-005 §14–§18 / IS-003 §15).
 *
 * Persisted wire values may still use legacy `live` for Active.
 * New code must go through these helpers — do not scatter `status === 'live'`.
 */

import type { CatalogBrand, CatalogProduct } from '../../src/types/catalog';
import { brandIsMarketplaceVisible } from './sellerWorkspace';

/** Canonical business lifecycle (docs). */
export type ProductLifecycleState =
  | 'draft'
  | 'active'
  | 'out_of_stock'
  | 'suspended'
  | 'archived';

/** Values that may appear on CatalogProduct.status (legacy + canonical). */
export type ProductStatusWire =
  | ProductLifecycleState
  | 'live';

const LIFECYCLE_SET = new Set<string>([
  'draft',
  'active',
  'out_of_stock',
  'suspended',
  'archived',
  'live',
]);

/** Map any persisted/requested status into canonical lifecycle. */
export function normalizeProductLifecycle(status: string | undefined | null): ProductLifecycleState {
  const raw = String(status || 'draft').trim().toLowerCase();
  if (raw === 'live' || raw === 'active' || raw === 'published' || raw === 'available') {
    return 'active';
  }
  if (raw === 'out_of_stock' || raw === 'outofstock' || raw === 'out-of-stock') {
    return 'out_of_stock';
  }
  if (raw === 'suspended') return 'suspended';
  if (raw === 'archived') return 'archived';
  if (raw === 'draft') return 'draft';
  return 'draft';
}

/**
 * Persist Active as legacy `live` so existing public clients keep working.
 * Other states use snake_case wire values.
 */
export function toPersistedProductStatus(lifecycle: ProductLifecycleState): ProductStatusWire {
  if (lifecycle === 'active') return 'live';
  return lifecycle;
}

export function isProductActive(status: string | undefined | null): boolean {
  return normalizeProductLifecycle(status) === 'active';
}

export function isProductOutOfStock(status: string | undefined | null): boolean {
  return normalizeProductLifecycle(status) === 'out_of_stock';
}

/**
 * Public discovery eligibility (ES-005 §15–§17).
 * Active listings are eligible; OutOfStock may remain discoverable (not deleted).
 * Draft / Suspended / Archived are never public.
 */
export function isProductLifecyclePubliclyListable(status: string | undefined | null): boolean {
  const lifecycle = normalizeProductLifecycle(status);
  return lifecycle === 'active' || lifecycle === 'out_of_stock';
}

export function isProductPubliclyEligible(
  product: Pick<CatalogProduct, 'status' | 'brandId'>,
  brand: CatalogBrand | null | undefined,
): boolean {
  if (!brand) return false;
  if (!brandIsMarketplaceVisible(brand)) return false;
  return isProductLifecyclePubliclyListable(product.status);
}

/** Marketplace Access must be granted/restored (or legacy public) before Active publish. */
export function brandAllowsProductPublish(brand: CatalogBrand | null | undefined): boolean {
  if (!brand) return false;
  return brandIsMarketplaceVisible(brand);
}

type TransitionActor = 'seller' | 'admin' | 'system';

/**
 * ES-005 §14 transitions (Restocked/Restored treated as transient → Active).
 * Deleted is handled via hard DELETE route, not status.
 */
const ALLOWED: Record<ProductLifecycleState, ProductLifecycleState[]> = {
  draft: ['active', 'archived'],
  active: ['out_of_stock', 'archived', 'suspended', 'draft'],
  out_of_stock: ['active', 'archived'],
  suspended: ['active', 'archived'],
  archived: ['active', 'draft'],
};

export function canTransitionProductLifecycle(
  fromStatus: string | undefined | null,
  toStatus: string | undefined | null,
  _actor: TransitionActor = 'seller',
): boolean {
  const from = normalizeProductLifecycle(fromStatus);
  const to = normalizeProductLifecycle(toStatus);
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export class ProductLifecycleError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ProductLifecycleError';
  }
}

export function assertProductLifecycleTransition(
  fromStatus: string | undefined | null,
  toStatus: string | undefined | null,
  actor: TransitionActor = 'seller',
): ProductLifecycleState {
  const to = normalizeProductLifecycle(toStatus);
  if (!canTransitionProductLifecycle(fromStatus, toStatus, actor)) {
    const from = normalizeProductLifecycle(fromStatus);
    throw new ProductLifecycleError(
      `Invalid product lifecycle transition: ${from} → ${to}`,
    );
  }
  return to;
}

/** Parse raw status input; unknown values fall back to draft (create) or existing. */
export function parseProductStatusInput(
  raw: unknown,
  existing?: string,
): ProductStatusWire {
  const candidate =
    typeof raw === 'string' && raw.trim()
      ? raw.trim().toLowerCase()
      : existing || 'draft';
  if (!LIFECYCLE_SET.has(candidate) && candidate !== 'published' && candidate !== 'available') {
    return toPersistedProductStatus(normalizeProductLifecycle(existing || 'draft'));
  }
  return toPersistedProductStatus(normalizeProductLifecycle(candidate));
}

/**
 * Stock-driven coupling (ES-005 §17): Active + qty 0 → OutOfStock;
 * OutOfStock + qty > 0 → Active. Never unsuspend/unarchive from stock alone.
 */
export function applyInventoryLifecycleCoupling(
  currentStatus: string | undefined | null,
  availableQuantity: number,
): ProductStatusWire {
  const lifecycle = normalizeProductLifecycle(currentStatus);
  if (availableQuantity <= 0) {
    if (lifecycle === 'active') {
      return toPersistedProductStatus('out_of_stock');
    }
    return toPersistedProductStatus(lifecycle);
  }
  if (lifecycle === 'out_of_stock') {
    return toPersistedProductStatus('active');
  }
  return toPersistedProductStatus(lifecycle);
}

export function deriveInventoryState(
  availableQuantity: number,
  lowStockThreshold = 5,
): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (availableQuantity <= 0) return 'out_of_stock';
  if (availableQuantity < lowStockThreshold) return 'low_stock';
  return 'in_stock';
}
