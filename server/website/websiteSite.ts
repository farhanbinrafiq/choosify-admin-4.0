/**
 * Website Studio → storefront header/footer bridge (Phase 3).
 *
 * GET /catalog/site gains `websiteStudio`: the PUBLISHED Navigation, Footer, Social, Company and
 * Brand Assets documents (only those that have been published). The storefront uses each part
 * only when it is present, so nothing changes for shoppers until a document is published.
 * Company identifiers are passed through only when marked verified.
 */
import { getDocument, getPublished } from './websiteStore';
import { validateCompany, validateContent, type BrandAssets, type CompanySettings } from './websiteContent';
import type { FooterContent, NavigationContent, SocialContent } from './siteContent';
import { SYSTEM_SITE_PAGES, sitePageByDocKey } from '../../shared/website/sitePages';
import { normalizeCustomPage } from '../../shared/website/customPages';

export const SITE_DOCUMENT_KEYS = ['navigation', 'footer', 'social', 'company', 'brand_assets'] as const;
export type SiteDocumentKey = (typeof SITE_DOCUMENT_KEYS)[number];

export type PublicCompany = {
  displayName: string;
  supportEmail: string;
  supportPhone: string;
  offices: Array<{ id: string; label: string; lines: string[] }>;
  dbid: string;
  tradeLicense: string;
  copyrightHolder: string;
};

export type StorefrontSiteStudio = {
  /** Published information / legal pages, keyed like the storefront's SitePagesConfig. */
  sitePages?: Record<string, unknown>;
  /** Preview only: one custom page draft, keyed by slug. */
  customPages?: Record<string, unknown>;
  navigation?: NavigationContent;
  footer?: FooterContent;
  social?: SocialContent;
  company?: PublicCompany;
  brandAssets?: BrandAssets;
};

/** Only what the public footer may show: enabled offices, VERIFIED identifiers only. */
export function publicCompany(c: CompanySettings): PublicCompany {
  return {
    displayName: c.displayName,
    supportEmail: c.supportEmail,
    supportPhone: c.supportPhone,
    offices: c.offices.filter((o) => o.enabled).map(({ id, label, lines }) => ({ id, label, lines })),
    dbid: c.identifiers.dbid.verified ? c.identifiers.dbid.value : '',
    tradeLicense: c.identifiers.tradeLicense.verified ? c.identifiers.tradeLicense.value : '',
    copyrightHolder: c.copyrightText || c.displayName || 'Choosify',
  };
}

function toPart(key: SiteDocumentKey, content: unknown): Partial<StorefrontSiteStudio> {
  if (key === 'company') return { company: publicCompany(validateCompany(content)) };
  if (key === 'brand_assets') return { brandAssets: validateContent('brand_assets', content) as BrandAssets };
  if (key === 'navigation') return { navigation: validateContent('navigation', content) as NavigationContent };
  if (key === 'footer') return { footer: validateContent('footer', content) as FooterContent };
  return { social: validateContent('social', content) as SocialContent };
}

// Short memo (same pattern as the homepage); publishing/rolling back any of these clears it.
const TTL_MS = 15_000;
let memo: { at: number; value: StorefrontSiteStudio } | null = null;
export function invalidateSiteStudioCache() {
  memo = null;
}

/** Page documents (information + legal pages) whose published content the storefront renders. */
export const SITE_PAGE_DOC_KEYS = SYSTEM_SITE_PAGES.map((p) => p.docKey);

function pagePart(docKey: string, content: unknown): Record<string, unknown> | null {
  const page = sitePageByDocKey(docKey);
  if (!page) return null;
  return { [page.pageKey]: validateContent(docKey.startsWith('legal:') ? 'legal' : 'page', content, docKey) };
}

export async function getPublishedSiteStudio(): Promise<StorefrontSiteStudio> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.value;
  const value: StorefrontSiteStudio = {};
  for (const key of SITE_DOCUMENT_KEYS) {
    try {
      const pub = await getPublished(key);
      if (pub) Object.assign(value, toPart(key, pub.version.content));
    } catch {
      /* a document that no longer validates is skipped → storefront keeps its built-in default */
    }
  }
  for (const key of SITE_PAGE_DOC_KEYS) {
    try {
      const pub = await getPublished(key);
      const part = pub ? pagePart(key, pub.version.content) : null;
      if (part) value.sitePages = { ...(value.sitePages || {}), ...part };
    } catch {
      /* skipped → the storefront keeps that page's built-in content */
    }
  }
  memo = { at: Date.now(), value };
  return value;
}

/** Published parts + ONE document's draft on top (token-gated preview only). */
export async function getDraftSiteStudio(key: SiteDocumentKey | string): Promise<StorefrontSiteStudio | null> {
  const doc = await getDocument(key);
  if (!doc || doc.draft === null) return null;
  memo = null;
  const base = await getPublishedSiteStudio();
  if (key.startsWith('page:') && !SITE_PAGE_DOC_KEYS.includes(key)) {
    return { ...base, customPages: { [key.slice(5)]: normalizeCustomPage(doc.draft) } };
  }
  if (SITE_PAGE_DOC_KEYS.includes(key)) {
    const part = pagePart(key, doc.draft);
    return { ...base, sitePages: { ...(base.sitePages || {}), ...(part || {}) } };
  }
  return { ...base, ...toPart(key as SiteDocumentKey, doc.draft) };
}

export async function isSiteDocumentPublished(key: SiteDocumentKey): Promise<boolean> {
  try {
    return Boolean((await getDocument(key))?.publishedVersion);
  } catch {
    return false;
  }
}

/**
 * Legacy PUT /catalog/site fields that a published Studio document now owns. Changing them through
 * the old endpoint would be silently overridden on the storefront, so that request is refused.
 */
export const LEGACY_SITE_FIELDS: Record<SiteDocumentKey, string[]> = {
  navigation: ['navigation', 'announcementBarText', 'announcementBarEnabled'],
  footer: ['footer'],
  social: ['socialLinks'],
  company: ['supportEmail', 'supportPhone', 'websiteName'],
  brand_assets: ['websiteAssets'],
};

export async function legacySiteConflicts(body: Record<string, unknown>, existing: Record<string, unknown>): Promise<string[]> {
  const out: string[] = [];
  for (const key of SITE_DOCUMENT_KEYS) {
    const fields = LEGACY_SITE_FIELDS[key].filter((f) => f in body && JSON.stringify(body[f]) !== JSON.stringify(existing?.[f]));
    if (fields.length && (await isSiteDocumentPublished(key))) out.push(...fields);
  }
  return out;
}
