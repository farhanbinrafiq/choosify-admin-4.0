import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Box,
  ClipboardList,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  Mail,
  ShieldCheck,
  Settings,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
import { authLoginErrorMessage } from '../lib/authLoginErrorMessage';

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'seller', 'creator', 'moderator'];

function resolveRoleParam(value: string | null): UserRole | null {
  if (!value) return null;
  return ALLOWED_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

/** Distant navigation silhouette — atmospheric geometry only, never wired. */
const DECOR_NAV: { label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Activity', icon: Activity },
  { label: 'Sellers', icon: Users },
  { label: 'Products', icon: Box },
  { label: 'Orders', icon: ClipboardList },
  { label: 'Reviews', icon: Star },
  { label: 'Reports', icon: TrendingUp },
  { label: 'Settings', icon: Settings },
];

/** Faint atmospheric points — large desktop only, static, aria-hidden. */
const AMBIENT_NODES: { left: string; top: string; cls: string }[] = [
  { left: '13%', top: '20%', cls: 'h-1 w-1 bg-white/20' },
  { left: '22%', top: '70%', cls: 'h-1.5 w-1.5 bg-[#7A3CFF]/40 shadow-[0_0_10px_2px_rgba(122,60,255,0.22)]' },
  { left: '8%', top: '44%', cls: 'h-1 w-1 bg-white/15' },
  { left: '46%', top: '10%', cls: 'h-1 w-1 bg-white/12' },
  { left: '63%', top: '84%', cls: 'h-1.5 w-1.5 bg-[#FF5B00]/35 shadow-[0_0_10px_2px_rgba(255,91,0,0.18)]' },
  { left: '80%', top: '28%', cls: 'h-1 w-1 bg-[#7A3CFF]/35' },
  { left: '90%', top: '54%', cls: 'h-1 w-1 bg-white/14' },
  { left: '72%', top: '15%', cls: 'h-1 w-1 bg-[#EF3C23]/35' },
];

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';
  const nextPath = searchParams.get('next')?.trim() || '';
  const roleFromQuery = resolveRoleParam(searchParams.get('role'));

  const [email, setEmail] = useState(prefillEmail || 'admin@choosify.com.bd');
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
    <div
      className="choosify-dark-surface relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Administrative atmosphere (decorative, non-interactive) ──────────
          Abstract premium operations/control-center environment: layered
          ambient lighting, peripheral grid, distant navigation geometry, an
          abstract security/network motif and a soft brand echo. Navy stays
          dominant. Nothing here is a usable dashboard. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* 1 · Ambient lighting zones — burgundy upper-left, violet behind the
            card, warm coral lower-right by the security motif */}
        <div className="absolute -left-[12%] -top-[10%] h-[620px] w-[620px] rounded-full bg-[#5A1230]/25 blur-[170px]" />
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7A3CFF]/10 blur-[180px]" />
        <div className="absolute -right-[10%] -bottom-[8%] h-[600px] w-[600px] rounded-full bg-[#FF5B00]/10 blur-[170px]" />
        <div className="absolute right-[6%] top-[58%] h-[320px] w-[320px] rounded-full bg-[#EF3C23]/[0.08] blur-[130px]" />

        {/* 2 · Peripheral grid — felt, not read (large desktop only) */}
        <div className="auth-admin-grid absolute inset-0 hidden opacity-60 xl:block" />

        {/* 3 · Soft Choosify brand echo — cropped by the right edge, folded
            into the coral light (large desktop only) */}
        <ChoosifyLogo
          variant="icon"
          className="absolute -right-[16%] top-1/2 hidden h-[760px] w-auto -translate-y-1/2 opacity-[0.022] blur-[3px] xl:block"
        />

        {/* 4 · Abstract data / network paths — full composition only,
            concentrated upper-right, right-centre and lower-left */}
        <svg
          className="absolute inset-0 hidden h-full w-full min-[1600px]:block"
          viewBox="0 0 1920 1080"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <path d="M1400 90 C1600 200 1720 360 1560 520" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M1660 620 C1500 720 1520 900 1720 990" stroke="rgba(255,255,255,0.045)" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M100 800 C260 720 320 900 460 880" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M1500 300 L1624 240 M1560 520 L1660 620" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <g fill="rgba(255,255,255,0.14)">
            <circle cx="1400" cy="90" r="2.5" />
            <circle cx="1624" cy="240" r="2" />
            <circle cx="1560" cy="520" r="2.5" />
            <circle cx="1660" cy="620" r="2" />
            <circle cx="1720" cy="990" r="2.5" />
            <circle cx="100" cy="800" r="2" />
            <circle cx="460" cy="880" r="2.5" />
          </g>
        </svg>

        {/* 5 · Distant administrative navigation — reads as geometry first;
            ~45% cropped, heavily edge-masked, centred on the card */}
        <div className="auth-admin-sidebar absolute -left-[96px] top-1/2 hidden w-[212px] -translate-y-1/2 opacity-50 xl:block min-[1600px]:-left-[68px]">
          <div className="mb-5 flex items-center gap-2 px-2">
            <span className="h-6 w-6 rounded-lg bg-white/[0.05]" />
            <span className="h-1.5 w-14 rounded bg-white/[0.045]" />
          </div>
          <div className="space-y-1">
            {DECOR_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/[0.12]"
                >
                  <Icon className="h-3.5 w-3.5 text-white/25" />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* 6 · Abstract security / network motif (right) — no container,
            embedded into the background (large desktop only) */}
        <div className="absolute right-[3%] top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 xl:block min-[1600px]:right-[5%]">
          <div className="absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF5B00]/10 blur-[38px]" />
          <div className="auth-admin-ring absolute left-1/2 top-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2" />
          <div className="auth-admin-ring absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2" />
          <div className="auth-admin-ring auth-admin-ring--dashed absolute left-1/2 top-1/2 h-[252px] w-[252px] -translate-x-1/2 -translate-y-1/2" />
          <span className="absolute left-1/2 top-[calc(50%-90px)] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/25" />
          <span className="absolute left-[calc(50%+126px)] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#FF5B00]/40" />
          <span className="absolute left-[calc(50%-56px)] top-[calc(50%+56px)] h-1 w-1 rounded-full bg-white/20" />
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <ShieldCheck className="h-7 w-7 text-white/35" />
            <span className="mt-3 text-[8.5px] font-bold uppercase tracking-[0.42em] text-white/30">
              Authorized Access
            </span>
          </span>
        </div>

        {/* 7 · Faint ambient nodes — full composition only */}
        {AMBIENT_NODES.map((n, i) => (
          <span
            key={i}
            className={`absolute hidden rounded-full min-[1600px]:block ${n.cls}`}
            style={{ left: n.left, top: n.top }}
          />
        ))}

        {/* 8 · Multi-directional vignette — pulls attention inward */}
        <div className="auth-admin-vignette absolute inset-0" />
      </div>

      <div
        className="relative flex w-full max-w-[880px] flex-col overflow-hidden rounded-[16px] border border-white/12 md:flex-row min-[1600px]:max-w-[960px]"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}
      >
        {/* Left brand panel */}
        <div className="choosify-dark-surface flex min-h-[320px] flex-1 flex-col justify-between border-r border-white/10 p-10 md:min-h-[520px] md:p-12">
          <div>
            <div className="mb-10 flex items-center gap-2">
              <ChoosifyLogo variant="full" theme="dark" className="h-10 w-auto max-w-[200px] select-none" />
            </div>
            <span className="mb-4 inline-block rounded-full bg-[rgba(255,90,44,0.14)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B00]">
              Admin Console
            </span>
            <h1
              className="mb-3 text-[30px] font-extrabold leading-tight text-white"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Operations
              <br />
              Control Center
            </h1>
            <p className="mb-4 text-[12.5px] font-bold leading-relaxed text-[#FF5B00]/90">
              Powering smarter commerce across Choosify.
            </p>
            <p className="max-w-[320px] text-[13px] font-semibold leading-relaxed text-white/55">
              Oversee sellers, products, orders, content and platform trust from one workspace.
            </p>
          </div>
          <div className="mt-10 text-[10.5px] font-semibold text-white/30 md:mt-0">
            © 2026 CHOOSIFY BANGLADESH LTD.
          </div>
        </div>

        {/* Right form panel — inputs, handlers and CTA unchanged */}
        <div className="flex min-h-[420px] flex-1 flex-col justify-center bg-white p-10 md:min-h-[520px] md:p-12">
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
                placeholder="admin@choosify.com.bd"
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
                placeholder="••••••••"
                autoComplete="current-password"
                className="flex-1 border-0 bg-transparent text-[13px] font-bold tracking-[2px] text-[#111827] outline-none placeholder:tracking-[2px] placeholder:text-[#9CA3AF]"
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
        </div>
      </div>
    </div>
  );
}
