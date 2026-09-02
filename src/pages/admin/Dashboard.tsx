import React, { lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Thin role dispatcher for /admin/dashboard.
 *
 * Presentation routing is driven by the canonical session role
 * (`profile.role`) — never by sniffing the shape of an analytics response.
 * Each role gets a genuinely different information architecture:
 *
 *   super_admin / admin / moderator → AdminHomeDashboard   (Platform Command Center)
 *   seller / verified_seller        → SellerHomeDashboard  (Seller Command Center)
 *   creator                         → CreatorHomeDashboard (Creator Command Center)
 *   consumer / finance_manager /    → WorkspaceFallback    (fail closed — never the Admin shell)
 *     support_agent / marketing_manager / unknown
 *
 * Moderator stays on the Admin view on purpose: the canonical analytics backend
 * (server/operationsRouter.ts `/operations/analytics`) grants moderator the
 * platform summary alongside admin/super_admin. That authorized access is
 * preserved here rather than silently removed as part of a visual rebuild.
 */
const AdminHomeDashboard = lazy(() => import('./dashboards/AdminHomeDashboard'));
const SellerHomeDashboard = lazy(() => import('./dashboards/SellerHomeDashboard'));
const CreatorHomeDashboard = lazy(() => import('./dashboards/CreatorHomeDashboard'));
const WorkspaceFallback = lazy(() => import('./dashboards/WorkspaceFallback'));

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'moderator']);
const SELLER_ROLES = new Set(['seller', 'verified_seller']);

function pickDashboard(role: string): React.ComponentType {
  const r = role.toLowerCase();
  if (ADMIN_ROLES.has(r)) return AdminHomeDashboard;
  if (SELLER_ROLES.has(r)) return SellerHomeDashboard;
  if (r === 'creator') return CreatorHomeDashboard;
  return WorkspaceFallback;
}

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-app-accent font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
        Loading dashboard…
      </div>
    );
  }

  const Selected = pickDashboard(String(profile?.role || ''));

  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-app-text-secondary font-mono text-[10px] uppercase tracking-[4px] animate-pulse">
          Loading dashboard…
        </div>
      }
    >
      <Selected />
    </Suspense>
  );
}
