import type { Request } from 'express';
import { recordEventAsync } from '../analytics/analyticsService';
import { ANALYTICS_EVENTS } from '../analytics/analyticsEvents';
import type { AnalyticsPayload } from '../analytics/analyticsTypes';

function requestContext(req?: Request) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
    userId: req.userId || req.user?.uid,
  };
}

export function recordSearchQuery(
  req: Request,
  payload: AnalyticsPayload & { searchQuery: string; resultCount: number },
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH,
    ...payload,
    ...requestContext(req),
    metadata: {
      ...(payload.metadata || {}),
      resultCount: payload.resultCount,
    },
  });
}

export function recordSearchClick(
  req: Request,
  payload: AnalyticsPayload & { searchQuery?: string; productId: string },
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_CLICK,
    ...payload,
    ...requestContext(req),
  });
}

export function recordSearchNoResult(
  req: Request,
  payload: AnalyticsPayload & { searchQuery: string },
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_NO_RESULT,
    ...payload,
    ...requestContext(req),
  });
}

export function recordAutocompleteSelection(
  req: Request,
  payload: AnalyticsPayload & { searchQuery: string; metadata?: Record<string, unknown> },
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_AUTOCOMPLETE_SELECT,
    ...payload,
    ...requestContext(req),
  });
}

export function recordSuggestionSelection(
  req: Request,
  payload: AnalyticsPayload & { searchQuery: string; metadata?: Record<string, unknown> },
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH_SUGGESTION_SELECT,
    ...payload,
    ...requestContext(req),
  });
}
