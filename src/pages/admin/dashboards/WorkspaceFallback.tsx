import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { WEB_ORIGIN } from './primitives';

/**
 * Fail-closed landing for every role WITHOUT an explicitly authorized home
 * dashboard: consumer, and staff roles (finance_manager / support_agent /
 * marketing_manager) that the analytics backend does not grant a platform view.
 *
 * Previously these roles hit `Dashboard.tsx`, got a 403 from
 * `/operations/analytics`, and fell through to the admin "Platform Command
 * Center" shell rendered with every KPI blank. They must never inherit the
 * Admin presentation just because analytics returned null.
 *
 * Moderator is intentionally NOT routed here — the canonical analytics backend
 * groups moderator with admin/super_admin (operationsRouter.ts) and that
 * authorized access is preserved.
 */
export default function WorkspaceFallback() {
  const { profile } = useAuth();
  const role = String(profile?.role || '').toLowerCase();
  const isConsumer = role === 'consumer' || role === 'user' || role === '';

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="bg-app-card border border-app-border rounded-2xl p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-app-accent/10 flex items-center justify-center mx-auto mb-5">
          <LayoutGrid className="w-6 h-6 text-app-accent" />
        </div>

        {isConsumer ? (
          <>
            <h1 className="text-xl font-bold text-app-text-primary tracking-tight m-0">
              Your Choosify account lives on the storefront
            </h1>
            <p className="text-sm text-app-text-secondary mt-3 leading-relaxed">
              Orders, messages, wishlist and account settings are all in the
              storefront account area — this operations dashboard is for sellers,
              creators and platform staff.
            </p>
            <a
              href={WEB_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-app-accent text-white text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-all no-underline"
            >
              <ExternalLink className="w-4 h-4" /> Go to Choosify
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-app-text-primary tracking-tight m-0">
              My Workspace
            </h1>
            <p className="text-sm text-app-text-secondary mt-3 leading-relaxed">
              Your role doesn&apos;t have a platform overview dashboard. Use the
              sidebar to open the tools available to you.
            </p>
            <Link
              to="/admin/orders"
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-app-card border border-app-accent text-app-accent text-xs font-bold uppercase tracking-wide hover:bg-app-accent/10 transition-all no-underline"
            >
              Open Orders
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
