import type { AnalyticsEventType } from './analyticsEvents';

export type TimeRangePreset = 'today' | '7d' | '30d' | '90d' | '12m' | 'custom';

export type TimeRange = {
  preset: TimeRangePreset;
  from: string;
  to: string;
};

export type AnalyticsEntity = {
  productId?: string;
  productTitle?: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  sellerId?: string;
  sellerName?: string;
  searchQuery?: string;
};

export type AnalyticsPayload = AnalyticsEntity & {
  userId?: string;
  sessionId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type AnalyticsEvent = AnalyticsPayload & {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

export type AnalyticsEventInput = AnalyticsPayload & {
  type: AnalyticsEventType;
  timestamp?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

export type TrendResult = {
  id: string;
  label: string;
  count: number;
  growthRate: number;
  metadata?: Record<string, unknown>;
};

export type AnalyticsSummary = {
  range: TimeRange;
  totalEvents: number;
  uniqueUsers: number;
  topProducts: TrendResult[];
  topCategories: TrendResult[];
  topBrands: TrendResult[];
  topSellers: TrendResult[];
  trendingSearches: TrendResult[];
  mostViewed: TrendResult[];
  mostCompared: TrendResult[];
  mostWishlisted: TrendResult[];
  eventCounts: Record<string, number>;
  generatedAt: string;
};
