import { randomUUID } from 'crypto';
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
  ModerationHistoryEntry,
  ModerationItem,
  ModerationQueueFilter,
  ModerationSummary,
  QueueItemInput,
  ReportItem,
  SellerVerification,
} from './moderationTypes';
import {
  MODERATION_DECISIONS,
  MODERATION_QUEUES,
  MODERATION_STATUSES,
  REPORT_STATUSES,
  VERIFICATION_STATUSES,
  type ModerationQueueType,
} from './moderationTypes';

/** Maps a report's free-form resourceType to a real moderation queue, when one exists,
 *  so "escalate" can link to (rather than duplicate) the moderation model. Resource types
 *  with no queue analog (e.g. reporting a consumer) are left un-escalatable to a queue item. */
const QUEUE_BY_RESOURCE_TYPE: Partial<Record<string, ModerationQueueType>> = {
  product: MODERATION_QUEUES.PRODUCTS,
  brand: MODERATION_QUEUES.BRANDS,
  seller: MODERATION_QUEUES.SELLERS,
  creator: MODERATION_QUEUES.CREATORS,
  guide: MODERATION_QUEUES.GUIDES,
  campaign: MODERATION_QUEUES.CAMPAIGNS,
  review: MODERATION_QUEUES.REVIEWS,
  media: MODERATION_QUEUES.MEDIA,
};

function resolveModerator(ctx: ModerationActionContext, req?: Request) {
  return {
    moderatorId: ctx.moderatorId || req?.userId,
    moderatorName: ctx.moderatorName || req?.user?.displayName,
  };
}

function appendHistory(
  item: ModerationItem,
  entry: Omit<ModerationHistoryEntry, 'id' | 'timestamp'>,
): ModerationHistoryEntry[] {
  const full: ModerationHistoryEntry = { ...entry, id: `mh-${randomUUID()}`, timestamp: new Date().toISOString() };
  return [...(item.history || []), full];
}

/** The most recent decision entry (approve/reject/request_changes) not yet revoked -- used to
 *  restore the correct prior status when that decision is undone. */
function findLastRevocableDecision(history: ModerationHistoryEntry[]): ModerationHistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.action === 'revoke') return undefined;
    if (entry.action === 'approve' || entry.action === 'reject' || entry.action === 'request_changes') {
      return entry;
    }
  }
  return undefined;
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
    history: [],
  });
}

export function approve(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const existing = moderationStore.getItem(itemId);
  if (!existing) return null;
  const moderator = resolveModerator(ctx, req);
  const history = appendHistory(existing, {
    action: 'approve',
    actorId: moderator.moderatorId,
    actorName: moderator.moderatorName,
    previousStatus: existing.status,
    newStatus: MODERATION_STATUSES.APPROVED,
    reason: ctx.reason,
    notes: ctx.notes,
  });
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.APPROVED,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedAt: new Date().toISOString(),
    decidedBy: moderator.moderatorId,
    history,
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
  const existing = moderationStore.getItem(itemId);
  if (!existing) return null;
  const moderator = resolveModerator(ctx, req);
  const history = appendHistory(existing, {
    action: 'reject',
    actorId: moderator.moderatorId,
    actorName: moderator.moderatorName,
    previousStatus: existing.status,
    newStatus: MODERATION_STATUSES.REJECTED,
    reason: ctx.reason,
    notes: ctx.notes,
  });
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.REJECTED,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedAt: new Date().toISOString(),
    decidedBy: moderator.moderatorId,
    history,
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

/**
 * Reverses the most recent still-standing decision (approve / reject /
 * request_changes) on an item WITHOUT erasing that it happened: the reversed
 * decision's history entry is left in place, and a new 'revoke' entry is
 * appended alongside it. The item returns to whatever status it was in
 * immediately before that decision (usually 'pending' or 'assigned') --
 * reusing the existing status vocabulary rather than inventing a new one.
 */
export function revoke(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const existing = moderationStore.getItem(itemId);
  if (!existing) return null;

  const lastDecision = findLastRevocableDecision(existing.history || []);
  if (!lastDecision) {
    throw new Error('This item has no standing moderation decision to revoke');
  }
  if (existing.status !== lastDecision.newStatus) {
    throw new Error('This item has changed state since that decision; nothing to revoke');
  }

  const moderator = resolveModerator(ctx, req);
  const restoredStatus = lastDecision.previousStatus || MODERATION_STATUSES.PENDING;

  const history = appendHistory(existing, {
    action: 'revoke',
    actorId: moderator.moderatorId,
    actorName: moderator.moderatorName,
    previousStatus: existing.status,
    newStatus: restoredStatus,
    reason: ctx.reason,
    notes: ctx.notes,
    revokesEntryId: lastDecision.id,
  });

  const updated = moderationStore.updateItem(itemId, {
    status: restoredStatus,
    history,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'revoke',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      decision: MODERATION_DECISIONS.REVOKE,
      reason: ctx.reason,
      moderatorId: moderator.moderatorId,
      metadata: {
        revokedAction: lastDecision.action,
        revokedStatus: lastDecision.newStatus,
        revokedBy: lastDecision.actorId,
        revokedAt: lastDecision.timestamp,
        restoredStatus,
      },
    },
    req,
  );

  if (updated.queue === 'sellers' && (lastDecision.action === 'approve' || lastDecision.action === 'reject')) {
    moderationStore.upsertVerification(
      updated.resourceId,
      {
        status: VERIFICATION_STATUSES.PENDING,
        sellerName: updated.resourceLabel,
      },
      {
        changedBy: moderator.moderatorId,
        reason: ctx.reason,
        notes: ctx.notes ? `[Revoked ${lastDecision.action}] ${ctx.notes}` : `[Revoked ${lastDecision.action}]`,
      },
    );
  }

  return updated;
}

export function requestChanges(
  itemId: string,
  ctx: ModerationActionContext = {},
  req?: Request,
): ModerationItem | null {
  const existing = moderationStore.getItem(itemId);
  if (!existing) return null;
  const moderator = resolveModerator(ctx, req);
  const history = appendHistory(existing, {
    action: 'request_changes',
    actorId: moderator.moderatorId,
    actorName: moderator.moderatorName,
    previousStatus: existing.status,
    newStatus: MODERATION_STATUSES.NEEDS_REVIEW,
    reason: ctx.reason,
    notes: ctx.notes,
  });
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.NEEDS_REVIEW,
    reason: ctx.reason,
    notes: ctx.notes,
    decidedBy: moderator.moderatorId,
    history,
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
  const existing = moderationStore.getItem(itemId);
  if (!existing) return null;
  const history = appendHistory(existing, {
    action: 'assign',
    actorId: req?.userId,
    actorName: req?.user?.displayName,
    previousStatus: existing.status,
    newStatus: MODERATION_STATUSES.ASSIGNED,
    notes: ctx.notes,
    assignedToId: moderatorId,
    assignedToName: moderatorName,
  });
  const updated = moderationStore.updateItem(itemId, {
    status: MODERATION_STATUSES.ASSIGNED,
    assignedModeratorId: moderatorId,
    assignedModeratorName: moderatorName,
    notes: ctx.notes,
    history,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'assign_moderator',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      moderatorId,
      metadata: { moderatorName, assignedBy: req?.userId, reassignment: (existing.history || []).some((h) => h.action === 'assign') },
    },
    req,
  );

  return updated;
}

export class DuplicateReportError extends Error {
  constructor() {
    super('You have already reported this within the last 24 hours');
    this.name = 'DuplicateReportError';
  }
}

export class SelfReportError extends Error {
  constructor() {
    super('You cannot report yourself');
    this.name = 'SelfReportError';
  }
}

const DUPLICATE_REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createReport(
  input: Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  req?: Request,
): ReportItem {
  if (input.reporterId && input.reporterId === input.resourceId) {
    throw new SelfReportError();
  }

  const recent = moderationStore
    .listReports({ resourceId: input.resourceId, resourceType: input.resourceType })
    .find((r) => {
      if (r.reporterId !== input.reporterId) return false;
      const age = Date.now() - new Date(r.createdAt).getTime();
      return age >= 0 && age < DUPLICATE_REPORT_WINDOW_MS;
    });
  if (recent) {
    throw new DuplicateReportError();
  }

  const report = moderationStore.createReport(input);
  recordReportCreated(report.id, report.resourceType, report.resourceId, report.category, req);
  return report;
}

export function assignReport(
  reportId: string,
  moderatorId: string,
  moderatorName?: string,
  req?: Request,
): ReportItem | null {
  const updated = moderationStore.updateReport(reportId, {
    assignedModeratorId: moderatorId,
    assignedModeratorName: moderatorName,
    status: REPORT_STATUSES.INVESTIGATING,
  });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'assign_report',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      moderatorId,
      metadata: { moderatorName, reportId },
    },
    req,
  );

  return updated;
}

export function addReportInternalNote(reportId: string, note: string, req?: Request): ReportItem | null {
  const existing = moderationStore.getReport(reportId);
  if (!existing) return null;
  const combined = existing.internalNotes ? `${existing.internalNotes}\n---\n${note}` : note;
  const updated = moderationStore.updateReport(reportId, { internalNotes: combined });
  if (!updated) return null;

  logModerationAudit(
    {
      action: 'report_internal_note',
      resource: updated.resourceType,
      resourceId: updated.resourceId,
      moderatorId: req?.userId,
      metadata: { reportId },
    },
    req,
  );

  return updated;
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

  const existing = moderationStore.getReport(reportId);
  if (!existing) return null;

  let linkedModerationItemId = existing.linkedModerationItemId;
  if (decision === MODERATION_DECISIONS.ESCALATE && !linkedModerationItemId) {
    const queue = QUEUE_BY_RESOURCE_TYPE[existing.resourceType];
    if (queue) {
      const item = queueItem({
        queue,
        resourceType: existing.resourceType,
        resourceId: existing.resourceId,
        resourceLabel: existing.resourceLabel,
        reason: ctx.reason,
        notes: existing.description,
      });
      linkedModerationItemId = item.id;
    }
  }

  const updated = moderationStore.updateReport(reportId, {
    status,
    resolution: decision,
    resolutionReason: ctx.reason,
    resolutionNote: ctx.notes,
    resolvedAt: new Date().toISOString(),
    resolvedBy: moderator.moderatorId,
    assignedModeratorId: existing.assignedModeratorId || moderator.moderatorId,
    linkedModerationItemId,
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
      metadata: { reportId, linkedModerationItemId },
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
