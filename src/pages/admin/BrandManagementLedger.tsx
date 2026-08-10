import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Plus, Search, Sliders } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import { operationsApi } from '../../services/operationsApi';
import type { CatalogBrand, CatalogMarketplaceStatus } from '../../types/catalog';

type LedgerTab =
  | 'all'
  | 'verified'
  | 'requests'
  | 'activeSellers'
  | 'claims'
  | 'flagged'
  | 'inactive'
  | 'suspended'
  | 'banned';

type OwnershipLabel = 'VERIFIED OWNER' | 'OWNERSHIP PENDING' | 'UNCLAIMED';

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'FLAGGED'
  | 'OWNERSHIP_PENDING'
  | 'VERIFIED'
  | 'UNCLAIMED';

type SortKey = 'az' | 'za' | 'new' | 'old';

type VerificationRow = {
  id: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  brand_id?: string;
  brand_name?: string;
  submitted_by?: string;
  submitted_by_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

function ownershipFromBrand(b: CatalogBrand): OwnershipLabel {
  if (b.claimStatus === 'verified' || b.verifiedStatus) return 'VERIFIED OWNER';
  if (b.claimStatus === 'pending') return 'OWNERSHIP PENDING';
  return 'UNCLAIMED';
}

function marketplaceStatusOf(b: CatalogBrand): CatalogMarketplaceStatus {
  if (b.marketplaceStatus) return b.marketplaceStatus;
  return b.marketplaceAccess ? 'granted' : 'not_granted';
}

function isMarketplaceOn(status: CatalogMarketplaceStatus): boolean {
  return status === 'granted' || status === 'restored';
}

function accessLabel(status: CatalogMarketplaceStatus): { label: string; color: string } {
  switch (status) {
    case 'granted':
    case 'restored':
      return { label: 'Active', color: '#16A34A' };
    case 'suspended':
      return { label: 'Suspended', color: '#DC2626' };
    case 'restricted':
      return { label: 'Restricted', color: '#B45309' };
    case 'revoked':
      return { label: 'Revoked', color: '#DC2626' };
    case 'not_granted':
    default:
      return { label: 'Inactive', color: '#9CA3AF' };
  }
}

function formatUnavailable(): string {
  return '—';
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'B'
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 10,
  fontWeight: 800,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '14px',
  fontSize: 12.5,
  color: '#111827',
  verticalAlign: 'middle',
};

const tdMuted: React.CSSProperties = {
  ...tdStyle,
  color: '#6B7280',
  fontWeight: 600,
};

/**
 * Admin / Super Admin platform Brand ledger.
 * Visual source: CmsMirror Brands Management Studio + Sellers.tsx structure.
 * Data: live catalog + operations verification APIs (Sprint 2). Seller Brand Studio is separate.
 */
export default function BrandManagementLedger() {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<LedgerTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<SortKey>('az');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<CatalogBrand | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brandRows, verificationRows] = await Promise.all([
        catalogApi.listBrands(),
        operationsApi.listVerifications({ entityType: 'brand' }).catch(() => [] as unknown[]),
      ]);
      setBrands(brandRows);
      setVerifications(Array.isArray(verificationRows) ? (verificationRows as VerificationRow[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand ledger');
      setBrands([]);
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const pendingClaims = useMemo(
    () =>
      verifications.filter((v) =>
        ['Submitted', 'Under Review', 'Draft'].includes(String(v.status || '')),
      ),
    [verifications],
  );

  const awaitingReview = useMemo(
    () => verifications.filter((v) => ['Submitted', 'Under Review'].includes(String(v.status || ''))),
    [verifications],
  );

  const stats = useMemo(() => {
    const unclaimed = brands.filter((b) => ownershipFromBrand(b) === 'UNCLAIMED').length;
    const verified = brands.filter((b) => ownershipFromBrand(b) === 'VERIFIED OWNER').length;
    return [
      {
        label: 'Unclaimed Profiles',
        value: String(unclaimed),
        color: '#DC2626',
        sub: 'SEO Index Enabled',
      },
      {
        label: 'Claims Awaiting Review',
        value: String(awaitingReview.length),
        color: '#B45309',
        sub: 'Pending Desk SLA',
      },
      {
        label: 'Verified Ownerships',
        value: String(verified),
        color: '#16A34A',
        sub: 'Secure Connection',
      },
      {
        label: 'Consolidated Listings',
        value: String(brands.length),
        color: '#2563EB',
        sub: 'Active & Cataloged',
      },
    ];
  }, [brands, awaitingReview.length]);

  const enriched = useMemo(() => {
    return brands.map((b) => {
      const ownership = ownershipFromBrand(b);
      const mStatus = marketplaceStatusOf(b);
      const access = accessLabel(mStatus);
      return {
        brand: b,
        ownership,
        mStatus,
        access,
        isVerifiedOwner: ownership === 'VERIFIED OWNER',
        isPending: ownership === 'OWNERSHIP PENDING',
        isUnclaimed: ownership === 'UNCLAIMED',
        isSuspended: mStatus === 'suspended',
        isBanned: mStatus === 'revoked',
        isInactive: mStatus === 'not_granted' || mStatus === 'restricted',
        isActiveSeller:
          Boolean(b.sellerId) &&
          isMarketplaceOn(mStatus) &&
          (b.verifiedStatus || b.claimStatus === 'verified'),
        isFlagged: false,
        representative: b.sellerId
          ? b.overview?.phone
            ? `Seller · ${b.overview.phone}`
            : `Seller · ${b.sellerId.slice(0, 10)}`
          : 'Unclaimed Pre-Merchant',
        summary: b.tagline || b.description || `${b.name} — ${b.category}`,
        trustLabel:
          typeof b.ratings === 'number' && b.ratings > 0
            ? `${Math.round(b.ratings <= 5 ? b.ratings * 20 : b.ratings)}/100`
            : formatUnavailable(),
        fulfillmentLabel: formatUnavailable(),
        revenueLabel: formatUnavailable(),
        lastActiveLabel: b.updatedAt
          ? new Date(b.updatedAt).toLocaleString()
          : formatUnavailable(),
        tradeDoc: '',
      };
    });
  }, [brands]);

  const tabDefs = useMemo(() => {
    return [
      { key: 'all' as const, icon: '👥', label: 'All Brands', count: enriched.length },
      {
        key: 'verified' as const,
        icon: '✔️',
        label: 'Verified Brands',
        count: enriched.filter((r) => r.isVerifiedOwner).length,
      },
      { key: 'requests' as const, icon: '🆕', label: 'Requests', count: awaitingReview.length },
      {
        key: 'activeSellers' as const,
        icon: '🏪',
        label: 'Active Sellers',
        count: enriched.filter((r) => r.isActiveSeller).length,
      },
      { key: 'claims' as const, icon: '📋', label: 'Ownership Claims', count: pendingClaims.length },
      { key: 'flagged' as const, icon: '🚩', label: 'Flagged', count: 0 },
      {
        key: 'inactive' as const,
        icon: '⏸️',
        label: 'Inactive',
        count: enriched.filter((r) => r.isInactive).length,
      },
      {
        key: 'suspended' as const,
        icon: '🔒',
        label: 'Suspended',
        count: enriched.filter((r) => r.isSuspended).length,
      },
      {
        key: 'banned' as const,
        icon: '🚫',
        label: 'Banned',
        count: enriched.filter((r) => r.isBanned).length,
      },
    ];
  }, [enriched, awaitingReview.length, pendingClaims.length]);

  const showTable = tab !== 'requests' && tab !== 'claims';

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = enriched.filter((r) => {
      if (tab === 'verified') return r.isVerifiedOwner;
      if (tab === 'activeSellers') return r.isActiveSeller;
      if (tab === 'flagged') return r.isFlagged;
      if (tab === 'inactive') return r.isInactive;
      if (tab === 'suspended') return r.isSuspended;
      if (tab === 'banned') return r.isBanned;
      return true;
    });

    if (statusFilter !== 'ALL') {
      rows = rows.filter((r) => {
        if (statusFilter === 'ACTIVE') return isMarketplaceOn(r.mStatus);
        if (statusFilter === 'SUSPENDED') return r.isSuspended;
        if (statusFilter === 'FLAGGED') return r.isFlagged;
        if (statusFilter === 'OWNERSHIP_PENDING') return r.isPending;
        if (statusFilter === 'VERIFIED') return r.isVerifiedOwner;
        if (statusFilter === 'UNCLAIMED') return r.isUnclaimed;
        return true;
      });
    }

    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.brand.name,
          r.brand.category,
          r.representative,
          r.brand.sellerId || '',
          r.summary,
          r.tradeDoc,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    rows = [...rows].sort((a, b) => {
      if (sort === 'az') return a.brand.name.localeCompare(b.brand.name);
      if (sort === 'za') return b.brand.name.localeCompare(a.brand.name);
      if (sort === 'new') return (b.brand.createdAt || '').localeCompare(a.brand.createdAt || '');
      if (sort === 'old') return (a.brand.createdAt || '').localeCompare(b.brand.createdAt || '');
      return 0;
    });

    return rows;
  }, [enriched, tab, statusFilter, search, sort]);

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.brand.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredRows.map((r) => r.brand.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyMarketplace = async (brand: CatalogBrand, status: CatalogMarketplaceStatus) => {
    setBusyId(brand.id);
    try {
      const result = await catalogApi.setBrandMarketplaceAccess(brand.id, status);
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? result.data : b)));
      const label = accessLabel(status).label;
      showToast(
        result.warning
          ? `${brand.name}: ${label}. Warning: ${result.warning}`
          : `${brand.name} Marketplace Access → ${label}`,
      );
    } catch (err) {
      showToast(
        `Marketplace Access update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusyId(null);
      setSuspendTarget(null);
    }
  };

  const onToggleAccess = (row: (typeof enriched)[number]) => {
    if (isMarketplaceOn(row.mStatus)) {
      setSuspendTarget(row.brand);
      return;
    }
    const next: CatalogMarketplaceStatus =
      row.mStatus === 'suspended' || row.mStatus === 'restricted' || row.mStatus === 'revoked'
        ? 'restored'
        : 'granted';
    void applyMarketplace(row.brand, next);
  };

  const reviewClaim = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await operationsApi.reviewVerification(id, {
        status: decision,
        feedback: decision === 'approved' ? 'Ownership claim approved by admin ledger.' : 'Ownership claim rejected by admin ledger.',
        reviewer_name: profile?.displayName || profile?.email || 'Admin',
      });
      showToast(decision === 'approved' ? 'Claim approved' : 'Claim rejected');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Review failed');
    }
  };

  const ownershipStyle = (ownership: OwnershipLabel): React.CSSProperties => {
    if (ownership === 'VERIFIED OWNER') {
      return {
        background: '#F0FDF4',
        color: '#15803D',
        fontSize: 9.5,
        fontWeight: 800,
        padding: '4px 9px',
        borderRadius: 6,
      };
    }
    if (ownership === 'OWNERSHIP PENDING') {
      return {
        background: '#FFFBEB',
        color: '#B45309',
        fontSize: 9.5,
        fontWeight: 800,
        padding: '4px 9px',
        borderRadius: 6,
      };
    }
    return {
      background: '#F3F4F6',
      color: '#6B7280',
      fontSize: 9.5,
      fontWeight: 800,
      padding: '4px 9px',
      borderRadius: 6,
    };
  };

  // Seller Brand Studio is a separate route entry; this ledger is Admin-only.
  if (profile && !isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-300">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-[100] bg-[#0A0A1F] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl border border-white/10">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[15.5px] font-extrabold text-app-text-primary m-0 tracking-tight">
              Seller Management Studio
            </h1>
            <span className="bg-[#F3F4F6] text-[#6B7280] text-[9px] font-extrabold px-2.5 py-1 rounded-md tracking-wide uppercase">
              Workspace Consolidation
            </span>
          </div>
          <p className="text-[12px] text-[#6B7280] font-semibold mt-1 mb-0">
            Unified brand monitoring directory, pre-merchant SEO profiles builder, claimable funnels,
            and corporate verification checks.
          </p>
        </div>
        <Link
          to="/admin/brand-studio/new"
          className="inline-flex items-center justify-center gap-1.5 px-[18px] py-[11px] rounded-lg text-[12.5px] font-extrabold text-white shrink-0 no-underline"
          style={{ background: '#EF3C23' }}
        >
          <Plus className="w-4 h-4" /> Create Brand Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {stats.map((st) => (
          <div key={st.label} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
            <div className="text-[10px] font-extrabold tracking-wide mb-2" style={{ color: st.color }}>
              ■ {st.label}
            </div>
            <div className="text-[22px] font-extrabold text-[#111827] mb-2">{loading ? '…' : st.value}</div>
            <div className="h-1 rounded-full bg-[#F1F3F5] overflow-hidden mb-1.5">
              <div className="h-full w-3/5" style={{ background: st.color }} />
            </div>
            <div className="text-[10px] text-[#9CA3AF] font-semibold">{st.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 bg-white border border-[#E8EDF2] rounded-[10px] p-2 overflow-x-auto">
        {tabDefs.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className="px-4 py-2.5 rounded-lg text-[11.5px] font-extrabold whitespace-nowrap border-0 cursor-pointer"
              style={
                active
                  ? { background: '#EF3C23', color: '#fff' }
                  : { background: 'transparent', color: '#374151' }
              }
            >
              {tb.icon} {tb.label} ({loading ? '…' : tb.count})
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-[10px] px-4 py-3 text-[12px] font-semibold">
          {error}{' '}
          <button type="button" className="underline bg-transparent border-0 text-red-700 cursor-pointer" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {showTable ? (
        <>
          <div className="flex flex-wrap gap-2.5 bg-white border border-[#E8EDF2] rounded-[10px] p-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Brand, Seller, representative name, category or trade license doc id..."
                className="w-full h-[38px] rounded-lg border border-[#E8EDF2] pl-10 pr-3 text-[12.5px] outline-none focus:border-[#EF3C23]"
              />
            </div>
            <div className="flex items-center gap-2 h-[38px] px-3 rounded-lg border border-[#E8EDF2] bg-white">
              <Sliders className="w-3.5 h-3.5 text-[#9CA3AF]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-full border-0 bg-transparent text-[12px] font-bold text-[#111827] outline-none cursor-pointer"
              >
                <option value="ALL">STATUS: ALL LEDGER</option>
                <option value="ACTIVE">Active Merchant</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="FLAGGED">Flagged / Incidents</option>
                <option value="OWNERSHIP_PENDING">Ownership Pending</option>
                <option value="VERIFIED">Verified Owner</option>
                <option value="UNCLAIMED">Unclaimed profiles</option>
              </select>
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-[38px] rounded-lg border border-[#E8EDF2] px-3 text-[12px] text-[#111827] bg-white outline-none"
            >
              <option value="az">Name: A → Z</option>
              <option value="za">Name: Z → A</option>
              <option value="new">Joined: Newest First</option>
              <option value="old">Joined: Oldest First</option>
            </select>
          </div>

          {selectedIds.size > 0 ? (
            <div
              className="flex justify-between items-center rounded-lg px-4 py-3 flex-wrap gap-2.5 text-white"
              style={{
                background:
                  'radial-gradient(1200px 500px at 15% 0%,hsla(22,100%,50%,0.18),transparent 65%),radial-gradient(900px 500px at 90% 20%,hsla(12,92%,45%,0.14),transparent 65%),rgba(10,10,31,0.96)',
              }}
            >
              <span className="bg-[rgba(255,91,0,0.25)] text-[#EF3C23] px-2.5 py-1 rounded-md text-[11px] font-extrabold">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="bg-transparent border-0 text-white/70 text-[10.5px] font-bold cursor-pointer"
              >
                ✕ Clear
              </button>
            </div>
          ) : null}

          <div className="bg-white border border-[#E8EDF2] rounded-lg overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th style={{ ...thStyle, width: 40 }}>Sl.</th>
                  <th style={thStyle}>Brand / Business Name</th>
                  <th style={thStyle}>Representative Seller</th>
                  <th style={thStyle}>Ownership Status</th>
                  <th style={thStyle}>Brand Summary</th>
                  <th style={thStyle}>Trust Score</th>
                  <th style={thStyle}>Fulfillment</th>
                  <th style={thStyle}>Revenue</th>
                  <th style={thStyle}>Last Active</th>
                  <th style={thStyle}>Marketplace Access</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ ...tdMuted, textAlign: 'center', padding: 40 }}>
                      Loading platform brand ledger…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ ...tdMuted, textAlign: 'center', padding: 40, fontStyle: 'italic' }}>
                      No records found in Brand Management Studio matching criteria
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const on = isMarketplaceOn(row.mStatus);
                    return (
                      <tr
                        key={row.brand.id}
                        className="border-t border-[#F1F3F5] hover:bg-[#FAFBFC]"
                      >
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.brand.id)}
                            onChange={() => toggleSelect(row.brand.id)}
                          />
                        </td>
                        <td style={tdMuted}>{idx + 1}</td>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[12px] font-extrabold shrink-0 overflow-hidden"
                              style={{ background: 'linear-gradient(135deg,#000435,#111827)' }}
                            >
                              {row.brand.logo ? (
                                <img src={row.brand.logo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                initials(row.brand.name)
                              )}
                            </div>
                            <div>
                              <Link
                                to={`/admin/brand-detail/${row.brand.id}?name=${encodeURIComponent(row.brand.name)}`}
                                className="font-bold text-[#EF3C23] hover:underline no-underline"
                              >
                                {row.brand.name}
                              </Link>
                              <div className="text-[10px] text-[#9CA3AF] font-bold">{row.brand.category}</div>
                            </div>
                          </div>
                        </td>
                        <td style={tdMuted}>{row.representative}</td>
                        <td style={tdStyle}>
                          <span style={ownershipStyle(row.ownership)}>{row.ownership}</span>
                        </td>
                        <td style={{ ...tdMuted, maxWidth: 220 }} className="truncate" title={row.summary}>
                          {row.summary}
                        </td>
                        <td style={tdStyle}>{row.trustLabel}</td>
                        <td style={tdMuted}>{row.fulfillmentLabel}</td>
                        <td style={tdStyle}>{row.revenueLabel}</td>
                        <td style={tdMuted}>{row.lastActiveLabel}</td>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.brand.id}
                              onClick={() => onToggleAccess(row)}
                              title={`Lifecycle: ${row.mStatus}`}
                              className="relative shrink-0 border-0 cursor-pointer disabled:opacity-50"
                              style={{
                                width: 38,
                                height: 20,
                                borderRadius: 99,
                                background: on ? '#16A34A' : '#D1D5DB',
                              }}
                            >
                              <span
                                className="absolute top-0.5 block rounded-full bg-white shadow"
                                style={{
                                  width: 16,
                                  height: 16,
                                  right: on ? 2 : undefined,
                                  left: on ? undefined : 2,
                                }}
                              />
                            </button>
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: row.access.color }}
                              title={row.mStatus}
                            >
                              {row.access.label}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'requests' ? (
        <div className="flex flex-col gap-3.5">
          {awaitingReview.length === 0 ? (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-10 text-center text-[#9CA3AF] text-[12.5px] font-semibold italic">
              No new brand registration / verification requests.
            </div>
          ) : (
            awaitingReview.map((rq) => (
              <div key={rq.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div>
                    <div className="text-[14px] font-extrabold text-[#111827]">
                      {rq.entityName || rq.brand_name || 'Brand request'}
                    </div>
                    <div className="text-[11.5px] text-[#9CA3AF] font-semibold mt-0.5">
                      Application ID:{' '}
                      <span className="text-[#EF3C23] font-extrabold">{rq.id}</span>
                    </div>
                  </div>
                  <span className="bg-[#EFF6FF] text-[#2563EB] text-[9.5px] font-extrabold px-2.5 py-1 rounded-md">
                    {rq.status || 'Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11.5px]">
                  <div>
                    <div className="text-[9px] font-extrabold text-[#9CA3AF]">SUBMITTED BY</div>
                    <div className="font-bold mt-0.5">
                      {rq.submitted_by_name || rq.submitted_by || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold text-[#9CA3AF]">CREATED</div>
                    <div className="font-bold mt-0.5">
                      {rq.created_at ? new Date(rq.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold text-[#9CA3AF]">ENTITY</div>
                    <div className="font-bold mt-0.5">{rq.entityId || rq.brand_id || '—'}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'claims' ? (
        <div className="flex flex-col gap-3.5">
          {pendingClaims.length === 0 ? (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-10 text-center text-[#9CA3AF] text-[12.5px] font-semibold italic">
              No ownership claims awaiting review.
            </div>
          ) : (
            pendingClaims.map((c) => (
              <div key={c.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                <div className="flex flex-wrap justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[14px] font-extrabold">
                      {c.brand_name || c.entityName || 'Brand claim'}
                    </div>
                    <div className="text-[11.5px] text-[#9CA3AF] font-semibold mt-0.5">
                      Claim ID: <span className="text-[#EF3C23] font-extrabold">{c.id}</span> · Status:{' '}
                      {c.status || '—'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(c.status === 'Submitted' || c.status === 'Under Review') && (
                      <>
                        <button
                          type="button"
                          onClick={() => void reviewClaim(c.id, 'rejected')}
                          className="px-3.5 py-2 rounded-lg text-[11.5px] font-extrabold bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewClaim(c.id, 'approved')}
                          className="px-3.5 py-2 rounded-lg text-[11.5px] font-extrabold bg-[#16A34A] border-0 text-white cursor-pointer"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {(c.entityId || c.brand_id) && (
                      <Link
                        to={`/admin/brand-detail/${c.entityId || c.brand_id}?name=${encodeURIComponent(c.entityName || c.brand_name || '')}`}
                        className="px-3.5 py-2 rounded-lg text-[11.5px] font-extrabold bg-white border border-[#E8EDF2] text-[#374151] no-underline"
                      >
                        Open Brand Profile
                      </Link>
                    )}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#6B7280] font-semibold">
                  Claimant: {c.submitted_by_name || c.submitted_by || '—'}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {suspendTarget ? (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] border border-[#E8EDF2] w-full max-w-md p-5 shadow-2xl">
            <div className="text-[15px] font-extrabold mb-1">Suspend Marketplace Access</div>
            <p className="text-[12.5px] text-[#6B7280] font-semibold mb-4">
              Suspend public marketplace visibility for <strong>{suspendTarget.name}</strong>? Seller
              ownership and Brand Studio editing remain intact (ES-005).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuspendTarget(null)}
                className="px-3.5 py-2 rounded-lg text-[11.5px] font-extrabold bg-white border border-[#E8EDF2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === suspendTarget.id}
                onClick={() => void applyMarketplace(suspendTarget, 'suspended')}
                className="px-3.5 py-2 rounded-lg text-[11.5px] font-extrabold bg-[#DC2626] text-white border-0 cursor-pointer disabled:opacity-50"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
