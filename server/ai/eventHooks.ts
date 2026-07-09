import type { Request } from 'express';
import { auditSystemEvent } from '../logging/auditLogger';
import { recordEventAsync } from '../analytics/analyticsService';
import { ANALYTICS_EVENTS } from '../analytics/analyticsEvents';
import type { AiSkillId } from './types';

function requestContext(req?: Request) {
  if (!req) return {};
  return {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
    userId: req.userId || req.user?.uid,
  };
}

export function logAiAudit(
  action: string,
  skillId: string,
  result: 'success' | 'failure' | 'denied',
  options: {
    userId?: string;
    executionTimeMs?: number;
    provider?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  } = {},
  req?: Request,
): void {
  auditSystemEvent(action, 'ai_skill', result, {
    resourceId: skillId,
    userId: options.userId,
    metadata: {
      executionTimeMs: options.executionTimeMs,
      provider: options.provider,
      model: options.model,
      ...options.metadata,
    },
  }, req);
}

export function recordAiRequest(
  skillId: AiSkillId | 'chat' | 'classify' | 'moderate',
  metadata: Record<string, unknown>,
  req?: Request,
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_REQUEST,
    source: 'emi_ai_platform',
    metadata: { skillId, ...metadata },
    ...requestContext(req),
  });
}

export function recordAiSkillExecuted(
  skillId: AiSkillId,
  metadata: Record<string, unknown>,
  req?: Request,
): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_SKILL_EXECUTED,
    source: 'emi_ai_platform',
    metadata: { skillId, ...metadata },
    ...requestContext(req),
  });
}

export function recordAiChat(metadata: Record<string, unknown>, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_CHAT,
    source: 'emi_ai_platform',
    metadata,
    ...requestContext(req),
  });
}

export function recordAiError(skillId: string, message: string, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.AI_ERROR,
    source: 'emi_ai_platform',
    metadata: { skillId, message },
    ...requestContext(req),
  });
}

// Framework hooks for future provider telemetry.
export function recordEmailOpenFramework(notificationId: string, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.EMAIL_OPEN,
    source: 'emi_ai_platform',
    metadata: { notificationId, framework: true },
    ...requestContext(req),
  });
}

export function recordPushOpenFramework(notificationId: string, req?: Request): void {
  recordEventAsync({
    type: ANALYTICS_EVENTS.PUSH_OPEN,
    source: 'emi_ai_platform',
    metadata: { notificationId, framework: true },
    ...requestContext(req),
  });
}
