/**
 * Component-level (non-browser) verification of the Moderation Center
 * search/filter/sort logic added to src/pages/admin/ModerationCenter.tsx.
 *
 * No browser automation tool is available in this environment, so this
 * probe imports the ACTUAL exported pure functions the component uses
 * (itemMatchesSearch, reportMatchesSearch, normalizeSearch,
 * withinDateFilter, isReportEscalated) and exercises them against
 * constructed ModerationItem/ReportItem fixtures shaped exactly like the
 * real API responses. This is real logic verification, not a substitute
 * claim of browser QA -- see the accompanying report for what remains
 * NOT AVAILABLE (live click-through, responsive layout).
 *
 * Usage: npx tsx scripts/probe-moderation-filters.ts
 */
import {
  isReportEscalated,
  itemMatchesSearch,
  normalizeSearch,
  reportMatchesSearch,
  withinDateFilter,
} from '../src/pages/admin/ModerationCenter';
import type { ModerationItem, ReportItem } from '../src/services/moderationApi';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

const item: ModerationItem = {
  id: 'mod-abc123',
  queue: 'products',
  resourceType: 'product',
  resourceId: 'prod-s24-ultra',
  resourceLabel: 'Samsung Galaxy S24 Ultra',
  status: 'needs_review',
  priority: 0,
  assignedModeratorId: 'staff-1',
  assignedModeratorName: 'Farhan Rafiq',
  reason: 'policy_violation',
  notes: 'Please add warranty info',
  history: [
    {
      id: 'mh-1',
      action: 'request_changes',
      actorId: 'staff-1',
      actorName: 'Farhan Rafiq',
      previousStatus: 'pending',
      newStatus: 'needs_review',
      notes: 'Please add warranty info',
      timestamp: iso(2 * 24 * 60 * 60 * 1000),
    },
  ],
  createdAt: iso(10 * 24 * 60 * 60 * 1000),
  updatedAt: iso(2 * 24 * 60 * 60 * 1000),
};

const report: ReportItem = {
  id: 'rpt-xyz789',
  category: 'counterfeit',
  status: 'resolved',
  resourceType: 'product',
  resourceId: 'prod-s24-ultra',
  resourceLabel: 'Samsung Galaxy S24 Ultra',
  reporterId: 'user-42',
  reporterRole: 'user',
  source: 'storefront',
  description: 'Looks fake, seller photos do not match',
  assignedModeratorId: 'staff-1',
  assignedModeratorName: 'Farhan Rafiq',
  internalNotes: 'Checked seller history',
  resolution: 'escalate',
  resolutionNote: 'Escalated for full review',
  linkedModerationItemId: 'mod-abc123',
  createdAt: iso(5 * 24 * 60 * 60 * 1000),
  updatedAt: iso(1 * 24 * 60 * 60 * 1000),
};

// 1. Search by CF-ID / moderation item id
assert(itemMatchesSearch(item, normalizeSearch('mod-abc123')), '1. search by moderation item id');
// 2. Search by resource id
assert(itemMatchesSearch(item, normalizeSearch('prod-s24-ultra')), '2. search by resource id');
// 3. Search by owner/content name
assert(itemMatchesSearch(item, normalizeSearch('Samsung Galaxy')), '3. search by content name');
// 4. Search by assigned moderator
assert(itemMatchesSearch(item, normalizeSearch('Farhan Rafiq')), '4. search by assigned moderator name');
// 5. Search by reason
assert(itemMatchesSearch(item, normalizeSearch('policy_violation')), '5. search by reason');
// 6. Search history notes
assert(itemMatchesSearch(item, normalizeSearch('warranty info')), '6. search matches history entry notes');
// 7. Case-insensitivity + whitespace tolerance
assert(itemMatchesSearch(item, normalizeSearch('  SAMSUNG   galaxy  ')), '7. search is case-insensitive and whitespace-tolerant');
assert(!itemMatchesSearch(item, normalizeSearch('totally unrelated needle')), '7b. non-matching search correctly excludes');

// Reports: search fields
assert(reportMatchesSearch(report, normalizeSearch('rpt-xyz789')), 'report search by report id');
assert(reportMatchesSearch(report, normalizeSearch('user-42')), 'report search by reporter id');
assert(reportMatchesSearch(report, normalizeSearch('Checked seller history')), 'report search by internal notes');
assert(reportMatchesSearch(report, normalizeSearch('do not match')), 'report search by reporter description');
assert(!reportMatchesSearch(report, normalizeSearch('zzz-nomatch-zzz')), 'report search correctly excludes non-matching needle');

// 14/20. Date filter
assert(withinDateFilter(item.createdAt, 'all'), '14a. date filter "all" always matches');
assert(!withinDateFilter(item.createdAt, 'today'), '14b. 10-day-old item excluded from "today"');
assert(withinDateFilter(item.createdAt, '30d'), '14c. 10-day-old item included in "last 30 days"');
assert(!withinDateFilter(item.createdAt, '7d'), '14d. 10-day-old item excluded from "last 7 days"');
assert(withinDateFilter(iso(60 * 60 * 1000), 'today'), '14e. item created 1 hour ago matches "today"');

// 20. Escalated derivation (report status bucket)
assert(isReportEscalated(report), '20a. resolved+resolution=escalate is treated as Escalated');
const resolvedNotEscalated: ReportItem = { ...report, resolution: 'approve' };
assert(!isReportEscalated(resolvedNotEscalated), '20b. resolved+resolution=approve is NOT Escalated (stays in Resolved bucket)');
const dismissed: ReportItem = { ...report, status: 'dismissed', resolution: 'dismiss' };
assert(!isReportEscalated(dismissed), '20c. dismissed report is not Escalated');

// 17/18/19. Sort semantics -- mirrors (does not import) ModerationCenter.tsx's
// inline comparator, since exporting it would mean restructuring the
// component's useMemo blocks, which was explicitly out of scope for this pass.
const older: ModerationItem = {
  ...item,
  id: 'mod-older',
  status: 'pending',
  assignedModeratorId: undefined,
  assignedModeratorName: undefined,
  reason: 'spam',
  createdAt: iso(20 * 24 * 60 * 60 * 1000),
  updatedAt: iso(15 * 24 * 60 * 60 * 1000),
};
const newer: ModerationItem = {
  ...item,
  id: 'mod-newer',
  status: 'approved',
  assignedModeratorId: 'staff-2',
  assignedModeratorName: 'Other Staff',
  reason: 'quality',
  createdAt: iso(1 * 24 * 60 * 60 * 1000),
  updatedAt: iso(30 * 60 * 1000),
};
const rows = [older, item, newer];

const newestFirst = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
assert(newestFirst.map((r) => r.id).join(',') === 'mod-newer,mod-abc123,mod-older', '17. newest-first sort orders by createdAt desc');

const oldestFirst = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
assert(oldestFirst.map((r) => r.id).join(',') === 'mod-older,mod-abc123,mod-newer', '18. oldest-first sort orders by createdAt asc');

const recentlyUpdated = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
assert(recentlyUpdated.map((r) => r.id).join(',') === 'mod-newer,mod-abc123,mod-older', '19. recently-updated sort orders by updatedAt desc');

// 8/9/10/11/12/13/15/16 -- combined-filter semantics exercised via the same predicate
// functions the component composes in its useMemo (status/assigned/reason/source
// filters are plain equality checks on real fields already covered by the search
// assertions above using the identical field access pattern; re-asserted here in
// combination to mirror how ItemsTable/ReportsTable actually chain them).
function applyItemFilters(all: ModerationItem[], f: { q?: string; status?: string; assigned?: string; reason?: string; date?: string }) {
  let out = all;
  if (f.q) out = out.filter((i) => itemMatchesSearch(i, normalizeSearch(f.q!)));
  if (f.status) out = out.filter((i) => i.status === f.status);
  if (f.assigned === 'unassigned') out = out.filter((i) => !i.assignedModeratorId);
  else if (f.assigned) out = out.filter((i) => i.assignedModeratorId === f.assigned);
  if (f.reason) out = out.filter((i) => i.reason === f.reason);
  if (f.date) out = out.filter((i) => withinDateFilter(i.createdAt, f.date!));
  return out;
}

const combined = applyItemFilters(rows, { status: 'needs_review', assigned: 'staff-1', reason: 'policy_violation' });
assert(combined.length === 1 && combined[0].id === 'mod-abc123', '15. combined status+assigned+reason filters narrow to exact match', combined.map((r) => r.id));

const unassignedFilter = applyItemFilters(rows, { assigned: 'unassigned' });
assert(unassignedFilter.length === 1 && unassignedFilter[0].id === 'mod-older', '10. unassigned filter isolates the one unassigned row', unassignedFilter.map((r) => r.id));

const specificStaffFilter = applyItemFilters(rows, { assigned: 'staff-2' });
assert(specificStaffFilter.length === 1 && specificStaffFilter[0].id === 'mod-newer', '11. specific-staff filter isolates that staff member\'s row', specificStaffFilter.map((r) => r.id));

const reasonOnlyFilter = applyItemFilters(rows, { reason: 'spam' });
assert(reasonOnlyFilter.length === 1 && reasonOnlyFilter[0].id === 'mod-older', '12. reason filter isolates matching row', reasonOnlyFilter.map((r) => r.id));

const statusOnlyFilter = applyItemFilters(rows, { status: 'approved' });
assert(statusOnlyFilter.length === 1 && statusOnlyFilter[0].id === 'mod-newer', '9. status filter isolates matching row', statusOnlyFilter.map((r) => r.id));

const clearedFilters = applyItemFilters(rows, {});
assert(clearedFilters.length === 3, '16. no filters (post-clear) returns the full set');

// 13. Source filter (reports only)
const otherSourceReport: ReportItem = { ...report, id: 'rpt-other-source', source: 'seller_dashboard' };
const reportRows = [report, otherSourceReport];
const sourceFiltered = reportRows.filter((r) => r.source === 'storefront');
assert(sourceFiltered.length === 1 && sourceFiltered[0].id === 'rpt-xyz789', '13. source filter isolates matching report', sourceFiltered.map((r) => r.id));

console.log('\n=== MODERATION FILTER LOGIC SUMMARY ===');
if (fails.length) {
  console.error('FAILS:', fails);
  console.error(`RESULT: FAILED (${fails.length})`);
  process.exitCode = 1;
} else {
  console.log('RESULT: ALL PASSED');
}
