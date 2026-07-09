import type { Request } from 'express';
import { auditCatalogModeration } from '../logging/auditLogger';
import { recordEventAsync } from '../analytics/analyticsService';
import { ANALYTICS_EVENTS } from '../analytics/analyticsEvents';
import type { AnalyticsPayload } from '../analytics/analyticsTypes';
import type { ModerationDecision, ModerationReason } from './moderationTypes';

type ModerationAuditInput = {
  action: string;
  resource: string;
  resourceId?: string;
  decision?: ModerationDecision;
  reason?: ModerationReason;
  moderatorId?: string;
  metadata?: Record<string, unknown>;
};

function requestContext(req?: Request) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
    userId: req.userId || req.user?.uid,
  };
}

export function logModerationAudit(input: ModerationAuditInput, req?: Request): void {
  auditCatalogModeration(input.action, input.resource, 'success', {
    resourceId: input.resourceId,
    userId: input.moderatorId || req?.userId,
    metadata: {
      decision: input.decision,
      reason: input.reason,
      ...input.metadata,
    },
  }, req);
}

export function recordModerationAnalytics(
  eventType: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  payload: AnalyticsPayload,
  req?: Request,
): void {
  recordEventAsync({
    type: eventType,
    ...payload,
    ...requestContext(req),
  });
}

export function recordSellerVerified(
  sellerId: string,
  sellerName: string | undefined,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.SELLER_VERIFIED,
    { sellerId, sellerName, source: 'moderation' },
    req,
  );
}

export function recordSellerRejected(
  sellerId: string,
  sellerName: string | undefined,
  reason?: ModerationReason,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.SELLER_REJECTED,
    { sellerId, sellerName, source: 'moderation', metadata: { reason } },
    req,
  );
}

export function recordProductApproved(
  productId: string,
  productTitle: string | undefined,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.PRODUCT_APPROVED,
    { productId, productTitle, source: 'moderation' },
    req,
  );
}

export function recordProductRejected(
  productId: string,
  productTitle: string | undefined,
  reason?: ModerationReason,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.PRODUCT_REJECTED,
    { productId, productTitle, source: 'moderation', metadata: { reason } },
    req,
  );
}

export function recordReportCreated(
  reportId: string,
  resourceType: string,
  resourceId: string,
  category: string,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.REPORT_CREATED,
    {
      source: 'moderation',
      metadata: { reportId, resourceType, resourceId, category },
    },
    req,
  );
}

export function recordReportResolved(
  reportId: string,
  resourceType: string,
  resourceId: string,
  decision?: ModerationDecision,
  req?: Request,
): void {
  recordModerationAnalytics(
    ANALYTICS_EVENTS.REPORT_RESOLVED,
    {
      source: 'moderation',
      metadata: { reportId, resourceType, resourceId, decision },
    },
    req,
  );
}
