/**
 * Website Studio — document kinds, defaults and server-side content validation.
 *
 * The CMS stores STRUCTURED content only (no HTML, no script, no arbitrary CSS); production
 * components stay the rendering authority. Every save/publish is validated here.
 *
 * Phase 1 makes Company Settings and Brand Assets editable. Other kinds exist (backfilled from
 * the live catalog settings) but are read-only until their own phase adds a strict schema.
 */

import { validateFooter, validateNavigation, validateSocial } from './siteContent';

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
export const EDITABLE_KINDS: ReadonlySet<WebsiteDocumentKind> = new Set(['company', 'brand_assets', 'homepage', 'navigation', 'footer', 'social']);

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
// Homepage (Phase 2)
// ---------------------------------------------------------------------------------------------

/**
 * The homepage sections the storefront ACTUALLY renders (Web src/pages/HomePage.tsx), in its
 * default order. `content` says what the Studio may configure for the section — only fields the
 * storefront really reads are offered:
 *  - categories: optional hand-picked categories (else: categories with the most products)
 *  - products:   featuredProductIds (else: newest products). Its own "Popular Products" section,
 *                ordered / hidden independently of "Viral Today".
 *  - guides:     featuredGuideIds (else: newest guides)
 *  - brands:     featuredBrandIds (else: daily rotation). Active ad placements still win.
 *  - dealsBanners: content comes from the Deals Banners studio (not stored here)
 *  - auto / static / personal: visibility, order and heading only
 */
export const HOMEPAGE_SECTIONS = [
  { id: 'categories', name: 'Top Categories', defaultTitle: 'Top Categories', content: 'categories', heading: true },
  { id: 'spotlight', name: 'Viral Today', defaultTitle: 'Viral Today', content: 'auto', heading: true },
  { id: 'trending', name: 'Popular Products', defaultTitle: 'Popular Products', content: 'products', heading: true },
  { id: 'deals', name: "Today's Deals", defaultTitle: "Today's Deals", content: 'dealsBanners', heading: true },
  { id: 'compare', name: 'Compare', defaultTitle: '', content: 'static', heading: false },
  { id: 'recommended', name: 'Top Buying Guides', defaultTitle: 'Top Buying Guides', content: 'guides', heading: true },
  { id: 'featured-brands', name: 'Featured Brands', defaultTitle: 'Featured Brands', content: 'brands', heading: true },
  { id: 'services', name: 'Popular Services', defaultTitle: 'Popular Services', content: 'static', heading: true },
  { id: 'recently-viewed', name: 'Recently Viewed', defaultTitle: 'Recently Viewed', content: 'personal', heading: true },
] as const;
export type HomepageSectionId = (typeof HOMEPAGE_SECTIONS)[number]['id'];
const SECTION_IDS = HOMEPAGE_SECTIONS.map((s) => s.id) as readonly string[];
/** Stored ids the storefront never renders (kept out of the Studio). */
export const DEPRECATED_HOMEPAGE_SECTIONS = ['creators', 'newsletter'];

// The storefront shows 6 category tiles (icons, not photos), 8 products, 12 brands, 12 guides.
export const HOMEPAGE_LIMITS = { slides: 6, categories: 6, products: 8, brands: 12, guides: 12, dealsBanners: 10, activeDealsBanners: 5 } as const;

/**
 * The four sample banners created at setup. The storefront hides them (HomeTodaysDealsSection
 * isSeededPlaceholder: id deals-banner-N AND one of these stock photos), so they import switched off.
 */
export const SEEDED_DEALS_BANNER_IMAGES = new Set([
  'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&h=320&fit=crop',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=320&fit=crop',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=320&fit=crop',
  'https://images.unsplash.com/photo-1556740714-a8395b3bf30f?w=800&h=320&fit=crop',
]);
export const isSeededDealsBanner = (b: { id?: unknown; image?: unknown }) =>
  /^deals-banner-\d+$/.test(String(b?.id ?? '')) && SEEDED_DEALS_BANNER_IMAGES.has(String(b?.image ?? ''));

function dealsBanner(raw: unknown, i: number, ids: Set<string>): HomepageDealsBanner {
  const f = `dealsBanners[${i}]`;
  const r = asObject(raw, f);
  let id = (text(r.id, `${f}.id`, 60) || `deal-banner-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  for (let n = 2; ids.has(id); n++) id = `${id}-${n}`;
  ids.add(id);
  const image = assetUrl(r.image, `${f}.image`);
  if (!image) throw new WebsiteContentError('Add the banner image', `${f}.image`);
  const type = r.destinationType === 'product' || r.destinationType === 'brand' ? r.destinationType : 'custom-url';
  const ref = type === 'custom-url' ? linkUrl(r.destinationRef || '/deals', `${f}.destinationRef`) : text(r.destinationRef, `${f}.destinationRef`, 120, true);
  return {
    id,
    image,
    destinationType: type,
    destinationRef: ref,
    brandName: text(r.brandName, `${f}.brandName`, 60),
    brandLogoUrl: assetUrl(r.brandLogoUrl, `${f}.brandLogoUrl`),
    isActive: bool(r.isActive, true),
  };
}

export type HomepageSlide = {
  id: string;
  /** Accessible name of the slide + its link (the hero shows media only, no text overlay). */
  label: string;
  linkUrl: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  /** Optional separate media for phones (same type). */
  mobileMediaUrl: string;
  /** Video only: still frame shown before the video plays. */
  posterUrl: string;
  alt: string;
  /** Focal point (0–100 %) — which part of the image stays visible when cropped. */
  focalX: number;
  focalY: number;
  isActive: boolean;
};
export type HomepageSection = { id: HomepageSectionId; isVisible: boolean; title: string; subtitle: string };
/** A real catalog category; blank label = the category's own name. */
export type HomepageCategoryPick = { id: string; label: string };
/**
 * Today's Deals carousel card (Web HomeTodaysDealsSection): a wide image (shown 120px tall,
 * cropped to fill) linking to a product, a brand or a site page, with an optional sponsor chip
 * ("PROMOTED" + brand name/logo). Max 5 shown.
 */
export type HomepageDealsBanner = {
  id: string;
  image: string;
  destinationType: 'product' | 'brand' | 'custom-url';
  destinationRef: string;
  brandName: string;
  brandLogoUrl: string;
  isActive: boolean;
};
export type HomepageStudio = {
  version: 2;
  heroVisible: boolean;
  slides: HomepageSlide[];
  dealsBanners: HomepageDealsBanner[];
  /** In display order. */
  sections: HomepageSection[];
  topCategories: HomepageCategoryPick[];
  featuredProductIds: string[];
  featuredBrandIds: string[];
  featuredGuideIds: string[];
};

export const DEFAULT_HOMEPAGE: HomepageStudio = {
  version: 2,
  heroVisible: true,
  slides: [],
  dealsBanners: [],
  sections: HOMEPAGE_SECTIONS.map((s) => ({ id: s.id, isVisible: true, title: '', subtitle: '' })),
  topCategories: [],
  featuredProductIds: [],
  featuredBrandIds: [],
  featuredGuideIds: [],
};

/** Internal site path ("/deals?x=1") or https URL. Empty allowed. */
export function linkUrl(v: unknown, field: string): string {
  const t = text(v, field, 500);
  if (!t) return '';
  if (t.startsWith('/') && !t.startsWith('//')) {
    if (/[\s<>"'`\\]/.test(t)) throw new WebsiteContentError('Invalid link', field);
    return t;
  }
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new WebsiteContentError('Use a site path like /deals or an https:// link', field);
  }
  if (u.protocol !== 'https:') throw new WebsiteContentError('Only https:// links are allowed', field);
  return u.toString();
}

const idList = (v: unknown, field: string, max: number): string[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new WebsiteContentError('Expected a list', field);
  const out: string[] = [];
  for (const [i, x] of v.entries()) {
    const id = text(x, `${field}[${i}]`, 120);
    if (id && !out.includes(id)) out.push(id);
  }
  if (out.length > max) throw new WebsiteContentError(`At most ${max}`, field);
  return out;
};

const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 50);

const VIDEO_EXT = /\.(mp4|webm)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;

function slide(raw: unknown, i: number, ids: Set<string>): HomepageSlide {
  const f = `slides[${i}]`;
  const r = asObject(raw, f);
  const id = (text(r.id, `${f}.id`, 40) || `slide-${i + 1}`).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(id)) throw new WebsiteContentError('Use letters, numbers and hyphens', `${f}.id`);
  if (ids.has(id)) throw new WebsiteContentError('Duplicate slide id', `${f}.id`);
  ids.add(id);
  const mediaType = r.mediaType === 'video' ? 'video' : 'image';
  const mediaUrl = assetUrl(r.mediaUrl, `${f}.mediaUrl`);
  const mobileMediaUrl = assetUrl(r.mobileMediaUrl, `${f}.mobileMediaUrl`);
  const posterUrl = mediaType === 'video' ? assetUrl(r.posterUrl, `${f}.posterUrl`) : '';
  const check = (url: string, field: string) => {
    if (!url) return;
    if (mediaType === 'video' && IMAGE_EXT.test(url)) throw new WebsiteContentError('This is an image — choose "Image" or use an MP4/WebM video', field);
    if (mediaType === 'image' && VIDEO_EXT.test(url)) throw new WebsiteContentError('This is a video — choose "Video" for this slide', field);
  };
  check(mediaUrl, `${f}.mediaUrl`);
  check(mobileMediaUrl, `${f}.mobileMediaUrl`);
  if (posterUrl && VIDEO_EXT.test(posterUrl)) throw new WebsiteContentError('The poster must be an image', `${f}.posterUrl`);
  const isActive = bool(r.isActive, true);
  const label = text(r.label, `${f}.label`, 120);
  const alt = text(r.alt, `${f}.alt`, 160);
  if (isActive) {
    if (!mediaUrl) throw new WebsiteContentError('An active slide needs an image or video (or switch it off)', `${f}.mediaUrl`);
    if (!label) throw new WebsiteContentError('Give the slide a name — screen readers announce it', `${f}.label`);
    if (mediaType === 'image' && !alt) throw new WebsiteContentError('Add alt text describing the image', `${f}.alt`);
  }
  return {
    id,
    label,
    linkUrl: linkUrl(r.linkUrl, `${f}.linkUrl`),
    mediaType,
    mediaUrl,
    mobileMediaUrl,
    posterUrl,
    alt,
    focalX: pct(r.focalX),
    focalY: pct(r.focalY),
    isActive,
  };
}

/**
 * Accepts the Studio shape (version 2) or the legacy catalog HomepageConfig the backfill imported,
 * and returns the strict Studio shape. Legacy conversion preserves what shoppers see today:
 *  - section order = the storefront's effective order (listed sections by `order`, then the
 *    sections it renders that were never listed, in its default order);
 *  - legacy `label`s were admin-only names, so headings stay the storefront defaults;
 *  - legacy hero banners without media were skipped by the storefront → imported switched off;
 *  - dealsBanners / featuredDealIds / featuredCreatorIds are not rendered from here → dropped.
 */
export function validateHomepage(input: unknown): HomepageStudio {
  const o = asObject(input, 'homepage');
  const legacy = o.version !== 2;
  let src: Record<string, unknown> = o;
  if (legacy) {
    const sections = Array.isArray(o.sections) ? (o.sections as Array<Record<string, unknown>>) : [];
    const norm = (id: unknown) => (id === 'viral-today' ? 'spotlight' : String(id ?? ''));
    const listed = new Map<string, { order: number; visible: boolean }>();
    for (const s of sections) {
      const id = norm(s?.id);
      if (SECTION_IDS.includes(id) && !listed.has(id)) listed.set(id, { order: Number(s.order) || 0, visible: s.isVisible !== false });
    }
    const hero = sections.find((s) => s?.id === 'hero');
    const orderedIds = [
      ...SECTION_IDS.filter((id) => listed.has(id)).sort((a, b) => listed.get(a)!.order - listed.get(b)!.order),
      ...SECTION_IDS.filter((id) => !listed.has(id)),
    ];
    const banners = Array.isArray(o.heroBanners) ? (o.heroBanners as Array<Record<string, unknown>>) : [];
    src = {
      version: 2,
      heroVisible: hero ? hero.isVisible !== false : true,
      slides: [...banners]
        .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
        .map((b) => {
          const isVideo = b?.mediaType === 'video';
          const media = String((isVideo ? b?.mediaUrl || b?.backgroundVideo : b?.mediaUrl || b?.backgroundImage) ?? '');
          return {
            id: b?.id,
            label: b?.headline || b?.ctaText || '',
            linkUrl: b?.ctaUrl || '',
            mediaType: isVideo ? 'video' : 'image',
            mediaUrl: media,
            posterUrl: isVideo ? b?.backgroundImage || '' : '',
            alt: b?.headline || '',
            isActive: b?.isActive !== false && Boolean(media),
          };
        }),
      sections: orderedIds.map((id) => ({ id, isVisible: listed.get(id)?.visible ?? true, title: '', subtitle: '' })),
      // Same cards the storefront shows today: sorted by order; setup samples it hides come in off.
      dealsBanners: (Array.isArray(o.dealsBanners) ? [...(o.dealsBanners as Array<Record<string, unknown>>)] : [])
        .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
        .map((b) => ({
          id: b?.id,
          image: b?.image,
          destinationType: b?.destinationType,
          destinationRef: b?.destinationRef,
          brandName: b?.brandName ?? '',
          brandLogoUrl: b?.brandLogoUrl ?? '',
          isActive: b?.isActive !== false && Boolean(b?.image) && !isSeededDealsBanner(b ?? {}),
        })),
      topCategories: Array.isArray(o.topCategories)
        ? [...(o.topCategories as Array<Record<string, unknown>>)]
            .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
            .slice(0, HOMEPAGE_LIMITS.categories)
            .map((c) => ({ id: c?.id, label: c?.label ?? '' }))
        : [],
      featuredProductIds: o.featuredProductIds,
      featuredBrandIds: o.featuredBrandIds,
      featuredGuideIds: o.featuredGuideIds,
    };
  }
  const allowed = new Set(['version', 'heroVisible', 'slides', 'dealsBanners', 'sections', 'topCategories', 'featuredProductIds', 'featuredBrandIds', 'featuredGuideIds']);
  for (const k of Object.keys(src)) if (!allowed.has(k)) throw new WebsiteContentError('Unknown homepage setting', k);

  const slidesRaw = src.slides === undefined ? [] : src.slides;
  if (!Array.isArray(slidesRaw)) throw new WebsiteContentError('Expected a list', 'slides');
  if (slidesRaw.length > HOMEPAGE_LIMITS.slides) throw new WebsiteContentError(`At most ${HOMEPAGE_LIMITS.slides} slides`, 'slides');
  const slideIds = new Set<string>();
  const slides = slidesRaw.map((s, i) => slide(s, i, slideIds));

  const bannersRaw = src.dealsBanners === undefined ? [] : src.dealsBanners;
  if (!Array.isArray(bannersRaw)) throw new WebsiteContentError('Expected a list', 'dealsBanners');
  if (bannersRaw.length > HOMEPAGE_LIMITS.dealsBanners) throw new WebsiteContentError(`At most ${HOMEPAGE_LIMITS.dealsBanners} deals banners`, 'dealsBanners');
  const bannerIds = new Set<string>();
  const dealsBanners = bannersRaw.map((b, i) => dealsBanner(b, i, bannerIds));
  if (dealsBanners.filter((b) => b.isActive).length > HOMEPAGE_LIMITS.activeDealsBanners) {
    throw new WebsiteContentError(`At most ${HOMEPAGE_LIMITS.activeDealsBanners} banners can be shown at once — switch some off`, 'dealsBanners');
  }

  const sectionsRaw = src.sections === undefined ? [] : src.sections;
  if (!Array.isArray(sectionsRaw)) throw new WebsiteContentError('Expected a list', 'sections');
  const seen = new Set<string>();
  const sections: HomepageSection[] = [];
  sectionsRaw.forEach((raw, i) => {
    const f = `sections[${i}]`;
    const r = asObject(raw, f);
    const id = text(r.id, `${f}.id`, 40, true);
    if (DEPRECATED_HOMEPAGE_SECTIONS.includes(id)) return; // never rendered by the storefront
    const def = HOMEPAGE_SECTIONS.find((s) => s.id === id);
    if (!def) throw new WebsiteContentError(`"${id}" is not a homepage section the website can show`, `${f}.id`);
    if (seen.has(id)) throw new WebsiteContentError('Section listed twice', `${f}.id`);
    seen.add(id);
    sections.push({
      id: def.id,
      isVisible: bool(r.isVisible, true),
      title: def.heading ? text(r.title, `${f}.title`, 60) : '',
      subtitle: def.heading ? text(r.subtitle, `${f}.subtitle`, 160) : '',
    });
  });
  // A section missing from the list keeps rendering on the storefront (after the listed ones),
  // so it is added visibly here — the Studio always shows the full, real page.
  for (const def of HOMEPAGE_SECTIONS) if (!seen.has(def.id)) sections.push({ id: def.id, isVisible: true, title: '', subtitle: '' });

  const catsRaw = src.topCategories === undefined ? [] : src.topCategories;
  if (!Array.isArray(catsRaw)) throw new WebsiteContentError('Expected a list', 'topCategories');
  if (catsRaw.length > HOMEPAGE_LIMITS.categories) throw new WebsiteContentError(`At most ${HOMEPAGE_LIMITS.categories} categories`, 'topCategories');
  const catIds = new Set<string>();
  const topCategories = catsRaw.map((raw, i) => {
    const f = `topCategories[${i}]`;
    const r = asObject(raw, f);
    const id = text(r.id, `${f}.id`, 120, true);
    if (catIds.has(id)) throw new WebsiteContentError('Category picked twice', `${f}.id`);
    catIds.add(id);
    return { id, label: text(r.label, `${f}.label`, 40) };
  });

  return {
    version: 2,
    heroVisible: bool(src.heroVisible, true),
    slides,
    dealsBanners,
    sections,
    topCategories,
    featuredProductIds: idList(src.featuredProductIds, 'featuredProductIds', HOMEPAGE_LIMITS.products),
    featuredBrandIds: idList(src.featuredBrandIds, 'featuredBrandIds', HOMEPAGE_LIMITS.brands),
    featuredGuideIds: idList(src.featuredGuideIds, 'featuredGuideIds', HOMEPAGE_LIMITS.guides),
  };
}

// ---------------------------------------------------------------------------------------------

export function defaultsForKind(kind: WebsiteDocumentKind): unknown {
  if (kind === 'company') return structuredClone(DEFAULT_COMPANY);
  if (kind === 'brand_assets') return structuredClone(DEFAULT_BRAND_ASSETS);
  if (kind === 'homepage') return structuredClone(DEFAULT_HOMEPAGE);
  if (kind === 'navigation') return validateNavigation({ version: 2, items: [{ id: 'home', label: 'Home', url: '/' }], announcement: { enabled: false, text: '', linkUrl: '' } });
  if (kind === 'footer') return validateFooter({ version: 2, description: '', columns: [], paymentMethods: [], deliveryPartners: [], apps: [] });
  if (kind === 'social') return { version: 2, links: [] };
  return null;
}

/** Validate + normalise content for a kind. Throws WebsiteContentError. */
export function validateContent(kind: WebsiteDocumentKind, content: unknown): unknown {
  assertSafeStructuredContent(content);
  if (kind === 'company') return validateCompany(content);
  if (kind === 'brand_assets') return validateBrandAssets(content);
  if (kind === 'homepage') return validateHomepage(content);
  if (kind === 'navigation') return validateNavigation(content);
  if (kind === 'footer') return validateFooter(content);
  if (kind === 'social') return validateSocial(content);
  // Read-only kinds in this phase: only the generic safety checks above apply (used by backfill).
  if (content === null || typeof content !== 'object') throw new WebsiteContentError('Expected an object');
  return content;
}
