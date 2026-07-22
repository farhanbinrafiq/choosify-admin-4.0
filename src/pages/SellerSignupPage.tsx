import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, Lock, Mail, Store, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';

export default function SellerSignupPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';

  const [email, setEmail] = useState(prefillEmail);
  const [displayName, setDisplayName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { registerSeller } = useAuth();
  const navigate = useNavigate();

  const loginHref = `/login?email=${encodeURIComponent(email.trim())}&role=seller`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerSeller({
        email,
        password,
        displayName,
        storeName: storeName || undefined,
      });
      navigate(result.dashboardPath || '/seller/products', { replace: true });
    } catch (err) {
      const typed = err as Error & { code?: string; loginPath?: string };
      if (typed.code === 'SELLER_EXISTS' || typed.code === 'EMAIL_EXISTS') {
        setError(typed.message || 'An account already exists for this email.');
      } else {
        setError(typed.message || 'Unable to create seller account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 font-sans relative">
      <a
        href="https://choosify.bd"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-8 left-8 flex items-center gap-2 text-app-text-secondary hover:text-white transition-colors text-sm font-bold"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Visit choosify.bd
      </a>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-app-card rounded-[2.5rem] overflow-hidden shadow-2xl border border-app-border">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-app-sidebar relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <ChoosifyLogo variant="full" theme="dark" className="h-9 w-auto select-none" />
            </div>
            <h2 className="text-4xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              Sell on <br />
              Bangladesh&apos;s <br />
              discovery platform.
            </h2>
            <p className="text-app-text-secondary text-sm leading-relaxed max-w-xs">
              Create your seller dashboard account, list products, and reach shoppers already browsing Choosify.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-app-text-secondary">
              <li className="flex items-center gap-2">
                <Store className="w-4 h-4 text-app-accent-light" />
                Product & inventory tools
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-app-accent-light" />
                Orders and brand management
              </li>
            </ul>
          </div>
          <div className="relative z-10 text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40">
            © 2026 Choosify Bangladesh Ltd.
          </div>
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-app-accent rounded-full blur-[100px] opacity-10" />
        </div>

        <div className="p-8 md:p-12">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Join as a Seller</h3>
            <p className="text-sm text-app-text-secondary">
              Create your seller dashboard account. Your Choosify email is pre-filled when you arrive from the storefront.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">
                Store / brand name <span className="opacity-50">(optional)</span>
              </label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Your shop name"
                  className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
                {(error.toLowerCase().includes('already') || error.toLowerCase().includes('sign in')) && (
                  <div className="mt-2">
                    <Link to={loginHref} className="text-app-accent-light font-bold hover:underline">
                      Go to seller login →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-app-accent hover:bg-app-accent-light disabled:opacity-60 text-white font-bold py-4 rounded-2xl shadow-xl shadow-app-accent/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 group"
            >
              <span>{submitting ? 'Creating account…' : 'Create Seller Account'}</span>
              {!submitting && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>

            <p className="text-center text-sm text-app-text-secondary">
              Already have a seller account?{' '}
              <Link to={loginHref} className="text-app-accent-light font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
