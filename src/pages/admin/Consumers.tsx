import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useContact } from '../../contexts/ContactInteractionContext';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, UserDirectoryEntry, UserDetail } from '../../services/authApi';
import { Badge } from '../../components/ui/Badge';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { BulkActionBar, BulkAction } from '../../components/ui/BulkActionBar';
import { StatTile } from '../../components/ui/StatTile';
import {
  Search,
  MoreVertical,
  Eye,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  ShieldCheck,
  IdCard,
  Users,
  Filter,
} from 'lucide-react';

// ============================================================================
// Real backend data — GET /auth/users/directory (bulk list) and
// GET /auth/users/:userId (single-account detail). See
// server/authRouter.ts:1419 / :1440 and src/services/authApi.ts.
// ============================================================================

type ViewRole = 'Consumer' | 'Creator' | 'Admin';

/** Non-partner platform staff roles bucketed into the "Admin" tab. */
const STAFF_ROLES = new Set([
  'admin',
  'super_admin',
  'moderator',
  'finance_manager',
  'support_agent',
  'marketing_manager',
]);

function roleGroup(role: string): ViewRole | 'Seller' | 'Other' {
  const r = (role || '').toLowerCase();
  if (r === 'consumer') return 'Consumer';
  if (r === 'creator') return 'Creator';
  if (r === 'seller') return 'Seller';
  if (STAFF_ROLES.has(r)) return 'Admin';
  return 'Other';
}

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

const RoleBadge = ({ role }: { role: string }) => {
  const group = roleGroup(role);
  const variants: Record<string, 'info' | 'accent' | 'success' | 'danger'> = {
    Consumer: 'info',
    Seller: 'accent',
    Creator: 'success',
    Admin: 'danger',
  };
  return <Badge variant={variants[group] || 'neutral'}>{role}</Badge>;
};

const PAGE_SIZE = 25;

export default function ConsumersPage() {
  const { profile, loading: authLoading } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('viewMode') || 'consumers';

  // Route Context Identification
  const isCreatorView = viewMode === 'creators';
  const isAdminView = viewMode === 'admins';
  const isConsumerView = viewMode === 'consumers' || (!isCreatorView && !isAdminView);

  // Active user type selection matches table listing path
  const currentViewRole: ViewRole = isCreatorView
    ? 'Creator'
    : isAdminView
      ? 'Admin'
      : 'Consumer';

  const { triggerMessage } = useContact();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ------------------------------------------------------------------------
  // Primary directory list — real GET /auth/users/directory
  // ------------------------------------------------------------------------
  const [directory, setDirectory] = useState<UserDirectoryEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const fetchDirectory = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const rows = await authApi.getUsersDirectory();
      setDirectory(rows);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load user directory.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Wait for the auth session to resolve before fetching — an unconditional
  // fetch on mount races the async session bootstrap and produces a
  // spurious first-paint 401 for every role including admin.
  useEffect(() => {
    if (authLoading || !profile) return;
    fetchDirectory();
  }, [authLoading, profile, fetchDirectory]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, viewMode]);

  // ------------------------------------------------------------------------
  // Single-account detail panel — real GET /auth/users/:userId
  // ------------------------------------------------------------------------
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const openDetail = async (uid: string) => {
    setActiveMenu(null);
    setDetailUserId(uid);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await authApi.getUserDetail(uid);
      setDetailData(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load account detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailUserId(null);
    setDetailData(null);
    setDetailError(null);
  };

  // ------------------------------------------------------------------------
  // Choosify User ID quick lookup — unrelated live search feature, kept as-is
  // (GET /auth/users/search, server/authRouter.ts:1386).
  // ------------------------------------------------------------------------
  const [cfLookup, setCfLookup] = useState<{
    uid: string;
    email: string;
    displayName: string;
    role: string;
    choosifyUserId: string;
  } | null>(null);
  const [cfLookupError, setCfLookupError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    const looksLikeCf =
      /^CF-\d+$/i.test(q) || (/^\d{1,9}$/.test(q) && Number(q) >= 1);
    if (!looksLikeCf) {
      setCfLookup(null);
      setCfLookupError(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await authApi.searchUser(q);
          if (cancelled) return;
          setCfLookupError(null);
          setCfLookup(data);
        } catch (err) {
          if (cancelled) return;
          setCfLookup(null);
          setCfLookupError(err instanceof Error ? err.message : 'No account found for this User ID');
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter based on currently active left sidebar route type
  const baseFiltered = useMemo(
    () => directory.filter((u) => roleGroup(u.role) === currentViewRole),
    [directory, currentViewRole],
  );

  const finalFiltered = useMemo(() => {
    const s = searchQuery.toLowerCase().trim();
    if (!s) return baseFiltered;
    return baseFiltered.filter((u) => {
      if (
        (u.displayName || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u.choosifyUserId || '').toLowerCase().includes(s)
      ) {
        return true;
      }
      // Numeric / CF-padded forms: 127 / 00127 → CF-00127
      const digits = s.replace(/^cf-/, '').replace(/\D/g, '');
      if (digits && u.choosifyUserId) {
        const cfDigits = u.choosifyUserId.replace(/^CF-/i, '').replace(/^0+/, '') || '0';
        const qDigits = digits.replace(/^0+/, '') || '0';
        if (cfDigits === qDigits) return true;
      }
      return false;
    });
  }, [baseFiltered, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(finalFiltered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => finalFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [finalFiltered, currentPage],
  );

  const getProfilePath = (role: ViewRole, id: string) => {
    if (role === 'Creator') return `/upe/creator/${id}`;
    return `/upe/consumer/${id}`;
  };

  const handleExportCSV = () => {
    const rows = pagedRows.filter((u) => selectedIds.has(u.uid));
    const header = ['Name', 'Email', 'Role', 'Choosify ID'];
    const csv = [
      header.join(','),
      ...rows.map((u) => [u.displayName, u.email, u.role, u.choosifyUserId || ''].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentViewRole.toLowerCase()}s-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} record(s) to CSV.`);
  };

  const bulkActions: BulkAction[] = [
    { label: 'Export CSV', onClick: handleExportCSV, variant: 'info' },
  ];

  // Real, directory-derived counts (no fabricated stats — the directory
  // endpoint has no purchase/engagement/session data to report on).
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { Consumer: 0, Creator: 0, Seller: 0, Admin: 0 };
    let missingCfId = 0;
    for (const u of directory) {
      const g = roleGroup(u.role);
      if (g in counts) counts[g] += 1;
      if (roleGroup(u.role) === currentViewRole && !u.choosifyUserId) missingCfId += 1;
    }
    return { ...counts, missingCfId };
  }, [directory, currentViewRole]);

  const staffRoleBreakdown = useMemo(() => {
    if (!isAdminView) return [] as Array<[string, number]>;
    const counts = new Map<string, number>();
    for (const u of directory) {
      if (roleGroup(u.role) === 'Admin') {
        counts.set(u.role, (counts.get(u.role) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [directory, isAdminView]);

  const registryColumns = useMemo<DataTableColumn<UserDirectoryEntry>[]>(() => {
    const columns: DataTableColumn<UserDirectoryEntry>[] = [
      {
        key: 'account',
        header: 'Account Identification',
        sortValue: (u) => u.displayName,
        render: (u) => (
          <div className="flex items-center gap-3">
            <button
              onClick={() => openDetail(u.uid)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[11.5px] font-bold bg-app-sidebar border border-app-border text-app-accent-light hover:border-app-accent/50 transition-all active:scale-95 shrink-0 cursor-pointer"
              title="Quick view account detail"
            >
              {initialsFor(u.displayName || u.email)}
            </button>
            <div className="min-w-0">
              <button
                onClick={() => openDetail(u.uid)}
                className="font-bold text-white hover:text-app-accent-light transition-colors block truncate text-left cursor-pointer"
              >
                {u.displayName || '(no name on file)'}
              </button>
              <div className="text-[10px] text-app-text-secondary/50 font-mono italic truncate">{u.email}</div>
            </div>
          </div>
        ),
      },
      {
        key: 'cfId',
        header: 'CF ID',
        sortValue: (u) => u.choosifyUserId || '',
        render: (u) => (
          <span className="font-mono text-[11px] font-bold text-app-text-muted whitespace-nowrap">
            {u.choosifyUserId || '—'}
          </span>
        ),
      },
      { key: 'role', header: 'Role Type', render: (u) => <RoleBadge role={u.role} /> },
    ];

    columns.push({
      key: 'actions',
      header: 'Administrative',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end relative">
          <button
            onClick={() => setActiveMenu(activeMenu === u.uid ? null : u.uid)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
              activeMenu === u.uid
                ? 'bg-app-accent text-white border-app-accent shadow-lg'
                : 'bg-white/5 text-app-text-secondary border-transparent hover:text-white hover:bg-white/10'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {activeMenu === u.uid && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
              <div className="absolute right-0 top-10 w-48 bg-app-card border border-app-border rounded-lg shadow-2xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button
                  onClick={() => openDetail(u.uid)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors text-left cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-app-accent" />
                  <span>Quick View</span>
                </button>
                <Link
                  to={getProfilePath(currentViewRole, u.uid)}
                  className="flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors"
                  onClick={() => setActiveMenu(null)}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-app-accent" />
                  <span>Open Full Profile</span>
                </Link>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    triggerMessage({ id: u.uid, name: u.displayName || u.email, avatarUrl: '', role: u.role });
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors text-left cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-app-accent" />
                  <span>Direct Message</span>
                </button>
              </div>
            </>
          )}
        </div>
      ),
    });

    return columns;
  }, [activeMenu, currentViewRole, triggerMessage]);

  return (
    <div className="space-y-6 pb-12 text-app-text-primary transition-all animate-in fade-in duration-300">

      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white shadow-2xl px-4 py-2.5 rounded-lg border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-app-text-primary">{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-app-text-disabled">
            <span>Platform Registry</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-disabled/50" />
            <span>Consumers</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-disabled/50" />
            <span className="text-app-accent">{currentViewRole}s Directory</span>
          </div>

           <h1 className="text-[17px] font-extrabold text-app-text-primary tracking-tight">
            {isCreatorView && 'Creator Management'}
            {isAdminView && 'Security & Administration'}
            {isConsumerView && 'Consumer Management Hub'}
          </h1>
          <p className="text-app-text-secondary text-[12px] font-semibold">
            {isCreatorView && 'Registered content creator accounts.'}
            {isAdminView && 'Registered platform staff accounts (admin, moderator, and operations roles).'}
            {isConsumerView && 'Registered platform buyer accounts.'}
          </p>
        </div>

        {/* Filters and Inputs */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-focus-within:text-app-accent transition-colors" />
            <input
              type="text"
              placeholder={`Search ${currentViewRole.toLowerCase()}s or User ID (CF-00127)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-app-border rounded-lg text-xs w-full md:w-64 focus:outline-none focus:border-app-accent/50 transition-all text-app-text-primary placeholder-app-text-muted font-semibold"
            />
          </div>
          <button
            onClick={() => fetchDirectory()}
            disabled={usersLoading}
            className="flex items-center gap-1.5 bg-white border border-app-border hover:border-app-accent text-app-text-secondary px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all shadow-sm active:scale-95 shrink-0 hover:text-app-accent cursor-pointer disabled:opacity-50"
          >
             <RefreshCw className={`w-3.5 h-3.5 text-app-accent ${usersLoading ? 'animate-spin' : ''}`} />
             <span>Refresh</span>
          </button>
        </div>
      </div>

      {cfLookup ? (
        <div className="rounded-lg border border-app-border bg-white px-4 py-3 text-xs">
          <div className="font-extrabold text-app-text-primary">Choosify User ID match</div>
          <div className="mt-1 font-mono font-bold text-app-accent">{cfLookup.choosifyUserId}</div>
          <div className="mt-1 text-app-text-secondary font-semibold">
            {cfLookup.displayName} · {cfLookup.email} · {cfLookup.role}
          </div>
          <Link
            to={getProfilePath(
              cfLookup.role === 'creator' ? 'Creator' : cfLookup.role === 'admin' || cfLookup.role === 'super_admin' ? 'Admin' : 'Consumer',
              cfLookup.uid,
            )}
            className="mt-2 inline-flex items-center gap-1 text-app-accent font-extrabold hover:underline"
          >
            Open profile <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : null}
      {cfLookupError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
          {cfLookupError}
        </div>
      ) : null}

      {usersError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-3 text-xs text-rose-700">
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {usersError}</span>
          <button
            onClick={() => fetchDirectory()}
            className="px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-md font-bold uppercase tracking-wider text-[10px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* REAL, DIRECTORY-DERIVED STAT TILES (no fabricated engagement/session data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile
          label={`Registered ${currentViewRole}s`}
          value={usersLoading ? '—' : roleCounts[currentViewRole]}
          icon={Users}
          accent="indigo"
        />
        <StatTile
          label="Missing Choosify ID"
          value={usersLoading ? '—' : roleCounts.missingCfId}
          icon={IdCard}
          accent="slate"
        />
        <StatTile
          label="Matching current filter"
          value={usersLoading ? '—' : finalFiltered.length}
          icon={Filter}
          accent="emerald"
        />
      </div>

      {isAdminView && staffRoleBreakdown.length > 0 && (
        <div className="bg-app-card border border-app-border rounded-lg p-4 flex flex-wrap gap-2">
          {staffRoleBreakdown.map(([role, count]) => (
            <span key={role} className="px-2.5 py-1 rounded-md bg-white/5 border border-app-border text-[10px] font-bold text-app-text-secondary font-mono">
              {role}: {count}
            </span>
          ))}
        </div>
      )}

      {/* REGISTRY TABLE PANEL */}
      <BulkActionBar
        count={selectedIds.size}
        actions={bulkActions}
        onClear={() => setSelectedIds(new Set())}
        itemLabel={currentViewRole.toLowerCase() + 's'}
      />
      <div className="bg-white border border-app-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <DataTable
            columns={registryColumns}
            rows={pagedRows}
            getRowId={(u: UserDirectoryEntry) => u.uid}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            isLoading={usersLoading}
            loadingMessage="Loading registry..."
            emptyMessage="No matches found for your search inquiry. Refine your keyword queries or select a different user catalog tab."
          />
        </div>

        {/* Pagination Section */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-between text-[11px] font-bold text-app-text-secondary uppercase tracking-widest bg-slate-50/60">
           <div>
             Registry range: {finalFiltered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} — {Math.min(currentPage * PAGE_SIZE, finalFiltered.length)} of {finalFiltered.length} matches
           </div>
           <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 bg-white border border-app-border text-app-text-secondary hover:text-app-accent disabled:text-app-text-disabled disabled:cursor-not-allowed rounded-md transition-all"
              >
                Prev
              </button>
              <button className="px-3 py-1 bg-app-accent text-white shadow-sm rounded-md">
                {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 bg-white border border-app-border text-app-text-secondary hover:text-app-accent disabled:text-app-text-disabled disabled:cursor-not-allowed rounded-md transition-all"
              >
                Next
              </button>
           </div>
        </div>
      </div>

      {/* QUICK VIEW DETAIL PANEL — GET /auth/users/:userId */}
      {detailUserId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-app-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <h3 className="font-extrabold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <IdCard className="w-4 h-4 text-app-accent" /> Account Detail
              </h3>
              <button
                onClick={closeDetail}
                className="p-1 hover:bg-black/5 rounded-full text-app-text-secondary hover:text-app-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-10 text-center text-app-text-secondary">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                <p>Loading account detail…</p>
              </div>
            ) : detailError ? (
              <div className="py-6 space-y-3 text-center">
                <p className="text-rose-600 font-semibold flex items-center justify-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {detailError}</p>
                <button
                  onClick={() => detailUserId && openDetail(detailUserId)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold text-rose-700 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : detailData ? (
              <div className="space-y-3 font-mono">
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">Name:</span>
                  <span className="col-span-2 text-app-text-primary font-bold">{detailData.displayName || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">Email:</span>
                  <span className="col-span-2 text-app-text-primary">{detailData.email}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">Role:</span>
                  <span className="col-span-2"><RoleBadge role={detailData.role} /></span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">CF ID:</span>
                  <span className="col-span-2 text-app-text-primary font-bold">{detailData.choosifyUserId || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                  <span className="text-app-text-secondary">Joined:</span>
                  <span className="col-span-2 text-app-text-primary">
                    {detailData.createdAt ? new Date(detailData.createdAt).toLocaleString() : '—'}
                  </span>
                </div>
                {detailData.profileStatus && (
                  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                    <span className="text-app-text-secondary">Profile Status:</span>
                    <span className="col-span-2 flex items-center gap-1.5 text-app-text-primary font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-app-accent" /> {detailData.profileStatus}
                    </span>
                  </div>
                )}
                {typeof detailData.identityVerified === 'boolean' && (
                  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                    <span className="text-app-text-secondary">Identity Verified:</span>
                    <span className="col-span-2 text-app-text-primary">{detailData.identityVerified ? 'Yes' : 'No'}</span>
                  </div>
                )}
                {typeof detailData.marketplaceAccess === 'boolean' && (
                  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                    <span className="text-app-text-secondary">Marketplace Access:</span>
                    <span className="col-span-2 text-app-text-primary">{detailData.marketplaceAccess ? 'Granted' : 'Not Granted'}</span>
                  </div>
                )}
                {detailData.partnerApplicationStatus && (
                  <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-app-border">
                    <span className="text-app-text-secondary">Partner App:</span>
                    <span className="col-span-2 text-app-text-primary capitalize">{detailData.partnerApplicationStatus}</span>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-2 border-t border-app-border flex justify-end gap-2">
              <Link
                to={getProfilePath(currentViewRole, detailUserId)}
                onClick={closeDetail}
                className="px-4 py-1.5 bg-app-accent text-white rounded-lg font-bold hover:bg-[var(--color-accent-hover)] flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Full Profile
              </Link>
              <button
                onClick={closeDetail}
                className="px-4 py-1.5 bg-black/5 rounded-lg text-app-text-secondary hover:bg-black/10 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
