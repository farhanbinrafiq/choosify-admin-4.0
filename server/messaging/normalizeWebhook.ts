import type { Conversation, UnifiedMessage } from '../../src/types';
import type { OmniPlatform } from './config';

export type NormalizedInbound = {
  platform: OmniPlatform;
  platformMessageId: string;
  senderId: string;
  senderName: string;
  bodyContent: string;
  type: 'text' | 'image' | 'file';
  mediaUrl?: string;
};

export function normalizeMetaWebhookPayload(webhookData: {
  object?: string;
  entry?: unknown[];
}): NormalizedInbound | null {
  const { object, entry } = webhookData;
  if (!object || !Array.isArray(entry) || entry.length === 0) {
    return null;
  }

  if (object === 'whatsapp_business_account') {
    const changes = (entry[0] as { changes?: { value?: Record<string, unknown> }[] })?.changes?.[0]?.value;
    const messages = changes?.messages as Array<Record<string, unknown>> | undefined;
    if (!messages?.length) return null;

    const msg = messages[0];
    const senderId = String(msg.from ?? '');
    const contacts = changes?.contacts as Array<{ profile?: { name?: string } }> | undefined;
    const senderName = contacts?.[0]?.profile?.name || `WA User (${senderId})`;
    const platformMessageId = String(msg.id ?? '');

    if (msg.type === 'text') {
      const text = msg.text as { body?: string };
      return {
        platform: 'whatsapp',
        platformMessageId,
        senderId,
        senderName,
        bodyContent: text.body || '',
        type: 'text',
      };
    }

    if (msg.type === 'image') {
      const image = msg.image as { url?: string };
      return {
        platform: 'whatsapp',
        platformMessageId,
        senderId,
        senderName,
        bodyContent: '[Image Attachment]',
        type: 'image',
        mediaUrl: image.url || 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=400',
      };
    }

    return {
      platform: 'whatsapp',
      platformMessageId,
      senderId,
      senderName,
      bodyContent: `[${String(msg.type)} File Attachment]`,
      type: 'file',
    };
  }

  if (object === 'page' || object === 'instagram') {
    const platform: OmniPlatform = object === 'page' ? 'messenger' : 'instagram';
    const messaging = (entry[0] as { messaging?: Array<Record<string, unknown>> })?.messaging?.[0];
    if (!messaging?.message) return null;

    const msg = messaging.message as Record<string, unknown>;
    const senderId = String((messaging.sender as { id?: string })?.id ?? '');
    const senderName =
      platform === 'messenger'
        ? `Messenger Contributor (${senderId.substring(0, 5)})`
        : `IG Fan (${senderId.substring(0, 5)})`;
    const platformMessageId = String(msg.mid ?? '');

    if (msg.text) {
      return {
        platform,
        platformMessageId,
        senderId,
        senderName,
        bodyContent: String(msg.text),
        type: 'text',
      };
    }

    const attachments = msg.attachments as Array<{ type?: string; payload?: { url?: string } }> | undefined;
    if (attachments?.[0]) {
      const att = attachments[0];
      if (att.type === 'image') {
        return {
          platform,
          platformMessageId,
          senderId,
          senderName,
          bodyContent: platform === 'messenger' ? '[Messenger Photo]' : '[Instagram Photo]',
          type: 'image',
          mediaUrl: att.payload?.url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
        };
      }
    }

    return {
      platform,
      platformMessageId,
      senderId,
      senderName,
      bodyContent: '[Attachment Document]',
      type: 'file',
    };
  }

  return null;
}

export function buildInboundMessage(
  normalized: NormalizedInbound,
  conversation: Pick<Conversation, 'assignedAgent' | 'status'>,
): { message: UnifiedMessage; conversation: Conversation } {
  const conversationId = `conv_${normalized.platform}_${normalized.senderId}`;
  const messageId = `m_in_${Date.now()}`;

  const message: UnifiedMessage = {
    id: messageId,
    platform: normalized.platform,
    platformMessageId: normalized.platformMessageId,
    conversationId,
    senderId: normalized.senderId,
    senderName: normalized.senderName,
    senderAvatar: normalized.senderName[0],
    content: {
      type: normalized.type,
      body: normalized.bodyContent,
      mediaUrl: normalized.mediaUrl,
    },
    direction: 'inbound',
    status: 'delivered',
    assignedAgent: conversation.assignedAgent || 'agent_farhan',
    conversationStatus: conversation.status || 'open',
    timestamp: new Date().toISOString(),
  };

  const updatedConversation: Conversation = {
    conversationId,
    platform: normalized.platform,
    senderName: normalized.senderName,
    senderAvatar: normalized.senderName[0],
    lastMessage: normalized.bodyContent,
    assignedAgent: conversation.assignedAgent || 'agent_farhan',
    status: conversation.status || 'open',
    updatedAt: new Date().toISOString(),
  };

  return { message, conversation: updatedConversation };
}
