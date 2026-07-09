import { randomUUID } from 'crypto';
import { Logger } from '../lib/logger';
import { isAnalyticsEventType } from './analyticsEvents';
import {
  appendAnalyticsEvent,
  appendAnalyticsEvents,
  listAnalyticsEvents,
} from './analyticsStorage';
import {
  countEventsByType,
  mostCompared,
  mostViewed,
  mostWishlisted,
  topBrands,
  topCategories,
  topProducts,
  topSellers,
  trendingSearches,
} from './aggregationUtils';
import type {
  AnalyticsEvent,
  AnalyticsEventInput,
  AnalyticsSummary,
  TimeRange,
} from './analyticsTypes';
import { resolveTimeRange } from './timeRanges';

function normalizeEvent(input: AnalyticsEventInput): AnalyticsEvent {
  if (!isAnalyticsEventType(input.type)) {
    throw new Error(`Unsupported analytics event type: ${String(input.type)}`);
  }

  return {
    ...input,
    id: randomUUID(),
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

export async function recordEvent(input: AnalyticsEventInput): Promise<AnalyticsEvent> {
  const event = normalizeEvent(input);
  await appendAnalyticsEvent(event);
  return event;
}

export function recordEventAsync(input: AnalyticsEventInput): void {
  setTimeout(() => {
    recordEvent(input).catch((error) => {
      Logger.warn('Analytics event recording failed', {
        eventType: input.type,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, 0);
}

export async function batchRecord(inputs: AnalyticsEventInput[]): Promise<AnalyticsEvent[]> {
  const events = inputs.map((input) => normalizeEvent(input));
  await appendAnalyticsEvents(events);
  return events;
}

export async function aggregateEvents(range: TimeRange) {
  const events = await listAnalyticsEvents(range);
  return {
    topProducts: topProducts(events),
    topCategories: topCategories(events),
    topBrands: topBrands(events),
    topSellers: topSellers(events),
    trendingSearches: trendingSearches(events),
    mostViewed: mostViewed(events),
    mostCompared: mostCompared(events),
    mostWishlisted: mostWishlisted(events),
    eventCounts: countEventsByType(events),
  };
}

export async function summarize(
  rangeInput?: string,
  customFrom?: string,
  customTo?: string,
): Promise<AnalyticsSummary> {
  const range = resolveTimeRange(rangeInput, customFrom, customTo);
  const events = await listAnalyticsEvents(range);
  const uniqueUsers = new Set(events.map((event) => event.userId).filter(Boolean)).size;
  const aggregates = await aggregateEvents(range);

  return {
    range,
    totalEvents: events.length,
    uniqueUsers,
    ...aggregates,
    generatedAt: new Date().toISOString(),
  };
}

export async function getTrending(rangeInput?: string, customFrom?: string, customTo?: string) {
  const summary = await summarize(rangeInput, customFrom, customTo);
  return {
    range: summary.range,
    topProducts: summary.topProducts.slice(0, 10),
    topCategories: summary.topCategories.slice(0, 10),
    topBrands: summary.topBrands.slice(0, 10),
    trendingSearches: summary.trendingSearches.slice(0, 10),
    topSellers: summary.topSellers.slice(0, 10),
    mostCompared: summary.mostCompared.slice(0, 10),
    mostWishlisted: summary.mostWishlisted.slice(0, 10),
    mostViewed: summary.mostViewed.slice(0, 10),
    generatedAt: summary.generatedAt,
  };
}
