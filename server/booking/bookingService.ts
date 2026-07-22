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

export async function createBookingRequest(
  input: CreateBookingRequestInput,
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const ts = nowIso();
  const id = `BOOK-REQ-${Date.now()}`;
  const isService = input.isService ?? true;
  const request: BookingRequest = {
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
    price: Number(input.price) || 0,
    originalPrice: input.originalPrice,
    currency: 'BDT',
    status: 'pending',
    createdAt: ts,
    updatedAt: ts,
    sellerRespondBy: hoursFromNow(BOOKING_SELLER_RESPONSE_HOURS),
    versions: [
      {
        version: 1,
        price: Number(input.price) || 0,
        fields: input.fields || {},
        notes: input.notes,
        status: 'pending',
        changedAt: ts,
        changedBy: 'buyer',
      },
    ],
  };

  await saveBookingRequest(request);
  return { request, offer: toBookingOfferCard(request) };
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
  const buyerPayBy = hoursFromNow(BOOKING_PAYMENT_WINDOW_HOURS);
  const orderId = `BOOK-${Date.now()}`;
  const invoiceId = makeInvoiceId();

  const order: OpsStorefrontOrder = {
    id: orderId,
    orderId,
    buyerId: existing.buyerId,
    isCOD: false,
    isSplit: false,
    overallTotal: existing.price,
    subtotal: existing.price,
    deliveryTotal: 0,
    subOrders: [
      {
        sellerId: existing.sellerId,
        sellerBusinessName: existing.sellerName,
        invoiceId,
        deliveryFee: 0,
        items: [
          {
            productId: existing.listingId,
            productTitle: existing.listingTitle,
            quantity: 1,
            price: existing.price,
            productType: existing.isService ? 'service' : 'physical',
            serviceCategory: existing.serviceCategory,
            serviceDetails: existing.fields,
          },
        ],
      },
    ],
    sourceMode: 'retail',
    paymentMethod: 'credit',
    status: 'pending_payment',
    bookingRequestId: existing.id,
    paymentDueAt: buyerPayBy,
    createdAt: ts,
    updatedAt: ts,
  };

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
  const buyerPayBy = hoursFromNow(BOOKING_PAYMENT_WINDOW_HOURS);
  const orderId = `BOOK-${Date.now()}`;
  const invoiceId = makeInvoiceId();

  const order: OpsStorefrontOrder = {
    id: orderId,
    orderId,
    buyerId: existing.buyerId,
    isCOD: false,
    isSplit: false,
    overallTotal: existing.price,
    subtotal: existing.price,
    deliveryTotal: 0,
    subOrders: [
      {
        sellerId: existing.sellerId,
        sellerBusinessName: existing.sellerName,
        invoiceId,
        deliveryFee: 0,
        items: [
          {
            productId: existing.listingId,
            productTitle: existing.listingTitle,
            quantity: 1,
            price: existing.price,
            productType: existing.isService ? 'service' : 'physical',
            serviceCategory: existing.serviceCategory,
            serviceDetails: existing.fields,
          },
        ],
      },
    ],
    sourceMode: 'retail',
    paymentMethod: 'credit',
    status: 'pending_payment',
    bookingRequestId: existing.id,
    paymentDueAt: buyerPayBy,
    createdAt: ts,
    updatedAt: ts,
  };

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
): Promise<{ request: BookingRequest; offer: BookingOfferCard }> {
  const existing = await getBookingRequest(id);
  if (!existing) throw new Error('Booking request not found');

  const ts = nowIso();
  const resolvedOrderId = orderId || existing.orderId;
  if (resolvedOrderId) {
    operationsStore.updateOrder(resolvedOrderId, {
      status: 'confirmed',
      paidAt: ts,
      invoiceGeneratedAt: ts,
    });
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
