/**
 * Paid ads for sellers and creators.
 *
 * Every seller / creator banner ad carries metadata.billing:
 *   { tier, ratePerDay, days, amount, currency, startsAt, endsAt, placementId,
 *     status: 'unpaid' | 'paid' | 'waived', quotedAt, paidAt?, paidBy?, method?, reference?, note? }
 * The quote is recomputed by the server whenever the place or the dates change (never taken from
 * the request). The ad cannot be approved or published until the charge is paid or waived — only
 * an admin can mark it so (there is no online ad payment yet). After payment, the place and the
 * dates are locked so the price cannot drift.
 */
import { quoteAd, type AdQuote } from '../../shared/ads/pricing';
import type { AdRecord } from './types';

export type AdBilling = AdQuote & {
  status: 'unpaid' | 'paid' | 'waived';
  quotedAt: string;
  paidAt?: string;
  paidBy?: string;
  method?: string;
  reference?: string;
  note?: string;
};

/** Ads the advertiser pays for (seller / creator owned banner ads). */
export const isPaidAd = (ad: Pick<AdRecord, 'ownerRole' | 'kind'>) =>
  (ad.ownerRole === 'seller' || ad.ownerRole === 'creator') && (ad.kind === 'banner' || ad.kind === 'external');

export const billingOf = (ad: AdRecord): AdBilling | null => {
  const b = (ad.metadata as Record<string, unknown> | undefined)?.billing;
  return b && typeof b === 'object' ? (b as AdBilling) : null;
};

/** Never accept billing from a request body (create / update). */
export function stripBilling(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const { billing: _drop, ...rest } = metadata as Record<string, unknown>;
  void _drop;
  return rest;
}

/** Is the paid-for part (place / dates) being changed after payment? */
export function changesPaidTerms(ad: AdRecord, next: { placementId?: string; startsAt?: string; endsAt?: string }): boolean {
  const b = billingOf(ad);
  if (!b || b.status === 'unpaid') return false;
  const same = (a?: string, c?: string) => (a ? Date.parse(a) : NaN) === (c ? Date.parse(c) : NaN) || (!a && !c);
  return (
    (next.placementId !== undefined && next.placementId !== b.placementId) ||
    (next.startsAt !== undefined && !same(next.startsAt, b.startsAt)) ||
    (next.endsAt !== undefined && !same(next.endsAt, b.endsAt))
  );
}

/**
 * The ad with its billing (re)computed: keeps a paid / waived charge as it is; otherwise a fresh
 * unpaid quote from the ad's current place and dates. Returns the ad unchanged for free ads.
 */
export function withBilling(ad: AdRecord, previous?: AdRecord | null): AdRecord {
  if (!isPaidAd(ad)) return ad;
  const prior = billingOf(previous ?? ad) ?? billingOf(ad);
  const meta = { ...((ad.metadata || {}) as Record<string, unknown>) };
  if (prior && prior.status !== 'unpaid') {
    meta.billing = prior;
    return { ...ad, metadata: meta };
  }
  const q = quoteAd(ad.placementId, ad.startsAt, ad.endsAt);
  if ('error' in q) {
    delete meta.billing;
    return { ...ad, metadata: meta };
  }
  const billing: AdBilling = { ...q, status: 'unpaid', quotedAt: new Date().toISOString() };
  meta.billing = billing;
  return { ...ad, metadata: meta };
}

/** Why a paid ad cannot go live yet, or null. */
export function billingBlocker(ad: AdRecord): string | null {
  if (!isPaidAd(ad)) return null;
  const b = billingOf(ad);
  if (!b) return 'Choose a start and an end date — ads are charged per day';
  if (b.status === 'unpaid') return `Payment not received yet (${b.currency} ${b.amount} for ${b.days} day${b.days === 1 ? '' : 's'})`;
  return null;
}
