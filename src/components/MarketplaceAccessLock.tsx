import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfilePath } from '../lib/userDisplay';
import { PARTNER_IDENTITY_PAGE_KEYS } from '../cms-mirror/nav';
import { catalogApi } from '../services/catalogApi';
import { identityStudioEditPath, nextStepOf, pendingStateOf, PENDING_STATE_LABEL as STATE_LABEL } from './marketplacePendingState';

export { identityStudioEditPath, nextStepOf, pendingStateOf } from './marketplacePendingState';
export type { PendingState } from './marketplacePendingState';

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
  const { pathname } = useLocation();
  if (!partnerMarketplaceLocked(profile) || !profile) {
    return <>{children}</>;
  }
  if (identityStudioEditPath(profile.role, pathname)) {
    return (
      <>
        <MarketplacePendingStudioNotice />
        {children}
      </>
    );
  }
  return <MarketplaceAccessLockPanel profilePath={getMyProfilePath(profile)} />;
};

/**
 * Phase E (E2/E3): shown above the partner's own Brand / Creator Studio while
 * Marketplace Access is pending — what still works, what is held, and the next step.
 */
export const MarketplacePendingStudioNotice: React.FC = () => {
  const { profile } = useAuth();
  const state = pendingStateOf(profile);
  const creator = profile?.role === 'creator';
  const held = creator
    ? 'You can keep editing and saving this profile. It stays private until it is live: only Choosify can make it live while access is pending, so Publish is held.'
    : 'You can keep editing and saving this brand. It stays private, and adding more brands, products and other selling tools wait for Marketplace Access.';
  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-4">
      <div
        role="status"
        data-testid="marketplace-pending-notice"
        className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#B45309]">
            MARKETPLACE ACCESS PENDING · {STATE_LABEL[state].toUpperCase()}
          </div>
          <p className="text-[13px] font-semibold text-[#92400E] leading-relaxed mt-1">
            {held} {nextStepOf(state)}
          </p>
        </div>
        {profile ? (
          <Link
            to={getMyProfilePath(profile)}
            className="shrink-0 inline-flex items-center justify-center rounded-lg border border-[#F59E0B] px-3 py-2 text-[12px] font-extrabold text-[#92400E]"
          >
            Open Profile &amp; Verification
          </Link>
        ) : null}
      </div>
    </div>
  );
};

/** The partner's own Brand / Creator profile they can still open while access is pending. */
function useOwnIdentityStudios(role: string | undefined): Array<{ id: string; name: string; href: string }> {
  const [rows, setRows] = useState<Array<{ id: string; name: string; href: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Both list endpoints are scoped server-side to the caller's own records.
        const next =
          role === 'seller'
            ? (await catalogApi.listBrands()).map((b) => ({ id: b.id, name: b.name, href: `/admin/brand-studio/${encodeURIComponent(b.id)}/edit` }))
            : role === 'creator'
              ? (await catalogApi.listCreators()).map((c) => ({ id: c.id, name: c.name, href: `/admin/creator-studio/${encodeURIComponent(c.id)}/edit` }))
              : [];
        if (!cancelled) setRows(next.slice(0, 5));
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);
  return rows;
}

export const MarketplaceAccessLockPanel: React.FC<{ profilePath: string }> = ({ profilePath }) => {
  const { profile } = useAuth();
  const state = pendingStateOf(profile);
  const own = useOwnIdentityStudios(profile?.role);
  const bodyCopy =
    state === 'awaiting_activation'
      ? 'Your account has been verified. Marketplace Access is awaiting activation by Choosify.'
      : 'Your account is currently under review. This feature will become available after Choosify verifies your account and enables Marketplace Access.';
  const ownLabel = profile?.role === 'creator' ? 'creator profile' : 'brand';
  return (
  <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
    <div className="max-w-lg w-full rounded-2xl border border-[#E8EDF2] bg-white p-8 text-center shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.14em] text-[#B45309] mb-2">
        MARKETPLACE ACCESS PENDING
      </div>
      <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#92400E] mb-3">
        {STATE_LABEL[state].toUpperCase()}
      </div>
      <h2 className="text-[18px] font-extrabold text-[#111827] mb-3">Marketplace Access Pending</h2>
      <p className="text-[13px] font-semibold text-[#6B7280] leading-relaxed mb-3">
        {bodyCopy}
      </p>
      <p data-testid="marketplace-next-step" className="text-[13px] font-semibold text-[#374151] leading-relaxed mb-6">
        {nextStepOf(state)}
      </p>
      <Link
        to={profilePath}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[12px] font-extrabold text-white"
        style={{ background: 'linear-gradient(90deg,#C8321A,#EF3C23)' }}
      >
        Open Profile &amp; Verification
      </Link>
      {own.length ? (
        <div className="mt-6 pt-5 border-t border-[#E8EDF2]" data-testid="marketplace-own-studios">
          <div className="text-[11px] font-extrabold text-[#6B7280] mb-2">
            You can keep editing your {ownLabel}{own.length === 1 ? '' : 's'} while you wait:
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {own.map((r) => (
              <Link key={r.id} to={r.href} className="text-[13px] font-extrabold text-[#C8321A] underline">
                Continue editing {r.name || `your ${ownLabel}`}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  </div>
  );
};
