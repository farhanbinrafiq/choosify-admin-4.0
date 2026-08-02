import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { EmiAiLogo } from '../components/EmiAiLogo';
import { useAuth } from '../contexts/AuthContext';

type NotFoundChip = {
  label: string;
  to: string;
};

/** Exact top-level names from Choosify-Web CATEGORIES_LIST — visual parity when CMS categories are empty */
const FALLBACK_CATEGORY_NAMES = [
  'Fashion & Lifestyle',
  'Jewelry & Accessories',
  'Eyewear & Fragrances',
  'Beauty & Personal Care',
  'Tech & Electronics',
  'Mobile & Wearable',
  'TV & Appliances',
  'Gaming & Entertainment',
  'Home & Living',
  'Vehicles & Automotive',
  'Family & Kids',
  'Food & Essentials',
  'Travel & Hospitality',
  'Hobbies & Creativity',
  'Health & Wellness',
  'Education & Learning',
] as const;

/** Same keyword filler terms as Choosify-Web buildPagePopularSearchTerms */
const FALLBACK_KEYWORD_TERMS = [
  'Samsung Galaxy',
  'Aarong Fashion',
  'iPhone 15',
  'Walton Fridge',
  'Apex Shoes',
  'Best Deals',
  'Electronics',
  'Fashion & Lifestyle',
  'Home Appliances',
  'Verified Brands',
] as const;

export type NotFoundPageProps = {
  /** `not-found` = classic 404; `error` = runtime crash using the same layout */
  variant?: 'not-found' | 'error';
  errorMessage?: string;
  onRetry?: () => void;
};

/**
 * Ported from Choosify-Web NotFoundPage — identical dark-surface / Emi layout.
 * Chip destinations map to CMS routes; labels match the storefront page.
 */
export default function NotFoundPage({
  variant = 'not-found',
  errorMessage,
  onRetry,
}: NotFoundPageProps = {}) {
  const { categories } = useAuth();
  const isError = variant === 'error';

  const chips = useMemo((): NotFoundChip[] => {
    const fromCms = [...(categories ?? [])]
      .filter((c) => !c.parentId && c.enabled !== false)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((c) => c.name)
      .filter(Boolean);

    const categoryNames = (fromCms.length ? fromCms : [...FALLBACK_CATEGORY_NAMES]).filter(Boolean);

    const categoryChips: NotFoundChip[] = categoryNames.slice(0, 12).map((name) => ({
      label: name,
      to: '/admin/categories',
    }));

    categoryChips.push({ label: 'More', to: '/admin/categories' });

    const categoryKeys = new Set(categoryNames.map((n) => n.toLowerCase()));
    const keywordChips: NotFoundChip[] = FALLBACK_KEYWORD_TERMS.filter(
      (term) => !categoryKeys.has(term.toLowerCase()),
    )
      .slice(0, 8)
      .map((term) => ({
        label: term,
        to: '/admin/products',
      }));

    return [...categoryChips, ...keywordChips];
  }, [categories]);

  return (
    <section
      className="w-full min-h-screen font-sans flex flex-col choosify-dark-surface text-white"
      aria-labelledby="not-found-heading"
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center px-5 pt-10 pb-8 sm:pt-14 sm:pb-10">
        <h1
          id="not-found-heading"
          className="text-[100px] sm:text-[150px] font-extrabold leading-none tracking-tight text-white"
        >
          {isError ? 'Oops' : '404'}
        </h1>

        <p className="mt-3 sm:mt-4 text-[15px] sm:text-base font-medium text-white/65">
          {isError
            ? 'Something went wrong while loading this page.'
            : 'Oops! We couldn\u2019t find that page.'}
        </p>

        {isError && errorMessage ? (
          <p className="mt-2 max-w-md text-[13px] font-medium text-[#FF5B00]/90">{errorMessage}</p>
        ) : null}

        <p className="mt-2 text-[15px] sm:text-base font-medium text-white/65">
          {isError && onRetry ? (
            <>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 text-[#FF5B00] font-semibold underline underline-offset-2 hover:opacity-90"
              >
                <RefreshCcw size={14} /> Refresh
              </button>
              {' or return '}
            </>
          ) : (
            'Return '
          )}
          <Link
            to="/"
            className="text-[#FF5B00] font-semibold underline underline-offset-2 hover:opacity-90"
          >
            Home
          </Link>
        </p>

        <div className="mt-8 sm:mt-10 flex items-center justify-center">
          <EmiAiLogo size={260} title="Emi. A.I" />
        </div>
      </div>

      <div className="w-full px-5 sm:px-8 lg:px-10 pt-6 pb-12 sm:pb-16 border-t border-white/10">
        <p className="text-center text-[13px] sm:text-sm font-medium text-white/55 mb-5 sm:mb-6">
          Why not check out our top categories instead?
        </p>

        <div className="flex flex-wrap gap-2.5 sm:gap-3 justify-start w-full">
          {chips.map((chip) => (
            <Link
              key={`${chip.to}-${chip.label}`}
              to={chip.to}
              className="inline-flex items-center text-white text-[12px] sm:text-[13px] font-semibold hover:bg-white/20 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '9px 18px',
              }}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
