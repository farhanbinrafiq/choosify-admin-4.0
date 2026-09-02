/**
 * In-app Notification Center client.
 * Hits the existing communication domain at `/api/notifications` (not `/api/v1`).
 *
 * When no bearer token is present (unauthenticated / pre-login), returns an
 * empty identity-scoped feed instead of inventing demo notifications.
 * Real delivery/creation remains the communication domain sprint.
 */

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low' | 'silent';

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  category: string;
  priority: NotificationPriority;
  title: string;
  summary?: string;
  actionUrl?: string;
  channels: string[];
  read: boolean;
  dismissed: boolean;
  archived: boolean;
  pinned: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
};

export type NotificationSummary = {
  total: number;
  unread: number;
  read: number;
  archived: number;
  pinned: number;
  dismissed: number;
};

export type NotificationListResult = {
  items: AppNotification[];
  summary: NotificationSummary;
  /** True when feed came from the unauthenticated empty adapter (not the live API). */
  temporaryEmpty?: boolean;
};

const AUTH_TOKEN_KEY = 'choosify_auth_token';
/** Communication router is mounted at `/api`, not `/api/v1`. */
const COMM_API_BASE = '/api';

const EMPTY_SUMMARY: NotificationSummary = {
  total: 0,
  unread: 0,
  read: 0,
  archived: 0,
  pinned: 0,
  dismissed: 0,
};

function authToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function emptyResult(temporaryEmpty = true): NotificationListResult {
  return { items: [], summary: { ...EMPTY_SUMMARY }, temporaryEmpty };
}

async function request<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  const token = authToken();
  if (!token) {
    throw new Error('Missing bearer token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${COMM_API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const text = await response.text();
  let parsed: { success?: boolean; data?: T; error?: string; message?: string } | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(parsed?.error || parsed?.message || `Request failed (${response.status})`);
  }

  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return parsed.data as T;
  }
  return parsed as T;
}

export async function listMyNotifications(opts?: {
  limit?: number;
  archived?: boolean;
  dismissed?: boolean;
}): Promise<NotificationListResult> {
  if (!authToken()) {
    return emptyResult(true);
  }

  try {
    const params = new URLSearchParams();
    params.set('limit', String(opts?.limit ?? 20));
    params.set('archived', String(opts?.archived ?? false));
    params.set('dismissed', String(opts?.dismissed ?? false));
    const data = await request<{
      items?: AppNotification[];
      summary?: NotificationSummary;
    }>(`/notifications?${params.toString()}`);

    const items = Array.isArray(data?.items) ? data.items : [];
    const summary = data?.summary
      ? data.summary
      : {
          ...EMPTY_SUMMARY,
          total: items.length,
          unread: items.filter((n) => !n.read && !n.archived).length,
          read: items.filter((n) => n.read && !n.archived).length,
        };

    return { items, summary, temporaryEmpty: false };
  } catch {
    // Auth/session present but API unavailable — stay empty rather than inventing seed rows.
    return emptyResult(false);
  }
}

export async function markNotificationRead(id: string): Promise<AppNotification | null> {
  if (!authToken() || !id) return null;
  try {
    return await request<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
  } catch {
    return null;
  }
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!authToken() || !ids.length) return;
  try {
    await request('/notifications/read', 'POST', { ids });
  } catch {
    /* ignore — UI already optimistically updated */
  }
}
