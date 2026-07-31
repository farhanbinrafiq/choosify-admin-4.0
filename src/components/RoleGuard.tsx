import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRbac } from '../contexts/RbacContext';
import { allowedPageKeysForRole, pathToPageKey } from '../cms-mirror/nav';

/**
 * Gate /admin/* by RBAC matrix, but never block pages that the CMS-mirror
 * role allowlist explicitly exposes (seller Brand Studio, creator Studio, etc.).
 * Stale operations permissions historically set seller.brand / creator.users to false
 * and bounced those routes to dashboard — leaving a blank main pane in the iframe.
 */
export const RoleGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { profile } = useAuth();
  const { canAccessPath } = useRbac();

  if (!location.pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const pageKey = pathToPageKey(location.pathname);
  const mirrorKeys = allowedPageKeysForRole(profile?.role);
  const allowedByMirror = !mirrorKeys || mirrorKeys.includes(pageKey);

  if (!canAccessPath(location.pathname) && !allowedByMirror) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};
