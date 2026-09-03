import type { Conversation, UnifiedMessage } from '../../src/types';
import type { OpsStorefrontOrder } from './types';
import {
  getConversation,
  saveConversation,
  saveMessage,
  messageExistsByPlatformId,
} from '../messaging/omniStore';

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
  return conversation;
}

export async function submitPlatformMessage(payload: {
  buyerId: string;
  userName: string;
  body: string;
  orderId?: string;
  bookingOffer?: Record<string, unknown>;
  orderOffer?: Record<string, unknown>;
  /**
   * Real author of this message. Defaults to `buyerId` (the buyer speaking as
   * themselves) for backward compatibility with every existing caller. Pass
   * this explicitly when someone OTHER than the buyer is posting into the
   * buyer's conversation (a seller or staff reply) so the stored message
   * reflects who actually sent it -- see `direction` below.
   */
  senderId?: string;
  /**
   * 'inbound' = from the buyer into the platform (default, matches every
   * pre-existing caller). 'outbound' = a reply back to the buyer from a
   * seller/staff. The web app's message-bubble rendering keys off this field
   * (`DashboardContext.tsx`'s `applyPlatformRows`), so getting it right here
   * is what makes a seller's own reply show as theirs instead of the buyer's.
   */
  direction?: 'inbound' | 'outbound';
  /** Structured "order dispatched" system card payload (Sprint 14). */
  dispatchEvent?: UnifiedMessage['dispatchEvent'];
  /**
   * Stable platform message id — pass to make the write idempotent. If a
   * message with this id already exists the call is a no-op (deduped=true).
   * Used by system events (e.g. `sys_dispatch_<orderId>`).
   */
  platformMessageId?: string;
}): Promise<{ conversation: Conversation | null; message: UnifiedMessage | null; deduped: boolean }> {
  const conversationId = `conv_platform_${payload.buyerId}`;
  const existing = await getConversation(conversationId);
  const direction = payload.direction || 'inbound';
  const senderId = payload.senderId || payload.buyerId;

  if (payload.platformMessageId && (await messageExistsByPlatformId(payload.platformMessageId))) {
    return { conversation: existing || null, message: null, deduped: true };
  }

  const conversation: Conversation = {
    conversationId,
    platform: 'platform',
    senderName: direction === 'inbound' ? payload.userName : existing?.senderName || payload.buyerId,
    lastMessage: payload.body,
    assignedAgent: existing?.assignedAgent || 'agent_farhan',
    status: 'open',
    updatedAt: nowIso(),
  };

  const prefix = payload.orderId ? `[Order ${payload.orderId}] ` : '';
  const message: UnifiedMessage = {
    id: `m_plat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    platform: 'platform',
    platformMessageId: payload.platformMessageId || `plat_${Date.now()}`,
    conversationId,
    senderId,
    senderName: payload.userName,
    content: { type: 'text', body: `${prefix}${payload.body}`.trim() },
    direction,
    status: 'delivered',
    assignedAgent: conversation.assignedAgent,
    conversationStatus: conversation.status,
    timestamp: nowIso(),
    bookingOffer: payload.bookingOffer,
    orderOffer: payload.orderOffer,
    dispatchEvent: payload.dispatchEvent,
  };

  await saveConversation(conversation);
  await saveMessage(message);
  return { conversation, message, deduped: false };
}
