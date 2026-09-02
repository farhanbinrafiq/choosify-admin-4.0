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

export type SenderRole = 'consumer' | 'seller' | 'seller_staff' | 'creator' | 'admin' | 'system';

/** Which side opened / owns a support conversation — for stable Admin-inbox querying. */
export type SupportAudience = 'consumer' | 'seller' | 'creator';

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

export const SUPPORT_TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  /** Admin is waiting on information from the user. */
  PENDING: 'pending',
  /** Admin scheduled a follow-up; the sweep flips this back to actionable at dueAt. */
  NEED_FOLLOWUP: 'need_followup',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type SupportTicketStatus =
  (typeof SUPPORT_TICKET_STATUSES)[keyof typeof SUPPORT_TICKET_STATUSES];

/**
 * States that put the ticket in the Admin's actionable queue. "Reopened" is
 * NOT a persisted status — a user reply to a resolved ticket sets
 * status:'open' + reopenedAt (smallest coherent state machine).
 */
export const ACTIVE_SUPPORT_TICKET_STATUSES: ReadonlySet<SupportTicketStatus> = new Set([
  SUPPORT_TICKET_STATUSES.OPEN,
  SUPPORT_TICKET_STATUSES.IN_PROGRESS,
  SUPPORT_TICKET_STATUSES.PENDING,
  SUPPORT_TICKET_STATUSES.NEED_FOLLOWUP,
]);

export const CLOSED_SUPPORT_TICKET_STATUSES: ReadonlySet<SupportTicketStatus> = new Set([
  SUPPORT_TICKET_STATUSES.RESOLVED,
  SUPPORT_TICKET_STATUSES.CLOSED,
]);

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export const SUPPORT_DEPARTMENTS = [
  'general_support',
  'seller_operations',
  'payments',
  'creator_support',
  'trust_safety',
] as const;
export type SupportDepartment = (typeof SUPPORT_DEPARTMENTS)[number];

export type SupportTicket = {
  id: string;
  conversationId: string;
  openerId: string;
  /** Canonical role of the opener/owner — 'consumer' | 'seller' | 'creator'. Server-stamped. */
  audience?: SupportAudience;
  /** Set when a staff member opened the thread proactively (Admin → user). */
  initiatedByAdminId?: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;

  // ─── CRM / Support Desk (additive, staff-only) ───────────────────────
  priority?: SupportTicketPriority;
  /** Canonical staff userId this ticket is assigned to. */
  assigneeId?: string;
  department?: SupportDepartment;
  /** Set when a user reply reopened a resolved/closed ticket. Not a status. */
  reopenedAt?: string;
};

/** Admin/staff-only note. NEVER returned by consumer/seller/creator endpoints. */
export type SupportTicketNote = {
  id: string;
  conversationId: string;
  ticketId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
};

/** Scheduled follow-up. Fired by the lazy sweep in listAdminSupportInbox — no background timer. */
export type SupportFollowup = {
  id: string;
  conversationId: string;
  ticketId: string;
  createdBy: string;
  createdAt: string;
  dueAt: string;
  status: 'scheduled' | 'fired' | 'cancelled';
  firedAt?: string;
  cancelledAt?: string;
  /** 'reply' when auto-cancelled because the user responded before dueAt. */
  cancelReason?: 'manual' | 'reply' | 'resolved';
};

export type AdminConversationEntry = {
  id: string;
  conversationId: string;
  adminId: string;
  reason?: string;
  createdAt: string;
};
