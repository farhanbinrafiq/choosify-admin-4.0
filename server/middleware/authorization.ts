import type { NextFunction, Request, Response } from 'express';
import { AUTH_ERROR_CODES, sendAuthError } from '../auth/authErrors';
import { hasAllPermissions, hasAnyPermission, hasRole } from '../permissions/authorization';
import type { Permission } from '../permissions/permissions';
import type { UserRole } from '../permissions/roles';

export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    if (!hasRole(req.userRole, requiredRole)) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient role');
      return;
    }

    next();
  };
}

export function requireAnyPermission(requiredPermissions: readonly Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    if (!hasAnyPermission(req.userRole, requiredPermissions, req.permissions)) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
      return;
    }

    next();
  };
}

export function requireAllPermissions(requiredPermissions: readonly Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
      return;
    }

    if (!hasAllPermissions(req.userRole, requiredPermissions, req.permissions)) {
      sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
      return;
    }

    next();
  };
}
