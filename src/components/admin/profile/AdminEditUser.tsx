import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lock, PencilLine, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { operationsApi, type AdminEditReason, type AdminEditSession } from '../../../services/operationsApi';

/**
 * Universal Super Admin "Edit User" mode for the Consumer / Seller / Creator
 * profile views.
 *
 * Profiles are VIEW ONLY. Entering edit mode opens a confirmation that
 * requires a reason; the server records an audit session (who, which user,
 * when, why) and only then are edit entry points shown. Exiting closes the
 * session server-side. Edit mode grants NO permissions — every edit still goes
 * through the canonical editor and its own endpoint authorization.
 */

export const ADMIN_EDIT_REASONS: Array<{ key: AdminEditReason; label: string }> = [
  { key: 'user_support_request', label: 'User support request' },
  { key: 'data_correction', label: 'Data correction' },
  { key: 'compliance_review', label: 'Compliance / policy review' },
  { key: 'fraud_investigation', label: 'Fraud or abuse investigation' },
  { key: 'other', label: 'Other' },
];
const reasonLabel = (k: string) => ADMIN_EDIT_REASONS.find((r) => r.key === k)?.label || k;

export interface AdminEditUserState {
  /** True only while a server-recorded edit session is open for this admin + user. */
  editing: boolean;
  session: AdminEditSession | null;
  history: AdminEditSession[];
  canUseEditMode: boolean;
  busy: boolean;
  openDialog: () => void;
  exit: () => Promise<void>;
  /** Render once in the page (dialog). */
  dialog: React.ReactNode;
}

export function useAdminEditUser(opts: {
  targetUserId: string;
  targetRole: AdminEditSession['targetRole'];
  targetLabel?: string;
}): AdminEditUserState {
  const { profile } = useAuth();
  const { targetUserId, targetRole, targetLabel } = opts;
  const canUseEditMode = profile?.role === 'super_admin' && Boolean(targetUserId) && profile?.id !== targetUserId;
  const [history, setHistory] = useState<AdminEditSession[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    try {
      setHistory(await operationsApi.listAdminEditSessions(targetUserId));
    } catch {
      setHistory([]);
    }
  }, [targetUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const session = useMemo(
    () => history.find((s) => !s.endedAt && s.adminUserId === profile?.id && Date.parse(s.expiresAt) > Date.now()) || null,
    [history, profile?.id],
  );

  const exit = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await operationsApi.endAdminEditSession(session.id);
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [session, refresh]);

  const dialog = open ? (
    <EnterEditDialog
      targetLabel={targetLabel || 'this user'}
      roleLabel={targetRole}
      onCancel={() => setOpen(false)}
      onConfirm={async (reason, reasonDetail) => {
        await operationsApi.startAdminEditSession({ targetUserId, targetRole, targetLabel, reason, reasonDetail, confirmed: true });
        setOpen(false);
        await refresh();
      }}
    />
  ) : null;

  return {
    editing: Boolean(canUseEditMode && session),
    session: canUseEditMode ? session : null,
    history,
    canUseEditMode,
    busy,
    openDialog: () => setOpen(true),
    exit,
    dialog,
  };
}

/** Top-right header action: "Edit User" ↔ "Exit Edit Mode". */
export function AdminEditUserButton({ state, style }: { state: AdminEditUserState; style?: React.CSSProperties }) {
  if (!state.canUseEditMode) return null;
  const base: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E8EDF2',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: '11.5px',
    fontWeight: 800,
    color: '#374151',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    ...style,
  };
  return state.editing ? (
    <button type="button" data-testid="admin-exit-edit" onClick={() => void state.exit()} disabled={state.busy} style={{ ...base, borderColor: '#B45309', color: '#B45309', background: '#FFFBEB' }}>
      <Lock size={13} /> Exit Edit Mode
    </button>
  ) : (
    <button type="button" data-testid="admin-edit-user" onClick={state.openDialog} style={base}>
      <PencilLine size={13} /> Edit User
    </button>
  );
}

/** "View only" / "Edit mode" strip shown under the page header. */
export function AdminEditModeStrip({ state }: { state: AdminEditUserState }) {
  if (!state.canUseEditMode) return null;
  if (!state.editing || !state.session) {
    return (
      <div data-testid="admin-view-only" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E8EDF2', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 14 }}>
        <Lock size={13} /> VIEW ONLY — use Edit User to make changes on behalf of this account. Every edit session is recorded.
      </div>
    );
  }
  const s = state.session;
  return (
    <div data-testid="admin-edit-mode-active" role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 14 }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        EDIT MODE — you are acting on behalf of this user. Reason: {reasonLabel(s.reason)} — “{s.reasonDetail}”. Started{' '}
        {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ends automatically at{' '}
        {new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Changes still go through each
        editor’s own checks.
      </div>
    </div>
  );
}

/** Audit history of edit sessions on this account (Account Information tab). */
export function AdminEditHistory({ state }: { state: AdminEditUserState }) {
  if (!state.canUseEditMode && !state.history.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 }} data-testid="admin-edit-history">
      <div style={{ fontSize: '12.5px', fontWeight: 800, marginBottom: 2 }}>ADMIN EDIT HISTORY</div>
      <div style={{ fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 10 }}>Recorded Super Admin edit sessions on this account.</div>
      {state.history.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '14px 0' }}>No edit sessions recorded.</div>
      ) : (
        state.history.slice(0, 10).map((s) => (
          <div key={s.id} style={{ fontSize: 11, fontWeight: 600, padding: '9px 0', borderTop: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#111827' }}>{s.adminName || s.adminEmail || s.adminUserId} · {reasonLabel(s.reason)}</div>
              <div style={{ color: '#6B7280', overflowWrap: 'anywhere' }}>{s.reasonDetail}</div>
            </div>
            <div style={{ color: '#9CA3AF', textAlign: 'right' }}>
              {new Date(s.startedAt).toLocaleString()}
              <br />
              {s.endedAt ? `${s.endReason === 'expired' ? 'Expired' : 'Ended'} ${new Date(s.endedAt).toLocaleTimeString()}` : 'Open'}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EnterEditDialog({
  targetLabel,
  roleLabel,
  onCancel,
  onConfirm,
}: {
  targetLabel: string;
  roleLabel: string;
  onCancel: () => void;
  onConfirm: (reason: AdminEditReason, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<AdminEditReason | ''>('');
  const [detail, setDetail] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Boolean(reason) && detail.trim().length >= 10 && ack;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#6B7280', letterSpacing: '0.04em', display: 'block', marginBottom: 4 };
  const input: React.CSSProperties = { width: '100%', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 10px', fontSize: 12.5, color: '#111827', background: '#fff', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="aeu-title" data-testid="admin-edit-dialog" style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '16px 18px', borderBottom: '1px solid #F1F3F5', background: '#FFFBEB' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <AlertTriangle size={20} color="#B45309" style={{ flexShrink: 0 }} />
            <div>
              <div id="aeu-title" style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Enter edit mode on behalf of {targetLabel}?</div>
              <div style={{ fontSize: 11.5, color: '#92400E', fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>
                You are about to make changes to a {roleLabel} account on the user’s behalf. Your name, the account, the time and your
                reason are recorded in the audit log.
              </div>
            </div>
          </div>
          <button type="button" aria-label="Cancel" onClick={onCancel} disabled={busy} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label} htmlFor="aeu-reason">REASON</label>
            <select id="aeu-reason" value={reason} onChange={(e) => setReason(e.target.value as AdminEditReason)} style={input}>
              <option value="">Select a reason…</option>
              {ADMIN_EDIT_REASONS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="aeu-detail">DETAILS (REQUIRED)</label>
            <textarea id="aeu-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Seller asked support to fix their brand contact email (ticket #1234)." style={{ ...input, resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>At least 10 characters.</div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 2 }} />
            I confirm I am entering edit mode on behalf of this user. Edit mode does not bypass any approval workflow or permission check.
          </label>
          {error ? <div role="alert" style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626' }}>{error}</div> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #F1F3F5' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="admin-edit-confirm"
            disabled={!valid || busy}
            onClick={async () => {
              if (!reason) return;
              setBusy(true);
              setError(null);
              try {
                await onConfirm(reason, detail.trim());
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not start edit mode.');
              } finally {
                setBusy(false);
              }
            }}
            style={{ background: valid ? '#B45309' : '#E5E7EB', color: valid ? '#fff' : '#9CA3AF', border: 0, borderRadius: 8, padding: '9px 14px', fontSize: 11.5, fontWeight: 800, cursor: valid ? 'pointer' : 'not-allowed' }}
          >
            {busy ? 'Starting…' : 'Enter Edit Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
