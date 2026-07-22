/**
 * Post-order buyer↔seller conversation expiry.
 * Does NOT apply to pre-order booking-request threads (those use 24h seller / 8h payment timers).
 */

export type ServiceCategoryKey =
  | 'hotels'
  | 'restaurants'
  | 'travel'
  | 'doctors'
  | 'education'
  | 'beauty'
  | 'real_estate'
  | 'transport';

/** Canonical “service ends / checkout” date field per category (from bookingFieldConfig). */
export const SERVICE_CONVERSATION_END_DATE_KEY: Record<ServiceCategoryKey, string> = {
  hotels: 'checkOutDate',
  restaurants: 'reservationDate',
  travel: 'travelDate',
  doctors: 'appointmentDate',
  education: 'preferredStartDate',
  beauty: 'appointmentDate',
  real_estate: 'viewingDate',
  transport: 'pickupDate',
};

export const CONVERSATION_EXPIRY_WARNING_HOURS = 24;

export type ConversationExpiryStatus = 'open' | 'closed' | 'not_applicable';

export interface ConversationExpiryResult {
  status: ConversationExpiryStatus;
  /** Why the conversation is closed / how it will close */
  reason?: string;
  /** ISO timestamp when replies stop (services); omitted for status-based product closes */
  closesAt?: string;
  /** Milliseconds until close when still open and closesAt is known */
  msRemaining?: number;
  /** True when open and within the warning window before closesAt */
  showWarning?: boolean;
  warningLabel?: string;
  /** Persistent notice shown while the conversation is still open */
  freezeNotice?: string;
  closedLabel?: string;
  kind?: 'physical' | 'service';
}

type OrderLikeItem = {
  productType?: 'physical' | 'service';
  serviceCategory?: string;
  serviceDetails?: Record<string, string | number>;
};

type OrderLikeSub = {
  trackingStatus?: string;
  items?: OrderLikeItem[];
};

export type OrderLikeForExpiry = {
  orderId?: string;
  status?: string;
  cancelledAt?: string;
  subOrders?: OrderLikeSub[];
};

function normalizeCategory(raw?: string): ServiceCategoryKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, ServiceCategoryKey> = {
    hotel: 'hotels',
    hotels: 'hotels',
    restaurant: 'restaurants',
    restaurants: 'restaurants',
    travel: 'travel',
    doctor: 'doctors',
    doctors: 'doctors',
    healthcare: 'doctors',
    education: 'education',
    beauty: 'beauty',
    salon: 'beauty',
    real_estate: 'real_estate',
    realestate: 'real_estate',
    property: 'real_estate',
    transport: 'transport',
  };
  return aliases[key] ?? null;
}

function parseYmd(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Format in BD calendar day
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

/**
 * 11:59:59.999 PM Asia/Dhaka on the given calendar date.
 * Dhaka is UTC+6 year-round (no DST) → 17:59:59.999 UTC same Y-M-D.
 */
export function bangladeshEndOfDayIso(dateYmd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d, 17, 59, 59, 999)).toISOString();
}

function formatHoursRemaining(ms: number): string {
  const hours = Math.max(0, Math.ceil(ms / (60 * 60 * 1000)));
  if (hours <= 1) return 'about 1 hour';
  if (hours < 48) return `${hours} hours`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? 'about 1 day' : `${days} days`;
}

function collectItems(order: OrderLikeForExpiry): OrderLikeItem[] {
  return (order.subOrders || []).flatMap((sub) => sub.items || []);
}

function isServiceOrder(order: OrderLikeForExpiry): boolean {
  return collectItems(order).some((item) => item.productType === 'service');
}

function resolveServiceClosesAt(order: OrderLikeForExpiry): string | null {
  const serviceItem = collectItems(order).find((item) => item.productType === 'service');
  if (!serviceItem) return null;
  const category = normalizeCategory(serviceItem.serviceCategory);
  const details = serviceItem.serviceDetails || {};
  const preferredKey = category ? SERVICE_CONVERSATION_END_DATE_KEY[category] : null;
  const candidates = [
    preferredKey ? details[preferredKey] : undefined,
    details.checkOutDate,
    details.reservationDate,
    details.travelDate,
    details.appointmentDate,
    details.preferredStartDate,
    details.viewingDate,
    details.pickupDate,
  ];
  for (const candidate of candidates) {
    const ymd = parseYmd(candidate);
    if (!ymd) continue;
    const iso = bangladeshEndOfDayIso(ymd);
    if (iso) return iso;
  }
  return null;
}

function isPhysicalConversationClosed(order: OrderLikeForExpiry): boolean {
  if (order.status === 'cancelled' || order.cancelledAt) return true;
  if (order.status === 'completed') return true;
  const subs = order.subOrders || [];
  if (subs.length === 0) return false;
  return subs.every((sub) => sub.trackingStatus === 'delivered');
}

function formatBdServiceDate(closesAtIso: string): string {
  try {
    return new Date(closesAtIso).toLocaleDateString('en-BD', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return closesAtIso.slice(0, 10);
  }
}

function physicalFreezeNotice(): string {
  return 'This conversation will freeze/close after the order is delivered or cancelled.';
}

function serviceFreezeNotice(closesAt?: string | null): string {
  if (closesAt) {
    return `This conversation will freeze/close at 11:59 PM Bangladesh time on ${formatBdServiceDate(closesAt)}.`;
  }
  return 'This conversation will freeze/close at 11:59 PM Bangladesh time on the service date.';
}

/** Pull seller id from thread ids like `thread-{sellerId}` or `seller-{sellerId}`. */
export function extractSellerIdFromThreadId(threadId?: string | null): string | null {
  if (!threadId) return null;
  if (threadId.startsWith('thread-')) {
    const id = threadId.slice('thread-'.length).trim();
    return id || null;
  }
  if (threadId.startsWith('seller-')) {
    const id = threadId.slice('seller-'.length).trim();
    return id || null;
  }
  return null;
}

function sellerIdsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;
  if (na === `seller-${nb}` || nb === `seller-${na}`) return true;
  if (na.replace(/^seller-/, '') === nb.replace(/^seller-/, '')) return true;
  return false;
}

type ThreadLikeForOrder = {
  id?: string;
  orderRef?: string;
  type?: string;
};

type OrderWithSeller = OrderLikeForExpiry & {
  bookingRequestId?: string;
  createdAt?: string;
  subOrders?: Array<OrderLikeSub & { sellerId?: string }>;
};

/**
 * Resolve the order that drives post-order freeze rules for a message thread.
 * Matches orderRef first, then the newest open (else newest) order for the thread's seller.
 */
export function resolveOrderForMessageThread(
  thread: ThreadLikeForOrder | null | undefined,
  orders: OrderWithSeller[] | null | undefined,
): OrderWithSeller | null {
  if (!thread || !orders?.length) return null;

  const ref = thread.orderRef?.trim();
  if (ref) {
    const byRef =
      orders.find((o) => o.orderId === ref) ||
      orders.find((o) => o.bookingRequestId && o.bookingRequestId === ref);
    if (byRef) return byRef;
  }

  const sellerId = extractSellerIdFromThreadId(thread.id);
  const looksPostOrder =
    thread.type === 'retail' ||
    Boolean(ref) ||
    Boolean(sellerId && (thread.id?.startsWith('thread-') || thread.id?.startsWith('seller-')));
  if (!sellerId || !looksPostOrder) return null;

  const matching = orders
    .filter((o) => (o.subOrders || []).some((sub) => sellerIdsMatch(sub.sellerId, sellerId)))
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

  if (matching.length === 0) return null;
  const open = matching.find((o) => evaluatePostOrderConversationExpiry(o).status === 'open');
  return open || matching[0] || null;
}

/**
 * Evaluate post-order conversation reply eligibility.
 * Pass `null` / undefined when there is no linked order (pre-order / general) → not_applicable.
 */
export function evaluatePostOrderConversationExpiry(
  order: OrderLikeForExpiry | null | undefined,
  nowMs: number = Date.now(),
): ConversationExpiryResult {
  if (!order?.orderId && !order?.status && !(order?.subOrders && order.subOrders.length)) {
    return { status: 'not_applicable' };
  }
  if (!order) return { status: 'not_applicable' };

  if (isServiceOrder(order)) {
    if (order.status === 'cancelled' || order.cancelledAt) {
      return {
        status: 'closed',
        kind: 'service',
        reason: 'cancelled',
        closedLabel: 'This conversation has ended',
      };
    }
    const closesAt = resolveServiceClosesAt(order);
    if (!closesAt) {
      return {
        status: 'open',
        kind: 'service',
        freezeNotice: serviceFreezeNotice(null),
      };
    }
    const closesAtMs = new Date(closesAt).getTime();
    const msRemaining = closesAtMs - nowMs;
    if (msRemaining <= 0) {
      return {
        status: 'closed',
        kind: 'service',
        reason: 'service_date_passed',
        closesAt,
        closedLabel: 'This conversation has ended',
      };
    }
    const warningMs = CONVERSATION_EXPIRY_WARNING_HOURS * 60 * 60 * 1000;
    const showWarning = msRemaining <= warningMs;
    return {
      status: 'open',
      kind: 'service',
      closesAt,
      msRemaining,
      freezeNotice: serviceFreezeNotice(closesAt),
      showWarning,
      warningLabel: showWarning
        ? `This conversation closes in ${formatHoursRemaining(msRemaining)}`
        : undefined,
    };
  }

  // Physical / retail products
  if (isPhysicalConversationClosed(order)) {
    const reason =
      order.status === 'cancelled' || order.cancelledAt ? 'cancelled' : 'delivered';
    return {
      status: 'closed',
      kind: 'physical',
      reason,
      closedLabel: 'This conversation has ended',
    };
  }

  return {
    status: 'open',
    kind: 'physical',
    freezeNotice: physicalFreezeNotice(),
  };
}

export function isPostOrderReplyAllowed(
  order: OrderLikeForExpiry | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const result = evaluatePostOrderConversationExpiry(order, nowMs);
  return result.status !== 'closed';
}
