import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { buildNavAttention } from './navAttentionService';

export const navAttentionRouter = Router();

navAttentionRouter.get('/dashboard/nav-attention', authenticateRequest, async (req, res) => {
  const userId = req.userId || req.user?.uid || '';
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const payload = await buildNavAttention({
      userId,
      role: req.userRole || req.user?.role,
    });
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to load nav attention',
    });
  }
});
