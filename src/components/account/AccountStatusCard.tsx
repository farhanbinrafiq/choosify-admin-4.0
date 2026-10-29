import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PauseCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/authApi';

const MIN_REASON = 10;
const DELETION_DAYS = 90;

type Mode = null | 'break' | 'delete';

/**
 * Settings → Security for sellers / creators: "Take a break" (inactive until
 * you sign in again; your brands / creator profile leave the marketplace and
 * Marketplace Access must be granted again) and "Delete my account" (inactive
 * now, deleted after 90 days unless you sign in again). Server enforces the same.
 */
export default function AccountStatusCard() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const role = String(profile?.role || '').toLowerCase();
  const offering = role === 'creator' ? 'your creator profile' : 'your brands';

  const open = (next: Mode) => {
    setMode(next);
    setReason('');
    setConfirmed(false);
    setError(null);
  };

  const reasonOk = reason.trim().length >= MIN_REASON;
  const canSubmit = reasonOk && (mode === 'break' || confirmed) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'delete') await authApi.requestMyDeletion(reason.trim());
      else await authApi.deactivateMe(reason.trim());
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const btn = 'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12px] font-bold transition-colors';

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5" data-testid="account-status-card">
      <div className="flex items-center gap-2 mb-1 text-[13px] font-extrabold text-app-text-primary">
        <PauseCircle className="w-4 h-4 text-app-accent" /> Account status
      </div>
      {mode === null ? (
        <div className="space-y-4">
          <div>
            <p className="text-[11.5px] text-app-text-secondary leading-relaxed">
              <span className="font-semibold text-app-text-primary">Take a break.</span> Your account becomes inactive,
              you&apos;re signed out everywhere and {offering} leave the marketplace. Sign in again whenever you&apos;re
              ready — you&apos;ll then request Marketplace Access again.
            </p>
            <button
              type="button"
              data-testid="account-take-break"
              onClick={() => open('break')}
              className={`${btn} mt-2 border-app-border bg-white text-app-text-primary hover:bg-[#F8F9FA]`}
            >
              <PauseCircle className="w-3.5 h-3.5" /> Make my account inactive
            </button>
          </div>
          <div className="border-t border-app-border pt-4">
            <p className="text-[11.5px] text-app-text-secondary leading-relaxed">
              <span className="font-semibold text-app-text-primary">Delete my account.</span> Your request is reviewed
              and the account is put in deletion: inactive for {DELETION_DAYS} days, then permanently deleted. Signing in
              again within {DELETION_DAYS} days cancels the deletion.
            </p>
            <button
              type="button"
              data-testid="account-delete"
              onClick={() => open('delete')}
              className={`${btn} mt-2 border-red-200 bg-white text-red-600 hover:bg-red-50`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete my account
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 mt-2">
          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700">
              {error}
            </p>
          ) : null}
          <label className="block text-[11px] font-bold text-app-text-secondary" htmlFor="account-status-reason">
            {mode === 'delete' ? 'Why are you leaving?' : 'Why are you taking a break?'}
          </label>
          <textarea
            id="account-status-reason"
            data-testid="account-status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-app-border bg-white px-3 py-2 text-[12px] outline-none focus:border-app-accent"
          />
          <p className="text-[10.5px] text-app-text-secondary">
            {reasonOk ? 'Thanks — this helps us improve.' : `At least ${MIN_REASON} characters.`}
          </p>
          {mode === 'delete' ? (
            <label className="flex items-start gap-2 text-[11.5px] text-app-text-secondary leading-relaxed">
              <input
                type="checkbox"
                data-testid="account-delete-confirm"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              I understand my account will be inactive now and permanently deleted after {DELETION_DAYS} days unless I
              sign in again.
            </label>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="account-status-submit"
              disabled={!canSubmit}
              className={`${btn} border-transparent text-white disabled:opacity-50 ${mode === 'delete' ? 'bg-red-600' : 'bg-[#1A1A2E]'}`}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {mode === 'delete' ? 'Submit deletion request' : 'Make inactive and sign out'}
            </button>
            <button
              type="button"
              onClick={() => open(null)}
              disabled={busy}
              className={`${btn} border-app-border bg-white text-app-text-primary hover:bg-[#F8F9FA]`}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
