/**
 * Phase 8 backend verification — Finance service. Creates clearly
 * identifiable temporary fixtures (plans prefixed "QA8", escrow/settlement
 * rows prefixed "esc_QA8_"/"stl_QA8_"), calls financeService directly
 * (matching the Phase 6/7 probe convention), verifies real HTTP security,
 * and cleans everything up afterward (with an explicit escrow-store flush
 * before exit — the Phase 7 lesson).
 *
 * Usage: npx tsx scripts/probe-finance.ts
 */
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';
import { escrowStore } from '../server/escrow/escrowStore';
import { getFinanceOverview, listFinanceTransactions, listFinanceSettlements, listFinanceBillingDocuments } from '../server/finance/financeService';
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
  await cleanupQaPlans('QA8');

  // ── Fixtures ──
  const sellerPlan = await planService.createPlan({ role: 'seller', name: 'QA8 Seller Plan', actorUserId: adminId });
  await planService.updatePlanMetadata(sellerPlan.id, { isPublic: true }, adminId);
  const v1 = await planService.createDraftVersion(sellerPlan.id, { nameSnapshot: 'QA8 Seller Plan v1' }, adminId);
  await planService.setDraftOffers(sellerPlan.id, v1.id, [{ billingInterval: 'monthly', price: 70000, currency: 'BDT' }]);
  await planService.publishVersion(sellerPlan.id, v1.id, adminId);
  const offerId = (await planService.getPlanDetail(sellerPlan.id)).versions[0].offers[0].id;

  const sub = await subscriptionService.activateInitialSubscription({ workspaceId: sellerWs.id, planVersionOfferId: offerId });
  const [succeededPayment] = await db.insert(subscriptionPayments).values({ subscriptionId: sub.id, workspaceId: sellerWs.id, planVersionOfferId: offerId, purpose: 'initial', amount: 70000, currency: 'BDT', result: 'succeeded', idempotencyKey: 'qa8-seller-succeeded' }).returning();
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: offerId, purpose: 'renewal', amount: 70000, currency: 'BDT', result: 'failed', idempotencyKey: 'qa8-seller-failed' });
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: offerId, purpose: 'renewal', amount: 70000, currency: 'BDT', result: 'cancelled', idempotencyKey: 'qa8-seller-cancelled' });
  await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: offerId, purpose: 'renewal', amount: 70000, currency: 'BDT', result: 'pending', idempotencyKey: 'qa8-seller-pending' });

  // A real billing document should already exist from activateInitialSubscription's own flow — issue one explicitly for the succeeded payment to be certain.
  const existingDoc = await db.select().from(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, succeededPayment.id));
  if (existingDoc.length === 0) {
    await subscriptionService.issueBillingDocumentForPayment({ subscriptionPaymentId: succeededPayment.id, workspaceId: sellerWs.id, periodStart: new Date(sub.currentPeriodStart), periodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null });
  }

  // Manual grant — must produce NO payment row and NO billing document.
  await cleanWorkspace(creatorWs.id);
  const creatorPlan = await planService.createPlan({ role: 'creator', name: 'QA8 Creator Plan', actorUserId: adminId });
  await planService.updatePlanMetadata(creatorPlan.id, { isPublic: true }, adminId);
  const cv1 = await planService.createDraftVersion(creatorPlan.id, { nameSnapshot: 'QA8 Creator Plan v1' }, adminId);
  await planService.setDraftOffers(creatorPlan.id, cv1.id, [{ billingInterval: 'annual', price: 500000, currency: 'BDT' }]);
  await planService.publishVersion(creatorPlan.id, cv1.id, adminId);
  const creatorOfferId = (await planService.getPlanDetail(creatorPlan.id)).versions[0].offers[0].id;
  await subscriptionService.manualGrant({ workspaceId: creatorWs.id, planVersionOfferId: creatorOfferId, actorUserId: adminId, reason: 'QA8 manual grant' });

  const range = { from: daysAgo(1), to: new Date(Date.now() + 60_000) };

  // ═══ OVERVIEW ═══
  const overview1 = await getFinanceOverview(range);
  assert(overview1.successfulSubscriptionPaymentCount >= 1, 'Overview counts at least the one succeeded subscription payment fixture', overview1.successfulSubscriptionPaymentCount);
  assert(overview1.failedSubscriptionPaymentCount >= 1, 'Overview counts the failed payment operationally', overview1.failedSubscriptionPaymentCount);
  assert(overview1.cancelledSubscriptionPaymentCount >= 1, 'Overview counts the cancelled payment operationally', overview1.cancelledSubscriptionPaymentCount);
  assert(overview1.pendingSubscriptionPaymentCount >= 1, 'Overview counts the pending payment operationally', overview1.pendingSubscriptionPaymentCount);
  assert(overview1.billingDocumentCount >= 1, 'Overview counts at least the one billing document issued for the succeeded payment', overview1.billingDocumentCount);

  // ═══ MANUAL GRANT: NO PAYMENT, NO BILLING DOCUMENT ═══
  const creatorPayments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, creatorWs.id));
  assert(creatorPayments.length === 0, 'Manual grant creates ZERO subscription_payments rows (Finance never fabricates revenue for it)', creatorPayments.length);

  // ═══ TRANSACTIONS ═══
  const tx = await listFinanceTransactions(range, { page: 1, pageSize: 50 });
  const succeededTxRow = tx.rows.find((r) => r.id === succeededPayment.id);
  assert(!!succeededTxRow && succeededTxRow.result === 'succeeded' && succeededTxRow.amount === 70000, 'Transactions list shows the real succeeded payment with its exact recorded amount (never recalculated)', succeededTxRow);
  const failedTxRow = tx.rows.find((r) => r.purpose === 'renewal' && r.result === 'failed');
  assert(!!failedTxRow, 'Transactions list shows the failed payment as a real record (operational, not revenue)', failedTxRow);

  const txSucceededOnly = await listFinanceTransactions({ ...range, paymentStatus: 'succeeded' }, { page: 1, pageSize: 50 });
  assert(txSucceededOnly.rows.every((r) => r.result === 'succeeded'), 'paymentStatus=succeeded filter returns only succeeded rows', txSucceededOnly.rows.map((r) => r.result));

  const txSellerOnly = await listFinanceTransactions({ ...range, persona: 'seller' }, { page: 1, pageSize: 50 });
  assert(txSellerOnly.rows.every((r) => r.workspaceType === 'seller'), 'persona=seller filter returns only Seller workspace rows', txSellerOnly.rows.map((r) => r.workspaceType));

  // ═══ SETTLEMENTS (real CommerceSettlement values preserved exactly) ═══
  const nowIso = new Date().toISOString();
  const escrow: CommerceEscrow = {
    escrowId: 'esc_QA8_1', paymentId: 'pay_QA8_1', checkoutId: 'chk_QA8_1', orderId: 'ord_QA8_1',
    consumerId: 'consumer_QA8', sellerId: 'seller_QA8', brandId: 'brand_QA8', currency: 'BDT',
    capturedAmount: 2500, heldAmount: 0, refundedAmount: 0, settledAmount: 2500, commissionAmount: 250, sellerNetAmount: 2250,
    status: 'settled', createdAt: nowIso, updatedAt: nowIso,
  };
  const settlement: CommerceSettlement = {
    settlementId: 'stl_QA8_1', escrowId: escrow.escrowId, paymentId: escrow.paymentId, orderId: escrow.orderId, checkoutId: escrow.checkoutId,
    sellerId: 'seller_QA8', brandId: 'brand_QA8', currency: 'BDT', grossAmount: 2500, commissionAmount: 250, sellerNetAmount: 2250,
    createdAt: nowIso, updatedAt: nowIso,
  };
  await escrowStore.upsertEscrow(escrow);
  await escrowStore.upsertSettlement(settlement);

  const st = await listFinanceSettlements(range, { page: 1, pageSize: 50 });
  const stRow = st.rows.find((r) => r.settlementId === settlement.settlementId);
  assert(!!stRow && stRow.commissionAmount === 25000 && stRow.sellerNetAmount === 225000 && stRow.grossAmount === 250000, 'Settlement row preserves the EXACT recorded commissionAmount/sellerNetAmount/grossAmount — never recalculated from current config', stRow);
  assert(stRow?.sellerName === null, 'Non-UUID test-fixture seller id gracefully falls back to raw id display (no crash)', stRow?.sellerName);

  // ═══ BILLING DOCUMENTS ═══
  const bd = await listFinanceBillingDocuments(range, { page: 1, pageSize: 50 });
  const bdRow = bd.rows.find((r) => r.amount === 70000);
  assert(!!bdRow, 'Billing documents list shows the real document issued for the succeeded payment', bdRow);
  assert(bd.rows.every((r) => r.status === 'issued' || r.status === 'void'), 'Billing document statuses are real enum values, never fabricated');
  const bdSellerOnly = await listFinanceBillingDocuments({ ...range, persona: 'seller' }, { page: 1, pageSize: 50 });
  assert(bdSellerOnly.rows.every((r) => r.workspaceType === 'seller'), 'persona filter applies correctly to billing documents too');

  // ═══ DATE FILTER: NO-DATA PERIOD / NO FUTURE LEAKAGE ═══
  const noDataRange = { from: new Date('2000-01-01'), to: new Date('2000-01-02') };
  const noDataOverview = await getFinanceOverview(noDataRange);
  assert(noDataOverview.successfulSubscriptionPaymentCount === 0 && noDataOverview.commerceSettlementCount === 0, 'A genuinely no-data historical period returns honest zeros', noDataOverview);
  const futureRange = { from: new Date(Date.now() + 365 * 86_400_000), to: new Date(Date.now() + 366 * 86_400_000) };
  const futureOverview = await getFinanceOverview(futureRange);
  assert(futureOverview.successfulSubscriptionPaymentCount === 0, 'No future-dated leakage — a future-only range shows zero records', futureOverview.successfulSubscriptionPaymentCount);

  // ═══ PAGINATION ═══
  const page1 = await listFinanceTransactions(range, { page: 1, pageSize: 2 });
  assert(page1.rows.length <= 2 && page1.pageSize === 2, 'Pagination respects the requested page size', page1.rows.length);

  // ═══ SECURITY ═══
  const sellerToken = await loginForEmail('seller@choosify.com.bd');
  const creatorToken = await loginForEmail('creator@choosify.com.bd');
  const adminToken = await loginForEmail('admin@choosify.com.bd');
  const qs = `from=${daysAgo(1).toISOString()}&to=${new Date().toISOString()}`;

  const noTokenResp = await fetch(`${BASE}/admin/finance/overview?${qs}`);
  assert(noTokenResp.status === 401, 'Unauthenticated request to Finance overview is rejected', noTokenResp.status);
  const sellerResp = await fetch(`${BASE}/admin/finance/overview?${qs}`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerResp.status === 401 || sellerResp.status === 403, 'Seller token cannot access Finance APIs', sellerResp.status);
  const creatorResp = await fetch(`${BASE}/admin/finance/overview?${qs}`, { headers: { Authorization: `Bearer ${creatorToken}` } });
  assert(creatorResp.status === 401 || creatorResp.status === 403, 'Creator token cannot access Finance APIs', creatorResp.status);
  const adminResp = await fetch(`${BASE}/admin/finance/overview?${qs}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(adminResp.status === 200, 'Admin/Super Admin token can access Finance APIs', adminResp.status);

  const sellerTxResp = await fetch(`${BASE}/admin/finance/transactions?${qs}`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerTxResp.status === 401 || sellerTxResp.status === 403, 'Seller token cannot access Finance transactions list', sellerTxResp.status);
  const sellerStResp = await fetch(`${BASE}/admin/finance/settlements?${qs}`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerStResp.status === 401 || sellerStResp.status === 403, 'Seller token cannot access Finance settlements list', sellerStResp.status);
  const sellerBdResp = await fetch(`${BASE}/admin/finance/billing-documents?${qs}`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerBdResp.status === 401 || sellerBdResp.status === 403, 'Seller token cannot access Finance billing documents list', sellerBdResp.status);

  // Client-supplied values never trusted — malformed filters rejected, not silently coerced.
  const badRangeResp = await fetch(`${BASE}/admin/finance/overview?from=not-a-date&to=${new Date().toISOString()}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert(badRangeResp.status === 400, 'Malformed date filter is rejected server-side, not silently coerced', badRangeResp.status);

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);

  // ── Cleanup ──
  await cleanWorkspace(sellerWs.id);
  await cleanWorkspace(creatorWs.id);
  await cleanupQaPlans('QA8');
  await escrowStore.deleteEscrow(escrow.escrowId);
  await escrowStore.deleteSettlement(settlement.settlementId);
  escrowStore.flushMemory();
  const remainingPlans = await db.select().from(plans).where(like(plans.name, 'QA8%'));
  console.log(remainingPlans.length === 0 ? 'PASS cleanup: no leftover QA8 plans' : `FAIL cleanup: ${remainingPlans.length} leftover`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('PROBE CRASHED:', e); process.exit(1); });
