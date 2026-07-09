import { Router } from 'express';
import { recordHealthCheck } from '../lib/metrics';
import { getReadinessStatus } from '../lib/readiness';
import {
  getAppName,
  getAppVersion,
  getEnvironment,
  getMemoryUsageSummary,
  getNodeVersion,
} from '../lib/runtimeInfo';
import { success } from '../lib/apiResponse';
import { healthRateLimit } from '../middleware/rateLimit';

const startedAt = Date.now();

export const healthRouter = Router();

healthRouter.get('/health', healthRateLimit, (_req, res) => {
  recordHealthCheck();

  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: getEnvironment(),
    version: getAppVersion(),
    nodeVersion: getNodeVersion(),
    startedAt: new Date(startedAt).toISOString(),
    app: getAppName(),
    readiness: getReadinessStatus(),
    memory: getMemoryUsageSummary(),
  });
});
