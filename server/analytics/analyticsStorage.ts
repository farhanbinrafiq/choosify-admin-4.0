import { readPositiveIntEnv } from '../lib/env';
import type { AnalyticsEvent, TimeRange } from './analyticsTypes';
import { isWithinRange } from './timeRanges';

export const ANALYTICS_EVENTS_COLLECTION = 'analytics_events';

const DEFAULT_MAX_EVENTS = 25_000;
const analyticsEvents: AnalyticsEvent[] = [];

function maxEvents(): number {
  return readPositiveIntEnv('ANALYTICS_MAX_IN_MEMORY_EVENTS', DEFAULT_MAX_EVENTS);
}

export async function appendAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  analyticsEvents.push(event);

  const limit = maxEvents();
  if (analyticsEvents.length > limit) {
    analyticsEvents.splice(0, analyticsEvents.length - limit);
  }
}

export async function appendAnalyticsEvents(events: AnalyticsEvent[]): Promise<void> {
  for (const event of events) {
    await appendAnalyticsEvent(event);
  }
}

export async function listAnalyticsEvents(range?: TimeRange): Promise<AnalyticsEvent[]> {
  const snapshot = [...analyticsEvents];
  if (!range) return snapshot;
  return snapshot.filter((event) => isWithinRange(event.timestamp, range));
}

export function getAnalyticsStorageStatus() {
  return {
    mode: 'memory',
    collectionName: ANALYTICS_EVENTS_COLLECTION,
    retainedEvents: analyticsEvents.length,
    maxEvents: maxEvents(),
    persistence: 'not_configured',
  };
}
