import { Router } from 'express';
import { getBookingFieldConfigPayload } from '../../shared/booking/bookingFieldConfig';
import { toBookingOfferCard } from '../../shared/booking/bookingTypes';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import { authenticateRequest } from '../middleware/auth';
import { hasRole } from '../permissions/authorization';
import { ROLES } from '../permissions/roles';
import { getBookingRequest, listBookingRequests } from './bookingStore';
import {
  acceptBookingRequest,
  buyerAcceptCounter,
  buyerDeclineBookingRequest,
  counterBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  markBookingPaid,
  resolveAutoApprove,
  resolvePartialPaymentSettings,
  sweepExpiredBookings,
} from './bookingService';

export const bookingRouter = Router();

/**
 * P0 fix: every mutating booking-request endpoint below previously trusted a
 * client-supplied sellerId/buyerId in the request body with no session check
 * at all (unlike every sibling commerce router — conversations, escrow,
 * operations mark-delivered all require auth + verify actor identity).
 * That let an unauthenticated caller accept/decline/counter someone else's
 * booking, or mark any booking "paid" outright. Fix: require a valid session
 * (authenticateRequest) and, for non-staff callers, derive the actor's
 * sellerId/buyerId from the authenticated session rather than the body —
 * staff may still act on a specific seller/buyer's behalf via the body field,
 * mirroring the staff-or-owner pattern already used for mark-delivered
 * (operationsRouter.ts).
 */
function userIsStaff(req: { userRole?: (typeof ROLES)[keyof typeof ROLES] }): boolean {
  const role = req.userRole;
  if (!role) return false;
  return (
    hasRole(role, ROLES.SUPER_ADMIN) ||
    hasRole(role, ROLES.ADMIN) ||
    hasRole(role, ROLES.SUPPORT_AGENT) ||
    hasRole(role, ROLES.MODERATOR)
  );
}

/** Public — shared field config for Product Studio + storefront Message Seller */
bookingRouter.get('/booking/field-config', (_req, res) => {
  res.json({ success: true, data: getBookingFieldConfigPayload() });
});

/** Seller's account-wide default for whether new bookings need their manual acceptance. */
bookingRouter.get('/booking/seller-settings/:sellerId', (req, res) => {
  res.json({ success: true, data: operationsStore.getSellerBookingSettings(req.params.sellerId) });
});

bookingRouter.patch('/booking/seller-settings/:sellerId', authenticateRequest, (req, res) => {
  try {
    if (!userIsStaff(req) && req.userId !== req.params.sellerId) {
      res.status(403).json({ error: 'Not authorized to update this seller\'s booking settings' });
      return;
    }
    const { autoApproveBookingsDefault } = req.body || {};
    if (typeof autoApproveBookingsDefault !== 'boolean') {
      res.status(400).json({ error: 'autoApproveBookingsDefault (boolean) is required' });
      return;
    }
    const updated = operationsStore.updateSellerBookingSettings(req.params.sellerId, {
      autoApproveBookingsDefault,
    });
    scheduleOperationsPersist();
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update seller booking settings' });
  }
});

bookingRouter.get('/booking/requests', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const requestedSellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
    const requestedBuyerId = typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined;
    if (!staff && !requestedSellerId && !requestedBuyerId) {
      res.status(400).json({ error: 'sellerId or buyerId is required' });
      return;
    }
    if (!staff && requestedSellerId && requestedSellerId !== req.userId) {
      res.status(403).json({ error: 'Not authorized to list this seller\'s booking requests' });
      return;
    }
    if (!staff && requestedBuyerId && requestedBuyerId !== req.userId) {
      res.status(403).json({ error: 'Not authorized to list this buyer\'s booking requests' });
      return;
    }
    const rows = await listBookingRequests({
      sellerId: requestedSellerId,
      buyerId: requestedBuyerId,
      conversationId:
        typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    res.json({
      success: true,
      data: rows.map(toBookingOfferCard),
      requests: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list booking requests' });
  }
});

bookingRouter.get('/booking/requests/:id', authenticateRequest, async (req, res) => {
  try {
    const request = await getBookingRequest(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'Booking request not found' });
      return;
    }
    if (!userIsStaff(req) && req.userId !== request.sellerId && req.userId !== request.buyerId) {
      res.status(403).json({ error: 'Not authorized to view this booking request' });
      return;
    }
    // Lazy expiry backup when a single request is read
    await sweepExpiredBookings();
    const fresh = (await getBookingRequest(req.params.id)) || request;
    res.json({ success: true, data: toBookingOfferCard(fresh), request: fresh });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load booking request' });
  }
});

bookingRouter.post('/booking/requests', authenticateRequest, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.listingId || !body.buyerId || !body.sellerId) {
      res.status(400).json({ error: 'listingId, buyerId, and sellerId are required' });
      return;
    }
    if (!userIsStaff(req) && req.userId !== String(body.buyerId)) {
      res.status(403).json({ error: 'Not authorized to create a booking request for another buyer' });
      return;
    }
    const listingId = String(body.listingId);
    const sellerId = String(body.sellerId);
    const autoApprove = await resolveAutoApprove(sellerId, listingId).catch(() => false);
    const partialPayment = await resolvePartialPaymentSettings(listingId).catch(() => ({
      partialPaymentEnabled: false,
      depositPercent: undefined as number | undefined,
    }));
    const result = await createBookingRequest({
      listingId,
      listingTitle: String(body.listingTitle || 'Service listing'),
      listingImage: body.listingImage,
      listingHref: body.listingHref,
      sellerId,
      sellerName: String(body.sellerName || 'Seller'),
      buyerId: String(body.buyerId),
      buyerName: body.buyerName,
      serviceCategory: body.serviceCategory,
      isService: body.isService !== false,
      fields: body.fields || {},
      notes: body.notes,
      price: Number(body.price) || 0,
      originalPrice: body.originalPrice !== undefined ? Number(body.originalPrice) : undefined,
      conversationId: body.conversationId,
      autoApprove,
      partialPaymentEnabled: partialPayment.partialPaymentEnabled,
      depositPercent: partialPayment.depositPercent,
      threadId: body.threadId,
    });
    res.status(201).json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create booking request' });
  }
});

bookingRouter.post('/booking/requests/:id/accept', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const sellerId = String((staff ? req.body?.sellerId : undefined) || req.userId || '');
    if (!sellerId) {
      res.status(400).json({ error: 'sellerId is required' });
      return;
    }
    const result = await acceptBookingRequest(req.params.id, {
      sellerId,
      sellerName: req.body?.sellerName,
    });
    res.json({ success: true, data: result.offer, request: result.request, order: result.order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to accept booking' });
  }
});

bookingRouter.post('/booking/requests/:id/decline', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const sellerId = String((staff ? req.body?.sellerId : undefined) || req.userId || '');
    const declineReason = String(req.body?.declineReason || '');
    if (!sellerId) {
      res.status(400).json({ error: 'sellerId is required' });
      return;
    }
    if (!declineReason.trim()) {
      res.status(400).json({ error: 'declineReason is required' });
      return;
    }
    const result = await declineBookingRequest(
      req.params.id,
      { sellerId, sellerName: req.body?.sellerName },
      declineReason,
    );
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to decline booking' });
  }
});

bookingRouter.post('/booking/requests/:id/counter', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const sellerId = String((staff ? req.body?.sellerId : undefined) || req.userId || '');
    if (!sellerId) {
      res.status(400).json({ error: 'sellerId is required' });
      return;
    }
    const result = await counterBookingRequest(
      req.params.id,
      { sellerId, sellerName: req.body?.sellerName },
      {
        price: req.body?.price !== undefined ? Number(req.body.price) : undefined,
        fields: req.body?.fields,
        notes: req.body?.notes,
      },
    );
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to counter booking' });
  }
});

bookingRouter.post('/booking/requests/:id/buyer-accept', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const buyerId = String((staff ? req.body?.buyerId : undefined) || req.userId || '');
    if (!buyerId) {
      res.status(400).json({ error: 'buyerId is required' });
      return;
    }
    const result = await buyerAcceptCounter(req.params.id, { buyerId });
    res.json({ success: true, data: result.offer, request: result.request, order: result.order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to accept counter-offer' });
  }
});

bookingRouter.post('/booking/requests/:id/buyer-decline', authenticateRequest, async (req, res) => {
  try {
    const staff = userIsStaff(req);
    const buyerId = String((staff ? req.body?.buyerId : undefined) || req.userId || '');
    if (!buyerId) {
      res.status(400).json({ error: 'buyerId is required' });
      return;
    }
    const declineReason =
      req.body?.declineReason !== undefined ? String(req.body.declineReason) : undefined;
    const result = await buyerDeclineBookingRequest(req.params.id, { buyerId }, declineReason);
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to decline offer' });
  }
});

bookingRouter.post('/booking/requests/:id/mark-paid', authenticateRequest, async (req, res) => {
  try {
    const existing = await getBookingRequest(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Booking request not found' });
      return;
    }
    if (!userIsStaff(req) && req.userId !== existing.buyerId) {
      res.status(403).json({ error: 'Not authorized to confirm payment for this booking' });
      return;
    }
    const paymentType = req.body?.paymentType === 'partial' ? 'partial' : 'full';
    const result = await markBookingPaid(req.params.id, req.body?.orderId, paymentType);
    res.json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to mark booking paid' });
  }
});

/**
 * Vercel Cron target — also callable manually.
 * Protect with CRON_SECRET when set (Authorization: Bearer <secret>).
 */
bookingRouter.post('/booking/expire', async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = String(req.headers.authorization || '');
      if (auth !== `Bearer ${secret}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    const result = await sweepExpiredBookings();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Expiry sweep failed' });
  }
});

bookingRouter.get('/booking/expire', async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = String(req.headers.authorization || '');
      if (auth !== `Bearer ${secret}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    const result = await sweepExpiredBookings();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Expiry sweep failed' });
  }
});
