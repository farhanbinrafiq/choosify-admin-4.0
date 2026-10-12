/**
 * Seller workflow repairs — Brand create from Brand Studio + CMS-mirror deep-link
 * navigation, driven in a real browser.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that same
 * database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost). Refuses
 * otherwise. Uses a throwaway seller account (deleted at the end); its "PSB …"
 * brands / product / guide stay in the disposable catalog.
 *
 *   S1 "+ Create Brand" (CMS-mirror home, 0 brands) opens /admin/brand-studio/new
 *   S2 an empty brand name is rejected clearly; nothing is created
 *   S3 a named first save creates the brand with the seller as owner, persists the
 *      section's data, and continues on /admin/brand-studio/:id/edit
 *   S4 Marketplace Access rules are unchanged (new seller brand not granted → locked)
 *   S5 editing an existing brand still saves and persists
 *   S6 /new does not reuse the previously opened brand; it creates a separate brand
 *   S7 a failed section save after create leaves /new for the created brand (no duplicate on retry)
 *   S8 "Open Brand Studio" in the CMS-mirror brand list opens that brand
 *   S9 the host follows the mirror's product / guide deep links; top-level nav still works
 *   S10 React Product and Guide list actions open their Studios
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-seller-brand-create-browser.ts
 */
import argon2 from 'argon2';
import pg from 'pg';
import { chromium, type Frame, type Page } from 'playwright-core';
import { createBlankProductModel, editorModelToCreatePatch } from '../src/pages/admin/productEditorModel';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const IMG = 'https://example.invalid/psb-product.jpg';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 400));
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
  return String(r.body.accessToken);
}

async function main() {
  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname) || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: database or server is not local.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
  if (!(await q(`select id from users where email='admin@choosify.com.bd'`))[0]) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const sfx = Date.now().toString(36);
  const pw = `PsbSeller!${sfx}`;
  const email = `psb.seller.${sfx}@probe.local`;
  const [seller] = await q<{ id: string }>(
    `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,'seller',true) returning id`,
    [email, await argon2.hash(pw), `PSB Seller ${sfx}`],
  );
  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const OWN = await apiLogin(email, pw);
  const myBrands = async () =>
    ((await call('/catalog/brands', SA)).body.data as any[]).filter((b) => b.sellerId === seller.id);
  const brandById = async (id: string) => (await myBrands()).find((b) => b.id === id);
  const N1 = `PSB Brand One ${sfx}`;
  const N2 = `PSB Brand Two ${sfx}`;
  const N3 = `PSB Brand Three ${sfx}`;
  const created: string[] = [];

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((t) => {
    try {
      if (!sessionStorage.getItem('psb')) {
        localStorage.setItem('choosify_auth_token', t as string);
        sessionStorage.setItem('psb', '1');
      }
    } catch {}
  }, OWN);
  const page = await ctx.newPage();
  const brandPosts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/catalog/brands') brandPosts.push(r.url());
  });
  const path = () => new URL(page.url()).pathname;
  const studioId = () => /^\/admin\/brand-studio\/([^/]+)\/edit$/.exec(path())?.[1] || '';
  const mirror = async (): Promise<Frame> => {
    for (let i = 0; i < 40; i += 1) {
      const f = page.frames().find((x) => x.url().includes('/cms-mirror/'));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    throw new Error('CMS mirror frame not found');
  };
  const toast = (re: RegExp) => page.getByText(re).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const openIdentity = async () => {
    await page.getByRole('button', { name: 'Edit Brand Identity' }).click({ timeout: 30000 });
    await page.getByPlaceholder('e.g. Walton').waitFor({ timeout: 10000 });
  };
  const gotoStudio = async (p: Page, id: string, ready: string) => {
    await p.goto(`${BASE}/admin/brand-studio/${id}/edit`, { waitUntil: 'domcontentloaded' });
    await p.getByText(ready).first().waitFor({ timeout: 45000 });
    await p.waitForTimeout(800);
  };

  try {
    // S1
    await page.goto(`${BASE}/admin/brand-studio`, { waitUntil: 'domcontentloaded' });
    const home = await mirror();
    await home.getByRole('button', { name: /Create Brand/ }).first().click({ timeout: 30000 });
    await page.waitForURL((u) => u.pathname === '/admin/brand-studio/new', { timeout: 15000 }).catch(() => undefined);
    check(path() === '/admin/brand-studio/new', 'S1 "+ Create Brand" in the mirror home opens /admin/brand-studio/new', path());

    // S2
    await openIdentity();
    check((await page.getByPlaceholder('e.g. Walton').inputValue()) === '', 'S2 /new starts with an empty brand name');
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    const s2toast = await toast(/Add your brand name in Brand Identity first/);
    await page.waitForTimeout(800);
    check(s2toast && path() === '/admin/brand-studio/new' && brandPosts.length === 0 && (await myBrands()).length === 0,
      'S2 empty name: clear message, stays on /new, no create request, no brand', { s2toast, path: path(), posts: brandPosts.length });

    // S3
    await page.getByPlaceholder('e.g. Walton').fill(N1);
    await page.getByPlaceholder('e.g. Made in Bangladesh, Trusted Nationwide').fill(`Tagline one ${sfx}`);
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    await page.waitForURL((u) => /^\/admin\/brand-studio\/[^/]+\/edit$/.test(u.pathname), { timeout: 20000 }).catch(() => undefined);
    const A = studioId();
    if (A) created.push(A);
    const a = A ? await brandById(A) : undefined;
    check(!!A && brandPosts.length === 1, 'S3 first save creates exactly one brand and continues on /admin/brand-studio/:id/edit', { path: path(), posts: brandPosts.length });
    check(a?.name === N1 && a?.sellerId === seller.id, 'S3 created brand has the entered name and the seller as owner', { name: a?.name, sellerId: a?.sellerId });
    check(a?.tagline === `Tagline one ${sfx}`, 'S3 the first section save persisted its data (tagline)', a?.tagline);

    // S4
    check(a?.marketplaceStatus === 'not_granted' && a?.marketplaceAccess === false, 'S4 new seller brand starts without Marketplace Access', { s: a?.marketplaceStatus, a: a?.marketplaceAccess });
    await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    check(/Marketplace Access Pending/i.test(await page.locator('#root').innerText()), 'S4 seller is locked out of Products until access is granted (rule unchanged)');
    const lockedPost = await call('/catalog/brands', OWN, 'POST', { name: `PSB locked ${sfx}`, category: 'General' });
    check(lockedPost.status === 403, 'S4 server still refuses a locked seller creating another brand (403)', lockedPost.status);
    const grant = await call(`/catalog/brands/${A}/marketplace-access`, SA, 'PATCH', { status: 'granted' });
    check(grant.status === 200, 'S4 Super Admin grants access to the first brand', grant.status);

    // S5
    await gotoStudio(page, A, N1);
    await openIdentity();
    await page.getByPlaceholder('e.g. Made in Bangladesh, Trusted Nationwide').fill(`Tagline two ${sfx}`);
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    const s5toast = await toast(/Section saved/);
    check(s5toast && (await brandById(A))?.tagline === `Tagline two ${sfx}`, 'S5 editing an existing brand saves and persists', (await brandById(A))?.tagline);

    // S6 — A was just opened (active brand); /new must not reuse it
    await page.goto(`${BASE}/admin/brand-studio/new`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Edit Brand Identity' }).waitFor({ timeout: 45000 });
    await page.waitForTimeout(1000);
    const newText = await page.locator('#root').innerText();
    check(!newText.includes(N1) && /Untitled Brand/.test(newText), 'S6 /new shows a blank brand, not the previously opened one');
    await openIdentity();
    check((await page.getByPlaceholder('e.g. Walton').inputValue()) === '', 'S6 /new name field is empty');
    await page.getByPlaceholder('e.g. Walton').fill(N2);
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    await page.waitForURL((u) => /^\/admin\/brand-studio\/[^/]+\/edit$/.test(u.pathname), { timeout: 20000 }).catch(() => undefined);
    const B = studioId();
    if (B && B !== A) created.push(B);
    const aAfter = await brandById(A);
    check(!!B && B !== A && (await brandById(B))?.name === N2 && (await brandById(B))?.sellerId === seller.id,
      'S6 /new creates a separate brand owned by the seller', { A, B });
    check(aAfter?.name === N1 && aAfter?.tagline === `Tagline two ${sfx}`, 'S6 the previously opened brand is unchanged', { name: aAfter?.name, tagline: aAfter?.tagline });

    // S7 — section save fails right after create
    await page.goto(`${BASE}/admin/brand-studio/new`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Edit Brand Identity' }).waitFor({ timeout: 45000 });
    await page.route('**/api/v1/catalog/brands/*', (r) =>
      r.request().method() === 'PATCH' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"PSB simulated failure"}' }) : r.continue(),
    );
    const before7 = (await myBrands()).length;
    await openIdentity();
    await page.getByPlaceholder('e.g. Walton').fill(N3);
    await page.getByRole('button', { name: 'Save Changes' }).first().click();
    await page.waitForURL((u) => /^\/admin\/brand-studio\/[^/]+\/edit$/.test(u.pathname), { timeout: 20000 }).catch(() => undefined);
    const s7toast = await toast(/Brand created, but this section did not save/);
    await page.unroute('**/api/v1/catalog/brands/*');
    const C = studioId();
    if (C) created.push(C);
    check(!!C && s7toast && (await myBrands()).length === before7 + 1 && (await brandById(C))?.name === N3,
      'S7 failed section save after create: one brand, clear message, Studio moved to the created brand (retry cannot duplicate)', { C, s7toast, count: (await myBrands()).length - before7 });

    // S8 — 3 owned brands → mirror management list
    await page.goto(`${BASE}/admin/brand-studio`, { waitUntil: 'domcontentloaded' });
    const list = await mirror();
    const row = list.locator('tr, sc-raw-tr').filter({ hasText: N2 }).first();
    await row.waitFor({ timeout: 30000 });
    await row.getByRole('button', { name: 'Open Brand Studio' }).click();
    await page.waitForURL((u) => u.pathname === `/admin/brand-studio/${B}/edit`, { timeout: 15000 }).catch(() => undefined);
    check(path() === `/admin/brand-studio/${B}/edit`, 'S8 "Open Brand Studio" on a mirror list row opens that brand', path());

    // S9 — the mirror's own deep-link messages, sent from inside the iframe
    const cats = ((await call('/catalog/categories', null)).body.data ?? []) as Array<{ id: string }>;
    let cat = '';
    for (const c of cats) {
      const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
      if (!((s.attributes ?? []) as Array<{ required?: boolean }>).some((x) => x.required)) {
        cat = c.id;
        break;
      }
    }
    const product = (await call('/catalog/products', OWN, 'POST', editorModelToCreatePatch({
      ...createBlankProductModel('new'), title: `PSB Product ${sfx}`, brandId: A, brandName: N1, categoryId: cat,
      image: IMG, gallery: [IMG], price: 100, stock: 3,
    }))).body.data;
    const guide = (await call('/catalog/guides', OWN, 'POST', { title: `PSB Guide ${sfx}` })).body.data;
    check(!!product?.id && !!guide?.id, 'S9 setup: product and guide created for the seller', { p: product?.id, g: guide?.id });
    const viaMirror = async (target: string) => {
      await page.goto(`${BASE}/admin/brand-studio`, { waitUntil: 'domcontentloaded' });
      const f = await mirror();
      await f.waitForLoadState('domcontentloaded');
      await f.evaluate((p) => window.parent.postMessage({ type: 'cms-mirror-navigate', path: p }, '*'), target);
      await page.waitForURL((u) => u.pathname === target, { timeout: 15000 }).catch(() => undefined);
      return path();
    };
    for (const target of [`/admin/products/${product.id}/edit`, '/admin/products/new', `/admin/guides/${guide.id}/edit`, '/admin/guides/new', `/admin/brand-studio/${A}/edit`]) {
      const got = await viaMirror(target);
      check(got === target, `S9 mirror deep link ${target} is followed (not shortened to the list)`, got);
    }
    const top = await viaMirror('/admin/guides');
    check(top === '/admin/guides', 'S9 top-level nav path from the mirror still navigates', top);

    // S10 — React list actions
    const listReqs: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/v1/catalog/products') listReqs.push(u.search || '(no params)'); });
    await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
    // A seller with several brands sees one brand at a time; pick the product's brand.
    await page.locator('select').filter({ has: page.locator(`option[value="${A}"]`) }).first().selectOption(A, { timeout: 30000 });
    await page.getByPlaceholder('Search products, brands, SKU').fill(sfx, { timeout: 30000 });
    const listed = await page.getByText(`PSB Product ${sfx}`).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    if (!listed) {
      const table = (await page.locator('table').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
      const mine = ((await call('/catalog/products?limit=500', OWN)).body.data ?? []) as any[];
      console.log('NOTE S10 list text:', table);
      console.log('NOTE S10 list requests:', JSON.stringify(listReqs), 'activeBrand(localStorage):', await page.evaluate(() => localStorage.getItem('choosify_active_brand_id')), 'A/B/C:', JSON.stringify(created));
      console.log('NOTE S10 seller API products:', JSON.stringify(mine.filter((x) => String(x.title || x.name).includes(sfx)).map((x) => ({ id: x.id, status: x.status, brandId: x.brandId }))));
    }
    await page.getByRole('link', { name: `PSB Product ${sfx}`, exact: true }).first().click();
    await page.waitForURL((u) => u.pathname === `/admin/products/${product.id}/edit`, { timeout: 15000 }).catch(() => undefined);
    check(path() === `/admin/products/${product.id}/edit`, 'S10 Products list item opens that product (seller → edit)', path());
    await page.goto(`${BASE}/admin/guides`, { waitUntil: 'domcontentloaded' });
    await page.getByText(`PSB Guide ${sfx}`).first().click({ timeout: 30000 });
    await page.waitForURL((u) => u.pathname === `/admin/guides/${guide.id}/edit`, { timeout: 15000 }).catch(() => undefined);
    check(path() === `/admin/guides/${guide.id}/edit`, 'S10 Guide list item opens that guide', path());
  } catch (e) {
    check(false, 'probe step threw', e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    await browser.close();
    for (const id of created) await call(`/catalog/brands/${id}`, SA, 'DELETE').catch(() => undefined);
    await q(`delete from users where id=$1`, [seller.id]).then(() => console.log('PASS cleanup: temporary seller and its brands removed')).catch((e) => console.log('NOTE cleanup:', e.message));
    await db.end();
  }

  console.log(`\n${FAIL.length ? 'FAIL' : 'PASS'} probe-seller-brand-create-browser (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) {
    for (const f of FAIL) console.log('  -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
