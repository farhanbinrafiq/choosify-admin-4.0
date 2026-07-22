import type { Conversation, UnifiedMessage } from '../../src/types';
import type { OpsStorefrontOrder } from './types';
import { getConversation, saveConversation, saveMessage } from '../messaging/omniStore';
import { emitOmniEvents } from '../messagingHub';

const nowIso = () => new Date().toISOString();

export async function ensurePlatformOrderConversation(order: OpsStorefrontOrder): Promise<Conversation> {
  const conversationId = `conv_platform_${order.buyerId}`;
  const existing = await getConversation(conversationId);
  const summary = `Order ${order.orderId} placed — ৳${Number(order.overallTotal || 0).toLocaleString()} (${order.sourceMode || 'retail'})`;

  const conversation: Conversation = {
    conversationId,
    platform: 'platform',
    senderName: order.shipping?.fullName || order.buyerId,
    lastMessage: summary,
    assignedAgent: existing?.assignedAgent || 'agent_farhan',
    status: 'open',
    updatedAt: nowIso(),
  };

  await saveConversation(conversation);

  const message: UnifiedMessage = {
    id: `m_sys_${Date.now()}`,
    platform: 'platform',
    platformMessageId: `sys_order_${order.orderId}`,
    conversationId,
    senderId: 'system',
    senderName: 'Choosify Platform',
    content: { type: 'text', body: summary },
    direction: 'inbound',
    status: 'delivered',
    assignedAgent: conversation.assignedAgent,
    conversationStatus: conversation.status,
    timestamp: nowIso(),
  };

  await saveMessage(message);
  emitOmniEvents(message, conversation);
  return conversation;
}

export async function submitPlatformMessage(payload: {
  buyerId: string;
  userName: string;
  body: string;
  orderId?: string;
  bookingOffer?: Record<string, unknown>;
}): Promise<{ conversation: Conversation; message: UnifiedMessage }> {
  const conversationId = `conv_platform_${payload.buyerId}`;
  const existing = await getConversation(conversationId);

  const conversation: Conversation = {
    conversationId,
    platform: 'platform',
    senderName: payload.userName,
    lastMessage: payload.body,
    assignedAgent: existing?.assignedAgent || 'agent_farhan',
    status: 'open',
    updatedAt: nowIso(),
  };

  const prefix = payload.orderId ? `[Order ${payload.orderId}] ` : '';
  const message: UnifiedMessage = {
    id: `m_plat_${Date.now()}`,
    platform: 'platform',
    platformMessageId: `plat_${Date.now()}`,
    conversationId,
    senderId: payload.buyerId,
    senderName: payload.userName,
    content: { type: 'text', body: `${prefix}${payload.body}`.trim() },
    direction: 'inbound',
    status: 'delivered',
    assignedAgent: conversation.assignedAgent,
    conversationStatus: conversation.status,
    timestamp: nowIso(),
    bookingOffer: payload.bookingOffer,
  };

  await saveConversation(conversation);
  await saveMessage(message);
  emitOmniEvents(message, conversation);
  return { conversation, message };
}
