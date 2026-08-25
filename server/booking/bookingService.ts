import {
  BOOKING_PAYMENT_WINDOW_HOURS,
  BOOKING_SELLER_RESPONSE_HOURS,
  normalizeServiceCategory,
} from '../../shared/booking/bookingFieldConfig';
import type { BookingOfferCard, BookingRequest } from '../../shared/booking/bookingTypes';
import { toBookingOfferCard } from '../../shared/booking/bookingTypes';
import type { OpsStorefrontOrder } from '../operations/types';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import { catalogStore } from '../catalogStore';
import {
  getBookingRequest,
  listExpirableBookingRequests,
  saveBookingRequest,
} from './bookingStore';
import { submitPlatformMessage } from '../operations/platformMessagingBridge';

const nowIso = () => new Date().toISOString();

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeInvoiceId(): string {
  return `INV-${Math.floor(100000 + Math.random() * 900000)}`;
}

/** Builds the pending-payment order for a booking request — shared by accept, buyer-accept-counter, and auto-approve. */
function buildOrderFromRequest(
  request: Pick<
    BookingRequest,
    'buyerId' | 'sellerId' | 'sellerName' | 'listingId' | 'listingTitle' | 'price' | 'isService' | 'serviceCategory' | 'fields' | 'id'
  >,
  ts: string,
): { order: OpsStorefrontOrder; buyerPayBy: string; orderId: string; invoiceId: string } {
  const buyerPayBy = hoursFromNow(BOOKING_PAYMENT_WINDOW_HOURS);
  const orderId = `BOOK-${Date.now()}`;
  const invoiceId = makeInvoiceId();

  const order: OpsStorefrontOrder = {
    id: orderId,
    orderId,
    buyerId: request.buyerId,
    isCOD: false,
    isSplit: false,
    overallTotal: request.price,
    subtotal: request.price,
    deliveryTotal: 0,
    subOrders: [
      {
        sellerId: request.sellerId,
        sellerBusinessName: request.sellerName,
        invoiceId,
        deliveryFee: 0,
        items: [
          {
            // Every other order-creation path (recomputeOrderPricingServerSide
            // in operationsRouter.ts) assigns itemId at creation; this one
            // didn't, which silently made every booking-derived order
            // impossible to mark delivered (findOrderItem matches on
            // itemId). Same generation pattern as that path.
            itemId: `item-${Date.now().toString(36)}-0`,
            productId: request.listingId,
            productTitle: request.listingTitle,
            quantity: 1,
            price: request.price,
            productType: request.isService ? 'service' : 'physical',
            serviceCategory: request.serviceCategory,
            serviceDetails: request.fields,
          },
        ],
      },
    ],
    sourceMode: 'retail',
    paymentMethod: 'credit',
    status: 'pending_payment',
    bookingRequestId: request.id,
    paymentDueAt: buyerPayBy,
    createdAt: ts,
    updatedAt: ts,
  };

  return { order, buyerPayBy, orderId, invoiceId };
}

/**
 * Whether a new booking request for this listing should skip manual seller acceptance.
 * The listing's own `requiresApproval` wins when explicitly set; otherwise falls back
 * to the seller's account-wide default (off unless the seller opted in).
 */
export async function resolveAutoApprove(sellerId: string, listingId: string): Promise<boolean> {
  const product = await catalogStore.getProduct(listingId).catch(() => null);
  if (product && typeof product.requiresApproval === 'boolean') {
    return product.requiresApproval === false;
  }
  const settings = operationsStore.getSellerBookingSettings(sellerId);
  return Boolean(settings.autoApproveBookingsDefault);
}

/**
 * Whether this listing lets the buyer pay a deposit now with the rest due later, and at
 * what percent. Gated by the platform-wide `partialPaymentEnabled` switch — if the super
 * admin has turned the feature off platform-wide, no listing can offer it regardless of
 * its own setting.
 */
export async function resolvePartialPaymentSettings(
  listingId: string,
): Promise<{ partialPaymentEnabled: boolean; depositPercent?: number }> {
  const platform = operationsStore.getPaymentOptionsConfig();
  if (!platform.partialPaymentEnabled) return { partialPaymentEnabled: false };

  const product = await catalogStore.getProduct(listingId).catch(() => null);
  if (!product?.partialPaymentEnabled) return { partialPaymentEnabled: false };

  const depositPercent = Math.min(
    Math.max(Number(product.depositPercent || platform.minDepositPercent), platform.minDepositPercent),
    platform.maxDepositPercent,
  );
  return { partialPaymentEnabled: true, depositPercent };
}

export interface CreateBookingRequestInput {
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  listingHref?: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName?: string;
  serviceCategory?: string;
  isService?: boolean;
  fields: Record<string, string | number>;
  notes?: string;
  price: number;
  originalPrice?: number;
  conversationId?: string;
  threadId?: string;
  /** Listing (or seller default) is configured to skip manual seller acceptance. */
  autoApprove?: boolean;
  /** Listing allows a deposit-now/rest-later payment, per `resolvePartialPaymentSettings`. */
  partialPaymentEnabled?: boolean;
  depositPercent?: number;
}

async function notifyBuyer(buyerId: string, buyerName: string | undefined, body: string, orderId?: string) {
  try {
    await submitPlatformMessage({
      buyerId,
      userName: buyerName || buyerId,
      body,
      orderId,
    });
  } catch (err) {
    console.warn('[Booking] Buyer notify failed:', err);
  }
}

async function notifySeller(sellerId: string, sellerName: string | undefined, body: string, orderId?: string) {
  try {
    await submitPlatformMessage({
      buyerId: sellerId,
      userName: sellerName || sellerId,
      body,
      orderId,
    });
  } catch (err) {
    console.warn('[Booking] Seller notify failed:', err);
  }
}

export async function createBookingRequest(
  input: CreateBookingRequestInput,
): Promise<{ request: BookingRequest; offer: BookingOfferCard; order?: OpsStorefrontOrder }> {
  const ts = nowIso();
  const id = `BOOK-REQ-${Date.now()}`;
  const isService = input.isService ?? true;
  const price = Number(input.price) || 0;

  const base: BookingRequest = {
    id,
    kind: 'booking_offer',
    version: 1,
    conversationId: input.conversationId || `conv_platform_${input.buyerId}`,
    threadId: input.threadId,
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    listingImage: input.listingImage,
    listingHref: input.listingHref || `/products/${input.listingId}`,
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    buyerId: input.buyerId,
    buyerName: input.buyerName,
    serviceCategory: input.serviceCategory
      ? normalizeServiceCategory(input.serviceCategory)
      : undefined,
    isService,
    fields: input.fields || {},
    notes: input.notes,
    price,
    originalPrice: input.originalPrice,
    currency: 'BDT',
    status: 'pending',
    createdAt: ts,
    updatedAt: ts,
    partialPaymentEnabled: input.partialPaymentEnabled,
    depositPercent: input.depositPercent,
    sellerRespondBy: hoursFromNow(BOOKING_SELLER_RESPONSE_HOURS),
    versions: [
      {
        version: 1,
        price,
        fields: input.fields || {},
        notes: input.notes,
        status: 'pending',
        changedAt: ts,
        changedBy: 'buyer',
      },
    ],
  };

  if (!input.autoApprove) {
    await saveBookingRequest(base);
    return { request: base, offer: toBookingOfferCard(base) };
  }

  // Listing (or seller default) skips manual acceptance — go straight to accepted + order.
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(base, ts);
  operationsStore.createOrder(order);
  scheduleOperationsPersist();

  const accepted: BookingRequest = {
    ...base,
    version: 2,
    status: 'accepted',
    autoApproved: true,
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...base.versions,
      {
        version: 2,
        price,
        fields: base.fields,
        notes: base.notes,
        status: 'accepted',
        changedAt: ts,
        changedBy: 'system',
      },
    ],
  };

  await saveBookingRequest(accepted);
  await notifyBuyer(
    accepted.buyerId,
    accepted.buyerName,
    `${accepted.sellerName} has pre-approved instant booking for "${accepted.listingTitle}" — your request is already accepted. Complete payment within ${BOOKING_PAYMENT_WINDOW_HOURS} hours to confirm (order ${orderId}).`,
    orderId,
  );

  return { request: accepted, offer: toBookingOfferCard(accepted), order };
}

export async function acceptBookingRequest(
  id: string,
  actor: { sellerId: string; sellerName?: string },
): Promise<{ request: BookingRequest; offer: BookingOfferCard; order: OpsStorefrontOrder }> {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (existing.sellerId !== actor.sellerId) throw new Error('Only the listing seller can accept');
  if (existing.status !== 'pending' && existing.status !== 'countered') {
    throw new Error(`Cannot accept booking in status ${existing.status}`);
  }

  const ts = nowIso();
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(existing, ts);

  operationsStore.createOrder(order);
  scheduleOperationsPersist();

  const nextVersion = existing.version + 1;
  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'accepted',
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: 'accepted',
        changedAt: ts,
        changedBy: 'seller',
      },
    ],
  };

  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} accepted your booking request for "${existing.listingTitle}". Complete payment within ${BOOKING_PAYMENT_WINDOW_HOURS} hours (order ${orderId}).`,
    orderId,
  );

  return { request: updated, offer: toBookingOfferCard(updated), order };
}

export async function declineBookingRequest(
  id: string,
  actor: { sellerId: string; sellerName?: string },
  declineReason: string,
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const reason = String(declineReason || '').trim();
  if (!reason) throw new Error('declineReason is required');

  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (existing.sellerId !== actor.sellerId) throw new Error('Only the listing seller can decline');
  if (existing.status !== 'pending' && existing.status !== 'countered') {
    throw new Error(`Cannot decline booking in status ${existing.status}`);
  }

  const ts = nowIso();
  const nextVersion = existing.version + 1;
  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'declined',
    declineReason: reason,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: 'declined',
        changedAt: ts,
        changedBy: 'seller',
        declineReason: reason,
      },
    ],
  };

  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} declined your booking request for "${existing.listingTitle}": ${reason}`,
  );

  return { request: updated, offer: toBookingOfferCard(updated) };
}

/**
 * Buyer declines a seller counter-offer, or an already-seller-accepted offer before paying.
 * Reuses status `declined` with `changedBy: 'buyer'` so history is distinguishable from seller declines.
 */
export async function buyerDeclineBookingRequest(
  id: string,
  actor: { buyerId: string },
  declineReason?: string,
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const reason = String(declineReason || '').trim();

  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (existing.buyerId !== actor.buyerId) throw new Error('Only the buyer can decline this offer');
  if (existing.status !== 'countered' && existing.status !== 'accepted') {
    throw new Error(`Cannot buyer-decline booking in status ${existing.status}`);
  }

  const ts = nowIso();
  const nextVersion = existing.version + 1;
  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'declined',
    ...(reason ? { declineReason: reason } : {}),
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        notes: existing.notes,
        status: 'declined',
        changedAt: ts,
        changedBy: 'buyer',
        ...(reason ? { declineReason: reason } : {}),
      },
    ],
  };

  await saveBookingRequest(updated);
  await notifySeller(
    existing.sellerId,
    existing.sellerName,
    `${existing.buyerName || 'Buyer'} declined the booking offer for "${existing.listingTitle}"${
      reason ? `: ${reason}` : ''
    }.`,
    existing.orderId,
  );

  return { request: updated, offer: toBookingOfferCard(updated) };
}

export async function counterBookingRequest(
  id: string,
  actor: { sellerId: string; sellerName?: string },
  patch: {
    price?: number;
    fields?: Record<string, string | number>;
    notes?: string;
  },
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (existing.sellerId !== actor.sellerId) throw new Error('Only the listing seller can modify');
  if (existing.status !== 'pending' && existing.status !== 'countered') {
    throw new Error(`Cannot modify booking in status ${existing.status}`);
  }

  const price = patch.price !== undefined ? Number(patch.price) : existing.price;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid counter-offer price');

  const ts = nowIso();
  const nextVersion = existing.version + 1;
  // Ball moves to buyer — reset a fresh 24h buyer response window (do not keep counting seller's original clock).
  const buyerRespondBy = hoursFromNow(BOOKING_SELLER_RESPONSE_HOURS);
  const fields = { ...existing.fields, ...(patch.fields || {}) };

  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'countered',
    price,
    fields,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    buyerRespondBy,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price,
        fields,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        status: 'countered',
        changedAt: ts,
        changedBy: 'seller',
      },
    ],
  };

  await saveBookingRequest(updated);
  await notifyBuyer(
    existing.buyerId,
    existing.buyerName,
    `${actor.sellerName || existing.sellerName} sent a counter-offer of BDT ${price.toLocaleString()} for "${existing.listingTitle}". Respond within ${BOOKING_SELLER_RESPONSE_HOURS} hours.`,
  );

  return { request: updated, offer: toBookingOfferCard(updated) };
}

export async function buyerAcceptCounter(
  id: string,
  actor: { buyerId: string },
): Promise<{ request: BookingRequest; offer: BookingOfferCard; order: OpsStorefrontOrder }> {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (existing.buyerId !== actor.buyerId) throw new Error('Only the buyer can accept this offer');
  if (existing.status !== 'countered' && existing.status !== 'accepted') {
    throw new Error(`Cannot buyer-accept booking in status ${existing.status}`);
  }

  // If seller already accepted without creating order path via acceptBookingRequest, reuse.
  if (existing.status === 'accepted' && existing.orderId) {
    const order = operationsStore.getOrder(existing.orderId);
    if (order) {
      const ts = nowIso();
      const nextVersion = existing.version + 1;
      const updated: BookingRequest = {
        ...existing,
        version: nextVersion,
        status: 'buyer_accepted',
        updatedAt: ts,
        versions: [
          ...existing.versions,
          {
            version: nextVersion,
            price: existing.price,
            fields: existing.fields,
            status: 'buyer_accepted',
            changedAt: ts,
            changedBy: 'buyer',
          },
        ],
      };
      await saveBookingRequest(updated);
      return { request: updated, offer: toBookingOfferCard(updated), order };
    }
  }

  // Create pending payment order from countered offer (buyer locking in seller's counter).
  const ts = nowIso();
  const { order, buyerPayBy, orderId, invoiceId } = buildOrderFromRequest(existing, ts);

  operationsStore.createOrder(order);
  scheduleOperationsPersist();

  const nextVersion = existing.version + 1;
  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'buyer_accepted',
    buyerPayBy,
    orderId,
    invoiceId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        status: 'buyer_accepted',
        changedAt: ts,
        changedBy: 'buyer',
      },
    ],
  };

  await saveBookingRequest(updated);
  return { request: updated, offer: toBookingOfferCard(updated), order };
}

export async function markBookingPaid(
  id: string,
  orderId?: string,
  paymentType: 'full' | 'partial' = 'full',
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');
  if (paymentType === 'partial' && !existing.partialPaymentEnabled) {
    throw new Error('This listing does not offer partial payment');
  }

  const ts = nowIso();
  const resolvedOrderId = orderId || existing.orderId;
  if (resolvedOrderId) {
    if (paymentType === 'partial' && existing.depositPercent) {
      const depositAmount = Math.round((existing.price * existing.depositPercent) / 100);
      operationsStore.updateOrder(resolvedOrderId, {
        status: 'confirmed',
        paidAt: ts,
        invoiceGeneratedAt: ts,
        isPartialPayment: true,
        depositPercent: existing.depositPercent,
        depositAmount,
        remainingAmount: Math.max(0, existing.price - depositAmount),
      });
    } else {
      operationsStore.updateOrder(resolvedOrderId, {
        status: 'confirmed',
        paidAt: ts,
        invoiceGeneratedAt: ts,
      });
    }
    scheduleOperationsPersist();
  }

  const nextVersion = existing.version + 1;
  const updated: BookingRequest = {
    ...existing,
    version: nextVersion,
    status: 'paid',
    orderId: resolvedOrderId,
    updatedAt: ts,
    versions: [
      ...existing.versions,
      {
        version: nextVersion,
        price: existing.price,
        fields: existing.fields,
        status: 'paid',
        changedAt: ts,
        changedBy: 'buyer',
      },
    ],
  };

  await saveBookingRequest(updated);
  return { request: updated, offer: toBookingOfferCard(updated) };
}

export interface ExpirySweepResult {
  sellerResponseExpired: string[];
  paymentExpired: string[];
  counterExpired: string[];
}

/**
 * Server-side expiry sweep — intended for Vercel Cron.
 * Also safe to call lazily on read paths as a backup.
 */
export async function sweepExpiredBookings(now = Date.now()): Promise<ExpirySweepResult> {
  const result: ExpirySweepResult = {
    sellerResponseExpired: [],
    paymentExpired: [],
    counterExpired: [],
  };

  const active = await listExpirableBookingRequests();

  for (const request of active) {
    const ts = new Date(now).toISOString();

    if (request.status === 'pending' && new Date(request.sellerRespondBy).getTime() <= now) {
      const nextVersion = request.version + 1;
      const updated: BookingRequest = {
        ...request,
        version: nextVersion,
        status: 'expired',
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: 'expired',
            changedAt: ts,
            changedBy: 'system',
          },
        ],
      };
      await saveBookingRequest(updated);
      await notifyBuyer(
        request.buyerId,
        request.buyerName,
        `Your booking request for "${request.listingTitle}" expired because the seller did not respond within ${BOOKING_SELLER_RESPONSE_HOURS} hours.`,
      );
      result.sellerResponseExpired.push(request.id);
      continue;
    }

    if (
      request.status === 'countered' &&
      request.buyerRespondBy &&
      new Date(request.buyerRespondBy).getTime() <= now
    ) {
      const nextVersion = request.version + 1;
      const updated: BookingRequest = {
        ...request,
        version: nextVersion,
        status: 'expired',
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: 'expired',
            changedAt: ts,
            changedBy: 'system',
          },
        ],
      };
      await saveBookingRequest(updated);
      result.counterExpired.push(request.id);
      continue;
    }

    if (
      (request.status === 'accepted' || request.status === 'buyer_accepted') &&
      request.buyerPayBy &&
      new Date(request.buyerPayBy).getTime() <= now
    ) {
      const nextVersion = request.version + 1;
      if (request.orderId) {
        operationsStore.updateOrder(request.orderId, { status: 'cancelled' });
        scheduleOperationsPersist();
      }
      const updated: BookingRequest = {
        ...request,
        version: nextVersion,
        status: 'payment_expired',
        updatedAt: ts,
        versions: [
          ...request.versions,
          {
            version: nextVersion,
            price: request.price,
            fields: request.fields,
            status: 'payment_expired',
            changedAt: ts,
            changedBy: 'system',
          },
        ],
      };
      await saveBookingRequest(updated);
      await notifyBuyer(
        request.buyerId,
        request.buyerName,
        `Payment window expired for "${request.listingTitle}". The pending booking order was cancelled.`,
        request.orderId,
      );
      result.paymentExpired.push(request.id);
    }
  }

  return result;
}
