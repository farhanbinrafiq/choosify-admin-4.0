import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../lib/logger';
import { recordFailedAuthAttempt } from '../lib/abuseProtection';
import {
  AUTH_ERROR_CODES,
  isExpiredFirebaseTokenError,
  sendAuthError,
} from '../auth/authErrors';
import {
  getBearerToken,
  resolveAuthenticatedUser,
  verifyFirebaseToken,
} from '../auth/authProfile';

export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    recordFailedAuthAttempt(req.ip, req.originalUrl);
    sendAuthError(res, 401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Missing bearer token');
    return;
  }

  try {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Invalid token');
      return;
    }

    const user = await resolveAuthenticatedUser(decoded);
    if (!user) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'User is not authorized.');
      return;
    }

    req.user = user;
    req.userId = user.uid;
    req.userRole = user.role;
    req.permissions = user.permissions;

    next();
  } catch (error) {
    const expired = isExpiredFirebaseTokenError(error);
    Logger.warn('Authentication failed', {
      requestId: req.requestId,
      path: req.originalUrl,
      reason: expired ? AUTH_ERROR_CODES.EXPIRED_TOKEN : AUTH_ERROR_CODES.INVALID_TOKEN,
      message: error instanceof Error ? error.message : String(error),
    });

    sendAuthError(
      res,
      401,
      expired ? AUTH_ERROR_CODES.EXPIRED_TOKEN : AUTH_ERROR_CODES.INVALID_TOKEN,
      expired ? 'Expired token' : 'Invalid token',
    );
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      Logger.warn('Excessive failed authentication attempts', {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count,
      });
    }
  }
}
