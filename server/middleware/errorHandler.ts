import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../lib/logger';

type HttpError = Error & {
  status?: number;
  statusCode?: number;
  details?: unknown;
  type?: string;
};

export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err.type === 'entity.too.large') {
    payloadTooLarge(err, req, res, next);
    return;
  }

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

function payloadTooLarge(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  Logger.warn('Payload too large', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message,
  });

  if (res.headersSent) {
    return;
  }

  res.status(413).json({
    success: false,
    error: 'Request payload too large',
    code: 'PAYLOAD_TOO_LARGE',
    requestId: req.requestId,
  });
}