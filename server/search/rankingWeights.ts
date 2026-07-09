/**
 * Configurable ranking weights for the discovery engine.
 * Weights are percentages and should sum to 100.
 * Override via environment variables (e.g. RANKING_WEIGHT_KEYWORD=40).
 */
export type RankingWeightKey =
  | 'keyword'
  | 'popularity'
  | 'trust'
  | 'seller'
  | 'freshness'
  | 'reviews'
  | 'inventory';

export type RankingWeights = Record<RankingWeightKey, number>;

const DEFAULT_WEIGHTS: RankingWeights = {
  keyword: 40,
  popularity: 15,
  trust: 15,
  seller: 10,
  freshness: 5,
  reviews: 10,
  inventory: 5,
};

const ENV_MAP: Record<RankingWeightKey, string> = {
  keyword: 'RANKING_WEIGHT_KEYWORD',
  popularity: 'RANKING_WEIGHT_POPULARITY',
  trust: 'RANKING_WEIGHT_TRUST',
  seller: 'RANKING_WEIGHT_SELLER',
  freshness: 'RANKING_WEIGHT_FRESHNESS',
  reviews: 'RANKING_WEIGHT_REVIEWS',
  inventory: 'RANKING_WEIGHT_INVENTORY',
};

function parseWeight(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getRankingWeights(): RankingWeights {
  return {
    keyword: parseWeight(process.env[ENV_MAP.keyword], DEFAULT_WEIGHTS.keyword),
    popularity: parseWeight(process.env[ENV_MAP.popularity], DEFAULT_WEIGHTS.popularity),
    trust: parseWeight(process.env[ENV_MAP.trust], DEFAULT_WEIGHTS.trust),
    seller: parseWeight(process.env[ENV_MAP.seller], DEFAULT_WEIGHTS.seller),
    freshness: parseWeight(process.env[ENV_MAP.freshness], DEFAULT_WEIGHTS.freshness),
    reviews: parseWeight(process.env[ENV_MAP.reviews], DEFAULT_WEIGHTS.reviews),
    inventory: parseWeight(process.env[ENV_MAP.inventory], DEFAULT_WEIGHTS.inventory),
  };
}

export const RANKING_WEIGHT_DEFAULTS = { ...DEFAULT_WEIGHTS };
