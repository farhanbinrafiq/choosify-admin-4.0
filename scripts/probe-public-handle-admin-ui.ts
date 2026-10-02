/**
 * Public Identity C5 — Admin public handle management, browser probe.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that
 * same database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost, with
 * migration 0013). Talks to Postgres only through its own client on that URL —
 * never the app's db client (which reads .env). Refuses otherwise; no override.
 *
 * Creates throwaway accounts (admin, two sellers, a creator owner) and fixture
 * Brands / Creators through the API, deletes the accounts and Brands at the end.
 * Handle history it writes stays (append-only by design; retired handles are
 * never reused) and uses per-run names.
 *
 *   A  Admin: read-only panels (no Edit Mode bar, no review/direct controls),
 *      multi-Brand selector, queue visible but review is read-only; API writes 403
 *   B  Moderator: no Public Handle tab / panel / queue; API reads 403
 *   C  Super Admin: no write controls in View Mode; controls in Edit Mode
 *   D  reject requires a reason (no request sent without one), then rejects;
 *      approve shows current → requested, refreshes active handle + history
 *   E  failures keep the dialog and its context: suspended Brand, handle taken
 *      meanwhile, injected 503; request stays pending
 *   F  queue: oldest first, links to the right Seller / Creator profile, ownership
 *      transfer → "no longer owns" in the dialog, queue refreshes
 *   G  Creator without an owner account: direct assign (availability check
 *      required), rename (old → new), retire (explicit confirmation)
 *   H  impersonated session: no panels; API mutation refused
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-public-handle-admin-ui.ts      (restart the API first: auth rate limit)
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
  return { token: String(r.body.accessToken), uid: String(r.body.uid || '') };
}

/** Browser context with a real session: refresh cookie (from login) + access token in localStorage. */
async function sessionContext(browser: Browser, email: string, password: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const res = await ctx.request.post(`${API}/auth/login`, { data: { email, password } });
  const token = String(((await res.json()) as Record<string, any>).accessToken || '');
  if (!token) throw new Error(`browser login ${email} failed`);
  await seedToken(ctx, token);
  return ctx;
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

const text = (p: Page, testId: string) => p.getByTestId(testId).first().innerText().catch(() => '');
const count = (p: Page, testId: string) => p.getByTestId(testId).count();
const waitFor = (p: Page, testId: string, timeout = 30000) => p.getByTestId(testId).first().waitFor({ timeout }).then(() => true, () => false);
const gone = (p: Page, testId: string, timeout = 15000) => p.getByTestId(testId).first().waitFor({ state: 'detached', timeout }).then(() => true, () => false);

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
  // The running server must use this same database: the dev Super Admin it authenticates must exist here.
  const sa = (await q<{ id: string }>(`select id from users where email='admin@choosify.com.bd'`))[0];
  if (!sa) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const sfx = Date.now().toString(36);
  const h = (b: string) => `${b}-${sfx}`;
  const pw = `HandleUi!${sfx}`;
  const hash = await argon2.hash(pw);
  const tempUsers: string[] = [];
  const mkUser = async (label: string, role: string, name: string) => {
    const email = `c5.${label}.${sfx}@probe.local`;
    const [row] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,$4,true) returning id`,
      [email, hash, name, role],
    );
    tempUsers.push(row.id);
    return { id: row.id, email };
  };
  const uAdmin = await mkUser('admin', 'admin', 'C5 Probe Admin');
  const uSeller = await mkUser('seller', 'seller', `C5 Seller ${sfx}`);
  const uSeller2 = await mkUser('seller2', 'seller', `C5 Seller Two ${sfx}`);
  const uCreator = await mkUser('creator', 'creator', `C5 Creator Owner ${sfx}`);

  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const SELLER = await apiLogin(uSeller.email, pw);
  const CREATOR = await apiLogin(uCreator.email, pw);
  const ADMIN = await apiLogin(uAdmin.email, pw);
  const MOD = await apiLogin('moderator@choosify.com.bd', DEV_PASSWORD);

  const brandIds: string[] = [];
  const mkBrand = async (key: string) => {
    const r = await call('/catalog/brands', SA.token, 'POST', {
      name: `C5 ${key.toUpperCase()} ${sfx}`,
      category: 'General',
      sellerId: uSeller.id,
      marketplaceAccess: true,
      marketplaceStatus: 'granted',
    });
    if (r.status !== 201) throw new Error(`brand ${key}: ${JSON.stringify(r.body)}`);
    brandIds.push(r.body.data.id);
    return r.body.data as { id: string; name: string; slug: string };
  };
  const B1 = await mkBrand('one');
  const B2 = await mkBrand('two');
  const B3 = await mkBrand('three');
  const creatorOwned = `creator-c5probe-${sfx}-owned`;
  const creatorFree = `creator-c5probe-${sfx}-free`;
  for (const [id, userId] of [[creatorOwned, uCreator.id], [creatorFree, null]] as const) {
    const r = await call(`/catalog/creators/${id}`, SA.token, 'PUT', { name: `C5 Creator ${id.endsWith('owned') ? 'Owned' : 'Free'} ${sfx}`, status: 'live', ...(userId ? { userId } : {}) });
    if (r.status !== 200) throw new Error(`creator ${id}: ${JSON.stringify(r.body)}`);
  }
  // Owner submit is retired (410): legacy pending requests are seeded as the old route wrote them.
  const seedRequest = async (ownerUserId: string, type: string, id: string, handle: string) => {
    const [row] = await q<{ id: string }>(
      `insert into public_handle_requests (entity_type, entity_id, requested_handle, status, requested_by_user_id, created_at) values ($1,$2,$3,'pending',$4,clock_timestamp()) returning id`,
      [type, id, handle, ownerUserId],
    );
    await q(
      `insert into public_handle_events (action, entity_type, entity_id, to_handle, request_id, actor_user_id, created_at) values ('request_submitted',$1,$2,$3,$4,$5,clock_timestamp())`,
      [type, id, handle, row.id, ownerUserId],
    );
    return { status: 201, body: { success: true, data: { id: row.id, status: 'pending' } } as Record<string, any> };
  };
  const pendingId = async (entityId: string) => (await q<{ id: string }>(`select id from public_handle_requests where entity_id=$1 and status='pending'`, [entityId]))[0]?.id;
  const requestStatus = async (id: string) => (await q<{ status: string }>(`select status from public_handle_requests where id=$1`, [id]))[0]?.status;
  const activeOf = async (type: string, id: string) =>
    (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;

  // Requests: B1 (to be rejected, then approved), B3 (suspended), B2 (ownership transfer), creator owned.
  check((await seedRequest(uSeller.id, 'brand', B1.id, h('rej'))).status === 201, 'setup: legacy request on Brand one');
  check((await seedRequest(uSeller.id, 'brand', B2.id, h('xfer'))).status === 201, 'setup: legacy request on Brand two');
  check((await seedRequest(uSeller.id, 'brand', B3.id, h('susp'))).status === 201, 'setup: legacy request on Brand three');
  check((await seedRequest(uCreator.id, 'creator', creatorOwned, h('cown'))).status === 201, 'setup: legacy request on the owned Creator');

  const sellerProfile = (brandId?: string) => `${BASE}/admin/seller-profile?sellerId=${uSeller.id}&tab=handle${brandId ? `&brandId=${brandId}` : ''}`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  try {
    // ── A. Admin: read-only ──
    {
      const ctx = await sessionContext(browser, uAdmin.email, pw);
      const page = await ctx.newPage();
      const writes: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('/public-handles/')) writes.push(r.url());
      });
      await page.goto(sellerProfile(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      check(await waitFor(page, 'handle-panel-brand-active'), 'A Admin: Brand handle panel loads on the Seller Profile');
      check((await count(page, 'handle-brand-select')) === 1, 'A multi-Brand seller gets a Brand selector');
      const options = await page.getByTestId('handle-brand-select').locator('option').count();
      check(options === 3, 'A the selector lists all three Brands of this seller', options);
      check((await count(page, 'enter-edit-mode')) === 0, 'A Admin: no Edit Mode bar');
      check((await count(page, 'handle-panel-brand-review-approve')) === 0 && (await count(page, 'handle-panel-brand-review-reject')) === 0, 'A Admin: no approve / reject controls');
      check((await count(page, 'handle-panel-brand-direct')) === 0, 'A Admin: no direct assign / rename / retire controls');
      check((await text(page, 'handle-panel-brand-review-handle')).includes(h('rej')), 'A Admin sees the pending request (read-only)');
      check((await text(page, 'handle-panel-brand-review-requester')).includes(`C5 Seller ${sfx}`), 'A requester identity from the Admin user directory');
      await page.getByTestId('handle-brand-select').selectOption(B3.id);
      check(await page.waitForFunction((id) => document.querySelector('[data-testid="handle-panel-brand"]')?.getAttribute('data-entity-id') === id, B3.id, { timeout: 15000 }).then(() => true, () => false), 'A switching Brands loads that Brand’s panel');
      await page.goto(`${BASE}/admin/brand-verification`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      check(await waitFor(page, 'handle-queue'), 'A Admin sees the handle request queue');
      const rid = await pendingId(B1.id);
      await page.getByTestId(`handle-queue-review-${rid}`).click();
      check(await waitFor(page, 'handle-queue-item'), 'A Admin can open a request for review');
      check((await count(page, 'handle-queue-item-approve')) === 0, 'A …but has no approve / reject buttons in the queue');
      check(writes.length === 0, 'A no handle write request was sent by the Admin UI', writes);
      check((await call(`/public-handles/admin/requests/${rid}/approve`, ADMIN.token, 'POST', {})).status === 403, 'A server: Admin approve → 403');
      await ctx.close();
    }

    // ── B. Moderator: no access ──
    {
      const ctx = await sessionContext(browser, 'moderator@choosify.com.bd', DEV_PASSWORD);
      const page = await ctx.newPage();
      await page.goto(sellerProfile(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      check((await count(page, 'handle-panel-brand')) === 0 && (await page.getByText('Public Handle', { exact: false }).count()) === 0, 'B Moderator: no Public Handle tab or panel');
      await page.goto(`${BASE}/admin/brand-verification`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      check((await count(page, 'handle-queue')) === 0, 'B Moderator: no handle request queue');
      check((await call(`/public-handles/brand/${B1.id}`, MOD.token)).status === 403, 'B server: Moderator handle read → 403');
      await ctx.close();
    }

    // ── C–E. Super Admin on the Seller Profile ──
    const ctx = await sessionContext(browser, 'admin@choosify.com.bd', DEV_PASSWORD);
    const page = await ctx.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/public-handles/')) sent.push(r.url());
    });
    await page.goto(sellerProfile(B1.id), { waitUntil: 'domcontentloaded', timeout: 60000 });
    check(await waitFor(page, 'handle-panel-brand-review'), 'C Super Admin: Brand one with its pending request');
    check((await count(page, 'handle-panel-brand-review-approve')) === 0 && (await count(page, 'handle-panel-brand-direct')) === 0, 'C View Mode: no write controls');
    await page.getByTestId('handle-panel-brand').getByTestId('enter-edit-mode').click();
    check(await waitFor(page, 'handle-panel-brand-review-approve', 10000), 'C Edit Mode: approve / reject appear');
    check((await count(page, 'handle-panel-brand-rename')) + (await count(page, 'handle-panel-brand-assign')) === 1, 'C Edit Mode: direct controls appear');

    // D. Reject requires a reason.
    await page.getByTestId('handle-panel-brand-review-reject').click();
    await waitFor(page, 'handle-panel-brand-review-dialog');
    const before = sent.length;
    await page.getByTestId('handle-panel-brand-review-dialog-submit').click();
    check((await text(page, 'handle-panel-brand-review-dialog-error')).toLowerCase().includes('required') && sent.length === before, 'D reject without a reason: blocked in the dialog, no request sent');
    await page.getByTestId('handle-panel-brand-review-dialog-note').fill('Probe: name belongs to someone else');
    await page.getByTestId('handle-panel-brand-review-dialog-submit').click();
    check(await gone(page, 'handle-panel-brand-review-dialog'), 'D reject with a reason closes the dialog');
    check(await waitFor(page, 'handle-panel-brand-no-request', 15000), 'D panel refreshes: no pending request');
    check((await text(page, 'handle-panel-brand-history-events')).includes('Request rejected'), 'D history shows the rejection');
    // Approve a fresh request.
    check((await seedRequest(uSeller.id, 'brand', B1.id, h('app'))).status === 201, 'D setup: another legacy request on Brand one');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitFor(page, 'handle-panel-brand-review');
    await page.getByTestId('handle-panel-brand').getByTestId('enter-edit-mode').click();
    await page.getByTestId('handle-panel-brand-review-approve').click();
    await waitFor(page, 'handle-panel-brand-review-dialog');
    check((await text(page, 'handle-panel-brand-review-dialog-change')).includes(`No handle → @${h('app')}`), 'D approve dialog shows current → requested');
    await page.getByTestId('handle-panel-brand-review-dialog-submit').click();
    check(await gone(page, 'handle-panel-brand-review-dialog'), 'D approval closes the dialog');
    check(await page.waitForFunction((v) => document.querySelector('[data-testid="handle-panel-brand-active"]')?.textContent?.includes(v), `@${h('app')}`, { timeout: 15000 }).then(() => true, () => false), 'D active handle refreshes to the approved handle');
    check((await activeOf('brand', B1.id)) === h('app'), 'D server state: approved handle is active');
    check((await text(page, 'handle-panel-brand-history-events')).includes('Request approved'), 'D history shows the approval');
    check((await text(page, 'handle-panel-brand-url')).endsWith(`/brands/${h('app')}`), 'D public URL uses the new handle');

    // E1. Suspended Brand: the server refuses; dialog + context stay; request stays pending.
    check((await call(`/catalog/brands/${B3.id}/marketplace-access`, SA.token, 'PATCH', { status: 'suspended' })).status === 200, 'E setup: Brand three suspended');
    await page.goto(sellerProfile(B3.id), { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'handle-panel-brand-review');
    check((await count(page, 'handle-panel-brand-review-blocked')) === 1, 'E suspended Brand: approval-blocked warning shown');
    await page.getByTestId('handle-panel-brand').getByTestId('enter-edit-mode').click();
    await page.getByTestId('handle-panel-brand-review-approve').click();
    await waitFor(page, 'handle-panel-brand-review-dialog');
    await page.getByTestId('handle-panel-brand-review-dialog-submit').click();
    check(await waitFor(page, 'handle-panel-brand-review-dialog-error', 15000), 'E suspended: error shown inside the dialog');
    check((await text(page, 'handle-panel-brand-review-dialog-error')).includes('suspended'), 'E suspended: explains the marketplace status');
    check((await text(page, 'handle-panel-brand-review-dialog-change')).includes(h('susp')), 'E suspended: dialog keeps the request context');
    check((await requestStatus((await pendingId(B3.id))!)) === 'pending', 'E suspended: request is still pending');
    await page.getByTestId('handle-panel-brand-review-dialog-cancel').click();

    // E2. Handle taken meanwhile.
    check((await call('/public-handles/admin/assign', SA.token, 'POST', { entityType: 'creator', entityId: creatorFree, handle: h('cown'), reason: 'Probe: take the requested handle' })).status === 200, 'E setup: the owned Creator’s requested handle is taken by another profile');
    await page.goto(`${BASE}/admin/creator-review?creatorId=${creatorOwned}&tab=handle`, { waitUntil: 'domcontentloaded' });
    check(await waitFor(page, 'handle-panel-creator-review'), 'E Creator Profile: Public Handle tab opens from ?tab=handle');
    check(await page.waitForFunction(() => /not available|belongs to another/i.test(document.querySelector('[data-testid="handle-panel-creator-review-availability"]')?.textContent || ''), undefined, { timeout: 15000 }).then(() => true, () => false), 'E availability check shows the handle is taken');
    await page.getByTestId('handle-panel-creator').getByTestId('enter-edit-mode').click();
    await page.getByTestId('handle-panel-creator-review-approve').click();
    await waitFor(page, 'handle-panel-creator-review-dialog');
    await page.getByTestId('handle-panel-creator-review-dialog-submit').click();
    check((await waitFor(page, 'handle-panel-creator-review-dialog-error', 15000)) && /not available/i.test(await text(page, 'handle-panel-creator-review-dialog-error')), 'E taken: "not available" shown inside the dialog');
    check((await text(page, 'handle-panel-creator-review-dialog-change')).includes(h('cown')), 'E taken: dialog keeps the request context');

    // E3. Injected server failure (503) keeps the dialog and the typed note.
    await page.route('**/public-handles/admin/requests/*/reject', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'x', code: 'HANDLES_UNAVAILABLE' }) }),
    );
    await page.getByTestId('handle-panel-creator-review-dialog-cancel').click();
    await page.getByTestId('handle-panel-creator-review-reject').click();
    await waitFor(page, 'handle-panel-creator-review-dialog');
    await page.getByTestId('handle-panel-creator-review-dialog-note').fill('Probe: kept after failure');
    await page.getByTestId('handle-panel-creator-review-dialog-submit').click();
    check((await waitFor(page, 'handle-panel-creator-review-dialog-error', 15000)) && /temporarily unavailable/i.test(await text(page, 'handle-panel-creator-review-dialog-error')), 'E 503: friendly error inside the dialog');
    check((await page.getByTestId('handle-panel-creator-review-dialog-note').inputValue()) === 'Probe: kept after failure', 'E 503: the typed note is preserved');
    check((await requestStatus((await pendingId(creatorOwned))!)) === 'pending', 'E 503: nothing changed server-side (still pending)');
    await page.unroute('**/public-handles/admin/requests/*/reject');
    await page.getByTestId('handle-panel-creator-review-dialog-cancel').click();
    check((await text(page, 'handle-panel-creator-status')).includes('live'), 'E Creator lifecycle status shown');

    // F. Queue: oldest first, profile links, ownership transfer.
    await page.goto(`${BASE}/admin/brand-verification`, { waitUntil: 'domcontentloaded' });
    check(await waitFor(page, 'handle-queue'), 'F Super Admin: queue loads');
    const ridB2 = await pendingId(B2.id);
    const ridB3 = await pendingId(B3.id);
    await page.getByTestId(`handle-queue-review-${ridB2}`).waitFor({ timeout: 15000 });
    const order = await page.locator('[data-testid^="handle-queue-review-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    check(order.indexOf(`handle-queue-review-${ridB2}`) < order.indexOf(`handle-queue-review-${ridB3}`), 'F queue lists older requests first', order);
    const hrefB2 = await page.getByTestId(`handle-queue-open-${ridB2}`).getAttribute('href');
    check(hrefB2 === `/admin/seller-profile?sellerId=${uSeller.id}&tab=handle&brandId=${B2.id}`, 'F Brand request links to its Seller Profile handle tab', hrefB2);
    const ridC = await pendingId(creatorOwned);
    check((await page.getByTestId(`handle-queue-open-${ridC}`).getAttribute('href')) === `/admin/creator-review?creatorId=${creatorOwned}&tab=handle`, 'F Creator request links to its Creator Profile handle tab');
    await page.getByTestId(`handle-queue-open-${ridB2}`).click();
    check(await page.waitForFunction((id) => document.querySelector('[data-testid="handle-panel-brand"]')?.getAttribute('data-entity-id') === id, B2.id, { timeout: 30000 }).then(() => true, () => false), 'F the link opens the right Brand’s panel');
    // Ownership transfer, then approve from the queue.
    check((await call(`/catalog/brands/${B2.id}`, SA.token, 'PATCH', { sellerId: uSeller2.id })).status === 200, 'F setup: Brand two transferred to another seller');
    await page.goto(`${BASE}/admin/brand-verification`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId(`handle-queue-review-${ridB2}`).click();
    await waitFor(page, 'handle-queue-item');
    check((await page.getByTestId('handle-queue-item-approve').count()) === 0, 'F View Mode: the review shows no approve / reject');
    await page.getByTestId('handle-queue-review').getByTestId('enter-edit-mode').click();
    await page.getByTestId('handle-queue-item-approve').click();
    await waitFor(page, 'handle-queue-item-dialog');
    await page.getByTestId('handle-queue-item-dialog-submit').click();
    check((await waitFor(page, 'handle-queue-item-dialog-error', 15000)) && /no longer owns/i.test(await text(page, 'handle-queue-item-dialog-error')), 'F transferred Brand: "no longer owns" shown in the dialog');
    check((await requestStatus(ridB2!)) === 'superseded', 'F server closed the request as superseded');
    await page.getByTestId('handle-queue-item-dialog-cancel').click();
    check(await gone(page, `handle-queue-review-${ridB2}`, 15000), 'F the queue refreshes after the dialog closes (request gone)');

    // G. Creator without an owner: direct assign / rename / retire.
    await page.goto(`${BASE}/admin/creator-review?creatorId=${creatorFree}&tab=handle`, { waitUntil: 'domcontentloaded' });
    check(await waitFor(page, 'handle-panel-creator-no-owner'), 'G Creator without an owner account is shown as such');
    check((await text(page, 'handle-panel-creator-active')).includes(h('cown')), 'G its handle (assigned in E) is shown');
    await page.getByTestId('handle-panel-creator').getByTestId('enter-edit-mode').click();
    await page.getByTestId('handle-panel-creator-rename').click();
    await waitFor(page, 'handle-rename');
    await page.getByTestId('handle-rename-input').fill(h('gnew'));
    await page.getByTestId('handle-rename-reason').fill('Probe: rename');
    check(await page.getByTestId('handle-rename-submit').isDisabled(), 'G rename disabled until availability is checked');
    await page.getByTestId('handle-rename-check').click();
    check((await waitFor(page, 'handle-rename-availability', 10000)) && /available/i.test(await text(page, 'handle-rename-availability')), 'G availability check passes');
    check((await text(page, 'handle-rename-change')).includes(`@${h('cown')} → @${h('gnew')}`), 'G rename shows previous → new');
    await page.getByTestId('handle-rename-submit').click();
    check(await gone(page, 'handle-rename'), 'G rename applied');
    check(await page.waitForFunction((v) => document.querySelector('[data-testid="handle-panel-creator-active"]')?.textContent?.includes(v), `@${h('gnew')}`, { timeout: 15000 }).then(() => true, () => false), 'G active handle refreshes after rename');
    await page.getByTestId('handle-panel-creator-retire').click();
    await waitFor(page, 'handle-retire');
    await page.getByTestId('handle-retire-reason').fill('Probe: retire');
    check(await page.getByTestId('handle-retire-submit').isDisabled(), 'G retire disabled until the permanence is confirmed');
    await page.getByTestId('handle-retire-confirm').check();
    await page.getByTestId('handle-retire-submit').click();
    check(await gone(page, 'handle-retire'), 'G retire applied');
    check(await page.waitForFunction(() => document.querySelector('[data-testid="handle-panel-creator-active"]')?.textContent?.trim() === 'None', undefined, { timeout: 15000 }).then(() => true, () => false), 'G active handle is None after retirement');
    await page.getByTestId('handle-panel-creator-assign').click();
    await waitFor(page, 'handle-assign');
    await page.getByTestId('handle-assign-input').fill(h('gnew'));
    await page.getByTestId('handle-assign-check').click();
    check((await waitFor(page, 'handle-assign-availability', 10000)) && /never be reissued|not available/i.test(await text(page, 'handle-assign-availability')), 'G a retired handle is reported unavailable for assignment');
    check(await page.getByTestId('handle-assign-submit').isDisabled(), 'G assignment stays disabled for an unavailable handle');
    await page.getByTestId('handle-assign-input').fill(h('gfinal'));
    await page.getByTestId('handle-assign-reason').fill('ok');
    await page.getByTestId('handle-assign-check').click();
    await waitFor(page, 'handle-assign-availability', 10000);
    check(await page.getByTestId('handle-assign-submit').isDisabled(), 'G a too-short reason keeps assignment disabled');
    await page.getByTestId('handle-assign-reason').fill('Probe: assign a fresh handle');
    await page.getByTestId('handle-assign-submit').click();
    check(await gone(page, 'handle-assign'), 'G assign applied');
    check((await activeOf('creator', creatorFree)) === h('gfinal'), 'G server state: assigned handle is active');
    check(pageErrors.length === 0, 'no page errors during the Super Admin session', pageErrors);
    await ctx.close();

    // ── H. Impersonated session ──
    {
      const imp = await call('/auth/impersonate/start', SA.token, 'POST', { targetUserId: uSeller.id, reason: 'C5 handle UI probe' });
      check(imp.status === 200 && imp.body.accessToken, 'H Super Admin starts impersonating the seller', imp.body);
      const ictx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
      await seedToken(ictx, String(imp.body.accessToken));
      const ipage = await ictx.newPage();
      await ipage.goto(sellerProfile(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await ipage.waitForTimeout(4000);
      check((await count(ipage, 'handle-panel-brand-review-approve')) === 0 && (await count(ipage, 'handle-panel-brand-direct')) === 0, 'H impersonated session: no handle write controls');
      const mut = await call('/public-handles/admin/retire', String(imp.body.accessToken), 'POST', { entityType: 'brand', entityId: B1.id, reason: 'Probe: impersonated' });
      check(mut.status === 403 && mut.body.code === 'HANDLE_IMPERSONATION_NOT_ALLOWED', 'H server: impersonated mutation refused', mut.body);
      check((await activeOf('brand', B1.id)) === h('app'), 'H nothing changed');
      await ictx.close();
    }
  } finally {
    await browser.close();
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA.token, 'DELETE').catch(() => undefined);
    await q(`delete from users where id = any($1::uuid[])`, [tempUsers]).catch((e) => console.log('cleanup:', e.message));
    const left = (await q<{ n: number }>(`select count(*)::int n from users where id = any($1::uuid[])`, [tempUsers]))[0]?.n;
    check(left === 0, 'cleanup: temporary accounts deleted');
    await db.end();
  }

  console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-public-handle-admin-ui (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
