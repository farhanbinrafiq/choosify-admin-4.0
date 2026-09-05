/**
 * Browser QA proving seller-controlled, irregular variant combinations —
 * the exact reported example (Size EU39/40/41 x Origin UK/USA/Vietnam,
 * seller only actually sells 4 of the 9 mathematically possible combos).
 *
 * Captures:
 *   1 studio-irregular-table.png   — Product Studio table: SIZE | ORIGIN
 *       columns (dynamic, not hardcoded), exactly 4 rows.
 *   2 add-variant-duplicate.png    — "+ Add Variant" modal, selecting an
 *       ALREADY-existing combination (EU39/UK) shows the duplicate error and
 *       a disabled Add button.
 *   3 add-variant-new.png          — same modal, switched to a genuinely new
 *       combination (EU40/USA), filled in and ready to add.
 *   4 studio-after-add.png         — table now shows 5 rows.
 *   5 large-generation-warning.png — a SEPARATE product with a large option
 *       space (10x8x6x5=2400) shows the "Generate a lot of combinations?"
 *       confirm before building anything.
 *   6 web-select-EU41.png          — storefront: EU41 selected -> Origin
 *       shows ONLY Vietnam enabled (the one real combo), UK/USA disabled.
 *   7 web-select-EU39.png          — storefront: EU39 selected -> Origin
 *       shows UK/USA enabled, Vietnam disabled (the opposite pattern).
 *
 * Usage: npx tsx scripts/probe-seller-controlled-variants-qa.ts   (needs :3001, :5173)
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_seller-controlled-variants-artifacts');
mkdirSync(OUT, { recursive: true });
const RID = Date.now();
const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);

async function api(path: string, init: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}
async function login(email: string) {
  const b = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PW }) })).body;
  return { token: b.accessToken || b.token || b.data?.accessToken || '', uid: b.uid || b.data?.uid || '' };
}

async function openOptionsEditor(page: Page, productId: string) {
  await page.goto(`${BASE}/admin/products/${productId}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /Options & Variants/i.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
  await settle(page);
  const clicked = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const target = pills.find((b) => {
      if (!/^\s*Edit\s*$/.test(b.textContent || '')) return false;
      const box = b.closest('div.relative');
      return !!box && /variant combination|product option picker|No product options/i.test(box.textContent || '');
    });
    if (target) { target.click(); return true; }
    return false;
  });
  if (!clicked) console.log('WARN: could not find the Options & Variants Edit pill');
  await page.waitForFunction(() => /Category product options|Custom product options/i.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
  await settle(page);
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  if (!admin.token || !seller.token) throw new Error('dev login failed — is ALLOW_DEV_LOGIN=true?');

  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.token)).body?.data || [];
  const brand = brands[0];
  if (!brand) throw new Error('seeded seller has no brand');

  const cat = (await api('/catalog/categories', { method: 'POST', body: JSON.stringify({
    name: `QA Irregular ${RID}`, slug: `qa-irregular-${RID}`, parentId: null, enabled: true,
  }) }, admin.token)).body?.data;

  // ── Product 1: the exact reported irregular Size x Origin shape ──────────
  const prod = (await api('/catalog/products', { method: 'POST', body: JSON.stringify({
    title: `QA Irregular Boot ${RID}`, brandId: brand.id, brandName: brand.name,
    categoryId: cat.id, categoryName: cat.name, price: 5000, originalPrice: 6000,
    stock: 0, status: 'live', modeType: 'retail',
    image: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600',
    description: 'QA fixture — seller sells only 4 of 9 Size x Origin combinations.',
  }) }, seller.token)).body?.data;

  const SIZE = ['EU39', 'EU40', 'EU41'];
  const ORIGIN = ['UK', 'USA', 'Vietnam'];
  const realCombos = [
    { Size: 'EU39', Origin: 'UK', price: 5000, stock: 8 },
    { Size: 'EU39', Origin: 'USA', price: 5050, stock: 6 },
    { Size: 'EU40', Origin: 'UK', price: 5100, stock: 5 },
    { Size: 'EU41', Origin: 'Vietnam', price: 5200, stock: 3 },
  ];
  await api(`/catalog/product-details/${prod.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prod.id, specs: [], addonItems: [],
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: SIZE, custom: true },
      { id: 'og-origin', name: 'Origin', displayType: 'pills', values: ORIGIN, custom: true },
    ],
    productVariants: realCombos.map((c, i) => ({
      id: `qa-irr-${i}-${RID}`, sku: `BOOT-${c.Size}-${c.Origin}-${RID}`.toUpperCase(),
      price: c.price, originalPrice: c.price + 400, stock: c.stock,
      options: { Size: c.Size, Origin: c.Origin }, status: 'active',
    })),
  }) }, seller.token);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('choosify_auth_token', t as string); } catch {} }, seller.token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

  await openOptionsEditor(page, prod.id);

  // ── 1. table with dynamic SIZE | ORIGIN columns, 4 rows ───────────────────
  const tableText1 = await page.evaluate(() => document.querySelector('table')?.innerText || '');
  console.log('1: table header shows SIZE?', /size/i.test(tableText1));
  console.log('1: table header shows ORIGIN?', /origin/i.test(tableText1));
  const rowCount1 = await page.locator('table tbody tr').count();
  console.log('1: exactly 4 rows shown?', rowCount1 === 4, 'actual:', rowCount1);
  await page.screenshot({ path: join(OUT, '1 studio-irregular-table.png'), fullPage: true });

  // ── 2. Add Variant -> pick an EXISTING combo -> duplicate error ──────────
  await page.locator('button:has-text("+ Add Variant")').first().click({ timeout: 6000 });
  await settle(page, 800);
  // Default selects should already resolve to EU39/UK (first value of each dim) -- the FIRST existing combo.
  const dupText = await page.evaluate(() => document.body.innerText);
  console.log('2: duplicate warning shown for default EU39/UK selection?', /already exists/i.test(dupText));
  await page.screenshot({ path: join(OUT, '2 add-variant-duplicate.png'), fullPage: false });

  // ── 3. switch to a genuinely new combo (EU40/USA), fill fields ───────────
  const addModal = page.locator('div.fixed.inset-0.z-\\[300\\]');
  const selects = addModal.locator('select');
  await selects.nth(0).selectOption('EU40'); // Size
  await selects.nth(1).selectOption('USA'); // Origin
  await settle(page, 500);
  const noDupText = await page.evaluate(() => document.body.innerText);
  console.log('3: no duplicate warning for the new EU40/USA combination?', !/already exists/i.test(noDupText));
  await addModal.locator('input[placeholder*="SHIRT-M-RED"]').fill(`BOOT-EU40-USA-${RID}`);
  const numInputs = addModal.locator('input[type="number"]');
  await numInputs.nth(0).fill('5300'); // price
  await numInputs.nth(2).fill('4'); // stock
  await page.screenshot({ path: join(OUT, '3 add-variant-new.png'), fullPage: false });
  await addModal.locator('button:has-text("Add Variant")').click({ timeout: 6000 });
  await settle(page, 1200);

  // ── 4. table now has 5 rows ────────────────────────────────────────────────
  const rowCount2 = await page.locator('table tbody tr').count();
  console.log('4: table now shows 5 rows after Add Variant?', rowCount2 === 5, 'actual:', rowCount2);
  await page.screenshot({ path: join(OUT, '4 studio-after-add.png'), fullPage: true });

  // ── 5. large-generation warning on a big option space (10x8x6x5=2400) ────
  const prodBig = (await api('/catalog/products', { method: 'POST', body: JSON.stringify({
    title: `QA Large Combination ${RID}`, brandId: brand.id, brandName: brand.name,
    categoryId: cat.id, categoryName: cat.name, price: 1000, originalPrice: 1200,
    stock: 0, status: 'live', modeType: 'retail',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    description: 'QA fixture for the large-generation warning.',
  }) }, seller.token)).body?.data;
  const dimVals = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  await api(`/catalog/product-details/${prodBig.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prodBig.id, specs: [], addonItems: [],
    optionGroups: [
      { id: 'og-w', name: 'W', displayType: 'pills', values: dimVals(10, 'w'), custom: true },
      { id: 'og-x', name: 'X', displayType: 'pills', values: dimVals(8, 'x'), custom: true },
      { id: 'og-y', name: 'Y', displayType: 'pills', values: dimVals(6, 'y'), custom: true },
      { id: 'og-z', name: 'Z', displayType: 'pills', values: dimVals(5, 'z'), custom: true },
    ],
    productVariants: [],
  }) }, seller.token);
  await openOptionsEditor(page, prodBig.id);
  await page.locator('button:has-text("Generate candidate combinations")').first().click({ timeout: 6000 });
  await settle(page, 800);
  const warnText = await page.evaluate(() => document.body.innerText);
  console.log('5: large-generation warning shown for 2400 combinations?', /2,400|2400/.test(warnText) && /lot of combinations/i.test(warnText));
  await page.screenshot({ path: join(OUT, '5 large-generation-warning.png'), fullPage: false });
  await page.locator('button:has-text("Cancel")').first().click({ timeout: 4000 }).catch(() => {});

  await page.close();
  await browser.close();

  // ── 6/7. real Choosify-Web storefront: generic multi-dim availability ────
  const webUp = await fetch('http://localhost:5173').then((r) => r.ok).catch(() => false);
  if (webUp) {
    const b2 = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
    const wp = await (await b2.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    await wp.goto(`${BASE.replace('3001', '5173')}/products/${prod.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wp.waitForTimeout(5000);

    // Scope the check to the ORIGIN option-group specifically (find the
    // "ORIGIN:" label, then read the button row that follows it) -- the page
    // has other unrelated buttons (nav, sign in, etc.) that could otherwise
    // collide with a bare document-wide button-text search.
    const readOriginState = () =>
      wp.evaluate(() => {
        const labelDiv = Array.from(document.querySelectorAll('div')).find((d) =>
          /^ORIGIN:/i.test((d.textContent || '').trim()),
        );
        const group = labelDiv?.parentElement;
        const btns = group ? Array.from(group.querySelectorAll('button')) : [];
        const out: Record<string, { disabled: boolean } | null> = {};
        for (const label of ['UK', 'USA', 'Vietnam']) {
          const b = btns.find((x) => (x.textContent || '').trim() === label) as HTMLButtonElement | undefined;
          out[label] = b ? { disabled: b.disabled } : null;
        }
        return out;
      });

    await wp.locator('button:has-text("EU41")').first().scrollIntoViewIfNeeded().catch(() => {});
    await wp.locator('button:has-text("EU41")').first().click({ timeout: 5000 });
    await wp.waitForTimeout(1200);
    const eu41State = await readOriginState();
    console.log('6: with EU41 selected -> UK disabled?', eu41State.UK?.disabled, 'USA disabled?', eu41State.USA?.disabled, 'Vietnam disabled?', eu41State.Vietnam?.disabled);
    await wp.screenshot({ path: join(OUT, '6 web-select-EU41.png'), fullPage: true });

    await wp.locator('button:has-text("EU39")').first().scrollIntoViewIfNeeded().catch(() => {});
    await wp.locator('button:has-text("EU39")').first().click({ timeout: 5000 });
    await wp.waitForTimeout(1200);
    const eu39State = await readOriginState();
    console.log('7: with EU39 selected -> UK disabled?', eu39State.UK?.disabled, 'USA disabled?', eu39State.USA?.disabled, 'Vietnam disabled?', eu39State.Vietnam?.disabled);
    await wp.screenshot({ path: join(OUT, '7 web-select-EU39.png'), fullPage: true });

    await b2.close();
  } else {
    console.log('web dev :5173 not running — skipped storefront screens 6+7');
  }

  console.log('screens written to', OUT);
  console.log('product (irregular):', prod.id, ' product (large):', prodBig.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
