import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../lib/logger';

type HttpError = Error & {
  status?: number;
  statusCode?: number;
  details?: unknown;
};

export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  Logger.error('Request failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });

  if (res.headersSent) {
    return;
  }

  res.status(status).json({
    success: false,
    error: status >= 500 && isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error',
    requestId: req.requestId,
    ...(err.details !== undefined ? { details: err.details } : {}),
    ...(!isProduction && err.stack ? { stack: err.stack } : {}),
  });
}
