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
  // isPartnerIdentityApiPath does an exact-path match for several entries
  // (e.g. /api/v1/operations/orders) -- unlike requireMarketplaceAccess's
  // normalizePath, `path` here still carries the query string, so a request
  // like GET .../orders?buyerId=X never matched and fell through to the
  // stricter entitlement check below, wrongly 403'ing a locked partner's own
  // buyer-side order list.
  const pathWithoutQuery = path.split('?')[0] || path;
  if (isPartnerIdentityApiPath(pathWithoutQuery, req.method || 'GET')) {
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
  // Express 4 does not catch rejected promises from async middleware: an
  // uncaught DB error here used to become an unhandled rejection and terminate
  // the whole process. Fail closed for this request only.
  let check: Awaited<ReturnType<typeof isApiPathEntitled>>;
  try {
    check = await isApiPathEntitled({ role, userId, path, method: req.method });
  } catch (error) {
    console.error('[Entitlements] Entitlement check failed:', {
      method: req.method,
      path: pathWithoutQuery,
      role,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'Feature access could not be verified right now. Please try again shortly.',
        code: 'ENTITLEMENT_CHECK_UNAVAILABLE',
      });
    }
    return;
  }
  if (check.ok) {
    next();
    return;
  }
  res.status(403).json({
    success: false,
    error: 'This feature is not enabled for your account',
    code: 'FEATURE_ENTITLEMENT_DENIED',
    featureKey: check.featureKey,
    // Why (e.g. 'override' + restrict/expiresAt, 'platform', 'plan', 'dependency'),
    // limited to allow-listed evaluator fields — never admin reasons or DB values.
    ...(check.source ? { source: check.source } : {}),
    ...(check.detail ? { detail: check.detail } : {}),
    ...(typeof check.detail?.expiresAt === 'string' ? { expiresAt: check.detail.expiresAt } : {}),
  });
}
