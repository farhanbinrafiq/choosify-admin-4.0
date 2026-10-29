import React, { CSSProperties, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { authApi, type AccountLifecycle } from '../../../services/authApi';

/**
 * Account lifecycle for any account (consumer / seller / creator): status
 * banner + a collapsed Super Admin "Danger zone" with Make inactive, Delete
 * (reason → confirm → internal note) and Reactivate, plus the status history.
 * Server enforces the same rules (Super Admin only, reasons, 90-day window).
 */
const MIN_REASON = 10;
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');

const C: Record<string, CSSProperties> = {
  panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: 16 },
  btn: { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: '1px solid #E5E7EB', background: '#fff' },
  danger: { padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 0, background: '#DC2626', color: '#fff' },
  input: { width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' },
  label: { fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: '#6B7280', marginBottom: 4, display: 'block' },
};

/** Top-of-profile banner while an account is inactive / in deletion / anonymized. */
export function AccountLifecycleBanner({ lifecycle }: { lifecycle?: AccountLifecycle | null }) {
  if (!lifecycle?.state) return null;
  const deletion = lifecycle.state === 'pending_deletion';
  const gone = lifecycle.state === 'anonymized';
  return (
    <div
      data-testid="account-lifecycle-banner"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        borderRadius: 12,
        padding: '12px 16px',
        border: `1px solid ${deletion || gone ? '#FECACA' : '#FDE68A'}`,
        background: deletion || gone ? '#FEF2F2' : '#FFFBEB',
        color: deletion || gone ? '#991B1B' : '#92400E',
        fontSize: 12,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontWeight: 900 }}>
          {gone
            ? 'Account deleted (anonymized)'
            : deletion
              ? `In deletion — will be deleted on ${fmt(lifecycle.deletionDueAt)}`
              : 'Account inactive'}
        </div>
        {!gone && (
          <div>
            {lifecycle.requestedBy === 'self' ? 'Requested by the account owner' : 'Set by Choosify'} on {fmt(lifecycle.at)}
            {lifecycle.reason ? ` — “${lifecycle.reason}”` : ''}. Signing in again reactivates it
            {deletion ? ' and cancels the deletion' : ''}.
          </div>
        )}
      </div>
    </div>
  );
}

/** Small list pill for the management tables' "Inactive / In Deletion" tab. */
export function AccountStatePill({ state, deletionDueAt }: { state?: AccountLifecycle['state']; deletionDueAt?: string | null }) {
  if (!state) return null;
  const red = state !== 'inactive';
  return (
    <span
      data-testid="account-state-pill"
      className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${
        red ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      }`}
      title={state === 'pending_deletion' && deletionDueAt ? `Deleted on ${fmt(deletionDueAt)} unless they sign in again` : undefined}
    >
      {state === 'anonymized' ? 'Deleted' : state === 'pending_deletion' ? `In deletion · ${fmt(deletionDueAt || undefined)}` : 'Account inactive'}
    </span>
  );
}

type Dialog =
  | { kind: 'deactivate'; reason: string }
  | { kind: 'delete'; step: 1 | 2 | 3; reason: string; internalNote: string }
  | { kind: 'reactivate'; note: string };

export function AccountLifecycleControls({
  userId,
  ownerLabel,
  onChanged,
}: {
  userId: string;
  ownerLabel: string;
  onChanged?: (lifecycle: AccountLifecycle) => void;
}) {
  const { profile } = useAuth();
  const isSuperAdmin = String(profile?.role || '') === 'super_admin';
  const [lifecycle, setLifecycle] = useState<AccountLifecycle | null>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await authApi.getUserDetail(userId);
      setLifecycle(detail.lifecycle ?? { history: [] });
    } catch {
      setLifecycle({ history: [] });
    }
  }, [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!isSuperAdmin || !lifecycle || userId === profile?.id) return null;
  const state = lifecycle.state;
  const deletionDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString();

  const run = async (fn: () => Promise<AccountLifecycle>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setLifecycle(next);
      setDialog(null);
      onChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...C.panel, borderColor: '#FECACA' }} data-testid="account-danger-zone">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 900, color: '#991B1B' }}
        data-testid="danger-zone-toggle"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} DANGER ZONE — account status
        <span style={{ fontWeight: 700, color: '#6B7280', marginLeft: 6 }}>
          {state === 'inactive' ? 'Inactive' : state === 'pending_deletion' ? `In deletion until ${fmt(lifecycle.deletionDueAt)}` : state === 'anonymized' ? 'Deleted' : 'Active'}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 1.5 }}>
            Making {ownerLabel} inactive signs them out everywhere and takes any brand or creator profile off the marketplace. Deleting does
            the same and anonymizes the account after 90 days. Signing in again before then reactivates it; a seller or creator then needs
            Marketplace Access granted again.
          </div>
          {state !== 'anonymized' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!state && (
                <button type="button" style={C.btn} onClick={() => setDialog({ kind: 'deactivate', reason: '' })} data-testid="lifecycle-deactivate">
                  Make inactive…
                </button>
              )}
              {state !== 'pending_deletion' && (
                <button
                  type="button"
                  style={{ ...C.btn, color: '#DC2626', borderColor: '#FECACA' }}
                  onClick={() => setDialog({ kind: 'delete', step: 1, reason: '', internalNote: '' })}
                  data-testid="lifecycle-delete"
                >
                  Delete account…
                </button>
              )}
              {state && (
                <button type="button" style={C.btn} onClick={() => setDialog({ kind: 'reactivate', note: '' })} data-testid="lifecycle-reactivate">
                  Reactivate account
                </button>
              )}
            </div>
          )}

          {dialog?.kind === 'deactivate' && (
            <div style={{ ...C.panel, background: '#FFFBEB' }} data-testid="lifecycle-deactivate-form">
              <label style={C.label} htmlFor="lc-reason">Reason (shown in the account history, {MIN_REASON}+ characters)</label>
              <textarea id="lc-reason" rows={3} style={C.input} value={dialog.reason} onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  style={{ ...C.danger, background: '#B45309', opacity: dialog.reason.trim().length < MIN_REASON || busy ? 0.5 : 1 }}
                  disabled={dialog.reason.trim().length < MIN_REASON || busy}
                  onClick={() => void run(() => authApi.deactivateUser(userId, { reason: dialog.reason.trim() }))}
                  data-testid="lifecycle-deactivate-confirm"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : 'Make inactive'}
                </button>
                <button type="button" style={C.btn} onClick={() => setDialog(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {dialog?.kind === 'delete' && (
            <div style={{ ...C.panel, background: '#FEF2F2' }} data-testid="lifecycle-delete-form">
              {dialog.step === 1 && (
                <>
                  <label style={C.label} htmlFor="lc-del-reason">Step 1 of 3 — why is this account being deleted? ({MIN_REASON}+ characters)</label>
                  <textarea id="lc-del-reason" rows={3} style={C.input} value={dialog.reason} onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      style={{ ...C.danger, opacity: dialog.reason.trim().length < MIN_REASON ? 0.5 : 1 }}
                      disabled={dialog.reason.trim().length < MIN_REASON}
                      onClick={() => setDialog({ ...dialog, step: 2 })}
                      data-testid="lifecycle-delete-next"
                    >
                      Delete
                    </button>
                    <button type="button" style={C.btn} onClick={() => setDialog(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {dialog.step === 2 && (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: '#991B1B', marginBottom: 4 }}>Step 2 of 3 — are you sure?</div>
                  <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
                    {ownerLabel.charAt(0).toUpperCase() + ownerLabel.slice(1)} will be signed out and inactive now, and anonymized on{' '}
                    <b>{deletionDate}</b> unless the owner signs in again before then. Orders and payments stay as anonymous records.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" style={C.danger} onClick={() => setDialog({ ...dialog, step: 3 })} data-testid="lifecycle-delete-sure">
                      Yes, continue
                    </button>
                    <button type="button" style={C.btn} onClick={() => setDialog(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {dialog.step === 3 && (
                <>
                  <label style={C.label} htmlFor="lc-del-note">Step 3 of 3 — internal note (staff only, 5+ characters)</label>
                  <textarea id="lc-del-note" rows={3} style={C.input} value={dialog.internalNote} onChange={(e) => setDialog({ ...dialog, internalNote: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      style={{ ...C.danger, opacity: dialog.internalNote.trim().length < 5 || busy ? 0.5 : 1 }}
                      disabled={dialog.internalNote.trim().length < 5 || busy}
                      onClick={() => void run(() => authApi.deleteUser(userId, { reason: dialog.reason.trim(), internalNote: dialog.internalNote.trim() }))}
                      data-testid="lifecycle-delete-confirm"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : 'Delete account'}
                    </button>
                    <button type="button" style={C.btn} onClick={() => setDialog(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {dialog?.kind === 'reactivate' && (
            <div style={{ ...C.panel, background: '#F0FDF4' }} data-testid="lifecycle-reactivate-form">
              <label style={C.label} htmlFor="lc-react-note">Note (optional)</label>
              <textarea id="lc-react-note" rows={2} style={C.input} value={dialog.note} onChange={(e) => setDialog({ ...dialog, note: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  style={{ ...C.danger, background: '#047857', opacity: busy ? 0.5 : 1 }}
                  disabled={busy}
                  onClick={() => void run(() => authApi.reactivateUser(userId, { note: dialog.note.trim() || undefined }))}
                  data-testid="lifecycle-reactivate-confirm"
                >
                  Reactivate
                </button>
                <button type="button" style={C.btn} onClick={() => setDialog(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{error}</div>}

          {lifecycle.history.length > 0 && (
            <div>
              <div style={C.label}>STATUS HISTORY</div>
              {[...lifecycle.history].reverse().map((h, i) => (
                <div key={`${h.at}-${i}`} style={{ fontSize: 11.5, padding: '6px 0', borderTop: '1px solid #F1F3F5' }} data-testid="lifecycle-history-row">
                  <b style={{ textTransform: 'capitalize' }}>{h.action.replace(/_/g, ' ')}</b> · {new Date(h.at).toLocaleString()} ·{' '}
                  {h.by === 'self' ? 'by the owner' : h.by === 'login' ? 'by signing in' : h.by === 'system' ? 'automatically' : `by ${h.actorName || 'Choosify'}`}
                  {h.reason ? <span style={{ color: '#4B5563' }}> — {h.reason}</span> : null}
                  {h.internalNote ? <span style={{ color: '#6B7280' }}> · Internal: {h.internalNote}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
