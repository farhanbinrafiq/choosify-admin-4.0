/**
 * Authoritative Messaging API — IS-005 §56 under /api/v1.
 */

import { Router } from 'express';
import { CommerceError } from '../../commerce/cartService';
import { authenticateRequest } from '../../middleware/auth';
import { requirePartnerEntitlement } from '../../entitlements/entitlementMiddleware';
import { requireMarketplaceAccess } from '../../entitlements/marketplaceAccessMiddleware';
import { Logger } from '../../lib/logger';
import { conversationMemoryFlushNow } from './conversationMemoryBackend';
import {
  connectSocialInbox,
  createCounterOffer,
  createProductInquiry,
  createServiceInquiry,
  disconnectSocialInbox,
  ensureActiveSupportConversation,
  enterConversationAsAdmin,
  findActiveSupportConversationForUser,
  getConversationForActor,
  listAdminSupportInbox,
  listConversationsForActor,
  listMessagesForActor,
  markConversationRead,
  openAdminSupportConversation,
  reconcileMissingOrderConversations,
  respondCounterOffer,
  searchConversationsForActor,
  sendMessage,
  resolveSupportTicket,
} from './conversationService';
import { isAdminEnterRole, resolveSelfServiceSupportAudience } from './conversationPermissions';
import {
  assertMessagingPersistenceReady,
  getMessagingPersistenceMode,
  listSocialInbox,
} from './conversationStore';
import { conversationMemorySnapshotPath } from './conversationPersistence';
import { getStoreBackend } from '../omniStore';
import {
  SUPPORT_TICKET_STATUSES,
  type SupportTicketStatus,
  type SupportTicketPriority,
} from './types';

export const conversationRouter = Router();

function flushIfMemoryDisk(): void {
  if (getMessagingPersistenceMode() === 'memory-disk') {
    conversationMemoryFlushNow();
  }
}

const requireAuth = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess];

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

/**
 * Public transport status — no auth required (clients must be able to check
 * this before/without a session to decide whether to rely on Firestore push
 * or fall back to REST polling). `realtime` reflects the OMNI store backend
 * specifically: that's the collection (`omni_conversations`/`omni_messages`)
 * every client-side onSnapshot listener in this app actually subscribes to
 * (via mirrorConversationToOmni/mirrorMessageToOmni + System B's own direct
 * writes) — `mode` below is the separate System A conversationStore backend,
 * kept for backward compatibility with existing callers of this route.
 */
conversationRouter.get('/messaging/persistence-mode', async (_req, res) => {
  try {
    assertMessagingPersistenceReady();
    const mode = getMessagingPersistenceMode();
    const omniBackend = await getStoreBackend();
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
        omniBackend,
        /** true only when the omni Firestore mirror is genuinely live —
         *  clients should treat this as the switch between trusting
         *  onSnapshot pushes and running their own REST poll. */
        realtime: omniBackend === 'admin',
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

conversationRouter.post('/conversations/:id/read', ...requireAuth, async (req, res) => {
  try {
    const result = await markConversationRead({ conversationId: req.params.id, actor: actorOf(req) });
    flushIfMemoryDisk();
    res.json({ success: true, data: result });
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

conversationRouter.get('/support/conversations/active', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const audienceParam = typeof req.query.audience === 'string' ? req.query.audience : undefined;
    const audience = resolveSelfServiceSupportAudience(actor, audienceParam);
    const found = await findActiveSupportConversationForUser(actor.userId, audience);
    if (!found) {
      res.status(404).json({ success: false, error: 'No active support conversation' });
      return;
    }
    // Lets a caller that's only silently CHECKING for an already-existing
    // thread (not opening it) still know whether it has anything new —
    // e.g. the storefront surfacing an admin-initiated thread the user
    // hasn't clicked into yet. Same "not mine, not yet in my readBy" rule
    // the admin inbox's own unread count uses, just from the opener's side.
    const msgs = await listMessagesForActor(found.conversation.id, actor);
    const unreadCount = msgs.filter(
      (m) => m.senderId !== actor.userId && !(Array.isArray(m.readBy) ? m.readBy : []).includes(actor.userId),
    ).length;
    res.json({ success: true, data: { ...found, created: false, unreadCount } });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/support/conversations', ...requireAuth, async (req, res) => {
  try {
    const rows = await listConversationsForActor(actorOf(req), { contextType: 'support_ticket' });
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/conversations/:id/read', ...requireAuth, async (req, res) => {
  try {
    const result = await markConversationRead({ conversationId: req.params.id, actor: actorOf(req) });
    flushIfMemoryDisk();
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

/** Choosify Support inbox — staff only. Enriched opener identity + audience + unread. */
conversationRouter.get('/admin/support/conversations', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    if (!isAdminEnterRole(actor.role)) {
      res.status(403).json({ success: false, error: 'Choosify staff only' });
      return;
    }
    const audienceRaw = typeof req.query.audience === 'string' ? req.query.audience : '';
    const audience =
      audienceRaw === 'consumer' || audienceRaw === 'seller' || audienceRaw === 'creator'
        ? audienceRaw
        : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = (Object.values(SUPPORT_TICKET_STATUSES) as string[]).includes(statusRaw ?? '')
      ? (statusRaw as SupportTicketStatus)
      : undefined;
    const priorityRaw = typeof req.query.priority === 'string' ? req.query.priority : undefined;
    const priority = (['low', 'medium', 'high', 'urgent'] as const).includes(
      priorityRaw as SupportTicketPriority,
    )
      ? (priorityRaw as SupportTicketPriority)
      : undefined;
    const assigneeId = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined;
    const rows = await listAdminSupportInbox(actor, {
      audience,
      status,
      priority,
      assigneeId: assigneeId === 'me' ? actor.userId : assigneeId,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Admin CRM / Support Desk — staff-only ticket controls ────────────────
conversationRouter.patch('/admin/support/conversations/:id', ...requireAuth, async (req, res) => {
  try {
    const { updateSupportTicketCrm } = await import('./conversationService');
    const ticket = await updateSupportTicketCrm({
      actor: actorOf(req),
      conversationId: req.params.id,
      patch: {
        status: req.body?.status,
        priority: req.body?.priority,
        assigneeId: req.body?.assigneeId === null ? null : req.body?.assigneeId,
        department: req.body?.department === null ? null : req.body?.department,
      },
    });
    flushIfMemoryDisk();
    res.json({ success: true, data: ticket });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/admin/support/conversations/:id/notes', ...requireAuth, async (req, res) => {
  try {
    const { listSupportNotesForActor } = await import('./conversationService');
    const rows = await listSupportNotesForActor(actorOf(req), req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/admin/support/conversations/:id/notes', ...requireAuth, async (req, res) => {
  try {
    const { addSupportNote } = await import('./conversationService');
    const note = await addSupportNote({
      actor: actorOf(req),
      conversationId: req.params.id,
      body: String(req.body?.body || ''),
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/admin/support/conversations/:id/followups', ...requireAuth, async (req, res) => {
  try {
    const { listSupportFollowupsForActor } = await import('./conversationService');
    const rows = await listSupportFollowupsForActor(actorOf(req), req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/admin/support/conversations/:id/followups', ...requireAuth, async (req, res) => {
  try {
    const { scheduleSupportFollowup } = await import('./conversationService');
    const fu = await scheduleSupportFollowup({
      actor: actorOf(req),
      conversationId: req.params.id,
      dueAt: String(req.body?.dueAt || ''),
    });
    flushIfMemoryDisk();
    res.status(201).json({ success: true, data: fu });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post(
  '/admin/support/conversations/:id/followups/:fid/cancel',
  ...requireAuth,
  async (req, res) => {
    try {
      const { cancelSupportFollowup } = await import('./conversationService');
      const fu = await cancelSupportFollowup({
        actor: actorOf(req),
        conversationId: req.params.id,
        followupId: req.params.fid,
      });
      flushIfMemoryDisk();
      res.json({ success: true, data: fu });
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Admin/Support proactively opens or reuses a user's Choosify Support thread. */
conversationRouter.post('/admin/support/conversations', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    if (!isAdminEnterRole(actor.role)) {
      res.status(403).json({ success: false, error: 'Choosify staff only' });
      return;
    }
    const targetUserId = String(req.body?.targetUserId || '').trim();
    if (!targetUserId) {
      res.status(400).json({ success: false, error: 'targetUserId is required' });
      return;
    }
    const audienceRaw = typeof req.body?.audience === 'string' ? req.body.audience : '';
    const audience =
      audienceRaw === 'consumer' || audienceRaw === 'seller' || audienceRaw === 'creator'
        ? audienceRaw
        : undefined;
    const result = await openAdminSupportConversation({
      adminActor: actor,
      targetUserId,
      audience,
      subject: req.body?.subject ? String(req.body.subject) : undefined,
      body: req.body?.body ? String(req.body.body) : undefined,
    });
    flushIfMemoryDisk();
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.get('/support/conversations/:id/messages', ...requireAuth, async (req, res) => {
  try {
    const conv = await getConversationForActor(req.params.id, actorOf(req));
    if (conv.contextType !== 'support_ticket') {
      res.status(400).json({ success: false, error: 'Not a support conversation' });
      return;
    }
    const messages = await listMessagesForActor(conv.id, actorOf(req));
    res.json({ success: true, data: messages });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/conversations/ensure', ...requireAuth, async (req, res) => {
  try {
    const result = await ensureActiveSupportConversation({
      actor: actorOf(req),
      subject: req.body?.subject ? String(req.body.subject) : undefined,
      body: req.body?.body ? String(req.body.body) : undefined,
      audience: req.body?.audience ? String(req.body.audience) : undefined,
    });
    flushIfMemoryDisk();
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/tickets', ...requireAuth, async (req, res) => {
  try {
    const result = await ensureActiveSupportConversation({
      actor: actorOf(req),
      subject: req.body?.subject ? String(req.body.subject) : undefined,
      body: req.body?.body ? String(req.body.body) : undefined,
      audience: req.body?.audience ? String(req.body.audience) : undefined,
    });
    flushIfMemoryDisk();
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/tickets/:id/resolve', ...requireAuth, async (req, res) => {
  try {
    const result = await resolveSupportTicket({
      actor: actorOf(req),
      ticketId: req.params.id,
      status: req.body?.status === 'closed' ? 'closed' : 'resolved',
    });
    flushIfMemoryDisk();
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/conversations/:id/resolve', ...requireAuth, async (req, res) => {
  try {
    const result = await resolveSupportTicket({
      actor: actorOf(req),
      conversationId: req.params.id,
      status: req.body?.status === 'closed' ? 'closed' : 'resolved',
    });
    flushIfMemoryDisk();
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

conversationRouter.post('/support/conversations/:id/messages', ...requireAuth, async (req, res) => {
  try {
    const conv = await getConversationForActor(req.params.id, actorOf(req));
    if (conv.contextType !== 'support_ticket') {
      res.status(400).json({ success: false, error: 'Not a support conversation' });
      return;
    }
    const actor = actorOf(req);
    const isOpener =
      conv.consumerId === actor.userId ||
      conv.participants.some((p) => p.userId === actor.userId);
    const body = req.body || {};
    const result = await sendMessage({
      conversationId: conv.id,
      actor,
      body: String(body.body || body.content?.body || ''),
      messageType: body.messageType,
      requireAdminEntry: isOpener ? false : undefined,
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
