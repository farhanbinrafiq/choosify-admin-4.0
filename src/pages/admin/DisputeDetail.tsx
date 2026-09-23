import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Scale } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { disputesApi, type Dispute, type DisputeDecision, type DisputeStatus } from '../../services/disputesApi';

/** Full-page Dispute detail — not a popup. Staff (admin/moderator/support/finance) get workflow + decision controls; a buyer/seller viewing their own dispute (if ever linked in from their own dashboard) sees a read-only view plus evidence/statement submission. */

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

const STATUS_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  raised: ['evidence_collection', 'under_review', 'closed'],
  evidence_collection: ['under_review', 'awaiting_buyer', 'awaiting_seller', 'closed'],
  under_review: ['awaiting_buyer', 'awaiting_seller', 'decision_pending', 'closed'],
  awaiting_buyer: ['under_review', 'decision_pending', 'closed'],
  awaiting_seller: ['under_review', 'decision_pending', 'closed'],
  decision_pending: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

const DECISION_OPTIONS: Array<{ value: DisputeDecision; label: string }> = [
  { value: 'uphold_seller', label: "Uphold Seller's decision" },
  { value: 'uphold_buyer', label: "Uphold Buyer's claim" },
  { value: 'partial', label: 'Partial resolution' },
  { value: 'refund_approved', label: 'Refund approved' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'dismissed', label: 'Case dismissed' },
];

const SOURCE_LINK: Record<string, { label: string; to: string }> = {
  return: { label: 'Returns & Refunds', to: '/admin/returns' },
  warranty_claim: { label: 'Warranty Claims', to: '/admin/warranty-claims' },
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isStaff = profile?.role ? ['super_admin', 'admin', 'moderator', 'support_agent', 'finance_manager'].includes(profile.role) : false;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [decision, setDecision] = useState<DisputeDecision>('uphold_seller');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionResultNote, setDecisionResultNote] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setDispute(await disputesApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error || !dispute) {
    return <div className="p-8 text-[13px] font-semibold text-red-600">{error || 'Dispute not found'}</div>;
  }

  const sourceLink = SOURCE_LINK[dispute.sourceType];
  const allowedTransitions = STATUS_TRANSITIONS[dispute.status] ?? [];
  const isResolved = dispute.status === 'resolved' || dispute.status === 'closed';

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-5 md:px-6">
      <button type="button" onClick={() => navigate('/admin/disputes')} className="mb-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#6B7280] hover:text-[#111827]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Disputes
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[16px] font-extrabold text-[#111827]">
            <Scale className="h-4 w-4 text-orange-500" /> {dispute.id}
          </div>
          <div className="text-[11px] font-semibold text-[#6B7280]">Raised {fmtDateTime(dispute.createdAt)}</div>
        </div>
        <span className="rounded-full border border-[#E8EDF2] bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold uppercase text-[#374151]">{STATUS_LABELS[dispute.status]}</span>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#E8EDF2] bg-white p-4 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Source</div>
          <div className="font-semibold text-[#1A1A2E]">
            {dispute.sourceType.replace('_', ' ')} <span className="font-mono text-[11px] text-[#6B7280]">{dispute.sourceId}</span>
          </div>
          {sourceLink && (
            <Link to={sourceLink.to} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline">
              Open {sourceLink.label} <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Order</div>
          <div className="font-mono text-[11px] text-[#1A1A2E]">{dispute.orderId}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Buyer / Seller</div>
          <div className="font-mono text-[11px] text-[#1A1A2E]">{dispute.buyerId}</div>
          <div className="font-mono text-[11px] text-[#1A1A2E]">{dispute.sellerId}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Amount / value</div>
          <div className="font-semibold text-[#1A1A2E]">{typeof dispute.amount === 'number' ? `৳${dispute.amount.toLocaleString()}` : '—'}</div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Reason</div>
        <div className="text-[12.5px] text-[#1A1A2E]">{dispute.reason}</div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Buyer statement</div>
          <div className="text-[12.5px] text-[#1A1A2E]">{dispute.buyerStatement || '—'}</div>
        </div>
        <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Seller statement</div>
          <div className="text-[12.5px] text-[#1A1A2E]">{dispute.sellerStatement || '—'}</div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Evidence ({dispute.evidence.length})</div>
        {dispute.evidence.length === 0 ? (
          <div className="text-[12px] text-[#9AA0AC]">No evidence submitted yet.</div>
        ) : (
          <div className="space-y-2">
            {dispute.evidence.map((e) => (
              <div key={e.id} className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12px]">
                <span className="font-bold uppercase text-[#374151]">{e.submittedBy}</span>: {e.description}
                {e.mediaUrl && (
                  <a href={e.mediaUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-orange-600 hover:underline">
                    attachment
                  </a>
                )}
                <div className="text-[10px] text-[#9AA0AC]">{fmtDateTime(e.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
        {!isResolved && (
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
              placeholder="Describe the evidence you're submitting…"
              value={evidenceDraft}
              onChange={(e) => setEvidenceDraft(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !evidenceDraft.trim()}
              onClick={() => withBusy(async () => { await disputesApi.addEvidence(dispute.id, evidenceDraft.trim()); setEvidenceDraft(''); })}
              className="rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Timeline</div>
        <div className="space-y-2">
          {dispute.timeline.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-[11.5px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9AA0AC]" />
              <div>
                <span className="font-bold text-[#1A1A2E]">
                  {t.type === 'status_change' ? `${t.fromStatus ? STATUS_LABELS[t.fromStatus] : ''} → ${t.toStatus ? STATUS_LABELS[t.toStatus] : ''}` : t.type.replace('_', ' ')}
                </span>{' '}
                {t.text && <span className="text-[#6B7280]">— {t.text}</span>}
                <span className="ml-1 text-[10px] text-[#9AA0AC]">{fmtDateTime(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isStaff && (
        <>
          <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Admin internal notes (staff only)</div>
            {dispute.adminNotes.length > 0 && (
              <ul className="mb-2 list-disc space-y-1 pl-4 text-[12px] text-[#1A1A2E]">
                {dispute.adminNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input className="flex-1 rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" placeholder="Internal note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
              <button
                type="button"
                disabled={busy || !noteDraft.trim()}
                onClick={() => withBusy(async () => { await disputesApi.addNote(dispute.id, noteDraft.trim()); setNoteDraft(''); })}
                className="rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                Add note
              </button>
            </div>
          </div>

          {!isResolved && allowedTransitions.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Move workflow status</div>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => withBusy(() => disputesApi.setStatus(dispute.id, s))}
                    className="rounded-full border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-bold text-[#374151] disabled:opacity-50"
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isResolved && (
            <div className="rounded-xl border-2 border-[#111827] bg-white p-4">
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">Super Admin decision</div>
              {decisionResultNote && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{decisionResultNote}</div>}
              <select className="mb-2 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" value={decision} onChange={(e) => setDecision(e.target.value as DisputeDecision)}>
                {DECISION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input className="mb-2 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]" placeholder="Decision notes (optional)" value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  withBusy(async () => {
                    const result = await disputesApi.decide(dispute.id, decision, decisionNotes.trim() || undefined);
                    setDecisionResultNote(result.note ?? null);
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Record decision
              </button>
              <div className="mt-2 text-[10.5px] text-[#9AA0AC]">
                This records the adjudication decision only. Any refund must still be processed via Returns & Refunds using the canonical refund flow — deciding a dispute never moves money on its own.
              </div>
            </div>
          )}
        </>
      )}

      {dispute.decision && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">Final decision</div>
          <div className="text-[12.5px] font-semibold text-emerald-900">{DECISION_OPTIONS.find((o) => o.value === dispute.decision)?.label ?? dispute.decision}</div>
          {dispute.decisionNotes && <div className="mt-1 text-[12px] text-emerald-800">{dispute.decisionNotes}</div>}
          <div className="mt-1 text-[10.5px] text-emerald-700">Decided {dispute.decidedAt ? fmtDateTime(dispute.decidedAt) : ''}</div>
        </div>
      )}
    </div>
  );
}
