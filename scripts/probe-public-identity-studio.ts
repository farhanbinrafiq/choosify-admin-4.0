/**
 * Public Identity — owner username section in Brand Studio + Creator Studio,
 * browser probe.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that
 * same database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost, with
 * migration 0013). Refuses otherwise; no override. Creates throwaway accounts,
 * Brands and Creators through the API and deletes the accounts and Brands at the
 * end (handle history is append-only and uses per-run names).
 *
 *   A  Brand owner: current username + canonical /brands/ URL; availability is
 *      checked as type=brand for THIS Brand (invalid / reserved / current /
 *      unavailable / available); network + 401 failures keep the typed username;
 *      submit sends { handle } to this Brand only; pending shown, active username
 *      unchanged; cancel; rejection reason shown; pending conflict handled
 *   B  second Brand of the same seller is independent
 *   C  Creator owner: /creators/ URL, type=creator; submit / approve / rename,
 *      the old username is retired; Brand handles unaffected (and vice versa)
 *   D  staff viewer: read-only (no change / cancel controls)
 *   E  impersonated session: no mutation controls; server refuses mutations
 *   F  non-owners: server refuses reads and requests
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-public-identity-studio.ts
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

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
async function apiLogin(email: string, password: string) {
  const r = await call('/auth/login', null, 'POST', { email, password });
  if (!r.body.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return { token: String(r.body.accessToken) };
}
async function seedToken(ctx: BrowserContext, token: string) {
  await ctx.addInitScript((t) => {
    try {
      if (!sessionStorage.getItem('__probe_seeded')) {
        localStorage.setItem('choosify_auth_token', t as string);
        sessionStorage.setItem('__probe_seeded', '1');
      }
    } catch {}
  }, token);
}
async function sessionContext(browser: Browser, email: string, password: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const res = await ctx.request.post(`${API}/auth/login`, { data: { email, password } });
  const token = String(((await res.json()) as Record<string, any>).accessToken || '');
  if (!token) throw new Error(`browser login ${email} failed`);
  await seedToken(ctx, token);
  return ctx;
}

const text = (p: Page, testId: string) => p.getByTestId(testId).first().innerText().catch(() => '');
const count = (p: Page, testId: string) => p.getByTestId(testId).count();
const waitFor = (p: Page, testId: string, timeout = 30000) => p.getByTestId(testId).first().waitFor({ timeout }).then(() => true, () => false);
const waitText = (p: Page, testId: string, needle: string, timeout = 15000) =>
  p.waitForFunction(([id, n]) => (document.querySelector(`[data-testid="${id}"]`)?.textContent || '').includes(n), [testId, needle] as const, { timeout }).then(() => true, () => false);

/** Open Brand Studio and the inline Identity editor (the "Edit" pill beside the brand name). */
async function openBrandIdentity(page: Page, brandId: string, brandName: string) {
  await page.goto(`${BASE}/admin/brand-studio/${encodeURIComponent(brandId)}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText(brandName).first().waitFor({ timeout: 45000 });
  const clicked = await page.evaluate((name) => {
    const pill = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Edit' && (b.nextElementSibling?.textContent || '').includes(name),
    ) as HTMLButtonElement | undefined;
    pill?.click();
    return Boolean(pill);
  }, brandName);
  return clicked && (await waitFor(page, 'pi-section'));
}

/** Open Creator Studio, switch the header View/Edit toggle to Edit, then the inline Identity editor. */
async function openCreatorIdentity(page: Page, creatorId: string) {
  await page.goto(`${BASE}/admin/creator-studio/${encodeURIComponent(creatorId)}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const editToggle = page.getByRole('button', { name: 'Edit', exact: true }).first();
  await editToggle.waitFor({ timeout: 45000 });
  await editToggle.click();
  const pill = page.getByRole('button', { name: 'Identity', exact: true }).first();
  await pill.waitFor({ timeout: 45000 });
  await pill.click();
  return waitFor(page, 'pi-section');
}

async function typeAndCheck(page: Page, value: string) {
  await page.getByTestId('pi-input').fill(value);
  await page.getByTestId('pi-check').click();
}
const verdictOf = (page: Page) =>
  page.getByTestId('pi-verdict').first().waitFor({ timeout: 15000 }).then(() => page.getByTestId('pi-verdict').first().getAttribute('data-verdict'), () => null);

async function main() {
  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
    console.error('REFUSING: PROBE_DISPOSABLE_DATABASE_URL is not local.');
    process.exit(2);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: PROBE_BASE_URL_ROOT is not a local server.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
  if (!(await q(`select to_regclass('public.public_handle_requests') is not null as ok`))[0]?.ok) {
    console.error('REFUSING: migration 0013 is not applied to this database.');
    process.exit(2);
  }
  if (!(await q(`select id from users where email='admin@choosify.com.bd'`))[0]) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const sfx = Date.now().toString(36);
  const h = (b: string) => `${b}-${sfx}`;
  const pw = `PiStudio!${sfx}`;
  const hash = await argon2.hash(pw);
  const tempUsers: string[] = [];
  const mkUser = async (label: string, role: string, name: string) => {
    const email = `pi.${label}.${sfx}@probe.local`;
    const [row] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,$4,true) returning id`,
      [email, hash, name, role],
    );
    tempUsers.push(row.id);
    return { id: row.id, email };
  };
  const uSeller = await mkUser('seller', 'seller', `PI Seller ${sfx}`);
  const uSeller2 = await mkUser('seller2', 'seller', `PI Seller Two ${sfx}`);
  const uCreator = await mkUser('creator', 'creator', `PI Creator ${sfx}`);
  const uAdmin = await mkUser('admin', 'admin', `PI Admin ${sfx}`);

  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const SELLER = await apiLogin(uSeller.email, pw);
  const SELLER2 = await apiLogin(uSeller2.email, pw);
  const CREATOR = await apiLogin(uCreator.email, pw);

  const brandIds: string[] = [];
  const mkBrand = async (key: string, sellerId: string) => {
    const r = await call('/catalog/brands', SA.token, 'POST', {
      name: `PI ${key.toUpperCase()} ${sfx}`,
      category: 'General',
      sellerId,
      marketplaceAccess: true,
      marketplaceStatus: 'granted',
    });
    if (r.status !== 201) throw new Error(`brand ${key}: ${JSON.stringify(r.body)}`);
    brandIds.push(r.body.data.id);
    return r.body.data as { id: string; name: string; slug: string };
  };
  const B1 = await mkBrand('one', uSeller.id);
  const B2 = await mkBrand('two', uSeller.id);
  const B3 = await mkBrand('other', uSeller2.id);
  const C1 = `creator-piprobe-${sfx}`;
  {
    const r = await call(`/catalog/creators/${C1}`, SA.token, 'PUT', { name: `PI Creator Profile ${sfx}`, slug: `pi-creator-${sfx}`, status: 'live', userId: uCreator.id });
    if (r.status !== 200) throw new Error(`creator: ${JSON.stringify(r.body)}`);
  }
  const C1slug = `pi-creator-${sfx}`;
  const assign = (entityType: string, entityId: string, handle: string) =>
    call('/public-handles/admin/assign', SA.token, 'POST', { entityType, entityId, handle, reason: 'Probe: initial username' });
  check((await assign('brand', B1.id, h('b1'))).status === 200, 'setup: Brand one has an active username');
  check((await assign('brand', B3.id, h('tk'))).status === 200, 'setup: another seller’s Brand holds a username');

  const activeOf = async (type: string, id: string) =>
    (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;
  const pendingOf = async (type: string, id: string) =>
    (await q<{ id: string; requested_handle: string }>(`select id, requested_handle from public_handle_requests where entity_type=$1 and entity_id=$2 and status='pending'`, [type, id]))[0] ?? null;
  const requestCount = async (type: string, id: string) =>
    (await q<{ n: number }>(`select count(*)::int n from public_handle_requests where entity_type=$1 and entity_id=$2`, [type, id]))[0].n;
  const statusOf = async (requestId: string) => (await q<{ status: string }>(`select status from public_handle_requests where id=$1`, [requestId]))[0]?.status;

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const pageErrors: string[] = [];
  try {
    // ── A. Brand owner ──
    const sctx = await sessionContext(browser, uSeller.email, pw);
    const page = await sctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const availabilityCalls: string[] = [];
    const posts: Array<{ url: string; body: string | null }> = [];
    page.on('request', (r) => {
      if (r.url().includes('/catalog/handles/availability')) availabilityCalls.push(r.url());
      if (r.method() === 'POST' && r.url().includes('/public-handles/')) posts.push({ url: r.url(), body: r.postData() });
    });

    check(await openBrandIdentity(page, B1.id, B1.name), 'A Brand Studio → Identity shows the PUBLIC IDENTITY section');
    check((await page.getByTestId('pi-section').getAttribute('data-entity-id')) === B1.id, 'A the section belongs to this Brand (entity id)');
    check(await waitText(page, 'pi-current', `@${h('b1')}`), 'A current username shown', await text(page, 'pi-current'));
    const href1 = (await page.getByTestId('pi-url').getAttribute('href')) || '';
    check(href1.endsWith(`/brands/${h('b1')}`) && /^https?:\/\//.test(href1), 'A canonical public URL /brands/<username>', href1);
    check((await page.getByText('Public Identity', { exact: true }).count()) >= 1, 'A section heading "Public Identity"');
    check(/permanently retired/i.test(await text(page, 'pi-section')) && /reviewed by Choosify/i.test(await text(page, 'pi-section')), 'A explains approval + permanent retirement');

    await page.getByTestId('pi-change').click();
    check(await waitFor(page, 'pi-form'), 'A "Change username" opens the request form');
    let before = availabilityCalls.length;
    await page.getByTestId('pi-input').fill('ab');
    check(await waitFor(page, 'pi-local-error', 5000), 'A too-short username flagged instantly (shared rules)');
    check(await page.getByTestId('pi-submit').isDisabled(), 'A submit disabled for an invalid username');
    await page.getByTestId('pi-check').click();
    check((await verdictOf(page)) === 'invalid', 'A verdict Invalid for "ab"');
    check(availabilityCalls.length === before, 'A an invalid username is not sent to the server');
    await page.getByTestId('pi-input').fill('My Shop!');
    check(/spaces or symbols/i.test(await text(page, 'pi-local-error')), 'A spaces / symbols explained', await text(page, 'pi-local-error'));
    await typeAndCheck(page, 'brand-shop');
    check((await verdictOf(page)) === 'reserved', 'A verdict Reserved for a reserved prefix');
    await typeAndCheck(page, 'admin');
    check((await verdictOf(page)) === 'reserved', 'A verdict Reserved for a reserved name');
    await typeAndCheck(page, h('b1'));
    check(await page.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'current', null, { timeout: 15000 }).then(() => true, () => false), 'A verdict Current for its own username');
    await typeAndCheck(page, h('tk'));
    check(await page.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'unavailable', null, { timeout: 15000 }).then(() => true, () => false), 'A verdict Unavailable for another profile’s username');
    check(!/brand|seller|PI OTHER/i.test(await text(page, 'pi-verdict')), 'A unavailable answer reveals nothing about the holder', await text(page, 'pi-verdict'));
    before = availabilityCalls.length;
    await typeAndCheck(page, h('new1'));
    check(await page.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'available', null, { timeout: 15000 }).then(() => true, () => false), 'A verdict Available for a free username');
    const lastAvail = new URL(availabilityCalls[availabilityCalls.length - 1] || 'http://x/');
    check(lastAvail.searchParams.get('type') === 'brand' && lastAvail.searchParams.get('entityId') === B1.id && lastAvail.searchParams.get('handle') === h('new1'), 'A availability checked as type=brand for this Brand', lastAvail.search);
    check(availabilityCalls.length === before + 1, 'A exactly one availability call per check');
    check(!(await page.getByTestId('pi-submit').isDisabled()), 'A submit enabled only after an Available verdict');

    // failures keep the typed username
    await page.route('**/api/v1/public-handles/*/*/requests', (route) => route.abort('failed'));
    await page.getByTestId('pi-submit').click();
    check(await waitText(page, 'pi-error', 'connection'), 'A network failure → connection message', await text(page, 'pi-error'));
    check((await page.getByTestId('pi-input').inputValue()) === h('new1'), 'A network failure keeps the typed username');
    await page.unroute('**/api/v1/public-handles/*/*/requests');
    await page.route('**/api/v1/public-handles/*/*/requests', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Unauthorized' }) }),
    );
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.getByTestId('pi-submit').click();
    check(await waitText(page, 'pi-error', 'session'), 'A 401 → session expired message', await text(page, 'pi-error'));
    check((await page.getByTestId('pi-input').inputValue()) === h('new1'), 'A 401 keeps the typed username');
    await page.unroute('**/api/v1/public-handles/*/*/requests');
    await page.unroute('**/api/v1/auth/refresh');
    check((await pendingOf('brand', B1.id)) === null, 'A failed submits created no request');

    // real submit
    const postsBefore = posts.length;
    await page.getByTestId('pi-submit').click();
    check(await waitFor(page, 'pi-pending'), 'A pending request shown after submit');
    const sent = posts.slice(postsBefore).find((p) => p.url.includes('/requests'));
    check(sent?.url.endsWith(`/public-handles/brand/${encodeURIComponent(B1.id)}/requests`) && JSON.parse(sent.body || '{}').handle === h('new1') && Object.keys(JSON.parse(sent.body || '{}')).length === 1, 'A submit sends { handle } to /public-handles/brand/<this Brand>/requests', sent);
    check((await text(page, 'pi-pending-handle')) === `@${h('new1')}`, 'A pending shows the requested username');
    check(await waitText(page, 'pi-notice', 'waiting for Choosify review'), 'A specific submitted message (not a generic success)', await text(page, 'pi-notice'));
    check((await text(page, 'pi-current')) === `@${h('b1')}` && (await activeOf('brand', B1.id)) === h('b1'), 'A active username unchanged before approval (UI + database)');
    check((await count(page, 'pi-change')) === 0, 'A no change form while a request is pending');
    check((await pendingOf('brand', B2.id)) === null, 'A the other Brand of this seller got no request');

    // cancel
    const pend1 = await pendingOf('brand', B1.id);
    await page.getByTestId('pi-cancel').click();
    await page.getByTestId('pi-cancel-confirm').click();
    check(await waitText(page, 'pi-notice', 'cancelled'), 'A cancel confirmed with a specific message', await text(page, 'pi-notice'));
    check(pend1 && (await statusOf(pend1.id)) === 'cancelled', 'A request cancelled in the database');
    check((await count(page, 'pi-pending')) === 0 && (await count(page, 'pi-change')) === 1, 'A after cancel: no pending, change available again');
    check(posts.some((p) => p.url.endsWith(`/public-handles/requests/${pend1?.id}/cancel`)), 'A cancel used /public-handles/requests/<id>/cancel');

    // rejected request shows its reason
    check((await call(`/public-handles/brand/${B1.id}/requests`, SELLER.token, 'POST', { handle: h('new2') })).status === 201, 'A setup: second request');
    const pend2 = await pendingOf('brand', B1.id);
    check((await call(`/public-handles/admin/requests/${pend2?.id}/reject`, SA.token, 'POST', { note: 'Probe: please use your brand name' })).status === 200, 'A setup: Super Admin rejects with a reason');
    check(await openBrandIdentity(page, B1.id, B1.name), 'A reopen Brand Studio');
    check(await waitFor(page, 'pi-rejected'), 'A rejected request shown');
    check((await text(page, 'pi-rejected-reason')) === 'Probe: please use your brand name', 'A rejection reason shown', await text(page, 'pi-rejected-reason'));
    check((await text(page, 'pi-current')) === `@${h('b1')}`, 'A rejected request left the username unchanged');

    // a request appears elsewhere while the form is open
    await page.getByTestId('pi-change').click();
    await typeAndCheck(page, h('new3'));
    await page.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'available', null, { timeout: 15000 }).catch(() => undefined);
    check((await call(`/public-handles/brand/${B1.id}/requests`, SELLER.token, 'POST', { handle: h('new4') })).status === 201, 'A setup: a request submitted from another tab');
    await page.getByTestId('pi-submit').click();
    check(await waitText(page, 'pi-error', 'already waiting'), 'A pending-request conflict explained', await text(page, 'pi-error'));
    check(await waitText(page, 'pi-pending-handle', h('new4')), 'A view refreshed to the other pending request');
    const pend4 = await pendingOf('brand', B1.id);
    if (pend4) await call(`/public-handles/requests/${pend4.id}/cancel`, SELLER.token, 'POST', {});

    // ── B. second Brand is independent ──
    check(await openBrandIdentity(page, B2.id, B2.name), 'B second Brand opens its own section');
    check((await page.getByTestId('pi-section').getAttribute('data-entity-id')) === B2.id, 'B section bound to the second Brand');
    check(/No username yet/.test(await text(page, 'pi-current')), 'B second Brand has no username (not Brand one’s)', await text(page, 'pi-current'));
    const href2 = (await page.getByTestId('pi-url').getAttribute('href')) || '';
    check(href2.endsWith(`/brands/${B2.slug}`), 'B URL falls back to the second Brand’s slug', href2);
    check((await text(page, 'pi-change')) === 'Request a username', 'B "Request a username" when none is active');
    await page.getByTestId('pi-change').click();
    await typeAndCheck(page, h('b2'));
    await page.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'available', null, { timeout: 15000 }).catch(() => undefined);
    const b1Requests = await requestCount('brand', B1.id);
    await page.getByTestId('pi-submit').click();
    check(await waitFor(page, 'pi-pending'), 'B request submitted for the second Brand');
    check((await pendingOf('brand', B2.id))?.requested_handle === h('b2'), 'B pending request stored for the second Brand');
    check((await requestCount('brand', B1.id)) === b1Requests && (await pendingOf('brand', B1.id)) === null, 'B Brand one untouched');
    await sctx.close();

    // ── C. Creator owner ──
    const cctx = await sessionContext(browser, uCreator.email, pw);
    const cpage = await cctx.newPage();
    cpage.on('pageerror', (e) => pageErrors.push(String(e)));
    const cAvail: string[] = [];
    const cPosts: string[] = [];
    cpage.on('request', (r) => {
      if (r.url().includes('/catalog/handles/availability')) cAvail.push(r.url());
      if (r.method() === 'POST' && r.url().includes('/public-handles/')) cPosts.push(r.url());
    });
    check(await openCreatorIdentity(cpage, C1), 'C Creator Studio → Identity shows the PUBLIC IDENTITY section');
    check((await cpage.getByTestId('pi-section').getAttribute('data-entity-type')) === 'creator', 'C section is for the Creator entity');
    check(/No username yet/.test(await text(cpage, 'pi-current')), 'C no username yet');
    const chref = (await cpage.getByTestId('pi-url').getAttribute('href')) || '';
    check(chref.endsWith(`/creators/${C1slug}`), 'C canonical /creators/ URL', chref);
    await cpage.getByTestId('pi-change').click();
    await typeAndCheck(cpage, h('tk'));
    check(await cpage.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'unavailable', null, { timeout: 15000 }).then(() => true, () => false), 'C a Brand’s username is unavailable to a Creator (one namespace)');
    await typeAndCheck(cpage, h('cr1'));
    check(await cpage.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'available', null, { timeout: 15000 }).then(() => true, () => false), 'C free username available');
    const cu = new URL(cAvail[cAvail.length - 1] || 'http://x/');
    check(cu.searchParams.get('type') === 'creator' && cu.searchParams.get('entityId') === C1, 'C availability checked as type=creator for this Creator', cu.search);
    const brandStateBefore = JSON.stringify([await activeOf('brand', B1.id), await activeOf('brand', B2.id), await requestCount('brand', B1.id), await requestCount('brand', B2.id)]);
    await cpage.getByTestId('pi-submit').click();
    check(await waitFor(cpage, 'pi-pending'), 'C pending request shown');
    check(cPosts.some((u) => u.endsWith(`/public-handles/creator/${C1}/requests`)), 'C submit went to /public-handles/creator/<id>/requests');
    const cp = await pendingOf('creator', C1);
    check(cp?.requested_handle === h('cr1'), 'C request stored for the Creator');
    check(/No username yet/.test(await text(cpage, 'pi-current')) && (await activeOf('creator', C1)) === null, 'C nothing active before approval');
    check(JSON.stringify([await activeOf('brand', B1.id), await activeOf('brand', B2.id), await requestCount('brand', B1.id), await requestCount('brand', B2.id)]) === brandStateBefore, 'C Creator request did not affect any Brand');
    check((await call(`/public-handles/admin/requests/${cp?.id}/approve`, SA.token, 'POST', {})).status === 200, 'C setup: Super Admin approves');
    check(await openCreatorIdentity(cpage, C1), 'C reopen Creator Studio');
    check(await waitText(cpage, 'pi-current', `@${h('cr1')}`), 'C approved username is now current', await text(cpage, 'pi-current'));
    check(await waitFor(cpage, 'pi-approved', 5000), 'C approval shown');
    check(((await cpage.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/creators/${h('cr1')}`), 'C URL now uses the username');
    // rename → old username retired
    await cpage.getByTestId('pi-change').click();
    await typeAndCheck(cpage, h('cr2'));
    await cpage.waitForFunction(() => document.querySelector('[data-testid="pi-verdict"]')?.getAttribute('data-verdict') === 'available', null, { timeout: 15000 }).catch(() => undefined);
    await cpage.getByTestId('pi-submit').click();
    check(await waitText(cpage, 'pi-notice', `@${h('cr1')} stays your username`), 'C rename request says the current username stays active', await text(cpage, 'pi-notice'));
    const cp2 = await pendingOf('creator', C1);
    check((await call(`/public-handles/admin/requests/${cp2?.id}/approve`, SA.token, 'POST', {})).status === 200, 'C setup: rename approved');
    const retired = await call(`/catalog/handles/availability?handle=${h('cr1')}&type=brand`, SELLER.token);
    check(retired.body.data?.available === false, 'C old username permanently retired (not available, even to a Brand)', retired.body);
    check((await call(`/public-handles/brand/${B1.id}`, CREATOR.token)).status === 403, 'C Creator owner cannot read a Brand’s handle state');
    check((await call(`/public-handles/brand/${B1.id}/requests`, CREATOR.token, 'POST', { handle: h('steal') })).status === 403, 'C Creator owner cannot request a Brand username');
    await cctx.close();

    // ── D. staff viewer: read-only ──
    const actx = await sessionContext(browser, uAdmin.email, pw);
    const apage = await actx.newPage();
    apage.on('pageerror', (e) => pageErrors.push(String(e)));
    const aPosts: string[] = [];
    apage.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/public-handles/')) aPosts.push(r.url());
    });
    check(await openBrandIdentity(apage, B1.id, B1.name), 'D Admin opens the Brand’s identity');
    check(await waitFor(apage, 'pi-readonly'), 'D read-only notice for staff');
    check(await waitText(apage, 'pi-current', `@${h('b1')}`), 'D staff see the current username');
    check((await count(apage, 'pi-change')) === 0 && (await count(apage, 'pi-cancel')) === 0, 'D no change / cancel controls for staff');
    check(aPosts.length === 0, 'D no handle write sent');
    await actx.close();

    // ── E. impersonated session ──
    const imp = await call('/auth/impersonate/start', SA.token, 'POST', { targetUserId: uSeller.id, reason: 'Public Identity studio probe' });
    check(imp.status === 200 && imp.body.accessToken, 'E Super Admin impersonates the seller', imp.body);
    const ictx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await seedToken(ictx, String(imp.body.accessToken));
    const ipage = await ictx.newPage();
    ipage.on('pageerror', (e) => pageErrors.push(String(e)));
    check(await openBrandIdentity(ipage, B2.id, B2.name), 'E impersonated: Brand Studio identity opens');
    check(await waitFor(ipage, 'pi-impersonating'), 'E impersonation notice shown');
    check((await count(ipage, 'pi-change')) === 0 && (await count(ipage, 'pi-cancel')) === 0, 'E no change / cancel controls while impersonating');
    const pB2 = await pendingOf('brand', B2.id);
    const impCancel = await call(`/public-handles/requests/${pB2?.id}/cancel`, String(imp.body.accessToken), 'POST', {});
    check(impCancel.status === 403 && impCancel.body.code === 'HANDLE_IMPERSONATION_NOT_ALLOWED', 'E server refuses an impersonated cancel', impCancel.body);
    const impSubmit = await call(`/public-handles/brand/${B1.id}/requests`, String(imp.body.accessToken), 'POST', { handle: h('imp') });
    check(impSubmit.status === 403 && impSubmit.body.code === 'HANDLE_IMPERSONATION_NOT_ALLOWED', 'E server refuses an impersonated request', impSubmit.body);
    check(pB2 && (await statusOf(pB2.id)) === 'pending' && (await pendingOf('brand', B1.id)) === null, 'E nothing changed');
    await call('/auth/impersonate/exit', String(imp.body.accessToken), 'POST', {}).catch(() => undefined);
    await ictx.close();

    // ── F. non-owners ──
    const f1 = await call(`/public-handles/brand/${B1.id}`, SELLER2.token);
    check(f1.status === 403 && f1.body.code === 'HANDLE_FORBIDDEN', 'F another seller cannot read this Brand’s username state', f1.body);
    const f2 = await call(`/public-handles/brand/${B1.id}/requests`, SELLER2.token, 'POST', { handle: h('steal2') });
    check(f2.status === 403, 'F another seller cannot request a username for it');
    const f3 = await call(`/public-handles/requests/${pB2?.id}/cancel`, SELLER2.token, 'POST', {});
    check(f3.status === 403, 'F another seller cannot cancel its request');
    const f4 = await call(`/public-handles/admin/requests/${pB2?.id}/approve`, SELLER.token, 'POST', {});
    check(f4.status === 403, 'F the owner cannot approve their own request');
    check(pB2 && (await statusOf(pB2.id)) === 'pending', 'F request still pending');

    check(pageErrors.length === 0, 'no uncaught page errors', pageErrors.slice(0, 3));
  } finally {
    await browser.close();
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA.token, 'DELETE').catch(() => undefined);
    await q(`delete from users where id = any($1::uuid[])`, [tempUsers]).catch((e) => console.log('cleanup:', e.message));
    const left = (await q<{ n: number }>(`select count(*)::int n from users where id = any($1::uuid[])`, [tempUsers]))[0]?.n;
    check(left === 0, 'cleanup: temporary accounts deleted');
    await db.end();
  }

  console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-public-identity-studio (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
