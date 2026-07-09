import type { Request } from 'express';
import { communicationStore } from './communicationStore';
import { createNotification } from './notificationService';
import { logBroadcastAudit, recordBroadcastSent } from './eventHooks';
import type { Broadcast, BroadcastInput } from './communicationTypes';
import { BROADCAST_STATUSES, DELIVERY_CHANNELS } from './communicationTypes';

export function listBroadcasts(): Broadcast[] {
  return communicationStore.listBroadcasts();
}

export function getBroadcast(id: string): Broadcast | null {
  return communicationStore.getBroadcast(id);
}

export async function createBroadcast(input: BroadcastInput, req?: Request): Promise<Broadcast> {
  const broadcast = communicationStore.createBroadcast({
    broadcastType: input.broadcastType,
    title: input.title,
    body: input.body,
    targetRoles: input.targetRoles ?? [],
    targetSegments: input.targetSegments ?? [],
    createdBy: input.createdBy,
    status: input.status ?? BROADCAST_STATUSES.DRAFT,
    channels: input.channels?.length ? input.channels : [DELIVERY_CHANNELS.IN_APP],
    scheduledAt: input.scheduledAt,
    metadata: input.metadata,
  });

  logBroadcastAudit('create_broadcast', broadcast.id, 'success', {
    userId: input.createdBy,
    metadata: {
      broadcastType: broadcast.broadcastType,
      targetRoles: broadcast.targetRoles,
      targetSegments: broadcast.targetSegments,
    },
  }, req);

  return broadcast;
}

export async function sendBroadcast(id: string, req?: Request): Promise<Broadcast | null> {
  const broadcast = communicationStore.getBroadcast(id);
  if (!broadcast) return null;

  const updated = communicationStore.updateBroadcast(id, {
    status: BROADCAST_STATUSES.SENT,
    sentAt: new Date().toISOString(),
  });
  if (!updated) return null;

  // Framework: create in-app notifications for targeted users when segment includes user IDs.
  const targetUserIds = (updated.metadata?.targetUserIds as string[] | undefined) ?? [];
  for (const userId of targetUserIds) {
    await createNotification(
      {
        userId,
        type: 'broadcast',
        category: updated.broadcastType === 'admin' ? 'admin' : updated.broadcastType === 'seller' ? 'seller' : 'buyer',
        title: updated.title,
        summary: updated.body,
        channels: updated.channels,
        metadata: { broadcastId: updated.id },
      },
      req,
    );
  }

  recordBroadcastSent(updated, req);
  logBroadcastAudit('send_broadcast', updated.id, 'success', {
    userId: req?.userId || updated.createdBy,
    metadata: { targetUserCount: targetUserIds.length },
  }, req);

  return updated;
}

export function updateBroadcast(
  id: string,
  patch: Partial<Pick<Broadcast, 'title' | 'body' | 'status' | 'targetRoles' | 'targetSegments' | 'scheduledAt' | 'metadata'>>,
): Broadcast | null {
  return communicationStore.updateBroadcast(id, patch);
}
