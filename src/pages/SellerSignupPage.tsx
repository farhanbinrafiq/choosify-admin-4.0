import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  LayoutDashboard,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCanonicalAdminCategories } from '../lib/storefrontCategories';

const PAGE_BG = '#000435';
const PRIMARY = '#EB4501';
const STOREFRONT_TERMS_URL = 'https://choosify.bd/terms';

const BENEFITS = [
  {
    icon: Users,
    title: 'Reach 2M+ shoppers',
    description: "Tap into Bangladesh's fastest-growing discovery platform.",
  },
  {
    icon: BadgeCheck,
    title: 'Verified badge',
    description: 'Build trust instantly with a verified-seller mark on your storefront.',
  },
  {
    icon: Wallet,
    title: 'Fast payouts',
    description: 'Get paid weekly with transparent, low commission rates.',
  },
  {
    icon: LayoutDashboard,
    title: 'Seller dashboard',
    description: 'Track orders, reviews and performance in one place.',
  },
] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      required={required}
      value={value}
      autoComplete={autoComplete}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#9AA0AC] focus:border-[#EB4501]"
    />
  );
}

export default function SellerSignupPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';

  const { registerSeller, categories } = useAuth();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const source = (categories?.length ? categories : getCanonicalAdminCategories()).filter(
      (row) => row.enabled !== false && (row.parentId == null || row.parentId === ''),
    );
    return [...source].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name));
  }, [categories]);

  const loginHref = `/login?email=${encodeURIComponent(email.trim())}&role=seller`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!storeName.trim()) {
      setError('Please enter your business or brand name.');
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
      setError('Please enter a valid business email.');
      return;
    }
    if (!category.trim()) {
      setError('Please select a category.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter your city.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Seller Terms to continue.');
      return;
    }

    const phone = `+880${digits.replace(/^880/, '').replace(/^0+/, '')}`;

    setSubmitting(true);
    try {
      const result = await registerSeller({
        email,
        displayName,
        storeName,
        phone,
        category,
        city,
        website: website.trim() || undefined,
      });
      navigate(result.dashboardPath || '/seller/products', { replace: true });
    } catch (err) {
      const typed = err as Error & { code?: string; loginPath?: string };
      if (typed.code === 'SELLER_EXISTS' || typed.code === 'EMAIL_EXISTS') {
        setError(typed.message || 'An account already exists for this email.');
      } else {
        setError(typed.message || 'Unable to submit your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-sans relative overflow-hidden" style={{ background: PAGE_BG }}>
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/35"
        aria-hidden
      />

      <div className="relative z-[2] flex flex-col min-h-screen">
        <div className="flex justify-between items-center px-6 sm:px-10 py-6">
          <a
            href="https://choosify.bd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] text-white/60 hover:text-white/85 transition-colors"
          >
            ← Visit choosify.bd
          </a>
          <Link to={loginHref} className="text-[12.5px] text-white/60 hover:text-white/85 transition-colors">
            Already a seller? Sign in
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-5">
          <div className="flex flex-col lg:flex-row w-full max-w-[920px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            {/* Left marketing panel — flush dark surface */}
            <div
              className="flex-1 min-w-0 p-7 sm:p-9"
              style={{
                background: `linear-gradient(160deg, ${PAGE_BG} 0%, #0A0A2A 55%, #1A1030 100%)`,
              }}
            >
              <div
                className="inline-block text-[11px] font-bold px-3.5 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(255,90,44,0.15)', color: PRIMARY }}
              >
                BECOME A SELLER
              </div>
              <h1 className="text-[28px] sm:text-[34px] font-extrabold text-white leading-[1.2] mb-[18px]">
                Sell your brand to{' '}
                <span style={{ color: PRIMARY }}>millions</span> of shoppers
              </h1>
              <p className="text-[13.5px] text-white/55 leading-[1.7] m-0 mb-7">
                Join Choosify&apos;s verified seller network and get your products in front of
                Bangladesh&apos;s most engaged shoppers.
              </p>
              <ul className="space-y-4 list-none p-0 m-0">
                {BENEFITS.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(235, 69, 1, 0.16)' }}
                    >
                      <item.icon size={16} color={PRIMARY} strokeWidth={2.4} />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-bold text-white leading-tight">{item.title}</div>
                      <div className="text-[12.5px] text-white/55 leading-snug mt-0.5">{item.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right apply form — white, no gap between panels */}
            <div className="bg-white p-7 sm:p-9 w-full lg:w-[440px] lg:shrink-0">
              <h2 className="text-[22px] font-extrabold text-[#1A1A2E] mb-1">Apply to sell</h2>
              <p className="text-[12.5px] text-[#9AA0AC] mb-5">
                Tell us about your business to get started
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <FieldLabel>Business / brand name</FieldLabel>
                  <TextInput
                    id="store-name"
                    value={storeName}
                    onChange={setStoreName}
                    placeholder="e.g. Walton Digi-Tech"
                    required
                    autoComplete="organization"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Your name</FieldLabel>
                    <TextInput
                      id="display-name"
                      value={displayName}
                      onChange={setDisplayName}
                      placeholder="Your full name"
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <FieldLabel>Phone</FieldLabel>
                    <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden focus-within:border-[#EB4501]">
                      <span className="px-3 py-2.5 text-[13px] font-semibold text-[#6B7280] bg-[#F8FAFC] border-r border-[#E5E7EB] select-none">
                        +880
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        required
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ''))}
                        placeholder="1XXXXXXXXX"
                        autoComplete="tel-national"
                        className="w-full px-3 py-2.5 text-[13px] text-[#1A1A2E] outline-none placeholder:text-[#9AA0AC]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>Business email</FieldLabel>
                  <TextInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@brand.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select
                      id="category"
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13px] text-[#1A1A2E] outline-none transition-colors focus:border-[#EB4501]"
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((row) => (
                        <option key={row.id} value={row.name}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>City</FieldLabel>
                    <TextInput
                      id="city"
                      value={city}
                      onChange={setCity}
                      placeholder="Dhaka"
                      required
                      autoComplete="address-level2"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>
                    Website / social link <span className="normal-case font-medium text-[#9AA0AC]">(optional)</span>
                  </FieldLabel>
                  <TextInput
                    id="website"
                    value={website}
                    onChange={setWebsite}
                    placeholder="https://"
                    autoComplete="url"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded accent-[#EB4501] shrink-0"
                  />
                  <span className="text-[12px] text-[#4B5563] leading-snug">
                    I agree to Choosify&apos;s Seller{' '}
                    <a
                      href={STOREFRONT_TERMS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#EB4501] hover:underline"
                    >
                      Terms
                    </a>{' '}
                    and confirm the information above is accurate.
                  </span>
                </label>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
                    {error}
                    {(error.toLowerCase().includes('already') || error.toLowerCase().includes('sign in')) && (
                      <div className="mt-1.5">
                        <Link to={loginHref} className="font-bold text-[#EB4501] hover:underline">
                          Go to seller login →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-lg text-[13px] font-bold text-white border-none cursor-pointer active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: PRIMARY }}
                >
                  {submitting ? 'Submitting…' : 'Submit application'}
                  {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
