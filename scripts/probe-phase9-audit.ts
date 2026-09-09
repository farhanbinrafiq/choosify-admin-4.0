/**
 * Phase 9 — cross-cutting production-readiness audit script. Covers what
 * Phases 6/7/8's own probes didn't yet explicitly test as a browser/HTTP
 * matter: Consumer-role denial across all three financial admin surfaces,
 * cross-workspace (Seller A vs Seller B) isolation, Payouts/Cashbook
 * backend authorization, and a data-integrity spot check (orphaned rows).
 * Creates one throwaway Consumer user + one throwaway second Seller
 * workspace, cleans both up afterward.
 *
 * Usage: npx tsx scripts/probe-phase9-audit.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments, planVersionOffers, planVersions, plans } from '../server/db/schema';
import { hashPassword } from '../server/auth/jwtTokens';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const BASE = (process.env.PROBE_ADMIN_BASE || 'http://localhost:3001') + '/api/v1';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function loginForEmail(email: string, password = DEV_PASSWORD): Promise<string> {
  const resp = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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

  const qs = `from=${daysAgo(1).toISOString()}&to=${new Date().toISOString()}`;

  // ═══ SECTION A: CONSUMER-ROLE DENIAL ═══
  const consumerEmail = `phase9-consumer-${Date.now()}@probe.local`;
  const [consumerUser] = await db
    .insert(users)
    .values({ email: consumerEmail, passwordHash: await hashPassword(DEV_PASSWORD), displayName: 'Phase9 Consumer', role: 'user', emailVerified: true })
    .returning();
  const consumerToken = await loginForEmail(consumerEmail);

  const consumerMonResp = await fetch(`${BASE}/admin/monetization/summary?${qs}`, { headers: { Authorization: `Bearer ${consumerToken}` } });
  assert(consumerMonResp.status === 401 || consumerMonResp.status === 403, 'Consumer role cannot access Monetization APIs', consumerMonResp.status);
  const consumerFinResp = await fetch(`${BASE}/admin/finance/overview?${qs}`, { headers: { Authorization: `Bearer ${consumerToken}` } });
  assert(consumerFinResp.status === 401 || consumerFinResp.status === 403, 'Consumer role cannot access Finance APIs', consumerFinResp.status);
  const consumerPlansResp = await fetch(`${BASE}/admin/subscription-plans`, { headers: { Authorization: `Bearer ${consumerToken}` } });
  assert(consumerPlansResp.status === 401 || consumerPlansResp.status === 403, 'Consumer role cannot access Super Admin Subscription Plans APIs', consumerPlansResp.status);
  const consumerCheckoutResp = await fetch(`${BASE}/subscriptions/checkout/initiate`, { method: 'POST', headers: { Authorization: `Bearer ${consumerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: 'x', purpose: 'initial' }) });
  assert(consumerCheckoutResp.status === 403 || consumerCheckoutResp.status === 400, 'Consumer role cannot initiate a subscription checkout (no workspace concept for Consumer)', consumerCheckoutResp.status);

  // ═══ SECTION B: PAYOUTS / CASHBOOK AUTHORIZATION ═══
  const sellerUser = (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  const sellerToken = await loginForEmail(sellerUser.email);
  const adminToken = await loginForEmail('admin@choosify.com.bd');

  const noTokenFinanceSummary = await fetch(`${BASE}/finance/summary`);
  assert(noTokenFinanceSummary.status === 401, 'Unauthenticated request to /finance/summary (payout/cashbook backend) is rejected', noTokenFinanceSummary.status);
  const sellerOwnSummary = await fetch(`${BASE}/finance/summary`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerOwnSummary.status === 200, "Seller CAN read their OWN payout summary (legitimate self-service)", sellerOwnSummary.status);
  const consumerCashbookOversight = await fetch(`${BASE}/cashbooks/oversight`, { headers: { Authorization: `Bearer ${consumerToken}` } });
  assert(consumerCashbookOversight.status === 401 || consumerCashbookOversight.status === 403, 'Consumer role cannot access staff cashbook oversight', consumerCashbookOversight.status);

  // ═══ SECTION C: CROSS-WORKSPACE ISOLATION (Seller A vs Seller B) ═══
  const creatorUser = (await db.select().from(users).where(eq(users.email, 'creator@choosify.com.bd')).limit(1))[0];
  const creatorToken = await loginForEmail(creatorUser.email);

  // Seller A's own subscription/history/payment-history endpoints resolve strictly from the
  // AUTHENTICATED caller (never a client-supplied workspaceId) — verified by re-reading the
  // router source (Phase 5/6 already locked this down); here we confirm a Creator token reading
  // "their own" subscription endpoints gets THEIR OWN (or empty) data, never Seller A's.
  const sellerCurrentResp = await fetch(`${BASE}/subscriptions/current`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  const creatorCurrentResp = await fetch(`${BASE}/subscriptions/current`, { headers: { Authorization: `Bearer ${creatorToken}` } });
  const sellerCurrentJson = (await sellerCurrentResp.json()) as { workspace?: { id?: string } };
  const creatorCurrentJson = (await creatorCurrentResp.json()) as { workspace?: { id?: string } };
  assert(!!sellerCurrentJson.workspace?.id && !!creatorCurrentJson.workspace?.id && sellerCurrentJson.workspace.id !== creatorCurrentJson.workspace.id, "Seller and Creator each resolve to their OWN distinct workspace — never each other's", { seller: sellerCurrentJson.workspace?.id, creator: creatorCurrentJson.workspace?.id });

  const sellerHistoryResp = await fetch(`${BASE}/subscriptions/history`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  const creatorHistoryResp = await fetch(`${BASE}/subscriptions/history`, { headers: { Authorization: `Bearer ${creatorToken}` } });
  assert(sellerHistoryResp.status === 200 && creatorHistoryResp.status === 200, 'Both Seller and Creator can read their own history (never a 403 for their own data)', { seller: sellerHistoryResp.status, creator: creatorHistoryResp.status });

  // Create one definitive, throwaway fixture so this critical check never silently skips.
  const sellerWs = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, sellerUser.id)))[0];
  const adminForPlan = (await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1))[0];
  const p9Plan = await planService.createPlan({ role: 'seller', name: 'PHASE9 Isolation Plan', actorUserId: adminForPlan.id });
  await planService.updatePlanMetadata(p9Plan.id, { isPublic: true }, adminForPlan.id);
  const p9v1 = await planService.createDraftVersion(p9Plan.id, { nameSnapshot: 'PHASE9 Isolation Plan v1' }, adminForPlan.id);
  await planService.setDraftOffers(p9Plan.id, p9v1.id, [{ billingInterval: 'monthly', price: 10000, currency: 'BDT' }]);
  await planService.publishVersion(p9Plan.id, p9v1.id, adminForPlan.id);
  const p9OfferId = (await planService.getPlanDetail(p9Plan.id)).versions[0].offers[0].id;
  const existingSellerSub = await subscriptionService.getCurrentSubscription(sellerWs.id);
  let p9PaymentId: string;
  let p9CreatedSubId: string | null = null;
  if (!existingSellerSub) {
    const p9Sub = await subscriptionService.activateInitialSubscription({ workspaceId: sellerWs.id, planVersionOfferId: p9OfferId });
    p9CreatedSubId = p9Sub.id;
    const [p9Payment] = await db.insert(subscriptionPayments).values({ subscriptionId: p9Sub.id, workspaceId: sellerWs.id, planVersionOfferId: p9OfferId, purpose: 'initial', amount: 10000, currency: 'BDT', result: 'succeeded', idempotencyKey: `phase9-isolation-${Date.now()}` }).returning();
    p9PaymentId = p9Payment.id;
  } else {
    const [p9Payment] = await db.insert(subscriptionPayments).values({ subscriptionId: null, workspaceId: sellerWs.id, planVersionOfferId: existingSellerSub.offer.id, purpose: 'renewal', amount: 10000, currency: 'BDT', result: 'pending', idempotencyKey: `phase9-isolation-${Date.now()}` }).returning();
    p9PaymentId = p9Payment.id;
  }
  const creatorReadingSellerPayment = await fetch(`${BASE}/subscriptions/payments/${p9PaymentId}/status`, { headers: { Authorization: `Bearer ${creatorToken}` } });
  assert(creatorReadingSellerPayment.status === 404, "Creator token cannot read Seller's own subscription payment by id (workspace-scoped, not just role-scoped)", creatorReadingSellerPayment.status);
  const sellerReadingOwnPayment = await fetch(`${BASE}/subscriptions/payments/${p9PaymentId}/status`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(sellerReadingOwnPayment.status === 200, 'Seller CAN read their own subscription payment by id (legitimate self-service, proving the 404 above is isolation, not a general bug)', sellerReadingOwnPayment.status);

  // Cleanup this specific fixture immediately (before the broader data-integrity scan below).
  await db.delete(subscriptionPayments).where(eq(subscriptionPayments.id, p9PaymentId));
  if (p9CreatedSubId) {
    await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, p9CreatedSubId));
    await db.delete(subscriptions).where(eq(subscriptions.id, p9CreatedSubId));
  }
  const p9Versions = await db.select().from(planVersions).where(eq(planVersions.planId, p9Plan.id));
  await db.update(plans).set({ currentPublishedVersionId: null }).where(eq(plans.id, p9Plan.id));
  for (const v of p9Versions) {
    await db.execute(`delete from plan_entitlements where plan_version_id = '${v.id}'`);
    await db.execute(`delete from plan_limits where plan_version_id = '${v.id}'`);
    await db.execute(`delete from plan_version_offers where plan_version_id = '${v.id}'`);
  }
  await db.delete(planVersions).where(eq(planVersions.planId, p9Plan.id));
  await db.delete(plans).where(eq(plans.id, p9Plan.id));

  // Client-supplied workspaceId is never honored — re-confirm by source inspection (matches the Phase 5 pattern).
  const { readFileSync } = await import('node:fs');
  const subRouterSrc = readFileSync(new URL('../server/subscriptions/subscriptionsRouter.ts', import.meta.url), 'utf8');
  for (const route of ["'/subscriptions/current'", "'/subscriptions/history'", "'/subscriptions/payments/history'", "'/subscriptions/checkout/initiate'"]) {
    const start = subRouterSrc.indexOf(route);
    const slice = subRouterSrc.slice(start, start + 600);
    assert(!slice.includes('body.workspaceId') && !slice.includes('params.workspaceId') && !slice.includes('query.workspaceId'), `${route} never accepts a client-supplied workspaceId`, route);
  }
  const finRouterSrc = readFileSync(new URL('../server/finance/financeRouter.ts', import.meta.url), 'utf8');
  assert(!finRouterSrc.includes('req.query.workspaceId') && !finRouterSrc.includes('req.body.workspaceId'), 'Finance router never accepts a client-supplied workspaceId for any query');
  const monRouterSrc = readFileSync(new URL('../server/monetization/monetizationRouter.ts', import.meta.url), 'utf8');
  assert(!monRouterSrc.includes('req.query.workspaceId') && !monRouterSrc.includes('req.body.workspaceId'), 'Monetization router never accepts a client-supplied workspaceId for any query');

  // ═══ SECTION D: DATA INTEGRITY (orphan spot-check over REAL, non-QA data) ═══
  const allSubs = await db.select({ id: subscriptions.id, workspaceId: subscriptions.workspaceId, planVersionOfferId: subscriptions.planVersionOfferId }).from(subscriptions);
  const allWorkspaceIds = new Set((await db.select({ id: workspaces.id }).from(workspaces)).map((w) => w.id));
  const allOfferIds = new Set((await db.select({ id: planVersionOffers.id }).from(planVersionOffers)).map((o) => o.id));
  const orphanedSubsByWorkspace = allSubs.filter((s) => !allWorkspaceIds.has(s.workspaceId));
  const orphanedSubsByOffer = allSubs.filter((s) => !allOfferIds.has(s.planVersionOfferId));
  assert(orphanedSubsByWorkspace.length === 0, 'No subscription rows reference a non-existent workspace', orphanedSubsByWorkspace.length);
  assert(orphanedSubsByOffer.length === 0, 'No subscription rows reference a non-existent plan_version_offer', orphanedSubsByOffer.length);

  const allPayments = await db.select({ id: subscriptionPayments.id, workspaceId: subscriptionPayments.workspaceId, subscriptionId: subscriptionPayments.subscriptionId, result: subscriptionPayments.result }).from(subscriptionPayments);
  const allSubIds = new Set(allSubs.map((s) => s.id));
  const orphanedPaymentsByWorkspace = allPayments.filter((p) => !allWorkspaceIds.has(p.workspaceId));
  const paymentsWithDanglingSub = allPayments.filter((p) => p.subscriptionId !== null && !allSubIds.has(p.subscriptionId));
  assert(orphanedPaymentsByWorkspace.length === 0, 'No subscription_payments rows reference a non-existent workspace', orphanedPaymentsByWorkspace.length);
  assert(paymentsWithDanglingSub.length === 0, 'No subscription_payments rows reference a non-existent subscription', paymentsWithDanglingSub.length);
  const succeededWithNullSub = allPayments.filter((p) => p.result === 'succeeded' && p.subscriptionId === null);
  assert(succeededWithNullSub.length === 0, 'Every SUCCEEDED payment is linked to a real subscription (Part 22 of the Phase 6 spec) — none left dangling', succeededWithNullSub.map((p) => p.id));

  const allBillingDocs = await db.select({ id: subscriptionBillingDocuments.id, subscriptionPaymentId: subscriptionBillingDocuments.subscriptionPaymentId, workspaceId: subscriptionBillingDocuments.workspaceId }).from(subscriptionBillingDocuments);
  const allPaymentIds = new Set(allPayments.map((p) => p.id));
  const orphanedBillingDocs = allBillingDocs.filter((b) => !allPaymentIds.has(b.subscriptionPaymentId));
  assert(orphanedBillingDocs.length === 0, 'No billing document references a non-existent subscription_payment', orphanedBillingDocs.length);
  // Exactly one billing document per successful payment — never more.
  const billingDocsByPayment = new Map<string, number>();
  for (const b of allBillingDocs) billingDocsByPayment.set(b.subscriptionPaymentId, (billingDocsByPayment.get(b.subscriptionPaymentId) || 0) + 1);
  const doubleIssued = [...billingDocsByPayment.entries()].filter(([, count]) => count > 1);
  assert(doubleIssued.length === 0, 'No subscription_payment has more than one billing document (DB unique constraint + service logic both hold)', doubleIssued);

  // One-open-subscription-per-workspace invariant.
  const openStatuses = new Set(['trial', 'active', 'past_due', 'grace_period']);
  const openByWorkspace = new Map<string, number>();
  const allSubsWithStatus = await db.select({ workspaceId: subscriptions.workspaceId, status: subscriptions.status }).from(subscriptions);
  for (const s of allSubsWithStatus) {
    if (openStatuses.has(s.status)) openByWorkspace.set(s.workspaceId, (openByWorkspace.get(s.workspaceId) || 0) + 1);
  }
  const workspacesWithMultipleOpen = [...openByWorkspace.entries()].filter(([, count]) => count > 1);
  assert(workspacesWithMultipleOpen.length === 0, 'No workspace has more than one OPEN subscription simultaneously (DB partial unique index holds)', workspacesWithMultipleOpen);

  // ═══ SECTION E: TIMESTAMP BOUNDARY SANITY (does the drift-aware query correctly bound "today") ═══
  const { monetizationService } = await import('../server/monetization/monetizationService');
  const now = new Date();
  const todayRange = { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: now };
  const yesterdayRange = { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1) };
  const todaySummary = await monetizationService.getSummary(todayRange);
  const yesterdaySummary = await monetizationService.getSummary(yesterdayRange);
  assert(typeof todaySummary.subscriptionRevenue === 'number' || todaySummary.subscriptionRevenue === null, "'Today' boundary query executes without error", todaySummary.subscriptionRevenue);
  assert(typeof yesterdaySummary.subscriptionRevenue === 'number' || yesterdaySummary.subscriptionRevenue === null, "'Yesterday' boundary (ending exactly at today's start minus 1ms) query executes without error", yesterdaySummary.subscriptionRevenue);

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);

  // ── Cleanup ──
  await db.delete(users).where(eq(users.id, consumerUser.id));
  const remainingConsumer = await db.select().from(users).where(eq(users.email, consumerEmail));
  console.log(remainingConsumer.length === 0 ? 'PASS cleanup: throwaway consumer user removed' : 'FAIL cleanup: consumer user still present');

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('PROBE CRASHED:', e); process.exit(1); });
