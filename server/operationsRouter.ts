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
import type { OpsCoupon, OpsReview, OpsStorefrontOrder, PermissionKey } from './operations/types';
import { validate } from './middleware/validate';
import { CouponValidateBodySchema } from './validation/operations/couponValidateSchema';
import {
  evaluatePostOrderConversationExpiry,
  type OrderLikeForExpiry,
} from '../shared/messaging/conversationExpiry';

export const operationsRouter = Router();

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

operationsRouter.patch('/operations/orders/:id', (req, res) => {
  const saved = operationsStore.updateOrder(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.get('/operations/coupons', (_req, res) => {
  res.json({ data: operationsStore.listCoupons() });
});

operationsRouter.post('/operations/coupons', (req, res) => {
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
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/coupons/:id', (req, res) => {
  const existing = operationsStore.getCoupon(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Coupon not found' });
    return;
  }
  const saved = operationsStore.upsertCoupon({ ...existing, ...req.body, id: existing.id });
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/coupons/:id', (req, res) => {
  const ok = operationsStore.deleteCoupon(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Coupon not found' });
    return;
  }
  res.json({ success: true });
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

operationsRouter.post('/operations/reviews', (req, res) => {
  const body = req.body as Partial<OpsReview>;
  if (!body.productTitle?.trim() || !body.comment?.trim() || !body.rating) {
    res.status(400).json({ error: 'productTitle, rating, and comment are required' });
    return;
  }
  const saved = operationsStore.createReview({
    userId: body.userId || 'guest',
    userName: body.userName || 'Anonymous',
    productId: body.productId || 'unknown',
    productTitle: body.productTitle,
    brandName: body.brandName || '',
    storeName: body.storeName || '',
    rating: Math.min(5, Math.max(1, Number(body.rating))),
    comment: body.comment.trim(),
  });
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/reviews/:id', (req, res) => {
  const patch = { ...req.body } as Partial<OpsReview>;
  if (patch.status) {
    patch.status = normalizeReviewStatus(String(patch.status));
  }
  const saved = operationsStore.updateReview(req.params.id, patch);
  if (!saved) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/reviews/:id', (req, res) => {
  const ok = operationsStore.deleteReview(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
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

operationsRouter.post('/operations/jobs', (req, res) => {
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
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/jobs/:id', (req, res) => {
  const saved = operationsStore.updateJobPosting(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.delete('/operations/jobs/:id', (req, res) => {
  const ok = operationsStore.deleteJobPosting(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Job posting not found' });
    return;
  }
  res.json({ success: true });
});

operationsRouter.get('/operations/job-applications', (req, res) => {
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
  res.json({ data: operationsStore.listJobApplications(jobId) });
});

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
  res.status(201).json({ success: true, data: saved });
});

operationsRouter.patch('/operations/job-applications/:id', (req, res) => {
  const saved = operationsStore.updateJobApplication(req.params.id, req.body);
  if (!saved) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json({ success: true, data: saved });
});

operationsRouter.post('/operations/media/upload-resume', async (req, res) => {
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

operationsRouter.put('/operations/permissions', (req, res) => {
  const permissions = req.body?.permissions;
  if (!permissions || typeof permissions !== 'object') {
    res.status(400).json({ error: 'permissions object is required' });
    return;
  }
  const saved = operationsStore.updatePermissions(permissions);
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

operationsRouter.patch('/operations/shipments/:id', (req, res) => {
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
      const { createBookingRequest } = await import('./booking/bookingService');
      const created = await createBookingRequest({
        listingId: String(bookingOffer.listingId || ''),
        listingTitle: String(bookingOffer.listingTitle || 'Service listing'),
        listingImage: bookingOffer.listingImage as string | undefined,
        listingHref: bookingOffer.listingHref as string | undefined,
        sellerId: String(bookingOffer.sellerId || ''),
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

operationsRouter.put('/operations/feature-flags', (req, res) => {
  const flags = req.body?.flags as Record<string, boolean> | undefined;
  if (!flags || typeof flags !== 'object') {
    res.status(400).json({ error: 'flags object is required' });
    return;
  }
  const saved = operationsStore.updateFeatureFlags(flags);
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
