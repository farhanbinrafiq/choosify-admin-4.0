import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Inbox, RefreshCw, Search } from 'lucide-react';
import { operationsApi, type OpsLead } from '../../services/operationsApi';
import {
  INQUIRY_STATUSES,
  INQUIRY_TYPES,
  inquiryStatusLabel,
  inquiryTypeLabel,
} from '../../../shared/inquiries/inquiryOptions';

export const INQUIRY_STATUS_TONE: Record<string, string> = {
  new: 'bg-[#FFF1EE] text-[#C8321A] border-[#FAD0C7]',
  reviewing: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-slate-100 text-slate-500 border-slate-200',
  spam: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function InquiryStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${INQUIRY_STATUS_TONE[status] ?? INQUIRY_STATUS_TONE.closed}`}>
      {inquiryStatusLabel(status)}
    </span>
  );
}

/** Admin inbox for public business inquiries (Suggest a Brand / Partnership / Advertise / Contact). */
export default function LeadsInboxPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<OpsLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await operationsApi.listLeads());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    return byStatus;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (typeFilter !== 'all' && (lead.inquiryType ?? 'general_contact') !== typeFilter) return false;
      if (statusFilter === 'open' && ['closed', 'rejected', 'spam'].includes(lead.status)) return false;
      if (statusFilter !== 'open' && statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!q) return true;
      return [lead.referenceId, lead.brandName, lead.email, lead.contactPerson, lead.subject]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, query, typeFilter, statusFilter]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-app-accent" />
            Inquiries
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Brand suggestions, partnership requests, advertising and contact inquiries from the public site.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLeads}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['New', counts.new ?? 0],
          ['Reviewing', counts.reviewing ?? 0],
          ['Contacted / Qualified', (counts.contacted ?? 0) + (counts.qualified ?? 0)],
          ['Resolved', counts.closed ?? 0],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-xl font-extrabold text-slate-900">{n}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference, brand, email, contact…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm"
          />
        </div>
        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="all">All types</option>
          {INQUIRY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option value="open">Open (not resolved)</option>
          <option value="all">All statuses</option>
          {INQUIRY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Brand / Subject</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading inquiries…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {leads.length === 0 ? 'No inquiries yet.' : 'No inquiries match these filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/admin/inquiries/${encodeURIComponent(lead.id)}`)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                >
                  <td className={`px-4 py-3 font-mono text-xs font-bold whitespace-nowrap ${lead.referenceId ? 'text-orange-600' : 'text-slate-400'}`}>
                    {lead.referenceId || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inquiryTypeLabel(lead.inquiryType)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      {lead.brandName}
                      {lead.duplicateSignals?.length ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Possible duplicate" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{lead.contactPerson || '—'}</div>
                    <div className="text-xs text-slate-500">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3"><InquiryStatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
