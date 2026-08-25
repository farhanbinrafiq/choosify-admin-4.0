/**
 * Choosify Sprint 10 — canonical manual product-order offer, sent by a
 * seller inside an existing buyer conversation. Deliberately separate from
 * shared/booking/bookingTypes.ts: service bookings support seller
 * re-counter + a buyer_accepted/paid state machine; manual product offers
 * are accept/reject only (no counter) per product decision — a rejected
 * offer stays rejected, and the seller sends an independent new offer
 * (new id) if terms change. Do not merge these two models.
 */

export type ManualOrderOfferStatus = 'pending' | 'accepted' | 'rejected';

export interface ManualOrderOfferItem {
  productId: string;
  productTitle: string;
  variantId?: string;
  quantity: number;
  /** Seller-set, negotiated price for this line — trusted at offer-creation time (the seller's own product), frozen and authoritative from then on. */
  price: number;
  productType?: 'physical' | 'service';
  image?: string;
}

/**
 * Canonical manual-order-offer document. Message threads embed a snapshot
 * (see ManualOrderOfferCard); this is the source of truth for accept/reject
 * and order linkage — the same role BookingRequest plays for bookings.
 */
export interface ManualOrderOffer {
  id: string;
  kind: 'manual_order_offer';
  conversationId: string;
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName?: string;
  items: ManualOrderOfferItem[];
  notes?: string;
  subtotal: number;
  deliveryTotal: number;
  overallTotal: number;
  currency: 'BDT';
  status: ManualOrderOfferStatus;
  createdAt: string;
  updatedAt: string;
  orderId?: string;
  rejectReason?: string;
}

export type ManualOrderOfferCard = Pick<
  ManualOrderOffer,
  | 'kind'
  | 'conversationId'
  | 'sellerId'
  | 'sellerName'
  | 'buyerId'
  | 'buyerName'
  | 'items'
  | 'notes'
  | 'subtotal'
  | 'deliveryTotal'
  | 'overallTotal'
  | 'currency'
  | 'status'
  | 'createdAt'
  | 'orderId'
  | 'rejectReason'
> & { offerId: string };

export function toManualOrderOfferCard(offer: ManualOrderOffer): ManualOrderOfferCard {
  return {
    kind: 'manual_order_offer',
    offerId: offer.id,
    conversationId: offer.conversationId,
    sellerId: offer.sellerId,
    sellerName: offer.sellerName,
    buyerId: offer.buyerId,
    buyerName: offer.buyerName,
    items: offer.items,
    notes: offer.notes,
    subtotal: offer.subtotal,
    deliveryTotal: offer.deliveryTotal,
    overallTotal: offer.overallTotal,
    currency: offer.currency,
    status: offer.status,
    createdAt: offer.createdAt,
    orderId: offer.orderId,
    rejectReason: offer.rejectReason,
  };
}
