import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Scale } from 'lucide-react';
import { disputesApi, type Dispute, type DisputeStatus } from '../../services/disputesApi';

/**
 * Disputes — the escalation/adjudication layer. NOT a duplicate of Returns &
 * Refunds, Warranty Claims, or Orders Hub: a dispute only exists when a
 * buyer/seller (or staff) escalates beyond the normal resolution workflow
 * for one of those cases. Every row here links back to its real source
 * case by id rather than duplicating that case's data.
 *
 * Backed by the real server/operations disputes store (JSON-snapshot
 * persisted alongside Returns/Warranty Claims) — created this session,
 * following the exact same pattern those two already use.
 */

const STATUS_LABELS: Record<DisputeStatus, string> = {
  raised: 'Raised',
  evidence_collection: 'Evidence Collection',
  under_review: 'Under Review',
  awaiting_buyer: 'Awaiting Buyer',
  awaiting_seller: 'Awaiting Seller',
  decision_pending: 'Decision Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_STYLE: Record<DisputeStatus, string> = {
  raised: 'bg-amber-50 text-amber-700 border-amber-200',
  evidence_collection: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_buyer: 'bg-orange-50 text-orange-700 border-orange-200',
  awaiting_seller: 'bg-orange-50 text-orange-700 border-orange-200',
  decision_pending: 'bg-purple-50 text-purple-700 border-purple-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-50 text-gray-500 border-gray-200',
};

const SOURCE_LABELS: Record<string, string> = {
  return: 'Return',
  warranty_claim: 'Warranty Claim',
  order: 'Order',
};

type StatusFilter = 'open' | 'all' | DisputeStatus;

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtAmount(amount?: number) {
  if (typeof amount !== 'number') return '—';
  return `৳${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DisputeCenter() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDisputes(await disputesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const OPEN_STATUSES = new Set<DisputeStatus>(['raised', 'evidence_collection', 'under_review', 'awaiting_buyer', 'awaiting_seller', 'decision_pending']);

  const filtered = useMemo(() => {
    if (filter === 'all') return disputes;
    if (filter === 'open') return disputes.filter((d) => OPEN_STATUSES.has(d.status));
    return disputes.filter((d) => d.status === filter);
  }, [disputes, filter]);

  const counts = useMemo(() => {
    const open = disputes.filter((d) => OPEN_STATUSES.has(d.status)).length;
    return { open, total: disputes.length };
  }, [disputes]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-[#111827]">
          <Scale className="h-4 w-4 text-orange-500" /> Disputes
        </div>
        <div className="text-[11px] font-semibold text-[#6B7280]">
          Escalation & adjudication for Returns, Warranty Claims, and Orders · {counts.open} open of {counts.total} total
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['open', 'all', ...Object.keys(STATUS_LABELS)] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide ${
              filter === f ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
            }`}
          >
            {f === 'open' ? 'Open' : f === 'all' ? 'All' : STATUS_LABELS[f as DisputeStatus]}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E8EDF2] p-10 text-center text-[12px] text-[#9AA0AC]">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-[#D1D5DB]" />
          No disputes in this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E8EDF2] bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#E8EDF2] bg-[#F8FAFC] text-left text-[10px] font-black uppercase tracking-wide text-[#9AA0AC]">
                <th className="px-3 py-2.5">Dispute ID</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Reason</th>
                <th className="px-3 py-2.5">Amount</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} onClick={() => navigate(`/admin/disputes/${d.id}`)} className="cursor-pointer border-b border-[#F3F4F6] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-[#1A1A2E]">{d.id}</td>
                  <td className="px-3 py-2.5">
                    {SOURCE_LABELS[d.sourceType] ?? d.sourceType} <span className="font-mono text-[10px] text-[#9AA0AC]">{d.sourceId}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#6B7280]">{d.orderId}</td>
                  <td className="px-3 py-2.5">{d.reason}</td>
                  <td className="px-3 py-2.5">{fmtAmount(d.amount)}</td>
                  <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDate(d.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
