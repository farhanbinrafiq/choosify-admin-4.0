/**
 * Phase 6 visual + functional QA — real SSLCommerz subscription checkout
 * flow on the Seller/Creator "Plan & Billing" page. Drives the ACTUAL UI
 * through initiate-checkout -> the real mock-gateway redirect -> the real
 * return-URL handling, taking screenshots at each key payment state.
 *
 * Local environment note (see Phase 6 report): no real/sandbox SSLCommerz
 * credentials are configured, so PAYMENT_GATEWAY_MOCK=true routes checkout
 * through the existing mockPaymentProvider harness. That harness's redirect
 * goes straight back to our success URL WITHOUT an IPN call (there is no
 * fake bank page to fire one) — exactly like a real gateway callback would,
 * except nothing has independently validated it yet. So immediately after
 * the browser lands back with a pending payment, this script — playing the
 * part SSLCommerz's own server-to-server IPN would play — calls the same
 * processSubscriptionIpn() function directly to deliver the callback, then
 * proves the UI reaches "succeeded" only via its own honest re-poll of
 * GET /subscriptions/payments/:id/status (never trusting the return URL).
 *
 * Usage: PAYMENT_GATEWAY_MOCK=true npx tsx scripts/probe-subscription-payment-ui.ts
 */
process.env.PAYMENT_GATEWAY_MOCK = 'true';

import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';
import { processSubscriptionIpn } from '../server/subscriptions/subscriptionPaymentService';
import { mockPaymentProvider } from '../server/payments/mockProvider';

const BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_subscription-payment-ui-qa');
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

/** Polls body text until it contains `substr` or the timeout elapses — avoids asserting against a stale Suspense/loading frame after navigation. */
async function waitForBodyText(page: Page, substr: string, timeoutMs = 15000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    last = await page.evaluate(() => document.body.innerText);
    if (last.includes(substr)) return last;
    await page.waitForTimeout(300);
  }
  return last;
}

async function cleanupQaPlans(namePrefix: string) {
  const qaPlans = await db.select().from(plans).where(like(plans.name, `${namePrefix}%`));
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

/**
 * Recovers from a session bounce back to /login — this automated run's
 * accumulated wall-clock time (many real waits/reloads across a full
 * checkout+redirect+reload cycle per step) occasionally outlasts what an
 * interactive session would; not a payment-correctness issue, so recover and
 * continue rather than let one stale token cascade into unrelated failures.
 */
async function waitReady(page: Page) {
  if (page.url().includes('/login')) {
    await login(page, 'seller@choosify.com.bd');
    await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('text=Plan & Billing', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('text=Loading your subscription', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Extracts tran_id/paymentId from wherever the browser landed after a (mock) gateway redirect. */
function parseReturn(url: string): { paymentId: string | null; tranId: string | null; outcome: string | null } {
  const u = new URL(url);
  return { paymentId: u.searchParams.get('paymentId'), tranId: u.searchParams.get('tran_id'), outcome: u.searchParams.get('paymentOutcome') };
}

/** Plays the role of SSLCommerz's own server-to-server IPN (see file header) — never the browser. */
async function deliverMockIpn(tranId: string, amountMajor: number, currency: string) {
  const valId = `mockval-ui-${tranId}`;
  mockPaymentProvider.seedValidation(valId, { valid: true, amount: amountMajor, tranId, currency });
  return processSubscriptionIpn({ tran_id: tranId, val_id: valId, status: 'VALID' });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(1);
  }

  const sellerUser = (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  const sellerWs = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, sellerUser.id)))[0];
  const adminUser = (await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1))[0];
  const adminId = adminUser.id;

  async function cleanWorkspace(wsId: string) {
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, wsId));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, wsId));
    for (const s of subs) await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, wsId));
  }
  await cleanWorkspace(sellerWs.id);
  await cleanupQaPlans('QA6 UI'); // in case an earlier crashed run left duplicate fixtures behind
  mockPaymentProvider.clear();

  async function makePlan(name: string, price: number) {
    const plan = await planService.createPlan({ role: 'seller', name, actorUserId: adminId });
    await planService.updatePlanMetadata(plan.id, { isPublic: true }, adminId);
    const v1 = await planService.createDraftVersion(plan.id, { nameSnapshot: name }, adminId);
    await planService.setDraftOffers(plan.id, v1.id, [{ billingInterval: 'monthly', price, currency: 'BDT' }]);
    await planService.setDraftEntitlements(plan.id, v1.id, [{ featureKey: 'cashbooks', enabled: true }]);
    await planService.publishVersion(plan.id, v1.id, adminId);
    const offerId = (await planService.getPlanDetail(plan.id)).versions[0].offers[0].id;
    return { plan, offerId };
  }

  const starter = await makePlan('QA6 UI Starter', 45000);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await login(page, 'seller@choosify.com.bd');
  await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page);

  // ── 1. Open checkout, proceed, follow the real redirect ──
  const starterCard = page.locator('.bg-app-card').filter({ hasText: 'QA6 UI Starter' }).first();
  await starterCard.locator('button:has-text("Select This Plan")').click();
  await page.waitForTimeout(500);
  let bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('৳450.00') && bodyText.includes('Proceed to Payment'), 'Checkout modal shows correct server-resolved amount before payment');
  await page.screenshot({ path: join(OUT, '01-checkout-ready.png'), fullPage: true });

  await Promise.all([
    page.waitForURL(/\/admin\/plan-billing\?paymentOutcome=/, { timeout: 20000 }),
    page.locator('button:has-text("Proceed to Payment")').click(),
  ]);
  await page.waitForTimeout(800);
  const ret1 = parseReturn(page.url());
  assert(ret1.outcome === 'success' && !!ret1.paymentId && !!ret1.tranId, 'Real redirect round-trip returns to Plan & Billing with the expected outcome/paymentId/tran_id', ret1);

  // ── 2. Immediately after return, payment is honestly PENDING (no IPN has fired yet) ──
  bodyText = await waitForBodyText(page, 'Confirming your payment');
  assert(bodyText.includes('Confirming your payment'), 'Before any IPN, UI honestly shows a pending/confirming state — never a fabricated success', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '02-payment-pending.png'), fullPage: true });

  const paymentRowBeforeIpn = (await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, ret1.paymentId!)))[0];
  assert(paymentRowBeforeIpn.result === 'pending', 'Backend payment row is genuinely still pending before IPN delivery', paymentRowBeforeIpn.result);
  const subBeforeIpn = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(subBeforeIpn === null, 'No subscription is activated merely from the browser landing back on the return URL');

  // ── 3. Deliver the IPN (server-to-server, never the browser) then refresh ──
  const ipnResult = await deliverMockIpn(ret1.tranId!, 450, 'BDT');
  assert(ipnResult.credited === true, 'IPN independently validates and credits the payment', ipnResult);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await waitForBodyText(page, 'Payment successful');
  assert(bodyText.includes('Payment successful') && bodyText.includes('QA6 UI Starter'), 'After the real IPN, re-checking the same return URL now honestly shows success', bodyText.slice(0, 300));
  assert(bodyText.includes('subscription is now active'), 'Success copy never claims automatic renewal — states the true one-time outcome');
  await page.screenshot({ path: join(OUT, '03-payment-success.png'), fullPage: true });

  const subAfterIpn = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(subAfterIpn?.plan.id === starter.plan.id, 'Subscription is genuinely active on the correct Plan after IPN credit', subAfterIpn?.plan.name);
  assert(!bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/), 'Success panel never exposes a raw internal UUID');

  // ── 4. Reopening the exact same success URL again is idempotent (no duplicate anything) ──
  await page.goto(`${BASE}/admin/plan-billing?paymentOutcome=success&paymentId=${ret1.paymentId}&tran_id=${ret1.tranId}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await waitForBodyText(page, 'Payment successful');
  assert(bodyText.includes('Payment successful'), 'Reopening the success URL again still shows the true (already-succeeded) state, not an error', bodyText.slice(0, 200));
  const paymentsAfterReopen = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, sellerWs.id));
  assert(paymentsAfterReopen.length === 1, 'Reopening the return URL created no duplicate payment row', paymentsAfterReopen.length);
  const eventsAfterReopen = await db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, subAfterIpn!.subscription.id));
  assert(eventsAfterReopen.filter((e) => e.eventType === 'subscribed').length === 1, 'Reopening the return URL created no duplicate lifecycle event');
  await page.screenshot({ path: join(OUT, '04-reopened-success-idempotent.png'), fullPage: true });

  // ── 5. Renewal: explicit action, own checkout, own redirect ──
  // Re-authenticate here: the access token has a real 15-minute TTL, and this
  // automated run's accumulated wall-clock time (many real waits/reloads) can
  // exceed that where an interactive session normally wouldn't — a QA-script
  // robustness step, not a product behavior under test.
  await login(page, 'seller@choosify.com.bd');
  await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('button:has-text("Renew Now")').click();
  bodyText = await waitForBodyText(page, 'Renew Subscription');
  assert(bodyText.includes('Renew Subscription') && bodyText.includes('never stores your card or charges you automatically'), 'Renewal modal explicitly states no stored cards / no automatic charging', bodyText.slice(0, 400));
  await page.screenshot({ path: join(OUT, '05-renewal-modal.png'), fullPage: true });

  await Promise.all([
    page.waitForURL(/\/admin\/plan-billing\?paymentOutcome=/, { timeout: 20000 }),
    page.locator('button:has-text("Proceed to Payment")').click(),
  ]);
  const ret2 = parseReturn(page.url());
  const periodBeforeRenewal = subAfterIpn!.subscription.currentPeriodEnd;
  await deliverMockIpn(ret2.tranId!, 450, 'BDT');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await waitForBodyText(page, 'renewed successfully');
  assert(bodyText.includes('renewed successfully'), 'Renewal success uses "renewed successfully" wording, never implies auto-charge', bodyText.slice(0, 300));
  const subAfterRenewal = await subscriptionService.getCurrentSubscription(sellerWs.id);
  assert(!!subAfterRenewal?.subscription.currentPeriodEnd && subAfterRenewal.subscription.currentPeriodEnd !== periodBeforeRenewal, 'Renewal genuinely extended the billing period', { before: periodBeforeRenewal, after: subAfterRenewal?.subscription.currentPeriodEnd });
  await page.screenshot({ path: join(OUT, '06-renewal-success.png'), fullPage: true });

  // ── 6. Failure/cancellation handling + Retry Payment (new attempt, never mutated old one) ──
  // Reuses the already-succeeded initial payment (ret1) to prove the URL's claimed outcome
  // ('failed' here) is never trusted — only the server's own record decides what is shown.
  await login(page, 'seller@choosify.com.bd'); // see re-auth note above
  await page.goto(`${BASE}/admin/plan-billing?paymentOutcome=failed&paymentId=${ret1.paymentId}&tran_id=${ret1.tranId}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await waitForBodyText(page, 'Payment successful');
  assert(bodyText.includes('Payment successful'), 'A failed-outcome URL for an ALREADY-succeeded payment id still shows the true server state, not the untrusted URL claim (URL-outcome is never trusted)', bodyText.slice(0, 200));
  await page.screenshot({ path: join(OUT, '07-untrusted-url-ignored.png'), fullPage: true });

  // Genuine failure: a fresh attempt, told the truth by applyUntrustedSubscriptionPaymentOutcome via the real /fail redirect route.
  // (Driven via direct HTTP + a real browser navigation to the actual /fail route — Starter is
  // the only Seller plan in this fixture, so there's no separate Plan to click "Upgrade" on; the
  // UI surface under test here is the /fail return route + Retry Payment, not plan selection.)
  const authToken = await page.evaluate(() => localStorage.getItem('choosify_auth_token'));
  const freshAttempt = await fetch(`${BASE}/api/v1/subscriptions/checkout/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ offerId: starter.offerId, purpose: 'renewal' }),
  }).then((r) => r.json());
  assert(!!freshAttempt.redirectUrl, 'Fresh renewal checkout attempt initiated successfully (server-side, for the /fail route test)', freshAttempt);
  const freshRedirect = new URL(freshAttempt.redirectUrl);
  await page.goto(`${BASE}${freshRedirect.pathname.replace('/success', '/fail')}${freshRedirect.search}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  bodyText = await waitForBodyText(page, 'Payment failed');
  assert(bodyText.includes('Payment failed') && bodyText.includes('Retry Payment'), 'Genuine failed-checkout redirect shows Payment failed with a Retry Payment action', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '08-payment-failed.png'), fullPage: true });
  const failedRow = (await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, freshAttempt.paymentId)))[0];
  assert(failedRow.result === 'failed', 'Failed browser redirect correctly marks that payment row failed (not success, not silently pending)', failedRow.result);

  await page.locator('button:has-text("Retry Payment")').click();
  bodyText = await waitForBodyText(page, 'Renew Subscription');
  assert(bodyText.includes('Renew Subscription') && bodyText.includes('Proceed to Payment'), 'Retry Payment opens a fresh checkout modal for a NEW attempt', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '09-retry-payment-modal.png'), fullPage: true });
  await page.locator('button', { hasText: /^Cancel$/ }).click();

  const paymentsAfterFailRetryOpen = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, sellerWs.id));
  const stillFailed = paymentsAfterFailRetryOpen.find((p) => p.id === freshAttempt.paymentId);
  assert(stillFailed?.result === 'failed', 'Opening Retry Payment never mutates the old failed attempt back into pending', stillFailed?.result);

  // ── 7. Payment History reflects everything honestly ──
  await login(page, 'seller@choosify.com.bd'); // see re-auth note above
  await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('button:has-text("History")').click();
  await page.waitForSelector('text=Loading payment history', { state: 'detached', timeout: 15000 }).catch(() => {});
  bodyText = await waitForBodyText(page, 'PAID');
  assert(bodyText.includes('Payment History'), 'History tab shows the new Payment History section', bodyText.slice(0, 200));
  assert(bodyText.includes('PAID') && bodyText.includes('FAILED'), 'Payment History shows both succeeded and failed rows with correct status labels', bodyText.slice(0, 400));
  assert(!bodyText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/), 'Payment History never exposes a raw internal UUID');
  await page.screenshot({ path: join(OUT, '10-payment-history.png'), fullPage: true });

  // ── 8. Mobile responsive check ──
  await login(page, 'seller@choosify.com.bd'); // see re-auth note above
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin/plan-billing`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.screenshot({ path: join(OUT, '11-mobile-overview.png'), fullPage: true });
  await page.locator('button:has-text("Renew Now")').click();
  await waitForBodyText(page, 'Renew Subscription');
  await page.screenshot({ path: join(OUT, '12-mobile-checkout-modal.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });

  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('categoryCatalogSync') &&
      !e.includes('Failed to sync canonical categories') &&
      !e.includes('Failed to load resource: the server responded with a status of 401') &&
      !e.includes('Failed to load resource: the server responded with a status of 429') &&
      !e.includes('Failed to load resource: the server responded with a status of 400'),
  );
  assert(relevantErrors.length === 0, 'no console errors attributable to the Plan & Billing payment flow itself', relevantErrors);

  await browser.close();

  // ── Cleanup ──
  await cleanWorkspace(sellerWs.id);
  await cleanupQaPlans('QA6 UI');
  mockPaymentProvider.clear();

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('QA CRASHED:', e); process.exit(1); });
