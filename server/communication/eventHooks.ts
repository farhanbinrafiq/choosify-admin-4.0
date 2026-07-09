import type { Request } from 'express';
import { auditAdminAction, auditPermissionChange } from '../logging/auditLogger';
import { recordEventAsync } from '../analytics/analyticsService';
import { ANALYTICS_EVENTS } from '../analytics/analyticsEvents';
import type { Broadcast, CommunicationNotification } from './communicationTypes';

function requestContext(req?: Request) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
    userId: req.userId || req.user?.uid,
  };
}

export function logNotificationAudit(
  action: string,
  resource: string,
  result: 'success' | 'failure' | 'denied',
  options: {
    resourceId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  } = {},
  req?: Request,
): void {
  auditAdminAction(action, resource, result, {
    resourceId: options.resourceId,
    userId: options.userId,
    metadata: options.metadata,
  }, req);
}

export function logBroadcastAudit(
  action: string,
  resourceId: string,
  result: 'success' | 'failure' | 'denied',
  options: {
    userId?: string;
    metadata?: Record<string, unknown>;
  } = {},
  req?: Request,
): void {
  auditAdminAction(action, 'broadcast', result, {
    resourceId,
    userId: options.userId,
    metadata: options.metadata,
  }, req);
}

export function logPreferenceChangeAudit(userId: string, req?: Request): void {
  auditPermissionChange('update_communication_preferences', 'communication_preferences', 'success', {
    resourceId: userId,
    userId: req?.userId || userId,
  }, req);
}

export function recordNotificationSent(notification: CommunicationNotification, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_SENT,
    userId: notification.userId,
    source: 'communication_platform',
    metadata: {
      notificationId: notification.id,
      category: notification.category,
      type: notification.type,
      priority: notification.priority,
      channels: notification.channels,
    },
    ...requestContext(req),
  });
}

export function recordNotificationRead(notification: CommunicationNotification, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_READ,
    userId: notification.userId,
    source: 'communication_platform',
    metadata: { notificationId: notification.id, category: notification.category },
    ...requestContext(req),
  });
}

export function recordNotificationDismissed(notification: CommunicationNotification, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.NOTIFICATION_DISMISSED,
    userId: notification.userId,
    source: 'communication_platform',
    metadata: { notificationId: notification.id, category: notification.category },
    ...requestContext(req),
  });
}

export function recordBroadcastSent(broadcast: Broadcast, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.BROADCAST_SENT,
    source: 'communication_platform',
    metadata: {
      broadcastId: broadcast.id,
      broadcastType: broadcast.broadcastType,
      targetRoles: broadcast.targetRoles,
      targetSegments: broadcast.targetSegments,
    },
    ...requestContext(req),
  });
}

// Framework hooks for future email/push provider telemetry.
export function recordEmailOpen(notificationId: string, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.EMAIL_OPEN,
    source: 'communication_platform',
    metadata: { notificationId },
    ...requestContext(req),
  });
}

export function recordPushOpen(notificationId: string, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PUSH_OPEN,
    source: 'communication_platform',
    metadata: { notificationId },
    ...requestContext(req),
  });
}
