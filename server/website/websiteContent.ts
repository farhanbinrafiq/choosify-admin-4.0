/**
 * Website Studio — document kinds, defaults and server-side content validation.
 *
 * The CMS stores STRUCTURED content only (no HTML, no script, no arbitrary CSS); production
 * components stay the rendering authority. Every save/publish is validated here.
 *
 * Phase 1 makes Company Settings and Brand Assets editable. Other kinds exist (backfilled from
 * the live catalog settings) but are read-only until their own phase adds a strict schema.
 */

export type WebsiteDocumentKind =
  | 'company'
  | 'brand_assets'
  | 'homepage'
  | 'navigation'
  | 'footer'
  | 'social'
  | 'seo'
  | 'page'
  | 'legal'
  | 'filters'
  | 'features';

export const WEBSITE_DOCUMENT_KINDS: readonly WebsiteDocumentKind[] = [
  'company', 'brand_assets', 'homepage', 'navigation', 'footer', 'social', 'seo', 'page', 'legal', 'filters', 'features',
];

/** Kinds whose drafts can be edited through the API in the current phase. */
export const EDITABLE_KINDS: ReadonlySet<WebsiteDocumentKind> = new Set(['company', 'brand_assets']);

export const KEY_PATTERN = /^[a-z][a-z0-9_]*(:[a-z0-9]+(-[a-z0-9]+)*)?$/;

/** Fixed (singleton) documents and their kinds. Pages/legal docs use "page:<slug>" / "legal:<slug>". */
export const SINGLETON_KINDS: Record<string, WebsiteDocumentKind> = {
  company: 'company',
  brand_assets: 'brand_assets',
  homepage: 'homepage',
  navigation: 'navigation',
  footer: 'footer',
  social: 'social',
  seo: 'seo',
  filters: 'filters',
  features: 'features',
};

export function kindForKey(key: string): WebsiteDocumentKind | null {
  if (!KEY_PATTERN.test(key)) return null;
  if (SINGLETON_KINDS[key]) return SINGLETON_KINDS[key];
  if (key.startsWith('page:')) return 'page';
  if (key.startsWith('legal:')) return 'legal';
  return null;
}

export const isLegalKind = (kind: WebsiteDocumentKind) => kind === 'legal';

export class WebsiteContentError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
  }
}

const MAX_DOCUMENT_BYTES = 256 * 1024;
const MAX_STRING = 5000;

/**
 * Generic safety net for EVERY document: plain JSON only, no prototype keys, no script-capable
 * URLs, no HTML tags in text, bounded size and depth.
 */
export function assertSafeStructuredContent(value: unknown): void {
  const size = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
  if (size > MAX_DOCUMENT_BYTES) throw new WebsiteContentError(`Document is too large (${Math.round(size / 1024)} KB, max 256 KB)`);
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 12) throw new WebsiteContentError('Document is nested too deeply', path);
    if (typeof v === 'string') {
      if (v.length > MAX_STRING) throw new WebsiteContentError(`Text is too long (max ${MAX_STRING} characters)`, path);
      const t = v.trim().toLowerCase().replace(/[\s\u0000-\u001f]+/g, '');
      if (/^(javascript|vbscript|data:text|data:application|file):/.test(t) || t.startsWith('javascript:')) {
        throw new WebsiteContentError('Script or unsafe links are not allowed', path);
      }
      if (/<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|img|a|div|span|p|html|body)\b/i.test(v) || /\bon(click|load|error|mouse[a-z]*|focus|blur|key[a-z]*|submit|change|input|pointer[a-z]*|touch[a-z]*)\s*=/i.test(v)) {
        throw new WebsiteContentError('HTML and inline scripts are not allowed — use plain text', path);
      }
      return;
    }
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return;
    if (Array.isArray(v)) {
      if (v.length > 500) throw new WebsiteContentError('List is too long (max 500 items)', path);
      v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof v === 'object') {
      if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) {
        throw new WebsiteContentError('Unsupported value', path);
      }
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new WebsiteContentError('Invalid field name', path);
        walk(x, path ? `${path}.${k}` : k, depth + 1);
      }
      return;
    }
    throw new WebsiteContentError('Unsupported value', path);
  };
  walk(value, '', 0);
}

// ---------------------------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------------------------

const asObject = (v: unknown, field: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new WebsiteContentError('Expected an object', field);
  return v as Record<string, unknown>;
};

const text = (v: unknown, field: string, max: number, required = false): string => {
  if (v === undefined || v === null) {
    if (required) throw new WebsiteContentError('Required', field);
    return '';
  }
  if (typeof v !== 'string') throw new WebsiteContentError('Expected text', field);
  const t = v.trim().replace(/\s+/g, ' ');
  if (required && !t) throw new WebsiteContentError('Required', field);
  if (t.length > max) throw new WebsiteContentError(`Too long (max ${max} characters)`, field);
  return t;
};

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i;
const PHONE = /^\+?[0-9][0-9\s\-()]{5,24}$/;

/** Website asset URL: our own media (/media/...), a site path (/...), or an https URL. */
export function assetUrl(v: unknown, field: string): string {
  const t = text(v, field, 1000);
  if (!t) return '';
  if (t.startsWith('/') && !t.startsWith('//')) {
    if (/[\s<>"'`]/.test(t) || t.includes('..')) throw new WebsiteContentError('Invalid path', field);
    return t;
  }
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new WebsiteContentError('Must be an https:// URL or a /media/ path', field);
  }
  if (u.protocol !== 'https:') throw new WebsiteContentError('Only https:// URLs are allowed', field);
  return u.toString();
}

// ---------------------------------------------------------------------------------------------
// Company Settings
// ---------------------------------------------------------------------------------------------

export type CompanyOffice = { id: string; label: string; lines: string[]; enabled: boolean };
export type CompanyIdentifier = { value: string; verified: boolean };
export type CompanySettings = {
  displayName: string;
  /** Registered legal name. Blank until verified — the company is NOT yet incorporated. */
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  offices: CompanyOffice[];
  /** Business identifiers are shown publicly ONLY when verified is true. */
  identifiers: { dbid: CompanyIdentifier; tradeLicense: CompanyIdentifier };
  copyrightText: string;
};

export const DEFAULT_COMPANY: CompanySettings = {
  displayName: 'Choosify',
  legalName: '',
  supportEmail: '',
  supportPhone: '',
  offices: [],
  identifiers: { dbid: { value: '', verified: false }, tradeLicense: { value: '', verified: false } },
  copyrightText: '',
};

function identifier(v: unknown, field: string): CompanyIdentifier {
  const o = v === undefined ? {} : asObject(v, field);
  const value = text(o.value, `${field}.value`, 80);
  const verified = bool(o.verified, false);
  if (verified && !value) throw new WebsiteContentError('A verified identifier needs a value', `${field}.value`);
  return { value, verified };
}

export function validateCompany(input: unknown): CompanySettings {
  const o = asObject(input, 'company');
  const supportEmail = text(o.supportEmail, 'supportEmail', 120);
  if (supportEmail && !EMAIL.test(supportEmail)) throw new WebsiteContentError('Not a valid email address', 'supportEmail');
  const supportPhone = text(o.supportPhone, 'supportPhone', 30);
  if (supportPhone && !PHONE.test(supportPhone)) throw new WebsiteContentError('Not a valid phone number', 'supportPhone');
  const officesRaw = o.offices === undefined ? [] : o.offices;
  if (!Array.isArray(officesRaw)) throw new WebsiteContentError('Expected a list', 'offices');
  if (officesRaw.length > 6) throw new WebsiteContentError('At most 6 offices', 'offices');
  const ids = new Set<string>();
  const offices = officesRaw.map((raw, i) => {
    const f = `offices[${i}]`;
    const r = asObject(raw, f);
    const id = text(r.id, `${f}.id`, 40, true).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(id)) throw new WebsiteContentError('Use letters, numbers and hyphens', `${f}.id`);
    if (ids.has(id)) throw new WebsiteContentError('Duplicate office id', `${f}.id`);
    ids.add(id);
    const linesRaw = r.lines === undefined ? [] : r.lines;
    if (!Array.isArray(linesRaw) || linesRaw.length > 6) throw new WebsiteContentError('Up to 6 address lines', `${f}.lines`);
    return {
      id,
      label: text(r.label, `${f}.label`, 60, true),
      lines: linesRaw.map((l, j) => text(l, `${f}.lines[${j}]`, 120)).filter(Boolean),
      enabled: bool(r.enabled, true),
    };
  });
  const ident = o.identifiers === undefined ? {} : asObject(o.identifiers, 'identifiers');
  return {
    displayName: text(o.displayName, 'displayName', 80, true),
    legalName: text(o.legalName, 'legalName', 160),
    supportEmail,
    supportPhone,
    offices,
    identifiers: { dbid: identifier(ident.dbid, 'identifiers.dbid'), tradeLicense: identifier(ident.tradeLicense, 'identifiers.tradeLicense') },
    copyrightText: text(o.copyrightText, 'copyrightText', 200),
  };
}

// ---------------------------------------------------------------------------------------------
// Brand Assets
// ---------------------------------------------------------------------------------------------

export const BRAND_ASSET_SLOTS = [
  'primaryLogo',
  'horizontalLogo',
  'footerLogo',
  'favicon',
  'emiLogo',
  'defaultShareImage',
  'defaultPlaceholder',
] as const;
export type BrandAssetSlot = (typeof BRAND_ASSET_SLOTS)[number];
export type BrandAsset = { url: string; alt: string };
export type BrandAssets = Record<BrandAssetSlot, BrandAsset>;

/** Empty slot = the storefront keeps its built-in fallback asset. */
export const DEFAULT_BRAND_ASSETS: BrandAssets = Object.fromEntries(
  BRAND_ASSET_SLOTS.map((s) => [s, { url: '', alt: '' }]),
) as BrandAssets;

export function validateBrandAssets(input: unknown): BrandAssets {
  const o = asObject(input, 'brandAssets');
  for (const k of Object.keys(o)) {
    if (!(BRAND_ASSET_SLOTS as readonly string[]).includes(k)) throw new WebsiteContentError('Unknown asset slot', k);
  }
  const out = {} as BrandAssets;
  for (const slot of BRAND_ASSET_SLOTS) {
    const r = o[slot] === undefined ? {} : asObject(o[slot], slot);
    const url = assetUrl(r.url, `${slot}.url`);
    const alt = text(r.alt, `${slot}.alt`, 160);
    // Accessibility: a public image needs real alt text (the favicon is not an <img>).
    if (url && !alt && slot !== 'favicon') throw new WebsiteContentError('Add alt text describing this image', `${slot}.alt`);
    out[slot] = { url, alt };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

export function defaultsForKind(kind: WebsiteDocumentKind): unknown {
  if (kind === 'company') return structuredClone(DEFAULT_COMPANY);
  if (kind === 'brand_assets') return structuredClone(DEFAULT_BRAND_ASSETS);
  return null;
}

/** Validate + normalise content for a kind. Throws WebsiteContentError. */
export function validateContent(kind: WebsiteDocumentKind, content: unknown): unknown {
  assertSafeStructuredContent(content);
  if (kind === 'company') return validateCompany(content);
  if (kind === 'brand_assets') return validateBrandAssets(content);
  // Read-only kinds in this phase: only the generic safety checks above apply (used by backfill).
  if (content === null || typeof content !== 'object') throw new WebsiteContentError('Expected an object');
  return content;
}
