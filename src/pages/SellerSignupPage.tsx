import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
import { getCanonicalAdminCategories } from '../lib/storefrontCategories';

const STOREFRONT_TERMS_URL = 'https://choosify.bd/terms';

type ApplicantType = 'seller' | 'creator';

/** Non-interactive explanation of the real (Admin-gated) application lifecycle. */
const PROCESS_STEPS = [
  { n: '01', title: 'Apply', body: 'Submit your information' },
  { n: '02', title: 'Review', body: 'Choosify reviews your application' },
  { n: '03', title: 'Access', body: 'Approved partners receive access' },
];

/** Faint atmospheric points — large desktop only, static, decorative. */
const PARTNER_NODES: { style: React.CSSProperties; cls: string }[] = [
  { style: { left: '11%', top: '16%' }, cls: 'h-1 w-1 bg-white/20' },
  { style: { left: '18%', top: '62%' }, cls: 'h-1.5 w-1.5 bg-[#7A3CFF]/45 shadow-[0_0_10px_2px_rgba(122,60,255,0.2)]' },
  { style: { left: '84%', top: '24%' }, cls: 'h-1 w-1 bg-[#7A3CFF]/40' },
  { style: { left: '90%', top: '58%' }, cls: 'h-1.5 w-1.5 bg-[#FF5B00]/35 shadow-[0_0_10px_2px_rgba(255,91,0,0.18)]' },
  { style: { left: '74%', top: '80%' }, cls: 'h-1 w-1 bg-[#EF3C23]/35' },
  { style: { left: '46%', top: '10%' }, cls: 'h-1 w-1 bg-white/[0.14]' },
];

/** Visual grouping only — no field, name, handler or payload change. */
function FormSection({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={first ? '' : 'mt-7 border-t border-[#EEF0F4] pt-7'}>
      <h3 className="mb-3.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Left-panel partner context — adapts to the existing `applicantType` UI state only. */
function ContextRow({
  active,
  label,
  body,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`flex gap-3 border-l-2 pl-3.5 ${active ? 'border-[#FF5B00]' : 'border-white/10'}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#FF5B00]' : 'text-white/30'}`} />
      <div>
        <div className={`text-[11.5px] font-bold ${active ? 'text-white/85' : 'text-white/40'}`}>
          {label}
        </div>
        <div className={`text-[10.5px] leading-relaxed ${active ? 'text-white/55' : 'text-white/30'}`}>
          {body}
        </div>
      </div>
    </div>
  );
}

/**
 * Unified Partner Application page — Seller/Brand + Creator.
 * Visual system: dashboard auth family (choosify-dark-surface, btn-brand-gradient, login inputs).
 * Submitting creates a restricted Seller/Creator account immediately.
 * Admin later verifies identity and enables Marketplace Access (no self-grant).
 */
export default function SellerSignupPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';
  const typeParam = searchParams.get('type')?.trim().toLowerCase();

  const { applyAsPartner, categories } = useAuth();
  const navigate = useNavigate();

  const [applicantType, setApplicantType] = useState<ApplicantType>(
    typeParam === 'creator' ? 'creator' : 'seller',
  );
  const [businessOrChannelName, setBusinessOrChannelName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [niche, setNiche] = useState('');
  const [contentFocus, setContentFocus] = useState('');
  const [socialPrimary, setSocialPrimary] = useState('');
  const [audienceSize, setAudienceSize] = useState('');
  const [notes, setNotes] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const source = (categories?.length ? categories : getCanonicalAdminCategories()).filter(
      (row) => row.enabled !== false && (row.parentId == null || row.parentId === ''),
    );
    return [...source].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
    );
  }, [categories]);

  const loginHref = `/login${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!businessOrChannelName.trim()) {
      setError(
        applicantType === 'creator'
          ? 'Please enter your channel or creator name.'
          : 'Please enter your business or brand name.',
      );
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }
    const digits = phoneLocal.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!category.trim()) {
      setError(
        applicantType === 'creator'
          ? 'Please select your primary content category.'
          : 'Please select a business category.',
      );
      return;
    }
    if (!city.trim()) {
      setError('Please enter your city.');
      return;
    }
    if (applicantType === 'creator' && !niche.trim()) {
      setError('Please describe your niche or content focus.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await applyAsPartner({
        applicantType,
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        phone: `+880${digits.replace(/^0+/, '')}`,
        businessOrChannelName: businessOrChannelName.trim(),
        category: category.trim(),
        city: city.trim(),
        website: website.trim() || undefined,
        niche: applicantType === 'creator' ? niche.trim() : undefined,
        contentFocus: applicantType === 'creator' ? contentFocus.trim() || undefined : undefined,
        socialPrimary: applicantType === 'creator' ? socialPrimary.trim() || undefined : undefined,
        audienceSize: applicantType === 'creator' ? audienceSize.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      setInfo(
        result.message ||
          'Application received. You can sign in now. Marketplace features stay locked until Admin verifies your identity and enables Marketplace Access.',
      );
      window.setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }, 2200);
    } catch (err) {
      const e = err as Error & { code?: string; loginPath?: string };
      if (e.code === 'PARTNER_EXISTS' || e.code === 'SELLER_EXISTS') {
        setError(e.message || 'An account already exists for this email. Sign in instead.');
      } else if (e.code === 'APPLICATION_PENDING') {
        setError(e.message || 'A pending application already exists for this email.');
      } else {
        setError(e.message || 'Unable to submit partner application.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldLabel = 'block text-[10px] font-extrabold text-[#6B7280] tracking-wide mb-1.5';
  const fieldWrap =
    'flex items-center gap-2 bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-[14px]';
  const fieldInput =
    'flex-1 bg-transparent border-0 outline-none text-[13px] font-semibold text-[#111827] placeholder:text-[#9CA3AF]';
  const selectClass =
    'w-full bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 h-11 mb-[14px] text-[13px] font-semibold text-[#111827] outline-none';
  const col2 = 'grid gap-x-4 lg:grid-cols-2';

  const isCreator = applicantType === 'creator';
  const accentLine = isCreator ? 'Create, guide and inspire.' : 'Grow your brand on Choosify.';

  return (
    <div
      className="choosify-dark-surface relative min-h-screen w-full"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* ── Partnership / growth atmosphere (decorative, viewport-anchored) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Ambient blooms — purple depth + warm growth glow. Navy stays dominant. */}
        <div className="absolute -left-[10%] -top-[12%] h-[600px] w-[600px] rounded-full bg-[#7A3CFF]/12 blur-[170px]" />
        <div className="absolute -right-[8%] -bottom-[10%] h-[620px] w-[620px] rounded-full bg-[#FF5B00]/10 blur-[160px]" />
        <div className="absolute left-1/2 top-1/3 hidden h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-[#7A3CFF]/[0.08] blur-[180px] sm:block" />
        <div className="absolute right-[12%] top-[68%] hidden h-[300px] w-[300px] rounded-full bg-[#EF3C23]/[0.07] blur-[130px] sm:block" />

        {/* Peripheral grid — felt, not read (large desktop only) */}
        <div className="auth-partner-grid absolute inset-0 hidden opacity-70 xl:block" />

        {/* Faint ecosystem / connection geometry — full composition only */}
        <svg
          className="absolute inset-0 hidden h-full w-full min-[1600px]:block"
          viewBox="0 0 1920 1080"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="1620" cy="470" r="120" stroke="rgba(255,255,255,0.05)" />
          <circle cx="1620" cy="470" r="210" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 8" />
          <path d="M1500 210 C1640 300 1700 380 1620 470" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M1620 470 C1560 640 1640 800 1500 900" stroke="rgba(255,255,255,0.045)" strokeWidth="1" strokeDasharray="2 7" />
          <path d="M150 300 C320 260 380 420 300 520" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 7" />
          <g fill="rgba(255,255,255,0.13)">
            <circle cx="1500" cy="210" r="2.5" />
            <circle cx="1620" cy="470" r="2.5" />
            <circle cx="1500" cy="900" r="2.5" />
            <circle cx="150" cy="300" r="2" />
            <circle cx="300" cy="520" r="2" />
          </g>
        </svg>

        {/* Tiny connection nodes */}
        {PARTNER_NODES.map((n, i) => (
          <span key={i} className={`absolute hidden rounded-full xl:block ${n.cls}`} style={n.style} />
        ))}

        {/* Soft vignette — pulls the eye inward */}
        <div className="auth-partner-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full justify-center px-5 py-10 sm:px-6 lg:py-16">
        <div
          className="my-auto grid w-full max-w-[1180px] rounded-[16px] border border-white/12 lg:grid-cols-[38fr_62fr]"
          style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}
        >
          {/* ── Left contextual panel (sticky on large desktop) ── */}
          <div className="choosify-dark-surface rounded-t-[16px] lg:rounded-t-none lg:rounded-l-[16px] lg:border-r lg:border-white/10">
            <div className="flex flex-col p-9 sm:p-10 md:p-12 lg:sticky lg:top-16">
              <ChoosifyLogo
                variant="full"
                theme="dark"
                className="mb-10 h-10 w-auto max-w-[200px] select-none"
              />
              <span className="mb-4 inline-block w-max rounded-full bg-[rgba(255,90,44,0.14)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B00]">
                Partner Program
              </span>
              <h1
                className="mb-3 text-[27px] font-extrabold leading-tight text-white sm:text-[29px]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Partner with
                <br />
                Choosify Bangladesh.
              </h1>
              <p className="mb-4 text-[12.5px] font-bold leading-relaxed text-[#FF5B00]/90">
                {accentLine}
              </p>
              <p className="max-w-[340px] text-[13px] font-semibold leading-relaxed text-white/55">
                Apply as a Seller/Brand or Creator. Access is granted only after Admin review —
                submitting this form does not activate partner tools.
              </p>

              {/* Partner context + process — full on large desktop, simplified below */}
              <div className="hidden lg:block">
                {/* Partner context — mirrors the selected application type */}
                <div className="mt-8 space-y-3.5">
                  <ContextRow
                    active={!isCreator}
                    icon={Store}
                    label="Seller / Brand"
                    body="Sell and manage your products through the Choosify ecosystem."
                  />
                  <ContextRow
                    active={isCreator}
                    icon={Sparkles}
                    label="Creator"
                    body="Build your creator profile and publish product discovery content."
                  />
                </div>

                {/* Application process — explanatory, non-interactive */}
                <ol className="mt-9 space-y-4">
                  {PROCESS_STEPS.map((s) => (
                    <li key={s.n} className="flex gap-3.5">
                      <span className="mt-px font-mono text-[11px] font-bold text-[#FF5B00]">{s.n}</span>
                      <div>
                        <div className="text-[12px] font-bold text-white/80">{s.title}</div>
                        <div className="text-[11px] text-white/45">{s.body}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-8 text-[10.5px] font-semibold text-white/30 lg:mt-10">
                © 2026 CHOOSIFY BANGLADESH LTD.
              </div>
            </div>
          </div>

          {/* ── Right application panel — page scrolls naturally, no nested scrollbar ── */}
          <div className="rounded-b-[16px] bg-white p-7 sm:p-8 md:p-10 lg:rounded-b-none lg:rounded-r-[16px] lg:p-12">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Link
                to={loginHref}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
              <span className="text-[12.5px] font-bold text-[#6B7280]">Partner application</span>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)}>
              <FormSection title="Account type" first>
                <label className={fieldLabel}>APPLY AS</label>
                <select
                  value={applicantType}
                  onChange={(e) => setApplicantType(e.target.value as ApplicantType)}
                  className={selectClass}
                  required
                >
                  <option value="seller">Seller / Brand</option>
                  <option value="creator">Creator</option>
                </select>
              </FormSection>

              <FormSection title={isCreator ? 'Creator identity' : 'Business identity'}>
                <label className={fieldLabel}>
                  {isCreator ? 'CHANNEL / CREATOR NAME' : 'BUSINESS / BRAND NAME'}
                </label>
                <div className={fieldWrap}>
                  <input
                    className={fieldInput}
                    required
                    value={businessOrChannelName}
                    onChange={(e) => setBusinessOrChannelName(e.target.value)}
                    placeholder={isCreator ? 'Your channel name' : 'Your store or brand'}
                  />
                </div>

                <div className={col2}>
                  <div>
                    <label className={fieldLabel}>YOUR FULL NAME</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>PHONE (BD)</label>
                    <div className={fieldWrap}>
                      <span className="shrink-0 text-[12px] font-bold text-[#6B7280]">+880</span>
                      <input
                        className={fieldInput}
                        required
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        placeholder="1XXXXXXXXX"
                        inputMode="tel"
                      />
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Account &amp; contact">
                <label className={fieldLabel}>EMAIL ADDRESS</label>
                <div className={fieldWrap}>
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.bd"
                    className={fieldInput}
                    autoComplete="email"
                  />
                </div>

                <label className={fieldLabel}>PASSWORD</label>
                <div className={fieldWrap}>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${fieldInput} font-bold tracking-[2px] placeholder:tracking-[2px]`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="shrink-0 rounded-md p-1 text-[#9CA3AF] hover:bg-black/5 hover:text-[#374151]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormSection>

              <FormSection title={isCreator ? 'Content details' : 'Business details'}>
                <div className={col2}>
                  <div>
                    <label className={fieldLabel}>
                      {isCreator ? 'PRIMARY CATEGORY' : 'BUSINESS CATEGORY'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>CITY</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Dhaka"
                      />
                    </div>
                  </div>
                </div>

                {!isCreator ? (
                  <>
                    <label className={fieldLabel}>WEBSITE (OPTIONAL)</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className={fieldLabel}>NICHE / CONTENT FOCUS</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        required
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        placeholder="e.g. Beauty reviews, travel vlogs"
                      />
                    </div>

                    <div className={col2}>
                      <div>
                        <label className={fieldLabel}>CONTENT STYLE (OPTIONAL)</label>
                        <div className={fieldWrap}>
                          <input
                            className={fieldInput}
                            value={contentFocus}
                            onChange={(e) => setContentFocus(e.target.value)}
                            placeholder="Short-form, long-form, live…"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={fieldLabel}>AUDIENCE SIZE (OPTIONAL)</label>
                        <div className={fieldWrap}>
                          <input
                            className={fieldInput}
                            value={audienceSize}
                            onChange={(e) => setAudienceSize(e.target.value)}
                            placeholder="e.g. 10K–50K"
                          />
                        </div>
                      </div>
                    </div>

                    <label className={fieldLabel}>PRIMARY SOCIAL LINK (OPTIONAL)</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        value={socialPrimary}
                        onChange={(e) => setSocialPrimary(e.target.value)}
                        placeholder="Instagram / YouTube / TikTok URL"
                      />
                    </div>

                    <label className={fieldLabel}>WEBSITE / PORTFOLIO (OPTIONAL)</label>
                    <div className={fieldWrap}>
                      <input
                        className={fieldInput}
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  </>
                )}
              </FormSection>

              <FormSection title="Application details">
                <label className={fieldLabel}>NOTES FOR REVIEW (OPTIONAL)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything Admin should know"
                  className="mb-[14px] w-full resize-none rounded-lg border border-[#E8EDF2] bg-[#F8F9FC] px-3.5 py-2.5 text-[13px] font-semibold text-[#111827] outline-none"
                />
              </FormSection>

              <FormSection title="Submission">
                <label className="mb-4 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-[#FF5B00]"
                  />
                  <span className="text-[11px] font-semibold leading-relaxed text-[#6B7280]">
                    I agree to the{' '}
                    <a
                      href={STOREFRONT_TERMS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#FF5B00] hover:text-[#FF5B00]"
                    >
                      Terms of Service
                    </a>{' '}
                    and understand my application requires Admin approval.
                  </span>
                </label>

                {error && (
                  <div className="mb-[14px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="mb-[14px] rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] text-emerald-800">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-brand-gradient flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] font-extrabold text-white disabled:opacity-70"
                >
                  {submitting ? 'Submitting…' : 'Submit Partner Application'}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </FormSection>
            </form>

            <p className="mt-5 text-center text-[11px] font-semibold text-[#6B7280]">
              Already have an account?{' '}
              <Link to={loginHref} className="font-bold text-[#FF5B00] hover:text-[#FF5B00]">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
