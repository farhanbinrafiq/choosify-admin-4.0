/**
 * Ad pricing for sellers and creators (Super Admin / Admin ads are free and their own decision).
 *
 * Charged per day the campaign runs (every started 24 hours from the start time):
 *   - Homepage hero slide ............ 100 BDT / day
 *   - Any other homepage place ......  50 BDT / day
 *   - Any other page ...............   30 BDT / day
 * Change the numbers here to change the price everywhere (server quotes + builder display).
 */
import { getAnyPlacementDef } from './placementRegistry';

export const AD_DAILY_RATES_BDT = {
  hero: 100,
  homepage: 50,
  internal: 30,
} as const;

export type AdRateTier = keyof typeof AD_DAILY_RATES_BDT;

export const RATE_TIER_LABEL: Record<AdRateTier, string> = {
  hero: 'Homepage hero',
  homepage: 'Homepage',
  internal: 'Other pages',
};

export function rateTierFor(placementId: string | undefined): AdRateTier {
  const p = getAnyPlacementDef(placementId || '');
  if (p?.placementId === 'HOME_HERO') return 'hero';
  if (p?.pageKey === 'homepage') return 'homepage';
  return 'internal';
}

export type AdQuote = {
  tier: AdRateTier;
  ratePerDay: number;
  days: number;
  amount: number;
  currency: 'BDT';
  startsAt: string;
  endsAt: string;
  placementId: string;
};

const DAY_MS = 86_400_000;

/** Price for running an ad in `placementId` from `startsAt` to `endsAt`, or an error message. */
export function quoteAd(placementId: string | undefined, startsAt: string | undefined, endsAt: string | undefined): AdQuote | { error: string } {
  if (!placementId) return { error: 'Choose where the ad goes' };
  const s = startsAt ? Date.parse(startsAt) : NaN;
  const e = endsAt ? Date.parse(endsAt) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { error: 'Choose a start and an end date — ads are charged per day' };
  if (e <= s) return { error: 'The end must be after the start' };
  const days = Math.max(1, Math.ceil((e - s) / DAY_MS));
  if (days > 366) return { error: 'An ad can run for at most 366 days at a time' };
  const tier = rateTierFor(placementId);
  const ratePerDay = AD_DAILY_RATES_BDT[tier];
  return { tier, ratePerDay, days, amount: ratePerDay * days, currency: 'BDT', startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString(), placementId };
}

export const formatBdt = (n: number) => `৳${n.toLocaleString('en-US')}`;
