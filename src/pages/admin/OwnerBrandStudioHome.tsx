import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogBrand } from '../../types/catalog';
import { MarketplaceAccessLockPanel, MarketplacePendingStudioNotice, partnerMarketplaceLocked } from '../../components/MarketplaceAccessLock';
import { getMyProfilePath } from '../../lib/userDisplay';
import { Avatar } from '../../components/shared/Avatar';
import { ContentCard, DashShell, EmptyState } from './dashboards/primitives';

/**
 * Seller Brand Studio home (/admin/brand-studio) for the cases the App route
 * used to hand to the CMS mirror: no brand yet, several brands, or Marketplace
 * Access still pending. One owned brand opens its Studio directly (the editor
 * allows a pending seller to keep editing it); several show the owned-brands
 * list; none offers Create Brand — which stays locked while access is pending.
 */
const MARKETPLACE_LABEL: Record<string, string> = {
  granted: 'Active',
  restored: 'Active',
  not_granted: 'Not active',
  restricted: 'Restricted',
  suspended: 'Suspended',
  revoked: 'Revoked',
};

function marketplaceLabel(b: CatalogBrand): string {
  if (b.marketplaceStatus) return MARKETPLACE_LABEL[b.marketplaceStatus] || b.marketplaceStatus;
  return b.marketplaceAccess ? 'Active' : 'Not active';
}

export default function OwnerBrandStudioHome() {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<CatalogBrand[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = partnerMarketplaceLocked(profile);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    catalogApi
      .listBrands()
      .then((all) => alive && setBrands(all.filter((b) => b.sellerId === profile.id)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load your brands.'));
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  if (!profile) return null;
  if (brands && brands.length === 1) {
    return <Navigate to={`/admin/brand-studio/${encodeURIComponent(brands[0].id)}/edit`} replace />;
  }
  // No brand and access pending: creating one waits for Marketplace Access.
  if (brands && brands.length === 0 && locked) {
    return <MarketplaceAccessLockPanel profilePath={getMyProfilePath(profile)} />;
  }

  const createButton = locked ? null : (
    <Link
      to="/admin/brand-studio/new"
      className="h-[42px] px-4 bg-[#F96500] text-white rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:opacity-90"
      data-testid="brand-studio-create"
    >
      <Plus className="w-4 h-4" /> Create Brand
    </Link>
  );

  return (
    <>
      {locked ? <MarketplacePendingStudioNotice /> : null}
      <DashShell title="Brand Studio" subtitle="Your brands — open Brand Studio to edit and publish each public Brand Page." actions={createButton}>
        {error ? (
          <ContentCard>
            <div className="text-sm font-bold text-red-600" role="alert">{error}</div>
          </ContentCard>
        ) : !brands ? (
          <ContentCard>
            <div className="py-10 text-center text-sm text-app-text-secondary">Loading your brands…</div>
          </ContentCard>
        ) : brands.length === 0 ? (
          <ContentCard>
            <div data-testid="brand-studio-empty">
              <EmptyState message="You don't own a brand yet. Create your first brand to set up its public Brand Page." />
            </div>
          </ContentCard>
        ) : (
          <ContentCard title={`My Brands (${brands.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]" data-testid="brand-studio-list">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-app-text-secondary border-b border-app-border">
                    <th className="py-2.5 pr-3 font-extrabold">Brand</th>
                    <th className="py-2.5 pr-3 font-extrabold">Verification</th>
                    <th className="py-2.5 pr-3 font-extrabold">Marketplace Access</th>
                    <th className="py-2.5 pr-3 font-extrabold">Last updated</th>
                    <th className="py-2.5 font-extrabold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...brands]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((b) => (
                      <tr key={b.id} className="border-b border-app-border last:border-0">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar src={b.logo || null} name={b.name} size={34} />
                            <div className="min-w-0">
                              <div className="font-bold text-app-text-primary truncate">{b.name}</div>
                              <div className="text-[11px] text-app-text-secondary truncate">{b.category || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-semibold">{b.verifiedStatus ? 'Verified' : 'Not verified'}</td>
                        <td className="py-3 pr-3 font-semibold">{marketplaceLabel(b)}</td>
                        <td className="py-3 pr-3 text-app-text-secondary">{b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : '—'}</td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/admin/brand-studio/${encodeURIComponent(b.id)}/edit`}
                            className="inline-flex items-center h-[34px] px-3 rounded-lg border-[1.5px] border-[#F96500] text-[#000435] text-[12px] font-bold hover:bg-[#FFF0E8]"
                          >
                            Open Brand Studio
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </ContentCard>
        )}
      </DashShell>
    </>
  );
}
