import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { AdminAuthShell } from '../components/auth/AdminAuthShell';
import { authLoginErrorMessage } from '../lib/authLoginErrorMessage';

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'seller', 'creator', 'moderator'];

function resolveRoleParam(value: string | null): UserRole | null {
  if (!value) return null;
  return ALLOWED_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';
  const nextPath = searchParams.get('next')?.trim() || '';
  const roleFromQuery = resolveRoleParam(searchParams.get('role'));

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = () => {
    const target = email.trim();
    navigate(`/forgot-password${target ? `?email=${encodeURIComponent(target)}` : ''}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const role = await loginWithEmail(email, password, roleFromQuery || 'super_admin');
      void role;

      // Forced password change is gated by AuthContext.mustChangePassword + routes.
      // Always land on root so RootRoute / ForcePasswordChangeGate can enforce.
      navigate('/');
    } catch (err) {
      setError(authLoginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminAuthShell>
      <>
          <p className="mb-6 text-[12.5px] font-bold text-[#6B7280]">
            Please sign in to your admin dashboard
          </p>

          <form onSubmit={handleLogin}>
            <label className="mb-1.5 block text-[10px] font-extrabold tracking-wide text-[#6B7280]">
              EMAIL ADDRESS
            </label>
            <div className="mb-[18px] flex h-11 items-center gap-2 rounded-lg border border-[#E8EDF2] bg-[#F8F9FC] px-3.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 border-0 bg-transparent text-[13px] font-semibold text-[#111827] outline-none placeholder:text-[#9CA3AF]"
              />
            </div>

            <label className="mb-1.5 block text-[10px] font-extrabold tracking-wide text-[#6B7280]">
              PASSWORD
            </label>
            <div className="mb-2.5 flex h-11 items-center gap-2 rounded-lg border border-[#E8EDF2] bg-[#F8F9FC] px-3.5">
              <Lock className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="flex-1 border-0 bg-transparent text-[13px] font-bold tracking-[2px] text-[#111827] outline-none placeholder:tracking-normal placeholder:text-[#9CA3AF]"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 rounded-md p-1 text-[#9CA3AF] outline-none transition-colors hover:bg-black/5 hover:text-[#374151] focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="mb-[22px] flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#4B5563]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#FF5B00]"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[11px] font-bold text-[#FF5B00] transition-colors hover:text-[#FF5B00]"
              >
                Forgot your password?
              </button>
            </div>

            {error && (
              <div className="mb-[18px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-brand-gradient flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] font-extrabold text-white disabled:opacity-70"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[10.5px] font-semibold text-[#9CA3AF]">
            Admin access only · Staff accounts are provisioned by Super Admin
          </p>

          <p className="mt-4 text-center text-[11px] font-semibold text-[#6B7280]">
            New to Choosify?{' '}
            <Link
              to={`/signup${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="font-bold text-[#FF5B00] hover:text-[#FF5B00]"
            >
              Apply as a Partner
            </Link>
          </p>
      </>
    </AdminAuthShell>
  );
}
