/**
 * Public Identity — owner username section in Brand Studio + Creator Studio,
 * browser probe (Facebook-style: type → live availability → Save → done).
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that
 * same database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost, with
 * migration 0013). Refuses otherwise; no override. Creates throwaway accounts,
 * Brands and Creators through the API and deletes the accounts and Brands at the
 * end (handle history is append-only and uses per-run names).
 *
 *   A  Brand owner: no username → URL falls back to the slug; live feedback
 *      (invalid / reserved / prefix / not available / available) as the user
 *      types, debounced, checked as type=brand for THIS Brand; Save only when
 *      available; network + 401 failures keep the typed username; Save sets it
 *      at once (PUT …/handle) and refreshes current username + URL; a change
 *      warns about and performs the retirement of the old one; a username taken
 *      between the check and Save is refused; no request / approval UI anywhere
 *      after a change the 30-day cooldown is shown (server date), the field is
 *      locked, it survives a reload and unlocks after 30 days
 *   B  second Brand of the same seller is independent
 *   C  Creator owner: /creators/ URL, type=creator, set + change (+ cooldown), Brands unaffected
 *   D  staff viewer: read-only
 *   E  impersonated session: no field / Save; server refuses the save
 *   F  non-owners: server refuses reads and saves
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
const waitStatus = (p: Page, status: string, timeout = 15000) =>
  p.waitForFunction((s) => document.querySelector('[data-testid="pi-status"]')?.getAttribute('data-status') === s, status, { timeout }).then(() => true, () => false);
const saveEnabled = async (p: Page) => !(await p.getByTestId('pi-save').isDisabled());

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

async function typeUsername(page: Page, value: string) {
  await page.getByTestId('pi-input').fill(value);
}

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
  const B4 = await mkBrand('race', uSeller2.id);
  const C1 = `creator-piprobe-${sfx}`;
  const C1slug = `pi-creator-${sfx}`;
  {
    const r = await call(`/catalog/creators/${C1}`, SA.token, 'PUT', { name: `PI Creator Profile ${sfx}`, slug: C1slug, status: 'live', userId: uCreator.id });
    if (r.status !== 200) throw new Error(`creator: ${JSON.stringify(r.body)}`);
  }
  check((await call('/public-handles/admin/assign', SA.token, 'POST', { entityType: 'brand', entityId: B3.id, handle: h('tk'), reason: 'Probe: setup' })).status === 200, 'setup: another seller’s Brand holds a username');

  const activeOf = async (type: string, id: string) =>
    (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;
  const statusOfHandle = async (handle: string) => (await q<{ status: string }>(`select status from public_handles where handle=$1`, [handle]))[0]?.status ?? null;
  const rowsFor = async (type: string, id: string) => (await q<{ n: number }>(`select count(*)::int n from public_handles where entity_type=$1 and entity_id=$2`, [type, id]))[0].n;
  const requestCount = async (type: string, id: string) =>
    (await q<{ n: number }>(`select count(*)::int n from public_handle_requests where entity_type=$1 and entity_id=$2`, [type, id]))[0].n;

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const pageErrors: string[] = [];
  try {
    // ── A. Brand owner ──
    const sctx = await sessionContext(browser, uSeller.email, pw);
    const page = await sctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const availabilityCalls: string[] = [];
    const saves: Array<{ url: string; method: string; body: string | null }> = [];
    page.on('request', (r) => {
      if (r.url().includes('/catalog/handles/availability')) availabilityCalls.push(r.url());
      if (r.method() !== 'GET' && r.url().includes('/public-handles/')) saves.push({ url: r.url(), method: r.method(), body: r.postData() });
    });

    check(await openBrandIdentity(page, B1.id, B1.name), 'A Brand Studio → Identity shows the PUBLIC IDENTITY section');
    check((await page.getByTestId('pi-section').getAttribute('data-entity-id')) === B1.id, 'A the section belongs to this Brand (entity id)');
    check(await waitText(page, 'pi-current', 'No username yet'), 'A no username yet');
    check(((await page.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/brands/${B1.slug}`), 'A URL falls back to the slug');
    check((await page.getByTestId('pi-input').inputValue()) === '' && !(await saveEnabled(page)), 'A empty field, Save disabled');
    const sectionText = await text(page, 'pi-section');
    check(!/approv|pending|request|review/i.test(sectionText), 'A no request / approval / review wording', sectionText);

    let before = availabilityCalls.length;
    await typeUsername(page, 'ab');
    check(await waitStatus(page, 'invalid', 5000), 'A too short → "Invalid username" instantly');
    await page.waitForTimeout(700);
    check(availabilityCalls.length === before && !(await saveEnabled(page)), 'A invalid input is never sent; Save disabled');
    await typeUsername(page, 'My Shop!');
    check((await waitStatus(page, 'invalid', 5000)) && /spaces or symbols/i.test(await text(page, 'pi-status')), 'A spaces / symbols explained', await text(page, 'pi-status'));
    await typeUsername(page, 'brand-shop');
    check(await waitStatus(page, 'reserved', 5000), 'A reserved prefix → "Reserved"');
    await typeUsername(page, 'admin');
    check((await waitStatus(page, 'reserved', 5000)) && /reserved/i.test(await text(page, 'pi-status')), 'A reserved name → "Reserved"');
    await typeUsername(page, h('tk'));
    check(await waitStatus(page, 'unavailable'), 'A another profile’s username → "Not available"');
    check(/Not available/.test(await text(page, 'pi-status')) && !/seller|PI OTHER|brand-/i.test(await text(page, 'pi-status')), 'A reveals nothing about the holder', await text(page, 'pi-status'));
    // Debounce: fast typing sends one check for the final value.
    before = availabilityCalls.length;
    await page.getByTestId('pi-input').fill('');
    await page.getByTestId('pi-input').pressSequentially(h('b1'), { delay: 25 });
    check(await waitStatus(page, 'available'), 'A free username → "Available" as the user types');
    check(availabilityCalls.length - before <= 2, 'A availability checks are debounced while typing', availabilityCalls.length - before);
    const lastAvail = new URL(availabilityCalls[availabilityCalls.length - 1] || 'http://x/');
    check(lastAvail.searchParams.get('type') === 'brand' && lastAvail.searchParams.get('entityId') === B1.id && lastAvail.searchParams.get('handle') === h('b1'), 'A checked as type=brand for this Brand', lastAvail.search);
    check(await saveEnabled(page), 'A Save enabled only when available');
    check((await count(page, 'pi-retire-note')) === 0, 'A no retirement warning for a first username');

    // failures keep the typed username
    await page.route('**/api/v1/public-handles/*/*/handle', (route) => route.abort('failed'));
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-error', 'connection'), 'A network failure → connection message', await text(page, 'pi-error'));
    check((await page.getByTestId('pi-input').inputValue()) === h('b1'), 'A network failure keeps the typed username');
    await page.unroute('**/api/v1/public-handles/*/*/handle');
    await page.route('**/api/v1/public-handles/*/*/handle', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false,"error":"Unauthorized"}' }));
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-error', 'session'), 'A 401 → session expired message', await text(page, 'pi-error'));
    check((await page.getByTestId('pi-input').inputValue()) === h('b1'), 'A 401 keeps the typed username');
    await page.unroute('**/api/v1/public-handles/*/*/handle');
    await page.unroute('**/api/v1/auth/refresh');
    check((await rowsFor('brand', B1.id)) === 0, 'A failed saves wrote nothing');

    // Save → done
    const savesBefore = saves.length;
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-current', `@${h('b1')}`), 'A Save sets the username at once', await text(page, 'pi-current'));
    const sent = saves.slice(savesBefore).find((s) => s.url.includes('/handle'));
    check(sent?.method === 'PUT' && sent.url.endsWith(`/public-handles/brand/${encodeURIComponent(B1.id)}/handle`) && JSON.parse(sent.body || '{}').handle === h('b1'), 'A PUT { handle } to /public-handles/brand/<this Brand>/handle', sent);
    check(await waitText(page, 'pi-notice', `Saved. Your username is now @${h('b1')}`), 'A clear success message', await text(page, 'pi-notice'));
    check(((await page.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/brands/${h('b1')}`), 'A public URL updated');
    check((await activeOf('brand', B1.id)) === h('b1') && (await requestCount('brand', B1.id)) === 0, 'A active in the database, no request created');
    check((await waitStatus(page, 'current', 5000)) && !(await saveEnabled(page)), 'A field now shows the current username; Save disabled');

    // Change → old retired
    await typeUsername(page, h('b1new'));
    check(await waitStatus(page, 'available'), 'A new username available');
    check(await waitText(page, 'pi-retire-note', `@${h('b1')}`), 'A warns that the current username will be retired', await text(page, 'pi-retire-note'));
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-current', `@${h('b1new')}`), 'A change applied at once');
    check(await waitText(page, 'pi-notice', `@${h('b1')} has been retired`), 'A success message names the retired username', await text(page, 'pi-notice'));
    check(((await page.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/brands/${h('b1new')}`), 'A URL updated after the change');
    check((await activeOf('brand', B1.id)) === h('b1new') && (await statusOfHandle(h('b1'))) === 'retired' && (await requestCount('brand', B1.id)) === 0, 'A database: new active, old retired, no request');
    // 30-day cooldown after a change: shown with the server's next allowed time, field locked.
    const serverUntil = (await call(`/public-handles/brand/${B1.id}`, SA.token)).body.data?.ownerChangeAvailableAt;
    check(await waitFor(page, 'pi-cooldown', 10000), 'A after a change the 30-day cooldown is shown');
    check((await page.getByTestId('pi-cooldown').getAttribute('data-until')) === serverUntil && /30 days/.test(await text(page, 'pi-cooldown')) && /\d{4}/.test(await text(page, 'pi-cooldown')), 'A it shows the server’s next allowed date / time', { ui: await page.getByTestId('pi-cooldown').getAttribute('data-until'), serverUntil });
    check((await page.getByTestId('pi-input').isDisabled()) && !(await saveEnabled(page)), 'A field and Save are locked during the cooldown');
    check(await openBrandIdentity(page, B1.id, B1.name), 'A reopen during the cooldown');
    check((await waitFor(page, 'pi-cooldown', 10000)) && (await page.getByTestId('pi-input').isDisabled()), 'A the cooldown survives a reload');
    // Test-only: move the owner change 30 days + 1 s into the past (disposable database).
    await q(`update public_handle_events set created_at = clock_timestamp() - interval '720 hours 1 second' where entity_type='brand' and entity_id=$1 and action='renamed' and request_id is null and reason='Set by the owner'`, [B1.id]);
    check(await openBrandIdentity(page, B1.id, B1.name), 'A reopen after 30 days');
    check((await waitText(page, 'pi-current', `@${h('b1new')}`)) && (await count(page, 'pi-cooldown')) === 0 && !(await page.getByTestId('pi-input').isDisabled()), 'A after 30 days the field is unlocked');
    await typeUsername(page, h('b1'));
    check(await waitStatus(page, 'unavailable'), 'A the retired username shows "Not available"');

    // Taken between the check and Save
    await typeUsername(page, h('race'));
    check(await waitStatus(page, 'available'), 'A race username available');
    check((await call(`/public-handles/brand/${B4.id}/handle`, SELLER2.token, 'PUT', { handle: h('race') })).status === 200, 'A setup: another seller saves it first');
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-error', 'just taken'), 'A taken-at-save refused with a clear message', await text(page, 'pi-error'));
    check((await page.getByTestId('pi-input').inputValue()) === h('race') && (await waitStatus(page, 'unavailable', 5000)) && !(await saveEnabled(page)), 'A input kept, marked "Not available", Save disabled');
    check((await text(page, 'pi-current')) === `@${h('b1new')}` && (await activeOf('brand', B1.id)) === h('b1new'), 'A current username unchanged');
    // Blur triggers the check without waiting for the debounce.
    await typeUsername(page, h('blur'));
    await page.getByTestId('pi-input').blur();
    check(await waitStatus(page, 'available', 5000), 'A leaving the field checks availability');
    check((await count(page, 'pi-pending')) + (await count(page, 'pi-cancel')) + (await count(page, 'pi-rejected')) + (await count(page, 'pi-submit')) === 0, 'A no pending / cancel / rejection / request controls exist');
    check(await openBrandIdentity(page, B1.id, B1.name), 'A reopen Brand Studio');
    check(await waitText(page, 'pi-current', `@${h('b1new')}`), 'A username persists after reload');

    // ── B. second Brand is independent ──
    check(await openBrandIdentity(page, B2.id, B2.name), 'B second Brand opens its own section');
    check((await page.getByTestId('pi-section').getAttribute('data-entity-id')) === B2.id, 'B section bound to the second Brand');
    check(await waitText(page, 'pi-current', 'No username yet'), 'B second Brand has no username (not Brand one’s)');
    check(((await page.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/brands/${B2.slug}`), 'B URL is the second Brand’s slug');
    await typeUsername(page, h('b2'));
    check(await waitStatus(page, 'available'), 'B username available');
    await page.getByTestId('pi-save').click();
    check(await waitText(page, 'pi-current', `@${h('b2')}`), 'B saved for the second Brand');
    check((await activeOf('brand', B2.id)) === h('b2') && (await activeOf('brand', B1.id)) === h('b1new'), 'B Brand one untouched');
    await sctx.close();

    // ── C. Creator owner ──
    const cctx = await sessionContext(browser, uCreator.email, pw);
    const cpage = await cctx.newPage();
    cpage.on('pageerror', (e) => pageErrors.push(String(e)));
    const cAvail: string[] = [];
    const cSaves: string[] = [];
    cpage.on('request', (r) => {
      if (r.url().includes('/catalog/handles/availability')) cAvail.push(r.url());
      if (r.method() === 'PUT' && r.url().includes('/public-handles/')) cSaves.push(r.url());
    });
    check(await openCreatorIdentity(cpage, C1), 'C Creator Studio → Identity shows the PUBLIC IDENTITY section');
    check((await cpage.getByTestId('pi-section').getAttribute('data-entity-type')) === 'creator', 'C section is for the Creator entity');
    check(await waitText(cpage, 'pi-current', 'No username yet'), 'C no username yet');
    check(((await cpage.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/creators/${C1slug}`), 'C canonical /creators/ URL');
    await typeUsername(cpage, h('tk'));
    check(await waitStatus(cpage, 'unavailable'), 'C a Brand’s username is "Not available" to a Creator (one namespace)');
    await typeUsername(cpage, h('cr1'));
    check(await waitStatus(cpage, 'available'), 'C free username available');
    const cu = new URL(cAvail[cAvail.length - 1] || 'http://x/');
    check(cu.searchParams.get('type') === 'creator' && cu.searchParams.get('entityId') === C1, 'C checked as type=creator for this Creator', cu.search);
    const brandsBefore = JSON.stringify([await activeOf('brand', B1.id), await activeOf('brand', B2.id)]);
    await cpage.getByTestId('pi-save').click();
    check(await waitText(cpage, 'pi-current', `@${h('cr1')}`), 'C saved at once');
    check(cSaves.some((u) => u.endsWith(`/public-handles/creator/${C1}/handle`)), 'C PUT /public-handles/creator/<id>/handle');
    check(((await cpage.getByTestId('pi-url').getAttribute('href')) || '').endsWith(`/creators/${h('cr1')}`), 'C URL uses the username');
    await typeUsername(cpage, h('cr2'));
    check(await waitStatus(cpage, 'available'), 'C new username available');
    await cpage.getByTestId('pi-save').click();
    check(await waitText(cpage, 'pi-current', `@${h('cr2')}`), 'C change applied at once');
    check((await activeOf('creator', C1)) === h('cr2') && (await statusOfHandle(h('cr1'))) === 'retired' && (await requestCount('creator', C1)) === 0, 'C old retired, no request');
    check((await waitFor(cpage, 'pi-cooldown', 10000)) && (await cpage.getByTestId('pi-input').isDisabled()), 'C the Creator change starts the same 30-day cooldown');
    const cBlocked = await call(`/public-handles/creator/${C1}/handle`, CREATOR.token, 'PUT', { handle: h('cr3') });
    check(cBlocked.status === 409 && cBlocked.body.code === 'HANDLE_CHANGE_COOLDOWN', 'C the server enforces it (not only the UI)', cBlocked.body);
    const cEvents = await q<{ action: string; actor_user_id: string }>(`select action, actor_user_id from public_handle_events where entity_type='creator' and entity_id=$1 order by created_at`, [C1]);
    check(cEvents.map((e) => e.action).join() === 'assigned,renamed' && cEvents.every((e) => e.actor_user_id === uCreator.id), 'C audit: assigned then renamed, by the Creator owner', cEvents);
    check(JSON.stringify([await activeOf('brand', B1.id), await activeOf('brand', B2.id)]) === brandsBefore, 'C Creator changes did not affect any Brand');
    await cctx.close();

    // ── D. staff viewer: read-only ──
    const actx = await sessionContext(browser, uAdmin.email, pw);
    const apage = await actx.newPage();
    apage.on('pageerror', (e) => pageErrors.push(String(e)));
    const aWrites: string[] = [];
    apage.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/public-handles/')) aWrites.push(r.url());
    });
    check(await openBrandIdentity(apage, B1.id, B1.name), 'D Admin opens the Brand’s identity');
    check(await waitFor(apage, 'pi-readonly'), 'D read-only notice for staff');
    check(await waitText(apage, 'pi-current', `@${h('b1new')}`), 'D staff see the current username');
    check((await count(apage, 'pi-input')) === 0 && (await count(apage, 'pi-save')) === 0, 'D no field / Save for staff');
    check(aWrites.length === 0, 'D no handle write sent');
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
    check((await count(ipage, 'pi-input')) === 0 && (await count(ipage, 'pi-save')) === 0, 'E no field / Save while impersonating');
    const impSave = await call(`/public-handles/brand/${B2.id}/handle`, String(imp.body.accessToken), 'PUT', { handle: h('imp') });
    check(impSave.status === 403 && impSave.body.code === 'HANDLE_IMPERSONATION_NOT_ALLOWED', 'E server refuses an impersonated save', impSave.body);
    check((await activeOf('brand', B2.id)) === h('b2'), 'E nothing changed');
    await call('/auth/impersonate/exit', String(imp.body.accessToken), 'POST', {}).catch(() => undefined);
    await ictx.close();

    // ── F. non-owners ──
    const f1 = await call(`/public-handles/brand/${B1.id}`, SELLER2.token);
    check(f1.status === 403 && f1.body.code === 'HANDLE_FORBIDDEN', 'F another seller cannot read this Brand’s username state', f1.body);
    check((await call(`/public-handles/brand/${B1.id}/handle`, SELLER2.token, 'PUT', { handle: h('steal') })).status === 403, 'F another seller cannot change it');
    check((await call(`/public-handles/brand/${B1.id}/handle`, CREATOR.token, 'PUT', { handle: h('steal2') })).status === 403, 'F a Creator owner cannot change a Brand’s username');
    check((await activeOf('brand', B1.id)) === h('b1new'), 'F unchanged');

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
