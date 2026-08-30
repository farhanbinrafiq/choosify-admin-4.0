import type { NextFunction, Request, Response } from 'express';
import { AUTH_ERROR_CODES, sendAuthError } from '../auth/authErrors';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { hasPermission, hasRole } from '../permissions/authorization';
import { PERMISSIONS } from '../permissions/permissions';
import { ROLES } from '../permissions/roles';
import { sellerOwnsBrand } from '../catalog/brandOwnership';
import type { CatalogGuide } from '../../lib/vercel-catalog/catalogEditorialTypes';

function isCreatorRole(role: string | undefined): boolean {
  if (!role) return false;
  return hasRole(role as (typeof ROLES)[keyof typeof ROLES], ROLES.CREATOR);
}

function isSellerRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role as (typeof ROLES)[keyof typeof ROLES];
  return hasRole(r, ROLES.SELLER) || hasRole(r, ROLES.VERIFIED_SELLER);
}

/** A brand-authored guide is "owned" by whoever owns/administers its publisher brand. */
export async function userOwnsGuidePublisherBrand(
  userId: string,
  guide: CatalogGuide | null,
): Promise<boolean> {
  if (!userId || guide?.publisherType !== 'brand' || !guide.publisherBrandId) return false;
  return sellerOwnsBrand(userId, guide.publisherBrandId);
}

/** All CatalogCreator ids whose `userId` is this authenticated user. */
export async function creatorIdsForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  const creators = await catalogStore.listCreators();
  return creators.filter((c) => c.userId && c.userId === userId).map((c) => c.id);
}

/** The primary CatalogCreator id to stamp on guides a creator authors. */
export async function primaryCreatorIdForUser(userId: string): Promise<string | null> {
  const ids = await creatorIdsForUser(userId);
  return ids[0] ?? null;
}

/**
 * A creator "owns" a guide when its `creatorId` resolves to a CatalogCreator
 * whose `userId` is this authenticated user.
 */
export async function userOwnsGuide(userId: string, guide: CatalogGuide | null): Promise<boolean> {
  if (!userId || !guide?.creatorId) return false;
  const ids = await creatorIdsForUser(userId);
  return ids.includes(guide.creatorId);
}

/**
 * Guide Studio writes (create / edit / lifecycle):
 * - `cms:edit` (moderator / admin / super_admin / marketing_manager) → allow, any guide
 * - `creator` role → allow only for their OWN guide (server-authoritative
 *   creatorId ⇄ CatalogCreator.userId); create (no :id) is allowed and the
 *   handler stamps creatorId from the session
 * - everyone else (incl. sellers who merely see the nav item) → 403
 * - unauthenticated → 401
 *
 * Never grants `cms:edit` to creators. Cross-owner mutation by route id is
 * rejected here, server-side — not by client hiding.
 */
export async function requireGuideStudioWrite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userRole || !req.userId) {
    sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    return;
  }

  if (hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    next();
    return;
  }

  const creator = isCreatorRole(req.userRole);
  const seller = isSellerRole(req.userRole);
  if (!creator && !seller) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions for Guide Studio');
    return;
  }

  const guideId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!guideId) {
    // Create — the handler stamps the publisher identity from the authenticated
    // session (creator → own creatorId; seller → verified publisher brand).
    next();
    return;
  }

  try {
    const guide = await catalogStore.getGuide(guideId);
    if (!guide) {
      // Let the handler return 404; ownership is moot for a missing record.
      next();
      return;
    }
    if (creator && (await userOwnsGuide(req.userId, guide))) {
      next();
      return;
    }
    if (seller && (await userOwnsGuidePublisherBrand(req.userId, guide))) {
      next();
      return;
    }
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Not authorized to modify this guide');
  } catch {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Insufficient permissions for Guide Studio');
  }
}
