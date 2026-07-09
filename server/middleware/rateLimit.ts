import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { readPositiveIntEnv } from '../lib/env';
import { Logger } from '../lib/logger';
import { recordSuspiciousRequest, getAbuseProtectionSnapshot } from '../lib/abuseProtection';

export type RateLimitPolicy =
  | 'health'
  | 'auth'
  | 'public'
  | 'catalogRead'
  | 'search'
  | 'messaging'
  | 'admin'
  | 'ai';

const WINDOW_MS = readPositiveIntEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

const POLICY_ENV_KEYS: Record<RateLimitPolicy, string> = {
  health: 'RATE_LIMIT_HEALTH_MAX',
  auth: 'RATE_LIMIT_AUTH_MAX',
  public: 'RATE_LIMIT_PUBLIC_MAX',
  catalogRead: 'RATE_LIMIT_CATALOG_READ_MAX',
  search: 'RATE_LIMIT_SEARCH_MAX',
  messaging: 'RATE_LIMIT_MESSAGING_MAX',
  admin: 'RATE_LIMIT_ADMIN_MAX',
  ai: 'RATE_LIMIT_AI_MAX',
};

const POLICY_DEFAULTS: Record<RateLimitPolicy, number> = {
  health: 120,
  auth: 20,
  public: 300,
  catalogRead: 600,
  search: 120,
  messaging: 100,
  admin: 200,
  ai: 60,
};

function createPolicyLimiter(policy: RateLimitPolicy) {
  const max = readPositiveIntEnv(POLICY_ENV_KEYS[policy], POLICY_DEFAULTS[policy]);

  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    handler: (req, res, _next, options) => {
      const ip = req.ip;
      const abuse = recordSuspiciousRequest(ip, req.originalUrl);
      Logger.warn('Rate limit exceeded', {
        requestId: req.requestId,
        policy,
        ip,
        path: req.originalUrl,
        method: req.method,
        abuseCount: abuse.count,
      });
      res.status(options.statusCode).json(options.message);
    },
  });
}

export const healthRateLimit = createPolicyLimiter('health');
export const authRateLimit = createPolicyLimiter('auth');
export const publicApiRateLimit = createPolicyLimiter('public');
export const catalogReadRateLimit = createPolicyLimiter('catalogRead');
export const searchRateLimit = createPolicyLimiter('search');
export const messagingRateLimit = createPolicyLimiter('messaging');
export const adminRateLimit = createPolicyLimiter('admin');
export const aiRateLimit = createPolicyLimiter('ai');

export function getRateLimitSummary() {
  const policies = Object.entries(POLICY_ENV_KEYS).map(([policy, envKey]) => ({
    policy,
    envKey,
    max: readPositiveIntEnv(envKey, POLICY_DEFAULTS[policy as RateLimitPolicy]),
    windowMs: WINDOW_MS,
  }));

  return {
    windowMs: WINDOW_MS,
    policies,
    abuseProtection: getAbuseProtectionSnapshot(),
  };
}

export function catalogReadRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET') {
    return catalogReadRateLimit(req, res, next);
  }
  return next();
}

export function searchRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (req.method === 'GET' && query.length > 0) {
    return searchRateLimit(req, res, next);
  }
  return next();
}
