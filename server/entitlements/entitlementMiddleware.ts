import type { NextFunction, Request, Response } from 'express';
import { isApiPathEntitled } from './entitlementStore';
import { isPartnerIdentityApiPath } from './marketplaceAccessMiddleware';
import { resolvePartnerLifecycle } from '../partnerApplications/partnerLifecycle';

/**
 * Authoritative partner entitlement gate for API routes.
 * Admins/staff are never blocked by partner entitlements.
 * Disabling a feature only denies access — it never deletes data.
 *
 * While Marketplace Access is pending, identity/profile/verification APIs stay
 * available even if a commercial feature is entitlement-disabled. After
 * Marketplace Access is granted, normal entitlement rules apply.
 */
export async function requirePartnerEntitlement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  const path = req.originalUrl || req.url || '';
  if (isPartnerIdentityApiPath(path, req.method || 'GET')) {
    try {
      const life = await resolvePartnerLifecycle({
        userId,
        email: req.user?.email,
        role,
      });
      if (!life.marketplaceAccess) {
        next();
        return;
      }
    } catch {
      // Fall through to entitlement check.
    }
  }
  const check = await isApiPathEntitled({ role, userId, path, method: req.method });
  if (check.ok) {
    next();
    return;
  }
  res.status(403).json({
    success: false,
    error: 'This feature is not enabled for your account',
    code: 'FEATURE_ENTITLEMENT_DENIED',
    featureKey: check.featureKey,
  });
}
