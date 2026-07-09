import { randomUUID } from 'crypto';
import type {
  Broadcast,
  CommunicationNotification,
  CommunicationPreferences,
  NotificationCenterFilter,
} from './communicationTypes';
import {
  DELIVERY_CHANNELS,
  DIGEST_MODES,
  NOTIFICATION_PRIORITIES,
} from './communicationTypes';

type CommunicationState = {
  notifications: CommunicationNotification[];
  broadcasts: Broadcast[];
  preferences: Map<string, CommunicationPreferences>;
};

const state: CommunicationState = {
  notifications: [],
  broadcasts: [],
  preferences: new Map(),
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultPreferences(userId: string): CommunicationPreferences {
  return {
    userId,
    channels: {
      [DELIVERY_CHANNELS.IN_APP]: true,
      [DELIVERY_CHANNELS.EMAIL]: true,
      [DELIVERY_CHANNELS.PUSH]: true,
      [DELIVERY_CHANNELS.SMS]: false,
      [DELIVERY_CHANNELS.WHATSAPP]: false,
      [DELIVERY_CHANNELS.WEBHOOK]: false,
    },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    digestMode: DIGEST_MODES.INSTANT,
    marketingOptIn: false,
    systemRequired: true,
    updatedAt: nowIso(),
  };
}

export const communicationStore = {
  listNotifications(filter: NotificationCenterFilter): CommunicationNotification[] {
    let rows = filter.userId
      ? state.notifications.filter((n) => n.userId === filter.userId)
      : [...state.notifications];

    if (filter.read !== undefined) rows = rows.filter((n) => n.read === filter.read);
    if (filter.archived !== undefined) rows = rows.filter((n) => n.archived === filter.archived);
    if (filter.dismissed !== undefined) rows = rows.filter((n) => n.dismissed === filter.dismissed);
    if (filter.pinned !== undefined) rows = rows.filter((n) => n.pinned === filter.pinned);
    if (filter.priority) rows = rows.filter((n) => n.priority === filter.priority);
    if (filter.category) rows = rows.filter((n) => n.category === filter.category);
    if (filter.type) rows = rows.filter((n) => n.type === filter.type);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.summary || '').toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },

  countNotifications(userId?: string): CommunicationNotification[] {
    return userId
      ? state.notifications.filter((n) => n.userId === userId)
      : [...state.notifications];
  },

  getNotification(id: string): CommunicationNotification | null {
    return state.notifications.find((n) => n.id === id) ?? null;
  },

  createNotification(
    input: Omit<CommunicationNotification, 'id' | 'createdAt' | 'updatedAt' | 'read' | 'dismissed' | 'archived'>,
  ): CommunicationNotification {
    const notification: CommunicationNotification = {
      ...input,
      id: `ntf-${randomUUID()}`,
      read: false,
      dismissed: false,
      archived: false,
      priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,
      channels: input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.notifications.unshift(notification);
    return notification;
  },

  updateNotification(id: string, patch: Partial<CommunicationNotification>): CommunicationNotification | null {
    const idx = state.notifications.findIndex((n) => n.id === id);
    if (idx < 0) return null;
    state.notifications[idx] = { ...state.notifications[idx], ...patch, updatedAt: nowIso() };
    return state.notifications[idx];
  },

  deleteNotification(id: string): boolean {
    const before = state.notifications.length;
    state.notifications = state.notifications.filter((n) => n.id !== id);
    return state.notifications.length < before;
  },

  listBroadcasts(): Broadcast[] {
    return [...state.broadcasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getBroadcast(id: string): Broadcast | null {
    return state.broadcasts.find((b) => b.id === id) ?? null;
  },

  createBroadcast(input: Omit<Broadcast, 'id' | 'createdAt' | 'updatedAt'>): Broadcast {
    const broadcast: Broadcast = {
      ...input,
      id: `brc-${randomUUID()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.broadcasts.unshift(broadcast);
    return broadcast;
  },

  updateBroadcast(id: string, patch: Partial<Broadcast>): Broadcast | null {
    const idx = state.broadcasts.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    state.broadcasts[idx] = { ...state.broadcasts[idx], ...patch, updatedAt: nowIso() };
    return state.broadcasts[idx];
  },

  getPreferences(userId: string): CommunicationPreferences {
    return state.preferences.get(userId) ?? defaultPreferences(userId);
  },

  upsertPreferences(
    userId: string,
    patch: Partial<Omit<CommunicationPreferences, 'userId' | 'updatedAt'>>,
  ): CommunicationPreferences {
    const current = state.preferences.get(userId) ?? defaultPreferences(userId);
    const updated: CommunicationPreferences = {
      ...current,
      ...patch,
      channels: { ...current.channels, ...(patch.channels || {}) },
      quietHours: { ...current.quietHours, ...(patch.quietHours || {}) },
      userId,
      updatedAt: nowIso(),
    };
    state.preferences.set(userId, updated);
    return updated;
  },

  countPreferencesUsers(): number {
    return state.preferences.size;
  },
};
