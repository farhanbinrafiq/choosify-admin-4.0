import React, { Suspense, lazy } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const SuperAdminDashboard = lazy(() => import('../../pages/admin/Dashboard'));
const SellerDashboard = lazy(() => import('./SellerDashboard'));
const CreatorDashboard = lazy(() => import('./CreatorDashboard'));
const RoleOpsDashboard = lazy(() => import('./RoleOpsDashboard'));

const OPS_ROLES = new Set([
  'admin',
  'moderator',
  'finance_manager',
  'support_agent',
  'marketing_manager',
]);

export default function DashboardRouter() {
  const { profile } = useAuth();
  const role = profile?.role || 'super_admin';

  return (
    <Suspense
      fallback={
        <div className="p-10 text-app-text-secondary font-mono text-xs opacity-50 animate-pulse uppercase tracking-[4px]">
          Initializing role dashboard…
        </div>
      }
    >
      {role === 'super_admin' && <SuperAdminDashboard />}
      {role === 'seller' && <SellerDashboard />}
      {role === 'creator' && <CreatorDashboard />}
      {OPS_ROLES.has(role) && <RoleOpsDashboard roleKey={role} />}
      {!['super_admin', 'seller', 'creator'].includes(role) && !OPS_ROLES.has(role) && (
        <RoleOpsDashboard roleKey="admin" />
      )}
    </Suspense>
  );
}
