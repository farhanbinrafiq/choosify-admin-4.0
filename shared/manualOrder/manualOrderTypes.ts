/**
 * Choosify Sprint 10 — canonical manual product-order offer, sent by a
 * seller inside an existing buyer conversation. Deliberately separate from
 * shared/booking/bookingTypes.ts: service bookings support seller
 * re-counter + a buyer_accepted/paid state machine; manual product offers
 * are accept/reject only (no counter) per product decision — a rejected
 * offer stays rejected, and the seller sends an independent new offer
 * (new id) if terms change. Do not merge these two models.
 */

export type ManualOrderOfferStatus =
  | 'pending'
  /** External/unregistered customer — offer prepared, waiting for the customer to sign in and claim it. */
  | 'awaiting_buyer_claim'
  | 'accepted'
  | 'rejected'
  | 'expired';

export type ManualOrderProvenanceSource =
  | 'manual'
  | 'external_whatsapp'
  | 'external_facebook'
  | 'external_instagram'
  | 'external_offline';

/**
 * Customer identity captured by the Seller at offer-creation time for an
 * external (no Choosify account yet) manual order. This is reconciliation
 * INPUT only — never an authorization fact. Final ownership is bound by the
 * server after the customer authenticates with a *verified* matching
 * identity (see claim-confirm).
 */
export interface ManualOrderIntendedCustomer {
  name: string;
  normalizedEmail: string;
  normalizedPhone: string;
  /** Set only when a single existing Consumer uniquely matched at creation time (email + phone agree). Advisory. */
  matchedConsumerId?: string;
  /** Address text lifted from the Meta conversation — prefill/context only; the Buyer picks the canonical address at confirmation. */
  addressHint?: string;
}

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
  /**
   * Set for the native flow (offer to an existing Choosify Buyer) OR once an
   * external customer has claimed + confirmed. Empty string while
   * `status === 'awaiting_buyer_claim'`.
   */
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

  // ─── External / Meta acquisition (additive) ───────────────────────────
  /** Present when the offer was created for an external customer (no buyerId yet). */
  intendedCustomer?: ManualOrderIntendedCustomer;
  /** SHA-256 of the opaque claim token. Raw token only lives in the customer link. */
  claimTokenHash?: string;
  /** ISO expiry for the claim token; confirm/preview reject after this. */
  claimTokenExpiresAt?: string;
  /** Authenticated Choosify userId the server bound the order to on claim. */
  claimedByUserId?: string;
  claimedAt?: string;
  /** Where this customer/order originated — retained through conversion for acquisition analytics. */
  provenance?: { source: ManualOrderProvenanceSource; conversationId?: string };
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
