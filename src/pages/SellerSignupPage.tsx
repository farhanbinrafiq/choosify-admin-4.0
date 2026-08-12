import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';
import { getCanonicalAdminCategories } from '../lib/storefrontCategories';

const STOREFRONT_TERMS_URL = 'https://choosify.bd/terms';

type ApplicantType = 'seller' | 'creator';

/**
 * Unified Partner Application page — Seller/Brand + Creator.
 * Visual system: exact dashboard login tokens (choosify-dark-surface, btn-brand-gradient, login inputs).
 * Submitting requests a role only — Admin approval provisions access (no self-grant).
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
          'Application received. Choosify Admin will review your request. You cannot access partner tools until approved.',
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

  return (
    <div
      className="choosify-dark-surface min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div
        className="relative w-full max-w-[920px] flex flex-col md:flex-row rounded-2xl overflow-hidden border border-white/12"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}
      >
        <div className="choosify-dark-surface flex-1 flex flex-col justify-between min-h-[280px] md:min-h-[560px] p-10 md:p-12 border-r border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <ChoosifyLogo variant="full" theme="dark" className="h-10 w-auto max-w-[200px] select-none" />
            </div>
            <h1
              className="text-[28px] font-extrabold text-white leading-tight mb-4"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Partner with
              <br />
              Choosify Bangladesh.
            </h1>
            <p className="text-[13px] font-semibold leading-relaxed max-w-[320px] text-white/55">
              Apply as a Seller/Brand or Creator. Access is granted only after Admin review —
              submitting this form does not activate partner tools.
            </p>
          </div>
          <div className="text-[10.5px] font-semibold text-white/30 mt-10 md:mt-0">
            © 2026 CHOOSIFY BANGLADESH LTD.
          </div>
        </div>

        <div className="flex-1 bg-white flex flex-col justify-start min-h-[420px] md:min-h-[560px] max-h-[90vh] overflow-y-auto p-8 md:p-10">
          <p className="text-[12.5px] font-bold text-[#6B7280] mb-5 shrink-0">Partner application</p>

          <form onSubmit={(e) => void handleSubmit(e)}>
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

            <label className={fieldLabel}>
              {applicantType === 'creator' ? 'CHANNEL / CREATOR NAME' : 'BUSINESS / BRAND NAME'}
            </label>
            <div className={fieldWrap}>
              <input
                className={fieldInput}
                required
                value={businessOrChannelName}
                onChange={(e) => setBusinessOrChannelName(e.target.value)}
                placeholder={applicantType === 'creator' ? 'Your channel name' : 'Your store or brand'}
              />
            </div>

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

            <label className={fieldLabel}>EMAIL ADDRESS</label>
            <div className={fieldWrap}>
              <Mail className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
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
              <Lock className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
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
                className="shrink-0 p-1 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-black/5"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <label className={fieldLabel}>PHONE (BD)</label>
            <div className={fieldWrap}>
              <span className="text-[12px] font-bold text-[#6B7280] shrink-0">+880</span>
              <input
                className={fieldInput}
                required
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value)}
                placeholder="1XXXXXXXXX"
                inputMode="tel"
              />
            </div>

            <label className={fieldLabel}>
              {applicantType === 'creator' ? 'PRIMARY CATEGORY' : 'BUSINESS CATEGORY'}
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

            {applicantType === 'seller' ? (
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
                <label className={fieldLabel}>CONTENT STYLE (OPTIONAL)</label>
                <div className={fieldWrap}>
                  <input
                    className={fieldInput}
                    value={contentFocus}
                    onChange={(e) => setContentFocus(e.target.value)}
                    placeholder="Short-form, long-form, live shopping…"
                  />
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
                <label className={fieldLabel}>AUDIENCE SIZE (OPTIONAL)</label>
                <div className={fieldWrap}>
                  <input
                    className={fieldInput}
                    value={audienceSize}
                    onChange={(e) => setAudienceSize(e.target.value)}
                    placeholder="e.g. 10K–50K"
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

            <label className={fieldLabel}>NOTES FOR REVIEW (OPTIONAL)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything Admin should know"
              className="w-full bg-[#F8F9FC] border border-[#E8EDF2] rounded-lg px-3.5 py-2.5 mb-[14px] text-[13px] font-semibold text-[#111827] outline-none resize-none"
            />

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-[#FF5B00]"
              />
              <span className="text-[11px] font-semibold text-[#6B7280] leading-relaxed">
                I agree to the{' '}
                <a
                  href={STOREFRONT_TERMS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#FF5B00] font-bold hover:text-[#E64A00]"
                >
                  Terms of Service
                </a>{' '}
                and understand my application requires Admin approval.
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 mb-[14px]">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] text-emerald-800 mb-[14px]">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-brand-gradient w-full h-[46px] rounded-[9px] text-[13.5px] font-extrabold text-white flex items-center justify-center gap-1.5 disabled:opacity-70"
            >
              {submitting ? 'Submitting…' : 'Submit Partner Application'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-[11px] font-semibold text-[#6B7280] mt-5">
            Already have an account?{' '}
            <Link to={loginHref} className="text-[#FF5B00] font-bold hover:text-[#E64A00]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
