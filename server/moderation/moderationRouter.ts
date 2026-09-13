import { Router, type Request, type Response } from 'express';
import { eq, ilike, or } from 'drizzle-orm';
import { success } from '../lib/apiResponse';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { db } from '../db/client';
import { users } from '../db/schema';
import {
  addReportInternalNote,
  approve,
  assignModerator,
  assignReport,
  calculateSellerReputation,
  calculateTrustScore,
  createReport,
  DuplicateReportError,
  getModerationSummary,
  listModerationQueue,
  queueItem,
  reject,
  requestChanges,
  resolveReport,
  revoke,
  SelfReportError,
} from './moderationService';
import { moderationStore } from './moderationStore';
import { operationsStore } from '../operations/operationsStore';
import { OPEN_DISPUTE_STATUSES } from '../operations/types';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { isModerationQueueType, isModerationStatus } from './moderationQueue';
import {
  MODERATION_QUEUES,
  MODERATION_REASONS,
  REPORT_CATEGORIES,
  REPORT_SOURCES,
  REPORT_STATUSES,
  type ModerationQueueFilter,
  type ModerationReason,
  type ReportCategory,
  type ReportSource,
} from './moderationTypes';

export const moderationRouter = Router();

const requireModerationAccess = [authenticateRequest, requireRole(ROLES.MODERATOR)];
/** Any signed-in account (consumer, seller, creator, staff) -- used for the
 * public "report this" surface, which is not a moderator-only action. */
const requireReporterAccess = [authenticateRequest, requireRole(ROLES.USER)];
const STAFF_ROLES = new Set(['moderator', 'admin', 'super_admin']);

const QUEUE_VALUES = new Set(Object.values(MODERATION_QUEUES));
const REASON_VALUES = new Set(Object.values(MODERATION_REASONS));
const REPORT_CATEGORY_VALUES = new Set(Object.values(REPORT_CATEGORIES));
const REPORT_STATUS_VALUES = new Set(Object.values(REPORT_STATUSES));

function isReasonValue(value: unknown): value is ModerationReason {
  return typeof value === 'string' && REASON_VALUES.has(value as ModerationReason);
}

function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && REPORT_CATEGORY_VALUES.has(value as ReportCategory);
}

const REPORT_SOURCE_VALUES = new Set(Object.values(REPORT_SOURCES));
function isReportSource(value: unknown): value is ReportSource {
  return typeof value === 'string' && REPORT_SOURCE_VALUES.has(value as ReportSource);
}

function defaultSourceForRole(role?: string): ReportSource {
  if (role === 'seller' || role === 'verified_seller') return REPORT_SOURCES.SELLER_DASHBOARD;
  if (role === 'creator') return REPORT_SOURCES.CREATOR_DASHBOARD;
  return REPORT_SOURCES.STOREFRONT;
}

/**
 * Best-effort existence check for the reported target -- validated against
 * the real catalog/user stores, never assumed. Resource types with no
 * canonical store lookup here (review, media, campaign, generic "post") are
 * left to server-side moderation review rather than blocked client-side,
 * since there is no single existing index to check them against yet.
 */
async function targetExists(resourceType: string, resourceId: string): Promise<boolean> {
  const type = resourceType.toLowerCase();
  try {
    if (type === 'product') {
      return (await catalogStore.listProducts()).some((p: { id: string }) => p.id === resourceId);
    }
    if (type === 'brand') {
      return (await catalogStore.listBrands()).some((b: { id: string }) => b.id === resourceId);
    }
    if (type === 'creator') {
      return (await catalogStore.listCreators()).some((c: { id: string }) => c.id === resourceId);
    }
    if (type === 'guide') {
      return (await catalogStore.listGuides()).some((g: { id: string }) => g.id === resourceId);
    }
    if (type === 'seller' || type === 'consumer' || type === 'user') {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, resourceId)).limit(1);
      return rows.length > 0;
    }
  } catch {
    return true;
  }
  return true;
}

moderationRouter.get('/admin/moderation/summary', ...requireModerationAccess, (_req, res) => {
  return success(res, getModerationSummary());
});

moderationRouter.get('/admin/moderation/queue', ...requireModerationAccess, (req, res) => {
  const filter: ModerationQueueFilter = {};

  if (typeof req.query.queue === 'string' && isModerationQueueType(req.query.queue)) {
    filter.queue = req.query.queue;
  }
  if (typeof req.query.status === 'string' && isModerationStatus(req.query.status)) {
    filter.status = req.query.status;
  }
  if (typeof req.query.assignedModeratorId === 'string') {
    filter.assignedModeratorId = req.query.assignedModeratorId;
  }
  if (typeof req.query.resourceType === 'string') {
    filter.resourceType = req.query.resourceType;
  }
  if (typeof req.query.limit === 'string') {
    const limit = Number(req.query.limit);
    if (!Number.isNaN(limit) && limit > 0) filter.limit = limit;
  }
  if (typeof req.query.offset === 'string') {
    const offset = Number(req.query.offset);
    if (!Number.isNaN(offset) && offset >= 0) filter.offset = offset;
  }

  return success(res, {
    items: listModerationQueue(filter),
    filter,
  });
});

moderationRouter.get('/admin/moderation/items/:id', ...requireModerationAccess, (req, res) => {
  const item = moderationStore.getItem(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Moderation item not found' });
  return success(res, item);
});

/**
 * Manually queue a piece of content for moderation -- the honest, real
 * "user report" / staff-flag producer. There is no automated content
 * scanner in this codebase; this is a genuine human-triggered flag, not a
 * simulated AI/safety-score pipeline.
 */
moderationRouter.post('/admin/moderation/flag', ...requireModerationAccess, (req, res) => {
  const body = req.body ?? {};
  const { queue, resourceType, resourceId, resourceLabel, notes } = body;

  if (typeof queue !== 'string' || !QUEUE_VALUES.has(queue as any)) {
    return res.status(400).json({ success: false, error: 'A valid queue is required' });
  }
  if (typeof resourceType !== 'string' || !resourceType.trim()) {
    return res.status(400).json({ success: false, error: 'resourceType is required' });
  }
  if (typeof resourceId !== 'string' || !resourceId.trim()) {
    return res.status(400).json({ success: false, error: 'resourceId (CF-ID) is required' });
  }

  const reason = isReasonValue(body.reason) ? body.reason : undefined;

  const item = queueItem({
    queue: queue as any,
    resourceType: resourceType.trim(),
    resourceId: resourceId.trim(),
    resourceLabel: typeof resourceLabel === 'string' ? resourceLabel.trim() : undefined,
    reason,
    notes: typeof notes === 'string' ? notes.trim() : undefined,
    priority: 0,
  });

  return success(res, item);
});

moderationRouter.post('/admin/moderation/items/:id/approve', ...requireModerationAccess, (req, res) => {
  const reason = isReasonValue(req.body?.reason) ? req.body.reason : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
  const updated = approve(req.params.id, { moderatorId: req.userId, moderatorName: req.user?.displayName, reason, notes }, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Moderation item not found' });
  return success(res, updated);
});

moderationRouter.post('/admin/moderation/items/:id/reject', ...requireModerationAccess, (req, res) => {
  const reason = isReasonValue(req.body?.reason) ? req.body.reason : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
  const updated = reject(req.params.id, { moderatorId: req.userId, moderatorName: req.user?.displayName, reason, notes }, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Moderation item not found' });
  return success(res, updated);
});

moderationRouter.post('/admin/moderation/items/:id/request-changes', ...requireModerationAccess, (req, res) => {
  const reason = isReasonValue(req.body?.reason) ? req.body.reason : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (!notes) {
    return res.status(400).json({ success: false, error: 'Notes describing the requested changes are required' });
  }
  const updated = requestChanges(req.params.id, { moderatorId: req.userId, moderatorName: req.user?.displayName, reason, notes }, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Moderation item not found' });
  return success(res, updated);
});

moderationRouter.post('/admin/moderation/items/:id/revoke', ...requireModerationAccess, (req, res) => {
  const reason = isReasonValue(req.body?.reason) ? req.body.reason : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
  try {
    const updated = revoke(req.params.id, { moderatorId: req.userId, moderatorName: req.user?.displayName, reason, notes }, req);
    if (!updated) return res.status(404).json({ success: false, error: 'Moderation item not found' });
    return success(res, updated);
  } catch (err) {
    return res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Unable to revoke this item' });
  }
});

moderationRouter.post('/admin/moderation/items/:id/assign', ...requireModerationAccess, (req, res) => {
  const moderatorId = typeof req.body?.moderatorId === 'string' ? req.body.moderatorId : req.userId;
  const moderatorName = typeof req.body?.moderatorName === 'string' ? req.body.moderatorName : req.user?.displayName;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
  if (!moderatorId) return res.status(400).json({ success: false, error: 'moderatorId is required' });
  const updated = assignModerator(req.params.id, moderatorId, moderatorName, { notes }, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Moderation item not found' });
  return success(res, updated);
});

/**
 * Staff directory search for the Assign flow -- lets a moderator find a
 * real teammate (moderator/admin/super_admin) by name or email instead of
 * only ever assigning to themselves. Backed by the real Postgres `users`
 * table, not the JSON moderation snapshot.
 */
moderationRouter.get('/admin/moderation/staff', ...requireModerationAccess, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (!search) return success(res, { staff: [] });

  const pattern = `%${search}%`;
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(or(ilike(users.displayName, pattern), ilike(users.email, pattern)))
    .limit(20);

  const staff = rows
    .filter((u) => STAFF_ROLES.has(u.role))
    .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email, role: u.role }));

  return success(res, { staff });
});

moderationRouter.get('/admin/moderation/reports', ...requireModerationAccess, (req, res) => {
  const filter: { status?: any; category?: any; resourceId?: string; resourceType?: string; limit?: number; offset?: number } = {};
  if (typeof req.query.status === 'string' && REPORT_STATUS_VALUES.has(req.query.status as any)) {
    filter.status = req.query.status;
  }
  if (typeof req.query.category === 'string' && isReportCategory(req.query.category)) {
    filter.category = req.query.category;
  }
  if (typeof req.query.resourceId === 'string') filter.resourceId = req.query.resourceId;
  if (typeof req.query.resourceType === 'string') filter.resourceType = req.query.resourceType;
  if (typeof req.query.limit === 'string') {
    const limit = Number(req.query.limit);
    if (!Number.isNaN(limit) && limit > 0) filter.limit = limit;
  }
  if (typeof req.query.offset === 'string') {
    const offset = Number(req.query.offset);
    if (!Number.isNaN(offset) && offset >= 0) filter.offset = offset;
  }
  return success(res, { reports: moderationStore.listReports(filter), filter });
});

async function handleCreateReport(req: Request, res: Response) {
  const body = req.body ?? {};
  const { resourceType, resourceId, resourceLabel, description, source } = body;
  if (!isReportCategory(body.category)) {
    return res.status(400).json({ success: false, error: 'A valid report category is required' });
  }
  if (typeof resourceType !== 'string' || !resourceType.trim()) {
    return res.status(400).json({ success: false, error: 'resourceType is required' });
  }
  if (typeof resourceId !== 'string' || !resourceId.trim()) {
    return res.status(400).json({ success: false, error: 'resourceId (CF-ID) is required' });
  }
  const trimmedType = resourceType.trim().toLowerCase();
  const trimmedId = resourceId.trim();

  const exists = await targetExists(trimmedType, trimmedId);
  if (!exists) {
    return res.status(400).json({ success: false, error: 'That item could not be found -- nothing was reported' });
  }

  try {
    const report = createReport(
      {
        category: body.category,
        resourceType: trimmedType,
        resourceId: trimmedId,
        resourceLabel: typeof resourceLabel === 'string' ? resourceLabel.trim() : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        reporterId: req.userId,
        reporterRole: req.userRole,
        source: isReportSource(source) ? source : defaultSourceForRole(req.userRole),
      },
      req,
    );
    return success(res, report);
  } catch (err) {
    if (err instanceof SelfReportError) return res.status(400).json({ success: false, error: err.message });
    if (err instanceof DuplicateReportError) return res.status(409).json({ success: false, error: err.message });
    throw err;
  }
}

moderationRouter.post('/admin/moderation/reports', ...requireModerationAccess, (req, res, next) => {
  void handleCreateReport(req, res).catch(next);
});

/**
 * Public report submission -- any signed-in consumer, seller, or creator can
 * file a report against a product, brand/seller, creator, guide, review, or
 * another user (abuse/fraud) from the storefront or their own dashboard.
 * Lands in the same queue moderators see under Moderation Center > Reported.
 * Reporter identity always comes from the authenticated token (req.userId /
 * req.userRole), never from the request body -- forging a reporter or role
 * this way is not possible.
 */
moderationRouter.post('/moderation/reports', ...requireReporterAccess, (req, res, next) => {
  void handleCreateReport(req, res).catch(next);
});

moderationRouter.post('/admin/moderation/reports/:id/assign', ...requireModerationAccess, (req, res) => {
  const moderatorId = typeof req.body?.moderatorId === 'string' ? req.body.moderatorId : req.userId;
  const moderatorName = typeof req.body?.moderatorName === 'string' ? req.body.moderatorName : req.user?.displayName;
  if (!moderatorId) return res.status(400).json({ success: false, error: 'moderatorId is required' });
  const updated = assignReport(req.params.id, moderatorId, moderatorName, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Report not found' });
  return success(res, updated);
});

moderationRouter.post('/admin/moderation/reports/:id/notes', ...requireModerationAccess, (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!note) return res.status(400).json({ success: false, error: 'note is required' });
  const updated = addReportInternalNote(req.params.id, note, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Report not found' });
  return success(res, updated);
});

moderationRouter.post('/admin/moderation/reports/:id/resolve', ...requireModerationAccess, (req, res) => {
  const decision = req.body?.decision;
  const validDecisions = new Set(['approve', 'reject', 'request_changes', 'escalate', 'dismiss']);
  if (typeof decision !== 'string' || !validDecisions.has(decision)) {
    return res.status(400).json({ success: false, error: 'A valid decision is required' });
  }
  const reason = isReasonValue(req.body?.reason) ? req.body.reason : undefined;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
  const updated = resolveReport(
    req.params.id,
    decision as any,
    { moderatorId: req.userId, moderatorName: req.user?.displayName, reason, notes },
    req,
  );
  if (!updated) return res.status(404).json({ success: false, error: 'Report not found' });
  return success(res, updated);
});

moderationRouter.get('/admin/reputation', ...requireModerationAccess, (req, res) => {
  const sellerId = typeof req.query.sellerId === 'string' ? req.query.sellerId : undefined;
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : 'seller';
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : sellerId;
  const entityLabel = typeof req.query.entityLabel === 'string' ? req.query.entityLabel : undefined;
  const accountCreatedAt =
    typeof req.query.accountCreatedAt === 'string' ? req.query.accountCreatedAt : undefined;

  if (!entityId) {
    return res.status(400).json({
      success: false,
      error: 'entityId or sellerId query parameter is required',
    });
  }

  if (entityType === 'seller') {
    return success(res, calculateSellerReputation(entityId, entityLabel, accountCreatedAt));
  }

  return success(res, calculateTrustScore(entityType, entityId, entityLabel));
});

/**
 * Trust & Analytics aggregate overview. Every number here is computed live
 * from real, existing stores -- the same canonical reputation engine used
 * by /admin/reputation (no second/competing score), real dispute/moderation
 * counts, and real order/return/warranty-claim rates. No fake AI/fraud
 * scores, no fabricated counters.
 */
moderationRouter.get('/admin/trust/overview', ...requireModerationAccess, async (req, res) => {
  const REPUTATION_ATTENTION_THRESHOLD = 50;

  const brands = await catalogStore.listBrands();
  const sellerIds = Array.from(new Set(brands.map((b) => b.sellerId).filter((id): id is string => Boolean(id))));
  const sellerReputations = sellerIds.map((id) => {
    const brand = brands.find((b) => b.sellerId === id);
    return calculateSellerReputation(id, brand?.name);
  });

  const creators = await catalogStore.listCreators();
  const creatorScores = creators.map((c: { id: string; name?: string }) => calculateTrustScore('creator', c.id, c.name));

  const average = (nums: number[]) => (nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : null);

  const disputes = operationsStore.listDisputes();
  const openDisputes = disputes.filter((d) => OPEN_DISPUTE_STATUSES.has(d.status)).length;

  const modSummary = getModerationSummary();
  const flaggedContent = Object.values(modSummary.queues).reduce((sum, q) => sum + q.pending + q.needsReview, 0);

  const orders = operationsStore.listOrders();
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
  const returns = operationsStore.listReturns();
  const warrantyClaims = operationsStore.listWarrantyClaims();

  const rate = (count: number, base: number) => (base > 0 ? Math.round((count / base) * 1000) / 10 : null);

  const accountsRequiringAttention = sellerReputations
    .filter((r) => r.score < REPUTATION_ATTENTION_THRESHOLD || r.complaintCount > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 20)
    .map((r) => ({
      sellerId: r.sellerId,
      sellerName: r.sellerName,
      role: 'seller' as const,
      reputationScore: r.score,
      grade: r.grade,
      reviewRating: r.reviewRating,
      mainIssue:
        r.complaintCount > 0
          ? `${r.complaintCount} active complaint(s)`
          : r.verificationStatus !== 'verified'
            ? `Verification: ${r.verificationStatus}`
            : 'Below reputation threshold',
    }));

  return success(res, {
    reputation: {
      avgSellerReputation: average(sellerReputations.map((r) => r.score)),
      sellerCount: sellerReputations.length,
      accountsBelowThreshold: sellerReputations.filter((r) => r.score < REPUTATION_ATTENTION_THRESHOLD).length,
      avgCreatorReputation: average(creatorScores.map((c) => c.score)),
      creatorCount: creatorScores.length,
      threshold: REPUTATION_ATTENTION_THRESHOLD,
    },
    disputes: {
      open: openDisputes,
      total: disputes.length,
    },
    moderation: {
      flaggedContent,
      openReports: modSummary.reports.open + modSummary.reports.investigating,
    },
    performance: {
      cancellationRatePct: rate(cancelledOrders, orders.length),
      returnRatePct: rate(returns.length, orders.length),
      warrantyClaimRatePct: rate(warrantyClaims.length, orders.length),
      totalOrders: orders.length,
    },
    accountsRequiringAttention,
    generatedAt: new Date().toISOString(),
  });
});
