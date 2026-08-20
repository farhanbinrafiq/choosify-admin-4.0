/**
 * Configurable tolerances for the Product/Brand Quick Comparison feature.
 * Follows the same shape as server/search/rankingWeights.ts — defaults +
 * optional env override + accessor function — rather than a new one-off
 * central config module.
 */
export type CompareConfig = {
  /** Product Quick Comparison price window, as a percent of current price. */
  productPriceTolerancePercent: number;
  /** Brand Quick Comparison rating window (absolute rating points). */
  brandRatingTolerance: number;
  /** Max candidate cards shown alongside the current item (excludes current). */
  maxComparisonCards: number;
};

const DEFAULTS: CompareConfig = {
  productPriceTolerancePercent: 15,
  brandRatingTolerance: 0.3,
  maxComparisonCards: 4,
};

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getCompareConfig(): CompareConfig {
  return {
    productPriceTolerancePercent: parseNumber(
      process.env.COMPARE_PRODUCT_PRICE_TOLERANCE_PERCENT,
      DEFAULTS.productPriceTolerancePercent,
    ),
    brandRatingTolerance: parseNumber(process.env.COMPARE_BRAND_RATING_TOLERANCE, DEFAULTS.brandRatingTolerance),
    maxComparisonCards: parseNumber(process.env.COMPARE_MAX_CARDS, DEFAULTS.maxComparisonCards),
  };
}

export const COMPARE_CONFIG_DEFAULTS = { ...DEFAULTS };
