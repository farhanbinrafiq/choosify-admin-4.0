import type { ServiceCategory } from './bookingFieldConfig';

export type BookingOfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'buyer_accepted'
  | 'buyer_declined'
  | 'expired'
  | 'payment_expired'
  | 'paid';

export interface BookingOfferVersion {
  version: number;
  price: number;
  fields: Record<string, string | number>;
  notes?: string;
  status: BookingOfferStatus;
  changedAt: string;
  changedBy: 'buyer' | 'seller' | 'system';
  declineReason?: string;
}

/**
 * Canonical booking-request document (Firestore `booking_requests`).
 * Message threads embed a snapshot; this collection is the source of truth
 * for accept/decline/counter, expiry cron, and order linkage.
 */
export interface BookingRequest {
  id: string;
  kind: 'booking_offer';
  version: number;
  conversationId: string;
  threadId?: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  listingHref: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName?: string;
  serviceCategory?: ServiceCategory;
  isService: boolean;
  /** Buyer-submitted booking detail fields (keys from SERVICE_BOOKING_FIELDS) */
  fields: Record<string, string | number>;
  notes?: string;
  price: number;
  originalPrice?: number;
  currency: 'BDT';
  status: BookingOfferStatus;
  createdAt: string;
  updatedAt: string;
  /** Seller must accept/decline/modify by this time while status=pending */
  sellerRespondBy: string;
  /** Buyer must respond to a counter-offer by this time while status=countered */
  buyerRespondBy?: string;
  /** Buyer must pay by this time while status=accepted|buyer_accepted */
  buyerPayBy?: string;
  declineReason?: string;
  orderId?: string;
  invoiceId?: string;
  /** Full counter-offer / status history */
  versions: BookingOfferVersion[];
}

export type BookingOfferCard = Pick<
  BookingRequest,
  | 'kind'
  | 'version'
  | 'listingId'
  | 'listingTitle'
  | 'listingImage'
  | 'listingHref'
  | 'sellerId'
  | 'sellerName'
  | 'buyerId'
  | 'serviceCategory'
  | 'isService'
  | 'fields'
  | 'notes'
  | 'price'
  | 'originalPrice'
  | 'currency'
  | 'status'
  | 'createdAt'
  | 'sellerRespondBy'
  | 'buyerRespondBy'
  | 'buyerPayBy'
  | 'declineReason'
  | 'orderId'
> & { requestId: string };

export function toBookingOfferCard(request: BookingRequest): BookingOfferCard {
  return {
    kind: 'booking_offer',
    requestId: request.id,
    version: request.version,
    listingId: request.listingId,
    listingTitle: request.listingTitle,
    listingImage: request.listingImage,
    listingHref: request.listingHref,
    sellerId: request.sellerId,
    sellerName: request.sellerName,
    buyerId: request.buyerId,
    serviceCategory: request.serviceCategory,
    isService: request.isService,
    fields: request.fields,
    notes: request.notes,
    price: request.price,
    originalPrice: request.originalPrice,
    currency: request.currency,
    status: request.status,
    createdAt: request.createdAt,
    sellerRespondBy: request.sellerRespondBy,
    buyerRespondBy: request.buyerRespondBy,
    buyerPayBy: request.buyerPayBy,
    declineReason: request.declineReason,
    orderId: request.orderId,
  };
}
