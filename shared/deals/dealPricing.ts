/**
 * Canonical seller Deals — shared pricing, schedule, lifecycle and promotion rules.
 *
 * Deals are OPEN marketplace inventory: a seller creates a Deal on one of their
 * own live listings, the server validates it, and it follows its dates
 * automatically (Scheduled → Active → Expired). There is no Deal approval.
 * The only admin-reviewed workflow is a Promotion Request for an Active Deal.
 *
 * Storage: the Ads Manager `AdRecord` — kind 'deal' for Deals, kind
 * 'promotion' with `dealId` for Promotion Requests.
 *
 * Deals store pricing TERMS (mode + value), never a trusted final price: the
 * deal price is always derived from a listing base price. The server uses
 * these helpers to validate and decide; the UI uses them only to preview.
 * Nothing here writes product.price / service.price, and cart/checkout do not
 * read deals yet.
 */

export type DealListingType = 'product' | 'service';

export type DealPricingMode = 'percentage' | 'amount' | 'special_price';

export const DEAL_PRICING_MODES: Array<{ key: DealPricingMode; label: string; valueLabel: string }> = [
  { key: 'percentage', label: 'Percentage discount', valueLabel: 'Discount (%)' },
  { key: 'amount', label: 'Fixed amount discount', valueLabel: 'Discount amount (৳)' },
  { key: 'special_price', label: 'Special price', valueLabel: 'Special price (৳)' },
];

/** Stored pricing terms. basePriceAtSubmit / dealPriceAtSubmit are server-computed audit snapshots. */
export interface DealTerms {
  mode: DealPricingMode;
  value: number;
  basePriceAtSubmit: number;
  dealPriceAtSubmit: number;
}

/** Schedule-derived state of an enabled (stored status `active`) canonical Deal. */
export type DealTimeState = 'scheduled' | 'active' | 'expired';

export type DealFilterKey = 'scheduled' | 'active' | 'expired' | 'paused' | 'disabled' | 'legacy';

/** UI-only advisory threshold — never a server rejection. */
export const LONG_DEAL_WARNING_DAYS = 90;
export const LONG_DEAL_WARNING_TEXT =
  'This deal runs for more than 90 days. Please confirm the campaign duration is intentional.';

export const REJECTION_REASON_MAX = 500;
export const SELLER_NOTE_MAX = 500;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function isDealPricingMode(v: unknown): v is DealPricingMode {
  return v === 'percentage' || v === 'amount' || v === 'special_price';
}

export function isDealListingType(v: unknown): v is DealListingType {
  return v === 'product' || v === 'service';
}

/**
 * Derive the deal price from pricing terms and a base price.
 * Always: 1 <= dealPrice < basePrice. A deal can never raise the customer's price.
 */
export function computeDealPrice(mode: DealPricingMode, value: number, basePrice: number): Result<number> {
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { ok: false, error: 'Listing has no valid base price' };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: 'Deal value must be a number' };
  }
  let dealPrice: number;
  switch (mode) {
    case 'percentage':
      if (value <= 0 || value >= 100) return { ok: false, error: 'Percentage must be greater than 0 and less than 100' };
      dealPrice = Math.round(basePrice * (1 - value / 100));
      break;
    case 'amount':
      if (value <= 0) return { ok: false, error: 'Discount amount must be greater than 0' };
      if (value >= basePrice) return { ok: false, error: 'Discount amount must be less than the base price' };
      dealPrice = Math.round(basePrice - value);
      break;
    case 'special_price':
      if (value < 1) return { ok: false, error: 'Special price must be at least ৳1' };
      if (value >= basePrice) return { ok: false, error: 'Special price must be below the current base price' };
      dealPrice = Math.round(value * 100) / 100;
      break;
    default:
      return { ok: false, error: 'Unknown pricing mode' };
  }
  if (dealPrice < 1) return { ok: false, error: 'Deal price must be at least ৳1' };
  if (dealPrice >= basePrice) return { ok: false, error: 'Deal price must be below the base price' };
  return { ok: true, value: dealPrice };
}

const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parse a strict ISO-8601 timestamp (timezone required). */
export function parseIsoTimestamp(v: unknown): number | null {
  if (typeof v !== 'string' || !ISO_TS.test(v.trim())) return null;
  const ms = Date.parse(v.trim());
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Validate a deal schedule. No maximum duration — admin moderation (pause /
 * disable) is the control for unreasonable campaigns.
 */
export function validateDealSchedule(
  startsAt: unknown,
  endsAt: unknown,
  now = Date.now(),
): Result<{ startsAt: string; endsAt: string }> {
  const s = parseIsoTimestamp(startsAt);
  const e = parseIsoTimestamp(endsAt);
  if (s === null) return { ok: false, error: 'startsAt must be a valid ISO timestamp' };
  if (e === null) return { ok: false, error: 'endsAt must be a valid ISO timestamp' };
  if (s >= e) return { ok: false, error: 'startsAt must be before endsAt' };
  if (e <= now) return { ok: false, error: 'endsAt must be in the future' };
  return { ok: true, value: { startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() } };
}

/** Half-open windows [aStart, aEnd) and [bStart, bEnd) overlap. */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

export function dealDurationDays(startsAt: string, endsAt: string): number {
  return (Date.parse(endsAt) - Date.parse(startsAt)) / 86_400_000;
}

export function isLongDeal(startsAt: string, endsAt: string): boolean {
  return dealDurationDays(startsAt, endsAt) > LONG_DEAL_WARNING_DAYS;
}

/** Minimal record shape the state helpers need (mirrors AdRecord). */
export interface DealLike {
  status: string;
  listingId?: string;
  listingType?: DealListingType;
  dealTerms?: DealTerms;
  startsAt?: string;
  endsAt?: string;
}

/** Pre-canonical deals (no listing type / pricing terms / schedule) — never canonical. */
export function isLegacyDeal(d: DealLike): boolean {
  return !(d.listingId && d.listingType && d.dealTerms && d.startsAt && d.endsAt);
}

/**
 * Server-clock time state. Only an enabled (stored `active`) canonical Deal has
 * one; paused / disabled / legacy deals return null.
 */
export function deriveDealTimeState(d: DealLike, now = Date.now()): DealTimeState | null {
  if (d.status !== 'active' || isLegacyDeal(d)) return null;
  const s = Date.parse(d.startsAt as string);
  const e = Date.parse(d.endsAt as string);
  if (now < s) return 'scheduled';
  if (now < e) return 'active';
  return 'expired';
}

export function dealFilterKey(d: DealLike, now = Date.now()): DealFilterKey {
  if (isLegacyDeal(d)) return 'legacy';
  const t = deriveDealTimeState(d, now);
  if (t) return t;
  return d.status === 'paused' ? 'paused' : 'disabled';
}

export function formatDealDiscount(mode: DealPricingMode, value: number): string {
  if (mode === 'percentage') return `${value}% off`;
  if (mode === 'amount') return `৳${Math.round(value).toLocaleString('en-US')} off`;
  return `Special ৳${value.toLocaleString('en-US')}`;
}

export const DEAL_PRICING_MODE_LABEL: Record<DealPricingMode, string> = {
  percentage: 'Percentage',
  amount: 'Fixed amount',
  special_price: 'Special price',
};

// ── Promotion Requests ──────────────────────────────────────────────────────

/**
 * V1 promotion types. FEATURED = editorial/curated treatment. SPONSORED = a
 * paid-visibility request; billing/payment is NOT implemented, so an approved
 * Sponsored request stays "awaiting fulfillment" and is never shown as running
 * or as financially settled.
 */
export type PromotionType = 'featured' | 'sponsored';

export const PROMOTION_TYPES: Array<{ key: PromotionType; label: string; description: string }> = [
  {
    key: 'featured',
    label: 'Featured',
    description: 'Editorial featuring, reviewed by Choosify.',
  },
  {
    key: 'sponsored',
    label: 'Sponsored',
    description:
      'Paid / sponsored visibility request. Choosify reviews the request first — pricing and payment are arranged separately; nothing is charged here.',
  },
];

export const PROMOTION_TYPE_LABEL: Record<PromotionType, string> = { featured: 'Featured', sponsored: 'Sponsored' };

export function isPromotionType(v: unknown): v is PromotionType {
  return v === 'featured' || v === 'sponsored';
}

export type PromotionRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Review trail on a Promotion Request — written only by the server. */
export interface PromotionReview {
  submittedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  cancelledAt?: string;
}

/**
 * Derived run state of an APPROVED request (null otherwise).
 *  featured:  upcoming → running (only while the Deal is Active) → completed;
 *             `inactive` inside the window while the Deal is paused/disabled/expired.
 *  sponsored: awaiting_fulfillment (no payment system yet) → lapsed after the window.
 */
export type PromotionRunState = 'upcoming' | 'running' | 'inactive' | 'completed' | 'awaiting_fulfillment' | 'lapsed';

export function derivePromotionRunState(
  req: { status: string; promotionType?: string; startsAt?: string; endsAt?: string },
  dealActiveNow: boolean,
  now = Date.now(),
): PromotionRunState | null {
  if (req.status !== 'approved' || !req.startsAt || !req.endsAt) return null;
  const s = Date.parse(req.startsAt);
  const e = Date.parse(req.endsAt);
  if (req.promotionType === 'sponsored') return now >= e ? 'lapsed' : 'awaiting_fulfillment';
  if (now < s) return 'upcoming';
  if (now >= e) return 'completed';
  return dealActiveNow ? 'running' : 'inactive';
}

export const PROMOTION_RUN_STATE_LABEL: Record<PromotionRunState, string> = {
  upcoming: 'Approved · upcoming',
  running: 'Promoted',
  inactive: 'Approved · not running (deal not active)',
  completed: 'Promotion completed',
  awaiting_fulfillment: 'Approved · awaiting fulfillment',
  lapsed: 'Approved · lapsed (not fulfilled)',
};
