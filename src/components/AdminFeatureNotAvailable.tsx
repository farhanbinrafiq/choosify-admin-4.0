import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';

/**
 * Sprint 11 remediation: this screen previously fell through to CmsMirrorHost
 * (a static prototype iframe) and rendered as if it were a working feature —
 * seeded/mock data, buttons with no real backend behind them. No real backend
 * exists yet for this feature. Per launch-readiness policy, a screen exposed
 * in the nav must either work end-to-end, be clearly disabled, or be proven
 * deferred — this renders the deferred/disabled state explicitly instead of
 * silently showing a non-functional mock UI.
 */
export function AdminFeatureNotAvailable({
  title,
  description,
  alternatives,
}: {
  title: string;
  description: string;
  alternatives?: Array<{ label: string; to: string }>;
}) {
  return (
    <div className="max-w-2xl mx-auto mt-12 bg-app-card border border-app-border rounded-2xl p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <ShieldAlert className="w-6 h-6 text-amber-600" />
      </div>
      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-3">
        Not Yet Available
      </div>
      <h1 className="text-lg font-bold text-app-text-primary mb-2">{title}</h1>
      <p className="text-[13px] text-app-text-secondary leading-relaxed mb-6">{description}</p>
      {alternatives && alternatives.length > 0 ? (
        <div className="flex flex-col gap-2 items-stretch">
          {alternatives.map((alt) => (
            <Link
              key={alt.to}
              to={alt.to}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-white text-[12px] font-bold hover:opacity-90 transition-all"
            >
              {alt.label} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default AdminFeatureNotAvailable;
