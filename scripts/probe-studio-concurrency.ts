/**
 * Phase C — Studio data integrity: stale-tab protection + section-scoped saves.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) against a DISPOSABLE local database, also given in
 * PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost). Refuses otherwise.
 * Creates "PC …" records in the disposable catalog and one throwaway seller (deleted).
 *
 *  API (each Studio endpoint: product, product detail, brand, creator, guide)
 *   A1 a save carrying the loaded version succeeds and returns a new version
 *   A2 a second save carrying the OLD version is refused 409 STALE_WRITE and the
 *      first save's data is intact
 *   A3 a section-scoped save (only the changed field) keeps every other field
 *   A4 a request without the version header behaves as before (backward compatible)
 *   A5 authorization still wins: a non-owner with a stale header gets 403, not 409
 *   A6 product PATCH also refuses when only its detail record changed (no half-save)
 *  Browser (two tabs per Studio: Product, Guide, Brand, Creator)
 *   B1 also: the stale save is ONE write request (Product: the combined studio-save), no automatic retry
 *   B1 tab A saves first; tab B's stale save shows the conflict notice
 *   B2 tab B's typed edits are still in its editor (not cleared)
 *   B3 tab A's saved value is intact on the server (not reverted)
 *   B4 "Discard my changes and load the latest" shows tab A's value
 *   B5 after reloading, tab B can save normally (non-conflicting save)
 *   B6 Guide: a stale layout change is refused and the previous layout restored
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-studio-concurrency.ts
 */
import argon2 from 'argon2';
import pg from 'pg';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const IMG = 'https://example.invalid/pc.jpg';
const V = 'X-Expected-Updated-At';
const VD = 'X-Expected-Detail-Updated-At';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 400));
}
type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const data = (r: Res, what: string) => {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return (r.body.data ?? r.body) as any;
};
async function apiLogin(email: string, password: string) {
  const r = await call('/auth/login', null, 'POST', { email, password });
  if (!r.body.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return String(r.body.accessToken);
}

/** Mark the first editable text field of the open inline editor as [data-pc-field]. */
async function tagField(p: Page): Promise<boolean> {
  return p.evaluate(() => {
    const save = Array.from(document.querySelectorAll('button')).find((b) => /^Save Changes$/.test((b.textContent || '').trim()) && (b as HTMLElement).offsetParent);
    if (!save) return false;
    document.querySelectorAll('[data-pc-field]').forEach((n) => n.removeAttribute('data-pc-field'));
    let el: Element | null = save;
    while ((el = el.parentElement)) {
      const f = Array.from(el.querySelectorAll('input, textarea')).find((x) => {
        const i = x as HTMLInputElement;
        return (i.tagName === 'TEXTAREA' || ['text', 'url', 'email', 'search', 'tel'].includes(i.type)) && !i.disabled && !i.readOnly && i.offsetParent;
      });
      if (f) {
        f.setAttribute('data-pc-field', '1');
        return true;
      }
    }
    return false;
  });
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
  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const pw = `PcOther!${sfx}`;
  const [other] = await q<{ id: string }>(
    `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,'seller',true) returning id`,
    [`pc.other.${sfx}@probe.local`, await argon2.hash(pw), `PC Other ${sfx}`],
  );
  const OTHER = await apiLogin(`pc.other.${sfx}@probe.local`, pw);
  const brandIds: string[] = [];
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  try {
    // ── fixtures ──
    const brand = data(await call('/catalog/brands', SA, 'POST', { name: `PC Brand ${sfx}`, category: 'General', tagline: 'base tagline', website: 'https://base.example' }), 'brand');
    brandIds.push(brand.id);
    const cats = data(await call('/catalog/categories', null), 'categories') as Array<{ id: string }>;
    let cat = '';
    for (const c of cats) {
      const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
      if (!((s.attributes ?? []) as Array<{ required?: boolean }>).some((a) => a.required)) {
        cat = c.id;
        break;
      }
    }
    const product = data(await call('/catalog/products', SA, 'POST', { title: `PC Product ${sfx}`, brandId: brand.id, brandName: brand.name, categoryId: cat, image: IMG, gallery: [IMG], price: 100, stock: 5, description: 'base description' }), 'product');
    data(await call(`/catalog/product-details/${product.id}`, SA, 'PUT', { about: 'base about', pros: ['base pro'] }), 'detail');
    const creatorId = `creator-pc-${sfx}`;
    data(await call(`/catalog/creators/${creatorId}`, SA, 'PUT', { id: creatorId, slug: creatorId, name: `PC Creator ${sfx}`, bio: 'base bio', location: 'base location' }), 'creator');
    const guide = data(await call('/catalog/guides', SA, 'POST', { title: `PC Guide ${sfx}`, excerpt: 'base excerpt', body: 'base body' }), 'guide');

    // ════════ API ════════
    console.log('\n── API ──');
    type Ep = { name: string; get: () => Promise<any>; path: string; method: 'PATCH' | 'PUT'; a: Record<string, unknown>; b: Record<string, unknown>; aKey: string; bKey: string };
    const listOne = async (list: string, id: string) => (data(await call(list, SA), list) as any[]).find((x) => x.id === id);
    const eps: Ep[] = [
      { name: 'product', get: async () => data(await call(`/catalog/products/${product.id}`, SA), 'p'), path: `/catalog/products/${product.id}`, method: 'PATCH', a: { title: `PC Product A ${sfx}` }, b: { description: 'tab B description' }, aKey: 'title', bKey: 'description' },
      { name: 'product detail', get: async () => data(await call(`/catalog/product-details/${product.id}`, SA), 'd'), path: `/catalog/product-details/${product.id}`, method: 'PUT', a: { about: 'tab A about' }, b: { pros: ['tab B pro'] }, aKey: 'about', bKey: 'pros' },
      { name: 'brand', get: () => listOne('/catalog/brands', brand.id), path: `/catalog/brands/${brand.id}`, method: 'PATCH', a: { tagline: 'tab A tagline' }, b: { website: 'https://tab-b.example' }, aKey: 'tagline', bKey: 'website' },
      { name: 'creator', get: () => listOne('/catalog/creators', creatorId), path: `/catalog/creators/${creatorId}`, method: 'PATCH', a: { bio: 'tab A bio' }, b: { location: 'tab B location' }, aKey: 'bio', bKey: 'location' },
      { name: 'guide', get: async () => data(await call(`/catalog/guides/${guide.id}`, SA), 'g'), path: `/catalog/guides/${guide.id}`, method: 'PATCH', a: { excerpt: 'tab A excerpt' }, b: { body: 'tab B body' }, aKey: 'excerpt', bKey: 'body' },
    ];
    for (const ep of eps) {
      const v0 = (await ep.get()).updatedAt as string;
      const before = await ep.get();
      const a = await call(ep.path, SA, ep.method, ep.a, { [V]: v0 });
      const v1 = a.body?.data?.updatedAt;
      check(a.status === 200 && v1 && v1 !== v0, `A1 ${ep.name}: save with the loaded version succeeds and returns a new version`, { status: a.status, v0, v1 });
      const b = await call(ep.path, SA, ep.method, ep.b, { [V]: v0 });
      const afterB = await ep.get();
      check(b.status === 409 && b.body?.code === 'STALE_WRITE', `A2 ${ep.name}: stale save (old version) → 409 STALE_WRITE`, b);
      check(JSON.stringify(afterB[ep.aKey]) === JSON.stringify(ep.a[ep.aKey]) && JSON.stringify(afterB[ep.bKey]) === JSON.stringify(before[ep.bKey]),
        `A2 ${ep.name}: the first save is intact and the stale save wrote nothing`, { a: afterB[ep.aKey], b: afterB[ep.bKey] });
      const c = await call(ep.path, SA, ep.method, ep.b, { [V]: v1 });
      const afterC = await ep.get();
      check(c.status === 200 && JSON.stringify(afterC[ep.bKey]) === JSON.stringify(ep.b[ep.bKey]) && JSON.stringify(afterC[ep.aKey]) === JSON.stringify(ep.a[ep.aKey]),
        `A3 ${ep.name}: section-scoped save with the current version keeps the other field`, { status: c.status, a: afterC[ep.aKey], b: afterC[ep.bKey] });
      const d = await call(ep.path, SA, ep.method, ep.a);
      check(d.status === 200, `A4 ${ep.name}: no version header → behaves as before (200)`, d.status);
    }
    // A5 authorization precedence (seller who owns none of these records)
    const v = (await eps[2].get()).updatedAt;
    const forb = [
      await call(`/catalog/products/${product.id}`, OTHER, 'PATCH', { title: 'x' }, { [V]: 'stale' }),
      await call(`/catalog/brands/${brand.id}`, OTHER, 'PATCH', { tagline: 'x' }, { [V]: v }),
      await call(`/catalog/guides/${guide.id}`, OTHER, 'PATCH', { excerpt: 'x' }, { [V]: 'stale' }),
    ];
    check(forb.every((r) => r.status === 403), 'A5 non-owner with a (stale) version header → 403, never 409 (authorization unchanged)', forb.map((r) => r.status));
    // A6 product PATCH refuses when only the detail changed since load
    const pv = data(await call(`/catalog/products/${product.id}`, SA), 'p').updatedAt;
    const dv0 = data(await call(`/catalog/product-details/${product.id}`, SA), 'd').updatedAt;
    data(await call(`/catalog/product-details/${product.id}`, SA, 'PUT', { about: 'detail changed elsewhere' }, { [V]: dv0 }), 'detail change');
    const titleBefore = data(await call(`/catalog/products/${product.id}`, SA), 'p').title;
    const half = await call(`/catalog/products/${product.id}`, SA, 'PATCH', { title: 'should not be written' }, { [V]: pv, [VD]: dv0 });
    check(half.status === 409 && data(await call(`/catalog/products/${product.id}`, SA), 'p').title === titleBefore,
      'A6 product PATCH with a stale DETAIL version → 409 before anything is written', { status: half.status });

    // ════════ BROWSER — two tabs per Studio ════════
    console.log('\n── Two tabs ──');
    const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        if (!sessionStorage.getItem('pc')) {
          localStorage.setItem('choosify_auth_token', t as string);
          sessionStorage.setItem('pc', '1');
        }
      } catch {}
    }, SA);
    const open = async (p: Page, path: string, ready: string | RegExp) => {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.getByText(ready).first().waitFor({ timeout: 45000 });
      await p.waitForTimeout(800);
      const toggle = p.getByRole('button', { name: 'Edit', exact: true });
      if ((await toggle.count()) > 0) {
        await toggle.first().click();
        await p.waitForTimeout(300);
      }
    };
    type Studio = { name: string; path: string; ready: string; pill: RegExp; readServer: () => Promise<string> };
    const studios: Studio[] = [
      { name: 'Product', path: `/admin/products/${product.id}/edit`, ready: 'PC Product', pill: /^Edit About This Product$/, readServer: async () => String(data(await call(`/catalog/products/${product.id}`, SA), 'p').description) },
      { name: 'Guide', path: `/admin/guides/${guide.id}/edit`, ready: 'PC Guide', pill: /^Edit Guide Identity$/, readServer: async () => String(data(await call(`/catalog/guides/${guide.id}`, SA), 'g').title) },
      { name: 'Brand', path: `/admin/brand-studio/${brand.id}/edit`, ready: `PC Brand ${sfx}`, pill: /^Edit Contact Information$/, readServer: async () => JSON.stringify((await listOne('/catalog/brands', brand.id)) ?? {}) },
      { name: 'Creator', path: `/admin/creator-studio/${creatorId}/edit`, ready: 'PC Creator', pill: /Profile Identity$/, readServer: async () => String((await listOne('/catalog/creators', creatorId))?.name) },
    ];
    for (const s of studios) {
      const P = (l: string) => `${s.name}: ${l}`;
      try {
        const A = await ctx.newPage();
        const B = await ctx.newPage();
        await open(A, s.path, s.ready);
        await open(B, s.path, s.ready);
        const edit = async (p: Page, value: string) => {
          await p.getByRole('button', { name: s.pill }).first().click();
          await p.waitForTimeout(400);
          if (!(await tagField(p))) throw new Error('no editable field');
          const f = p.locator('[data-pc-field]');
          await f.fill(value);
          return f;
        };
        const aVal = `PC tab A ${s.name} ${sfx}`;
        const bVal = `PC tab B ${s.name} ${sfx}`;
        await edit(A, aVal);
        await A.getByRole('button', { name: 'Save Changes' }).first().click();
        await A.waitForTimeout(2000);
        const afterA = await s.readServer();
        check(afterA.includes(aVal), P('setup: tab A saved'), afterA.slice(0, 120));
        const bField = await edit(B, bVal);
        // Count tab B's catalog write requests from here on (Phase C.1: no automatic retry).
        const bWrites: string[] = [];
        const onReq = (r: { method: () => string; url: () => string }) => {
          if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && /\/api\/v1\/catalog\//.test(r.url())) bWrites.push(`${r.method()} ${new URL(r.url()).pathname}`);
        };
        B.on('request', onReq);
        await B.getByRole('button', { name: 'Save Changes' }).first().click();
        const notice = B.getByTestId('studio-conflict');
        await notice.waitFor({ timeout: 15000 }).catch(() => undefined);
        check(await notice.isVisible().catch(() => false), P('B1 tab B’s stale save shows the conflict notice'));
        await B.waitForTimeout(2500);
        B.off('request', onReq);
        check(bWrites.length === 1, P('B1 the stale save sent exactly one write request (no automatic retry)'), bWrites);
        if (s.name === 'Product') check(/\/studio-save$/.test(bWrites[0] ?? ''), P('B1 the Product Studio save is the single combined studio-save request'), bWrites);
        check((await bField.count()) === 1 && (await bField.inputValue()) === bVal, P('B2 tab B’s typed edits are still in its editor'));
        const serverNow = await s.readServer();
        check(serverNow.includes(aVal) && !serverNow.includes(bVal), P('B3 tab A’s save is intact on the server (not reverted)'), serverNow.slice(0, 160));
        await B.getByRole('button', { name: 'Discard my changes and load the latest' }).click();
        await B.waitForTimeout(2500);
        check((await B.getByTestId('studio-conflict').count()) === 0 && (await B.locator('#root').innerText()).includes(aVal), P('B4 explicit reload shows tab A’s value'));
        const toggle = B.getByRole('button', { name: 'Edit', exact: true });
        if ((await toggle.count()) > 0) await toggle.first().click();
        const b2 = `PC tab B again ${s.name} ${sfx}`;
        await edit(B, b2);
        await B.getByRole('button', { name: 'Save Changes' }).first().click();
        await B.waitForTimeout(2000);
        check((await B.getByTestId('studio-conflict').count()) === 0 && (await s.readServer()).includes(b2), P('B5 after reloading, tab B saves normally'));
        await A.close();
        await B.close();
      } catch (e) {
        check(false, P('two-tab step threw'), e instanceof Error ? e.message.split('\n')[0] : String(e));
      }
    }
    // B6 Guide layout conflict
    try {
      const A = await ctx.newPage();
      const B = await ctx.newPage();
      // The title was changed by the two-tab test above — wait for the Studio header instead.
      await open(A, `/admin/guides/${guide.id}/edit`, /Guide Studio/i);
      await open(B, `/admin/guides/${guide.id}/edit`, /Guide Studio/i);
      const layout = async () => JSON.stringify((data(await call(`/catalog/guides/${guide.id}`, SA), 'g').sections || []).map((x: any) => `${x.id}:${x.enabled}`));
      const hideA = A.locator('button[aria-label^="Hide "]').first();
      const label = (await hideA.getAttribute('aria-label')) || '';
      await hideA.click();
      await A.waitForTimeout(1500);
      const afterA = await layout();
      const otherHide = B.locator('button[aria-label^="Hide "]').nth(1);
      const otherLabel = (await otherHide.getAttribute('aria-label')) || '';
      await otherHide.click();
      await B.waitForTimeout(1500);
      check((await B.getByTestId('studio-conflict').count()) === 1 && (await B.locator(`button[aria-label="${otherLabel}"]`).count()) === 1 && (await layout()) === afterA,
        'B6 Guide: stale layout change refused, previous layout restored in tab B, tab A’s layout intact', { label, otherLabel });
      await A.close();
      await B.close();
    } catch (e) {
      check(false, 'B6 Guide layout two-tab step threw', e instanceof Error ? e.message.split('\n')[0] : String(e));
    }
  } catch (e) {
    check(false, 'probe step threw', e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    await browser.close();
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA, 'DELETE').catch(() => undefined);
    await q(`delete from users where id=$1`, [other.id]).catch(() => undefined);
    await db.end();
  }
  console.log(`\n${FAIL.length ? 'FAIL' : 'PASS'} probe-studio-concurrency (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) {
    for (const f of FAIL) console.log('  -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
