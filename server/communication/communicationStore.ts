import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications as notificationsTable } from '../db/schema';
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
  broadcasts: Broadcast[];
  preferences: Map<string, CommunicationPreferences>;
};

const state: CommunicationState = {
  broadcasts: [],
  preferences: new Map(),
};

/**
 * Sprint 12 pre-beta audit — P0 fix: notifications themselves were migrated to
 * Postgres in Sprint 10 (see comment below), but admin broadcast messages and
 * per-user notification preferences (channel opt-in, quiet hours, marketing
 * opt-in) were left behind in this bare in-memory state with zero persistence
 * — both silently wiped on every restart. Adds the same disk-snapshot pattern
 * used everywhere else in the codebase.
 */
const DISK_SNAPSHOT_PATH =
  process.env.COMMUNICATION_MEMORY_SNAPSHOT_PATH?.trim() ||
  join(process.cwd(), '.data', 'communication-memory-snapshot.json');

let hydrated = false;
function ensureCommunicationHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  if (!existsSync(DISK_SNAPSHOT_PATH)) return;
  try {
    const snap = JSON.parse(readFileSync(DISK_SNAPSHOT_PATH, 'utf8')) as {
      broadcasts?: Broadcast[];
      preferences?: Array<[string, CommunicationPreferences]>;
    };
    if (snap.broadcasts) state.broadcasts = snap.broadcasts;
    if (snap.preferences) state.preferences = new Map(snap.preferences);
    console.log(
      `[CommunicationMemoryPersist] Hydrated (${state.broadcasts.length} broadcasts, ${state.preferences.size} preference rows).`,
    );
  } catch (error) {
    console.warn('[CommunicationMemoryPersist] Failed to load snapshot:', error);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      mkdirSync(dirname(DISK_SNAPSHOT_PATH), { recursive: true });
      writeFileSync(
        DISK_SNAPSHOT_PATH,
        JSON.stringify({ broadcasts: state.broadcasts, preferences: [...state.preferences.entries()] }),
        'utf8',
      );
    } catch (error) {
      console.error('[CommunicationMemoryPersist] Failed to save snapshot:', error);
    }
  }, 300);
}

ensureCommunicationHydrated();

type NotificationRow = typeof notificationsTable.$inferSelect;

function rowToNotification(row: NotificationRow): CommunicationNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as CommunicationNotification['type'],
    category: row.category as CommunicationNotification['category'],
    priority: row.priority as CommunicationNotification['priority'],
    title: row.title,
    summary: row.summary || undefined,
    actionUrl: row.actionUrl || undefined,
    channels: (row.channels as CommunicationNotification['channels']) || [],
    read: row.read,
    dismissed: row.dismissed,
    archived: row.archived,
    pinned: row.pinned,
    metadata: (row.metadata as Record<string, unknown>) || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : undefined,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : undefined,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : undefined,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
  };
}

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
  // Sprint 10 durability migration: notifications are read/written directly against
  // PostgreSQL on every call (no per-process cache) — a bare in-memory Map with no
  // disk snapshot at all previously meant every restart silently discarded history.
  async listNotifications(filter: NotificationCenterFilter): Promise<CommunicationNotification[]> {
    const conditions = [];
    if (filter.userId) conditions.push(eq(notificationsTable.userId, filter.userId));
    if (filter.read !== undefined) conditions.push(eq(notificationsTable.read, filter.read));
    if (filter.archived !== undefined) conditions.push(eq(notificationsTable.archived, filter.archived));
    if (filter.dismissed !== undefined) conditions.push(eq(notificationsTable.dismissed, filter.dismissed));
    if (filter.pinned !== undefined) conditions.push(eq(notificationsTable.pinned, filter.pinned));
    if (filter.priority) conditions.push(eq(notificationsTable.priority, filter.priority));
    if (filter.category) conditions.push(eq(notificationsTable.category, filter.category));
    if (filter.type) conditions.push(eq(notificationsTable.type, filter.type));

    const query = conditions.length
      ? db.select().from(notificationsTable).where(and(...conditions))
      : db.select().from(notificationsTable);
    let rows = (await query.orderBy(desc(notificationsTable.pinned), desc(notificationsTable.createdAt))).map(rowToNotification);

    if (filter.q) {
      const q = filter.q.toLowerCase();
      rows = rows.filter((n) => n.title.toLowerCase().includes(q) || (n.summary || '').toLowerCase().includes(q));
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  },

  async countNotifications(userId?: string): Promise<CommunicationNotification[]> {
    const rows = userId
      ? await db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId))
      : await db.select().from(notificationsTable);
    return rows.map(rowToNotification);
  },

  async getNotification(id: string): Promise<CommunicationNotification | null> {
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id)).limit(1);
    return rows[0] ? rowToNotification(rows[0]) : null;
  },

  async createNotification(
    input: Omit<CommunicationNotification, 'id' | 'createdAt' | 'updatedAt' | 'read' | 'dismissed' | 'archived'>,
  ): Promise<CommunicationNotification> {
    const rows = await db
      .insert(notificationsTable)
      .values({
        id: `ntf-${randomUUID()}`,
        userId: input.userId,
        type: input.type,
        category: input.category,
        priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,
        title: input.title,
        summary: input.summary,
        actionUrl: input.actionUrl,
        channels: input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP],
        pinned: input.pinned ?? false,
        metadata: input.metadata,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      })
      .returning();
    return rowToNotification(rows[0]);
  },

  async updateNotification(id: string, patch: Partial<CommunicationNotification>): Promise<CommunicationNotification | null> {
    const {
      id: _ignoreId,
      createdAt: _ignoreCreatedAt,
      updatedAt: _ignoreUpdatedAt,
      readAt: _ignoreReadAt,
      dismissedAt: _ignoreDismissedAt,
      archivedAt: _ignoreArchivedAt,
      expiresAt: _ignoreExpiresAt,
      ...rest
    } = patch;
    const values: Partial<typeof notificationsTable.$inferInsert> = { ...rest, updatedAt: new Date() };
    if (patch.readAt !== undefined) values.readAt = patch.readAt ? new Date(patch.readAt) : null;
    if (patch.dismissedAt !== undefined) values.dismissedAt = patch.dismissedAt ? new Date(patch.dismissedAt) : null;
    if (patch.archivedAt !== undefined) values.archivedAt = patch.archivedAt ? new Date(patch.archivedAt) : null;
    if (patch.expiresAt !== undefined) values.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    const rows = await db.update(notificationsTable).set(values).where(eq(notificationsTable.id, id)).returning();
    return rows[0] ? rowToNotification(rows[0]) : null;
  },

  async deleteNotification(id: string): Promise<boolean> {
    const rows = await db.delete(notificationsTable).where(eq(notificationsTable.id, id)).returning();
    return rows.length > 0;
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
    schedulePersist();
    return broadcast;
  },

  updateBroadcast(id: string, patch: Partial<Broadcast>): Broadcast | null {
    const idx = state.broadcasts.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    state.broadcasts[idx] = { ...state.broadcasts[idx], ...patch, updatedAt: nowIso() };
    schedulePersist();
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
    schedulePersist();
    return updated;
  },

  countPreferencesUsers(): number {
    return state.preferences.size;
  },
};
