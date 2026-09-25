/**
 * Storefront Curation — authorization + audit trail.
 *
 * V1 decision: curation editing (Deals Curation + Trust & Assurance) is
 * SUPER ADMIN ONLY. This is a dedicated role check — deliberately NOT the
 * generic CMS_EDIT permission (which admin / marketing_manager / moderator
 * hold) and not a new grantable permission, so no other role can be given
 * curation editing by accident. It uses the effective actor role, so an
 * impersonated non-super-admin session is denied too.
 *
 * Every successful save stamps the placement with updatedAt/updatedBy and
 * prepends a minimal entry to the persistent audit trail on the site doc
 * (no migration), in addition to the standard structured audit log line.
 */
import type { NextFunction, Request, Response } from 'express';
import type { SiteConfig } from '../../lib/vercel-catalog/catalogTypes';
import { auditAdminAction, auditSecurityEvent } from '../logging/auditLogger';
import {
  CURATION_AUDIT_MAX,
  CURATION_EDITOR_ROLE,
  type CurationAuditEntry,
  type CurationEditor,
} from '../../shared/storefront/storefrontCuration';

export function isCurationEditor(role: unknown): boolean {
  return String(role || '').toLowerCase() === CURATION_EDITOR_ROLE;
}

/** Use after authenticateRequest. 401 without a session, 403 for every role except super_admin. */
export function requireCurationEditor(req: Request, res: Response, next: NextFunction): void {
  if (!req.userRole) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!isCurationEditor(req.userRole)) {
    auditSecurityEvent('storefront_curation.write', 'storefront_curation', 'denied', {
      metadata: { path: req.path },
    }, req);
    res.status(403).json({ error: 'Storefront Curation can only be edited by a Super Admin' });
    return;
  }
  next();
}

export function curationEditorOf(req: Request): CurationEditor {
  const name = String(req.user?.displayName || '').trim().slice(0, 80);
  return { id: String(req.userId || req.user?.uid || ''), ...(name ? { name } : {}) };
}

/**
 * Stamp a saved placement and build the next audit trail (newest first,
 * capped). Counts only — no coupon codes / entity data.
 */
export function recordCurationSave<T extends { enabled: boolean; items: Array<{ enabled: boolean }> }>(
  req: Request,
  existing: SiteConfig | null | undefined,
  area: CurationAuditEntry['area'],
  placement: string,
  value: T,
  droppedCount = 0,
): { stamped: T & { updatedAt: string; updatedBy: CurationEditor }; audit: CurationAuditEntry[] } {
  const at = new Date().toISOString();
  const editor = curationEditorOf(req);
  const stamped = { ...value, updatedAt: at, updatedBy: editor };
  const entry: CurationAuditEntry = {
    at,
    area,
    placement,
    editorId: editor.id,
    editorRole: String(req.userRole || ''),
    placementEnabled: value.enabled,
    itemCount: value.items.length,
    enabledItemCount: value.items.filter((i) => i.enabled).length,
    ...(droppedCount ? { droppedCount } : {}),
  };
  const audit = [entry, ...(existing?.storefrontCurationAudit ?? [])].slice(0, CURATION_AUDIT_MAX);
  auditAdminAction('storefront_curation.save', 'storefront_curation', 'success', {
    resourceId: `${area}:${placement}`,
    metadata: {
      placementEnabled: entry.placementEnabled,
      itemCount: entry.itemCount,
      enabledItemCount: entry.enabledItemCount,
      droppedCount,
    },
  }, req);
  return { stamped, audit };
}

/**
 * GET /catalog/site is public (footer, socials, CTA banners…). Curation
 * internals — raw pins incl. ineligible ones, editor metadata and the audit
 * trail — are only returned to the curation editor; the storefront reads the
 * resolved, public-safe /catalog/storefront/* endpoints instead.
 */
export function siteForViewer(site: SiteConfig | null, role: unknown): SiteConfig | null {
  if (!site || isCurationEditor(role)) return site;
  const { storefrontCuration: _c, assuranceStrips: _a, storefrontCurationAudit: _t, ...rest } = site;
  return rest as SiteConfig;
}
