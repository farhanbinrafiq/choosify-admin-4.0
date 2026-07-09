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

export type BulkNotificationResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
};

export function listNotifications(filter: NotificationCenterFilter) {
  return communicationStore.listNotifications(filter);
}

export function getNotification(id: string): CommunicationNotification | null {
  return communicationStore.getNotification(id);
}

export async function createNotification(
  input: NotificationInput,
  req?: Request,
): Promise<CommunicationNotification> {
  const preferences = communicationStore.getPreferences(input.userId);
  const channels = input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP];

  const notification = communicationStore.createNotification({
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

  const enabledChannels = channels.filter((channel) => {
    if (input.category === 'system' || input.category === 'security') return true;
    return preferences.channels[channel] !== false;
  });

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
): CommunicationNotification | null {
  return communicationStore.updateNotification(id, patch);
}

export function dismissNotification(id: string, req?: Request): CommunicationNotification | null {
  const updated = communicationStore.updateNotification(id, {
    dismissed: true,
    dismissedAt: new Date().toISOString(),
  });
  if (updated) recordNotificationDismissed(updated, req);
  return updated;
}

export function markRead(id: string, req?: Request): CommunicationNotification | null {
  const updated = communicationStore.updateNotification(id, {
    read: true,
    readAt: new Date().toISOString(),
  });
  if (updated) recordNotificationRead(updated, req);
  return updated;
}

export function markUnread(id: string): CommunicationNotification | null {
  return communicationStore.updateNotification(id, {
    read: false,
    readAt: undefined,
  });
}

export function archiveNotification(id: string): CommunicationNotification | null {
  return communicationStore.updateNotification(id, {
    archived: true,
    archivedAt: new Date().toISOString(),
  });
}

export function deleteNotification(id: string, req?: Request): boolean {
  const existing = communicationStore.getNotification(id);
  if (!existing) return false;
  const deleted = communicationStore.deleteNotification(id);
  if (deleted) {
    logNotificationAudit('delete_notification', 'notification', 'success', {
      resourceId: id,
      userId: req?.userId,
      metadata: { targetUserId: existing.userId },
    }, req);
  }
  return deleted;
}

function runBulk(ids: string[], action: (id: string) => CommunicationNotification | null): BulkNotificationResult {
  const succeeded: string[] = [];
  const failed: BulkNotificationResult['failed'] = [];
  for (const id of ids) {
    const result = action(id);
    if (result) succeeded.push(id);
    else failed.push({ id, error: 'Notification not found' });
  }
  return { succeeded, failed };
}

export function bulkRead(ids: string[], req?: Request): BulkNotificationResult {
  return runBulk(ids, (id) => markRead(id, req));
}

export function bulkArchive(ids: string[]): BulkNotificationResult {
  return runBulk(ids, (id) => archiveNotification(id));
}

export function getNotificationCenterSummary(userId: string) {
  const rows = communicationStore.countNotifications(userId);
  return {
    total: rows.length,
    unread: rows.filter((n) => !n.read && !n.archived).length,
    read: rows.filter((n) => n.read && !n.archived).length,
    archived: rows.filter((n) => n.archived).length,
    pinned: rows.filter((n) => n.pinned).length,
    dismissed: rows.filter((n) => n.dismissed).length,
  };
}
