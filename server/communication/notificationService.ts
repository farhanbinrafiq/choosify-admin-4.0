import type { Request } from 'express';
import { communicationStore } from './communicationStore';
import { dispatchToChannels } from './deliveryChannels';
import {
  logNotificationAudit,
  recordNotificationDismissed,
  recordNotificationRead,
  recordNotificationSent,
} from './eventHooks';
import type {
  CommunicationNotification,
  NotificationCenterFilter,
  NotificationInput,
} from './communicationTypes';
import { DELIVERY_CHANNELS, NOTIFICATION_PRIORITIES } from './communicationTypes';
import { isInAppNotificationEnabled } from './preferenceService';

export type BulkNotificationResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
};

export function listNotifications(filter: NotificationCenterFilter) {
  return communicationStore.listNotifications(filter);
}

export function getNotification(id: string): Promise<CommunicationNotification | null> {
  return communicationStore.getNotification(id);
}

/**
 * Whether the recipient's own preference allows this in-app notification.
 * Security-category, mandatory and un-keyed notifications always pass. A
 * lookup failure also passes — a preference outage must never silently drop
 * a notification.
 */
async function preferenceAllows(input: NotificationInput): Promise<boolean> {
  if (input.category === 'security' || !input.eventKey || !input.persona) return true;
  try {
    return await isInAppNotificationEnabled(input.userId, input.persona, input.eventKey);
  } catch (error) {
    console.warn('[Notifications] Preference lookup failed; delivering anyway:', error);
    return true;
  }
}

/**
 * Creates (and dispatches) one notification — or returns null, creating
 * nothing, when the recipient switched this event off for this persona.
 */
export async function createNotification(
  input: NotificationInput,
  req?: Request,
): Promise<CommunicationNotification | null> {
  if (!(await preferenceAllows(input))) return null;
  const channels = input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP];

  const notification = await communicationStore.createNotification({
    userId: input.userId,
    type: input.type,
    category: input.category,
    priority: input.priority ?? NOTIFICATION_PRIORITIES.NORMAL,
    title: input.title,
    summary: input.summary,
    actionUrl: input.actionUrl,
    channels,
    pinned: input.pinned ?? false,
    metadata: input.metadata,
    expiresAt: input.expiresAt,
  });

  // Only in-app has a real provider; the others are framework no-ops, so the
  // legacy per-channel JSON flags (which never changed delivery) are gone.
  const enabledChannels = channels;

  await dispatchToChannels(
    {
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      summary: notification.summary,
      metadata: notification.metadata,
    },
    enabledChannels,
  );

  recordNotificationSent(notification, req);
  return notification;
}

export function updateNotification(
  id: string,
  patch: Partial<Pick<CommunicationNotification, 'title' | 'summary' | 'priority' | 'pinned' | 'metadata'>>,
): Promise<CommunicationNotification | null> {
  return communicationStore.updateNotification(id, patch);
}

export async function dismissNotification(id: string, req?: Request): Promise<CommunicationNotification | null> {
  const updated = await communicationStore.updateNotification(id, {
    dismissed: true,
    dismissedAt: new Date().toISOString(),
  });
  if (updated) recordNotificationDismissed(updated, req);
  return updated;
}

export async function markRead(id: string, req?: Request): Promise<CommunicationNotification | null> {
  const updated = await communicationStore.updateNotification(id, {
    read: true,
    readAt: new Date().toISOString(),
  });
  if (updated) recordNotificationRead(updated, req);
  return updated;
}

export function markUnread(id: string): Promise<CommunicationNotification | null> {
  return communicationStore.updateNotification(id, {
    read: false,
    readAt: undefined,
  });
}

export function archiveNotification(id: string): Promise<CommunicationNotification | null> {
  return communicationStore.updateNotification(id, {
    archived: true,
    archivedAt: new Date().toISOString(),
  });
}

export async function deleteNotification(id: string, req?: Request): Promise<boolean> {
  const existing = await communicationStore.getNotification(id);
  if (!existing) return false;
  const deleted = await communicationStore.deleteNotification(id);
  if (deleted) {
    logNotificationAudit('delete_notification', 'notification', 'success', {
      resourceId: id,
      userId: req?.userId,
      metadata: { targetUserId: existing.userId },
    }, req);
  }
  return deleted;
}

async function runBulk(ids: string[], action: (id: string) => Promise<CommunicationNotification | null>): Promise<BulkNotificationResult> {
  const succeeded: string[] = [];
  const failed: BulkNotificationResult['failed'] = [];
  for (const id of ids) {
    const result = await action(id);
    if (result) succeeded.push(id);
    else failed.push({ id, error: 'Notification not found' });
  }
  return { succeeded, failed };
}

export function bulkRead(ids: string[], req?: Request): Promise<BulkNotificationResult> {
  return runBulk(ids, (id) => markRead(id, req));
}

export function bulkArchive(ids: string[]): Promise<BulkNotificationResult> {
  return runBulk(ids, (id) => archiveNotification(id));
}

export async function getNotificationCenterSummary(userId: string) {
  const rows = await communicationStore.countNotifications(userId);
  return {
    total: rows.length,
    unread: rows.filter((n) => !n.read && !n.archived).length,
    read: rows.filter((n) => n.read && !n.archived).length,
    archived: rows.filter((n) => n.archived).length,
    pinned: rows.filter((n) => n.pinned).length,
    dismissed: rows.filter((n) => n.dismissed).length,
  };
}
