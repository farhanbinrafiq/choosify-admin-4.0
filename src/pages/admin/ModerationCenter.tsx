import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Flag, Loader2, RotateCcw, Search, ShieldAlert, StickyNote, UserCheck, X, XCircle } from 'lucide-react';
import {
  moderationApi,
  type ModerationHistoryEntry,
  type ModerationItem,
  type ModerationQueueType,
  type ModerationReason,
  type ReportCategory,
  type ReportItem,
  type ReportSource,
  type StaffMember,
} from '../../services/moderationApi';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Moderation Center -- the canonical cross-platform content moderation
 * queue for everything that ISN'T a review (reviews stay in the dedicated
 * Review Console; a flagged review here just deep-links there instead of
 * duplicating its moderation actions).
 *
 * Backed by the real server/moderation/* backend (JSON-snapshot persisted,
 * role-gated to MODERATOR+) -- previously built and mounted but never
 * called by any frontend. There is no automated content scanner in this
 * codebase: every queue item here was placed by a real human action (a
 * staff/report flag), never a simulated AI/safety score.
 */

type TabKey = 'all' | 'products' | 'profiles' | 'guides' | 'media' | 'campaigns' | 'reported';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'products', label: 'Products' },
  { key: 'profiles', label: 'Profiles' },
  { key: 'guides', label: 'Guides' },
  { key: 'media', label: 'Media' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'reported', label: 'Reported' },
];

const PROFILE_QUEUES: ModerationQueueType[] = ['brands', 'sellers', 'creators'];

const QUEUE_LABELS: Record<ModerationQueueType, string> = {
  products: 'Product',
  brands: 'Brand profile',
  sellers: 'Seller profile',
  creators: 'Creator profile',
  guides: 'Guide',
  media: 'Media',
  campaigns: 'Campaign creative',
  reviews: 'Review',
  reports: 'Report',
};

const REASON_OPTIONS: Array<{ value: ModerationReason; label: string }> = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'spam', label: 'Spam' },
  { value: 'counterfeit', label: 'Counterfeit' },
  { value: 'misleading', label: 'Misleading' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'quality', label: 'Quality' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'other', label: 'Other' },
];

const REPORT_CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'fake_product', label: 'Fake product' },
  { value: 'counterfeit', label: 'Counterfeit' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'incorrect_information', label: 'Incorrect information' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'other', label: 'Other' },
];

const REPORT_SOURCE_OPTIONS: Array<{ value: ReportSource; label: string }> = [
  { value: 'storefront', label: 'Storefront' },
  { value: 'seller_dashboard', label: 'Seller dashboard' },
  { value: 'creator_dashboard', label: 'Creator dashboard' },
  { value: 'consumer_account', label: 'Consumer account' },
  { value: 'admin', label: 'Admin' },
];

const ITEM_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

/** Report status buckets -- 'escalated' is derived (resolved + resolution==='escalate'),
 *  not a real persisted ReportItem.status value, so it's split out of 'resolved' here
 *  rather than inventing a new backend status. */
const REPORT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Assigned' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const DATE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'updated', label: 'Recently updated' },
];

export function isReportEscalated(r: ReportItem): boolean {
  return r.status === 'resolved' && r.resolution === 'escalate';
}

export function withinDateFilter(iso: string, filter: string): boolean {
  if (filter === 'all') return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (filter === 'today') return t >= startOfToday.getTime();
  if (filter === '7d') return t >= now - 7 * 24 * 60 * 60 * 1000;
  if (filter === '30d') return t >= now - 30 * 24 * 60 * 60 * 1000;
  return true;
}

export function normalizeSearch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const FLAGGABLE_QUEUES: Array<{ value: ModerationQueueType; label: string }> = [
  { value: 'products', label: 'Product' },
  { value: 'brands', label: 'Brand profile' },
  { value: 'sellers', label: 'Seller profile' },
  { value: 'creators', label: 'Creator profile' },
  { value: 'guides', label: 'Guide' },
  { value: 'media', label: 'Media' },
  { value: 'campaigns', label: 'Campaign creative' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    needs_review: 'bg-orange-50 text-orange-700 border-orange-200',
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    archived: 'bg-gray-50 text-gray-500 border-gray-200',
    open: 'bg-amber-50 text-amber-700 border-amber-200',
    investigating: 'bg-blue-50 text-blue-700 border-blue-200',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dismissed: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The most recent decision (approve/reject/request_changes) not yet revoked --
 * mirrors server/moderation/moderationService.ts's findLastRevocableDecision so the
 * Revoke confirmation can name exactly what it's reversing. */
function lastRevocableDecision(item: ModerationItem): ModerationHistoryEntry | undefined {
  const history = item.history || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.action === 'revoke') return undefined;
    if (entry.action === 'approve' || entry.action === 'reject' || entry.action === 'request_changes') return entry;
  }
  return undefined;
}

type DecisionAction = 'approve' | 'reject' | 'request_changes' | 'revoke';

/** Every field below is already present on the fetched ModerationItem/ReportItem
 * objects -- no backend change was needed for search/filter/sort. See the
 * "Filtering architecture" note further down for why this stays client-side. */
type ModerationFilters = {
  q: string;
  status: string;
  assigned: string; // 'all' | 'unassigned' | 'me' | <staffId>
  assignedLabel: string;
  reason: string;
  source: string;
  date: string;
  sort: string;
};

const DEFAULT_FILTERS: ModerationFilters = {
  q: '',
  status: 'all',
  assigned: 'all',
  assignedLabel: '',
  reason: 'all',
  source: 'all',
  date: 'all',
  sort: 'newest',
};

export function itemMatchesSearch(item: ModerationItem, needle: string): boolean {
  const haystack = [
    item.id,
    item.resourceId,
    item.resourceLabel,
    item.resourceType,
    item.assignedModeratorId,
    item.assignedModeratorName,
    item.decidedBy,
    item.reason,
    item.notes,
    ...(item.history || []).flatMap((h) => [h.actorId, h.actorName, h.notes, h.assignedToId, h.assignedToName]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function reportMatchesSearch(report: ReportItem, needle: string): boolean {
  const haystack = [
    report.id,
    report.resourceId,
    report.resourceLabel,
    report.resourceType,
    report.resourceOwnerId,
    report.reporterId,
    report.reporterRole,
    report.assignedModeratorId,
    report.assignedModeratorName,
    report.category,
    report.description,
    report.internalNotes,
    report.resolutionNote,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export default function ModerationCenter() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('tab') as TabKey) || 'all';
  const filters: ModerationFilters = {
    q: searchParams.get('q') || DEFAULT_FILTERS.q,
    status: searchParams.get('status') || DEFAULT_FILTERS.status,
    assigned: searchParams.get('assigned') || DEFAULT_FILTERS.assigned,
    assignedLabel: searchParams.get('assignedLabel') || DEFAULT_FILTERS.assignedLabel,
    reason: searchParams.get('reason') || DEFAULT_FILTERS.reason,
    source: searchParams.get('source') || DEFAULT_FILTERS.source,
    date: searchParams.get('date') || DEFAULT_FILTERS.date,
    sort: searchParams.get('sort') || DEFAULT_FILTERS.sort,
  };

  const [searchInput, setSearchInput] = useState(filters.q);
  useEffect(() => setSearchInput(filters.q), [filters.q]);

  const updateParams = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === 'all') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  const setTab = (nextTab: TabKey) => updateParams({ tab: nextTab === 'all' ? null : nextTab });
  const setFilter = (patch: Partial<ModerationFilters>) => updateParams(patch);
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (tab !== 'all') next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Debounce free-text search into the URL (and therefore into the memoized
  // filter below) rather than re-filtering synchronously on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (normalizeSearch(searchInput) !== normalizeSearch(filters.q)) {
        updateParams({ q: searchInput || null });
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const [items, setItems] = useState<ModerationItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{ action: DecisionAction; item: ModerationItem } | null>(null);
  const [assignModal, setAssignModal] = useState<{ item: ModerationItem } | null>(null);
  const [reportAssignModal, setReportAssignModal] = useState<{ report: ReportItem } | null>(null);
  const [reportNoteModal, setReportNoteModal] = useState<{ report: ReportItem } | null>(null);
  const [reportResolveModal, setReportResolveModal] = useState<{
    report: ReportItem;
    decision: 'approve' | 'reject' | 'request_changes' | 'escalate' | 'dismiss';
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'reported') {
        setReports(await moderationApi.listReports());
      } else if (tab === 'all') {
        setItems(await moderationApi.listQueue());
      } else if (tab === 'profiles') {
        const results = await Promise.all(PROFILE_QUEUES.map((q) => moderationApi.listQueue({ queue: q })));
        setItems(results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        setItems(await moderationApi.listQueue({ queue: tab as ModerationQueueType }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const summary = useMemo(() => {
    const pending = items.filter((i) => i.status === 'pending' || i.status === 'needs_review').length;
    return { pending, total: items.length };
  }, [items]);

  /**
   * Filtering architecture: client-side, over the FULL array each tab already
   * fetches (moderationApi.listQueue()/listReports() are called with no limit,
   * so this operates on the complete dataset, not just visible rows). The
   * underlying store is a small JSON-snapshot array (server/moderation/
   * moderationStore.ts), not an indexed database, and every field searched/
   * filtered here already exists on the objects the client already holds --
   * so server-side search would just move the same linear scan behind an
   * extra network round-trip per keystroke/filter change, for a dataset that
   * doesn't need it at today's scale. Revisit if the queue grows into the
   * thousands.
   */
  const filteredItems = useMemo(() => {
    let rows = items;
    const needle = normalizeSearch(filters.q);
    if (needle) rows = rows.filter((i) => itemMatchesSearch(i, needle));
    if (filters.status !== 'all') rows = rows.filter((i) => i.status === filters.status);
    if (filters.assigned === 'unassigned') rows = rows.filter((i) => !i.assignedModeratorId);
    else if (filters.assigned === 'me') rows = rows.filter((i) => i.assignedModeratorId === profile?.id);
    else if (filters.assigned !== 'all') rows = rows.filter((i) => i.assignedModeratorId === filters.assigned);
    if (filters.reason !== 'all') rows = rows.filter((i) => i.reason === filters.reason);
    if (filters.date !== 'all') rows = rows.filter((i) => withinDateFilter(i.createdAt, filters.date));

    const sorted = [...rows];
    if (filters.sort === 'oldest') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (filters.sort === 'updated') sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [items, filters.q, filters.status, filters.assigned, filters.reason, filters.date, filters.sort, profile?.id]);

  const filteredReports = useMemo(() => {
    let rows = reports;
    const needle = normalizeSearch(filters.q);
    if (needle) rows = rows.filter((r) => reportMatchesSearch(r, needle));
    if (filters.status !== 'all') {
      if (filters.status === 'escalated') rows = rows.filter((r) => isReportEscalated(r));
      else if (filters.status === 'resolved') rows = rows.filter((r) => r.status === 'resolved' && !isReportEscalated(r));
      else rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.assigned === 'unassigned') rows = rows.filter((r) => !r.assignedModeratorId);
    else if (filters.assigned === 'me') rows = rows.filter((r) => r.assignedModeratorId === profile?.id);
    else if (filters.assigned !== 'all') rows = rows.filter((r) => r.assignedModeratorId === filters.assigned);
    if (filters.reason !== 'all') rows = rows.filter((r) => r.category === filters.reason);
    if (filters.source !== 'all') rows = rows.filter((r) => r.source === filters.source);
    if (filters.date !== 'all') rows = rows.filter((r) => withinDateFilter(r.createdAt, filters.date));

    const sorted = [...rows];
    if (filters.sort === 'oldest') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (filters.sort === 'updated') sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [reports, filters.q, filters.status, filters.assigned, filters.reason, filters.source, filters.date, filters.sort, profile?.id]);

  const activeFilterCount = [
    filters.q,
    filters.status !== 'all',
    filters.assigned !== 'all',
    filters.reason !== 'all',
    filters.source !== 'all',
    filters.date !== 'all',
  ].filter(Boolean).length;

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-extrabold text-[#111827]">
            <ShieldAlert className="h-4 w-4 text-orange-500" /> Moderation Center
          </div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Cross-platform content moderation queue · Reviews are handled in the Review Console
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowFlagForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-3.5 py-2 text-[12px] font-bold text-white"
        >
          <Flag className="h-3.5 w-3.5" /> Flag Content
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide ${
              tab === t.key ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ModerationFilterBar
        tab={tab}
        filters={filters}
        setFilter={setFilter}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        clearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
      />

      {tab !== 'reported' ? (
        <div className="mb-3 text-[11px] font-semibold text-[#6B7280]">
          {activeFilterCount > 0 ? (
            <>
              {filteredItems.length} of {items.length} shown
            </>
          ) : (
            <>
              {summary.pending} pending / needs review of {summary.total} shown
            </>
          )}
        </div>
      ) : (
        <div className="mb-3 text-[11px] font-semibold text-[#6B7280]">
          {activeFilterCount > 0 ? `${filteredReports.length} of ${reports.length} shown` : `${reports.length} reports`}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>
      )}

      {showFlagForm && (
        <FlagContentForm
          onCancel={() => setShowFlagForm(false)}
          onSubmit={async (input) => {
            await moderationApi.flag(input);
            setShowFlagForm(false);
            await load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tab === 'reported' ? (
        <ReportsTable
          reports={filteredReports}
          emptyMessage={
            reports.length === 0
              ? 'No reports.'
              : activeFilterCount > 0 && filters.q
                ? 'No results match your search.'
                : 'No reports match the selected filters.'
          }
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          busyId={busyId}
          onAssign={(report) => setReportAssignModal({ report })}
          onAddNote={(report) => setReportNoteModal({ report })}
          onResolve={(report, decision) => setReportResolveModal({ report, decision })}
        />
      ) : (
        <ItemsTable
          items={filteredItems}
          emptyMessage={
            items.length === 0
              ? 'No moderation items found.'
              : activeFilterCount > 0 && filters.q
                ? 'No results match your search.'
                : 'No moderation items match these filters.'
          }
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          busyId={busyId}
          onDecision={(action, item) => setDecisionModal({ action, item })}
          onAssign={(item) => setAssignModal({ item })}
        />
      )}

      {decisionModal && (
        <DecisionModal
          action={decisionModal.action}
          item={decisionModal.item}
          onCancel={() => setDecisionModal(null)}
          onConfirm={async (reason, notes) => {
            const id = decisionModal.item.id;
            const fn =
              decisionModal.action === 'approve'
                ? () => moderationApi.approve(id, reason, notes)
                : decisionModal.action === 'reject'
                  ? () => moderationApi.reject(id, reason, notes)
                  : decisionModal.action === 'request_changes'
                    ? () => moderationApi.requestChanges(id, reason, notes)
                    : () => moderationApi.revoke(id, reason, notes);
            await act(fn, id);
            setDecisionModal(null);
          }}
        />
      )}

      {assignModal && (
        <AssignModal
          title={`Assign — ${assignModal.item.resourceLabel || assignModal.item.resourceId}`}
          onCancel={() => setAssignModal(null)}
          onConfirm={async (staff, notes) => {
            const id = assignModal.item.id;
            await act(() => moderationApi.assign(id, staff.id, staff.displayName, notes), id);
            setAssignModal(null);
          }}
        />
      )}

      {reportAssignModal && (
        <AssignModal
          title={`Assign report — ${reportAssignModal.report.resourceLabel || reportAssignModal.report.resourceId}`}
          hideNotes
          onCancel={() => setReportAssignModal(null)}
          onConfirm={async (staff) => {
            const id = reportAssignModal.report.id;
            await act(() => moderationApi.assignReport(id, staff.id, staff.displayName), id);
            setReportAssignModal(null);
          }}
        />
      )}

      {reportNoteModal && (
        <NoteModal
          title="Add internal note"
          description="Staff-only investigation note. Never shown to the reporter or the reported party."
          confirmLabel="Save note"
          onCancel={() => setReportNoteModal(null)}
          onConfirm={async (note) => {
            const id = reportNoteModal.report.id;
            await act(() => moderationApi.addReportNote(id, note), id);
            setReportNoteModal(null);
          }}
        />
      )}

      {reportResolveModal && (
        <NoteModal
          title={
            reportResolveModal.decision === 'dismiss'
              ? 'Dismiss report?'
              : reportResolveModal.decision === 'escalate'
                ? 'Escalate to moderation?'
                : 'Resolve report'
          }
          description={
            reportResolveModal.decision === 'dismiss'
              ? 'This report will be closed with no action taken. It stays in the audit trail.'
              : reportResolveModal.decision === 'escalate'
                ? 'This links the report to (or creates) a real moderation queue item for the target, rather than acting on the report alone.'
                : 'Explain how this report was handled.'
          }
          required={false}
          confirmLabel={reportResolveModal.decision === 'dismiss' ? 'Dismiss' : reportResolveModal.decision === 'escalate' ? 'Escalate' : 'Resolve'}
          onCancel={() => setReportResolveModal(null)}
          onConfirm={async (note) => {
            const { report, decision } = reportResolveModal;
            await act(() => moderationApi.resolveReport(report.id, decision, undefined, note || undefined), report.id);
            setReportResolveModal(null);
          }}
        />
      )}
    </div>
  );
}

function ItemsTable({
  items,
  busyId,
  onDecision,
  onAssign,
  emptyMessage = 'Nothing in this queue.',
  onClearFilters,
}: {
  items: ModerationItem[];
  busyId: string | null;
  onDecision: (action: DecisionAction, item: ModerationItem) => void;
  onAssign: (item: ModerationItem) => void;
  emptyMessage?: string;
  onClearFilters?: () => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E8EDF2] p-8 text-center text-[12px] text-[#9AA0AC]">
        {emptyMessage}
        {onClearFilters && (
          <button type="button" onClick={onClearFilters} className="ml-2 font-bold text-orange-600 hover:underline">
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8EDF2] bg-white">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[#E8EDF2] bg-[#F8FAFC] text-left text-[10px] font-black uppercase tracking-wide text-[#9AA0AC]">
            <th className="px-3 py-2.5">Content type</th>
            <th className="px-3 py-2.5">Owner</th>
            <th className="px-3 py-2.5">CF-ID</th>
            <th className="px-3 py-2.5">Reason</th>
            <th className="px-3 py-2.5">Assigned to</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const revocable = lastRevocableDecision(item);
            const canRevoke = Boolean(revocable && revocable.newStatus === item.status);
            const isReview = item.queue === 'reviews';
            return (
              <tr key={item.id} className="border-b border-[#F3F4F6] last:border-0">
                <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">{QUEUE_LABELS[item.queue] ?? item.queue}</td>
                <td className="px-3 py-2.5">{item.resourceLabel || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-[#6B7280]">{item.resourceId}</td>
                <td className="px-3 py-2.5">{item.reason ? REASON_OPTIONS.find((r) => r.value === item.reason)?.label ?? item.reason : '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{item.assignedModeratorName || '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDate(item.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(item.status)}`}>{item.status.replace('_', ' ')}</span>
                </td>
                <td className="px-3 py-2.5">
                  {isReview ? (
                    <Link to="/admin/reviews" className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline">
                      Open in Review Console <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canRevoke ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => onDecision('revoke', item)}
                          title="Revoke this decision"
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10.5px] font-bold text-amber-700 disabled:opacity-30"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Revoke
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => onDecision('approve', item)}
                            title="Approve"
                            className="rounded-md border border-emerald-200 p-1.5 text-emerald-600 disabled:opacity-30"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => onDecision('reject', item)}
                            title="Reject / Hide / Remove"
                            className="rounded-md border border-red-200 p-1.5 text-red-600 disabled:opacity-30"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => onDecision('request_changes', item)}
                            className="rounded-md border border-[#E8EDF2] px-2 py-1 text-[10.5px] font-bold text-[#374151] disabled:opacity-30"
                          >
                            Request Changes
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => onAssign(item)}
                        title={item.assignedModeratorId ? 'Reassign' : 'Assign'}
                        className="rounded-md border border-[#E8EDF2] p-1.5 text-[#374151] disabled:opacity-30"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  storefront: 'Storefront',
  seller_dashboard: 'Seller dashboard',
  creator_dashboard: 'Creator dashboard',
  consumer_account: 'Consumer account',
  admin: 'Admin',
};

function ReportsTable({
  reports,
  busyId,
  onAssign,
  onAddNote,
  onResolve,
  emptyMessage = 'No reports.',
  onClearFilters,
}: {
  reports: ReportItem[];
  busyId: string | null;
  onAssign: (report: ReportItem) => void;
  onAddNote: (report: ReportItem) => void;
  onResolve: (report: ReportItem, decision: 'approve' | 'reject' | 'request_changes' | 'escalate' | 'dismiss') => void;
  emptyMessage?: string;
  onClearFilters?: () => void;
}) {
  if (!reports.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E8EDF2] p-8 text-center text-[12px] text-[#9AA0AC]">
        {emptyMessage}
        {onClearFilters && (
          <button type="button" onClick={onClearFilters} className="ml-2 font-bold text-orange-600 hover:underline">
            Clear Filters
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8EDF2] bg-white">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[#E8EDF2] bg-[#F8FAFC] text-left text-[10px] font-black uppercase tracking-wide text-[#9AA0AC]">
            <th className="px-3 py-2.5">Category</th>
            <th className="px-3 py-2.5">Target</th>
            <th className="px-3 py-2.5">Reporter</th>
            <th className="px-3 py-2.5">Source</th>
            <th className="px-3 py-2.5">Assigned</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const open = r.status === 'open' || r.status === 'investigating';
            return (
              <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0 align-top">
                <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">
                  {r.category.replace('_', ' ')}
                  {r.description && <div className="mt-0.5 max-w-[220px] whitespace-normal text-[10.5px] font-normal text-[#6B7280]">"{r.description}"</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold capitalize text-[#1A1A2E]">
                    {r.resourceType === 'review' ? (
                      <Link to="/admin/reviews" className="inline-flex items-center gap-1 font-bold text-orange-600 hover:underline">
                        Review <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      r.resourceType
                    )}
                  </div>
                  <div className="font-mono text-[10.5px] text-[#9AA0AC]">{r.resourceLabel || r.resourceId}</div>
                  {r.linkedModerationItemId && <div className="text-[10px] font-bold text-orange-600">Linked to moderation queue</div>}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">
                  <div className="font-semibold capitalize text-[#1A1A2E]">{r.reporterRole || 'system'}</div>
                  <div className="font-mono text-[10.5px]">{r.reporterId ? r.reporterId.slice(0, 12) : '—'}</div>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{r.source ? SOURCE_LABELS[r.source] ?? r.source : '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{r.assignedModeratorName || '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" disabled={busyId === r.id} onClick={() => onAssign(r)} title="Assign to admin" className="rounded-md border border-[#E8EDF2] p-1.5 text-[#374151] disabled:opacity-30">
                      <UserCheck className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => onAddNote(r)} title="Add internal note" className="rounded-md border border-[#E8EDF2] p-1.5 text-[#374151] disabled:opacity-30">
                      <StickyNote className="h-3.5 w-3.5" />
                    </button>
                    {open && r.resourceType !== 'review' && (
                      <>
                        <button type="button" disabled={busyId === r.id} onClick={() => onResolve(r, 'escalate')} className="rounded-md border border-orange-200 px-2 py-1 text-[10.5px] font-bold text-orange-700 disabled:opacity-30">
                          Escalate
                        </button>
                        <button type="button" disabled={busyId === r.id} onClick={() => onResolve(r, 'approve')} className="rounded-md border border-emerald-200 px-2 py-1 text-[10.5px] font-bold text-emerald-700 disabled:opacity-30">
                          Resolve
                        </button>
                        <button type="button" disabled={busyId === r.id} onClick={() => onResolve(r, 'dismiss')} className="rounded-md border border-[#E8EDF2] px-2 py-1 text-[10.5px] font-bold text-[#374151] disabled:opacity-30">
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                  {r.internalNotes && <div className="mt-1 max-w-[220px] whitespace-normal text-[10px] text-[#9AA0AC]">Notes: {r.internalNotes}</div>}
                  {r.resolutionNote && <div className="mt-1 max-w-[220px] whitespace-normal text-[10px] text-[#9AA0AC]">Resolution: {r.resolutionNote}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssignedToFilter({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffMember[]>([]);
  const [searching, setSearching] = useState(false);
  const isPreset = value === 'all' || value === 'unassigned' || value === 'me';

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      moderationApi
        .searchStaff(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative">
      <select
        value={isPreset ? value : '__specific__'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__specific__') return;
          onChange(v, '');
        }}
        className="w-full rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
      >
        <option value="all">Assigned to: All</option>
        <option value="unassigned">Unassigned</option>
        <option value="me">Me</option>
        {!isPreset && <option value="__specific__">{label || 'Specific staff…'}</option>}
      </select>
      {!isPreset ? null : (
        <div className="relative mt-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff to filter…"
            className="w-full rounded-lg border border-[#E8EDF2] px-2.5 py-1.5 text-[11.5px]"
          />
          {searching && <Loader2 className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-[#9AA0AC]" />}
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id, s.displayName);
                    setQuery('');
                    setResults([]);
                  }}
                  className="block w-full px-2.5 py-1.5 text-left text-[11.5px] hover:bg-[#F8FAFC]"
                >
                  {s.displayName} <span className="text-[#9AA0AC]">({s.role.replace('_', ' ')})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModerationFilterBar({
  tab,
  filters,
  setFilter,
  searchInput,
  setSearchInput,
  clearFilters,
  activeFilterCount,
}: {
  tab: TabKey;
  filters: ModerationFilters;
  setFilter: (patch: Partial<ModerationFilters>) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}) {
  const isReported = tab === 'reported';
  const statusOptions = isReported ? REPORT_STATUS_OPTIONS : ITEM_STATUS_OPTIONS;
  const reasonOptions = isReported ? REPORT_CATEGORY_OPTIONS : REASON_OPTIONS;

  return (
    <div className="mb-3 rounded-xl border border-[#E8EDF2] bg-white p-3">
      <div className="relative mb-2.5">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9AA0AC]" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={isReported ? 'Search report ID, target, reporter, reason…' : 'Search CF-ID, product, owner, assigned staff…'}
          className="w-full rounded-lg border border-[#E8EDF2] py-2 pl-8 pr-3 text-[12.5px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select
          value={filters.status}
          onChange={(e) => setFilter({ status: e.target.value })}
          className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
        >
          <option value="all">Status: All</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <AssignedToFilter
          value={filters.assigned}
          label={filters.assignedLabel}
          onChange={(value, label) => setFilter({ assigned: value, assignedLabel: label })}
        />

        <select
          value={filters.reason}
          onChange={(e) => setFilter({ reason: e.target.value })}
          className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
        >
          <option value="all">Reason: All</option>
          {reasonOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isReported && (
          <select
            value={filters.source}
            onChange={(e) => setFilter({ source: e.target.value })}
            className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
          >
            <option value="all">Source: All</option>
            {REPORT_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        <select
          value={filters.date}
          onChange={(e) => setFilter({ date: e.target.value })}
          className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilter({ sort: e.target.value })}
          className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#374151]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {activeFilterCount > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10.5px] font-bold text-orange-700">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </span>
          <button type="button" onClick={clearFilters} className="text-[11px] font-bold text-[#374151] hover:text-red-600">
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

function FlagContentForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: { queue: ModerationQueueType; resourceType: string; resourceId: string; resourceLabel?: string; reason?: ModerationReason; notes?: string }) => Promise<void>;
}) {
  const [queue, setQueue] = useState<ModerationQueueType>('products');
  const [resourceId, setResourceId] = useState('');
  const [resourceLabel, setResourceLabel] = useState('');
  const [reason, setReason] = useState<ModerationReason>('policy_violation');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resourceTypeFor = (q: ModerationQueueType) => (q === 'brands' ? 'brand' : q === 'sellers' ? 'seller' : q === 'creators' ? 'creator' : q === 'guides' ? 'guide' : q === 'media' ? 'media' : q === 'campaigns' ? 'campaign' : 'product');

  const submit = async () => {
    if (!resourceId.trim()) {
      setError('CF-ID is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ queue, resourceType: resourceTypeFor(queue), resourceId: resourceId.trim(), resourceLabel: resourceLabel.trim() || undefined, reason, notes: notes.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag content');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border-2 border-[#111827] bg-white p-4">
      <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Flag content for moderation</div>
      {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Content type</label>
          <select className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={queue} onChange={(e) => setQueue(e.target.value as ModerationQueueType)}>
            {FLAGGABLE_QUEUES.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">CF-ID</label>
          <input className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={resourceId} onChange={(e) => setResourceId(e.target.value)} placeholder="e.g. product-1789..." />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Owner / label</label>
          <input className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={resourceLabel} onChange={(e) => setResourceLabel(e.target.value)} placeholder="Seller/brand/product name" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Reason</label>
          <select className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={reason} onChange={(e) => setReason(e.target.value as ModerationReason)}>
            {REASON_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Notes</label>
          <input className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context for the reviewing moderator" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF5B00] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />} Flag
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ModalShell({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-[420px] rounded-xl border border-[#E8EDF2] bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const DECISION_TITLES: Record<DecisionAction, string> = {
  approve: 'Approve this item?',
  reject: 'Reject this item?',
  request_changes: 'Request Changes',
  revoke: 'Revoke this decision?',
};

function DecisionModal({
  action,
  item,
  onCancel,
  onConfirm,
}: {
  action: DecisionAction;
  item: ModerationItem;
  onCancel: () => void;
  onConfirm: (reason: ModerationReason | undefined, notes: string | undefined) => Promise<void>;
}) {
  const [reason, setReason] = useState<ModerationReason>('policy_violation');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoked = action === 'revoke' ? lastRevocableDecision(item) : undefined;
  const requiresNotes = action === 'request_changes';
  const showReason = action === 'reject';

  const description =
    action === 'approve'
      ? 'The item will be marked approved and become visible on the storefront.'
      : action === 'reject'
        ? 'The item will be marked rejected and hidden from the storefront.'
        : action === 'request_changes'
          ? 'What changes are required? This note is sent back with the item so the submitter knows what to fix.'
          : revoked?.action === 'reject'
            ? 'This will return this item to moderation review. The previous rejection will remain in the audit history.'
            : revoked?.action === 'request_changes'
              ? 'This will return the item to its prior review state while preserving the previous request and notes in the audit history.'
              : 'This will return this item to moderation review. The previous approval will remain in the audit history.';

  const submit = async () => {
    const trimmed = notes.trim();
    if (requiresNotes && !trimmed) {
      setError('Please describe what changes are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(showReason ? reason : undefined, trimmed || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onCancel={onCancel}>
      <div className="mb-1 text-[13px] font-black text-[#111827]">{DECISION_TITLES[action]}</div>
      <div className="mb-3 text-[11.5px] text-[#6B7280]">{description}</div>
      {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</div>}

      {showReason && (
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Reason</label>
          <select className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={reason} onChange={(e) => setReason(e.target.value as ModerationReason)}>
            {REASON_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">
          {action === 'request_changes' ? 'What changes are required?' : action === 'revoke' ? 'Reversal notes (optional)' : 'Notes (optional)'}
        </label>
        <textarea
          className="h-24 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={action === 'request_changes' ? 'e.g. Please upload a clearer product image and provide the manufacturer\'s warranty information.' : 'Optional context'}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50 ${
            action === 'reject' ? 'bg-red-600' : action === 'revoke' ? 'bg-amber-600' : 'bg-[#FF5B00]'
          }`}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : action === 'request_changes' ? 'Request Changes' : 'Yes, revoke'}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]">
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

function AssignModal({
  title,
  hideNotes,
  onCancel,
  onConfirm,
}: {
  title: string;
  hideNotes?: boolean;
  onCancel: () => void;
  onConfirm: (staff: StaffMember, notes: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      moderationApi
        .searchStaff(q)
        .then((rows) => setResults(rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const submit = async () => {
    if (!selected) {
      setError('Search and select a staff member to assign.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(selected, notes.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onCancel={onCancel}>
      <div className="mb-1 text-[13px] font-black text-[#111827]">{title}</div>
      <div className="mb-3 text-[11.5px] text-[#6B7280]">Search real admin/moderator staff by name or email.</div>
      {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</div>}

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9AA0AC]" />
        <input
          className="w-full rounded-lg border border-[#E8EDF2] py-2 pl-8 pr-3 text-[12.5px]"
          value={selected ? selected.displayName : query}
          onChange={(e) => {
            setSelected(null);
            setQuery(e.target.value);
          }}
          placeholder="Search staff by name or email…"
        />
        {searching && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-[#9AA0AC]" />}
      </div>

      {!selected && results.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-[#E8EDF2]">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelected(s);
                setResults([]);
              }}
              className="flex w-full flex-col items-start border-b border-[#F3F4F6] px-3 py-2 text-left last:border-0 hover:bg-[#F8FAFC]"
            >
              <span className="text-[12px] font-bold text-[#1A1A2E]">{s.displayName}</span>
              <span className="text-[10.5px] text-[#9AA0AC]">{s.email} · {s.role.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}

      {!hideNotes && (
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Internal note (staff-only)</label>
          <textarea
            className="h-20 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Please verify supplier documents before approving. Never shown on the storefront."
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm assignment
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]">
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

function NoteModal({
  title,
  description,
  confirmLabel,
  required = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  required?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = note.trim();
    if (required && !trimmed) {
      setError('This note is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onCancel={onCancel}>
      <div className="mb-1 text-[13px] font-black text-[#111827]">{title}</div>
      {description && <div className="mb-3 text-[11.5px] text-[#6B7280]">{description}</div>}
      {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</div>}
      <textarea
        className="mb-3 h-24 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={required ? 'Required…' : 'Optional…'}
      />
      <div className="flex items-center gap-2">
        <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {confirmLabel}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]">
          Cancel
        </button>
        <button type="button" onClick={() => onCancel()} className="ml-auto text-[#9AA0AC]" title="Close" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    </ModalShell>
  );
}
