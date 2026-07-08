import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../lib/logger';
import { readBytesEnv } from '../lib/env';

export const JSON_BODY_LIMIT = readBytesEnv('JSON_BODY_LIMIT', '1mb');
export const URLENCODED_BODY_LIMIT = readBytesEnv('URLENCODED_BODY_LIMIT', '1mb');
export const RAW_BODY_LIMIT = readBytesEnv('RAW_BODY_LIMIT', '256kb');

export function payloadTooLargeHandler(
  err: Error & { status?: number; type?: string },
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err.type !== 'entity.too.large') {
    next(err);
    return;
  }

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
