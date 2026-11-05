/**
 * Website Studio → Pages → Storefront pages: the editable words on the listing pages
 * (Categories, Products & Services, Brands, Recommendations, Deals, Creators, Compare).
 *
 * Small on purpose: the pages keep their design, filters and tabs (tab names drive filtering,
 * so they stay in code). Each page only carries the fields it actually shows. A copy of this file
 * lives in Choosify-Web src/lib/cmsListingPages.ts — keep the two in step.
 */

export type ListingPageKey = 'categories' | 'products' | 'brands' | 'recommendations' | 'deals' | 'creators' | 'compare';

export type ListingCta = { show: boolean; heading: string; text: string; buttonLabel: string; buttonHref: string };

export type ListingPageContent = {
  /** Small label above the list heading. */
  eyebrow?: string;
  /** Optional line under the heading (empty = not shown). */
  intro: string;
  /** Title of the filter panel. */
  filterTitle?: string;
  /** Title of the "Quick Specs" box in the filter panel. */
  quickSpecsTitle?: string;
  /** Optional call-to-action strip under the list. */
  ctaStrip: ListingCta;
};

export type ListingPageDef = { key: ListingPageKey; docKey: string; label: string; path: string };

export const LISTING_PAGES: ListingPageDef[] = [
  { key: 'categories', docKey: 'page:listing-categories', label: 'Categories', path: '/categories' },
  { key: 'products', docKey: 'page:listing-products', label: 'Products & Services', path: '/products' },
  { key: 'brands', docKey: 'page:listing-brands', label: 'Brands', path: '/brands' },
  { key: 'recommendations', docKey: 'page:listing-recommendations', label: 'Recommendations', path: '/spotlight' },
  { key: 'deals', docKey: 'page:listing-deals', label: 'Deals', path: '/deals' },
  { key: 'creators', docKey: 'page:listing-creators', label: 'Creators', path: '/creators' },
  { key: 'compare', docKey: 'page:listing-compare', label: 'Compare', path: '/compare' },
];

export const listingPageByDocKey = (docKey: string) => LISTING_PAGES.find((p) => p.docKey === docKey);

const noCta = (): ListingCta => ({ show: false, heading: '', text: '', buttonLabel: '', buttonHref: '' });

const DEFAULTS: Record<ListingPageKey, ListingPageContent> = {
  categories: { eyebrow: 'Shop by • Categories', intro: '', filterTitle: 'Category Discovery', ctaStrip: noCta() },
  products: { eyebrow: 'Catalog • Products', intro: '', filterTitle: 'Filter Catalog', quickSpecsTitle: 'Products Quick Specs', ctaStrip: noCta() },
  brands: { eyebrow: 'Our partners • Brands', intro: '', filterTitle: 'Filter Brands', quickSpecsTitle: 'Brands Quick Specs', ctaStrip: noCta() },
  recommendations: { eyebrow: 'Spotlight • Discover', intro: '', ctaStrip: noCta() },
  deals: { eyebrow: 'Savings • Deals', intro: '', filterTitle: 'Filter Deals', quickSpecsTitle: 'Deals Quick Specs', ctaStrip: noCta() },
  creators: { eyebrow: 'Our partners • Creator directory', intro: '', filterTitle: 'Filter Creators', ctaStrip: noCta() },
  compare: { intro: '', ctaStrip: noCta() },
};

export function defaultListingPage(key: ListingPageKey): ListingPageContent {
  return JSON.parse(JSON.stringify(DEFAULTS[key])) as ListingPageContent;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, max) : null);

/** Only the page's own fields, plain text, filled from the defaults (never blanks a page). */
export function normalizeListingPage(key: ListingPageKey, raw: unknown): ListingPageContent {
  const d = defaultListingPage(key);
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: ListingPageContent = { ...d };
  for (const k of ['eyebrow', 'filterTitle', 'quickSpecsTitle'] as const) {
    if (k in d) {
      const v = str(r[k], 80);
      (out as Record<string, unknown>)[k] = v !== null && v.trim() ? v : d[k];
    }
  }
  out.intro = str(r.intro, 400) ?? '';
  const c = (r.ctaStrip && typeof r.ctaStrip === 'object' ? r.ctaStrip : {}) as Record<string, unknown>;
  out.ctaStrip = {
    show: c.show === true,
    heading: str(c.heading, 120) ?? '',
    text: str(c.text, 240) ?? '',
    buttonLabel: str(c.buttonLabel, 40) ?? '',
    buttonHref: (str(c.buttonHref, 300) ?? '').trim(),
  };
  return out;
}
