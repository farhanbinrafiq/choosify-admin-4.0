import type { NextFunction, Request, Response } from 'express';
import { resolvePartnerLifecycle } from '../partnerApplications/partnerLifecycle';

/**
 * Pending / not-yet-marketplace-enabled partners may use identity surfaces
 * (auth, profile, workspace hydrate, verification) but not operational marketplace APIs.
 * Grandfathered and staff accounts are never blocked.
 */
function normalizePath(req: Request): string {
  return String(req.originalUrl || req.url || '').split('?')[0] || '';
}

/** Profile, verification, and account APIs that must remain available during review. */
export function isPartnerIdentityApiPath(path: string, method: string): boolean {
  const p = path.startsWith('/api/v1')
    ? path
    : path.startsWith('/api/')
      ? `/api/v1${path.slice(4)}`
      : path;
  const m = method.toUpperCase();

  if (p.includes('/marketplace-access')) return false;

  if (p.startsWith('/api/v1/auth')) return true;
  if (p.startsWith('/api/v1/entitlements')) return true;
  if (p.startsWith('/api/v1/catalog/workspace/seller/ensure')) return true;
  if (p.startsWith('/api/v1/catalog/workspace/creator/ensure')) return true;
  if (m === 'GET' && p.startsWith('/api/v1/catalog/workspace/')) return true;
  if (m === 'GET' && (p === '/api/v1/catalog/brands' || p.startsWith('/api/v1/catalog/brands/'))) {
    return true;
  }
  if (m === 'GET' && (p === '/api/v1/catalog/creators' || p.startsWith('/api/v1/catalog/creators/'))) {
    return true;
  }
  if ((m === 'PATCH' || m === 'PUT') && /^\/api\/v1\/catalog\/brands\/[^/]+$/.test(p)) return true;
  if ((m === 'PATCH' || m === 'PUT') && /^\/api\/v1\/catalog\/creators\/[^/]+$/.test(p)) return true;
  if (m === 'POST' && p.startsWith('/api/v1/catalog/media')) return true;
  if (p.startsWith('/api/v1/operations/verifications')) return true;
  if (p.startsWith('/api/v1/operations/partner-applications')) return true;
  // Buying/messaging is a role-independent identity action, not a partner
  // commercial capability -- a person mid-review on a seller/creator
  // application must still be able to shop and message as a buyer on the
  // same account. Only genuinely seller/creator-operational writes within
  // operationsRouter (e.g. mark-delivered) stay gated by this check.
  if (p === '/api/v1/operations/orders') return true; // GET (list) / POST (place order)
  if (/^\/api\/v1\/operations\/orders\/[^/]+$/.test(p)) return true; // GET / PATCH a specific order
  if (/^\/api\/v1\/operations\/orders\/[^/]+\/cancel$/.test(p)) return true;
  if (p === '/api/v1/operations/platform-messages') return true;
  if (p.startsWith('/api/v1/support/')) return true;
  if (m === 'GET' && p.startsWith('/api/v1/dashboard/nav-attention')) return true;
  if (m === 'GET' && (p.startsWith('/api/v1/notifications') || p.startsWith('/api/notifications'))) {
    return true;
  }
  return false;
}

export async function requireMarketplaceAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  const email = req.user?.email;

  try {
    const life = await resolvePartnerLifecycle({ userId, email, role });
    req.partnerMarketplaceLocked = !life.marketplaceAccess;
    if (life.marketplaceAccess) {
      next();
      return;
    }

    const path = normalizePath(req);
    const method = req.method || 'GET';
    if (isPartnerIdentityApiPath(path, method)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error:
        'Marketplace Access Pending. Your account is currently under review. This feature will become available after Choosify verifies your account and enables Marketplace Access.',
      code: 'MARKETPLACE_ACCESS_REQUIRED',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to resolve marketplace access',
    });
  }
}
