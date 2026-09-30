import { Router, type Request, type Response } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import {
  entitlementStore,
  getEnabledMapForActor,
  type PartnerFeatureKey,
  type PartnerRole,
} from './entitlementStore';
import {
  EntitlementAdminError,
  getAccountEntitlementSummary,
  getAccountOverrideWithDecision,
  getPlatformFeatureState,
  listEntitlementAuditEvents,
  listPlatformFeatureStates,
  removeAccountOverride,
  setAccountOverride,
  setPlatformFeatureState,
  setRoleDefaults,
  type EntitlementActor,
} from './entitlementAdminStore';
import { planStore } from './planStore';
import { featureRequestStore, type FeatureRequestStatus } from './featureRequestStore';
import { notifyRoles, notifyUser } from '../communication/systemNotify';
import {
  PARTNER_FEATURES,
  PARTNER_FEATURE_GROUPS,
  featureByKey,
  featureKeysForRole,
  isSwitchableFeature,
} from '../../shared/entitlements/registry';

export const entitlementsRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

/** Current actor's resolved entitlements (for nav/route gating). */
function sendEntitlementUnavailable(res: Response, context: string, error: unknown) {
  console.error(`[Entitlements] ${context} failed:`, error instanceof Error ? error.message : error);
  if (!res.headersSent) {
    res.status(503).json({
      success: false,
      error: 'Feature access could not be loaded right now. Please try again shortly.',
      code: 'ENTITLEMENT_CHECK_UNAVAILABLE',
    });
  }
}

entitlementsRouter.get('/entitlements/me', ...requireAuth, async (req, res) => {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  let enabled: Record<string, boolean>;
  let plan: Awaited<ReturnType<typeof planStore.getAccountPlan>> | null;
  try {
    enabled = await getEnabledMapForActor({ role, userId });
    plan = userId ? await planStore.getAccountPlan(userId) : null;
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/me', error);
    return;
  }
  res.json({
    success: true,
    role,
    entitlements: enabled,
    plan,
    catalog: PARTNER_FEATURES.filter((f) => {
      if (f.deprecated) return false;
      const r = String(role || '').toLowerCase();
      if (r === 'seller' || r === 'verified_seller') return f.roles.includes('seller');
      if (r === 'creator') return f.roles.includes('creator');
      return false;
    }),
  });
});

/** Admin: full catalog + role defaults + account overrides + platform switches. */
entitlementsRouter.get('/entitlements/admin', ...requireAdmin, async (_req, res) => {
  let snapshot: Awaited<ReturnType<typeof entitlementStore.snapshot>>;
  try {
    snapshot = await entitlementStore.snapshot();
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/admin', error);
    return;
  }
  res.json({
    success: true,
    catalog: entitlementStore.catalog(),
    groups: PARTNER_FEATURE_GROUPS,
    roleDefaults: snapshot.roleDefaults,
    accountOverrides: snapshot.accountOverrides,
    platformStates: snapshot.platformStates,
    precedence: [
      'unknownOrDeprecated',
      'roleEligibility',
      'core',
      'platformSwitch',
      'overrideRevoke',
      'overrideRestrict(active)',
      'overrideGrant',
      'planEntitlement(planControlled, open subscription)',
      'roleDefault',
      'dependencies',
    ],
    note: 'Disabling a feature blocks access only. Feature-owned business data is never deleted.',
  });
});

/** Entitlement writes are Super Admin only (Phase 2A); reads stay available to Admin. */
const requireSuperAdmin = [authenticateRequest, requireRole(ROLES.SUPER_ADMIN)];

function actorFrom(req: Request): EntitlementActor {
  return { userId: req.userId || req.user?.uid || null, realActorUserId: req.realActorUserId || null, source: 'admin_api' };
}

function sendAdminError(res: Response, error: unknown, fallback: string) {
  if (error instanceof EntitlementAdminError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code });
    return;
  }
  // Anything else (DB unavailable, audit insert failure -> transaction rolled back).
  sendEntitlementUnavailable(res, fallback, error);
}

entitlementsRouter.put('/entitlements/admin/role-defaults', ...requireSuperAdmin, async (req, res) => {
  const role = String((req.body as { role?: string })?.role || '').toLowerCase() as PartnerRole;
  if (role !== 'seller' && role !== 'creator') {
    res.status(400).json({ success: false, error: 'role must be seller or creator' });
    return;
  }
  const features = (req.body as { features?: Record<string, boolean> })?.features;
  if (!features || typeof features !== 'object') {
    res.status(400).json({ success: false, error: 'features map is required' });
    return;
  }
  try {
    const result = await setRoleDefaults({
      role,
      changes: features,
      actor: actorFrom(req),
      reason: (req.body as { reason?: string })?.reason,
    });
    res.json({ success: true, roleDefaults: result.roleDefaults, changed: result.changed });
  } catch (error) {
    sendAdminError(res, error, 'PUT /entitlements/admin/role-defaults');
  }
});

entitlementsRouter.patch('/entitlements/admin/role-defaults/:role/:featureKey', ...requireSuperAdmin, async (req, res) => {
  const role = String(req.params.role || '').toLowerCase() as PartnerRole;
  const featureKey = String(req.params.featureKey || '');
  if (role !== 'seller' && role !== 'creator') {
    res.status(400).json({ success: false, error: 'role must be seller or creator' });
    return;
  }
  if (!featureKeysForRole(role).includes(featureKey as PartnerFeatureKey)) {
    res.status(400).json({ success: false, error: 'Unknown feature for role' });
    return;
  }
  if (!isSwitchableFeature(featureByKey(featureKey))) {
    res.status(400).json({
      success: false,
      error: 'Core and reserved capabilities cannot be switched off',
      code: 'FEATURE_NOT_SWITCHABLE',
    });
    return;
  }
  const enabled = Boolean((req.body as { enabled?: boolean })?.enabled);
  try {
    const result = await setRoleDefaults({
      role,
      changes: { [featureKey]: enabled },
      actor: actorFrom(req),
      reason: (req.body as { reason?: string })?.reason,
      strict: true,
    });
    res.json({
      success: true,
      roleDefaults: result.roleDefaults,
      changed: result.changed,
      note: 'Access toggled only — existing feature data is preserved.',
    });
  } catch (error) {
    sendAdminError(res, error, 'PATCH /entitlements/admin/role-defaults');
  }
});

// ─── Phase 2B: account overrides ────────────────────────────────────────────

/** One account: identity, overrides and the effective decision for every feature of its role. */
entitlementsRouter.get('/entitlements/admin/accounts/:userId', ...requireAdmin, async (req, res) => {
  try {
    const summary = await getAccountEntitlementSummary(String(req.params.userId));
    res.json({ success: true, ...summary });
  } catch (error) {
    sendAdminError(res, error, 'GET /entitlements/admin/accounts/:userId');
  }
});

entitlementsRouter.put('/entitlements/admin/accounts/:userId/overrides/:featureKey', ...requireSuperAdmin, async (req, res) => {
  const userId = String(req.params.userId);
  const featureKey = String(req.params.featureKey);
  const body = (req.body || {}) as { effect?: string; expiresAt?: string | null; reason?: string };
  try {
    const { changed } = await setAccountOverride(
      {
        userId,
        featureKey,
        effect: body.effect as 'grant' | 'revoke' | 'restrict',
        expiresAt: body.expiresAt,
        reason: String(body.reason ?? ''),
      },
      actorFrom(req),
    );
    const current = await getAccountOverrideWithDecision(userId, featureKey);
    res.json({ success: true, changed, override: current.override, decision: current.decision });
  } catch (error) {
    sendAdminError(res, error, 'PUT /entitlements/admin/accounts/:userId/overrides/:featureKey');
  }
});

entitlementsRouter.delete('/entitlements/admin/accounts/:userId/overrides/:featureKey', ...requireSuperAdmin, async (req, res) => {
  try {
    const { changed } = await removeAccountOverride(
      {
        userId: String(req.params.userId),
        featureKey: String(req.params.featureKey),
        reason: String(((req.body || {}) as { reason?: string }).reason ?? ''),
      },
      actorFrom(req),
    );
    res.json({ success: true, changed });
  } catch (error) {
    sendAdminError(res, error, 'DELETE /entitlements/admin/accounts/:userId/overrides/:featureKey');
  }
});

// ─── Phase 2B: platform feature switches ────────────────────────────────────

/** Every switchable feature; a missing row is reported as enabled. */
entitlementsRouter.get('/entitlements/admin/platform-states', ...requireAdmin, async (_req, res) => {
  try {
    res.json({ success: true, states: await listPlatformFeatureStates() });
  } catch (error) {
    sendAdminError(res, error, 'GET /entitlements/admin/platform-states');
  }
});

entitlementsRouter.get('/entitlements/admin/platform-states/:featureKey', ...requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, state: await getPlatformFeatureState(String(req.params.featureKey)) });
  } catch (error) {
    sendAdminError(res, error, 'GET /entitlements/admin/platform-states/:featureKey');
  }
});

entitlementsRouter.put('/entitlements/admin/platform-states/:featureKey', ...requireSuperAdmin, async (req, res) => {
  const featureKey = String(req.params.featureKey);
  const body = (req.body || {}) as { enabled?: unknown; reason?: string | null };
  try {
    const { changed } = await setPlatformFeatureState(
      { featureKey, enabled: body.enabled as boolean, reason: body.reason ?? null },
      actorFrom(req),
    );
    res.json({ success: true, changed, state: await getPlatformFeatureState(featureKey) });
  } catch (error) {
    sendAdminError(res, error, 'PUT /entitlements/admin/platform-states/:featureKey');
  }
});

// ─── Phase 2B: audit history (read-only — there is no mutation route) ──────

entitlementsRouter.get('/entitlements/admin/audit', ...requireAdmin, async (req, res) => {
  const q = req.query as Record<string, unknown>;
  try {
    const page = await listEntitlementAuditEvents({
      targetUserId: typeof q.userId === 'string' && q.userId ? q.userId : undefined,
      featureKey: typeof q.featureKey === 'string' && q.featureKey ? q.featureKey : undefined,
      before: typeof q.before === 'string' && q.before ? q.before : undefined,
      limit: typeof q.limit === 'string' ? Number(q.limit) : undefined,
    });
    res.json({ success: true, ...page });
  } catch (error) {
    sendAdminError(res, error, 'GET /entitlements/admin/audit');
  }
});

/**
 * Sprint 11 — minimal Plan foundation. Admin-only CRUD for plan catalog entries
 * and per-account plan assignment. No billing/payment fields — see
 * server/db/schema.ts `plans`/`accountPlans` for the scope rationale.
 * (Legacy: the resolver does not read these; kept as-is, now crash-safe.)
 */
entitlementsRouter.get('/entitlements/admin/plans', ...requireAdmin, async (req, res) => {
  const role = typeof req.query.role === 'string' ? (req.query.role as PartnerRole) : undefined;
  try {
    const list = await planStore.listPlans(role);
    res.json({ success: true, plans: list });
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/admin/plans', error);
  }
});

entitlementsRouter.post('/entitlements/admin/plans', ...requireAdmin, async (req, res) => {
  const body = req.body as { role?: string; name?: string; priceLabel?: string; sortOrder?: number };
  const role = String(body.role || '').toLowerCase() as PartnerRole;
  if (role !== 'seller' && role !== 'creator') {
    res.status(400).json({ success: false, error: 'role must be seller or creator' });
    return;
  }
  const name = String(body.name || '').trim();
  if (!name) {
    res.status(400).json({ success: false, error: 'name is required' });
    return;
  }
  try {
    const created = await planStore.createPlan({ role, name, priceLabel: body.priceLabel, sortOrder: body.sortOrder });
    res.status(201).json({ success: true, plan: created });
  } catch (error) {
    sendEntitlementUnavailable(res, 'POST /entitlements/admin/plans', error);
  }
});

entitlementsRouter.patch('/entitlements/admin/plans/:id', ...requireAdmin, async (req, res) => {
  const body = req.body as { name?: string; priceLabel?: string | null; active?: boolean; sortOrder?: number };
  try {
    const updated = await planStore.updatePlan(req.params.id, body);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }
    res.json({ success: true, plan: updated });
  } catch (error) {
    sendEntitlementUnavailable(res, 'PATCH /entitlements/admin/plans/:id', error);
  }
});

/**
 * Retired (Phase 2A). This wrote feature_entitlements scope='plan' rows that the
 * resolver has not read since Sprint 12 — a competing, dead source of truth.
 * Plan access comes only from Plan Versions (plan_entitlements, planControlled
 * keys) via /admin/subscription-plans/:planId/versions/:versionId/entitlements.
 */
entitlementsRouter.patch('/entitlements/admin/plan-defaults/:planId/:featureKey', ...requireAdmin, (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Plan defaults are retired. Configure plan-controlled features on a Plan Version instead.',
    code: 'LEGACY_PLAN_DEFAULTS_RETIRED',
  });
});

/** Admin-only: assign/change which plan an account is on. Never self-service. */
entitlementsRouter.post('/entitlements/admin/accounts/:userId/plan', ...requireAdmin, async (req, res) => {
  const body = req.body as { planId?: string; expiresAt?: string | null };
  const planId = String(body.planId || '');
  if (!planId) {
    res.status(400).json({ success: false, error: 'planId is required' });
    return;
  }
  try {
    const assigned = await planStore.assignAccountPlan({
      userId: req.params.userId,
      planId,
      assignedByUserId: req.userId || req.user?.uid || 'unknown',
      expiresAt: body.expiresAt ?? null,
    });
    res.json({ success: true, accountPlan: assigned });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to assign plan',
    });
  }
});

entitlementsRouter.get('/entitlements/admin/accounts/:userId/plan', ...requireAdmin, async (req, res) => {
  try {
    const accountPlan = await planStore.getAccountPlan(req.params.userId);
    res.json({ success: true, accountPlan });
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/admin/accounts/:userId/plan', error);
  }
});

/**
 * Sprint 11 — Feature Request workflow. Seller/Creator requests access to a
 * feature they don't currently have; Admin reviews. Requesting NEVER
 * self-enables the feature — only a role default, a Plan Version entitlement or
 * an account override (all admin-only) actually grant it.
 */
entitlementsRouter.post('/entitlements/feature-requests', ...requireAuth, async (req, res) => {
  const role = String(req.userRole || req.user?.role || '').toLowerCase();
  if (role !== 'seller' && role !== 'verified_seller' && role !== 'creator') {
    res.status(403).json({ success: false, error: 'Feature requests are only available to sellers and creators' });
    return;
  }
  const partnerRole: PartnerRole = role === 'creator' ? 'creator' : 'seller';
  const featureKey = String((req.body as { featureKey?: string })?.featureKey || '') as PartnerFeatureKey;
  if (!featureKeysForRole(partnerRole).includes(featureKey)) {
    res.status(400).json({ success: false, error: 'Unknown feature for your role' });
    return;
  }
  const userId = req.userId || req.user?.uid;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const message = typeof (req.body as { message?: string })?.message === 'string'
    ? (req.body as { message?: string }).message!.slice(0, 500)
    : undefined;
  let created: Awaited<ReturnType<typeof featureRequestStore.create>>;
  try {
    created = await featureRequestStore.create({ userId, role: partnerRole, featureKey, message });
  } catch (error) {
    sendEntitlementUnavailable(res, 'POST /entitlements/feature-requests', error);
    return;
  }
  if (created.status === 'pending') {
    try {
      await notifyRoles(['admin', 'super_admin'], {
        type: 'system_alert',
        category: 'admin',
        eventKey: 'staff.feature_request',
        persona: 'staff',
        title: 'Feature Request Awaiting Review',
        summary: `${partnerRole} requested access to "${featureKey}".`,
        actionUrl: '/admin/feature-access',
        metadata: { featureRequestId: created.id, featureKey },
      });
    } catch (error) {
      console.error('[Entitlements] Failed to notify admins of feature request:', error);
    }
  }
  res.status(201).json({ success: true, featureRequest: created });
});

/** The requesting user's own feature requests. */
entitlementsRouter.get('/entitlements/feature-requests/mine', ...requireAuth, async (req, res) => {
  const userId = req.userId || req.user?.uid;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const list = await featureRequestStore.list({ userId });
    res.json({ success: true, featureRequests: list });
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/feature-requests/mine', error);
  }
});

entitlementsRouter.get('/entitlements/admin/feature-requests', ...requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as FeatureRequestStatus) : undefined;
  try {
    const list = await featureRequestStore.list({ status });
    res.json({ success: true, featureRequests: list });
  } catch (error) {
    sendEntitlementUnavailable(res, 'GET /entitlements/admin/feature-requests', error);
  }
});

entitlementsRouter.patch('/entitlements/admin/feature-requests/:id', ...requireAdmin, async (req, res) => {
  const body = req.body as { status?: string; reviewNote?: string };
  const status = body.status;
  if (status !== 'approved' && status !== 'declined' && status !== 'contacted') {
    res.status(400).json({ success: false, error: 'status must be approved, declined, or contacted' });
    return;
  }
  // reviewed_by_user_id is a uuid FK: never fall back to a placeholder string.
  const reviewerId = req.userId || req.user?.uid;
  if (!reviewerId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  let updated: Awaited<ReturnType<typeof featureRequestStore.review>>;
  try {
    updated = await featureRequestStore.review(req.params.id, {
      status,
      reviewedByUserId: reviewerId,
      reviewNote: body.reviewNote,
    });
  } catch (error) {
    sendEntitlementUnavailable(res, 'PATCH /entitlements/admin/feature-requests/:id', error);
    return;
  }
  if (!updated) {
    res.status(404).json({ success: false, error: 'Feature request not found' });
    return;
  }
  try {
    const statusLabel = status === 'approved' ? 'Approved' : status === 'declined' ? 'Declined' : 'Contact Requested';
    await notifyUser(updated.userId, {
      type: updated.role === 'seller' ? 'seller_update' : 'buyer_update',
      category: updated.role === 'seller' ? 'seller' : 'buyer',
      eventKey: 'feature_request.update',
      persona: updated.role === 'creator' ? 'creator' : 'seller',
      title: `Feature Request ${statusLabel}`,
      summary: body.reviewNote || `Your request for "${updated.featureKey}" was ${statusLabel.toLowerCase()}.`,
      actionUrl: '/admin/feature-access',
      metadata: { featureRequestId: updated.id, featureKey: updated.featureKey },
    });
  } catch (error) {
    console.error('[Entitlements] Failed to notify user of feature request review:', error);
  }
  res.json({
    success: true,
    featureRequest: updated,
    note: 'Decision recorded only — grant the feature explicitly via role defaults, a Plan Version or an account override if approved.',
  });
});
