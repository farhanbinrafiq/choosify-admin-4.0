import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import { operationsApi, type OpsVerification, type OpsPartnerApplication } from '../../services/operationsApi';
import { moderationApi, type ReportItem } from '../../services/moderationApi';
import type { CatalogBrand } from '../../types/catalog';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Avatar } from '../../components/shared/Avatar';

/**
 * Super Admin Seller Management — real React replacement for the legacy
 * CmsMirrorHost "Seller Management Studio" (public/cms-mirror/app.html).
 *
 * Canonical data sources (no fabricated state -- see audit):
 *  - Sellers themselves: derived from `GET /catalog/brands` (CatalogBrand.sellerId),
 *    grouped by seller. There is no dedicated "list sellers" endpoint.
 *  - Seller identity (CF ID / name / email): `GET /auth/users/directory` (admin-only,
 *    bulk -- avoids one request per seller).
 *  - Requests: `GET /operations/partner-applications?status=pending` (applicantType==='seller').
 *  - Ownership Claims: `GET /operations/verifications?entityType=brand&status=pending`.
 *  - Verified: `CatalogBrand.verifiedStatus` / `claimStatus==='verified'`.
 *  - Active Sellers: verified && brand.status==='live'-equivalent && marketplaceAccess && !suspended
 *    (see isActiveSeller below -- documented, not invented).
 *  - Suspended: `CatalogBrand.marketplaceStatus === 'suspended'` (real enum value).
 *  - Inactive: !marketplaceAccess && !suspended (derived from the same real fields).
 *  - Flagged: real cross-reference against `GET /admin/moderation/reports?status=open|investigating`,
 *    matched by `resourceOwnerId === sellerId` or (`resourceType==='seller'|'brand'` && `resourceId===sellerId/brandId`).
 *    Single bulk request, not N+1.
 *  - "Banned" was REMOVED: no authoritative seller/brand banned state exists anywhere
 *    in the backend (the legacy mirror's `isBanned: i===10` was array-index fabrication).
 */

type SellerFilter =
  | 'all'
  | 'verified'
  | 'requests'
  | 'claims'
  | 'active'
  | 'suspended'
  | 'inactive'
  | 'flagged';

interface SellerRow {
  sellerId: string;
  cfId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  brands: CatalogBrand[];
  primaryBrand: CatalogBrand | null;
  verified: boolean;
  active: boolean;
  suspended: boolean;
  inactive: boolean;
  flagged: boolean;
  createdAt: string | null;
}

const FILTER_TABS: { key: SellerFilter; label: string }[] = [
  { key: 'all', label: 'All Sellers' },
  { key: 'verified', label: 'Verified Sellers' },
  { key: 'requests', label: 'Requests' },
  { key: 'claims', label: 'Ownership Claims' },
  { key: 'active', label: 'Active Sellers' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'suspended', label: 'Suspended' },
];

export default function SellerManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('filter') as SellerFilter) || 'all';
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState<'az' | 'za' | 'new' | 'old'>('az');

  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [requests, setRequests] = useState<OpsPartnerApplication[]>([]);
  const [claims, setClaims] = useState<OpsVerification[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const PAGE_SIZE = 20;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [brandsRes, usersRes, requestsRes, claimsRes, openReports, investigatingReports] = await Promise.all([
          catalogApi.listBrands(),
          authApi.getUsersDirectory(),
          operationsApi.listPartnerApplications('pending'),
          operationsApi.listVerifications({ entityType: 'brand', status: 'pending' }),
          moderationApi.listReports({ status: 'open' }),
          moderationApi.listReports({ status: 'investigating' }),
        ]);
        if (cancelled) return;
        setBrands(brandsRes);
        setUsers(usersRes);
        setRequests(requestsRes.filter((r) => r.applicantType === 'seller'));
        setClaims(claimsRes);
        setReports([...openReports, ...investigatingReports]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load seller data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);

  const flaggedSellerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reports) {
      if (r.resourceOwnerId) ids.add(r.resourceOwnerId);
      if (r.resourceType === 'seller') ids.add(r.resourceId);
    }
    return ids;
  }, [reports]);

  const flaggedBrandIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reports) {
      if (r.resourceType === 'brand') ids.add(r.resourceId);
    }
    return ids;
  }, [reports]);

  const claimedBrandIds = useMemo(
    () => new Set(claims.map((c) => c.entityId || c.brand_id).filter(Boolean) as string[]),
    [claims],
  );

  const sellers: SellerRow[] = useMemo(() => {
    const bySeller = new Map<string, CatalogBrand[]>();
    for (const b of brands) {
      if (!b.sellerId) continue;
      const list = bySeller.get(b.sellerId) ?? [];
      list.push(b);
      bySeller.set(b.sellerId, list);
    }
    const rows: SellerRow[] = [];
    for (const [sellerId, ownedBrands] of bySeller) {
      const user = usersById.get(sellerId);
      const primaryBrand = ownedBrands.find((b) => b.verifiedStatus) ?? ownedBrands[0] ?? null;
      const verified = ownedBrands.some((b) => b.verifiedStatus || b.claimStatus === 'verified');
      const suspended = ownedBrands.some((b) => b.marketplaceStatus === 'suspended');
      const marketplaceActive = ownedBrands.some((b) => b.marketplaceAccess);
      // Active Seller = documented condition from the audit: verified, has at
      // least one marketplace-visible brand, and none of their brands are
      // currently suspended.
      const active = verified && marketplaceActive && !suspended;
      const inactive = !marketplaceActive && !suspended;
      const flagged = flaggedSellerIds.has(sellerId) || ownedBrands.some((b) => flaggedBrandIds.has(b.id));
      rows.push({
        sellerId,
        cfId: user?.choosifyUserId || '—',
        displayName: user?.displayName || primaryBrand?.name || 'Unknown seller',
        avatarUrl: user?.avatarUrl || null,
        email: user?.email || '—',
        brands: ownedBrands,
        primaryBrand,
        verified,
        active,
        suspended,
        inactive,
        flagged,
        createdAt: ownedBrands.reduce<string | null>((earliest, b) => {
          if (!b.createdAt) return earliest;
          if (!earliest || b.createdAt < earliest) return b.createdAt;
          return earliest;
        }, null),
      });
    }
    return rows;
  }, [brands, usersById, flaggedSellerIds, flaggedBrandIds]);

  const counts = useMemo(
    () => ({
      all: sellers.length,
      verified: sellers.filter((s) => s.verified).length,
      requests: requests.length,
      claims: claims.length,
      active: sellers.filter((s) => s.active).length,
      flagged: sellers.filter((s) => s.flagged).length,
      inactive: sellers.filter((s) => s.inactive).length,
      suspended: sellers.filter((s) => s.suspended).length,
    }),
    [sellers, requests, claims],
  );

  const filtered = useMemo(() => {
    let rows = sellers;
    if (filter === 'verified') rows = rows.filter((s) => s.verified);
    else if (filter === 'active') rows = rows.filter((s) => s.active);
    else if (filter === 'flagged') rows = rows.filter((s) => s.flagged);
    else if (filter === 'inactive') rows = rows.filter((s) => s.inactive);
    else if (filter === 'suspended') rows = rows.filter((s) => s.suspended);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((s) => {
        const hay = [
          s.displayName,
          s.email,
          s.cfId,
          ...s.brands.map((b) => b.name),
          ...s.brands.map((b) => b.brandReferenceId || ''),
          ...s.brands.map((b) => b.category),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...rows].sort((a, b) => {
      if (sort === 'az') return a.displayName.localeCompare(b.displayName);
      if (sort === 'za') return b.displayName.localeCompare(a.displayName);
      if (sort === 'new') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    return sorted;
  }, [sellers, filter, search, sort]);

  useEffect(() => setPage(1), [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const setFilter = (f: SellerFilter) => {
    const next = new URLSearchParams(searchParams);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    setSearchParams(next);
  };

  const openSellerProfile = (seller: SellerRow) => {
    // Real Seller Profile page (src/pages/admin/SellerProfile.tsx) -- replaces the
    // legacy CmsMirrorHost destination, which was driven by a hardcoded fixture with
    // no real seller ids and rendered permanently blank.
    navigate(`/admin/seller-profile?sellerId=${encodeURIComponent(seller.sellerId)}`);
  };

  const isRequestsView = filter === 'requests';
  const isClaimsView = filter === 'claims';

  const columns: DataTableColumn<SellerRow>[] = [
    {
      key: 'seller',
      header: 'Seller',
      sortValue: (s) => s.displayName,
      render: (s) => (
        <button
          type="button"
          onClick={() => openSellerProfile(s)}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <Avatar src={s.avatarUrl} name={s.displayName} size={36} />
          <div>
            <div className="text-xs font-bold text-app-text-primary flex items-center gap-1.5">
              {s.displayName}
              {s.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <div className="text-[10px] text-app-text-secondary">{s.email}</div>
          </div>
        </button>
      ),
    },
    {
      key: 'cfId',
      header: 'Seller CF ID',
      sortValue: (s) => s.cfId,
      render: (s) => <span className="font-mono text-xs font-bold">{s.cfId}</span>,
    },
    {
      key: 'brands',
      header: 'Owned Brands',
      render: (s) => (
        <div className="flex flex-col gap-0.5">
          {s.brands.slice(0, 2).map((b) => (
            <span key={b.id} className="text-[11px] text-app-text-primary">
              {b.name}{' '}
              <span className="font-mono text-[9px] text-app-text-secondary">{b.brandReferenceId || '—'}</span>
            </span>
          ))}
          {s.brands.length > 2 && (
            <span className="text-[10px] text-app-text-secondary">+{s.brands.length - 2} more</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.suspended && (
            <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded border bg-red-500/10 text-red-500 border-red-500/20">
              Suspended
            </span>
          )}
          {s.flagged && (
            <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded border bg-amber-500/10 text-amber-600 border-amber-500/20">
              Flagged
            </span>
          )}
          {s.active && (
            <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              Active
            </span>
          )}
          {s.inactive && !s.suspended && (
            <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded border bg-slate-500/10 text-slate-500 border-slate-500/20">
              Inactive
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (s) => s.createdAt || '',
      render: (s) => <span className="text-xs text-app-text-secondary">{s.createdAt ? s.createdAt.slice(0, 10) : '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <button
          type="button"
          onClick={() => openSellerProfile(s)}
          className="p-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded-lg transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
        >
          View Profile <ExternalLink className="w-3 h-3" />
        </button>
      ),
    },
  ];

  return (
    <div className="aws-page space-y-5 text-left text-app-text-primary">
      <div className="aws-page-card p-5 space-y-1">
        <h1 className="text-[20px] font-extrabold tracking-tight">Seller Management Studio</h1>
        <p className="text-app-text-secondary text-[12.5px]">
          Unified seller & brand monitoring directory — real accounts, real verification, real marketplace status.
        </p>
      </div>

      {/* KPI cards -- same canonical counts the filters below use */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Total Sellers</div>
          <div className="text-2xl font-black mt-1.5">{counts.all}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Verified Sellers</div>
          <div className="text-2xl font-black mt-1.5 text-emerald-500">{counts.verified}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Requests</div>
          <div className="text-2xl font-black mt-1.5 text-app-accent">{counts.requests}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Ownership Claims</div>
          <div className="text-2xl font-black mt-1.5">{counts.claims}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="aws-page-card p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3.5 py-2 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all shrink-0 ${
              filter === t.key ? 'bg-app-accent text-white' : 'text-app-text-secondary hover:bg-[#F1F3F5]'
            }`}
          >
            {t.label} ({counts[t.key as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="aws-page-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96 bg-[#F8F9FB] border border-app-border rounded-xl flex items-center px-3.5 gap-2.5">
          <Search className="w-4 h-4 text-app-text-secondary" />
          <input
            placeholder="Search by Seller, CF ID, brand, BR ID or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 py-2.5 text-xs bg-transparent outline-none text-app-text-primary"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="bg-white border border-app-border rounded-lg px-3 py-2 text-xs font-bold"
        >
          <option value="az">Name: A → Z</option>
          <option value="za">Name: Z → A</option>
          <option value="new">Joined: Newest First</option>
          <option value="old">Joined: Oldest First</option>
        </select>
      </div>

      {error && (
        <div className="aws-page-card p-4 flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {isRequestsView ? (
        <div className="aws-page-card overflow-hidden">
          {requests.length === 0 ? (
            <p className="p-10 text-center text-xs text-app-text-secondary">No pending seller requests.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {requests.map((r) => {
                const targetSellerId = r.provisionedUserId || r.existingUserId;
                const content = (
                  <>
                    <div>
                      <div className="text-xs font-bold">{r.displayName}</div>
                      <div className="text-[10.5px] text-app-text-secondary">{r.businessOrChannelName} · {r.email}</div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-600 shrink-0">
                      {r.resubmissionRequested ? 'Resubmission requested' : 'Under review'}
                    </span>
                  </>
                );
                return targetSellerId ? (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/admin/seller-profile?sellerId=${encodeURIComponent(targetSellerId)}`)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-app-accent/5 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={r.id}
                    className="p-4 flex items-center justify-between gap-3"
                    title="No provisioned seller account yet — not linked to a profile"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isClaimsView ? (
        <div className="aws-page-card overflow-hidden">
          {claims.length === 0 ? (
            <p className="p-10 text-center text-xs text-app-text-secondary">No pending ownership claims.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {claims.map((c) => {
                const brand = brands.find((b) => b.id === (c.entityId || c.brand_id));
                const content = (
                  <>
                    <div>
                      <div className="text-xs font-bold">{brand?.name || c.entityId}</div>
                      <div className="text-[10.5px] text-app-text-secondary">
                        {brand?.brandReferenceId || '—'} · submitted {c.created_at?.slice(0, 10) || '—'}
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-600 shrink-0">
                      {c.status}
                    </span>
                  </>
                );
                return brand?.sellerId ? (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/admin/seller-profile?sellerId=${encodeURIComponent(brand.sellerId as string)}`)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-app-accent/5 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={c.id}
                    className="p-4 flex items-center justify-between gap-3"
                    title="No linked seller account — not linked to a profile"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="aws-page-card overflow-hidden">
          <DataTable
            columns={columns}
            rows={paged}
            getRowId={(s) => s.sellerId}
            isLoading={loading}
            loadingMessage="Loading sellers..."
            emptyMessage="No sellers match your active filters."
          />
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-app-border text-xs">
              <span className="text-app-text-secondary">
                Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-app-border disabled:opacity-40 font-bold"
                >
                  Prev
                </button>
                <span className="font-mono">{clampedPage} / {totalPages}</span>
                <button
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-app-border disabled:opacity-40 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-app-text-secondary text-xs py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading real seller data…
        </div>
      )}
    </div>
  );
}
