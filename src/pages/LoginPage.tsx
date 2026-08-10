import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
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

  const [email, setEmail] = useState(prefillEmail || 'admin@choosify.bd');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const role = await loginWithEmail(email, password, roleFromQuery || 'super_admin');
      void role;

      let redirectPath = '/admin/dashboard';
      if (nextPath.startsWith('/') && !nextPath.startsWith('//')) {
        redirectPath = nextPath;
      }

      navigate(redirectPath);
    } catch (err) {
      setError(authLoginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="choosify-dark-surface min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div
        className="relative w-full max-w-[880px] flex flex-col md:flex-row rounded-2xl overflow-hidden border border-white/12"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}
      >
        {/* Left brand panel — storefront dark-surface / footer gradient */}
        <div className="choosify-dark-surface flex-1 flex flex-col justify-between min-h-[320px] md:min-h-[520px] p-10 md:p-12 border-r border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <ChoosifyLogo variant="full" theme="dark" className="h-10 w-auto max-w-[200px] select-none" />
            </div>
            <h1
              className="text-[30px] font-extrabold text-white leading-tight mb-4"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Manage Bangladesh&apos;s
              <br />
              finest marketplace.
            </h1>
            <p className="text-[13px] font-semibold leading-relaxed max-w-[320px] text-white/55">
              Sign in to oversee catalog, orders, logistics and trust across the Choosify platform.
            </p>
          </div>
          <div className="text-[10.5px] font-semibold text-white/30 mt-10 md:mt-0">
            © 2026 CHOOSIFY BANGLADESH LTD.
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 bg-white flex flex-col justify-center min-h-[420px] md:min-h-[520px] p-10 md:p-12">
          <p className="text-[12.5px] font-bold text-[#6B7280] mb-6">
            Please sign in to your admin dashboard
          </p>

          <form onSubmit={handleLogin}>
            <label className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
              EMAIL ADDRESS
            </label>
            <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-[18px]">
              <Mail className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@choosify.bd"
                className="flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827] placeholder:text-[#9CA3AF]"
              />
            </div>

            <label className="block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5">
              PASSWORD
            </label>
            <div className="flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-2.5">
              <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="flex-1 bg-transparent border-0 outline-none text-[13px] font-bold text-[#111827] tracking-[2px] placeholder:tracking-[2px] placeholder:text-[#9CA3AF]"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 p-1 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-black/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-right mb-[22px]">
              <button
                type="button"
                className="text-[11px] font-bold text-[#FF5B00] hover:text-[#E64A00] transition-colors"
              >
                Forgot your password?
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 mb-[18px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-brand-gradient w-full h-[46px] rounded-[9px] text-[13.5px] font-extrabold text-white flex items-center justify-center gap-1.5 disabled:opacity-70"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-[10.5px] font-semibold text-[#9CA3AF] mt-5">
            Admin access only · Staff accounts are provisioned by Super Admin
          </p>

          <p className="text-center text-[11px] font-semibold text-[#6B7280] mt-4">
            New seller?{' '}
            <Link
              to={`/signup${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="text-[#FF5B00] font-bold hover:text-[#E64A00]"
            >
              Create a seller account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
