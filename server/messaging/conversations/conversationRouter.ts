/**
 * Authoritative Messaging API — IS-005 §56 under /api/v1.
 */

import { Router } from 'express';
import { CommerceError } from '../../commerce/cartService';
import { authenticateRequest } from '../../middleware/auth';
import { Logger } from '../../lib/logger';
import { conversationMemoryFlushNow } from './conversationMemoryBackend';
import {
  connectSocialInbox,
  createCounterOffer,
  createProductInquiry,
  createServiceInquiry,
  createSupportTicket,
  disconnectSocialInbox,
  enterConversationAsAdmin,
  getConversationForActor,
  listConversationsForActor,
  listMessagesForActor,
  reconcileMissingOrderConversations,
  respondCounterOffer,
  searchConversationsForActor,
  sendMessage,
} from './conversationService';
import {
  assertMessagingPersistenceReady,
  getMessagingPersistenceMode,
  listSocialInbox,
} from './conversationStore';
import { conversationMemorySnapshotPath } from './conversationPersistence';

export const conversationRouter = Router();

function flushIfMemoryDisk(): void {
  if (getMessagingPersistenceMode() === 'memory-disk') {
    conversationMemoryFlushNow();
  }
}

const requireAuth = [authenticateRequest];

function actorOf(req: {
  userId?: string;
  user?: { uid?: string; role?: string };
  userRole?: string;
}): { userId: string; role?: string } {
  return {
    userId: req.userId || req.user?.uid || '',
    role: req.userRole || req.user?.role,
  };
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof CommerceError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  Logger.error('Messaging API error', {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Messaging error',
  });
}

conversationRouter.post('/messaging/flush', ...requireAuth, async (req, res) => {
  try {
    const role = actorOf(req).role;
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Admin only' });
      return;
    }
    flushIfMemoryDisk();
    res.json({ success: true, data: { flushed: true, mode: getMessagingPersistenceMode() } });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/messaging/persistence-mode', (_req, res) => {
  try {
    assertMessagingPersistenceReady();
    const mode = getMessagingPersistenceMode();
    res.json({
      success: true,
      data: {
        mode,
        snapshotPath: mode === 'memory-disk' ? conversationMemorySnapshotPath() : null,
        notificationEngine: false,
        firestoreCollections:
          mode === 'firestore-admin'
            ? [
                'messaging_conversations',
                'messaging_messages',
                'messaging_attachments',
                'messaging_social_inbox',
                'messaging_support_tickets',
                'messaging_admin_entries',
              ]
            : undefined,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/messaging/reconcile-order-conversations', ...requireAuth, async (req, res) => {
  try {
    const role = actorOf(req).role;
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Admin only' });
      return;
    }
    const result = await reconcileMissingOrderConversations();
    flushIfMemoryDisk();
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/conversations/search', ...requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const rows = await searchConversationsForActor(actorOf(req), q);
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/conversations', ...requireAuth, async (req, res) => {
  try {
    const rows = await listConversationsForActor(actorOf(req), {
      brandId: typeof req.query.brandId === 'string' ? req.query.brandId : undefined,
      contextType: typeof req.query.contextType === 'string' ? req.query.contextType : undefined,
      sourceChannel:
        typeof req.query.sourceChannel === 'string' ? req.query.sourceChannel : undefined,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/conversations/:id', ...requireAuth, async (req, res) => {
  try {
    const conv = await getConversationForActor(req.params.id, actorOf(req));
    res.json({ success: true, data: conv });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/conversations/:id/messages', ...requireAuth, async (req, res) => {
  try {
    const rows = await listMessagesForActor(req.params.id, actorOf(req));
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/conversations/:id/messages', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await sendMessage({
      conversationId: req.params.id,
      actor: actorOf(req),
      body: String(body.body || body.content?.body || ''),
      messageType: body.messageType,
      attachment: body.attachment,
      clientSenderId: body.senderId,
      externalMessageId: body.externalMessageId,
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/conversations/:id/counter-offers', ...requireAuth, async (req, res) => {
  try {
    const result = await createCounterOffer({
      conversationId: req.params.id,
      actor: actorOf(req),
      amount: Number(req.body?.amount),
      currency: req.body?.currency,
      note: req.body?.note,
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post(
  '/conversations/:id/counter-offers/:offerId/respond',
  ...requireAuth,
  async (req, res) => {
    try {
      const action = String(req.body?.action || '').toLowerCase();
      if (action !== 'accept' && action !== 'reject') {
        res.status(400).json({ success: false, error: 'action must be accept|reject' });
        return;
      }
      const result = await respondCounterOffer({
        conversationId: req.params.id,
        offerId: req.params.offerId,
        actor: actorOf(req),
        action,
      });
      flushIfMemoryDisk();
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);

conversationRouter.post('/products/:id/inquiries', ...requireAuth, async (req, res) => {
  try {
    const result = await createProductInquiry({
      productId: req.params.id,
      actor: actorOf(req),
      body: req.body?.body,
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/services/:id/inquiries', ...requireAuth, async (req, res) => {
  try {
    const result = await createServiceInquiry({
      serviceId: req.params.id,
      actor: actorOf(req),
      body: req.body?.body,
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/seller/social-inbox/connect', ...requireAuth, async (req, res) => {
  try {
    const channel = String(req.body?.channel || '') as 'facebook' | 'instagram' | 'whatsapp';
    if (!['facebook', 'instagram', 'whatsapp'].includes(channel)) {
      res.status(400).json({ success: false, error: 'Invalid channel' });
      return;
    }
    const row = await connectSocialInbox({
      actor: actorOf(req),
      brandId: String(req.body?.brandId || ''),
      channel,
      externalAccountId: req.body?.externalAccountId,
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/seller/social-inbox/status', ...requireAuth, async (req, res) => {
  try {
    const brandId = typeof req.query.brandId === 'string' ? req.query.brandId : undefined;
    const rows = await listSocialInbox(brandId);
    // Ownership filter: only return rows the actor owns
    const { sellerOwnsBrand } = await import('../../catalog/brandOwnership');
    const actor = actorOf(req);
    const visible = [];
    for (const row of rows) {
      if (row.sellerId === actor.userId || (await sellerOwnsBrand(actor.userId, row.brandId))) {
        visible.push(row);
      }
    }
    res.json({ success: true, data: visible });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.delete('/seller/social-inbox/:channel', ...requireAuth, async (req, res) => {
  try {
    const channel = String(req.params.channel) as 'facebook' | 'instagram' | 'whatsapp';
    const brandId = String(req.query.brandId || req.body?.brandId || '');
    const row = await disconnectSocialInbox({
      actor: actorOf(req),
      brandId,
      channel,
    });
    res.json({ success: true, data: row });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/tickets', ...requireAuth, async (req, res) => {
  try {
    const result = await createSupportTicket({
      actor: actorOf(req),
      subject: String(req.body?.subject || ''),
      body: String(req.body?.body || ''),
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post(
  '/admin/conversations/:id/enter',
  ...requireAuth,
  async (req, res) => {
    try {
      const result = await enterConversationAsAdmin({
        conversationId: req.params.id,
        actor: actorOf(req),
        reason: req.body?.reason ? String(req.body.reason) : undefined,
      });
      flushIfMemoryDisk();
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  },
);
