import type { NextFunction, Request, Response } from 'express';
import { isApiPathEntitled } from './entitlementStore';

/**
 * Authoritative partner entitlement gate for API routes.
 * Admins/staff are never blocked by partner entitlements.
 * Disabling a feature only denies access — it never deletes data.
 */
export function requirePartnerEntitlement(req: Request, res: Response, next: NextFunction): void {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  const path = req.originalUrl || req.url || '';
  const check = isApiPathEntitled({ role, userId, path, method: req.method });
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
