import type { NextFunction, Request, Response } from 'express';
import { AUTH_ERROR_CODES, sendAuthError } from '../auth/authErrors';
import { hasPermission, hasRole } from '../permissions/authorization';
import { PERMISSIONS } from '../permissions/permissions';
import { ROLES } from '../permissions/roles';
import { sellerOwnsBrand } from '../catalog/brandOwnership';

function isSellerRole(role: string | undefined): boolean {
  if (!role) return false;
  const userRole = role as (typeof ROLES)[keyof typeof ROLES];
  return hasRole(userRole, ROLES.SELLER) || hasRole(userRole, ROLES.VERIFIED_SELLER);
}

/**
 * Brand Studio writes (PUT/PATCH /catalog/brands/:id):
 * - cms:edit → allow (platform CMS editors)
 * - seller / verified_seller → allow only when they own req.params.id
 * - otherwise → 403
 *
 * Does not grant cms:edit to sellers. Global CMS routes keep requireCmsWrite.
 */
export async function requireBrandStudioWrite(
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

  if (!isSellerRole(req.userRole) || !req.userId) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
    return;
  }

  const brandId = typeof req.params.id === 'string' ? req.params.id : '';
  // Create (POST /brands) has no :id — sellers may create; handler stamps sellerId.
  if (!brandId) {
    next();
    return;
  }

  try {
    const owns = await sellerOwnsBrand(req.userId, brandId);
    if (!owns) {
      sendAuthError(
        res,
        403,
        AUTH_ERROR_CODES.FORBIDDEN,
        'Not authorized to modify this brand',
      );
      return;
    }
    next();
  } catch {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions');
  }
}
