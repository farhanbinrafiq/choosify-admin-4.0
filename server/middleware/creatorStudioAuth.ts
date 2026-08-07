import type { NextFunction, Request, Response } from 'express';
import { AUTH_ERROR_CODES, sendAuthError } from '../auth/authErrors';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { hasPermission, hasRole } from '../permissions/authorization';
import { PERMISSIONS } from '../permissions/permissions';
import { ROLES } from '../permissions/roles';

function isCreatorRole(role: string | undefined): boolean {
  if (!role) return false;
  return hasRole(role as (typeof ROLES)[keyof typeof ROLES], ROLES.CREATOR);
}

/**
 * Creator Studio writes: cms:edit OR owning creator (CatalogCreator.userId).
 */
export async function requireCreatorStudioWrite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userRole) {
    sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    return;
  }

  if (hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    next();
    return;
  }

  if (!isCreatorRole(req.userRole) || !req.userId) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
    return;
  }

  const creatorId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!creatorId) {
    next();
    return;
  }

  try {
    const creator = await catalogStore.getCreator(creatorId);
    if (!creator || creator.userId !== req.userId) {
      sendAuthError(
        res,
        403,
        AUTH_ERROR_CODES.FORBIDDEN,
        'Not authorized to modify this creator profile',
      );
      return;
    }
    next();
  } catch {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
  }
}
