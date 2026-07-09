import { ANALYTICS_EVENTS, type AnalyticsEventType } from './analyticsEvents';
import type { AnalyticsEvent, TimeRange, TrendResult } from './analyticsTypes';
import { isWithinRange } from './timeRanges';

type GroupSelector = (event: AnalyticsEvent) => {
  id?: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

function countGrouped(
  events: AnalyticsEvent[],
  selector: GroupSelector,
  eventTypes?: readonly AnalyticsEventType[],
): TrendResult[] {
  const allowed = eventTypes ? new Set(eventTypes) : null;
  const map = new Map<string, TrendResult>();

  for (const event of events) {
    if (allowed && !allowed.has(event.type)) continue;

    const group = selector(event);
    if (!group.id || !group.label) continue;

    const existing = map.get(group.id) || {
      id: group.id,
      label: group.label,
      count: 0,
      growthRate: 0,
      metadata: group.metadata,
    };

    existing.count += 1;
    map.set(group.id, existing);
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
}

function previousRange(range: TimeRange): TimeRange {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const duration = Math.max(1, to - from);
  return {
    preset: 'custom',
    from: new Date(from - duration).toISOString(),
    to: new Date(from).toISOString(),
  };
}

export function calculateGrowthRate(
  currentEvents: AnalyticsEvent[],
  allEvents: AnalyticsEvent[],
  range: TimeRange,
  predicate: (event: AnalyticsEvent) => boolean,
): number {
  const current = currentEvents.filter(predicate).length;
  const priorRange = previousRange(range);
  const prior = allEvents.filter((event) => isWithinRange(event.timestamp, priorRange) && predicate(event)).length;

  if (prior === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

export function topProducts(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(events, (event) => ({
    id: event.productId,
    label: event.productTitle || event.productId,
    metadata: { brandName: event.brandName, categoryName: event.categoryName },
  }));
}

export function topCategories(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(events, (event) => ({
    id: event.categoryId || event.categoryName,
    label: event.categoryName || event.categoryId,
  }));
}

export function topBrands(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(events, (event) => ({
    id: event.brandId || event.brandName,
    label: event.brandName || event.brandId,
  }));
}

export function topSellers(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(events, (event) => ({
    id: event.sellerId || event.sellerName,
    label: event.sellerName || event.sellerId,
  }));
}

export function trendingSearches(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(
    events,
    (event) => ({
      id: event.searchQuery?.trim().toLowerCase(),
      label: event.searchQuery?.trim(),
    }),
    [ANALYTICS_EVENTS.SEARCH, ANALYTICS_EVENTS.PRODUCT_SEARCH],
  );
}

export function mostViewed(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName },
    }),
    [ANALYTICS_EVENTS.PRODUCT_VIEW],
  );
}

export function mostCompared(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName },
    }),
    [ANALYTICS_EVENTS.PRODUCT_COMPARE],
  );
}

export function mostWishlisted(events: AnalyticsEvent[]): TrendResult[] {
  return countGrouped(
    events,
    (event) => ({
      id: event.productId,
      label: event.productTitle || event.productId,
      metadata: { brandName: event.brandName, categoryName: event.categoryName },
    }),
    [ANALYTICS_EVENTS.PRODUCT_WISHLIST],
  );
}

export function countEventsByType(events: AnalyticsEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
}
