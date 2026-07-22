import { Router } from 'express';
import { getBookingFieldConfigPayload } from '../../shared/booking/bookingFieldConfig';
import { toBookingOfferCard } from '../../shared/booking/bookingTypes';
import { getBookingRequest, listBookingRequests } from './bookingStore';
import {
  acceptBookingRequest,
  buyerAcceptCounter,
  counterBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  markBookingPaid,
  sweepExpiredBookings,
} from './bookingService';

export const bookingRouter = Router();

/** Public — shared field config for Product Studio + storefront Message Seller */
bookingRouter.get('/booking/field-config', (_req, res) => {
  res.json({ success: true, data: getBookingFieldConfigPayload() });
});

bookingRouter.get('/booking/requests', async (req, res) => {
  try {
    const rows = await listBookingRequests({
      sellerId: typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined,
      buyerId: typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined,
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

bookingRouter.get('/booking/requests/:id', async (req, res) => {
  try {
    const request = await getBookingRequest(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'Booking request not found' });
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

bookingRouter.post('/booking/requests', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.listingId || !body.buyerId || !body.sellerId) {
      res.status(400).json({ error: 'listingId, buyerId, and sellerId are required' });
      return;
    }
    const result = await createBookingRequest({
      listingId: String(body.listingId),
      listingTitle: String(body.listingTitle || 'Service listing'),
      listingImage: body.listingImage,
      listingHref: body.listingHref,
      sellerId: String(body.sellerId),
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
      threadId: body.threadId,
    });
    res.status(201).json({ success: true, data: result.offer, request: result.request });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create booking request' });
  }
});

bookingRouter.post('/booking/requests/:id/accept', async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || '');
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

bookingRouter.post('/booking/requests/:id/decline', async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || '');
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

bookingRouter.post('/booking/requests/:id/counter', async (req, res) => {
  try {
    const sellerId = String(req.body?.sellerId || '');
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

bookingRouter.post('/booking/requests/:id/buyer-accept', async (req, res) => {
  try {
    const buyerId = String(req.body?.buyerId || '');
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

bookingRouter.post('/booking/requests/:id/mark-paid', async (req, res) => {
  try {
    const result = await markBookingPaid(req.params.id, req.body?.orderId);
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
