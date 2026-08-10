/**
 * Dual-write bridge: Commerce Conversation SoT → Omni Unified Inbox (frozen UI).
 */

import type { Conversation, UnifiedMessage } from '../../../src/types';
import {
  getConversation as getOmniConversation,
  saveConversation as saveOmniConversation,
  saveMessage as saveOmniMessage,
} from '../omniStore';
import type { CommerceConversation, CommerceMessage } from './types';

function omniPlatform(
  channel: CommerceConversation['sourceChannel'],
): Conversation['platform'] {
  if (channel === 'facebook') return 'messenger';
  if (channel === 'instagram') return 'instagram';
  if (channel === 'whatsapp' || channel === 'external_whatsapp') return 'whatsapp';
  return 'platform';
}

export async function mirrorConversationToOmni(conv: CommerceConversation): Promise<void> {
  const existing = await getOmniConversation(conv.id);
  const row: Conversation = {
    conversationId: conv.id,
    platform: omniPlatform(conv.sourceChannel),
    senderName:
      (existing?.senderName as string) ||
      (typeof conv.metadata?.consumerName === 'string'
        ? conv.metadata.consumerName
        : `Consumer ${conv.consumerId.slice(0, 8)}`),
    senderAvatar: existing?.senderAvatar,
    lastMessage: conv.lastMessagePreview || existing?.lastMessage,
    assignedAgent: existing?.assignedAgent || conv.sellerId,
    status:
      conv.status === 'active' ? 'open' : conv.status === 'read_only' ? 'resolved' : 'pending',
    updatedAt: conv.updatedAt,
  };
  await saveOmniConversation(row);
}

export async function mirrorMessageToOmni(
  conv: CommerceConversation,
  msg: CommerceMessage,
): Promise<void> {
  const direction: UnifiedMessage['direction'] =
    msg.senderRole === 'consumer' ? 'inbound' : 'outbound';
  const contentType: UnifiedMessage['content']['type'] =
    msg.messageType === 'attachment' ? 'file' : 'text';
  const omni: UnifiedMessage = {
    id: msg.id,
    platform: omniPlatform(conv.sourceChannel),
    platformMessageId: msg.externalMessageId || msg.id,
    conversationId: conv.id,
    senderId: msg.senderId,
    senderName: msg.senderRole,
    content: {
      type: contentType,
      body: msg.body,
    },
    direction,
    status: 'sent',
    conversationStatus: conv.status === 'active' ? 'open' : 'resolved',
    timestamp: msg.createdAt,
    bookingOffer:
      msg.messageType === 'counter_offer'
        ? (msg.metadata as Record<string, unknown>)
        : undefined,
  };
  await saveOmniMessage(omni);
  await mirrorConversationToOmni({
    ...conv,
    lastMessagePreview: msg.body.slice(0, 240),
    lastMessageAt: msg.createdAt,
    updatedAt: msg.createdAt,
  });
}
