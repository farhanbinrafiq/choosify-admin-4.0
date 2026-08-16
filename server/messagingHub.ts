import { NextFunction, Request, Response, Router } from 'express';
import type { UnifiedMessage } from '../src/types';
import { getChannelAdapter } from './messaging/adapters';
import type { SendMessageResult } from './messaging/adapters/channelAdapter';
import { extractRecipientId, getMessagingStatus, getMetaVerifyToken } from './messaging/config';
import { buildInboundMessage, normalizeMetaWebhookPayload } from './messaging/normalizeWebhook';
import {
  getConversation,
  getLatestInboundMessage,
  listAgents,
  listConversations,
  listMessages,
  messageExistsByPlatformId,
  patchConversation,
  saveConversation,
  saveMessage,
} from './messaging/omniStore';
import { upsertOmniStaff } from './messaging/omniStaff';
import { seedOmnichannelData } from './messaging/seedData';
import { drainPendingWebhookJobs, enqueueMetaWebhookJob } from './messaging/webhookJobs';
import { verifyMetaWebhookSignature } from './messaging/webhookVerify';
import { AUTH_ERROR_CODES, sendAuthError } from './auth/authErrors';
import { authenticateRequest } from './middleware/auth';
import { validate } from './middleware/validate';
import { ROLES, type UserRole } from './permissions/roles';
import { SendMessageBodySchema } from './validation/messaging/sendMessageSchema';

export { seedOmnichannelData };

export const messagingRouter = Router();

const MESSAGING_LISTENER_ROLES = new Set<UserRole>([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.SUPPORT_AGENT,
  ROLES.FINANCE_MANAGER,
  ROLES.MARKETING_MANAGER,
]);

/**
 * Sprint 11 pre-commit audit: read/write access to raw customer conversation
 * content (list, read messages, send as the platform, reassign, change status)
 * is a narrower privilege than "may register for Firestore realtime listener
 * updates." Finance Manager and Marketing Manager have no operational need to
 * see or act on customer conversations, so they're excluded here even though
 * they remain in MESSAGING_LISTENER_ROLES for the lower-risk listener-registration
 * endpoint. Least-privilege, not a blanket reuse of that set.
 */
const OMNI_MESSAGING_ACCESS_ROLES = new Set<UserRole>([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MODERATOR,
  ROLES.SUPPORT_AGENT,
]);

/**
 * Sprint 11: this legacy Omni/Meta provider inbox mirrors real conversation data
 * (dual-written from canonical commerce messaging + real inbound Meta webhooks).
 * It previously had NO authentication on any read/write route. Unknown/missing
 * role fails closed (403), not open.
 */
function requireMessagingStaffAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.userRole;
  if (!role || !OMNI_MESSAGING_ACCESS_ROLES.has(role)) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Messaging provider access requires staff role.');
    return;
  }
  next();
}

const requireOmniMessagingAccess = [authenticateRequest, requireMessagingStaffAccess];

async function handleNormalizedMetaMessage(webhookData: Record<string, unknown>) {
  const normalized = normalizeMetaWebhookPayload(webhookData);
  if (!normalized) return;

  if (await messageExistsByPlatformId(normalized.platformMessageId)) {
    console.log(`[Deduplication] Message ${normalized.platformMessageId} already processed.`);
    return;
  }

  const conversationId = `conv_${normalized.platform}_${normalized.senderId}`;
  const existing = await getConversation(conversationId);

  const { message, conversation } = buildInboundMessage(normalized, {
    assignedAgent: existing?.assignedAgent || 'agent_farhan',
    status: existing?.status || 'open',
  });

  await saveMessage(message);
  await saveConversation(conversation);
}

/** Drain leftover Meta webhook jobs after process start (cold-start safety). */
export async function bootstrapMessagingJobs() {
  try {
    const count = await drainPendingWebhookJobs(handleNormalizedMetaMessage);
    if (count > 0) {
      console.log(`[webhook_jobs] Drained ${count} pending Meta webhook job(s).`);
    }
  } catch (err) {
    console.error('[webhook_jobs] Bootstrap drain failed:', err);
  }
}

messagingRouter.get('/messaging/status', (_req: Request, res: Response) => {
  return res.status(200).json(getMessagingStatus());
});

/**
 * Registers the signed-in staff uid in omni_staff so Firestore rules can allow
 * client onSnapshot reads of omni_conversations / omni_messages.
 */
messagingRouter.post(
  '/messaging/register-listener',
  authenticateRequest,
  async (req: Request, res: Response) => {
    try {
      const role = req.userRole;
      if (!role || !MESSAGING_LISTENER_ROLES.has(role)) {
        return res.status(403).json({ error: 'Messaging listener registration requires staff role.' });
      }
      const uid = req.userId || req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: 'Missing authenticated user.' });
      }
      await upsertOmniStaff(uid, { email: req.user?.email, role });
      return res.status(200).json({ status: 'ok', uid });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  },
);

messagingRouter.get('/webhooks/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === getMetaVerifyToken()) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

export async function handleMetaWebhookPost(req: Request, res: Response) {
  const rawBody = req.body as Buffer;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid Meta signature');
    return res.sendStatus(403);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (!body.object) {
    return res.status(400).json({ error: 'Invalid meta webhook payload structure' });
  }

  // Acknowledge quickly; job record survives cold starts if processing is interrupted.
  void enqueueMetaWebhookJob(body, handleNormalizedMetaMessage).catch((err) => {
    console.error('[webhook_jobs] Failed to enqueue/process Meta webhook:', err);
  });
  return res.status(200).json({ status: 'EVENT_RECEIVED', object: body.object });
}

messagingRouter.get('/conversations', ...requireOmniMessagingAccess, async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(await listConversations());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.get('/conversations/:id', ...requireOmniMessagingAccess, async (req: Request, res: Response) => {
  try {
    const conversation = await getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation thread not found.' });
    }
    return res.status(200).json(conversation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.get('/messages/:conversationId', ...requireOmniMessagingAccess, async (req: Request, res: Response) => {
  try {
    return res.status(200).json(await listMessages(req.params.conversationId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.post(
  '/messages/send',
  ...requireOmniMessagingAccess,
  validate({ body: SendMessageBodySchema }),
  async (req: Request, res: Response) => {
  try {
    const { conversationId, content, senderId, senderName, templateName, templateLanguage } = req.body;

    const conv = await getConversation(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Active context thread not found' });
    }

    let whatsappRuleViolation = false;
    if (conv.platform === 'whatsapp') {
      const latestInbound = await getLatestInboundMessage(conversationId);
      if (latestInbound) {
        const hrsElapsed = (Date.now() - new Date(latestInbound.timestamp).getTime()) / (1000 * 60 * 60);
        if (hrsElapsed > 24 && !templateName) {
          whatsappRuleViolation = true;
        }
      }
    }

    const recipientId = extractRecipientId(conversationId, conv.platform);
    const adapter = getChannelAdapter(conv.platform);

    let delivery: SendMessageResult = {
      platformMessageId: `mid.out_${Date.now()}_local`,
      delivered: false,
      mode: 'mock',
    };

    if (!whatsappRuleViolation && conv.platform !== 'platform') {
      try {
        delivery = await adapter.sendMessage({
          platform: conv.platform,
          recipientId,
          content: {
            type: content.type || 'text',
            body: content.body,
            mediaUrl: content.mediaUrl,
            templateName,
            templateLanguage,
          },
        });
      } catch (err) {
        console.error('[Outbound Adapter Error]', err);
        return res.status(502).json({
          error: err instanceof Error ? err.message : 'Failed to deliver message via channel adapter',
        });
      }
    }

    const outboundMsg: UnifiedMessage = {
      id: `m_out_${Date.now()}`,
      platform: conv.platform,
      platformMessageId: delivery.platformMessageId,
      conversationId,
      senderId: senderId || 'agent_farhan',
      senderName: senderName || 'Kazi Farhan (Supervisor)',
      content: {
        type: content.type || 'text',
        body: content.body,
        mediaUrl: content.mediaUrl,
      },
      direction: 'outbound',
      status: delivery.delivered ? 'delivered' : 'sent',
      assignedAgent: conv.assignedAgent || 'agent_farhan',
      conversationStatus: conv.status || 'open',
      timestamp: new Date().toISOString(),
    };

    await saveMessage(outboundMsg);
    await patchConversation(conversationId, { lastMessage: content.body });

    return res.status(200).json({
      status: 'success',
      message: outboundMsg,
      delivery,
      whatsapp24HourWarning: whatsappRuleViolation
        ? "Outgoing message exceeds WhatsApp's active 24-hour user interaction window. Use an approved template."
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
  },
);

messagingRouter.patch('/conversation/status', ...requireOmniMessagingAccess, async (req: Request, res: Response) => {
  try {
    const { conversationId, status } = req.body;
    if (!conversationId || !status) {
      return res.status(400).json({ error: 'conversationId and status fields are mandatory.' });
    }

    const updatedConv = await patchConversation(conversationId, { status });
    if (!updatedConv) {
      return res.status(404).json({ error: 'Conversation context not found.' });
    }

    return res.status(200).json({ status: 'success', conversation: updatedConv });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.patch('/conversation/assign-agent', ...requireOmniMessagingAccess, async (req: Request, res: Response) => {
  try {
    const { conversationId, agentId } = req.body;
    if (!conversationId || !agentId) {
      return res.status(400).json({ error: 'conversationId and agentId fields are mandatory' });
    }

    const updatedConv = await patchConversation(conversationId, { assignedAgent: agentId });
    if (!updatedConv) {
      return res.status(404).json({ error: 'Conversation thread not found' });
    }

    return res.status(200).json({ status: 'success', conversation: updatedConv });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.get('/agents', ...requireOmniMessagingAccess, async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(await listAgents());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});
