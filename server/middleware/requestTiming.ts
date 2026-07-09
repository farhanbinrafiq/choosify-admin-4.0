import type { NextFunction, Request, Response } from 'express';
import { recordRequestMetrics } from '../lib/metrics';
import { getEnvironment } from '../lib/runtimeInfo';
import { Logger } from '../lib/logger';

function getClientIp(req: Request): string | undefined {
  return req.ip;
}

function getUserAgent(req: Request): string | undefined {
  return req.get('user-agent') || undefined;
}

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.locals.requestStartedAt = startedAt;

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    res.locals.requestDurationMs = durationMs;

    recordRequestMetrics({
      statusCode: res.statusCode,
      durationMs,
      authenticated: Boolean(req.userId || req.user?.uid),
    });

    Logger.info('HTTP request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      environment: getEnvironment(),
    });
  });

  next();
}
