import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, XCircle } from 'lucide-react';
import { AdminAuthCard, AdminAuthInput, AdminAuthButton } from '../components/auth/AdminAuthCard';

type Stage = 'form' | 'success' | 'invalid';

// Canonical policy — same as sign-up / the backend (8–128). Never weakened for UI.
const MIN_LEN = 8;
const MAX_LEN = 128;

/**
 * Dashboard (Admin / Partner) Reset Password. Consumes the same
 * hashed-at-rest / single-use / 1-hour token via POST /auth/reset-password; the
 * backend revokes all sessions on success. No social login here.
 */
export default function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Independent visibility per field.
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>(token ? 'form' : 'invalid');
  const [error, setError] = useState('');

  const tooShort = password.length > 0 && password.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = useMemo(
    () => password.length >= MIN_LEN && password.length <= MAX_LEN && password === confirm && !submitting,
    [password, confirm, submitting],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LEN) return setError(`Password must be at least ${MIN_LEN} characters.`);
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean };
      setStage(res.ok && body.success ? 'success' : 'invalid');
    } catch {
      setStage('invalid');
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'success') {
    return (
      <AdminAuthCard title="Password updated" intro="Your password has been changed and every other session was signed out.">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="mb-5 text-[12.5px] leading-relaxed text-[#4B5563]">Sign in with your new password to continue.</p>
          <AdminAuthButton type="button" onClick={() => navigate('/login')}>
            Continue to sign in <ArrowRight className="h-4 w-4" />
          </AdminAuthButton>
        </div>
      </AdminAuthCard>
    );
  }

  if (stage === 'invalid') {
    return (
      <AdminAuthCard
        title="Link expired or invalid"
        intro="This reset link is no longer valid — it may have been used already, or it's more than an hour old."
        footer={
          <button type="button" onClick={() => navigate('/login')} className="font-bold text-[#FF5B00]">
            Back to sign in
          </button>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <XCircle className="h-7 w-7 text-rose-500" />
          </div>
          <AdminAuthButton type="button" onClick={() => navigate('/forgot-password')}>
            Request a new link <ArrowRight className="h-4 w-4" />
          </AdminAuthButton>
        </div>
      </AdminAuthCard>
    );
  }

  const eyeToggle = (visible: boolean, toggle: () => void) => (
    <button
      type="button"
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      onClick={toggle}
      className="shrink-0 rounded-md p-1 text-[#9CA3AF] outline-none transition-colors hover:bg-black/5 hover:text-[#374151] focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <AdminAuthCard title="Choose a new password" intro={`Use at least ${MIN_LEN} characters — the same rule as sign-up.`}>
      <form onSubmit={handleSubmit}>
        <AdminAuthInput
          id="new-password"
          label="NEW PASSWORD"
          type={showNew ? 'text' : 'password'}
          required
          autoFocus
          minLength={MIN_LEN}
          maxLength={MAX_LEN}
          icon={Lock}
          rightSlot={eyeToggle(showNew, () => setShowNew((v) => !v))}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {tooShort ? <p className="-mt-3 mb-3 text-[11px] font-bold text-rose-500">At least {MIN_LEN} characters.</p> : null}
        <AdminAuthInput
          id="confirm-password"
          label="CONFIRM NEW PASSWORD"
          type={showConfirm ? 'text' : 'password'}
          required
          minLength={MIN_LEN}
          maxLength={MAX_LEN}
          icon={Lock}
          rightSlot={eyeToggle(showConfirm, () => setShowConfirm((v) => !v))}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {mismatch ? <p className="-mt-3 mb-3 text-[11px] font-bold text-rose-500">Passwords don't match.</p> : null}
        {error ? (
          <div className="mb-[18px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
            {error}
          </div>
        ) : null}
        <AdminAuthButton type="submit" loading={submitting} disabled={!canSubmit}>
          {submitting ? 'Updating…' : 'Reset password'}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </AdminAuthButton>
      </form>
    </AdminAuthCard>
  );
}
