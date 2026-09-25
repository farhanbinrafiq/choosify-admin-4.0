/**
 * Storefront Curation — shared registry for editorial placements (Deals page
 * modules) and Trust & Assurance strips. Used by the server (validation +
 * public resolution) and the Admin UI (editors), so both agree on placement
 * keys, limits, the approved icon registry and coupon eligibility.
 *
 * Persistence: `SiteConfig.storefrontCuration` / `SiteConfig.assuranceStrips`
 * in the existing catalog site document — editorial only. Paid/sponsored
 * placements stay in `CatalogPlacement` (sponsorType); nothing here implies
 * payment or promotion.
 */

// ── Editorial entity placements ─────────────────────────────────────────────

export type CurationEntityType = 'coupon' | 'category' | 'brand';

export const CURATION_PLACEMENTS = {
  'deals.top_coupons': { entityType: 'coupon', label: 'Top Coupons', max: 6 },
  'deals.popular_categories': { entityType: 'category', label: 'Popular Deal Categories', max: 12 },
  'deals.brand_deals': { entityType: 'brand', label: 'Brand Deals', max: 12 },
} as const satisfies Record<string, { entityType: CurationEntityType; label: string; max: number }>;

export type CurationPlacementKey = keyof typeof CURATION_PLACEMENTS;
export const CURATION_PLACEMENT_KEYS = Object.keys(CURATION_PLACEMENTS) as CurationPlacementKey[];

/** One pinned entity. Order = position in the `items` array. */
export interface CurationItem {
  entityId: string;
  enabled: boolean;
}

/** Who last saved a placement — server-written, never accepted from the client. */
export interface CurationEditor {
  id: string;
  name?: string;
}

export interface CurationPlacementConfig {
  enabled: boolean;
  items: CurationItem[];
  /** Server-written on every successful save (ISO timestamp). */
  updatedAt?: string;
  updatedBy?: CurationEditor;
}

export type StorefrontCurationConfig = Partial<Record<CurationPlacementKey, CurationPlacementConfig>>;

/**
 * Persistent curation audit trail (kept on the site doc, newest first, capped).
 * Deliberately minimal: editor id + role only (no names/emails), placement,
 * and counts — never coupon codes or other entity data.
 */
export interface CurationAuditEntry {
  at: string;
  area: 'deals' | 'assurance';
  placement: string;
  editorId: string;
  editorRole: string;
  placementEnabled: boolean;
  itemCount: number;
  enabledItemCount: number;
  droppedCount?: number;
}

export const CURATION_AUDIT_MAX = 200;

/** Storefront Curation editing is Super Admin only (V1). Mirrored by the server guard. */
export const CURATION_EDITOR_ROLE = 'super_admin';

// ── Trust & Assurance strips ────────────────────────────────────────────────

/** Approved icons only (rendered with the platform's lucide components) — no arbitrary SVG/HTML. */
export const ASSURANCE_ICONS = [
  { key: 'shield-check', label: 'Shield (check)' },
  { key: 'badge-check', label: 'Verified badge' },
  { key: 'lock', label: 'Lock' },
  { key: 'credit-card', label: 'Card / payment' },
  { key: 'rotate-ccw', label: 'Return arrow' },
  { key: 'headphones', label: 'Support headset' },
  { key: 'banknote', label: 'Cash' },
  { key: 'truck', label: 'Delivery' },
  { key: 'award', label: 'Award' },
  { key: 'star', label: 'Star' },
  { key: 'users', label: 'People' },
  { key: 'refresh-cw', label: 'Refresh / updated' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'thumbs-up', label: 'Thumbs up' },
  { key: 'heart', label: 'Heart' },
  { key: 'search', label: 'Search' },
] as const;
export type AssuranceIconKey = (typeof ASSURANCE_ICONS)[number]['key'];

/** Soft icon-chip backgrounds used by the Deals strip (the existing palette). */
export const ASSURANCE_TONES = {
  blue: '#DBEAFE',
  orange: '#FFEDD5',
  green: '#DCFCE7',
  purple: '#F3E8FF',
  red: '#FEE2E2',
  slate: '#F1F5F9',
} as const;
export type AssuranceTone = keyof typeof ASSURANCE_TONES;

/**
 * How each placement renders (keeps each page's existing visual treatment):
 *  - chips: icon in a toned circle + title + description (Deals)
 *  - text:  title + description, no icon (Recommendations / Discover)
 *  - icons: icon + title only (Customer dashboard overview)
 */
export type AssuranceVariant = 'chips' | 'text' | 'icons';

export interface AssuranceItem {
  id: string;
  title: string;
  description: string;
  icon: AssuranceIconKey;
  tone: AssuranceTone;
  enabled: boolean;
}

export interface AssurancePlacementConfig {
  enabled: boolean;
  items: AssuranceItem[];
  /** Server-written on every successful save (ISO timestamp). */
  updatedAt?: string;
  updatedBy?: CurationEditor;
}

export const ASSURANCE_LIMITS = { title: 40, description: 80, items: 8 } as const;

/**
 * Registered strips. `defaults` are the exact texts currently live on each
 * page (migration fallback, used only until a placement is first saved) —
 * no claims are added or reworded here.
 */
export const ASSURANCE_PLACEMENTS = {
  'deals.assurance_strip': {
    label: 'Deals page',
    tab: 'Deals',
    page: '/deals',
    variant: 'chips' as AssuranceVariant,
    defaults: [
      { id: 'authentic', title: '100% Authentic', description: 'Verified products & sellers', icon: 'shield-check', tone: 'blue', enabled: true },
      { id: 'price', title: 'Best Price Guarantee', description: 'We beat any lower price', icon: 'lock', tone: 'orange', enabled: true },
      { id: 'returns', title: 'Easy Returns', description: '7-day return policy', icon: 'rotate-ccw', tone: 'green', enabled: true },
      { id: 'payments', title: 'Secure Payments', description: '100% secure checkout', icon: 'credit-card', tone: 'purple', enabled: true },
      { id: 'support', title: '24/7 Support', description: "We're here to help", icon: 'headphones', tone: 'red', enabled: true },
    ] as AssuranceItem[],
  },
  'discover.assurance_strip': {
    label: 'Recommendations / Discover',
    tab: 'Discover',
    page: '/spotlight',
    variant: 'text' as AssuranceVariant,
    defaults: [
      { id: 'expert', title: 'Expert & Verified', description: 'Content by experts and verified creators', icon: 'badge-check', tone: 'blue', enabled: true },
      { id: 'independent', title: '100% Independent', description: 'Unbiased guides you can trust', icon: 'shield-check', tone: 'green', enabled: true },
      { id: 'updated', title: 'Regularly Updated', description: 'Latest trends and recommendations', icon: 'refresh-cw', tone: 'orange', enabled: true },
      { id: 'real', title: 'Real Experiences', description: 'From real users and customers', icon: 'users', tone: 'purple', enabled: true },
      { id: 'smart', title: 'Smart & Helpful', description: 'AI powered discovery just for you', icon: 'sparkles', tone: 'red', enabled: true },
    ] as AssuranceItem[],
  },
  'account.overview_trust': {
    label: 'Customer dashboard overview',
    tab: 'Dashboard',
    page: '/dashboard',
    variant: 'icons' as AssuranceVariant,
    defaults: [
      { id: 'verified', title: 'Verified Sellers', description: '', icon: 'badge-check', tone: 'slate', enabled: true },
      { id: 'payments', title: 'Secure Payments', description: '', icon: 'credit-card', tone: 'slate', enabled: true },
      { id: 'returns', title: 'Easy Returns', description: '', icon: 'rotate-ccw', tone: 'slate', enabled: true },
      { id: 'cod', title: 'COD Available', description: '', icon: 'banknote', tone: 'slate', enabled: true },
      { id: 'support', title: '24/7 Support', description: '', icon: 'headphones', tone: 'slate', enabled: true },
    ] as AssuranceItem[],
  },
} as const;

export type AssurancePlacementKey = keyof typeof ASSURANCE_PLACEMENTS;
export const ASSURANCE_PLACEMENT_KEYS = Object.keys(ASSURANCE_PLACEMENTS) as AssurancePlacementKey[];
export type AssuranceStripsConfig = Partial<Record<AssurancePlacementKey, AssurancePlacementConfig>>;

/** Stored config if the placement has ever been saved, else the live-content defaults. */
export function resolveAssurancePlacement(config: AssuranceStripsConfig | undefined, key: AssurancePlacementKey): AssurancePlacementConfig & { isDefault: boolean } {
  const stored = config?.[key];
  if (stored) return { ...stored, isDefault: false };
  return { enabled: true, items: ASSURANCE_PLACEMENTS[key].defaults.map((i) => ({ ...i })), isDefault: true };
}

// ── Coupon eligibility (canonical OpsCoupon) ────────────────────────────────

/** Minimal coupon shape needed for eligibility/display (mirrors OpsCoupon). */
export interface CurationCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y';
  discountTarget: 'all_products' | 'specific_product' | 'specific_category' | 'specific_brand';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  deleted?: boolean;
  totalRedemptions?: number;
  rules?: { minPurchaseAmount?: number; maxUsages?: number; buyQuantity?: number; getQuantity?: number };
}

/** Date-only bounds are whole days: validFrom = start of that day, validUntil = end of that day. */
function boundMs(value: string, edge: 'start' | 'end'): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`);
  return Date.parse(value);
}

export type CouponIneligibleReason = 'deleted' | 'inactive' | 'not_started' | 'expired' | 'usage_limit_reached' | 'invalid_dates';

/** Why a coupon may not be shown on the storefront right now (null = eligible). */
export function couponIneligibleReason(c: CurationCoupon, now = Date.now()): CouponIneligibleReason | null {
  if (c.deleted) return 'deleted';
  if (!c.active) return 'inactive';
  const from = boundMs(c.validFrom, 'start');
  const until = boundMs(c.validUntil, 'end');
  if (Number.isNaN(from) || Number.isNaN(until)) return 'invalid_dates';
  if (now < from) return 'not_started';
  if (now > until) return 'expired';
  const max = c.rules?.maxUsages;
  if (max && max > 0 && (c.totalRedemptions ?? 0) >= max) return 'usage_limit_reached';
  return null;
}

export const COUPON_REASON_LABEL: Record<CouponIneligibleReason, string> = {
  deleted: 'Deleted',
  inactive: 'Inactive',
  not_started: 'Not started yet',
  expired: 'Expired',
  usage_limit_reached: 'Usage limit reached',
  invalid_dates: 'Invalid dates',
};

/** Public-safe display fields (no usage stats, no internal ids beyond the code). */
export interface PublicCoupon {
  code: string;
  headline: string;
  detail: string;
  validUntil: string;
}

const bdt = (n: number) => `BDT ${Math.round(n).toLocaleString('en-US')}`;

export function couponHeadline(c: CurationCoupon): string {
  switch (c.type) {
    case 'percentage':
      return `${c.discountValue}%`;
    case 'fixed_amount':
      return `৳${Math.round(c.discountValue).toLocaleString('en-US')}`;
    case 'free_shipping':
      return 'Free ship';
    case 'buy_x_get_y':
      return c.rules?.buyQuantity && c.rules?.getQuantity ? `B${c.rules.buyQuantity}G${c.rules.getQuantity}` : 'Offer';
    default:
      return 'Offer';
  }
}

export function couponDetail(c: CurationCoupon): string {
  const min = c.rules?.minPurchaseAmount;
  if (min && min > 0) return `Min. Spend ${bdt(min)}`;
  if (c.discountTarget === 'specific_brand') return 'On selected brands';
  if (c.discountTarget === 'specific_category') return 'On selected categories';
  if (c.discountTarget === 'specific_product') return 'On selected products';
  return 'On all products';
}

export function toPublicCoupon(c: CurationCoupon): PublicCoupon {
  return { code: c.code, headline: couponHeadline(c), detail: couponDetail(c), validUntil: c.validUntil };
}

// ── Brand Deals eligibility (CatalogProduct deal flags) ─────────────────────

/** Minimal product shape needed to decide whether a brand has an active Deal. */
export interface CurationDealProduct {
  brandId?: string;
  isDeal?: boolean;
  status?: string;
  dealValidUntil?: string;
  discountPercent?: number;
}

/** Shown in Admin and returned by the server when a brand fails the Brand Deals rule. */
export const BRAND_NO_ACTIVE_DEAL = 'No active deal';

/**
 * Brand Deal = a real brand with an active Deal. A product counts as an active
 * Deal when: isDeal + live/active status + not expired + discountPercent > 0.
 * Returns brandId → highest active discount ("Up to X%"); a brand absent from
 * the map has no active Deal and is not eligible for Brand Deals.
 */
export function brandLiveDealPercents(products: CurationDealProduct[], now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of products) {
    if (!p.isDeal || !p.brandId || !(p.status === 'live' || p.status === 'active')) continue;
    if (p.dealValidUntil && Date.parse(p.dealValidUntil) < now) continue;
    const pct = Number(p.discountPercent);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    out.set(p.brandId, Math.max(out.get(p.brandId) ?? 0, Math.round(pct)));
  }
  return out;
}
