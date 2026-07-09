import { Router } from 'express';
import { success } from '../lib/apiResponse';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import {
  calculateSellerReputation,
  calculateTrustScore,
  getModerationSummary,
  listModerationQueue,
} from './moderationService';
import { isModerationQueueType, isModerationStatus } from './moderationQueue';
import type { ModerationQueueFilter } from './moderationTypes';

export const moderationRouter = Router();

const requireModerationAccess = [authenticateRequest, requireRole(ROLES.MODERATOR)];

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
