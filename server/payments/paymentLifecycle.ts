/**
 * ES-005 §34 Payment Lifecycle — centralized transitions.
 * Initiated → Pending → Authorized → Captured
 * Pending → Failed | Cancelled
 */

export type PaymentLifecycleStatus =
  | 'initiated'
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'cancelled';

const FORWARD: Record<string, PaymentLifecycleStatus> = {
  initiated: 'pending',
  pending: 'authorized',
  authorized: 'captured',
};

const FROM_PENDING_FAIL: PaymentLifecycleStatus[] = ['failed', 'cancelled'];

/** Normalize API/UI payment status strings to canonical form. */
export function normalizePaymentStatus(
  raw: string | undefined | null,
): PaymentLifecycleStatus | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, PaymentLifecycleStatus> = {
    initiated: 'initiated',
    pending: 'pending',
    pending_payment: 'pending',
    authorized: 'authorized',
    authorisation: 'authorized',
    authorization: 'authorized',
    captured: 'captured',
    paid: 'captured',
    success: 'captured',
    failed: 'failed',
    fail: 'failed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    cancel: 'cancelled',
  };
  return map[s] ?? null;
}

export function isTerminalPaymentStatus(status: PaymentLifecycleStatus): boolean {
  return status === 'captured' || status === 'failed' || status === 'cancelled';
}

export function canTransitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): boolean {
  if (from === to) return true;
  if (isTerminalPaymentStatus(from)) return false;
  if (FORWARD[from] === to) return true;
  if (from === 'pending' && FROM_PENDING_FAIL.includes(to)) return true;
  if (from === 'initiated' && (to === 'failed' || to === 'cancelled' || to === 'pending')) {
    return true;
  }
  // Abandoned authorization may fail/cancel without capture
  if (from === 'authorized' && (to === 'failed' || to === 'cancelled')) return true;
  return false;
}

/**
 * Apply a single step. For capture flows that skip explicit authorize at the gateway,
 * callers should transition Pending → Authorized then Authorized → Captured.
 */
export function transitionPayment(
  from: PaymentLifecycleStatus,
  to: PaymentLifecycleStatus,
): PaymentLifecycleStatus {
  if (from === to) return from;
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition ${from} → ${to}`);
  }
  return to;
}

/** Advance Pending → Authorized → Captured in one validated capture path. */
export function advanceToCaptured(from: PaymentLifecycleStatus): PaymentLifecycleStatus {
  if (from === 'captured') return 'captured';
  if (from === 'failed' || from === 'cancelled') {
    throw new Error(`Cannot capture payment in terminal status ${from}`);
  }
  let cur: PaymentLifecycleStatus = from;
  if (cur === 'initiated') cur = transitionPayment(cur, 'pending');
  if (cur === 'pending') cur = transitionPayment(cur, 'authorized');
  if (cur === 'authorized') cur = transitionPayment(cur, 'captured');
  return cur;
}
