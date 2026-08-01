import { Router } from 'express';
import { operationsStore, DEFAULT_ROLE_PERMISSIONS } from './operations/operationsStore';
import { validateCoupon } from './operations/couponValidator';
import { getAnalyticsSummary, getRoleAnalytics } from './operations/analyticsService';
import { getSellerDashboardIntelligence } from './operations/sellerIntelligenceService';
import { shipmentStore } from './operations/shipmentStore';
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
  PermissionKey,
} from './operations/types';
import { validate } from './middleware/validate';
import { authenticateRequest } from './middleware/auth';
import { requireRole } from './middleware/authorization';
import { hasRole } from './permissions/authorization';
import { ROLES } from './permissions/roles';
import { CouponValidateBodySchema } from './validation/operations/couponValidateSchema';
import {
  evaluatePostOrderConversationExpiry,
  type OrderLikeForExpiry,
} from '../shared/messaging/conversationExpiry';

export const operationsRouter = Router();

const requireAuth = [authenticateRequest];
/** Admin or super_admin (via ROLE_INHERITANCE). */
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

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
 * Buyer may review a product only after a delivered/completed purchase of that product.
 * Mirrors storefront ProductDetailPage `reviewableOrders` (delivered sub-order item).
 */
function userHasPurchasedProductForReview(userId: string, productId: string): boolean {
  if (!userId || !productId || productId === 'unknown') return false;
  return operationsStore.listOrders().some((order) => {
    if (order.buyerId !== userId) return false;
    if (order.status === 'cancelled') return false;
    const subs = (order.subOrders || []) as Array<{
      trackingStatus?: string;
      items?: Array<{ productId?: string }>;
    }>;
    const deliveredItem = subs.some(
      (sub) =>
        (sub.trackingStatus === 'delivered' || order.status === 'completed') &&
        (sub.items || []).some((item) => String(item.productId) === String(productId)),
    );
    if (deliveredItem) return true;
    // Flat item lists on some order shapes
    const flatItems = (order as { items?: Array<{ productId?: string }> }).items || [];
    return (
      order.status === 'completed' &&
      flatItems.some((item) => String(item.productId) === String(productId))
    );
  });
}

function userCanModerateOrEditReview(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  review: OpsReview,
): boolean {
  if (userIsStaff(req)) return true;
  const role = req.userRole;
  if (role && hasRole(role, ROLES.MODERATOR)) return true;
  return Boolean(req.userId && review.userId === req.userId);
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

operationsRouter.get('/operations/orders', (_req, res) => {
  res.json({ data: operationsStore.listOrders() });
});

operationsRouter.get('/operations/orders/:id', (req, res) => {
  const order = operationsStore.getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ data: order });
});

operationsRouter.post('/operations/orders', async (req, res) => {
  try {
    const body = req.body as Partial<OpsStorefrontOrder>;
    if (!body.orderId) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }
    const status =
      body.status === 'pending_payment' ||
      body.status === 'confirmed' ||
      body.status === 'cancelled' ||
      body.status === 'completed'
        ? body.status
        : 'active';
    const saved = operationsStore.createOrder({
      orderId: body.orderId,
      buyerId: body.buyerId || 'guest',
      isCOD: Boolean(body.isCOD),
      isSplit: Boolean(body.isSplit),
      overallTotal: Number(body.overallTotal || 0),
      subtotal: body.subtotal,
      deliveryTotal: body.deliveryTotal,
      subOrders: body.subOrders || [],
      promoCode: body.promoCode,
      promoDiscount: body.promoDiscount,
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
      createdAt: body.createdAt || new Date().toISOString(),
      isManual: body.isManual,
      platformSource: body.platformSource,
      claimToken: body.claimToken,
      codDeliveryFeePaid: body.codDeliveryFeePaid,
      codDeliveryFeePaidAt: body.codDeliveryFeePaidAt,
      codRemainingAmount: body.codRemainingAmount,
      isPartialPayment: body.isPartialPayment,
      depositPercent: body.depositPercent,
      depositAmount: body.depositAmount,
      remainingAmount: body.remainingAmount,
    });

    if (body.promoCode && body.promoDiscount) {
      const coupon = operationsStore.getCouponByCode(body.promoCode);
      if (coupon) {
        operationsStore.recordCouponUsage({
          couponId: coupon.id,
          couponCode: coupon.code,
          orderId: saved.orderId,
          userId: saved.buyerId,
          discountAmount: Number(body.promoDiscount || 0),
          originalAmount: Number(body.subtotal || body.overallTotal || 0),
          finalAmount: Number(body.overallTotal || 0),
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

    res.status(201).json({ success: true, data: saved, shipmentId: shipment?.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid order payload' });
  }
});

// Public — no staff auth. Powers the customer-facing "View & Confirm Order" page on
// Choosify-Web, reached via the confirm link a seller sends from a manually-created order.
operationsRouter.get('/operations/orders/claim/:token', (req, res) => {
  const order = operationsStore.getOrderByClaimToken(req.params.token);
  if (!order) {
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
    },
  });
});

operationsRouter.post('/operations/orders/claim/:token/confirm', (req, res) => {
  const { buyerId, buyerName } = req.body as { buyerId?: string; buyerName?: string };
  if (!buyerId?.trim()) {
    res.status(400).json({ error: 'buyerId is required' });
    return;
  }
  const existing = operationsStore.getOrderByClaimToken(req.params.token);
  if (!existing) {
    res.status(404).json({ error: 'This order link is invalid or has expired.' });
    return;
  }
  if (existing.claimedAt && existing.buyerId !== buyerId.trim()) {
    res.status(409).json({ error: 'This order has already been confirmed by another account.' });
    return;
  }
  const saved = operationsStore.claimOrder(req.params.token, {
    buyerId: buyerId.trim(),
    buyerName: buyerName?.trim(),
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

operationsRouter.post('/operations/orders/:id/cancel', ...requireAuth, (req, res) => {
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
  const subs = (existing.subOrders || []) as Array<{ trackingStatus?: string }>;
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

  const ts = new Date().toISOString();
  const saved = operationsStore.updateOrder(req.params.id, {
    status: 'cancelled',
    cancelledAt: ts,
    cancelReason: reason,
    cancelledBy: 'buyer',
  });
  if (!saved) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  scheduleOperationsPersist();
  res.json({ success: true, data: saved });
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

operationsRouter.post('/operations/returns', ...requireAuth, (req, res) => {
  const body = req.body as Partial<OpsReturnRequest>;
  const orderId = String(body.orderId || '').trim();
  const buyerId = String(body.buyerId || '').trim();
  const sellerId = String(body.sellerId || '').trim();
  const reason = body.reason;
  const description = String(body.description || '').trim();

  if (!orderId || !buyerId || !sellerId || !reason || !description) {
    res.status(400).json({
      error: 'orderId, buyerId, sellerId, reason, and description are required',
    });
    return;
  }
  if (!req.userId || buyerId !== req.userId) {
    res.status(403).json({ error: 'buyerId must match the authenticated user' });
    return;
  }

  const saved = operationsStore.createReturn({
    orderId,
    itemId: String(body.itemId || '').trim(),
    initiatedBy: body.initiatedBy === 'admin' ? 'admin' : 'customer',
    reason,
    description,
    evidencePhotos: Array.isArray(body.evidencePhotos) ? body.evidencePhotos : [],
    status: body.status || 'initiated',
    refundStatus: body.refundStatus || 'pending',
    notes: Array.isArray(body.notes) ? body.notes : [],
    sellerId,
    buyerId,
    ...(body.id ? { id: body.id } : {}),
    ...(body.approvalDecision ? { approvalDecision: body.approvalDecision } : {}),
    ...(body.approvalReason ? { approvalReason: body.approvalReason } : {}),
    ...(body.approvedAt ? { approvedAt: body.approvedAt } : {}),
    ...(body.approvedBy ? { approvedBy: body.approvedBy } : {}),
    ...(typeof body.refundAmount === 'number' ? { refundAmount: body.refundAmount } : {}),
    ...(body.returnTrackingId ? { returnTrackingId: body.returnTrackingId } : {}),
    ...(body.returnCourier ? { returnCourier: body.returnCourier } : {}),
    ...(body.pickupDate ? { pickupDate: body.pickupDate } : {}),
    ...(body.deliveryDate ? { deliveryDate: body.deliveryDate } : {}),
    ...(body.disputeId ? { disputeId: body.disputeId } : {}),
  });
  scheduleOperationsPersist();
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/returns/:id/approve', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to approve this return' });
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
  res.json({ success: true, data: saved });
});

operationsRouter.patch('/operations/returns/:id/reject', ...requireAuth, (req, res) => {
  const existing = operationsStore.getReturn(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Return not found' });
    return;
  }
  if (!userCanManageReturnAsSellerOrAdmin(req, existing)) {
    res.status(403).json({ error: 'Not authorized to reject this return' });
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

operationsRouter.get('/operations/reviews', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
  const reviews = operationsStore.listReviews({
    status: status || undefined,
    productId: productId || undefined,
  });
  res.json({ data: reviews });
});

operationsRouter.get('/operations/reviews/public', (req, res) => {
  const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
  if (!productId) {
    res.status(400).json({ error: 'productId is required' });
    return;
  }
  const reviews = operationsStore
    .listReviews({ productId, status: 'published' })
    .map((review) => ({
      id: review.id,
      userName: review.userName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      response: review.response,
    }));
  res.json({ data: reviews });
});

operationsRouter.post('/operations/reviews', ...requireAuth, (req, res) => {
  const body = req.body as Partial<OpsReview>;
  if (!body.productTitle?.trim() || !body.comment?.trim() || !body.rating) {
    res.status(400).json({ error: 'productTitle, rating, and comment are required' });
    return;
  }
  const productId = body.productId || 'unknown';
  // Always bind reviewer to authenticated uid — never trust body.userId.
  const userId = req.userId!;
  if (!userHasPurchasedProductForReview(userId, productId)) {
    res.status(403).json({
      error: 'A completed/delivered purchase of this product is required to leave a review',
    });
    return;
  }
  const saved = operationsStore.createReview({
    userId,
    userName: body.userName || 'Anonymous',
    productId,
    productTitle: body.productTitle,
    brandName: body.brandName || '',
    storeName: body.storeName || '',
    rating: Math.min(5, Math.max(1, Number(body.rating))),
    comment: body.comment.trim(),
  });
  scheduleOperationsPersist();
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
  const saved = operationsStore.updateReview(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  scheduleOperationsPersist();
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

operationsRouter.patch('/operations/leads/:id', (req, res) => {
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

operationsRouter.post('/operations/job-applications', ...requireAuth, (req, res) => {
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

operationsRouter.post('/operations/media/upload-resume', ...requireAuth, async (req, res) => {
  try {
    const { validateDocumentUploadInput } = await import('./lib/uploadValidation');
    const { uploadDocumentToCloudinary } = await import('../lib/vercel-catalog/mediaUpload');
    const body = req.body as { data?: string; mimeType?: string; fileName?: string };
    const validation = validateDocumentUploadInput({
      base64Data: body.data || '',
      mimeType: body.mimeType,
      fileName: body.fileName,
    });
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const url = await uploadDocumentToCloudinary({
      base64Data: body.data!,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
    });
    res.status(201).json({ success: true, url, fileName: validation.fileName });
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

operationsRouter.get('/operations/analytics', (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  res.json({ data: getAnalyticsSummary(range) });
});

operationsRouter.get('/operations/analytics/role/:role', (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  res.json({ data: getRoleAnalytics(req.params.role, range) });
});

operationsRouter.get('/operations/seller-dashboard', async (req, res) => {
  try {
    const sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId.trim() : '';
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

operationsRouter.get('/operations/shipments', (_req, res) => {
  res.json({ data: shipmentStore.listShipments() });
});

operationsRouter.get('/operations/shipments/:id', (req, res) => {
  const shipment = shipmentStore.getShipment(req.params.id);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  res.json({ data: shipment });
});

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
  const saved = shipmentStore.updateShipment(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/platform-messages', async (req, res) => {
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
    if (!buyerId?.trim() || !body?.trim()) {
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
      const sellerId = String(bookingOffer.sellerId || '');
      const autoApprove = await resolveAutoApprove(sellerId, listingId).catch(() => false);
      const partialPayment = await resolvePartialPaymentSettings(listingId).catch(() => ({
        partialPaymentEnabled: false,
        depositPercent: undefined as number | undefined,
      }));
      const created = await createBookingRequest({
        listingId,
        listingTitle: String(bookingOffer.listingTitle || 'Service listing'),
        listingImage: bookingOffer.listingImage as string | undefined,
        listingHref: bookingOffer.listingHref as string | undefined,
        sellerId,
        sellerName: String(bookingOffer.sellerName || 'Seller'),
        buyerId: buyerId.trim(),
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
        conversationId: `conv_platform_${buyerId.trim()}`,
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
      buyerId: buyerId.trim(),
      userName: userName?.trim() || buyerId.trim(),
      body: `${complaintPrefix}${body.trim()}`,
      orderId: orderId?.trim(),
      bookingOffer: attachedOffer,
    });
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

operationsRouter.get('/operations/shipments/track/:orderId', (req, res) => {
  const shipment = shipmentStore.getShipmentByOrderId(req.params.orderId);
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found for this order' });
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

operationsRouter.get('/operations/users', (_req, res) => {
  res.json({ data: operationsStore.listUsers() });
});

operationsRouter.get('/operations/seller-offers', (_req, res) => {
  res.json({ data: operationsStore.listSellerOffers() });
});

operationsRouter.post('/operations/seller-offers', (req, res) => {
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

operationsRouter.patch('/operations/seller-offers/:id', (req, res) => {
  const saved = operationsStore.updateSellerOffer(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Seller offer not found' });
    return;
  }
  res.json({ success: true, data: saved });
});
