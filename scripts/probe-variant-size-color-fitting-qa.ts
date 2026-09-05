/**
 * Browser QA for the "add a dimension after variants exist" fix — exact
 * reported scenario: Size(4) already has variants, seller then adds Color(4)
 * and Fitting(2).
 *
 * Captures:
 *   1 before-size-only.png        — Studio table: 4 rows, Size only.
 *   2 bug-state-dashes.png        — after Color+Fitting are added to
 *       optionGroups (variants untouched, simulating the exact reported
 *       state) — 4 rows, Color/Fitting show amber "—", "Generate missing
 *       combinations (32)" button visible.
 *   3 after-generate-32-rows.png  — after clicking Generate: 32 full rows,
 *       no dashes, M's data visibly carried onto its 8 completions.
 *   4 after-delete-sparse.png     — after deleting a few combinations the
 *       seller doesn't sell (sparse matrix).
 *   5 storefront-preview.png      — admin storefront-parity preview: Size,
 *       Color, Fitting all selectable/available.
 *   6 web-storefront-*.png        — real Choosify-Web page (if :5173 up):
 *       initial deduplicated gallery, then a resolved variant's own gallery,
 *       then a deleted-combination fitting correctly disabled.
 *
 * Screens: scripts/_tmp_variant-size-color-fitting-artifacts/
 * Usage:   npx tsx scripts/probe-variant-size-color-fitting-qa.ts   (needs dev :3001)
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_variant-size-color-fitting-artifacts');
mkdirSync(OUT, { recursive: true });
const RID = Date.now();
const settle = (p: Page, ms = 2200) => p.waitForTimeout(ms);

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

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  if (!admin.token || !seller.token) throw new Error('dev login failed — is ALLOW_DEV_LOGIN=true?');

  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.token)).body?.data || [];
  const brand = brands[0];
  if (!brand) throw new Error('seeded seller has no brand');

  const cat = (await api('/catalog/categories', { method: 'POST', body: JSON.stringify({
    name: `QA Apparel ${RID}`, slug: `qa-apparel-${RID}`, parentId: null, enabled: true,
  }) }, admin.token)).body?.data;

  const prod = (await api('/catalog/products', { method: 'POST', body: JSON.stringify({
    title: `QA Dimension-Add Shirt ${RID}`, brandId: brand.id, brandName: brand.name,
    categoryId: cat.id, categoryName: cat.name, price: 1000, originalPrice: 1200,
    stock: 0, status: 'live', modeType: 'retail',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
    description: 'QA fixture — Size-only variants, Color/Fitting added afterward.',
  }) }, seller.token)).body?.data;

  const SIZE = ['M (40)', 'L (42)', 'XL (44)', 'XXL (48)'];
  const COLOR = ['Red', 'Blue', 'White', 'Green'];
  const FITTING = ['Slim Fit', 'Regular Fit'];
  const SIZE_IMAGES: Record<string, string[]> = {
    'M (40)': ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700'],
    'L (42)': ['https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=700'],
    'XL (44)': ['https://images.unsplash.com/photo-1562157873-818bc0726f68?w=700'],
    'XXL (48)': ['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=700'],
  };

  // ── Step 0: Size-only variants (the pre-existing state) ──────────────────
  await api(`/catalog/product-details/${prod.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prod.id, specs: [], addonItems: [],
    optionGroups: [{ id: 'og-size', name: 'Size', displayType: 'pills', values: SIZE, custom: true }],
    productVariants: SIZE.map((s, i) => ({
      id: `size-only-${i}-${RID}`,
      sku: `SHIRT-${s.replace(/[^A-Z0-9]/gi, '')}-${RID}`,
      price: 1000 + i * 100,
      originalPrice: 1200 + i * 100,
      stock: 20 + i * 5,
      options: { Size: s },
      images: SIZE_IMAGES[s],
      status: 'active',
    })),
  }) }, seller.token);

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('choosify_auth_token', t as string); } catch {} }, seller.token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

  const openOptionsEditor = async () => {
    await page.goto(`${BASE}/admin/products/${prod.id}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  };

  // ── 1. BEFORE: Size-only, 4 rows ──────────────────────────────────────────
  await openOptionsEditor();
  await page.screenshot({ path: join(OUT, '1 before-size-only.png'), fullPage: true });
  console.log('1: captured Size-only state (4 rows)');

  // ── Step: seller adds Color + Fitting (variants untouched) — the exact
  //    reported bug trigger. Done via the same PUT the Studio's own "Save"
  //    would issue after the seller adds two new option rows in the UI.
  const beforeVariants = (await api(`/catalog/product-details/${prod.id}`, { method: 'GET' }, seller.token)).body?.productVariants;
  await api(`/catalog/product-details/${prod.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prod.id, specs: [], addonItems: [],
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: SIZE, custom: true },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: COLOR, custom: true },
      { id: 'og-fitting', name: 'Fitting', displayType: 'pills', values: FITTING, custom: true },
    ],
    productVariants: beforeVariants,
  }) }, seller.token);

  // ── 2. BUG STATE: 4 rows, Color/Fitting show "—", Generate (32) ──────────
  await openOptionsEditor();
  const bugStateText = await page.evaluate(() => document.body.innerText);
  console.log('2: bug-state shows "Generate missing combinations"?', /Generate missing combinations \(32\)/.test(bugStateText));
  console.log('2: bug-state mentions incomplete rows?', /saved before a newer option was added/.test(bugStateText));
  await page.screenshot({ path: join(OUT, '2 bug-state-dashes.png'), fullPage: true });

  // ── 3. Click "Generate missing combinations" → 32 full rows ──────────────
  await page.locator('button:has-text("Generate missing combinations")').first().click({ timeout: 6000 });
  await settle(page, 1500);
  const afterGenText = await page.evaluate(() => document.body.innerText);
  console.log('3: after-generate shows "All combinations created"?', /All combinations created/.test(afterGenText));
  await page.screenshot({ path: join(OUT, '3 after-generate-32-rows.png'), fullPage: true });

  // ── 4. Delete a couple of combinations (sparse matrix) ────────────────────
  // Delete the LAST row a few times via the row's ✕ button (rightmost cell).
  for (let i = 0; i < 3; i++) {
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count === 0) break;
    const lastRow = rows.nth(count - 1);
    await lastRow.locator('button').last().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await settle(page, 1000);
  await page.screenshot({ path: join(OUT, '4 after-delete-sparse.png'), fullPage: true });

  // ── Save the product (persist through the real Studio Save flow) ─────────
  const allButtonTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
  );
  console.log('DEBUG all button texts:', JSON.stringify(allButtonTexts));
  const saveClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const save = btns.find((b) => /^\s*Save\s*$/i.test(b.textContent || '') || /Save changes/i.test(b.textContent || ''));
    if (save) { save.click(); return true; }
    return false;
  });
  console.log('save button clicked?', saveClicked);
  await settle(page, 4000);

  // Confirm via API what actually persisted.
  const persistedResp = await api(`/catalog/product-details/${prod.id}`, { method: 'GET' }, seller.token);
  console.log('DEBUG persisted GET:', JSON.stringify({ status: persistedResp.status, bodyKeys: Object.keys(persistedResp.body || {}), success: persistedResp.body?.success, error: persistedResp.body?.error }));
  const persisted = persistedResp.body;
  const persistedCount = Array.isArray(persisted?.productVariants) ? persisted.productVariants.length : -1;
  const anyDash = Array.isArray(persisted?.productVariants)
    ? persisted.productVariants.some((v: any) => !v.options?.Size || !v.options?.Color || !v.options?.Fitting)
    : true;
  console.log('persisted variant count after save (expect 29 = 32 - 3 deleted):', persistedCount);
  console.log('any persisted row still missing a dimension (expect false):', anyDash);

  // ── 5. storefront-parity preview ──────────────────────────────────────────
  await page.goto(`${BASE}/admin/products/${prod.id}/preview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /Size|Color|Fitting/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: join(OUT, '5 storefront-preview.png'), fullPage: true });

  await browser.close();

  // ── 6. real Choosify-Web storefront ────────────────────────────────────────
  const webUp = await fetch('http://localhost:5173').then((r) => r.ok).catch(() => false);
  if (webUp) {
    const b2 = await chromium
      .launch({ headless: true, channel: 'chrome' })
      .catch(() => chromium.launch({ headless: true }));
    const wp = await (await b2.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();
    await wp.goto(`http://localhost:5173/products/${prod.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wp.waitForTimeout(6000);
    await wp.screenshot({ path: join(OUT, '6 web-initial-gallery.png'), fullPage: true });
    await wp.locator('button:has-text("L (42)")').first().click({ timeout: 4000 }).catch(() => {});
    await wp.waitForTimeout(1200);
    await wp.locator('button:has-text("Blue")').first().click({ timeout: 4000 }).catch(() => {});
    await wp.waitForTimeout(1200);
    await wp.locator('button:has-text("Slim Fit")').first().click({ timeout: 4000 }).catch(() => {});
    await wp.waitForTimeout(1500);
    await wp.screenshot({ path: join(OUT, '7 web-resolved-variant.png'), fullPage: true });
    await b2.close();
    console.log('web storefront screens written');
  } else {
    console.log('web dev :5173 not running — skipped storefront screens 6+7');
  }

  console.log('screens written to', OUT);
  console.log('product:', prod.id, ' category:', cat.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
