import { getStoredAccessToken, refreshAccessToken, reportFeatureEntitlementDenied } from './authRefresh';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseErrorMessage(rawError: string, status: number): string {
  if (!rawError) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(rawError) as { error?: string; message?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // keep raw text
  }
  return rawError;
}

function doFetch(path: string, method: HttpMethod, body: unknown, token: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  // Write routes require Firebase Bearer (authenticateRequest). Attach whenever
  // present — public GETs/validate ignore it. An unauthenticated caller has no
  // token and must fail loudly on protected writes.
  const token = getStoredAccessToken();
  let response = await doFetch(path, method, body, token);

  // A dashboard tab left open across a long session can outlive its access
  // token. Try one silent refresh via the httpOnly refresh cookie and retry
  // before surfacing a raw 'expired token' error the user has no way to act on.
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch(path, method, body, refreshed);
    }
  }

  if (!response.ok) {
    const rawError = await response.text();
    reportFeatureEntitlementDenied(response.status, rawError);
    throw new Error(parseErrorMessage(rawError, response.status));
  }
  return response.json() as Promise<T>;
}

/**
 * A single line item within a sub-order. Mirrors what
 * server/operationsRouter.ts's recomputeOrderPricingServerSide (checkout path)
 * and server/booking/bookingService.ts's buildOrderFromRequest (booking path)
 * actually persist — see also findOrderItem/mark-delivered in
 * server/operationsRouter.ts for the fields that get set post-creation
 * (deliveredAt, inventoryConsumed, warrantyStartsAt/warrantyExpiresAt).
 */
export interface OpsOrderItem {
  itemId: string;
  productId?: string;
  serviceId?: string;
  variantId?: string;
  /**
   * Buyer's selected variant combination, snapshotted server-side at checkout
   * (recomputeOrderPricingServerSide) from the product's own productVariants —
   * never re-derived from the live product. Display only.
   */
  variantSku?: string;
  variantLabel?: string;
  selectedOptions?: Record<string, string>;
  productTitle: string;
  quantity: number;
  price: number;
  productType?: 'physical' | 'service';
  serviceCategory?: string;
  serviceDetails?: Record<string, string | number>;
  /** Warranty terms snapshotted from the product at purchase time (never re-derived live). */
  warrantyMonthsAtPurchase?: number;
  warrantyTypeAtPurchase?: string;
  warrantyProviderAtPurchase?: string;
  warrantyTermsSnapshot?: string;
  warrantyStartsAt?: string;
  warrantyExpiresAt?: string;
  /** Set exactly once, server-side, by POST .../items/:itemId/mark-delivered. */
  deliveredAt?: string;
  /** True once this item's reserved stock has been converted to consumed (mark-delivered, idempotent). */
  inventoryConsumed?: boolean;
}

/** One seller's slice of a (possibly multi-seller/split) order. */
export interface OpsSubOrder {
  sellerId: string;
  sellerBusinessName?: string;
  /** Brand the seller fulfilled this slice under (set by the checkout mirror). */
  brandId?: string;
  invoiceId?: string;
  deliveryFee: number;
  /**
   * Free-form; 'pending' is the implicit default when unset (see
   * operationsRouter.ts cancel-order handler). Only ever set to 'delivered'
   * server-side by mark-delivered — no other admin-settable states exist.
   */
  trackingStatus?: string;
  items: OpsOrderItem[];
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
  subOrders: OpsSubOrder[];
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
  /** Booking / service orders use pending_payment until paid, then confirmed. */
  status: 'pending_payment' | 'active' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelledBy?: 'buyer' | 'seller' | 'admin';
  isManual?: boolean;
  platformSource?: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
  claimToken?: string;
  claimTokenExpiresAt?: string;
  claimedAt?: string;
  claimedByName?: string;
  paymentProvider?: 'sslcommerz';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'cancelled';
  paymentTranId?: string;
  paymentValId?: string;
  paidAmount?: number;
  paymentValidatedAt?: string;
  paidAt?: string;
  paymentDueAt?: string;
  /** COD orders only -- delivery fee prepaid online at checkout; product amount stays due at the doorstep. */
  codDeliveryFeePaid?: boolean;
}

/** Staff-only internal note on an order (GET/POST /operations/orders/:id/notes). */
export interface OpsOrderInternalNote {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

/**
 * The canonical Commerce order behind an Operations orderId (1:1 by
 * orderNumber). Only the fields the Order Hub lifecycle panel needs — the full
 * shape lives in server/commerce/types.ts CommerceOrder.
 */
export interface CommerceOrderLite {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  sellerId: string;
  consumerId: string;
  brandId?: string;
  source?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  statusBeforeCancel?: string;
  updatedAt?: string;
  items?: Array<{ listingType?: string }>;
}

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
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';
  discountTarget: string;
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

export interface OpsReview {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  brandName: string;
  storeName: string;
  rating: number;
  comment: string;
  status: string;
  reports: number;
  flags?: string[];
  response?: { id: string; author: string; comment: string; timestamp: string };
  isAuthentic?: boolean;
  authenticityScore?: number;
  authenticityReason?: string;
  /** The delivered order / line the review is for (Sprint 9 uniqueness key). */
  orderId?: string;
  orderItemId?: string;
  createdAt: string;
  updatedAt: string;
}

/** One Marketplace Access decision — mirrors server/operations/types.ts OpsMarketplaceAccessEvent. */
export interface MarketplaceAccessEvent {
  id: string;
  entityType: 'brand' | 'creator';
  entityId: string;
  entityName?: string;
  ownerUserId?: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  durationDays?: number | null;
  reviewAt?: string;
  notifyOwner?: boolean;
  actorId: string;
  actorName?: string;
  at: string;
}

/** Staff "Ask to Upload" request — mirrors OpsVerificationDocRequest (actor fields absent for owners). */
export interface VerificationDocRequest {
  id: string;
  entityType: 'brand' | 'creator';
  entityId: string;
  ownerUserId: string;
  docTypes: string[];
  note?: string;
  actorId?: string;
  actorName?: string;
  at: string;
}

/** Account Activity Log entry — mirrors OpsAccountActivity (staff-only fields absent in the owner view). */
export interface AccountActivityEntry {
  id: string;
  userId: string;
  at: string;
  type: string;
  category: 'sign_in' | 'security' | 'account' | 'verification' | 'admin';
  summary: string;
  actor: 'self' | 'staff' | 'system';
  success: boolean;
  ip?: string;
  device?: string;
  location?: string;
  staffActorId?: string;
  staffActorName?: string;
  staffActorRole?: string;
  staffIp?: string;
  staffDevice?: string;
  staffNote?: string;
}

/** A shopper's storefront signals (saved items, followed creators, searches) — mirrors OpsShopperSignals. */
export interface ShopperSignalItem {
  id: string;
  label: string;
  image?: string;
  at: string;
}
export interface ShopperSignals {
  userId: string;
  savedProducts: ShopperSignalItem[];
  savedBrands: ShopperSignalItem[];
  followedCreators: ShopperSignalItem[];
  searches: Array<{ q: string; at: string }>;
  updatedAt: string;
}

/** Server-side payout profile (how a Seller / Creator gets paid) — mirrors OpsPayoutProfile. */
export interface PayoutProfile {
  userId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  branchName: string;
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  createdAt: string;
  updatedAt: string;
}
export interface PayoutChannel {
  kind: 'bank' | 'mfs';
  provider: string;
  accountName: string;
  number: string;
  extra?: string;
}
export interface PayoutReminder {
  id: string;
  userId: string;
  actorId: string;
  actorName?: string;
  at: string;
}

/** Super Admin "Edit User" session — mirrors server/operations/types.ts OpsAdminEditSession. */
export type AdminEditReason = 'user_support_request' | 'data_correction' | 'compliance_review' | 'fraud_investigation' | 'other';
export interface AdminEditSession {
  id: string;
  adminUserId: string;
  adminName?: string;
  adminEmail?: string;
  targetUserId: string;
  targetRole: 'consumer' | 'seller' | 'creator';
  targetLabel?: string;
  reason: AdminEditReason;
  reasonDetail: string;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  endedBy?: string;
  endReason?: 'exited' | 'expired';
}

/** Public business inquiry — mirrors server/operations/types.ts OpsLead. */
export interface OpsLead {
  id: string;
  source: string;
  brandName: string;
  contactPerson?: string;
  email: string;
  budget?: string;
  placementInterest?: string;
  message?: string;
  status: import('../../shared/inquiries/inquiryOptions').InquiryStatus;
  createdAt: string;
  updatedAt: string;
  inquiryType?: import('../../shared/inquiries/inquiryOptions').InquiryType;
  referenceId?: string;
  website?: string;
  categoryId?: string;
  categoryName?: string;
  country?: string;
  subject?: string;
  partnershipModel?: string;
  submittedByUserId?: string;
  sourcePath?: string;
  duplicateSignals?: Array<{ kind: 'existing_brand' | 'existing_suggestion'; matchId: string; matchLabel: string; matchedOn: 'name' | 'website' }>;
  notes?: Array<{ id: string; body: string; authorId: string; authorName: string; createdAt: string }>;
  history?: Array<{ at: string; action: 'created' | 'status_changed' | 'note_added'; actorId?: string; actorName?: string; fromStatus?: string; toStatus?: string }>;
  delivery?: { adminNotified: boolean; adminNotifyError?: string; emailAttempted: boolean; emailSent: boolean; emailVia?: string; emailSkippedReason?: string };
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

export type PermissionKey =
  | 'content'
  | 'users'
  | 'finance'
  | 'brand'
  | 'system'
  | 'analytics'
  | 'taxonomy'
  | 'impersonate';

// Mirrors server/operations/shipmentStore.ts OpsShipmentStatus exactly.
export type OpsShipmentStatus =
  | 'awaiting_dispatch'
  | 'dispatched'
  | 'pending_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

/** Shipment statuses that are canonical evidence the parcel physically progressed. */
export const SHIPMENT_MOVEMENT_STATUSES: readonly OpsShipmentStatus[] = [
  'picked_up',
  'in_transit',
  'delivered',
  'failed_delivery',
  'returned',
];

export interface OpsShipment {
  id: string;
  orderId: string;
  buyerId: string;
  status: OpsShipmentStatus;
  courier: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  region: string;
  codAmount: number;
  deliveryCharge: number;
  createdAt: string;
  updatedAt: string;
  trackingEvents: {
    id: string;
    timestamp: string;
    status: string;
    location: string;
    description: string;
  }[];
  /** Dispatch Details (Sprint 14) — set only on a real successful dispatch. */
  fulfillmentMethod?: 'courier' | 'seller_delivery' | 'pickup';
  dispatchedAt?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  dispatchNote?: string;
}

/**
 * Fields PATCH /operations/shipments/:id accepts. Server enforces a strict
 * allowlist (see SHIPMENT_PATCH_ALLOWED_KEYS in server/operationsRouter.ts) —
 * status/tracking history are webhook-driven only and cannot be set here.
 */
export interface OpsShipmentPatch {
  courier?: string;
  trackingNumber?: string;
}

export interface AnalyticsSummary {
  range: string;
  generatedAt: string;
  orders: {
    total: number;
    revenue: number;
    promoDiscount: number;
    cod: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
  };
  reviews: {
    total: number;
    pending: number;
    published: number;
  };
  shipments: {
    total: number;
    pending: number;
    delivered: number;
  };
  coupons: {
    active: number;
    totalRedemptions: number;
    totalDiscountGiven: number;
  };
  daily: { date: string; orders: number; revenue: number; leads: number }[];
}

export interface RoleAnalyticsPayload {
  role: string;
  cards: { label: string; value: string; sub?: string }[];
  quickLinks: { label: string; path: string }[];
  summary: AnalyticsSummary;
}

/**
 * GET /operations/analytics is role-polymorphic: admin/staff get an
 * AnalyticsSummary directly, seller/creator get a RoleAnalyticsPayload
 * wrapper. Narrow on the discriminating `cards` array.
 */
export function isRoleAnalyticsPayload(
  value: AnalyticsSummary | RoleAnalyticsPayload,
): value is RoleAnalyticsPayload {
  return Array.isArray((value as RoleAnalyticsPayload).cards);
}

/** Collapse the role-dependent analytics result down to the AnalyticsSummary. */
export function toAnalyticsSummary(
  value: AnalyticsSummary | RoleAnalyticsPayload,
): AnalyticsSummary {
  return isRoleAnalyticsPayload(value) ? value.summary : value;
}

/**
 * Embedded structured-offer snapshots persisted on the System-B platform
 * message (UnifiedMessage.bookingOffer / .orderOffer) and returned verbatim
 * by GET /operations/platform-messages. The admin DTO previously dropped
 * these fields — they are the same records the Buyer storefront renders.
 * Kept as loose records: the canonical typed shape lives in the booking /
 * manual-order stores; live status is re-resolved via listBookingRequests.
 */
export type OpsBookingOfferStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'buyer_accepted'
  | 'buyer_declined'
  | 'expired'
  | 'payment_expired'
  | 'paid';

/**
 * Real ownership-claim / verification record — GET /operations/verifications.
 * Mirrors the server contract (server/operations/types.ts: OpsVerificationRequest),
 * which itself mirrors TrustContext's VerificationRequest — reusing those field
 * types here instead of redeclaring them keeps the three in lockstep.
 */
export interface OpsVerification {
  id: string;
  entityType: 'brand' | 'creator';
  entityId: string;
  entityName: string;
  brand_id: string;
  brand_name: string;
  logo_url: string;
  submitted_by: string;
  submitted_by_name?: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Expired';
  /** owner_verification = the owner verifying their own profile; ownership_claim = claiming a community profile. */
  kind?: 'owner_verification' | 'ownership_claim';
  claimSource?: 'storefront' | 'invitation' | 'onboarding';
  claimIntentId?: string;
  /** Ownership claims: who is claiming (owner / representative, role, name, phone, official email). */
  claimantDetails?: import('../../shared/verification/verificationDocuments').ClaimantDetails;
  closedAt?: string;
  closedReason?: string;
  documents: import('../contexts/TrustContext').VerificationDocument[];
  reviews: import('../contexts/TrustContext').VerificationReview[];
  audit_trail: { timestamp: string; action: string; actor: string; details: string }[];
  created_at: string;
  updated_at: string;
}

export interface CommunityDuplicate {
  id: string;
  name: string;
  slug: string;
  matchedOn: Array<'name' | 'website' | 'social'>;
  owned: boolean;
}

export interface CommunityProfileInput {
  entityType: 'brand' | 'creator';
  name: string;
  categoryId?: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  website?: string;
  socialLinks?: Record<string, string>;
  location?: string;
  publish?: boolean;
  acknowledgeDuplicates?: boolean;
}

export interface CommunityProfileCopy {
  brandDisclaimer: string;
  creatorDisclaimer: string;
  claimReviewNotice: string;
  updatedAt: string | null;
  isDefault: boolean;
}

/** Real Seller/Creator onboarding application — GET /operations/partner-applications. */
export interface OpsPartnerApplication {
  id: string;
  applicantType: 'seller' | 'creator';
  status: 'pending' | 'approved' | 'rejected';
  email: string;
  displayName: string;
  businessOrChannelName: string;
  category?: string;
  city?: string;
  provisionedUserId?: string;
  catalogEntityId?: string;
  existingUserId?: string;
  resubmissionRequested?: boolean;
  phone?: string;
  website?: string;
  niche?: string;
  contentFocus?: string;
  socialPrimary?: string;
  audienceSize?: string;
  notes?: string;
  adminNotes?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpsBookingOffer {
  kind?: 'booking_offer';
  requestId?: string;
  version?: number;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingHref?: string;
  sellerId?: string;
  sellerName?: string;
  buyerId?: string;
  isService?: boolean;
  serviceCategory?: string;
  fields?: Record<string, string | number>;
  notes?: string;
  price?: number;
  originalPrice?: number;
  status?: OpsBookingOfferStatus;
  createdAt?: string;
  sellerRespondBy?: string;
  buyerPayBy?: string;
  declineReason?: string;
  orderId?: string;
}

export interface OpsManualOrderOffer {
  kind?: 'manual_order_offer';
  offerId?: string;
  orderId?: string;
  status?: string;
  sellerId?: string;
  buyerId?: string;
  overallTotal?: number;
  currency?: string;
  notes?: string;
  rejectReason?: string;
  items?: Array<{ name?: string; quantity?: number; price?: number; image?: string }>;
  createdAt?: string;
  expiresAt?: string;
}

export interface OpsPlatformMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: { type: 'text' | 'image' | 'file'; body: string; mediaUrl?: string };
  direction: 'inbound' | 'outbound';
  timestamp: string;
  /** Structured booking/product/service/counter card snapshot (see above). */
  bookingOffer?: OpsBookingOffer;
  /** Structured manual product-order offer card snapshot. */
  orderOffer?: OpsManualOrderOffer;
}

export interface OpsPlatformConversation {
  conversationId: string;
  senderName: string;
  lastMessage?: string;
  status: 'open' | 'pending' | 'resolved';
  updatedAt: string;
}

export const operationsApi = {
  /** No params, called by staff, returns every real order (server auto-scopes non-staff callers). */
  /** Marketplace Access decisions (staff, or the owner of the brand / creator). */
  listMarketplaceAccessEvents: async (filter: { entityType?: 'brand' | 'creator'; entityId?: string; ownerUserId?: string }): Promise<MarketplaceAccessEvent[]> => {
    const q = new URLSearchParams();
    if (filter.entityType) q.set('entityType', filter.entityType);
    if (filter.entityId) q.set('entityId', filter.entityId);
    if (filter.ownerUserId) q.set('ownerUserId', filter.ownerUserId);
    const result = await request<{ data: MarketplaceAccessEvent[] }>(`/operations/marketplace-access-events?${q}`);
    return result.data;
  },
  /** Staff: ask the owner to upload specific verification documents (notifies them). */
  requestVerificationDocuments: async (input: { entityType: 'brand' | 'creator'; entityId: string; docTypes: string[]; note?: string }) => {
    const result = await request<{ data: VerificationDocRequest }>('/operations/verification-document-requests', 'POST', input);
    return result.data;
  },
  /** Document requests (staff: all; owner: those addressed to them). */
  listVerificationDocumentRequests: async (filter: { entityType?: 'brand' | 'creator'; entityId?: string }): Promise<VerificationDocRequest[]> => {
    const q = new URLSearchParams();
    if (filter.entityType) q.set('entityType', filter.entityType);
    if (filter.entityId) q.set('entityId', filter.entityId);
    const result = await request<{ data: VerificationDocRequest[] }>(`/operations/verification-document-requests?${q}`);
    return result.data;
  },
  /** Account Activity Log — `me` for the signed-in owner, or a user id (staff). */
  listAccountActivity: async (userId: string): Promise<{ rows: AccountActivityEntry[]; staffView: boolean }> => {
    const result = await request<{ data: AccountActivityEntry[]; staffView?: boolean }>(`/operations/account-activity/${encodeURIComponent(userId)}`);
    return { rows: result.data, staffView: Boolean(result.staffView) };
  },
  /** Staff view of a shopper's saved items, followed creators and recent searches. */
  getUserShopperSignals: async (userId: string): Promise<ShopperSignals> => {
    const result = await request<{ data: ShopperSignals }>(`/operations/shopper-signals/${encodeURIComponent(userId)}`);
    return result.data;
  },
  /** Signed-in owner's payout profile (bank / bKash / Nagad / Rocket). */
  getMyPayoutProfile: async (): Promise<{ profile: PayoutProfile | null; channels: PayoutChannel[]; updatedAt: string | null }> => {
    const result = await request<{ data: { profile: PayoutProfile | null; channels: PayoutChannel[]; updatedAt: string | null } }>('/operations/payout-profile/me');
    return result.data;
  },
  saveMyPayoutProfile: async (input: Partial<Omit<PayoutProfile, 'userId' | 'createdAt' | 'updatedAt'>>) => {
    const result = await request<{ data: { profile: PayoutProfile; channels: PayoutChannel[]; updatedAt: string } }>('/operations/payout-profile/me', 'PUT', input);
    return result.data;
  },
  /** Staff view of a user's payout channels (masked for support agents) + reminders sent. */
  getUserPayoutProfile: async (userId: string): Promise<{ channels: PayoutChannel[]; updatedAt: string | null; masked: boolean; reminders: PayoutReminder[] }> => {
    const result = await request<{ data: { channels: PayoutChannel[]; updatedAt: string | null; masked: boolean; reminders: PayoutReminder[] } }>(`/operations/payout-profile/${encodeURIComponent(userId)}`);
    return result.data;
  },
  sendPayoutReminder: async (userId: string): Promise<PayoutReminder> => {
    const result = await request<{ data: PayoutReminder }>(`/operations/payout-profile/${encodeURIComponent(userId)}/reminders`, 'POST', {});
    return result.data;
  },
  /** Super Admin edit sessions for a user (audit history + the active one). */
  listAdminEditSessions: async (targetUserId: string): Promise<AdminEditSession[]> => {
    const result = await request<{ data: AdminEditSession[] }>(`/operations/admin-edit-sessions?targetUserId=${encodeURIComponent(targetUserId)}`);
    return result.data;
  },
  startAdminEditSession: async (payload: {
    targetUserId: string;
    targetRole: AdminEditSession['targetRole'];
    targetLabel?: string;
    reason: AdminEditReason;
    reasonDetail: string;
    confirmed: true;
  }): Promise<AdminEditSession> => {
    const result = await request<{ data: AdminEditSession }>('/operations/admin-edit-sessions', 'POST', payload);
    return result.data;
  },
  endAdminEditSession: async (id: string): Promise<AdminEditSession> => {
    const result = await request<{ data: AdminEditSession }>(`/operations/admin-edit-sessions/${encodeURIComponent(id)}/end`, 'POST', {});
    return result.data;
  },
  /** Staff read-only: brand ids a user follows. */
  listUserFollowedBrandIds: async (userId: string): Promise<string[]> => {
    const result = await request<{ brandIds: string[] }>(`/follows/users/${encodeURIComponent(userId)}/brands`);
    return result.brandIds || [];
  },

  listOrders: async (params?: {
    buyerId?: string;
    sellerId?: string;
    status?: string;
  }): Promise<OpsStorefrontOrder[]> => {
    const qs = new URLSearchParams();
    if (params?.buyerId) qs.set('buyerId', params.buyerId);
    if (params?.sellerId) qs.set('sellerId', params.sellerId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    const result = await request<{ data: OpsStorefrontOrder[] }>(`/operations/orders${suffix}`);
    return result.data;
  },
  getOrder: async (orderId: string): Promise<OpsStorefrontOrder> => {
    const result = await request<{ data: OpsStorefrontOrder }>(
      `/operations/orders/${encodeURIComponent(orderId)}`,
    );
    return result.data;
  },
  /**
   * Lazily/idempotently ensures the seller sub-order has a real invoice
   * number, minting one server-side exactly once if eligible. Never mints a
   * second number on repeat calls. `eligible:false` (never a thrown error)
   * means the order isn't in an invoice-eligible state or its financial data
   * can't be resolved — callers must show an explicit unavailable state, not
   * a zeroed document.
   */
  ensureInvoiceNumber: async (
    orderId: string,
    sellerId: string,
  ): Promise<{ invoiceId: string | null; eligible: boolean; reason?: string }> => {
    const result = await request<{ data: { invoiceId: string | null; eligible: boolean; reason?: string } }>(
      `/operations/orders/${encodeURIComponent(orderId)}/subs/${encodeURIComponent(sellerId)}/invoice`,
      'POST',
    );
    return result.data;
  },
  markOrderItemDelivered: async (orderId: string, itemId: string): Promise<OpsStorefrontOrder> => {
    const result = await request<{ data: OpsStorefrontOrder }>(
      `/operations/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/mark-delivered`,
      'POST',
    );
    return result.data;
  },

  /** Staff-only order internal notes. A seller call 403s (surfaces as an error). */
  listOrderNotes: async (orderId: string): Promise<OpsOrderInternalNote[]> => {
    const result = await request<{ data: OpsOrderInternalNote[] }>(
      `/operations/orders/${encodeURIComponent(orderId)}/notes`,
    );
    return result.data;
  },
  addOrderNote: async (
    orderId: string,
    body: string,
    authorName?: string,
  ): Promise<OpsOrderInternalNote[]> => {
    const result = await request<{ data: OpsOrderInternalNote[] }>(
      `/operations/orders/${encodeURIComponent(orderId)}/notes`,
      'POST',
      { body, authorName },
    );
    return result.data;
  },

  // ── Canonical order lifecycle (Commerce FSM) ────────────────────────────
  // The rich order lifecycle (pending → confirmed → packed → shipped →
  // delivered → completed, + cancel) lives in the Commerce engine
  // (server/commerce/orderService.ts). Operations orders mirror its status.
  // These resolve + drive that canonical FSM; the server owns every
  // transition/role/ownership/idempotency rule.
  /**
   * The role-scoped Commerce order list (rich lifecycle status), joined to the
   * Operations orders by orderNumber for the Order Hub workflow tabs. Server
   * scopes: admin/staff → platform-wide; seller → its own (`as=seller`). A
   * forged `as`/id cannot widen — same boundary as GET /operations/orders.
   */
  listCommerceOrders: async (mode: 'admin' | 'seller'): Promise<CommerceOrderLite[]> => {
    const path = mode === 'seller' ? '/orders?as=seller' : '/orders';
    try {
      const result = await request<{ data: CommerceOrderLite[] }>(path);
      return Array.isArray(result.data) ? result.data : [];
    } catch {
      return [];
    }
  },
  getCommerceOrderByNumber: async (orderId: string): Promise<CommerceOrderLite | null> => {
    try {
      const result = await request<{ data: CommerceOrderLite }>(
        `/orders/by-number/${encodeURIComponent(orderId)}`,
      );
      return result.data;
    } catch (err) {
      // 404 = this Operations order has no Commerce lifecycle record (booking / legacy).
      if (err instanceof Error && /\(404\)|not found|No commerce order/i.test(err.message)) return null;
      throw err;
    }
  },
  transitionCommerceOrder: async (
    commerceOrderId: string,
    status: CommerceOrderLite['status'],
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: { order: CommerceOrderLite } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/transition`,
      'POST',
      { status },
    );
    return result.data.order;
  },
  cancelCommerceOrder: async (
    commerceOrderId: string,
    reason: string,
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: CommerceOrderLite }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/cancel`,
      'POST',
      { reason },
    );
    return result.data;
  },
  /** Controlled correction: confirmed → pending only. Server validates eligibility. */
  returnCommerceOrderToPending: async (
    commerceOrderId: string,
    reason: string,
  ): Promise<CommerceOrderLite> => {
    const result = await request<{ data: CommerceOrderLite }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/return-to-pending`,
      'POST',
      { reason },
    );
    return result.data;
  },

  /**
   * Dispatch Details gate: Processing/Packed → Dispatched. Writes the canonical
   * OpsShipment then advances the lifecycle. A 400 with { code:'DISPATCH_VALIDATION',
   * details:{field:msg} } means the form is incomplete and the order did NOT move.
   */
  dispatchCommerceOrder: async (
    commerceOrderId: string,
    body: {
      fulfillmentMethod: 'courier' | 'seller_delivery' | 'pickup';
      courier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedDelivery?: string;
      dispatchNote?: string;
    },
  ): Promise<{ order: CommerceOrderLite; shipment: OpsShipment; reused: boolean }> => {
    const result = await request<{ data: { order: CommerceOrderLite; shipment: OpsShipment; reused: boolean } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/dispatch`,
      'POST',
      body,
    );
    return result.data;
  },

  /**
   * Administrative Status Correction (staff-only). Allowed targets per state:
   * confirmed→pending · packed→confirmed|pending · shipped→packed (pre-movement).
   */
  adminCorrectCommerceOrder: async (
    commerceOrderId: string,
    toStatus: 'pending' | 'confirmed' | 'packed',
    reason: string,
  ): Promise<{ order: CommerceOrderLite; from: string; to: string }> => {
    const result = await request<{ data: { order: CommerceOrderLite; from: string; to: string } }>(
      `/orders/${encodeURIComponent(commerceOrderId)}/admin-correct`,
      'POST',
      { toStatus, reason },
    );
    return result.data;
  },
  createOrder: async (
    payload: Partial<OpsStorefrontOrder>,
  ): Promise<OpsStorefrontOrder & { confirmOrderUrl?: string }> => {
    const result = await request<{ data: OpsStorefrontOrder; confirmOrderUrl?: string }>(
      '/operations/orders',
      'POST',
      payload,
    );
    return { ...result.data, confirmOrderUrl: result.confirmOrderUrl };
  },

  listCoupons: async (): Promise<OpsCoupon[]> => {
    const result = await request<{ data: OpsCoupon[] }>('/operations/coupons');
    return result.data;
  },
  upsertCoupon: async (payload: Partial<OpsCoupon>): Promise<OpsCoupon> => {
    if (payload.id) {
      const result = await request<{ data: OpsCoupon }>(`/operations/coupons/${payload.id}`, 'PATCH', payload);
      return result.data;
    }
    const result = await request<{ data: OpsCoupon }>('/operations/coupons', 'POST', payload);
    return result.data;
  },
  validateCoupon: async (payload: {
    code: string;
    cartTotal: number;
    userId?: string;
    cartItems?: { id: string; price: number; category?: string; brand?: string; quantity?: number }[];
  }): Promise<{ valid: boolean; discount: number; type?: string; code?: string; reason?: string }> =>
    request('/operations/coupons/validate', 'POST', payload),

  deleteCoupon: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/coupons/${id}`, 'DELETE');
  },

  listFeeCharges: async (): Promise<OpsFeeCharge[]> => {
    const result = await request<{ data: OpsFeeCharge[] }>('/operations/fee-charges');
    return result.data;
  },
  upsertFeeCharge: async (payload: Partial<OpsFeeCharge>): Promise<OpsFeeCharge> => {
    if (payload.id) {
      const result = await request<{ data: OpsFeeCharge }>(`/operations/fee-charges/${payload.id}`, 'PATCH', payload);
      return result.data;
    }
    const result = await request<{ data: OpsFeeCharge }>('/operations/fee-charges', 'POST', payload);
    return result.data;
  },
  deleteFeeCharge: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/fee-charges/${id}`, 'DELETE');
  },

  getPaymentOptionsConfig: async (): Promise<OpsPaymentOptionsConfig> => {
    const result = await request<{ data: OpsPaymentOptionsConfig }>('/operations/payment-options');
    return result.data;
  },
  updatePaymentOptionsConfig: async (payload: Partial<OpsPaymentOptionsConfig>): Promise<OpsPaymentOptionsConfig> => {
    const result = await request<{ data: OpsPaymentOptionsConfig }>('/operations/payment-options', 'PUT', payload);
    return result.data;
  },

  listReviews: async (filter?: { sellerId?: string; userId?: string }): Promise<OpsReview[]> => {
    const q = new URLSearchParams();
    if (filter?.sellerId) q.set('sellerId', filter.sellerId);
    if (filter?.userId) q.set('userId', filter.userId);
    const qs = q.toString() ? `?${q}` : '';
    const result = await request<{ data: OpsReview[] }>(`/operations/reviews${qs}`);
    return result.data;
  },
  updateReview: async (id: string, payload: Partial<OpsReview>): Promise<OpsReview> => {
    const result = await request<{ data: OpsReview }>(`/operations/reviews/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteReview: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/operations/reviews/${id}`, 'DELETE');
  },

  listLeads: async (): Promise<OpsLead[]> => {
    const result = await request<{ data: OpsLead[] }>('/operations/leads');
    return result.data;
  },
  getLead: async (id: string): Promise<OpsLead> => {
    const result = await request<{ data: OpsLead }>(`/operations/leads/${encodeURIComponent(id)}`);
    return result.data;
  },
  /** Status only — submitted inquiry fields are immutable server-side. */
  updateLead: async (id: string, payload: { status: OpsLead['status'] }): Promise<OpsLead> => {
    const result = await request<{ data: OpsLead }>(`/operations/leads/${encodeURIComponent(id)}`, 'PATCH', { status: payload.status });
    return result.data;
  },
  addLeadNote: async (id: string, body: string): Promise<OpsLead> => {
    const result = await request<{ data: OpsLead }>(`/operations/leads/${encodeURIComponent(id)}/notes`, 'POST', { body });
    return result.data;
  },

  listJobs: async (): Promise<OpsJobPosting[]> => {
    const result = await request<{ data: OpsJobPosting[] }>('/operations/jobs');
    return result.data;
  },
  createJob: async (
    payload: Omit<OpsJobPosting, 'id' | 'postedAt' | 'createdAt' | 'updatedAt'> & { slug?: string },
  ): Promise<OpsJobPosting> => {
    const result = await request<{ data: OpsJobPosting }>('/operations/jobs', 'POST', payload);
    return result.data;
  },
  updateJob: async (id: string, payload: Partial<OpsJobPosting>): Promise<OpsJobPosting> => {
    const result = await request<{ data: OpsJobPosting }>(`/operations/jobs/${id}`, 'PATCH', payload);
    return result.data;
  },
  listJobApplications: async (jobId?: string): Promise<OpsJobApplication[]> => {
    const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
    const result = await request<{ data: OpsJobApplication[] }>(`/operations/job-applications${qs}`);
    return result.data;
  },
  updateJobApplication: async (
    id: string,
    payload: Partial<OpsJobApplication>,
  ): Promise<OpsJobApplication> => {
    const result = await request<{ data: OpsJobApplication }>(
      `/operations/job-applications/${id}`,
      'PATCH',
      payload,
    );
    return result.data;
  },

  getPermissions: async (): Promise<Record<string, Record<PermissionKey, boolean>>> => {
    const result = await request<{ permissions: Record<string, Record<PermissionKey, boolean>> }>(
      '/operations/permissions',
    );
    return result.permissions;
  },
  updatePermissions: async (
    permissions: Record<string, Record<PermissionKey, boolean>>,
  ): Promise<Record<string, Record<PermissionKey, boolean>>> => {
    const result = await request<{ permissions: Record<string, Record<PermissionKey, boolean>> }>(
      '/operations/permissions',
      'PUT',
      { permissions },
    );
    return result.permissions;
  },

  /**
   * GET /operations/analytics returns the admin-shaped AnalyticsSummary
   * directly for admin/staff, but for seller/creator callers the server
   * returns the role-scoped RoleAnalyticsPayload instead (cards/quickLinks/
   * summary) -- same endpoint, role-dependent shape. Callers must narrow
   * on 'cards' in result before assuming either shape.
   */
  getAnalytics: async (range = '30d'): Promise<AnalyticsSummary | RoleAnalyticsPayload> => {
    const result = await request<{ data: AnalyticsSummary | RoleAnalyticsPayload }>(
      `/operations/analytics?range=${range}`,
    );
    return result.data;
  },

  getRoleAnalytics: async (role: string, range = '30d'): Promise<RoleAnalyticsPayload> => {
    const result = await request<{ data: RoleAnalyticsPayload }>(
      `/operations/analytics/role/${encodeURIComponent(role)}?range=${range}`,
    );
    return result.data;
  },

  listShipments: async (): Promise<OpsShipment[]> => {
    const result = await request<{ data: OpsShipment[] }>('/operations/shipments');
    return result.data;
  },
  /** Matches by shipment id, orderId, or trackingNumber — server-side lookup (shipmentStore.getShipment). */
  getShipment: async (idOrOrderIdOrTrackingNumber: string): Promise<OpsShipment> => {
    const result = await request<{ data: OpsShipment }>(
      `/operations/shipments/${encodeURIComponent(idOrOrderIdOrTrackingNumber)}`,
    );
    return result.data;
  },
  /** Only courier/trackingNumber are updatable — see OpsShipmentPatch. */
  updateShipment: async (id: string, patch: OpsShipmentPatch): Promise<OpsShipment> => {
    const result = await request<{ data: OpsShipment }>(
      `/operations/shipments/${encodeURIComponent(id)}`,
      'PATCH',
      patch,
    );
    return result.data;
  },

  // ── Canonical booking requests (/api/v1/booking/*) ────────────────────
  // Seller-scoped: the accept/counter/decline routes derive sellerId from
  // the authenticated session; GET filters by the sellerId/buyerId query.
  // Used to re-resolve the *current* status of a bookingOffer snapshot
  // embedded on a System-B platform message — no state is duplicated.
  listBookingRequests: async (params: {
    sellerId?: string;
    buyerId?: string;
    conversationId?: string;
    status?: string;
  }): Promise<OpsBookingOffer[]> => {
    const qs = new URLSearchParams();
    if (params.sellerId) qs.set('sellerId', params.sellerId);
    if (params.buyerId) qs.set('buyerId', params.buyerId);
    if (params.conversationId) qs.set('conversationId', params.conversationId);
    if (params.status) qs.set('status', params.status);
    const result = await request<{ data: OpsBookingOffer[] }>(
      `/booking/requests?${qs.toString()}`,
    );
    return result.data;
  },
  getBookingRequest: async (requestId: string): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}`,
    );
    return result.data;
  },
  acceptBookingRequest: async (
    requestId: string,
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/accept`,
      'POST',
      { sellerName },
    );
    return result.data;
  },
  declineBookingRequest: async (
    requestId: string,
    declineReason: string,
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/decline`,
      'POST',
      { declineReason, sellerName },
    );
    return result.data;
  },
  counterBookingRequest: async (
    requestId: string,
    patch: { price?: number; fields?: Record<string, string | number>; notes?: string },
    sellerName?: string,
  ): Promise<OpsBookingOffer> => {
    const result = await request<{ data: OpsBookingOffer }>(
      `/booking/requests/${encodeURIComponent(requestId)}/counter`,
      'POST',
      { ...patch, sellerName },
    );
    return result.data;
  },

  /**
   * Canonical Seller Manual Order — POST /operations/manual-offers.
   * Native mode: pass `buyerId` (existing Choosify Buyer) → Offer Card in
   * their Messages. External mode: omit buyerId, pass customerName + email +
   * phone → server returns a secure `claim.url` for the customer.
   */
  createManualOffer: async (input: {
    buyerId?: string;
    customerName?: string;
    email?: string;
    phone?: string;
    addressHint?: string;
    conversationId?: string;
    provenanceSource?:
      | 'manual'
      | 'external_whatsapp'
      | 'external_facebook'
      | 'external_instagram'
      | 'external_offline';
    deliveryTotal?: number;
    notes?: string;
    sellerName?: string;
    buyerName?: string;
    items: Array<{ productId: string; quantity: number; price: number; variantId?: string }>;
  }): Promise<{
    data: OpsManualOrderOffer;
    claim?: { token: string; url: string; expiresAt?: string };
  }> => {
    const result = await request<{
      success: boolean;
      data: OpsManualOrderOffer;
      claim?: { token: string; url: string; expiresAt?: string };
    }>('/operations/manual-offers', 'POST', input);
    return { data: result.data, claim: result.claim };
  },

  getFeatureFlags: async (): Promise<Record<string, boolean>> => {
    const result = await request<{ flags: Record<string, boolean> }>('/operations/feature-flags');
    return result.flags;
  },
  updateFeatureFlags: async (flags: Record<string, boolean>): Promise<Record<string, boolean>> => {
    const result = await request<{ flags: Record<string, boolean> }>('/operations/feature-flags', 'PUT', { flags });
    return result.flags;
  },
  listUsers: async () => {
    const result = await request<{ data: unknown[] }>('/operations/users');
    return result.data;
  },
  listSellerOffers: async () => {
    const result = await request<{ data: unknown[] }>('/operations/seller-offers');
    return result.data;
  },
  updateSellerOffer: async (id: string, payload: Record<string, unknown>) => {
    const result = await request<{ data: unknown }>(`/operations/seller-offers/${id}`, 'PATCH', payload);
    return result.data;
  },

  listReturns: async (filter?: {
    buyerId?: string;
    sellerId?: string;
    status?: string;
    orderId?: string;
  }): Promise<import('../contexts/ReturnsContext').ReturnRequest[]> => {
    const params = new URLSearchParams();
    if (filter?.buyerId) params.set('buyerId', filter.buyerId);
    if (filter?.sellerId) params.set('sellerId', filter.sellerId);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.orderId) params.set('orderId', filter.orderId);
    const qs = params.toString();
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest[] }>(
      `/operations/returns${qs ? `?${qs}` : ''}`,
    );
    return result.data;
  },
  getReturn: async (id: string): Promise<import('../contexts/ReturnsContext').ReturnRequest> => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}`,
    );
    return result.data;
  },
  getReturnDocument: async (id: string) => {
    const result = await request<{
      data: {
        returnCase: import('../contexts/ReturnsContext').ReturnRequest;
        buyer: { name: string; choosifyUserId: string | null; email: string } | null;
        seller: { name: string; choosifyUserId: string | null; email: string } | null;
        product: { title?: string; variant?: string } | null;
      };
    }>(`/operations/returns/${encodeURIComponent(id)}/document`);
    return result.data;
  },
  createReturn: async (
    payload: Partial<import('../contexts/ReturnsContext').ReturnRequest>,
  ): Promise<import('../contexts/ReturnsContext').ReturnRequest> => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      '/operations/returns',
      'POST',
      payload,
    );
    return result.data;
  },
  approveReturn: async (id: string, refundAmount: number, requiresReturn: boolean, note?: string, approvedBy?: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/approve`,
      'PATCH',
      { refundAmount, requiresReturn, note, approvedBy },
    );
    return result.data;
  },
  rejectReturn: async (id: string, reason: string, approvedBy?: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/reject`,
      'PATCH',
      { reason, approvedBy },
    );
    return result.data;
  },
  processReturnRefund: async (id: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/refund`,
      'PATCH',
      {},
    );
    return result.data;
  },
  updateReturnStatus: async (
    id: string,
    status: import('../contexts/ReturnsContext').ReturnRequest['status'],
  ) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/status`,
      'PATCH',
      { status },
    );
    return result.data;
  },
  addReturnNote: async (id: string, note: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/note`,
      'PATCH',
      { note },
    );
    return result.data;
  },
  /** Staff/seller-only — never shown to the buyer. */
  addReturnInternalNote: async (id: string, note: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/internal-note`,
      'PATCH',
      { note },
    );
    return result.data;
  },
  generateReturnLabel: async (id: string) => {
    const result = await request<{
      data: import('../contexts/ReturnsContext').ReturnRequest;
      labelUrl: string;
      trackingId: string;
      courier: string;
    }>(`/operations/returns/${encodeURIComponent(id)}/label`, 'POST', {});
    return result;
  },
  /** Creates a real Dispute case server-side (server/operations disputes) and links this return to it -- no client-fabricated id. */
  linkReturnToDispute: async (id: string, reason?: string) => {
    const result = await request<{ data: import('../contexts/ReturnsContext').ReturnRequest }>(
      `/operations/returns/${encodeURIComponent(id)}/dispute`,
      'PATCH',
      { reason },
    );
    return result.data;
  },

  listVerifications: async (params?: {
    status?: string;
    entityType?: string;
    entityId?: string;
    kind?: 'owner_verification' | 'ownership_claim';
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.kind) qs.set('kind', params.kind);
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.entityId) qs.set('entityId', params.entityId);
    const suffix = qs.toString() ? `?${qs}` : '';
    const result = await request<{ data: OpsVerification[] }>(`/operations/verifications${suffix}`);
    return result.data;
  },

  // ── Community Claimable Profiles ──────────────────────────────────────
  /** Possible duplicates (warnings only) before creating a community profile. */
  findCommunityDuplicates: async (params: { entityType: 'brand' | 'creator'; name: string; website?: string; socialLinks?: Record<string, string> }) => {
    const qs = new URLSearchParams({ entityType: params.entityType, name: params.name });
    if (params.website) qs.set('website', params.website);
    for (const [k, v] of Object.entries(params.socialLinks || {})) if (v) qs.set(k, v);
    const result = await request<{ data: CommunityDuplicate[] }>(`/catalog/community-profiles/duplicates?${qs}`);
    return result.data;
  },
  createCommunityProfile: async (input: CommunityProfileInput) => {
    const result = await request<{ data: { id: string; name: string; slug: string } }>('/catalog/community-profiles', 'POST', input);
    return result.data;
  },
  updateCommunityProfile: async (id: string, input: Omit<CommunityProfileInput, 'publish' | 'acknowledgeDuplicates'>) => {
    const result = await request<{ data: { id: string; name: string; slug: string } }>(
      `/catalog/community-profiles/${input.entityType}/${encodeURIComponent(id)}`,
      'PATCH',
      input,
    );
    return result.data;
  },
  deleteCommunityProfile: async (entityType: 'brand' | 'creator', id: string) => {
    return request<{ data: { name: string }; warning?: string }>(`/catalog/community-profiles/${entityType}/${encodeURIComponent(id)}`, 'DELETE');
  },
  getCommunityProfileCopy: async () => {
    const result = await request<{ data: CommunityProfileCopy }>('/catalog/site/community-profiles');
    return result.data;
  },
  updateCommunityProfileCopy: async (copy: Pick<CommunityProfileCopy, 'brandDisclaimer' | 'creatorDisclaimer' | 'claimReviewNotice'>) => {
    const result = await request<{ data: CommunityProfileCopy }>('/catalog/site/community-profiles', 'PUT', copy);
    return result.data;
  },
  withdrawOwnershipClaim: async (id: string, reason?: string) => {
    const result = await request<{ data: OpsVerification }>(`/operations/verifications/${encodeURIComponent(id)}/withdraw`, 'POST', { reason });
    return result.data;
  },

  /** Real Seller/Creator onboarding requests — GET /operations/partner-applications (requireAdmin). */
  listPartnerApplications: async (status?: 'pending' | 'approved' | 'rejected') => {
    const suffix = status ? `?status=${status}` : '';
    const result = await request<{ success: boolean; applications: OpsPartnerApplication[] }>(
      `/operations/partner-applications${suffix}`,
    );
    return result.applications;
  },

  /** POST /operations/partner-applications/:id/approve (requireAdmin) — identity approval only; Marketplace Access is granted separately. */
  approvePartnerApplication: async (id: string, note?: string) => {
    const result = await request<{ success: boolean; application: OpsPartnerApplication }>(
      `/operations/partner-applications/${encodeURIComponent(id)}/approve`,
      'POST',
      { note },
    );
    return result.application;
  },

  /** POST /operations/partner-applications/:id/resubmit (requireAdmin) — stays pending; asks the applicant for changes. */
  requestPartnerResubmission: async (id: string, note: string) => {
    const result = await request<{ success: boolean; application: OpsPartnerApplication }>(
      `/operations/partner-applications/${encodeURIComponent(id)}/resubmit`,
      'POST',
      { note },
    );
    return result.application;
  },

  /** PATCH /operations/partner-applications/:id/notes (requireAdmin) — internal notes; keeps the application pending. */
  savePartnerApplicationNotes: async (id: string, adminNotes: string) => {
    const result = await request<{ success: boolean; application: OpsPartnerApplication }>(
      `/operations/partner-applications/${encodeURIComponent(id)}/notes`,
      'PATCH',
      { adminNotes },
    );
    return result.application;
  },

  /** POST /operations/partner-applications/:id/reject (requireAdmin). */
  rejectPartnerApplication: async (id: string, note?: string) => {
    const result = await request<{ success: boolean; application: OpsPartnerApplication }>(
      `/operations/partner-applications/${encodeURIComponent(id)}/reject`,
      'POST',
      { note },
    );
    return result.application;
  },
  getVerification: async (id: string) => {
    const result = await request<{ data: unknown }>(`/operations/verifications/${encodeURIComponent(id)}`);
    return result.data;
  },
  createVerification: async (payload: Record<string, unknown>) => {
    const result = await request<{ data: unknown }>('/operations/verifications', 'POST', payload);
    return result.data;
  },
  submitVerification: async (id: string) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/submit`,
      'PATCH',
      {},
    );
    return result.data;
  },
  updateVerificationDocument: async (
    id: string,
    docId: string,
    payload: { status: 'approved' | 'rejected'; notes?: string },
  ) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/document/${encodeURIComponent(docId)}`,
      'PATCH',
      payload,
    );
    return result.data;
  },
  /** Owner (or Admin) adds a document to an open request (Draft / Submitted / Under Review). */
  addVerificationDocument: async (
    id: string,
    payload: { type: string; name: string; doc_url: string },
  ) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/documents`,
      'POST',
      payload,
    );
    return result.data;
  },
  /** Owner attaches (or re-submits) their current account profile picture as the Profile Photo document. */
  attachVerificationProfilePhoto: async (id: string) => {
    const result = await request<{ data: unknown }>(`/operations/verifications/${encodeURIComponent(id)}/profile-photo`, 'POST', {});
    return result.data;
  },
  /** Owner (or Admin) removes a not-yet-approved document from an open request. */
  removeVerificationDocument: async (id: string, docId: string) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/document/${encodeURIComponent(docId)}`,
      'DELETE',
    );
    return result.data;
  },
  /** Owner (or Admin) replace/re-upload — resets document to pending. */
  replaceVerificationDocument: async (
    id: string,
    docId: string,
    payload: { doc_url: string; name?: string },
  ) => {
    const result = await request<{ data: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/document/${encodeURIComponent(docId)}/replace`,
      'PUT',
      payload,
    );
    return result.data;
  },
  /**
   * Admin / Super Admin: revoke an approved owner verification — removes the
   * verified badge, rejects the chosen documents with `reason` and reopens the
   * request for the owner. Ownership and Marketplace Access are unchanged.
   */
  revokeVerification: async (id: string, payload: { reason: string; documentIds: string[] }) => {
    const result = await request<{ data: unknown }>(`/operations/verifications/${encodeURIComponent(id)}/revoke`, 'POST', payload);
    return result.data;
  },
  reviewVerification: async (
    id: string,
    payload: { status: 'approved' | 'rejected' | 'request_info' | 'under_review'; feedback: string; reviewer_name?: string },
  ) => {
    const result = await request<{ data: unknown; catalogSideEffect?: unknown }>(
      `/operations/verifications/${encodeURIComponent(id)}/review`,
      'PATCH',
      payload,
    );
    return result;
  },

  /**
   * Real buyer<->seller conversation thread (one per buyer, id
   * conv_platform_<buyerId>) -- the same backend choosify-web's buyer
   * inbox reads/writes. A seller/creator may read/reply to any buyer
   * they have a real order/booking/manual-offer relationship with
   * (enforced server-side); passing userId=<buyerId> resolves that
   * buyer's conversation for the caller.
   */
  listPlatformMessages: async (userId: string): Promise<{ data: OpsPlatformMessage[]; conversationId: string }> => {
    return request<{ data: OpsPlatformMessage[]; conversationId: string }>(
      `/operations/platform-messages?userId=${encodeURIComponent(userId)}`,
    );
  },
  sendPlatformMessage: async (payload: {
    buyerId: string;
    userName: string;
    body: string;
    orderId?: string;
  }): Promise<{ conversation: OpsPlatformConversation; message: OpsPlatformMessage }> => {
    const result = await request<{ success: boolean; data: { conversation: OpsPlatformConversation; message: OpsPlatformMessage } }>(
      '/operations/platform-messages',
      'POST',
      payload,
    );
    return result.data;
  },
};
