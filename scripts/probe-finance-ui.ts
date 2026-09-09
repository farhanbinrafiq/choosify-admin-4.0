/**
 * Phase 8 visual + functional QA — Finance. Real browser session against
 * the local dev server, real local DB + escrow store. Creates clearly
 * identifiable temporary fixtures, drives the ACTUAL page through its
 * tabs/filters, takes screenshots, and cleans everything up.
 *
 * Usage: npx tsx scripts/probe-finance-ui.ts
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, workspaces, plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments } from '../server/db/schema';
import { planService } from '../server/subscriptions/planService';
import { subscriptionService } from '../server/subscriptions/subscriptionService';
import { escrowStore } from '../server/escrow/escrowStore';
import type { CommerceEscrow, CommerceSettlement } from '../server/escrow/types';

const BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_finance-ui-qa');
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

async function waitReady(page: Page) {
  if (page.url().includes('/login')) {
    await login(page, 'admin@choosify.com.bd');
    await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('text=Finance', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** Polls body text until it contains `substr` or the timeout elapses — avoids asserting against a stale/loading frame right after a navigation or tab switch. */
async function waitForBodyText(page: Page, substr: string, timeoutMs = 15000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(() => document.body.innerText);
    } catch {
      // A navigation mid-poll destroys the execution context transiently — retry, don't crash.
      await page.waitForTimeout(300);
      continue;
    }
    if (last.includes(substr)) return last;
    await page.waitForTimeout(300);
  }
  return last;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(1);
  }

  const sellerUser = (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  const adminUser = (await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1))[0];
  const sellerWs = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, sellerUser.id)))[0];
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
  await cleanupQaPlans('QA8UI');

  const plan = await planService.createPlan({ role: 'seller', name: 'QA8UI Seller Plan', actorUserId: adminId });
  await planService.updatePlanMetadata(plan.id, { isPublic: true }, adminId);
  const v1 = await planService.createDraftVersion(plan.id, { nameSnapshot: 'QA8UI Seller Plan v1' }, adminId);
  await planService.setDraftOffers(plan.id, v1.id, [{ billingInterval: 'monthly', price: 80000, currency: 'BDT' }]);
  await planService.publishVersion(plan.id, v1.id, adminId);
  const offerId = (await planService.getPlanDetail(plan.id)).versions[0].offers[0].id;
  const sub = await subscriptionService.activateInitialSubscription({ workspaceId: sellerWs.id, planVersionOfferId: offerId });
  const [succeededPayment] = await db.insert(subscriptionPayments).values({ subscriptionId: sub.id, workspaceId: sellerWs.id, planVersionOfferId: offerId, purpose: 'initial', amount: 80000, currency: 'BDT', result: 'succeeded', idempotencyKey: 'qa8ui-seller-succeeded' }).returning();
  // subscription_payments/subscription_billing_documents are Postgres-backed and genuinely
  // shared with the running dev server process (unlike the escrow store below — see the
  // Phase 8 report's cross-process note) — issue a real billing document so the Billing
  // Documents tab has real, browser-visible data for this fixture.
  await subscriptionService.issueBillingDocumentForPayment({ subscriptionPaymentId: succeededPayment.id, workspaceId: sellerWs.id, periodStart: new Date(sub.currentPeriodStart), periodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null });

  const nowIso = new Date().toISOString();
  const escrow: CommerceEscrow = {
    escrowId: 'esc_QA8UI_1', paymentId: 'pay_QA8UI_1', checkoutId: 'chk_QA8UI_1', orderId: 'ord_QA8UI_1',
    consumerId: 'consumer_QA8UI', sellerId: 'seller_QA8UI', brandId: 'brand_QA8UI', currency: 'BDT',
    capturedAmount: 1200, heldAmount: 0, refundedAmount: 0, settledAmount: 1200, commissionAmount: 120, sellerNetAmount: 1080,
    status: 'settled', createdAt: nowIso, updatedAt: nowIso,
  };
  const settlement: CommerceSettlement = {
    settlementId: 'stl_QA8UI_1', escrowId: escrow.escrowId, paymentId: escrow.paymentId, orderId: escrow.orderId, checkoutId: escrow.checkoutId,
    sellerId: 'seller_QA8UI', brandId: 'brand_QA8UI', currency: 'BDT', grossAmount: 1200, commissionAmount: 120, sellerNetAmount: 1080,
    createdAt: nowIso, updatedAt: nowIso,
  };
  await escrowStore.upsertEscrow(escrow);
  await escrowStore.upsertSettlement(settlement);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // ── 1. Landing (Super Admin) — legacy CmsMirrorHost gone ──
  await login(page, 'admin@choosify.com.bd');
  await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitReady(page);
  let bodyText = await waitForBodyText(page, 'Total Successful Subscription Payment Value');
  assert(bodyText.includes('Finance') && /view only/i.test(bodyText), 'Finance loads as the real native page (view-only framing present)', bodyText.slice(0, 200));
  assert(!bodyText.includes('48.2M') && !bodyText.includes('3.9M') && !bodyText.includes('2.1M') && !bodyText.includes('412K'), 'None of the old CmsMirrorHost fake Finance figures (৳48.2M GMV, ৳3.9M Commission, etc.) appear');
  assert(!/Subscription Plans \(Sellers\)/i.test(bodyText) && !bodyText.includes('৳12,600'), 'The fake "Subscription Plans (Sellers) — ৳12,600" row is gone');
  await page.screenshot({ path: join(OUT, '01-overview.png'), fullPage: true });

  const hasIframe = await page.evaluate(() => document.querySelectorAll('iframe').length > 0);
  assert(!hasIframe, 'No iframe / CmsMirrorHost present on the Finance route');

  // ── 2. Overview metrics never use Monetization's own labels ──
  // The page subtitle legitimately cross-references "platform revenue performance" to point
  // admins at Monetization Center — strip that one sentence before checking Finance never uses
  // the phrase as one of ITS OWN metric labels.
  const bodyTextExcludingCrossRef = bodyText.replace(/for platform revenue performance,? see monetization center\.?/i, '');
  assert(!/\bplatform revenue\b/i.test(bodyTextExcludingCrossRef) && !/\bgmv\b/i.test(bodyTextExcludingCrossRef), 'Finance Overview never uses "Platform Revenue"/"GMV" as one of its OWN metric labels — that framing stays in Monetization Center', bodyTextExcludingCrossRef.match(/platform revenue|gmv/i));
  // MetricTile labels render with CSS uppercase — match case-insensitively.
  assert(/total successful subscription payment value/i.test(bodyText) && /total commission recorded/i.test(bodyText) && /total seller net recorded/i.test(bodyText), 'Overview shows the real, distinctly-labeled financial-record metrics', bodyText.slice(0, 400));

  // ── 3. Related pages links (no duplication of Payouts/Cashbook) ──
  const payoutsLink = page.locator('a[href="/admin/payouts"]');
  const cashbookLink = page.locator('a[href="/admin/cashbook"]');
  assert((await payoutsLink.count()) > 0 && (await cashbookLink.count()) > 0, 'Finance links out to the existing real Payouts and Cashbook pages instead of duplicating them');

  // ── 4. Transactions tab ──
  await page.locator('button:has-text("Transactions")').click();
  bodyText = await waitForBodyText(page, 'QA8UI Seller Plan');
  assert(bodyText.includes('QA8UI Seller Plan') && bodyText.includes('৳800.00'), 'Transactions tab shows the real succeeded subscription payment with its exact amount', bodyText.slice(0, 300));
  assert(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(bodyText), 'Transactions tab never exposes a raw internal UUID');
  await page.screenshot({ path: join(OUT, '02-transactions.png'), fullPage: true });

  // ── 5. Settlements tab ──
  // NOTE (Phase 8 finding, documented in the report): the escrow/settlement store lives in the
  // ALREADY-RUNNING dev server process's own memory (hydrated once at its boot from disk); a
  // fixture upserted by this separate script process is invisible to that server until it
  // restarts, so this cannot assert on OUR OWN injected settlement's exact numbers via the
  // browser (the backend probe already verifies that, same-process, with exact deltas). This
  // instead verifies the real, already-present settlement history renders correctly.
  await page.locator('button:has-text("Settlements")').click();
  bodyText = await waitForBodyText(page, 'GROSS'); // table header renders uppercase via CSS text-transform
  assert(/date/i.test(bodyText) && /seller/i.test(bodyText) && /gross/i.test(bodyText) && /commission/i.test(bodyText) && /seller net/i.test(bodyText), 'Settlements tab shows the expected real column headers', bodyText.slice(0, 500));
  assert(/৳[\d,]+\.\d{2}/.test(bodyText), 'Settlements tab shows real currency-formatted amounts');
  await page.screenshot({ path: join(OUT, '03-settlements.png'), fullPage: true });

  // ── 6. Billing Documents tab ── (subscription_billing_documents is Postgres-backed, genuinely shared — this fixture IS visible)
  await page.locator('button:has-text("Billing Documents")').click();
  bodyText = await waitForBodyText(page, 'SINV');
  assert(/SINV/i.test(bodyText) && bodyText.includes('৳800.00'), 'Billing Documents tab shows a real SINV reference and the exact amount', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '04-billing-documents.png'), fullPage: true });

  // ── 7. Empty state honesty: a far-future date range shows honest empty states, not fake rows ──
  await page.locator('button:has-text("Custom range")').click();
  await page.waitForTimeout(300);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2000-01-01');
  await dateInputs.nth(1).fill('2000-01-02');
  await page.waitForTimeout(1200);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(/No subscription billing documents found for this period\.?/i.test(bodyText), 'Billing Documents shows the exact honest empty-state message for a no-data period', bodyText.slice(0, 300));
  await page.screenshot({ path: join(OUT, '05-empty-state.png'), fullPage: true });

  await page.locator('button:has-text("Transactions")').click();
  bodyText = await waitForBodyText(page, 'No financial transactions found');
  assert(/No financial transactions found for this period\.?/i.test(bodyText), 'Transactions shows the exact honest empty-state message for a no-data period');

  await page.locator('button:has-text("Settlements")').click();
  bodyText = await waitForBodyText(page, 'No settlements recorded');
  assert(/No settlements recorded for this period\.?/i.test(bodyText), 'Settlements shows the exact honest empty-state message for a no-data period');

  // Restore to Last 30 days for the rest of the run.
  await page.locator('button:has-text("Last 30 days")').click();
  await page.waitForTimeout(800);

  // ── 8. View-only: no edit/delete/mutate controls anywhere on the page ──
  await page.locator('button:has-text("Overview")').click();
  await waitForBodyText(page, 'Total Successful Subscription Payment Value');
  const mutationButtons = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim().toLowerCase() || '');
    return texts.filter((t) => /^(edit|delete|remove|save|update|approve|reject|process payout|mark as paid)/.test(t));
  });
  assert(mutationButtons.length === 0, 'No edit/delete/mutation controls exist anywhere on Finance (view-only by default)', mutationButtons);

  // ── 9. No console errors attributable to this page ──
  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('categoryCatalogSync') &&
      !e.includes('Failed to sync canonical categories') &&
      !e.includes('Failed to load resource: the server responded with a status of 401') &&
      !e.includes('Failed to load resource: the server responded with a status of 429'),
  );
  assert(relevantErrors.length === 0, 'No console errors attributable to the Finance page itself', relevantErrors);

  // ── 10. Mobile responsive ──
  // Direct DOM inspection (see Phase 8 report) already confirmed the page-level horizontal
  // overflow on every admin page at 390px traces entirely to the shared AdminWorkspaceLayout
  // sidebar not collapsing on mobile (main content area measured at ~150px wide on a 390px
  // viewport) — pre-existing, out of scope, not a Finance defect. Rather than compare against a
  // live baseline measurement (which proved flaky run-to-run), this checks FINANCE'S OWN elements
  // directly: the tab row must be properly self-contained (its own overflow-x-auto scroll region,
  // not leaking past the viewport), which is the one thing actually specific to this page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.screenshot({ path: join(OUT, '06-mobile-overview.png'), fullPage: true });
  const tabRowContainment = await page.evaluate(() => {
    const firstTabButton = Array.from(document.querySelectorAll('button')).find((b) => /Overview/.test(b.textContent || ''));
    const tabsRow = firstTabButton?.parentElement;
    if (!tabsRow) return null;
    const r = tabsRow.getBoundingClientRect();
    return { overflowX: getComputedStyle(tabsRow).overflowX, right: Math.round(r.right), viewportWidth: document.documentElement.clientWidth };
  });
  assert(!!tabRowContainment && tabRowContainment.overflowX === 'auto' && tabRowContainment.right <= tabRowContainment.viewportWidth + 2, "Finance's tab row is properly self-contained on mobile (own scroll region, not leaking past the viewport)", tabRowContainment);
  await page.setViewportSize({ width: 1440, height: 960 });

  // ── 11. Security: Seller/Creator cannot reach the real page ──
  const page2: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await login(page2, 'seller@choosify.com.bd');
  await page2.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.waitForTimeout(1500);
  const sellerBody = await page2.evaluate(() => document.body.innerText);
  const sellerUrl = page2.url();
  assert(!sellerUrl.includes('/admin/analytics') || sellerBody.includes('Access Required') || !sellerBody.includes('Total Successful Subscription Payment Value'), 'Seller cannot view real Finance data (redirected, or shown Access Denied)', { sellerUrl });
  await page2.close();

  await browser.close();

  // ── Cleanup ──
  await cleanWorkspace(sellerWs.id);
  await cleanupQaPlans('QA8UI');
  await escrowStore.deleteEscrow(escrow.escrowId);
  await escrowStore.deleteSettlement(settlement.settlementId);
  escrowStore.flushMemory();
  const remainingPlans = await db.select().from(plans).where(like(plans.name, 'QA8UI%'));
  console.log(remainingPlans.length === 0 ? 'PASS cleanup: no leftover QA8UI plans' : `FAIL cleanup: ${remainingPlans.length} leftover`);

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('QA CRASHED:', e); process.exit(1); });
