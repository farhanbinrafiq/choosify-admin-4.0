import type { NextFunction, Request, Response } from 'express';
import { recordFailedAuthAttempt } from '../lib/abuseProtection';
import { operationalEvents } from '../logging/operationalEvents';
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
import { isExpiredJwtError } from '../auth/jwtTokens';
import { getUserProfileExtras } from '../auth/userProfileExtras';
import { getImpersonationSession, cleanupExpiredImpersonations } from '../impersonation/impersonationStore';

/** Paths allowed while changeNextLogin is true (relative to /api/v1 mount or full originalUrl). */
function isPasswordChangeAllowlisted(req: Request): boolean {
  const raw = `${req.originalUrl || ''} ${req.path || ''}`.toLowerCase();
  return (
    raw.includes('/auth/me') ||
    raw.includes('/auth/change-password') ||
    raw.includes('/auth/logout') ||
    raw.includes('/auth/refresh')
  );
}

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

    // Preserve admin identity for audit/troubleshooting while using
    // effective actor (target account) for all RBAC checks.
    if (decoded.impersonation?.sessionId) {
      cleanupExpiredImpersonations();
      const sess = getImpersonationSession(decoded.impersonation.sessionId);
      if (!sess || sess.endedAt) {
        sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Impersonation session ended');
        return;
      }
      if (new Date(sess.expiresAt).getTime() <= Date.now()) {
        sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Impersonation session expired');
        return;
      }

      // For all RBAC checks, req.userId/req.userRole remain the effective actor
      // (target account). The real admin is preserved separately.
      req.impersonationSessionId = decoded.impersonation.sessionId;
      req.realActorUserId = decoded.impersonation.realActorUid;
      req.realActorRole = decoded.impersonation.realActorRole;
    }

    const extras = getUserProfileExtras(user.uid);
    const mustChange = extras?.changeNextLogin === true;
    (req as Request & { changeNextLogin?: boolean }).changeNextLogin = mustChange;

    if (mustChange && !isPasswordChangeAllowlisted(req)) {
      res.status(403).json({
        success: false,
        error: 'Password change required before continuing',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
      return;
    }

    next();
  } catch (error) {
    const expired = isExpiredFirebaseTokenError(error) || isExpiredJwtError(error);
    const reason = expired ? AUTH_ERROR_CODES.EXPIRED_TOKEN : AUTH_ERROR_CODES.INVALID_TOKEN;

    operationalEvents.authenticationFailure({
      requestId: req.requestId,
      path: req.originalUrl,
      message: error instanceof Error ? error.message : String(error),
      metadata: { reason },
    });

    sendAuthError(
      res,
      401,
      reason,
      expired ? 'Expired token' : 'Invalid token',
    );
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      operationalEvents.securityWarning('Excessive failed authentication attempts', {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count,
      });
    }
  }
}

/**
 * Attach user when a valid bearer is present; otherwise continue anonymously.
 * Used for catalog list scoping (seller workspace vs public marketplace).
 */
export async function softAuthenticateRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) {
      next();
      return;
    }
    const user = await resolveAuthenticatedUser(decoded);
    if (!user) {
      next();
      return;
    }
    req.user = user;
    req.userId = user.uid;
    req.userRole = user.role;
    req.permissions = user.permissions;
  } catch {
    // ignore — treat as anonymous
  }
  next();
}
