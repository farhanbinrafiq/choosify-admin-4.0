import type { Request } from 'express';
import { ANALYTICS_EVENTS } from './analyticsEvents';
import { recordEventAsync } from './analyticsService';
import type { AnalyticsPayload } from './analyticsTypes';

function requestContext(req?: Request) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
    userId: req.userId || req.user?.uid,
  };
}

export function recordProductView(req: Request, payload: AnalyticsPayload): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_VIEW,
    ...payload,
    ...requestContext(req),
  });
}

export function recordSearch(req: Request, payload: AnalyticsPayload): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.SEARCH,
    ...payload,
    ...requestContext(req),
  });
}

export function recordWishlist(req: Request, payload: AnalyticsPayload): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_WISHLIST,
    ...payload,
    ...requestContext(req),
  });
}

export function recordCompare(req: Request, payload: AnalyticsPayload): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PRODUCT_COMPARE,
    ...payload,
    ...requestContext(req),
  });
}

export function recordLogin(req: Request, payload: AnalyticsPayload): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.LOGIN,
    ...payload,
    ...requestContext(req),
  });
}
