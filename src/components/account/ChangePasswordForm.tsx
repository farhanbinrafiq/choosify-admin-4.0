import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * The ONE self-service "change your own password" form for every
 * password-authenticated dashboard role (Seller / Creator / Admin / Super
 * Admin / staff). The target account is derived entirely from the
 * authenticated session inside AuthContext.changePassword →
 * POST /auth/change-password (current password verified server-side, Argon2,
 * Password-Changed email). There is NO userId input — an admin viewing another
 * user's profile must never render this component.
 */
const MIN_LEN = 8;
const MAX_LEN = 128;

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  autoFocus?: boolean;
};

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, autoFocus }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 focus-within:border-[#EF3C23]/40 focus-within:ring-2 focus-within:ring-[#EF3C23]/10 transition-colors">
        <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827]"
          autoComplete={autoComplete}
          minLength={MIN_LEN}
          maxLength={MAX_LEN}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={onToggle}
          className="text-[#9CA3AF] p-1 rounded outline-none hover:text-[#374151] focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LEN &&
    newPassword.length <= MAX_LEN &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < MIN_LEN) return setError(`New password must be at least ${MIN_LEN} characters.`);
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');
    if (newPassword === currentPassword) return setError('New password must be different from your current password.');
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-emerald-800">
          <p className="font-bold">Password updated.</p>
          <p className="mt-0.5 text-emerald-700">
            Use your new password next time you sign in. Other signed-in sessions are not affected.
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-2 text-[11.5px] font-bold text-emerald-800 underline"
          >
            Change it again
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <PasswordField
        id="cp-current"
        label="CURRENT PASSWORD"
        value={currentPassword}
        onChange={setCurrentPassword}
        visible={showCurrent}
        onToggle={() => setShowCurrent((v) => !v)}
        autoComplete="current-password"
        autoFocus
      />
      <PasswordField
        id="cp-new"
        label="NEW PASSWORD"
        value={newPassword}
        onChange={setNewPassword}
        visible={showNew}
        onToggle={() => setShowNew((v) => !v)}
        autoComplete="new-password"
      />
      {newPassword.length > 0 && newPassword.length < MIN_LEN ? (
        <p className="-mt-2 mb-3 text-[11px] font-bold text-rose-500">At least {MIN_LEN} characters.</p>
      ) : null}
      <PasswordField
        id="cp-confirm"
        label="CONFIRM NEW PASSWORD"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((v) => !v)}
        autoComplete="new-password"
      />
      {confirmPassword.length > 0 && confirmPassword !== newPassword ? (
        <p className="-mt-2 mb-3 text-[11px] font-bold text-rose-500">Passwords don&apos;t match.</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-brand-gradient w-full h-[46px] rounded-[9px] text-[13.5px] font-extrabold text-white disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Updating…' : 'Change password'}
      </button>
    </form>
  );
}
