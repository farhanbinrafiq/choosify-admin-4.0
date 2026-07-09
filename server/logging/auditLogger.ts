import type { Request } from 'express';
import { Logger } from '../lib/logger';
import type { UserRole } from '../permissions/roles';

export const AUDIT_CATEGORIES = {
  ADMIN_ACTION: 'admin_action',
  AUTHENTICATION: 'authentication',
  SELLER_ACTION: 'seller_action',
  CATALOG_MODERATION: 'catalog_moderation',
  PERMISSION_CHANGE: 'permission_change',
  SECURITY_EVENT: 'security_event',
  SYSTEM_EVENT: 'system_event',
} as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[keyof typeof AUDIT_CATEGORIES];

export type AuditResult = 'success' | 'failure' | 'denied';

export type AuditLogInput = {
  category: AuditCategory;
  action: string;
  resource: string;
  result: AuditResult;
  requestId?: string;
  userId?: string;
  userRole?: UserRole | string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

function resolveRequestContext(req?: Request) {
  if (!req) {
    return {};
  }

  return {
    requestId: req.requestId,
    userId: req.userId || req.user?.uid,
    userRole: req.userRole || req.user?.role,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
  };
}

export function auditLog(input: AuditLogInput, req?: Request): void {
  const context = resolveRequestContext(req);

  Logger.audit('Audit event', {
    timestamp: new Date().toISOString(),
    category: input.category,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    result: input.result,
    requestId: input.requestId || context.requestId,
    userId: input.userId || context.userId,
    userRole: input.userRole || context.userRole,
    ip: input.ip || context.ip,
    userAgent: input.userAgent || context.userAgent,
    metadata: input.metadata,
  });
}

export function auditAdminAction(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog({ category: AUDIT_CATEGORIES.ADMIN_ACTION, action, resource, result, ...options }, req);
}

export function auditAuthenticationEvent(
  action: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog(
    {
      category: AUDIT_CATEGORIES.AUTHENTICATION,
      action,
      resource: 'auth',
      result,
      ...options,
    },
    req,
  );
}

export function auditSellerAction(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog({ category: AUDIT_CATEGORIES.SELLER_ACTION, action, resource, result, ...options }, req);
}

export function auditCatalogModeration(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog(
    { category: AUDIT_CATEGORIES.CATALOG_MODERATION, action, resource, result, ...options },
    req,
  );
}

export function auditPermissionChange(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog(
    { category: AUDIT_CATEGORIES.PERMISSION_CHANGE, action, resource, result, ...options },
    req,
  );
}

export function auditSecurityEvent(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog({ category: AUDIT_CATEGORIES.SECURITY_EVENT, action, resource, result, ...options }, req);
}

export function auditSystemEvent(
  action: string,
  resource: string,
  result: AuditResult,
  options: Omit<AuditLogInput, 'category' | 'action' | 'resource' | 'result'> = {},
  req?: Request,
): void {
  auditLog({ category: AUDIT_CATEGORIES.SYSTEM_EVENT, action, resource, result, ...options }, req);
}
