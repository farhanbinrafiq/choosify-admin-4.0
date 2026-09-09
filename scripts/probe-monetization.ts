/**
 * Phase 7 backend verification — Monetization Center aggregation service.
 * Creates clearly-identifiable temporary fixtures (plans prefixed "QA7",
 * escrow/settlement rows prefixed "esc_QA7_"/"stl_QA7_"), calls
 * monetizationService directly (matching the Phase 6 probe convention),
 * and cleans everything up afterward.
 *
 * Usage: npx tsx scripts/probe-monetization.ts
 */
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';
import { escrowStore } from '../server/escrow/escrowStore';
import { monetizationService } from '../server/monetization/monetizationService';
import type { CommerceEscrow, CommerceSettlement } from '../server/escrow/types';

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const BASE = (process.env.PROBE_ADMIN_BASE || 'http://localhost:3001') + '/api/v1';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function loginForEmail(email: string): Promise<string> {
  const resp = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const data = (await resp.json()) as { accessToken?: string };
  if (!resp.ok || !data.accessToken) throw new Error(`login failed for ${email}: ${resp.status}`);
  return data.accessToken;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

let escrowSeq = 0;
function makeEscrow(overrides: Partial<CommerceEscrow>): CommerceEscrow {
  escrowSeq += 1;
  const now = new Date().toISOString();
  return {
    escrowId: `esc_QA7_${escrowSeq}`,
    paymentId: `pay_QA7_${escrowSeq}`,
    checkoutId: `chk_QA7_${escrowSeq}`,
    orderId: `ord_QA7_${escrowSeq}`,
    consumerId: 'consumer_QA7',
    sellerId: 'seller_QA7',
    brandId: 'brand_QA7',
    currency: 'BDT',
    capturedAmount: 1000,
    heldAmount: 0,
    refundedAmount: 0,
    settledAmount: 1000,
    commissionAmount: 100,
    sellerNetAmount: 900,
    status: 'settled',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let settlementSeq = 0;
function makeSettlement(overrides: Partial<CommerceSettlement>): CommerceSettlement {
  settlementSeq += 1;
  const now = new Date().toISOString();
  return {
    settlementId: `stl_QA7_${settlementSeq}`,
    escrowId: `esc_QA7_${settlementSeq}`,
    paymentId: `pay_QA7_${settlementSeq}`,
    orderId: `ord_QA7_${settlementSeq}`,
    checkoutId: `chk_QA7_${settlementSeq}`,
    sellerId: 'seller_QA7',
    brandId: 'brand_QA7',
    currency: 'BDT',
    grossAmount: 1000,
    commissionAmount: 100,
    sellerNetAmount: 900,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(1);
  }

  const sellerUser = (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  const creatorUser = (await db.select().from(users).where(eq(users.email, 'creator@choosify.com.bd')).limit(1))[0];
  const adminUser = (await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1))[0];
  const sellerWs = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, sellerUser.id)))[0];
  const creatorWs = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, creatorUser.id)))[0];
  const adminId = adminUser.id;

  async function cleanWorkspace(wsId: string) {
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsId));
    for (const s of subs) await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, wsId));
  }
  async function cleanupQaPlans(prefix: string) {
    const qaPlans = await db.select().from(plans).where(like(plans.name, `${prefix}%`));
    for (const p of qaPlans) {
      const versions = await db.select().from(planVersions).where(eq(planVersions.planId, p.id));
      await db.update(plans).set({ currentPublishedVersionId: null }).where(eq(plans.id, p.id));
      for (const v of versions) {
        await db.execute(`delete from plan_entitlements where plan_version_id = '${v.id}'`);
        await db.execute(`delete from plan_limits where plan_version_id = '${v.id}'`);
        await db.execute(`delete from plan_version_offers where plan_version_id = '${v.id}'`);
      }
      await db.delete(planVersions).where(eq(planVersions.planId, p.id));
      await db.delete(plans).where(eq(plans.id, p.id));
    }
  }
  await cleanWorkspace(sellerWs.id);
  await cleanWorkspace(creatorWs.id);
  await cleanupQaPlans('QA7');

  // ── Fixtures: Seller plan v1, then v2 (grandfathering test) ──
  const sellerPlan = await planService.createPlan({ role: 'seller', name: 'QA7 Seller Plan', actorUserId: adminId });
  await planService.updatePlanMetadata(sellerPlan.id, { isPublic: true }, adminId);
  const v1 = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'QA7 Seller Plan v1' }, adminId);
  await planService.setDraftOffers(sellerPlan.id, v1.id, [{ billingInterval: 'monthly', price: 50000, currency: 'BDT' }]);
  await planService.publishVersion(sellerPlan.id, v1.id, adminId);
  const v1OfferId = (await planService.getPlanDetail(sellerPlan.id)).versions[0].offers[0].id;

  const creatorPlan = await planService.createPlan({ role: 'creator', name: 'QA7 Creator Plan', actorUserId: adminId });
  await planService.updatePlanMetadata(creatorPlan.id, { isPublic: true }, adminId);
  const cv1 = await planService.createDraftVersion(creatorPlan.id, { nameSnapshot: 'QA7 Creator Plan v1' }, adminId);
  await planService.setDraftOffers(creatorPlan.id, cv1.id, [{ billingInterval: 'annual', price: 400000, currency: 'BDT' }]);
  await planService.publishVersion(creatorPlan.id, cv1.id, adminId);
  const creatorOfferId = (await planService.getPlanDetail(creatorPlan.id)).versions[0].offers[0].id;

  // ── Seller: succeeded initial payment on v1 ──
  const sellerSub = await subscriptionService.activateInitialSubscription({ workspaceId: sellerWs.id, planVersionOfferId: v1OfferId });
  const [sellerPaymentRow] = await db
    .insert(subscriptionPayments)
    .values({ subscriptionId: sellerSub.id, workspaceId: sellerWs.id, planVersionOfferId: v1OfferId, purpose: 'initial', amount: 50000, currency: 'BDT', result: 'succeeded', idempotencyKey: 'qa7-seller-succeeded' })
    .returning();

  // ── Creator: succeeded initial payment ──
  const creatorSub = await subscriptionService.activateInitialSubscription({ workspaceId: creatorWs.id, planVersionOfferId: creatorOfferId });
  await db.insert(subscriptionPayments).values({ subscriptionId: creatorSub.id, workspaceId: creatorWs.id, planVersionOfferId: creatorOfferId, purpose: 'initial', amount: 400000, currency: 'BDT', result: 'succeeded', idempotencyKey: 'qa7-creator-succeeded' });

  // ── Failed / pending / cancelled payments (must NOT count as revenue) ──
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: v1OfferId, purpose: 'renewal', amount: 50000, currency: 'BDT', result: 'failed', idempotencyKey: 'qa7-seller-failed' });
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: v1OfferId, purpose: 'renewal', amount: 50000, currency: 'BDT', result: 'pending', idempotencyKey: 'qa7-seller-pending' });
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: v1OfferId, purpose: 'renewal', amount: 50000, currency: 'BDT', result: 'cancelled', idempotencyKey: 'qa7-seller-cancelled' });

  // ── Renewal event for lifecycle counts ──
  await subscriptionService.renewSubscription({ subscriptionId: sellerSub.id });

  const range = { from: daysAgo(1), to: new Date(Date.now() + 60_000) };

  // ═══ SUBSCRIPTION REVENUE ═══
  const subMetrics1 = await monetizationService.getSubscriptionMetrics(range);
  assert(subMetrics1.sellerRevenue === 50000, 'Seller subscription revenue counts only the succeeded payment', subMetrics1.sellerRevenue);
  assert(subMetrics1.creatorRevenue === 400000, 'Creator subscription revenue counts only the succeeded payment', subMetrics1.creatorRevenue);
  assert(subMetrics1.paymentCounts.failed === 1 && subMetrics1.paymentCounts.pending === 1 && subMetrics1.paymentCounts.cancelled === 1, 'Failed/pending/cancelled payments are counted operationally but not as revenue', subMetrics1.paymentCounts);
  assert(subMetrics1.renewals === 1, 'Renewal lifecycle event counted', subMetrics1.renewals);

  const summary1 = await monetizationService.getSummary({ ...range, source: 'subscriptions' });
  assert(summary1.subscriptionRevenue === 450000, 'Total subscription revenue = seller + creator succeeded payments only', summary1.subscriptionRevenue);
  assert(summary1.commissionRevenue === null && summary1.gmv === null, "source='subscriptions' excludes commerce metrics (null, not 0)", summary1);

  // ── Manual grant produces ZERO subscription revenue ──
  await cleanWorkspace(creatorWs.id);
  const manualGrant = await subscriptionService.manualGrant({ workspaceId: creatorWs.id, planVersionOfferId: creatorOfferId, actorUserId: adminId, reason: 'QA7 manual grant' });
  const subMetrics2 = await monetizationService.getSubscriptionMetrics(range);
  assert(subMetrics2.creatorRevenue === 0, 'Manual grant contributes ZERO subscription revenue', subMetrics2.creatorRevenue);

  // ── Duplicate-read stability: calling twice must return identical totals (no side effects) ──
  const readA = await monetizationService.getSubscriptionMetrics(range);
  const readB = await monetizationService.getSubscriptionMetrics(range);
  assert(readA.sellerRevenue === readB.sellerRevenue && readA.creatorRevenue === readB.creatorRevenue, 'Repeated reads never double-count (idempotent aggregation)', { readA: readA.sellerRevenue, readB: readB.sellerRevenue });

  // ═══ PLAN VERSION GRANDFATHERING ═══
  const v2 = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'QA7 Seller Plan v2' }, adminId);
  await planService.setDraftOffers(sellerPlan.id, v2.id, [{ billingInterval: 'monthly', price: 90000, currency: 'BDT' }]);
  await planService.publishVersion(sellerPlan.id, v2.id, adminId);
  const subMetrics3 = await monetizationService.getSubscriptionMetrics(range);
  assert(subMetrics3.sellerRevenue === 50000, 'Publishing v2 does NOT rewrite the existing v1 historical revenue', subMetrics3.sellerRevenue);
  const v1Row = subMetrics3.byPlan.find((r) => r.planVersion === 1 && r.planName === 'QA7 Seller Plan');
  assert(v1Row?.revenue === 50000, 'By-plan breakdown attributes the payment to the actual purchased Version (v1), not the current published Version', v1Row);
  const v2Row = subMetrics3.byPlan.find((r) => r.planVersion === 2 && r.planName === 'QA7 Seller Plan');
  assert(!v2Row, 'No revenue is fabricated for v2 — nobody has paid for it', v2Row);

  // ═══ PERSONA ISOLATION ═══
  const summarySellerOnly = await monetizationService.getSubscriptionMetrics({ ...range, persona: 'seller' });
  assert(summarySellerOnly.sellerRevenue === 50000 && summarySellerOnly.creatorRevenue === 0, 'Persona=seller filter shows only Seller revenue, zero cross-persona leakage into the response fields', summarySellerOnly);

  // ═══ COMMERCE: GMV / COMMISSION / SELLER NET (separate concepts) ═══
  // This is a shared dev environment with real, pre-existing escrow/settlement activity, so this
  // section asserts on the DELTA its own fixtures introduce, not on an assumed-empty baseline.
  const commerceRange = { from: daysAgo(3), to: new Date(Date.now() + 60_000) };
  const baselineGmv = await monetizationService.getGmvMetrics(commerceRange);
  const baselineCommission = await monetizationService.getCommissionMetrics(commerceRange);
  const baselineSummary = await monetizationService.getSummary({ ...commerceRange, source: 'commerce' });

  const e1 = makeEscrow({ capturedAmount: 1000, commissionAmount: 100, sellerNetAmount: 900, createdAt: daysAgo(1).toISOString() });
  const e2 = makeEscrow({ capturedAmount: 2000, commissionAmount: 200, sellerNetAmount: 1800, createdAt: daysAgo(2).toISOString() });
  await escrowStore.upsertEscrow(e1);
  await escrowStore.upsertEscrow(e2);
  const s1 = makeSettlement({ escrowId: e1.escrowId, grossAmount: 1000, commissionAmount: 100, sellerNetAmount: 900, createdAt: e1.createdAt });
  const s2 = makeSettlement({ escrowId: e2.escrowId, grossAmount: 2000, commissionAmount: 200, sellerNetAmount: 1800, createdAt: e2.createdAt });
  await escrowStore.upsertSettlement(s1);
  await escrowStore.upsertSettlement(s2);

  const gmvMetrics = await monetizationService.getGmvMetrics(commerceRange);
  const commissionMetrics = await monetizationService.getCommissionMetrics(commerceRange);
  assert(gmvMetrics.totalGmv - baselineGmv.totalGmv === 300000, 'GMV = SUM(escrow.capturedAmount) in minor units — this fixture\'s 2 escrows add exactly ৳3000.00', { delta: gmvMetrics.totalGmv - baselineGmv.totalGmv });
  assert(commissionMetrics.totalCommission - baselineCommission.totalCommission === 30000, 'Commission Revenue = SUM(settlement.commissionAmount) — this fixture\'s 2 settlements add exactly ৳300.00', { delta: commissionMetrics.totalCommission - baselineCommission.totalCommission });
  assert(gmvMetrics.totalGmv !== commissionMetrics.totalCommission, 'GMV and Commission Revenue are genuinely different numbers, never conflated');

  const commerceSummary = await monetizationService.getSummary({ ...commerceRange, source: 'commerce' });
  const sellerNetDelta = (commerceSummary.sellerNet ?? 0) - (baselineSummary.sellerNet ?? 0);
  assert(sellerNetDelta === 270000, 'Seller Net = SUM(settlement.sellerNetAmount) — this fixture\'s 2 settlements add exactly ৳2700.00, tracked separately from commission/GMV', { sellerNetDelta });
  assert(commerceSummary.subscriptionRevenue === null, "source='commerce' excludes subscription revenue (null, not 0)", commerceSummary);
  const platformRevenueDelta = (commerceSummary.platformRevenue ?? 0) - (baselineSummary.platformRevenue ?? 0);
  assert(platformRevenueDelta === 30000, 'Platform Revenue delta under source=commerce equals ONLY the Commission Revenue delta (30000), never the GMV delta (300000)', { platformRevenueDelta });

  // ── Duplicate settlement upsert (same settlementId) must not double count ──
  await escrowStore.upsertSettlement({ ...s1 }); // re-upsert identical row (simulates a retried write)
  const commissionAfterReupsert = await monetizationService.getCommissionMetrics(commerceRange);
  assert(commissionAfterReupsert.totalCommission === commissionMetrics.totalCommission, 'Re-upserting the same settlement row (retry) does not double-count commission', { before: commissionMetrics.totalCommission, after: commissionAfterReupsert.totalCommission });

  // ═══ PLATFORM REVENUE = COMMISSION + SUBSCRIPTION (never GMV) ═══
  const allSummary = await monetizationService.getSummary({ from: daysAgo(3), to: new Date(Date.now() + 60_000) });
  const expectedPlatform = (allSummary.subscriptionRevenue ?? 0) + (allSummary.commissionRevenue ?? 0);
  assert(allSummary.platformRevenue === expectedPlatform, 'Platform Revenue always equals exactly Commission + Subscription — never includes GMV', { platformRevenue: allSummary.platformRevenue, expectedPlatform, gmv: allSummary.gmv });
  assert(allSummary.platformRevenue !== allSummary.gmv, 'Platform Revenue is never equal to (confused with) GMV in this fixture', allSummary);

  // ═══ DATE FILTERING ═══
  const noDataRange = { from: new Date('2000-01-01'), to: new Date('2000-01-02') };
  const noDataSummary = await monetizationService.getSummary(noDataRange);
  assert(noDataSummary.subscriptionRevenue === 0 && noDataSummary.commissionRevenue === 0 && noDataSummary.gmv === 0, 'A genuinely no-data historical period returns honest zeros, not an error or fabricated value', noDataSummary);

  const todayRange = (() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: now };
  })();
  const todaySummary = await monetizationService.getSummary(todayRange);
  assert((todaySummary.subscriptionRevenue ?? 0) >= 50000, "'Today' date preset includes payments created moments ago", todaySummary.subscriptionRevenue);

  // ═══ TREND ═══
  const trend = await monetizationService.getRevenueTrend({ from: daysAgo(3), to: new Date(Date.now() + 60_000) });
  const trendTotal = trend.points.reduce((s, p) => s + p.subscriptionRevenue, 0);
  assert(trendTotal === 50000, 'Revenue trend points sum to the same total as the summary (real transaction dates, no fabricated points)', { trendTotal, points: trend.points.length });
  const emptyTrend = await monetizationService.getRevenueTrend(noDataRange);
  assert(emptyTrend.points.length === 0, 'A no-data period yields zero trend points — an honest empty chart, not fake points', emptyTrend.points.length);

  // ═══ FILTER OPTIONS ═══
  const filterOptions = await monetizationService.getFilterOptions();
  assert(filterOptions.plans.some((p) => p.name === 'QA7 Seller Plan'), 'Filter options list real plans from the database', filterOptions.plans.length);

  // ═══ SECURITY ═══
  const sellerToken = await loginForEmail('seller@choosify.com.bd');
  const adminToken = await loginForEmail('admin@choosify.com.bd');
  const noTokenResp = await fetch(`${BASE}/admin/monetization/summary?from=${daysAgo(1).toISOString()}&to=${new Date().toISOString()}`);
  assert(noTokenResp.status === 401, 'Unauthenticated request to Monetization summary is rejected', noTokenResp.status);
  const sellerResp = await fetch(`${BASE}/admin/monetization/summary?from=${daysAgo(1).toISOString()}&to=${new Date().toISOString()}`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerResp.status === 401 || sellerResp.status === 403, 'Seller token cannot access Monetization Center APIs', sellerResp.status);
  const adminResp = await fetch(`${BASE}/admin/monetization/summary?from=${daysAgo(1).toISOString()}&to=${new Date().toISOString()}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(adminResp.status === 200, 'Admin/Super Admin token can access Monetization Center APIs', adminResp.status);
  const adminJson = (await adminResp.json()) as { success: boolean; summary?: { subscriptionRevenue: number | null } };
  assert(adminJson.success === true, 'Admin-authorized HTTP response is well-formed', adminJson);

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);

  // ── Cleanup ──
  await cleanWorkspace(sellerWs.id);
  await cleanWorkspace(creatorWs.id);
  await cleanupQaPlans('QA7');
  await escrowStore.deleteEscrow(e1.escrowId);
  await escrowStore.deleteEscrow(e2.escrowId);
  await escrowStore.deleteSettlement(s1.settlementId);
  await escrowStore.deleteSettlement(s2.settlementId);
  const remainingPlans = await db.select().from(plans).where(like(plans.name, 'QA7%'));
  const remainingEscrows = await escrowStore.listEscrowsInRange('2000-01-01', new Date(Date.now() + 86_400_000).toISOString());
  const leftoverQaEscrows = remainingEscrows.filter((e) => e.escrowId.startsWith('esc_QA7_'));
  console.log(remainingPlans.length === 0 ? 'PASS cleanup: no leftover QA7 plans' : `FAIL cleanup: ${remainingPlans.length} leftover QA7 plans`);
  console.log(leftoverQaEscrows.length === 0 ? 'PASS cleanup: no leftover QA7 escrows' : `FAIL cleanup: ${leftoverQaEscrows.length} leftover QA7 escrows`);

  // The escrow store's disk persistence is debounced/async — flush it explicitly before exiting
  // so this run's deletes are actually durable on disk, not just in this process's memory (a
  // process.exit() right after a scheduled-but-not-yet-written persist would otherwise leave the
  // deleted fixtures to reappear on the NEXT run's re-hydration from the stale on-disk snapshot).
  escrowStore.flushMemory();

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('PROBE CRASHED:', e); process.exit(1); });
