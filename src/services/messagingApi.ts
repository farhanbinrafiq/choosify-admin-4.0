/**
 * Commerce Messaging client — IS-005 /api/v1 conversations.
 * Used by frozen Unified Inbox platform threads (OrdersContext).
 */

import { getAuthToken } from '../lib/commerceOrderAdapter';

const base = '/api/v1';

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required for messaging');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  };
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Messaging request failed (${res.status})`);
  }
  return body.data as T;
}

export type ApiConversation = {
  id: string;
  contextType: string;
  status: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  orderId?: string;
  bookingRequestId?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  updatedAt: string;
  createdAt: string;
  sourceChannel?: string;
  participants?: Array<{ userId: string; role: string }>;
  metadata?: Record<string, unknown>;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  body: string;
  messageType: string;
  attachmentIds?: string[];
  readBy?: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type SupportAudience = 'consumer' | 'seller' | 'creator';
export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'pending'
  | 'need_followup'
  | 'resolved'
  | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportDepartment =
  | 'general_support'
  | 'seller_operations'
  | 'payments'
  | 'creator_support'
  | 'trust_safety';

export type SupportTicketNote = {
  id: string;
  conversationId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
};
export type SupportFollowup = {
  id: string;
  conversationId: string;
  dueAt: string;
  createdBy: string;
  createdAt: string;
  status: 'scheduled' | 'fired' | 'cancelled';
  cancelReason?: 'manual' | 'reply' | 'resolved';
};

export type AdminSupportInboxRow = {
  conversation: ApiConversation;
  ticket: {
    id: string;
    status: string;
    subject: string;
    audience?: SupportAudience;
    priority?: SupportTicketPriority;
    assigneeId?: string;
    department?: SupportDepartment;
    reopenedAt?: string;
  } | null;
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
  priority?: SupportTicketPriority;
  status?: SupportTicketStatus;
  assigneeId?: string;
  assigneeName?: string;
  department?: SupportDepartment;
  reopenedAt?: string;
  noteCount: number;
  followupDueAt?: string;
};

export type SocialChannel = 'facebook' | 'instagram' | 'whatsapp';

export type SocialConnection = {
  id: string;
  brandId: string;
  sellerId: string;
  channel: SocialChannel;
  status: 'connected' | 'disconnected' | 'error';
  externalAccountId?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: 'Consumer' | 'Seller' | 'Creator' | 'Admin';
  choosifyUserId?: string;
  avatarUrl?: string;
  contextLabel?: string;
};

export const messagingApi = {
  listConversations: (params?: { brandId?: string; contextType?: string }) => {
    const q = new URLSearchParams();
    if (params?.brandId) q.set('brandId', params.brandId);
    if (params?.contextType) q.set('contextType', params.contextType);
    const qs = q.toString();
    return authJson<ApiConversation[]>(`/conversations${qs ? `?${qs}` : ''}`);
  },
  listMessages: (conversationId: string) =>
    authJson<ApiMessage[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    authJson<{ conversation: ApiConversation; message: ApiMessage }>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body: JSON.stringify({ body }) },
    ),
  ensureActiveSupportConversation: (payload?: { subject?: string; body?: string }) =>
    authJson<{
      created: boolean;
      ticket: { id: string; conversationId: string; openerId: string; subject: string; status: string };
      conversation: ApiConversation;
      message?: ApiMessage | null;
    }>('/support/conversations/ensure', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  getActiveSupportConversation: () =>
    authJson<{
      created: boolean;
      ticket: { id: string; conversationId: string; openerId: string; subject: string; status: string };
      conversation: ApiConversation;
    }>('/support/conversations/active'),
  sendSupportMessage: (conversationId: string, body: string) =>
    authJson<{ conversation: ApiConversation; message: ApiMessage }>(
      `/support/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body: JSON.stringify({ body }) },
    ),
  resolveSupportConversation: (conversationId: string, status?: 'resolved' | 'closed') =>
    authJson<{ ticket: { id: string; status: string }; conversation: ApiConversation }>(
      `/support/conversations/${encodeURIComponent(conversationId)}/resolve`,
      { method: 'POST', body: JSON.stringify({ status: status || 'resolved' }) },
    ),

  /** Mark every not-by-me message in a conversation read for the current actor. */
  markConversationRead: (conversationId: string) =>
    authJson<{ conversationId: string; marked: number }>(
      `/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: 'POST', body: '{}' },
    ),
  markSupportConversationRead: (conversationId: string) =>
    authJson<{ conversationId: string; marked: number }>(
      `/support/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: 'POST', body: '{}' },
    ),

  // ── Staff-only: Choosify Support inbox ────────────────────────────────
  listAdminSupportInbox: (filter?: {
    audience?: SupportAudience;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assigneeId?: string;
  }) => {
    const q = new URLSearchParams();
    if (filter?.audience) q.set('audience', filter.audience);
    if (filter?.status) q.set('status', filter.status);
    if (filter?.priority) q.set('priority', filter.priority);
    if (filter?.assigneeId) q.set('assigneeId', filter.assigneeId);
    const qs = q.toString();
    return authJson<AdminSupportInboxRow[]>(
      `/admin/support/conversations${qs ? `?${qs}` : ''}`,
    );
  },

  // ── Admin CRM / Support Desk (staff-only) ────────────────────────────
  updateSupportTicketCrm: (
    conversationId: string,
    patch: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assigneeId?: string | null;
      department?: SupportDepartment | null;
    },
  ) =>
    authJson<Record<string, unknown>>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  listSupportNotes: (conversationId: string) =>
    authJson<SupportTicketNote[]>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}/notes`,
    ),
  addSupportNote: (conversationId: string, body: string) =>
    authJson<SupportTicketNote>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}/notes`,
      { method: 'POST', body: JSON.stringify({ body }) },
    ),
  listSupportFollowups: (conversationId: string) =>
    authJson<SupportFollowup[]>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}/followups`,
    ),
  scheduleSupportFollowup: (conversationId: string, dueAt: string) =>
    authJson<SupportFollowup>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}/followups`,
      { method: 'POST', body: JSON.stringify({ dueAt }) },
    ),
  cancelSupportFollowup: (conversationId: string, followupId: string) =>
    authJson<SupportFollowup>(
      `/admin/support/conversations/${encodeURIComponent(conversationId)}/followups/${encodeURIComponent(followupId)}/cancel`,
      { method: 'POST', body: '{}' },
    ),
  // ── Seller-owned Meta / omnichannel social inbox ─────────────────────
  // Read paths are ownership-scoped server-side: connections are filtered
  // by sellerOwnsBrand, and external_social conversations only return where
  // the seller is a participant (assertCanReadConversation). Live inbound
  // Meta ingest into this seller-scoped surface is not wired yet — see the
  // Meta Inbox blocker note.
  listSocialConnections: (brandId?: string) =>
    authJson<SocialConnection[]>(
      `/seller/social-inbox/status${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`,
    ),
  listSocialConversations: () =>
    authJson<ApiConversation[]>('/conversations?contextType=external_social'),
  connectSocialChannel: (payload: {
    channel: SocialChannel;
    brandId: string;
    externalAccountId?: string;
  }) =>
    authJson<SocialConnection>('/seller/social-inbox/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disconnectSocialChannel: (channel: SocialChannel, brandId: string) =>
    authJson<SocialConnection>(
      `/seller/social-inbox/${encodeURIComponent(channel)}?brandId=${encodeURIComponent(brandId)}`,
      { method: 'DELETE' },
    ),

  /** Admin proactively opens (or reuses) a user's Choosify Support thread. */
  startAdminSupportConversation: (payload: {
    targetUserId: string;
    /** Persona override for dual-capability accounts (e.g. a Verified Seller
     *  also has a Consumer persona) — server validates against what the
     *  target's role actually grants; omit for the default role-derived thread. */
    audience?: SupportAudience;
    subject?: string;
    body?: string;
  }) =>
    authJson<{
      created: boolean;
      conversation: ApiConversation;
      ticket: { id: string; status: string; subject: string; audience?: SupportAudience };
      message: ApiMessage | null;
      target: { id: string; displayName: string; choosifyUserId?: string; audience: SupportAudience };
    }>('/admin/support/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/** Staff user-directory search (CFID exact-first, then name/email). */
export async function searchDirectoryUsers(q: string): Promise<DirectoryUser[]> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required');
  const res = await fetch(
    `${base}/operations/users?context=messaging&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`User search failed (${res.status})`);
  const body = (await res.json().catch(() => ({}))) as { data?: DirectoryUser[] };
  return Array.isArray(body.data) ? body.data : [];
}
