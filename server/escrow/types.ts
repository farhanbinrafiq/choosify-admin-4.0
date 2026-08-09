/**
 * Escrow / Settlement / Seller Balance / Refund types — Sprint 8 / IS-010 Sprint 11.
 * Finance-domain-owned records; Commerce PaymentCaptured is the only create trigger.
 */

/** Documented Escrow Held + exception / settlement outcomes (ES-005 §37–§38). */
export type EscrowStatus =
  | 'held'
  | 'settled'
  | 'full_refund'
  | 'partial_refund_remaining' // Held reduced after partial refund; still settleable
  | 'dispute_hold'
  | 'administrative_adjustment';

export type CommerceEscrow = {
  escrowId: string;
  paymentId: string;
  checkoutId: string;
  orderId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  currency: string;
  /** Immutable gross allocation from Payment×Order snapshot (major units). */
  capturedAmount: number;
  heldAmount: number;
  refundedAmount: number;
  settledAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  status: EscrowStatus;
  escrowCreatedEmitted?: boolean;
  escrowReleasedEmitted?: boolean;
  escrowCancelledEmitted?: boolean;
  settlementId?: string;
  disputeHoldReason?: string;
  disputeHoldAt?: string;
  adminAdjustmentNote?: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
  cancelledAt?: string;
};

export type CommerceSettlement = {
  settlementId: string;
  escrowId: string;
  paymentId: string;
  orderId: string;
  checkoutId: string;
  sellerId: string;
  brandId: string;
  currency: string;
  grossAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  sellerBalanceCredited?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SellerBalanceAccount = {
  sellerId: string;
  currency: string;
  /** Escrow still held (informational aggregate). */
  escrowBalance: number;
  pendingSettlement: number;
  availableBalance: number;
  updatedAt: string;
};

export type SellerBalanceLedgerEntry = {
  entryId: string;
  sellerId: string;
  currency: string;
  /** Positive = credit to available. */
  amount: number;
  kind: 'settlement_credit' | 'refund_clawback' | 'admin_adjustment';
  settlementId?: string;
  escrowId?: string;
  orderId?: string;
  idempotencyKey: string;
  createdAt: string;
};

export type RefundStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'failed'
  /** Post-settlement refund needs Finance clawback (Sprint 17) — fail safe, no silent mutate. */
  | 'requires_financial_adjustment';

export type CommerceRefund = {
  refundId: string;
  paymentId: string;
  escrowId: string;
  checkoutId: string;
  orderId: string;
  amount: number;
  currency: string;
  reason: string;
  requestedBy: string;
  status: RefundStatus;
  providerRefundRefId?: string;
  providerBankTranId?: string;
  /** Idempotency: provider refund already accepted. */
  providerRefundDone?: boolean;
  paymentRefundedEmitted?: boolean;
  escrowCancelledEmitted?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'refund_processing'
  | 'closed';

export type CommerceReturn = {
  returnId: string;
  orderId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  reason: string;
  status: ReturnStatus;
  refundId?: string;
  createdAt: string;
  updatedAt: string;
};
