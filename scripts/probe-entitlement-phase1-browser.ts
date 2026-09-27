/**
 * Feature Access & Entitlements — Phase 1 browser probe.
 *
 *   O  Feature Access refreshes an expired/invalid access token (no "Expired token" block)
 *   P  Feature Access API error state — no fabricated "all enabled" state
 *   +  Plan Locked from catalog planControlled; catalog groups; Consumer tab explanation
 *   Q  FEATURE_ENTITLEMENT_DENIED → FeatureUnavailable (no silent dashboard redirect);
 *      unauthorized roles still redirect
 *   R  Partner application approve/reject lives in Seller/Creator Management, not Feature Access
 *   S  seller Messages (sellerConversations) nav controlled by messaging
 *   T  partner "Finance & Payouts" routes to the partner surface, never admin Finance APIs
 *
 * Partner-application list/approve/reject responses are route-mocked (no accounts are
 * created). Role toggles made through the admin API are restored in `finally`.
 * Screens: scripts/_tmp_entitlement-phase1-artifacts/
 *
 * Usage: npx tsx scripts/probe-entitlement-phase1-browser.ts   (needs dev server :3001)
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_entitlement-phase1-artifacts');
mkdirSync(OUT, { recursive: true });

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}

async function apiLogin(email: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS_ }),
  });
  const b = (await r.json()) as Record<string, any>;
  if (!b.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return String(b.accessToken);
}

/** Browser context with a real session: refresh cookie (from login) + access token in localStorage. */
async function sessionContext(browser: Browser, email: string): Promise<{ ctx: BrowserContext; token: string }> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const res = await ctx.request.post(`${API}/auth/login`, { data: { email, password: PASS_ } });
  const body = (await res.json()) as Record<string, any>;
  const token = String(body.accessToken || '');
  // Seed the token only on first load so a silent refresh is not overwritten later.
  await ctx.addInitScript((t) => {
    try {
      if (!sessionStorage.getItem('__probe_seeded')) {
        localStorage.setItem('choosify_auth_token', t as string);
        sessionStorage.setItem('__probe_seeded', '1');
      }
    } catch {}
  }, token);
  return { ctx, token };
}

const settle = (p: Page, ms = 2500) => p.waitForTimeout(ms);

async function main() {
  const adminToken = await apiLogin('admin@choosify.com.bd');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const restore: Array<() => Promise<void>> = [];
  const setRole = async (role: string, key: string, enabled: boolean) => {
    const r = await fetch(`${API}/entitlements/admin/role-defaults/${role}/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) throw new Error(`toggle ${role}/${key} ${r.status}`);
  };

  try {
    // ── Admin: Feature Access ────────────────────────────────────────────
    {
      const { ctx } = await sessionContext(browser, 'admin@choosify.com.bd');
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByTestId('feature-row-cashbooks').waitFor({ timeout: 30000 });
      await page.screenshot({ path: join(OUT, 'feature-access-seller.png'), fullPage: true });

      const text = await page.locator('.fa-entitlements').innerText();
      check((await page.getByTestId('summary-plan-locked').innerText()).trim() === '4', 'Plan Locked (seller) = 4 plan-controlled keys');
      for (const title of ['Storefront & Catalog', 'Marketing & Promotion', 'Messaging', 'Finance & Earnings', 'Account']) {
        check(text.toUpperCase().includes(title.toUpperCase()), `catalog group rendered: ${title}`);
      }
      check(!/OTHER FEATURES|MARKETING & MESSAGING/i.test(text), 'no hard-coded page-local groups');
      check((await page.getByTestId('feature-row-notifications').getByRole('switch').count()) === 0, 'notifications row has no toggle (core)');
      check(/CORE · ALWAYS ON/.test(await page.getByTestId('feature-row-notifications').innerText()), 'notifications shows CORE badge');
      check((await page.getByTestId('feature-row-returnsRefunds').getByRole('switch').count()) === 1, 'returnsRefunds switchable');
      check(!/PLAN-CONTROLLED/.test(await page.getByTestId('feature-row-returnsRefunds').innerText()), 'returnsRefunds not plan-controlled');
      check(/PLAN-CONTROLLED/.test(await page.getByTestId('feature-row-promotionRequests').innerText()), 'promotionRequests plan-controlled');
      check((await page.getByTestId('feature-row-advancedAnalytics').count()) === 0, 'deprecated advancedAnalytics not listed');
      check((await page.getByTestId('feature-row-logisticsAnalytics').count()) === 1, 'logisticsAnalytics listed');
      check((await page.getByRole('button', { name: /^Approve$/ }).count()) === 0, 'R no Approve action in Feature Access');
      check((await page.getByTestId('partner-applications-pointer').count()) === 1, 'R pointer to management studios present');

      await page.getByRole('button', { name: 'CREATOR' }).click();
      await settle(page, 500);
      check((await page.getByTestId('summary-plan-locked').innerText()).trim() === '3', 'Plan Locked (creator) = 3');
      await page.getByRole('button', { name: 'CONSUMER' }).click();
      await settle(page, 500);
      check(/not controlled through Feature Access/.test(await page.getByTestId('consumer-core-explanation').innerText()), 'Consumer tab explains core');
      await page.screenshot({ path: join(OUT, 'feature-access-consumer.png'), fullPage: true });
      await page.getByRole('button', { name: 'SELLER' }).click();

      // O: stale access token → toggle → silent refresh + retry succeeds.
      let refreshCalls = 0;
      page.on('request', (r) => {
        if (r.url().includes('/auth/refresh')) refreshCalls += 1;
      });
      await page.evaluate(() => localStorage.setItem('choosify_auth_token', 'stale.expired.token'));
      restore.push(() => setRole('seller', 'reviews', true));
      await page.getByTestId('feature-row-reviews').getByRole('switch').click();
      await settle(page, 2500);
      const after = await page.locator('.fa-entitlements').innerText();
      check(refreshCalls >= 1, 'O stale token triggered /auth/refresh', refreshCalls);
      check(/access disabled for seller/.test(after), 'O toggle succeeded after refresh (toast)');
      check(!/Expired token|session has expired/i.test(after), 'O no "Expired token" / session error shown');
      check((await page.evaluate(() => localStorage.getItem('choosify_auth_token'))) !== 'stale.expired.token', 'O stored token replaced');
      await page.getByTestId('feature-row-reviews').getByRole('switch').click();
      await settle(page, 1500);

      // P: API error states — never fabricated.
      for (const [status, expect] of [
        [503, /temporarily unavailable/i],
        [500, /Failed to load Feature Access|boom/i],
      ] as const) {
        await page.route('**/api/v1/entitlements/admin', (route) =>
          route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'boom', code: status === 503 ? 'ENTITLEMENT_CHECK_UNAVAILABLE' : undefined }) }),
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('feature-access-load-error').waitFor({ timeout: 30000 });
        const t = await page.locator('.fa-entitlements').innerText();
        check(expect.test(t), `P ${status}: real error message shown`, t.slice(0, 200));
        check((await page.getByRole('switch').count()) === 0, `P ${status}: no toggles rendered (no fabricated state)`);
        check(!/All switchable features are currently enabled/.test(t), `P ${status}: no "all enabled" summary`);
        await page.unroute('**/api/v1/entitlements/admin');
      }
      await page.screenshot({ path: join(OUT, 'feature-access-error.png'), fullPage: true });
      check(errors.length === 0, 'admin Feature Access: no page errors', errors.slice(0, 3));
      await ctx.close();
    }

    // ── R: partner applications in Seller / Creator Management ───────────
    for (const kind of ['seller', 'creator'] as const) {
      const { ctx } = await sessionContext(browser, 'admin@choosify.com.bd');
      const page = await ctx.newPage();
      const app = {
        id: `pa_probe_${kind}`,
        applicantType: kind,
        status: 'pending',
        email: `probe.${kind}@example.invalid`,
        displayName: `Probe ${kind}`,
        businessOrChannelName: `Probe ${kind} Co`,
        provisionedUserId: `u_probe_${kind}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const actions: string[] = [];
      await page.route('**/api/v1/operations/partner-applications?status=pending', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, applications: [app] }) }),
      );
      await page.route(`**/api/v1/operations/partner-applications/${app.id}/*`, (route) => {
        const action = route.request().url().split('/').pop() || '';
        actions.push(action);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, application: { ...app, status: action === 'approve' ? 'approved' : 'rejected' } }),
        });
      });
      page.on('dialog', (d) => void d.accept());
      await page.goto(`${BASE}/admin/${kind}-management?filter=requests`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const row = page.getByTestId('partner-application-row').first();
      await row.waitFor({ timeout: 30000 });
      await page.screenshot({ path: join(OUT, `${kind}-management-requests.png`), fullPage: true });
      const action = kind === 'seller' ? 'Approve' : 'Reject';
      await row.getByRole('button', { name: new RegExp(action, 'i') }).click();
      await settle(page, 1500);
      check(actions.includes(action.toLowerCase()), `R ${kind} Management ${action} calls existing API`, actions);
      check((await page.getByTestId('partner-application-row').count()) === 0, `R ${kind} row leaves pending list`);
      if (kind === 'seller') {
        check(/Marketplace Access is still off/.test(await page.locator('body').innerText()), 'R approve shows Marketplace Access next step');
      }
      await ctx.close();
    }

    // ── Seller: S / Q / T ───────────────────────────────────────────────
    {
      const { ctx } = await sessionContext(browser, 'seller@choosify.com.bd');
      const page = await ctx.newPage();
      const adminFinanceCalls: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('request', (r) => {
        if (r.url().includes('/api/v1/admin/finance')) adminFinanceCalls.push(r.url());
      });

      // T: Finance & Payouts → partner surface, rendered in place with the right active nav item.
      const activeNavLabels = () =>
        page.locator('.admin-workspace__sidebar a[aria-current="page"]').allInnerTexts().then((t) => t.map((s) => s.trim()));
      await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByText('Payout Summary').first().waitFor({ timeout: 30000 }).catch(() => undefined);
      await settle(page);
      check(page.url().endsWith('/admin/analytics'), 'T Finance & Payouts stays on /admin/analytics (no redirect)', page.url());
      check((await page.getByText('Payout Summary').count()) > 0, 'T seller sees the partner earnings/payout surface');
      const activeOnFinance = await activeNavLabels();
      check(
        activeOnFinance.length === 1 && activeOnFinance[0] === 'Finance & Payouts',
        'T sidebar highlights only "Finance & Payouts"',
        activeOnFinance,
      );
      check(adminFinanceCalls.length === 0, 'T no admin Finance API calls from seller', adminFinanceCalls);
      await page.screenshot({ path: join(OUT, 'seller-finance-route.png'), fullPage: true });
      await page.goto(`${BASE}/admin/payouts`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const activeOnPayouts = await activeNavLabels();
      check(
        activeOnPayouts.length === 1 && /Payouts \/ Withdrawals/.test(activeOnPayouts[0]),
        'T /admin/payouts highlights only "Payouts / Withdrawals"',
        activeOnPayouts,
      );

      // S: messaging ON → Messages nav present.
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(page, 3500);
      const navOn = await page.locator('a[href="/admin/conversations"], [data-path="/admin/conversations"]').count();
      check(navOn > 0, 'S seller Messages nav visible with messaging ON', navOn);

      // S + Q: messaging OFF → nav hidden, direct visit shows FeatureUnavailable (not dashboard).
      restore.push(() => setRole('seller', 'messaging', true));
      await setRole('seller', 'messaging', false);
      await page.goto(`${BASE}/admin/conversations`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('feature-unavailable').waitFor({ timeout: 30000 }).catch(() => undefined);
      check((await page.getByTestId('feature-unavailable').count()) === 1, 'Q FeatureUnavailable shown for disabled messaging');
      check(page.url().endsWith('/admin/conversations'), 'Q no silent redirect to dashboard', page.url());
      check(/Messaging/.test(await page.getByTestId('feature-unavailable').innerText().catch(() => '')), 'Q names the unavailable capability');
      const navOff = await page.locator('a[href="/admin/conversations"], [data-path="/admin/conversations"]').count();
      check(navOff === 0, 'S seller Messages nav hidden with messaging OFF', navOff);
      await page.screenshot({ path: join(OUT, 'seller-feature-unavailable.png'), fullPage: true });

      // Q: "Check again" after re-enabling restores the page without reload.
      await setRole('seller', 'messaging', true);
      await page.getByRole('button', { name: /Check again/i }).click();
      await page.getByTestId('feature-unavailable').waitFor({ state: 'detached', timeout: 20000 }).catch(() => undefined);
      check((await page.getByTestId('feature-unavailable').count()) === 0, 'Q restoring the entitlement restores the page');

      // Q: an API 403 FEATURE_ENTITLEMENT_DENIED triggers an entitlements refetch → FeatureUnavailable.
      let meCalls = 0;
      await page.route('**/api/v1/entitlements/me', async (route) => {
        meCalls += 1;
        const res = await route.fetch();
        const body = await res.json();
        body.entitlements = { ...(body.entitlements || {}), messaging: false };
        await route.fulfill({ response: res, body: JSON.stringify(body) });
      });
      const before = meCalls;
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('choosify:feature-entitlement-denied', { detail: { featureKey: 'messaging' } }),
        );
      });
      await page.getByTestId('feature-unavailable').waitFor({ timeout: 20000 }).catch(() => undefined);
      check(meCalls > before, 'Q denied event refetches /entitlements/me', { before, meCalls });
      check((await page.getByTestId('feature-unavailable').count()) === 1, 'Q denied event → FeatureUnavailable in place');
      await page.unroute('**/api/v1/entitlements/me');

      // Genuinely unauthorized: seller → admin-only Feature Access still redirects.
      await page.goto(`${BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL('**/admin/dashboard', { timeout: 20000 }).catch(() => undefined);
      check(page.url().endsWith('/admin/dashboard'), 'Q unauthorized role still redirects to dashboard', page.url());
      check(errors.length === 0, 'seller pages: no page errors', errors.slice(0, 3));
      await ctx.close();
    }

    // ── O (partner): expired token on load → entitlements context refreshes ─
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
      await ctx.request.post(`${API}/auth/login`, { data: { email: 'seller@choosify.com.bd', password: PASS_ } });
      const page = await ctx.newPage();
      let meStatuses: number[] = [];
      page.on('response', (r) => {
        if (r.url().endsWith('/api/v1/entitlements/me')) meStatuses.push(r.status());
      });
      // Real token first so the profile loads, then make it stale before the context fetch.
      const token = await (await ctx.request.post(`${API}/auth/login`, { data: { email: 'seller@choosify.com.bd', password: PASS_ } })).json();
      await ctx.addInitScript((t) => {
        try {
          if (!sessionStorage.getItem('__seeded')) {
            localStorage.setItem('choosify_auth_token', t as string);
            sessionStorage.setItem('__seeded', '1');
          }
        } catch {}
      }, String(token.accessToken));
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page, 3000);
      meStatuses = [];
      await page.evaluate(() => localStorage.setItem('choosify_auth_token', 'stale.expired.token'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent('choosify:feature-entitlement-denied', { detail: {} })),
      );
      await settle(page, 3000);
      check(meStatuses.includes(401) && meStatuses.includes(200), 'O entitlements context: 401 → refresh → 200', meStatuses);
      const navCount = await page.locator('a[href="/admin/conversations"], [data-path="/admin/conversations"]').count();
      check(navCount > 0, 'O gated nav not fail-closed after token refresh', navCount);
      await ctx.close();
    }
  } finally {
    for (const r of restore) await r().catch((e) => console.error('restore failed', e));
    await browser.close();
  }

  if (FAIL.length) {
    console.error(`\nFAIL probe-entitlement-phase1-browser (${FAIL.length} failed, ${passes} passed)`);
    for (const f of FAIL) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase1-browser (${passes} checks)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
