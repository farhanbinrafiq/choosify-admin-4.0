import { randomBytes } from 'crypto';
import { Router } from 'express';
import { operationsStore, DEFAULT_ROLE_PERMISSIONS } from './operations/operationsStore';
import { isProductLifecyclePubliclyListable, normalizeProductLifecycle } from './catalog/productLifecycle';
import { validateCoupon } from './operations/couponValidator';
import { getAnalyticsSummary, getRoleAnalytics } from './operations/analyticsService';
import { getSellerDashboardIntelligence } from './operations/sellerIntelligenceService';
import { shipmentStore, type OpsShipment } from './operations/shipmentStore';
import {
  ensurePlatformOrderConversation,
  submitPlatformMessage,
} from './operations/platformMessagingBridge';
import { scheduleOperationsPersist } from './operations/operationsPersistence';
import { ensureSubOrderInvoiceNumber } from './operations/invoiceAssignment';
import type {
  OpsCoupon,
  OpsDispute,
  OpsDisputeDecision,
  OpsDisputeSourceType,
  OpsDisputeStatus,
  OpsFeeCharge,
  OpsReturnRequest,
  OpsReturnStatus,
  OpsReturnTimelineEntry,
  OpsReview,
  OpsStorefrontOrder,
  OpsOrderInternalNote,
  OpsLead,
  OpsVerificationDocument,
  OpsVerificationRequest,
  OpsWarrantyClaim,
  OpsWarrantyClaimStatus,
  OpsWarrantyClaimServiceStage,
  OpsWarrantyClaimResolutionType,
  OpsWarrantyClaimTimelineEntry,
  OpsWarrantyClaimAttachmentCategory,
  PermissionKey,
} from './operations/types';
import { OPEN_DISPUTE_STATUSES, WARRANTY_CLAIM_SERVICE_STAGE_ORDER, WARRANTY_CLAIM_ATTACHMENT_CATEGORIES } from './operations/types';
import { ensureEntityReferenceId } from './referenceIds/referenceIdService';
import { processEscrowRefund } from './escrow/escrowService';
import { escrowStore } from './escrow/escrowStore';
import { CommerceError } from './commerce/cartService';
import { db } from './db/client';
import { users } from './db/schema';
import { eq, inArray } from 'drizzle-orm';
import { validate } from './middleware/validate';
import { authenticateRequest, softAuthenticateRequest } from './middleware/auth';
import { requireRole } from './middleware/authorization';
import {
  detectBrandDuplicateSignals,
  findRecentResubmission,
  inquiryOptionsPayload,
  notifyInquiryCreated,
  validateInquiry,
} from './inquiries/inquiryService';
import { INQUIRY_STATUSES, type InquiryType } from '../shared/inquiries/inquiryOptions';
import { requirePartnerEntitlement } from './entitlements/entitlementMiddleware';
import { requireMarketplaceAccess } from './entitlements/marketplaceAccessMiddleware';
import { requireModerator as requireModeratorRole } from './middleware/requireModerator';
import { hasRole } from './permissions/authorization';
import { ROLES } from './permissions/roles';
import { CouponValidateBodySchema } from './validation/operations/couponValidateSchema';
import {
  evaluatePostOrderConversationExpiry,
  type OrderLikeForExpiry,
} from '../shared/messaging/conversationExpiry';
import { catalogStore } from '../lib/vercel-catalog/catalogStore';
import {
  reserveInventoryQuantity,
  releaseInventoryQuantity,
} from './catalog/inventoryStore';
import { getService } from './catalog/serviceStore';
import { resolveActiveGuideOffer, guideOfferWasPresent } from './catalog/guideOfferService';
import { normalizeBrandInput } from './catalogContract';
import { normalizeCreatorInput } from '../lib/vercel-catalog/catalogEditorialContract';
import { recordSuspiciousRequest, recordClaimConfirmAttempt } from './lib/abuseProtection';
import { normalizePrimaryPhone } from './lib/phone';
import {
  normalizeEmail,
  normalizeBdPhone,
  isPlausibleEmail,
  isPlausibleBdPhone,
} from './lib/identityNormalize';
import {
  generateClaimToken,
  hashClaimToken,
  claimTokenMatches,
  claimTokenExpiryIso,
  isClaimExpired,
} from './lib/claimToken';
import { findAccountByNormalizedEmail } from './operations/operationsDb';
import { batchAccountPrimaryLabels } from './profileStatusFacts';
import { Logger } from './lib/logger';
import { randomUUID } from 'crypto';
import { ownerView, recordAccountActivity } from './accountActivity/accountActivity';
import { recordKey, withRecordLocks } from './catalog/recordLock';
import { createCommunityProfile, type CommunityProfileInput } from './claims/communityProfiles';
import type { CatalogBrand } from '../src/types/catalog';
import {
  ACTIVE_VERIFICATION_STATUSES,
  ClaimError,
  approveOwnershipClaim,
  assignOwnerExplicitly,
  closeOwnershipClaim,
  createClaimIntent,
  createOwnershipClaim,
  emailUser,
  expireStaleClaims,
  isPrivateUploadUrl,
  loadClaimant,
  loadEntity,
  ownerOf,
  publicOwnership,
  activeOwnershipClaims,
  requiredRoleFor,
  resolveClaimIntent,
  recordAudit,
  roleCanClaim,
  verificationKindOf,
  type ClaimEntityType,
} from './claims/ownershipClaims';
import {
  PROFILE_PHOTO_DOCUMENT,
  VERIFICATION_DOCUMENT_TYPES,
  claimantDetailsProblem,
  missingClaimDocuments,
  missingRequiredDocuments,
  type ClaimantDetails,
  verificationDocumentLabel,
  verificationDocumentSpecs,
} from '../shared/verification/verificationDocuments';
import { createNotification } from './communication/notificationService';
import { notifyRoles, notifyUser } from './communication/systemNotify';
import { COMMUNICATION_TYPES, DELIVERY_CHANNELS } from './communication/communicationTypes';
import { publishEvent } from './events/eventBus';
import {
  saveManualOrderOffer,
  getManualOrderOffer,
  listManualOrderOffers,
} from './operations/manualOrderOfferStore';
import {
  type ManualOrderOffer,
  type ManualOrderOfferItem,
  toManualOrderOfferCard,
} from '../shared/manualOrder/manualOrderTypes';

export const operationsRouter = Router();

const requireAuth = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess];
/** Admin or super_admin (via ROLE_INHERITANCE). */
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];
/** Moderator+ (admin/super_admin inherit moderator). */
const requireModerator = [authenticateRequest, requireModeratorRole];

/**
 * Coupons UI (`/admin/coupons`, content gate) is available to admin and seller
 * (and marketing_manager). Coupons are platform-wide today — not seller-scoped —
 * so sellers who can open the page may CRUD them. Validate stays public for checkout.
 */
function userCanManageCoupons(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  const role = req.userRole;
  if (!role) return false;
  return (
    hasRole(role, ROLES.ADMIN) ||
    hasRole(role, ROLES.SELLER) ||
    hasRole(role, ROLES.VERIFIED_SELLER) ||
    hasRole(role, ROLES.MARKETING_MANAGER)
  );
}

/**
 * PATCH /operations/orders/:id field whitelist.
 * Audited callers (Choosify-Web + admin): none currently hit this HTTP route —
 * storefront `updateOrder` and admin Orders Hub mutate local state only; booking
 * payment updates call `operationsStore.updateOrder` in-process. Keep this list
 * empty until a real client is wired, then add only the fields that client sends.
 * Cancel / returns get dedicated endpoints (not this generic PATCH).
 */
const ORDER_PATCH_ALLOWED_KEYS = [] as const;

type OrderPatchBody = Partial<Pick<OpsStorefrontOrder, (typeof ORDER_PATCH_ALLOWED_KEYS)[number]>>;

function pickOrderPatch(body: unknown): { patch: OrderPatchBody; rejected: string[] } {
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const rejected = Object.keys(raw).filter(
    (key) => !(ORDER_PATCH_ALLOWED_KEYS as readonly string[]).includes(key),
  );
  const patch: OrderPatchBody = {};
  for (const key of ORDER_PATCH_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      (patch as Record<string, unknown>)[key] = raw[key];
    }
  }
  return { patch, rejected };
}

function userCanMutateOrder(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  order: OpsStorefrontOrder,
): boolean {
  const userId = req.userId;
  if (!userId) return false;
  if (order.buyerId === userId) return true;

  const role = req.userRole;
  if (
    role &&
    (hasRole(role, ROLES.SUPER_ADMIN) ||
      hasRole(role, ROLES.ADMIN) ||
      hasRole(role, ROLES.SUPPORT_AGENT) ||
      hasRole(role, ROLES.MODERATOR) ||
      hasRole(role, ROLES.FINANCE_MANAGER))
  ) {
    return true;
  }

  if (role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER))) {
    const subs = (order.subOrders || []) as Array<{ sellerId?: string }>;
    return subs.some((sub) => sub.sellerId === userId);
  }

  return false;
}

/** Cancel is buyer-only — authenticated uid must own the order (ignore body buyerId spoofing). */
function userIsOrderBuyer(
  req: { userId?: string },
  order: OpsStorefrontOrder,
): boolean {
  return Boolean(req.userId && order.buyerId === req.userId);
}

function userIsStaff(req: { userRole?: (typeof ROLES)[keyof typeof ROLES] }): boolean {
  const role = req.userRole;
  if (!role) return false;
  return (
    hasRole(role, ROLES.SUPER_ADMIN) ||
    hasRole(role, ROLES.ADMIN) ||
    hasRole(role, ROLES.SUPPORT_AGENT) ||
    hasRole(role, ROLES.MODERATOR) ||
    hasRole(role, ROLES.FINANCE_MANAGER)
  );
}

/** Manual / Meta-inbox orders: staff or seller may create an unclaimed order with a claim link. */
function userCanCreateManualOrder(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  return Boolean(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)));
}

/**
 * Sprint 12 pre-beta audit — P0 fix: POST /operations/orders previously trusted
 * body.overallTotal/body.subtotal and every subOrder item's client-supplied
 * `price` verbatim (`Number(body.overallTotal || 0)`, `body.subOrders || []`),
 * with zero server-side recomputation. Verified live: a real ৳9999 product
 * could be checked out for ৳1. This mirrors the price re-resolution already
 * done correctly by the newer engine (server/commerce/checkoutService.ts
 * `revalidateCartItem` — `item.unitPrice = product.price`), applied here for
 * the storefront's actual live checkout path (Choosify-Web CheckoutPage.tsx
 * -> operationsApi.createOrder -> this endpoint).
 *
 * Only applied to buyer-initiated (non-manual) orders — manual orders remain
 * staff-only (userCanCreateManualOrder) and deliberately support a staff
 * price override (Sprint 11 Messages.tsx "Price Overwrite" field, via the
 * separate checkoutService.createManualOrder path), a different, already
 * trust-appropriate flow.
 */
/** Mirrors Choosify-Web CheckoutPage.tsx's DELIVERY_FEE_PER_SELLER flat rate. */
const FLAT_DELIVERY_FEE_PER_SELLER = 120;

/**
 * Thrown by recomputeOrderPricingServerSide when it can't be resolved to a plain
 * 400. Lets the POST /operations/orders handler emit a specific status + code so
 * the storefront can react (e.g. GUIDE_OFFER_PRICE_CHANGED → show the buyer the
 * updated total and require re-confirmation).
 */
class OrderPricingError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  constructor(message: string, statusCode = 400, opts?: { code?: string; details?: Record<string, unknown> }) {
    super(message);
    this.name = 'OrderPricingError';
    this.statusCode = statusCode;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

async function recomputeOrderPricingServerSide(
  body: Partial<OpsStorefrontOrder>,
): Promise<{ subOrders: unknown[]; subtotal: number; deliveryTotal: number; overallTotal: number; promoDiscount: number }> {
  const rawSubOrders = Array.isArray(body.subOrders) ? body.subOrders : [];
  let subtotal = 0;
  let deliveryTotal = 0;

  const recomputedSubOrders = await Promise.all(
    rawSubOrders.map(async (rawSub) => {
      const sub = (rawSub && typeof rawSub === 'object' ? rawSub : {}) as Record<string, unknown>;
      const rawItems = Array.isArray(sub.items) ? sub.items : [];
      const items = await Promise.all(
        rawItems.map(async (rawItem, itemIndex) => {
          const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
          const itemId =
            typeof item.itemId === 'string' && item.itemId
              ? item.itemId
              : `item-${Date.now().toString(36)}-${itemIndex}`;
          // Pre-commit audit follow-up: live UAT found a real product whose
          // catalog id is numeric (e.g. 24, not "24") — a strict `typeof ===
          // 'string'` check silently discarded it as empty, turning a genuine
          // checkout into a hard 400 "missing productId/serviceId" regression.
          // Accept any non-empty string/number id and normalize to a string.
          const toIdString = (value: unknown): string =>
            typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
          const productId = toIdString(item.productId);
          const serviceId = toIdString(item.serviceId);
          const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

          let realPrice = 0;
          let realTitle = typeof item.productTitle === 'string' ? item.productTitle : '';
          // Warranty terms are snapshotted from the product AT THE MOMENT OF
          // PURCHASE (server-side, never client-supplied) — a seller later
          // editing the product's warranty config must never change what a
          // past buyer is entitled to. warrantyStartsAt defaults to the order
          // date here as the "purchase date" fallback; it is overwritten with
          // the real delivery date by POST .../mark-delivered once shipped.
          let warrantySnapshot: {
            warrantyMonthsAtPurchase?: number;
            warrantyTypeAtPurchase?: string;
            warrantyProviderAtPurchase?: string;
            warrantyTermsSnapshot?: string;
            warrantyStartsAt?: string;
            warrantyExpiresAt?: string;
          } = {};
          // Server-authoritative snapshot of the buyer's selected variant
          // combination. Never trusted from the client — resolved below against
          // the product's own productVariants and used to overwrite whatever the
          // client sent for variantId / SKU / options / label.
          let resolvedVariant:
            | {
                variantId: string;
                variantSku?: string;
                selectedOptions?: Record<string, string>;
                variantLabel?: string;
              }
            | undefined;
          // Guide LIVE-offer context (client-supplied, never trusted for price).
          const rawGuideOfferRef =
            item.guideOfferRef && typeof item.guideOfferRef === 'object'
              ? (item.guideOfferRef as Record<string, unknown>)
              : null;
          const guideOfferGuideId = rawGuideOfferRef ? toIdString(rawGuideOfferRef.guideId) : '';
          const guideOfferProductId = rawGuideOfferRef
            ? toIdString(rawGuideOfferRef.productId) || productId
            : '';
          const expectedUnitPrice =
            typeof item.expectedUnitPrice === 'number' && Number.isFinite(item.expectedUnitPrice)
              ? item.expectedUnitPrice
              : undefined;
          let guideOfferSnapshot:
            | { guideId: string; offerId: string; basePrice: number }
            | undefined;
          if (productId) {
            const product = await catalogStore.getProduct(productId);
            if (!product) throw new Error(`Product ${productId} no longer exists`);
            if (!isProductLifecyclePubliclyListable(product.status)) {
              throw new Error(
                `"${product.title}" is no longer available for purchase (status: ${normalizeProductLifecycle(product.status)}).`,
              );
            }
            realPrice = product.price;
            realTitle = product.title;

            // ── Variant-aware pricing + authoritative snapshot ───────────────
            // Retail checkout (Choosify-Web) can send a selected variant. Trust
            // NOTHING from the client for money: resolve the id against the
            // product's own productVariants, require it to be active, and take
            // the price / SKU / option map from the stored variant. A forged,
            // unknown or inactive variant id is a hard error — never a silent
            // fall-through to the base price.
            const rawVariantId = typeof item.variantId === 'string' ? item.variantId.trim() : '';
            if (rawVariantId) {
              const variantDetail = await catalogStore.getProductDetail(productId).catch(() => null);
              const allVariants = variantDetail?.productVariants ?? [];
              // Only enforce when the product actually defines variants. A stray
              // variantId on a product with none configured is ignored (older
              // clients occasionally send noise), never a hard failure.
              if (allVariants.length > 0) {
                const variant = allVariants.find((v) => v.id === rawVariantId);
                if (!variant) {
                  throw new Error(
                    `The selected option for "${product.title}" is no longer available. Please re-pick your choice and try again.`,
                  );
                }
                const variantActive = variant.status
                  ? variant.status === 'active'
                  : variant.enabled !== false;
                if (!variantActive) {
                  throw new Error(
                    `The selected option for "${product.title}" is no longer available. Please choose another combination.`,
                  );
                }
                if (typeof variant.price === 'number' && Number.isFinite(variant.price) && variant.price > 0) {
                  realPrice = variant.price;
                }
                const opts =
                  variant.options && typeof variant.options === 'object'
                    ? (variant.options as Record<string, string>)
                    : undefined;
                resolvedVariant = {
                  variantId: variant.id,
                  variantSku: variant.sku || undefined,
                  selectedOptions: opts,
                  variantLabel: opts
                    ? Object.entries(opts)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : undefined,
                };
              }
            }

            // ── Guide LIVE offer: server-authoritative promotional price ──────
            // The offer only ever LOWERS realPrice, only for the exact product it
            // references, only inside its server-time window, only for a
            // brand-authored guide whose brand owns the product. It never touches
            // add-ons or variant deltas — it replaces the product unit price only.
            if (guideOfferGuideId && guideOfferProductId === productId) {
              const lineHasVariant = Boolean(
                (typeof item.variantId === 'string' && item.variantId) ||
                  (typeof item.variantSku === 'string' && item.variantSku),
              );
              const resolved = await resolveActiveGuideOffer(
                guideOfferGuideId,
                productId,
                product.price,
                Date.now(),
                lineHasVariant,
              );
              if (resolved) {
                realPrice = resolved.unitPrice;
                guideOfferSnapshot = {
                  guideId: resolved.guideId,
                  offerId: resolved.offerId,
                  basePrice: resolved.basePrice,
                };
              }
              // If the buyer added the item expecting a promotional price, the
              // authoritative price MUST match it — otherwise the offer changed
              // or expired while the item sat in the cart. Reject explicitly so
              // the storefront can show the updated total and require re-confirm;
              // never silently charge a different amount.
              if (typeof expectedUnitPrice === 'number' && Math.abs(expectedUnitPrice - realPrice) > 0.001) {
                const wasPresent = await guideOfferWasPresent(guideOfferGuideId, productId);
                throw new OrderPricingError(
                  wasPresent
                    ? `The LIVE offer for "${product.title}" has changed or expired. The current price is ৳${realPrice.toLocaleString()}. Please review the updated total before continuing.`
                    : `The price for "${product.title}" has changed. The current price is ৳${realPrice.toLocaleString()}. Please review the updated total before continuing.`,
                  409,
                  {
                    code: 'GUIDE_OFFER_PRICE_CHANGED',
                    details: {
                      productId,
                      expectedUnitPrice,
                      actualUnitPrice: realPrice,
                      guideOfferActive: Boolean(resolved),
                      offerWasPresent: wasPresent,
                    },
                  },
                );
              }
            }
            if (product.warrantyMonths && product.warrantyMonths > 0) {
              const startsAt = new Date().toISOString();
              const expiresAt = new Date(
                Date.now() + product.warrantyMonths * 30 * 24 * 60 * 60 * 1000,
              ).toISOString();
              warrantySnapshot = {
                warrantyMonthsAtPurchase: product.warrantyMonths,
                warrantyTypeAtPurchase: product.warrantyType,
                warrantyProviderAtPurchase: product.warrantyProvider,
                warrantyTermsSnapshot: product.warrantyTerms,
                warrantyStartsAt: startsAt,
                warrantyExpiresAt: expiresAt,
              };
            }
          } else if (serviceId) {
            const service = await getService(serviceId);
            if (!service) throw new Error(`Service ${serviceId} no longer exists`);
            if (!isProductLifecyclePubliclyListable(service.status)) {
              throw new Error(
                `"${service.title}" is no longer available for booking (status: ${normalizeProductLifecycle(service.status)}).`,
              );
            }
            realPrice = service.price;
            realTitle = service.title;
          } else {
            throw new Error('Order item is missing productId/serviceId');
          }

          subtotal += realPrice * quantity;
          // Drop the transient client assertion; keep an authoritative offer snapshot.
          const { expectedUnitPrice: _dropExpected, ...cleanItem } = item as Record<string, unknown>;
          return {
            ...cleanItem,
            itemId,
            ...warrantySnapshot,
            price: realPrice,
            productTitle: realTitle,
            quantity,
            // Server-resolved variant identity wins over anything the client sent.
            ...(resolvedVariant ?? {}),
            ...(guideOfferSnapshot ? { guideOffer: guideOfferSnapshot } : {}),
          };
        }),
      );

      // Pre-commit audit follow-up: deliveryFee was still client-supplied (only
      // floored at >=0) — the one monetary field the original P0 fix missed.
      // Storefront charges a flat per-seller parcel fee for any sub-order that
      // contains a physical product; pure service/booking sub-orders (and the
      // booking-payment flow generally) are deliveryFee:0. Recompute the same
      // way server-side instead of trusting the client's number.
      const hasProduct = (items as Array<{ productId?: unknown }>).some(
        (it) => (typeof it.productId === 'string' || typeof it.productId === 'number') && String(it.productId).trim(),
      );
      const deliveryFee = hasProduct ? FLAT_DELIVERY_FEE_PER_SELLER : 0;
      deliveryTotal += deliveryFee;
      return { ...sub, items, deliveryFee };
    }),
  );

  // Coupon existence/validity is real, but the discount computation engine
  // doesn't exist server-side yet (client just sends a number) — rather than
  // fully trust it (the same vulnerability class as price), clamp it to a
  // bounded fraction of the real subtotal so a forged discount can never
  // zero out an order the way the forged price could.
  let promoDiscount = 0;
  if (body.promoCode && body.promoDiscount) {
    const coupon = operationsStore.getCouponByCode(String(body.promoCode));
    if (coupon && coupon.active) {
      const now = new Date();
      const validFrom = coupon.validFrom ? new Date(coupon.validFrom) : null;
      const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;
      const withinWindow = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
      if (withinWindow) {
        const claimed = Math.max(0, Number(body.promoDiscount) || 0);
        const safeCap = subtotal * 0.9;
        promoDiscount = Math.min(claimed, safeCap, coupon.rules?.maxDiscountAmount ?? Infinity);
      }
    }
  }

  const overallTotal = Math.max(0, subtotal + deliveryTotal - promoDiscount);
  return { subOrders: recomputedSubOrders, subtotal, deliveryTotal, overallTotal, promoDiscount };
}

const CLAIM_TOKEN_TTL_MS = Number(process.env.ORDER_CLAIM_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000);

function generateOrderClaimToken(): string {
  return randomBytes(32).toString('hex');
}

function buildClaimConfirmUrl(token: string): string {
  const base = (
    process.env.CHOOSIFY_WEB_URL ||
    process.env.VITE_CHOOSIFY_WEB_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
  return `${base}/orders/confirm/${encodeURIComponent(token)}`;
}

function isClaimTokenExpired(order: OpsStorefrontOrder): boolean {
  if (!order.claimTokenExpiresAt) return true;
  const expires = Date.parse(order.claimTokenExpiresAt);
  if (Number.isNaN(expires)) return true;
  return Date.now() > expires;
}

function userIsReturnSeller(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsReturnRequest,
): boolean {
  if (!req.userId || row.sellerId !== req.userId) return false;
  const role = req.userRole;
  return Boolean(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)));
}

/** Approve / reject / refund / status / label / dispute — seller on the return or staff. */
function userCanManageReturnAsSellerOrAdmin(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsReturnRequest,
): boolean {
  if (userIsStaff(req)) return true;
  return userIsReturnSeller(req, row);
}

/**
 * Actual money movement (the /refund endpoint, and once a case is
 * disputed) is staff-only — a seller can approve/reject a case (the
 * decision layer) but never triggers the real escrow payout themselves.
 * Once a case reaches 'dispute', only staff decide the outcome at all
 * (refunded or rejected) — this is the deliberate "seller refuses, admin
 * still has final say" override: the seller's earlier decision (or lack
 * of one) does not block staff from resolving the case either way.
 */
function userCanProcessRefund(req: { userRole?: (typeof ROLES)[keyof typeof ROLES] }): boolean {
  return userIsStaff(req);
}

/** Notes: Returns.tsx (admin) can add notes; MyReturnsSection has no note UI.
 * Allow seller-or-admin only — not buyers.
 */
function userCanAddReturnNote(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsReturnRequest,
): boolean {
  return userCanManageReturnAsSellerOrAdmin(req, row);
}

/** Shipment updates: staff or seller on the order — never the buyer. */
function userCanUpdateShipment(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  shipmentOrderId: string,
): boolean {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (!(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)))) {
    return false;
  }
  if (!req.userId) return false;
  const order = operationsStore.getOrder(shipmentOrderId);
  if (!order) return false;
  const subs = (order.subOrders || []) as Array<{ sellerId?: string }>;
  return subs.some((sub) => sub.sellerId === req.userId);
}

/**
 * Sprint 11: a seller/creator may reply into a buyer's platform conversation
 * only if a real transactional relationship already exists between them --
 * at least one order, booking request, or manual order offer connecting this
 * sellerId to this buyerId. Prevents cold-messaging a buyer who has never
 * interacted with this seller. Staff may always reply (existing behavior).
 */
async function userCanReplyToBuyerConversation(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  buyerId: string,
): Promise<boolean> {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (!(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER) || hasRole(role, ROLES.CREATOR)))) {
    return false;
  }
  if (!req.userId || !buyerId) return false;
  if (operationsStore.listOrders({ buyerId, sellerId: req.userId }).length > 0) return true;
  const offers = await listManualOrderOffers({ buyerId, sellerId: req.userId });
  if (offers.length > 0) return true;
  const { listBookingRequests } = await import('./booking/bookingStore');
  const bookings = await listBookingRequests({ buyerId, sellerId: req.userId });
  return bookings.length > 0;
}

/**
 * Sprint 12 pre-beta audit: GET /operations/shipments and /operations/shipments/:id
 * had NO authentication at all — any unauthenticated caller could dump every
 * shipment's recipientName/recipientPhone/deliveryAddress/codAmount/buyerId
 * across the whole platform. A buyer may view their own shipment; a seller may
 * view a shipment for an order containing one of their own sub-orders; staff
 * may view any.
 */
function userCanViewShipment(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  shipment: { orderId: string; buyerId: string },
): boolean {
  if (userIsStaff(req)) return true;
  if (!req.userId) return false;
  if (shipment.buyerId === req.userId) return true;
  return userCanUpdateShipment(req, shipment.orderId);
}

/**
 * Buyer may review a product only after a delivered/completed purchase of that product.
 * Mirrors storefront ProductDetailPage `reviewableOrders` (delivered sub-order item).
 */
function userCanModerateOrEditReview(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  review: OpsReview,
): boolean {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (role && hasRole(role, ROLES.MODERATOR)) return true;
  return Boolean(req.userId && review.userId === req.userId);
}

function userCanManageVerifications(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  const role = req.userRole;
  if (!role) return false;
  return (
    hasRole(role, ROLES.ADMIN) ||
    hasRole(role, ROLES.SUPER_ADMIN) ||
    hasRole(role, ROLES.MODERATOR)
  );
}

function userCanViewVerification(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsVerificationRequest,
): boolean {
  if (userCanManageVerifications(req)) return true;
  return Boolean(req.userId && row.submitted_by === req.userId);
}

/**
 * OWNER-VERIFICATION decision side effect. Ownership is never changed here:
 * an owner verification can only (un)verify the profile's CURRENT owner.
 * Ownership claims go through claims/ownershipClaims.approveOwnershipClaim.
 */
async function applyEntityVerificationSideEffect(
  row: OpsVerificationRequest,
  decision: 'approved' | 'rejected',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const type = row.entityType === 'creator' ? 'creator' : 'brand';
  try {
    return await withRecordLocks([`claim:${type}:${row.entityId}`, recordKey(type, row.entityId)], async () => {
      const existing = await loadEntity(type, row.entityId);
      if (!existing) return { ok: false as const, error: `${type === 'brand' ? 'Brand' : 'Creator'} ${row.entityId} not found in catalog` };
      if (ownerOf(type, existing) !== row.submitted_by) {
        return { ok: false as const, error: 'This request was not filed by the profile\'s current owner, so it cannot change verification. Ownership claims use the claim workflow.' };
      }
      const now = new Date().toISOString();
      if (type === 'brand') {
        const b = existing as CatalogBrand;
        const normalized = normalizeBrandInput(
          decision === 'approved'
            ? { ...b, claimStatus: 'verified', verifiedStatus: true, ownershipVerifiedAt: b.ownershipVerifiedAt || now }
            : { ...b, verifiedStatus: false },
          b,
        );
        await catalogStore.upsertBrand({ ...normalized, slug: b.slug });
      } else {
        const c = existing as import('../lib/vercel-catalog/catalogEditorialTypes').CatalogCreator;
        const normalized = normalizeCreatorInput(
          decision === 'approved'
            ? { ...c, claimStatus: 'verified', verifiedStatus: true, ownershipVerifiedAt: c.ownershipVerifiedAt || now }
            : { ...c, verifiedStatus: false },
          c,
        );
        await catalogStore.upsertCreator({ ...normalized, slug: c.slug });
      }
      return { ok: true as const };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update catalog entity',
    };
  }
}

/** List returns: buyer may only query own buyerId; seller/admin may query by sellerId or list broadly if staff. */
function userCanListReturns(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  filter: { buyerId?: string; sellerId?: string },
): boolean {
  if (userIsStaff(req)) return true;
  const userId = req.userId;
  if (!userId) return false;

  if (filter.buyerId) {
    if (filter.buyerId !== userId) return false;
    // Buyer listing own returns — ok even without seller role
    return true;
  }

  if (filter.sellerId) {
    const role = req.userRole;
    if (!(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)))) {
      return false;
    }
    return filter.sellerId === userId;
  }

  // Unfiltered list — sellers see only their own (enforced by forcing sellerId); staff already returned
  return false;
}

/** List orders: same scoping pattern as returns (buyer own / seller own / staff all). */
function userCanListOrders(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  filter: { buyerId?: string; sellerId?: string },
): boolean {
  return userCanListReturns(req, filter);
}

/** Internal reviews list: own reviews via userId, or staff/moderator for everything. */
function userCanListReviews(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  filter: { userId?: string; sellerId?: string },
): boolean {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (role && hasRole(role, ROLES.MODERATOR)) return true;
  const userId = req.userId;
  if (!userId) return false;
  if (filter.userId) return filter.userId === userId;
  if (
    filter.sellerId &&
    role &&
    (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER) || hasRole(role, ROLES.CREATOR))
  ) {
    return filter.sellerId === userId;
  }
  return false;
}

function toExpiryOrder(order: OpsStorefrontOrder | OrderLikeForExpiry): OrderLikeForExpiry {
  return {
    orderId: order.orderId,
    status: order.status,
    cancelledAt: 'cancelledAt' in order ? order.cancelledAt : undefined,
    subOrders: (order.subOrders as OrderLikeForExpiry['subOrders']) || [],
  };
}

function assertPostOrderReplyAllowed(
  orderId: string | undefined,
  skipExpiry: boolean,
  orderSnapshot?: OrderLikeForExpiry | null,
) {
  if (skipExpiry) return null;

  const stored = orderId?.trim() ? operationsStore.getOrder(orderId.trim()) : null;
  // Prefer authoritative store record; fall back to client snapshot only to *close*
  // (never to keep a conversation open when the store says closed — store wins when present).
  const orderForEval = stored
    ? toExpiryOrder(stored)
    : orderSnapshot?.orderId || orderSnapshot?.subOrders?.length
      ? toExpiryOrder(orderSnapshot)
      : null;

  if (!orderForEval) return null; // no order context → cannot enforce yet

  const expiry = evaluatePostOrderConversationExpiry(orderForEval);
  if (expiry.status === 'closed') {
    return {
      error: 'CONVERSATION_EXPIRED',
      message: expiry.closedLabel || 'This conversation has ended',
      expiry,
      enforcedFrom: stored ? 'store' : 'snapshot',
    };
  }
  return null;
}

const normalizeReviewStatus = (status: string): OpsReview['status'] => {
  const map: Record<string, OpsReview['status']> = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    flagged: 'flagged',
    published: 'published',
    deleted: 'deleted',
    hidden: 'hidden',
    Flagged: 'flagged',
    Published: 'published',
    Deleted: 'deleted',
    Hidden: 'hidden',
  };
  return map[status] ?? 'pending';
};

operationsRouter.get('/operations/orders', ...requireAuth, (req, res) => {
  let buyerId = typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined;
  let sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  if (!userCanListOrders(req, { buyerId, sellerId })) {
    if (
      !buyerId &&
      !sellerId &&
      req.userId &&
      req.userRole &&
      (hasRole(req.userRole, ROLES.SELLER) || hasRole(req.userRole, ROLES.VERIFIED_SELLER))
    ) {
      sellerId = req.userId;
    } else if (!buyerId && !sellerId && req.userId && !userIsStaff(req)) {
      buyerId = req.userId;
    }
    if (!userCanListOrders(req, { buyerId, sellerId })) {
      res.status(403).json({ error: 'Not authorized to list these orders' });
      return;
    }
  }

  res.json({ data: operationsStore.listOrders({ buyerId, sellerId, status }) });
});

operationsRouter.get('/operations/orders/:id', ...requireAuth, (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (!userCanMutateOrder(req, order)) {
    res.status(403).json({ error: 'Not authorized to view this order' });
    return;
  }
  res.json({ data: order });
});

/**
 * Ensures the given seller sub-order has a real invoice number, minting one
 * exactly once (lazily, idempotently, concurrency-safe) the first time an
 * authorized eligible request asks for it. See server/operations/invoiceAssignment.ts.
 *
 * Authorization is scoped to THIS sub-order specifically — not "does the
 * requester own any sub-order on this order" (userCanMutateOrder is too broad
 * for a multi-seller order: it would let seller A ensure/read seller B's
 * invoice). Staff (admin/super_admin/support_agent/moderator/finance_manager)
 * may act on any sub-order; the owning seller may act on their own sub-order;
 * the order's own buyer may also ensure/read invoice numbers for any
 * sub-order on THEIR OWN order (needed for the customer invoice screen —
 * a buyer opening their invoice before any seller/staff has may otherwise
 * have no invoice number to display at all). This widens WHO may trigger the
 * existing lazy-mint, never HOW a number is generated or what it is —
 * ensureSubOrderInvoiceNumber() and its numbering scheme are unchanged.
 */
operationsRouter.post('/operations/orders/:id/subs/:sellerId/invoice', ...requireAuth, async (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const targetSellerId = req.params.sellerId;
  const sub = (order.subOrders || []).find((s: { sellerId?: string }) => s.sellerId === targetSellerId);
  if (!sub) {
    res.status(404).json({ error: "Seller's slice of this order was not found" });
    return;
  }
  const role = req.userRole;
  const isStaff = Boolean(
    role &&
      (hasRole(role, ROLES.SUPER_ADMIN) ||
        hasRole(role, ROLES.ADMIN) ||
        hasRole(role, ROLES.SUPPORT_AGENT) ||
        hasRole(role, ROLES.MODERATOR) ||
        hasRole(role, ROLES.FINANCE_MANAGER)),
  );
  const isOwningSeller = Boolean(req.userId && req.userId === targetSellerId);
  const isOwningBuyer = Boolean(req.userId && req.userId === order.buyerId);
  if (!isStaff && !isOwningSeller && !isOwningBuyer) {
    res.status(403).json({ error: 'Not authorized to view this invoice' });
    return;
  }

  try {
    const result = await ensureSubOrderInvoiceNumber(req.params.id, targetSellerId);
    if (!result.eligible) {
      res.json({ data: { invoiceId: null, eligible: false, reason: result.reason } });
      return;
    }
    res.json({ data: { invoiceId: result.invoiceId, eligible: true } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to prepare invoice' });
  }
});

operationsRouter.post('/operations/orders', ...requireAuth, async (req, res) => {
  // QA3-001: lines successfully reserved this request, for rollback if a
  // later step (createOrder, coupon usage, shipment) throws.
  let reservedInventoryLines: Array<{ productId: string; variantId?: string; quantity: number }> = [];
  try {
    const body = req.body as Partial<OpsStorefrontOrder>;
    if (!body.orderId) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }

    // Data-integrity guard: `shipping.phone` and `shipping.address` must stay
    // semantically independent fields. Only a presence check existed here
    // before, so nothing rejected a caller (a buggy/legacy client, a stray
    // copy-paste) submitting the delivery address text (or any other
    // non-phone string) as the phone -- it was persisted verbatim and later
    // rendered as-is on the invoice. Only validated when a phone is actually
    // provided; shipping itself is not required by this endpoint (manual
    // orders may have none yet).
    const bodyShippingPhone = (body.shipping as { phone?: unknown } | undefined)?.phone;
    if (typeof bodyShippingPhone === 'string' && bodyShippingPhone.trim()) {
      if (!normalizePrimaryPhone(bodyShippingPhone).ok) {
        res.status(400).json({
          error: 'Shipping phone must be a valid phone number.',
          code: 'INVALID_SHIPPING_PHONE',
        });
        return;
      }
    }

    const wantsManual = Boolean(body.isManual);
    let buyerId: string;
    if (wantsManual) {
      if (!userCanCreateManualOrder(req)) {
        res.status(403).json({ error: 'Not authorized to create manual orders' });
        return;
      }
      // Unclaimed until the customer confirms via claim link — never trust client buyerId.
      buyerId = 'unclaimed';
    } else {
      const bodyBuyerId = String(body.buyerId || '').trim();
      if (bodyBuyerId && bodyBuyerId !== req.userId) {
        res.status(403).json({ error: 'buyerId does not match authenticated user' });
        return;
      }
      buyerId = req.userId!;
    }

    // QA2-001: orderId is client-supplied and previously had no uniqueness
    // check here, so a duplicate submission (double-click, retry, replay)
    // silently produced a second order row indistinguishable from an
    // overwrite via getOrder(). Checked after the buyer/manual authorization
    // above so an unauthorized caller gets 403 rather than a 409 that would
    // confirm someone else's orderId exists. operationsStore.createOrder()
    // is also now idempotent by orderId as a second layer of defense.
    if (operationsStore.getOrder(body.orderId)) {
      res.status(409).json({ error: 'Order already exists' });
      return;
    }

    const status =
      body.status === 'pending_payment' ||
      body.status === 'confirmed' ||
      body.status === 'cancelled' ||
      body.status === 'completed'
        ? body.status
        : 'active';

    // claimToken is server-generated only — never accept client-supplied tokens.
    let claimToken: string | undefined;
    let claimTokenExpiresAt: string | undefined;
    if (wantsManual) {
      claimToken = generateOrderClaimToken();
      claimTokenExpiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_MS).toISOString();
    }

    // P0 fix: recompute pricing server-side for buyer-initiated orders. Manual
    // (staff-created) orders keep the client-supplied price — that's the
    // deliberate staff price-override feature, a different trust boundary.
    let pricing: { subOrders: unknown[]; subtotal: number; deliveryTotal: number; overallTotal: number; promoDiscount: number };
    if (wantsManual) {
      pricing = {
        subOrders: body.subOrders || [],
        subtotal: Number(body.subtotal || 0),
        deliveryTotal: Number(body.deliveryTotal || 0),
        overallTotal: Number(body.overallTotal || 0),
        promoDiscount: Number(body.promoDiscount || 0),
      };
    } else {
      try {
        pricing = await recomputeOrderPricingServerSide(body);
      } catch (err) {
        if (err instanceof OrderPricingError) {
          res.status(err.statusCode).json({
            error: err.message,
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ? { details: err.details } : {}),
          });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to validate order items',
        });
        return;
      }
    }

    // QA3-001: manual (staff-created) orders keep the same trust boundary as
    // pricing above -- not enforced here. Buyer orders reuse pricing's
    // already-validated subOrders (product existence already confirmed by
    // recomputeOrderPricingServerSide's own throw above), never the raw
    // client body. Aggregate quantity per product+variant across every line
    // FIRST (a product can appear twice, or split across sub-orders) so
    // availability is checked against the true total, not line-by-line.
    if (!wantsManual) {
      // Defense-in-depth: the 409 check above and this reservation step are
      // separated by the pricing-recomputation await, so re-check
      // synchronously right before reserving to narrow (not fully close --
      // see the audit report's atomicity section) the duplicate-orderId
      // race window.
      if (operationsStore.getOrder(body.orderId)) {
        res.status(409).json({ error: 'Order already exists' });
        return;
      }

      const required = new Map<string, { productId: string; variantId?: string; quantity: number }>();
      for (const sub of pricing.subOrders as Array<{ items?: Array<Record<string, unknown>> }>) {
        for (const item of sub.items || []) {
          const productId =
            typeof item.productId === 'string' || typeof item.productId === 'number'
              ? String(item.productId).trim()
              : '';
          if (!productId) continue; // service line -- never consumes physical inventory
          const variantId = typeof item.variantId === 'string' ? item.variantId : undefined;
          const key = `${productId}::${variantId || ''}`;
          const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
          const existing = required.get(key);
          required.set(key, { productId, variantId, quantity: (existing?.quantity || 0) + quantity });
        }
      }

      for (const line of required.values()) {
        const result = await reserveInventoryQuantity(line);
        if (result.ok === true) {
          reservedInventoryLines.push(line);
          continue;
        }
        const insufficientResult: { ok: false; available: number } = result;
        for (const r of reservedInventoryLines) {
          await releaseInventoryQuantity(r).catch((err) => {
            console.error('[Order] Failed to release inventory after a later line failed reservation:', err);
          });
        }
        reservedInventoryLines = [];
        res.status(409).json({
          error: `Insufficient stock for one or more items`,
          code: 'INSUFFICIENT_STOCK',
          productId: line.productId,
          requestedQuantity: line.quantity,
          availableQuantity: insufficientResult.available,
        });
        return;
      }
    }

    // Stable reference used below to detect whether createOrder() actually
    // created this row or returned a pre-existing one (its own idempotency
    // guard) -- which can happen despite the checks above if a genuinely
    // concurrent duplicate submission raced through both of them.
    const createdAtValue = body.createdAt || new Date().toISOString();

    const saved = operationsStore.createOrder({
      orderId: body.orderId,
      buyerId,
      isCOD: Boolean(body.isCOD),
      isSplit: Boolean(body.isSplit),
      overallTotal: pricing.overallTotal,
      subtotal: pricing.subtotal,
      deliveryTotal: pricing.deliveryTotal,
      subOrders: pricing.subOrders,
      inventoryReserved: reservedInventoryLines.length > 0 ? true : undefined,
      promoCode: body.promoCode,
      promoDiscount: pricing.promoDiscount,
      promoType: body.promoType,
      sourceMode: body.sourceMode,
      paymentMethod: body.paymentMethod,
      shipping: body.shipping,
      tradeLicense: body.tradeLicense,
      companyName: body.companyName,
      isQuotationRequest: body.isQuotationRequest,
      status,
      bookingRequestId: body.bookingRequestId,
      paymentDueAt: body.paymentDueAt,
      paidAt: body.paidAt,
      invoiceGeneratedAt: body.invoiceGeneratedAt,
      createdAt: createdAtValue,
      isManual: wantsManual || undefined,
      platformSource: body.platformSource,
      claimToken,
      claimTokenExpiresAt,
      codDeliveryFeePaid: body.codDeliveryFeePaid,
      codDeliveryFeePaidAt: body.codDeliveryFeePaidAt,
      codRemainingAmount: body.codRemainingAmount,
      isPartialPayment: body.isPartialPayment,
      depositPercent: body.depositPercent,
      depositAmount: body.depositAmount,
      remainingAmount: body.remainingAmount,
      paymentProvider: body.paymentProvider,
      paymentStatus: body.paymentStatus,
      paymentTranId: body.paymentTranId,
      paymentValId: body.paymentValId,
      paidAmount: body.paidAmount,
      paymentValidatedAt: body.paymentValidatedAt,
    });

    // QA3-001: createOrder() is idempotent -- if a genuinely concurrent
    // duplicate submission raced past both checks above, `saved` here is
    // the OTHER request's already-persisted row (different createdAt),
    // not a new order backed by the reservation this request just made.
    // Release it so the same order's stock isn't reserved twice.
    if (reservedInventoryLines.length > 0 && saved.createdAt !== createdAtValue) {
      for (const r of reservedInventoryLines) {
        await releaseInventoryQuantity(r).catch((err) => {
          console.error('[Order] Failed to release inventory after losing a duplicate-orderId race:', err);
        });
      }
      reservedInventoryLines = [];
    }

    if (body.promoCode && pricing.promoDiscount) {
      const coupon = operationsStore.getCouponByCode(body.promoCode);
      if (coupon) {
        operationsStore.recordCouponUsage({
          couponId: coupon.id,
          couponCode: coupon.code,
          orderId: saved.orderId,
          userId: saved.buyerId,
          discountAmount: pricing.promoDiscount,
          originalAmount: pricing.subtotal,
          finalAmount: pricing.overallTotal,
          status: 'redeemed',
        });
      }
    }

    const shipment =
      saved.status === 'pending_payment'
        ? null
        : shipmentStore.createFromOrder(saved);
    scheduleOperationsPersist();
    try {
      await ensurePlatformOrderConversation(saved);
    } catch (err) {
      console.warn('[Order] Platform conversation bridge failed:', err);
    }

    if (saved.status !== 'pending_payment') {
      const sellerIds = Array.from(
        new Set(
          ((saved.subOrders || []) as Array<{ sellerId?: string }>)
            .map((sub) => sub.sellerId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      for (const sellerId of sellerIds) {
        try {
          await notifyUser(sellerId, {
            type: COMMUNICATION_TYPES.ORDER_UPDATE,
            category: 'seller',
            eventKey: 'order.new',
            persona: 'seller',
            title: 'New order received',
            summary: `Order ${saved.orderId} placed — ৳${Number(saved.overallTotal || 0).toLocaleString()}.`,
            actionUrl: '/dashboard?tab=seller-orders',
            metadata: { orderId: saved.orderId },
          });
        } catch (err) {
          console.warn('[Order] Notify seller (new order) failed:', err);
        }
      }
    }

    let confirmOrderUrl: string | undefined;
    if (saved.claimToken && req.userId) {
      confirmOrderUrl = buildClaimConfirmUrl(saved.claimToken);
      try {
        await createNotification({
          userId: req.userId,
          type: COMMUNICATION_TYPES.ORDER_UPDATE,
          category: 'seller',
          eventKey: 'order.new',
          persona: 'seller',
          title: `Order claim link ready — ${saved.orderId}`,
          summary: `Share this link so the customer can confirm order ${saved.orderId} on Choosify.bd.`,
          actionUrl: confirmOrderUrl,
          channels: [DELIVERY_CHANNELS.IN_APP],
          metadata: {
            orderId: saved.orderId,
            claimTokenExpiresAt: saved.claimTokenExpiresAt,
          },
        }, req);
      } catch (err) {
        console.warn('[Order] Claim-link notification failed:', err);
      }
    }

    res.status(201).json({
      success: true,
      data: saved,
      shipmentId: shipment?.id,
      confirmOrderUrl,
    });
  } catch (error) {
    // QA3-001: compensate any reservation made above if anything later in
    // this same request threw (createOrder is not expected to throw, but
    // this is the same rollback discipline checkoutService.ts's
    // executeCheckout() uses).
    if (reservedInventoryLines.length > 0) {
      for (const r of reservedInventoryLines) {
        await releaseInventoryQuantity(r).catch((err) => {
          console.error('[Order] Failed to release inventory after order creation failed:', err);
        });
      }
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid order payload' });
  }
});

// Public GET — powers the customer-facing "View & Confirm Order" page preview.
// Confirm POST requires auth (buyerId from token).
operationsRouter.get('/operations/orders/claim/:token', (req, res) => {
  const order = operationsStore.getOrderByClaimToken(req.params.token);
  if (!order || isClaimTokenExpired(order)) {
    res.status(404).json({ error: 'This order link is invalid or has expired.' });
    return;
  }
  res.json({
    data: {
      orderId: order.orderId,
      overallTotal: order.overallTotal,
      subtotal: order.subtotal,
      deliveryTotal: order.deliveryTotal,
      isCOD: order.isCOD,
      paymentMethod: order.paymentMethod,
      platformSource: order.platformSource,
      subOrders: order.subOrders,
      createdAt: order.createdAt,
      claimed: Boolean(order.claimedAt),
      claimedByName: order.claimedByName,
      claimTokenExpiresAt: order.claimTokenExpiresAt,
    },
  });
});

operationsRouter.post('/operations/orders/claim/:token/confirm', ...requireAuth, (req, res) => {
  const token = req.params.token;
  const abuse = recordClaimConfirmAttempt(req.ip, token);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: 'Too many confirmation attempts. Please try again later.' });
    return;
  }

  const bodyBuyerId = String((req.body as { buyerId?: string })?.buyerId || '').trim();
  if (bodyBuyerId && bodyBuyerId !== req.userId) {
    res.status(403).json({ error: 'buyerId does not match authenticated user' });
    return;
  }
  const buyerId = req.userId!;
  const buyerName =
    String((req.body as { buyerName?: string })?.buyerName || '').trim() ||
    req.user?.displayName ||
    undefined;

  const existing = operationsStore.getOrderByClaimToken(token);
  if (!existing || isClaimTokenExpired(existing)) {
    res.status(404).json({ error: 'This order link is invalid or has expired.' });
    return;
  }
  if (existing.claimedAt && existing.buyerId !== buyerId) {
    res.status(409).json({ error: 'This order has already been confirmed by another account.' });
    return;
  }
  const saved = operationsStore.claimOrder(token, {
    buyerId,
    buyerName,
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/orders/:id', ...requireAuth, (req, res) => {
  const existing = operationsStore.getOrder(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (!userCanMutateOrder(req, existing)) {
    res.status(403).json({ error: 'Not authorized to modify this order' });
    return;
  }

  const { patch, rejected } = pickOrderPatch(req.body);
  if (rejected.length > 0) {
    res.status(400).json({
      error: 'One or more fields are not allowed on this endpoint',
      rejected,
      allowed: [...ORDER_PATCH_ALLOWED_KEYS],
    });
    return;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      error: 'No updatable fields provided',
      allowed: [...ORDER_PATCH_ALLOWED_KEYS],
    });
    return;
  }

  const saved = operationsStore.updateOrder(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/orders/:id/cancel', ...requireAuth, async (req, res) => {
  const reason = String(req.body?.reason || req.body?.cancelReason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const existing = operationsStore.getOrder(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  // Buyer-only: authenticated uid must own the order (body buyerId is not trusted).
  if (!userIsOrderBuyer(req, existing)) {
    res.status(403).json({ error: 'Only the order buyer can cancel this order' });
    return;
  }
  const bodyBuyerId = String(req.body?.buyerId || '').trim();
  if (bodyBuyerId && bodyBuyerId !== req.userId) {
    res.status(403).json({ error: 'buyerId does not match authenticated user' });
    return;
  }
  if (existing.status === 'cancelled') {
    res.status(400).json({ error: 'Order is already cancelled' });
    return;
  }
  if (existing.status === 'completed') {
    res.status(400).json({ error: 'Completed orders cannot be cancelled' });
    return;
  }

  const BLOCKED_TRACKING = new Set([
    'dispatched',
    'transit',
    'delivered',
    'picked_up',
    'in_transit',
    'cancelled',
  ]);
  const subs = (existing.subOrders || []) as Array<{
    trackingStatus?: string;
    items?: Array<Record<string, unknown>>;
  }>;
  const alreadyMoving = subs.some((sub) => {
    const tracking = String(sub.trackingStatus || 'pending').toLowerCase();
    return BLOCKED_TRACKING.has(tracking);
  });
  if (alreadyMoving) {
    res.status(400).json({
      error: 'This order has already been dispatched and cannot be cancelled.',
    });
    return;
  }

  // QA3-001: release each product line's reservation before persisting the
  // cancellation. Gated on existing.inventoryReserved (idempotent -- this
  // handler is already unreachable a second time once status is
  // 'cancelled', per the check above, but this flag is the same explicit
  // guard the Commerce engine's releaseOrderReservations() uses). Mark-
  // delivered already converts reserved->consumed per item and marks the
  // order "alreadyMoving" above, which blocks cancel entirely once any
  // item has been delivered -- so cancel can only ever reach here while
  // every product line is still purely reserved, never consumed.
  if (existing.inventoryReserved) {
    const items = subs.flatMap((sub) => sub.items || []);
    for (const item of items) {
      const productId =
        typeof item.productId === 'string' || typeof item.productId === 'number'
          ? String(item.productId).trim()
          : '';
      if (!productId) continue;
      const variantId = typeof item.variantId === 'string' ? item.variantId : undefined;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      await releaseInventoryQuantity({ productId, variantId, quantity }).catch((err) => {
        console.error('[Order] Failed to release inventory on cancel:', err);
      });
    }
  }

  const ts = new Date().toISOString();
  const saved = operationsStore.updateOrder(req.params.id, {
    status: 'cancelled',
    cancelledAt: ts,
    cancelReason: reason,
    cancelledBy: 'buyer',
    inventoryReserved: false,
  });
  if (!saved) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  scheduleOperationsPersist();

  const cancelSellerIds = Array.from(
    new Set(
      ((saved.subOrders || []) as Array<{ sellerId?: string }>)
        .map((sub) => sub.sellerId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  for (const sellerId of cancelSellerIds) {
    try {
      await notifyUser(sellerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'seller',
        eventKey: 'order.cancelled',
        persona: 'seller',
        title: 'Order cancelled',
        summary: `Order ${saved.orderId} was cancelled by the buyer: ${reason}`,
        actionUrl: '/dashboard?tab=seller-orders',
        metadata: { orderId: saved.orderId },
      });
    } catch (err) {
      console.warn('[Order] Notify seller (cancelled) failed:', err);
    }
  }

  res.json({ success: true, data: saved });
});

/**
 * Marks a single order item delivered — seller (owning the item's sub-order)
 * or staff only. This is the authoritative warranty-start trigger: prefers
 * deliveredAt, recomputing warrantyStartsAt/warrantyExpiresAt from it and
 * overwriting the order-creation-time fallback.
 *
 * Sprint 7 (state-consistency fix): shipment.status is real-courier
 * operational state, driven by server/logisticsRouter.ts's webhook handler
 * -- but no real courier is connected in production (confirmed baseline),
 * so that path never fires and shipment.status was permanently frozen at
 * pending_pickup for every order's entire lifetime. Since mark-delivered is
 * the only signal that ever reflects real-world delivery today, once every
 * item across every sub-order in this order has been individually
 * delivered, the order's single shipment (one per order, not per
 * sub-order/seller) is synced to 'delivered' too, via the existing
 * validated shipmentStore.updateShipment() helper -- never raw snapshot
 * mutation. This does not reopen QA3-003: the PATCH endpoint's field
 * allowlist is untouched and still excludes status for client requests;
 * this is a server-side transition triggered by mark-delivered's own
 * existing seller/staff authorization, not a new client-facing capability.
 * Wrapped so a shipment-sync failure never blocks the order/inventory
 * mutation above it, which remains authoritative either way -- there is no
 * cross-store transaction here, only ordering: inventory and order state
 * are committed first and are correct regardless of what happens next.
 */
operationsRouter.post('/operations/orders/:id/items/:itemId/mark-delivered', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getOrder(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const subs = (existing.subOrders || []) as Array<{
    sellerId?: string;
    trackingStatus?: string;
    items?: Array<Record<string, unknown>>;
  }>;
  const located = findOrderItem(existing, req.params.itemId);
  if (!located) {
    res.status(404).json({ error: 'Order item not found' });
    return;
  }

  // Authorization: staff, the sub-order's own sellerId (when trustworthy), or
  // — since sub.sellerId isn't always populated by every order-creation path —
  // the REAL current owner of the product, resolved fresh from the catalog.
  let authorized = userIsStaff(req);
  if (!authorized && req.userId && located.sub.sellerId === req.userId) authorized = true;
  if (!authorized && req.userId) {
    const productId = String(located.item.productId || '').trim();
    if (productId) {
      const product = await catalogStore.getProduct(productId);
      if (product?.sellerId === req.userId) authorized = true;
    }
  }
  if (!authorized) {
    res.status(403).json({ error: 'Not authorized to update this order item' });
    return;
  }

  // Canonical delivery settlement (Sprint 14). One convergence point shared with
  // the lifecycle "Mark delivered" CTA and the courier webhook: sets this item's
  // deliveredAt (+ warranty window), consumes its reservation ONLY for
  // Operations-only orders (a Commerce checkout order already consumed at
  // Packed — no double-decrement), marks the sub-order delivered when all its
  // items are, and — only once EVERY applicable item is delivered — flips the
  // OpsShipment to `delivered`, advances the linked Commerce order
  // shipped → delivered, and posts the single buyer "delivered" event.
  // Partial delivery never settles the whole order. Idempotent.
  const { settleOrderItemDelivered } = await import('./operations/deliverySettlement');
  const settlement = await settleOrderItemDelivered(
    req.params.id,
    req.params.itemId,
    userIsStaff(req) ? 'admin' : 'per_item_manual',
    { actorId: req.userId },
  );
  if (!settlement.ok) {
    res
      .status(settlement.reason === 'item_not_found' ? 404 : 409)
      .json({ error: settlement.reason === 'item_not_found' ? 'Order item not found' : 'Delivery could not be settled' });
    return;
  }

  const saved = operationsStore.getOrder(req.params.id);
  res.json({ success: true, data: saved });
});

/**
 * Order internal notes (Sprint 14) — staff-only operational log on one order.
 * STRICT boundary: readable/writable ONLY by platform staff
 * (super_admin / admin / support_agent / moderator / finance_manager). A seller
 * — even one who owns a sub-order on this order — is 403'd. Notes are never
 * exposed to the buyer and are never written to any System-B / support
 * conversation. Append-only: no edit, no delete route. Stored on the order in
 * the operations JSON snapshot (additive `internalNotes[]`).
 */
operationsRouter.get('/operations/orders/:id/notes', ...requireAuth, (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Internal order notes are staff-only' });
    return;
  }
  res.json({ data: (order.internalNotes || []) as OpsOrderInternalNote[] });
});

operationsRouter.post('/operations/orders/:id/notes', ...requireAuth, (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Internal order notes are staff-only' });
    return;
  }
  const body = String((req.body as { body?: unknown })?.body || '').trim();
  if (!body) {
    res.status(400).json({ error: 'body is required' });
    return;
  }
  if (body.length > 4000) {
    res.status(400).json({ error: 'Note is too long (max 4000 characters)' });
    return;
  }
  const note: OpsOrderInternalNote = {
    id: `note_${randomBytes(8).toString('hex')}`,
    orderId: order.orderId,
    authorId: req.userId || 'unknown',
    authorName: String((req.body as { authorName?: unknown })?.authorName || '').trim() || 'Staff',
    authorRole: String(req.userRole || 'staff'),
    body,
    createdAt: new Date().toISOString(),
  };
  const next = [...((order.internalNotes || []) as OpsOrderInternalNote[]), note];
  const saved = operationsStore.updateOrder(order.id, { internalNotes: next });
  scheduleOperationsPersist();
  res.status(201).json({ data: (saved?.internalNotes || next) as OpsOrderInternalNote[], note });
});

// ─── Manual order offers (Sprint 10) ───────────────────────────────────────────
/**
 * Canonical "seller creates an order from a chat conversation" journey.
 * Deliberately NOT the Commerce-engine createManualOrder path (Sprint 9
 * found that writes orders the real buyer-facing app never reads) and
 * deliberately NOT the isManual/claim-token branch of POST /operations/orders
 * (Sprint 10 investigation found it skips inventory reservation entirely and
 * has no seller-product-ownership check — sound for the "buyer has no
 * Choosify account yet" case it was built for, wrong trust boundary for a
 * seller creating a normal in-conversation offer for an existing buyer).
 * This mints a single ManualOrderOffer (accept/reject only, no counter --
 * product decision, Sprint 10), and acceptance runs through the exact same
 * server-authoritative inventory-reservation + shipment-creation path a
 * normal checkout uses, via operationsStore.createOrder with a
 * deterministic orderId (idempotent by design -- see createOrder) so a
 * concurrent duplicate accept can never create a second order.
 */
function makeManualOfferInvoiceId(): string {
  return `INV-${Math.floor(100000 + Math.random() * 900000)}`;
}

operationsRouter.post('/operations/manual-offers', ...requireAuth, async (req, res) => {
  try {
    if (!userCanCreateManualOrder(req)) {
      res.status(403).json({ error: 'Not authorized to create manual order offers' });
      return;
    }
    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const staff = userIsStaff(req);

    // Two customer modes:
    //  (a) native  — an existing Choosify Buyer (body.buyerId). Offer card
    //      appears in their System-B conversation; they Accept/Reject.
    //  (b) external — a Meta/offline customer with no account yet. Requires
    //      name + email + phone; server generates a secure claim link.
    const nativeBuyerId = String(body.buyerId || '').trim();
    const isExternal = !nativeBuyerId;

    const extName = String(body.customerName || body.buyerName || '').trim();
    const extEmailRaw = String(body.email || '').trim();
    const extPhoneRaw = String(body.phone || '').trim();
    let intendedCustomer: import('../shared/manualOrder/manualOrderTypes').ManualOrderIntendedCustomer | undefined;
    if (isExternal) {
      if (!extName || !extEmailRaw || !extPhoneRaw) {
        res.status(400).json({
          error: 'An external Manual Order requires customer name, email and phone.',
          code: 'EXTERNAL_CUSTOMER_FIELDS_REQUIRED',
        });
        return;
      }
      if (!isPlausibleEmail(extEmailRaw)) {
        res.status(400).json({ error: 'That email address looks invalid.', code: 'INVALID_EMAIL' });
        return;
      }
      if (!isPlausibleBdPhone(extPhoneRaw)) {
        res.status(400).json({ error: 'That phone number is not a valid Bangladesh mobile number.', code: 'INVALID_PHONE' });
        return;
      }
      const normalizedEmail = normalizeEmail(extEmailRaw);
      const normalizedPhone = normalizeBdPhone(extPhoneRaw);
      // Advisory only: does a Choosify account already use this email?
      const existingAccount = await findAccountByNormalizedEmail(normalizedEmail).catch(() => null);
      intendedCustomer = {
        name: extName,
        normalizedEmail,
        normalizedPhone,
        matchedConsumerId:
          existingAccount && existingAccount.role === 'user' ? existingAccount.uid : undefined,
        addressHint:
          typeof body.addressHint === 'string' && body.addressHint.trim()
            ? body.addressHint.trim()
            : undefined,
      };
    }
    const buyerId = nativeBuyerId;
    // Non-staff sellers may only offer as themselves — never another seller's identity.
    const sellerId = staff && body.sellerId ? String(body.sellerId).trim() : req.userId;

    const validatedItems: ManualOrderOfferItem[] = [];
    let subtotal = 0;
    for (const raw of rawItems as Array<Record<string, unknown>>) {
      const productId = String(raw.productId || '').trim();
      if (!productId) {
        res.status(400).json({ error: 'Each item requires a productId' });
        return;
      }
      const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      const price = Number(raw.price);
      if (!Number.isFinite(price) || price <= 0) {
        res.status(400).json({ error: `Invalid price for product ${productId}` });
        return;
      }

      let productType: 'physical' | 'service' = 'physical';
      let productTitle = '';
      let image: string | undefined;
      let ownerId: string | undefined;
      const product = await catalogStore.getProduct(productId);
      if (product) {
        if (!isProductLifecyclePubliclyListable(product.status)) {
          res.status(400).json({
            error: `"${product.title}" is no longer available (status: ${normalizeProductLifecycle(product.status)}) and cannot be offered.`,
          });
          return;
        }
        productTitle = product.title;
        image = product.image;
        ownerId = product.sellerId;
      } else {
        const service = await getService(productId);
        if (!service) {
          res.status(404).json({ error: `Product or service ${productId} not found` });
          return;
        }
        if (!isProductLifecyclePubliclyListable(service.status)) {
          res.status(400).json({
            error: `"${service.title}" is no longer available (status: ${normalizeProductLifecycle(service.status)}) and cannot be offered.`,
          });
          return;
        }
        productType = 'service';
        productTitle = service.title;
        image = service.image;
        ownerId = service.sellerId;
      }
      if (!staff && ownerId !== sellerId) {
        res.status(403).json({ error: `Not authorized to offer ${productId} — you do not own it` });
        return;
      }

      validatedItems.push({
        productId,
        productTitle,
        variantId: typeof raw.variantId === 'string' ? raw.variantId : undefined,
        quantity,
        price,
        productType,
        image,
      });
      subtotal += price * quantity;
    }

    const deliveryTotal = Math.max(0, Number(body.deliveryTotal) || 0);
    const overallTotal = subtotal + deliveryTotal;
    const ts = new Date().toISOString();

    const provSourceRaw = String(body.provenanceSource || body.source || '').trim();
    const PROV_SOURCES = new Set([
      'manual',
      'external_whatsapp',
      'external_facebook',
      'external_instagram',
      'external_offline',
    ]);
    const provenanceSource = PROV_SOURCES.has(provSourceRaw)
      ? (provSourceRaw as import('../shared/manualOrder/manualOrderTypes').ManualOrderProvenanceSource)
      : isExternal
        ? 'external_offline'
        : 'manual';
    const metaConversationId =
      typeof body.conversationId === 'string' && body.conversationId.trim()
        ? body.conversationId.trim()
        : isExternal
          ? `meta:${sellerId}:${Date.now()}`
          : `conv_platform_${buyerId}`;

    let rawClaimToken: string | undefined;
    let claimTokenHash: string | undefined;
    let claimTokenExpiresAt: string | undefined;
    if (isExternal) {
      rawClaimToken = generateClaimToken();
      claimTokenHash = hashClaimToken(rawClaimToken);
      claimTokenExpiresAt = claimTokenExpiryIso();
    }

    const offer: ManualOrderOffer = {
      id: `MOF-${Date.now()}`,
      kind: 'manual_order_offer',
      conversationId: metaConversationId,
      sellerId,
      sellerName: typeof body.sellerName === 'string' ? body.sellerName : req.user?.displayName,
      buyerId,
      buyerName: isExternal ? intendedCustomer?.name : (typeof body.buyerName === 'string' ? body.buyerName : undefined),
      items: validatedItems,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      subtotal,
      deliveryTotal,
      overallTotal,
      currency: 'BDT',
      status: isExternal ? 'awaiting_buyer_claim' : 'pending',
      createdAt: ts,
      updatedAt: ts,
      ...(isExternal
        ? { intendedCustomer, claimTokenHash, claimTokenExpiresAt }
        : {}),
      provenance: { source: provenanceSource, conversationId: metaConversationId },
    };
    await saveManualOrderOffer(offer);

    const itemSummary = validatedItems.map((it) => `${it.productTitle} x${it.quantity}`).join(', ');

    if (!isExternal) {
      // Native flow — post the Offer Card into the Buyer's System-B thread + notify.
      try {
        await submitPlatformMessage({
          buyerId,
          userName: offer.sellerName || 'Seller',
          body: `New order offer: ${itemSummary} — ৳${overallTotal.toLocaleString()}`,
          orderOffer: toManualOrderOfferCard(offer) as unknown as Record<string, unknown>,
        });
      } catch (err) {
        console.warn('[ManualOrderOffer] Failed to post offer message:', err);
      }
      try {
        await notifyUser(buyerId, {
          type: COMMUNICATION_TYPES.SELLER_UPDATE,
          category: 'buyer',
          eventKey: 'order.offer',
          persona: 'consumer',
          title: 'New order offer',
          summary: `${offer.sellerName || 'A seller'} sent you an offer: ${itemSummary} — ৳${overallTotal.toLocaleString()}.`,
          actionUrl: `/messages/conv_platform_${buyerId}`,
          metadata: { offerId: offer.id },
        });
      } catch (err) {
        console.warn('[ManualOrderOffer] Notify buyer (new offer) failed:', err);
      }
      res.status(201).json({ success: true, data: toManualOrderOfferCard(offer) });
      return;
    }

    // External flow — return the one-time raw claim token + URL. This is the
    // ONLY place the raw token is ever emitted; it is not stored in plaintext.
    const webBase = (
      process.env.CHOOSIFY_WEB_URL ||
      process.env.VITE_CHOOSIFY_WEB_URL ||
      'http://localhost:5173'
    ).replace(/\/$/, '');
    res.status(201).json({
      success: true,
      data: toManualOrderOfferCard(offer),
      claim: {
        token: rawClaimToken,
        url: `${webBase}/orders/confirm/${encodeURIComponent(rawClaimToken!)}`,
        expiresAt: claimTokenExpiresAt,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create offer' });
  }
});

operationsRouter.get('/operations/manual-offers/:id', ...requireAuth, async (req, res) => {
  const existing = await getManualOrderOffer(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }
  if (!userIsStaff(req) && req.userId !== existing.sellerId && req.userId !== existing.buyerId) {
    res.status(403).json({ error: 'Not authorized to view this offer' });
    return;
  }
  res.json({ success: true, data: toManualOrderOfferCard(existing) });
});

/** Typed failure from finalizeManualOrderOffer so both the /accept and the
 *  external /claim/:token/confirm routes translate it to the same HTTP shape. */
class ManualOfferFinalizeError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Materialize a pending ManualOrderOffer into a canonical Operations order
 * for `buyer`. Shared by the native buyer /accept path and the external
 * customer /claim/:token/confirm path — one order engine, one code path.
 * Idempotent by the deterministic `MOF-ORDER-<offerId>` id.
 */
async function finalizeManualOrderOffer(
  existing: ManualOrderOffer,
  buyer: { buyerId: string; buyerName?: string },
): Promise<{ offer: ManualOrderOffer; order: ReturnType<typeof operationsStore.createOrder> }> {
  // Re-verify every item is still purchasable at acceptance time.
  for (const item of existing.items) {
    const entity =
      item.productType === 'service'
        ? await getService(item.productId)
        : await catalogStore.getProduct(item.productId);
    if (!entity) {
      throw new ManualOfferFinalizeError(
        400,
        `"${item.productTitle}" no longer exists and cannot be purchased.`,
      );
    }
    if (!isProductLifecyclePubliclyListable(entity.status)) {
      throw new ManualOfferFinalizeError(
        400,
        `"${item.productTitle}" is no longer available (status: ${normalizeProductLifecycle(entity.status)}) and cannot be purchased.`,
      );
    }
  }

  const orderId = `MOF-ORDER-${existing.id}`;
  const alreadyCreated = operationsStore.getOrder(orderId);
  if (alreadyCreated) {
    return {
      offer: {
        ...existing,
        status: 'accepted',
        orderId,
        buyerId: existing.buyerId || buyer.buyerId,
      },
      order: alreadyCreated,
    };
  }

  const required = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  for (const item of existing.items) {
    if (item.productType === 'service') continue;
    const key = `${item.productId}::${item.variantId || ''}`;
    const prior = required.get(key);
    required.set(key, {
      productId: item.productId,
      variantId: item.variantId,
      quantity: (prior?.quantity || 0) + item.quantity,
    });
  }

  const reservedInventoryLines: Array<{ productId: string; variantId?: string; quantity: number }> = [];
  for (const line of required.values()) {
    const result = await reserveInventoryQuantity(line);
    if (result.ok === true) {
      reservedInventoryLines.push(line);
      continue;
    }
    for (const r of reservedInventoryLines) {
      await releaseInventoryQuantity(r).catch((err) => {
        console.error('[ManualOrderOffer] Failed to release inventory after a later line failed reservation:', err);
      });
    }
    throw new ManualOfferFinalizeError(409, 'Insufficient stock for one or more items', {
      error: 'Insufficient stock for one or more items',
      code: 'INSUFFICIENT_STOCK',
      productId: line.productId,
      requestedQuantity: line.quantity,
      availableQuantity: (result as { ok: false; available: number }).available,
    });
  }

  // Re-check right before creating — narrows the reserve→write race.
  if (operationsStore.getOrder(orderId)) {
    for (const r of reservedInventoryLines) {
      await releaseInventoryQuantity(r).catch(() => undefined);
    }
    return {
      offer: {
        ...existing,
        status: 'accepted',
        orderId,
        buyerId: existing.buyerId || buyer.buyerId,
      },
      order: operationsStore.getOrder(orderId)!,
    };
  }

  // Warranty terms are snapshotted at the moment of purchase (acceptance).
  const ts = new Date().toISOString();
  const orderItems = await Promise.all(
    existing.items.map(async (it, idx) => {
      let warrantySnapshot: Record<string, unknown> = {};
      if (it.productType !== 'service') {
        const product = await catalogStore.getProduct(it.productId).catch(() => null);
        if (product?.warrantyMonths && product.warrantyMonths > 0) {
          const expiresAt = new Date(
            Date.now() + product.warrantyMonths * 30 * 24 * 60 * 60 * 1000,
          ).toISOString();
          warrantySnapshot = {
            warrantyMonthsAtPurchase: product.warrantyMonths,
            warrantyTypeAtPurchase: product.warrantyType,
            warrantyProviderAtPurchase: product.warrantyProvider,
            warrantyTermsSnapshot: product.warrantyTerms,
            warrantyStartsAt: ts,
            warrantyExpiresAt: expiresAt,
          };
        }
      }
      return {
        itemId: `item-${Date.now().toString(36)}-${idx}`,
        productId: it.productId,
        productTitle: it.productTitle,
        variantId: it.variantId,
        quantity: it.quantity,
        price: it.price,
        productType: it.productType,
        ...warrantySnapshot,
      };
    }),
  );
  const order = operationsStore.createOrder({
    orderId,
    buyerId: buyer.buyerId,
    isCOD: true,
    isSplit: false,
    overallTotal: existing.overallTotal,
    subtotal: existing.subtotal,
    deliveryTotal: existing.deliveryTotal,
    subOrders: [
      {
        sellerId: existing.sellerId,
        sellerBusinessName: existing.sellerName || '',
        items: orderItems,
        deliveryFee: existing.deliveryTotal,
        invoiceId: makeManualOfferInvoiceId(),
        trackingStatus: 'pending',
      },
    ],
    inventoryReserved: reservedInventoryLines.length > 0 ? true : undefined,
    paymentMethod: 'cod',
    status: 'confirmed',
    // Provenance retained through conversion — a claimed Meta order stays a Meta order.
    platformSource: PROVENANCE_TO_PLATFORM_SOURCE[existing.provenance?.source || 'manual'],
    isManual: true,
    createdAt: ts,
  });

  if (order.status !== 'pending_payment') {
    shipmentStore.createFromOrder(order);
  }
  scheduleOperationsPersist();
  try {
    await ensurePlatformOrderConversation(order);
  } catch (err) {
    console.warn('[ManualOrderOffer] Platform conversation bridge failed:', err);
  }

  const updated: ManualOrderOffer = {
    ...existing,
    status: 'accepted',
    orderId,
    buyerId: buyer.buyerId,
    buyerName: buyer.buyerName || existing.buyerName,
    claimedByUserId: existing.intendedCustomer ? buyer.buyerId : existing.claimedByUserId,
    claimedAt: existing.intendedCustomer ? ts : existing.claimedAt,
    updatedAt: ts,
  };
  await saveManualOrderOffer(updated);

  try {
    await notifyUser(existing.sellerId, {
      type: COMMUNICATION_TYPES.BUYER_UPDATE,
      category: 'seller',
      eventKey: 'order.offer',
      persona: 'seller',
      title: 'Order offer accepted',
      summary: `${updated.buyerName || 'The customer'} confirmed your offer — order ${orderId} created.`,
      actionUrl: '/dashboard?tab=seller-orders',
      metadata: { offerId: existing.id, orderId },
    });
  } catch (err) {
    console.warn('[ManualOrderOffer] Notify seller (accepted) failed:', err);
  }

  return { offer: updated, order };
}

const PROVENANCE_TO_PLATFORM_SOURCE: Record<string, 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline'> = {
  manual: 'Offline',
  external_offline: 'Offline',
  external_whatsapp: 'WhatsApp',
  external_facebook: 'Facebook',
  external_instagram: 'Instagram',
};

operationsRouter.post('/operations/manual-offers/:id/accept', ...requireAuth, async (req, res) => {
  const existing = await getManualOrderOffer(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }
  if (!req.userId || existing.buyerId !== req.userId) {
    res.status(403).json({ error: 'Only the buyer can accept this offer' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(400).json({ error: `Cannot accept offer in status ${existing.status}` });
    return;
  }
  try {
    const { offer, order } = await finalizeManualOrderOffer(existing, {
      buyerId: req.userId,
      buyerName: existing.buyerName || req.user?.displayName,
    });
    res.json({ success: true, data: toManualOrderOfferCard(offer), order });
  } catch (err) {
    if (err instanceof ManualOfferFinalizeError) {
      res.status(err.statusCode).json(err.body || { error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to accept offer' });
  }
});

// ─── External customer claim (no Choosify account required to receive the link) ──
// Reuses the security model of /operations/orders/claim/:token: opaque
// high-entropy token, SHA-256 stored server-side, expiry, public preview
// only, authenticated confirmation, server stamps buyerId, rate limited,
// idempotent. The token identifies the pending claim; authentication + a
// VERIFIED matching identity authorizes ownership — two separate concepts.

/** PUBLIC preview — no PII beyond what the customer already provided. */
operationsRouter.get('/operations/manual-offers/claim/:token', async (req, res) => {
  try {
    const hash = hashClaimToken(req.params.token);
    const offers = await listManualOrderOffers();
    const offer = offers.find((o) => o.claimTokenHash && o.claimTokenHash === hash);
    if (!offer) {
      res.status(404).json({ error: 'This order link is invalid.' });
      return;
    }
    if (isClaimExpired(offer.claimTokenExpiresAt) && offer.status === 'awaiting_buyer_claim') {
      res.status(410).json({ error: 'This order link has expired.', code: 'CLAIM_EXPIRED' });
      return;
    }
    const card = toManualOrderOfferCard(offer);
    res.json({
      data: {
        offerId: card.offerId,
        sellerName: card.sellerName,
        items: card.items,
        subtotal: card.subtotal,
        deliveryTotal: card.deliveryTotal,
        overallTotal: card.overallTotal,
        currency: card.currency,
        status: card.status,
        createdAt: card.createdAt,
        orderId: card.orderId,
        provenanceSource: offer.provenance?.source,
        intendedCustomerName: offer.intendedCustomer?.name,
        addressHint: offer.intendedCustomer?.addressHint,
        claimTokenExpiresAt: offer.claimTokenExpiresAt,
        alreadyClaimed: Boolean(offer.claimedByUserId),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Lookup failed' });
  }
});

/** AUTHENTICATED confirm — server binds ownership; the frontend never sends buyerId. */
operationsRouter.post(
  '/operations/manual-offers/claim/:token/confirm',
  ...requireAuth,
  async (req, res) => {
    const rawToken = req.params.token;
    const abuse = recordClaimConfirmAttempt(req.ip, rawToken);
    if (abuse.thresholdExceeded) {
      res.status(429).json({ error: 'Too many confirmation attempts. Please try again later.' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hash = hashClaimToken(rawToken);
    const offers = await listManualOrderOffers();
    const existing = offers.find((o) => o.claimTokenHash && claimTokenMatches(rawToken, o.claimTokenHash) && o.claimTokenHash === hash);
    if (!existing) {
      res.status(404).json({ error: 'This order link is invalid.' });
      return;
    }

    // Idempotency: already claimed by THIS user → return the existing order.
    if (existing.claimedByUserId && existing.claimedByUserId === req.userId && existing.orderId) {
      const order = operationsStore.getOrder(existing.orderId);
      res.json({ success: true, data: toManualOrderOfferCard(existing), order: order || null });
      return;
    }
    if (existing.claimedByUserId && existing.claimedByUserId !== req.userId) {
      res.status(409).json({ error: 'This order has already been confirmed by another account.', code: 'ALREADY_CLAIMED' });
      return;
    }
    if (existing.status === 'rejected') {
      res.status(409).json({ error: 'This order was declined and can no longer be confirmed.', code: 'OFFER_REJECTED' });
      return;
    }
    if (existing.status !== 'awaiting_buyer_claim') {
      res.status(400).json({ error: `Cannot claim an offer in status ${existing.status}` });
      return;
    }
    if (isClaimExpired(existing.claimTokenExpiresAt)) {
      const ts = new Date().toISOString();
      await saveManualOrderOffer({ ...existing, status: 'expired', updatedAt: ts });
      res.status(410).json({ error: 'This order link has expired.', code: 'CLAIM_EXPIRED' });
      return;
    }

    // ── Identity verification ──────────────────────────────────────────
    // Choosify verifies EMAIL (authTokens 'email_verification' + users.emailVerified).
    // There is NO phone verification anywhere — phone is corroborating only.
    const intended = existing.intendedCustomer;
    if (!intended) {
      res.status(400).json({ error: 'This offer has no external customer to reconcile.' });
      return;
    }
    const authEmailNorm = normalizeEmail(req.user?.email || '');
    // Source-of-truth verification state from the DB (a JWT claim can be stale).
    const authAccount = await findAccountByNormalizedEmail(authEmailNorm).catch(() => null);

    const emailIdentityVerified =
      !!authAccount &&
      authAccount.uid === req.userId &&
      authAccount.emailVerified === true &&
      req.user?.emailVerified === true;

    if (!emailIdentityVerified) {
      res.status(403).json({
        error:
          'Confirm your email address on your Choosify account, then reopen this order link.',
        code: 'IDENTITY_NOT_VERIFIED',
      });
      return;
    }
    if (authEmailNorm !== intended.normalizedEmail) {
      // Wrong authenticated account — possessing the raw link is not enough.
      res.status(403).json({
        error:
          'This order was created for a different email address and cannot be claimed by this account.',
        code: 'IDENTITY_MISMATCH',
      });
      return;
    }

    // Identity-conflict guard: `users` has NO phone column, so a phone can
    // never resolve to a Consumer account today — there is nothing to
    // contradict the verified-email match. If a phone-on-account model is
    // added later, resolve intended.normalizedPhone and return
    // 409 IDENTITY_CONFLICT when it maps to a different uid than req.userId.

    // Customer explicitly declines from the review page.
    if (String((req.body as { action?: string })?.action || '').toLowerCase() === 'decline') {
      const tsD = new Date().toISOString();
      const declined: ManualOrderOffer = {
        ...existing,
        status: 'rejected',
        rejectReason:
          typeof (req.body as { reason?: string })?.reason === 'string'
            ? (req.body as { reason: string }).reason.trim() || undefined
            : undefined,
        claimedByUserId: req.userId,
        claimedAt: tsD,
        updatedAt: tsD,
      };
      await saveManualOrderOffer(declined);
      try {
        await notifyUser(existing.sellerId, {
          type: COMMUNICATION_TYPES.BUYER_UPDATE,
          category: 'seller',
          eventKey: 'order.offer',
          persona: 'seller',
          title: 'Order offer declined',
          summary: `${intended.name} declined the prepared order.`,
          actionUrl: '/dashboard?tab=seller-orders',
          metadata: { offerId: existing.id },
        });
      } catch {
        /* non-fatal */
      }
      res.json({ success: true, data: toManualOrderOfferCard(declined), order: null });
      return;
    }

    try {
      const { offer, order } = await finalizeManualOrderOffer(
        { ...existing, status: 'pending' },
        { buyerId: req.userId, buyerName: req.user?.displayName || intended.name },
      );
      res.json({ success: true, data: toManualOrderOfferCard(offer), order });
    } catch (err) {
      if (err instanceof ManualOfferFinalizeError) {
        res.status(err.statusCode).json(err.body || { error: err.message });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to confirm order' });
    }
  },
);

operationsRouter.post('/operations/manual-offers/:id/reject', ...requireAuth, async (req, res) => {
  const existing = await getManualOrderOffer(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }
  if (!req.userId || existing.buyerId !== req.userId) {
    res.status(403).json({ error: 'Only the buyer can reject this offer' });
    return;
  }
  if (existing.status !== 'pending') {
    res.status(400).json({ error: `Cannot reject offer in status ${existing.status}` });
    return;
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const ts = new Date().toISOString();
  const updated: ManualOrderOffer = {
    ...existing,
    status: 'rejected',
    rejectReason: reason || undefined,
    updatedAt: ts,
  };
  await saveManualOrderOffer(updated);

  try {
    await notifyUser(existing.sellerId, {
      type: COMMUNICATION_TYPES.BUYER_UPDATE,
      category: 'seller',
      eventKey: 'order.offer',
      persona: 'seller',
      title: 'Order offer rejected',
      summary: `${existing.buyerName || 'The buyer'} rejected your offer${reason ? `: ${reason}` : '.'}`,
      actionUrl: `/messages/conv_platform_${existing.buyerId}`,
      metadata: { offerId: existing.id },
    });
  } catch (err) {
    console.warn('[ManualOrderOffer] Notify seller (rejected) failed:', err);
  }

  res.json({ success: true, data: toManualOrderOfferCard(updated) });
});

// ─── Returns ─────────────────────────────────────────────────────────────────

/**
 * Controlled state machine — mirrors WARRANTY_CLAIM_TRANSITIONS below. Before
 * this, /status accepted ANY enum value regardless of current status (no
 * guard at all), and /approve+/reject only checked "is this still initiated"
 * — /refund, /label and /dispute had no transition guard whatsoever.
 *
 * "Return + Refund" vs "Refund without return" are two structurally
 * different outcomes (product rule #3) and must never be simultaneously
 * available with no explicit decision recorded — the seller/staff chooses
 * `requiresReturn` AT APPROVAL TIME (see /approve), and that single boolean
 * on the row is what actually gates which of these two branches is legal
 * from here on, not just "is 'refunded' in this list at all":
 *   requiresReturn=true  → approved → returned_in_transit → received → refunded
 *   requiresReturn=false → approved → refunded directly (no transit/received)
 * Both branches appear in RETURN_TRANSITIONS below for the type to compile;
 * assertReturnTransition() takes the full row and enforces the split.
 * 'refunded'/'rejected' are terminal; 'dispute' is reachable from any
 * non-terminal status and is also terminal here (the dispute layer takes
 * over from there), matching the warranty claim model.
 */
const RETURN_TRANSITIONS: Record<OpsReturnStatus, OpsReturnStatus[]> = {
  initiated: ['approved', 'rejected', 'dispute'],
  approved: ['returned_in_transit', 'refunded', 'dispute'],
  returned_in_transit: ['received', 'dispute'],
  received: ['refunded', 'dispute'],
  refunded: [],
  rejected: [],
  // A disputed case is adjudicated by staff (POST /operations/disputes/:id/decision,
  // requireAdmin), independent of whether the seller ever approved it — staff
  // must be able to force EITHER outcome from here, which is exactly the
  // "seller refuses, admin still has final say" override the product needs.
  dispute: ['refunded', 'rejected'],
};

/**
 * `row` is optional only for call sites that don't yet have one (there are
 * none left, but keeps this safe to call defensively). When present, the
 * requiresReturn split is enforced on top of the base RETURN_TRANSITIONS
 * table: from 'approved', only ONE of returned_in_transit/refunded is ever
 * legal, per that case's own recorded decision — never both.
 */
function assertReturnTransition(
  current: OpsReturnStatus,
  next: OpsReturnStatus,
  row?: Pick<OpsReturnRequest, 'requiresReturn'>,
): string | null {
  const allowed = RETURN_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return `Cannot move a return from "${current}" to "${next}".`;
  }
  if (current === 'approved' && row) {
    const requiresReturn = row.requiresReturn !== false; // default true — matches the common case
    if (requiresReturn && next === 'refunded') {
      return 'This case requires the item back before a refund — mark it shipped and received first.';
    }
    if (!requiresReturn && next === 'returned_in_transit') {
      return 'This case was approved as refund-without-return — no physical return is expected.';
    }
  }
  return null;
}

/** Every status transition appends here — never mutated after the fact. */
function appendReturnTimeline(
  ret: OpsReturnRequest,
  entry: { status: OpsReturnStatus; note?: string; by?: string },
): OpsReturnTimelineEntry[] {
  const existing = ret.timeline || [];
  return [
    ...existing,
    { id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), ...entry },
  ];
}

/** Strip staff/seller-only notes before a response ever reaches the buyer. */
function sanitizeReturnForConsumer(row: OpsReturnRequest): OpsReturnRequest {
  const { internalNotes, ...rest } = row;
  return { ...rest, internalNotes: [] };
}

operationsRouter.get('/operations/returns', ...requireAuth, (req, res) => {
  let buyerId = typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined;
  let sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;

  if (!userCanListReturns(req, { buyerId, sellerId })) {
    // Sellers with no filter → scope to their own sellerId
    if (
      !buyerId &&
      !sellerId &&
      req.userId &&
      req.userRole &&
      (hasRole(req.userRole, ROLES.SELLER) || hasRole(req.userRole, ROLES.VERIFIED_SELLER))
    ) {
      sellerId = req.userId;
    } else if (!buyerId && !sellerId && req.userId && !userIsStaff(req)) {
      // Default buyers to their own list
      buyerId = req.userId;
    }
    if (!userCanListReturns(req, { buyerId, sellerId })) {
      res.status(403).json({ error: 'Not authorized to list these returns' });
      return;
    }
  }

  const rows = operationsStore.listReturns({ buyerId, sellerId, status, orderId });
  const isBuyerRequest = !userIsStaff(req) && !sellerId;
  res.json({ data: isBuyerRequest ? rows.map(sanitizeReturnForConsumer) : rows });
});

operationsRouter.get('/operations/returns/:id', ...requireAuth, (req, res) => {
  const row = operationsStore.getReturn(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  const isBuyer = Boolean(req.userId && row.buyerId === req.userId);
  if (!isBuyer && !userCanManageReturnAsSellerOrAdmin(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this return' });
    return;
  }
  res.json({ data: isBuyer && !userCanManageReturnAsSellerOrAdmin(req, row) ? sanitizeReturnForConsumer(row) : row });
});

/**
 * Flat, document-ready payload for the Return / Refund Case Document —
 * resolves buyer/seller identity server-side (never via the admin-only
 * GET /auth/users/:id, which a seller can't call) so both buyer and seller
 * can render the same document. Internal-only notes are never included.
 */
operationsRouter.get('/operations/returns/:id/document', ...requireAuth, async (req, res) => {
  const row = operationsStore.getReturn(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  const isBuyer = Boolean(req.userId && row.buyerId === req.userId);
  if (!isBuyer && !userCanManageReturnAsSellerOrAdmin(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this return' });
    return;
  }

  const order = operationsStore.getOrder(row.orderId);
  const located = order ? findOrderItem(order, row.itemId) : null;
  const item = located?.item;

  const [buyer, seller] = await Promise.all([
    db.select({ displayName: users.displayName, choosifyUserId: users.choosifyUserId, email: users.email }).from(users).where(eq(users.id, row.buyerId)).limit(1),
    db.select({ displayName: users.displayName, choosifyUserId: users.choosifyUserId, email: users.email }).from(users).where(eq(users.id, row.sellerId)).limit(1),
  ]);

  const returnCase = sanitizeReturnForConsumer(row);
  res.json({
    data: {
      returnCase,
      buyer: buyer[0] ? { name: buyer[0].displayName, choosifyUserId: buyer[0].choosifyUserId, email: buyer[0].email } : null,
      seller: seller[0] ? { name: seller[0].displayName, choosifyUserId: seller[0].choosifyUserId, email: seller[0].email } : null,
      product: item
        ? {
            title: typeof item.productTitle === 'string' ? item.productTitle : undefined,
            variant: typeof item.variantLabel === 'string' ? item.variantLabel : undefined,
          }
        : null,
    },
  });
});

/**
 * Sprint 8 QA — P0 fix: this endpoint previously trusted orderId/sellerId
 * from the client with no order lookup at all (a return could be created
 * against a nonexistent order), and separately spread body.status /
 * body.approvalDecision / body.refundAmount / body.approvedBy / body.id
 * straight onto the created row — letting an authenticated buyer
 * self-create an already-"approved" return with an arbitrary refund
 * amount for a fabricated order. Every trust-sensitive field is now
 * derived server-side from the real, owned, delivered order/order-item,
 * mirroring the pattern also used for review eligibility (Sprint 9) and
 * mark-delivered authorization.
 * Approval/refund fields can only ever be set via the dedicated
 * /approve, /reject etc. endpoints, which already have real
 * authorization checks.
 */
operationsRouter.post('/operations/returns', ...requireAuth, async (req, res) => {
  const body = req.body as Partial<OpsReturnRequest>;
  const orderId = String(body.orderId || '').trim();
  const itemId = String(body.itemId || '').trim();
  const reason = body.reason;
  const description = String(body.description || '').trim();

  if (!orderId || !itemId || !reason || !description) {
    res.status(400).json({
      error: 'orderId, itemId, reason, and description are required',
    });
    return;
  }
  const evidenceMediaIds = Array.isArray(body.evidenceMediaIds)
    ? (body.evidenceMediaIds as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 8)
    : [];
  // External link only (e.g. Google Drive) — never a raw video upload; a basic
  // http(s) sanity check, not full validation of the destination.
  const videoLink =
    typeof body.videoLink === 'string' && /^https?:\/\//i.test(body.videoLink.trim())
      ? body.videoLink.trim().slice(0, 500)
      : undefined;
  // Proof requirement: a return claim (damage/wrong item/etc.) must carry at
  // least one photo or a video link — never taken purely on the buyer's word.
  if (evidenceMediaIds.length === 0 && !videoLink) {
    res.status(400).json({ error: 'At least one evidence photo or a video link is required to submit a return request' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const order = operationsStore.getOrder(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.buyerId !== req.userId) {
    res.status(403).json({ error: 'Not authorized to request a return for this order' });
    return;
  }
  const located = findOrderItem(order, itemId);
  if (!located) {
    res.status(404).json({ error: 'Order item not found' });
    return;
  }
  const delivered =
    located.sub.trackingStatus === 'delivered' || order.status === 'completed';
  if (!delivered) {
    res.status(400).json({ error: 'This item has not been delivered yet' });
    return;
  }
  // Seller identity — re-resolved server-side from the real product record
  // (mirroring the warranty-claims create handler), since sub.sellerId isn't
  // always populated by every order-creation path. Without this fallback the
  // seller could never see or approve their own return.
  const returnProductId = String(located.item.productId || '').trim();
  let sellerId = String(located.sub.sellerId || '').trim();
  if (returnProductId) {
    const returnProduct = await catalogStore.getProduct(returnProductId);
    if (returnProduct?.sellerId) sellerId = returnProduct.sellerId;
  }
  if (!sellerId) {
    res.status(400).json({ error: 'Could not resolve the seller for this order item' });
    return;
  }

  const activeExisting = operationsStore.getActiveReturnForItem(itemId);
  if (activeExisting) {
    // Policy: at most one ACTIVE case per order item — return the existing one rather than erroring hard.
    res.status(200).json({ success: true, data: activeExisting, reused: true });
    return;
  }

  const saved = operationsStore.createReturn({
    orderId,
    itemId,
    initiatedBy: 'customer',
    reason,
    description,
    evidencePhotos: Array.isArray(body.evidencePhotos) ? body.evidencePhotos : [],
    evidenceMediaIds,
    videoLink,
    status: 'initiated',
    refundStatus: 'pending',
    notes: [],
    sellerId,
    buyerId: req.userId,
  });
  scheduleOperationsPersist();

  // Link evidence photos to this case via the canonical media polymorphic association.
  if (evidenceMediaIds.length) {
    try {
      const { linkMediaToEntity } = await import('./media/mediaRepository');
      await Promise.all(
        evidenceMediaIds.map((mid) => linkMediaToEntity(mid, 'return', saved.id).catch(() => undefined)),
      );
    } catch {
      /* linking is best-effort; the case itself is already saved */
    }
  }

  // Canonical RT-##### display id — never generated on the frontend.
  let savedWithRef = saved;
  try {
    const referenceId = await ensureEntityReferenceId({
      entityType: 'return',
      internalId: saved.id,
      current: saved.referenceId,
    });
    savedWithRef = operationsStore.updateReturn(saved.id, { referenceId }) || saved;
    scheduleOperationsPersist();
  } catch (err) {
    Logger.warn('return: failed to assign reference id', {
      returnId: saved.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (sellerId) {
    try {
      await notifyUser(sellerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'seller',
        eventKey: 'return.update',
        persona: 'seller',
        title: 'New return request',
        summary: `${String(located.item.productTitle || 'An item')} from order ${orderId} — reason: ${reason}.`,
        actionUrl: `/admin/returns/${encodeURIComponent(savedWithRef.referenceId || savedWithRef.id)}`,
        metadata: { orderId, returnId: saved.id, referenceId: savedWithRef.referenceId },
      });
    } catch (err) {
      console.warn('[Returns] Notify seller (new return) failed:', err);
    }
  }

  res.status(201).json({ success: true, data: operationsStore.getReturn(saved.id) || saved });
});

operationsRouter.patch('/operations/returns/:id/approve', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to approve this return' });
    return;
  }
  const approveTransitionError = assertReturnTransition(existing.status, 'approved', existing);
  if (approveTransitionError) {
    res.status(409).json({ error: approveTransitionError });
    return;
  }
  const refundAmount = Number(req.body?.refundAmount);
  if (!Number.isFinite(refundAmount)) {
    res.status(400).json({ error: 'refundAmount is required' });
    return;
  }
  // Explicit decision, recorded once and never re-decided later: does the
  // buyer have to send the item back before the refund, or not? Defaults to
  // true (the common case — most defective/damaged/wrong-item claims DO
  // require the item back) when the caller doesn't say otherwise; only an
  // explicit `false` opts into the no-return path. This is what actually
  // stops both "Mark Shipped" and "Refund Without Return" being ambiguously
  // available on the same case at once.
  const requiresReturn = req.body?.requiresReturn !== false;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const approvedBy =
    typeof req.body?.approvedBy === 'string' && req.body.approvedBy.trim()
      ? req.body.approvedBy.trim()
      : req.user?.displayName || req.userId || 'Admin Main';

  const adminNotes = [...existing.notes];
  if (note) adminNotes.push(note);
  adminNotes.push(
    requiresReturn
      ? `Return approved with refund of ৳${refundAmount}. Waiting for item return.`
      : `Return approved as refund-without-return, ৳${refundAmount}. No physical return required.`,
  );

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'approved',
    approvalDecision: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy,
    refundAmount,
    requiresReturn,
    notes: adminNotes,
    timeline: appendReturnTimeline(existing, {
      status: 'approved',
      note: note || (requiresReturn ? undefined : 'Refund without return'),
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();

  try {
    await notifyUser(existing.buyerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'return.update',
      persona: 'consumer',
      title: 'Return approved',
      summary: `Your return for order ${existing.orderId} was approved — refund of ৳${refundAmount.toLocaleString()}.`,
      actionUrl: '/dashboard?tab=my-returns',
      metadata: { orderId: existing.orderId, returnId: existing.id },
    });
  } catch (err) {
    console.warn('[Returns] Notify buyer (approved) failed:', err);
  }

  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/returns/:id/reject', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to reject this return' });
    return;
  }
  // Once escalated to dispute, only staff decide the outcome — the seller's
  // own reject/approve authority does not extend past that point.
  if (existing.status === 'dispute' && !userCanProcessRefund(req)) {
    res.status(403).json({ error: 'This case is under dispute — only staff can decide the outcome.' });
    return;
  }
  const rejectTransitionError = assertReturnTransition(existing.status, 'rejected', existing);
  if (rejectTransitionError) {
    res.status(409).json({ error: rejectTransitionError });
    return;
  }
  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }
  const approvedBy =
    typeof req.body?.approvedBy === 'string' && req.body.approvedBy.trim()
      ? req.body.approvedBy.trim()
      : req.user?.displayName || req.userId || 'Admin Main';

  const adminNotes = [...existing.notes];
  adminNotes.push(`Return rejected. Reason: "${reason}"`);

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'rejected',
    approvalDecision: 'rejected',
    approvalReason: reason,
    approvedAt: new Date().toISOString(),
    approvedBy,
    notes: adminNotes,
    timeline: appendReturnTimeline(existing, { status: 'rejected', note: reason, by: req.userId }),
  });
  scheduleOperationsPersist();

  try {
    await notifyUser(existing.buyerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'return.update',
      persona: 'consumer',
      title: 'Return rejected',
      summary: `Your return for order ${existing.orderId} was rejected: ${reason}`,
      actionUrl: '/dashboard?tab=my-returns',
      metadata: { orderId: existing.orderId, returnId: existing.id },
    });
  } catch (err) {
    console.warn('[Returns] Notify buyer (rejected) failed:', err);
  }

  res.json({ success: true, data: saved });
});

/**
 * The canonical Returns & Refunds refund flow — and, per product decision,
 * the ONLY place warranty-claim "refund" resolutions are allowed to move
 * money too (see /operations/warranty-claims/:id/resolve). This must
 * actually touch the real escrow ledger, not just flip a status label:
 * finds the held escrow for this return's order (the same seller's escrow,
 * when more than one exists on the order) and calls the real
 * processEscrowRefund() — the one money-moving entry point in this
 * codebase (server/escrow/escrowService.ts). A missing/unrefundable
 * escrow now fails loudly (409) instead of silently "succeeding".
 *
 * STAFF-ONLY: the seller may approve/reject a case (the decision layer,
 * see /approve and /reject), but never dispatches the actual payout
 * themselves. Once staff decide — including overriding a seller who
 * refused, via the dispute path — only staff execute the money movement.
 */
operationsRouter.patch('/operations/returns/:id/refund', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanProcessRefund(req)) {
    res.status(403).json({ error: 'Only Choosify staff can process a refund payout.' });
    return;
  }
  // CRITICAL FIX: this previously required exactly 'approved', but the admin
  // UI only ever reveals the "Process & Issue Refund Payment" button once the
  // case reaches 'received' — meaning the documented happy path (approve →
  // in-transit → received → refund) 409'd on every real click. 'approved' is
  // kept too for a legitimate "refund without return" case (rule #3).
  const refundTransitionError = assertReturnTransition(existing.status, 'refunded', existing);
  if (refundTransitionError) {
    res.status(409).json({ error: refundTransitionError });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const escrows = await escrowStore.listEscrowsByOrder(existing.orderId);
    const escrow = escrows.find((e) => e.sellerId === existing.sellerId) || escrows[0];
    if (!escrow) {
      res.status(409).json({ error: 'No escrow found for this order — cannot process a real refund.' });
      return;
    }
    const refund = await processEscrowRefund({
      escrowId: escrow.escrowId,
      amount: typeof existing.refundAmount === 'number' ? existing.refundAmount : undefined,
      reason: `return_refund:${existing.id}`,
      actor: { userId: req.userId, role: req.userRole },
    });

    const adminNotes = [...existing.notes];
    adminNotes.push(
      `Refund processed via escrow (${refund.refundReferenceId || refund.refundId}, amount ${refund.amount} ${refund.currency}).`,
    );

    const saved = operationsStore.updateReturn(req.params.id, {
      status: 'refunded',
      refundStatus: 'processed',
      refundAmount: refund.amount,
      notes: adminNotes,
      timeline: appendReturnTimeline(existing, {
        status: 'refunded',
        note: `Refund ${refund.refundReferenceId || refund.refundId}, amount ${refund.amount} ${refund.currency}`,
        by: req.userId,
      }),
    });
    scheduleOperationsPersist();
    res.json({ success: true, data: saved, refund });
  } catch (error) {
    res.status(error instanceof CommerceError ? error.statusCode || 409 : 500).json({
      error: error instanceof Error ? error.message : 'Failed to process refund',
    });
  }
});

operationsRouter.patch('/operations/returns/:id/status', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this return status' });
    return;
  }
  const status = String(req.body?.status || '').trim() as OpsReturnStatus;
  const allowed: OpsReturnStatus[] = [
    'initiated',
    'approved',
    'rejected',
    'returned_in_transit',
    'received',
    'refunded',
    'dispute',
  ];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: 'Invalid status', allowed });
    return;
  }
  // Previously accepted ANY value in `allowed` regardless of the case's
  // current status — a caller could PATCH straight from 'initiated' to
  // 'refunded', or bounce backward from 'refunded' to 'initiated'. Now
  // routed through the same RETURN_TRANSITIONS state machine as every
  // other mutation endpoint.
  const statusTransitionError = assertReturnTransition(existing.status, status, existing);
  if (statusTransitionError) {
    res.status(409).json({ error: statusTransitionError });
    return;
  }

  const adminNotes = [...existing.notes];
  adminNotes.push(`Status transitioned to: ${status.toUpperCase()}`);

  const saved = operationsStore.updateReturn(req.params.id, {
    status,
    notes: adminNotes,
    timeline: appendReturnTimeline(existing, { status, by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/returns/:id/note', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  // Returns.tsx (admin) adds notes; MyReturnsSection has no note UI → seller/admin only.
  if (!userCanAddReturnNote(req, existing)) {
    res.status(403).json({ error: 'Not authorized to add a note on this return' });
    return;
  }
  const note = String(req.body?.note || '').trim();
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }

  const saved = operationsStore.updateReturn(req.params.id, {
    notes: [...existing.notes, `[${new Date().toISOString()}] ${note}`],
    timeline: appendReturnTimeline(existing, { status: existing.status, note, by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/returns/:id/label', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to generate a return label' });
    return;
  }
  // A shipping label only makes sense before/during the physical return leg —
  // previously callable in any status including after refunded/rejected.
  if (existing.status !== 'approved' && existing.status !== 'returned_in_transit') {
    res.status(409).json({ error: `Cannot generate a return label while status is "${existing.status}".` });
    return;
  }

  const trackingId = `PATHAO-RET-${Math.floor(100000 + Math.random() * 900000)}`;
  const courier = 'Pathao Delivery';
  const labelUrl = `https://api.choosify.bd/logistics/label/${trackingId}`;

  const saved = operationsStore.updateReturn(req.params.id, {
    returnTrackingId: trackingId,
    returnCourier: courier,
    notes: [...existing.notes, `Prepaid Return Label generated with tracking ID ${trackingId}.`],
  });
  scheduleOperationsPersist();
  res.json({
    success: true,
    data: saved,
    labelUrl,
    trackingId,
    courier,
  });
});

operationsRouter.patch('/operations/returns/:id/dispute', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to escalate this return' });
    return;
  }
  // Previously callable in any status, including an already-refunded/rejected
  // case. Escalation only makes sense while the case is still open.
  const disputeTransitionError = assertReturnTransition(existing.status, 'dispute', existing);
  if (disputeTransitionError) {
    res.status(409).json({ error: disputeTransitionError });
    return;
  }

  // Creates a real Dispute case (server/operations disputes) rather than
  // just stamping a client-fabricated string -- the Disputes module is now
  // the actual escalation/adjudication layer, not an inert label.
  let dispute = operationsStore.getActiveDisputeForSource('return', existing.id);
  if (!dispute) {
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : `Return ${existing.id} escalated to dispute`;
    dispute = operationsStore.createDispute({
      sourceType: 'return',
      sourceId: existing.id,
      orderId: existing.orderId,
      buyerId: existing.buyerId,
      sellerId: existing.sellerId,
      reason,
      amount: existing.refundAmount,
    });
  }

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'dispute',
    disputeId: dispute.id,
    notes: [
      ...existing.notes,
      `Escalated to Dispute resolution system. Dispute ID: ${dispute.id}`,
    ],
    timeline: appendReturnTimeline(existing, { status: 'dispute', note: `Escalated to dispute ${dispute.id}`, by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved, dispute });
});

/** Seller/staff/admin: internal note — NEVER returned to the buyer under any circumstance. */
operationsRouter.patch('/operations/returns/:id/internal-note', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this return' });
    return;
  }
  const note = String(req.body?.note || '').trim();
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  const saved = operationsStore.updateReturn(req.params.id, {
    internalNotes: [
      ...(existing.internalNotes || []),
      { id: `in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, note, by: req.userId || 'unknown', at: new Date().toISOString() },
    ],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

// ─── Warranty Claims ───────────────────────────────────────────────────────

/**
 * Controlled state machine — a seller/staff action may only move a claim to
 * one of these next statuses from its current one. This is what actually
 * stops "Submitted" jumping straight to "Resolved": every mutation endpoint
 * below calls assertWarrantyClaimTransition() before writing the new status.
 * Terminal statuses (rejected/resolved/cancelled) have no further exits;
 * 'disputed' is reachable from any still-open status via the existing
 * escalate-to-dispute endpoint, and is also terminal for this state machine
 * (the dispute layer takes over from there).
 */
const WARRANTY_CLAIM_TRANSITIONS: Record<OpsWarrantyClaimStatus, OpsWarrantyClaimStatus[]> = {
  submitted: ['acknowledged', 'more_info_required', 'rejected', 'cancelled', 'disputed'],
  more_info_required: ['submitted', 'cancelled', 'disputed'],
  acknowledged: ['approved', 'more_info_required', 'rejected', 'disputed'],
  approved: ['service_in_progress', 'resolved', 'disputed'],
  service_in_progress: ['resolved', 'disputed'],
  rejected: [],
  resolved: [],
  cancelled: [],
  // Staff adjudicate a disputed claim independent of the seller's earlier
  // stance — the same "seller refuses, admin has final say" override as
  // Returns. Resolve here covers all outcomes, including a staff-forced
  // refund (resolutionType: 'refunded', already staff-gated in /resolve).
  disputed: ['resolved'],
};

function assertWarrantyClaimTransition(
  current: OpsWarrantyClaimStatus,
  next: OpsWarrantyClaimStatus,
): string | null {
  const allowed = WARRANTY_CLAIM_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return `Cannot move a warranty claim from "${current}" to "${next}".`;
  }
  return null;
}

/** Every status transition and every customer-visible note appends here — never mutated after the fact. */
function appendWarrantyClaimTimeline(
  claim: OpsWarrantyClaim,
  entry: {
    status: OpsWarrantyClaimStatus;
    serviceStage?: OpsWarrantyClaimServiceStage;
    note?: string;
    by?: string;
  },
): OpsWarrantyClaimTimelineEntry[] {
  const existing = claim.timeline || [];
  return [
    ...existing,
    {
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    },
  ];
}

/** Strip staff/seller-only notes before a response ever reaches the consumer. */
function sanitizeWarrantyClaimForConsumer(row: OpsWarrantyClaim): OpsWarrantyClaim {
  const { internalNotes, ...rest } = row;
  return { ...rest, internalNotes: [] };
}

function warrantyServiceStageTier(stage: OpsWarrantyClaimServiceStage): number {
  return WARRANTY_CLAIM_SERVICE_STAGE_ORDER.findIndex((tier) => tier.includes(stage));
}

const WARRANTY_SERVICE_STAGES = new Set<OpsWarrantyClaimServiceStage>(
  WARRANTY_CLAIM_SERVICE_STAGE_ORDER.flat(),
);

function userIsWarrantyClaimSeller(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsWarrantyClaim,
): boolean {
  if (!req.userId || row.sellerId !== req.userId) return false;
  const role = req.userRole;
  return Boolean(role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER)));
}

function userCanManageWarrantyClaim(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsWarrantyClaim,
): boolean {
  if (userIsStaff(req)) return true;
  return userIsWarrantyClaimSeller(req, row);
}

/** Locate an order item + its owning sub-order, purely server-side (never trust client-supplied item data). */
function findOrderItem(
  order: OpsStorefrontOrder,
  orderItemId: string,
): { sub: Record<string, unknown>; item: Record<string, unknown> } | null {
  const subs = (order.subOrders || []) as Array<Record<string, unknown>>;
  for (const sub of subs) {
    const items = (sub.items || []) as Array<Record<string, unknown>>;
    const item = items.find((it) => it.itemId === orderItemId);
    if (item) return { sub, item };
  }
  return null;
}

operationsRouter.get('/operations/warranty-claims', ...requireAuth, (req, res) => {
  let consumerId = typeof req.query.consumerId === 'string' ? req.query.consumerId : undefined;
  let sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orderItemId = typeof req.query.orderItemId === 'string' ? req.query.orderItemId : undefined;

  if (!userIsStaff(req)) {
    if (req.userRole && (hasRole(req.userRole, ROLES.SELLER) || hasRole(req.userRole, ROLES.VERIFIED_SELLER))) {
      // Sellers see ONLY claims against their own seller/brand — never client-supplied sellerId.
      sellerId = req.userId;
      consumerId = undefined;
    } else {
      // Everyone else (consumer) sees only their own claims.
      consumerId = req.userId;
      sellerId = undefined;
    }
  }

  const rows = operationsStore.listWarrantyClaims({ consumerId, sellerId, orderItemId, status });
  const isConsumerRequest = !userIsStaff(req) && !sellerId;
  res.json({ data: isConsumerRequest ? rows.map(sanitizeWarrantyClaimForConsumer) : rows });
});

operationsRouter.get('/operations/warranty-claims/:id', ...requireAuth, (req, res) => {
  const row = operationsStore.getWarrantyClaim(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  const isConsumer = Boolean(req.userId && row.consumerId === req.userId);
  if (!isConsumer && !userCanManageWarrantyClaim(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this warranty claim' });
    return;
  }
  res.json({ data: isConsumer && !userCanManageWarrantyClaim(req, row) ? sanitizeWarrantyClaimForConsumer(row) : row });
});

/**
 * Flat, document-ready payload for the Warranty Delivery Invoice — resolves
 * buyer/seller identity server-side (never via the admin-only
 * GET /auth/users/:id, which a seller can't call) so both buyer and seller
 * can render the same document. Internal-only notes are never included.
 *
 * No document exists before the claim is actually accepted and moving
 * through repair — there's nothing to print for a request still pending
 * review; the buyer already sees seller/staff notes and status updates in
 * the storefront claim view for that. Available from approval through
 * resolution (the repair/replacement period).
 */
const WARRANTY_DELIVERY_INVOICE_ELIGIBLE_STATUSES = new Set<OpsWarrantyClaimStatus>(['approved', 'service_in_progress', 'resolved']);

operationsRouter.get('/operations/warranty-claims/:id/document', ...requireAuth, async (req, res) => {
  const row = operationsStore.getWarrantyClaim(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  const isConsumer = Boolean(req.userId && row.consumerId === req.userId);
  if (!isConsumer && !userCanManageWarrantyClaim(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this warranty claim' });
    return;
  }
  if (!WARRANTY_DELIVERY_INVOICE_ELIGIBLE_STATUSES.has(row.status)) {
    res.status(400).json({ error: 'A Warranty Delivery Invoice is only available once the claim has been accepted and is moving through repair.' });
    return;
  }

  const order = operationsStore.getOrder(row.orderId);
  const located = order ? findOrderItem(order, row.orderItemId) : null;
  const item = located?.item;

  const [buyer, seller] = await Promise.all([
    db.select({ displayName: users.displayName, choosifyUserId: users.choosifyUserId, email: users.email }).from(users).where(eq(users.id, row.consumerId)).limit(1),
    db.select({ displayName: users.displayName, choosifyUserId: users.choosifyUserId, email: users.email }).from(users).where(eq(users.id, row.sellerId)).limit(1),
  ]);

  const claim = sanitizeWarrantyClaimForConsumer(row);
  res.json({
    data: {
      claim,
      buyer: buyer[0] ? { name: buyer[0].displayName, choosifyUserId: buyer[0].choosifyUserId, email: buyer[0].email } : null,
      seller: seller[0] ? { name: seller[0].displayName, choosifyUserId: seller[0].choosifyUserId, email: seller[0].email } : null,
      product: item
        ? {
            title: typeof item.productTitle === 'string' ? item.productTitle : undefined,
            variant: typeof item.variantLabel === 'string' ? item.variantLabel : undefined,
            serialNumber: typeof item.serialNumber === 'string' ? item.serialNumber : undefined,
          }
        : null,
    },
  });
});

const WARRANTY_ISSUE_TYPES = new Set([
  'not_powering_on',
  'manufacturing_defect',
  'physical_damage',
  'battery_charging',
  'performance_software',
  'missing_damaged_accessory',
  'other',
]);

/**
 * Submit a warranty claim. Every trust-sensitive field — purchase date,
 * warranty months, expiry, seller id, product ownership — is derived
 * server-side from the real order/order-item, never from the client body.
 * At most ONE active claim per order item; a resolved claim may allow
 * another later claim if the warranty snapshot is still active.
 */
operationsRouter.post('/operations/warranty-claims', ...requireAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const orderItemId = String(req.body?.orderItemId || '').trim();
    const issueType = String(req.body?.issueType || '').trim();
    const description = String(req.body?.description || '').trim();

    // Evidence is collected as four separate, categorized proof uploads
    // (warranty card, product photo, box, invoice/receipt) rather than one
    // generic bucket — each category is its own upload section on the
    // storefront. attachmentMediaIds is kept as the flat union for backward
    // compat (media linking, document view) but attachmentCategories is now
    // the source of truth for what was actually submitted under each proof type.
    const rawCategories = req.body?.attachmentCategories;
    const attachmentCategories: Partial<Record<OpsWarrantyClaimAttachmentCategory, string[]>> = {};
    if (rawCategories && typeof rawCategories === 'object') {
      for (const cat of WARRANTY_CLAIM_ATTACHMENT_CATEGORIES) {
        const list = (rawCategories as Record<string, unknown>)[cat];
        if (Array.isArray(list)) {
          const filtered = list.filter((v): v is string => typeof v === 'string').slice(0, 6);
          if (filtered.length) attachmentCategories[cat] = filtered;
        }
      }
    }
    const categorizedUnion = WARRANTY_CLAIM_ATTACHMENT_CATEGORIES.flatMap((cat) => attachmentCategories[cat] || []);
    const legacyFlat = Array.isArray(req.body?.attachmentMediaIds)
      ? (req.body.attachmentMediaIds as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    const attachmentMediaIds = Array.from(new Set([...categorizedUnion, ...legacyFlat])).slice(0, 24);

    if (!orderId || !orderItemId || !issueType || !description) {
      res.status(400).json({ error: 'orderId, orderItemId, issueType, and description are required' });
      return;
    }
    if (!WARRANTY_ISSUE_TYPES.has(issueType)) {
      res.status(400).json({ error: 'Invalid issueType' });
      return;
    }
    // Proof requirement: a warranty claim must carry at least one photo or
    // video attachment across the categorized proof sections — never taken
    // purely on the buyer's word.
    if (attachmentMediaIds.length === 0) {
      res.status(400).json({ error: 'At least one evidence photo or video is required to submit a warranty claim' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const order = operationsStore.getOrder(orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    // Ownership: current user must own the order. Never trust a client-supplied consumerId.
    if (order.buyerId !== req.userId) {
      res.status(403).json({ error: 'Not authorized to claim warranty on this order' });
      return;
    }

    const located = findOrderItem(order, orderItemId);
    if (!located) {
      res.status(404).json({ error: 'Order item not found' });
      return;
    }
    const { sub, item } = located;

    const warrantyMonths = Number(item.warrantyMonthsAtPurchase) || 0;
    const warrantyExpiresAt = typeof item.warrantyExpiresAt === 'string' ? item.warrantyExpiresAt : undefined;
    if (!warrantyMonths || !warrantyExpiresAt) {
      res.status(400).json({ error: 'This order item has no warranty on record' });
      return;
    }
    if (new Date(warrantyExpiresAt).getTime() <= Date.now()) {
      res.status(400).json({ error: 'Warranty has expired for this item — a claim can no longer be opened' });
      return;
    }

    const activeExisting = operationsStore.getActiveWarrantyClaimForItem(orderItemId);
    if (activeExisting) {
      // Policy: at most one ACTIVE claim per order item — return the existing one rather than erroring hard.
      res.status(200).json({ success: true, data: activeExisting, reused: true });
      return;
    }

    // Seller/brand/product identity — re-resolved server-side from the real
    // product record, never trusted from the order item or client body.
    const productId = String(item.productId || '').trim();
    let sellerId = String(sub.sellerId || '').trim();
    let brandId = '';
    if (productId) {
      const product = await catalogStore.getProduct(productId);
      if (product) {
        brandId = product.brandId;
        sellerId = product.sellerId || sellerId;
      }
    }
    if (!sellerId) {
      res.status(400).json({ error: 'Could not resolve the seller for this order item' });
      return;
    }

    const saved = operationsStore.createWarrantyClaim({
      orderId,
      orderItemId,
      consumerId: req.userId,
      sellerId,
      brandId,
      productId,
      warrantyMonthsAtPurchase: warrantyMonths,
      warrantyTypeAtPurchase: typeof item.warrantyTypeAtPurchase === 'string' ? item.warrantyTypeAtPurchase : undefined,
      warrantyProviderAtPurchase:
        typeof item.warrantyProviderAtPurchase === 'string' ? item.warrantyProviderAtPurchase : undefined,
      warrantyTermsSnapshot: typeof item.warrantyTermsSnapshot === 'string' ? item.warrantyTermsSnapshot : undefined,
      warrantyStartsAt: typeof item.warrantyStartsAt === 'string' ? item.warrantyStartsAt : undefined,
      warrantyExpiresAt,
      issueType: issueType as OpsWarrantyClaim['issueType'],
      description,
      attachmentMediaIds,
      attachmentCategories: Object.keys(attachmentCategories).length ? attachmentCategories : undefined,
      status: 'submitted',
    });
    scheduleOperationsPersist();

    // Canonical WC-##### display id — never generated on the frontend.
    let savedWithRef = saved;
    try {
      const referenceId = await ensureEntityReferenceId({
        entityType: 'warrantyClaim',
        internalId: saved.id,
        current: saved.referenceId,
      });
      savedWithRef = operationsStore.updateWarrantyClaim(saved.id, { referenceId }) || saved;
      scheduleOperationsPersist();
    } catch (err) {
      Logger.warn('warranty claim: failed to assign reference id', {
        claimId: saved.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Link attachments to this claim via the canonical media polymorphic association.
    if (attachmentMediaIds.length) {
      try {
        const { linkMediaToEntity } = await import('./media/mediaRepository');
        await Promise.all(
          attachmentMediaIds.map((id) =>
            linkMediaToEntity(id, 'warranty_claim', saved.id).catch(() => undefined),
          ),
        );
      } catch {
        /* linking is best-effort; the claim itself is already saved */
      }
    }

    // Idempotent claim/support conversation — never duplicated for the same claim.
    let claimConversationId: string | undefined;
    try {
      const { ensureClaimConversation } = await import('./messaging/conversations/conversationService');
      const { conversation } = await ensureClaimConversation({
        claimId: saved.id,
        orderId,
        consumerId: req.userId,
        sellerId,
        brandId,
        actor: req.userId,
      });
      claimConversationId = conversation.id;
      operationsStore.updateWarrantyClaim(saved.id, { conversationId: conversation.id });
      scheduleOperationsPersist();
    } catch (err) {
      Logger.warn('warranty claim: failed to ensure conversation', {
        claimId: saved.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await notifyUser(sellerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'seller',
        eventKey: 'warranty.update',
        persona: 'seller',
        title: 'New warranty claim',
        summary: `${String(item.productTitle || 'An item')} from order ${orderId} — ${issueType.replace(/_/g, ' ')}.`,
        actionUrl: `/admin/warranty-claims/${encodeURIComponent(savedWithRef.referenceId || savedWithRef.id)}`,
        metadata: { orderId, claimId: saved.id, referenceId: savedWithRef.referenceId },
      });
    } catch (err) {
      console.warn('[Warranty] Notify seller (new claim) failed:', err);
    }

    res.status(201).json({ success: true, data: operationsStore.getWarrantyClaim(saved.id) || saved });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit warranty claim' });
  }
});

/** Seller/staff: acknowledge receipt of the claim. */
operationsRouter.patch('/operations/warranty-claims/:id/acknowledge', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to acknowledge this warranty claim' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'acknowledged');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    timeline: appendWarrantyClaimTimeline(existing, { status: 'acknowledged', by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

/** Seller/staff: request more info from the consumer. */
operationsRouter.patch('/operations/warranty-claims/:id/request-info', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this warranty claim' });
    return;
  }
  const sellerResponse = String(req.body?.sellerResponse || '').trim();
  if (!sellerResponse) {
    res.status(400).json({ error: 'sellerResponse is required' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'more_info_required');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'more_info_required',
    sellerResponse,
    timeline: appendWarrantyClaimTimeline(existing, {
      status: 'more_info_required',
      note: sellerResponse,
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'warranty.update',
      persona: 'consumer',
      title: 'More information needed for your warranty claim',
      summary: sellerResponse,
      actionUrl: '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (more info required) failed:', err);
  }
  res.json({ success: true, data: saved });
});

/** Consumer: provide the requested info (does not change status by itself — seller/staff moves it forward). */
operationsRouter.patch('/operations/warranty-claims/:id/provide-info', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!req.userId || existing.consumerId !== req.userId) {
    res.status(403).json({ error: 'Only the claim owner may provide additional info' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'submitted');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const additionalDescription = String(req.body?.description || '').trim();
  const additionalMediaIds = Array.isArray(req.body?.attachmentMediaIds)
    ? (req.body.attachmentMediaIds as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 12)
    : [];
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'submitted',
    description: additionalDescription ? `${existing.description}\n\n[Update] ${additionalDescription}` : existing.description,
    attachmentMediaIds: [...existing.attachmentMediaIds, ...additionalMediaIds],
    timeline: appendWarrantyClaimTimeline(existing, {
      status: 'submitted',
      note: additionalDescription ? `Buyer provided additional information: ${additionalDescription}` : 'Buyer provided additional information.',
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

/** Seller/staff: approve the claim. */
operationsRouter.patch('/operations/warranty-claims/:id/approve', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to approve this warranty claim' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'approved');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const sellerResponse = typeof req.body?.sellerResponse === 'string' ? req.body.sellerResponse.trim() : undefined;
  const estimatedCompletionDate =
    typeof req.body?.estimatedCompletionDate === 'string' && req.body.estimatedCompletionDate.trim()
      ? req.body.estimatedCompletionDate.trim()
      : undefined;
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'approved',
    ...(sellerResponse ? { sellerResponse } : {}),
    ...(estimatedCompletionDate ? { estimatedCompletionDate } : {}),
    timeline: appendWarrantyClaimTimeline(existing, { status: 'approved', note: sellerResponse, by: req.userId }),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'warranty.update',
      persona: 'consumer',
      title: 'Warranty claim approved',
      summary: `Your warranty claim for order ${existing.orderId} was approved.`,
      actionUrl: existing.conversationId ? `/messages/${existing.conversationId}` : '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (approved) failed:', err);
  }
  res.json({ success: true, data: saved });
});

/** Seller/staff: reject the claim. */
operationsRouter.patch('/operations/warranty-claims/:id/reject', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to reject this warranty claim' });
    return;
  }
  const sellerResponse = String(req.body?.sellerResponse || '').trim();
  if (!sellerResponse) {
    res.status(400).json({ error: 'sellerResponse (rejection reason) is required' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'rejected');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'rejected',
    sellerResponse,
    resolutionType: 'rejected',
    resolvedAt: new Date().toISOString(),
    timeline: appendWarrantyClaimTimeline(existing, { status: 'rejected', note: sellerResponse, by: req.userId }),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'warranty.update',
      persona: 'consumer',
      title: 'Warranty claim rejected',
      summary: `Your warranty claim for order ${existing.orderId} was rejected: ${sellerResponse}`,
      actionUrl: existing.conversationId ? `/messages/${existing.conversationId}` : '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (rejected) failed:', err);
  }
  res.json({ success: true, data: saved });
});

/** Seller/staff: mark service in progress, optionally setting the initial service stage. */
operationsRouter.patch('/operations/warranty-claims/:id/service-status', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this warranty claim' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'service_in_progress');
  if (existing.status !== 'service_in_progress' && transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }
  const serviceStage =
    typeof req.body?.serviceStage === 'string' && WARRANTY_SERVICE_STAGES.has(req.body.serviceStage as OpsWarrantyClaimServiceStage)
      ? (req.body.serviceStage as OpsWarrantyClaimServiceStage)
      : existing.serviceStage;
  const estimatedCompletionDate =
    typeof req.body?.estimatedCompletionDate === 'string' && req.body.estimatedCompletionDate.trim()
      ? req.body.estimatedCompletionDate.trim()
      : existing.estimatedCompletionDate;
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'service_in_progress',
    ...(serviceStage ? { serviceStage } : {}),
    ...(estimatedCompletionDate ? { estimatedCompletionDate } : {}),
    timeline: appendWarrantyClaimTimeline(existing, {
      status: 'service_in_progress',
      serviceStage,
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

/** Seller/staff: advance the service stage within an in-progress claim — validated as forward-only. */
operationsRouter.patch('/operations/warranty-claims/:id/service-stage', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this warranty claim' });
    return;
  }
  if (existing.status !== 'service_in_progress') {
    res.status(400).json({ error: `Cannot set a service stage on a claim in status "${existing.status}"` });
    return;
  }
  const nextStage = String(req.body?.serviceStage || '');
  if (!WARRANTY_SERVICE_STAGES.has(nextStage as OpsWarrantyClaimServiceStage)) {
    res.status(400).json({ error: 'Invalid serviceStage' });
    return;
  }
  const currentTier = existing.serviceStage ? warrantyServiceStageTier(existing.serviceStage) : -1;
  const nextTier = warrantyServiceStageTier(nextStage as OpsWarrantyClaimServiceStage);
  if (nextTier < currentTier) {
    res.status(400).json({ error: `Cannot move the service stage backward from "${existing.serviceStage}" to "${nextStage}".` });
    return;
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const estimatedCompletionDate =
    typeof req.body?.estimatedCompletionDate === 'string' && req.body.estimatedCompletionDate.trim()
      ? req.body.estimatedCompletionDate.trim()
      : existing.estimatedCompletionDate;
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    serviceStage: nextStage as OpsWarrantyClaimServiceStage,
    ...(estimatedCompletionDate ? { estimatedCompletionDate } : {}),
    timeline: appendWarrantyClaimTimeline(existing, {
      status: 'service_in_progress',
      serviceStage: nextStage as OpsWarrantyClaimServiceStage,
      note,
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'warranty.update',
      persona: 'consumer',
      title: `Warranty claim update: ${nextStage.replace(/_/g, ' ')}`,
      summary: note || `Your warranty claim for order ${existing.orderId} moved to "${nextStage.replace(/_/g, ' ')}".`,
      actionUrl: '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (service stage) failed:', err);
  }
  res.json({ success: true, data: saved });
});

/** Seller/staff: resolve the claim. */
operationsRouter.patch('/operations/warranty-claims/:id/resolve', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to resolve this warranty claim' });
    return;
  }
  // Once escalated to dispute, only staff decide the outcome — mirrors the
  // same override rule on Returns.
  if (existing.status === 'disputed' && !userIsStaff(req)) {
    res.status(403).json({ error: 'This claim is under dispute — only staff can decide the outcome.' });
    return;
  }
  const resolutionNotes = String(req.body?.resolutionNotes || '').trim();
  if (!resolutionNotes) {
    res.status(400).json({ error: 'resolutionNotes is required' });
    return;
  }
  const WARRANTY_RESOLUTION_TYPES = new Set(['repaired', 'replaced', 'refunded', 'no_fault_found', 'other']);
  const resolutionType = String(req.body?.resolutionType || '').trim();
  if (!WARRANTY_RESOLUTION_TYPES.has(resolutionType)) {
    res.status(400).json({ error: 'resolutionType is required (repaired, replaced, refunded, no_fault_found, or other)' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'resolved');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }

  // A warranty "refund" resolution must move money through the SAME
  // canonical engine as Returns & Refunds — never a second refund path.
  // STAFF-ONLY, same rule as Returns: the seller may resolve a claim as
  // repaired/replaced/rejected/no_fault_found, but the actual payout is
  // always dispatched by Choosify staff, never the seller directly.
  let warrantyRefund: Awaited<ReturnType<typeof processEscrowRefund>> | undefined;
  if (resolutionType === 'refunded') {
    if (!userIsStaff(req)) {
      res.status(403).json({ error: 'Only Choosify staff can process a refund payout.' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const refundAmount = Number(req.body?.refundAmount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      res.status(400).json({ error: 'refundAmount is required and must be greater than 0 when resolutionType is "refunded"' });
      return;
    }
    try {
      const escrows = await escrowStore.listEscrowsByOrder(existing.orderId);
      const escrow = escrows.find((e) => e.sellerId === existing.sellerId) || escrows[0];
      if (!escrow) {
        res.status(409).json({ error: 'No escrow found for this order — cannot process a real refund.' });
        return;
      }
      warrantyRefund = await processEscrowRefund({
        escrowId: escrow.escrowId,
        amount: refundAmount,
        reason: `warranty_claim_refund:${existing.id}`,
        actor: { userId: req.userId, role: req.userRole },
      });
    } catch (error) {
      res.status(error instanceof CommerceError ? error.statusCode || 409 : 500).json({
        error: error instanceof Error ? error.message : 'Failed to process warranty refund',
      });
      return;
    }
  }

  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'resolved',
    resolutionNotes,
    resolutionType: resolutionType as OpsWarrantyClaim['resolutionType'],
    resolvedAt: new Date().toISOString(),
    timeline: appendWarrantyClaimTimeline(existing, {
      status: 'resolved',
      note: warrantyRefund
        ? `${resolutionNotes} (Refund ${warrantyRefund.refundReferenceId || warrantyRefund.refundId}, ${warrantyRefund.amount} ${warrantyRefund.currency})`
        : resolutionNotes,
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      eventKey: 'warranty.update',
      persona: 'consumer',
      title: 'Warranty claim resolved',
      summary: `Your warranty claim for order ${existing.orderId} was resolved (${resolutionType.replace(/_/g, ' ')}): ${resolutionNotes}`,
      actionUrl: existing.conversationId ? `/messages/${existing.conversationId}` : '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (resolved) failed:', err);
  }
  res.json({ success: true, data: saved, refund: warrantyRefund });
});

/** Consumer: cancel own claim (only while it hasn't reached a terminal/service state). */
operationsRouter.patch('/operations/warranty-claims/:id/cancel', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!req.userId || existing.consumerId !== req.userId) {
    res.status(403).json({ error: 'Only the claim owner may cancel this claim' });
    return;
  }
  const CANCELLABLE = new Set(['submitted', 'acknowledged', 'more_info_required']);
  if (!CANCELLABLE.has(existing.status)) {
    res.status(400).json({ error: `Cannot cancel a claim in status "${existing.status}"` });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    timeline: appendWarrantyClaimTimeline(existing, { status: 'cancelled', by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/warranty-claims/:id/dispute', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to escalate this warranty claim' });
    return;
  }
  const transitionError = assertWarrantyClaimTransition(existing.status, 'disputed');
  if (transitionError) {
    res.status(400).json({ error: transitionError });
    return;
  }

  let dispute = operationsStore.getActiveDisputeForSource('warranty_claim', existing.id);
  if (!dispute) {
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : `Warranty claim ${existing.id} escalated to dispute`;
    dispute = operationsStore.createDispute({
      sourceType: 'warranty_claim',
      sourceId: existing.id,
      orderId: existing.orderId,
      buyerId: existing.consumerId,
      sellerId: existing.sellerId,
      reason,
    });
  }

  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'disputed',
    disputeId: dispute.id,
    timeline: appendWarrantyClaimTimeline(existing, { status: 'disputed', note: `Escalated to dispute ${dispute.id}`, by: req.userId }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved, dispute });
});

/**
 * Seller/staff: add a customer-visible status note WITHOUT changing status
 * (e.g. "Inspection may take up to 15 days after we receive the product.").
 * Optionally also sets/updates the estimated completion date in the same call.
 */
operationsRouter.patch('/operations/warranty-claims/:id/note', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this warranty claim' });
    return;
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const estimatedCompletionDate =
    typeof req.body?.estimatedCompletionDate === 'string' && req.body.estimatedCompletionDate.trim()
      ? req.body.estimatedCompletionDate.trim()
      : undefined;
  if (!note && !estimatedCompletionDate) {
    res.status(400).json({ error: 'note or estimatedCompletionDate is required' });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    ...(note ? { sellerResponse: note } : {}),
    ...(estimatedCompletionDate ? { estimatedCompletionDate } : {}),
    timeline: appendWarrantyClaimTimeline(existing, {
      status: existing.status,
      serviceStage: existing.serviceStage,
      note: note || undefined,
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  if (note) {
    try {
      await notifyUser(existing.consumerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'buyer',
        eventKey: 'warranty.update',
        persona: 'consumer',
        title: 'Update on your warranty claim',
        summary: note,
        actionUrl: '/dashboard?tab=my-warranty',
        metadata: { orderId: existing.orderId, claimId: existing.id },
      });
    } catch (err) {
      console.warn('[Warranty] Notify buyer (note) failed:', err);
    }
  }
  res.json({ success: true, data: saved });
});

/** Seller/staff/admin: internal note — NEVER returned to the consumer under any circumstance. */
operationsRouter.patch('/operations/warranty-claims/:id/internal-note', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this warranty claim' });
    return;
  }
  const note = String(req.body?.note || '').trim();
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    internalNotes: [
      ...(existing.internalNotes || []),
      { id: `in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, note, by: req.userId || 'unknown', at: new Date().toISOString() },
    ],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

/**
 * Warranty return-pickup / redelivery shipments — reuse the existing
 * Courier/Order Hub shipment model (shipmentStore), but as a shipment
 * referencing this claim + the original Order ID, never a new commercial
 * order. See shipmentStore.createForWarrantyClaim.
 */
operationsRouter.post('/operations/warranty-claims/:id/shipments', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  if (!userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to create logistics for this warranty claim' });
    return;
  }
  const direction = req.body?.direction === 'redelivery' ? 'redelivery' : 'return_pickup';
  const order = operationsStore.getOrder(existing.orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const shipment = shipmentStore.createForWarrantyClaim({
    claimId: existing.id,
    orderId: existing.orderId,
    buyerId: existing.consumerId,
    direction,
    recipientName: order.shipping?.fullName || existing.consumerId,
    recipientPhone: order.shipping?.phone || '',
    deliveryAddress: order.shipping?.address || '',
    region: order.shipping?.region || 'Dhaka',
  });
  const stage = direction === 'return_pickup' ? 'return_requested' : 'ready_for_dispatch';
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    timeline: appendWarrantyClaimTimeline(existing, {
      status: existing.status,
      serviceStage: stage as OpsWarrantyClaimServiceStage,
      note: direction === 'return_pickup' ? 'Return pickup requested.' : 'Redelivery scheduled.',
      by: req.userId,
    }),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: { shipment, claim: saved } });
});

/** Visible to the claim owner (buyer), the seller who manages it, or staff. */
operationsRouter.get('/operations/warranty-claims/:id/shipments', ...requireAuth, (req, res) => {
  const existing = operationsStore.getWarrantyClaim(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Warranty claim not found' });
    return;
  }
  const isConsumer = Boolean(req.userId && existing.consumerId === req.userId);
  if (!isConsumer && !userCanManageWarrantyClaim(req, existing)) {
    res.status(403).json({ error: 'Not authorized to view this warranty claim\'s logistics' });
    return;
  }
  res.json({ data: shipmentStore.getShipmentsByWarrantyClaimId(existing.id) });
});

// ─── Disputes ────────────────────────────────────────────────────────────────
// The escalation/adjudication layer -- NOT a duplicate of Returns, Warranty
// Claims, or Orders Hub. A dispute always references its source case by id
// (sourceType + sourceId); the source's own canonical record remains the
// source of truth for order/return/warranty data. Any refund a decision
// implies must still go through the canonical Returns & Refunds finance
// engine (PATCH /operations/returns/:id/refund) -- deciding a dispute here
// never moves money on its own.

function userIsDisputeParty(
  req: { userId?: string },
  row: OpsDispute,
): boolean {
  return Boolean(req.userId && (row.buyerId === req.userId || row.sellerId === req.userId));
}

function userCanViewDispute(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  row: OpsDispute,
): boolean {
  return userIsStaff(req) || userIsDisputeParty(req, row);
}

async function resolveDisputeSource(
  sourceType: OpsDisputeSourceType,
  sourceId: string,
  /** Required only for sourceType "order" -- a single order can span multiple sellers' sub-orders, so the caller must say which one this dispute concerns. */
  explicitSellerId?: string,
): Promise<{ orderId: string; buyerId: string; sellerId: string } | null> {
  if (sourceType === 'return') {
    const ret = operationsStore.getReturn(sourceId);
    if (!ret) return null;
    return { orderId: ret.orderId, buyerId: ret.buyerId, sellerId: ret.sellerId };
  }
  if (sourceType === 'warranty_claim') {
    const claim = operationsStore.getWarrantyClaim(sourceId);
    if (!claim) return null;
    return { orderId: claim.orderId, buyerId: claim.consumerId, sellerId: claim.sellerId };
  }
  // sourceType === 'order' -- orders don't carry a single top-level sellerId (see subOrders), so it must be supplied explicitly.
  const order = operationsStore.getOrder(sourceId);
  if (!order || !explicitSellerId) return null;
  return { orderId: order.orderId, buyerId: order.buyerId, sellerId: explicitSellerId };
}

operationsRouter.get('/operations/disputes', ...requireAuth, (req, res) => {
  const filter: { buyerId?: string; sellerId?: string; orderId?: string; status?: OpsDisputeStatus; sourceType?: OpsDisputeSourceType } = {};

  if (!userIsStaff(req)) {
    // Sellers/buyers only ever see their own disputes -- never the platform-wide queue.
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    filter.sellerId = req.userId;
  } else {
    if (typeof req.query.sellerId === 'string') filter.sellerId = req.query.sellerId;
    if (typeof req.query.buyerId === 'string') filter.buyerId = req.query.buyerId;
  }
  if (typeof req.query.orderId === 'string') filter.orderId = req.query.orderId;
  if (typeof req.query.status === 'string') filter.status = req.query.status as OpsDisputeStatus;
  if (typeof req.query.sourceType === 'string') filter.sourceType = req.query.sourceType as OpsDisputeSourceType;

  res.json({ data: operationsStore.listDisputes(filter) });
});

operationsRouter.get('/operations/disputes/:id', ...requireAuth, (req, res) => {
  const existing = operationsStore.getDispute(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }
  if (!userCanViewDispute(req, existing)) {
    res.status(403).json({ error: 'Not authorized to view this dispute' });
    return;
  }
  res.json({ data: existing });
});

operationsRouter.post('/operations/disputes', ...requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const sourceType = body.sourceType as OpsDisputeSourceType;
  const sourceId = String(body.sourceId || '').trim();
  const reason = String(body.reason || '').trim();

  if (!['return', 'warranty_claim', 'order'].includes(sourceType)) {
    res.status(400).json({ error: 'A valid sourceType (return | warranty_claim | order) is required' });
    return;
  }
  if (!sourceId) {
    res.status(400).json({ error: 'sourceId is required' });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const explicitSellerId = typeof body.sellerId === 'string' ? body.sellerId.trim() : undefined;
  const source = await resolveDisputeSource(sourceType, sourceId, explicitSellerId);
  if (!source) {
    res.status(404).json({
      error:
        sourceType === 'order' && !explicitSellerId
          ? 'sellerId is required when raising a dispute against an order (a single order can span multiple sellers)'
          : `${sourceType} "${sourceId}" was not found -- disputes must reference a real case`,
    });
    return;
  }

  if (!userIsStaff(req) && req.userId !== source.buyerId && req.userId !== source.sellerId) {
    res.status(403).json({ error: 'Only the buyer, seller, or staff may raise a dispute on this case' });
    return;
  }

  const alreadyOpen = operationsStore.getActiveDisputeForSource(sourceType, sourceId);
  if (alreadyOpen) {
    res.json({ success: true, data: alreadyOpen, alreadyExisted: true });
    return;
  }

  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : undefined;
  const buyerStatement = req.userId === source.buyerId ? String(body.statement || '').trim() || undefined : undefined;
  const sellerStatement = req.userId === source.sellerId ? String(body.statement || '').trim() || undefined : undefined;

  const created = operationsStore.createDispute({
    sourceType,
    sourceId,
    orderId: source.orderId,
    buyerId: source.buyerId,
    sellerId: source.sellerId,
    reason,
    amount,
    buyerStatement,
    sellerStatement,
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: created });
});

operationsRouter.patch('/operations/disputes/:id/status', ...requireAuth, (req, res) => {
  const existing = operationsStore.getDispute(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Only staff may change a dispute\'s workflow status' });
    return;
  }
  const toStatus = req.body?.status as OpsDisputeStatus;
  const updated = operationsStore.transitionDispute(req.params.id, toStatus, {
    actorId: req.userId,
    actorRole: req.userRole,
    text: typeof req.body?.note === 'string' ? req.body.note : undefined,
  });
  if (!updated) {
    res.status(400).json({ error: `Cannot move a dispute from "${existing.status}" to "${toStatus}"` });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: updated });
});

operationsRouter.post('/operations/disputes/:id/evidence', ...requireAuth, (req, res) => {
  const existing = operationsStore.getDispute(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }
  if (!userCanViewDispute(req, existing)) {
    res.status(403).json({ error: 'Not authorized to add evidence to this dispute' });
    return;
  }
  const description = String(req.body?.description || '').trim();
  if (!description) {
    res.status(400).json({ error: 'description is required' });
    return;
  }
  const submittedBy: 'buyer' | 'seller' | 'admin' = userIsStaff(req)
    ? 'admin'
    : req.userId === existing.buyerId
      ? 'buyer'
      : 'seller';
  const updated = operationsStore.addDisputeEvidence(req.params.id, {
    submittedBy,
    submittedByUserId: req.userId,
    description,
    mediaUrl: typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl : undefined,
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: updated });
});

operationsRouter.post('/operations/disputes/:id/notes', ...requireAuth, (req, res) => {
  const existing = operationsStore.getDispute(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Only staff may add internal notes' });
    return;
  }
  const note = String(req.body?.note || '').trim();
  if (!note) {
    res.status(400).json({ error: 'note is required' });
    return;
  }
  const updated = operationsStore.addDisputeAdminNote(req.params.id, note, req.userId);
  scheduleOperationsPersist();
  res.json({ success: true, data: updated });
});

const DISPUTE_DECISIONS = new Set(['uphold_seller', 'uphold_buyer', 'partial', 'refund_approved', 'replacement', 'dismissed']);

operationsRouter.post('/operations/disputes/:id/decision', ...requireAdmin, (req, res) => {
  const existing = operationsStore.getDispute(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Dispute not found' });
    return;
  }
  if (!OPEN_DISPUTE_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `Dispute is already "${existing.status}"; it cannot be decided again.` });
    return;
  }
  const decision = req.body?.decision as OpsDisputeDecision;
  if (!DISPUTE_DECISIONS.has(decision)) {
    res.status(400).json({ error: 'A valid decision is required' });
    return;
  }
  const decisionNotes = typeof req.body?.decisionNotes === 'string' ? req.body.decisionNotes : undefined;
  const updated = operationsStore.decideDispute(req.params.id, decision, decisionNotes, req.userId);
  scheduleOperationsPersist();
  res.json({
    success: true,
    data: updated,
    // Deliberately no automatic financial side effect -- see module comment.
    note:
      decision === 'refund_approved'
        ? 'This records the adjudication decision only. Process the actual refund via Returns & Refunds using the canonical refund flow.'
        : undefined,
  });
});

// The full coupon dataset (incl. usage/redemption totals) is for coupon
// managers only — same roles as create/update/delete. The public storefront
// uses GET /catalog/storefront/coupons (eligible coupons, public-safe fields).
operationsRouter.get('/operations/coupons', ...requireAuth, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: 'Not authorized to list coupons' });
    return;
  }
  res.json({ data: operationsStore.listCoupons() });
});

operationsRouter.post('/operations/coupons', ...requireAuth, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: 'Not authorized to create coupons' });
    return;
  }
  const body = req.body as Partial<OpsCoupon>;
  if (!body.code?.trim()) {
    res.status(400).json({ error: 'Coupon code is required' });
    return;
  }
  const existing = operationsStore.getCouponByCode(body.code);
  if (existing && existing.id !== body.id) {
    res.status(409).json({ error: 'Coupon code already exists' });
    return;
  }
  const saved = operationsStore.upsertCoupon({
    id: body.id || `coup_${Date.now()}`,
    code: body.code.toUpperCase().trim(),
    type: body.type || 'percentage',
    discountTarget: body.discountTarget || 'all_products',
    discountValue: Number(body.discountValue || 0),
    validFrom: body.validFrom || new Date().toISOString().slice(0, 10),
    validUntil: body.validUntil || '2026-12-31',
    active: body.active ?? true,
    rules: body.rules || {},
    description: body.description || '',
    totalUsages: body.totalUsages ?? 0,
    totalRedemptions: body.totalRedemptions ?? 0,
    totalDiscountGiven: body.totalDiscountGiven ?? 0,
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/coupons/:id', ...requireAuth, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: 'Not authorized to update coupons' });
    return;
  }
  const existing = operationsStore.getCoupon(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Coupon not found' });
    return;
  }
  const saved = operationsStore.upsertCoupon({ ...existing, ...req.body, id: existing.id });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/coupons/:id', ...requireAuth, (req, res) => {
  if (!userCanManageCoupons(req)) {
    res.status(403).json({ error: 'Not authorized to delete coupons' });
    return;
  }
  const ok = operationsStore.deleteCoupon(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Coupon not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});

operationsRouter.get('/operations/fee-charges', (_req, res) => {
  res.json({ data: operationsStore.listFeeCharges() });
});

operationsRouter.post('/operations/fee-charges', ...requireAdmin, (req, res) => {
  const body = req.body as Partial<OpsFeeCharge>;
  if (!body.name?.trim()) {
    res.status(400).json({ error: 'Fee/charge name is required' });
    return;
  }
  const saved = operationsStore.upsertFeeCharge({
    id: body.id || `fee_${Date.now()}`,
    name: body.name.trim(),
    type: body.type || 'platform_fee',
    rateType: body.rateType || 'percentage',
    rateValue: Number(body.rateValue || 0),
    scopeType: body.scopeType || 'platform',
    scopeBrandIds: body.scopeBrandIds || [],
    scopeCategoryIds: body.scopeCategoryIds || [],
    scopeProductIds: body.scopeProductIds || [],
    active: body.active ?? true,
    description: body.description || '',
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/fee-charges/:id', ...requireAdmin, (req, res) => {
  const existing = operationsStore.getFeeCharge(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Fee/charge rule not found' });
    return;
  }
  const saved = operationsStore.upsertFeeCharge({ ...existing, ...req.body, id: existing.id });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/fee-charges/:id', ...requireAdmin, (req, res) => {
  const ok = operationsStore.deleteFeeCharge(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Fee/charge rule not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});

operationsRouter.get('/operations/payment-options', (_req, res) => {
  res.json({ data: operationsStore.getPaymentOptionsConfig() });
});

/** Platform-wide partial-payment config (not per-seller). */
operationsRouter.put('/operations/payment-options', ...requireAdmin, (req, res) => {
  const body = req.body as Partial<{ partialPaymentEnabled: boolean; minDepositPercent: number; maxDepositPercent: number }>;
  if (
    body.minDepositPercent !== undefined &&
    body.maxDepositPercent !== undefined &&
    Number(body.minDepositPercent) > Number(body.maxDepositPercent)
  ) {
    res.status(400).json({ error: 'Minimum deposit percent cannot exceed maximum deposit percent' });
    return;
  }
  const saved = operationsStore.updatePaymentOptionsConfig({
    ...(body.partialPaymentEnabled !== undefined && { partialPaymentEnabled: body.partialPaymentEnabled }),
    ...(body.minDepositPercent !== undefined && { minDepositPercent: Number(body.minDepositPercent) }),
    ...(body.maxDepositPercent !== undefined && { maxDepositPercent: Number(body.maxDepositPercent) }),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.post(
  '/operations/coupons/validate',
  validate({ body: CouponValidateBodySchema }),
  (req, res) => {
  const { code, cartTotal, userId, cartItems } = req.body;
  const coupon = operationsStore.getCouponByCode(code.trim());
  if (!coupon) {
    res.json({ valid: false, discount: 0, reason: 'Invalid or expired promo code.' });
    return;
  }
  const userUsageCount = userId ? operationsStore.countCouponUsageForUser(coupon.id, userId) : 0;
  const result = validateCoupon(coupon, Number(cartTotal || 0), userId, cartItems, userUsageCount);
  res.json(result);
  },
);

// ── Marketplace Access history (brand marketplaceStatus / creator publish status decisions) ──
// ---------------------------------------------------------------------------
// Shopper signals — saved products / brands, followed creators, recent searches
// ---------------------------------------------------------------------------

const SIGNAL_LISTS = ['savedProducts', 'savedBrands', 'followedCreators'] as const;
type SignalList = (typeof SIGNAL_LISTS)[number];
const SIGNAL_LIST_MAX = 200;
const SEARCH_HISTORY_MAX = 50;
const SIGNAL_STAFF_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SUPPORT_AGENT, ROLES.MODERATOR];

function emptySignals(userId: string): import('./operations/types').OpsShopperSignals {
  return { userId, savedProducts: [], savedBrands: [], followedCreators: [], searches: [], updatedAt: new Date().toISOString() };
}

operationsRouter.get('/operations/shopper-signals/me', ...requireAuth, (req, res) => {
  res.json({ success: true, data: operationsStore.getShopperSignals(req.userId!) || emptySignals(req.userId!) });
});

/** Replace one list with the storefront's current set (keeps the original saved date per id). */
operationsRouter.put('/operations/shopper-signals/me/:list', ...requireAuth, (req, res) => {
  const list = req.params.list as SignalList;
  if (!SIGNAL_LISTS.includes(list)) {
    res.status(400).json({ error: `list must be one of: ${SIGNAL_LISTS.join(', ')}` });
    return;
  }
  const raw = Array.isArray(req.body?.items) ? (req.body.items as unknown[]) : null;
  if (!raw) {
    res.status(400).json({ error: 'items[] is required' });
    return;
  }
  const current = operationsStore.getShopperSignals(req.userId!) || emptySignals(req.userId!);
  const prevAt = new Map(current[list].map((x) => [x.id, x.at]));
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const items: import('./operations/types').OpsShopperSignalItem[] = [];
  for (const entry of raw) {
    const e = (entry || {}) as Record<string, unknown>;
    const id = String(e.id ?? '').trim().slice(0, 120);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const image = typeof e.image === 'string' && /^(https?:\/\/|\/)/.test(e.image) ? e.image.slice(0, 500) : undefined;
    items.push({ id, label: String(e.label ?? id).trim().slice(0, 160) || id, ...(image ? { image } : {}), at: prevAt.get(id) || now });
    if (items.length >= SIGNAL_LIST_MAX) break;
  }
  const saved = operationsStore.saveShopperSignals({ ...current, [list]: items, updatedAt: now });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/shopper-signals/me/searches', ...requireAuth, (req, res) => {
  const q = String(req.body?.q ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (q.length < 2) {
    res.status(400).json({ error: 'q must be at least 2 characters' });
    return;
  }
  const current = operationsStore.getShopperSignals(req.userId!) || emptySignals(req.userId!);
  const now = new Date().toISOString();
  // A repeated search moves to the top and counts how many times it was searched.
  const prev = current.searches.find((s) => s.q.toLowerCase() === q.toLowerCase());
  const count = (prev?.count || (prev ? 1 : 0)) + 1;
  const searches = [{ q, at: now, count }, ...current.searches.filter((s) => s !== prev)].slice(0, SEARCH_HISTORY_MAX);
  const saved = operationsStore.saveShopperSignals({ ...current, searches, updatedAt: now });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved.searches });
});

/** Remove one search (?q=) or clear the whole history. */
operationsRouter.delete('/operations/shopper-signals/me/searches', ...requireAuth, (req, res) => {
  const current = operationsStore.getShopperSignals(req.userId!) || emptySignals(req.userId!);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const searches = q ? current.searches.filter((s) => s.q.toLowerCase() !== q) : [];
  const saved = operationsStore.saveShopperSignals({ ...current, searches, updatedAt: new Date().toISOString() });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved.searches });
});

operationsRouter.get('/operations/shopper-signals/:userId', ...requireAuth, (req, res) => {
  if (!req.userRole || !SIGNAL_STAFF_ROLES.includes(req.userRole)) {
    res.status(403).json({ error: 'Not authorized to view this shopper’s activity' });
    return;
  }
  const userId = String(req.params.userId || '').trim();
  Logger.audit('shopper_signals.viewed', { actorId: req.userId, targetUserId: userId });
  res.json({ success: true, data: operationsStore.getShopperSignals(userId) || emptySignals(userId) });
});

// ---------------------------------------------------------------------------
// Account Activity Log — the account owner and Choosify staff
// ---------------------------------------------------------------------------

const ACTIVITY_STAFF_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SUPPORT_AGENT, ROLES.MODERATOR];

operationsRouter.get('/operations/account-activity/:userId', ...requireAuth, async (req, res) => {
  const target = req.params.userId === 'me' ? String(req.userId || '') : String(req.params.userId || '').trim();
  const isStaff = Boolean(req.userRole && ACTIVITY_STAFF_ROLES.includes(req.userRole)) && !req.realActorUserId;
  const isOwner = Boolean(req.userId && target === req.userId);
  if (!target || (!isOwner && !isStaff)) {
    res.status(403).json({ error: 'Not authorized to view this account’s activity' });
    return;
  }
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 200));
  const rows = operationsStore
    .listAccountActivity(target)
    .filter((a) => !category || a.category === category)
    .slice(0, limit);
  const staffView = isStaff && !isOwner;
  if (!staffView) {
    res.json({ success: true, data: rows.map(ownerView), staffView });
    return;
  }
  // Entries recorded during Login As carry only the staff id — resolve display names for staff.
  const missing = [...new Set(rows.filter((a) => a.staffActorId && !a.staffActorName).map((a) => a.staffActorId as string))];
  const names = new Map<string, string>();
  if (missing.length) {
    const found = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, missing)).catch(() => []);
    for (const u of found) if (u.displayName) names.set(u.id, u.displayName);
  }
  res.json({
    success: true,
    data: rows.map((a) => (a.staffActorId && !a.staffActorName && names.has(a.staffActorId) ? { ...a, staffActorName: names.get(a.staffActorId) } : a)),
    staffView,
  });
});

// ---------------------------------------------------------------------------
// Payout profile — how a Seller / Creator gets paid (bank and/or MFS wallets)
// ---------------------------------------------------------------------------

const PAYOUT_FULL_VIEW_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER];
const PAYOUT_STAFF_ROLES: string[] = [...PAYOUT_FULL_VIEW_ROLES, ROLES.SUPPORT_AGENT];
const PAYOUT_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function payoutRoleIn(req: { userRole?: string }, roles: readonly string[]): boolean {
  return Boolean(req.userRole && roles.includes(req.userRole));
}

function maskTail(value: string): string {
  const v = String(value || '');
  return v.length <= 4 ? v : `${'•'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

type PayoutChannel = { kind: 'bank' | 'mfs'; provider: string; accountName: string; number: string; extra?: string };

function payoutChannels(p: import('./operations/types').OpsPayoutProfile | null, masked = false): PayoutChannel[] {
  if (!p) return [];
  const num = (v: string) => (masked ? maskTail(v) : v);
  const out: PayoutChannel[] = [];
  if (p.accountNumber) {
    const extra = [p.branchName && `Branch: ${p.branchName}`, p.routingNumber && `Routing: ${masked ? '••••' : p.routingNumber}`].filter(Boolean).join(' · ');
    out.push({ kind: 'bank', provider: p.bankName, accountName: p.accountHolderName, number: num(p.accountNumber), extra: extra || undefined });
  }
  if (p.bkashNumber) out.push({ kind: 'mfs', provider: 'bKash', accountName: p.accountHolderName, number: num(p.bkashNumber) });
  if (p.nagadNumber) out.push({ kind: 'mfs', provider: 'Nagad', accountName: p.accountHolderName, number: num(p.nagadNumber) });
  if (p.rocketNumber) out.push({ kind: 'mfs', provider: 'Rocket', accountName: p.accountHolderName, number: num(p.rocketNumber) });
  return out;
}

const MFS_RE = /^01[3-9]\d{8}$/;
function cleanMfs(v: unknown): string {
  return String(v ?? '').replace(/[\s-]/g, '').replace(/^\+?88/, '');
}

operationsRouter.get('/operations/payout-profile/me', ...requireAuth, (req, res) => {
  const p = operationsStore.getPayoutProfile(req.userId!);
  res.json({ success: true, data: { profile: p, channels: payoutChannels(p), updatedAt: p?.updatedAt || null, masked: false } });
});

operationsRouter.put('/operations/payout-profile/me', ...requireAuth, (req, res) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const str = (k: string, max = 120) => String(b[k] ?? '').trim().slice(0, max);
  const accountNumber = str('accountNumber', 34).replace(/\s/g, '');
  const routingNumber = str('routingNumber', 12).replace(/\s/g, '');
  const bkashNumber = cleanMfs(b.bkashNumber);
  const nagadNumber = cleanMfs(b.nagadNumber);
  const rocketNumber = cleanMfs(b.rocketNumber);
  const accountHolderName = str('accountHolderName');
  const errors: string[] = [];
  if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) errors.push('Bank account number must be 6–20 digits.');
  if (routingNumber && !/^\d{9}$/.test(routingNumber)) errors.push('Routing number must be 9 digits.');
  for (const [label, v] of [['bKash', bkashNumber], ['Nagad', nagadNumber], ['Rocket', rocketNumber]] as const) {
    if (v && !MFS_RE.test(v)) errors.push(`${label} number must be an 11-digit Bangladeshi mobile number (01XXXXXXXXX).`);
  }
  if ((accountNumber || bkashNumber || nagadNumber || rocketNumber) && !accountHolderName) errors.push('Account holder name is required.');
  if (accountNumber && !str('bankName')) errors.push('Bank name is required for a bank account.');
  if (errors.length) {
    res.status(400).json({ error: errors.join(' '), errors });
    return;
  }
  const now = new Date().toISOString();
  const prev = operationsStore.getPayoutProfile(req.userId!);
  const saved = operationsStore.upsertPayoutProfile({
    userId: req.userId!,
    accountHolderName,
    bankName: accountNumber ? str('bankName') : '',
    accountNumber,
    routingNumber: accountNumber ? routingNumber : '',
    branchName: accountNumber ? str('branchName') : '',
    bkashNumber,
    nagadNumber,
    rocketNumber,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  });
  scheduleOperationsPersist();
  Logger.audit('payout_profile.updated', { actorId: req.userId, channels: payoutChannels(saved).map((c) => c.provider) });
  recordAccountActivity(req, {
    userId: req.userId!,
    type: 'payout_updated',
    category: 'account',
    summary: payoutChannels(saved).length ? `Payout details updated (${payoutChannels(saved).map((c) => c.provider).join(', ')})` : 'Payout details cleared',
  });
  res.json({ success: true, data: { profile: saved, channels: payoutChannels(saved), updatedAt: saved.updatedAt, masked: false } });
});

operationsRouter.get('/operations/payout-profile/:userId', ...requireAuth, (req, res) => {
  if (!payoutRoleIn(req, PAYOUT_STAFF_ROLES)) {
    res.status(403).json({ error: 'Not authorized to view payout details' });
    return;
  }
  const masked = !payoutRoleIn(req, PAYOUT_FULL_VIEW_ROLES);
  const p = operationsStore.getPayoutProfile(req.params.userId);
  res.json({
    success: true,
    data: { channels: payoutChannels(p, masked), updatedAt: p?.updatedAt || null, masked, reminders: operationsStore.listPayoutReminders(req.params.userId) },
  });
});

operationsRouter.post('/operations/payout-profile/:userId/reminders', ...requireAuth, async (req, res) => {
  if (!payoutRoleIn(req, PAYOUT_STAFF_ROLES)) {
    res.status(403).json({ error: 'Not authorized to send payout reminders' });
    return;
  }
  const userId = String(req.params.userId || '').trim();
  if (!userId || userId === req.userId) {
    res.status(400).json({ error: 'A different target user is required' });
    return;
  }
  if (payoutChannels(operationsStore.getPayoutProfile(userId)).length) {
    res.status(409).json({ error: 'This account already has a payout method.' });
    return;
  }
  const last = operationsStore.listPayoutReminders(userId)[0];
  if (last && Date.now() - Date.parse(last.at) < PAYOUT_REMINDER_COOLDOWN_MS) {
    res.status(429).json({ error: `A reminder was already sent at ${new Date(last.at).toLocaleString()}. You can send another 24 hours after that.` });
    return;
  }
  const reminder = operationsStore.addPayoutReminder({
    id: `prem_${randomUUID()}`,
    userId,
    actorId: req.userId!,
    actorName: req.user?.displayName,
    at: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  Logger.audit('payout_profile.reminder_sent', { actorId: req.userId, targetUserId: userId });
  recordAccountActivity(req, { userId, type: 'payout_reminder', category: 'admin', actor: 'staff', summary: 'Choosify staff sent a reminder to add payout details' });
  try {
    await notifyUser(userId, {
      type: COMMUNICATION_TYPES.SELLER_UPDATE,
      category: 'seller',
      eventKey: 'admin.direct',
      persona: 'seller',
      title: 'Add your payout details',
      summary: 'Choosify needs a bank account or mobile wallet (bKash / Nagad / Rocket) to send your payouts. Add it under Payouts → Payment Info.',
      actionUrl: '/admin/payouts?tab=payment-info',
      metadata: { reminderId: reminder.id },
    });
  } catch (err) {
    Logger.error('notifyUser failed (payout reminder)', { error: String(err) });
  }
  res.status(201).json({ success: true, data: reminder });
});

operationsRouter.get('/operations/marketplace-access-events', ...requireAuth, async (req, res) => {
  const entityType = req.query.entityType === 'brand' || req.query.entityType === 'creator' ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  const ownerUserId = typeof req.query.ownerUserId === 'string' ? req.query.ownerUserId : undefined;
  if (!userIsStaff(req)) {
    // Owners may read the history of their own brand / creator profile only.
    if (!req.userId) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    let owns = false;
    if (ownerUserId) owns = ownerUserId === req.userId;
    else if (entityType === 'brand' && entityId) owns = (await catalogStore.getBrand(entityId))?.sellerId === req.userId;
    else if (entityType === 'creator' && entityId) owns = (await catalogStore.getCreator(entityId))?.userId === req.userId;
    if (!owns) {
      res.status(403).json({ error: 'Not authorized to view this access history' });
      return;
    }
  }
  res.json({ data: operationsStore.listMarketplaceAccessEvents({ entityType, entityId, ownerUserId }) });
});

// ── Super Admin "Edit User" sessions (audit trail for acting on a user's account) ──
const ADMIN_EDIT_REASONS = new Set(['user_support_request', 'data_correction', 'compliance_review', 'fraud_investigation', 'other']);
const ADMIN_EDIT_SESSION_MS = 2 * 60 * 60 * 1000;

operationsRouter.get('/operations/admin-edit-sessions', ...requireAuth, (req, res) => {
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Not authorized to view edit sessions' });
    return;
  }
  const targetUserId = typeof req.query.targetUserId === 'string' ? req.query.targetUserId : undefined;
  res.json({ data: operationsStore.listAdminEditSessions({ targetUserId }) });
});

operationsRouter.post('/operations/admin-edit-sessions', ...requireAuth, (req, res) => {
  // Only a Super Admin may enter edit mode on someone else's account.
  if (!hasRole(req.userRole, ROLES.SUPER_ADMIN) || !req.userId) {
    res.status(403).json({ error: 'Only a Super Admin can enter edit mode on a user account' });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
  const targetRole = body.targetRole === 'consumer' || body.targetRole === 'seller' || body.targetRole === 'creator' ? body.targetRole : null;
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const reasonDetail = typeof body.reasonDetail === 'string' ? body.reasonDetail.trim().slice(0, 500) : '';
  if (!targetUserId || !targetRole) {
    res.status(400).json({ error: 'targetUserId and targetRole are required' });
    return;
  }
  if (targetUserId === req.userId) {
    res.status(400).json({ error: 'Edit mode is for acting on another user’s account' });
    return;
  }
  if (!ADMIN_EDIT_REASONS.has(reason)) {
    res.status(400).json({ error: 'Choose a reason for entering edit mode' });
    return;
  }
  if (reasonDetail.length < 10) {
    res.status(400).json({ error: 'Describe why you are editing this account (at least 10 characters)' });
    return;
  }
  if (body.confirmed !== true) {
    res.status(400).json({ error: 'Edit mode must be explicitly confirmed' });
    return;
  }
  const existing = operationsStore
    .listAdminEditSessions({ targetUserId, adminUserId: req.userId })
    .find((s) => !s.endedAt);
  if (existing) {
    res.json({ data: existing, reused: true });
    return;
  }
  const now = new Date();
  const session = operationsStore.createAdminEditSession({
    id: `aes_${randomUUID()}`,
    adminUserId: req.userId,
    adminName: req.user?.displayName || undefined,
    adminEmail: req.user?.email || undefined,
    targetUserId,
    targetRole,
    targetLabel: typeof body.targetLabel === 'string' ? body.targetLabel.slice(0, 120) : undefined,
    reason: reason as import('./operations/types').OpsAdminEditReason,
    reasonDetail,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ADMIN_EDIT_SESSION_MS).toISOString(),
  });
  recordAccountActivity(req, {
    userId: targetUserId,
    type: 'edit_session_started',
    category: 'admin',
    actor: 'staff',
    summary: 'Choosify staff opened an Edit User session on this account',
    staffNote: `Reason: ${session.reason} — ${session.reasonDetail}`,
  });
  Logger.audit('admin.edit_mode.start', {
    sessionId: session.id,
    adminUserId: session.adminUserId,
    targetUserId: session.targetUserId,
    targetRole: session.targetRole,
    reason: session.reason,
    reasonDetail: session.reasonDetail,
    startedAt: session.startedAt,
  });
  res.status(201).json({ data: session });
});

operationsRouter.post('/operations/admin-edit-sessions/:id/end', ...requireAuth, (req, res) => {
  if (!hasRole(req.userRole, ROLES.SUPER_ADMIN) || !req.userId) {
    res.status(403).json({ error: 'Only a Super Admin can end an edit session' });
    return;
  }
  const session = operationsStore.listAdminEditSessions().find((s) => s.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Edit session not found' });
    return;
  }
  const ended = operationsStore.endAdminEditSession(session.id, req.userId);
  recordAccountActivity(req, {
    userId: session.targetUserId,
    type: 'edit_session_ended',
    category: 'admin',
    actor: 'staff',
    summary: 'Choosify staff closed the Edit User session',
  });
  Logger.audit('admin.edit_mode.end', {
    sessionId: session.id,
    adminUserId: session.adminUserId,
    endedBy: req.userId,
    targetUserId: session.targetUserId,
    endedAt: ended?.endedAt,
    endReason: ended?.endReason,
  });
  res.json({ data: ended });
});

operationsRouter.get('/operations/reviews', ...requireAuth, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
  let userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;

  if (!userCanListReviews(req, { userId, sellerId })) {
    // Only silently self-scope when the caller asked for nothing specific --
    // an explicit (even if unauthorized) userId/sellerId must fail cleanly,
    // never be quietly reinterpreted as "show me my own reviews instead".
    if (
      !userId &&
      !sellerId &&
      req.userId &&
      !userIsStaff(req) &&
      !(req.userRole && hasRole(req.userRole, ROLES.MODERATOR))
    ) {
      userId = req.userId;
    }
    if (!userCanListReviews(req, { userId, sellerId })) {
      res.status(403).json({ error: 'Not authorized to list these reviews' });
      return;
    }
  }

  let reviews = operationsStore.listReviews({
    status: status || undefined,
    productId: productId || undefined,
    userId: userId || undefined,
  });

  // Sprint 11 (BUG-3-04): reviews don't carry sellerId directly, so a
  // seller-scoped request ("reviews on MY products") is resolved dynamically
  // via each review's product ownership. Cross-seller isolation: a seller's
  // own userId is the only value that can satisfy `sellerId === userId`
  // above, so this can never return another seller's reviews.
  if (sellerId) {
    const ownedFlags = await Promise.all(
      reviews.map(async (r) => {
        const product = await catalogStore.getProduct(r.productId).catch(() => null);
        return product?.sellerId === sellerId;
      }),
    );
    reviews = reviews.filter((_, i) => ownedFlags[i]);
  }

  res.json({ data: reviews });
});

operationsRouter.get('/operations/reviews/public', (req, res) => {
  const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
  const brandName = typeof req.query.brandName === 'string' ? req.query.brandName.trim() : '';
  if (!productId && !brandName) {
    res.status(400).json({ error: 'productId or brandName is required' });
    return;
  }
  const reviews = operationsStore
    .listReviews({
      productId: productId || undefined,
      brandName: brandName || undefined,
      status: 'published',
    })
    .map((review) => ({
      id: review.id,
      userName: review.userName,
      rating: review.rating,
      comment: review.comment,
      photos: review.photos || [],
      createdAt: review.createdAt,
      productId: review.productId,
      productTitle: review.productTitle,
      brandName: review.brandName,
      response: review.response,
    }));
  res.json({ data: reviews });
});

/**
 * Sprint 9 — review integrity fix. Previously this only checked "does the
 * user own ANY delivered order containing this productId" (via the now-
 * removed userHasPurchasedProductForReview), never recorded which order/
 * item the review was actually for, and had no duplicate check at all --
 * a buyer could submit unlimited reviews for the same delivered purchase.
 * The frontend already collected a specific orderId (reviewableOrders /
 * selectedReviewOrderId in ProductDetailPage.tsx) and even had a client-
 * side "already reviewed" filter, but it silently never worked because
 * the field it filtered on (review.orderId) was never sent to or stored
 * by the server. Now mirrors the same real-order-lookup pattern already
 * used for returns/warranty claims: orderId+orderItemId are required,
 * verified against the real order (ownership + delivered), and the
 * uniqueness key is buyerId+orderId+orderItemId -- not productId alone,
 * since a buyer legitimately reviews a later re-purchase separately.
 */
operationsRouter.post('/operations/reviews', ...requireAuth, (req, res) => {
  const body = req.body as Partial<OpsReview>;
  if (!body.productTitle?.trim() || !body.comment?.trim() || !body.rating) {
    res.status(400).json({ error: 'productTitle, rating, and comment are required' });
    return;
  }
  const orderId = String(body.orderId || '').trim();
  const orderItemId = String(body.orderItemId || '').trim();
  if (!orderId || !orderItemId) {
    res.status(400).json({ error: 'orderId and orderItemId are required' });
    return;
  }
  // Always bind reviewer to authenticated uid — never trust body.userId.
  const userId = req.userId!;

  const order = operationsStore.getOrder(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.buyerId !== userId) {
    res.status(403).json({ error: 'Not authorized to review this order' });
    return;
  }
  const located = findOrderItem(order, orderItemId);
  if (!located) {
    res.status(404).json({ error: 'Order item not found' });
    return;
  }
  const delivered = located.sub.trackingStatus === 'delivered' || order.status === 'completed';
  if (!delivered) {
    res.status(400).json({ error: 'This item has not been delivered yet' });
    return;
  }
  const productId = String(located.item.productId || body.productId || 'unknown');

  const existingReview = operationsStore
    .listReviews({ userId })
    .find((r) => r.orderId === orderId && r.orderItemId === orderItemId);
  if (existingReview) {
    res.status(200).json({ success: true, data: existingReview, reused: true });
    return;
  }

  const saved = operationsStore.createReview({
    userId,
    userName: body.userName || 'Anonymous',
    orderId,
    orderItemId,
    productId,
    productTitle: body.productTitle,
    brandName: body.brandName || '',
    storeName: body.storeName || '',
    rating: Math.min(5, Math.max(1, Number(body.rating))),
    comment: body.comment.trim(),
    photos: Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === 'string').slice(0, 6) : [],
  });
  scheduleOperationsPersist();
  if (located.sub.sellerId) {
    notifyUser(String(located.sub.sellerId), {
      type: COMMUNICATION_TYPES.SELLER_UPDATE,
      category: 'seller',
      eventKey: 'review.update',
      persona: 'seller',
      title: 'New product review',
      summary: `${saved.userName} left a ${saved.rating}-star review on ${saved.productTitle}.`,
      actionUrl: '/admin/reviews',
    }).catch((err) => Logger.error('notifyUser failed (review created)', { error: String(err) }));
  }
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/reviews/:id', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReview(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  if (!userCanModerateOrEditReview(req, existing)) {
    res.status(403).json({ error: 'Not authorized to update this review' });
    return;
  }
  const patch = { ...req.body } as Partial<OpsReview>;
  // Authors may edit content; only staff/moderator may change moderation status.
  if (patch.status && !userIsStaff(req) && !(req.userRole && hasRole(req.userRole, ROLES.MODERATOR))) {
    delete patch.status;
  } else if (patch.status) {
    patch.status = normalizeReviewStatus(String(patch.status));
  }
  // Prevent authorship takeover via patch.
  delete patch.userId;
  const statusChanged = Boolean(patch.status) && patch.status !== existing.status;
  const saved = operationsStore.updateReview(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  scheduleOperationsPersist();
  if (statusChanged && saved.userId && saved.userId !== req.userId) {
    notifyUser(saved.userId, {
      type: COMMUNICATION_TYPES.MODERATION_UPDATE,
      category: 'buyer',
      eventKey: 'review.update',
      persona: 'consumer',
      title: 'Your review was updated',
      summary: `Your review of ${saved.productTitle} is now "${saved.status}".`,
      actionUrl: '/dashboard?tab=my-reviews',
    }).catch((err) => Logger.error('notifyUser failed (review moderated)', { error: String(err) }));
  }
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/reviews/:id', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReview(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  if (!userCanModerateOrEditReview(req, existing)) {
    res.status(403).json({ error: 'Not authorized to delete this review' });
    return;
  }
  const ok = operationsStore.deleteReview(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});

// ── Public business inquiries (canonical "lead" record) ─────────────────────

/** Controlled options for the public inquiry forms — the server validates against the same lists. */
operationsRouter.get('/operations/lead-options', async (_req, res) => {
  try {
    const categories = await catalogStore.listCategories();
    res.json({ data: inquiryOptionsPayload(categories) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load inquiry options' });
  }
});

const LEGACY_SOURCE_TYPE: Record<string, InquiryType> = {
  'suggest-brand': 'suggest_brand',
  'partnership-page': 'partnership',
  'advertise-page': 'advertising',
  'contact-page': 'general_contact',
  // Creator profile "ask for branding" modal still posts the legacy shape.
  'creator-ask-for-branding': 'partnership',
};

async function assignInquiryReference(leadId: string) {
  try {
    const referenceId = await ensureEntityReferenceId({ entityType: 'inquiry', internalId: leadId });
    return operationsStore.updateLead(leadId, { referenceId }) ?? operationsStore.getLead(leadId);
  } catch (err) {
    // The inquiry stays persisted without a reference rather than being lost.
    Logger.warn('[Inquiry] Reference id allocation failed', { leadId, error: err instanceof Error ? err.message : String(err) });
    return operationsStore.getLead(leadId);
  }
}

function notifyInquiryInBackground(leadId: string) {
  const lead = operationsStore.getLead(leadId);
  if (!lead) return;
  void notifyInquiryCreated(lead).then((delivery) => {
    operationsStore.updateLead(leadId, { delivery });
  });
}

/** Per-IP inquiry submissions allowed per abuse window (15 min). Generous enough for shared/CGNAT IPs. */
const INQUIRY_SUBMISSIONS_PER_WINDOW = Number(process.env.INQUIRY_RATE_LIMIT || 30);

operationsRouter.post('/operations/leads', softAuthenticateRequest, async (req, res) => {
  // Fixed key (not originalUrl) so query-string variations share one bucket.
  const abuse = recordSuspiciousRequest(req.ip, 'POST /operations/leads');
  if (abuse.thresholdExceeded || abuse.count > INQUIRY_SUBMISSIONS_PER_WINDOW) {
    res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const submittedByUserId = req.userId || undefined;

  // Legacy storefront payload (no inquiryType) — accepted unchanged so an
  // older storefront build keeps working until it is redeployed.
  if (typeof body.inquiryType !== 'string') {
    const brandName = typeof body.brandName === 'string' ? body.brandName.trim().slice(0, 200) : '';
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 500) : '';
    if (!brandName || !email) {
      res.status(400).json({ error: 'brandName and email are required' });
      return;
    }
    const source = typeof body.source === 'string' ? body.source.slice(0, 60) : 'advertise-page';
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || undefined : undefined);
    const created = operationsStore.createLead({
      source,
      inquiryType: LEGACY_SOURCE_TYPE[source] ?? 'general_contact',
      brandName,
      contactPerson: str(body.contactPerson, 200),
      email,
      budget: str(body.budget, 60),
      placementInterest: str(body.placementInterest, 60),
      message: str(body.message, 4000),
      submittedByUserId,
    });
    const saved = await assignInquiryReference(created.id);
    notifyInquiryInBackground(created.id);
    res.status(201).json({ success: true, data: { id: created.id, referenceId: saved?.referenceId ?? null } });
    return;
  }

  let categories: Awaited<ReturnType<typeof catalogStore.listCategories>> = [];
  if (body.inquiryType === 'suggest_brand') {
    try {
      categories = await catalogStore.listCategories();
    } catch {
      res.status(503).json({ error: 'Categories are temporarily unavailable. Please try again.' });
      return;
    }
  }
  const result = validateInquiry(body, categories, { allowImages: Boolean(submittedByUserId), ownHosts: [String(req.get('host') || '')].filter(Boolean) });
  if ('errors' in result) {
    res.status(400).json({ error: 'Please check the highlighted fields.', fieldErrors: result.errors });
    return;
  }
  const value = result.value;

  // Hidden honeypot field: kept for review as spam, never notified.
  const honeypot = typeof body.companyFax === 'string' && body.companyFax.trim().length > 0;

  const existing = findRecentResubmission(value, operationsStore.listLeads());
  if (existing && !honeypot) {
    res.status(200).json({ success: true, duplicate: true, data: { id: existing.id, referenceId: existing.referenceId ?? null } });
    return;
  }

  let duplicateSignals: ReturnType<typeof detectBrandDuplicateSignals> = [];
  if (value.inquiryType === 'suggest_brand') {
    try {
      duplicateSignals = detectBrandDuplicateSignals(value, await catalogStore.listBrands(), operationsStore.listLeads());
    } catch {
      duplicateSignals = [];
    }
  }

  const created = operationsStore.createLead(
    {
      source: value.sourcePath || value.inquiryType,
      inquiryType: value.inquiryType,
      brandName: value.brandName,
      contactPerson: value.contactPerson,
      email: value.email,
      website: value.website,
      categoryId: value.categoryId,
      categoryName: value.categoryName,
      country: value.country,
      subject: value.subject,
      partnershipModel: value.partnershipModel,
      budget: value.budget,
      placementInterest: value.placementInterest,
      message: value.message,
      sourcePath: value.sourcePath,
      submittedByUserId,
      duplicateSignals: duplicateSignals.length ? duplicateSignals : undefined,
      ...(value.suggestion ? { suggestion: value.suggestion } : {}),
    },
    { status: honeypot ? 'spam' : 'new' },
  );
  if (honeypot) {
    res.status(201).json({ success: true, data: { id: created.id, referenceId: null } });
    return;
  }
  const saved = await assignInquiryReference(created.id);
  notifyInquiryInBackground(created.id);
  res.status(201).json({ success: true, data: { id: created.id, referenceId: saved?.referenceId ?? null } });
});

operationsRouter.get('/operations/leads', ...requireAdmin, (_req, res) => {
  res.json({ data: operationsStore.listLeads() });
});

operationsRouter.get('/operations/leads/:id', ...requireAdmin, (req, res) => {
  const lead = operationsStore.getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  res.json({ data: lead });
});

/** Status only — the inquiry's submitted fields are never editable through the API. */
operationsRouter.patch('/operations/leads/:id', ...requireAdmin, (req, res) => {
  const status = (req.body as { status?: unknown } | undefined)?.status;
  if (typeof status !== 'string' || !INQUIRY_STATUSES.some((s) => s.value === status)) {
    res.status(400).json({ error: 'A valid status is required.' });
    return;
  }
  const saved = operationsStore.setLeadStatus(req.params.id, status as (typeof INQUIRY_STATUSES)[number]['value'], {
    id: req.userId || 'unknown',
    name: req.user?.displayName || req.userId || 'Admin',
  });
  if (!saved) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

/**
 * Suggest a Brand review. Approve creates a community brand profile from the
 * (staff-reviewed) details through the same path as "Create community brand",
 * then links it to the suggestion; Reject records a note. Each suggestion can
 * be decided once.
 */
function openBrandSuggestion(id: string, res: import('express').Response): OpsLead | null {
  const lead = operationsStore.getLead(id);
  if (!lead || lead.inquiryType !== 'suggest_brand') {
    res.status(404).json({ error: 'Brand suggestion not found' });
    return null;
  }
  if (lead.suggestionDecision) {
    res.status(409).json({ error: `This suggestion was already ${lead.suggestionDecision.decision}.`, code: 'SUGGESTION_DECIDED' });
    return null;
  }
  return lead;
}

operationsRouter.post('/operations/leads/:id/approve-suggestion', ...requireAdmin, async (req, res) => {
  await withRecordLocks([`lead:${req.params.id}`], async () => {
    const lead = openBrandSuggestion(req.params.id, res);
    if (!lead) return;
    try {
      const result = await createCommunityProfile(req, { ...(req.body as CommunityProfileInput), type: 'brand' });
      if (!result.created) {
        res.status(409).json({
          error: 'Possible duplicate profiles found. Review them, then confirm to create anyway.',
          code: 'POSSIBLE_DUPLICATES',
          duplicates: result.duplicates,
        });
        return;
      }
      const actor = { id: req.userId || 'unknown', name: req.user?.displayName || req.userId || 'Admin' };
      const at = new Date().toISOString();
      operationsStore.updateLead(lead.id, {
        status: 'closed',
        suggestionDecision: {
          decision: 'approved',
          at,
          actorId: actor.id,
          actorName: actor.name,
          communityProfileId: result.created.id,
          communityProfileSlug: result.created.slug,
        },
        history: [
          ...(lead.history ?? []),
          { at, action: 'suggestion_approved', actorId: actor.id, actorName: actor.name, fromStatus: lead.status, toStatus: 'closed' },
        ],
      });
      scheduleOperationsPersist();
      res.status(201).json({ success: true, data: result.created });
    } catch (error) {
      if (error instanceof ClaimError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create the profile.' });
    }
  });
});

operationsRouter.post('/operations/leads/:id/reject-suggestion', ...requireAdmin, (req, res) => {
  const lead = openBrandSuggestion(req.params.id, res);
  if (!lead) return;
  const raw = (req.body as { note?: unknown } | undefined)?.note;
  const note = typeof raw === 'string' ? raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 1000) : '';
  if (note.length < 5) {
    res.status(400).json({ error: 'Add a short reason (at least 5 characters).', code: 'REASON_REQUIRED' });
    return;
  }
  const actor = { id: req.userId || 'unknown', name: req.user?.displayName || req.userId || 'Admin' };
  const at = new Date().toISOString();
  const saved = operationsStore.updateLead(lead.id, {
    status: 'rejected',
    suggestionDecision: { decision: 'rejected', at, actorId: actor.id, actorName: actor.name, note },
    history: [
      ...(lead.history ?? []),
      { at, action: 'suggestion_rejected', actorId: actor.id, actorName: actor.name, fromStatus: lead.status, toStatus: 'rejected' },
    ],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/leads/:id/notes', ...requireAdmin, (req, res) => {
  const raw = (req.body as { body?: unknown } | undefined)?.body;
  const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '';
  if (!text || text.length > 2000) {
    res.status(400).json({ error: 'A note between 1 and 2000 characters is required.' });
    return;
  }
  const saved = operationsStore.addLeadNote(req.params.id, text, {
    id: req.userId || 'unknown',
    name: req.user?.displayName || req.userId || 'Admin',
  });
  if (!saved) {
    res.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.get('/operations/jobs/public', (_req, res) => {
  res.json({ data: operationsStore.listJobPostings({ publicOnly: true }) });
});

operationsRouter.get('/operations/jobs/public/:idOrSlug', (req, res) => {
  const job = operationsStore.getJobPosting(req.params.idOrSlug);
  if (!job || job.status !== 'open') {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  res.json({ data: job });
});

operationsRouter.get('/operations/jobs', (_req, res) => {
  res.json({ data: operationsStore.listJobPostings() });
});

operationsRouter.post('/operations/jobs', ...requireAdmin, (req, res) => {
  const body = req.body as {
    title?: string;
    department?: string;
    location?: string;
    employmentType?: string;
    summary?: string;
    description?: string;
    responsibilities?: string;
    requirements?: string;
    status?: string;
    slug?: string;
  };
  if (!body.title?.trim() || !body.department?.trim() || !body.location?.trim()) {
    res.status(400).json({ error: 'title, department, and location are required' });
    return;
  }
  const employmentType = (body.employmentType || 'full_time') as
    | 'full_time'
    | 'part_time'
    | 'internship'
    | 'contract';
  const status = (body.status || 'open') as 'open' | 'closed' | 'draft';
  const saved = operationsStore.createJobPosting({
    title: body.title.trim(),
    department: body.department.trim(),
    location: body.location.trim(),
    employmentType,
    summary: (body.summary || '').trim(),
    description: (body.description || '').trim(),
    responsibilities: (body.responsibilities || '').trim(),
    requirements: (body.requirements || '').trim(),
    status,
    slug: body.slug?.trim(),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/jobs/:id', ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateJobPosting(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/jobs/:id', ...requireAdmin, (req, res) => {
  const ok = operationsStore.deleteJobPosting(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true });
});

/** Applicant PII — hiring admin only. */
operationsRouter.get('/operations/job-applications', ...requireAdmin, (req, res) => {
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
  res.json({ data: operationsStore.listJobApplications(jobId) });
});

// Public/anonymous: a job applicant has no Choosify account. Validation
// below (jobId/name/email/resumeUrl presence, open-job lookup) is the
// actual authorization boundary for this write -- there is no
// partner/marketplace concept applicable to a job application.
operationsRouter.post('/operations/job-applications', (req, res) => {
  const body = req.body as {
    jobId?: string;
    name?: string;
    email?: string;
    phone?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    coverLetter?: string;
  };
  if (!body.jobId?.trim() || !body.name?.trim() || !body.email?.trim() || !body.resumeUrl?.trim()) {
    res.status(400).json({ error: 'jobId, name, email, and resumeUrl are required' });
    return;
  }
  const job = operationsStore.getJobPosting(body.jobId.trim());
  if (!job || job.status !== 'open') {
    res.status(404).json({ error: 'Open job posting not found' });
    return;
  }
  const saved = operationsStore.createJobApplication({
    jobId: job.id,
    jobTitle: job.title,
    name: body.name.trim(),
    email: body.email.trim(),
    phone: (body.phone || '').trim(),
    resumeUrl: body.resumeUrl.trim(),
    resumeFileName: body.resumeFileName?.trim(),
    coverLetter: (body.coverLetter || '').trim(),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/job-applications/:id', ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateJobApplication(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

// Public/anonymous: a job applicant has no Choosify account, so this
// cannot go through storeUploadedDocument() -- its media table row
// requires a real, FK-constrained uploadedByUserId (uuid references
// users.id). saveMediaFile() writes straight to the existing public
// 'careers' storage root with no database record; the file remains
// reachable via the job-application record's resumeUrl, matching how
// hiring staff actually find it (GET /operations/job-applications).
operationsRouter.post('/operations/media/upload-resume', async (req, res) => {
  try {
    const { validateDocumentUploadInput } = await import('./lib/uploadValidation');
    const { saveMediaFile } = await import('./lib/mediaStorage');
    const body = req.body as { data?: string; mimeType?: string; fileName?: string };
    const validation = validateDocumentUploadInput({
      base64Data: body.data || '',
      mimeType: body.mimeType,
      fileName: body.fileName,
    });
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const saved = await saveMediaFile({
      category: 'careers',
      buffer: Buffer.from(body.data!, 'base64'),
      mimeType: validation.mimeType,
    });
    res.status(201).json({ success: true, url: saved.publicUrl, fileName: validation.fileName });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Resume upload failed',
    });
  }
});

operationsRouter.get('/operations/permissions', (_req, res) => {
  res.json({ permissions: operationsStore.getPermissions(), defaults: DEFAULT_ROLE_PERMISSIONS });
});

/**
 * Updates the admin UI RBAC matrix (PermissionKey gates: content/users/finance/
 * brand/system/analytics per role). Does NOT assign Firebase user roles — that
 * lives in admin user profiles. Only admin/super_admin may write; callers cannot
 * elevate themselves by rewriting this matrix without already being admin.
 */
operationsRouter.put('/operations/permissions', ...requireAdmin, (req, res) => {
  const permissions = req.body?.permissions;
  if (!permissions || typeof permissions !== 'object') {
    res.status(400).json({ error: 'permissions object is required' });
    return;
  }
  const saved = operationsStore.updatePermissions(permissions);
  scheduleOperationsPersist();
  res.json({ success: true, permissions: saved });
});

operationsRouter.get('/operations/permissions/check', (req, res) => {
  const role = typeof req.query.role === 'string' ? req.query.role : '';
  const permission = typeof req.query.permission === 'string' ? req.query.permission : '';
  if (!role || !permission) {
    res.status(400).json({ error: 'role and permission query params are required' });
    return;
  }
  const permissions = operationsStore.getPermissions();
  const rolePerms = permissions[role] || DEFAULT_ROLE_PERMISSIONS[role];
  const allowed =
    role === 'super_admin' ||
    Boolean(rolePerms?.[permission as PermissionKey]);
  res.json({ allowed, role, permission });
});

operationsRouter.get('/operations/analytics', ...requireAuth, async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  const role = req.userRole;
  const userId = req.userId || '';
  const activeBrandId =
    typeof req.query.brandId === 'string' && req.query.brandId.trim()
      ? req.query.brandId.trim()
      : null;

  if (
    role &&
    (hasRole(role, ROLES.ADMIN) ||
      hasRole(role, ROLES.SUPER_ADMIN) ||
      hasRole(role, ROLES.MODERATOR))
  ) {
    res.json({ data: getAnalyticsSummary(range) });
    return;
  }

  if (role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER))) {
    let ownedBrandIds: string[] = [];
    try {
      const brands = await catalogStore.listBrands();
      ownedBrandIds = brands
        .filter((b) => String(b.sellerId || '') === String(userId))
        .map((b) => b.id)
        .filter(Boolean);
    } catch {
      ownedBrandIds = [];
    }
    if (activeBrandId && !ownedBrandIds.includes(activeBrandId)) {
      res.status(403).json({ error: 'Not authorized for this Brand analytics scope' });
      return;
    }
    res.json({
      data: getRoleAnalytics('seller', range, {
        ownerId: userId,
        activeBrandId,
        ownedBrandIds,
      }),
    });
    return;
  }

  if (role && hasRole(role, ROLES.CREATOR)) {
    res.json({
      data: getRoleAnalytics('creator', range, { ownerId: userId }),
    });
    return;
  }

  res.status(403).json({ error: 'Not authorized to view platform analytics' });
});

operationsRouter.get('/operations/analytics/role/:role', ...requireAuth, async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  const requestedRole = req.params.role;
  const userRole = req.userRole;
  const userId = req.userId || '';
  const activeBrandId =
    typeof req.query.brandId === 'string' && req.query.brandId.trim()
      ? req.query.brandId.trim()
      : null;

  if (
    userRole &&
    (hasRole(userRole, ROLES.ADMIN) ||
      hasRole(userRole, ROLES.SUPER_ADMIN) ||
      hasRole(userRole, ROLES.MODERATOR))
  ) {
    res.json({ data: getRoleAnalytics(requestedRole, range) });
    return;
  }

  if (userRole && (hasRole(userRole, ROLES.SELLER) || hasRole(userRole, ROLES.VERIFIED_SELLER))) {
    if (requestedRole === 'seller') {
      let ownedBrandIds: string[] = [];
      try {
        const brands = await catalogStore.listBrands();
        ownedBrandIds = brands
          .filter((b) => String(b.sellerId || '') === String(userId))
          .map((b) => b.id)
          .filter(Boolean);
      } catch {
        ownedBrandIds = [];
      }
      if (activeBrandId && !ownedBrandIds.includes(activeBrandId)) {
        res.status(403).json({ error: 'Not authorized for this Brand analytics scope' });
        return;
      }
      res.json({
        data: getRoleAnalytics('seller', range, {
          ownerId: userId,
          activeBrandId,
          ownedBrandIds,
        }),
      });
      return;
    }
    res.status(403).json({ error: 'Sellers may only request their own role analytics' });
    return;
  }

  if (userRole && hasRole(userRole, ROLES.CREATOR)) {
    if (requestedRole === 'creator') {
      res.json({
        data: getRoleAnalytics('creator', range, { ownerId: userId }),
      });
      return;
    }
    res.status(403).json({ error: 'Creators may only request their own role analytics' });
    return;
  }

  res.status(403).json({ error: 'Not authorized to view role analytics' });
});

operationsRouter.get('/operations/seller-dashboard', ...requireAuth, async (req, res) => {
  try {
    let sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId.trim() : '';
    const role = req.userRole;
    const userId = req.userId;
    const isStaff =
      role &&
      (hasRole(role, ROLES.ADMIN) ||
        hasRole(role, ROLES.SUPER_ADMIN) ||
        hasRole(role, ROLES.MODERATOR) ||
        hasRole(role, ROLES.SUPPORT_AGENT));

    if (role && (hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER))) {
      if (sellerId && sellerId !== userId) {
        res.status(403).json({ error: 'Sellers may only view their own dashboard' });
        return;
      }
      sellerId = userId || '';
    } else if (!isStaff) {
      res.status(403).json({ error: 'Not authorized to view seller dashboard' });
      return;
    }

    if (!sellerId) {
      res.status(400).json({ error: 'sellerId query parameter is required' });
      return;
    }

    const data = await getSellerDashboardIntelligence({
      sellerId,
      sellerName: typeof req.query.sellerName === 'string' ? req.query.sellerName : undefined,
      storeName: typeof req.query.storeName === 'string' ? req.query.storeName : undefined,
      range: typeof req.query.range === 'string' ? req.query.range : undefined,
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load seller dashboard intelligence',
    });
  }
});

operationsRouter.get('/operations/shipments', ...requireAuth, (req, res) => {
  const all = shipmentStore.listShipments();
  const scoped = userIsStaff(req) ? all : all.filter((s) => userCanViewShipment(req, s));
  res.json({ data: scoped });
});

operationsRouter.get('/operations/shipments/:id', ...requireAuth, (req, res) => {
  const shipment = shipmentStore.getShipment(req.params.id);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  if (!userCanViewShipment(req, shipment)) {
    res.status(403).json({ error: 'Not authorized to view this shipment' });
    return;
  }
  res.json({ data: shipment });
});

// QA3-003: previously passed req.body straight into a raw object-spread
// update with no field allowlist -- an authorized seller (userCanUpdateShipment
// allows staff OR the order's owning seller) could set id/orderId/buyerId/
// codAmount/deliveryCharge/status/trackingEvents/timestamps arbitrarily on
// their own order's shipment. Confirmed via a fresh grep across both repos
// that this endpoint has zero frontend callers today, so a strict allowlist
// carries no risk of breaking an existing flow. Limited to the two fields
// that match its evident purpose: the seller/staff recording courier
// booking details.
const SHIPMENT_PATCH_ALLOWED_KEYS = ['courier', 'trackingNumber'] as const;

operationsRouter.patch('/operations/shipments/:id', ...requireAuth, (req, res) => {
  const existing = shipmentStore.getShipment(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  if (!userCanUpdateShipment(req, existing.orderId)) {
    res.status(403).json({ error: 'Not authorized to update this shipment' });
    return;
  }

  const rawBody = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const rejected = Object.keys(rawBody).filter(
    (key) => !(SHIPMENT_PATCH_ALLOWED_KEYS as readonly string[]).includes(key),
  );
  if (rejected.length > 0) {
    res.status(400).json({
      error: 'One or more fields are not allowed on this endpoint',
      rejected,
      allowed: [...SHIPMENT_PATCH_ALLOWED_KEYS],
    });
    return;
  }
  const patch: Partial<Pick<OpsShipment, (typeof SHIPMENT_PATCH_ALLOWED_KEYS)[number]>> = {};
  for (const key of SHIPMENT_PATCH_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(rawBody, key)) {
      (patch as Record<string, unknown>)[key] = rawBody[key];
    }
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      error: 'No updatable fields provided',
      allowed: [...SHIPMENT_PATCH_ALLOWED_KEYS],
    });
    return;
  }

  const saved = shipmentStore.updateShipment(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.get('/operations/platform-messages', ...requireAuth, async (req, res) => {
  try {
    const conversationIdRaw =
      typeof req.query.conversationId === 'string'
        ? req.query.conversationId.trim()
        : typeof req.query.threadId === 'string'
          ? req.query.threadId.trim()
          : '';
    let userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';

    // Resolve conversation: explicit id, or conv_platform_<userId>, or caller's own inbox.
    let conversationId = conversationIdRaw;
    if (!conversationId) {
      if (!userId) userId = req.userId || '';
      if (!userId) {
        res.status(400).json({ error: 'conversationId, threadId, or userId is required' });
        return;
      }
      conversationId = `conv_platform_${userId}`;
    }

    const ownConversation = req.userId ? `conv_platform_${req.userId}` : '';
    const isOwnInbox = Boolean(req.userId && conversationId === ownConversation);
    const requestedUserId = userId || (conversationId.startsWith('conv_platform_')
      ? conversationId.slice('conv_platform_'.length)
      : '');
    // Sprint 11: a seller/creator with a real relationship to the requested
    // buyer (order/booking/manual-offer) may read that buyer's conversation,
    // same relationship rule as replying (POST, above).
    const isOwnRequest = requestedUserId && requestedUserId === req.userId;
    if (!isOwnInbox && !isOwnRequest && !userIsStaff(req)) {
      const canReadAsRelated =
        requestedUserId && (await userCanReplyToBuyerConversation(req, requestedUserId));
      if (!canReadAsRelated) {
        res.status(403).json({ error: 'Not authorized to list these messages' });
        return;
      }
    }

    const { listMessages } = await import('./messaging/omniStore');
    const messages = await listMessages(conversationId);
    res.json({ data: messages, conversationId });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list platform messages',
    });
  }
});

operationsRouter.post('/operations/platform-messages', ...requireAuth, async (req, res) => {
  try {
    const { buyerId, userName, body, orderId, bookingOffer, conversationId, isComplaint, sellerId, orderSnapshot } =
      req.body as {
        buyerId?: string;
        userName?: string;
        body?: string;
        orderId?: string;
        bookingOffer?: Record<string, unknown>;
        conversationId?: string;
        sellerId?: string;
        /** Client order shape used when ops store has no row yet (close-only enforcement). */
        orderSnapshot?: OrderLikeForExpiry;
        /** Support complaints bypass post-order reply lock (they go to platform inbox, not seller thread). */
        isComplaint?: boolean;
      };
    if (!body?.trim()) {
      res.status(400).json({ error: 'buyerId and body are required' });
      return;
    }

    // Never trust client buyerId for shoppers — staff may post on behalf of a
    // buyer, and (Sprint 11) a seller/creator with a real order/booking/offer
    // relationship to this buyer may reply into their conversation. Anyone
    // else posting a buyerId that isn't their own is rejected.
    const requestedBuyerId = buyerId?.trim();
    const isSelfPost = !requestedBuyerId || requestedBuyerId === req.userId;
    let effectiveBuyerId: string;
    let isReplyFromOther = false;

    if (isSelfPost) {
      effectiveBuyerId = req.userId || '';
    } else if (userIsStaff(req)) {
      effectiveBuyerId = requestedBuyerId;
      isReplyFromOther = true;
    } else if (await userCanReplyToBuyerConversation(req, requestedBuyerId)) {
      effectiveBuyerId = requestedBuyerId;
      isReplyFromOther = true;
    } else {
      res.status(403).json({ error: 'Not authorized to post as another user' });
      return;
    }
    if (!effectiveBuyerId) {
      res.status(400).json({ error: 'buyerId and body are required' });
      return;
    }

    // Pre-order booking offers keep their own 24h/8h timers — skip post-order expiry.
    // Complaints are support tickets routed to platform inbox, not seller replies.
    const skipExpiry = Boolean(bookingOffer) || Boolean(isComplaint);
    const blocked = assertPostOrderReplyAllowed(orderId, skipExpiry, orderSnapshot);
    if (blocked) {
      res.status(403).json(blocked);
      return;
    }

    let attachedOffer = bookingOffer;
    // If client sends a bookingOffer without requestId, create a canonical booking_requests row
    if (bookingOffer && !bookingOffer.requestId) {
      const { createBookingRequest, resolveAutoApprove, resolvePartialPaymentSettings } = await import(
        './booking/bookingService'
      );
      const listingId = String(bookingOffer.listingId || '');
      const offerSellerId = String(bookingOffer.sellerId || '');
      const autoApprove = await resolveAutoApprove(offerSellerId, listingId).catch(() => false);
      const partialPayment = await resolvePartialPaymentSettings(listingId).catch(() => ({
        partialPaymentEnabled: false,
        depositPercent: undefined as number | undefined,
      }));
      const created = await createBookingRequest({
        listingId,
        listingTitle: String(bookingOffer.listingTitle || 'Service listing'),
        listingImage: bookingOffer.listingImage as string | undefined,
        listingHref: bookingOffer.listingHref as string | undefined,
        sellerId: offerSellerId,
        sellerName: String(bookingOffer.sellerName || 'Seller'),
        buyerId: effectiveBuyerId,
        buyerName: userName?.trim(),
        serviceCategory: bookingOffer.serviceCategory as string | undefined,
        isService: bookingOffer.isService !== false,
        fields: (bookingOffer.fields as Record<string, string | number>) || {},
        notes: bookingOffer.notes as string | undefined,
        price: Number(bookingOffer.price) || 0,
        originalPrice:
          bookingOffer.originalPrice !== undefined
            ? Number(bookingOffer.originalPrice)
            : undefined,
        conversationId: `conv_platform_${effectiveBuyerId}`,
        autoApprove,
        partialPaymentEnabled: partialPayment.partialPaymentEnabled,
        depositPercent: partialPayment.depositPercent,
      });
      attachedOffer = created.offer as unknown as Record<string, unknown>;
    }

    const complaintPrefix = isComplaint
      ? `[Complaint${conversationId ? ` · thread ${conversationId}` : ''}${orderId ? ` · order ${orderId}` : ''}${sellerId ? ` · seller ${sellerId}` : ''}] `
      : '';

    const result = await submitPlatformMessage({
      buyerId: effectiveBuyerId,
      userName: userName?.trim() || effectiveBuyerId,
      body: `${complaintPrefix}${body.trim()}`,
      orderId: orderId?.trim(),
      bookingOffer: attachedOffer,
      senderId: isReplyFromOther ? req.userId : undefined,
      direction: isReplyFromOther ? 'outbound' : undefined,
    });

    const conversationActionUrl = `/messages/conv_platform_${effectiveBuyerId}`;
    if (isReplyFromOther) {
      // Seller/staff replied — notify the buyer, unless staff is posting as
      // themselves in their own thread (effectiveBuyerId === req.userId, i.e.
      // not actually a reply to someone else, already excluded by isSelfPost).
      notifyUser(effectiveBuyerId, {
        type: COMMUNICATION_TYPES.BUYER_UPDATE,
        category: 'buyer',
        eventKey: 'message.new',
        persona: 'consumer',
        priority: 'normal',
        title: 'New message',
        summary: `${userName?.trim() || 'A seller'} sent you a message.`,
        actionUrl: conversationActionUrl,
        channels: [DELIVERY_CHANNELS.IN_APP],
      }).catch((err) => Logger.error('notifyUser failed (new message, buyer)', { error: String(err) }));
    } else if (!isComplaint && !bookingOffer) {
      // Buyer sent an ordinary message — notify sellers who have a real
      // relationship with this buyer (skip booking-offer/system messages,
      // which already have their own dedicated notifications).
      const relatedOrderSellerIds = operationsStore
        .listOrders({ buyerId: effectiveBuyerId })
        .flatMap((o) => ((o.subOrders || []) as Array<{ sellerId?: string }>).map((s) => s.sellerId))
        .filter((id): id is string => Boolean(id));
      const uniqueSellerIds = Array.from(new Set(relatedOrderSellerIds));
      for (const sellerId of uniqueSellerIds) {
        notifyUser(sellerId, {
          type: COMMUNICATION_TYPES.SELLER_UPDATE,
          category: 'seller',
          eventKey: 'message.new',
          persona: 'seller',
          priority: 'normal',
          title: 'New message',
          summary: `${userName?.trim() || 'A buyer'} sent you a message.`,
          actionUrl: conversationActionUrl,
          channels: [DELIVERY_CHANNELS.IN_APP],
        }).catch((err) => Logger.error('notifyUser failed (new message, seller)', { error: String(err) }));
      }
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit message' });
  }
});

operationsRouter.get('/operations/conversation-expiry', (req, res) => {
  const orderId = String(req.query.orderId || '').trim();
  if (!orderId) {
    res.status(400).json({ error: 'orderId is required' });
    return;
  }
  const order = operationsStore.getOrder(orderId);
  if (!order) {
    res.json({
      data: {
        status: 'not_applicable',
        enforced: false,
        reason: 'order_not_found_on_server',
      },
    });
    return;
  }
  const expiry = evaluatePostOrderConversationExpiry(toExpiryOrder(order));
  res.json({ data: { ...expiry, enforced: true } });
});

operationsRouter.get('/operations/shipments/track/:orderId', ...requireAuth, (req, res) => {
  const shipment = shipmentStore.getShipmentByOrderId(req.params.orderId);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found for this order' });
    return;
  }
  if (!userCanViewShipment(req, shipment)) {
    res.status(403).json({ error: 'Not authorized to view this shipment' });
    return;
  }
  res.json({ data: shipment });
});

operationsRouter.get('/operations/feature-flags', (_req, res) => {
  res.json({ flags: operationsStore.getFeatureFlags() });
});

operationsRouter.put('/operations/feature-flags', ...requireAdmin, (req, res) => {
  const flags = req.body?.flags as Record<string, boolean> | undefined;
  if (!flags || typeof flags !== 'object') {
    res.status(400).json({ error: 'flags object is required' });
    return;
  }
  const saved = operationsStore.updateFeatureFlags(flags);
  scheduleOperationsPersist();
  res.json({ success: true, flags: saved });
});

// Sprint 11: this endpoint had zero authentication -- any unauthenticated
// caller could dump every user's email/displayName/role/id. Staff-only.
operationsRouter.get('/operations/users', authenticateRequest, async (req, res) => {
  if (!userIsStaff(req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  // Optional staff directory search: exact CFID match ranks first, then a
  // case-insensitive contains on CFID / name / email. Server-side only.
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const wantMessagingContext = req.query.context === 'messaging';
  try {
    const { db } = await import('./db/client');
    const { users } = await import('./db/schema');
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        choosifyUserId: users.choosifyUserId,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users);

    const mapRole = (role: string): 'Consumer' | 'Creator' | 'Seller' | 'Admin' => {
      const r = String(role || '').toLowerCase();
      if (r === 'creator') return 'Creator';
      if (r === 'seller' || r === 'verified_seller') return 'Seller';
      if (r === 'admin' || r === 'super_admin') return 'Admin';
      return 'Consumer';
    };

    const initials = (name: string) =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'U';

    // Seller business / creator handle context for the messaging contact picker.
    let brandBySeller = new Map<string, string>();
    let creatorByUser = new Map<string, string>();
    if (wantMessagingContext) {
      try {
        const [brands, creators] = await Promise.all([
          catalogStore.listBrands().catch(() => [] as Array<{ sellerId?: string; name?: string }>),
          catalogStore
            .listCreators()
            .catch(() => [] as Array<{ userId?: string; name?: string; handle?: string }>),
        ]);
        brandBySeller = new Map(
          (brands as Array<{ sellerId?: string; name?: string }>)
            .filter((b) => b.sellerId && b.name)
            .map((b) => [b.sellerId as string, b.name as string]),
        );
        creatorByUser = new Map(
          (creators as Array<{ userId?: string; name?: string; handle?: string }>)
            .filter((c) => c.userId)
            .map((c) => [c.userId as string, c.handle || c.name || '']),
        );
      } catch {
        /* optional */
      }
    }

    const labels = await batchAccountPrimaryLabels(
      rows.map((u) => ({ id: u.id, role: u.role, email: u.email })),
    );

    let authUsers = rows.map((u) => {
      const name = u.displayName || u.email || 'User';
      const joined = u.createdAt ? String(u.createdAt).slice(0, 10) : '—';
      const roleLabel = mapRole(u.role);
      return {
        id: u.id,
        name,
        email: u.email,
        role: roleLabel,
        status: labels.get(u.id) || 'Active',
        joined,
        active: joined,
        initials: initials(name),
        trustScore: 85,
        behaviorSegment: 'Retail Shopper',
        choosifyUserId: u.choosifyUserId || undefined,
        avatarUrl: u.avatarUrl || undefined,
        contextLabel:
          roleLabel === 'Seller'
            ? brandBySeller.get(u.id)
            : roleLabel === 'Creator'
              ? creatorByUser.get(u.id)
              : undefined,
      };
    });

    if (q) {
      const needle = q.toLowerCase();
      const cfidNeedle = needle.replace(/\s+/g, '');
      authUsers = authUsers
        .map((u) => {
          const cfid = String(u.choosifyUserId || '').toLowerCase();
          const exact = cfid && cfid === cfidNeedle ? 3 : 0;
          const cfidHit = cfid.includes(cfidNeedle) ? 2 : 0;
          const textHit =
            String(u.name).toLowerCase().includes(needle) ||
            String(u.email).toLowerCase().includes(needle)
              ? 1
              : 0;
          return { u, score: exact || cfidHit || textHit };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name))
        .slice(0, 25)
        .map((x) => x.u);
    }

    if (authUsers.length || q) {
      res.json({ data: authUsers });
      return;
    }
  } catch {
    /* fall through to ops memory list */
  }
  res.json({ data: operationsStore.listUsers() });
});

operationsRouter.get('/operations/seller-offers', (_req, res) => {
  res.json({ data: operationsStore.listSellerOffers() });
});

operationsRouter.post('/operations/seller-offers', (req, res) => {
  const abuse = recordSuspiciousRequest(req.ip, req.originalUrl);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    return;
  }
  const body = req.body as {
    productName?: string;
    category?: string;
    brand?: string;
    price?: string;
    description?: string;
    sellerName?: string;
    sellerPhone?: string;
    sellerRegion?: string;
  };
  if (!body.productName?.trim() || !body.sellerName?.trim()) {
    res.status(400).json({ error: 'productName and sellerName are required' });
    return;
  }
  const saved = operationsStore.createSellerOffer({
    productName: body.productName.trim(),
    category: body.category?.trim() || 'General',
    brand: body.brand?.trim() || '',
    price: body.price?.trim() || '',
    description: body.description?.trim() || '',
    sellerName: body.sellerName.trim(),
    sellerPhone: body.sellerPhone?.trim() || '',
    sellerRegion: body.sellerRegion?.trim() || 'Dhaka',
  });
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/seller-offers/:id', ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateSellerOffer(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Seller offer not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

// ---------------------------------------------------------------------------
// Brand / creator verification (Trust / claim pipeline)
// ---------------------------------------------------------------------------

operationsRouter.post('/operations/media/upload-verification', ...requireAuth, async (req, res) => {
  try {
    const { validateVerificationUploadInput } = await import('./lib/uploadValidation');
    const { storeUploadedVerificationAsset } = await import('./media/mediaUploadService');
    const body = req.body as { data?: string; mimeType?: string; fileName?: string };
    const validation = validateVerificationUploadInput({
      base64Data: body.data || '',
      mimeType: body.mimeType,
      fileName: body.fileName,
    });
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const uploaderId = req.userId || req.user?.uid;
    if (!uploaderId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const uploaded = await storeUploadedVerificationAsset({
      base64Data: body.data!,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
      kind: validation.kind,
      uploaderId,
    });
    res.status(201).json({
      success: true,
      url: uploaded.url,
      fileName: validation.fileName,
      kind: validation.kind,
      mediaId: uploaded.mediaId,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Verification upload failed',
    });
  }
});

function sendClaimError(res: import('express').Response, error: unknown, fallback = 'Request failed'): void {
  if (error instanceof ClaimError) {
    res.status(error.status).json({ error: error.message, code: error.code, ...(error.details || {}) });
    return;
  }
  Logger.error('ownership claim route failed', { error: error instanceof Error ? error.message : String(error) });
  res.status(500).json({ error: fallback });
}

const ownerDashboardTab = (type: string) => (type === 'creator' ? '/admin/creator-profile?tab=verification' : '/admin/brand-profile?tab=verification');

/** Staff destination for a submitted verification: the creator's profile, or the brand Verification Center. */
function staffVerificationUrl(type: string, entityId: string): string {
  return type === 'creator' ? `/admin/creator-review?creatorId=${encodeURIComponent(entityId)}` : '/admin/brand-verification';
}

/** Notifications + email + activity once an ownership claim reaches Submitted. */
async function afterClaimSubmitted(req: import('express').Request, claim: OpsVerificationRequest): Promise<void> {
  recordAccountActivity(req, {
    userId: claim.submitted_by,
    type: 'ownership_claim_submitted',
    category: 'verification',
    summary: `Ownership claim submitted for ${claim.entityName}`,
  });
  try {
    await notifyRoles(['admin', 'super_admin', 'moderator'], {
      type: 'system_alert',
      category: 'admin',
      eventKey: 'staff.verification_submitted',
      persona: 'staff',
      title: 'Ownership claim needs review',
      summary: `${claim.submitted_by_name || 'A user'} claimed the ${claim.entityType} "${claim.entityName}".`,
      actionUrl: claim.entityType === 'creator' ? '/admin/creator-management?filter=claims' : '/admin/seller-management?filter=claims',
      metadata: { verificationId: claim.id, entityType: claim.entityType, entityId: claim.entityId },
    });
    await notifyUser(claim.submitted_by, {
      type: COMMUNICATION_TYPES.MODERATION_UPDATE,
      category: 'seller',
      eventKey: 'verification.update',
      persona: claim.entityType === 'creator' ? 'creator' : 'seller',
      title: 'Ownership claim received',
      summary: `We received your claim for ${claim.entityName}. It is under verification — typically within 48 hours.`,
      actionUrl: ownerDashboardTab(claim.entityType),
    });
  } catch (err) {
    Logger.error('ownership claim notify failed', { error: String(err) });
  }
  void emailUser(claim.submitted_by, {
    subject: `Ownership claim received — ${claim.entityName}`,
    heading: 'Ownership claim received',
    lines: [
      `We received your claim for ${claim.entityName}.`,
      'Choosify will review your documents — typically within 48 hours. We may ask you for more information.',
      'You will not get control of the profile until the claim is approved.',
    ],
    ctaLabel: 'View verification status',
    dashboardPath: ownerDashboardTab(claim.entityType),
  });
}

/**
 * Claim requests are closed for document changes once they leave Draft /
 * Submitted / Under Review (Approved, Rejected, Withdrawn, Expired). Returns
 * true when it already answered the request.
 */
async function refuseClosedClaimDocumentChange(existing: OpsVerificationRequest, res: import('express').Response): Promise<boolean> {
  const type: ClaimEntityType = existing.entityType === 'creator' ? 'creator' : 'brand';
  const kind = verificationKindOf(existing, ownerOf(type, await loadEntity(type, existing.entityId)));
  if (kind === 'ownership_claim' && !ACTIVE_VERIFICATION_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `This ownership claim is ${existing.status.toLowerCase()} and can no longer be changed. Start a new claim from the profile page.`, code: 'CLAIM_CLOSED' });
    return true;
  }
  return false;
}

operationsRouter.post('/operations/verifications', ...requireAuth, async (req, res) => {
  const body = req.body as {
    entityType?: string;
    entityId?: string;
    entityName?: string;
    brand_id?: string;
    brand_name?: string;
    logo_url?: string;
    submitted_by?: string;
    submitted_by_name?: string;
    status?: string;
    documents?: OpsVerificationDocument[];
    claimIntentId?: string;
    claimSource?: string;
    claimantDetails?: unknown;
  };

  const entityType: ClaimEntityType = body.entityType === 'creator' ? 'creator' : 'brand';
  const entityId = String(body.entityId || body.brand_id || '').trim();
  if (!entityId) {
    res.status(400).json({ error: 'entityId (or brand_id) is required' });
    return;
  }

  // Never trust client-supplied submitted_by — bind to authenticated uid.
  if (body.submitted_by && body.submitted_by !== req.userId) {
    res.status(403).json({ error: 'submitted_by does not match authenticated user' });
    return;
  }

  const entity = await loadEntity(entityType, entityId);
  if (!entity) {
    res.status(404).json({ error: 'This profile does not exist.', code: 'PROFILE_NOT_FOUND' });
    return;
  }
  const owner = ownerOf(entityType, entity);
  const entityName = String((entity as { name?: string }).name || body.entityName || body.brand_name || entityId);

  // ── Not the owner → this is an OWNERSHIP CLAIM (community profiles only). ──
  if (owner !== req.userId) {
    if (userCanManageVerifications(req)) {
      res.status(403).json({ error: 'Choosify staff cannot file ownership claims. Use the explicit ownership assignment workflow.', code: 'STAFF_CANNOT_CLAIM' });
      return;
    }
    try {
      const { claim, reused } = await createOwnershipClaim({
        req,
        type: entityType,
        entityId,
        claimant: {
          id: req.userId!,
          role: String(req.userRole || ''),
          displayName: body.submitted_by_name?.trim() || req.user?.displayName || '',
        },
        source: body.claimSource === 'invitation' ? 'invitation' : 'storefront',
        intentId: body.claimIntentId ? String(body.claimIntentId) : undefined,
        documents: body.documents,
        submit: body.status !== 'Draft',
        claimantDetails: normalizeClaimantDetails(body.claimantDetails),
      });
      if (!reused && claim.status === 'Submitted') await afterClaimSubmitted(req, claim);
      else if (!reused) {
        recordAccountActivity(req, { userId: claim.submitted_by, type: 'ownership_claim_started', category: 'verification', summary: `Ownership claim started for ${claim.entityName}` });
      }
      res.status(reused ? 200 : 201).json({ success: true, data: claim, reused });
    } catch (error) {
      sendClaimError(res, error, 'Unable to create ownership claim');
    }
    return;
  }

  // ── The owner verifying their own profile (owner_verification). ──
  const documents = Array.isArray(body.documents) ? body.documents : [];
  for (const doc of documents) {
    if (!doc?.type || !doc?.name || !doc?.doc_url) {
      res.status(400).json({ error: 'Each document requires type, name, and doc_url' });
      return;
    }
  }
  const activeOwnerRequest = operationsStore
    .listVerifications({ entityType, entityId })
    .find((row) => ACTIVE_VERIFICATION_STATUSES.has(row.status) && verificationKindOf(row, owner) === 'owner_verification');
  if (activeOwnerRequest) {
    res.status(409).json({
      error: 'You already have an open verification request for this profile',
      existingVerificationId: activeOwnerRequest.id,
    });
    return;
  }

  const status =
    body.status === 'Draft' ||
    body.status === 'Submitted' ||
    body.status === 'Under Review'
      ? body.status
      : 'Submitted';

  const actorName = body.submitted_by_name?.trim() || req.user?.displayName || req.userId || 'Owner';
  const saved = operationsStore.createVerification({
    entityType,
    entityId,
    entityName,
    brand_id: entityId,
    brand_name: entityName,
    logo_url: body.logo_url || '',
    submitted_by: req.userId!,
    submitted_by_name: actorName,
    status,
    kind: 'owner_verification',
    documents: documents.map((doc, index) => ({
      id: doc.id || `doc_${Date.now()}_${index}`,
      type: doc.type,
      name: doc.name,
      doc_url: doc.doc_url,
      // Never trust client-supplied approval/rejection on create.
      status: 'pending' as const,
      notes: undefined,
    })),
    audit_trail: [
      {
        timestamp: new Date().toISOString(),
        action: status === 'Draft' ? 'Draft Created' : 'Request Submitted',
        actor: actorName,
        details: status === 'Draft' ? 'Initialized a draft verification dossier' : 'Verification documents submitted for review',
      },
    ],
  });

  if (status === 'Submitted' || status === 'Under Review') {
    if (entityType === 'brand') {
      publishEvent({
        eventName: 'BrandVerificationSubmitted',
        domain: 'Marketplace',
        producer: 'operationsRouter',
        aggregateId: entityId,
        actor: req.userId!,
        payload: { verificationId: saved.id, entityId, entityName },
      });
    }
    try {
      await notifyRoles(['admin', 'super_admin', 'moderator'], {
        type: 'system_alert',
        category: 'admin',
        eventKey: 'staff.verification_submitted',
        persona: 'staff',
        title: entityType === 'brand' ? 'Seller Verification Submitted' : 'Creator Verification Submitted',
        summary: `${actorName} submitted a ${entityType} verification for "${entityName}".`,
        actionUrl: staffVerificationUrl(entityType, entityId),
        metadata: { verificationId: saved.id, entityType, entityId },
      });
    } catch (err) {
      console.error('[Verification] Failed to notify admins of verification submission:', err);
    }
  }

  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

/** Current owner of every brand / creator (for deriving `kind` on legacy rows). */
async function ownerLookup(): Promise<(type: string, id: string) => string> {
  const [brands, creators] = await Promise.all([catalogStore.listBrands(), catalogStore.listCreators()]);
  const b = new Map(brands.map((x) => [x.id, x.sellerId || '']));
  const c = new Map(creators.map((x) => [x.id, x.userId || '']));
  return (type, id) => (type === 'creator' ? c.get(id) : b.get(id)) || '';
}

const withKind = (row: OpsVerificationRequest, ownerOfRow: (type: string, id: string) => string) => ({
  ...row,
  kind: verificationKindOf(row, ownerOfRow(row.entityType, row.entityId)),
});

operationsRouter.get('/operations/verifications', ...requireAuth, async (req, res) => {
  const statusQ = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const kindQ = typeof req.query.kind === 'string' ? req.query.kind.trim() : '';
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  await expireStaleClaims().catch(() => []);

  // status=pending → awaiting staff (Submitted / Under Review); status=open → any active state.
  const statusSet = statusQ
    ? new Set(
        (statusQ.toLowerCase() === 'pending'
          ? ['submitted', 'under review']
          : statusQ.toLowerCase() === 'open'
            ? ['draft', 'submitted', 'under review']
            : statusQ.split(',')
        ).map((x) => x.trim().toLowerCase()),
      )
    : null;

  const redactForOwner = (rows: OpsVerificationRequest[]) =>
    rows.map((row) => ({
      ...row,
      documents: (row.documents || []).map((doc) => ({
        ...doc,
        // Internal admin notes must not leak to owners.
        notes: doc.status === 'rejected' ? doc.notes : undefined,
      })),
      reviews: (row.reviews || []).map((rv) => ({
        id: rv.id,
        status: rv.status,
        reviewed_at: rv.reviewed_at,
        // Keep rejection-facing feedback only; strip reviewer identity internals for owners.
        feedback: rv.status === 'rejected' ? rv.feedback : undefined,
      })),
    }));

  const staff = userCanManageVerifications(req);
  const base = staff
    ? operationsStore.listVerifications({ entityType, entityId })
    : operationsStore.listVerifications({ submittedBy: req.userId, entityType, entityId });
  const ownerOfRow = await ownerLookup();
  const rows = base
    .filter((r) => !statusSet || statusSet.has(String(r.status).toLowerCase()))
    .map((r) => withKind(r, ownerOfRow))
    .filter((r) => !kindQ || r.kind === kindQ);
  res.json({ data: staff ? rows : redactForOwner(rows) });
});

operationsRouter.get('/operations/verifications/:id', ...requireAuth, async (req, res) => {
  const row = operationsStore.getVerification(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (!userCanViewVerification(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this verification request' });
    return;
  }
  const ownerOfRow = await ownerLookup();
  if (userCanManageVerifications(req)) {
    res.json({ data: withKind(row, ownerOfRow) });
    return;
  }
  res.json({
    data: {
      ...withKind(row, ownerOfRow),
      documents: (row.documents || []).map((doc) => ({
        ...doc,
        notes: doc.status === 'rejected' ? doc.notes : undefined,
      })),
      reviews: (row.reviews || []).map((rv) => ({
        id: rv.id,
        status: rv.status,
        reviewed_at: rv.reviewed_at,
        feedback: rv.status === 'rejected' ? rv.feedback : undefined,
      })),
    },
  });
});

/** Submitter or admin may move Draft → Submitted (and into Under Review queue). */
function normalizeClaimantDetails(raw: unknown): ClaimantDetails | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  const text = (k: string, max: number) => String(d[k] ?? '').trim().slice(0, max);
  return {
    relationship: d.relationship === 'representative' ? 'representative' : d.relationship === 'owner' ? 'owner' : ('' as ClaimantDetails['relationship']),
    roleTitle: text('roleTitle', 80),
    fullName: text('fullName', 120),
    phone: text('phone', 30),
    email: text('email', 160).toLowerCase(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The claimant saves who they are (owner / representative, role, name, phone,
 * official email) on their own open ownership claim. Required before submit.
 */
operationsRouter.patch('/operations/verifications/:id/claimant-details', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (!req.userId || existing.submitted_by !== req.userId) {
    res.status(403).json({ error: 'Only the claimant can update these details' });
    return;
  }
  const entity = await loadEntity(existing.entityType === 'creator' ? 'creator' : 'brand', existing.entityId);
  const owner = ownerOf(existing.entityType === 'creator' ? 'creator' : 'brand', entity);
  if (verificationKindOf(existing, owner) !== 'ownership_claim') {
    res.status(409).json({ error: 'Claimant details belong to ownership claims only', code: 'NOT_OWNERSHIP_CLAIM' });
    return;
  }
  if (!ACTIVE_VERIFICATION_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `This claim is ${existing.status.toLowerCase()}.`, code: 'VERIFICATION_CLOSED' });
    return;
  }
  const details = normalizeClaimantDetails(req.body);
  const problem = claimantDetailsProblem(details);
  if (!details || problem) {
    res.status(400).json({ error: problem || 'Claimant details are required', code: 'INVALID_CLAIMANT_DETAILS' });
    return;
  }
  const saved = operationsStore.updateVerification(existing.id, {
    claimantDetails: details,
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: details.updatedAt!,
        action: existing.claimantDetails ? 'Claimant Details Updated' : 'Claimant Details Added',
        actor: req.user?.displayName || req.userId,
        details: `${details.fullName} — ${details.relationship === 'owner' ? 'Owner' : 'Representative'} (${details.roleTitle})`,
      },
    ],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/verifications/:id/submit', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (!userCanViewVerification(req, existing)) {
    res.status(403).json({ error: 'Not authorized to submit this verification request' });
    return;
  }
  if (existing.status !== 'Draft' && existing.status !== 'Submitted') {
    res.status(400).json({ error: `Cannot submit from status ${existing.status}` });
    return;
  }
  const submitEntity = await loadEntity(existing.entityType === 'creator' ? 'creator' : 'brand', existing.entityId);
  const submitOwner = ownerOf(existing.entityType === 'creator' ? 'creator' : 'brand', submitEntity);
  const submitKind = verificationKindOf(existing, submitOwner);
  if (submitKind === 'ownership_claim' && submitOwner) {
    res.status(409).json({ error: 'This profile already has an owner, so the claim cannot be submitted.', code: 'PROFILE_ALREADY_OWNED' });
    return;
  }
  if (submitKind === 'ownership_claim') {
    const detailsProblem = claimantDetailsProblem(existing.claimantDetails);
    if (detailsProblem) {
      res.status(400).json({ error: `Add your details before submitting: ${detailsProblem}`, code: 'CLAIMANT_DETAILS_MISSING' });
      return;
    }
  }
  {
    const missing = missingDocsMessage(existing, submitKind);
    if (missing) {
      res.status(400).json({ error: `Upload every required document before submitting. Missing: ${missing}`, code: 'VERIFICATION_DOCUMENTS_MISSING' });
      return;
    }
  }
  const actor = req.user?.displayName || req.userId || 'Claimant';
  const saved = operationsStore.updateVerification(req.params.id, {
    status: 'Submitted',
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: new Date().toISOString(),
        action: 'Form Submitted',
        actor,
        details: 'Dossier dispatched to lead auditor verification queue',
      },
    ],
  });
  if (submitKind === 'ownership_claim' && saved) {
    if (existing.status === 'Draft') {
      recordAudit(req, {
        action: 'claim_submitted',
        targetType: existing.entityType === 'creator' ? 'creator' : 'brand',
        targetId: existing.entityId,
        targetName: existing.entityName,
        refs: { claimId: existing.id, ...(existing.claimSource ? { source: existing.claimSource } : {}) },
      });
    }
    await afterClaimSubmitted(req, saved);
  } else {
    recordAccountActivity(req, { userId: existing.submitted_by, type: 'verification_submitted', category: 'verification', summary: `Verification submitted for review (${existing.entityName || existing.brand_name})` });
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch(
  '/operations/verifications/:id/document/:docId',
  ...requireModerator,
  async (req, res) => {
    if (!userCanManageVerifications(req)) {
      res.status(403).json({ error: 'Not authorized to audit verification documents' });
      return;
    }
    const existing = operationsStore.getVerification(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Verification request not found' });
      return;
    }
    if (await refuseClosedClaimDocumentChange(existing, res)) return;
    // A finished request is changed only through Revoke (POST .../revoke), which
    // also removes the verified badge and reopens the request for the owner.
    if (!ACTIVE_VERIFICATION_STATUSES.has(existing.status)) {
      res.status(409).json({
        error: `This verification request is ${existing.status.toLowerCase()}. Revoke the approval to reopen it before changing documents.`,
        code: 'VERIFICATION_CLOSED',
      });
      return;
    }
    const status = req.body?.status === 'rejected' ? 'rejected' : req.body?.status === 'approved' ? 'approved' : '';
    if (!status) {
      res.status(400).json({ error: 'status must be approved or rejected' });
      return;
    }
    const notes =
      typeof req.body?.notes === 'string'
        ? req.body.notes.trim()
        : typeof req.body?.adminComment === 'string'
          ? req.body.adminComment.trim()
          : undefined;
    const actor = req.user?.displayName || req.userId || 'Administrative Auditor';
    // Self-approve / self-reject of own dossier documents is forbidden.
    if (req.userId && existing.submitted_by === req.userId) {
      res.status(403).json({ error: 'Cannot approve or reject your own verification documents' });
      return;
    }
    const saved = operationsStore.updateVerificationDocument(req.params.id, req.params.docId, {
      status,
      notes,
    });
    if (!saved) {
      res.status(404).json({ error: 'Document not found on this verification request' });
      return;
    }
    const withAudit = operationsStore.updateVerification(req.params.id, {
      // Reviewing a document of a draft keeps it a draft: the owner is still
      // uploading and submits the whole request when it is complete.
      status: saved.status === 'Submitted' ? 'Under Review' : saved.status,
      audit_trail: [
        ...saved.audit_trail,
        {
          timestamp: new Date().toISOString(),
          action: 'Document Audited',
          actor,
          details: `Document item state updated to ${status}. Notes: ${notes || 'none'}`,
        },
      ],
    });
    {
      const reviewedDoc = (existing.documents || []).find((d) => d.id === req.params.docId);
      if (existing.submitted_by) {
        recordAccountActivity(req, {
          userId: existing.submitted_by,
          type: status === 'rejected' ? 'verification_document_rejected' : 'verification_document_approved',
          category: 'verification',
          actor: 'staff',
          summary: `${reviewedDoc ? verificationDocumentLabel(existing.entityType, reviewedDoc.type) : 'Document'} ${status === 'rejected' ? `rejected — ${notes || 'no reason given'}` : 'approved'}`,
        });
      }
    }
    Logger.audit('verification.document_reviewed', {
      actorId: req.userId,
      verificationId: req.params.id,
      docId: req.params.docId,
      status,
    });
    if (status === 'rejected' && existing.submitted_by) {
      const doc = (existing.documents || []).find((d) => d.id === req.params.docId);
      notifyUser(existing.submitted_by, {
        type: COMMUNICATION_TYPES.MODERATION_UPDATE,
        category: 'seller',
        eventKey: 'verification.update',
        persona: existing.entityType === 'creator' ? 'creator' : 'seller',
        title: 'A verification document needs to be replaced',
        summary: `${doc ? verificationDocumentLabel(existing.entityType, doc.type) : 'A document'}: ${notes || 'rejected by Choosify'}`,
        actionUrl: existing.entityType === 'creator' ? '/admin/creator-profile?tab=verification' : '/admin/brand-profile?tab=verification',
      }).catch((err) => Logger.error('notifyUser failed (verification document rejected)', { error: String(err) }));
    }
    scheduleOperationsPersist();
    res.json({ success: true, data: withAudit || saved });
  },
);

/**
 * Profile-owner document replace/re-upload.
 * Resets document status to pending so Admin must re-review.
 * Does not grant approve/reject authority.
 */
operationsRouter.put(
  '/operations/verifications/:id/document/:docId/replace',
  ...requireAuth,
  async (req, res) => {
    const existing = operationsStore.getVerification(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Verification request not found' });
      return;
    }
    if (await refuseClosedClaimDocumentChange(existing, res)) return;
    const replaceType: ClaimEntityType = existing.entityType === 'creator' ? 'creator' : 'brand';
    const replacingClaimDoc =
      verificationKindOf(existing, ownerOf(replaceType, await loadEntity(replaceType, existing.entityId))) === 'ownership_claim';
    const isOwner = Boolean(req.userId && existing.submitted_by === req.userId);
    const isAdmin = userCanManageVerifications(req);
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorized to replace this verification document' });
      return;
    }
    const docUrl = typeof req.body?.doc_url === 'string' ? req.body.doc_url.trim() : '';
    if (!docUrl) {
      res.status(400).json({ error: 'doc_url is required' });
      return;
    }
    if (replacingClaimDoc && !docUrl.includes('/catalog/media/private/')) {
      res.status(400).json({ error: 'doc_url must be a private verification upload (POST /operations/media/upload-verification)', code: 'DOCUMENT_NOT_PRIVATE_UPLOAD' });
      return;
    }
    const name =
      typeof req.body?.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : undefined;
    const actor = req.user?.displayName || req.userId || 'Document Owner';
    const saved = operationsStore.updateVerificationDocument(req.params.id, req.params.docId, {
      doc_url: docUrl,
      ...(name ? { name } : {}),
      status: 'pending',
      notes: undefined,
    });
    if (!saved) {
      res.status(404).json({ error: 'Document not found on this verification request' });
      return;
    }
    // Replacing a document invalidates prior approval — Admin must re-review.
    let nextOverall = existing.status;
    if (replacingClaimDoc) {
      // Claims never auto-submit or reopen here: a Draft claim is submitted only
      // through /submit (document + ownership gates); closed claims were refused above.
      nextOverall = existing.status;
    } else if (existing.status === 'Approved' || existing.status === 'Rejected') {
      nextOverall = 'Under Review';
    } else if (existing.status === 'Draft') {
      nextOverall = 'Submitted';
    }
    const withAudit = operationsStore.updateVerification(req.params.id, {
      status: nextOverall,
      audit_trail: [
        ...saved.audit_trail,
        {
          timestamp: new Date().toISOString(),
          action: 'Document Replaced',
          actor,
          details: 'Owner replaced a verification document; status reset to pending for Admin review',
        },
      ],
    });
    scheduleOperationsPersist();
    if (existing.submitted_by) {
      recordAccountActivity(req, {
        userId: existing.submitted_by,
        type: 'verification_document_replaced',
        category: 'verification',
        actor: isOwner ? 'self' : 'staff',
        summary: `Replaced a verification document (${name || 'new file'})`,
      });
    }
    Logger.audit('verification.document_replaced', {
      actorId: req.userId,
      verificationId: req.params.id,
      docId: req.params.docId,
      overallStatus: nextOverall,
    });
    res.json({ success: true, data: withAudit || saved });
  },
);

/**
 * Owner (or Admin) removes a document from an open request — e.g. a wrong
 * file uploaded by mistake. Documents Choosify already approved stay; closed
 * requests cannot change.
 */
operationsRouter.delete('/operations/verifications/:id/document/:docId', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (await refuseClosedClaimDocumentChange(existing, res)) return;
  const isOwner = Boolean(req.userId && existing.submitted_by === req.userId);
  const isAdmin = userCanManageVerifications(req);
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Not authorized to remove this verification document' });
    return;
  }
  if (existing.status === 'Approved' || existing.status === 'Rejected') {
    res.status(409).json({ error: `This request is already ${existing.status.toLowerCase()} and cannot be changed.` });
    return;
  }
  const doc = (existing.documents || []).find((d) => d.id === req.params.docId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found on this verification request' });
    return;
  }
  if (doc.status === 'approved' && !isAdmin) {
    res.status(409).json({ error: 'Choosify already approved this document. Use Upload New to replace it instead.' });
    return;
  }
  const actor = req.user?.displayName || req.userId || 'Document Owner';
  const saved = operationsStore.updateVerification(existing.id, {
    documents: existing.documents.filter((d) => d.id !== doc.id),
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: new Date().toISOString(),
        action: 'Document Removed',
        actor,
        details: `${isOwner ? 'Owner' : 'Staff'} removed ${verificationDocumentLabel(existing.entityType, doc.type)}: ${doc.name}`,
      },
    ],
  });
  scheduleOperationsPersist();
  Logger.audit('verification.document_removed', { actorId: req.userId, verificationId: existing.id, docId: doc.id, byOwner: isOwner });
  recordAccountActivity(req, {
    userId: existing.submitted_by,
    type: 'verification_document_removed',
    category: 'verification',
    actor: isOwner ? 'self' : 'staff',
    summary: `Removed ${verificationDocumentLabel(existing.entityType, doc.type)}: ${doc.name}`,
  });
  res.json({ success: true, data: saved });
});

const VERIFICATION_DOC_TYPES: readonly OpsVerificationDocument['type'][] = VERIFICATION_DOCUMENT_TYPES;

function missingDocsMessage(row: OpsVerificationRequest, kind?: string): string | null {
  const missing =
    kind === 'ownership_claim'
      ? missingClaimDocuments(row.entityType, row.documents || [], row.claimantDetails?.relationship)
      : missingRequiredDocuments(row.entityType, row.documents || [], kind);
  return missing.length ? missing.map((m) => m.label).join(', ') : null;
}

/**
 * Profile-owner (or Admin) adds a document to an open request — how an owner
 * answers "please send your Tax Certificate". Only private verification
 * uploads are accepted. Closed (Approved / Rejected) requests cannot change;
 * the owner starts a new request instead.
 */
operationsRouter.post('/operations/verifications/:id/documents', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  const isOwner = Boolean(req.userId && existing.submitted_by === req.userId);
  if (!isOwner && !userCanManageVerifications(req)) {
    res.status(403).json({ error: 'Not authorized to add documents to this verification request' });
    return;
  }
  if (!ACTIVE_VERIFICATION_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `This request is already ${existing.status.toLowerCase()}. Start a new verification request instead.` });
    return;
  }
  const type = String(req.body?.type || '') as OpsVerificationDocument['type'];
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 200) : '';
  const docUrl = typeof req.body?.doc_url === 'string' ? req.body.doc_url.trim() : '';
  if (!VERIFICATION_DOC_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VERIFICATION_DOC_TYPES.join(', ')}` });
    return;
  }
  if (type === PROFILE_PHOTO_DOCUMENT) {
    res.status(400).json({ error: 'The profile photo is attached from the account picture — use POST /operations/verifications/:id/profile-photo' });
    return;
  }
  if (!name || !docUrl) {
    res.status(400).json({ error: 'name and doc_url are required' });
    return;
  }
  if (!docUrl.includes('/catalog/media/private/')) {
    res.status(400).json({ error: 'doc_url must be a private verification upload (POST /operations/media/upload-verification)' });
    return;
  }
  const actor = req.user?.displayName || req.userId || 'Document Owner';
  const doc: OpsVerificationDocument = { id: `doc_${randomUUID()}`, type, name, doc_url: docUrl, status: 'pending' };
  const saved = operationsStore.updateVerification(existing.id, {
    documents: [...(existing.documents || []), doc],
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: new Date().toISOString(),
        action: 'Document Added',
        actor,
        details: `${isOwner ? 'Owner' : 'Staff'} added ${type}: ${name}`,
      },
    ],
  });
  scheduleOperationsPersist();
  recordAccountActivity(req, {
    userId: existing.submitted_by,
    type: 'verification_document_added',
    category: 'verification',
    actor: isOwner ? 'self' : 'staff',
    summary: `Uploaded ${verificationDocumentLabel(existing.entityType, type)}: ${name}`,
  });
  Logger.audit('verification.document_added', {
    actorId: req.userId,
    verificationId: existing.id,
    docId: doc.id,
    type,
    byOwner: isOwner,
  });
  if (isOwner && existing.status !== 'Draft') {
    try {
      await notifyRoles(['admin', 'super_admin', 'moderator'], {
        type: 'system_alert',
        category: 'admin',
        eventKey: 'staff.verification_submitted',
        persona: 'staff',
        title: 'Verification document added',
        summary: `${actor} added a ${type} to the ${existing.entityType || 'brand'} verification for "${existing.entityName || existing.brand_name}".`,
        actionUrl: staffVerificationUrl(existing.entityType || 'brand', existing.entityId || existing.brand_id),
        metadata: { verificationId: existing.id, entityType: existing.entityType, entityId: existing.entityId },
      });
    } catch (err) {
      console.error('[Verification] Failed to notify staff of added document:', err);
    }
  }
  res.status(201).json({ success: true, data: saved });
});

/**
 * Photo verification: snapshot the submitter's CURRENT profile picture (read
 * server-side from the account, never from the client) into the request as
 * the 'Profile Photo' document, replacing any earlier snapshot. Owners can
 * change their picture any time and call this again to re-submit it.
 */
operationsRouter.post('/operations/verifications/:id/profile-photo', ...requireAuth, async (req, res) => {
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (!req.userId || existing.submitted_by !== req.userId) {
    res.status(403).json({ error: 'Only the account owner can attach their profile photo' });
    return;
  }
  if (existing.status === 'Approved' || existing.status === 'Rejected') {
    res.status(409).json({ error: `This request is already ${existing.status.toLowerCase()}. Start a new verification request instead.` });
    return;
  }
  const rows = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, req.userId)).limit(1);
  const avatarUrl = String(rows[0]?.avatarUrl || '').trim();
  if (!avatarUrl) {
    res.status(400).json({ error: 'Add a profile picture to your account first.', code: 'PROFILE_PHOTO_MISSING' });
    return;
  }
  const actor = req.user?.displayName || req.userId;
  const previous = (existing.documents || []).find((d) => d.type === PROFILE_PHOTO_DOCUMENT);
  const doc: OpsVerificationDocument = {
    id: previous?.id || `doc_${randomUUID()}`,
    type: PROFILE_PHOTO_DOCUMENT,
    name: 'Profile photo (account picture)',
    doc_url: avatarUrl,
    status: 'pending',
  };
  const saved = operationsStore.updateVerification(existing.id, {
    documents: [...(existing.documents || []).filter((d) => d.type !== PROFILE_PHOTO_DOCUMENT), doc],
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: new Date().toISOString(),
        action: previous ? 'Document Replaced' : 'Document Added',
        actor,
        details: previous ? 'Owner re-submitted their current profile photo' : 'Owner attached their profile photo for photo verification',
      },
    ],
  });
  scheduleOperationsPersist();
  Logger.audit('verification.profile_photo_attached', { actorId: req.userId, verificationId: existing.id, replaced: Boolean(previous) });
  recordAccountActivity(req, { userId: req.userId, type: 'verification_photo_submitted', category: 'verification', summary: 'Submitted the current profile photo for photo verification' });
  res.status(201).json({ success: true, data: saved });
});

/** Owner of a verification subject: the brand's seller or the creator's account. */
async function verificationSubjectOwner(entityType: 'brand' | 'creator', entityId: string): Promise<{ ownerUserId: string; name: string } | null> {
  if (entityType === 'creator') {
    const c = (await catalogStore.listCreators()).find((x) => x.id === entityId);
    return c?.userId ? { ownerUserId: c.userId, name: c.name } : null;
  }
  const b = await catalogStore.getBrand(entityId).catch(() => null);
  return b?.sellerId ? { ownerUserId: b.sellerId, name: b.name } : null;
}

/**
 * Staff "Ask to Upload": ask the owner for specific verification documents
 * (missing or to be re-uploaded). Works with or without an existing request.
 * Notifies the owner, shows in their Verification Center and Activity Log.
 */
operationsRouter.post('/operations/verification-document-requests', ...requireAuth, async (req, res) => {
  if (!userCanManageVerifications(req)) {
    res.status(403).json({ error: 'Not authorized to request verification documents' });
    return;
  }
  const entityType = req.body?.entityType === 'creator' ? 'creator' : req.body?.entityType === 'brand' ? 'brand' : null;
  const entityId = String(req.body?.entityId || '').trim();
  const docTypes = Array.isArray(req.body?.docTypes)
    ? [...new Set((req.body.docTypes as unknown[]).map((t) => String(t)).filter((t) => (VERIFICATION_DOC_TYPES as readonly string[]).includes(t)))]
    : [];
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
  if (!entityType || !entityId || !docTypes.length) {
    res.status(400).json({ error: 'entityType, entityId and at least one valid docTypes entry are required' });
    return;
  }
  const subject = await verificationSubjectOwner(entityType, entityId);
  if (!subject) {
    res.status(404).json({ error: 'This profile has no owner account to ask' });
    return;
  }
  if (subject.ownerUserId === req.userId) {
    res.status(400).json({ error: 'You cannot request documents from yourself' });
    return;
  }
  const labels = docTypes.map((t) => verificationDocumentLabel(entityType, t));
  const request = operationsStore.addVerificationDocRequest({
    id: `vdr_${randomUUID()}`,
    entityType,
    entityId,
    ownerUserId: subject.ownerUserId,
    docTypes,
    ...(note ? { note } : {}),
    actorId: req.userId!,
    actorName: req.user?.displayName,
    at: new Date().toISOString(),
  });
  // Mirror onto the open request's audit trail so both sides see it in the history.
  // Mirror only onto the OWNER's own verification — never onto someone's ownership claim.
  const open = operationsStore
    .listVerifications({ entityType, entityId })
    .filter((v) => ACTIVE_VERIFICATION_STATUSES.has(v.status) && verificationKindOf(v, subject.ownerUserId || '') === 'owner_verification')
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (open) {
    operationsStore.updateVerification(open.id, {
      audit_trail: [
        ...open.audit_trail,
        { timestamp: request.at, action: 'Documents Requested', actor: req.user?.displayName || 'Choosify', details: `Please upload: ${labels.join(', ')}${note ? ` — ${note}` : ''}` },
      ],
    });
  }
  scheduleOperationsPersist();
  Logger.audit('verification.documents_requested', { actorId: req.userId, entityType, entityId, docTypes });
  recordAccountActivity(req, {
    userId: subject.ownerUserId,
    type: 'verification_documents_requested',
    category: 'verification',
    actor: 'staff',
    summary: `Choosify asked you to upload: ${labels.join(', ')}${note ? ` — ${note}` : ''}`,
  });
  try {
    await notifyUser(subject.ownerUserId, {
      type: COMMUNICATION_TYPES.MODERATION_UPDATE,
      category: 'seller',
      eventKey: 'verification.update',
      persona: entityType === 'creator' ? 'creator' : 'seller',
      title: 'Please upload verification documents',
      summary: `Choosify needs: ${labels.join(', ')}${note ? ` — ${note}` : ''}`,
      actionUrl: entityType === 'creator' ? '/admin/creator-profile?tab=verification' : '/admin/brand-profile?tab=verification',
      metadata: { requestId: request.id, entityType, entityId },
    });
  } catch (err) {
    Logger.error('notifyUser failed (verification documents requested)', { error: String(err) });
  }
  res.status(201).json({ success: true, data: request });
});

operationsRouter.get('/operations/verification-document-requests', ...requireAuth, async (req, res) => {
  const entityType = req.query.entityType === 'creator' ? 'creator' : req.query.entityType === 'brand' ? 'brand' : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
  if (userCanManageVerifications(req)) {
    res.json({ success: true, data: operationsStore.listVerificationDocRequests({ entityType, entityId }) });
    return;
  }
  // Owners: only requests addressed to them.
  const mine = operationsStore.listVerificationDocRequests({ entityType, entityId }).filter((r) => r.ownerUserId === req.userId);
  res.json({ success: true, data: mine.map(({ actorId: _a, actorName: _n, ...rest }) => rest) });
});

// ---------------------------------------------------------------------------
// Community Claimable Profiles — intents, withdrawal, document reuse, public
// ownership state, explicit staff assignment, audit history.
// ---------------------------------------------------------------------------

const claimTypeOf = (v: unknown): ClaimEntityType | null => (v === 'brand' || v === 'creator' ? v : null);

/** Start a claim: returns a short-lived, server-issued claim reference (anyone may start one). */
operationsRouter.post('/operations/claim-intents', softAuthenticateRequest, async (req, res) => {
  const type = claimTypeOf(req.body?.entityType);
  const entityId = String(req.body?.entityId || '').trim();
  if (!type || !entityId) {
    res.status(400).json({ error: 'entityType (brand|creator) and entityId are required' });
    return;
  }
  try {
    // Bound to the viewer only when that account can claim; otherwise it stays open
    // for the right account type (sign-in / partner application).
    const bindTo = req.userId && roleCanClaim(type, String(req.userRole || '')) ? req.userId : undefined;
    const { intent, ownership } = await createClaimIntent({ type, entityId, source: req.body?.source === 'invitation' ? 'invitation' : 'storefront', userId: bindTo });
    res.status(201).json({ success: true, data: { id: intent.id, entityType: intent.entityType, entityId: intent.entityId, expiresAt: intent.expiresAt, ownership } });
  } catch (error) {
    sendClaimError(res, error, 'Unable to start claim');
  }
});

/** Resolve a claim reference after sign-in / sign-up: target, current ownership, the viewer's eligibility and claim. */
operationsRouter.get('/operations/claim-intents/:id', softAuthenticateRequest, async (req, res) => {
  try {
    const { intent, entity } = await resolveClaimIntent(req.params.id, req.userId, String(req.userRole || ''));
    const type = intent.entityType;
    const owner = ownerOf(type, entity);
    const open = activeOwnershipClaims(type, entity.id, owner);
    const myClaim =
      (req.userId && (intent.claimId ? operationsStore.getVerification(intent.claimId) : null)) ||
      (req.userId ? operationsStore.listVerifications({ entityType: type, entityId: entity.id, submittedBy: req.userId }).find((r) => verificationKindOf(r, owner) === 'ownership_claim') : null) ||
      null;
    const ownership = publicOwnership(type, entity, open.length > 0);
    const role = String(req.userRole || '');
    const isStaff = userCanManageVerifications(req);
    const e = entity as unknown as Record<string, unknown>;
    res.json({
      success: true,
      data: {
        intent: { id: intent.id, entityType: type, entityId: intent.entityId, expiresAt: intent.expiresAt, source: intent.source },
        target: {
          id: entity.id,
          name: String(e.name || ''),
          slug: String(e.slug || ''),
          image: String((type === 'brand' ? e.logo : e.avatar) || ''),
          category: String(e.category || ''),
        },
        ownership,
        viewer: {
          authenticated: Boolean(req.userId),
          role: role || null,
          requiredRole: requiredRoleFor(type),
          eligible: Boolean(req.userId) && !isStaff && roleCanClaim(type, role),
          isOwner: Boolean(req.userId && owner === req.userId),
          isStaff,
        },
        // What a claim must include — the same list the submit + approval gates use.
        requiredDocuments: verificationDocumentSpecs(type, 'ownership_claim'),
        myClaim: myClaim && myClaim.submitted_by === req.userId
          ? {
              id: myClaim.id,
              status: myClaim.status,
              created_at: myClaim.created_at,
              updated_at: myClaim.updated_at,
              closedReason: myClaim.closedReason || null,
              claimantDetails: myClaim.claimantDetails || null,
              documents: (myClaim.documents || []).map((d) => ({ id: d.id, type: d.type, name: d.name, status: d.status, notes: d.notes || null })),
              // The claimant's own claim history (no staff names).
              history: [...(myClaim.audit_trail || [])]
                .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
                .slice(0, 30)
                .map((e) => ({ at: e.timestamp, action: e.action, details: e.details || '' })),
              latestFeedback:
                [...(myClaim.audit_trail || [])]
                  .reverse()
                  .find((e) => e.action === 'Additional Information Requested' || /reject/i.test(e.action))?.details ||
                [...(myClaim.reviews || [])].reverse().find((r) => r.feedback)?.feedback ||
                null,
            }
          : null,
      },
    });
  } catch (error) {
    sendClaimError(res, error, 'Unable to load claim');
  }
});

/** Public, authoritative ownership state for one profile (no claimant details). */
operationsRouter.get('/operations/ownership/:entityType/:entityId', softAuthenticateRequest, async (req, res) => {
  const type = claimTypeOf(req.params.entityType);
  if (!type) {
    res.status(400).json({ error: 'entityType must be brand or creator' });
    return;
  }
  await expireStaleClaims().catch(() => []);
  const entity = await loadEntity(type, req.params.entityId);
  if (!entity) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  const owner = ownerOf(type, entity);
  res.json({ success: true, data: publicOwnership(type, entity, activeOwnershipClaims(type, entity.id, owner).length > 0) });
});

/** Claimant withdraws their own open ownership claim. History is kept. */
operationsRouter.post('/operations/verifications/:id/withdraw', ...requireAuth, async (req, res) => {
  const row = operationsStore.getVerification(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (row.submitted_by !== req.userId) {
    res.status(403).json({ error: 'Only the person who filed the claim can withdraw it' });
    return;
  }
  const type: ClaimEntityType = row.entityType === 'creator' ? 'creator' : 'brand';
  if (verificationKindOf(row, ownerOf(type, await loadEntity(type, row.entityId))) !== 'ownership_claim') {
    res.status(400).json({ error: 'Only ownership claims can be withdrawn', code: 'NOT_A_CLAIM' });
    return;
  }
  try {
    const closed = await closeOwnershipClaim({ req, claimId: row.id, status: 'Withdrawn', actorName: req.user?.displayName || req.userId!, feedback: String(req.body?.reason || '').slice(0, 300) || undefined });
    recordAccountActivity(req, { userId: row.submitted_by, type: 'ownership_claim_withdrawn', category: 'verification', summary: `Ownership claim for ${row.entityName} withdrawn` });
    void emailUser(row.submitted_by, {
      subject: `Ownership claim withdrawn — ${row.entityName}`,
      heading: 'Claim withdrawn',
      lines: [`You withdrew your ownership claim for ${row.entityName}. You can start a new claim from the profile page at any time.`],
    });
    res.json({ success: true, data: closed });
  } catch (error) {
    sendClaimError(res, error, 'Unable to withdraw claim');
  }
});

/**
 * Claimant reuses documents Choosify ALREADY APPROVED on their own earlier
 * requests, for claim-required types the claim does not have yet. Copies keep
 * the private file and come in as `pending` — staff still review them for this
 * claim (approval on another request is evidence, not automatic acceptance).
 */
operationsRouter.post('/operations/verifications/:id/reuse-documents', ...requireAuth, async (req, res) => {
  const row = operationsStore.getVerification(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (row.submitted_by !== req.userId) {
    res.status(403).json({ error: 'Only the claimant can reuse their documents' });
    return;
  }
  if (!ACTIVE_VERIFICATION_STATUSES.has(row.status) || row.kind !== 'ownership_claim') {
    res.status(409).json({ error: 'Documents can only be reused on an open ownership claim', code: 'CLAIM_CLOSED' });
    return;
  }
  const needed = new Set(missingRequiredDocuments(row.entityType, row.documents || [], 'ownership_claim').map((m) => m.type));
  const reusable: OpsVerificationDocument[] = [];
  for (const other of operationsStore.listVerifications({ submittedBy: req.userId })) {
    if (other.id === row.id) continue;
    for (const d of other.documents || []) {
      if (d.status !== 'approved' || !needed.has(d.type) || !isPrivateUploadUrl(d.doc_url)) continue;
      needed.delete(d.type);
      reusable.push({ id: `doc_${randomUUID()}`, type: d.type, name: `${d.name} (reused from an earlier verification)`, doc_url: d.doc_url, status: 'pending' });
    }
  }
  if (!reusable.length) {
    res.json({ success: true, data: row, reused: 0 });
    return;
  }
  const now = new Date().toISOString();
  const saved = operationsStore.updateVerification(row.id, {
    documents: [...(row.documents || []), ...reusable],
    audit_trail: [...row.audit_trail, { timestamp: now, action: 'Documents Reused', actor: req.user?.displayName || req.userId!, details: `Reused previously approved: ${reusable.map((d) => d.type).join(', ')}` }],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved, reused: reusable.length });
});

/**
 * The explicit, separate ownership workflow (disputes / staff onboarding):
 * Super Admin assigns — or, with replaceExistingOwner + a reason, replaces —
 * a profile's owner. Never part of claim approval. Does not grant Marketplace Access.
 */
operationsRouter.post('/operations/ownership/assign', ...requireAuth, async (req, res) => {
  if (!hasRole(req.userRole, ROLES.SUPER_ADMIN) || req.realActorUserId) {
    res.status(403).json({ error: 'Only a Super Admin can assign profile ownership' });
    return;
  }
  const type = claimTypeOf(req.body?.entityType);
  const entityId = String(req.body?.entityId || '').trim();
  const userId = String(req.body?.userId || '').trim();
  const reason = String(req.body?.reason || '').trim();
  if (!type || !entityId || !userId) {
    res.status(400).json({ error: 'entityType, entityId and userId are required' });
    return;
  }
  if (reason.length < 10) {
    res.status(400).json({ error: 'A reason of at least 10 characters is required', code: 'REASON_REQUIRED' });
    return;
  }
  try {
    const result = await assignOwnerExplicitly({ req, type, entityId, userId, reason, replaceExistingOwner: req.body?.replaceExistingOwner === true });
    for (const c of result.closedClaims) {
      notifyUser(c.submitted_by, {
        type: COMMUNICATION_TYPES.MODERATION_UPDATE,
        category: 'seller',
        eventKey: 'verification.update',
        persona: type === 'creator' ? 'creator' : 'seller',
        title: 'Ownership claim closed',
        summary: `Ownership of ${c.entityName} was resolved by Choosify.`,
        actionUrl: ownerDashboardTab(type),
      }).catch(() => undefined);
    }
    recordAccountActivity(req, { userId, type: 'ownership_assigned', category: 'admin', actor: 'staff', summary: `Choosify staff made you the owner of ${(result.entity as { name?: string }).name}`, staffNote: reason });
    res.json({ success: true, data: result.entity, previousOwner: result.previousOwner || null });
  } catch (error) {
    sendClaimError(res, error, 'Unable to assign ownership');
  }
});

/** Queryable ownership / community-profile audit history (staff). */
operationsRouter.get('/operations/audit-events', ...requireAuth, (req, res) => {
  if (!userCanManageVerifications(req) && !hasRole(req.userRole, ROLES.SUPPORT_AGENT)) {
    res.status(403).json({ error: 'Not authorized to view audit history' });
    return;
  }
  const q = (k: string) => (typeof req.query[k] === 'string' ? (req.query[k] as string) : undefined);
  res.json({
    success: true,
    data: operationsStore.listAuditEvents({ targetType: q('targetType'), targetId: q('targetId'), action: q('action'), limit: Math.min(500, Number(q('limit')) || 200) }),
  });
});

/**
 * Revoke an approved OWNER verification (Admin / Super Admin): the profile loses
 * its verified badge, the chosen documents are rejected with the reason, and the
 * request reopens as "more information needed" so the owner can re-upload.
 * Ownership and Marketplace Access are not changed. Ownership claims are not
 * revocable here — replacing an owner uses the ownership-dispute workflow.
 */
operationsRouter.post('/operations/verifications/:id/revoke', ...requireModerator, async (req, res) => {
  const role = req.userRole;
  if (!role || !(hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPER_ADMIN))) {
    res.status(403).json({ error: 'Only an Admin or Super Admin can revoke a verification', code: 'REVOKE_NOT_ALLOWED' });
    return;
  }
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (req.userId && existing.submitted_by === req.userId) {
    res.status(403).json({ error: 'Cannot revoke your own verification' });
    return;
  }
  if (existing.status !== 'Approved') {
    res.status(409).json({ error: `Only an approved verification can be revoked (this one is ${existing.status.toLowerCase()}).`, code: 'NOT_APPROVED' });
    return;
  }
  const type: ClaimEntityType = existing.entityType === 'creator' ? 'creator' : 'brand';
  const owner = ownerOf(type, await loadEntity(type, existing.entityId));
  if (verificationKindOf(existing, owner) !== 'owner_verification') {
    res.status(409).json({ error: 'Ownership claims cannot be revoked here — use the ownership-dispute workflow.', code: 'NOT_OWNER_VERIFICATION' });
    return;
  }
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10) {
    res.status(400).json({ error: 'Give a reason of at least 10 characters — the owner sees it.', code: 'REASON_REQUIRED' });
    return;
  }
  const requested: unknown[] = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
  const docIds = [...new Set(requested.map((d) => String(d)))];
  const unknownDoc = docIds.find((id) => !(existing.documents || []).some((d) => d.id === id));
  if (unknownDoc) {
    res.status(400).json({ error: 'A selected document is not part of this verification request', code: 'UNKNOWN_DOCUMENT' });
    return;
  }
  const otherOpen = operationsStore
    .listVerifications({ entityType: existing.entityType, entityId: existing.entityId })
    .find((row) => row.id !== existing.id && ACTIVE_VERIFICATION_STATUSES.has(row.status) && verificationKindOf(row, owner) === 'owner_verification');
  if (otherOpen) {
    res.status(409).json({ error: 'The owner already has another open verification request for this profile — review that one instead.', code: 'OTHER_REQUEST_OPEN' });
    return;
  }

  // Badge first: if the catalog update fails, nothing else has changed.
  const sideEffect = await applyEntityVerificationSideEffect(existing, 'rejected');
  if (sideEffect.ok === false) {
    res.status(409).json({ error: sideEffect.error });
    return;
  }
  for (const docId of docIds) operationsStore.updateVerificationDocument(existing.id, docId, { status: 'rejected', notes: reason });
  const actor = req.user?.displayName || req.userId || 'Administrative Auditor';
  const labels = docIds.map((id) => {
    const d = (existing.documents || []).find((x) => x.id === id);
    return d ? verificationDocumentLabel(existing.entityType, d.type) : id;
  });
  const current = operationsStore.getVerification(existing.id) || existing;
  const saved = operationsStore.updateVerification(existing.id, {
    status: 'Under Review',
    audit_trail: [
      ...current.audit_trail,
      {
        timestamp: new Date().toISOString(),
        action: 'Approval Revoked',
        actor,
        details: `${reason}${labels.length ? ` Documents to replace: ${labels.join(', ')}.` : ''} Verified badge removed; request reopened.`,
      },
    ],
  });
  scheduleOperationsPersist();
  if (existing.submitted_by) {
    recordAccountActivity(req, {
      userId: existing.submitted_by,
      type: 'verification_revoked',
      category: 'verification',
      actor: 'staff',
      summary: `Verification of ${existing.entityName} revoked by Choosify — ${reason}`,
    });
    notifyUser(existing.submitted_by, {
      type: COMMUNICATION_TYPES.MODERATION_UPDATE,
      category: 'seller',
      eventKey: 'verification.update',
      persona: existing.entityType === 'creator' ? 'creator' : 'seller',
      title: 'Verification needs attention again',
      summary: reason,
      actionUrl: ownerDashboardTab(existing.entityType),
    }).catch((err) => Logger.error('notifyUser failed (verification revoked)', { error: String(err) }));
    void emailUser(existing.submitted_by, {
      subject: `Verification needs attention — ${existing.entityName}`,
      heading: 'Your verification was reopened',
      lines: [
        `Choosify reopened the verification of ${existing.entityName} and removed its verified badge until it is approved again:`,
        reason,
        ...(labels.length ? [`Please upload again: ${labels.join(', ')}.`] : []),
      ],
      ctaLabel: 'Open Verification Center',
      dashboardPath: ownerDashboardTab(existing.entityType),
    });
  }
  Logger.audit('verification.revoked', {
    actorId: req.userId,
    verificationId: existing.id,
    entityType: existing.entityType,
    entityId: existing.entityId,
    rejectedDocuments: docIds.length,
  });
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/verifications/:id/review', ...requireModerator, async (req, res) => {
  if (!userCanManageVerifications(req)) {
    res.status(403).json({ error: 'Not authorized to review verification requests' });
    return;
  }
  const existing = operationsStore.getVerification(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (req.userId && existing.submitted_by === req.userId) {
    res.status(403).json({ error: 'Cannot approve or reject your own verification request' });
    return;
  }
  if (!ACTIVE_VERIFICATION_STATUSES.has(existing.status)) {
    res.status(409).json({ error: `This verification request was already ${existing.status.toLowerCase()} and cannot be reviewed again.` });
    return;
  }
  const rawStatus = String(req.body?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const reviewType: ClaimEntityType = existing.entityType === 'creator' ? 'creator' : 'brand';
  const reviewEntity = await loadEntity(reviewType, existing.entityId);
  const reviewKind = verificationKindOf(existing, ownerOf(reviewType, reviewEntity));
  const feedback = String(req.body?.feedback || req.body?.adminComment || '').trim();
  // "Mark pending": a reviewer takes the request into review. No message to the
  // claimant/owner (nothing is asked of them); recorded in the audit trail.
  if (rawStatus === 'under_review' && !feedback) {
    if (existing.status === 'Draft') {
      res.status(409).json({ error: 'This request has not been submitted yet, so it cannot be marked as under review.', code: 'NOT_SUBMITTED' });
      return;
    }
    const actor = req.user?.displayName || req.userId || 'Administrative Auditor';
    const saved = operationsStore.updateVerification(req.params.id, {
      status: 'Under Review',
      audit_trail: [...existing.audit_trail, { timestamp: new Date().toISOString(), action: 'Review Started', actor, details: 'Marked pending — under review' }],
    });
    scheduleOperationsPersist();
    if (reviewKind === 'ownership_claim') {
      recordAudit(req, { action: 'claim_review_started', targetType: reviewType, targetId: existing.entityId, targetName: existing.entityName, refs: { claimId: existing.id } });
    }
    res.json({ success: true, data: saved });
    return;
  }
  if (rawStatus === 'under_review' || rawStatus === 'request_info' || rawStatus === 'resubmit') {
    if (!feedback) {
      res.status(400).json({ error: 'feedback is required' });
      return;
    }
    const actor = req.user?.displayName || req.userId || 'Administrative Auditor';
    const saved = operationsStore.updateVerification(req.params.id, {
      status: 'Under Review',
      audit_trail: [
        ...existing.audit_trail,
        {
          timestamp: new Date().toISOString(),
          action: 'Additional Information Requested',
          actor,
          details: feedback,
        },
      ],
    });
    scheduleOperationsPersist();
    if (existing.submitted_by) {
      recordAccountActivity(req, { userId: existing.submitted_by, type: 'verification_info_requested', category: 'verification', actor: 'staff', summary: `Choosify asked for more information: ${feedback}` });
    }
    Logger.audit('verification.info_requested', {
      actorId: req.userId,
      verificationId: existing.id,
    });
    if (existing.submitted_by) {
      notifyUser(existing.submitted_by, {
        type: COMMUNICATION_TYPES.MODERATION_UPDATE,
        category: 'seller',
        eventKey: 'verification.update',
        persona: existing.entityType === 'creator' ? 'creator' : 'seller',
        title: 'More information needed for your verification',
        summary: feedback,
        actionUrl: existing.entityType === 'creator' ? '/admin/creator-profile?tab=verification' : '/admin/brand-profile?tab=verification',
      }).catch((err) => Logger.error('notifyUser failed (verification info requested)', { error: String(err) }));
      void emailUser(existing.submitted_by, {
        subject: `More information needed — ${existing.entityName}`,
        heading: 'More information needed',
        lines: [`Choosify needs more information to verify ${existing.entityName}:`, feedback],
        ctaLabel: 'Upload requested documents',
        dashboardPath: ownerDashboardTab(existing.entityType),
      });
    }
    if (reviewKind === 'ownership_claim') {
      recordAudit(req, { action: 'claim_info_requested', targetType: reviewType, targetId: existing.entityId, targetName: existing.entityName, refs: { claimId: existing.id }, note: feedback });
    }
    res.json({ success: true, data: saved });
    return;
  }
  const decision = rawStatus === 'rejected' ? 'rejected' : rawStatus === 'approved' ? 'approved' : '';
  if (!decision) {
    res.status(400).json({ error: 'status must be approved or rejected' });
    return;
  }
  if (!feedback) {
    res.status(400).json({ error: 'feedback is required' });
    return;
  }

  // ── Ownership claims: atomic, owner-protecting transitions. ──
  if (reviewKind === 'ownership_claim') {
    const reviewerName = String(req.body?.reviewer_name || '').trim() || req.user?.displayName || req.userId!;
    try {
      if (decision === 'approved') {
        const result = await approveOwnershipClaim({ req, claimId: existing.id, reviewerId: req.userId!, reviewerName, feedback });
        recordAccountActivity(req, { userId: existing.submitted_by, type: 'ownership_claim_approved', category: 'verification', actor: 'staff', summary: `Ownership of ${existing.entityName} verified — you now manage this profile` });
        notifyUser(existing.submitted_by, {
          type: COMMUNICATION_TYPES.MODERATION_UPDATE,
          category: 'seller',
          eventKey: 'verification.update',
          persona: reviewType === 'creator' ? 'creator' : 'seller',
          title: 'Ownership verified',
          summary: `You are now the verified owner of ${existing.entityName}.`,
          actionUrl: reviewType === 'creator' ? '/admin/creator-studio' : `/admin/brand-studio/${encodeURIComponent(existing.entityId)}/edit`,
        }).catch((err) => Logger.error('notifyUser failed (claim approved)', { error: String(err) }));
        void emailUser(existing.submitted_by, {
          subject: `Ownership verified — ${existing.entityName}`,
          heading: 'Ownership verified',
          lines: [
            `Your claim for ${existing.entityName} was approved. You can now manage the profile in ${reviewType === 'creator' ? 'Creator Studio' : 'Brand Studio'}.`,
            'Marketplace Access (selling) is reviewed separately by Choosify.',
          ],
          ctaLabel: reviewType === 'creator' ? 'Open Creator Studio' : 'Open Brand Studio',
          dashboardPath: reviewType === 'creator' ? '/admin/creator-studio' : `/admin/brand-studio/${encodeURIComponent(existing.entityId)}/edit`,
        });
        for (const other of result.superseded) {
          notifyUser(other.submitted_by, {
            type: COMMUNICATION_TYPES.MODERATION_UPDATE,
            category: 'seller',
            eventKey: 'verification.update',
            persona: reviewType === 'creator' ? 'creator' : 'seller',
            title: 'Ownership claim closed',
            summary: `Ownership of ${other.entityName} was verified for another applicant.`,
            actionUrl: ownerDashboardTab(other.entityType),
          }).catch(() => undefined);
        }
        res.json({ success: true, data: result.claim, catalogSideEffect: { entityType: reviewType, entityId: existing.entityId, decision, applied: true } });
      } else {
        const closed = await closeOwnershipClaim({ req, claimId: existing.id, status: 'Rejected', actorName: reviewerName, feedback, reviewerId: req.userId! });
        recordAccountActivity(req, { userId: existing.submitted_by, type: 'ownership_claim_rejected', category: 'verification', actor: 'staff', summary: `Ownership claim for ${existing.entityName} not approved — ${feedback}` });
        notifyUser(existing.submitted_by, {
          type: COMMUNICATION_TYPES.MODERATION_UPDATE,
          category: 'seller',
          eventKey: 'verification.update',
          persona: reviewType === 'creator' ? 'creator' : 'seller',
          title: 'Ownership claim not approved',
          summary: feedback,
          actionUrl: ownerDashboardTab(reviewType),
        }).catch((err) => Logger.error('notifyUser failed (claim rejected)', { error: String(err) }));
        void emailUser(existing.submitted_by, {
          subject: `Ownership claim not approved — ${existing.entityName}`,
          heading: 'Claim not approved',
          lines: [`Your claim for ${existing.entityName} was not approved.`, `Reason: ${feedback}`],
          ctaLabel: 'View details',
          dashboardPath: ownerDashboardTab(reviewType),
        });
        res.json({ success: true, data: closed, catalogSideEffect: { entityType: reviewType, entityId: existing.entityId, decision, applied: true } });
      }
    } catch (error) {
      sendClaimError(res, error, 'Unable to review ownership claim');
    }
    return;
  }

  const brandBeforeDecision =
    existing.entityType === 'brand'
      ? await catalogStore.getBrand(existing.entityId).catch(() => null)
      : null;
  const wasOwnershipClaim = Boolean(
    brandBeforeDecision && brandBeforeDecision.sellerId !== existing.submitted_by,
  );
  if (decision === 'approved') {
    const missing = missingDocsMessage(existing, 'owner_verification');
    const rejectedDocs = (existing.documents || []).filter((d) => d.status === 'rejected');
    if (missing || rejectedDocs.length) {
      res.status(400).json({
        error: missing
          ? `Required documents are missing: ${missing}. Request them from the owner before approving.`
          : `Rejected documents must be replaced by the owner before approving: ${rejectedDocs.map((d) => verificationDocumentLabel(existing.entityType, d.type)).join(', ')}.`,
        code: 'VERIFICATION_NOT_COMPLETE',
      });
      return;
    }
  }

  const sideEffect = await applyEntityVerificationSideEffect(existing, decision);
  if (sideEffect.ok === false) {
    res.status(409).json({ error: sideEffect.error });
    return;
  }

  if (existing.entityType === 'brand' && wasOwnershipClaim) {
    publishEvent({
      eventName: decision === 'approved' ? 'BrandClaimApproved' : 'BrandClaimRejected',
      domain: 'Marketplace',
      producer: 'operationsRouter',
      aggregateId: existing.entityId,
      actor: req.userId!,
      payload: { verificationId: existing.id, sellerId: existing.submitted_by },
    });
  }

  const reviewerId = req.userId!;
  const reviewerName =
    String(req.body?.reviewer_name || '').trim() ||
    req.user?.displayName ||
    reviewerId;
  const reviewedAt = new Date().toISOString();
  const review = {
    id: `rvw_${Date.now()}`,
    reviewer_id: reviewerId,
    reviewer_name: reviewerName,
    status: decision as 'approved' | 'rejected',
    feedback,
    reviewed_at: reviewedAt,
  };

  const finalStatus = decision === 'approved' ? 'Approved' : 'Rejected';
  const saved = operationsStore.updateVerification(req.params.id, {
    status: finalStatus,
    reviews: [...existing.reviews, review],
    audit_trail: [
      ...existing.audit_trail,
      {
        timestamp: reviewedAt,
        action: decision === 'approved' ? 'Audit Approved' : 'Audit Rejected',
        actor: reviewerName,
        details: `Verification finalized: ${feedback}. Catalog ${existing.entityType} claimStatus/verifiedStatus updated.`,
      },
    ],
  });

  scheduleOperationsPersist();
  if (existing.submitted_by) {
    recordAccountActivity(req, {
      userId: existing.submitted_by,
      type: decision === 'approved' ? 'verification_approved' : 'verification_rejected',
      category: 'verification',
      actor: 'staff',
      summary: decision === 'approved' ? `Verification approved — ${feedback}` : `Verification rejected — ${feedback}`,
    });
  }
  Logger.audit('verification.reviewed', {
    actorId: reviewerId,
    verificationId: existing.id,
    decision: finalStatus,
    submittedBy: existing.submitted_by,
  });
  if (existing.submitted_by) {
    notifyUser(existing.submitted_by, {
      type: COMMUNICATION_TYPES.MODERATION_UPDATE,
      category: 'seller',
      eventKey: 'verification.update',
      persona: existing.entityType === 'creator' ? 'creator' : 'seller',
      title: decision === 'approved' ? 'Verification approved' : 'Verification rejected',
      summary: feedback,
      actionUrl: existing.entityType === 'creator' ? '/admin/creator-profile?tab=verification' : '/admin/brand-profile?tab=verification',
    }).catch((err) => Logger.error('notifyUser failed (verification reviewed)', { error: String(err) }));
  }
  res.json({
    success: true,
    data: saved,
    catalogSideEffect: {
      entityType: existing.entityType,
      entityId: existing.entityId,
      decision,
      applied: true,
    },
  });
});
