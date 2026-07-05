import express, { Request, Response, Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import type { Conversation, UnifiedMessage } from '../src/types';
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
import { seedOmnichannelData } from './messaging/seedData';
import { verifyMetaWebhookSignature } from './messaging/webhookVerify';

export function emitOmniEvents(message: UnifiedMessage, conversation: Conversation) {
  emitMessageEvents(message, conversation);
}

export { seedOmnichannelData };

export const messagingRouter = Router();
let ioInstance: SocketIOServer | null = null;

class MockBullQueue {
  private queue: Array<{ name: string; data: unknown; retries: number }> = [];
  private processing = false;

  async add(jobName: string, data: unknown) {
    this.queue.push({ name: jobName, data, retries: 3 });
    console.log(`[Bull Queue] Job added: ${jobName}. Queue size: ${this.queue.length}`);
    this.processNext();
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const job = this.queue.shift()!;
    try {
      await this.worker(job);
    } catch (err) {
      console.error(`[Bull Queue] Failed Job ${job.name}:`, err);
      if (job.retries > 0) {
        job.retries -= 1;
        this.queue.push(job);
      }
    } finally {
      this.processing = false;
      setTimeout(() => this.processNext(), 100);
    }
  }

  private async worker(job: { name: string; data: unknown }) {
    if (job.name === 'process-meta-webhook') {
      await handleNormalizedMetaMessage(job.data as Record<string, unknown>);
    }
  }
}

const webhookQueue = new MockBullQueue();

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    socket.on('typing:start', ({ conversationId, agentName }: { conversationId: string; agentName: string }) => {
      socket.to(conversationId).emit('typing:start', { agentName });
    });

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(conversationId).emit('typing:stop');
    });
  });
}

function emitMessageEvents(message: UnifiedMessage, conversation: Conversation) {
  if (!ioInstance) return;
  ioInstance.emit('message:received', message);
  ioInstance.to(message.conversationId).emit('message:new', message);
  ioInstance.emit('conversation:updated', conversation);
}

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
  emitMessageEvents(message, conversation);
}

messagingRouter.get('/messaging/status', (_req: Request, res: Response) => {
  return res.status(200).json(getMessagingStatus());
});

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

  webhookQueue.add('process-meta-webhook', body);
  return res.status(200).json({ status: 'EVENT_RECEIVED', object: body.object });
}

messagingRouter.get('/conversations', async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(await listConversations());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.get('/conversations/:id', async (req: Request, res: Response) => {
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

messagingRouter.get('/messages/:conversationId', async (req: Request, res: Response) => {
  try {
    return res.status(200).json(await listMessages(req.params.conversationId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const { conversationId, content, senderId, senderName, templateName, templateLanguage } = req.body;

    if (!conversationId || !content?.body) {
      return res.status(400).json({ error: 'Mandatory params content, conversationId required.' });
    }

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
    const updatedConv = await patchConversation(conversationId, { lastMessage: content.body });
    if (updatedConv) {
      emitMessageEvents(outboundMsg, updatedConv);
    }

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
});

messagingRouter.patch('/conversation/status', async (req: Request, res: Response) => {
  try {
    const { conversationId, status } = req.body;
    if (!conversationId || !status) {
      return res.status(400).json({ error: 'conversationId and status fields are mandatory.' });
    }

    const updatedConv = await patchConversation(conversationId, { status });
    if (!updatedConv) {
      return res.status(404).json({ error: 'Conversation context not found.' });
    }

    ioInstance?.emit('conversation:updated', updatedConv);
    return res.status(200).json({ status: 'success', conversation: updatedConv });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.patch('/conversation/assign-agent', async (req: Request, res: Response) => {
  try {
    const { conversationId, agentId } = req.body;
    if (!conversationId || !agentId) {
      return res.status(400).json({ error: 'conversationId and agentId fields are mandatory' });
    }

    const updatedConv = await patchConversation(conversationId, { assignedAgent: agentId });
    if (!updatedConv) {
      return res.status(404).json({ error: 'Conversation thread not found' });
    }

    ioInstance?.emit('conversation:updated', updatedConv);
    return res.status(200).json({ status: 'success', conversation: updatedConv });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

messagingRouter.get('/agents', async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(await listAgents());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});
