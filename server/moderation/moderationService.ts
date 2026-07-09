import type { Request } from 'express';
import { moderationStore } from './moderationStore';
import { getQueueSummary } from './moderationQueue';
import {
  logModerationAudit,
  recordProductApproved,
  recordProductRejected,
  recordReportCreated,
  recordReportResolved,
  recordSellerRejected,
  recordSellerVerified,
} from './eventHooks';
import { calculateSellerReputation, calculateTrustScore } from './reputationEngine';
import type {
  ModerationActionContext,
  ModerationItem,
  ModerationQueueFilter,
  ModerationSummary,
  QueueItemInput,
  ReportItem,
  SellerVerification,
} from './moderationTypes';
import {
  MODERATION_DECISIONS,
  MODERATION_STATUSES,
  REPORT_STATUSES,
  VERIFICATION_STATUSES,
} from './moderationTypes';

function resolveModerator(ctx: ModerationActionContext, req?: Request) {
  return {
    moderatorId: ctx.moderatorId || req?.userId,
    moderatorName: ctx.moderatorName || req?.user?.displayName,
  };
}

export function queueItem(input: QueueItemInput): ModerationItem {
  const existing = moderationStore.findItemByResource(input.queue, input.resourceId);
  if (existing && existing.status !== MODERATION_STATUSES.ARCHIVED) {
    return existing;
  }

  return moderationStore.createItem({
    queue: input.queue,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    resourceLabel: input.resourceLabel,
    priority: input.priority ?? 0,
    reason: input.reason,
    notes: input.notes,
    metadata: input.metadata,
    status: MODERATION_STATUSES.PENDING,
  });
}

export function approve(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const moderator = resolveModerator(ctx, req);
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.APPROVED,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedAt: new Date().toISOString(),
    decidedBy: moderator.moderatorId,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'approve',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      decision: MODERATION_DECISIONS.APPROVE,
      reason: ctx.reason,
      moderatorId: moderator.moderatorId,
    },
    req,
  );

  if (updated.queue === 'products') {
    recordProductApproved(updated.resourceId, updated.resourceLabel, req);
  }
  if (updated.queue === 'sellers') {
    const verification = moderationStore.upsertVerification(
      updated.resourceId,
      {
        status: VERIFICATION_STATUSES.VERIFIED,
        sellerName: updated.resourceLabel,
        verifiedAt: new Date().toISOString(),
      },
      { changedBy: moderator.moderatorId, reason: ctx.reason, notes: ctx.notes },
    );
    recordSellerVerified(verification.sellerId, verification.sellerName, req);
  }

  return updated;
}

export function reject(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const moderator = resolveModerator(ctx, req);
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.REJECTED,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedAt: new Date().toISOString(),
    decidedBy: moderator.moderatorId,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'reject',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      decision: MODERATION_DECISIONS.REJECT,
      reason: ctx.reason,
      moderatorId: moderator.moderatorId,
    },
    req,
  );

  if (updated.queue === 'products') {
    recordProductRejected(updated.resourceId, updated.resourceLabel, ctx.reason, req);
  }
  if (updated.queue === 'sellers') {
    const verification = moderationStore.upsertVerification(
      updated.resourceId,
      {
        status: VERIFICATION_STATUSES.REJECTED,
        sellerName: updated.resourceLabel,
        rejectedReason: ctx.reason,
      },
      { changedBy: moderator.moderatorId, reason: ctx.reason, notes: ctx.notes },
    );
    recordSellerRejected(verification.sellerId, verification.sellerName, ctx.reason, req);
  }

  return updated;
}

export function requestChanges(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const moderator = resolveModerator(ctx, req);
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.NEEDS_REVIEW,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedBy: moderator.moderatorId,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'request_changes',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      decision: MODERATION_DECISIONS.REQUEST_CHANGES,
      reason: ctx.reason,
      moderatorId: moderator.moderatorId,
    },
    req,
  );

  return updated;
}

export function assignModerator(
  itemId: string,
  moderatorId: string,
  moderatorName?: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.ASSIGNED,
    assignedModeratorId: moderatorId,
    assignedModeratorName: moderatorName,
    notes: ctx.notes,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'assign_moderator',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      moderatorId,
      metadata: { moderatorName },
    },
    req,
  );

  return updated;
}

export function createReport(
  input: Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  req?: Request,
): ReportItem {
  const report = moderationStore.createReport(input);
  recordReportCreated(report.id, report.resourceType, report.resourceId, report.category, req);
  return report;
}

export function resolveReport(
  reportId: string,
  decision: (typeof MODERATION_DECISIONS)[keyof typeof MODERATION_DECISIONS],
  ctx: ModerationActionContext = {},
  req?: Request,
): ReportItem | null {
  const moderator = resolveModerator(ctx, req);
  const status =
    decision === MODERATION_DECISIONS.DISMISS
      ? REPORT_STATUSES.DISMISSED
      : REPORT_STATUSES.RESOLVED;

  const updated = moderationStore.updateReport(reportId, {
    status,
    resolution: decision,
    resolutionReason: ctx.reason,
    resolvedAt: new Date().toISOString(),
    resolvedBy: moderator.moderatorId,
    assignedModeratorId: moderator.moderatorId,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'resolve_report',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      decision,
      reason: ctx.reason,
      moderatorId: moderator.moderatorId,
      metadata: { reportId },
    },
    req,
  );

  recordReportResolved(reportId, updated.resourceType, updated.resourceId, decision, req);
  return updated;
}

export function getModerationSummary(): ModerationSummary {
  const reportCounts = moderationStore.countReportsByStatus();
  const verificationCounts = moderationStore.countVerificationsByStatus();
  const fraudSignals = moderationStore.listFraudSignals();

  return {
    queues: getQueueSummary(),
    reports: {
      open: reportCounts.open,
      investigating: reportCounts.investigating,
      resolved: reportCounts.resolved,
      dismissed: reportCounts.dismissed,
      total: Object.values(reportCounts).reduce((sum, n) => sum + n, 0),
    },
    verifications: {
      pending: verificationCounts.pending,
      verified: verificationCounts.verified,
      rejected: verificationCounts.rejected,
      suspended: verificationCounts.suspended,
      expired: verificationCounts.expired,
      total: Object.values(verificationCounts).reduce((sum, n) => sum + n, 0),
    },
    fraudSignals: {
      unreviewed: fraudSignals.filter((s) => !s.reviewed).length,
      total: fraudSignals.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function listModerationQueue(filter: ModerationQueueFilter = {}) {
  return moderationStore.listItems(filter);
}

export function getSellerVerification(sellerId: string): SellerVerification | null {
  return moderationStore.getVerification(sellerId);
}

export { calculateTrustScore, calculateSellerReputation };
