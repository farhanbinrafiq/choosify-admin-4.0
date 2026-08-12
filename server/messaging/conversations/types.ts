/**
 * Authoritative Commerce Messaging models — IS-005 / Conversation Sprint 9.
 * Separate from Meta omni Conversation shape in src/types.ts.
 */

export const CONVERSATION_CONTEXT_TYPES = {
  PRODUCT_INQUIRY: 'product_inquiry',
  ORDER: 'order',
  SERVICE_REQUEST: 'service_request',
  BOOKING: 'booking',
  MANUAL_ORDER: 'manual_order',
  EXTERNAL_SOCIAL: 'external_social',
  SUPPORT_TICKET: 'support_ticket',
} as const;

export type ConversationContextType =
  (typeof CONVERSATION_CONTEXT_TYPES)[keyof typeof CONVERSATION_CONTEXT_TYPES];

export const CONVERSATION_STATUSES = {
  ACTIVE: 'active',
  READ_ONLY: 'read_only',
  CLOSED: 'closed',
} as const;

export type ConversationStatus =
  (typeof CONVERSATION_STATUSES)[keyof typeof CONVERSATION_STATUSES];

export const MESSAGE_TYPES = {
  TEXT: 'text',
  SYSTEM: 'system',
  ATTACHMENT: 'attachment',
  ORDER_CARD: 'order_card',
  PRODUCT_CARD: 'product_card',
  SERVICE_CARD: 'service_card',
  BOOKING_CARD: 'booking_card',
  COUNTER_OFFER: 'counter_offer',
} as const;

export type CommerceMessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export type SenderRole = 'consumer' | 'seller' | 'seller_staff' | 'admin' | 'system';

export type SourceChannel =
  | 'platform'
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'manual'
  | 'external_whatsapp';

export type CommerceConversation = {
  id: string;
  /** Permanent Choosify Conversation Reference ID (CV-#####). Support/audit display. */
  conversationReferenceId?: string;
  contextType: ConversationContextType;
  status: ConversationStatus;
  consumerId: string;
  sellerId: string;
  brandId: string;
  orderId?: string;
  bookingRequestId?: string;
  checkoutId?: string;
  sourceChannel: SourceChannel;
  participants: Array<{ userId: string; role: SenderRole }>;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  readOnlyAt?: string;
  closedAt?: string;
  /** Idempotency / reconcile key — unique per commercial context */
  reconcileKey: string;
  metadata?: Record<string, unknown>;
};

export type CommerceAttachment = {
  id: string;
  messageId: string;
  conversationId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageRef: string;
  uploadedBy: string;
  createdAt: string;
};

export type CommerceMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  body: string;
  messageType: CommerceMessageType;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  readBy: string[];
  sourceChannel: SourceChannel;
  /** Dedup for Meta / replay */
  externalMessageId?: string;
  metadata?: Record<string, unknown>;
};

export type SocialInboxConnection = {
  id: string;
  brandId: string;
  sellerId: string;
  channel: 'facebook' | 'instagram' | 'whatsapp';
  status: 'connected' | 'disconnected' | 'error';
  externalAccountId?: string;
  syncCursor?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type SupportTicket = {
  id: string;
  conversationId: string;
  openerId: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
};

export type AdminConversationEntry = {
  id: string;
  conversationId: string;
  adminId: string;
  reason?: string;
  createdAt: string;
};
