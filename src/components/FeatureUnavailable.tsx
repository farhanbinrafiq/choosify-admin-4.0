import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, ArrowRight } from 'lucide-react';
import type { PartnerFeatureDef } from '../../shared/entitlements/registry';

/**
 * Shown to a Seller/Creator when a page's capability is entitlement-disabled
 * (or FEATURE_ENTITLEMENT_DENIED came back from the API) — instead of a silent
 * redirect to the dashboard. Existing data is never deleted by an entitlement
 * change, so the copy says so. Genuinely unauthorized roles still redirect
 * (RoleGuard), this is only for partner-role pages switched off by Feature Access.
 */
export function FeatureUnavailable({
  features,
  verificationFailed = false,
  onRetry,
}: {
  features: PartnerFeatureDef[];
  /** True when entitlements could not be loaded (503/network) rather than a real denial. */
  verificationFailed?: boolean;
  onRetry?: () => void;
}) {
  const names = features.map((f) => f.label).join(', ');
  const title = verificationFailed ? 'Feature access could not be verified' : 'This feature is currently unavailable';
  const description = verificationFailed
    ? 'We could not confirm access to this capability right now. Nothing has changed on your account — please try again in a moment.'
    : `${names || 'This capability'} is not enabled for your account at the moment. Your existing data is preserved and will be available again if access is restored. Contact Choosify Support if you think this is a mistake.`;
  return (
    <div
      data-testid="feature-unavailable"
      className="max-w-2xl mx-auto mt-12 bg-app-card border border-app-border rounded-2xl p-8 text-center"
    >
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-3">
        {verificationFailed ? 'Access check unavailable' : 'Feature unavailable'}
      </div>
      <h1 className="text-lg font-bold text-app-text-primary mb-2">{title}</h1>
      <p className="text-[13px] text-app-text-secondary leading-relaxed mb-6">{description}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-app-border text-app-text-primary text-[12px] font-bold hover:bg-[#F1F3F5] transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Check again
          </button>
        ) : null}
        <Link
          to="/admin/dashboard"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-white text-[12px] font-bold hover:opacity-90 transition-all"
        >
          Go to dashboard <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default FeatureUnavailable;
