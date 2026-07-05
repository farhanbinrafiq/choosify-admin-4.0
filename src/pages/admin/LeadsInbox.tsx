import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, Search } from 'lucide-react';
import { operationsApi, type OpsLead } from '../../services/operationsApi';

const STATUS_OPTIONS: OpsLead['status'][] = ['new', 'contacted', 'qualified', 'closed'];

export default function LeadsInboxPage() {
  const [leads, setLeads] = useState<OpsLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await operationsApi.listLeads());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered = leads.filter((lead) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      lead.brandName.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      (lead.contactPerson || '').toLowerCase().includes(q)
    );
  });

  const updateStatus = async (lead: OpsLead, status: OpsLead['status']) => {
    try {
      const saved = await operationsApi.updateLead(lead.id, { status });
      setLeads((prev) => prev.map((row) => (row.id === lead.id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-app-accent" />
            Lead Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">Advertise & sponsorship inquiries from the public site.</p>
        </div>
        <button
          type="button"
          onClick={loadLeads}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brand, email, contact..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white"
        />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Interest</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading leads...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No leads yet.</td></tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{lead.brandName}</div>
                    <div className="text-xs text-slate-500">{lead.source}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{lead.contactPerson || '—'}</div>
                    <div className="text-xs text-slate-500">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.placementInterest || lead.budget || '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(event) => updateStatus(lead, event.target.value as OpsLead['status'])}
                      className="px-2 py-1 rounded border border-slate-200 bg-white capitalize"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
