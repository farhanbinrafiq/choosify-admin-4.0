import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Loader2, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import { operationsApi, type OpsVerification, type OpsPartnerApplication } from '../../services/operationsApi';
import { moderationApi, type ReportItem } from '../../services/moderationApi';
import type { CatalogCreator } from '../../types/catalog';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Avatar } from '../../components/shared/Avatar';

/**
 * Super Admin Creator Management — real React replacement for the legacy
 * CmsMirrorHost "Creators Management" directory.
 *
 * Canonical data sources (see audit; no fabricated state):
 *  - Creators: `GET /catalog/creators` (CatalogCreator).
 *  - Identity (CF ID / email): `GET /auth/users/directory`, matched on `CatalogCreator.userId`.
 *  - Requests: `GET /operations/partner-applications?status=pending` (applicantType==='creator').
 *  - Ownership Claims: `GET /operations/verifications?entityType=creator&status=pending`.
 *  - Pending Review / Active Creators / Inactive: `CatalogCreator.status` --
 *    'draft' -> Pending Review, 'live' -> Active Creators, 'archived' -> Inactive.
 *    This is the ONLY real lifecycle enum on the creator model.
 *  - Flagged: same real moderation-reports cross-reference as Seller Management
 *    (`resourceOwnerId` / `resourceType==='creator'`), single bulk request.
 *  - "Suspended" and "Banned" were REMOVED: no authoritative creator status of
 *    either kind exists anywhere in the backend (CatalogCreator.status is only
 *    draft|live|archived) -- the legacy mirror's "Suspended" tab compared
 *    against a string ('Suspended') the real enum can never produce, so it was
 *    permanently stuck at 0. Not reintroduced here.
 */

type CreatorFilter = 'all' | 'pending' | 'requests' | 'claims' | 'active' | 'flagged' | 'inactive';

interface CreatorRow {
  id: string;
  userId: string | null;
  cfId: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
  status: 'draft' | 'live' | 'archived';
  verified: boolean;
  flagged: boolean;
  createdAt: string;
}

const FILTER_TABS: { key: CreatorFilter; label: string }[] = [
  { key: 'all', label: 'All Creators' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'requests', label: 'Requests' },
  { key: 'claims', label: 'Ownership Claims' },
  { key: 'active', label: 'Active Creators' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'inactive', label: 'Inactive' },
];

export default function CreatorManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('filter') as CreatorFilter) || 'all';
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState<'az' | 'za' | 'new' | 'old'>('az');

  const [creators, setCreators] = useState<CatalogCreator[]>([]);
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
        const [creatorsRes, usersRes, requestsRes, claimsRes, openReports, investigatingReports] = await Promise.all([
          catalogApi.listCreators(),
          authApi.getUsersDirectory(),
          operationsApi.listPartnerApplications('pending'),
          operationsApi.listVerifications({ entityType: 'creator', status: 'pending' }),
          moderationApi.listReports({ status: 'open' }),
          moderationApi.listReports({ status: 'investigating' }),
        ]);
        if (cancelled) return;
        setCreators(creatorsRes);
        setUsers(usersRes);
        setRequests(requestsRes.filter((r) => r.applicantType === 'creator'));
        setClaims(claimsRes);
        setReports([...openReports, ...investigatingReports]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load creator data.');
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

  const flaggedCreatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reports) {
      if (r.resourceOwnerId) ids.add(r.resourceOwnerId);
      if (r.resourceType === 'creator') ids.add(r.resourceId);
    }
    return ids;
  }, [reports]);

  const rows: CreatorRow[] = useMemo(
    () =>
      creators.map((c) => {
        const user = c.userId ? usersById.get(c.userId) : undefined;
        return {
          id: c.id,
          userId: c.userId || null,
          cfId: user?.choosifyUserId || '—',
          name: c.name,
          handle: c.handle || '—',
          email: user?.email || c.email || '—',
          avatarUrl: c.avatar || user?.avatarUrl || null,
          status: c.status,
          verified: !!c.verifiedStatus,
          flagged:
            flaggedCreatorIds.has(c.id) || (c.userId ? flaggedCreatorIds.has(c.userId) : false),
          createdAt: c.createdAt,
        };
      }),
    [creators, usersById, flaggedCreatorIds],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === 'draft').length,
      requests: requests.length,
      claims: claims.length,
      active: rows.filter((r) => r.status === 'live').length,
      flagged: rows.filter((r) => r.flagged).length,
      inactive: rows.filter((r) => r.status === 'archived').length,
    }),
    [rows, requests, claims],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'pending') list = list.filter((r) => r.status === 'draft');
    else if (filter === 'active') list = list.filter((r) => r.status === 'live');
    else if (filter === 'inactive') list = list.filter((r) => r.status === 'archived');
    else if (filter === 'flagged') list = list.filter((r) => r.flagged);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.name, r.handle, r.email, r.cfId].join(' ').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'az') return a.name.localeCompare(b.name);
      if (sort === 'za') return b.name.localeCompare(a.name);
      if (sort === 'new') return b.createdAt.localeCompare(a.createdAt);
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [rows, filter, search, sort]);

  useEffect(() => setPage(1), [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const setFilter = (f: CreatorFilter) => {
    const next = new URLSearchParams(searchParams);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    setSearchParams(next);
  };

  const openCreatorProfile = (creator: CreatorRow) => {
    // Real Creator Profile page (src/pages/admin/CreatorProfile.tsx) -- replaces the
    // legacy CmsMirrorHost destination, which was driven by a hardcoded fixture with
    // no real creator ids and rendered permanently blank.
    navigate(`/admin/creator-review?creatorId=${encodeURIComponent(creator.id)}`);
  };

  const isRequestsView = filter === 'requests';
  const isClaimsView = filter === 'claims';

  const statusLabel: Record<CreatorRow['status'], string> = {
    draft: 'Pending Review',
    live: 'Active',
    archived: 'Inactive',
  };
  const statusStyle: Record<CreatorRow['status'], string> = {
    draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    live: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    archived: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };

  const columns: DataTableColumn<CreatorRow>[] = [
    {
      key: 'creator',
      header: 'Creator',
      sortValue: (r) => r.name,
      render: (r) => (
        <button
          type="button"
          onClick={() => openCreatorProfile(r)}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          <Avatar src={r.avatarUrl} name={r.name} size={36} />
          <div>
            <div className="text-xs font-bold text-app-text-primary flex items-center gap-1.5">
              {r.name}
              {r.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <div className="text-[10px] text-app-text-secondary">{r.handle}</div>
          </div>
        </button>
      ),
    },
    {
      key: 'cfId',
      header: 'Creator CF ID',
      sortValue: (r) => r.cfId,
      render: (r) => <span className="font-mono text-xs font-bold">{r.cfId}</span>,
    },
    { key: 'email', header: 'Email', render: (r) => <span className="text-xs text-app-text-secondary">{r.email}</span> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => (
        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${statusStyle[r.status]}`}>
          {statusLabel[r.status]}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="text-xs text-app-text-secondary">{r.createdAt?.slice(0, 10) || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => openCreatorProfile(r)}
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
        <h1 className="text-[20px] font-extrabold tracking-tight">Creators Management</h1>
        <p className="text-app-text-secondary text-[12.5px]">
          Real creator directory — publication status, requests, ownership claims and moderation state.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Total Creators</div>
          <div className="text-2xl font-black mt-1.5">{counts.all}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Active Creators</div>
          <div className="text-2xl font-black mt-1.5 text-emerald-500">{counts.active}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Pending Review</div>
          <div className="text-2xl font-black mt-1.5 text-app-accent">{counts.pending}</div>
        </div>
        <div className="aws-page-card p-4">
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Flagged</div>
          <div className="text-2xl font-black mt-1.5 text-amber-600">{counts.flagged}</div>
        </div>
      </div>

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

      <div className="aws-page-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96 bg-[#F8F9FB] border border-app-border rounded-xl flex items-center px-3.5 gap-2.5">
          <Search className="w-4 h-4 text-app-text-secondary" />
          <input
            placeholder="Search by creator name, handle, email or CF ID..."
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
            <p className="p-10 text-center text-xs text-app-text-secondary">No pending creator requests.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {requests.map((r) => {
                const targetCreatorId = r.catalogEntityId;
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
                return targetCreatorId ? (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/admin/creator-review?creatorId=${encodeURIComponent(targetCreatorId)}`)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-app-accent/5 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={r.id}
                    className="p-4 flex items-center justify-between gap-3"
                    title="No provisioned creator record yet — not linked to a profile"
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
                const creator = creators.find((cr) => cr.id === c.entityId);
                const content = (
                  <>
                    <div>
                      <div className="text-xs font-bold">{creator?.name || c.entityId}</div>
                      <div className="text-[10.5px] text-app-text-secondary">
                        submitted {c.created_at?.slice(0, 10) || '—'}
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-600 shrink-0">
                      {c.status}
                    </span>
                  </>
                );
                return creator ? (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/admin/creator-review?creatorId=${encodeURIComponent(creator.id)}`)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-app-accent/5 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={c.id}
                    className="p-4 flex items-center justify-between gap-3"
                    title="No linked creator record — not linked to a profile"
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
            getRowId={(r) => r.id}
            isLoading={loading}
            loadingMessage="Loading creators..."
            emptyMessage="No creators match your active filters."
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
          <Loader2 className="w-4 h-4 animate-spin" /> Loading real creator data…
        </div>
      )}
    </div>
  );
}
