import type { Request } from 'express';
import {
  approve,
  assignModerator,
  reject,
} from './moderationService';
import { moderationStore } from './moderationStore';
import { logModerationAudit } from './eventHooks';
import type { ModerationActionContext, ModerationItem } from './moderationTypes';
import { MODERATION_STATUSES } from './moderationTypes';

export type BulkModerationResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
};

function runBulk(
  ids: string[],
  action: (id: string) => ModerationItem | null,
): BulkModerationResult {
  const succeeded: string[] = [];
  const failed: BulkModerationResult['failed'] = [];

  for (const id of ids) {
    try {
      const result = action(id);
      if (result) {
        succeeded.push(id);
      } else {
        failed.push({ id, error: 'Item not found' });
      }
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { succeeded, failed };
}

export function bulkApprove(
  ids: string[],
  ctx: ModerationActionContext = {},
  req?: Request,
): BulkModerationResult {
  return runBulk(ids, (id) => approve(id, ctx, req));
}

export function bulkReject(
  ids: string[],
  ctx: ModerationActionContext = {},
  req?: Request,
): BulkModerationResult {
  return runBulk(ids, (id) => reject(id, ctx, req));
}

export function bulkAssign(
  ids: string[],
  moderatorId: string,
  moderatorName?: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): BulkModerationResult {
  return runBulk(ids, (id) => assignModerator(id, moderatorId, moderatorName, ctx, req));
}

export function bulkArchive(
  ids: string[],
  ctx: ModerationActionContext = {},
  req?: Request,
): BulkModerationResult {
  return runBulk(ids, (id) => {
    const updated = moderationStore.updateItem(id, {
      status: MODERATION_STATUSES.ARCHIVED,
      notes: ctx.notes,
      decidedAt: new Date().toISOString(),
      decidedBy: ctx.moderatorId || req?.userId,
    });
    if (updated) {
      logModerationAudit(
        {
          action: 'archive',
          resource: updated.resourceType,
          resourceId: updated.resourceId,
          moderatorId: ctx.moderatorId || req?.userId,
        },
        req,
      );
    }
    return updated;
  });
}
