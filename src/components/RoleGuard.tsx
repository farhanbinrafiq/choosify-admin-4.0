import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRbac } from '../contexts/RbacContext';
import { useEntitlements } from '../contexts/EntitlementsContext';
import { allowedPageKeysForRole, pathToPageKey } from '../cms-mirror/nav';

/**
 * Gate /admin/* by RBAC matrix, but never block pages that the CMS-mirror
 * role allowlist explicitly exposes (seller Brand Studio, creator Studio, etc.).
 * Stale operations permissions historically set seller.brand / creator.users to false
 * and bounced those routes to dashboard — leaving a blank main pane in the iframe.
 * Partner entitlements further restrict Seller/Creator commercial features (not Admin RBAC).
 */
export const RoleGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { profile } = useAuth();
  const { canAccessPath } = useRbac();
  const { filterAllowedPageKeys } = useEntitlements();

  if (!location.pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const pageKey = pathToPageKey(location.pathname);
  const mirrorKeys = filterAllowedPageKeys(allowedPageKeysForRole(profile?.role));
  const allowedByMirror = !mirrorKeys || mirrorKeys.includes(pageKey);

  // Admin feature-access is never seller/creator-entitlement-gated
  if (pageKey === 'featureAccess') {
    const role = profile?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <>{children}</>;
  }

  if (!canAccessPath(location.pathname) && !allowedByMirror) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Entitlement denial for partners even when RBAC path is open
  if (mirrorKeys && !mirrorKeys.includes(pageKey)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};
