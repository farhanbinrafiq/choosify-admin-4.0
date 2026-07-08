import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../lib/logger';

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.locals.requestStartedAt = startedAt;

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    res.locals.requestDurationMs = durationMs;

    Logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
