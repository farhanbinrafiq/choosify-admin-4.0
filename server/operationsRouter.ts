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
import type {
  OpsCoupon,
  OpsFeeCharge,
  OpsReturnRequest,
  OpsReturnStatus,
  OpsReview,
  OpsStorefrontOrder,
  OpsVerificationDocument,
  OpsVerificationRequest,
  OpsWarrantyClaim,
  PermissionKey,
} from './operations/types';
import { validate } from './middleware/validate';
import { authenticateRequest } from './middleware/auth';
import { requireRole } from './middleware/authorization';
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
  consumeInventoryQuantity,
} from './catalog/inventoryStore';
import { getService } from './catalog/serviceStore';
import { normalizeBrandInput } from './catalogContract';
import { normalizeCreatorInput } from '../lib/vercel-catalog/catalogEditorialContract';
import { recordSuspiciousRequest, recordClaimConfirmAttempt } from './lib/abuseProtection';
import { batchAccountPrimaryLabels } from './profileStatusFacts';
import { Logger } from './lib/logger';
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
          return { ...item, itemId, ...warrantySnapshot, price: realPrice, productTitle: realTitle, quantity };
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

async function applyEntityVerificationSideEffect(
  row: OpsVerificationRequest,
  decision: 'approved' | 'rejected',
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (row.entityType === 'brand') {
      const existing = await catalogStore.getBrand(row.entityId);
      if (!existing) {
        return { ok: false, error: `Brand ${row.entityId} not found in catalog` };
      }
      if (decision === 'approved') {
        const normalized = normalizeBrandInput(
          {
            ...existing,
            claimStatus: 'verified',
            verifiedStatus: true,
            sellerId: row.submitted_by || existing.sellerId,
          },
          existing,
        );
        await catalogStore.upsertBrand(normalized);
      } else {
        const otherOwner =
          Boolean(existing.sellerId) && existing.sellerId !== row.submitted_by;
        const normalized = normalizeBrandInput(
          {
            ...existing,
            claimStatus: otherOwner && existing.verifiedStatus ? 'verified' : 'community',
            verifiedStatus: otherOwner ? Boolean(existing.verifiedStatus) : false,
            sellerId: otherOwner ? existing.sellerId : existing.sellerId,
          },
          existing,
        );
        await catalogStore.upsertBrand(normalized);
      }
      return { ok: true };
    }

    const existing = await catalogStore.getCreator(row.entityId);
    if (!existing) {
      return { ok: false, error: `Creator ${row.entityId} not found in catalog` };
    }
    const otherOwner = Boolean(existing.userId) && existing.userId !== row.submitted_by;
    const normalized = normalizeCreatorInput(
      {
        ...existing,
        verifiedStatus:
          decision === 'approved' ? true : otherOwner ? Boolean(existing.verifiedStatus) : false,
        userId: decision === 'approved' ? row.submitted_by || existing.userId : existing.userId,
      },
      existing,
    );
    await catalogStore.upsertCreator(normalized);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update catalog entity',
    };
  }
}

async function markEntityClaimPending(row: {
  entityType: 'brand' | 'creator';
  entityId: string;
}): Promise<void> {
  if (row.entityType !== 'brand') return;
  const existing = await catalogStore.getBrand(row.entityId);
  if (!existing) return;
  if (existing.claimStatus === 'verified') return;
  const normalized = normalizeBrandInput({ ...existing, claimStatus: 'pending' }, existing);
  await catalogStore.upsertBrand(normalized);
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

  // QA3-001: convert this item's reservation into consumed stock (the legacy
  // path has no separate "packed"/"dispatched" step -- Sprint 3 confirmed
  // trackingStatus is set to 'delivered' in exactly one place in the whole
  // server, this endpoint -- so this is the only fulfillment-progressed
  // signal available; mirrors the Commerce engine's reserved->consumed
  // conversion at Packed). Idempotent via the item's own inventoryConsumed
  // flag so repeated mark-delivered calls never double-decrement. Service
  // lines (no productId) never touch inventory.
  const productId = String(located.item.productId || '').trim();
  const alreadyConsumed = Boolean(located.item.inventoryConsumed);
  if (productId && !alreadyConsumed) {
    const variantId = typeof located.item.variantId === 'string' ? located.item.variantId : undefined;
    const quantity = Math.max(1, Math.floor(Number(located.item.quantity) || 1));
    await consumeInventoryQuantity({ productId, variantId, quantity }).catch((err) => {
      console.error('[Order] Failed to consume inventory on mark-delivered:', err);
    });
  }

  const deliveredAt = new Date().toISOString();
  const nextSubs = subs.map((sub) => {
    const items = sub.items || [];
    const hasItem = items.some((it) => it.itemId === req.params.itemId);
    if (!hasItem) return sub;
    return {
      ...sub,
      trackingStatus: 'delivered',
      items: items.map((it) => {
        if (it.itemId !== req.params.itemId) return it;
        const consumedFlag = productId ? { inventoryConsumed: true } : {};
        const warrantyMonths = Number(it.warrantyMonthsAtPurchase) || 0;
        if (!warrantyMonths) return { ...it, ...consumedFlag, deliveredAt };
        const expiresAt = new Date(
          Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        return { ...it, ...consumedFlag, deliveredAt, warrantyStartsAt: deliveredAt, warrantyExpiresAt: expiresAt };
      }),
    };
  });

  const saved = operationsStore.updateOrder(req.params.id, { subOrders: nextSubs });
  scheduleOperationsPersist();

  // Sync the order's shipment only once every item in every sub-order has
  // its own deliveredAt (product AND service lines both get deliveredAt
  // unconditionally above) -- a multi-seller order shares one shipment, so
  // marking a single item delivered must not flip it early while other
  // sellers' items are still outstanding.
  try {
    const allItemsDelivered = nextSubs.every((sub) =>
      (sub.items || []).every((it) => Boolean((it as Record<string, unknown>).deliveredAt)),
    );
    if (allItemsDelivered) {
      const shipment = shipmentStore.getShipmentByOrderId(req.params.id);
      if (shipment && shipment.status !== 'delivered') {
        shipmentStore.updateShipment(shipment.id, {
          status: 'delivered',
          trackingEvents: [
            {
              id: `evt_${Date.now()}`,
              timestamp: deliveredAt,
              status: 'delivered',
              location: shipment.region || 'Dhaka',
              description: `Marked delivered via order fulfillment (item ${req.params.itemId}).`,
            },
            ...shipment.trackingEvents,
          ],
        });
      }
    }
  } catch (err) {
    console.error('[Order] Failed to sync shipment status on mark-delivered:', err);
  }

  if (existing.buyerId) {
    try {
      await notifyUser(existing.buyerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'buyer',
        title: 'Order delivered',
        summary: `${String(located.item.productTitle || 'Your item')} from order ${existing.orderId} was marked delivered.`,
        actionUrl: '/profile/orders',
        metadata: { orderId: existing.orderId, itemId: req.params.itemId },
      });
    } catch (err) {
      console.warn('[Order] Notify buyer (delivered) failed:', err);
    }
  }

  res.json({ success: true, data: saved });
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
    const buyerId = String(body.buyerId || '').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!buyerId || rawItems.length === 0) {
      res.status(400).json({ error: 'buyerId and at least one item are required' });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const staff = userIsStaff(req);
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
    const offer: ManualOrderOffer = {
      id: `MOF-${Date.now()}`,
      kind: 'manual_order_offer',
      conversationId: `conv_platform_${buyerId}`,
      sellerId,
      sellerName: typeof body.sellerName === 'string' ? body.sellerName : req.user?.displayName,
      buyerId,
      buyerName: typeof body.buyerName === 'string' ? body.buyerName : undefined,
      items: validatedItems,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      subtotal,
      deliveryTotal,
      overallTotal,
      currency: 'BDT',
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    };
    await saveManualOrderOffer(offer);

    const itemSummary = validatedItems.map((it) => `${it.productTitle} x${it.quantity}`).join(', ');
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
        title: 'New order offer',
        summary: `${offer.sellerName || 'A seller'} sent you an offer: ${itemSummary} — ৳${overallTotal.toLocaleString()}.`,
        actionUrl: `/messages/conv_platform_${buyerId}`,
        metadata: { offerId: offer.id },
      });
    } catch (err) {
      console.warn('[ManualOrderOffer] Notify buyer (new offer) failed:', err);
    }

    res.status(201).json({ success: true, data: toManualOrderOfferCard(offer) });
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

  // Re-verify every item is still purchasable at acceptance time -- the
  // seller/admin may have archived/suspended it after the offer was sent but
  // before the buyer accepted.
  for (const item of existing.items) {
    const entity =
      item.productType === 'service'
        ? await getService(item.productId)
        : await catalogStore.getProduct(item.productId);
    if (!entity) {
      res.status(400).json({ error: `"${item.productTitle}" no longer exists and cannot be purchased.` });
      return;
    }
    if (!isProductLifecyclePubliclyListable(entity.status)) {
      res.status(400).json({
        error: `"${item.productTitle}" is no longer available (status: ${normalizeProductLifecycle(entity.status)}) and cannot be purchased.`,
      });
      return;
    }
  }

  const orderId = `MOF-ORDER-${existing.id}`;
  const alreadyCreated = operationsStore.getOrder(orderId);
  if (alreadyCreated) {
    res.json({
      success: true,
      data: toManualOrderOfferCard({ ...existing, status: 'accepted', orderId }),
      order: alreadyCreated,
    });
    return;
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

  let reservedInventoryLines: Array<{ productId: string; variantId?: string; quantity: number }> = [];
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
    const insufficientResult: { ok: false; available: number } = result;
    res.status(409).json({
      error: 'Insufficient stock for one or more items',
      code: 'INSUFFICIENT_STOCK',
      productId: line.productId,
      requestedQuantity: line.quantity,
      availableQuantity: insufficientResult.available,
    });
    return;
  }

  // Re-check right before creating — narrows (does not fully close, same
  // residual window already accepted elsewhere in this file, e.g. QA3-001)
  // the race between the reservation awaits above and this write.
  if (operationsStore.getOrder(orderId)) {
    for (const r of reservedInventoryLines) {
      await releaseInventoryQuantity(r).catch(() => undefined);
    }
    const raced = operationsStore.getOrder(orderId)!;
    res.json({
      success: true,
      data: toManualOrderOfferCard({ ...existing, status: 'accepted', orderId }),
      order: raced,
    });
    return;
  }

  // Warranty terms are snapshotted from the product AT THE MOMENT OF
  // PURCHASE (acceptance, for this flow), same rule POST /operations/orders
  // already applies — a seller later editing the product's warranty config
  // must never change what a past buyer is entitled to.
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
    buyerId: req.userId,
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

  const updated: ManualOrderOffer = { ...existing, status: 'accepted', orderId, updatedAt: ts };
  await saveManualOrderOffer(updated);

  try {
    await notifyUser(existing.sellerId, {
      type: COMMUNICATION_TYPES.BUYER_UPDATE,
      category: 'seller',
      title: 'Order offer accepted',
      summary: `${existing.buyerName || 'The buyer'} accepted your offer — order ${orderId} created.`,
      actionUrl: '/dashboard?tab=seller-orders',
      metadata: { offerId: existing.id, orderId },
    });
  } catch (err) {
    console.warn('[ManualOrderOffer] Notify seller (accepted) failed:', err);
  }

  res.json({ success: true, data: toManualOrderOfferCard(updated), order });
});

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

operationsRouter.get('/operations/returns', ...requireAuth, (req, res) => {
  let buyerId = typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined;
  let sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

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

  const rows = operationsStore.listReturns({ buyerId, sellerId, status });
  res.json({ data: rows });
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
  res.json({ data: row });
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
  const sellerId = String(located.sub.sellerId || '');

  const saved = operationsStore.createReturn({
    orderId,
    itemId,
    initiatedBy: 'customer',
    reason,
    description,
    evidencePhotos: Array.isArray(body.evidencePhotos) ? body.evidencePhotos : [],
    status: 'initiated',
    refundStatus: 'pending',
    notes: [],
    sellerId,
    buyerId: req.userId,
  });
  scheduleOperationsPersist();

  if (sellerId) {
    try {
      await notifyUser(sellerId, {
        type: COMMUNICATION_TYPES.ORDER_UPDATE,
        category: 'seller',
        title: 'New return request',
        summary: `${String(located.item.productTitle || 'An item')} from order ${orderId} — reason: ${reason}.`,
        actionUrl: '/dashboard?tab=seller-orders',
        metadata: { orderId, returnId: saved.id },
      });
    } catch (err) {
      console.warn('[Returns] Notify seller (new return) failed:', err);
    }
  }

  res.status(201).json({ success: true, data: saved });
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
  if (existing.status !== 'initiated') {
    res.status(409).json({ error: `Return is already ${existing.status}; cannot approve again.` });
    return;
  }
  const refundAmount = Number(req.body?.refundAmount);
  if (!Number.isFinite(refundAmount)) {
    res.status(400).json({ error: 'refundAmount is required' });
    return;
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const approvedBy =
    typeof req.body?.approvedBy === 'string' && req.body.approvedBy.trim()
      ? req.body.approvedBy.trim()
      : req.user?.displayName || req.userId || 'Admin Main';

  const adminNotes = [...existing.notes];
  if (note) adminNotes.push(note);
  adminNotes.push(`Return approved with refund of ৳${refundAmount}. Waiting for item return.`);

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'approved',
    approvalDecision: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy,
    refundAmount,
    notes: adminNotes,
  });
  scheduleOperationsPersist();

  try {
    await notifyUser(existing.buyerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
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
  if (existing.status !== 'initiated') {
    res.status(409).json({ error: `Return is already ${existing.status}; cannot reject again.` });
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
  });
  scheduleOperationsPersist();

  try {
    await notifyUser(existing.buyerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
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

operationsRouter.patch('/operations/returns/:id/refund', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to process this refund' });
    return;
  }
  if (existing.status !== 'approved') {
    res.status(409).json({ error: `Return is ${existing.status}, not approved; cannot process refund.` });
    return;
  }
  const adminNotes = [...existing.notes];
  adminNotes.push('Refund successfully processed back to customer payment channel.');

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'refunded',
    refundStatus: 'processed',
    notes: adminNotes,
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
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

  const adminNotes = [...existing.notes];
  adminNotes.push(`Status transitioned to: ${status.toUpperCase()}`);

  const saved = operationsStore.updateReturn(req.params.id, {
    status,
    notes: adminNotes,
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
  const disputeId = String(req.body?.disputeId || '').trim();
  if (!disputeId) {
    res.status(400).json({ error: 'disputeId is required' });
    return;
  }

  const saved = operationsStore.updateReturn(req.params.id, {
    status: 'dispute',
    disputeId,
    notes: [
      ...existing.notes,
      `Escalated to Dispute resolution system. Dispute ID: ${disputeId}`,
    ],
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

// ─── Warranty Claims ───────────────────────────────────────────────────────

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
  res.json({ data: rows });
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
  res.json({ data: row });
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
    const attachmentMediaIds = Array.isArray(req.body?.attachmentMediaIds)
      ? (req.body.attachmentMediaIds as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 12)
      : [];

    if (!orderId || !orderItemId || !issueType || !description) {
      res.status(400).json({ error: 'orderId, orderItemId, issueType, and description are required' });
      return;
    }
    if (!WARRANTY_ISSUE_TYPES.has(issueType)) {
      res.status(400).json({ error: 'Invalid issueType' });
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
      status: 'submitted',
    });
    scheduleOperationsPersist();

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
        title: 'New warranty claim',
        summary: `${String(item.productTitle || 'An item')} from order ${orderId} — ${issueType.replace(/_/g, ' ')}.`,
        actionUrl: claimConversationId ? `/messages/${claimConversationId}` : '/dashboard?tab=seller-orders',
        metadata: { orderId, claimId: saved.id },
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
  if (existing.status !== 'submitted') {
    res.status(400).json({ error: `Cannot acknowledge a claim in status "${existing.status}"` });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

/** Seller/staff: request more info from the consumer. */
operationsRouter.patch('/operations/warranty-claims/:id/request-info', ...requireAuth, (req, res) => {
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
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'more_info_required',
    sellerResponse,
  });
  scheduleOperationsPersist();
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
  if (existing.status !== 'more_info_required') {
    res.status(400).json({ error: `Cannot provide info on a claim in status "${existing.status}"` });
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
  const sellerResponse = typeof req.body?.sellerResponse === 'string' ? req.body.sellerResponse.trim() : undefined;
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'approved',
    ...(sellerResponse ? { sellerResponse } : {}),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
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
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'rejected',
    sellerResponse,
    resolvedAt: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
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

/** Seller/staff: mark service in progress. */
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
  if (existing.status !== 'approved' && existing.status !== 'service_in_progress') {
    res.status(400).json({ error: `Cannot start service on a claim in status "${existing.status}"` });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, { status: 'service_in_progress' });
  scheduleOperationsPersist();
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
  const resolutionNotes = String(req.body?.resolutionNotes || '').trim();
  if (!resolutionNotes) {
    res.status(400).json({ error: 'resolutionNotes is required' });
    return;
  }
  const saved = operationsStore.updateWarrantyClaim(req.params.id, {
    status: 'resolved',
    resolutionNotes,
    resolvedAt: new Date().toISOString(),
  });
  scheduleOperationsPersist();
  try {
    await notifyUser(existing.consumerId, {
      type: COMMUNICATION_TYPES.ORDER_UPDATE,
      category: 'buyer',
      title: 'Warranty claim resolved',
      summary: `Your warranty claim for order ${existing.orderId} was resolved: ${resolutionNotes}`,
      actionUrl: existing.conversationId ? `/messages/${existing.conversationId}` : '/dashboard?tab=my-warranty',
      metadata: { orderId: existing.orderId, claimId: existing.id },
    });
  } catch (err) {
    console.warn('[Warranty] Notify buyer (resolved) failed:', err);
  }
  res.json({ success: true, data: saved });
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
  });
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.get('/operations/coupons', (_req, res) => {
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

operationsRouter.get('/operations/leads', (_req, res) => {
  res.json({ data: operationsStore.listLeads() });
});

operationsRouter.post('/operations/leads', (req, res) => {
  const abuse = recordSuspiciousRequest(req.ip, req.originalUrl);
  if (abuse.thresholdExceeded) {
    res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    return;
  }
  const body = req.body as {
    brandName?: string;
    contactPerson?: string;
    email?: string;
    budget?: string;
    placementInterest?: string;
    message?: string;
    source?: string;
  };
  if (!body.brandName?.trim() || !body.email?.trim()) {
    res.status(400).json({ error: 'brandName and email are required' });
    return;
  }
  const saved = operationsStore.createLead({
    source: body.source || 'advertise-page',
    brandName: body.brandName.trim(),
    contactPerson: body.contactPerson?.trim(),
    email: body.email.trim(),
    budget: body.budget,
    placementInterest: body.placementInterest,
    message: body.message?.trim(),
  });
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/leads/:id', ...requireAdmin, (req, res) => {
  const saved = operationsStore.updateLead(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ success: true, data: saved });
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

    const labels = await batchAccountPrimaryLabels(
      rows.map((u) => ({ id: u.id, role: u.role, email: u.email })),
    );

    const authUsers = rows.map((u) => {
      const name = u.displayName || u.email || 'User';
      const joined = u.createdAt ? String(u.createdAt).slice(0, 10) : '—';
      return {
        id: u.id,
        name,
        email: u.email,
        role: mapRole(u.role),
        status: labels.get(u.id) || 'Active',
        joined,
        active: joined,
        initials: initials(name),
        trustScore: 85,
        behaviorSegment: 'Retail Shopper',
        choosifyUserId: u.choosifyUserId || undefined,
      };
    });

    if (authUsers.length) {
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
  };

  const entityType = body.entityType === 'creator' ? 'creator' : 'brand';
  const entityId = String(body.entityId || body.brand_id || '').trim();
  const entityName = String(body.entityName || body.brand_name || '').trim();
  if (!entityId || !entityName) {
    res.status(400).json({ error: 'entityId/entityName (or brand_id/brand_name) are required' });
    return;
  }

  // Never trust client-supplied submitted_by — bind to authenticated uid.
  if (body.submitted_by && body.submitted_by !== req.userId) {
    res.status(403).json({ error: 'submitted_by does not match authenticated user' });
    return;
  }

  const documents = Array.isArray(body.documents) ? body.documents : [];
  for (const doc of documents) {
    if (!doc?.type || !doc?.name || !doc?.doc_url) {
      res.status(400).json({ error: 'Each document requires type, name, and doc_url' });
      return;
    }
  }

  const activeClaim = operationsStore.listVerifications({ entityType, entityId }).find((row) => {
    const s = String(row.status || '');
    return s === 'Submitted' || s === 'Under Review' || s === 'Draft';
  });
  if (activeClaim) {
    res.status(409).json({
      error: 'An active ownership claim already exists for this profile',
      existingVerificationId: activeClaim.id,
    });
    return;
  }

  const status =
    body.status === 'Draft' ||
    body.status === 'Submitted' ||
    body.status === 'Under Review'
      ? body.status
      : 'Submitted';

  const actorName = body.submitted_by_name?.trim() || req.user?.displayName || req.userId || 'Claimant';
  const saved = operationsStore.createVerification({
    entityType,
    entityId,
    entityName,
    brand_id: entityType === 'brand' ? entityId : body.brand_id || entityId,
    brand_name: entityType === 'brand' ? entityName : body.brand_name || entityName,
    logo_url: body.logo_url || '',
    submitted_by: req.userId!,
    submitted_by_name: actorName,
    status,
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
        details:
          status === 'Draft'
            ? 'Initialized a draft verification dossier'
            : 'Claim documents submitted for administrative review',
      },
    ],
  });

  if (status === 'Submitted' || status === 'Under Review') {
    try {
      await markEntityClaimPending(saved);
    } catch (err) {
      console.warn('[Verification] Failed to mark claim pending on catalog entity:', err);
    }

    if (entityType === 'brand') {
      const existingBrand = await catalogStore.getBrand(entityId).catch(() => null);
      const isOwnershipClaim = !existingBrand || existingBrand.sellerId !== req.userId;
      publishEvent({
        eventName: isOwnershipClaim ? 'BrandClaimSubmitted' : 'BrandVerificationSubmitted',
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
        title: entityType === 'brand' ? 'Ownership Claim Submitted' : 'Creator Verification Submitted',
        summary: `${actorName} submitted a ${entityType} verification for "${entityName}".`,
        actionUrl: `/upe/${entityType}/${encodeURIComponent(entityId)}`,
        metadata: { verificationId: saved.id, entityType, entityId },
      });
    } catch (err) {
      console.error('[Verification] Failed to notify admins of claim submission:', err);
    }
  }

  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.get('/operations/verifications', ...requireAuth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;

  const redactForOwner = (rows: ReturnType<typeof operationsStore.listVerifications>) =>
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

  if (userCanManageVerifications(req)) {
    res.json({
      data: operationsStore.listVerifications({ status, entityType, entityId }),
    });
    return;
  }

  // Regular users: only their own submissions; redact internal admin comments.
  res.json({
    data: redactForOwner(
      operationsStore.listVerifications({
        submittedBy: req.userId,
        status,
        entityType,
        entityId,
      }),
    ),
  });
});

operationsRouter.get('/operations/verifications/:id', ...requireAuth, (req, res) => {
  const row = operationsStore.getVerification(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Verification request not found' });
    return;
  }
  if (!userCanViewVerification(req, row)) {
    res.status(403).json({ error: 'Not authorized to view this verification request' });
    return;
  }
  if (userCanManageVerifications(req)) {
    res.json({ data: row });
    return;
  }
  res.json({
    data: {
      ...row,
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
  try {
    if (saved) await markEntityClaimPending(saved);
  } catch (err) {
    console.warn('[Verification] mark pending failed:', err);
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
});

operationsRouter.patch(
  '/operations/verifications/:id/document/:docId',
  ...requireModerator,
  (req, res) => {
    if (!userCanManageVerifications(req)) {
      res.status(403).json({ error: 'Not authorized to audit verification documents' });
      return;
    }
    const existing = operationsStore.getVerification(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Verification request not found' });
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
      status: saved.status === 'Draft' || saved.status === 'Submitted' ? 'Under Review' : saved.status,
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
    Logger.audit('verification.document_reviewed', {
      actorId: req.userId,
      verificationId: req.params.id,
      docId: req.params.docId,
      status,
    });
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
  (req, res) => {
    const existing = operationsStore.getVerification(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Verification request not found' });
      return;
    }
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
    if (existing.status === 'Approved' || existing.status === 'Rejected') {
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
    Logger.audit('verification.document_replaced', {
      actorId: req.userId,
      verificationId: req.params.id,
      docId: req.params.docId,
      overallStatus: nextOverall,
    });
    res.json({ success: true, data: withAudit || saved });
  },
);

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
  const rawStatus = String(req.body?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const feedback = String(req.body?.feedback || req.body?.adminComment || '').trim();
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
    Logger.audit('verification.info_requested', {
      actorId: req.userId,
      verificationId: existing.id,
    });
    if (existing.submitted_by) {
      notifyUser(existing.submitted_by, {
        type: COMMUNICATION_TYPES.MODERATION_UPDATE,
        category: 'seller',
        title: 'More information needed for your verification',
        summary: feedback,
        actionUrl: '/admin/brand-verification',
      }).catch((err) => Logger.error('notifyUser failed (verification info requested)', { error: String(err) }));
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

  const brandBeforeDecision =
    existing.entityType === 'brand'
      ? await catalogStore.getBrand(existing.entityId).catch(() => null)
      : null;
  const wasOwnershipClaim = Boolean(
    brandBeforeDecision && brandBeforeDecision.sellerId !== existing.submitted_by,
  );

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
      title: decision === 'approved' ? 'Verification approved' : 'Verification rejected',
      summary: feedback,
      actionUrl: '/admin/brand-verification',
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
