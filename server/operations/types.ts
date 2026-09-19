export type OpsCouponType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';

export interface OpsCouponRule {
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  maxUsages?: number;
  maxUsagesPerUser?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  applicableBrands?: string[];
  excludeCategories?: string[];
  excludeProducts?: string[];
  excludeBrands?: string[];
  buyQuantity?: number;
  getQuantity?: number;
}

export interface OpsCoupon {
  id: string;
  code: string;
  type: OpsCouponType;
  discountTarget: 'all_products' | 'specific_product' | 'specific_category' | 'specific_brand';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  deleted?: boolean;
  rules: OpsCouponRule;
  description: string;
  totalUsages: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  createdAt: string;
  updatedAt: string;
}

export interface OpsCouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  userId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  timestamp: string;
  status: 'applied' | 'redeemed' | 'failed';
}

export interface OpsStorefrontOrder {
  id: string;
  orderId: string;
  buyerId: string;
  isCOD: boolean;
  isSplit: boolean;
  overallTotal: number;
  subtotal?: number;
  deliveryTotal?: number;
  subOrders: unknown[];
  promoCode?: string;
  promoDiscount?: number;
  promoType?: string;
  sourceMode?: 'retail';
  paymentMethod?: 'cod' | 'credit' | 'online';
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region: string;
    deliveryNotes?: string;
  };
  tradeLicense?: string;
  companyName?: string;
  isQuotationRequest?: boolean;
  /** Booking / service orders use pending_payment until paid, then confirmed */
  status: 'pending_payment' | 'active' | 'confirmed' | 'cancelled' | 'completed';
  bookingRequestId?: string;
  paymentDueAt?: string;
  paidAt?: string;
  invoiceGeneratedAt?: string;
  /** Buyer (or staff) cancellation audit fields */
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: 'buyer' | 'seller' | 'admin';
  /**
   * QA3-001 (Sprint 5): set true once inventory has been reserved for this
   * order's product lines at creation. Gates cancel-time release so a
   * second cancel attempt (already blocked by status==='cancelled' at the
   * router level, but checked again here defensively) can never release
   * twice. Mirrors CommerceOrder.inventoryReserved/inventoryConsumed.
   */
  inventoryReserved?: boolean;
  /**
   * COD orders only: buyer prepays the delivery fee online at checkout so the order
   * confirms immediately; the product amount (`codRemainingAmount`) stays payable at
   * the doorstep. Not set for online/`credit` orders, which are paid in full upfront.
   */
  codDeliveryFeePaid?: boolean;
  codDeliveryFeePaidAt?: string;
  codRemainingAmount?: number;
  /**
   * Deposit-now / rest-later payment (services: rest due at check-in; products: rest due
   * at delivery). Independent of the COD fields above — this is for buyers who paid
   * online but chose a partial amount rather than the full price.
   */
  isPartialPayment?: boolean;
  depositPercent?: number;
  depositAmount?: number;
  remainingAmount?: number;
  /** SSLCommerz (or future gateways) — granular payment lifecycle alongside `status`. */
  paymentProvider?: 'sslcommerz';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentTranId?: string;
  paymentValId?: string;
  paidAmount?: number;
  paymentValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Manual orders created from a seller's Meta inbox chat, awaiting the customer's confirmation */
  isManual?: boolean;
  platformSource?: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
  /** Server-generated token embedded in the customer-facing confirm link — set until the order is claimed */
  claimToken?: string;
  /** ISO expiry for claimToken; confirm/lookup reject after this time */
  claimTokenExpiresAt?: string;
  claimedAt?: string;
  claimedByName?: string;
  /**
   * Sprint 14 — staff-only internal operational notes on this order. Append-only
   * (POST /operations/orders/:id/notes; staff roles only — never a seller, never
   * the buyer, never mirrored to any System-B conversation). Additive field,
   * persisted in the operations JSON snapshot; absent on orders created before it.
   */
  internalNotes?: OpsOrderInternalNote[];
}

export interface OpsOrderInternalNote {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export type OpsReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged'
  | 'published'
  | 'deleted'
  | 'hidden';

export interface OpsReview {
  id: string;
  userId: string;
  userName: string;
  /** Sprint 9 — the specific delivered order/order-item this review is attached to. Required for new reviews; may be absent on reviews created before this field existed. */
  orderId?: string;
  orderItemId?: string;
  productId: string;
  productTitle: string;
  brandName: string;
  storeName: string;
  rating: number;
  comment: string;
  photos?: string[];
  status: OpsReviewStatus;
  reports: number;
  flags?: string[];
  response?: {
    id: string;
    author: string;
    comment: string;
    timestamp: string;
  };
  isAuthentic?: boolean;
  authenticityScore?: number;
  authenticityReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export interface OpsLead {
  id: string;
  source: string;
  brandName: string;
  contactPerson?: string;
  email: string;
  budget?: string;
  placementInterest?: string;
  message?: string;
  status: OpsLeadStatus;
  createdAt: string;
  updatedAt: string;
}

export type OpsJobEmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type OpsJobStatus = 'open' | 'closed' | 'draft';

export interface OpsJobPosting {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: OpsJobEmploymentType;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  status: OpsJobStatus;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type OpsJobApplicationStatus = 'new' | 'reviewed' | 'interviewing' | 'rejected' | 'hired';

export interface OpsJobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  resumeUrl: string;
  resumeFileName?: string;
  coverLetter: string;
  status: OpsJobApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export type OpsFeeChargeType = 'service_charge' | 'platform_fee' | 'tax' | 'delivery';
export type OpsFeeRateType = 'percentage' | 'flat';
export type OpsFeeScopeType = 'platform' | 'brand' | 'category' | 'product';

export interface OpsFeeCharge {
  id: string;
  name: string;
  type: OpsFeeChargeType;
  rateType: OpsFeeRateType;
  rateValue: number;
  scopeType: OpsFeeScopeType;
  /** Populated when scopeType === 'brand'; supports multi-brand scoping. */
  scopeBrandIds?: string[];
  scopeCategoryIds?: string[];
  scopeProductIds?: string[];
  active: boolean;
  deleted?: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpsPaymentOptionsConfig {
  partialPaymentEnabled: boolean;
  minDepositPercent: number;
  maxDepositPercent: number;
  updatedAt: string;
}

/**
 * Per-seller default for whether new service booking requests need manual acceptance.
 * A listing's own `CatalogProduct.requiresApproval` overrides this when set explicitly.
 */
export interface OpsSellerBookingSettings {
  sellerId: string;
  autoApproveBookingsDefault: boolean;
  updatedAt: string;
}

export type PermissionKey =
  | 'content'
  | 'users'
  | 'finance'
  | 'brand'
  | 'system'
  | 'analytics'
  | 'taxonomy'
  | 'impersonate';

export type RolePermissionsMap = Record<string, Record<PermissionKey, boolean>>;

/** Mirrors admin `ReturnRequest` in src/contexts/ReturnsContext.tsx */
export type OpsReturnInitiatedBy = 'customer' | 'admin';
export type OpsReturnReason =
  | 'defective'
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'customer_changed_mind';
export type OpsReturnStatus =
  | 'initiated'
  | 'approved'
  | 'rejected'
  | 'returned_in_transit'
  | 'received'
  | 'refunded'
  | 'dispute';
export type OpsRefundStatus = 'pending' | 'processed' | 'failed';

/** Open (non-terminal) return statuses — used for the duplicate-active-return guard, mirrors OPEN_WARRANTY_CLAIM_STATUSES. */
export const OPEN_RETURN_STATUSES = new Set<OpsReturnStatus>([
  'initiated',
  'approved',
  'returned_in_transit',
  'received',
]);

/** One buyer-visible history entry — every status change appends here. Append-only, never mutated. */
export interface OpsReturnTimelineEntry {
  id: string;
  status: OpsReturnStatus;
  note?: string;
  at: string;
  by?: string;
}

/** Staff/seller-only note — never returned to the buyer under any circumstance. */
export interface OpsReturnInternalNote {
  id: string;
  note: string;
  by: string;
  at: string;
}

export interface OpsReturnRequest {
  id: string;
  /** Permanent Choosify Return Reference ID (RT-#####). */
  referenceId?: string;
  orderId: string;
  itemId: string;
  initiatedBy: OpsReturnInitiatedBy;
  reason: OpsReturnReason;
  description: string;
  /** Legacy raw-URL evidence field — kept for backward compatibility with old rows. New submissions use evidenceMediaIds. */
  evidencePhotos: string[];
  /** Evidence photos via the canonical private media service (category 'return-evidence'), same pattern as warranty claims. */
  evidenceMediaIds?: string[];
  /** Optional buyer-supplied external video link (e.g. Google Drive) — never a raw video upload. */
  videoLink?: string;
  status: OpsReturnStatus;
  approvalDecision?: 'approved' | 'rejected';
  approvalReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  /**
   * Explicit decision made AT APPROVAL TIME — whether the buyer must
   * physically send the item back before a refund can be processed, or
   * whether this is a refund-without-return case. Two structurally
   * different outcomes (rule #3), never conflated into one implicit
   * status: true → approved → returned_in_transit → received → refunded;
   * false → approved → refunded directly. Undefined only for legacy rows
   * persisted before this field existed.
   */
  requiresReturn?: boolean;
  refundAmount?: number;
  refundStatus: OpsRefundStatus;
  returnTrackingId?: string;
  returnCourier?: string;
  pickupDate?: string;
  deliveryDate?: string;
  /** Seller/admin-writable, buyer-readable decision log (existing behavior, unchanged). */
  notes: string[];
  /** Full buyer-visible structured history — every status transition. Optional for backward
   *  compatibility with cases persisted before this field existed. */
  timeline?: OpsReturnTimelineEntry[];
  /** Staff/seller-only notes — filtered out of every response sent to the buyer. Optional for the
   *  same backward-compatibility reason as `timeline`. */
  internalNotes?: OpsReturnInternalNote[];
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  buyerId: string;
  /** Set when linked via dispute escalation */
  disputeId?: string;
}

/** Warranty claims — mirrors the OpsReturnRequest shape/workflow. */
export type OpsWarrantyClaimStatus =
  | 'submitted'
  | 'acknowledged'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'service_in_progress'
  | 'resolved'
  | 'cancelled'
  | 'disputed';

export const OPEN_WARRANTY_CLAIM_STATUSES = new Set<OpsWarrantyClaimStatus>([
  'submitted',
  'acknowledged',
  'more_info_required',
  'approved',
  'service_in_progress',
]);

export type OpsWarrantyClaimIssueType =
  | 'not_powering_on'
  | 'manufacturing_defect'
  | 'physical_damage'
  | 'battery_charging'
  | 'performance_software'
  | 'missing_damaged_accessory'
  | 'other';

/**
 * Granular, buyer-visible progress WITHIN the coarse 'service_in_progress'
 * status — deliberately NOT a replacement for OpsWarrantyClaimStatus. The
 * canonical status enum stays small and durable; this optional sub-stage
 * gives the "Return Requested → In Transit → Received → Under Review →
 * Repair/Replacement In Progress → Ready for Dispatch → Dispatched →
 * Delivered" resolution detail the product spec asks for, without adding a
 * dozen new top-level statuses that would fragment every existing guard/
 * filter/notification keyed off OpsWarrantyClaimStatus.
 */
export type OpsWarrantyClaimServiceStage =
  | 'return_requested'
  | 'in_transit'
  | 'received'
  | 'under_review'
  | 'repair_in_progress'
  | 'replacement_in_progress'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered';

/** Linear progression tiers — 'repair_in_progress' and 'replacement_in_progress'
 *  share a tier since a claim follows exactly one of those two paths, never both. */
export const WARRANTY_CLAIM_SERVICE_STAGE_ORDER: OpsWarrantyClaimServiceStage[][] = [
  ['return_requested'],
  ['in_transit'],
  ['received'],
  ['under_review'],
  ['repair_in_progress', 'replacement_in_progress'],
  ['ready_for_dispatch'],
  ['dispatched'],
  ['delivered'],
];

/** Final outcome once a claim reaches 'resolved' (or is 'rejected'). */
export type OpsWarrantyClaimResolutionType =
  | 'repaired'
  | 'replaced'
  | 'refunded'
  | 'rejected'
  | 'no_fault_found'
  | 'other';

/** One buyer-visible history entry — every status change and every seller
 *  customer-visible note appends here. This is what the buyer timeline and
 *  the warranty claim document both render from; it is never mutated after
 *  the fact, only appended to. */
export interface OpsWarrantyClaimTimelineEntry {
  id: string;
  status: OpsWarrantyClaimStatus;
  serviceStage?: OpsWarrantyClaimServiceStage;
  /** Customer-visible note attached to this transition, if any (e.g. "Inspection may take up to 15 days"). */
  note?: string;
  at: string;
  by?: string;
}

/** Staff/seller-only note — never returned to a consumer under any circumstance. */
export interface OpsWarrantyClaimInternalNote {
  id: string;
  note: string;
  by: string;
  at: string;
}

/** The four proof categories a warranty claim's evidence is collected under — each is its own upload section on the storefront. */
export type OpsWarrantyClaimAttachmentCategory = 'warrantyCard' | 'productPhoto' | 'box' | 'receipt';

export const WARRANTY_CLAIM_ATTACHMENT_CATEGORIES: OpsWarrantyClaimAttachmentCategory[] = [
  'warrantyCard',
  'productPhoto',
  'box',
  'receipt',
];

export interface OpsWarrantyClaim {
  id: string;
  /** Permanent Choosify Warranty Claim Reference ID (WC-#####). */
  referenceId?: string;
  orderId: string;
  orderItemId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  productId: string;
  /** Warranty snapshot copied from the order item at claim-open time — never re-derived from the live product. */
  warrantyMonthsAtPurchase?: number;
  warrantyTypeAtPurchase?: string;
  warrantyProviderAtPurchase?: string;
  warrantyTermsSnapshot?: string;
  warrantyStartsAt?: string;
  warrantyExpiresAt?: string;
  issueType: OpsWarrantyClaimIssueType;
  description: string;
  /** media ids from the canonical media service, category `warranty-claims` — flat union of attachmentCategories, kept for backward-compat display and polymorphic media linking. */
  attachmentMediaIds: string[];
  /** Same media ids as attachmentMediaIds, broken down by proof type. Optional — older claims persisted before this field existed won't have it; always read via `claim.attachmentCategories || {}`. */
  attachmentCategories?: Partial<Record<OpsWarrantyClaimAttachmentCategory, string[]>>;
  status: OpsWarrantyClaimStatus;
  /** Only meaningful while status === 'service_in_progress'. */
  serviceStage?: OpsWarrantyClaimServiceStage;
  sellerResponse?: string;
  resolutionNotes?: string;
  /** Structured outcome once resolved/rejected — free-text resolutionNotes remains the human detail. */
  resolutionType?: OpsWarrantyClaimResolutionType;
  /** Seller/Admin-set expectation only — never fabricated by the platform. */
  estimatedCompletionDate?: string;
  /** Full buyer-visible history — every status transition + every customer-visible note. Append-only.
   *  Optional for backward compatibility with claims persisted before this field existed — always
   *  read via `claim.timeline || []`, never assume presence. */
  timeline?: OpsWarrantyClaimTimelineEntry[];
  /** Staff/seller-only notes — filtered out of every response sent to the consumer. Optional for the
   *  same backward-compatibility reason as `timeline`. */
  internalNotes?: OpsWarrantyClaimInternalNote[];
  conversationId?: string;
  submittedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Set when linked via dispute escalation */
  disputeId?: string;
}

/**
 * Disputes — the escalation/adjudication layer, NOT a duplicate of Returns,
 * Warranty Claims, or Orders. A dispute always references its source case by
 * id (never copies the source's data) and exists only when a normal
 * resolution is being challenged/escalated. Any refund a decision implies
 * must still go through the canonical Returns & Refunds finance engine
 * (`PATCH /operations/returns/:id/refund`) — a dispute decision here never
 * moves money on its own.
 */
export type OpsDisputeSourceType = 'return' | 'warranty_claim' | 'order';

export type OpsDisputeStatus =
  | 'raised'
  | 'evidence_collection'
  | 'under_review'
  | 'awaiting_buyer'
  | 'awaiting_seller'
  | 'decision_pending'
  | 'resolved'
  | 'closed';

/** Valid forward transitions — enforced server-side, never trust the client. */
export const OPS_DISPUTE_TRANSITIONS: Record<OpsDisputeStatus, OpsDisputeStatus[]> = {
  raised: ['evidence_collection', 'under_review', 'closed'],
  evidence_collection: ['under_review', 'awaiting_buyer', 'awaiting_seller', 'closed'],
  under_review: ['awaiting_buyer', 'awaiting_seller', 'decision_pending', 'closed'],
  awaiting_buyer: ['under_review', 'decision_pending', 'closed'],
  awaiting_seller: ['under_review', 'decision_pending', 'closed'],
  decision_pending: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export const OPEN_DISPUTE_STATUSES = new Set<OpsDisputeStatus>([
  'raised',
  'evidence_collection',
  'under_review',
  'awaiting_buyer',
  'awaiting_seller',
  'decision_pending',
]);

export type OpsDisputeDecision =
  | 'uphold_seller'
  | 'uphold_buyer'
  | 'partial'
  | 'refund_approved'
  | 'replacement'
  | 'dismissed';

export interface OpsDisputeEvidenceItem {
  id: string;
  submittedBy: 'buyer' | 'seller' | 'admin';
  submittedByUserId?: string;
  description: string;
  mediaUrl?: string;
  createdAt: string;
}

export interface OpsDisputeTimelineEntry {
  id: string;
  type: 'status_change' | 'note' | 'evidence' | 'decision' | 'raised';
  fromStatus?: OpsDisputeStatus;
  toStatus?: OpsDisputeStatus;
  actorId?: string;
  actorRole?: string;
  text?: string;
  createdAt: string;
}

export interface OpsDispute {
  /** DSP-<timestamp> */
  id: string;
  sourceType: OpsDisputeSourceType;
  /** The source Return (RET-...), Warranty Claim (WC-...), or Order (ORD-...) id — canonical record lives there, never duplicated here. */
  sourceId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  /** Disputed amount/value, if applicable (e.g. refund amount in question). */
  amount?: number;
  buyerStatement?: string;
  sellerStatement?: string;
  status: OpsDisputeStatus;
  evidence: OpsDisputeEvidenceItem[];
  timeline: OpsDisputeTimelineEntry[];
  /** Staff-only internal notes — never shown to buyer/seller. */
  adminNotes: string[];
  decision?: OpsDisputeDecision;
  decisionNotes?: string;
  decidedBy?: string;
  decidedAt?: string;
  assignedAdminId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

/** Mirrors admin TrustContext VerificationRequest (+ entityType for brand|creator). */
export type OpsVerificationEntityType = 'brand' | 'creator';
export type OpsVerificationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected';
export type OpsDocumentType =
  | 'Trade License'
  | 'Business Registration'
  | 'Tax Certificate'
  | 'Brand Ownership Proof'
  | 'Identity Verification';
export type OpsDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface OpsVerificationDocument {
  id: string;
  type: OpsDocumentType;
  name: string;
  doc_url: string;
  status: OpsDocumentStatus;
  notes?: string;
}

export interface OpsVerificationReview {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: 'approved' | 'rejected';
  feedback: string;
  reviewed_at: string;
}

export interface OpsVerificationAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface OpsVerificationRequest {
  id: string;
  /** Generalized entity — brand or creator claim */
  entityType: OpsVerificationEntityType;
  entityId: string;
  entityName: string;
  /** Kept for BrandVerification.tsx compatibility (mirrors entity* when brand). */
  brand_id: string;
  brand_name: string;
  logo_url: string;
  /** Firebase uid of the submitter — never trust client override on create. */
  submitted_by: string;
  submitted_by_name?: string;
  status: OpsVerificationStatus;
  documents: OpsVerificationDocument[];
  reviews: OpsVerificationReview[];
  audit_trail: OpsVerificationAuditEntry[];
  created_at: string;
  updated_at: string;
}
