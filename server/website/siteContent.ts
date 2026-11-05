/**
 * Website Studio Phase 3 — Navigation & Header, Footer and Social Links content schemas.
 *
 * Only settings the storefront really renders are accepted (Web Navbar.tsx / Footer.tsx). Legacy
 * catalog-shaped content (the imported v1 baselines) converts to the Studio shape (version 2)
 * without changing what shoppers see. Payment methods are checked against the gateways actually
 * configured on this server (paymentCapabilities) at publish time, so the footer can never
 * advertise a method checkout cannot take.
 */
import { WebsiteContentError, assetUrl, linkUrl } from './websiteContent';

const asObject = (v: unknown, field: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new WebsiteContentError('Expected an object', field);
  return v as Record<string, unknown>;
};
const list = (v: unknown, field: string, max: number, what = 'items'): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new WebsiteContentError('Expected a list', field);
  if (v.length > max) throw new WebsiteContentError(`At most ${max} ${what}`, field);
  return v;
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
const slugId = (v: unknown, field: string, fallback: string, seen: Set<string>) => {
  const id = (text(v, field, 40) || fallback).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
  let unique = id;
  for (let n = 2; seen.has(unique); n++) unique = `${id}-${n}`;
  seen.add(unique);
  return unique;
};
const rejectUnknown = (o: Record<string, unknown>, allowed: string[]) => {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new WebsiteContentError('Unknown setting', k);
};

// ---------------------------------------------------------------------------------------------
// Links: storefront routes only (reserved / staff / transactional routes refused), or https
// ---------------------------------------------------------------------------------------------

/** Public storefront sections a menu or footer link may point at (Web src/App.tsx). */
export const LINKABLE_ROUTES = [
  '/', '/about', '/advertise', '/blogs', '/brand-deals', '/brands', '/careers', '/categories', '/compare', '/contact',
  '/creators', '/customer-favorite', '/deals', '/emi', '/faq', '/guides', '/partnership', '/privacy', '/products',
  '/reviews', '/search', '/spotlight', '/suggest-brand', '/terms', '/warranty-claims',
  // "Your own pages" made in Website Studio → Pages
  '/pages',
] as const;
/** Never linkable from public menus: staff, account, checkout/payment, preview and API paths. */
export const RESERVED_ROUTES = [
  '/admin', '/api', '/cms-preview', '/dashboard', '/login', '/forgot-password', '/reset-password', '/verify-email', '/checkout',
  '/cart', '/payment', '/order-success', '/order-tracking', '/orders', '/invoice', '/messages', '/profile', '/post-offer',
  '/marketing', '/claim', '/publisher', '/media', '/health', '/whats-on', '/recommendations',
];

export function siteLink(v: unknown, field: string, required = true): { url: string; external: boolean } {
  const url = linkUrl(v, field);
  if (!url) {
    if (required) throw new WebsiteContentError('Add a link', field);
    return { url: '', external: false };
  }
  if (!url.startsWith('/')) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // A full link to our own storefront must use the site path instead (keeps route checks).
    if (host === 'choosify.bd') throw new WebsiteContentError('Use the site path (e.g. /deals) for Choosify pages', field);
    return { url, external: true };
  }
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const top = path === '/' ? '/' : `/${path.split('/')[1]}`;
  if (RESERVED_ROUTES.includes(top)) throw new WebsiteContentError(`${top} is a reserved page and cannot be linked from public menus`, field);
  if (!(LINKABLE_ROUTES as readonly string[]).includes(top)) throw new WebsiteContentError(`${top} is not a page on the website`, field);
  return { url, external: false };
}

// ---------------------------------------------------------------------------------------------
// Navigation & Header
// ---------------------------------------------------------------------------------------------

export type NavItem = { id: string; label: string; url: string; external: boolean; showOnDesktop: boolean; showOnMobile: boolean };
export type Announcement = { enabled: boolean; text: string; linkUrl: string };
export type NavigationContent = { version: 2; items: NavItem[]; announcement: Announcement };

export const NAV_LIMITS = { items: 10, label: 24, announcement: 140 } as const;

/** Legacy import → Studio shape. The storefront showed every item on desktop and mobile. */
function navigationFromLegacy(o: Record<string, unknown>): Record<string, unknown> {
  const items = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];
  const bar = (o.announcementBar ?? {}) as Record<string, unknown>;
  return {
    version: 2,
    items: [...items]
      .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
      .filter((i) => i?.enabled !== false)
      .map((i) => ({ id: i.id, label: i.label, url: i.path ?? i.url, showOnDesktop: true, showOnMobile: true })),
    announcement: { enabled: Boolean(bar.enabled), text: bar.text ?? '', linkUrl: '' },
  };
}

export function validateNavigation(input: unknown): NavigationContent {
  let o = asObject(input, 'navigation');
  if (o.version !== 2) o = navigationFromLegacy(o);
  rejectUnknown(o, ['version', 'items', 'announcement']);
  const seen = new Set<string>();
  const items = list(o.items, 'items', NAV_LIMITS.items, 'menu items').map((raw, i) => {
    const f = `items[${i}]`;
    const r = asObject(raw, f);
    const label = text(r.label, `${f}.label`, NAV_LIMITS.label, true);
    const link = siteLink(r.url, `${f}.url`);
    return {
      id: slugId(r.id, `${f}.id`, label, seen),
      label,
      url: link.url,
      external: link.external,
      showOnDesktop: bool(r.showOnDesktop, true),
      showOnMobile: bool(r.showOnMobile, true),
    };
  });
  const home = items.find((i) => i.url === '/');
  if (!home || !home.showOnDesktop || !home.showOnMobile) {
    throw new WebsiteContentError('Keep a visible "Home" link (/) — it is the way back to the homepage', 'items');
  }
  const a = o.announcement === undefined ? {} : asObject(o.announcement, 'announcement');
  const announcement = {
    enabled: bool(a.enabled, false),
    text: text(a.text, 'announcement.text', NAV_LIMITS.announcement),
    linkUrl: siteLink(a.linkUrl, 'announcement.linkUrl', false).url,
  };
  if (announcement.enabled && !announcement.text) throw new WebsiteContentError('Write the announcement text (or switch the bar off)', 'announcement.text');
  return { version: 2, items, announcement };
}

// ---------------------------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------------------------

export const SOCIAL_PLATFORMS: Record<string, { label: string; hosts: string[] }> = {
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'm.facebook.com'] },
  instagram: { label: 'Instagram', hosts: ['instagram.com'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  linkedin: { label: 'LinkedIn', hosts: ['linkedin.com'] },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com'] },
  x: { label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'] },
  whatsapp: { label: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'] },
};
export type SocialLink = { platform: string; url: string; visible: boolean };
export type SocialContent = { version: 2; links: SocialLink[] };

const platformKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '').replace(/^twitter$/, 'x');

export function validateSocial(input: unknown): SocialContent {
  const o = asObject(input, 'social');
  const legacy = o.version !== 2;
  rejectUnknown(o, ['version', 'links']);
  const raw = list(o.links, 'links', 10, 'links');
  const ordered = legacy ? [...raw].sort((a, b) => Number((a as any)?.order ?? 0) - Number((b as any)?.order ?? 0)) : raw;
  const seen = new Set<string>();
  const links = ordered.map((x, i) => {
    const f = `links[${i}]`;
    const r = asObject(x, f);
    const platform = platformKey(r.platform);
    const def = SOCIAL_PLATFORMS[platform];
    if (!def) throw new WebsiteContentError('Choose a supported social network', `${f}.platform`);
    if (seen.has(platform)) throw new WebsiteContentError(`${def.label} is listed twice`, `${f}.platform`);
    seen.add(platform);
    const url = linkUrl(r.url, `${f}.url`);
    if (!url || url.startsWith('/')) throw new WebsiteContentError(`Paste the full https:// link to the ${def.label} page`, `${f}.url`);
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (!def.hosts.some((h) => host === h || host.endsWith(`.${h}`))) throw new WebsiteContentError(`This is not a ${def.label} link`, `${f}.url`);
    return { platform, url, visible: bool(legacy ? r.isVisible : r.visible, true) };
  });
  return { version: 2, links };
}

// ---------------------------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------------------------

/** Payment methods the footer can show, and what each one needs to be genuinely available. */
export const PAYMENT_METHODS: Record<string, { label: string; needs: 'cod' | 'sslcommerz' }> = {
  cod: { label: 'Cash on Delivery', needs: 'cod' },
  visa: { label: 'Visa', needs: 'sslcommerz' },
  mastercard: { label: 'Mastercard', needs: 'sslcommerz' },
  amex: { label: 'American Express', needs: 'sslcommerz' },
  bkash: { label: 'bKash', needs: 'sslcommerz' },
  nagad: { label: 'Nagad', needs: 'sslcommerz' },
};

export type AppLink = { platform: 'android' | 'ios'; url: string };
export type DeliveryPartner = { id: string; name: string; logoUrl: string; confirmed: true };
export type FooterLinkItem = { label: string; url: string; external: boolean };
export type FooterColumn = { id: string; title: string; links: FooterLinkItem[] };
export type FooterContent = {
  version: 2;
  description: string;
  columns: FooterColumn[];
  showOffices: boolean;
  showBusinessIds: boolean;
  paymentMethods: string[];
  deliveryPartners: DeliveryPartner[];
  apps: AppLink[];
};

export const FOOTER_LIMITS = { columns: 4, links: 8, description: 300, partners: 6 } as const;

/** Real store listings only: a Google Play app id, or an App Store app id. */
const APP_URL: Record<AppLink['platform'], RegExp> = {
  android: /^https:\/\/play\.google\.com\/store\/apps\/details\?id=[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+(&[\w=.-]*)?$/,
  ios: /^https:\/\/apps\.apple\.com\/([a-z]{2}\/)?app\/[\w%.-]+\/id\d{6,12}(\?[\w=&.-]*)?$/,
};

/** Legacy import → Studio shape, matching today's footer (Footer.tsx fallbacks). */
function footerFromLegacy(o: Record<string, unknown>): Record<string, unknown> {
  const cols = Array.isArray(o.columns) ? (o.columns as Array<Record<string, unknown>>) : [];
  return {
    version: 2,
    description: o.description ?? '',
    columns: cols.map((c) => ({
      id: c.id,
      title: c.title,
      links: (Array.isArray(c.links) ? (c.links as Array<Record<string, unknown>>) : []).map((l) => ({ label: l.label, url: l.url })),
    })),
    showOffices: true,
    showBusinessIds: true,
    // Imported EMPTY on purpose: none of today's payment/app/courier logos is backed by a live
    // integration (see Phase 3 audit). Staff add only what is genuinely supported.
    paymentMethods: [],
    deliveryPartners: [],
    apps: [],
  };
}

export function validateFooter(input: unknown): FooterContent {
  let o = asObject(input, 'footer');
  if (o.version !== 2) o = footerFromLegacy(o);
  rejectUnknown(o, ['version', 'description', 'columns', 'showOffices', 'showBusinessIds', 'paymentMethods', 'deliveryPartners', 'apps']);
  const colIds = new Set<string>();
  const columns = list(o.columns, 'columns', FOOTER_LIMITS.columns, 'columns').map((raw, i) => {
    const f = `columns[${i}]`;
    const r = asObject(raw, f);
    const title = text(r.title, `${f}.title`, 30, true);
    const links = list(r.links, `${f}.links`, FOOTER_LIMITS.links, 'links per column').map((lr, j) => {
      const lf = `${f}.links[${j}]`;
      const l = asObject(lr, lf);
      const link = siteLink(l.url, `${lf}.url`);
      return { label: text(l.label, `${lf}.label`, 40, true), url: link.url, external: link.external };
    });
    if (!links.length) throw new WebsiteContentError('A column needs at least one link (or delete the column)', `${f}.links`);
    return { id: slugId(r.id, `${f}.id`, title, colIds), title, links };
  });
  const paymentMethods: string[] = [];
  list(o.paymentMethods, 'paymentMethods', Object.keys(PAYMENT_METHODS).length, 'methods').forEach((x, i) => {
    const id = text(x, `paymentMethods[${i}]`, 30);
    if (!PAYMENT_METHODS[id]) throw new WebsiteContentError('Unknown payment method', `paymentMethods[${i}]`);
    if (!paymentMethods.includes(id)) paymentMethods.push(id);
  });
  const pIds = new Set<string>();
  const deliveryPartners = list(o.deliveryPartners, 'deliveryPartners', FOOTER_LIMITS.partners, 'partners').map((raw, i) => {
    const f = `deliveryPartners[${i}]`;
    const r = asObject(raw, f);
    const name = text(r.name, `${f}.name`, 40, true);
    const logoUrl = assetUrl(r.logoUrl, `${f}.logoUrl`);
    if (!logoUrl) throw new WebsiteContentError('Add the courier logo', `${f}.logoUrl`);
    if (r.confirmed !== true) {
      throw new WebsiteContentError(`Confirm Choosify orders really ship with ${name} before showing its logo`, `${f}.confirmed`);
    }
    return { id: slugId(r.id, `${f}.id`, name, pIds), name, logoUrl, confirmed: true as const };
  });
  const seenApp = new Set<string>();
  const apps = list(o.apps, 'apps', 2, 'app links').map((raw, i) => {
    const f = `apps[${i}]`;
    const r = asObject(raw, f);
    const platform = r.platform === 'ios' ? 'ios' : r.platform === 'android' ? 'android' : null;
    if (!platform) throw new WebsiteContentError('Choose Android or iOS', `${f}.platform`);
    if (seenApp.has(platform)) throw new WebsiteContentError('Only one link per store', `${f}.platform`);
    seenApp.add(platform);
    const url = text(r.url, `${f}.url`, 300, true);
    if (!APP_URL[platform].test(url)) {
      throw new WebsiteContentError(
        platform === 'android'
          ? 'Paste the real Google Play listing (https://play.google.com/store/apps/details?id=…)'
          : 'Paste the real App Store listing (https://apps.apple.com/…/app/…/id…)',
        `${f}.url`,
      );
    }
    return { platform, url } as AppLink;
  });
  return {
    version: 2,
    description: text(o.description, 'description', FOOTER_LIMITS.description),
    columns,
    showOffices: bool(o.showOffices, true),
    showBusinessIds: bool(o.showBusinessIds, true),
    paymentMethods,
    deliveryPartners,
    apps,
  };
}

// ---------------------------------------------------------------------------------------------
// Payment availability (what checkout can really take on THIS server)
// ---------------------------------------------------------------------------------------------

export type PaymentCapability = { id: string; label: string; available: boolean; reason: string };

export function paymentCapabilities(env: NodeJS.ProcessEnv = process.env): PaymentCapability[] {
  const sslLive =
    String(env.SSLCOMMERZ_MODE || '').toLowerCase() === 'live' && Boolean(env.SSLCOMMERZ_STORE_ID?.trim()) && Boolean(env.SSLCOMMERZ_STORE_PASSWORD?.trim());
  return Object.entries(PAYMENT_METHODS).map(([id, def]) => ({
    id,
    label: def.label,
    available: def.needs === 'cod' ? true : sslLive,
    reason:
      def.needs === 'cod'
        ? 'Offered at checkout (paid to the courier on delivery)'
        : sslLive
          ? 'Online payments are live through SSLCommerz'
          : 'Online payments are not live yet (SSLCommerz is not configured for live payments)',
  }));
}

/** Publish-time check: every payment method shown must be available right now. */
export function unavailablePaymentMethods(footer: FooterContent, env: NodeJS.ProcessEnv = process.env): string[] {
  const caps = paymentCapabilities(env);
  return footer.paymentMethods.filter((id) => !caps.find((c) => c.id === id)?.available).map((id) => PAYMENT_METHODS[id]?.label ?? id);
}
