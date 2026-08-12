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
import { PARTNER_FEATURES, featureKeysForRole } from '../../shared/entitlements/registry';

export const entitlementsRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

/** Current actor's resolved entitlements (for nav/route gating). */
entitlementsRouter.get('/entitlements/me', ...requireAuth, (req, res) => {
  const role = req.userRole || req.user?.role;
  const userId = req.userId || req.user?.uid;
  const enabled = getEnabledMapForActor({ role, userId });
  res.json({
    success: true,
    role,
    entitlements: enabled,
    catalog: PARTNER_FEATURES.filter((f) => {
      const r = String(role || '').toLowerCase();
      if (r === 'seller' || r === 'verified_seller') return f.roles.includes('seller');
      if (r === 'creator') return f.roles.includes('creator');
      return false;
    }),
  });
});

/** Admin: full catalog + role defaults (+ empty plan/account stubs for future UI). */
entitlementsRouter.get('/entitlements/admin', ...requireAdmin, (_req, res) => {
  res.json({
    success: true,
    catalog: entitlementStore.catalog(),
    roleDefaults: entitlementStore.getRoleDefaults(),
    planDefaults: entitlementStore.snapshot().planDefaults,
    accountOverrides: entitlementStore.snapshot().accountOverrides,
    precedence: ['accountOverride', 'planDefault', 'roleDefault'],
    note: 'Disabling a feature blocks access only. Feature-owned business data is never deleted.',
  });
});

entitlementsRouter.put('/entitlements/admin/role-defaults', ...requireAdmin, (req, res) => {
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
    const saved = entitlementStore.setRoleDefaultsBulk(role, features);
    res.json({ success: true, roleDefaults: saved });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to update entitlements',
    });
  }
});

entitlementsRouter.patch('/entitlements/admin/role-defaults/:role/:featureKey', ...requireAdmin, (req, res) => {
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
    const saved = entitlementStore.setRoleDefault(role, featureKey, enabled);
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
