import { communicationStore } from './communicationStore';
import { listChannelStatus } from './deliveryChannels';
import type { CommunicationSummary } from './communicationTypes';
import { BROADCAST_STATUSES } from './communicationTypes';

export function getCommunicationSummary(): CommunicationSummary {
  const notifications = communicationStore.countNotifications();
  const broadcasts = communicationStore.listBroadcasts();

  return {
    notifications: {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read && !n.archived).length,
      read: notifications.filter((n) => n.read && !n.archived).length,
      archived: notifications.filter((n) => n.archived).length,
      pinned: notifications.filter((n) => n.pinned).length,
      dismissed: notifications.filter((n) => n.dismissed).length,
    },
    broadcasts: {
      total: broadcasts.length,
      draft: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.DRAFT).length,
      scheduled: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.SCHEDULED).length,
      sent: broadcasts.filter((b) => b.status === BROADCAST_STATUSES.SENT).length,
    },
    preferences: {
      usersWithPreferences: communicationStore.countPreferencesUsers(),
    },
    generatedAt: new Date().toISOString(),
  };
}

export function getCommunicationPlatformStatus() {
  return {
    summary: getCommunicationSummary(),
    channels: listChannelStatus(),
  };
}
