/**
 * Sprint 12 — canonical quantitative Plan Limit resolver. Sibling to
 * resolveFeatureEnabled() (server/entitlements/entitlementStore.ts) — kept
 * as its own function/file because a limit is a number (or "unlimited"),
 * never a boolean, and mixing the two concepts into one resolver was
 * explicitly ruled out. This is NOT a competing entitlement engine: it
 * only ever reads plan_limits via the same workspace -> open subscription
 * -> plan_version_offer -> plan_version chain the plan tier of
 * resolveFeatureEnabled() now uses.
 *
 * Invents nothing: if no open subscription exists, or the resolved Plan
 * Version simply has no row for this limitKey, the result says so
 * explicitly (source: 'none') rather than returning a guessed number —
 * callers remain responsible for whatever platform-hard-rule/role-rule
 * default applies outside the Subscription Plans system (see the Phase 2
 * classification: e.g. today's flat 3-active-voucher cap is a platform hard
 * rule, not sourced from here at all).
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { planLimits } from '../db/schema';
import { workspaceService } from '../subscriptions/workspaceService';

export type PlanLimitResolution =
  | { source: 'none'; limitValue: null; unlimited: false }
  | { source: 'plan'; limitValue: number | null; unlimited: boolean; planId: string; planVersionId: string };

/** Same calling convention as resolveFeatureEnabled({role, featureKey, userId}) — resolves the Workspace internally. */
export async function resolvePlanLimit(params: {
  userId: string | null | undefined;
  role: string | undefined | null;
  limitKey: string;
}): Promise<PlanLimitResolution> {
  if (!params.userId) return { source: 'none', limitValue: null, unlimited: false };
  const workspace = await workspaceService.resolveWorkspaceForUser(params.userId, params.role);
  if (!workspace) return { source: 'none', limitValue: null, unlimited: false };

  const resolved = await workspaceService.getResolvedOpenSubscription(workspace.id);
  if (!resolved) return { source: 'none', limitValue: null, unlimited: false };

  const rows = await db
    .select()
    .from(planLimits)
    .where(and(eq(planLimits.planVersionId, resolved.version.id), eq(planLimits.limitKey, params.limitKey)))
    .limit(1);
  const row = rows[0];
  if (!row) return { source: 'none', limitValue: null, unlimited: false };

  return {
    source: 'plan',
    limitValue: row.limitValue,
    unlimited: row.limitValue === null,
    planId: resolved.plan.id,
    planVersionId: resolved.version.id,
  };
}
