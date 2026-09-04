/**
 * Canonical invoice-number assignment for REGULAR product-checkout sub-orders.
 *
 * Booking/service orders (server/booking/bookingService.ts `makeInvoiceId`) and
 * manual seller-offer orders (server/operationsRouter.ts
 * `makeManualOfferInvoiceId`) already mint an invoiceId at creation time and are
 * DELIBERATELY left untouched here — changing those call sites would touch
 * booking/manual-order creation flows that are out of scope for this change.
 *
 * Regular checkout sub-orders (recomputeOrderPricingServerSide) never receive
 * an invoiceId at any lifecycle stage today — that's the actual product gap.
 * This module closes it with a LAZY, idempotent, concurrency-safe assignment:
 * the first time an authorized, eligible request actually asks for the
 * invoice, a real number is minted once and persisted; every request after
 * that (and every historical order already sitting with invoiceId = null)
 * gets the same number back forever.
 *
 * Why lazy instead of "at order confirmation": confirmation is a lifecycle
 * transition handled deep in the existing order-status code paths, which are
 * explicitly off-limits for this change (regression risk to confirm/cancel/
 * inventory-adjacent logic). Lazy assignment needs no lifecycle hook, handles
 * the historical backlog with the SAME code path (no separate backfill
 * script), and naturally excludes ineligible/incomplete orders because the
 * caller (the invoice route) only calls this after its own eligibility check.
 *
 * Uses the SAME canonical reference-id allocator as every other Choosify
 * reference id (CF/BR/PR/OR/…) — server/referenceIds/referenceIdService.ts —
 * so there is one atomic, unique, sequential generator, not a second
 * `Math.random()` scheme. The counter table (`choosify_reference_id_counters`)
 * already exists (migration-free) and already provisions an 'invoice' row.
 */
import { operationsStore } from './operationsStore';
import { allocateReferenceId, registerReferenceAssignment } from '../referenceIds/referenceIdService';
import { Logger } from '../lib/logger';

type LooseSubOrder = {
  sellerId?: string;
  invoiceId?: string;
  deliveryFee?: unknown;
  items?: Array<{ price?: unknown; quantity?: unknown }>;
};

const ELIGIBLE_STATUSES = new Set(['active', 'confirmed', 'completed']);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Same completeness rule as the client's buildInvoiceViewModel — never trusts
 *  a client-supplied "it's fine" flag; the server independently verifies before
 *  ever persisting a real invoice number. */
function subOrderFinancialsComplete(sub: LooseSubOrder): boolean {
  const deliveryOk = isFiniteNumber(sub.deliveryFee);
  const itemsOk = (sub.items || []).every((it) => isFiniteNumber(it.price) && isFiniteNumber(it.quantity));
  return deliveryOk && itemsOk;
}

export type EnsureInvoiceResult = {
  eligible: boolean;
  invoiceId?: string;
  created?: boolean;
  reason?: 'not_found' | 'not_eligible_status' | 'incomplete_data';
};

// Per (orderId, sellerId) async lock — a second concurrent request for the
// SAME sub-order waits for the first to finish and returns its exact result,
// instead of both racing the allocator and disagreeing on the final number.
const locks = new Map<string, Promise<unknown>>();

async function withSubOrderLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === undefined) {
      /* no-op, kept for symmetry */
    }
  }
}

/**
 * Ensures the given sub-order has a real invoice number, minting one exactly
 * once if eligible and none exists yet. Never reassigns an existing
 * invoiceId. Returns `eligible:false` (never throws) for a cancelled/pending
 * order or one whose financial data can't be resolved (malformed fixture) —
 * the caller must not present a document in that case.
 */
export async function ensureSubOrderInvoiceNumber(
  orderId: string,
  sellerId: string,
): Promise<EnsureInvoiceResult> {
  const key = `${orderId}::${sellerId}`;
  return withSubOrderLock(key, async () => {
    const order = operationsStore.getOrder(orderId);
    if (!order) return { eligible: false, reason: 'not_found' };
    const subOrders = (order.subOrders || []) as LooseSubOrder[];
    const idx = subOrders.findIndex((s) => s.sellerId === sellerId);
    if (idx < 0) return { eligible: false, reason: 'not_found' };
    const sub = subOrders[idx];

    // Already assigned (booking/manual-offer at creation, or a prior lazy
    // assignment) — idempotent, always return the same number, no re-check.
    if (sub.invoiceId) {
      return { eligible: true, invoiceId: sub.invoiceId, created: false };
    }

    if (!ELIGIBLE_STATUSES.has(order.status)) {
      return { eligible: false, reason: 'not_eligible_status' };
    }
    if (!subOrderFinancialsComplete(sub)) {
      return { eligible: false, reason: 'incomplete_data' };
    }

    const invoiceId = await allocateReferenceId('invoice');
    registerReferenceAssignment('invoice', invoiceId, `${orderId}:${sellerId}`);

    const nextSubOrders = subOrders.map((s, i) => (i === idx ? { ...s, invoiceId } : s));
    operationsStore.updateOrder(orderId, { subOrders: nextSubOrders } as never);

    Logger.audit('operations.invoice_number_assigned', { orderId, sellerId, invoiceId });
    return { eligible: true, invoiceId, created: true };
  });
}
