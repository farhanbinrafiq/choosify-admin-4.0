import { moderationStore } from './moderationStore';
import type {
  ModerationItem,
  ModerationQueueFilter,
  ModerationQueueType,
  ModerationStatus,
  ModerationSummary,
} from './moderationTypes';
import { MODERATION_QUEUES, MODERATION_STATUSES } from './moderationTypes';

const QUEUE_VALUES = Object.values(MODERATION_QUEUES);

export function isModerationQueueType(value: unknown): value is ModerationQueueType {
  return typeof value === 'string' && QUEUE_VALUES.includes(value as ModerationQueueType);
}

export function isModerationStatus(value: unknown): value is ModerationStatus {
  return (
    typeof value === 'string' &&
    Object.values(MODERATION_STATUSES).includes(value as ModerationStatus)
  );
}

export function listQueueItems(filter: ModerationQueueFilter = {}): ModerationItem[] {
  return moderationStore.listItems(filter);
}

export function getQueueSummary(): ModerationSummary['queues'] {
  const counts = moderationStore.countItemsByQueueAndStatus();
  const summary = {} as ModerationSummary['queues'];

  for (const queue of QUEUE_VALUES) {
    const bucket = counts[queue] ?? {
      pending: 0,
      approved: 0,
      rejected: 0,
      needs_review: 0,
      assigned: 0,
      archived: 0,
    };
    summary[queue] = {
      pending: bucket.pending,
      approved: bucket.approved,
      rejected: bucket.rejected,
      needsReview: bucket.needs_review,
      assigned: bucket.assigned,
      total: Object.values(bucket).reduce((sum, n) => sum + n, 0),
    };
  }

  return summary;
}

export function filterQueueByStatus(
  queue: ModerationQueueType,
  status: ModerationStatus,
  limit = 50,
): ModerationItem[] {
  return moderationStore.listItems({ queue, status, limit });
}

export function getPendingQueue(queue: ModerationQueueType, limit = 50): ModerationItem[] {
  return filterQueueByStatus(queue, MODERATION_STATUSES.PENDING, limit);
}

export function getAssignedQueue(moderatorId: string, limit = 50): ModerationItem[] {
  return moderationStore.listItems({
    status: MODERATION_STATUSES.ASSIGNED,
    assignedModeratorId: moderatorId,
    limit,
  });
}
