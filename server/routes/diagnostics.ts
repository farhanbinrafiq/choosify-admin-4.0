import { Router } from 'express';
import { getAbuseProtectionSnapshot } from '../lib/abuseProtection';
import { getMetricsSnapshot } from '../lib/metrics';
import { getReadinessStatus, isApplicationReady } from '../lib/readiness';
import {
  getAppName,
  getAppVersion,
  getCpuUsageSummary,
  getEnvironment,
  getMemoryUsageSummary,
  getNodeVersion,
  getSystemSummary,
} from '../lib/runtimeInfo';
import { success } from '../lib/apiResponse';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { getRateLimitSummary } from '../middleware/rateLimit';
import { ROLES } from '../permissions/roles';

const startedAt = Date.now();

export const diagnosticsRouter = Router();

diagnosticsRouter.get(
  '/diagnostics',
  authenticateRequest,
  requireRole(ROLES.ADMIN),
  (_req, res) => {
    const metrics = getMetricsSnapshot();
    const readiness = getReadinessStatus();

    return success(res, {
      application: {
        name: getAppName(),
        version: getAppVersion(),
        environment: getEnvironment(),
        nodeVersion: getNodeVersion(),
        uptimeSeconds: Math.floor(process.uptime()),
        startedAt: new Date(startedAt).toISOString(),
      },
      runtime: {
        memory: getMemoryUsageSummary(),
        cpu: getCpuUsageSummary(),
        system: getSystemSummary(),
      },
      metrics,
      rateLimits: getRateLimitSummary(),
      health: {
        status: readiness === 'ready' ? 'ok' : 'starting',
        readiness,
        ready: isApplicationReady(),
        healthChecks: metrics.healthChecks,
      },
    });
  },
);
