import { Router, type Request } from 'express';
import { created, success } from '../lib/apiResponse';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import {
  archiveNotification,
  bulkArchive,
  bulkRead,
  createNotification,
  deleteNotification,
  dismissNotification,
  getNotificationCenterSummary,
  listNotifications,
  markRead,
  markUnread,
  updateNotification,
} from './notificationService';
import { getPreferences, updatePreferences } from './preferenceService';
import {
  createBroadcast,
  getBroadcast,
  listBroadcasts,
  sendBroadcast,
  updateBroadcast,
} from './broadcastService';
import { getCommunicationPlatformStatus } from './communicationService';
import type { NotificationCenterFilter } from './communicationTypes';

export const communicationRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

function parseBool(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function resolveUserId(req: Request): string | null {
  return req.userId || req.user?.uid || null;
}

function buildFilter(req: Request, userId?: string): NotificationCenterFilter {
  return {
    userId,
    read: parseBool(req.query.read),
    archived: parseBool(req.query.archived),
    dismissed: parseBool(req.query.dismissed),
    pinned: parseBool(req.query.pinned),
    priority:
      typeof req.query.priority === 'string'
        ? (req.query.priority as NotificationCenterFilter['priority'])
        : undefined,
    category:
      typeof req.query.category === 'string'
        ? (req.query.category as NotificationCenterFilter['category'])
        : undefined,
    type:
      typeof req.query.type === 'string'
        ? (req.query.type as NotificationCenterFilter['type'])
        : undefined,
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    limit: parseNumber(req.query.limit),
    offset: parseNumber(req.query.offset),
  };
}

// User APIs
communicationRouter.get('/notifications', ...requireAuth, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const filter = buildFilter(req, userId);
  const items = listNotifications(filter);
  return success(res, {
    items,
    summary: getNotificationCenterSummary(userId),
    filter,
  });
});

communicationRouter.get('/notifications/preferences', ...requireAuth, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  return success(res, getPreferences(userId));
});

communicationRouter.put('/notifications/preferences', ...requireAuth, (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
  return success(res, updatePreferences(userId, req.body || {}, req));
});

communicationRouter.post('/notifications/read', ...requireAuth, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
  if (ids.length === 0) return res.status(400).json({ success: false, error: 'ids array is required' });
  return success(res, bulkRead(ids, req));
});

communicationRouter.post('/notifications/archive', ...requireAuth, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
  if (ids.length === 0) return res.status(400).json({ success: false, error: 'ids array is required' });
  return success(res, bulkArchive(ids));
});

communicationRouter.patch('/notifications/:id/read', ...requireAuth, (req, res) => {
  const updated = markRead(req.params.id, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
  return success(res, updated);
});

communicationRouter.patch('/notifications/:id/unread', ...requireAuth, (req, res) => {
  const updated = markUnread(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
  return success(res, updated);
});

communicationRouter.patch('/notifications/:id/dismiss', ...requireAuth, (req, res) => {
  const updated = dismissNotification(req.params.id, req);
  if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
  return success(res, updated);
});

communicationRouter.patch('/notifications/:id/archive', ...requireAuth, (req, res) => {
  const updated = archiveNotification(req.params.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
  return success(res, updated);
});

communicationRouter.delete('/notifications/:id', ...requireAuth, (req, res) => {
  const deleted = deleteNotification(req.params.id, req);
  if (!deleted) return res.status(404).json({ success: false, error: 'Notification not found' });
  return success(res, { deleted: true });
});

// Admin APIs
communicationRouter.get('/admin/notifications', ...requireAdmin, (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const filter = buildFilter(req, userId);
  if (!filter.limit) filter.limit = 50;
  if (filter.offset === undefined) filter.offset = 0;
  return success(res, { items: listNotifications(filter), filter });
});

communicationRouter.post('/admin/notifications', ...requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (!body.userId || !body.title || !body.type || !body.category) {
    return res.status(400).json({ success: false, error: 'userId, title, type, and category are required' });
  }
  const notification = await createNotification(body, req);
  return created(res, notification);
});

communicationRouter.get('/admin/broadcasts', ...requireAdmin, (_req, res) => {
  return success(res, { items: listBroadcasts() });
});

communicationRouter.post('/admin/broadcasts', ...requireAdmin, async (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.body || !body.broadcastType) {
    return res.status(400).json({ success: false, error: 'title, body, and broadcastType are required' });
  }
  const broadcast = await createBroadcast(
    {
      ...body,
      createdBy: req.userId || req.user?.uid || 'admin',
    },
    req,
  );
  return created(res, broadcast);
});

communicationRouter.post('/admin/broadcasts/:id/send', ...requireAdmin, async (req, res) => {
  const broadcast = await sendBroadcast(req.params.id, req);
  if (!broadcast) return res.status(404).json({ success: false, error: 'Broadcast not found' });
  return success(res, broadcast);
});

communicationRouter.patch('/admin/broadcasts/:id', ...requireAdmin, (req, res) => {
  const updated = updateBroadcast(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'Broadcast not found' });
  return success(res, updated);
});

communicationRouter.get('/admin/broadcasts/:id', ...requireAdmin, (req, res) => {
  const broadcast = getBroadcast(req.params.id);
  if (!broadcast) return res.status(404).json({ success: false, error: 'Broadcast not found' });
  return success(res, broadcast);
});

communicationRouter.get('/admin/communication', ...requireAdmin, (_req, res) => {
  return success(res, getCommunicationPlatformStatus());
});
