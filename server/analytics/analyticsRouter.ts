import { Router } from 'express';
import { ANALYTICS_EVENTS, isAnalyticsEventType } from './analyticsEvents';
import { batchRecord, getTrending, recordEvent, summarize } from './analyticsService';
import { getAnalyticsStorageStatus } from './analyticsStorage';
import { recordCompare, recordWishlist } from './eventHooks';
import type { AnalyticsEventInput } from './analyticsTypes';

export const analyticsRouter = Router();

analyticsRouter.post('/analytics/events', async (req, res) => {
  try {
    const body = req.body as Partial<AnalyticsEventInput>;
    if (!isAnalyticsEventType(body.type)) {
      res.status(400).json({ error: 'Unsupported analytics event type' });
      return;
    }

    const event = await recordEvent({
      ...body,
      type: body.type,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
      userId: body.userId || req.userId || req.user?.uid,
    });

    res.status(202).json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid analytics event' });
  }
});

analyticsRouter.post('/analytics/events/batch', async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? (req.body.events as Partial<AnalyticsEventInput>[]) : [];
    if (events.length === 0) {
      res.status(400).json({ error: 'events array is required' });
      return;
    }

    const normalized = events.map((event) => {
      if (!isAnalyticsEventType(event.type)) {
        throw new Error(`Unsupported analytics event type: ${String(event.type)}`);
      }

      return {
        ...event,
        type: event.type,
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
        userId: event.userId || req.userId || req.user?.uid,
      };
    });

    const saved = await batchRecord(normalized);
    res.status(202).json({ success: true, count: saved.length });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid analytics batch' });
  }
});

analyticsRouter.post('/analytics/hooks/wishlist', (req, res) => {
  recordWishlist(req, req.body || {});
  res.status(202).json({ success: true });
});

analyticsRouter.post('/analytics/hooks/compare', (req, res) => {
  recordCompare(req, req.body || {});
  res.status(202).json({ success: true });
});

analyticsRouter.get('/analytics/summary', async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({ data: await summarize(range, from, to) });
});

analyticsRouter.get('/analytics/trending', async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({ data: await getTrending(range, from, to) });
});

analyticsRouter.get('/analytics/events/types', (_req, res) => {
  res.json({ data: ANALYTICS_EVENTS });
});

analyticsRouter.get('/analytics/storage', (_req, res) => {
  res.json({ data: getAnalyticsStorageStatus() });
});

analyticsRouter.get('/admin/analytics', async (req, res) => {
  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  res.json({
    data: {
      summary: await summarize(range),
      trending: await getTrending(range),
      storage: getAnalyticsStorageStatus(),
    },
  });
});
