/**
 * Authoritative Conversation + Message service — IS-005 / Conversation Sprint 9.
 */

import { randomUUID } from 'node:crypto';
import { CommerceError } from '../../commerce/cartService';
import { commerceStore } from '../../commerce/commerceStore';
import { catalogStore } from '../../catalogStore';
import { publishEvent } from '../../events/eventBus';
import { Logger } from '../../lib/logger';
import { notifyUser, notifyRoles } from '../../communication/systemNotify';
import { COMMUNICATION_TYPES } from '../../communication/communicationTypes';
import {
  getConversationByReconcileKey,
  getConversation,
  getMessageByExternalId,
  listAdminEntries,
  listConversations,
  listMessages,
  listSocialInbox,
  listSupportTickets,
  saveAdminEntry,
  saveAttachment,
  saveConversation,
  saveMessage,
  saveSocialInbox,
  saveSupportTicket,
  getAttachment,
  getSupportTicket,
  saveSupportNote,
  listSupportNotes,
  saveSupportFollowup,
  listSupportFollowups,
} from './conversationStore';
import {
  markClosed,
  markReadOnly,
  shouldBecomeReadOnlyForOrderStatus,
} from './conversationLifecycle';
import {
  allowedAudiencesForTarget,
  assertCanReadConversation,
  assertCanSendMessage,
  assertNotForbiddenDmCreate,
  consumerInitiated,
  isAdminEnterRole,
  parseSupportAudience,
  resolveSelfServiceSupportAudience,
  resolveSenderRole,
  resolveSupportAudience,
  type MessagingActor,
} from './conversationPermissions';
import { mirrorConversationToOmni, mirrorMessageToOmni } from './omniBridge';
import {
  ACTIVE_SUPPORT_TICKET_STATUSES,
  CLOSED_SUPPORT_TICKET_STATUSES,
  CONVERSATION_CONTEXT_TYPES,
  CONVERSATION_STATUSES,
  MESSAGE_TYPES,
  SUPPORT_TICKET_STATUSES,
  type CommerceAttachment,
  type CommerceConversation,
  type CommerceMessage,
  type ConversationContextType,
  type SenderRole,
  type SocialInboxConnection,
  type SourceChannel,
  type SupportAudience,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportTicketNote,
  type SupportFollowup,
  type SupportTicketPriority,
  type SupportDepartment,
} from './types';

const STAFF_SUPPORT_ROLES = ['admin', 'super_admin', 'support_agent'] as const;

/** Canonical target-user resolution for Admin-initiated support (never trusts client role). */
export type SupportTargetUser = {
  id: string;
  role: string;
  senderRole: SenderRole;
  audience: SupportAudience;
  displayName: string;
  choosifyUserId?: string;
  avatarUrl?: string;
  /** CRM snapshot — canonical fields only; phone is NOT on `users` so it is never surfaced here. */
  email?: string;
  emailVerified?: boolean;
  memberSince?: string;
};

export async function resolveSupportTargetUser(
  targetUserId: string,
): Promise<SupportTargetUser | null> {
  const id = String(targetUserId || '').trim();
  if (!id) return null;
  try {
    const { db } = await import('../../db/client');
    const { users } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({
        id: users.id,
        role: users.role,
        displayName: users.displayName,
        choosifyUserId: users.choosifyUserId,
        avatarUrl: users.avatarUrl,
        email: users.email,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const u = rows[0];
    if (!u) return null;
    const senderRole = resolveSenderRole(u.role);
    // System-only identities are never a valid support target.
    if (senderRole === 'admin' || senderRole === 'system') return null;
    return {
      id: u.id,
      role: u.role,
      senderRole,
      audience: resolveSupportAudience(u.role),
      displayName: u.displayName || 'User',
      choosifyUserId: u.choosifyUserId || undefined,
      avatarUrl: u.avatarUrl || undefined,
      email: u.email || undefined,
      emailVerified: Boolean(u.emailVerified),
      memberSince: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    };
  } catch (error) {
    Logger.warn('resolveSupportTargetUser failed', {
      targetUserId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const COUNTER_OFFER_TTL_MS = 8 * 60 * 60 * 1000; // IS-005 §26 — 8 hours
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function emitMessaging(
  eventName: string,
  aggregateId: string,
  actor: string,
  payload: Record<string, unknown>,
): void {
  publishEvent({
    eventName,
    domain: 'Messaging',
    producer: 'conversationService',
    aggregateId,
    actor,
    payload,
  });
}

export function orderReconcileKey(orderId: string): string {
  return `order:${orderId}`;
}

export function mapOrderSourceChannel(source: string): SourceChannel {
  if (source === 'external_whatsapp') return 'external_whatsapp';
  if (source === 'external_facebook') return 'facebook';
  if (source === 'external_instagram') return 'instagram';
  if (source === 'manual' || source === 'external_offline') return 'manual';
  return 'platform';
}

export function bookingReconcileKey(bookingRequestId: string): string {
  return `booking:${bookingRequestId}`;
}

export function inquiryReconcileKey(kind: 'product' | 'service', listingId: string, consumerId: string): string {
  return `inquiry:${kind}:${listingId}:${consumerId}`;
}

export function supportReconcileKey(ticketId: string): string {
  return `support:${ticketId}`;
}

/** One active platform-support conversation per authenticated user, per persona/audience. */
export function activeSupportReconcileKey(userId: string, audience: SupportAudience): string {
  return `support:active:${userId}:${audience}`;
}

/** Pre-audience-scoping key format — kept only so existing conversations are
 *  found once instead of orphaned/duplicated by this change. Never used for
 *  new conversations. */
function legacyActiveSupportReconcileKey(userId: string): string {
  return `support:active:${userId}`;
}

export function closedSupportReconcileKey(ticketId: string): string {
  return `support:closed:${ticketId}`;
}

export function isActiveSupportConversation(
  ticket: SupportTicket | null | undefined,
  conv?: CommerceConversation | null,
): boolean {
  if (!ticket) return false;
  if (CLOSED_SUPPORT_TICKET_STATUSES.has(ticket.status)) return false;
  if (!ACTIVE_SUPPORT_TICKET_STATUSES.has(ticket.status)) return false;
  if (!conv) return true;
  return conv.status === CONVERSATION_STATUSES.ACTIVE;
}

type EnsureOrderInput = {
  orderId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  checkoutId?: string;
  sourceChannel?: SourceChannel;
  contextType?: ConversationContextType;
  metadata?: Record<string, unknown>;
  actor?: string;
};

/**
 * Idempotent Order → Conversation creation (one Conversation per Brand Order).
 */
export async function ensureOrderConversation(
  input: EnsureOrderInput,
): Promise<{ conversation: CommerceConversation; created: boolean }> {
  const key = orderReconcileKey(input.orderId);
  const existing = await getConversationByReconcileKey(key);
  if (existing) {
    return { conversation: existing, created: false };
  }

  const now = nowIso();
  const contextType =
    input.contextType ||
    (input.sourceChannel && input.sourceChannel !== 'platform'
      ? CONVERSATION_CONTEXT_TYPES.EXTERNAL_SOCIAL
      : CONVERSATION_CONTEXT_TYPES.ORDER);

  const conversation: CommerceConversation = {
    id: newId('conv'),
    contextType,
    status: CONVERSATION_STATUSES.ACTIVE,
    consumerId: input.consumerId,
    sellerId: input.sellerId,
    brandId: input.brandId,
    orderId: input.orderId,
    checkoutId: input.checkoutId,
    sourceChannel: input.sourceChannel || 'platform',
    participants: [
      { userId: input.consumerId, role: 'consumer' },
      { userId: input.sellerId, role: 'seller' },
    ],
    createdAt: now,
    updatedAt: now,
    reconcileKey: key,
    metadata: {
      ...input.metadata,
      consumerInitiated: false,
    },
  };

  // Race-safe: re-check after build
  const raced = await getConversationByReconcileKey(key);
  if (raced) return { conversation: raced, created: false };

  try {
    const { ensureEntityReferenceId } = await import('../../referenceIds/referenceIdService');
    conversation.conversationReferenceId = await ensureEntityReferenceId({
      entityType: 'conversation',
      internalId: conversation.id,
    });
  } catch {
    /* backfill can repair */
  }

  const saved = await saveConversation(conversation);
  await mirrorConversationToOmni(saved);

  const systemMsg = await persistMessageInternal({
    conversation: saved,
    senderId: 'system',
    senderRole: 'system',
    body: `Order conversation created for order ${input.orderId}`,
    messageType: MESSAGE_TYPES.ORDER_CARD,
    metadata: { orderId: input.orderId },
  });

  emitMessaging('ConversationCreated', saved.id, input.actor || input.consumerId, {
    conversationId: saved.id,
    orderId: input.orderId,
    brandId: input.brandId,
    sellerId: input.sellerId,
    consumerId: input.consumerId,
    checkoutId: input.checkoutId,
    contextType: saved.contextType,
    systemMessageId: systemMsg.id,
  });

  return { conversation: saved, created: true };
}

export function claimReconcileKey(claimId: string): string {
  return `claim:${claimId}`;
}

type EnsureClaimInput = {
  claimId: string;
  orderId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  actor?: string;
};

/**
 * Idempotent Warranty Claim → Conversation creation. Mirrors
 * ensureOrderConversation exactly — one Conversation per claim, race-safe
 * double-check-then-create, system message + event-emit tail.
 */
export async function ensureClaimConversation(
  input: EnsureClaimInput,
): Promise<{ conversation: CommerceConversation; created: boolean }> {
  const key = claimReconcileKey(input.claimId);
  const existing = await getConversationByReconcileKey(key);
  if (existing) {
    return { conversation: existing, created: false };
  }

  const now = nowIso();
  const conversation: CommerceConversation = {
    id: newId('conv'),
    contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
    status: CONVERSATION_STATUSES.ACTIVE,
    consumerId: input.consumerId,
    sellerId: input.sellerId,
    brandId: input.brandId,
    orderId: input.orderId,
    sourceChannel: 'platform',
    participants: [
      { userId: input.consumerId, role: 'consumer' },
      { userId: input.sellerId, role: 'seller' },
    ],
    createdAt: now,
    updatedAt: now,
    reconcileKey: key,
    metadata: { consumerInitiated: false, warrantyClaimId: input.claimId },
  };

  // Race-safe: re-check after build
  const raced = await getConversationByReconcileKey(key);
  if (raced) return { conversation: raced, created: false };

  try {
    const { ensureEntityReferenceId } = await import('../../referenceIds/referenceIdService');
    conversation.conversationReferenceId = await ensureEntityReferenceId({
      entityType: 'conversation',
      internalId: conversation.id,
    });
  } catch {
    /* backfill can repair */
  }

  const saved = await saveConversation(conversation);
  await mirrorConversationToOmni(saved);

  const systemMsg = await persistMessageInternal({
    conversation: saved,
    senderId: 'system',
    senderRole: 'system',
    body: `Warranty claim opened for order ${input.orderId}.`,
    messageType: MESSAGE_TYPES.SYSTEM,
    metadata: { orderId: input.orderId, warrantyClaimId: input.claimId },
  });

  emitMessaging('ConversationCreated', saved.id, input.actor || input.consumerId, {
    conversationId: saved.id,
    orderId: input.orderId,
    brandId: input.brandId,
    sellerId: input.sellerId,
    consumerId: input.consumerId,
    contextType: saved.contextType,
    warrantyClaimId: input.claimId,
    systemMessageId: systemMsg.id,
  });

  return { conversation: saved, created: true };
}

export async function ensureBookingConversation(input: {
  bookingRequestId: string;
  orderId?: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  serviceId?: string;
  actor?: string;
}): Promise<{ conversation: CommerceConversation; created: boolean }> {
  const key = bookingReconcileKey(input.bookingRequestId);
  const existing = await getConversationByReconcileKey(key);
  if (existing) return { conversation: existing, created: false };

  // Prefer linking to Order conversation when booking already has orderId
  if (input.orderId) {
    const orderConv = await getConversationByReconcileKey(orderReconcileKey(input.orderId));
    if (orderConv) {
      const linked: CommerceConversation = {
        ...orderConv,
        bookingRequestId: input.bookingRequestId,
        contextType: CONVERSATION_CONTEXT_TYPES.BOOKING,
        updatedAt: nowIso(),
        metadata: {
          ...orderConv.metadata,
          bookingRequestId: input.bookingRequestId,
          serviceId: input.serviceId,
        },
      };
      const saved = await saveConversation(linked);
      await mirrorConversationToOmni(saved);
      return { conversation: saved, created: false };
    }
  }

  const now = nowIso();
  const conversation: CommerceConversation = {
    id: newId('conv'),
    contextType: CONVERSATION_CONTEXT_TYPES.BOOKING,
    status: CONVERSATION_STATUSES.ACTIVE,
    consumerId: input.consumerId,
    sellerId: input.sellerId,
    brandId: input.brandId,
    orderId: input.orderId,
    bookingRequestId: input.bookingRequestId,
    sourceChannel: 'platform',
    participants: [
      { userId: input.consumerId, role: 'consumer' },
      { userId: input.sellerId, role: 'seller' },
    ],
    createdAt: now,
    updatedAt: now,
    reconcileKey: key,
    metadata: {
      consumerInitiated: true,
      serviceId: input.serviceId,
    },
  };

  const raced = await getConversationByReconcileKey(key);
  if (raced) return { conversation: raced, created: false };

  const saved = await saveConversation(conversation);
  await mirrorConversationToOmni(saved);
  await persistMessageInternal({
    conversation: saved,
    senderId: 'system',
    senderRole: 'system',
    body: `Booking request conversation created`,
    messageType: MESSAGE_TYPES.BOOKING_CARD,
    metadata: { bookingRequestId: input.bookingRequestId },
  });
  emitMessaging('ConversationCreated', saved.id, input.actor || input.consumerId, {
    conversationId: saved.id,
    bookingRequestId: input.bookingRequestId,
    orderId: input.orderId,
    brandId: input.brandId,
  });
  return { conversation: saved, created: true };
}

/** Replay/reconcile missing conversations for existing orders. */
export async function reconcileMissingOrderConversations(): Promise<{
  scanned: number;
  created: number;
}> {
  const orders = await commerceStore.listOrders();
  let created = 0;
  for (const order of orders) {
    const result = await ensureOrderConversation({
      orderId: order.id,
      consumerId: order.consumerId,
      sellerId: order.sellerId,
      brandId: order.brandId,
      checkoutId: order.checkoutId,
      sourceChannel: mapOrderSourceChannel(order.source),
      contextType:
        order.source !== 'checkout'
          ? CONVERSATION_CONTEXT_TYPES.MANUAL_ORDER
          : CONVERSATION_CONTEXT_TYPES.ORDER,
      metadata: {
        orderNumber: order.orderNumber,
        orderSource: order.source,
      },
      actor: 'reconcile',
    });
    if (result.created) created += 1;
  }
  return { scanned: orders.length, created };
}

export async function applyOrderLifecycleToConversation(
  orderId: string,
  orderStatus: string,
  actor = 'system',
): Promise<CommerceConversation | null> {
  const conv = await getConversationByReconcileKey(orderReconcileKey(orderId));
  if (!conv) return null;
  if (!shouldBecomeReadOnlyForOrderStatus(conv.contextType, orderStatus)) {
    return conv;
  }
  const next = markReadOnly(conv);
  if (next.status === conv.status && next.readOnlyAt === conv.readOnlyAt) return conv;
  const saved = await saveConversation(next);
  await mirrorConversationToOmni(saved);
  emitMessaging('ConversationClosed', saved.id, actor, {
    conversationId: saved.id,
    orderId,
    orderStatus,
    reason: 'order_terminal_or_delivered',
  });
  return saved;
}

async function persistMessageInternal(input: {
  conversation: CommerceConversation;
  senderId: string;
  senderRole: SenderRole;
  body: string;
  messageType: CommerceMessage['messageType'];
  attachmentIds?: string[];
  externalMessageId?: string;
  sourceChannel?: SourceChannel;
  metadata?: Record<string, unknown>;
  emitEvent?: boolean;
}): Promise<CommerceMessage> {
  if (input.externalMessageId) {
    const dup = await getMessageByExternalId(input.externalMessageId);
    if (dup) return dup;
  }

  const now = nowIso();
  const message: CommerceMessage = {
    id: newId('msg'),
    conversationId: input.conversation.id,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body: input.body,
    messageType: input.messageType,
    attachmentIds: input.attachmentIds || [],
    createdAt: now,
    updatedAt: now,
    readBy: [input.senderId],
    sourceChannel: input.sourceChannel || input.conversation.sourceChannel,
    externalMessageId: input.externalMessageId,
    metadata: input.metadata,
  };

  const saved = await saveMessage(message);
  const convUpdated: CommerceConversation = {
    ...input.conversation,
    lastMessagePreview: input.body.slice(0, 240),
    lastMessageAt: now,
    updatedAt: now,
  };
  await saveConversation(convUpdated);
  await mirrorMessageToOmni(convUpdated, saved);

  if (input.emitEvent !== false && input.senderRole !== 'system') {
    emitMessaging('MessageSent', saved.id, input.senderId, {
      messageId: saved.id,
      conversationId: saved.conversationId,
      senderRole: saved.senderRole,
      messageType: saved.messageType,
    });
  }
  return saved;
}

export async function sendMessage(input: {
  conversationId: string;
  actor: MessagingActor;
  body: string;
  messageType?: CommerceMessage['messageType'];
  attachment?: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageRef: string;
  };
  /** Client must NEVER supply senderId — ignored if present */
  clientSenderId?: string;
  externalMessageId?: string;
  requireAdminEntry?: boolean;
}): Promise<{ conversation: CommerceConversation; message: CommerceMessage }> {
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);

  const senderRole = await assertCanSendMessage(conv, input.actor);

  // Choosify Support is the staff's job — no separate "enter" ceremony to reply
  // to a support ticket. Private commerce still requires an audited enter.
  const supportContext = conv.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET;
  if (senderRole === 'admin' && input.requireAdminEntry !== false && !supportContext) {
    const entries = await listAdminEntries(conv.id);
    const entered = entries.some((e) => e.adminId === input.actor.userId);
    if (!entered) {
      throw new CommerceError('Admin must enter the conversation before messaging', 403);
    }
  }
  if (senderRole === 'admin' && supportContext) {
    Logger.audit('messaging.support_staff_reply', {
      conversationId: conv.id,
      adminId: input.actor.userId,
    });
  }

  // Client-authoritative senderId is ignored (server uses authenticated actor).
  void input.clientSenderId;

  const body = String(input.body || '').trim();
  if (!body && !input.attachment) {
    throw new CommerceError('Message body or attachment required', 400);
  }

  let attachmentIds: string[] = [];
  if (input.attachment) {
    const att = await createAttachment({
      conversationId: conv.id,
      actor: input.actor,
      ...input.attachment,
      messageIdPlaceholder: true,
    });
    attachmentIds = [att.id];
  }

  const message = await persistMessageInternal({
    conversation: conv,
    senderId: input.actor.userId,
    senderRole,
    body: body || '(attachment)',
    messageType: input.attachment
      ? MESSAGE_TYPES.ATTACHMENT
      : input.messageType || MESSAGE_TYPES.TEXT,
    attachmentIds,
    externalMessageId: input.externalMessageId,
  });

  if (attachmentIds.length) {
    const att = await getAttachment(attachmentIds[0]);
    if (att) {
      await saveAttachment({ ...att, messageId: message.id });
      emitMessaging('AttachmentUploaded', att.id, input.actor.userId, {
        attachmentId: att.id,
        conversationId: conv.id,
        messageId: message.id,
      });
    }
  }

  const isSupport = conv.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET;
  const recipientIds = Array.from(
    new Set(
      (conv.participants || [])
        .map((p) => p.userId)
        .filter((uid): uid is string => Boolean(uid) && uid !== input.actor.userId),
    ),
  );
  for (const recipientId of recipientIds) {
    try {
      await notifyUser(recipientId, {
        type: COMMUNICATION_TYPES.NOTIFICATION,
        category: isSupport ? 'system' : senderRole === 'seller' ? 'buyer' : 'seller',
        title: isSupport ? 'Choosify Support replied' : 'New message',
        summary: body ? body.slice(0, 140) : 'Sent an attachment.',
        actionUrl: isSupport ? '/messages' : '/messages',
        metadata: { conversationId: conv.id, messageId: message.id },
      });
    } catch (err) {
      Logger.warn('sendMessage: notify recipient failed', {
        conversationId: conv.id,
        recipientId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Support-ticket reply from a user (not staff) → alert Choosify support staff,
  // auto-cancel any scheduled follow-up, and reopen a resolved/closed ticket.
  if (isSupport && senderRole !== 'admin' && senderRole !== 'system') {
    await notifySupportStaffOfActivity(
      conv,
      `New ${(conv.metadata?.audience as string) || 'user'} support reply`,
      body,
    );
    await onSupportUserReply(conv.id);
  }

  const refreshed = (await getConversation(conv.id)) || conv;
  return { conversation: refreshed, message };
}

export async function createAttachment(input: {
  conversationId: string;
  actor: MessagingActor;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageRef: string;
  messageIdPlaceholder?: boolean;
}): Promise<CommerceAttachment> {
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  await assertCanReadConversation(conv, input.actor);

  if (!ALLOWED_ATTACHMENT_TYPES.has(input.contentType)) {
    throw new CommerceError('Unsupported attachment content type', 400);
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new CommerceError('Attachment size exceeds allowed limit', 400);
  }
  // Reject absolute filesystem paths / path traversal in storage refs
  if (
    !input.storageRef ||
    input.storageRef.includes('..') ||
    /^[a-zA-Z]:\\/.test(input.storageRef) ||
    input.storageRef.startsWith('/') ||
    input.storageRef.startsWith('file:')
  ) {
    throw new CommerceError('Invalid attachment storage reference', 400);
  }

  const row: CommerceAttachment = {
    id: newId('att'),
    messageId: input.messageIdPlaceholder ? '' : '',
    conversationId: input.conversationId,
    fileName: input.fileName.slice(0, 255),
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    storageRef: input.storageRef,
    uploadedBy: input.actor.userId,
    createdAt: nowIso(),
  };
  return saveAttachment(row);
}

export async function createProductInquiry(input: {
  productId: string;
  actor: MessagingActor;
  body?: string;
}): Promise<{ conversation: CommerceConversation; message: CommerceMessage }> {
  if (resolveSenderRole(input.actor.role) !== 'consumer') {
    throw new CommerceError('Only consumers may create product inquiries', 403);
  }
  const product = await catalogStore.getProduct(input.productId);
  if (!product) throw new CommerceError('Product not found', 404);
  const brandId = product.brandId;
  const brand = brandId ? await catalogStore.getBrand(brandId) : null;
  const sellerId = brand?.sellerId || product.sellerId;
  if (!brandId || !sellerId) {
    throw new CommerceError('Product missing Brand/Seller ownership', 400);
  }

  assertNotForbiddenDmCreate({
    initiatorRole: 'consumer',
    counterpartRole: 'seller',
    contextType: CONVERSATION_CONTEXT_TYPES.PRODUCT_INQUIRY,
  });

  const key = inquiryReconcileKey('product', input.productId, input.actor.userId);
  let conv = await getConversationByReconcileKey(key);
  let created = false;
  if (!conv) {
    const now = nowIso();
    conv = await saveConversation({
      id: newId('conv'),
      contextType: CONVERSATION_CONTEXT_TYPES.PRODUCT_INQUIRY,
      status: CONVERSATION_STATUSES.ACTIVE,
      consumerId: input.actor.userId,
      sellerId,
      brandId,
      sourceChannel: 'platform',
      participants: [
        { userId: input.actor.userId, role: 'consumer' },
        { userId: sellerId, role: 'seller' },
      ],
      createdAt: now,
      updatedAt: now,
      reconcileKey: key,
      metadata: { productId: input.productId, consumerInitiated: true },
    });
    created = true;
    await mirrorConversationToOmni(conv);
    emitMessaging('ConversationCreated', conv.id, input.actor.userId, {
      conversationId: conv.id,
      contextType: conv.contextType,
      productId: input.productId,
    });
  }

  const message = await persistMessageInternal({
    conversation: conv,
    senderId: input.actor.userId,
    senderRole: 'consumer',
    body: input.body || `Inquiry about product ${input.productId}`,
    messageType: MESSAGE_TYPES.PRODUCT_CARD,
    metadata: { productId: input.productId },
  });

  return { conversation: (await getConversation(conv.id)) || conv, message };
}

export async function createServiceInquiry(input: {
  serviceId: string;
  actor: MessagingActor;
  body?: string;
}): Promise<{ conversation: CommerceConversation; message: CommerceMessage }> {
  if (resolveSenderRole(input.actor.role) !== 'consumer') {
    throw new CommerceError('Only consumers may create service inquiries', 403);
  }
  // Services share product catalog records with listingType service where present.
  const product = await catalogStore.getProduct(input.serviceId);
  if (!product) throw new CommerceError('Service not found', 404);
  const brandId = product.brandId;
  const brand = brandId ? await catalogStore.getBrand(brandId) : null;
  const sellerId = brand?.sellerId || product.sellerId;
  if (!brandId || !sellerId) {
    throw new CommerceError('Service missing Brand/Seller ownership', 400);
  }

  const key = inquiryReconcileKey('service', input.serviceId, input.actor.userId);
  let conv = await getConversationByReconcileKey(key);
  if (!conv) {
    const now = nowIso();
    conv = await saveConversation({
      id: newId('conv'),
      contextType: CONVERSATION_CONTEXT_TYPES.SERVICE_REQUEST,
      status: CONVERSATION_STATUSES.ACTIVE,
      consumerId: input.actor.userId,
      sellerId,
      brandId,
      sourceChannel: 'platform',
      participants: [
        { userId: input.actor.userId, role: 'consumer' },
        { userId: sellerId, role: 'seller' },
      ],
      createdAt: now,
      updatedAt: now,
      reconcileKey: key,
      metadata: { serviceId: input.serviceId, consumerInitiated: true },
    });
    await mirrorConversationToOmni(conv);
    emitMessaging('ConversationCreated', conv.id, input.actor.userId, {
      conversationId: conv.id,
      contextType: conv.contextType,
      serviceId: input.serviceId,
    });
  }

  const message = await persistMessageInternal({
    conversation: conv,
    senderId: input.actor.userId,
    senderRole: 'consumer',
    body: input.body || `Service inquiry for ${input.serviceId}`,
    messageType: MESSAGE_TYPES.SERVICE_CARD,
    metadata: { serviceId: input.serviceId },
  });
  return { conversation: (await getConversation(conv.id)) || conv, message };
}

export async function createCounterOffer(input: {
  conversationId: string;
  actor: MessagingActor;
  amount: number;
  currency?: string;
  note?: string;
}): Promise<{ conversation: CommerceConversation; message: CommerceMessage; offerId: string }> {
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  const role = await assertCanSendMessage(conv, input.actor);
  if (role !== 'seller' && role !== 'seller_staff') {
    throw new CommerceError('Only sellers may create counter-offers', 403);
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CommerceError('Invalid counter-offer amount', 400);
  }

  const offerId = newId('offer');
  const expiresAt = new Date(Date.now() + COUNTER_OFFER_TTL_MS).toISOString();
  const message = await persistMessageInternal({
    conversation: conv,
    senderId: input.actor.userId,
    senderRole: role,
    body: input.note || `Counter offer: ${input.amount}`,
    messageType: MESSAGE_TYPES.COUNTER_OFFER,
    metadata: {
      offerId,
      amount: input.amount,
      currency: input.currency || 'BDT',
      status: 'pending',
      expiresAt,
    },
  });

  emitMessaging('CounterOfferCreated', offerId, input.actor.userId, {
    offerId,
    conversationId: conv.id,
    messageId: message.id,
    amount: input.amount,
    expiresAt,
  });

  return {
    conversation: (await getConversation(conv.id)) || conv,
    message,
    offerId,
  };
}

export async function respondCounterOffer(input: {
  conversationId: string;
  offerId: string;
  actor: MessagingActor;
  action: 'accept' | 'reject';
}): Promise<{ conversation: CommerceConversation; message: CommerceMessage }> {
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  if (conv.consumerId !== input.actor.userId) {
    throw new CommerceError('Only the consumer may respond to a counter-offer', 403);
  }
  await assertCanSendMessage(conv, input.actor);

  const messages = await listMessages(conv.id);
  const offerMsg = messages.find(
    (m) =>
      m.messageType === MESSAGE_TYPES.COUNTER_OFFER &&
      m.metadata?.offerId === input.offerId,
  );
  if (!offerMsg) throw new CommerceError('Counter-offer not found', 404);

  const status = String(offerMsg.metadata?.status || '');
  if (status !== 'pending') {
    throw new CommerceError('Counter-offer already resolved', 409);
  }
  const expiresAt = String(offerMsg.metadata?.expiresAt || '');
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    await expireCounterOffer(conv.id, input.offerId, 'system');
    throw new CommerceError('Counter-offer expired', 409);
  }

  const nextStatus = input.action === 'accept' ? 'accepted' : 'rejected';
  await saveMessage({
    ...offerMsg,
    updatedAt: nowIso(),
    metadata: { ...offerMsg.metadata, status: nextStatus },
  });

  const reply = await persistMessageInternal({
    conversation: conv,
    senderId: input.actor.userId,
    senderRole: 'consumer',
    body: input.action === 'accept' ? 'Counter offer accepted' : 'Counter offer rejected',
    messageType: MESSAGE_TYPES.SYSTEM,
    metadata: { offerId: input.offerId, action: input.action },
  });

  if (input.action === 'accept') {
    emitMessaging('CounterOfferAccepted', input.offerId, input.actor.userId, {
      offerId: input.offerId,
      conversationId: conv.id,
      messageId: reply.id,
    });
  }

  return { conversation: (await getConversation(conv.id)) || conv, message: reply };
}

export async function expireCounterOffer(
  conversationId: string,
  offerId: string,
  actor = 'system',
): Promise<void> {
  const conv = await getConversation(conversationId);
  if (!conv) return;
  const messages = await listMessages(conv.id);
  const offerMsg = messages.find(
    (m) =>
      m.messageType === MESSAGE_TYPES.COUNTER_OFFER &&
      m.metadata?.offerId === offerId &&
      m.metadata?.status === 'pending',
  );
  if (!offerMsg) return;

  await saveMessage({
    ...offerMsg,
    updatedAt: nowIso(),
    metadata: { ...offerMsg.metadata, status: 'expired' },
  });
  emitMessaging('CounterOfferExpired', offerId, actor, {
    offerId,
    conversationId,
  });

  // Chained consequence: service conversation → read-only (IS-005 §29)
  if (
    conv.contextType === CONVERSATION_CONTEXT_TYPES.BOOKING ||
    conv.contextType === CONVERSATION_CONTEXT_TYPES.SERVICE_REQUEST
  ) {
    const next = markReadOnly(conv);
    await saveConversation(next);
    await mirrorConversationToOmni(next);
    emitMessaging('ConversationClosed', conv.id, actor, {
      conversationId: conv.id,
      reason: 'counter_offer_expired',
    });
  }
}

export async function enterConversationAsAdmin(input: {
  conversationId: string;
  actor: MessagingActor;
  reason?: string;
}): Promise<{ conversation: CommerceConversation; entryId: string }> {
  if (!isAdminEnterRole(input.actor.role)) {
    throw new CommerceError('Admin enter requires elevated role', 403);
  }
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);

  const entry = await saveAdminEntry({
    id: newId('admin_entry'),
    conversationId: conv.id,
    adminId: input.actor.userId,
    reason: input.reason,
    createdAt: nowIso(),
  });

  Logger.audit('messaging.admin_enter', {
    conversationId: conv.id,
    adminId: input.actor.userId,
    reason: input.reason,
    entryId: entry.id,
  });

  return { conversation: conv, entryId: entry.id };
}

/**
 * Admin/Support proactively opens (or reuses) a user's Choosify Support thread.
 * Same canonical support relationship — NOT a separate DM engine. The target
 * role/audience/CFID are resolved SERVER-SIDE from `targetUserId`; any client
 * supplied role/identity is ignored. Reuses `support:active:<targetUserId>` so
 * a profile-originated open and an inbox-search open resolve to one thread.
 */
export async function openAdminSupportConversation(input: {
  adminActor: MessagingActor;
  targetUserId: string;
  /**
   * Optional persona override — which of the target's support personas this
   * admin wants to reach (e.g. a Verified Seller account also has a Consumer
   * persona). Validated against the allowlist and against what the target's
   * current role actually grants; an invalid/unauthorized value is ignored,
   * falling back to the target's role-derived audience. Never taken from any
   * other route or trusted from any other client input.
   */
  audience?: string;
  subject?: string;
  body?: string;
}): Promise<{
  conversation: CommerceConversation;
  ticket: SupportTicket;
  message: CommerceMessage | null;
  created: boolean;
  target: SupportTargetUser;
}> {
  if (!input.adminActor?.userId) throw new CommerceError('Authentication required', 401);
  if (!isAdminEnterRole(input.adminActor.role)) {
    throw new CommerceError('Only Choosify staff may start a support conversation', 403);
  }
  const target = await resolveSupportTargetUser(input.targetUserId);
  if (!target) throw new CommerceError('Target user not found', 404);
  if (target.id === input.adminActor.userId) {
    throw new CommerceError('Cannot start a support conversation with yourself', 400);
  }

  const requestedAudience = parseSupportAudience(input.audience);
  const audience =
    requestedAudience && allowedAudiencesForTarget(target.role).includes(requestedAudience)
      ? requestedAudience
      : target.audience;

  const body = input.body ? String(input.body).trim() : '';

  // Reuse this persona's one active support thread if it exists.
  const existing = await findActiveSupportConversationForUser(target.id, audience);
  let conversation: CommerceConversation;
  let ticket: SupportTicket;
  let created = false;

  if (existing) {
    conversation = existing.conversation;
    ticket = existing.ticket;
    // Backfill audience only when genuinely missing (legacy tickets/
    // conversations predating this field) — never relabel an existing,
    // already-audience-tagged thread to a different persona.
    if (!ticket.audience) {
      ticket = await saveSupportTicket({ ...ticket, audience, updatedAt: nowIso() });
    }
    if (conversation.metadata?.audience === undefined) {
      conversation = await saveConversation({
        ...conversation,
        metadata: { ...conversation.metadata, audience },
        updatedAt: conversation.updatedAt,
      });
    }
  } else {
    const now = nowIso();
    const key = activeSupportReconcileKey(target.id, audience);
    const raced = await getConversationByReconcileKey(key);
    if (raced && raced.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET) {
      conversation = raced;
      const tickets = await listSupportTickets();
      ticket =
        tickets.find((t) => t.conversationId === raced.id && t.openerId === target.id) ||
        (await saveSupportTicket({
          id: newId('ticket'),
          conversationId: raced.id,
          openerId: target.id,
          audience,
          subject: input.subject?.trim() || 'Choosify Support',
          status: SUPPORT_TICKET_STATUSES.OPEN,
          createdAt: now,
          updatedAt: now,
        }));
    } else {
      const subject = input.subject?.trim() || 'Message from Choosify';
      conversation = await saveConversation({
        id: newId('conv'),
        contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
        status: CONVERSATION_STATUSES.ACTIVE,
        consumerId: target.id,
        sellerId: 'platform_support',
        brandId: 'platform_support',
        sourceChannel: 'platform',
        participants: [{ userId: target.id, role: target.senderRole }],
        createdAt: now,
        updatedAt: now,
        reconcileKey: key,
        metadata: {
          supportTicket: true,
          subject,
          openerId: target.id,
          audience,
          initiatedByAdminId: input.adminActor.userId,
        },
      });
      ticket = await saveSupportTicket({
        id: newId('ticket'),
        conversationId: conversation.id,
        openerId: target.id,
        audience,
        initiatedByAdminId: input.adminActor.userId,
        subject,
        status: SUPPORT_TICKET_STATUSES.OPEN,
        createdAt: now,
        updatedAt: now,
      });
      created = true;
      emitMessaging('ConversationCreated', conversation.id, input.adminActor.userId, {
        conversationId: conversation.id,
        supportTicketId: ticket.id,
        audience,
        initiatedByAdminId: input.adminActor.userId,
        contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
      });
    }
  }

  // Record the audited staff entry (also satisfies the admin-send gate).
  await saveAdminEntry({
    id: newId('admin_entry'),
    conversationId: conversation.id,
    adminId: input.adminActor.userId,
    reason: 'admin_initiated_support',
    createdAt: nowIso(),
  });
  Logger.audit('messaging.admin_initiated_support', {
    conversationId: conversation.id,
    adminId: input.adminActor.userId,
    targetUserId: target.id,
    targetRole: target.senderRole,
    created,
  });

  let message: CommerceMessage | null = null;
  if (body) {
    message = await persistMessageInternal({
      conversation,
      senderId: input.adminActor.userId,
      senderRole: 'admin',
      body,
      messageType: MESSAGE_TYPES.TEXT,
    });
    try {
      await notifyUser(target.id, {
        type: COMMUNICATION_TYPES.NOTIFICATION,
        category: 'system',
        title: 'Message from Choosify Support',
        summary: body.slice(0, 140),
        actionUrl: '/messages',
        metadata: { conversationId: conversation.id, messageId: message.id },
      });
    } catch (err) {
      Logger.warn('openAdminSupportConversation: notify target failed', {
        conversationId: conversation.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const refreshed = (await getConversation(conversation.id)) || conversation;
  return { conversation: refreshed, ticket, message, created, target };
}

/**
 * Mark a conversation read for the authenticated actor. Server determines the
 * actor; you can never mark messages read as someone else. Only messages NOT
 * sent by the actor and not already in `readBy` are stamped.
 */
export async function markConversationRead(input: {
  conversationId: string;
  actor: MessagingActor;
}): Promise<{ conversationId: string; marked: number }> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  await assertCanReadConversation(conv, input.actor);

  const messages = await listMessages(conv.id);
  let marked = 0;
  for (const msg of messages) {
    if (msg.senderId === input.actor.userId) continue;
    const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
    if (readBy.includes(input.actor.userId)) continue;
    await saveMessage({ ...msg, readBy: [...readBy, input.actor.userId] });
    marked += 1;
  }
  return { conversationId: conv.id, marked };
}

/**
 * Strip staff-only CRM metadata from a ticket before it reaches a
 * consumer/seller/creator-facing endpoint. Priority, assignee, department,
 * reopenedAt are Support-Desk internal — never in a non-staff contract.
 */
export function toPublicSupportTicket(ticket: SupportTicket): SupportTicket {
  const { priority, assigneeId, department, reopenedAt, ...pub } = ticket;
  void priority;
  void assigneeId;
  void department;
  void reopenedAt;
  return pub as SupportTicket;
}

/**
 * Finds the one active support conversation for `userId` under a specific
 * persona/`audience`. The same user may have multiple active support
 * conversations distinguished by audience (e.g. a Consumer-persona thread and
 * a Seller-persona thread) — this never merges or leaks across them.
 */
export async function findActiveSupportConversationForUser(
  userId: string,
  audience: SupportAudience,
): Promise<{ ticket: SupportTicket; conversation: CommerceConversation } | null> {
  if (!userId) return null;

  const tryKey = async (key: string) => {
    const byKey = await getConversationByReconcileKey(key);
    if (!byKey || byKey.contextType !== CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET) return null;
    const tickets = await listSupportTickets();
    const ticket = tickets.find((t) => t.conversationId === byKey.id && t.openerId === userId) || null;
    if (ticket && isActiveSupportConversation(ticket, byKey)) {
      return { ticket: toPublicSupportTicket(ticket), conversation: byKey };
    }
    return null;
  };

  const byNewKey = await tryKey(activeSupportReconcileKey(userId, audience));
  if (byNewKey) return byNewKey;

  // Conversations created before audience-scoped keys existed were reconciled
  // under the bare per-user key. Recover them here (matched only when the
  // stored ticket's own audience agrees) so an existing thread isn't
  // orphaned/duplicated the first time it's looked up post-change.
  const legacyMatch = await tryKey(legacyActiveSupportReconcileKey(userId));
  if (legacyMatch && (legacyMatch.ticket.audience ?? audience) === audience) return legacyMatch;

  const tickets = await listSupportTickets();
  const mine = tickets.filter((t) => t.openerId === userId && (t.audience ?? audience) === audience);
  for (const ticket of mine) {
    const conv = await getConversation(ticket.conversationId);
    if (conv && isActiveSupportConversation(ticket, conv)) {
      return { ticket: toPublicSupportTicket(ticket), conversation: conv };
    }
  }
  return null;
}

export async function ensureActiveSupportConversation(input: {
  actor: MessagingActor;
  subject?: string;
  body?: string;
  /**
   * Optional fixed, surface-determined persona hint (not an arbitrary client
   * role) — see `resolveSelfServiceSupportAudience`. E.g. the storefront's
   * Consumer Messages surface always passes `'consumer'` so a Seller/Creator
   * account can still reach its own Consumer-persona thread there.
   */
  audience?: string;
}): Promise<{
  ticket: SupportTicket;
  conversation: CommerceConversation;
  message: CommerceMessage | null;
  created: boolean;
}> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);

  const audience = resolveSelfServiceSupportAudience(input.actor, input.audience);
  const existing = await findActiveSupportConversationForUser(input.actor.userId, audience);
  if (existing) {
    return { ...existing, message: null, created: false };
  }

  const created = await createSupportTicket({
    actor: input.actor,
    subject: input.subject,
    body: input.body,
    audience: input.audience,
  });
  return { ...created, created: true };
}

export async function createSupportTicket(input: {
  actor: MessagingActor;
  subject?: string;
  body?: string;
  /** See `ensureActiveSupportConversation` — same fixed-surface persona hint. */
  audience?: string;
}): Promise<{ ticket: SupportTicket; conversation: CommerceConversation; message: CommerceMessage }> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);

  const audience = resolveSelfServiceSupportAudience(input.actor, input.audience);
  const racedExisting = await findActiveSupportConversationForUser(input.actor.userId, audience);
  if (racedExisting) {
    const messages = await listMessages(racedExisting.conversation.id);
    return {
      ticket: racedExisting.ticket,
      conversation: racedExisting.conversation,
      message: messages[0] || (await persistMessageInternal({
        conversation: racedExisting.conversation,
        senderId: input.actor.userId,
        senderRole: resolveSenderRole(input.actor.role),
        body: String(input.body || 'Hello, I need help from Choosify Support.').trim() || 'Hello, I need help from Choosify Support.',
        messageType: MESSAGE_TYPES.TEXT,
      })),
    };
  }

  const subject = String(input.subject || 'Support request').trim() || 'Support request';
  const body =
    String(input.body || 'Hello, I need help from Choosify Support.').trim() ||
    'Hello, I need help from Choosify Support.';

  const ticketId = newId('ticket');
  const now = nowIso();
  const key = activeSupportReconcileKey(input.actor.userId, audience);
  const racedKey = await getConversationByReconcileKey(key);
  if (racedKey) {
    const tickets = await listSupportTickets();
    const ticket = tickets.find((t) => t.conversationId === racedKey.id && t.openerId === input.actor.userId);
    if (ticket && isActiveSupportConversation(ticket, racedKey)) {
      const messages = await listMessages(racedKey.id);
      return { ticket: toPublicSupportTicket(ticket), conversation: racedKey, message: messages[0] };
    }
  }

  const openerSenderRole = resolveSenderRole(input.actor.role);
  const conversation: CommerceConversation = {
    id: newId('conv'),
    contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
    status: CONVERSATION_STATUSES.ACTIVE,
    consumerId: input.actor.userId,
    sellerId: 'platform_support',
    brandId: 'platform_support',
    sourceChannel: 'platform',
    participants: [{ userId: input.actor.userId, role: openerSenderRole }],
    createdAt: now,
    updatedAt: now,
    reconcileKey: key,
    metadata: { supportTicket: true, subject, openerId: input.actor.userId, audience },
  };
  const savedConv = await saveConversation(conversation);
  const ticket = await saveSupportTicket({
    id: ticketId,
    conversationId: savedConv.id,
    openerId: input.actor.userId,
    audience,
    subject,
    status: SUPPORT_TICKET_STATUSES.OPEN,
    createdAt: now,
    updatedAt: now,
  });
  const message = await persistMessageInternal({
    conversation: savedConv,
    senderId: input.actor.userId,
    senderRole: openerSenderRole,
    body,
    messageType: MESSAGE_TYPES.TEXT,
  });
  emitMessaging('ConversationCreated', savedConv.id, input.actor.userId, {
    conversationId: savedConv.id,
    supportTicketId: ticket.id,
    audience,
    contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
  });
  await notifySupportStaffOfActivity(savedConv, `New ${audience} support request`, body);
  return { ticket: toPublicSupportTicket(ticket), conversation: savedConv, message };
}

/** Notify Choosify support staff once each about new support activity (no duplicates). */
async function notifySupportStaffOfActivity(
  conv: CommerceConversation,
  title: string,
  preview: string,
): Promise<void> {
  try {
    await notifyRoles([...STAFF_SUPPORT_ROLES], {
      type: COMMUNICATION_TYPES.NOTIFICATION,
      category: 'system',
      title,
      summary: preview ? preview.slice(0, 140) : 'Open the support inbox.',
      actionUrl: `/admin/messages?c=${conv.id}`,
      metadata: { conversationId: conv.id, supportAudience: conv.metadata?.audience },
    });
  } catch (err) {
    Logger.warn('notifySupportStaffOfActivity failed', {
      conversationId: conv.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function resolveSupportTicket(input: {
  actor: MessagingActor;
  ticketId?: string;
  conversationId?: string;
  status?: SupportTicketStatus;
}): Promise<{ ticket: SupportTicket; conversation: CommerceConversation }> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);
  if (!isAdminEnterRole(input.actor.role)) {
    throw new CommerceError('Only support staff may close a support conversation', 403);
  }
  const nextStatus: SupportTicketStatus =
    input.status === SUPPORT_TICKET_STATUSES.CLOSED
      ? SUPPORT_TICKET_STATUSES.CLOSED
      : SUPPORT_TICKET_STATUSES.RESOLVED;
  const tickets = await listSupportTickets();
  const ticket = tickets.find((t) =>
    (input.ticketId && t.id === input.ticketId) ||
    (input.conversationId && t.conversationId === input.conversationId),
  );
  if (!ticket) throw new CommerceError('Support ticket not found', 404);
  const conv = await getConversation(ticket.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  await assertCanReadConversation(conv, input.actor);

  const now = nowIso();
  const closedConv = await saveConversation({
    ...markClosed(conv, now),
    reconcileKey: closedSupportReconcileKey(ticket.id),
    metadata: { ...conv.metadata, supportTicket: true, resolvedBy: input.actor.userId },
  });
  const savedTicket = await saveSupportTicket({
    ...ticket,
    status: nextStatus,
    updatedAt: now,
  });
  Logger.audit('messaging.support_resolved', {
    ticketId: savedTicket.id,
    conversationId: closedConv.id,
    adminId: input.actor.userId,
    status: nextStatus,
  });
  return { ticket: savedTicket, conversation: closedConv };
}

// ═══════════════════════════════════════════════════════════════════════
// Admin CRM / Support Desk — persisted status, priority, assignment,
// internal notes, follow-ups. All mutations are staff-only. None of this
// metadata is ever returned by a consumer/seller/creator endpoint.
// ═══════════════════════════════════════════════════════════════════════

function assertSupportStaff(actor: MessagingActor): void {
  if (!actor?.userId) throw new CommerceError('Authentication required', 401);
  if (!isAdminEnterRole(actor.role)) throw new CommerceError('Choosify staff only', 403);
}

async function findTicketByConversation(conversationId: string): Promise<SupportTicket> {
  const t = (await listSupportTickets()).find((x) => x.conversationId === conversationId);
  if (!t) throw new CommerceError('Support ticket not found', 404);
  return t;
}

/** Staff mutate status / priority / assignee / department. Reopen = status:'open' + reopenedAt. */
export async function updateSupportTicketCrm(input: {
  actor: MessagingActor;
  conversationId: string;
  patch: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assigneeId?: string | null;
    department?: SupportDepartment | null;
  };
}): Promise<SupportTicket> {
  assertSupportStaff(input.actor);
  const ticket = await findTicketByConversation(input.conversationId);
  const now = nowIso();
  const next: SupportTicket = { ...ticket, updatedAt: now };

  if (input.patch.status && input.patch.status !== ticket.status) {
    // Guard the state machine — only known statuses.
    const allowed = Object.values(SUPPORT_TICKET_STATUSES) as string[];
    if (!allowed.includes(input.patch.status)) {
      throw new CommerceError(`Invalid status ${input.patch.status}`, 400);
    }
    next.status = input.patch.status;
    if (
      (ticket.status === SUPPORT_TICKET_STATUSES.RESOLVED ||
        ticket.status === SUPPORT_TICKET_STATUSES.CLOSED) &&
      input.patch.status === SUPPORT_TICKET_STATUSES.OPEN
    ) {
      next.reopenedAt = now;
    }
  }
  if (input.patch.priority) {
    const pr: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
    if (!pr.includes(input.patch.priority)) throw new CommerceError('Invalid priority', 400);
    next.priority = input.patch.priority;
  }
  if (input.patch.assigneeId !== undefined) {
    if (input.patch.assigneeId) {
      // Assignee must reference a real Choosify staff account.
      const role = await resolveStaffRole(input.patch.assigneeId);
      if (!role || !isAdminEnterRole(role)) {
        throw new CommerceError('Assignee is not a Choosify staff account', 400);
      }
      next.assigneeId = input.patch.assigneeId;
    } else {
      next.assigneeId = undefined;
    }
  }
  if (input.patch.department !== undefined) {
    next.department = input.patch.department || undefined;
  }

  const saved = await saveSupportTicket(next);
  Logger.audit('messaging.support_crm_update', {
    conversationId: input.conversationId,
    ticketId: saved.id,
    adminId: input.actor.userId,
    patch: input.patch,
  });
  return saved;
}

async function resolveStaffRole(userId: string): Promise<string | null> {
  try {
    const { db } = await import('../../db/client');
    const { users } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    return rows[0]?.role || null;
  } catch {
    return null;
  }
}

export async function addSupportNote(input: {
  actor: MessagingActor;
  conversationId: string;
  body: string;
}): Promise<SupportTicketNote> {
  assertSupportStaff(input.actor);
  const body = String(input.body || '').trim();
  if (!body) throw new CommerceError('Note body is required', 400);
  const ticket = await findTicketByConversation(input.conversationId);
  const staff = await resolveStaffDisplay(input.actor.userId);
  const note: SupportTicketNote = {
    id: newId('snote'),
    conversationId: input.conversationId,
    ticketId: ticket.id,
    authorId: input.actor.userId,
    authorName: staff,
    body,
    createdAt: nowIso(),
  };
  const saved = await saveSupportNote(note);
  Logger.audit('messaging.support_note_added', {
    conversationId: input.conversationId,
    noteId: saved.id,
    adminId: input.actor.userId,
  });
  return saved;
}

export async function listSupportNotesForActor(
  actor: MessagingActor,
  conversationId: string,
): Promise<SupportTicketNote[]> {
  assertSupportStaff(actor);
  return listSupportNotes(conversationId);
}

async function resolveStaffDisplay(userId: string): Promise<string> {
  try {
    const { db } = await import('../../db/client');
    const { users } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0]?.displayName || rows[0]?.email || 'Choosify staff';
  } catch {
    return 'Choosify staff';
  }
}

export async function scheduleSupportFollowup(input: {
  actor: MessagingActor;
  conversationId: string;
  dueAt: string;
}): Promise<SupportFollowup> {
  assertSupportStaff(input.actor);
  const due = Date.parse(input.dueAt);
  if (Number.isNaN(due)) throw new CommerceError('dueAt must be a valid ISO date', 400);
  const ticket = await findTicketByConversation(input.conversationId);
  // Cancel any existing scheduled follow-up for this conversation first.
  for (const f of await listSupportFollowups(input.conversationId)) {
    if (f.status === 'scheduled') {
      await saveSupportFollowup({ ...f, status: 'cancelled', cancelledAt: nowIso(), cancelReason: 'manual' });
    }
  }
  const followup: SupportFollowup = {
    id: newId('sfu'),
    conversationId: input.conversationId,
    ticketId: ticket.id,
    createdBy: input.actor.userId,
    createdAt: nowIso(),
    dueAt: new Date(due).toISOString(),
    status: 'scheduled',
  };
  const saved = await saveSupportFollowup(followup);
  await saveSupportTicket({
    ...ticket,
    status: SUPPORT_TICKET_STATUSES.NEED_FOLLOWUP,
    updatedAt: nowIso(),
  });
  Logger.audit('messaging.support_followup_scheduled', {
    conversationId: input.conversationId,
    followupId: saved.id,
    dueAt: saved.dueAt,
    adminId: input.actor.userId,
  });
  return saved;
}

export async function listSupportFollowupsForActor(
  actor: MessagingActor,
  conversationId: string,
): Promise<SupportFollowup[]> {
  assertSupportStaff(actor);
  return listSupportFollowups(conversationId);
}

export async function cancelSupportFollowup(input: {
  actor: MessagingActor;
  conversationId: string;
  followupId: string;
}): Promise<SupportFollowup> {
  assertSupportStaff(input.actor);
  const rows = await listSupportFollowups(input.conversationId);
  const f = rows.find((x) => x.id === input.followupId);
  if (!f) throw new CommerceError('Follow-up not found', 404);
  if (f.status !== 'scheduled') return f;
  return saveSupportFollowup({ ...f, status: 'cancelled', cancelledAt: nowIso(), cancelReason: 'manual' });
}

/**
 * Lazy sweep — invoked from listAdminSupportInbox (mirrors the booking-expiry
 * "cron / lazy sweep" pattern). Idempotent, restart-safe, backed by persisted
 * dueAt: a follow-up only fires once (guarded by status:'scheduled'→'fired').
 * NEVER messages the customer; only flips the ticket into the actionable
 * queue and raises an internal staff attention item.
 */
export async function sweepDueFollowups(): Promise<number> {
  const now = Date.now();
  const all = await listSupportFollowups();
  let fired = 0;
  for (const f of all) {
    if (f.status !== 'scheduled') continue;
    if (Date.parse(f.dueAt) > now) continue;
    await saveSupportFollowup({ ...f, status: 'fired', firedAt: nowIso() });
    fired += 1;
    try {
      const ticket = (await listSupportTickets()).find((t) => t.id === f.ticketId);
      if (ticket && !CLOSED_SUPPORT_TICKET_STATUSES.has(ticket.status)) {
        await saveSupportTicket({
          ...ticket,
          status: SUPPORT_TICKET_STATUSES.NEED_FOLLOWUP,
          updatedAt: nowIso(),
        });
      }
      const conv = await getConversation(f.conversationId);
      if (conv) {
        await notifyRoles([...STAFF_SUPPORT_ROLES], {
          type: COMMUNICATION_TYPES.REMINDER,
          category: 'system',
          title: 'Support follow-up due',
          summary: 'A scheduled support follow-up is now due.',
          actionUrl: `/admin/messages?c=${f.conversationId}`,
          metadata: { conversationId: f.conversationId, followupId: f.id },
        }).catch(() => undefined);
      }
    } catch (err) {
      Logger.warn('sweepDueFollowups post-fire step failed', {
        followupId: f.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return fired;
}

/**
 * Called from the canonical message-send path when a NON-staff participant
 * replies on a support conversation. Auto-cancels any scheduled follow-up
 * and returns a resolved/closed ticket to the actionable queue (open +
 * reopenedAt). Runs server-side — no dependency on an Admin browser.
 */
async function onSupportUserReply(conversationId: string): Promise<void> {
  try {
    const ticket = (await listSupportTickets()).find((t) => t.conversationId === conversationId);
    if (!ticket) return;
    const now = nowIso();
    for (const f of await listSupportFollowups(conversationId)) {
      if (f.status === 'scheduled') {
        await saveSupportFollowup({ ...f, status: 'cancelled', cancelledAt: now, cancelReason: 'reply' });
      }
    }
    if (
      ticket.status === SUPPORT_TICKET_STATUSES.RESOLVED ||
      ticket.status === SUPPORT_TICKET_STATUSES.CLOSED
    ) {
      await saveSupportTicket({
        ...ticket,
        status: SUPPORT_TICKET_STATUSES.OPEN,
        reopenedAt: now,
        updatedAt: now,
      });
      Logger.audit('messaging.support_reopened_by_reply', { conversationId, ticketId: ticket.id });
    } else if (ticket.status === SUPPORT_TICKET_STATUSES.NEED_FOLLOWUP) {
      await saveSupportTicket({ ...ticket, status: SUPPORT_TICKET_STATUSES.OPEN, updatedAt: now });
    }
  } catch (err) {
    Logger.warn('onSupportUserReply failed', {
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function listConversationsForActor(
  actor: MessagingActor,
  filters?: { brandId?: string; contextType?: string; sourceChannel?: string },
): Promise<CommerceConversation[]> {
  const all = await listConversations();
  const senderRole = resolveSenderRole(actor.role);
  const isStaff = senderRole === 'admin';

  // Staff no longer see every private commerce conversation in a list (IS-005 §7):
  // support_ticket + external_social auto, plus any conversation they have an
  // audited entry on. Fetch entries once instead of an assert-per-row.
  const enteredIds = isStaff
    ? new Set(
        (await listAdminEntries())
          .filter((e) => e.adminId === actor.userId)
          .map((e) => e.conversationId),
      )
    : new Set<string>();

  const out: CommerceConversation[] = [];
  for (const c of all) {
    if (isStaff) {
      const autoReadable =
        c.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET ||
        c.contextType === CONVERSATION_CONTEXT_TYPES.EXTERNAL_SOCIAL;
      if (!autoReadable && !enteredIds.has(c.id)) continue;
    } else {
      // Support tickets stay off the seller/creator commerce inbox unless they opened them.
      if (
        c.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET &&
        (senderRole === 'seller' || senderRole === 'seller_staff' || senderRole === 'creator')
      ) {
        const isOwn =
          c.consumerId === actor.userId ||
          c.participants.some((p) => p.userId === actor.userId);
        if (!isOwn) continue;
      }
      try {
        await assertCanReadConversation(c, actor);
      } catch {
        continue;
      }
    }
    if (filters?.brandId && c.brandId !== filters.brandId) continue;
    if (filters?.contextType && c.contextType !== filters.contextType) continue;
    if (filters?.sourceChannel && c.sourceChannel !== filters.sourceChannel) continue;
    out.push(c);
  }
  return out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getConversationForActor(
  id: string,
  actor: MessagingActor,
): Promise<CommerceConversation> {
  const conv = await getConversation(id);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  await assertCanReadConversation(conv, actor);
  return conv;
}

export async function listMessagesForActor(
  conversationId: string,
  actor: MessagingActor,
): Promise<CommerceMessage[]> {
  await getConversationForActor(conversationId, actor);
  return listMessages(conversationId);
}

export type AdminSupportInboxRow = {
  conversation: CommerceConversation;
  ticket: SupportTicket | null;
  audience: SupportAudience;
  opener: {
    id: string;
    displayName: string;
    choosifyUserId?: string;
    avatarUrl?: string;
    roleLabel: 'Consumer' | 'Seller' | 'Creator';
    contextLabel?: string;
    email?: string;
    emailVerified?: boolean;
    memberSince?: string;
    totalOrders?: number;
  };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unread: number;
  // CRM (staff-only — this whole endpoint is staff-gated)
  priority?: SupportTicketPriority;
  status?: SupportTicketStatus;
  assigneeId?: string;
  assigneeName?: string;
  department?: SupportDepartment;
  reopenedAt?: string;
  noteCount: number;
  followupDueAt?: string;
};

/**
 * Enriched Choosify Support inbox for staff — every support_ticket conversation
 * with resolved opener identity, audience, and unread-for-this-admin count.
 */
export async function listAdminSupportInbox(
  actor: MessagingActor,
  filter?: {
    audience?: SupportAudience;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assigneeId?: string;
  },
): Promise<AdminSupportInboxRow[]> {
  if (!isAdminEnterRole(actor.role)) {
    throw new CommerceError('Choosify staff only', 403);
  }
  // Lazy sweep — production-safe, idempotent, restart-safe (no background timer).
  await sweepDueFollowups().catch(() => undefined);

  const convs = (await listConversations()).filter(
    (c) => c.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
  );
  const tickets = await listSupportTickets();
  const ticketByConv = new Map(tickets.map((t) => [t.conversationId, t]));
  const allNotes = await listSupportNotes();
  const allFollowups = await listSupportFollowups();
  const noteCountByConv = new Map<string, number>();
  for (const n of allNotes) noteCountByConv.set(n.conversationId, (noteCountByConv.get(n.conversationId) || 0) + 1);
  const dueByConv = new Map<string, string>();
  for (const f of allFollowups) {
    if (f.status === 'scheduled') dueByConv.set(f.conversationId, f.dueAt);
  }
  const assigneeIds = Array.from(new Set(tickets.map((t) => t.assigneeId).filter(Boolean))) as string[];
  const assigneeNames = new Map<string, string>();
  await Promise.all(
    assigneeIds.map(async (uid) => assigneeNames.set(uid, await resolveStaffDisplay(uid))),
  );

  const openerIds = Array.from(new Set(convs.map((c) => c.consumerId).filter(Boolean)));
  const idMap = new Map<string, SupportTargetUser>();
  await Promise.all(
    openerIds.map(async (uid) => {
      const u = await resolveSupportTargetUser(uid);
      if (u) idMap.set(uid, u);
    }),
  );
  // Optional seller/creator display context (business / handle).
  let brands: Array<{ sellerId?: string; name?: string }> = [];
  let creators: Array<{ userId?: string; name?: string; handle?: string }> = [];
  try {
    const { catalogStore: editorialCatalogStore } = await import(
      '../../../lib/vercel-catalog/catalogStore'
    );
    brands = (await editorialCatalogStore.listBrands()) as never;
    creators = (await editorialCatalogStore.listCreators()) as never;
  } catch {
    /* optional */
  }

  // Best-effort order counts for the CRM snapshot (canonical, cheap).
  let orderCountByBuyer = new Map<string, number>();
  try {
    const { operationsStore } = await import('../../operations/operationsStore');
    for (const o of operationsStore.listOrders()) {
      orderCountByBuyer.set(o.buyerId, (orderCountByBuyer.get(o.buyerId) || 0) + 1);
    }
  } catch {
    orderCountByBuyer = new Map();
  }

  const rows: AdminSupportInboxRow[] = [];
  for (const c of convs) {
    const ticket = ticketByConv.get(c.id) || null;
    const audience =
      (ticket?.audience as SupportAudience) ||
      (c.metadata?.audience as SupportAudience) ||
      idMap.get(c.consumerId)?.audience ||
      'consumer';
    if (filter?.audience && audience !== filter.audience) continue;
    if (filter?.status && (ticket?.status || SUPPORT_TICKET_STATUSES.OPEN) !== filter.status) continue;
    if (filter?.priority && ticket?.priority !== filter.priority) continue;
    if (filter?.assigneeId && ticket?.assigneeId !== filter.assigneeId) continue;

    const u = idMap.get(c.consumerId);
    const roleLabel =
      audience === 'seller' ? 'Seller' : audience === 'creator' ? 'Creator' : 'Consumer';
    let contextLabel: string | undefined;
    if (audience === 'seller') {
      contextLabel = brands.find((b) => b.sellerId === c.consumerId)?.name;
    } else if (audience === 'creator') {
      const cr = creators.find((x) => x.userId === c.consumerId);
      contextLabel = cr?.handle || cr?.name;
    }

    const msgs = await listMessages(c.id);
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter(
      (m) =>
        m.senderId !== actor.userId &&
        m.senderRole !== 'admin' &&
        m.senderRole !== 'system' &&
        !(Array.isArray(m.readBy) ? m.readBy : []).includes(actor.userId),
    ).length;

    rows.push({
      conversation: c,
      ticket,
      audience,
      opener: {
        id: c.consumerId,
        displayName: u?.displayName || `User ${c.consumerId.slice(0, 8)}`,
        choosifyUserId: u?.choosifyUserId,
        avatarUrl: u?.avatarUrl,
        roleLabel,
        contextLabel,
        email: u?.email,
        emailVerified: u?.emailVerified,
        memberSince: u?.memberSince,
        totalOrders: orderCountByBuyer.get(c.consumerId) ?? 0,
      },
      lastMessageAt: last?.createdAt || c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unread,
      priority: ticket?.priority,
      status: ticket?.status,
      assigneeId: ticket?.assigneeId,
      assigneeName: ticket?.assigneeId ? assigneeNames.get(ticket.assigneeId) : undefined,
      department: ticket?.department,
      reopenedAt: ticket?.reopenedAt,
      noteCount: noteCountByConv.get(c.id) || 0,
      followupDueAt: dueByConv.get(c.id),
    });
  }
  return rows.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
}

export async function searchConversationsForActor(
  actor: MessagingActor,
  q: string,
): Promise<CommerceConversation[]> {
  const needle = q.trim().toLowerCase();
  const rows = await listConversationsForActor(actor);
  if (!needle) return rows;
  const matched: CommerceConversation[] = [];
  for (const c of rows) {
    const hay = [
      c.id,
      c.orderId,
      c.bookingRequestId,
      c.lastMessagePreview,
      c.brandId,
      JSON.stringify(c.metadata || {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (hay.includes(needle)) {
      matched.push(c);
      continue;
    }
    const msgs = await listMessages(c.id);
    if (msgs.some((m) => m.body.toLowerCase().includes(needle))) matched.push(c);
  }
  return matched;
}

export async function connectSocialInbox(input: {
  actor: MessagingActor;
  brandId: string;
  channel: 'facebook' | 'instagram' | 'whatsapp';
  externalAccountId?: string;
}): Promise<SocialInboxConnection> {
  const { sellerOwnsBrand } = await import('../../catalog/brandOwnership');
  if (!(await sellerOwnsBrand(input.actor.userId, input.brandId))) {
    throw new CommerceError('Not authorized for this Brand', 403);
  }
  // Do not fake live Meta success — mark connected only when credentials exist for channel.
  const { getMessagingStatus } = await import('../config');
  const status = getMessagingStatus();
  const channelState =
    input.channel === 'facebook'
      ? status.channels.messenger
      : input.channel === 'instagram'
        ? status.channels.instagram
        : status.channels.whatsapp;
  // Only claim "connected" when live credentials are ready — never fake Meta success.
  const channelReady = channelState === 'ready';

  const now = nowIso();
  const existing = (await listSocialInbox(input.brandId)).find((s) => s.channel === input.channel);
  const row: SocialInboxConnection = {
    id: existing?.id || newId('social'),
    brandId: input.brandId,
    sellerId: input.actor.userId,
    channel: input.channel,
    status: channelReady ? 'connected' : 'error',
    externalAccountId: input.externalAccountId,
    connectedAt: channelReady ? now : undefined,
    updatedAt: now,
    metadata: {
      note: channelReady
        ? 'Provider credentials present; sandbox sync is Integration UAT'
        : 'Provider credentials unavailable — connection not claimed live',
    },
  };
  return saveSocialInbox(row);
}

export async function disconnectSocialInbox(input: {
  actor: MessagingActor;
  brandId: string;
  channel: 'facebook' | 'instagram' | 'whatsapp';
}): Promise<SocialInboxConnection | null> {
  const { sellerOwnsBrand } = await import('../../catalog/brandOwnership');
  if (!(await sellerOwnsBrand(input.actor.userId, input.brandId))) {
    throw new CommerceError('Not authorized for this Brand', 403);
  }
  const existing = (await listSocialInbox(input.brandId)).find((s) => s.channel === input.channel);
  if (!existing) return null;
  return saveSocialInbox({
    ...existing,
    status: 'disconnected',
    disconnectedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function ingestExternalMessageIdempotent(input: {
  conversationId: string;
  externalMessageId: string;
  body: string;
  senderId: string;
  senderRole: SenderRole;
  sourceChannel: SourceChannel;
}): Promise<{ message: CommerceMessage; duplicate: boolean }> {
  const existing = await getMessageByExternalId(input.externalMessageId);
  if (existing) return { message: existing, duplicate: true };
  const conv = await getConversation(input.conversationId);
  if (!conv) throw new CommerceError('Conversation not found', 404);
  const message = await persistMessageInternal({
    conversation: conv,
    senderId: input.senderId,
    senderRole: input.senderRole,
    body: input.body,
    messageType: MESSAGE_TYPES.TEXT,
    externalMessageId: input.externalMessageId,
    sourceChannel: input.sourceChannel,
  });
  return { message, duplicate: false };
}

export {
  listSocialInbox,
  listSupportTickets,
  getSupportTicket,
  listAdminEntries,
  consumerInitiated,
  markClosed,
  ACTIVE_SUPPORT_TICKET_STATUSES,
  CLOSED_SUPPORT_TICKET_STATUSES,
};
