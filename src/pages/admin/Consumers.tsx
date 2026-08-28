import React, { useState, useEffect, useMemo, useCallback, CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContact } from '../../contexts/ContactInteractionContext';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, UserDirectoryEntry } from '../../services/authApi';
import {
  Search,
  MoreVertical,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  UserPlus,
  Save,
} from 'lucide-react';

// ============================================================================
// Real backend data — GET /auth/users/directory (bulk list) and
// GET /auth/users/search (CF-ID lookup). See server/authRouter.ts:1419 / :1386
// and src/services/authApi.ts.
// ============================================================================
//
// Sprint 13 UI regression lock — Step 2 (restoration method for all dashboard
// pages). PRESENTATION is a faithful reproduction of the approved standalone
// `isCustomerList` section (design-reference/Choosify Admin CMS (standalone).html,
// decoded lines 3400–3486): exact hex, px, grid and DOM structure, expressed as
// inline styles rather than translated into shared-component defaults. Sanctioned
// deviation: the accent uses the canonical `--cms-accent` token for dashboard-wide
// consistency (per product-owner decision), not the raw reference `#FF5B00`.
//
// FUNCTIONALITY is the current canonical layer: GET /auth/users/directory list,
// GET /auth/users/search CF-ID lookup, viewMode (consumers/creators/admins)
// reuse, client pagination, CSV export of selected rows, DM via
// ContactInteraction. Selecting a consumer for inspection navigates to the
// existing universal profile route /upe/{consumer,creator}/:id via the
// canonical getProfilePath() mechanism — the full profile page is the
// authoritative detail surface. No in-page detail panel / modal is rendered.
//
// DATA-INTEGRITY NOTES (values only appear where a canonical production source
// exists; the approved column/panel STRUCTURE is kept regardless):
//  - Registry columns Sl. | Account Identification | Role Type are backed by the
//    directory contract. Behavior Intent Segment / Security Trust Score / Status
//    Badge / Last Access Active have NO field in the list contract (or anywhere
//    canonical) → rendered as an honest "—".
//  - The three insight panels (Most Searched / Most Viewed / Most Saved) have no
//    persisted canonical source. `/api/analytics/trending` exists but its store
//    (server/analytics/analyticsStorage.ts) is volatile in-memory,
//    `persistence: 'not_configured'`, empty on boot, and unauthenticated; there
//    is no wishlist table and no product-search-count concept. Panels are
//    restored as shells with a neutral empty state.
//  - "Refine List" and "Invite Consumer" have no canonical implementation
//    (the prototype buttons carry no handler; there is no consumer-invite
//    endpoint) → rendered in the approved position but visibly disabled.
//
// The standalone prototype's mock fields — behavior segment, trust score,
// last-access, purchased-in-30d, average basket, most-searched/viewed/saved
// numbers, LTV, wallet, addresses, sessions, followed brands/creators, search
// history, suspend toggle — are exactly what Sprint 11 (6250eaa) removed. None
// are reproduced.
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
  // `user` is the persisted role for platform buyers — the user_role enum has no
  // `consumer` value, and every account created through /auth/register is stored
  // as `user`. AuthContext.toUserRole() already normalizes `user` → `consumer`
  // for the logged-in profile; without the same mapping here, no real buyer
  // account ever appears in the Consumers tab.
  if (r === 'consumer' || r === 'user') return 'Consumer';
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

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

/** Reference role-badge pill — inline, matching the standalone status-badge chrome. */
const roleBadgeStyle = (role: string): CSSProperties => {
  const g = roleGroup(role);
  const map: Record<string, { bg: string; fg: string }> = {
    Consumer: { bg: 'rgba(37,99,235,0.12)', fg: '#2563EB' },
    Seller: { bg: ACCENT_WASH, fg: ACCENT },
    Creator: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
    Admin: { bg: 'rgba(239,68,68,0.1)', fg: '#DC2626' },
  };
  const c = map[g] || { bg: '#F1F3F5', fg: '#6B7280' };
  return {
    background: c.bg,
    color: c.fg,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 5,
    whiteSpace: 'nowrap',
  };
};

/** Grouped, display-friendly role label ('user' → 'Consumer'). */
const roleLabel = (role: string): string => {
  const g = roleGroup(role);
  return g === 'Other' ? role : g;
};

const PAGE_SIZE = 25;

/**
 * Approved insight panels. No canonical persisted source exists for any of the
 * three, so each renders a neutral empty state (see header notes). The shell —
 * position, proportions, border, title treatment — matches isCustomerList.
 */
const INSIGHT_PANELS: Array<{ title: string; emptyLabel: string }> = [
  { title: 'MOST SEARCHED PRODUCTS', emptyLabel: 'No search analytics available yet' },
  { title: 'MOST VIEWED PRODUCTS', emptyLabel: 'No view analytics available yet' },
  { title: 'MOST SAVED / WISHLISTED', emptyLabel: 'No saved-product analytics available yet' },
];

export default function ConsumersPage() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'az' | 'za'>('az');
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
    const matched = !s
      ? baseFiltered
      : baseFiltered.filter((u) => {
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
    // Reference exposes a sort control; wire it to a real client-side sort over
    // the fetched directory. The prototype's Joined-date options are dropped —
    // directory rows carry no join date (that field is detail-only).
    const sorted = [...matched].sort((a, b) => {
      const an = (a.displayName || a.email || '').toLowerCase();
      const bn = (b.displayName || b.email || '').toLowerCase();
      return sortKey === 'za' ? bn.localeCompare(an) : an.localeCompare(bn);
    });
    return sorted;
  }, [baseFiltered, searchQuery, sortKey]);

  const totalPages = Math.max(1, Math.ceil(finalFiltered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => finalFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [finalFiltered, currentPage],
  );

  // Canonical universal-profile route the app already uses internally:
  // inspectionUniversalPath('consumer') === '/admin/consumers/:id'. Navigate
  // straight to it — the previous '/upe/consumer/:id' target only redirected
  // here anyway, and that route now renders the real React UnifiedProfileShell
  // (App.tsx), not the mock CmsMirror customer deep-link.
  const getProfilePath = (role: ViewRole, id: string) => {
    if (role === 'Creator') return `/upe/creator/${id}`;
    return `/admin/consumers/${id}`;
  };

  /** Selecting a consumer for inspection → canonical full profile, one navigation. */
  const openProfile = (uid: string) => {
    setActiveMenu(null);
    navigate(getProfilePath(currentViewRole, uid));
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

  const selectedCount = pagedRows.filter((u) => selectedIds.has(u.uid)).length;
  const allSelected = pagedRows.length > 0 && pagedRows.every((u) => selectedIds.has(u.uid));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pagedRows.forEach((u) => next.delete(u.uid));
      else pagedRows.forEach((u) => next.add(u.uid));
      return next;
    });
  };
  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  // ── presentation — exact reference values (isCustomerList 3400–3486) ─────
  const S: Record<string, CSSProperties> = {
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    crumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 6 },
    h1: { fontSize: '15.5px', fontWeight: 800, color: '#111827' },
    sub: { fontSize: 12, color: '#6B7280', fontWeight: 600, marginTop: 2 },
    controls: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
    search: { height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 14px 0 34px', fontSize: '12.5px', minWidth: 220, outline: 'none', background: '#fff' },
    select: { height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: 12, color: '#111827', background: '#fff', outline: 'none', cursor: 'pointer' },
    btn: { height: 38, boxSizing: 'border-box', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', fontSize: '11.5px', fontWeight: 800, color: '#111827', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    btnDisabled: { height: 38, boxSizing: 'border-box', borderRadius: 8, padding: '0 16px', fontSize: '11.5px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', opacity: 0.45 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    statNum: { fontSize: 22, fontWeight: 800, color: '#111827' },
    statLabel: { fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginTop: 4 },
    statSub: { fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 4 },
    panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 },
    panelEmpty: { borderTop: '1px solid #F1F3F5', paddingTop: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 11, fontWeight: 600, fontStyle: 'italic' },
    bulkBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg,rgba(0,4,53,0.94) 0%,rgba(0,6,46,0.92) 80%,rgba(0,2,37,0.94) 100%)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
    bulkChip: { background: ACCENT_WASH, color: ACCENT, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 },
    bulkBtn: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, padding: '5px 12px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' },
    bulkClear: { cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'none', border: 0 },
    tableWrap: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '10.5px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
    td: { padding: '14px 16px', fontSize: 13, color: '#111827' },
    tdMuted: { padding: '14px 16px', fontSize: 13, color: '#6B7280' },
    row: { borderTop: '1px solid #F1F3F5', cursor: 'pointer' },
    empty: { color: '#9CA3AF' },
    avatar: { width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #000435)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 },
    pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #F1F3F5', background: '#F9FAFB', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
    pagerBtn: { padding: '6px 12px', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 6, fontSize: 10.5, fontWeight: 800, color: '#374151', cursor: 'pointer' },
    menu: { position: 'absolute', right: 0, top: 34, width: 190, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', zIndex: 20, padding: 4, overflow: 'hidden' },
    menuItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: '11.5px', fontWeight: 700, color: '#374151', background: 'none', border: 0, borderRadius: 6, cursor: 'pointer', textAlign: 'left', textDecoration: 'none' },
  };

  const pillRoleLabel = isCreatorView ? 'Creators' : isAdminView ? 'Admins' : 'Consumers';
  const title = isCreatorView ? 'Creator Management' : isAdminView ? 'Security & Administration' : 'Consumer Management Hub';
  const subtitle = isCreatorView
    ? 'Registered content creator accounts.'
    : isAdminView
      ? 'Registered platform staff accounts (admin, moderator, and operations roles).'
      : 'Manage registered platform buyers, and audit account safety.';
  const registeredSub = isCreatorView
    ? 'Enrolled creator accounts'
    : isAdminView
      ? 'Platform staff & operations roles'
      : 'Enrolled platform buyers';

  return (
    <div style={{ color: '#111827' }}>
      {/* Toast — dashboard-consistent (matches Category Studio) */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            background: '#111827', color: '#fff', borderRadius: 12, padding: '11px 18px',
            fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          }}
        >
          <Save size={15} /> {toastMessage}
        </div>
      )}

      {/* ── Header (reference) ── */}
      <div style={S.headRow}>
        <div>
          <div style={S.crumb}>
            <span>Platform Registry</span>
            <ChevronRight size={13} style={{ opacity: 0.5 }} />
            <span>Consumers</span>
            <ChevronRight size={13} style={{ opacity: 0.5 }} />
            <span style={{ color: ACCENT }}>{currentViewRole}s Directory</span>
          </div>
          <div style={S.h1}>{title}</div>
          <div style={S.sub}>{subtitle}</div>
        </div>

        <div style={S.controls}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${currentViewRole.toLowerCase()}s or User ID (CF-00127)`}
              style={S.search}
            />
          </div>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as 'az' | 'za')} style={S.select}>
            <option value="az">Name: A → Z</option>
            <option value="za">Name: Z → A</option>
          </select>
          {/* Reference control — no canonical filter-panel implementation → disabled */}
          <button type="button" disabled aria-disabled title="Advanced filters are not available in this release" style={{ ...S.btnDisabled, background: '#fff', border: '1px solid #E8EDF2', color: '#111827' }}>
            <SlidersHorizontal size={13} /> Refine List
          </button>
          <button onClick={() => fetchDirectory()} disabled={usersLoading} style={{ ...S.btn, opacity: usersLoading ? 0.6 : 1 }}>
            <RefreshCw size={13} className={usersLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          {/* Reference control — no consumer-invite endpoint → disabled */}
          <button type="button" disabled aria-disabled title="Consumer invitations are not available in this release" style={{ ...S.btnDisabled, background: ACCENT, color: '#fff' }}>
            <UserPlus size={13} /> Invite Consumer
          </button>
        </div>
      </div>

      {/* CF-ID lookup match (real; no reference equivalent) */}
      {cfLookup ? (
        <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 800, color: '#111827' }}>Choosify User ID match</div>
          <div style={{ marginTop: 3, fontFamily: 'monospace', fontWeight: 800, color: ACCENT }}>{cfLookup.choosifyUserId}</div>
          <div style={{ marginTop: 3, color: '#6B7280', fontWeight: 600 }}>
            {cfLookup.displayName} · {cfLookup.email} · {cfLookup.role}
          </div>
          <Link
            to={getProfilePath(
              cfLookup.role === 'creator' ? 'Creator' : cfLookup.role === 'admin' || cfLookup.role === 'super_admin' ? 'Admin' : 'Consumer',
              cfLookup.uid,
            )}
            style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, color: ACCENT, fontWeight: 800, fontSize: 11.5 }}
          >
            Open profile <ChevronRight size={13} />
          </Link>
        </div>
      ) : null}
      {cfLookupError ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
          {cfLookupError}
        </div>
      ) : null}

      {usersError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#B91C1C' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} /> {usersError}</span>
          <button onClick={() => fetchDirectory()} style={{ ...S.btn, height: 30, background: '#FEE2E2', borderColor: '#FECACA', color: '#B91C1C' }}>Retry</button>
        </div>
      )}

      {/* ── Real directory-derived stat cards (reference card chrome) ── */}
      <div style={S.statGrid}>
        <div style={{ ...S.statCard, borderLeft: '4px solid #6C4CFF' }}>
          <div style={S.statNum}>{usersLoading ? '—' : roleCounts[currentViewRole]}</div>
          <div style={S.statLabel}>Registered {pillRoleLabel}</div>
          <div style={S.statSub}>{registeredSub}</div>
        </div>
        <div style={{ ...S.statCard, borderLeft: '4px solid #DC2626' }}>
          <div style={S.statNum}>{usersLoading ? '—' : roleCounts.missingCfId}</div>
          <div style={S.statLabel}>Missing Choosify ID</div>
          <div style={S.statSub}>Accounts without a CF-ID</div>
        </div>
        <div style={{ ...S.statCard, borderLeft: '4px solid #2563EB' }}>
          <div style={S.statNum}>{usersLoading ? '—' : finalFiltered.length}</div>
          <div style={S.statLabel}>Matching current filter</div>
          <div style={S.statSub}>Search + role tab applied</div>
        </div>
      </div>

      {/* ── Insight panels (approved shells; no canonical source → empty state) ── */}
      <div style={S.panelGrid}>
        {INSIGHT_PANELS.map((p) => (
          <div key={p.title} style={S.panel}>
            <div style={S.panelTitle}>{p.title}</div>
            <div style={S.panelEmpty}>{p.emptyLabel}</div>
          </div>
        ))}
      </div>

      {isAdminView && staffRoleBreakdown.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {staffRoleBreakdown.map(([role, count]) => (
            <span key={role} style={{ padding: '4px 10px', borderRadius: 6, background: '#F9FAFB', border: '1px solid #E8EDF2', fontSize: 10, fontWeight: 800, color: '#6B7280', fontFamily: 'monospace' }}>
              {role}: {count}
            </span>
          ))}
        </div>
      )}

      {/* ── Bulk selection bar (reference) ── */}
      {selectedCount > 0 && (
        <div style={S.bulkBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={S.bulkChip}>{selectedCount} selected</span>
            <button onClick={handleExportCSV} style={S.bulkBtn}>Export CSV</button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} style={S.bulkClear}>✕ Clear</button>
        </div>
      )}

      {/* ── Registry table (reference — 7 approved columns) ── */}
      <div style={S.tableWrap}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ ...S.th, width: 36, textAlign: 'center' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all on page" />
                </th>
                <th style={{ ...S.th, width: 40 }}>Sl.</th>
                <th style={S.th}>Account Identification</th>
                <th style={S.th}>Role Type</th>
                <th style={S.th}>Behavior Intent Segment</th>
                <th style={S.th}>Security Trust Score</th>
                <th style={S.th}>Status Badge</th>
                <th style={S.th}>Last Access Active</th>
                <th style={{ ...S.th, width: 52, textAlign: 'right' }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={9} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 0' }}>
                    <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                    Loading registry…
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 16px', fontStyle: 'italic' }}>
                    No matches found for your search inquiry. Refine your keyword queries or select a different user catalog tab.
                  </td>
                </tr>
              ) : (
                pagedRows.map((u, idx) => {
                  const sl = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={u.uid} style={S.row} onClick={() => openProfile(u.uid)}>
                      <td style={{ ...S.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(u.uid)} onChange={() => toggleSelect(u.uid)} aria-label={`Select ${u.displayName || u.email}`} />
                      </td>
                      <td style={S.tdMuted}>{sl}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={S.avatar}>{initialsFor(u.displayName || u.email)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.displayName || '(no name on file)'}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.email}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#6B7280', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.02em', marginTop: 2 }}>
                              {u.choosifyUserId || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={S.td}><span style={roleBadgeStyle(u.role)}>{roleLabel(u.role)}</span></td>
                      <td style={S.tdMuted}><span style={S.empty}>—</span></td>
                      <td style={S.tdMuted}><span style={S.empty}>—</span></td>
                      <td style={S.tdMuted}><span style={S.empty}>—</span></td>
                      <td style={S.tdMuted}><span style={S.empty}>—</span></td>
                      <td style={{ ...S.td, textAlign: 'right', position: 'relative', overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveMenu(activeMenu === u.uid ? null : u.uid)}
                          style={{
                            width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 7, border: '1px solid ' + (activeMenu === u.uid ? ACCENT : 'transparent'),
                            background: activeMenu === u.uid ? ACCENT_WASH : 'transparent', color: activeMenu === u.uid ? ACCENT : '#6B7280', cursor: 'pointer',
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {activeMenu === u.uid && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setActiveMenu(null)} />
                            <div style={S.menu}>
                              <Link to={getProfilePath(currentViewRole, u.uid)} onClick={() => setActiveMenu(null)} style={S.menuItem}>
                                <ExternalLink size={14} color={ACCENT} /> Open Full Profile
                              </Link>
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  triggerMessage({ id: u.uid, name: u.displayName || u.email, avatarUrl: '', role: u.role });
                                }}
                                style={S.menuItem}
                              >
                                <MessageCircle size={14} color={ACCENT} /> Direct Message
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={S.pager}>
          <div>
            Registry range: {finalFiltered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} — {Math.min(currentPage * PAGE_SIZE, finalFiltered.length)} of {finalFiltered.length} matches
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ ...S.pagerBtn, opacity: currentPage <= 1 ? 0.4 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
            <span style={{ ...S.pagerBtn, background: ACCENT, color: '#fff', border: 'none' }}>
              {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ ...S.pagerBtn, opacity: currentPage >= totalPages ? 0.4 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
