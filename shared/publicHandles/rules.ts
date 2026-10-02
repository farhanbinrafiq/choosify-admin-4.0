/**
 * Public handle rules (Public Identity Phase B) — Admin copy.
 *
 * One global handle namespace shared by BRANDS and CREATORS only. A Brand is the
 * seller's public storefront (Seller Management is its back-office view), so
 * there are no seller, user, product, guide, deal or service handles. Products
 * and guides keep their own per-type slugs.
 *
 * A handle is a presentation identifier: the canonical identity stays the
 * entity's catalog id. This is the same contract as the storefront's
 * lib/publicHandles.ts (Web repo) and the public_handles.handle CHECK constraint
 * (migration 0012). Both validators are tested against byte-identical vectors
 * (./vectors.json here, lib/publicHandleVectors.json in Web) — keep all three in step:
 *   - 3–30 characters, lowercase ASCII letters, digits and single hyphens
 *   - starts with a letter; no leading/trailing or consecutive hyphens
 *   - no whitespace, punctuation or Unicode (display names may use any script)
 *   - not a reserved name, and not starting with a catalog id prefix (brand-, creator-, prod-)
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

/** Same pattern as the public_handles_handle_format_check constraint. */
export const HANDLE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export type HandleEntityType = 'brand' | 'creator';

export type HandleRejection =
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'non_ascii'
  | 'invalid_characters'
  | 'must_start_with_letter'
  | 'leading_or_trailing_hyphen'
  | 'consecutive_hyphens'
  | 'reserved'
  | 'reserved_prefix';

export type HandleValidation = { ok: true; handle: string } | { ok: false; handle: string; reason: HandleRejection };

/**
 * Names that can never be a public handle, each with the reason it is held.
 * `route`  — a top-level storefront path (src/App.tsx) or server/static path
 *            (server.ts, public/); a handle URL must never shadow it.
 * `dashboard` — a top-level path of the Choosify dashboard app.
 * `security` — would let an account pose as the platform or its staff.
 * The storefront repo's probe fails when a new top-level storefront route is added
 * without being listed; scripts/probe-public-handles.ts here keeps this copy equal
 * to the shared vectors.
 */
export const RESERVED_HANDLES: Readonly<Record<string, 'route' | 'dashboard' | 'security'>> = Object.freeze({
  // Storefront routes (src/App.tsx)
  about: 'route',
  advertise: 'route',
  blogs: 'route',
  'brand-deals': 'route',
  brands: 'route',
  careers: 'route',
  cart: 'route',
  categories: 'route',
  checkout: 'route',
  'cms-preview': 'route',
  compare: 'route',
  contact: 'route',
  creators: 'route',
  'customer-favorite': 'route',
  dashboard: 'route',
  deals: 'route',
  emi: 'route',
  faq: 'route',
  'forgot-password': 'route',
  guides: 'route',
  invoice: 'route',
  login: 'route',
  marketing: 'route',
  messages: 'route',
  'order-success': 'route',
  'order-tracking': 'route',
  orders: 'route',
  partnership: 'route',
  payment: 'route',
  'post-offer': 'route',
  privacy: 'route',
  products: 'route',
  profile: 'route',
  publisher: 'route',
  recommendations: 'route',
  'reset-password': 'route',
  reviews: 'route',
  search: 'route',
  spotlight: 'route',
  'suggest-brand': 'route',
  terms: 'route',
  'verify-email': 'route',
  'warranty-claims': 'route',
  'whats-on': 'route',
  // Server and static paths (server.ts, public/, build output)
  api: 'route',
  assets: 'route',
  brand: 'route',
  fonts: 'route',
  hero: 'route',
  icons: 'route',
  // Choosify dashboard app top-level paths
  admin: 'dashboard',
  consumer: 'dashboard',
  creator: 'dashboard',
  'force-password-change': 'dashboard',
  marketplace: 'dashboard',
  order: 'dashboard',
  seller: 'dashboard',
  signup: 'dashboard',
  upe: 'dashboard',
  // Platform / staff impersonation
  choosify: 'security',
  staff: 'security',
  support: 'security',
  system: 'security',
});

/**
 * Catalog ids look like `brand-<uuid>`, `creator-<timestamp>` and `prod-<n>`. A
 * handle with one of these prefixes could equal an existing or future catalog id
 * and shadow that entity's id URL (/brands/brand-apple), so none may be claimed.
 */
export const RESERVED_HANDLE_PREFIXES: readonly string[] = Object.freeze(['brand-', 'creator-', 'prod-']);

export function hasReservedPrefix(handle: string): boolean {
  return RESERVED_HANDLE_PREFIXES.some((prefix) => handle.startsWith(prefix));
}

export function isReservedHandle(handle: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESERVED_HANDLES, handle);
}

/** Canonical stored form: trimmed, one leading "@" removed, lowercased. Not validated. */
export function normalizeHandle(input: string): string {
  return String(input ?? '').trim().replace(/^@/, '').toLowerCase();
}

/** Normalize, then check every rule. The returned `handle` is the normalized form. */
export function validateHandle(input: string): HandleValidation {
  const handle = normalizeHandle(input);
  const reject = (reason: HandleRejection): HandleValidation => ({ ok: false, handle, reason });
  if (!handle) return reject('empty');
  if (/[^\x00-\x7f]/.test(handle)) return reject('non_ascii');
  if (/[^a-z0-9-]/.test(handle)) return reject('invalid_characters');
  if (handle.length < HANDLE_MIN_LENGTH) return reject('too_short');
  if (handle.length > HANDLE_MAX_LENGTH) return reject('too_long');
  if (handle.startsWith('-') || handle.endsWith('-')) return reject('leading_or_trailing_hyphen');
  if (handle.includes('--')) return reject('consecutive_hyphens');
  if (!/^[a-z]/.test(handle)) return reject('must_start_with_letter');
  if (!HANDLE_PATTERN.test(handle)) return reject('invalid_characters');
  if (isReservedHandle(handle)) return reject('reserved');
  if (hasReservedPrefix(handle)) return reject('reserved_prefix');
  return { ok: true, handle };
}
