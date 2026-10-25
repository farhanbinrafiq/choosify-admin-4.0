import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, FileText, ShieldCheck, AlertTriangle, Camera } from 'lucide-react';
import { operationsApi, type OpsVerification, type VerificationDocRequest } from '../../../services/operationsApi';
import { uploadVerificationDocument } from '../../../services/mediaUpload';
import { DocumentThumbnail, DocumentViewerHost, downloadVerificationDocument, openVerificationDocument } from './VerificationCenterPanel';
import {
  PROFILE_PHOTO_DOCUMENT,
  missingRequiredDocuments,
  verificationDocumentSpecs,
  type VerificationDocumentSpec,
} from '../../../../shared/verification/verificationDocuments';
import { getPublishedStorefrontUrl } from '../../../lib/storefrontUrls';

/**
 * Owner-side Verification Center (Seller brands / Creator profile). Everything
 * here is the REAL verification record (/operations/verifications, scoped to
 * the signed-in owner by the server). The owner uploads every required
 * document (stored privately), attaches their profile picture for photo
 * verification, submits, sees what Choosify approved / rejected / asked for,
 * and answers with Upload New / Delete / new uploads. Choosify staff review
 * the same record from the Super Admin profile's Verification Center.
 */

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif';
const OWNER_ACTIONS = new Set(['Document Added', 'Document Replaced', 'Document Removed', 'Form Submitted', 'Request Submitted', 'Draft Created']);

const TONE: Record<string, React.CSSProperties> = {
  Approved: { background: '#DCFCE7', color: '#166534' },
  Rejected: { background: '#FEE2E2', color: '#991B1B' },
  'Under Review': { background: '#FEF3C7', color: '#92400E' },
  Submitted: { background: '#EEF2FF', color: '#3730A3' },
  Draft: { background: '#F1F5F9', color: '#475569' },
  approved: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: '#FEE2E2', color: '#991B1B' },
  pending: { background: '#FEF3C7', color: '#92400E' },
  missing: { background: '#F1F5F9', color: '#64748B' },
};
const DOC_LABEL: Record<string, string> = { approved: 'Verified', rejected: 'Rejected', pending: 'Waiting for review', missing: 'Not uploaded' };
const badge: React.CSSProperties = { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' };
const btn: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 5 };
const danger: React.CSSProperties = { ...btn, color: '#B91C1C', borderColor: '#FECACA' };
const primary: React.CSSProperties = { ...btn, background: 'var(--cms-accent, #E8462A)', borderColor: 'var(--cms-accent, #E8462A)', color: '#fff' };
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 16 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, flexWrap: 'wrap' };
const thumb: React.CSSProperties = { width: 44, height: 44, borderRadius: 8, border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', flexShrink: 0, overflow: 'hidden', background: '#fff' };

const STATUS_COPY: Record<OpsVerification['status'], string> = {
  Draft: 'Draft — upload every required document, then submit for review. Choosify does not review a draft until you submit it.',
  Submitted: 'Submitted — Choosify will review your documents. You can still replace or add documents while you wait.',
  'Under Review': 'Under review — Choosify is checking your documents.',
  Approved: 'Verified — Choosify approved your documents.',
  Rejected: 'Not approved — see the reason below. Upload corrected documents to start a new request.',
  Withdrawn: 'Withdrawn.',
  Expired: 'Expired after a period of inactivity. Upload documents to start a new request.',
};

/** The latest "more information" request the owner has not answered yet. */
function openInfoRequest(v: OpsVerification): { details: string; at: string } | null {
  if (v.status !== 'Under Review') return null;
  const trail = [...(v.audit_trail || [])].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  let pending: { details: string; at: string } | null = null;
  for (const e of trail) {
    if (e.action === 'Additional Information Requested') pending = { details: e.details, at: e.timestamp };
    else if (OWNER_ACTIONS.has(e.action)) pending = null;
  }
  return pending;
}

function EntityVerification({
  entityType,
  entity,
  avatarUrl,
}: {
  entityType: 'brand' | 'creator';
  entity: { id: string; name: string; logo?: string };
  avatarUrl?: string | null;
}) {
  const [rows, setRows] = useState<OpsVerification[]>([]);
  const [asks, setAsks] = useState<VerificationDocRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const target = useRef<{ spec: VerificationDocumentSpec; replaceDocId?: string } | null>(null);
  const specs = verificationDocumentSpecs(entityType);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, requested] = await Promise.all([
        // The owner's OWN verification only — ownership claims are listed separately.
        operationsApi.listVerifications({ entityType, entityId: entity.id, kind: 'owner_verification' }),
        operationsApi.listVerificationDocumentRequests({ entityType, entityId: entity.id }).catch(() => [] as VerificationDocRequest[]),
      ]);
      setRows(all.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
      setAsks(requested);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your verification.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entity.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = rows[0] || null;
  const isOpen = Boolean(current && ['Draft', 'Submitted', 'Under Review'].includes(current.status));
  // After a rejection the slots start empty again: a new request is opened on the first upload.
  const docs = isOpen || current?.status === 'Approved' ? current?.documents || [] : [];
  const info = current ? openInfoRequest(current) : null;
  const missing = missingRequiredDocuments(entityType, docs);
  const rejectionFeedback = (current?.reviews || []).filter((r) => r.status === 'rejected' && r.feedback).map((r) => r.feedback);
  const extraDocs = docs.filter((d) => !specs.some((s) => s.type === d.type));
  // Documents Choosify asked for that are still missing (or were rejected) — answered by uploading them.
  const requestedAt = new Map<string, string>();
  for (const q of asks) for (const t of q.docTypes) if (!requestedAt.has(t) || requestedAt.get(t)! < q.at) requestedAt.set(t, q.at);
  const stillRequested = specs.filter((sp) => {
    if (!requestedAt.has(sp.type)) return false;
    const d = docs.find((x) => x.type === sp.type);
    return !d || d.status === 'rejected';
  });
  const latestNote = asks.find((q) => q.note)?.note;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  /** The open request, or a new Draft when there is none (first upload / after a rejection). */
  const ensureRequest = async (): Promise<string> => {
    if (isOpen && current) return current.id;
    const created = (await operationsApi.createVerification({
      entityType,
      entityId: entity.id,
      entityName: entity.name,
      logo_url: entity.logo || '',
      status: 'Draft',
      documents: [],
    })) as OpsVerification;
    return created.id;
  };

  const onFile = (file: File | undefined) => {
    const t = target.current;
    if (!file || !t) return;
    void run(`file:${t.spec.type}`, async () => {
      const up = await uploadVerificationDocument(file);
      if (t.replaceDocId && current && isOpen) {
        await operationsApi.replaceVerificationDocument(current.id, t.replaceDocId, { doc_url: up.url, name: up.fileName });
      } else {
        const id = await ensureRequest();
        await operationsApi.addVerificationDocument(id, { type: t.spec.type, name: up.fileName, doc_url: up.url });
      }
    });
  };

  const pick = (spec: VerificationDocumentSpec, replaceDocId?: string) => {
    target.current = { spec, replaceDocId };
    uploadRef.current?.click();
  };

  const submitPhoto = () =>
    void run(`file:${PROFILE_PHOTO_DOCUMENT}`, async () => {
      const id = await ensureRequest();
      await operationsApi.attachVerificationProfilePhoto(id);
    });

  const onError = (e: unknown) => setError(e instanceof Error ? e.message : 'Could not open the document.');

  return (
    <div style={panel} data-testid={`owner-verification-${entity.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, fontWeight: 800 }}>{entity.name}</div>
        {current ? <span style={{ ...badge, ...(TONE[current.status] || {}) }} data-testid="owner-verification-status">{current.status}</span> : <span style={{ ...badge, ...TONE.missing }}>Not submitted</span>}
      </div>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: '#4B5563', fontWeight: 600, margin: '8px 0 12px', lineHeight: 1.55 }}>
            {current ? STATUS_COPY[current.status] : 'You have not submitted verification documents yet. Upload each required document below — files are stored privately and only Choosify staff can open them.'}
          </div>

          {info ? (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }} data-testid="owner-info-request">
              <AlertTriangle size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', lineHeight: 1.5 }}>
                Choosify asked for more information ({new Date(info.at).toLocaleString()}):
                <div style={{ fontWeight: 600, color: '#78350F', marginTop: 3 }}>“{info.details}”</div>
                <div style={{ fontWeight: 600, marginTop: 3 }}>Upload or replace the documents mentioned — Choosify is notified automatically.</div>
              </div>
            </div>
          ) : null}

          {stillRequested.length && current?.status !== 'Approved' ? (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }} data-testid="owner-documents-requested">
              <AlertTriangle size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', lineHeight: 1.5 }}>
                Choosify asked you to upload: {stillRequested.map((s) => s.label).join(', ')}.
                {latestNote ? <div style={{ fontWeight: 600, color: '#78350F', marginTop: 3 }}>“{latestNote}”</div> : null}
              </div>
            </div>
          ) : null}

          {current?.status === 'Rejected' && rejectionFeedback.length ? (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11.5, fontWeight: 700, color: '#991B1B' }} data-testid="owner-rejection-reason">
              Reason: {rejectionFeedback.join(' · ')}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {specs.map((spec) => {
              const doc = docs.find((d) => d.type === spec.type);
              const state = doc ? doc.status : 'missing';
              const isPhoto = spec.type === PROFILE_PHOTO_DOCUMENT;
              const photoChanged = isPhoto && doc && avatarUrl && doc.doc_url !== avatarUrl;
              const locked = current?.status === 'Approved' && !isOpen;
              const fileBusy = busy === `file:${spec.type}`;
              return (
                <div key={spec.type} style={row} data-testid={`owner-doc-${spec.type}`}>
                  {!isPhoto && doc ? (
                    <DocumentThumbnail url={doc.doc_url} name={doc.name} />
                  ) : (
                    <div style={thumb}>
                      {isPhoto && (doc?.doc_url || avatarUrl) ? (
                        <img src={doc?.doc_url || avatarUrl || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : isPhoto ? (
                        <Camera size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                  )}
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{spec.label}</div>
                    <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, overflowWrap: 'anywhere' }}>{doc ? doc.name : spec.hint}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ ...badge, ...(TONE[state] || {}) }}>{DOC_LABEL[state] || state}</span>
                      <span style={{ ...badge, background: 'transparent', color: spec.required ? '#64748B' : '#94A3B8' }}>{spec.required ? 'Required' : 'Optional'}</span>
                      {stillRequested.some((s) => s.type === spec.type) ? <span style={{ ...badge, background: '#FEF3C7', color: '#92400E' }}>Requested by Choosify</span> : null}
                    </div>
                    {doc?.status === 'rejected' && doc.notes ? <div style={{ fontSize: 10.5, color: '#B91C1C', fontWeight: 700, marginTop: 3 }}>Choosify: {doc.notes}</div> : null}
                    {photoChanged ? <div style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700, marginTop: 3 }}>Your profile picture changed since you submitted it — submit the current photo for review.</div> : null}
                    {isPhoto && !avatarUrl ? <div style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700, marginTop: 3 }}>Add a profile picture in your profile card first.</div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {doc ? (
                      <>
                        <button type="button" style={btn} onClick={() => openVerificationDocument(doc.doc_url, `${spec.label} — ${doc.name}`).catch(onError)}>View</button>
                        {!isPhoto ? <button type="button" style={btn} onClick={() => downloadVerificationDocument(doc.doc_url, doc.name).catch(onError)}>Download</button> : null}
                      </>
                    ) : null}
                    {!locked && isPhoto ? (
                      <button type="button" style={doc ? btn : primary} disabled={busy !== null || !avatarUrl} onClick={submitPhoto} data-testid="owner-submit-photo">
                        {fileBusy ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />} {doc ? 'Submit current photo' : 'Use my profile picture'}
                      </button>
                    ) : null}
                    {!locked && !isPhoto ? (
                      <button type="button" style={doc ? btn : primary} disabled={busy !== null} onClick={() => pick(spec, doc && isOpen ? doc.id : undefined)} data-testid={`owner-upload-${spec.type}`}>
                        {fileBusy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {doc ? 'Upload New' : 'Upload'}
                      </button>
                    ) : null}
                    {doc && isOpen && current && doc.status !== 'approved' ? (
                      <button
                        type="button"
                        style={danger}
                        disabled={busy !== null}
                        onClick={() => {
                          if (window.confirm(`Delete “${doc.name}”?`)) void run(`del:${doc.id}`, () => operationsApi.removeVerificationDocument(current.id, doc.id));
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {extraDocs.map((doc) => (
              <div key={doc.id} style={row}>
                <DocumentThumbnail url={doc.doc_url} name={doc.name} />
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{doc.type}</div>
                  <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>{doc.name}</div>
                  <span style={{ ...badge, ...(TONE[doc.status] || {}), marginTop: 4 }}>{DOC_LABEL[doc.status] || doc.status}</span>
                </div>
                <button type="button" style={btn} onClick={() => openVerificationDocument(doc.doc_url, `${doc.type} — ${doc.name}`).catch(onError)}>View</button>
              </div>
            ))}
          </div>

          {isOpen && current?.status === 'Draft' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" style={primary} disabled={busy !== null || missing.length > 0} onClick={() => void run('submit', () => operationsApi.submitVerification(current.id))} data-testid="owner-submit">
                {busy === 'submit' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Submit for review
              </button>
              {missing.length ? <span style={{ fontSize: 10.5, color: '#B45309', fontWeight: 700 }}>Still needed: {missing.map((m) => m.label).join(', ')}</span> : null}
            </div>
          ) : null}

          {error ? <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 700, marginTop: 10 }} role="alert">{error}</div> : null}

          {current?.audit_trail?.length ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 10.5, fontWeight: 800, color: '#6B7280', cursor: 'pointer' }}>Verification history</summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...current.audit_trail].reverse().map((e, i) => (
                  <div key={`${e.timestamp}-${i}`} style={{ fontSize: 10.5, fontWeight: 600, color: '#4B5563' }}>
                    <span style={{ fontWeight: 800, color: '#111827' }}>{e.action}</span> · {new Date(e.timestamp).toLocaleString()}
                    <div style={{ color: '#6B7280' }}>{e.details}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
      <input ref={uploadRef} type="file" accept={ACCEPT} hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} data-testid="owner-upload-input" />
    </div>
  );
}

export function OwnerVerificationPanel({
  entityType,
  entities,
  emptyText,
  avatarUrl,
}: {
  entityType: 'brand' | 'creator';
  entities: Array<{ id: string; name: string; logo?: string }>;
  emptyText: string;
  /** The account's current profile picture (photo verification). */
  avatarUrl?: string | null;
}) {
  if (!entities.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MyOwnershipClaims entityType={entityType} />
        <div style={{ ...panel, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9CA3AF', fontStyle: 'italic' }}>{emptyText}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="owner-verification-center">
      <MyOwnershipClaims entityType={entityType} />
      {entities.map((e) => (
        <EntityVerification key={e.id} entityType={entityType} entity={e} avatarUrl={avatarUrl} />
      ))}
      <DocumentViewerHost />
    </div>
  );
}

/**
 * The signed-in user's ownership CLAIMS on community profiles (kept apart from
 * their own verification above). Documents are uploaded on the storefront
 * claim page; here the claimant sees status and can withdraw an open claim.
 */
function MyOwnershipClaims({ entityType }: { entityType: 'brand' | 'creator' }) {
  const [claims, setClaims] = useState<OpsVerification[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const rows = await operationsApi.listVerifications({ entityType, kind: 'ownership_claim' });
      setClaims(rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
    } catch {
      setClaims([]);
    }
  }, [entityType]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!claims.length) return null;
  const storefront = getPublishedStorefrontUrl();
  const withdraw = async (c: OpsVerification) => {
    if (!window.confirm(`Withdraw your ownership claim for ${c.entityName}?`)) return;
    setBusy(c.id);
    setMsg(null);
    try {
      await operationsApi.withdrawOwnershipClaim(c.id);
      setMsg({ ok: true, text: 'Claim withdrawn.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not withdraw the claim.' });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div style={panel} data-testid="my-ownership-claims">
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Your ownership claims</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {claims.map((c) => {
          const open = ['Draft', 'Submitted', 'Under Review'].includes(c.status);
          return (
            <div key={c.id} style={row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{c.entityName}</div>
                <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>
                  {c.documents.length} document{c.documents.length === 1 ? '' : 's'} · updated {new Date(c.updated_at).toLocaleDateString()}
                  {c.closedReason ? ` · ${c.closedReason}` : ''}
                </div>
              </div>
              <span style={{ ...badge, ...(TONE[c.status] || TONE.Draft) }}>{c.status}</span>
              {open && c.claimIntentId ? (
                <a href={`${storefront}/claim/${encodeURIComponent(c.claimIntentId)}`} target="_blank" rel="noreferrer" style={btn}>
                  {c.status === 'Draft' ? 'Upload documents' : 'View claim'}
                </a>
              ) : null}
              {open ? (
                <button type="button" style={danger} disabled={busy === c.id} onClick={() => void withdraw(c)}>
                  Withdraw
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {msg ? <div role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: msg.ok ? '#166534' : '#DC2626' }}>{msg.text}</div> : null}
    </div>
  );
}
