import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { Logger } from '../lib/logger';
import { findUserByChoosifyUserId } from '../auth/choosifyUserId';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { commerceStore } from '../commerce/commerceStore';
import { commercePaymentStore } from '../payments/commercePaymentStore';
import { escrowStore } from '../escrow/escrowStore';
import { adsStore } from '../ads/adsStore';
import { getConversation } from '../messaging/conversations/conversationStore';
import { getCashbookForOwner } from '../cashbook/cashbookStore';
import {
  lookupReferenceIndex,
  parseReferenceId,
  ensureReferenceIdSchema,
} from './referenceIdService';
import { backfillAllReferenceIds } from './backfillAllReferenceIds';

export const referenceIdRouter = Router();
const requireAuth = [authenticateRequest];

function isStaff(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin';
}

function actorOf(req: {
  userId?: string;
  user?: { uid?: string; role?: string };
  userRole?: string;
}) {
  return {
    userId: req.userId || req.user?.uid || '',
    role: req.userRole || req.user?.role,
  };
}

/**
 * Resolve a platform reference ID to entity metadata (RBAC-gated).
 * GET /api/v1/reference/:referenceId
 */
referenceIdRouter.get('/reference/:referenceId', ...requireAuth, async (req, res) => {
  try {
    await ensureReferenceIdSchema();
    const parsed = parseReferenceId(req.params.referenceId);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Invalid reference ID format' });
      return;
    }
    const actor = actorOf(req);
    const staff = isStaff(actor.role);
    const indexed = lookupReferenceIndex(parsed.canonical);

    let internalId = indexed?.internalId || null;
    let payload: Record<string, unknown> | null = null;

    if (parsed.entityType === 'user') {
      const user = await findUserByChoosifyUserId(parsed.canonical);
      if (!user) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      if (!staff && actor.userId !== user.id) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      internalId = user.id;
      payload = {
        id: user.id,
        choosifyUserId: user.choosifyUserId,
        email: staff || actor.userId === user.id ? user.email : undefined,
        displayName: user.displayName,
        role: user.role,
      };
    } else if (parsed.entityType === 'brand') {
      const brand = internalId
        ? await catalogStore.getBrand(internalId)
        : (await catalogStore.listBrands()).find((b) => b.brandReferenceId === parsed.canonical) ||
          null;
      if (!brand) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      if (!staff && brand.sellerId && brand.sellerId !== actor.userId) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      payload = {
        id: brand.id,
        brandReferenceId: brand.brandReferenceId || parsed.canonical,
        name: brand.name,
        slug: brand.slug,
      };
    } else if (parsed.entityType === 'product') {
      const product = internalId
        ? await catalogStore.getProduct(internalId)
        : (await catalogStore.listProducts()).find(
            (p) => p.productReferenceId === parsed.canonical,
          ) || null;
      if (!product) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      payload = {
        id: product.id,
        productReferenceId: product.productReferenceId || parsed.canonical,
        title: product.title,
        brandId: product.brandId,
        slug: product.slug,
      };
    } else if (parsed.entityType === 'content') {
      const guide = internalId
        ? await catalogStore.getGuide(internalId)
        : (await catalogStore.listGuides()).find(
            (g) => g.contentReferenceId === parsed.canonical,
          ) || null;
      if (!guide) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      payload = {
        id: guide.id,
        contentReferenceId: guide.contentReferenceId || parsed.canonical,
        title: guide.title,
        type: guide.type,
      };
    } else if (parsed.entityType === 'order' || parsed.entityType === 'invoice') {
      const orders = await commerceStore.listOrders();
      const order =
        (internalId ? await commerceStore.getOrder(internalId) : null) ||
        orders.find((o) =>
          parsed.entityType === 'order'
            ? o.orderReferenceId === parsed.canonical
            : o.invoiceReferenceId === parsed.canonical,
        ) ||
        null;
      if (!order) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      if (
        !staff &&
        actor.userId !== order.sellerId &&
        actor.userId !== order.consumerId
      ) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      payload = {
        id: order.id,
        orderNumber: order.orderNumber,
        orderReferenceId: order.orderReferenceId,
        invoiceReferenceId: order.invoiceReferenceId,
        status: order.status,
      };
    } else if (parsed.entityType === 'payment') {
      if (!staff) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      const payment = internalId
        ? await commercePaymentStore.getPayment(internalId)
        : null;
      if (!payment) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      payload = {
        paymentId: payment.paymentId,
        paymentReferenceId: payment.paymentReferenceId || parsed.canonical,
        status: payment.status,
        providerTransactionId: payment.providerTransactionId,
      };
    } else if (parsed.entityType === 'escrow') {
      if (!staff) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      const escrow = internalId ? await escrowStore.getEscrow(internalId) : null;
      if (!escrow) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      payload = {
        escrowId: escrow.escrowId,
        escrowReferenceId: escrow.escrowReferenceId || parsed.canonical,
        paymentId: escrow.paymentId,
        orderId: escrow.orderId,
      };
    } else if (parsed.entityType === 'advertisement' || parsed.entityType === 'deal') {
      const ad = internalId
        ? await adsStore.getAd(internalId)
        : (await adsStore.listAds()).find((a) =>
            parsed.entityType === 'deal'
              ? a.dealReferenceId === parsed.canonical
              : a.advertisementReferenceId === parsed.canonical,
          ) || null;
      if (!ad) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      if (!staff && ad.ownerId !== actor.userId) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      payload = {
        id: ad.id,
        kind: ad.kind,
        title: ad.title,
        dealReferenceId: ad.dealReferenceId,
        advertisementReferenceId: ad.advertisementReferenceId,
      };
    } else if (parsed.entityType === 'conversation') {
      if (!staff) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      const conv = internalId ? await getConversation(internalId) : null;
      if (!conv) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      payload = {
        id: conv.id,
        conversationReferenceId: conv.conversationReferenceId || parsed.canonical,
        orderId: conv.orderId,
      };
    } else if (parsed.entityType === 'cashbook') {
      if (!internalId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      const book = getCashbookForOwner(internalId, actor.userId);
      if (!book && !staff) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      payload = {
        id: internalId,
        cashbookReferenceId: parsed.canonical,
        name: book?.name,
      };
    } else if (parsed.entityType === 'return' || parsed.entityType === 'refund') {
      if (!staff) {
        res.status(403).json({ success: false, error: 'Not authorized' });
        return;
      }
      payload = {
        id: internalId,
        referenceId: parsed.canonical,
        entityType: parsed.entityType,
      };
      if (!internalId) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        referenceId: parsed.canonical,
        entityType: parsed.entityType,
        internalId,
        entity: payload,
      },
    });
  } catch (error) {
    Logger.error('Reference lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Reference lookup failed' });
  }
});

/** Admin-only: run idempotent backfill. */
referenceIdRouter.post('/reference/backfill', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    if (!isStaff(actor.role)) {
      res.status(403).json({ success: false, error: 'Admin only' });
      return;
    }
    const report = await backfillAllReferenceIds();
    res.json({ success: true, data: report });
  } catch (error) {
    Logger.error('Reference backfill failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Backfill failed',
    });
  }
});
