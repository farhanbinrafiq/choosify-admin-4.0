/**
 * Phase 5 visual + functional QA — Seller/Creator "Plan & Billing" page.
 * Real browser session against the local dev server, real local DB. Sets up
 * throwaway QA Plans/offers directly via the backend services (fast/
 * reliable — already proven correct by Phase 3/4 probes), then drives the
 * ACTUAL Seller/Creator lifecycle entirely through the real UI, taking
 * screenshots at each key state. Cleans up everything afterward.
 *
 * Usage: npx tsx scripts/probe-plan-billing-ui.ts
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';

const BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_plan-billing-ui-qa');
mkdirSync(OUT, { recursive: true });

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

const consoleErrors: string[] = [];

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await page.fill('input[type="email"], input[name="email"]', email).catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', PW).catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function getToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('choosify_auth_token'));
}

/**
 * Waits for the real page content — not the Suspense/skeleton fallback
 * (cold lazy-chunk compiles) and not this page's OWN "Loading your
 * subscription…" spinner (its data fetch can outlast a fixed timeout).
 */
async function waitReady(page: Page) {
  await page.waitForSelector('text=Plan & Billing', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('text=Loading your subscription', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
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

  // ── Clean slate for these two workspaces from any prior run ──
  async function cleanWorkspace(wsId: string) {
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsId));
    for (const s of subs) await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, wsId));
  }
  await cleanWorkspace(sellerWs.id);
  await cleanWorkspace(creatorWs.id);

  // ── Set up throwaway QA Plans (Seller: monthly-only, annual-only, both, premium; Creator: one) ──
  async function makePlan(role: 'seller' | 'creator', name: string, offers: Array<{ billingInterval: 'monthly' | 'annual'; price: number }>, features: string[]) {
    const plan = await planService.createPlan({ role, name, actorUserId: adminId });
    await planService.updatePlanMetadata(plan.id, { isPublic: true }, adminId);
    const v1 = await planService.createDraftVersion(plan.id, { nameSnapshot: name }, adminId);
    await planService.setDraftOffers(plan.id, v1.id, offers.map((o) => ({ ...o, currency: 'BDT' })));
    if (features.length) await planService.setDraftEntitlements(plan.id, v1.id, features.map((f) => ({ featureKey: f, enabled: true })));
    await planService.setDraftLimits(plan.id, v1.id, [{ limitKey: 'team_member_limit', limitValue: 2 }]);
    await planService.publishVersion(plan.id, v1.id, adminId);
    return plan;
  }

  const monthlyOnly = await makePlan('seller', 'QA5 Monthly Only', [{ billingInterval: 'monthly', price: 30000 }], ['cashbooks']);
  const annualOnly = await makePlan('seller', 'QA5 Annual Only', [{ billingInterval: 'annual', price: 300000 }], ['messaging']);
  const bothIntervals = await makePlan('seller', 'QA5 Both Intervals', [{ billingInterval: 'monthly', price: 50000 }, { billingInterval: 'annual', price: 500000 }], ['cashbooks', 'messaging']);
  const premium = await makePlan('seller', 'QA5 Premium', [{ billingInterval: 'monthly', price: 90000 }], ['cashbooks', 'messaging', 'adsDeals']);
  const creatorPlan = await makePlan('creator', 'QA5 Creator Plan', [{ billingInterval: 'monthly', price: 40000 }], ['guideManagement']);

  const bothOfferId = (await planService.getPlanDetail(bothIntervals.id)).versions[0].offers.find((o) => o.billingInterval === 'monthly')!.id;
  const monthlyOnlyOfferId = (await planService.getPlanDetail(monthlyOnly.id)).versions[0].offers[0].id;

  // ── Browser session ──
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // ── Seller: no-subscription state + persona filtering ──
  await login(page, 'seller@choosify.com.bd');
  await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page);
  let bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('No Active Subscription'), 'Seller no-subscription state shown');
  assert(bodyText.includes('QA5 Monthly Only') && bodyText.includes('QA5 Annual Only') && bodyText.includes('QA5 Both Intervals') && bodyText.includes('QA5 Premium'), 'Seller sees all real Seller plans');
  assert(!bodyText.includes('QA5 Creator Plan'), 'Seller does NOT see the Creator-only plan (persona filtering)');
  const monthlyOnlyCardText = (bodyText.split('QA5 Monthly Only')[1] || '').split('QA5')[0];
  assert(/monthly/i.test(monthlyOnlyCardText) && !/annual/i.test(monthlyOnlyCardText), 'Monthly-only plan card shows Monthly only, no Annual option', monthlyOnlyCardText);
  await page.screenshot({ path: join(OUT, '01-seller-no-subscription.png'), fullPage: true });

  const sellerToken = await getToken(page);

  // ── Initial selection -> real Phase 6 checkout modal (server-resolved amount, no fake purchase yet) ──
  const bothCard = page.locator('.bg-app-card').filter({ hasText: 'QA5 Both Intervals' }).first();
  await bothCard.locator('button:has-text("Select This Plan")').click();
  await page.waitForTimeout(600);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Proceed to Payment') && bodyText.includes('৳500.00'), 'Initial selection opens the real Phase 6 checkout modal with the correct server-resolved amount', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '02-checkout-handoff.png'), fullPage: true });
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(400);

  const afterHandoff = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(afterHandoff === null, 'Closing the checkout modal without paying did NOT activate any subscription on the backend', afterHandoff);

  // ── Backend: manual grant (simulates an active subscription without faking payment) ──
  const grant = await subscriptionService.manualGrant({ workspaceId: sellerWs.id, planVersionOfferId: bothOfferId, actorUserId: adminId, reason: 'QA5 setup' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('QA5 Both Intervals') && bodyText.includes('Version 1'), 'Active subscription shows correct Plan and Version');
  assert(bodyText.includes('assigned by Choosify administration'), 'Manual grant is disclosed honestly, no fake payment info');
  assert(bodyText.includes('Cashbooks') && bodyText.includes('Messaging'), 'Current Plan shows its real included features');
  assert(bodyText.includes('team_member_limit'), 'Current Plan shows its real quantitative limit');
  await page.screenshot({ path: join(OUT, '03-active-subscription.png'), fullPage: true });

  // ── Upgrade quote (validate only, never activates) ──
  const premiumCard = page.locator('.bg-app-card').filter({ hasText: 'QA5 Premium' }).first();
  await premiumCard.locator('button:has-text("Upgrade to This Plan")').click();
  await page.waitForTimeout(800);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('৳900.00') && bodyText.includes('fresh billing period') && bodyText.includes('not credited or refunded'), 'Upgrade review shows real full amount and correct no-proration wording', bodyText.slice(0, 400));
  await page.screenshot({ path: join(OUT, '04-upgrade-review.png'), fullPage: true });
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(500);
  const afterUpgradeQuote = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(afterUpgradeQuote?.plan.name === 'QA5 Both Intervals', 'Upgrade quote alone did NOT activate the upgrade — still on original Plan', afterUpgradeQuote?.plan.name);

  // ── Grandfathering: publish v2 with DIFFERENT features; Current Plan must still show v1 ──
  const detailBefore = await planService.getPlanDetail(bothIntervals.id);
  const v2 = await planService.createDraftVersion(bothIntervals.id, { nameSnapshot: 'QA5 Both Intervals v2' }, adminId);
  await planService.setDraftOffers(bothIntervals.id, v2.id, [{ billingInterval: 'monthly', price: 60000, currency: 'BDT' }]);
  await planService.setDraftEntitlements(bothIntervals.id, v2.id, [{ featureKey: 'adsDeals', enabled: true }]); // deliberately different from v1
  await planService.publishVersion(bothIntervals.id, v2.id, adminId);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Version 1'), 'GRANDFATHERING: Current Plan still shows Version 1 after v2 is published');
  assert(bodyText.includes('Cashbooks') && bodyText.includes('Messaging'), 'GRANDFATHERING: Current Plan still shows v1\'s features, not v2\'s');
  assert(bodyText.includes('current published terms') || bodyText.includes('actual purchased Version'), 'Available-plan card for the same Plan explicitly disambiguates published-vs-purchased version');
  await page.screenshot({ path: join(OUT, '05-grandfathering.png'), fullPage: true });

  // ── Pending downgrade ──
  const monthlyOnlyCard = page.locator('.bg-app-card').filter({ hasText: 'QA5 Monthly Only' }).first();
  await monthlyOnlyCard.locator('button:has-text("Schedule as Next Plan")').click();
  await page.waitForTimeout(1000);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Scheduled') && /payment will be required/i.test(bodyText), 'Downgrade schedule confirmation does not imply automatic billing', bodyText.slice(0, 300));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Pending Plan Change') && bodyText.includes('QA5 Monthly Only'), 'Pending Plan Change section shows the real target Plan');
  assert(bodyText.includes('Cashbooks'), 'Current Plan features remain the ACTIVE plan\'s features while a downgrade is only pending');
  await page.screenshot({ path: join(OUT, '06-pending-downgrade.png'), fullPage: true });

  // ── Cancel pending downgrade ──
  await page.locator('button:has-text("Cancel Pending Downgrade")').click();
  await page.waitForTimeout(1800);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes('Pending Plan Change'), 'Cancelling the pending downgrade clears it from the UI');
  await page.screenshot({ path: join(OUT, '07-pending-downgrade-cancelled.png'), fullPage: true });

  // ── Cancellation wins over a pending downgrade ──
  // Re-establish the pending downgrade directly via the already-proven backend
  // operation (the UI path for requesting it was already verified above) so
  // this step tests exactly what it claims — cancellation clearing an
  // existing pending change — without a redundant, flaky repeat UI click.
  await subscriptionService.requestDowngrade({ subscriptionId: grant.id, toPlanVersionOfferId: monthlyOnlyOfferId, actorUserId: sellerUser.id });
  // The self-service "Cancel Subscription" button is deliberately hidden for
  // manually-granted subscriptions (Seller/Creator cannot cancel/replace an
  // Admin-assigned grant themselves — see PlanBilling.tsx). This QA
  // subscription has been a manual grant throughout (there is no real
  // payment path yet to create a non-manual one). Flip the fixture's
  // grantedManually flag directly to exercise the genuine self-service
  // cancellation UI/flow — a test-fixture adjustment, not a product change.
  await db.update(subscriptions).set({ grantedManually: false }).where(eq(subscriptions.id, grant.id));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Pending Plan Change'), 'Pending downgrade re-established for the cancellation-interaction test');
  await page.locator('button:has-text("Cancel Subscription")').click();
  await page.waitForTimeout(400);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('No business data') && !bodyText.includes('Cancel immediately'), 'Cancellation confirmation states access continues + no data deleted, never "immediately"');
  await page.screenshot({ path: join(OUT, '08-cancel-confirm.png'), fullPage: true });
  await page.locator('button:has-text("Cancel at Period End")').click();
  await page.waitForTimeout(1000);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Cancellation scheduled'), 'Cancellation-scheduled state shown after confirming');
  assert(!bodyText.includes('Pending Plan Change'), 'CANCELLATION WINS: pending downgrade disappears once full cancellation is requested');
  await page.screenshot({ path: join(OUT, '09-cancellation-scheduled.png'), fullPage: true });

  const afterCancelRequest = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(afterCancelRequest?.subscription.pendingPlanVersionOfferId === null, 'Backend confirms cancellation cleared the pending downgrade', afterCancelRequest?.subscription.pendingPlanVersionOfferId);

  // ── Expiry -> back to no-subscription, showing prior-plan context ──
  await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 60_000) }).where(eq(subscriptions.id, grant.id));
  await subscriptionService.processExpirations();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('No Active Subscription') && bodyText.includes('ended'), 'Expired state returns to No Active Subscription with honest prior-plan context');
  await page.screenshot({ path: join(OUT, '10-expired-state.png'), fullPage: true });

  // ── History ──
  await page.locator('button:has-text("History")').click();
  await page.waitForTimeout(1200);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('Plan assigned by Choosify administration'), 'History translates manually_granted into friendly language');
  assert(bodyText.includes('Requested a Plan change') || bodyText.includes('Cancelled a pending Plan change'), 'History shows the downgrade request/cancel lifecycle events');
  assert(bodyText.includes('Requested cancellation') || bodyText.includes('cancelled'), 'History shows the cancellation lifecycle');
  assert(!bodyText.includes('planVersionOfferId') && !bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/), 'History never exposes raw UUIDs/schema field names');
  await page.screenshot({ path: join(OUT, '11-history.png'), fullPage: true });

  // ── Responsive ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '12-responsive-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });

  // ── Creator: no-subscription + persona filtering the other direction ──
  const page2: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page2.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await login(page2, 'creator@choosify.com.bd');
  await page2.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page2);
  const creatorBodyText = await page2.evaluate(() => document.body.innerText);
  assert(creatorBodyText.includes('No Active Subscription'), 'Creator no-subscription state shown');
  assert(creatorBodyText.includes('QA5 Creator Plan'), 'Creator sees the real Creator plan');
  assert(!creatorBodyText.includes('QA5 Monthly Only') && !creatorBodyText.includes('QA5 Both Intervals'), 'Creator does NOT see any Seller-only plan (reverse persona filtering)');
  await page2.screenshot({ path: join(OUT, '13-creator-no-subscription.png'), fullPage: true });
  const creatorToken = await getToken(page2);
  await page2.close();

  // ── Security / isolation via direct HTTP with real captured tokens ──
  const adminOnlyResp = await fetch(`${BASE}/api/v1/admin/subscription-plans`, { headers: { Authorization: `Bearer ${sellerToken}` } });
  assert(adminOnlyResp.status === 403 || adminOnlyResp.status === 401, 'Seller token cannot call Super Admin plan-management endpoint', adminOnlyResp.status);

  const sellerAvailable = await fetch(`${BASE}/api/v1/subscriptions/available-plans`, { headers: { Authorization: `Bearer ${sellerToken}` } }).then((r) => r.json());
  const sellerPlanNames = (sellerAvailable.plans || []).map((p: any) => p.plan.name);
  assert(!sellerPlanNames.includes('QA5 Creator Plan'), 'Direct API call with Seller token still cannot retrieve Creator Plans');

  const creatorAvailable = await fetch(`${BASE}/api/v1/subscriptions/available-plans`, { headers: { Authorization: `Bearer ${creatorToken}` } }).then((r) => r.json());
  const creatorPlanNames = (creatorAvailable.plans || []).map((p: any) => p.plan.name);
  assert(!creatorPlanNames.some((n: string) => n.startsWith('QA5') && n !== 'QA5 Creator Plan'), 'Direct API call with Creator token still cannot retrieve Seller Plans');

  const manualGrantAttempt = await fetch(`${BASE}/api/v1/admin/subscriptions/manual-grant`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: sellerWs.id, planVersionOfferId: monthlyOnlyOfferId, reason: 'should be rejected' }),
  });
  assert(manualGrantAttempt.status === 403 || manualGrantAttempt.status === 401, 'Seller token cannot call the Super Admin manual-grant endpoint', manualGrantAttempt.status);

  // Self-service routes never accept a client-supplied workspaceId — reconfirm by code inspection for the Phase-5-touched routes.
  const { readFileSync } = await import('node:fs');
  const routerSrc = readFileSync(new URL('../server/subscriptions/subscriptionsRouter.ts', import.meta.url), 'utf8');
  for (const route of ["'/subscriptions/current'", "'/subscriptions/available-plans'", "'/subscriptions/history'", "'/subscriptions/cancel'"]) {
    const start = routerSrc.indexOf(route);
    const slice = routerSrc.slice(start, start + 400);
    assert(!slice.includes('body.workspaceId') && !slice.includes('params.workspaceId') && !slice.includes('query.workspaceId'), `${route} never accepts a client-supplied workspaceId`);
  }

  // Pre-existing, unrelated global noise:
  //  - AuthContext.tsx / categoryCatalogSync.ts fires a canonical-category sync on every
  //    authenticated session load, regardless of route — predates this work.
  //  - The 401s are the same sync failing a token race on first paint.
  //  - The 429s come from server/app.ts's catch-all `app.use('/api', publicApiRateLimit)`,
  //    a single shared rate budget across EVERY /api/* route (confirmed by reading app.ts) —
  //    this task's own explicit boundaries exclude touching global rate-limit config. Flagged
  //    in the report as a pre-existing, out-of-scope observation, not fixed here.
  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('categoryCatalogSync') &&
      !e.includes('Failed to sync canonical categories') &&
      !e.includes('Failed to load resource: the server responded with a status of 401') &&
      !e.includes('Failed to load resource: the server responded with a status of 429'),
  );
  assert(relevantErrors.length === 0, 'no console errors attributable to the Plan & Billing page itself', relevantErrors);
  if (consoleErrors.length > relevantErrors.length) {
    console.log(`  (note: ${consoleErrors.length - relevantErrors.length} pre-existing, unrelated console errors were seen and filtered out — see comment above)`);
  }

  await browser.close();

  // ── Cleanup ──
  await cleanWorkspace(sellerWs.id);
  await cleanWorkspace(creatorWs.id);
  const qaPlans = await db.select().from(plans).where(like(plans.name, 'QA5%'));
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
  const remaining = await db.select().from(plans).where(like(plans.name, 'QA5%'));
  assert(remaining.length === 0, 'all QA5 Plan data cleaned up afterward');
  const remainingSubs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, sellerWs.id));
  assert(remainingSubs.length === 0, 'seller test workspace has no leftover subscriptions');

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('QA CRASHED:', e); process.exit(1); });
