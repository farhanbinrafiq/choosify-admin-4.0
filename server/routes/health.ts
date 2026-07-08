import { Router } from 'express';
import { success } from '../lib/apiResponse';
import { healthRateLimit } from '../middleware/rateLimit';

const startedAt = Date.now();

export const healthRouter = Router();

healthRouter.get('/health', healthRateLimit, (_req, res) => {
  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || process.env.npm_package_version || '0.0.0',
    startedAt: new Date(startedAt).toISOString(),
    app: process.env.APP_NAME || 'choosify-admin',
  });
});
