/**
 * Website Studio page documents for the storefront's information + legal pages.
 *
 * The content model (types / defaults / normalize) is a copy of Choosify-Web
 * src/lib/cmsSitePages — the storefront renders these pages from exactly this structure and
 * fills anything missing from the same defaults, so a page can never be blanked by the CMS.
 * Keep the two copies in step when a page gains a field.
 */
import { defaultSitePages } from './defaults';
import { normalizeSitePages } from './normalize';
import type { SitePageKey, SitePagesConfig } from './types';

export * from './types';
export { defaultSitePages } from './defaults';
export { normalizeSitePages } from './normalize';

export type SystemSitePage = {
  /** Website Studio document key. */
  docKey: string;
  /** Key in the storefront's SitePagesConfig. */
  pageKey: SitePageKey;
  label: string;
  path: string;
  group: 'info' | 'legal';
};

export const SYSTEM_SITE_PAGES: SystemSitePage[] = [
  { docKey: 'page:about', pageKey: 'about', label: 'About', path: '/about', group: 'info' },
  { docKey: 'page:contact', pageKey: 'contact', label: 'Contact', path: '/contact', group: 'info' },
  { docKey: 'page:suggest-brand', pageKey: 'suggestBrand', label: 'Suggest a Brand', path: '/suggest-brand', group: 'info' },
  { docKey: 'page:partnership', pageKey: 'partnership', label: 'Partnership', path: '/partnership', group: 'info' },
  { docKey: 'page:advertise', pageKey: 'advertise', label: 'Advertise', path: '/advertise', group: 'info' },
  { docKey: 'legal:terms', pageKey: 'terms', label: 'Terms of Service', path: '/terms', group: 'legal' },
  { docKey: 'legal:privacy', pageKey: 'privacy', label: 'Privacy Policy', path: '/privacy', group: 'legal' },
];

export const sitePageByDocKey = (docKey: string): SystemSitePage | undefined => SYSTEM_SITE_PAGES.find((p) => p.docKey === docKey);

export function defaultsForSitePage(pageKey: SitePageKey): unknown {
  return structuredClone(defaultSitePages()[pageKey]);
}

/** Complete, normalised content for one page (missing fields filled from the defaults). */
export function normalizeSitePage(pageKey: SitePageKey, raw: unknown): SitePagesConfig[SitePageKey] {
  return normalizeSitePages({ [pageKey]: raw } as Record<string, unknown>)[pageKey];
}

const LINK_KEY = /(href|url)$/i;

/**
 * Links / image addresses inside a page must be safe: an internal path (/…), an in-page anchor
 * (#…), mailto:, tel:, or an https:// address. Returns the first problem, or null.
 */
export function firstUnsafeLink(value: unknown, path = ''): { path: string; value: string } | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = firstUnsafeLink(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (LINK_KEY.test(k) && typeof v === 'string' && v.trim()) {
        const s = v.trim();
        const ok = (s.startsWith('/') && !s.startsWith('//')) || s.startsWith('#') || /^mailto:[^\s]+$/i.test(s) || /^tel:[+\d\s()-]+$/i.test(s) || /^https:\/\/[^\s]+$/i.test(s);
        if (!ok) return { path: p, value: s };
      } else {
        const hit = firstUnsafeLink(v, p);
        if (hit) return hit;
      }
    }
  }
  return null;
}
