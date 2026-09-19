import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Truck,
  DollarSign,
  AlertTriangle,
  Printer,
  CheckCircle2,
  XCircle,
  ZoomIn,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { useReturns, ReturnRequest } from '../../contexts/ReturnsContext';
import { useOrders } from '../../contexts/OrdersContext';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, BadgeVariant } from '../../components/ui/Badge';

const STAFF_ROLES = new Set(['super_admin', 'admin', 'moderator', 'finance_manager', 'support_agent']);

/**
 * Full Return / Refund Case Details — same dedicated-page pattern as
 * /admin/orders/:orderId and /admin/warranty-claims/:id: a back link to the
 * Control Desk queue, the case as the primary reading surface, and an
 * actions rail — not a small popup card. Route: /admin/returns/:id (accepts
 * either the internal id or the canonical RT-##### reference id).
 */

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  initiated: 'warning',
  dispute: 'danger',
  rejected: 'neutral',
  approved: 'info',
  returned_in_transit: 'accent',
  received: 'success',
  refunded: 'success',
};

const STATUS_LABEL: Record<string, string> = {
  initiated: 'New Request',
  approved: 'Approved',
  rejected: 'Rejected',
  returned_in_transit: 'Return In Transit',
  received: 'Item Received',
  refunded: 'Refunded',
  dispute: 'Disputed',
};

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 12, padding: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', marginBottom: 12 };
const fieldRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid #F1F3F5' };

export default function ReturnCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    returnRequests,
    loading,
    approveReturn,
    rejectReturn,
    processRefund,
    addReturnNote,
    addInternalNote,
    updateReturnStatus,
    generateReturnLabel,
    linkReturnToDispute,
  } = useReturns();
  const { orders } = useOrders();
  const { profile } = useAuth();
  const isStaff = Boolean(profile?.role && STAFF_ROLES.has(profile.role));

  const ret: ReturnRequest | undefined = returnRequests.find((r) => r.id === id || r.referenceId === id);

  const [noteInput, setNoteInput] = useState('');
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [refundInput, setRefundInput] = useState<number>(0);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [requiresReturnInput, setRequiresReturnInput] = useState(true);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const order = ret ? orders.find((o) => o.id === ret.orderId) : undefined;

  useEffect(() => {
    if (ret) {
      const totalPayable = order?.total_payable || order?.product.price || 0;
      setRefundInput(ret.refundAmount || totalPayable);
      setIsRejecting(false);
      setRejectReasonInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ret?.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setActionBusy(label);
    try {
      await fn();
      showToast('Updated.');
      setNoteInput('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setActionBusy(null);
    }
  };

  if (loading && !ret) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading case…
      </div>
    );
  }
  if (!ret) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => navigate('/admin/returns')} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Returns & Refunds
        </button>
        <div className="border border-dashed border-rose-200 bg-rose-50 rounded-xl p-6 text-sm text-rose-600">Case not found.</div>
      </div>
    );
  }

  const limit = order?.total_payable || order?.product.price || 99999;
  const isTerminal = ret.status === 'refunded' || ret.status === 'rejected' || ret.status === 'dispute';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}
      {zoomImg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 cursor-zoom-out" onClick={() => setZoomImg(null)}>
          <div className="relative max-w-3xl w-full">
            <img src={zoomImg} alt="evidence" className="w-full h-auto rounded-md border border-slate-200 shadow-2xl" />
            <button onClick={() => setZoomImg(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <button onClick={() => navigate('/admin/returns')} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Returns & Refunds
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-app-accent" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 font-mono">{ret.referenceId || ret.id}</h1>
              <Badge variant={STATUS_VARIANT[ret.status] || 'neutral'}>{STATUS_LABEL[ret.status] || ret.status}</Badge>
            </div>
            <div className="text-xs text-slate-500 mt-1">Order {ret.orderId}</div>
          </div>
        </div>
        <Link
          to={`/admin/returns/${ret.id}/document`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          <FileText className="w-3.5 h-3.5" /> Return / Refund Document
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-5">
          <div style={card}>
            <div style={sectionTitle}>Case Summary</div>
            <div style={fieldRow}><span className="text-slate-500">Order ID</span><span className="font-bold">{ret.orderId}</span></div>
            <div style={fieldRow}><span className="text-slate-500">Customer</span><span>{order?.customer.name || 'Unknown'} ({order?.customer.email || 'N/A'})</span></div>
            <div style={fieldRow}><span className="text-slate-500">Seller</span><span className="font-mono">{ret.sellerId}</span></div>
            <div style={fieldRow}>
              <span className="text-slate-500">Resolution</span>
              <span className="font-bold">
                {ret.status === 'initiated'
                  ? 'Pending decision'
                  : ret.requiresReturn === false
                    ? 'Refund without return'
                    : 'Return + Refund'}
              </span>
            </div>
            <div style={fieldRow}><span className="text-slate-500">Refund amount</span><span className="font-bold font-mono">৳{(ret.refundAmount || limit).toLocaleString()}</span></div>
            <div style={{ ...fieldRow, borderBottom: 'none' }}><span className="text-slate-500">Case submitted</span><span>{new Date(ret.createdAt).toLocaleString()}</span></div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Reason & Description</div>
            <div className="text-sm font-bold text-slate-900 mb-1.5 capitalize">{ret.reason.replace(/_/g, ' ')}</div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{ret.description}</p>
          </div>

          {ret.returnTrackingId && (
            <div style={card}>
              <div style={sectionTitle}>Return Shipment</div>
              <div style={fieldRow}><span className="text-slate-500">Courier</span><span className="font-bold">{ret.returnCourier}</span></div>
              <div style={{ ...fieldRow, borderBottom: 'none' }}><span className="text-slate-500">Tracking ID</span><span className="font-mono">{ret.returnTrackingId}</span></div>
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>Timeline</div>
            {ret.timeline && ret.timeline.length > 0 ? (
              <ol className="space-y-3">
                {ret.timeline.slice().reverse().map((t) => (
                  <li key={t.id} className="flex gap-3 text-xs">
                    <span className="text-slate-400 shrink-0 w-32">{new Date(t.at).toLocaleString()}</span>
                    <span className="text-slate-700">
                      <span className="font-bold text-slate-900">{STATUS_LABEL[t.status] || t.status}</span>
                      {t.note ? ` — ${t.note}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-xs text-slate-400">No history yet.</div>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>Decision & Status Notes (visible to buyer &amp; seller)</div>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {ret.notes.length > 0 ? (
                ret.notes.map((n, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs text-slate-600">{n}</div>
                ))
              ) : (
                <div className="text-xs text-slate-400">No notes yet.</div>
              )}
            </div>
            {!isTerminal && (
              <div className="flex gap-2">
                <input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add a note visible to the customer and seller…"
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                />
                <button
                  disabled={actionBusy === 'note' || !noteInput.trim()}
                  onClick={() => act(() => addReturnNote(ret.id, noteInput.trim()), 'note')}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {(ret.internalNotes?.length ?? 0) > 0 && (
            <div style={card}>
              <div style={sectionTitle}>Internal Notes (staff/seller only — never shown to buyer)</div>
              <ul className="space-y-2">
                {ret.internalNotes!.map((n) => (
                  <li key={n.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">{new Date(n.at).toLocaleString()}</span> — {n.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>
              Buyer-Submitted Evidence — Photos &amp; Video ({(ret.evidencePhotos?.length || 0) + (ret.evidenceMediaIds?.length || 0)})
            </div>
            {ret.evidencePhotos.length > 0 || (ret.evidenceMediaIds?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {ret.evidencePhotos.map((img, i) => (
                  <div key={`legacy-${i}`} onClick={() => setZoomImg(img)} className="relative group aspect-square rounded-md overflow-hidden bg-white border border-slate-200 cursor-zoom-in">
                    <img src={img} alt="evidence" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <ZoomIn className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ))}
                {(ret.evidenceMediaIds || []).map((mid) => {
                  const url = `${(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1'}/catalog/media/private/${mid}`;
                  return (
                    <div key={mid} onClick={() => setZoomImg(url)} className="relative group aspect-square rounded-md overflow-hidden bg-white border border-slate-200 cursor-zoom-in">
                      <img src={url} alt="evidence" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400">No evidence photographs uploaded with request.</div>
            )}
            {ret.videoLink ? (
              <a
                href={ret.videoLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-app-accent hover:underline"
              >
                View buyer-submitted video (Google Drive link) ↗
              </a>
            ) : (
              <div className="text-xs text-slate-400 mt-3">No video link was submitted with this request.</div>
            )}
          </div>
        </div>

        {/* ── Actions rail ── */}
        <div className="space-y-5">
          {ret.status === 'initiated' && (
            <div style={card}>
              <div style={sectionTitle}>Review Request</div>
              {!isRejecting ? (
                <>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Refund Amount (BDT)</label>
                  <input
                    type="number"
                    value={refundInput}
                    onChange={(e) => setRefundInput(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 mb-3 font-mono"
                  />
                  <label className="flex items-start gap-2 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresReturnInput}
                      onChange={(e) => setRequiresReturnInput(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-[11px] text-slate-600 leading-relaxed">
                      Buyer must send the item back before the refund is processed.{' '}
                      <span className="text-slate-400">
                        {requiresReturnInput ? '(Return + Refund)' : '(Refund without return)'}
                      </span>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setIsRejecting(true)} className="text-xs font-bold px-3 py-2 rounded-lg bg-rose-50 text-rose-700">
                      Reject
                    </button>
                    <button
                      disabled={actionBusy === 'approve'}
                      onClick={() => {
                        if (refundInput <= 0) { showToast('Refund amount must be greater than zero.'); return; }
                        if (refundInput > limit) { showToast(`Refund cannot exceed order total (৳${limit.toLocaleString()})`); return; }
                        act(() => approveReturn(ret.id, refundInput, requiresReturnInput, 'Approved by Admin.'), 'approve');
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Rejection Reason</label>
                  <textarea
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    rows={2}
                    placeholder="e.g. Item delivered more than 30 days ago."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 mb-2"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsRejecting(false)} className="text-xs font-bold px-3 py-1.5 text-slate-500">Cancel</button>
                    <button
                      disabled={actionBusy === 'reject'}
                      onClick={() => {
                        if (!rejectReasonInput.trim()) { showToast('A reason is required.'); return; }
                        act(() => rejectReturn(ret.id, rejectReasonInput.trim()), 'reject');
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Confirm Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {ret.status === 'approved' && (
            <div style={card}>
              <div style={sectionTitle}>
                {ret.requiresReturn === false ? 'Refund Without Return' : 'Logistics — Return + Refund'}
              </div>
              {ret.requiresReturn === false ? (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    Approved as refund-without-return — no physical item is expected back. Authorize the payout when ready.
                  </p>
                  <button
                    disabled={actionBusy === 'refund-noreturn' || !isStaff}
                    onClick={() => act(() => processRefund(ret.id), 'refund-noreturn')}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 disabled:opacity-40"
                    title={isStaff ? undefined : 'Only Choosify staff can dispatch a refund payout'}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Process Refund
                  </button>
                  {!isStaff && (
                    <p className="text-[10.5px] text-slate-400 italic mt-2">Awaiting Choosify staff to process the payout.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-3">This case requires the item back before a refund. Print a label, then mark shipped once the buyer dispatches it.</p>
                  <div className="flex flex-col gap-2">
                    <button
                      disabled={actionBusy === 'label'}
                      onClick={() => act(() => generateReturnLabel(ret.id), 'label')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Return Label
                    </button>
                    <button
                      disabled={actionBusy === 'transit'}
                      onClick={() => act(() => updateReturnStatus(ret.id, 'returned_in_transit'), 'transit')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-purple-50 text-purple-700 disabled:opacity-40"
                    >
                      <Truck className="w-3.5 h-3.5" /> Mark Shipped / In Transit
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {ret.status === 'returned_in_transit' && (
            <div style={card}>
              <div style={sectionTitle}>Warehouse Verification</div>
              <p className="text-xs text-slate-500 mb-3">Once the package lands at the seller's warehouse, mark it received to unlock the refund step.</p>
              <button
                disabled={actionBusy === 'received'}
                onClick={() => act(() => updateReturnStatus(ret.id, 'received'), 'received')}
                className="w-full text-xs font-bold px-3 py-2 rounded-lg bg-app-accent text-white disabled:opacity-40"
              >
                Mark as Received at Warehouse
              </button>
            </div>
          )}

          {ret.status === 'received' && (
            <div style={card}>
              <div style={sectionTitle}>Process Refund</div>
              <p className="text-xs text-slate-500 mb-3">
                Item verified. Authorize ৳{(ret.refundAmount || 0).toLocaleString()} refund to the customer's original payment method.
              </p>
              <button
                disabled={actionBusy === 'refund'}
                onClick={() => act(() => processRefund(ret.id), 'refund')}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-app-accent text-white disabled:opacity-40"
              >
                <DollarSign className="w-3.5 h-3.5" /> Process & Issue Refund
              </button>
            </div>
          )}

          {isTerminal && (
            <div style={card} className="text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-xs font-extrabold uppercase text-slate-900">Case Closed</div>
              <p className="text-[11px] text-slate-500 mt-1">This case has reached a final resolution state.</p>
            </div>
          )}

          {!isTerminal && (
            <div style={card}>
              <button
                disabled={actionBusy === 'dispute'}
                onClick={() => act(() => linkReturnToDispute(ret.id, `Return ${ret.id} escalated from Returns & Refunds`), 'dispute')}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-50 text-red-700 disabled:opacity-40"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Dispute
              </button>
            </div>
          )}

          <div style={card}>
            <div style={sectionTitle}>Internal Note</div>
            <div className="flex gap-2">
              <input
                value={internalNoteInput}
                onChange={(e) => setInternalNoteInput(e.target.value)}
                placeholder="Staff/seller only…"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
              />
              <button
                disabled={actionBusy === 'internal-note' || !internalNoteInput.trim()}
                onClick={() =>
                  act(async () => {
                    await addInternalNote(ret.id, internalNoteInput);
                    setInternalNoteInput('');
                  }, 'internal-note')
                }
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
