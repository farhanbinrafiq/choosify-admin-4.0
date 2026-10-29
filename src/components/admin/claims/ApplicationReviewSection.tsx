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
const SOCIAL_LABELS: Array<[keyof NonNullable<OpsPartnerApplication['socialLinks']>, string]> = [
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
];

/** Creator links to check the applicant is real — Facebook is required for applications since 2026-10-29. */
function ApplicantSocialLinks({ app }: { app: OpsPartnerApplication }) {
  const links: Array<[string, string]> = SOCIAL_LABELS.map(([k, label]) => [label, app.socialLinks?.[k] || ''] as [string, string]).filter(([, url]) => url);
  // Older applications only had one "primary social" field.
  if (!links.length && app.socialPrimary) links.push(['Social link', app.socialPrimary]);
  const hasFacebook = Boolean(app.socialLinks?.facebook || /facebook\.com|fb\.com|fb\.watch/i.test(app.socialPrimary || ''));
  return (
    <div style={{ marginTop: 10, border: '1px solid #EEF1F4', borderRadius: 8, padding: 12 }} data-testid="application-social-links">
      <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
        Social links — open each one to check this is a real creator
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {links.map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={url}
            style={{ ...btn, textDecoration: 'none', color: '#111827', display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            {label} ↗
          </a>
        ))}
        {!links.length ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9CA3AF' }}>No social links given.</span> : null}
      </div>
      {!hasFacebook ? (
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#B45309' }} data-testid="application-no-facebook">
          No Facebook link — this application was sent before Facebook became required. Use “Request changes” to ask for it before approving.
        </div>
      ) : null}
    </div>
  );
}

const btn: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#374151' };

const HISTORY_LABEL: Record<string, string> = {
  submitted: 'Application submitted',
  admin_note: 'Internal note added (kept pending)',
  resubmission_requested: 'Changes requested from the applicant',
  applicant_resubmitted: 'Applicant sent the changes',
  identity_verified: 'Approved (identity verified)',
  rejected: 'Rejected',
  approval_withdrawn: 'Unapproved — back to review',
  legacy_linked: 'Linked to an existing account',
  legacy_provisioned: 'Account set up for review',
};
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

/**
 * Shown on the applicant's profile whether staff arrived from the Requests tab
 * (`applicationId` in the URL) or from any creator / seller list: without an id
 * the section finds the account's application itself (pending first, else the
 * latest), and renders nothing when the account never applied.
 */
export function ApplicationReviewSection({
  applicationId,
  match,
  accountCreatedAt,
  placement = 'top',
  onDecided,
}: {
  /**
   * 'top' = the review box above the profile, shown only while the application
   * waits for a decision; 'panel' = the decided application (approved /
   * rejected) inside Account Information, with Unapprove while Marketplace
   * Access is off.
   */
  placement?: 'top' | 'panel';
  applicationId?: string;
  match?: { type: 'seller' | 'creator'; userId?: string; catalogEntityId?: string };
  /** users.createdAt — when the login account was created (sign-up). */
  accountCreatedAt?: string;
  onDecided: () => void;
}) {
  const navigate = useNavigate();
  const [app, setApp] = useState<OpsPartnerApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [none, setNone] = useState(false);
  const [unapproveReason, setUnapproveReason] = useState('');

  const load = useCallback(async () => {
    try {
      // No single-application endpoint: the admin list (all statuses) is the canonical source.
      const all = await operationsApi.listPartnerApplications();
      let row = applicationId ? all.find((a) => a.id === applicationId) || null : null;
      if (!row && !applicationId && match) {
        const mine = all
          .filter((a) => a.applicantType === match.type)
          .filter(
            (a) =>
              (match.catalogEntityId && a.catalogEntityId === match.catalogEntityId) ||
              (match.userId && (a.provisionedUserId === match.userId || a.existingUserId === match.userId)),
          )
          .sort((x, y) => (y.status === 'pending' ? 1 : 0) - (x.status === 'pending' ? 1 : 0) || y.createdAt.localeCompare(x.createdAt));
        row = mine[0] || null;
        if (!row) {
          setNone(true);
          return;
        }
      }
      if (!row) throw new Error('Application not found.');
      setNone(false);
      setApp(row);
      setAdminNotes(row.adminNotes || '');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the application.');
    }
  }, [applicationId, match?.type, match?.userId, match?.catalogEntityId]);

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

  const box: React.CSSProperties =
    placement === 'top'
      ? { background: '#fff', border: '2px solid var(--cms-accent)', borderRadius: 16, padding: 16, marginBottom: 16 }
      : { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: 16 };
  if (none) return null;
  if (error) return placement === 'top' && applicationId ? <div style={{ ...box, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>{error}</div> : null;
  if (!app) {
    return placement === 'top' && applicationId ? (
      <div style={{ ...box, textAlign: 'center' }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    ) : null;
  }
  const isCreator = app.applicantType === 'creator';
  const pending = app.status === 'pending';
  // Review box on top only while undecided; the decided application lives in Account Information.
  if (placement === 'top' && !pending) return null;
  if (placement === 'panel' && pending) return null;
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
          ['Audience size', app.audienceSize],
        ] as Array<[string, string | undefined]>)
      : []),
    ['Applicant notes', app.notes],
    ['Account created (sign-up)', accountCreatedAt ? when(accountCreatedAt) : undefined],
    // The recorded 'submitted' event (an ISO time) — the same moment the timeline shows.
    ['Application submitted', when(app.reviewHistory?.find((h) => h.action === 'submitted')?.at || app.createdAt)],
    ['Last updated', app.updatedAt && app.updatedAt !== app.createdAt ? when(app.updatedAt) : undefined],
    ['Reviewed', app.reviewedAt ? when(app.reviewedAt) : pending ? 'Not reviewed yet' : undefined],
    ['Existing account upgraded', app.existingUserId ? 'Yes — Consumer account kept (same CF-ID)' : 'No — new account'],
  ];

  return (
    <div style={box} data-testid={placement === 'top' ? 'application-review-section' : 'application-decided-panel'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em' }}>
            {placement === 'top' ? `NEW ${isCreator ? 'CREATOR' : 'SELLER'} APPLICATION` : 'PARTNER APPLICATION'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }} data-testid="application-review-name">{app.businessOrChannelName}</div>
          {placement === 'top' ? (
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
              The account shown below is the applicant. Approval verifies the identity only — Marketplace Access is granted separately.
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', ...(STATUS_TONE[app.status] || STATUS_TONE.pending) }} data-testid="application-review-status">
            {app.status === 'pending' && app.resubmissionRequested ? 'pending · changes requested' : app.status}
          </span>
          {placement === 'top' ? (
            <button type="button" style={btn} onClick={() => navigate(queueHref)}>← Requests</button>
          ) : null}
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

      {isCreator ? <ApplicantSocialLinks app={app} /> : null}

      <div style={{ marginTop: 10, border: '1px solid #EEF1F4', borderRadius: 8, padding: 12 }} data-testid="application-timeline">
        <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Timeline</div>
        {[
          ...(accountCreatedAt ? [{ at: accountCreatedAt, label: 'Account created (sign-up)', note: '' }] : []),
          ...((app.reviewHistory || []).length
            ? (app.reviewHistory || []).map((h) => ({
                at: h.at,
                label: HISTORY_LABEL[h.action] || h.action.replace(/_/g, ' '),
                note: h.note || '',
              }))
            : [{ at: app.createdAt, label: 'Application submitted', note: '' }]),
        ]
          .sort((x, y) => x.at.localeCompare(y.at))
          .map((e, i) => (
            <div key={`${e.at}-${i}`} style={{ display: 'flex', gap: 12, padding: '5px 0', borderTop: i ? '1px solid #F4F6F8' : undefined, fontSize: 11.5 }}>
              <span style={{ width: 150, flexShrink: 0, color: '#6B7280', fontWeight: 600 }}>{when(e.at)}</span>
              <span style={{ fontWeight: 700 }}>
                {e.label}
                {e.note ? <span style={{ fontWeight: 500, color: '#6B7280' }}> — {e.note}</span> : null}
              </span>
            </div>
          ))}
        {pending ? <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#B45309' }}>Waiting for review — not approved or rejected yet.</div> : null}
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
      {placement === 'panel' && app.status === 'approved' ? (
        <div style={{ marginTop: 12, background: '#FAFBFC', border: '1px solid #EEF1F4', borderRadius: 8, padding: 12 }} data-testid="application-unapprove">
          <label htmlFor="app-unapprove" style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            UNAPPROVE — SEND BACK TO REVIEW (REASON REQUIRED, SHOWN TO THE APPLICANT)
          </label>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 6 }}>
            Only possible while Marketplace Access has not been granted. The account goes back to “under review” and the
            review box returns to the top of this profile.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="app-unapprove"
              value={unapproveReason}
              onChange={(e) => setUnapproveReason(e.target.value)}
              maxLength={1000}
              placeholder="e.g. Approved by mistake — we still need to verify the Facebook page."
              style={{ flex: '1 1 260px', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 8px', fontSize: 12 }}
              data-testid="application-unapprove-reason"
            />
            <button
              type="button"
              style={{ ...btn, color: '#991B1B', borderColor: '#FCA5A5' }}
              disabled={busy || unapproveReason.trim().length < 10}
              onClick={() => {
                if (window.confirm(`Unapprove ${app.businessOrChannelName} and send the application back to review?`)) {
                  void act(() => operationsApi.unapprovePartnerApplication(app.id, unapproveReason.trim()), 'Unapproved — the application is back under review.', true);
                }
              }}
              data-testid="application-unapprove-button"
            >
              Unapprove
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
