import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
