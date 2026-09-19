import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Wrench,
  AlertTriangle,
  FileText,
  Truck,
  Loader2,
} from 'lucide-react';
import {
  warrantyClaimsApi,
  type WarrantyClaim,
  type WarrantyClaimStatus,
  type WarrantyClaimServiceStage,
  type WarrantyClaimResolutionType,
  type WarrantyClaimAttachmentCategory,
} from '../../services/warrantyClaimsApi';
import { useAuth } from '../../contexts/AuthContext';

const STAFF_ROLES = new Set(['super_admin', 'admin', 'moderator', 'finance_manager', 'support_agent']);

// No document exists before the claim is actually accepted and moving through
// repair — there's nothing to print for a request that's still pending
// review. Once accepted the buyer needs a Warranty Delivery Invoice covering
// the repair/replacement period, available from approval through resolution.
const DELIVERY_INVOICE_ELIGIBLE_STATUSES = new Set<WarrantyClaimStatus>(['approved', 'service_in_progress', 'resolved']);

const ATTACHMENT_CATEGORIES: WarrantyClaimAttachmentCategory[] = ['warrantyCard', 'productPhoto', 'box', 'receipt'];
const ATTACHMENT_CATEGORY_LABEL: Record<WarrantyClaimAttachmentCategory, string> = {
  warrantyCard: 'Warranty Card',
  productPhoto: 'Product Issue Photos',
  box: 'Box',
  receipt: 'Original Invoice / Money Receipt',
};

/**
 * Full Warranty Claim Details — a dedicated workspace page, same pattern as
 * Order Details (/admin/orders/:orderId): a back link to the queue, the case
 * summary + timeline as the primary reading surface, and an actions rail —
 * not a small popup card. Route: /admin/warranty-claims/:id (accepts either
 * the internal id or the canonical WC-##### reference id).
 */

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

const SERVICE_STAGE_LABEL: Record<WarrantyClaimServiceStage, string> = {
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

const SERVICE_STAGE_ORDER: WarrantyClaimServiceStage[] = [
  'return_requested',
  'in_transit',
  'received',
  'under_review',
  'repair_in_progress',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
];

const ISSUE_LABEL: Record<string, string> = {
  not_powering_on: 'Not powering on',
  manufacturing_defect: 'Manufacturing defect',
  physical_damage: 'Physical damage',
  battery_charging: 'Battery/charging',
  performance_software: 'Performance/software',
  missing_damaged_accessory: 'Missing/damaged accessory',
  other: 'Other',
};

const RESOLUTION_TYPE_LABEL: Record<WarrantyClaimResolutionType, string> = {
  repaired: 'Repaired',
  replaced: 'Replaced',
  refunded: 'Refunded',
  rejected: 'Rejected',
  no_fault_found: 'No Fault Found',
  other: 'Other',
};

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 12, padding: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', marginBottom: 12 };
const fieldRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid #F1F3F5' };

export default function WarrantyClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isStaff = Boolean(profile?.role && STAFF_ROLES.has(profile.role));
  const [claim, setClaim] = useState<WarrantyClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [responseText, setResponseText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [resolutionType, setResolutionType] = useState<WarrantyClaimResolutionType | ''>('');
  const [refundAmount, setRefundAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    warrantyClaimsApi
      .get(id)
      .then((row) => {
        setClaim(row);
        setEstimatedCompletionDate(row.estimatedCompletionDate?.slice(0, 10) || '');
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load claim'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const act = async (fn: () => Promise<WarrantyClaim>) => {
    setBusy(true);
    try {
      const updated = await fn();
      setClaim(updated);
      showToast('Updated.');
      setResponseText('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const nextServiceStage = useMemo(() => {
    if (!claim?.serviceStage) return SERVICE_STAGE_ORDER[0];
    const idx = SERVICE_STAGE_ORDER.indexOf(claim.serviceStage);
    return idx >= 0 && idx < SERVICE_STAGE_ORDER.length - 1 ? SERVICE_STAGE_ORDER[idx + 1] : null;
  }, [claim?.serviceStage]);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading claim…
      </div>
    );
  }
  if (error || !claim) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link to="/admin/warranty-claims" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Warranty Claims
        </Link>
        <div className="border border-dashed border-rose-200 bg-rose-50 rounded-xl p-6 text-sm text-rose-600">{error || 'Claim not found.'}</div>
      </div>
    );
  }

  const isTerminal = ['rejected', 'resolved', 'cancelled', 'disputed'].includes(claim.status);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <button onClick={() => navigate('/admin/warranty-claims')} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Warranty Claims
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#EF3C23]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 font-mono">{claim.referenceId || claim.id}</h1>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_COLOR[claim.status]}`}>
                {STATUS_LABEL[claim.status]}
                {claim.status === 'service_in_progress' && claim.serviceStage ? ` · ${SERVICE_STAGE_LABEL[claim.serviceStage]}` : ''}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Order {claim.orderId}</div>
          </div>
        </div>
        {DELIVERY_INVOICE_ELIGIBLE_STATUSES.has(claim.status) && (
          <Link
            to={`/admin/warranty-claims/${claim.id}/document`}
            target="_blank"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <FileText className="w-3.5 h-3.5" /> Warranty Delivery Invoice
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-5">
          <div style={card}>
            <div style={sectionTitle}>Case Summary</div>
            <div style={fieldRow}><span className="text-slate-500">Order ID</span><span className="font-bold">{claim.orderId}</span></div>
            <div style={fieldRow}><span className="text-slate-500">Buyer</span><span className="font-mono">{claim.consumerId}</span></div>
            <div style={fieldRow}><span className="text-slate-500">Warranty duration</span><span className="font-bold">{claim.warrantyMonthsAtPurchase ? `${claim.warrantyMonthsAtPurchase} months` : '—'}{claim.warrantyProviderAtPurchase ? ` · ${claim.warrantyProviderAtPurchase}` : ''}</span></div>
            <div style={fieldRow}><span className="text-slate-500">Coverage start</span><span>{claim.warrantyStartsAt ? new Date(claim.warrantyStartsAt).toLocaleDateString() : '—'}</span></div>
            <div style={fieldRow}><span className="text-slate-500">Coverage expiry</span><span>{claim.warrantyExpiresAt ? new Date(claim.warrantyExpiresAt).toLocaleDateString() : '—'}</span></div>
            <div style={{ ...fieldRow, borderBottom: 'none' }}><span className="text-slate-500">Claim submitted</span><span>{new Date(claim.submittedAt).toLocaleString()}</span></div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Issue Reported</div>
            <div className="text-sm font-bold text-slate-900 mb-1.5">{ISSUE_LABEL[claim.issueType] || claim.issueType}</div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{claim.description}</p>
          </div>

          {claim.resolutionType && (
            <div style={card}>
              <div style={sectionTitle}>Outcome</div>
              <div className="text-sm font-bold text-slate-900 mb-1">{RESOLUTION_TYPE_LABEL[claim.resolutionType]}</div>
              {claim.resolutionNotes && <p className="text-sm text-slate-600 whitespace-pre-wrap">{claim.resolutionNotes}</p>}
              {claim.resolvedAt && <div className="text-xs text-slate-400 mt-2">Resolved {new Date(claim.resolvedAt).toLocaleString()}</div>}
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>Timeline</div>
            {claim.timeline && claim.timeline.length > 0 ? (
              <ol className="space-y-3">
                {claim.timeline.slice().reverse().map((t) => (
                  <li key={t.id} className="flex gap-3 text-xs">
                    <span className="text-slate-400 shrink-0 w-32">{new Date(t.at).toLocaleString()}</span>
                    <span className="text-slate-700">
                      <span className="font-bold text-slate-900">{STATUS_LABEL[t.status] || t.status}</span>
                      {t.serviceStage ? ` · ${SERVICE_STAGE_LABEL[t.serviceStage]}` : ''}
                      {t.note ? ` — ${t.note}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-xs text-slate-400">No history yet.</div>
            )}
          </div>

          {(claim.internalNotes?.length ?? 0) > 0 && (
            <div style={card}>
              <div style={sectionTitle}>Internal Notes (staff/seller only — never shown to buyer)</div>
              <ul className="space-y-2">
                {claim.internalNotes!.map((n) => (
                  <li key={n.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">{new Date(n.at).toLocaleString()}</span> — {n.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>Buyer-Submitted Evidence — Photos &amp; Video ({claim.attachmentMediaIds.length})</div>
            {claim.attachmentMediaIds.length === 0 ? (
              <div className="text-xs text-slate-400">No evidence photographs uploaded with request.</div>
            ) : ATTACHMENT_CATEGORIES.some((cat) => (claim.attachmentCategories?.[cat]?.length ?? 0) > 0) ? (
              <div className="space-y-4">
                {ATTACHMENT_CATEGORIES.filter((cat) => (claim.attachmentCategories?.[cat]?.length ?? 0) > 0).map((cat) => (
                  <div key={cat}>
                    <div className="text-[11px] font-bold text-slate-500 mb-1.5">{ATTACHMENT_CATEGORY_LABEL[cat]}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {claim.attachmentCategories![cat]!.map((mid) => (
                        <img
                          key={mid}
                          src={`${(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1'}/catalog/media/private/${mid}`}
                          alt={ATTACHMENT_CATEGORY_LABEL[cat]}
                          className="aspect-square object-cover rounded-md border border-slate-200"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {claim.attachmentMediaIds.map((mid) => (
                  <img
                    key={mid}
                    src={`${(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1'}/catalog/media/private/${mid}`}
                    alt="evidence"
                    className="aspect-square object-cover rounded-md border border-slate-200"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Actions rail ── */}
        <div className="space-y-5">
          {claim.estimatedCompletionDate && (
            <div style={card}>
              <div style={sectionTitle}>Estimated Completion</div>
              <div className="text-sm font-bold text-slate-900">{new Date(claim.estimatedCompletionDate).toLocaleDateString()}</div>
            </div>
          )}

          {(claim.status === 'service_in_progress' || claim.status === 'approved') && (
            <div style={card}>
              <div style={sectionTitle}>Logistics</div>
              <div className="flex flex-col gap-2">
                <button
                  disabled={busy}
                  onClick={() => act(async () => { await warrantyClaimsApi.createShipment(claim.id, 'return_pickup'); return warrantyClaimsApi.get(claim.id); })}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700"
                >
                  <Truck className="w-3.5 h-3.5" /> Request Return Pickup
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(async () => { await warrantyClaimsApi.createShipment(claim.id, 'redelivery'); return warrantyClaimsApi.get(claim.id); })}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700"
                >
                  <Truck className="w-3.5 h-3.5" /> Schedule Redelivery
                </button>
              </div>
            </div>
          )}

          {!isTerminal && (
            <div style={card}>
              <div style={sectionTitle}>Customer-Visible Note</div>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="e.g. Inspection may take up to 15 days…"
                rows={3}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 mb-2"
              />
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Estimated completion</label>
              <input
                type="date"
                value={estimatedCompletionDate}
                onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 w-full"
              />
              <button
                disabled={busy || (!responseText.trim() && !estimatedCompletionDate)}
                onClick={() => act(() => warrantyClaimsApi.addNote(claim.id, responseText || undefined, estimatedCompletionDate || undefined))}
                className="w-full text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
              >
                Post Note
              </button>
            </div>
          )}

          {!isTerminal && (
            <div style={card}>
              <div style={sectionTitle}>Actions</div>
              <div className="flex flex-col gap-2">
                {claim.status === 'submitted' && (
                  <button disabled={busy} onClick={() => act(() => warrantyClaimsApi.acknowledge(claim.id))} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-blue-50 text-blue-700">
                    <Clock className="w-3.5 h-3.5" /> Acknowledge (Seller Viewed)
                  </button>
                )}
                {(claim.status === 'submitted' || claim.status === 'acknowledged') && (
                  <>
                    <button disabled={busy || !responseText.trim()} onClick={() => act(() => warrantyClaimsApi.requestInfo(claim.id, responseText))} className="text-xs font-bold px-3 py-2 rounded-lg bg-orange-50 text-orange-700 disabled:opacity-40">
                      Request Info
                    </button>
                    <button
                      disabled={busy || claim.status === 'submitted'}
                      title={claim.status === 'submitted' ? 'Acknowledge the claim first' : undefined}
                      onClick={() => act(() => warrantyClaimsApi.approve(claim.id, responseText || undefined, estimatedCompletionDate || undefined))}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accept Claim
                    </button>
                    <button disabled={busy || !responseText.trim()} onClick={() => act(() => warrantyClaimsApi.reject(claim.id, responseText))} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-rose-50 text-rose-700 disabled:opacity-40">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                {claim.status === 'approved' && (
                  <button disabled={busy} onClick={() => act(() => warrantyClaimsApi.serviceStatus(claim.id, 'return_requested', estimatedCompletionDate || undefined))} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-purple-50 text-purple-700">
                    <Wrench className="w-3.5 h-3.5" /> Start Resolution
                  </button>
                )}
                {claim.status === 'service_in_progress' && nextServiceStage && (
                  <button
                    disabled={busy}
                    onClick={() => act(() => warrantyClaimsApi.advanceServiceStage(claim.id, nextServiceStage, responseText || undefined, estimatedCompletionDate || undefined))}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-purple-50 text-purple-700"
                  >
                    <Wrench className="w-3.5 h-3.5" /> Advance to {SERVICE_STAGE_LABEL[nextServiceStage]}
                  </button>
                )}

                {(claim.status === 'approved' || claim.status === 'service_in_progress') && (
                  <div className="border-t border-slate-100 pt-2 mt-1 space-y-2">
                    <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value as WarrantyClaimResolutionType)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2">
                      <option value="">Outcome…</option>
                      <option value="repaired">Repaired</option>
                      <option value="replaced">Replaced</option>
                      <option value="refunded" disabled={!isStaff}>Refunded {isStaff ? '' : '(staff only)'}</option>
                      <option value="no_fault_found">No Fault Found</option>
                      <option value="other">Other</option>
                    </select>
                    {resolutionType === 'refunded' && (
                      <input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Refund amount" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2" />
                    )}
                    <button
                      disabled={
                        busy ||
                        !responseText.trim() ||
                        !resolutionType ||
                        (resolutionType === 'refunded' && (!isStaff || !(Number(refundAmount) > 0)))
                      }
                      onClick={() => act(() => warrantyClaimsApi.resolve(claim.id, responseText, resolutionType as WarrantyClaimResolutionType, resolutionType === 'refunded' ? Number(refundAmount) : undefined))}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </button>
                    {resolutionType === 'refunded' && !isStaff && (
                      <p className="text-[10.5px] text-slate-400 italic">Only Choosify staff can dispatch a refund payout.</p>
                    )}
                  </div>
                )}

                <button disabled={busy} onClick={() => act(() => warrantyClaimsApi.escalateToDispute(claim.id).then((r) => r.data))} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-50 text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Dispute
                </button>
              </div>
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>Internal Note</div>
            <div className="flex gap-2">
              <input
                value={internalNoteText}
                onChange={(e) => setInternalNoteText(e.target.value)}
                placeholder="Staff/seller only…"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
              />
              <button
                disabled={busy || !internalNoteText.trim()}
                onClick={() => act(async () => { const updated = await warrantyClaimsApi.addInternalNote(claim.id, internalNoteText); setInternalNoteText(''); return updated; })}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
