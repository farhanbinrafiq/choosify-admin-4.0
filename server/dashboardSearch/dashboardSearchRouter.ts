import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { searchDashboardForActor } from './dashboardSearchService';

export const dashboardSearchRouter = Router();

dashboardSearchRouter.get('/search', authenticateRequest, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    res.json({ success: true, query: q, groups: [], total: 0 });
    return;
  }

  const limitPerGroup = (() => {
    const raw = req.query.limitPerGroup;
    const n = typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n <= 0) return 5;
    return Math.min(10, Math.max(1, Math.floor(n)));
  })();

  try {
    const result = await searchDashboardForActor({
      actor: { userId: req.userId || '', role: req.userRole },
      q,
      limitPerGroup,
    });
    res.json({ success: true, query: q, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      query: q,
      error: error instanceof Error ? error.message : 'Search failed',
    });
  }
});

dashboardSearchRouter.get('/search/suggestions', authenticateRequest, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    res.json({ success: true, query: q, groups: [], total: 0 });
    return;
  }

  try {
    const result = await searchDashboardForActor({
      actor: { userId: req.userId || '', role: req.userRole },
      q,
      limitPerGroup: 3,
    });
    res.json({ success: true, query: q, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      query: q,
      error: error instanceof Error ? error.message : 'Search failed',
    });
  }
});

