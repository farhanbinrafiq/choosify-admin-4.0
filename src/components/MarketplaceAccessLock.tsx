import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfilePath } from '../lib/userDisplay';
import { PARTNER_IDENTITY_PAGE_KEYS } from '../cms-mirror/nav';

export const MARKETPLACE_PENDING_ALLOWED_PAGE_KEYS = new Set<string>([
  ...PARTNER_IDENTITY_PAGE_KEYS.seller,
  ...PARTNER_IDENTITY_PAGE_KEYS.creator,
]);

export function partnerMarketplaceLocked(profile: {
  role?: string;
  marketplaceAccess?: boolean;
} | null | undefined): boolean {
  const role = profile?.role;
  if (role !== 'seller' && role !== 'creator') return false;
  return profile?.marketplaceAccess === false;
}

/** Full-page lock for Visual Builder / studio routes that sit outside CmsMirrorHost. */
export const MarketplaceAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  if (!partnerMarketplaceLocked(profile) || !profile) {
    return <>{children}</>;
  }
  return <MarketplaceAccessLockPanel profilePath={getMyProfilePath(profile)} />;
};

export const MarketplaceAccessLockPanel: React.FC<{ profilePath: string }> = ({ profilePath }) => {
  const { profile } = useAuth();
  const status = profile?.partnerApplicationStatus;
  const resubmit = profile?.resubmissionRequested === true;
  const stateLabel = resubmit
    ? 'Verification Required'
    : status === 'rejected'
      ? 'Application Declined'
      : 'Under Review';
  return (
  <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
    <div className="max-w-lg w-full rounded-2xl border border-[#E8EDF2] bg-white p-8 text-center shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.14em] text-[#B45309] mb-2">
        MARKETPLACE ACCESS PENDING
      </div>
      <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#92400E] mb-3">
        {stateLabel.toUpperCase()}
      </div>
      <h2 className="text-[18px] font-extrabold text-[#111827] mb-3">Marketplace Access Pending</h2>
      <p className="text-[13px] font-semibold text-[#6B7280] leading-relaxed mb-6">
        Your account is currently under review. This feature will become available after Choosify
        verifies your account and enables Marketplace Access.
      </p>
      <Link
        to={profilePath}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[12px] font-extrabold text-white"
        style={{ background: 'linear-gradient(90deg,#C8321A,#EF3C23)' }}
      >
        Open Profile &amp; Verification
      </Link>
    </div>
  </div>
  );
};
