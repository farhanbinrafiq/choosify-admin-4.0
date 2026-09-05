import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';

/**
 * Non-dismissible gate after admin-assisted temporary password reset.
 * User cannot reach the dashboard until change-password succeeds.
 */
export default function ForcePasswordChangePage() {
  const { changePassword, logout, profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from the temporary password.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="choosify-dark-surface min-h-screen flex items-center justify-center p-6"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="w-full max-w-[440px] bg-white rounded-2xl border border-[#E8EDF2] p-8 shadow-xl">
        <ChoosifyLogo variant="full" theme="light" className="h-8 w-auto max-w-[160px] mb-6" />
        <h1 className="text-[20px] font-extrabold text-[#111827] mb-2">Password change required</h1>
        <p className="text-[12.5px] font-semibold text-[#6B7280] leading-relaxed mb-5">
          Your account was reset by Choosify Support. You must set a new password before accessing the
          dashboard
          {profile?.email ? (
            <>
              {' '}
              (<span className="text-[#111827]">{profile.email}</span>)
            </>
          ) : null}
          .
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <label className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
            TEMPORARY / CURRENT PASSWORD
          </label>
          <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-4">
            <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827]"
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label={showCurrent ? 'Hide' : 'Show'}
              onClick={() => setShowCurrent((v) => !v)}
              className="text-[#9CA3AF] p-1"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
            NEW PASSWORD
          </label>
          <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-4">
            <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            <input
              type={showNew ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827]"
              autoComplete="new-password"
              minLength={8}
            />
            <button
              type="button"
              aria-label={showNew ? 'Hide' : 'Show'}
              onClick={() => setShowNew((v) => !v)}
              className="text-[#9CA3AF] p-1"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
            CONFIRM NEW PASSWORD
          </label>
          <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-5">
            <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827]"
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 mb-4">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-brand-gradient w-full h-[46px] rounded-[9px] text-[13.5px] font-extrabold text-white disabled:opacity-70"
          >
            {submitting ? 'Updating…' : 'Set new password'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => logout()}
          className="w-full mt-4 text-[11.5px] font-bold text-[#6B7280] hover:text-[#111827]"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
