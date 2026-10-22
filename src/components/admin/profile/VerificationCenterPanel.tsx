import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { operationsApi, type OpsVerification, type VerificationDocRequest } from '../../../services/operationsApi';
import { getStoredAccessToken } from '../../../services/authRefresh';
import {
  PROFILE_PHOTO_DOCUMENT,
  missingRequiredDocuments,
  verificationDocumentLabel,
  verificationDocumentSpecs,
  type VerificationKind,
} from '../../../../shared/verification/verificationDocuments';

/**
 * Verification Center on the Super Admin profile — the REAL verification
 * requests (GET /operations/verifications) for this seller's brands or this
 * creator: status, every submitted document, per-document decisions, the
 * reviewer feedback and the audit trail. Staff review through the canonical
 * endpoints (per-document approve/reject, Approve / Reject / Request more
 * information on the request). Nothing is pre-filled or simulated: with no
 * submission, the panel says so.
 */

const API_BASE = ((import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

/** Private documents need the bearer token — fetch them as a blob. */
async function fetchVerificationBlob(url: string): Promise<Blob | null> {
  if (!url || url === '#') throw new Error('This document has no file attached.');
  if (!url.includes('/catalog/media/private/')) {
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) throw new Error('Unsupported document link.');
    return null; // public URL (e.g. the profile photo) — open directly
  }
  const path = url.slice(url.indexOf('/catalog/media/private/'));
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getStoredAccessToken() || ''}` } });
  if (!res.ok) throw new Error(res.status === 403 ? 'You are not allowed to open this document.' : 'The document could not be opened.');
  return res.blob();
}

const VIEWER_EVENT = 'choosify:verification-document-view';
type ViewerDetail = { src: string; name: string; mime: string; originalUrl: string; revoke: boolean };

/** Opens the document in the in-app viewer popup (rendered by <DocumentViewerHost />). */
export async function openVerificationDocument(url: string, name = 'Document'): Promise<void> {
  const blob = await fetchVerificationBlob(url);
  const detail: ViewerDetail = blob
    ? { src: URL.createObjectURL(blob), name, mime: blob.type || '', originalUrl: url, revoke: true }
    : { src: url, name, mime: /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || /images\.unsplash\.com/.test(url) ? 'image/*' : '', originalUrl: url, revoke: false };
  window.dispatchEvent(new CustomEvent<ViewerDetail>(VIEWER_EVENT, { detail }));
}

/** In-platform document viewer popup: images and PDFs preview inline; other types offer Download. */
export function DocumentViewerHost() {
  const [doc, setDoc] = useState<ViewerDetail | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => setDoc((e as CustomEvent<ViewerDetail>).detail);
    window.addEventListener(VIEWER_EVENT, onOpen);
    return () => window.removeEventListener(VIEWER_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDoc(null);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (doc.revoke) URL.revokeObjectURL(doc.src);
    };
  }, [doc]);
  if (!doc) return null;
  const isImage = doc.mime.startsWith('image/');
  const isPdf = doc.mime === 'application/pdf';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.name}
      onClick={() => setDoc(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      data-testid="document-viewer"
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(960px, 100%)', height: 'min(86vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #E8EDF2' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
          <button type="button" style={btn} onClick={() => void downloadVerificationDocument(doc.originalUrl, doc.name)}>Download</button>
          <button type="button" style={btn} onClick={() => setDoc(null)} aria-label="Close document" data-testid="document-viewer-close">Close</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isImage ? (
            <img src={doc.src} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : isPdf ? (
            <iframe src={doc.src} title={doc.name} style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />
          ) : (
            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#6B7280', padding: 24 }}>
              This file type can’t be previewed here.
              <div style={{ marginTop: 10 }}>
                <button type="button" style={btn} onClick={() => void downloadVerificationDocument(doc.originalUrl, doc.name)}>Download to open it</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export async function downloadVerificationDocument(url: string, fileName: string): Promise<void> {
  const blob = (await fetchVerificationBlob(url)) || (await (await fetch(url)).blob());
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

const STATUS_TONE: Record<string, React.CSSProperties> = {
  Approved: { background: '#DCFCE7', color: '#166534' },
  Rejected: { background: '#FEE2E2', color: '#991B1B' },
  'Under Review': { background: '#FEF3C7', color: '#92400E' },
  Submitted: { background: '#EEF2FF', color: '#3730A3' },
  Draft: { background: '#F1F5F9', color: '#475569' },
  Withdrawn: { background: '#F1F5F9', color: '#64748B' },
  Expired: { background: '#F1F5F9', color: '#64748B' },
  approved: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: '#FEE2E2', color: '#991B1B' },
  pending: { background: '#FEF3C7', color: '#92400E' },
};
const badge: React.CSSProperties = { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' };
const btn: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#374151' };

export function VerificationCenterPanel({
  entityType,
  entities,
  emptyHint,
  onRequestDocuments,
  kind = 'owner_verification',
}: {
  entityType: 'brand' | 'creator';
  /** Owner verification (default) or ownership claims — never mixed in one list. */
  kind?: VerificationKind;
  entities: Array<{ id: string; name: string }>;
  emptyHint: string;
  /** Opens a message to the owner (no verification exists yet to attach a request to). */
  onRequestDocuments?: () => void;
}) {
  const { profile } = useAuth();
  const canReview = ['super_admin', 'admin', 'moderator'].includes(String(profile?.role || ''));
  const [rows, setRows] = useState<OpsVerification[]>([]);
  const [requests, setRequests] = useState<VerificationDocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ids = entities.map((e) => e.id).join('|');

  const loadedOnce = React.useRef(false);
  const load = useCallback(async () => {
    // Spinner only on the first load — refreshes after an action keep the cards
    // (and their confirmation messages) on screen.
    if (!loadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [all, asks] = await Promise.all([
        operationsApi.listVerifications({ entityType, kind }),
        operationsApi.listVerificationDocumentRequests({ entityType }).catch(() => [] as VerificationDocRequest[]),
      ]);
      const set = new Set(entities.map((e) => e.id));
      setRows(all.filter((v) => set.has(v.entityId)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
      setRequests(asks.filter((r) => set.has(r.entityId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load verification records.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, ids, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const wrap: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, overflow: 'hidden' };

  if (loading) {
    return <div style={{ ...wrap, padding: 24, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>;
  }
  if (error) {
    return <div style={{ ...wrap, padding: 20, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{error}</div>;
  }
  // Placeholder cards ("not submitted yet") only make sense for the owner's own verification.
  const withoutRequest = kind === 'owner_verification' ? entities.filter((e) => !rows.some((v) => v.entityId === e.id)) : [];
  const askedFor = (entityId: string) => requests.filter((q) => q.entityId === entityId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid={rows.length ? 'verification-center' : 'verification-empty'}>
      {rows.map((v) => (
        <VerificationRequestCard
          key={v.id}
          v={v}
          entityType={entityType}
          entityId={v.entityId}
          entityName={entities.find((e) => e.id === v.entityId)?.name || v.entityName}
          canReview={canReview && v.submitted_by !== profile?.id}
          asks={askedFor(v.entityId)}
          kind={kind}
          onChanged={load}
        />
      ))}
      {withoutRequest.map((e) => (
        <VerificationRequestCard
          key={`none-${e.id}`}
          v={null}
          entityType={entityType}
          entityId={e.id}
          entityName={e.name}
          canReview={canReview}
          asks={askedFor(e.id)}
          emptyHint={emptyHint}
          onMessageOwner={onRequestDocuments}
          onChanged={load}
        />
      ))}
      <DocumentViewerHost />
    </div>
  );
}

export function VerificationRequestCard({
  v,
  entityType,
  entityId,
  entityName,
  canReview,
  asks,
  emptyHint,
  onMessageOwner,
  onChanged,
  kind = 'owner_verification',
}: {
  kind?: VerificationKind;
  /** null = the owner has not started a verification request yet. */
  v: OpsVerification | null;
  entityType: 'brand' | 'creator';
  entityId: string;
  entityName: string;
  canReview: boolean;
  asks: VerificationDocRequest[];
  emptyHint?: string;
  onMessageOwner?: () => void;
  onChanged: () => void;
}) {
  const docs = v?.documents || [];
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const open = Boolean(v && (v.status === 'Submitted' || v.status === 'Under Review'));
  const closed = Boolean(v && !['Draft', 'Submitted', 'Under Review'].includes(v.status));
  const isClaim = kind === 'ownership_claim';
  const who = isClaim ? 'claimant' : 'owner';
  const specs = verificationDocumentSpecs(entityType, kind);
  const missing = missingRequiredDocuments(entityType, docs, kind);
  const rejectedDocs = docs.filter((d) => d.status === 'rejected');
  const extraDocs = docs.filter((d) => !specs.some((s) => s.type === d.type));
  /** Latest time Choosify asked for each document type. */
  const lastAsked = new Map<string, string>();
  for (const q of asks) for (const t of q.docTypes) if (!lastAsked.has(t) || lastAsked.get(t)! < q.at) lastAsked.set(t, q.at);
  // Owner verification: the doc-request endpoint notifies the profile OWNER.
  // Claims have no owner yet, so the request goes to the CLAIMANT as a
  // "request more information" (notification + email + shown on their claim page).
  const canAsk = canReview && !closed && (!isClaim || v?.status !== 'Draft');
  const ask = (types: string[], what: string) =>
    isClaim
      ? act(
          () =>
            operationsApi.reviewVerification(v!.id, {
              status: 'request_info',
              feedback: `Please upload: ${types.map((t) => verificationDocumentLabel(entityType, t, kind)).join(', ')}.${feedback.trim() ? ` ${feedback.trim()}` : ''}`,
            }),
          `Asked the claimant to upload ${what}. They were notified by email and on their claim page.`,
        )
      : act(() => operationsApi.requestVerificationDocuments({ entityType, entityId, docTypes: types }), `Asked the owner to upload ${what}. They were notified.`);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // A claim transfers ownership: the server also requires every document individually approved.
  const unreviewedDocs = isClaim ? docs.filter((d) => d.status === 'pending') : [];
  const approveBlocked = missing.length > 0 || rejectedDocs.length > 0 || unreviewedDocs.length > 0;
  const approveBlockedReason = missing.length
    ? `Approve is locked: ${missing.length} required document${missing.length === 1 ? '' : 's'} missing.`
    : rejectedDocs.length
      ? `Approve is locked: ${rejectedDocs.length} document${rejectedDocs.length === 1 ? '' : 's'} rejected.`
      : unreviewedDocs.length
        ? `Approve is locked until each document is verified (${unreviewedDocs.length} still pending) — use “Verify all” or Approve on each document.`
        : '';

  /** Pre-fills the owner feedback with what is missing / must be replaced. */
  const draftInfoRequest = () => {
    const parts: string[] = [];
    if (missing.length) parts.push(`Please upload: ${missing.map((m) => m.label).join(', ')}.`);
    if (rejectedDocs.length) parts.push(`Please replace: ${rejectedDocs.map((d) => `${verificationDocumentLabel(entityType, d.type, kind)}${d.notes ? ` (${d.notes})` : ''}`).join(', ')}.`);
    setFeedback(parts.join(' ') || feedback);
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setFeedback('');
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, overflow: 'hidden' }} data-testid="verification-request">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>{entityName}</div>
          <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>
            {v
              ? `Submitted by ${v.submitted_by_name || v.submitted_by} · created ${new Date(v.created_at).toLocaleDateString()} · updated ${new Date(v.updated_at).toLocaleDateString()}`
              : `No verification submitted yet. ${emptyHint || ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {canAsk && missing.length ? (
            <button type="button" style={{ ...btn, borderColor: 'var(--cms-accent)', color: 'var(--cms-accent)' }} disabled={busy} onClick={() => void ask(missing.map((m) => m.type), `${missing.length} missing document${missing.length === 1 ? '' : 's'}`)} data-testid="verification-ask-all">
              Ask to upload all missing ({missing.length})
            </button>
          ) : null}
          {!v && onMessageOwner ? (
            <button type="button" style={btn} onClick={onMessageOwner}>Message owner</button>
          ) : null}
          <span style={{ ...badge, ...(v ? STATUS_TONE[v.status] || STATUS_TONE.Draft : { background: '#F1F5F9', color: '#64748B' }) }}>{v ? v.status : 'Not submitted'}</span>
        </div>
      </div>

      <div style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 6 }}>
          REQUIRED DOCUMENTS · {specs.filter((sp) => sp.required).length - missing.length}/{specs.filter((sp) => sp.required).length} uploaded
        </div>
        {[...specs.map((sp) => ({ sp, d: docs.find((x) => x.type === sp.type) })), ...extraDocs.map((d) => ({ sp: null, d }))].map(({ sp, d }) => {
          const key = d?.id || sp?.type || '';
          const label = sp ? sp.label : verificationDocumentLabel(entityType, d?.type || '', kind);
          const askedAt = sp ? lastAsked.get(sp.type) : undefined;
          return (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #F5F6F8', flexWrap: 'wrap' }} data-testid={d ? 'verification-document' : 'verification-document-missing'}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                {sp?.type === PROFILE_PHOTO_DOCUMENT && d ? (
                  <img src={d.doc_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid #E8EDF2' }} />
                ) : null}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                    {label}
                    {sp ? <span style={{ fontSize: 9, fontWeight: 800, color: sp.required ? '#64748B' : '#94A3B8', marginLeft: 6 }}>{sp.required ? 'REQUIRED' : 'OPTIONAL'}</span> : null}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {d ? d.name : 'Not uploaded yet'}
                    {d?.notes ? <span style={{ color: '#B91C1C' }}> · {d.notes}</span> : null}
                  </div>
                  {askedAt && (!d || d.status === 'rejected') ? (
                    <div style={{ fontSize: 10, color: '#B45309', fontWeight: 700 }}>Asked the owner {new Date(askedAt).toLocaleString()}</div>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...badge, ...(d ? STATUS_TONE[d.status] || STATUS_TONE.pending : { background: '#F1F5F9', color: '#64748B' }) }}>{d ? (d.status === 'approved' ? 'verified' : d.status) : 'not uploaded'}</span>
                {sp && canAsk && (!d || d.status === 'rejected') ? (
                  <button
                    type="button"
                    style={{ ...btn, borderColor: '#FCD34D', color: '#92400E' }}
                    disabled={busy}
                    onClick={() => void ask([sp.type], label)}
                    data-testid={`verification-ask-${sp.type}`}
                  >
                    {d ? 'Ask to re-upload' : askedAt ? 'Ask again' : 'Ask to Upload'}
                  </button>
                ) : null}
                {d ? (
                  <>
                    <button type="button" style={btn} onClick={() => void openVerificationDocument(d.doc_url, `${label} — ${d.name}`).catch((e) => setMsg({ ok: false, text: e.message }))}>View</button>
                    <button type="button" style={btn} onClick={() => void downloadVerificationDocument(d.doc_url, d.name).catch((e) => setMsg({ ok: false, text: e.message }))}>Download</button>
                  </>
                ) : null}
                {d && canReview && open && d.status !== 'approved' ? (
                  <button type="button" style={{ ...btn, color: '#166534' }} disabled={busy} onClick={() => void act(() => operationsApi.updateVerificationDocument(v!.id, d.id, { status: 'approved' }), `${label} approved.`)} data-testid="verification-doc-approve">
                    Approve
                  </button>
                ) : null}
                {d && canReview && open && d.status !== 'rejected' ? (
                  <button type="button" style={{ ...btn, color: '#991B1B' }} disabled={busy} onClick={() => { setRejecting(d.id); setRejectReason(''); }} data-testid="verification-doc-reject">
                    Reject
                  </button>
                ) : null}
              </div>
              {d && rejecting === d.id ? (
                <div style={{ display: 'flex', gap: 6, width: '100%', flexWrap: 'wrap' }}>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={`Why is the ${label} wrong? (shown to the owner)`}
                    aria-label="Reason for rejecting this document"
                    style={{ flex: '1 1 240px', border: '1px solid #FCA5A5', borderRadius: 7, padding: '6px 8px', fontSize: 11.5 }}
                    data-testid="verification-doc-reject-reason"
                  />
                  <button
                    type="button"
                    style={{ ...btn, background: '#991B1B', color: '#fff', borderColor: '#991B1B' }}
                    disabled={busy || rejectReason.trim().length < 5}
                    onClick={() => void act(() => operationsApi.updateVerificationDocument(v!.id, d.id, { status: 'rejected', notes: rejectReason.trim() }), `${label} rejected.`).then(() => setRejecting(null))}
                    data-testid="verification-doc-reject-confirm"
                  >
                    Reject with reason
                  </button>
                  <button type="button" style={btn} onClick={() => setRejecting(null)}>Cancel</button>
                </div>
              ) : null}
            </div>
          );
        })}
        {v?.status === 'Draft' ? (
          <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, marginTop: 6 }}>The {who} has not submitted this request yet — it can be reviewed once they submit it.</div>
        ) : null}
      </div>

      {v?.reviews.length ? (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F3F5' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 6 }}>DECISIONS</div>
          {v.reviews.map((r) => (
            <div key={r.id} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 0' }}>
              <b style={{ textTransform: 'capitalize' }}>{r.status}</b> by {r.reviewer_name} · {new Date(r.reviewed_at).toLocaleString()} — {r.feedback}
            </div>
          ))}
        </div>
      ) : null}

      {canReview && open && v ? (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F3F5', background: '#FAFBFC' }} data-testid="verification-review">
          {approveBlocked ? (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
              Approval needs every required document uploaded and none rejected.
              {missing.length ? ` Missing: ${missing.map((m) => m.label).join(', ')}.` : ''}
              {rejectedDocs.length ? ` Rejected: ${rejectedDocs.map((d) => verificationDocumentLabel(v.entityType, d.type, kind)).join(', ')}.` : ''}
              {unreviewedDocs.length ? ` Approve each document first (${unreviewedDocs.length} not reviewed).` : ''}
              {' '}Use “Request more information” to ask the {who} again.
            </div>
          ) : null}
          <label htmlFor={`vf-${v.id}`} style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: 4 }}>FEEDBACK TO THE {who.toUpperCase()} (REQUIRED FOR ANY DECISION)</label>
          <textarea
            id={`vf-${v.id}`}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Trade license is expired — please upload the renewed one."
            style={{ width: '100%', border: '1px solid #E8EDF2', borderRadius: 7, padding: 8, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ ...btn, background: '#166534', color: '#fff', borderColor: '#166534', opacity: approveBlocked ? 0.5 : 1 }}
              disabled={busy || !feedback.trim() || approveBlocked}
              title={approveBlocked ? approveBlockedReason : !feedback.trim() ? 'Write the feedback first.' : undefined}
              onClick={() => void act(() => operationsApi.reviewVerification(v.id, { status: 'approved', feedback: feedback.trim() }), isClaim ? 'Claim approved — ownership transferred to the claimant.' : 'Verification approved.')}
              data-testid="verification-approve"
            >
              Approve
            </button>
            {unreviewedDocs.length > 0 && !missing.length && !rejectedDocs.length ? (
              <button
                type="button"
                style={{ ...btn, color: '#166534', borderColor: '#86EFAC' }}
                disabled={busy}
                title="Mark every uploaded document verified after checking them (View / Download above)"
                onClick={() =>
                  void act(async () => {
                    for (const d of unreviewedDocs) await operationsApi.updateVerificationDocument(v.id, d.id, { status: 'approved' });
                  }, `All ${unreviewedDocs.length} documents verified — you can approve now.`)
                }
                data-testid="verification-verify-all"
              >
                Verify all {unreviewedDocs.length} documents
              </button>
            ) : null}
            {missing.length || rejectedDocs.length ? (
              <button type="button" style={btn} disabled={busy} onClick={draftInfoRequest} data-testid="verification-draft-missing">
                Fill in what’s missing / wrong
              </button>
            ) : null}
            {v.status === 'Submitted' ? (
              <button
                type="button"
                style={{ ...btn, color: '#3730A3', borderColor: '#C7D2FE' }}
                disabled={busy}
                title="Take this request into review (no message is sent)"
                onClick={() => void act(() => operationsApi.reviewVerification(v.id, { status: 'under_review', feedback: '' }), 'Marked pending — under review.')}
                data-testid="verification-mark-pending"
              >
                Mark pending (under review)
              </button>
            ) : null}
            <button type="button" style={{ ...btn, color: '#92400E', borderColor: '#FCD34D' }} disabled={busy || !feedback.trim()} onClick={() => void act(() => operationsApi.reviewVerification(v.id, { status: 'request_info', feedback: feedback.trim() }), `More information requested from the ${who}.`)} data-testid="verification-request-info">
              Request more information
            </button>
            <button type="button" style={{ ...btn, color: '#991B1B', borderColor: '#FCA5A5' }} disabled={busy || !feedback.trim()} onClick={() => void act(() => operationsApi.reviewVerification(v.id, { status: 'rejected', feedback: feedback.trim() }), isClaim ? 'Claim rejected — the profile is claimable again.' : 'Verification rejected.')}>
              Reject
            </button>
          </div>
          {approveBlocked ? (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280', marginTop: 6 }} data-testid="verification-approve-locked">
              {approveBlockedReason}
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <div role={msg.ok ? 'status' : 'alert'} style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 700, color: msg.ok ? '#166534' : '#DC2626' }}>{msg.text}</div> : null}

      <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F3F5' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 6 }}>AUDIT TRAIL</div>
        {!v || v.audit_trail.length === 0 ? (
          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic' }}>No history yet.</div>
        ) : (
          [...v.audit_trail].reverse().slice(0, 12).map((a, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 0', color: '#374151' }}>
              <span style={{ color: '#9CA3AF' }}>{new Date(a.timestamp).toLocaleString()}</span> · <b>{a.action}</b> · {a.actor}
              {a.details ? <span style={{ color: '#6B7280' }}> — {a.details}</span> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
