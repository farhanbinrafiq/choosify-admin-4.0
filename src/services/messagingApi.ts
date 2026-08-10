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
  metadata?: Record<string, unknown>;
};

export type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  body: string;
  messageType: string;
  createdAt: string;
};

export const messagingApi = {
  listConversations: (params?: { brandId?: string }) => {
    const q = params?.brandId ? `?brandId=${encodeURIComponent(params.brandId)}` : '';
    return authJson<ApiConversation[]>(`/conversations${q}`);
  },
  listMessages: (conversationId: string) =>
    authJson<ApiMessage[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    authJson<{ conversation: ApiConversation; message: ApiMessage }>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body: JSON.stringify({ body }) },
    ),
};
