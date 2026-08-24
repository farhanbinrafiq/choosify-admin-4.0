/**
 * Server-authoritative inventory via catalogStore (Firestore or memory-disk).
 *
 * Source of truth: CatalogInventory records.
 * product.stock is a denormalized cache (see syncProductStockFromInventory).
 */

import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type { CatalogInventory } from '../../lib/vercel-catalog/catalogTypes';
import type { CatalogProduct } from '../../src/types/catalog';
import {
  applyInventoryLifecycleCoupling,
  deriveInventoryState,
} from './productLifecycle';

export type CatalogInventoryState = CatalogInventory['inventoryState'];
export type CatalogInventoryRecord = CatalogInventory;

export function inventoryRecordId(productId: string, variantId?: string | null): string {
  return variantId ? `inv__${productId}__${variantId}` : `inv__${productId}__product`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function recompute(record: CatalogInventoryRecord): CatalogInventoryRecord {
  const reserved = Math.max(0, Math.floor(record.reservedQuantity));
  const quantity = Math.floor(record.quantity);
  const available = Math.max(0, quantity - reserved);
  return {
    ...record,
    quantity,
    reservedQuantity: reserved,
    availableQuantity: available,
    inventoryState:
      record.inventoryState === 'archived'
        ? 'archived'
        : deriveInventoryState(available, record.lowStockThreshold),
    updatedAt: nowIso(),
  };
}

export async function getInventoryRecord(
  productId: string,
  variantId?: string | null,
): Promise<CatalogInventoryRecord | null> {
  return catalogStore.getInventory(inventoryRecordId(productId, variantId));
}

export async function listInventoryForProduct(
  productId: string,
): Promise<CatalogInventoryRecord[]> {
  const all = await catalogStore.listInventory();
  return all.filter((r) => r.productId === productId);
}

export async function ensureInventoryRecord(input: {
  productId: string;
  variantId?: string;
  sku?: string;
  quantity: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  warehouseId?: string | null;
}): Promise<CatalogInventoryRecord> {
  const id = inventoryRecordId(input.productId, input.variantId);
  const existing = await catalogStore.getInventory(id);
  if (existing) {
    const next = recompute({
      ...existing,
      sku: input.sku ?? existing.sku,
      quantity: input.quantity,
      reservedQuantity: input.reservedQuantity ?? existing.reservedQuantity,
      lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
      warehouseId: input.warehouseId !== undefined ? input.warehouseId : existing.warehouseId,
    });
    return catalogStore.upsertInventory(next);
  }
  const created = recompute({
    id,
    productId: input.productId,
    variantId: input.variantId,
    sku: input.sku,
    quantity: Math.max(0, Math.floor(input.quantity)),
    reservedQuantity: Math.max(0, Math.floor(input.reservedQuantity ?? 0)),
    availableQuantity: 0,
    lowStockThreshold: input.lowStockThreshold ?? 5,
    inventoryState: 'in_stock',
    warehouseId: input.warehouseId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return catalogStore.upsertInventory(created);
}

export class InventoryValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

export async function adjustInventory(input: {
  productId: string;
  variantId?: string;
  sku?: string;
  quantity?: number;
  delta?: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  warehouseId?: string | null;
  allowNegative?: boolean;
}): Promise<CatalogInventoryRecord> {
  const id = inventoryRecordId(input.productId, input.variantId);
  let current = await catalogStore.getInventory(id);
  if (!current) {
    current = await ensureInventoryRecord({
      productId: input.productId,
      variantId: input.variantId,
      sku: input.sku,
      quantity: 0,
    });
  }

  let nextQuantity = current.quantity;
  if (typeof input.quantity === 'number' && Number.isFinite(input.quantity)) {
    nextQuantity = Math.floor(input.quantity);
  } else if (typeof input.delta === 'number' && Number.isFinite(input.delta)) {
    nextQuantity = Math.floor(current.quantity + input.delta);
  }

  if (!input.allowNegative && nextQuantity < 0) {
    throw new InventoryValidationError('Inventory quantity cannot be negative');
  }

  const reserved =
    typeof input.reservedQuantity === 'number' && Number.isFinite(input.reservedQuantity)
      ? Math.floor(input.reservedQuantity)
      : current.reservedQuantity;

  if (reserved < 0) {
    throw new InventoryValidationError('Reserved quantity cannot be negative');
  }
  if (reserved > nextQuantity && !input.allowNegative) {
    throw new InventoryValidationError('Reserved quantity cannot exceed on-hand quantity');
  }

  const next = recompute({
    ...current,
    sku: input.sku ?? current.sku,
    quantity: nextQuantity,
    reservedQuantity: reserved,
    lowStockThreshold: input.lowStockThreshold ?? current.lowStockThreshold,
    warehouseId: input.warehouseId !== undefined ? input.warehouseId : current.warehouseId,
  });
  return catalogStore.upsertInventory(next);
}

/**
 * Denormalize product.stock from inventory SoT.
 * - If any variant inventory rows exist: product.stock = sum(variant availableQuantity)
 * - Else: product.stock = product-level availableQuantity
 * Lifecycle: only Active ↔ OutOfStock from stock; never unsuspend/unarchive.
 */
export async function syncProductStockFromInventory(
  productId: string,
): Promise<CatalogProduct | null> {
  const product = await catalogStore.getProduct(productId);
  if (!product) return null;

  const records = await listInventoryForProduct(productId);
  const variantRows = records.filter((r) => Boolean(r.variantId));
  const productRow = records.find((r) => !r.variantId);

  let available = 0;
  if (variantRows.length > 0) {
    available = variantRows.reduce((sum, r) => sum + r.availableQuantity, 0);
  } else if (productRow) {
    available = productRow.availableQuantity;
  } else {
    available = Math.max(0, product.stock);
  }

  const nextStatus = applyInventoryLifecycleCoupling(product.status, available);
  const saved = await catalogStore.upsertProduct({
    ...product,
    stock: available,
    status: nextStatus as CatalogProduct['status'],
    updatedAt: nowIso(),
  });
  return saved;
}

/**
 * Sprint 5 (QA3-001): getInventoryRecord()/adjustInventory() are each a
 * separate `await`, so a read-check-write sequence built from them has a
 * TOCTOU gap -- Node yields control at every await boundary regardless of
 * whether the underlying memory-disk work is itself synchronous, so two
 * concurrent requests for the same product can both read the same
 * "available" value before either writes back. The Commerce engine's own
 * reserveProductInventory() has this same gap today (unmodified this
 * sprint -- out of scope; see the audit report). There is no real
 * cross-process transaction available in the current memory-disk/JSON-
 * snapshot architecture, but Choosify runs as a single Node process (no
 * clustering), so a per-key in-process mutex is a complete fix for the
 * concurrency that can actually occur in production today. Empirically
 * verified in Sprint 5's concurrency test (concurrent last-unit requests).
 */
const inventoryLocks = new Map<string, Promise<unknown>>();

async function withInventoryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = inventoryLocks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  inventoryLocks.set(key, prior.then(() => next));
  await prior;
  try {
    return await fn();
  } finally {
    release();
    if (inventoryLocks.get(key) === next) inventoryLocks.delete(key);
  }
}

export type ReserveInventoryResult =
  | { ok: true; record: CatalogInventoryRecord }
  | { ok: false; available: number };

/**
 * Atomically (within this process) reserves `quantity` against a product's
 * availableQuantity, lazily seeding the inventory record from product.stock
 * on first-ever reservation -- the same seeding behavior
 * checkoutService.ts's reserveProductInventory() already uses, reused here
 * rather than a separate backfill script. Returns { ok: false } instead of
 * throwing so callers can build a clean 409 without a try/catch per call.
 */
export async function reserveInventoryQuantity(input: {
  productId: string;
  variantId?: string;
  quantity: number;
}): Promise<ReserveInventoryResult> {
  const key = inventoryRecordId(input.productId, input.variantId);
  return withInventoryLock<ReserveInventoryResult>(key, async () => {
    const existing = await getInventoryRecord(input.productId, input.variantId);
    if (!existing) {
      const product = await catalogStore.getProduct(input.productId);
      const seedQty = Math.max(0, Math.floor(product?.stock ?? 0));
      if (input.quantity > seedQty) {
        return { ok: false, available: seedQty };
      }
      const record = await ensureInventoryRecord({
        productId: input.productId,
        variantId: input.variantId,
        quantity: seedQty,
        reservedQuantity: input.quantity,
      });
      await syncProductStockFromInventory(input.productId);
      return { ok: true, record };
    }
    if (input.quantity > existing.availableQuantity) {
      return { ok: false, available: existing.availableQuantity };
    }
    const record = await adjustInventory({
      productId: input.productId,
      variantId: input.variantId,
      reservedQuantity: existing.reservedQuantity + input.quantity,
    });
    await syncProductStockFromInventory(input.productId);
    return { ok: true, record };
  });
}

/** Releases a previously-reserved quantity (cancel / creation-failure compensation). quantity unchanged, reservedQuantity only. */
export async function releaseInventoryQuantity(input: {
  productId: string;
  variantId?: string;
  quantity: number;
}): Promise<CatalogInventoryRecord | null> {
  const key = inventoryRecordId(input.productId, input.variantId);
  return withInventoryLock(key, async () => {
    const existing = await getInventoryRecord(input.productId, input.variantId);
    if (!existing) return null;
    const record = await adjustInventory({
      productId: input.productId,
      variantId: input.variantId,
      reservedQuantity: Math.max(0, existing.reservedQuantity - input.quantity),
    });
    await syncProductStockFromInventory(input.productId);
    return record;
  });
}

/** Converts a reservation into sold stock: quantity -= n AND reservedQuantity -= n. */
export async function consumeInventoryQuantity(input: {
  productId: string;
  variantId?: string;
  quantity: number;
}): Promise<CatalogInventoryRecord | null> {
  const key = inventoryRecordId(input.productId, input.variantId);
  return withInventoryLock(key, async () => {
    const existing = await getInventoryRecord(input.productId, input.variantId);
    if (!existing) return null;
    const nextQuantity = Math.max(0, existing.quantity - input.quantity);
    const nextReserved = Math.max(0, existing.reservedQuantity - input.quantity);
    const record = await adjustInventory({
      productId: input.productId,
      variantId: input.variantId,
      quantity: nextQuantity,
      reservedQuantity: Math.min(nextReserved, nextQuantity),
    });
    await syncProductStockFromInventory(input.productId);
    return record;
  });
}

/** Test helper — clears inventory collection (memory-disk / firestore). */
export async function __resetInventoryStoreForTests(): Promise<void> {
  const all = await catalogStore.listInventory();
  await Promise.all(all.map((r) => catalogStore.deleteInventory(r.id)));
}
