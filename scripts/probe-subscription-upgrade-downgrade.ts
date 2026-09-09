/**
 * Phase 3C backend verification — upgrade/downgrade policy, including
 * migration 0008's pending-downgrade support. Direct service-layer calls
 * against the LOCAL dev DB (same convention as
 * scripts/probe-subscription-backend.ts). Creates and cleans up its own
 * throwaway Plans; reuses real backfilled Workspace rows.
 *
 * Usage: npx tsx scripts/probe-subscription-upgrade-downgrade.ts
 */
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments, plans, planVersions } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';

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

  const sellerWs = await db.select().from(workspaces).where(eq(workspaces.type, 'seller')).limit(2);
  const creatorWs = await db.select().from(workspaces).where(eq(workspaces.type, 'creator')).limit(1);
  const adminUser = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
  if (sellerWs.length < 2 || creatorWs.length < 1 || adminUser.length < 1) {
    console.error('Missing fixtures.');
    process.exit(1);
  }
  const [wsA, wsB] = sellerWs;
  const wsCreator = creatorWs[0];
  const adminId = adminUser[0].id;

  // ── No price-comparison logic remains anywhere in the service ──
  const serviceSrc = readFileSync(new URL('../server/subscriptions/subscriptionService.ts', import.meta.url), 'utf8');
  assert(!serviceSrc.includes('classifyPlanChange'), 'classifyPlanChange (price-based direction inference) no longer exists in the service at all');
  assert(!/offer\.price\s*[<>]/.test(serviceSrc), 'no remaining code compares offer.price to decide upgrade vs downgrade direction', serviceSrc.match(/offer\.price\s*[<>][^\n]*/g));

  // ── Router-level cross-workspace guarantee (code inspection) ──
  const routerSrc = readFileSync(new URL('../server/subscriptions/subscriptionsRouter.ts', import.meta.url), 'utf8');
  for (const route of ["'/subscriptions/request-upgrade'", "'/subscriptions/request-downgrade'", "'/subscriptions/cancel-pending-downgrade'"]) {
    const start = routerSrc.indexOf(route);
    assert(start >= 0, `${route} route exists`);
    const slice = routerSrc.slice(start, start + 800);
    assert(!slice.includes('body.subscriptionId') && !slice.includes('params.subscriptionId'), `${route} never accepts a client-supplied subscriptionId`);
  }

  // ── Fixtures: two Seller plans + one Creator plan (prices deliberately do NOT indicate direction) ──
  const planX = await planService.createPlan({ role: 'seller', name: 'PROBE Plan X', actorUserId: adminId });
  const planY = await planService.createPlan({ role: 'seller', name: 'PROBE Plan Y', actorUserId: adminId });
  const creatorPlan = await planService.createPlan({ role: 'creator', name: 'PROBE UD Creator Plan', actorUserId: adminId });

  const xV1 = await planService.createDraftVersion(planX.id, { nameSnapshot: 'X v1' }, adminId);
  await planService.setDraftOffers(planX.id, xV1.id, [{ billingInterval: 'monthly', price: 50000 }]);
  await planService.publishVersion(planX.id, xV1.id, adminId);
  const xOfferId = (await planService.getPlanDetail(planX.id)).versions[0].offers[0].id;

  const yV1 = await planService.createDraftVersion(planY.id, { nameSnapshot: 'Y v1' }, adminId);
  await planService.setDraftOffers(planY.id, yV1.id, [{ billingInterval: 'monthly', price: 50000 }]); // SAME price as X — proves direction is not inferred from price
  await planService.publishVersion(planY.id, yV1.id, adminId);
  const yOfferId = (await planService.getPlanDetail(planY.id)).versions[0].offers[0].id;

  const creatorV1 = await planService.createDraftVersion(creatorPlan.id, { nameSnapshot: 'Creator v1' }, adminId);
  await planService.setDraftOffers(creatorPlan.id, creatorV1.id, [{ billingInterval: 'monthly', price: 40000 }]);
  await planService.publishVersion(creatorPlan.id, creatorV1.id, adminId);
  const creatorOfferId = (await planService.getPlanDetail(creatorPlan.id)).versions[0].offers[0].id;

  async function cleanWorkspace(ws: { id: string }) {
    // Payments are looked up by WORKSPACE, not by subscriptionId — a downgrade-activation
    // payment is deliberately created with subscriptionId=null (mirrors the "payment precedes
    // the subscription" pattern), so a subscriptionId-only cleanup query would silently miss it.
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
    for (const s of subs) {
      await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    }
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
  }
  await cleanWorkspace(wsA);
  await cleanWorkspace(wsB);

  // ── Baseline: Workspace A on Plan X (equal price to Y — proves direction is explicit, not inferred) ──
  const grantA = await subscriptionService.manualGrant({ workspaceId: wsA.id, planVersionOfferId: xOfferId, actorUserId: adminId, reason: 'probe baseline' });

  // ── Persona mismatch on both explicit operations ──
  await expectThrow('requestUpgrade rejects a Creator-plan target for a Seller workspace', () =>
    subscriptionService.requestUpgrade({ subscriptionId: grantA.id, toPlanVersionOfferId: creatorOfferId, actorUserId: wsA.ownerUserId }),
  );
  await expectThrow('requestDowngrade rejects a Creator-plan target for a Seller workspace', () =>
    subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: creatorOfferId, actorUserId: wsA.ownerUserId }),
  );

  // ── Cross-workspace isolation: the ACTUAL security boundary is the router (verified above by code
  // inspection — the client can only ever say WHICH operation it wants, never WHICH subscriptionId).
  // At the data level, confirm operating on Workspace B's subscription id never affects Workspace A's row.
  const grantB = await subscriptionService.manualGrant({ workspaceId: wsB.id, planVersionOfferId: xOfferId, actorUserId: adminId, reason: 'probe B baseline' });
  await subscriptionService.requestDowngrade({ subscriptionId: grantB.id, toPlanVersionOfferId: yOfferId, actorUserId: wsB.ownerUserId });
  const aUnaffected = await subscriptionService.getCurrentSubscription(wsA.id);
  assert(aUnaffected?.subscription.id === grantA.id && aUnaffected?.subscription.pendingPlanVersionOfferId === null, 'a downgrade requested against Workspace B\'s subscription id leaves Workspace A\'s subscription completely untouched');
  await subscriptionService.cancelPendingDowngrade(grantB.id, adminId); // reset B's baseline before continuing

  // ── Upgrade: request alone must not change the plan ──
  const upgradeQuote = await subscriptionService.requestUpgrade({ subscriptionId: grantA.id, toPlanVersionOfferId: yOfferId, actorUserId: wsA.ownerUserId });
  assert(upgradeQuote.status === 'upgrade_quote' && upgradeQuote.amountDue === 50000, 'requestUpgrade returns a quote and does not mutate', upgradeQuote);
  const afterUpgradeQuote = await subscriptionService.getCurrentSubscription(wsA.id);
  assert(afterUpgradeQuote?.offer.id === xOfferId, 'upgrade REQUEST alone does not change the Plan');

  // ── Downgrade request FIRST (to prove upgrade later clears it) ──
  const downReq1 = await subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: yOfferId, actorUserId: wsA.ownerUserId });
  assert(downReq1.pendingPlanVersionOfferId === yOfferId, 'pending downgrade persists canonically on the subscription row', downReq1.pendingPlanVersionOfferId);
  assert(downReq1.planVersionOfferId === xOfferId, 'downgrade request does not alter the current offer');
  const entAfterDowngradeReq = await subscriptionService.getCurrentSubscription(wsA.id);
  assert(entAfterDowngradeReq?.offer.id === xOfferId, 'current entitlements (via the still-unchanged offer) remain active after a downgrade request');
  const eventsAfterReq1 = await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, grantA.id));
  assert(eventsAfterReq1.some((e) => e.eventType === 'downgrade_requested' && e.toPlanVersionOfferId === yOfferId), 'downgrade_requested history event created');

  const paymentsAfterReq1 = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, grantA.id));
  assert(paymentsAfterReq1.length === 0, 'pending downgrade generates no payment');
  const docsAfterReq1 = await db.select().from(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.workspaceId, wsA.id));
  assert(docsAfterReq1.length === 0, 'pending downgrade generates no billing document');

  // ── Change the pending target to a third-ish scenario: re-request downgrade to X itself won't work (same as current after? no — still Y is current target; use a genuinely different second plan) ──
  const planZ = await planService.createPlan({ role: 'seller', name: 'PROBE Plan Z', actorUserId: adminId });
  const zV1 = await planService.createDraftVersion(planZ.id, { nameSnapshot: 'Z v1' }, adminId);
  await planService.setDraftOffers(planZ.id, zV1.id, [{ billingInterval: 'monthly', price: 10000 }]);
  await planService.publishVersion(planZ.id, zV1.id, adminId);
  const zOfferId = (await planService.getPlanDetail(planZ.id)).versions[0].offers[0].id;

  const downReq2 = await subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: zOfferId, actorUserId: wsA.ownerUserId });
  assert(downReq2.pendingPlanVersionOfferId === zOfferId, 'changing the pending target replaces it with the new target', downReq2.pendingPlanVersionOfferId);

  // ── Cancel the pending downgrade ──
  const cancelled = await subscriptionService.cancelPendingDowngrade(grantA.id, wsA.ownerUserId);
  assert(cancelled.pendingPlanVersionOfferId === null, 'cancelling pending downgrade clears it');
  const eventsAfterCancel = await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, grantA.id));
  assert(eventsAfterCancel.some((e) => e.eventType === 'downgrade_cancelled'), 'downgrade_cancelled history event created');
  await expectThrow('cancelPendingDowngrade throws when there is nothing pending', () => subscriptionService.cancelPendingDowngrade(grantA.id, wsA.ownerUserId));

  // ── Request a pending downgrade again, then prove a successful upgrade clears it (upgrade wins) ──
  await subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: zOfferId, actorUserId: wsA.ownerUserId });
  const payment1 = await subscriptionService.recordSuccessfulPayment({
    workspaceId: wsA.id, subscriptionId: grantA.id, planVersionOfferId: yOfferId, purpose: 'upgrade', amount: 50000, currency: 'BDT', idempotencyKey: `probe-up-${grantA.id}`,
  });
  const activatedUpgrade = await subscriptionService.activateUpgrade({ subscriptionId: grantA.id, toPlanVersionOfferId: yOfferId, subscriptionPaymentId: payment1.id, actorUserId: wsA.ownerUserId });
  assert(activatedUpgrade.planVersionOfferId === yOfferId, 'successful validated upgrade changes the Plan immediately');
  assert(activatedUpgrade.pendingPlanVersionOfferId === null, 'a successful immediate upgrade clears a stale pending downgrade');

  // ── Period-end expiry with a pending downgrade: does NOT auto-activate ──
  await subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: zOfferId, actorUserId: wsA.ownerUserId });
  await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 60_000) }).where(eq(subscriptions.id, grantA.id));
  const sweep = await subscriptionService.processExpirations();
  assert(sweep.ids.includes(grantA.id), 'expiry sweep picks up the past-due subscription');
  const afterSweep = await db.select().from(subscriptions).where(eq(subscriptions.id, grantA.id));
  assert(afterSweep[0].status === 'expired', 'subscription closes to EXPIRED at period end (no cancel_at_period_end was set)');
  assert(afterSweep[0].planVersionOfferId === yOfferId, 'period-end expiry does NOT activate the unpaid pending target — current offer is unchanged, only status closes');
  assert(afterSweep[0].pendingPlanVersionOfferId === zOfferId, 'the pending target survives expiry so a later payment can still find it');
  const paymentsAtExpiry = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, grantA.id));
  const paymentsSincePriorUpgrade = paymentsAtExpiry.filter((p) => p.id !== payment1.id);
  assert(paymentsSincePriorUpgrade.length === 0, 'pending downgrade + its expiry generates no additional payment/revenue');

  // ── Later validated payment activates the pending target correctly ──
  const payment2 = await subscriptionService.recordSuccessfulPayment({
    workspaceId: wsA.id, subscriptionId: null, planVersionOfferId: zOfferId, purpose: 'downgrade', amount: 10000, currency: 'BDT', idempotencyKey: `probe-down-${grantA.id}`,
  });
  const activatedDowngrade = await subscriptionService.activatePendingDowngrade({ workspaceId: wsA.id, subscriptionPaymentId: payment2.id });
  assert(activatedDowngrade.id === grantA.id, 'activatePendingDowngrade reactivates the SAME canonical subscription row (no duplicate history fragment)');
  assert(activatedDowngrade.planVersionOfferId === zOfferId, 'the pending target is correctly activated');
  assert(activatedDowngrade.pendingPlanVersionOfferId === null, 'pending target is cleared after successful activation');
  assert(activatedDowngrade.status === 'active', 'reactivated subscription is ACTIVE again');
  const finalEvents = await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, grantA.id));
  const finalDowngradedEvent = finalEvents.filter((e) => e.eventType === 'downgraded').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  assert(!!finalDowngradedEvent && finalDowngradedEvent.fromPlanVersionOfferId === yOfferId && finalDowngradedEvent.toPlanVersionOfferId === zOfferId, 'final downgraded event contains the correct from/to offers', finalDowngradedEvent);
  const docsForPayment2 = await db.select().from(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, payment2.id));
  assert(docsForPayment2.length === 1, 'a billing document was issued for the downgrade activation payment');

  // ── Cancellation clears a pending downgrade (cancellation wins) ──
  await subscriptionService.requestDowngrade({ subscriptionId: grantA.id, toPlanVersionOfferId: xOfferId, actorUserId: wsA.ownerUserId });
  const cancelledSub = await subscriptionService.requestCancellation(wsA.id, wsA.ownerUserId);
  assert(cancelledSub.cancelAtPeriodEnd === true, 'full cancellation sets cancel_at_period_end=true');
  assert(cancelledSub.pendingPlanVersionOfferId === null, 'full cancellation clears any pending downgrade (cancellation wins)');

  // ── Manual grants: unaffected by customer billing semantics ──
  const paymentsForGrantAOverall = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, grantA.id));
  assert(paymentsForGrantAOverall.every((p) => p.purpose !== 'manual_adjustment'), 'no manual-adjustment payment rows were ever fabricated for this customer subscription');

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);

  // ── Cleanup ──
  await cleanWorkspace(wsA);
  await cleanWorkspace(wsB);
  for (const planId of [planX.id, planY.id, planZ.id, creatorPlan.id]) {
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

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('PROBE CRASHED:', e);
  process.exit(1);
});
