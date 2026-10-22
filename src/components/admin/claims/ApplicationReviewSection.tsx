import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { operationsApi, type OpsPartnerApplication } from '../../../services/operationsApi';

/**
 * New Seller / Creator application review on the applicant's full 360° profile
 * (/admin/seller-profile or /admin/creator-review with `applicationId`) — the
 * same pattern as the ownership-claim review. Staff read everything the
 * applicant submitted next to their real account, then Approve / Keep pending
 * (internal note) / Request changes / Reject through the canonical endpoints.
 * Approval is identity approval only; Marketplace Access stays a separate step.
 */

const STATUS_TONE: Record<string, React.CSSProperties> = {
  pending: { background: '#FEF3C7', color: '#92400E' },
  approved: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: '#FEE2E2', color: '#991B1B' },
};
const btn: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#374151' };

export function ApplicationReviewSection({ applicationId, onDecided }: { applicationId: string; onDecided: () => void }) {
  const navigate = useNavigate();
  const [app, setApp] = useState<OpsPartnerApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      // No single-application endpoint: the admin list (all statuses) is the canonical source.
      const row = (await operationsApi.listPartnerApplications()).find((a) => a.id === applicationId) || null;
      if (!row) throw new Error('Application not found.');
      setApp(row);
      setAdminNotes(row.adminNotes || '');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the application.');
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string, reloadProfile = false) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setNote('');
      await load();
      if (reloadProfile) onDecided();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(false);
    }
  };

  const box: React.CSSProperties = { background: '#fff', border: '2px solid var(--cms-accent)', borderRadius: 16, padding: 16, marginBottom: 16 };
  if (error) return <div style={{ ...box, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{error}</div>;
  if (!app) {
    return (
      <div style={{ ...box, textAlign: 'center' }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }
  const isCreator = app.applicantType === 'creator';
  const pending = app.status === 'pending';
  const queueHref = `/admin/${isCreator ? 'creator' : 'seller'}-management?filter=requests`;
  const fields: Array<[string, string | undefined]> = [
    [isCreator ? 'Channel / creator name' : 'Business / brand name', app.businessOrChannelName],
    ['Applicant', app.displayName],
    ['Email', app.email],
    ['Phone', app.phone],
    ['Category', app.category],
    ['City', app.city],
    ['Website', app.website],
    ...(isCreator
      ? ([
          ['Niche', app.niche],
          ['Content focus', app.contentFocus],
          ['Primary social', app.socialPrimary],
          ['Audience size', app.audienceSize],
        ] as Array<[string, string | undefined]>)
      : []),
    ['Applicant notes', app.notes],
    ['Applied', new Date(app.createdAt).toLocaleString()],
    ['Existing account upgraded', app.existingUserId ? 'Yes — Consumer account kept (same CF-ID)' : 'No — new account'],
  ];

  return (
    <div style={box} data-testid="application-review-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em' }}>
            NEW {isCreator ? 'CREATOR' : 'SELLER'} APPLICATION
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }} data-testid="application-review-name">{app.businessOrChannelName}</div>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
            The account shown below is the applicant. Approval verifies the identity only — Marketplace Access is granted separately.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', ...(STATUS_TONE[app.status] || STATUS_TONE.pending) }} data-testid="application-review-status">
            {app.status === 'pending' && app.resubmissionRequested ? 'pending · changes requested' : app.status}
          </span>
          <button type="button" style={btn} onClick={() => navigate(queueHref)}>← Requests</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 18px', border: '1px solid #EEF1F4', borderRadius: 8, padding: 12 }}>
        {fields
          .filter(([, v]) => v && String(v).trim())
          .map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{v}</div>
            </div>
          ))}
      </div>

      {app.reviewNote && !pending ? (
        <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 10, color: '#374151' }}>
          <b>Decision note:</b> {app.reviewNote} {app.reviewedAt ? `· ${new Date(app.reviewedAt).toLocaleString()}` : ''}
        </div>
      ) : null}

      {pending ? (
        <div style={{ marginTop: 12, background: '#FAFBFC', border: '1px solid #EEF1F4', borderRadius: 8, padding: 12 }} data-testid="application-review-actions">
          <label htmlFor="app-note" style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            MESSAGE TO THE APPLICANT (REQUIRED FOR “REQUEST CHANGES” AND “REJECT”)
          </label>
          <textarea
            id="app-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Please use your registered business name exactly as on the trade license."
            style={{ width: '100%', border: '1px solid #E8EDF2', borderRadius: 7, padding: 8, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ ...btn, background: '#166534', borderColor: '#166534', color: '#fff' }}
              disabled={busy}
              onClick={() => void act(() => operationsApi.approvePartnerApplication(app.id, note.trim() || 'Approved after profile review'), 'Application approved. Grant Marketplace Access separately when ready.', true)}
              data-testid="application-approve"
            >
              Approve
            </button>
            <button
              type="button"
              style={{ ...btn, color: '#92400E', borderColor: '#FCD34D' }}
              disabled={busy || note.trim().length < 5}
              onClick={() => void act(() => operationsApi.requestPartnerResubmission(app.id, note.trim()), 'Changes requested — the application stays pending.')}
              data-testid="application-request-changes"
            >
              Request changes
            </button>
            <button
              type="button"
              style={{ ...btn, color: '#991B1B', borderColor: '#FCA5A5' }}
              disabled={busy || note.trim().length < 5}
              onClick={() => {
                if (window.confirm(`Reject the application from ${app.businessOrChannelName}?`)) {
                  void act(() => operationsApi.rejectPartnerApplication(app.id, note.trim()), 'Application rejected.', true);
                }
              }}
              data-testid="application-reject"
            >
              Reject
            </button>
          </div>
          <label htmlFor="app-admin-notes" style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', display: 'block', margin: '12px 0 4px' }}>
            KEEP PENDING — INTERNAL NOTE (NOT SHOWN TO THE APPLICANT)
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="app-admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Waiting for a call-back to confirm the phone number."
              style={{ flex: '1 1 260px', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 8px', fontSize: 12 }}
            />
            <button
              type="button"
              style={btn}
              disabled={busy}
              onClick={() => void act(() => operationsApi.savePartnerApplicationNotes(app.id, adminNotes.trim()), 'Kept pending — note saved.')}
              data-testid="application-keep-pending"
            >
              Keep pending
            </button>
          </div>
        </div>
      ) : null}
      {msg ? (
        <div role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: msg.ok ? '#166534' : '#DC2626' }}>
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
