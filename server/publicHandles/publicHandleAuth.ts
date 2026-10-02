/**
 * Public Identity Phase C2 — who may act on public handles.
 *
 *  - Handle management (assign, rename, retire, reserve, release, approve,
 *    reject) is SUPER ADMIN ONLY: requireRole(ROLES.SUPER_ADMIN). Page
 *    permissions, `cms:edit` and Feature Access entitlements never grant it, and
 *    no entitlement middleware is used here.
 *  - Admins (admin + super_admin, ROLE_INHERITANCE) may read queues and history.
 *  - Owners: Brand → brand.sellerId === req.userId; Creator → creator.userId ===
 *    req.userId. Deliberately NOT sellerOwnsBrand(): its approved-claim fallback
 *    keeps a former owner authorized after an ownership transfer.
 *  - Every handle MUTATION refuses an impersonated session outright with
 *    403 HANDLE_IMPERSONATION_NOT_ALLOWED: Super Admin actions and the owner's
 *    own submit / cancel alike. (Admin and Super Admin accounts cannot be
 *    impersonated, so requireRole would fail anyway for the former; the guard runs
 *    first so the refusal is explicit and independent of that rule.) Reads stay
 *    available under the normal read policy.
 *  - Pending partner applicants are NOT blocked (requireMarketplaceAccess is not
 *    used): a request only ever takes effect after Super Admin approval.
 */
import type { NextFunction, Request, Response } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { hasRole } from '../permissions/authorization';
import { ROLES } from '../permissions/roles';
import type { HandleActor, HandleEntity } from './publicHandleStore';

export function rejectImpersonation(req: Request, res: Response, next: NextFunction) {
  if (req.impersonationSessionId || req.realActorUserId) {
    res.status(403).json({
      success: false,
      error: 'Public handle management is not available while impersonating an account.',
      code: 'HANDLE_IMPERSONATION_NOT_ALLOWED',
    });
    return;
  }
  next();
}

/** Assign / rename / retire / reserve / release / approve / reject. */
export const requireHandleSuperAdmin = [authenticateRequest, rejectImpersonation, requireRole(ROLES.SUPER_ADMIN)];

/** Owner submit / cancel: signed in, never impersonated; ownership is checked per entity. */
export const requireHandleOwnerAction = [authenticateRequest, rejectImpersonation];

/** Read-only queues and history. */
export const requireHandleReader = [authenticateRequest, requireRole(ROLES.ADMIN)];

/** Owner read route: authenticates here, authorizes per entity in the handler. */
export const requireHandleSession = [authenticateRequest];

export function handleActorOf(req: Request): HandleActor {
  return { userId: String(req.userId || ''), realActorUserId: req.realActorUserId || null };
}

/** Admin or Super Admin (inherited role check, as requireRole(ROLES.ADMIN)). */
export function isHandleReader(req: Request): boolean {
  return Boolean(req.userRole && hasRole(req.userRole, ROLES.ADMIN));
}

export function isEntityOwner(entity: HandleEntity, userId: string | undefined): boolean {
  return Boolean(userId && entity.ownerUserId && entity.ownerUserId === userId);
}
