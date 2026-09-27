import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRbac } from '../contexts/RbacContext';
import { useEntitlements } from '../contexts/EntitlementsContext';
import { allowedPageKeysForRole, pathToPageKey } from '../cms-mirror/nav';
import {
  featuresForPageKey,
  isEntitlementControlledPageKey,
  type PartnerRole,
} from '../../shared/entitlements/registry';
import { isSuperAdminOnlyPath } from '../lib/rbac';
import { AdminWorkspaceLayout } from './Layout/AdminWorkspaceLayout';
import { FeatureUnavailable } from './FeatureUnavailable';

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
  const { filterAllowedPageKeys, status, refresh } = useEntitlements();

  if (!location.pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const pageKey = pathToPageKey(location.pathname);
  const role = String(profile?.role || '').toLowerCase();
  const partnerRole: PartnerRole | null =
    role === 'seller' || role === 'verified_seller' ? 'seller' : role === 'creator' ? 'creator' : null;
  // Nav may stay complete while entitlements load; gated ROUTES must not fail-open.
  if (
    partnerRole &&
    (status === 'loading' || status === 'idle') &&
    isEntitlementControlledPageKey(partnerRole, pageKey)
  ) {
    return null;
  }
  const roleKeys = allowedPageKeysForRole(profile?.role);
  const mirrorKeys = filterAllowedPageKeys(roleKeys);
  const allowedByMirror = !mirrorKeys || mirrorKeys.includes(pageKey);

  // The role may open this page but a Feature Access entitlement removed it:
  // explain that instead of silently bouncing to the dashboard. Genuinely
  // unauthorized roles still redirect below.
  if (
    partnerRole &&
    roleKeys?.includes(pageKey) &&
    isEntitlementControlledPageKey(partnerRole, pageKey) &&
    mirrorKeys &&
    !mirrorKeys.includes(pageKey)
  ) {
    return (
      <AdminWorkspaceLayout pageTitle="Feature unavailable">
        <FeatureUnavailable
          features={featuresForPageKey(partnerRole, pageKey)}
          verificationFailed={status === 'failed'}
          onRetry={() => void refresh()}
        />
      </AdminWorkspaceLayout>
    );
  }

  // Super-Admin-only routes (Storefront Curation): redirect every other role,
  // including admin, whose mirror allowlist is otherwise "all pages".
  if (isSuperAdminOnlyPath(location.pathname)) {
    if (role !== 'super_admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <>{children}</>;
  }

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
