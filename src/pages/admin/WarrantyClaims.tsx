import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, CheckCircle, Wrench, DollarSign, AlertTriangle, Search, Filter, X } from 'lucide-react';
import { warrantyClaimsApi, type WarrantyClaim, type WarrantyClaimStatus, type WarrantyClaimIssueType } from '../../services/warrantyClaimsApi';
import { StatTile } from '../../components/ui/StatTile';

const STATUS_LABEL: Record<WarrantyClaimStatus, string> = {
  submitted: 'Submitted',
  acknowledged: 'Seller Viewed',
  more_info_required: 'More Info Required',
  approved: 'Claim Accepted',
  rejected: 'Rejected',
  service_in_progress: 'Resolution In Progress',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const STATUS_COLOR: Record<WarrantyClaimStatus, string> = {
  submitted: 'bg-amber-100 text-amber-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  more_info_required: 'bg-orange-100 text-orange-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  service_in_progress: 'bg-purple-100 text-purple-700',
  resolved: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-500',
  disputed: 'bg-red-100 text-red-700',
};

const SERVICE_STAGE_LABEL: Record<string, string> = {
  return_requested: 'Return Requested',
  in_transit: 'Product In Transit',
  received: 'Product Received',
  under_review: 'Under Review',
  repair_in_progress: 'Repair In Progress',
  replacement_in_progress: 'Replacement In Progress',
  ready_for_dispatch: 'Ready For Dispatch',
  dispatched: 'Dispatched To Customer',
  delivered: 'Delivered To Customer',
};

const ISSUE_LABEL: Record<string, string> = {
  not_powering_on: 'Not powering on',
  manufacturing_defect: 'Manufacturing defect',
  physical_damage: 'Physical damage',
  battery_charging: 'Battery/charging',
  performance_software: 'Performance/software',
  missing_damaged_accessory: 'Missing/damaged accessory',
  other: 'Other',
};

const ISSUE_OPTIONS: { value: WarrantyClaimIssueType; label: string }[] = [
  { value: 'not_powering_on', label: 'Not powering on' },
  { value: 'manufacturing_defect', label: 'Manufacturing defect' },
  { value: 'physical_damage', label: 'Physical damage' },
  { value: 'battery_charging', label: 'Battery/charging' },
  { value: 'performance_software', label: 'Performance/software' },
  { value: 'missing_damaged_accessory', label: 'Missing/damaged accessory' },
  { value: 'other', label: 'Other' },
];

export default function WarrantyClaimsPage() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [issueFilter, setIssueFilter] = useState<string>('All');

  useEffect(() => {
    warrantyClaimsApi
      .list()
      .then(setClaims)
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, []);

  // Real KPI counts only — derived from the fetched claim list, never fabricated.
  const submittedCount = claims.filter((c) => c.status === 'submitted' || c.status === 'acknowledged' || c.status === 'more_info_required').length;
  const approvedCount = claims.filter((c) => c.status === 'approved').length;
  const inProgressCount = claims.filter((c) => c.status === 'service_in_progress').length;
  const resolvedCount = claims.filter((c) => c.status === 'resolved').length;
  const disputedCount = claims.filter((c) => c.status === 'disputed').length;

  const filteredClaims = claims.filter((c) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (c.referenceId || c.id).toLowerCase().includes(q) ||
      c.orderId.toLowerCase().includes(q) ||
      c.consumerId.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (issueFilter !== 'All' && c.issueType !== issueFilter) return false;
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary p-4 sm:p-6 font-sans">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-app-text-primary flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-app-accent" />
            <span>Warranty & Claims</span>
          </h1>
          <p className="text-xs font-semibold text-app-text-muted mt-1">
            Review and resolve customer warranty claims for products sold on Choosify
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatTile label="Submitted" value={submittedCount} icon={Clock} accent="orange" />
        <StatTile label="Approved" value={approvedCount} icon={CheckCircle} accent="indigo" />
        <StatTile label="In Progress" value={inProgressCount} icon={Wrench} accent="slate" />
        <StatTile label="Resolved" value={resolvedCount} icon={DollarSign} accent="emerald" />
        <div className="col-span-2 md:col-span-1">
          <StatTile label="Disputes" value={disputedCount} icon={AlertTriangle} accent="rose" />
        </div>
      </div>

      <div className="bg-white border border-app-border p-3.5 rounded-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-app-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search claim by Claim ID, Order ID, buyer, or description..."
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-app-bg border border-app-border rounded-md text-app-text-secondary placeholder-app-text-muted focus:outline-none focus:border-app-accent transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 p-0.5 rounded text-app-text-muted hover:text-app-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1 bg-app-bg border border-app-border rounded-md px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-app-text-muted" />
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs font-semibold focus:outline-none pr-1"
            >
              <option value="All">All Issues</option>
              {ISSUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1 bg-app-bg border border-app-border rounded-md px-2 py-1.5">
            <Clock className="w-3.5 h-3.5 text-app-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-app-text-secondary text-xs font-semibold focus:outline-none pr-1"
            >
              <option value="All">All Statuses</option>
              {(Object.keys(STATUS_LABEL) as WarrantyClaimStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-app-text-muted">Loading…</div>
      ) : filteredClaims.length === 0 ? (
        <div className="border border-dashed border-app-border rounded-xl p-10 text-center text-sm text-app-text-muted bg-white">
          {claims.length === 0 ? 'No warranty claims yet.' : 'No claims match the current filters.'}
        </div>
      ) : (
        <div className="bg-white border border-app-border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-app-border text-[10px] text-app-text-disabled uppercase tracking-widest font-extrabold">
                  <th className="p-4">Claim ID</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Buyer</th>
                  <th className="p-4">Warranty</th>
                  <th className="p-4">Issue</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Submitted</th>
                  <th className="p-4">Latest activity</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5]">
                {filteredClaims.map((c) => {
                  const lastActivity = c.timeline?.[c.timeline.length - 1];
                  const warrantyExpired = c.warrantyExpiresAt ? new Date(c.warrantyExpiresAt).getTime() <= Date.now() : false;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/warranty-claims/${c.id}`)}
                      data-testid="warranty-claim-row"
                    >
                      <td className="p-4 font-bold font-mono text-app-accent">{c.referenceId || c.id}</td>
                      <td className="p-4 font-mono font-semibold text-app-text-secondary">{c.orderId}</td>
                      <td className="p-4 font-mono text-xs text-app-text-secondary">{c.consumerId.slice(0, 8)}…</td>
                      <td className="p-4 text-xs">
                        {c.warrantyMonthsAtPurchase ? `${c.warrantyMonthsAtPurchase} mo` : '—'}
                        {warrantyExpired ? <span className="ml-1 text-rose-500">(expired)</span> : null}
                      </td>
                      <td className="p-4 font-semibold text-app-text-secondary">{ISSUE_LABEL[c.issueType] || c.issueType}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLOR[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                          {c.status === 'service_in_progress' && c.serviceStage ? ` · ${SERVICE_STAGE_LABEL[c.serviceStage]}` : ''}
                        </span>
                      </td>
                      <td className="p-4 text-app-text-secondary font-mono font-semibold">{new Date(c.submittedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="p-4 text-app-text-disabled text-xs">{lastActivity ? new Date(lastActivity.at).toLocaleString() : '—'}</td>
                      <td className="p-4 text-right text-app-text-disabled">→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
