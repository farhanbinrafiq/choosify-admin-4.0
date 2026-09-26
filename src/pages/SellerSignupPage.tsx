import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
import { AdminAuthShell, AdminAuthTrustRow } from '../components/auth/AdminAuthShell';
import { getCanonicalAdminCategories } from '../lib/storefrontCategories';

const STOREFRONT_TERMS_URL = 'https://choosify.bd/terms';

type ApplicantType = 'seller' | 'creator';

/** Non-interactive explanation of the real (Admin-gated) application lifecycle. */
const PROCESS_STEPS = [
  { n: '01', title: 'Apply', body: 'Submit your information' },
  { n: '02', title: 'Review', body: 'Choosify reviews your application' },
  { n: '03', title: 'Access', body: 'Approved partners receive access' },
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
    <div className={`flex gap-3 border-l-2 pl-3.5 ${active ? 'border-[#FF5B00]' : 'border-[#E8EDF2]'}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#FF5B00]' : 'text-[#C4CAD3]'}`} />
      <div>
        <div className={`text-[11.5px] font-bold ${active ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}>
          {label}
        </div>
        <div className={`text-[10.5px] leading-relaxed ${active ? 'text-[#6B7280]' : 'text-[#B8BEC7]'}`}>
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    if (!confirmPassword) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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

  // Inline hint only — never blocks typing, and only appears once the user has
  // actually started the confirm field, so it doesn't nag while they're still
  // typing the first password. Submission is separately blocked in handleSubmit.
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const isCreator = applicantType === 'creator';
  const accentLine = isCreator ? 'Create, guide and inspire.' : 'Grow your brand on Choosify.';

  const leftContent = (
    <>
      <div className="mb-8">
        <ChoosifyLogo variant="full" theme="light" className="h-9 w-auto max-w-[190px] select-none" />
      </div>
      <span className="mb-4 inline-block w-max rounded-full bg-[rgba(255,90,44,0.1)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B00]">
        Partner Program
      </span>
      <h1
        className="mb-3 text-[27px] font-extrabold leading-tight text-[#111827] sm:text-[29px]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Partner with
        <br />
        Choosify Bangladesh.
      </h1>
      <p className="mb-2 text-[12.5px] font-bold leading-relaxed text-[#FF5B00]">{accentLine}</p>
      <p className="mb-7 max-w-[380px] text-[13px] font-semibold leading-relaxed text-[#6B7280]">
        Apply as a Seller/Brand or Creator. Access is granted only after Admin review — submitting
        this form does not activate partner tools.
      </p>

      {/* Partner context — mirrors the selected application type */}
      <div className="mb-7 space-y-3.5">
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
      <ol className="mb-2 space-y-4">
        {PROCESS_STEPS.map((s) => (
          <li key={s.n} className="flex gap-3.5">
            <span className="mt-px font-mono text-[11px] font-bold text-[#FF5B00]">{s.n}</span>
            <div>
              <div className="text-[12px] font-bold text-[#111827]">{s.title}</div>
              <div className="text-[11px] text-[#9CA3AF]">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <AdminAuthTrustRow />

      <div className="mt-8 text-[10.5px] font-semibold text-[#9CA3AF]">© 2026 CHOOSIFY BANGLADESH LTD.</div>
    </>
  );

  return (
    <AdminAuthShell left={leftContent} cardMaxWidthClass="max-w-[720px]">
      <>
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

                <label className={fieldLabel}>CONFIRM PASSWORD</label>
                <div className={fieldWrap}>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${fieldInput} font-bold tracking-[2px] placeholder:tracking-[2px]`}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="shrink-0 rounded-md p-1 text-[#9CA3AF] hover:bg-black/5 hover:text-[#374151]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p className="-mt-2.5 mb-[14px] text-[11px] font-semibold text-red-600">
                    Passwords do not match.
                  </p>
                )}
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
      </>
    </AdminAuthShell>
  );
}
