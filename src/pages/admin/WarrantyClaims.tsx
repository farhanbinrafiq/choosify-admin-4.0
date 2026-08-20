import React, { useEffect, useState } from 'react';
import { ShieldCheck, Clock, CheckCircle2, XCircle, Wrench, X } from 'lucide-react';
import { warrantyClaimsApi, type WarrantyClaim, type WarrantyClaimStatus } from '../../services/warrantyClaimsApi';

const STATUS_LABEL: Record<WarrantyClaimStatus, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  more_info_required: 'More Info Required',
  approved: 'Approved',
  rejected: 'Rejected',
  service_in_progress: 'Service In Progress',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
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

export default function WarrantyClaimsPage() {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WarrantyClaim | null>(null);
  const [responseText, setResponseText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    warrantyClaimsApi
      .list()
      .then(setClaims)
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const act = async (fn: () => Promise<WarrantyClaim>) => {
    setBusy(true);
    try {
      const updated = await fn();
      setSelected(updated);
      setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast('Updated.');
      setResponseText('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-[#EF3C23]" />
        <h1 className="text-xl font-black text-slate-900">Warranty Claims</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">Review and resolve customer warranty claims for your products.</p>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400">
          No warranty claims yet.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Issue</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelected(c)}
                  data-testid="warranty-claim-row"
                >
                  <td className="px-4 py-3 font-mono text-xs">{c.referenceId || c.id}</td>
                  <td className="px-4 py-3">{c.orderId}</td>
                  <td className="px-4 py-3">{ISSUE_LABEL[c.issueType] || c.issueType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.submittedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-slate-400">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-900">Claim {selected.referenceId || selected.id}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-600 mb-4">
              <div>
                <span className="font-bold">Order:</span> {selected.orderId}
              </div>
              <div>
                <span className="font-bold">Warranty:</span> {selected.warrantyMonthsAtPurchase} months
                {selected.warrantyProviderAtPurchase ? ` · ${selected.warrantyProviderAtPurchase}` : ''}
              </div>
              {selected.warrantyExpiresAt && (
                <div>
                  <span className="font-bold">Expires:</span> {new Date(selected.warrantyExpiresAt).toLocaleDateString()}
                </div>
              )}
              <div>
                <span className="font-bold">Issue:</span> {ISSUE_LABEL[selected.issueType] || selected.issueType}
              </div>
              <div>
                <span className="font-bold">Description:</span> {selected.description}
              </div>
              {selected.attachmentMediaIds.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.attachmentMediaIds.map((id) => (
                    <img
                      key={id}
                      src={`${(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1'}/catalog/media/private/${id}`}
                      alt="evidence"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                    />
                  ))}
                </div>
              )}
              <div className="pt-2">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_COLOR[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              {selected.sellerResponse && (
                <div className="pt-2 bg-slate-50 rounded-lg p-2">
                  <span className="font-bold">Your response:</span> {selected.sellerResponse}
                </div>
              )}
            </div>

            {['submitted', 'acknowledged', 'more_info_required', 'approved', 'service_in_progress'].includes(selected.status) && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Response / notes…"
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2"
                />
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'submitted' && (
                    <button
                      disabled={busy}
                      onClick={() => act(() => warrantyClaimsApi.acknowledge(selected.id))}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-blue-50 text-blue-700"
                    >
                      <Clock className="w-3.5 h-3.5" /> Acknowledge
                    </button>
                  )}
                  {(selected.status === 'submitted' || selected.status === 'acknowledged') && (
                    <>
                      <button
                        disabled={busy || !responseText.trim()}
                        onClick={() => act(() => warrantyClaimsApi.requestInfo(selected.id, responseText))}
                        className="text-xs font-bold px-3 py-2 rounded-lg bg-orange-50 text-orange-700 disabled:opacity-40"
                      >
                        Request Info
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => act(() => warrantyClaimsApi.approve(selected.id, responseText || undefined))}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        disabled={busy || !responseText.trim()}
                        onClick={() => act(() => warrantyClaimsApi.reject(selected.id, responseText))}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-rose-50 text-rose-700 disabled:opacity-40"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {selected.status === 'approved' && (
                    <button
                      disabled={busy}
                      onClick={() => act(() => warrantyClaimsApi.serviceStatus(selected.id))}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-purple-50 text-purple-700"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Start Service
                    </button>
                  )}
                  {(selected.status === 'approved' || selected.status === 'service_in_progress') && (
                    <button
                      disabled={busy || !responseText.trim()}
                      onClick={() => act(() => warrantyClaimsApi.resolve(selected.id, responseText))}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
