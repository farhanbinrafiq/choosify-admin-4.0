/**
 * Phase 3B backend verification — Subscription Plans + Monetization Center.
 * Calls the real service layer directly against the LOCAL dev DB (same
 * house convention as other scripts/probe-*.ts — no HTTP/browser needed to
 * verify backend logic). Creates and cleans up its own throwaway Plan rows;
 * reuses real, already-backfilled Workspace rows (never fabricates one).
 *
 * Usage: npx tsx scripts/probe-subscription-backend.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, subscriptions, subscriptionEvents, subscriptionPayments, featureEntitlements, plans, planVersions } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';
import { workspaceService } from '../server/subscriptions/workspaceService';
import { resolveFeatureEnabled } from '../server/entitlements/entitlementStore';
import { resolvePlanLimit } from '../server/entitlements/planLimitResolver';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    assert(false, label + ' (expected throw, none occurred)');
  } catch {
    assert(true, label);
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(1);
  }

  // ── Fixtures: real backfilled Workspaces + a real admin actor ──
  const sellerWs = await db.select().from(workspaces).where(eq(workspaces.type, 'seller')).limit(2);
  const creatorWs = await db.select().from(workspaces).where(eq(workspaces.type, 'creator')).limit(1);
  const adminUser = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
  assert(sellerWs.length === 2, 'fixture: at least 2 Seller workspaces available');
  assert(creatorWs.length === 1, 'fixture: at least 1 Creator workspace available');
  assert(adminUser.length === 1, 'fixture: a super_admin user exists');
  if (sellerWs.length < 2 || creatorWs.length < 1 || adminUser.length < 1) {
    console.log('\nCannot continue without fixtures.');
    process.exit(1);
  }
  const [wsA, wsB] = sellerWs;
  const wsCreator = creatorWs[0];
  const adminId = adminUser[0].id;

  // Clean slate for these specific workspaces from any prior probe run.
  for (const ws of [wsA, wsB, wsCreator]) {
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
    for (const s of subs) {
      await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
      await db.delete(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, s.id));
    }
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
  }
  for (const ws of [wsA, wsB]) {
    const overrideRows = await db.select().from(featureEntitlements).where(eq(featureEntitlements.scope, 'account'));
    for (const r of overrideRows.filter((r) => r.scopeKey === ws.ownerUserId)) {
      await db.delete(featureEntitlements).where(eq(featureEntitlements.id, r.id));
    }
  }

  // ── 1/2. Create Seller + Creator plans (draft) ──
  const sellerPlan = await planService.createPlan({ role: 'seller', name: 'PROBE Seller Plan', actorUserId: adminId });
  const creatorPlan = await planService.createPlan({ role: 'creator', name: 'PROBE Creator Plan', actorUserId: adminId });
  assert(sellerPlan.lifecycleState === 'draft', 'new plan starts as draft');
  assert(sellerPlan.isPublic === false, 'new plan defaults to isPublic=false (never auto-listed)');
  // isPublic is a SEPARATE flag from lifecycleState (Super Admin controls "publicly listed" independent
  // of "published" — e.g. an invite-only published plan) — set it explicitly for these catalog-visibility checks.
  await planService.updatePlanMetadata(sellerPlan.id, { isPublic: true }, adminId);
  await planService.updatePlanMetadata(creatorPlan.id, { isPublic: true }, adminId);

  const sellerV1 = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'PROBE Seller v1' }, adminId);
  await planService.setDraftOffers(sellerPlan.id, sellerV1.id, [{ billingInterval: 'monthly', price: 50000, currency: 'BDT' }]);
  await planService.setDraftEntitlements(sellerPlan.id, sellerV1.id, [{ featureKey: 'customerInsights', enabled: true }]);
  await planService.setDraftLimits(sellerPlan.id, sellerV1.id, [{ limitKey: 'team_member_limit', limitValue: 2 }]);
  await planService.publishVersion(sellerPlan.id, sellerV1.id, adminId);

  const creatorV1 = await planService.createDraftVersion(creatorPlan.id, { nameSnapshot: 'PROBE Creator v1' }, adminId);
  await planService.setDraftOffers(creatorPlan.id, creatorV1.id, [{ billingInterval: 'monthly', price: 30000 }]);
  await planService.publishVersion(creatorPlan.id, creatorV1.id, adminId);

  const sellerV1Offers = (await planService.getPlanDetail(sellerPlan.id)).versions.find((v) => v.id === sellerV1.id)!.offers;
  const creatorV1Offers = (await planService.getPlanDetail(creatorPlan.id)).versions.find((v) => v.id === creatorV1.id)!.offers;
  const sellerV1OfferId = sellerV1Offers[0].id;
  const creatorV1OfferId = creatorV1Offers[0].id;

  // Draft plan that is never published — must stay invisible.
  const draftOnlyPlan = await planService.createPlan({ role: 'seller', name: 'PROBE Draft-Only Plan', actorUserId: adminId });

  // ── 3/4/5. Persona isolation + draft invisibility in catalog listing ──
  const sellerCatalog = await planService.listPublishedPlansForPersona('seller');
  const creatorCatalog = await planService.listPublishedPlansForPersona('creator');
  assert(sellerCatalog.some((p) => p.plan.id === sellerPlan.id), 'Seller catalog includes the published Seller plan');
  assert(!sellerCatalog.some((p) => p.plan.id === creatorPlan.id), 'Seller catalog excludes the Creator plan');
  assert(creatorCatalog.some((p) => p.plan.id === creatorPlan.id), 'Creator catalog includes the published Creator plan');
  assert(!creatorCatalog.some((p) => p.plan.id === sellerPlan.id), 'Creator catalog excludes the Seller plan');
  assert(!sellerCatalog.some((p) => p.plan.id === draftOnlyPlan.id), 'Draft-only plan is invisible in the published catalog');

  // ── 6. Persona mismatch rejection on grant ──
  await expectThrow('Seller workspace cannot be granted a Creator plan offer (persona mismatch)', () =>
    subscriptionService.manualGrant({ workspaceId: wsA.id, planVersionOfferId: creatorV1OfferId, actorUserId: adminId, reason: 'probe' }),
  );

  // ── 7/8. Manual grant + current subscription lookup ──
  const grantA = await subscriptionService.manualGrant({
    workspaceId: wsA.id,
    planVersionOfferId: sellerV1OfferId,
    actorUserId: adminId,
    reason: 'probe manual grant',
  });
  assert(grantA.grantedManually === true, 'manual grant flagged grantedManually=true');
  const currentA = await subscriptionService.getCurrentSubscription(wsA.id);
  assert(currentA?.offer.id === sellerV1OfferId, 'current subscription resolves to the granted offer');
  assert(currentA?.version.id === sellerV1.id, 'current subscription resolves through to the correct Plan Version');

  // ── 13. Manual grant produced zero payment/revenue rows ──
  const paymentsForGrant = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, grantA.id));
  assert(paymentsForGrant.length === 0, 'manual grant created ZERO subscription_payments rows (no revenue)');

  // ── 9/16. Entitlement resolution: plan tier + account override precedence ──
  const enabledFromPlan = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsA.ownerUserId });
  assert(enabledFromPlan === true, 'plan-tier resolution grants a feature the subscribed Plan Version enables', enabledFromPlan);
  // A feature NOT present in the subscribed Plan Version's plan_entitlements must fall through to
  // the role default exactly (whatever that currently is) rather than being silently denied/allowed
  // by the plan tier — verify it MATCHES the real role-default row instead of assuming a value.
  const roleDefaultRows = await db.select().from(featureEntitlements).where(eq(featureEntitlements.scope, 'role'));
  const roleDefaultForAdsDeals = roleDefaultRows.find((r) => r.scopeKey === 'seller' && r.featureKey === 'adsDeals')?.enabled ?? false;
  const notInPlan = await resolveFeatureEnabled({ role: 'seller', featureKey: 'adsDeals', userId: wsA.ownerUserId });
  assert(notInPlan === roleDefaultForAdsDeals, 'a feature NOT in the Plan Version falls through correctly to the real role default', { notInPlan, roleDefaultForAdsDeals });

  await db.insert(featureEntitlements).values({ scope: 'account', scopeKey: wsA.ownerUserId, featureKey: 'customerInsights', enabled: false });
  const overridden = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsA.ownerUserId });
  assert(overridden === false, 'account-scope override still takes precedence OVER the plan tier (account > plan > role, unchanged)');
  {
    const overrideRows = await db.select().from(featureEntitlements).where(eq(featureEntitlements.scope, 'account'));
    for (const r of overrideRows.filter((r) => r.scopeKey === wsA.ownerUserId && r.featureKey === 'customerInsights')) {
      await db.delete(featureEntitlements).where(eq(featureEntitlements.id, r.id));
    }
  }

  // ── 10. Plan-limit resolver ──
  const limitRes = await resolvePlanLimit({ userId: wsA.ownerUserId, role: 'seller', limitKey: 'team_member_limit' });
  assert(limitRes.source === 'plan' && limitRes.limitValue === 2, 'resolvePlanLimit returns the subscribed Plan Version\'s configured limit', limitRes);
  const unknownLimit = await resolvePlanLimit({ userId: wsA.ownerUserId, role: 'seller', limitKey: 'nonexistent_limit_key' });
  assert(unknownLimit.source === 'none', 'resolvePlanLimit returns source:none for a limit key the Plan Version does not define (never invents a value)');

  // ── 18a. Duplicate/open-subscription protection ──
  await expectThrow('Cannot manually grant a second open subscription to the same Workspace', () =>
    subscriptionService.manualGrant({ workspaceId: wsA.id, planVersionOfferId: sellerV1OfferId, actorUserId: adminId, reason: 'dup probe' }),
  );

  // ── 19. Publish guard: cannot publish a version with zero offers ──
  const emptyVersion = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'PROBE empty version' }, adminId);
  await expectThrow('Cannot publish a Plan Version with no billing offer', () =>
    planService.publishVersion(sellerPlan.id, emptyVersion.id, adminId),
  );

  // ── 20. Entitlement key validation ──
  await expectThrow('Cannot assign an unknown feature key to a Plan Version', () =>
    planService.setDraftEntitlements(sellerPlan.id, emptyVersion.id, [{ featureKey: 'totally_not_a_real_feature', enabled: true }]),
  );

  // ── 11/12. Grandfathering: publishing v2 with different entitlements must not alter Workspace A (still on v1) ──
  const sellerV2 = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'PROBE Seller v2' }, adminId);
  await planService.setDraftOffers(sellerPlan.id, sellerV2.id, [{ billingInterval: 'monthly', price: 60000 }]);
  await planService.setDraftEntitlements(sellerPlan.id, sellerV2.id, [{ featureKey: 'customerInsights', enabled: false }]); // DIFFERENT from v1
  await planService.setDraftLimits(sellerPlan.id, sellerV2.id, [{ limitKey: 'team_member_limit', limitValue: 5 }]); // DIFFERENT from v1
  await planService.publishVersion(sellerPlan.id, sellerV2.id, adminId);

  const stillOnV1 = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsA.ownerUserId });
  assert(stillOnV1 === true, 'GRANDFATHERING: existing subscriber (Workspace A, still on v1) keeps v1 entitlement after v2 is published', stillOnV1);
  const stillV1Limit = await resolvePlanLimit({ userId: wsA.ownerUserId, role: 'seller', limitKey: 'team_member_limit' });
  assert(stillV1Limit.limitValue === 2, 'GRANDFATHERING: existing subscriber keeps v1 LIMIT after v2 is published', stillV1Limit);

  const sellerV2Offers = (await planService.getPlanDetail(sellerPlan.id)).versions.find((v) => v.id === sellerV2.id)!.offers;
  const sellerV2OfferId = sellerV2Offers[0].id;
  const grantB = await subscriptionService.manualGrant({ workspaceId: wsB.id, planVersionOfferId: sellerV2OfferId, actorUserId: adminId, reason: 'probe v2 grant' });
  const newSubscriberFeature = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsB.ownerUserId });
  assert(newSubscriberFeature === false, 'a NEW subscriber on v2 gets v2\'s (different) entitlement', newSubscriberFeature);

  // ── 17. Cross-workspace isolation ──
  assert(wsA.id !== wsB.id && wsA.ownerUserId !== wsB.ownerUserId, 'Seller A and Seller B are genuinely distinct workspaces/owners');
  const historyA = await subscriptionService.getSubscriptionHistory(wsA.id);
  const historyB = await subscriptionService.getSubscriptionHistory(wsB.id);
  assert(!historyA.subscriptions.some((s) => s.id === grantB.id), 'Seller A\'s history does not include Seller B\'s subscription');
  assert(!historyB.subscriptions.some((s) => s.id === grantA.id), 'Seller B\'s history does not include Seller A\'s subscription');
  const wsForCreatorOwner = await workspaceService.resolveWorkspaceForUser(wsCreator.ownerUserId, 'creator');
  assert(wsForCreatorOwner?.id === wsCreator.id, 'Creator persona resolves to the Creator\'s own workspace only');
  const sellerRoleForCreatorOwner = await workspaceService.resolveWorkspaceForUser(wsCreator.ownerUserId, 'seller');
  assert(sellerRoleForCreatorOwner === null, 'Creator cannot resolve a Seller workspace for their own account (no cross-persona leakage)');

  // ── 14. Cancellation-at-period-end ──
  const cancelled = await subscriptionService.requestCancellation(wsA.id, adminId);
  assert(cancelled.cancelAtPeriodEnd === true, 'cancellation sets cancel_at_period_end=true');
  assert(cancelled.status === 'active', 'subscription remains ACTIVE immediately after cancellation request (entitlement not revoked yet)');
  const stillEntitledAfterCancelRequest = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsA.ownerUserId });
  assert(stillEntitledAfterCancelRequest === true, 'entitlement remains available after cancel-at-period-end request, before the period actually ends');

  // ── 15. Expiry transition + idempotency ──
  await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 60_000) }).where(eq(subscriptions.id, grantA.id));
  const sweep1 = await subscriptionService.processExpirations();
  assert(sweep1.ids.includes(grantA.id), 'expiry sweep picks up the past-due-period subscription', sweep1);
  const rowsAfterSweep1 = await db.select().from(subscriptions).where(eq(subscriptions.id, grantA.id));
  assert(rowsAfterSweep1[0]?.status === 'cancelled', 'subscription transitions to CANCELLED (was cancel_at_period_end=true) at expiry sweep', rowsAfterSweep1[0]?.status);
  // Once the subscription is closed, plan-tier grandfathering ends and resolution falls through to
  // whatever the real ROLE DEFAULT is (not necessarily false — defaultRoleEntitlements seeds every
  // known feature to true unless an Admin has since disabled it) — verify the fallthrough is correct,
  // not that it's unconditionally denied.
  const roleDefaultForCustomerInsights = roleDefaultRows.find((r) => r.scopeKey === 'seller' && r.featureKey === 'customerInsights')?.enabled ?? false;
  const noLongerEntitled = await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: wsA.ownerUserId });
  assert(
    noLongerEntitled === roleDefaultForCustomerInsights,
    'after the subscription closes, resolution correctly falls back to the real role default (plan-tier grandfathering no longer applies)',
    { noLongerEntitled, roleDefaultForCustomerInsights },
  );
  const sweep2 = await subscriptionService.processExpirations();
  assert(!sweep2.ids.includes(grantA.id), 'expiry sweep is idempotent — a second run does not reprocess the same already-closed subscription', sweep2);

  // ── 18b. After closing, a fresh manual grant to the SAME workspace succeeds ──
  const regrantA = await subscriptionService.manualGrant({ workspaceId: wsA.id, planVersionOfferId: sellerV1OfferId, actorUserId: adminId, reason: 'probe regrant after expiry' });
  assert(!!regrantA.id, 'a new manual grant succeeds once the prior subscription is closed (partial-unique-index + service check both correctly scoped to OPEN rows only)');

  // ── Cleanup: remove every probe-created row ──
  for (const ws of [wsA, wsB]) {
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
    for (const s of subs) {
      await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
      await db.delete(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, s.id));
    }
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
  }
  for (const planId of [sellerPlan.id, creatorPlan.id, draftOnlyPlan.id]) {
    const versions = await db.select().from(planVersions).where(eq(planVersions.planId, planId));
    await db.update(plans).set({ currentPublishedVersionId: null }).where(eq(plans.id, planId));
    for (const v of versions) {
      await db.execute(`delete from plan_entitlements where plan_version_id = '${v.id}'`);
      await db.execute(`delete from plan_limits where plan_version_id = '${v.id}'`);
      await db.execute(`delete from plan_version_offers where plan_version_id = '${v.id}'`);
    }
    await db.delete(planVersions).where(eq(planVersions.planId, planId));
    await db.delete(plans).where(eq(plans.id, planId));
  }

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('PROBE CRASHED:', e);
  process.exit(1);
});
