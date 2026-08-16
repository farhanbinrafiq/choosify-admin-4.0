import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import {
  entitlementStore,
  getEnabledMapForActor,
  type PartnerFeatureKey,
  type PartnerRole,
} from './entitlementStore';
import { planStore } from './planStore';
import { featureRequestStore, type FeatureRequestStatus } from './featureRequestStore';
import { notifyRoles, notifyUser } from '../communication/systemNotify';
import { PARTNER_FEATURES, featureKeysForRole } from '../../shared/entitlements/registry';

export const entitlementsRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

/** Current actor's resolved entitlements (for nav/route gating). */
entitlementsRouter.get('/entitlements/me', ...requireAuth, async (req, res) => {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  const enabled = await getEnabledMapForActor({ role, userId });
  const plan = userId ? await planStore.getAccountPlan(userId) : null;
  res.json({
    success: true,
    role,
    entitlements: enabled,
    plan,
    catalog: PARTNER_FEATURES.filter((f) => {
      const r = String(role || '').toLowerCase();
      if (r === 'seller' || r === 'verified_seller') return f.roles.includes('seller');
      if (r === 'creator') return f.roles.includes('creator');
      return false;
    }),
  });
});

/** Admin: full catalog + role defaults (+ empty plan/account stubs for future UI). */
entitlementsRouter.get('/entitlements/admin', ...requireAdmin, async (_req, res) => {
  const snapshot = await entitlementStore.snapshot();
  res.json({
    success: true,
    catalog: entitlementStore.catalog(),
    roleDefaults: snapshot.roleDefaults,
    planDefaults: snapshot.planDefaults,
    accountOverrides: snapshot.accountOverrides,
    precedence: ['accountOverride', 'planDefault', 'roleDefault'],
    note: 'Disabling a feature blocks access only. Feature-owned business data is never deleted.',
  });
});

entitlementsRouter.put('/entitlements/admin/role-defaults', ...requireAdmin, async (req, res) => {
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
    const saved = await entitlementStore.setRoleDefaultsBulk(role, features);
    res.json({ success: true, roleDefaults: saved });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to update entitlements',
    });
  }
});

entitlementsRouter.patch('/entitlements/admin/role-defaults/:role/:featureKey', ...requireAdmin, async (req, res) => {
  const role = String(req.params.role || '').toLowerCase() as PartnerRole;
  const featureKey = String(req.params.featureKey || '') as PartnerFeatureKey;
  if (role !== 'seller' && role !== 'creator') {
    res.status(400).json({ success: false, error: 'role must be seller or creator' });
    return;
  }
  if (!featureKeysForRole(role).includes(featureKey)) {
    res.status(400).json({ success: false, error: 'Unknown feature for role' });
    return;
  }
  const enabled = Boolean((req.body as { enabled?: boolean })?.enabled);
  try {
    const saved = await entitlementStore.setRoleDefault(role, featureKey, enabled);
    res.json({
      success: true,
      roleDefaults: saved,
      note: 'Access toggled only — existing feature data is preserved.',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to update entitlement',
    });
  }
});

/**
 * Sprint 11 — minimal Plan foundation. Admin-only CRUD for plan catalog entries
 * and per-account plan assignment. No billing/payment fields — see
 * server/db/schema.ts `plans`/`accountPlans` for the scope rationale.
 */
entitlementsRouter.get('/entitlements/admin/plans', ...requireAdmin, async (req, res) => {
  const role = typeof req.query.role === 'string' ? (req.query.role as PartnerRole) : undefined;
  const list = await planStore.listPlans(role);
  res.json({ success: true, plans: list });
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
  const created = await planStore.createPlan({ role, name, priceLabel: body.priceLabel, sortOrder: body.sortOrder });
  res.status(201).json({ success: true, plan: created });
});

entitlementsRouter.patch('/entitlements/admin/plans/:id', ...requireAdmin, async (req, res) => {
  const body = req.body as { name?: string; priceLabel?: string | null; active?: boolean; sortOrder?: number };
  const updated = await planStore.updatePlan(req.params.id, body);
  if (!updated) {
    res.status(404).json({ success: false, error: 'Plan not found' });
    return;
  }
  res.json({ success: true, plan: updated });
});

/** Toggle a feature for a plan — mirrors the role-defaults endpoint exactly. */
entitlementsRouter.patch(
  '/entitlements/admin/plan-defaults/:planId/:featureKey',
  ...requireAdmin,
  async (req, res) => {
    const { planId, featureKey } = req.params;
    const plan = await planStore.getPlan(planId);
    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }
    if (!featureKeysForRole(plan.role).includes(featureKey as PartnerFeatureKey)) {
      res.status(400).json({ success: false, error: 'Unknown feature for this plan\'s role' });
      return;
    }
    const enabled = Boolean((req.body as { enabled?: boolean })?.enabled);
    await entitlementStore.setPlanFeature(planId, featureKey as PartnerFeatureKey, enabled);
    res.json({ success: true, note: 'Access toggled only — existing feature data is preserved.' });
  },
);

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
  const accountPlan = await planStore.getAccountPlan(req.params.userId);
  res.json({ success: true, accountPlan });
});

/**
 * Sprint 11 — Feature Request workflow. Seller/Creator requests access to a
 * feature they don't currently have; Admin reviews. Requesting NEVER
 * self-enables the feature — only entitlementStore.setRoleDefault /
 * setPlanFeature / an account override (all admin-only) actually grant it.
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
  const created = await featureRequestStore.create({ userId, role: partnerRole, featureKey, message });
  if (created.status === 'pending') {
    try {
      await notifyRoles(['admin', 'super_admin'], {
        type: 'system_alert',
        category: 'admin',
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
  const list = await featureRequestStore.list({ userId });
  res.json({ success: true, featureRequests: list });
});

entitlementsRouter.get('/entitlements/admin/feature-requests', ...requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as FeatureRequestStatus) : undefined;
  const list = await featureRequestStore.list({ status });
  res.json({ success: true, featureRequests: list });
});

entitlementsRouter.patch('/entitlements/admin/feature-requests/:id', ...requireAdmin, async (req, res) => {
  const body = req.body as { status?: string; reviewNote?: string };
  const status = body.status;
  if (status !== 'approved' && status !== 'declined' && status !== 'contacted') {
    res.status(400).json({ success: false, error: 'status must be approved, declined, or contacted' });
    return;
  }
  const reviewerId = req.userId || req.user?.uid || 'unknown';
  const updated = await featureRequestStore.review(req.params.id, {
    status,
    reviewedByUserId: reviewerId,
    reviewNote: body.reviewNote,
  });
  if (!updated) {
    res.status(404).json({ success: false, error: 'Feature request not found' });
    return;
  }
  try {
    const statusLabel = status === 'approved' ? 'Approved' : status === 'declined' ? 'Declined' : 'Contact Requested';
    await notifyUser(updated.userId, {
      type: updated.role === 'seller' ? 'seller_update' : 'buyer_update',
      category: updated.role === 'seller' ? 'seller' : 'buyer',
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
    note: 'Decision recorded only — grant the feature explicitly via role-defaults/plan-defaults/account override if approved.',
  });
});
