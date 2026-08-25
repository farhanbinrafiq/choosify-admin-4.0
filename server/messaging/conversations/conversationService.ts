/**
 * Authoritative Conversation + Message service — IS-005 / Conversation Sprint 9.
 */

import { randomUUID } from 'node:crypto';
import { CommerceError } from '../../commerce/cartService';
import { commerceStore } from '../../commerce/commerceStore';
import { catalogStore } from '../../catalogStore';
import { publishEvent } from '../../events/eventBus';
import { Logger } from '../../lib/logger';
import { notifyUser } from '../../communication/systemNotify';
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
} from './conversationStore';
import {
  markClosed,
  markReadOnly,
  shouldBecomeReadOnlyForOrderStatus,
} from './conversationLifecycle';
import {
  assertCanReadConversation,
  assertCanSendMessage,
  assertNotForbiddenDmCreate,
  consumerInitiated,
  isAdminEnterRole,
  resolveSenderRole,
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
  type SupportTicket,
  type SupportTicketStatus,
} from './types';

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

/** One active platform-support conversation per authenticated user. */
export function activeSupportReconcileKey(userId: string): string {
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

  if (senderRole === 'admin' && input.requireAdminEntry !== false) {
    const entries = await listAdminEntries(conv.id);
    const entered = entries.some((e) => e.adminId === input.actor.userId);
    if (!entered) {
      throw new CommerceError('Admin must enter the conversation before messaging', 403);
    }
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
        category: senderRole === 'seller' ? 'buyer' : 'seller',
        title: 'New message',
        summary: body ? body.slice(0, 140) : 'Sent an attachment.',
        actionUrl: '/messages',
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

export async function findActiveSupportConversationForUser(
  userId: string,
): Promise<{ ticket: SupportTicket; conversation: CommerceConversation } | null> {
  if (!userId) return null;
  const byKey = await getConversationByReconcileKey(activeSupportReconcileKey(userId));
  if (byKey && byKey.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET) {
    const tickets = await listSupportTickets();
    const ticket = tickets.find((t) => t.conversationId === byKey.id && t.openerId === userId) || null;
    if (ticket && isActiveSupportConversation(ticket, byKey)) {
      return { ticket, conversation: byKey };
    }
  }
  const tickets = await listSupportTickets();
  const mine = tickets.filter((t) => t.openerId === userId);
  for (const ticket of mine) {
    const conv = await getConversation(ticket.conversationId);
    if (conv && isActiveSupportConversation(ticket, conv)) {
      return { ticket, conversation: conv };
    }
  }
  return null;
}

export async function ensureActiveSupportConversation(input: {
  actor: MessagingActor;
  subject?: string;
  body?: string;
}): Promise<{
  ticket: SupportTicket;
  conversation: CommerceConversation;
  message: CommerceMessage | null;
  created: boolean;
}> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);

  const existing = await findActiveSupportConversationForUser(input.actor.userId);
  if (existing) {
    return { ...existing, message: null, created: false };
  }

  const created = await createSupportTicket({
    actor: input.actor,
    subject: input.subject,
    body: input.body,
  });
  return { ...created, created: true };
}

export async function createSupportTicket(input: {
  actor: MessagingActor;
  subject?: string;
  body?: string;
}): Promise<{ ticket: SupportTicket; conversation: CommerceConversation; message: CommerceMessage }> {
  if (!input.actor?.userId) throw new CommerceError('Authentication required', 401);

  const racedExisting = await findActiveSupportConversationForUser(input.actor.userId);
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
  const key = activeSupportReconcileKey(input.actor.userId);
  const racedKey = await getConversationByReconcileKey(key);
  if (racedKey) {
    const tickets = await listSupportTickets();
    const ticket = tickets.find((t) => t.conversationId === racedKey.id && t.openerId === input.actor.userId);
    if (ticket && isActiveSupportConversation(ticket, racedKey)) {
      const messages = await listMessages(racedKey.id);
      return { ticket, conversation: racedKey, message: messages[0] };
    }
  }

  const conversation: CommerceConversation = {
    id: newId('conv'),
    contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
    status: CONVERSATION_STATUSES.ACTIVE,
    consumerId: input.actor.userId,
    sellerId: 'platform_support',
    brandId: 'platform_support',
    sourceChannel: 'platform',
    participants: [
      { userId: input.actor.userId, role: resolveSenderRole(input.actor.role) },
    ],
    createdAt: now,
    updatedAt: now,
    reconcileKey: key,
    metadata: { supportTicket: true, subject, openerId: input.actor.userId },
  };
  const savedConv = await saveConversation(conversation);
  const ticket = await saveSupportTicket({
    id: ticketId,
    conversationId: savedConv.id,
    openerId: input.actor.userId,
    subject,
    status: SUPPORT_TICKET_STATUSES.OPEN,
    createdAt: now,
    updatedAt: now,
  });
  const message = await persistMessageInternal({
    conversation: savedConv,
    senderId: input.actor.userId,
    senderRole: resolveSenderRole(input.actor.role),
    body,
    messageType: MESSAGE_TYPES.TEXT,
  });
  emitMessaging('ConversationCreated', savedConv.id, input.actor.userId, {
    conversationId: savedConv.id,
    supportTicketId: ticket.id,
    contextType: CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET,
  });
  return { ticket, conversation: savedConv, message };
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

export async function listConversationsForActor(
  actor: MessagingActor,
  filters?: { brandId?: string; contextType?: string; sourceChannel?: string },
): Promise<CommerceConversation[]> {
  const all = await listConversations();
  const out: CommerceConversation[] = [];
  for (const c of all) {
    // Support tickets stay off the seller commerce inbox unless this seller opened them.
    if (
      c.contextType === CONVERSATION_CONTEXT_TYPES.SUPPORT_TICKET &&
      resolveSenderRole(actor.role) === 'seller'
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
