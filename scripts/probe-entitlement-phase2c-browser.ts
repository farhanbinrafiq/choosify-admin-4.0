/**
 * Feature Access & Entitlements — Phase 2C browser probe (Admin UI).
 *
 * LOCAL ONLY: needs the dev server (:3001) on a LOCAL database with migration
 * 0011; refuses to run otherwise. Creates two throwaway local accounts (an
 * `admin`-role user and a seller) and deletes them afterwards; every platform
 * switch is restored to its exact pre-probe rows. Audit events it writes stay
 * (append-only by design) and only ever target the throwaway seller.
 *
 *   A  Super Admin: roles / platform / accounts / audit views; grant → revoke →
 *      restrict (+expiry, reason) → remove through the UI; state re-read from the server
 *   B  client validation: empty reason, past expiry (no request sent)
 *   C  platform: disable needs a reason; core/deprecated/reserved never switches;
 *      "Platform Disabled" beats an account grant; re-enable
 *   D  dependency adsDeals → promotionRequests explained
 *   E  audit: new events, newest first, actor/target/previous/new/reason/time,
 *      account + feature filters, Load more, no edit/delete controls
 *   F  ordinary Admin: read-only everywhere, direct writes 403
 *   G  partner isolation, creator without a linked account, per-role feature sets
 *   H  401 / 503 shown honestly with Retry — never a fabricated state
 *
 * Screens: scripts/_tmp_entitlement-phase2c-artifacts/
 * Run: npx tsx scripts/probe-entitlement-phase2c-browser.ts   (restart the API first: auth rate limit)
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../server/db/client';
import { accountEntitlementOverrides, platformFeatureStates, users } from '../server/db/schema';
import { hashPassword } from '../server/auth/jwtTokens';
import { PARTNER_FEATURES, featureByKey, featureKeysForRole } from '../shared/entitlements/registry';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_entitlement-phase2c-artifacts');
mkdirSync(OUT, { recursive: true });

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}

type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}

async function apiLogin(email: string, password = PASS_) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = (await r.json()) as Record<string, any>;
  if (!b.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return { token: String(b.accessToken), uid: String(b.uid || '') };
}

/** Browser context with a real session: refresh cookie (from login) + access token in localStorage. */
async function sessionContext(browser: Browser, email: string, password = PASS_): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const res = await ctx.request.post(`${API}/auth/login`, { data: { email, password } });
  const token = String(((await res.json()) as Record<string, any>).accessToken || '');
  if (!token) throw new Error(`browser login ${email} failed`);
  await ctx.addInitScript((t) => {
    try {
      if (!sessionStorage.getItem('__probe_seeded')) {
        localStorage.setItem('choosify_auth_token', t as string);
        sessionStorage.setItem('__probe_seeded', '1');
      }
    } catch {}
  }, token);
  return ctx;
}

const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);
const text = (p: Page, testId: string) => p.getByTestId(testId).first().innerText().catch(() => '');
/** Value for <input type="datetime-local"> in the browser's local time. */
function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(2);
  }
  if (!/localhost|127\.0\.0\.1/.test(BASE)) {
    console.error('REFUSING: not a local server.');
    process.exit(2);
  }

  const stamp = Date.now();
  const tempPassword = `Phase2c!${stamp}`;
  const sellerName = `Phase2C Probe Seller ${stamp}`;
  const [tempAdmin] = await db
    .insert(users)
    .values({
      email: `phase2c.admin.${stamp}@probe.local`,
      passwordHash: await hashPassword(tempPassword),
      displayName: 'Phase2C Probe Admin',
      role: 'admin',
      emailVerified: true,
    })
    .returning({ id: users.id, email: users.email });
  const [tempSeller] = await db
    .insert(users)
    .values({
      email: `phase2c.seller.${stamp}@probe.local`,
      passwordHash: await hashPassword(tempPassword),
      displayName: sellerName,
      role: 'seller',
      emailVerified: true,
    })
    .returning({ id: users.id });
  const platformSnapshot = await db.select().from(platformFeatureStates);

  const superAdmin = await apiLogin('admin@choosify.com.bd');
  const admin = await apiLogin(tempAdmin.email, tempPassword);
  const seller = await apiLogin('seller@choosify.com.bd');
  const creator = await apiLogin('creator@choosify.com.bd');
  const S = superAdmin.token;
  const SID = tempSeller.id;
  const putOverride = (token: string, key: string, body: unknown, userId = SID) =>
    call(`/entitlements/admin/accounts/${userId}/overrides/${key}`, token, 'PUT', body);
  const delOverride = (token: string, key: string, userId = SID) =>
    call(`/entitlements/admin/accounts/${userId}/overrides/${key}`, token, 'DELETE', { reason: 'Phase2C probe cleanup' });

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  try {
    const superCtx = await sessionContext(browser, 'admin@choosify.com.bd');
    const page = await superCtx.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const writes: string[] = [];
    let accountReads = 0;
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('/entitlements/admin/') && ['PUT', 'DELETE', 'PATCH'].includes(r.method())) writes.push(`${r.method()} ${u}`);
      if (r.method() === 'GET' && u.includes(`/entitlements/admin/accounts/${SID}`)) accountReads += 1;
    });

    const openAccount = async (userId: string, edit: boolean) => {
      await page.goto(`${BASE}/admin/feature-access?view=accounts&userId=${userId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByTestId('account-entitlements-panel').waitFor({ timeout: 30000 });
      if (edit) {
        await page.getByTestId('enter-edit-mode').click();
        await page.getByTestId('admin-edit-mode').waitFor({ timeout: 10000 });
      }
    };
    const overrideDialog = async (action: string, key: string, input: { reason?: string; expiry?: Date } = {}) => {
      await page.getByTestId(`override-action-${action}-${key}`).click();
      await page.getByTestId('override-dialog').waitFor({ timeout: 10000 });
      if (input.expiry) await page.getByTestId('override-dialog-expiry').fill(localInputValue(input.expiry));
      if (input.reason !== undefined) await page.getByTestId('override-dialog-reason').fill(input.reason);
      await page.getByTestId('override-dialog-submit').click();
    };
    const dialogClosed = (id: string) => page.getByTestId(id).waitFor({ state: 'detached', timeout: 15000 }).then(() => true, () => false);

    // ── A: views ─────────────────────────────────────────────────────────
    await page.goto(`${BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByTestId('feature-row-cashbooks').waitFor({ timeout: 30000 });
    check((await page.getByTestId('feature-row-returnsRefunds').getByRole('switch').count()) === 1, 'A roles view (default): Super Admin keeps role-default toggles');
    check((await page.getByTestId('entitlements-readonly-note').count()) === 0, 'A Super Admin sees no read-only note');
    check((await page.getByTestId('enter-edit-mode').count()) === 0, 'A roles view shows no Edit Mode bar (role toggles unchanged)');

    await page.getByRole('button', { name: 'Platform Controls' }).click();
    await page.getByTestId('platform-controls-panel').waitFor({ timeout: 30000 });
    check(page.url().includes('view=platform'), 'A platform view selected via ?view=platform', page.url());
    check((await page.locator('[data-testid^="platform-action-"]').count()) === 0, 'A platform: no switch actions before Edit Mode');
    const nonSwitchable = PARTNER_FEATURES.filter((f) => f.tier === 'core' || f.tier === 'reserved' || f.deprecated).map((f) => f.key);
    let leaked = 0;
    for (const k of nonSwitchable) leaked += await page.getByTestId(`platform-row-${k}`).count();
    check(nonSwitchable.length >= 6 && leaked === 0, `C core/deprecated/reserved never listed as platform switches (${nonSwitchable.join(',')})`, leaked);
    check((await page.getByTestId('platform-row-cashbooks').count()) === 1 && (await page.getByTestId('platform-row-adsDeals').count()) === 1, 'C switchable features listed');
    await page.getByTestId('enter-edit-mode').click();
    check((await page.getByTestId('platform-action-notifications').count()) === 0 && (await page.getByTestId('platform-action-cashbooks').count()) === 1, 'C Edit Mode: actions only on switchable rows');
    await page.screenshot({ path: join(OUT, 'platform-controls-edit.png'), fullPage: true });

    await page.getByRole('button', { name: 'Account Access' }).click();
    await page.getByTestId('account-access-empty').waitFor({ timeout: 30000 });
    await page.getByTestId('account-picker-search').fill(sellerName);
    await page.getByTestId(`account-picker-option-${SID}`).click();
    await page.getByTestId('account-entitlements-panel').waitFor({ timeout: 30000 });
    check(page.url().includes(`userId=${SID}`), 'A account picker selects via ?userId=', page.url());
    check((await text(page, 'account-identity')).includes(sellerName), 'A account identity shown');
    check(/Role Default|Plan/.test(await text(page, 'account-source-cashbooks')), 'A baseline cashbooks source is role default/plan', await text(page, 'account-source-cashbooks'));
    check(/Core/.test(await text(page, 'account-source-notifications')) && (await page.getByTestId('override-action-grant-notifications').count()) === 0, 'A core feature explained as Core, no override actions');

    // ── A + B: grant / validation / revoke / restrict / remove ─────────────
    await openAccount(SID, true);
    let writesBefore = writes.length;
    await overrideDialog('grant', 'cashbooks', { reason: '   ' });
    check(/reason is required/i.test(await text(page, 'override-dialog-error')), 'B empty reason rejected client-side');
    check(writes.length === writesBefore, 'B no request sent for an empty reason', writes.slice(writesBefore));
    const readsBeforeGrant = accountReads;
    await page.getByTestId('override-dialog-reason').fill('Phase2C grant');
    await page.getByTestId('override-dialog-submit').click();
    check(await dialogClosed('override-dialog'), 'A grant dialog closes on success');
    await settle(page, 800);
    check(/Account Grant/.test(await text(page, 'account-source-cashbooks')), 'A grant → source "Account Grant"', await text(page, 'account-source-cashbooks'));
    check((await text(page, 'account-status-cashbooks')) === 'ENABLED', 'A grant → ENABLED');
    check(/Grant[\s\S]*ACTIVE[\s\S]*Phase2C grant/.test(await text(page, 'account-override-cashbooks')), 'A override column shows Grant · ACTIVE · reason');
    check(accountReads > readsBeforeGrant, 'A effective state re-read from the server after the write', { readsBeforeGrant, accountReads });

    await overrideDialog('revoke', 'cashbooks', { reason: 'Phase2C revoke' });
    await dialogClosed('override-dialog');
    await settle(page, 800);
    check(/Account Revocation/.test(await text(page, 'account-source-cashbooks')) && (await text(page, 'account-status-cashbooks')) === 'DISABLED', 'A revoke → Account Revocation, DISABLED');

    writesBefore = writes.length;
    await overrideDialog('restrict', 'cashbooks', { reason: 'Phase2C past', expiry: new Date(Date.now() - 2 * 3600_000) });
    check(/must be in the future/i.test(await text(page, 'override-dialog-error')), 'B past restriction expiry rejected client-side');
    await page.getByTestId('override-dialog-expiry').fill('');
    await page.getByTestId('override-dialog-submit').click();
    check(/needs an expiry/i.test(await text(page, 'override-dialog-error')), 'B restriction without expiry rejected client-side');
    check(writes.length === writesBefore, 'B no request sent for an invalid restriction', writes.slice(writesBefore));
    const until = new Date(Date.now() + 2 * 3600_000);
    await page.getByTestId('override-dialog-expiry').fill(localInputValue(until));
    await page.getByTestId('override-dialog-reason').fill('Phase2C temporary restriction');
    await page.getByTestId('override-dialog-submit').click();
    await dialogClosed('override-dialog');
    await settle(page, 800);
    const restrictedSource = await text(page, 'account-source-cashbooks');
    const restrictedOverride = await text(page, 'account-override-cashbooks');
    check(/Account Restriction/.test(restrictedSource) && /until/.test(restrictedSource), 'A restrict → Account Restriction with expiry', restrictedSource);
    check((await text(page, 'account-status-cashbooks')) === 'RESTRICTED', 'A restrict → RESTRICTED');
    check(/Temporary Restriction[\s\S]*ACTIVE[\s\S]*Expires[\s\S]*Phase2C temporary restriction/.test(restrictedOverride), 'A restriction shows ACTIVE, expiry and reason', restrictedOverride);
    const apiView = await call(`/entitlements/admin/accounts/${SID}`, S);
    const apiCash = (apiView.body.overrides || []).find((o: any) => o.featureKey === 'cashbooks');
    check(apiCash?.effect === 'restrict' && Math.abs(new Date(apiCash.expiresAt).getTime() - until.getTime()) < 61_000, 'A server stored the restriction expiry the UI sent', apiCash);
    await page.screenshot({ path: join(OUT, 'account-restricted.png'), fullPage: true });

    writesBefore = writes.length;
    await overrideDialog('remove', 'cashbooks', { reason: '' });
    check(/reason is required/i.test(await text(page, 'override-dialog-error')) && writes.length === writesBefore, 'B remove needs a reason (no request)');
    await page.getByTestId('override-dialog-reason').fill('Phase2C remove');
    await page.getByTestId('override-dialog-submit').click();
    await dialogClosed('override-dialog');
    await settle(page, 800);
    check((await text(page, 'account-override-cashbooks')) === 'None' && /Role Default|Plan/.test(await text(page, 'account-source-cashbooks')), 'A remove → no override, falls back to role default/plan');
    check((await page.getByTestId('override-action-remove-cashbooks').count()) === 0, 'A Remove action gone once no override exists');

    // Expired restriction displayed as inactive.
    await putOverride(S, 'reviews', { effect: 'restrict', expiresAt: new Date(Date.now() + 3000).toISOString(), reason: 'Phase2C short' });
    await new Promise((r) => setTimeout(r, 3800));
    await openAccount(SID, false);
    const expired = await text(page, 'account-override-reviews');
    check(/EXPIRED · INACTIVE/.test(expired) && !/(^|\s)ACTIVE(\s|$)/.test(expired), 'A expired restriction shown inactive', expired);
    check(!/Account Restriction/.test(await text(page, 'account-source-reviews')) && /Expired restriction/.test(await text(page, 'account-source-reviews')), 'A expired restriction not presented as the source', await text(page, 'account-source-reviews'));
    await delOverride(S, 'reviews');

    // ── C: platform switch beats an account grant ──────────────────────────
    await putOverride(S, 'cashbooks', { effect: 'grant', reason: 'Phase2C grant under platform' });
    await page.goto(`${BASE}/admin/feature-access?view=platform`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('platform-controls-panel').waitFor({ timeout: 30000 });
    await page.getByTestId('enter-edit-mode').click();
    writesBefore = writes.length;
    await page.getByTestId('platform-action-cashbooks').click();
    await page.getByTestId('platform-dialog').waitFor({ timeout: 10000 });
    await page.getByTestId('platform-dialog-submit').click();
    check(/reason is required/i.test(await text(page, 'platform-dialog-error')) && writes.length === writesBefore, 'C disabling needs a reason (no request)');
    await page.getByTestId('platform-dialog-reason').fill('Phase2C platform incident');
    await page.getByTestId('platform-dialog-submit').click();
    await dialogClosed('platform-dialog');
    await settle(page, 800);
    check((await text(page, 'platform-state-cashbooks')) === 'OFF', 'C platform cashbooks OFF after disable');
    check(/Phase2C platform incident/.test(await page.getByTestId('platform-controls-panel').innerText()), 'C platform reason displayed');
    await openAccount(SID, false);
    const platSource = await text(page, 'account-source-cashbooks');
    check(/Platform Disabled/.test(platSource) && /platform switch takes precedence/.test(platSource), 'C account view: Platform Disabled + override-overridden note', platSource);
    await page.screenshot({ path: join(OUT, 'account-platform-disabled.png'), fullPage: true });
    await page.goto(`${BASE}/admin/feature-access?view=platform`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('platform-controls-panel').waitFor({ timeout: 30000 });
    await page.getByTestId('enter-edit-mode').click();
    await page.getByTestId('platform-action-cashbooks').click();
    await page.getByTestId('platform-dialog-submit').click(); // enabling: reason optional
    await dialogClosed('platform-dialog');
    await settle(page, 800);
    check((await text(page, 'platform-state-cashbooks')) === 'ON', 'C re-enable without a reason → ON');
    await delOverride(S, 'cashbooks');

    // ── D: dependency ──────────────────────────────────────────────────────
    await putOverride(S, 'promotionRequests', { effect: 'grant', reason: 'Phase2C dependency grant' });
    await putOverride(S, 'adsDeals', { effect: 'revoke', reason: 'Phase2C dependency revoke' });
    await openAccount(SID, false);
    const depSource = await text(page, 'account-source-promotionRequests');
    const adsLabel = featureByKey('adsDeals')!.label;
    check(/Dependency/.test(depSource) && depSource.includes(`Requires ${adsLabel}, which is off (Account Override)`), 'D promotionRequests explained as Dependency on Ads & Deals (off by account override)', depSource);
    check(/override \(Grant\) is active, but a required feature is off/.test(depSource), 'D active grant noted as blocked by the dependency', depSource);
    await delOverride(S, 'adsDeals');
    await delOverride(S, 'promotionRequests');

    // ── E: audit ───────────────────────────────────────────────────────────
    for (let i = 0; i < 14; i++) {
      await putOverride(S, 'guideManagement', { effect: i % 2 ? 'grant' : 'revoke', reason: `Phase2C audit filler ${i}` });
    }
    await delOverride(S, 'guideManagement');
    const expected: any[] = (await call(`/entitlements/admin/audit?userId=${SID}&limit=200`, S)).body.events || [];
    await openAccount(SID, false);
    await page.getByTestId('account-audit-link').click();
    await page.getByTestId('entitlement-audit-panel').waitFor({ timeout: 30000 });
    await page.getByTestId('audit-event').first().waitFor({ timeout: 30000 });
    check(page.url().includes('view=audit') && page.url().includes(`userId=${SID}`), 'E account view links to its audit history', page.url());
    check((await page.getByTestId('audit-event').count()) === 20 && (await page.getByTestId('audit-load-more').count()) === 1, 'E first page = 20 events + Load more');
    for (let i = 0; i < 5 && (await page.getByTestId('audit-load-more').count()); i++) {
      await page.getByTestId('audit-load-more').click();
      await settle(page, 1200);
    }
    const ids = await page.getByTestId('audit-event').evaluateAll((els) => els.map((e) => e.getAttribute('data-event-id')));
    const times = await page.getByTestId('audit-event').evaluateAll((els) => els.map((e) => e.getAttribute('data-created-at') || ''));
    check(expected.length > 20 && ids.length === expected.length && new Set(ids).size === ids.length, `E Load more reaches every event once (${ids.length}/${expected.length})`);
    check(times.every((t, i) => i === 0 || t <= times[i - 1]), 'E newest first');
    check(ids[0] === expected[0]?.id, 'E newest event on top matches the API');
    const firstRow = page.getByTestId('audit-event').first().locator('xpath=ancestor::tr');
    const rowText = await firstRow.innerText();
    check(/Account override removed/.test(rowText) && rowText.includes(sellerName) && /Phase2C probe cleanup/.test(rowText), 'E row shows action, target and reason', rowText);
    check(!/^—$/.test((await firstRow.getByTestId('audit-actor').innerText()).trim()) && (await firstRow.getByTestId('audit-previous').innerText()).trim() !== '—', 'E row shows actor and previous state');
    const restrictRow = page.locator('tr', { hasText: 'Phase2C temporary restriction' }).first();
    check(/Temporary Restriction until/.test(await restrictRow.getByTestId('audit-new').innerText()), 'E new state shows restriction + expiry');
    check(/Revoke/.test(await restrictRow.getByTestId('audit-previous').innerText()), 'E previous state shown (revoke before restrict)');
    const auditButtons = await page.getByTestId('entitlement-audit-panel').getByRole('button').allInnerTexts();
    check(!auditButtons.some((b) => /edit|delete|remove|undo|revert/i.test(b)), 'E audit has no edit/delete controls', auditButtons);
    await page.getByTestId('audit-feature-filter').selectOption('cashbooks');
    await settle(page, 1500);
    const cashLabel = featureByKey('cashbooks')!.label;
    const filtered = await page.getByTestId('audit-feature').allInnerTexts();
    const expCash = expected.filter((e) => e.featureKey === 'cashbooks').length;
    check(filtered.length === expCash && filtered.every((f) => f === cashLabel), `E account + feature filter (${filtered.length}/${expCash})`);
    await page.getByTestId('audit-account-clear').click();
    await settle(page, 1500);
    check((await page.locator('tr', { hasText: 'Phase2C platform incident' }).getByTestId('audit-target').first().innerText()) === 'Platform (all partners)', 'E feature filter alone includes the platform event');
    await page.screenshot({ path: join(OUT, 'audit-history.png'), fullPage: true });

    // ── G: profile entry points (read-only) + per-role feature sets ───────
    await page.goto(`${BASE}/admin/seller-profile?sellerId=${SID}`, { waitUntil: 'domcontentloaded' });
    await page.locator('div', { hasText: /^⚑ Feature Access$/ }).last().waitFor({ timeout: 30000 });
    await page.locator('div', { hasText: /^⚑ Feature Access$/ }).last().click();
    await page.getByTestId('account-entitlements-panel').waitFor({ timeout: 30000 });
    check((await page.locator('[data-testid^="override-action-"]').count()) === 0, 'G seller profile tab is read-only (no override actions)');
    check((await page.getByTestId('enter-edit-mode').count()) === 0, 'G seller profile tab has no Edit Mode');
    check((await page.getByTestId('account-manage-link').getAttribute('href'))?.includes(`view=accounts&userId=${SID}`), 'G profile tab links to central Feature Access');
    const sellerKeys = (await page.locator('[data-testid^="account-feature-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('account-feature-', '')))).sort();
    check(JSON.stringify(sellerKeys) === JSON.stringify([...featureKeysForRole('seller')].sort()), 'G seller account lists exactly the seller features', sellerKeys);
    await page.screenshot({ path: join(OUT, 'seller-profile-feature-access.png'), fullPage: true });

    await openAccount(creator.uid, false);
    const creatorKeys = await page.locator('[data-testid^="account-feature-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('account-feature-', '')));
    const sellerOnly = PARTNER_FEATURES.filter((f) => !f.roles.includes('creator')).map((f) => f.key);
    check(creatorKeys.length > 0 && !creatorKeys.some((k) => sellerOnly.includes(k as any)), 'G seller-only features never listed for a creator account', creatorKeys);
    const creatorOnly = PARTNER_FEATURES.filter((f) => !f.roles.includes('seller')).map((f) => f.key);
    check(!sellerKeys.some((k) => creatorOnly.includes(k as any)), `G creator-only features never listed for a seller (registry has ${creatorOnly.length})`);

    const creatorsRes = await call('/catalog/creators', S);
    const template = (creatorsRes.body.data || [])[0] || {};
    const unlinked = { ...template, id: 'probe-phase2c-unlinked', name: 'Phase2C Unlinked Creator', userId: null };
    await page.route('**/api/v1/catalog/creators', async (route) => {
      const res = await route.fetch();
      const body = await res.json().catch(() => ({ data: [] }));
      await route.fulfill({ response: res, body: JSON.stringify({ ...body, data: [...(body.data || []), unlinked] }) });
    });
    let unlinkedEntitlementCalls = 0;
    const countCalls = (r: { url(): string }) => {
      if (r.url().includes('/entitlements/admin/accounts/')) unlinkedEntitlementCalls += 1;
    };
    page.on('request', countCalls);
    await page.goto(`${BASE}/admin/creator-review?creatorId=probe-phase2c-unlinked`, { waitUntil: 'domcontentloaded' });
    await page.locator('div', { hasText: /^⚑ Feature Access$/ }).last().waitFor({ timeout: 30000 });
    await page.locator('div', { hasText: /^⚑ Feature Access$/ }).last().click();
    await page.getByTestId('creator-feature-access-no-account').waitFor({ timeout: 15000 });
    await settle(page, 1000);
    check(/No linked account/.test(await text(page, 'creator-feature-access-no-account')), 'G creator without linked account → "No linked account"');
    check(unlinkedEntitlementCalls === 0, 'G no entitlement request for an unlinked creator', unlinkedEntitlementCalls);
    page.off('request', countCalls);
    await page.unroute('**/api/v1/catalog/creators');

    // ── H: honest errors ───────────────────────────────────────────────────
    await page.route(`**/api/v1/entitlements/admin/accounts/${SID}`, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'down', code: 'ENTITLEMENT_CHECK_UNAVAILABLE' }) }),
    );
    await page.goto(`${BASE}/admin/feature-access?view=accounts&userId=${SID}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('account-entitlements-error').waitFor({ timeout: 30000 });
    check(/temporarily unavailable/i.test(await text(page, 'account-entitlements-error')), 'H 503 → "temporarily unavailable"');
    check((await page.locator('[data-testid^="account-status-"]').count()) === 0 && !/ENABLED/.test(await page.locator('.fa-entitlements').innerText()), 'H 503 → no fabricated states');
    await page.unroute(`**/api/v1/entitlements/admin/accounts/${SID}`);
    await page.getByTestId('account-entitlements-error').getByRole('button', { name: 'Retry' }).click();
    await page.getByTestId('account-entitlements-panel').waitFor({ timeout: 30000 });
    check((await page.locator('[data-testid^="account-status-"]').count()) > 0, 'H Retry recovers once the API is back');
    await page.route('**/api/v1/entitlements/admin/platform-states', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid token', code: 'AUTH_INVALID_TOKEN' }) }),
    );
    await page.goto(`${BASE}/admin/feature-access?view=platform`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('platform-controls-error').waitFor({ timeout: 30000 });
    check(/session has expired/i.test(await text(page, 'platform-controls-error')) && (await page.locator('[data-testid^="platform-state-"]').count()) === 0, 'H 401 → session message, no platform states');
    check((await page.getByTestId('platform-controls-error').getByRole('button', { name: 'Retry' }).count()) === 1, 'H Retry available');
    await page.unroute('**/api/v1/entitlements/admin/platform-states');
    await page.route('**/api/v1/entitlements/admin/audit*', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'down', code: 'ENTITLEMENT_CHECK_UNAVAILABLE' }) }),
    );
    await page.goto(`${BASE}/admin/feature-access?view=audit`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('audit-error').waitFor({ timeout: 30000 });
    check((await page.getByTestId('audit-event').count()) === 0, 'H audit 503 → error card, no rows');
    await page.unroute('**/api/v1/entitlements/admin/audit*');
    check(pageErrors.length === 0, 'Super Admin pages: no page errors', pageErrors.slice(0, 3));
    await superCtx.close();

    // ── F: ordinary Admin (read-only) ─────────────────────────────────────
    const adminCtx = await sessionContext(browser, tempAdmin.email, tempPassword);
    const ap = await adminCtx.newPage();
    const adminErrors: string[] = [];
    ap.on('pageerror', (e) => adminErrors.push(String(e)));
    await ap.goto(`${BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ap.getByTestId('feature-row-cashbooks').waitFor({ timeout: 30000 });
    check((await ap.getByTestId('entitlements-readonly-note').count()) === 1, 'F Admin sees the read-only note');
    check((await ap.getByRole('switch').count()) === 0 && (await ap.getByTestId('role-default-state-cashbooks').count()) === 1, 'F role defaults shown as state, not toggles');
    await ap.screenshot({ path: join(OUT, 'admin-readonly-roles.png'), fullPage: true });
    for (const v of ['platform', 'accounts', 'audit']) {
      await ap.goto(`${BASE}/admin/feature-access?view=${v}${v === 'accounts' ? `&userId=${SID}` : ''}`, { waitUntil: 'domcontentloaded' });
      const panel = v === 'platform' ? 'platform-controls-panel' : v === 'accounts' ? 'account-entitlements-panel' : 'entitlement-audit-panel';
      const loaded = await ap.getByTestId(panel).waitFor({ timeout: 30000 }).then(() => true, () => false);
      check(loaded, `F Admin: ${v} view loads`);
      check(
        (await ap.getByTestId('enter-edit-mode').count()) === 0 &&
          (await ap.locator('[data-testid^="platform-action-"], [data-testid^="override-action-"]').count()) === 0,
        `F Admin: ${v} view has no Edit button or mutation controls`,
      );
    }
    check((await putOverride(admin.token, 'cashbooks', { effect: 'revoke', reason: 'x' })).status === 403, 'F Admin direct PUT override → 403');
    check((await call(`/entitlements/admin/accounts/${SID}/overrides/cashbooks`, admin.token, 'DELETE', { reason: 'x' })).status === 403, 'F Admin direct DELETE override → 403');
    check((await call('/entitlements/admin/role-defaults/seller/cashbooks', admin.token, 'PATCH', { enabled: false })).status === 403, 'F Admin direct PATCH role default → 403');
    check((await call('/entitlements/admin/platform-states/cashbooks', admin.token, 'PUT', { enabled: false, reason: 'x' })).status === 403, 'F Admin direct PUT platform → 403');
    check(adminErrors.length === 0, 'Admin pages: no page errors', adminErrors.slice(0, 3));
    await adminCtx.close();

    // ── G: partners cannot reach the Admin entitlement UI or APIs ──────────
    for (const [name, t] of [['seller', seller.token], ['creator', creator.token]] as const) {
      check((await call(`/entitlements/admin/accounts/${SID}`, t)).status === 403, `G ${name}: account summary API → 403`);
      check((await call('/entitlements/admin/platform-states', t)).status === 403, `G ${name}: platform API → 403`);
      check((await call('/entitlements/admin/audit', t)).status === 403, `G ${name}: audit API → 403`);
    }
    const sellerCtx = await sessionContext(browser, 'seller@choosify.com.bd');
    const sp = await sellerCtx.newPage();
    await sp.goto(`${BASE}/admin/feature-access?view=accounts&userId=${SID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sp.waitForURL('**/admin/dashboard', { timeout: 20000 }).catch(() => undefined);
    check(sp.url().endsWith('/admin/dashboard') && (await sp.getByTestId('account-entitlements-panel').count()) === 0, 'G seller redirected away from Feature Access', sp.url());
    await sellerCtx.close();
  } finally {
    await db.delete(accountEntitlementOverrides).where(inArray(accountEntitlementOverrides.userId, [SID]));
    await db.delete(platformFeatureStates);
    if (platformSnapshot.length) await db.insert(platformFeatureStates).values(platformSnapshot);
    await db.delete(users).where(inArray(users.id, [SID, tempAdmin.id]));
    const restored = await db.select().from(platformFeatureStates);
    check(JSON.stringify(restored.map((r) => [r.featureKey, r.enabled]).sort()) === JSON.stringify(platformSnapshot.map((r) => [r.featureKey, r.enabled]).sort()), 'cleanup: platform states restored exactly');
    const leftover = await db.select({ id: users.id }).from(users).where(eq(users.id, SID));
    check(leftover.length === 0, 'cleanup: temporary accounts deleted');
    await browser.close();
  }

  if (FAIL.length) {
    console.error(`\nFAIL probe-entitlement-phase2c-browser (${FAIL.length} failed, ${passes} passed)`);
    for (const f of FAIL) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase2c-browser (${passes} checks)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
