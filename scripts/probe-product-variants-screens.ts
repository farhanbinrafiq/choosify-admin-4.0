/**
 * Product Studio Options & Variants — screenshot capture (browser).
 *
 * Builds one product whose category defines variant-eligible options (Storage,
 * RAM), adds a seller CUSTOM product option (Strap Material) and a full
 * combination matrix + a size guide, then captures:
 *
 *   1 studio-options-editor.png   — Options & Variants editor: the in-section
 *       searchable PRODUCT CATEGORY picker, the category-driven product options,
 *       the custom product option, and the generated variant-combination table.
 *   2 studio-category-search.png  — the same picker with its search box open.
 *   3 storefront-preview.png      — /admin/products/:id/preview (same
 *       <ProductDetailPresentation> the storefront uses) with the options /
 *       combinations summary + size-guide CTA.
 *
 * Screens: scripts/_tmp_product-variants-artifacts/
 * Usage:   npx tsx scripts/probe-product-variants-screens.ts   (needs dev :3001)
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_product-variants-artifacts');
mkdirSync(OUT, { recursive: true });
const RID = Date.now();
const settle = (p: Page) => p.waitForTimeout(2500);

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

  // seller's first granted brand
  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.token)).body?.data || [];
  const brand = brands[0];
  if (!brand) throw new Error('seeded seller has no brand');

  // category with two variant-eligible attributes
  const cat = (await api('/catalog/categories', { method: 'POST', body: JSON.stringify({
    name: `Screens Wearables ${RID}`, slug: `screens-wearables-${RID}`, parentId: null, enabled: true,
  }) }, admin.token)).body?.data;
  for (const a of [
    { name: 'Storage', options: ['32GB', '64GB'] },
    { name: 'RAM', options: ['1GB', '2GB'] },
  ]) {
    await api(`/catalog/categories/${cat.id}/attributes`, { method: 'POST', body: JSON.stringify({
      name: a.name, type: 'select', variantEligible: true, options: a.options,
    }) }, admin.token);
  }

  const prod = (await api('/catalog/products', { method: 'POST', body: JSON.stringify({
    title: `Studio Screens Watch ${RID}`, brandId: brand.id, brandName: brand.name,
    categoryId: cat.id, categoryName: cat.name, price: 8000, originalPrice: 9500,
    stock: 0, status: 'live', modeType: 'retail',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
    description: 'Screenshot fixture product.',
  }) }, seller.token)).body?.data;

  const vids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  // Strap Material drives which photos a shopper sees — Silicone vs Leather sets.
  const SILICONE_IMGS = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700',
    'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=700',
  ];
  const LEATHER_IMGS = [
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=700',
  ];
  const combos = [
    { Storage: '32GB', RAM: '1GB', 'Strap Material': 'Silicone', price: 8000, stock: 6 },
    { Storage: '32GB', RAM: '1GB', 'Strap Material': 'Leather', price: 8600, stock: 4 },
    { Storage: '32GB', RAM: '2GB', 'Strap Material': 'Silicone', price: 8800, stock: 5 },
    { Storage: '32GB', RAM: '2GB', 'Strap Material': 'Leather', price: 9200, stock: 3 },
    { Storage: '64GB', RAM: '1GB', 'Strap Material': 'Silicone', price: 9000, stock: 5 },
    { Storage: '64GB', RAM: '1GB', 'Strap Material': 'Leather', price: 9500, stock: 2 },
    { Storage: '64GB', RAM: '2GB', 'Strap Material': 'Silicone', price: 9800, stock: 4 },
    { Storage: '64GB', RAM: '2GB', 'Strap Material': 'Leather', price: 10400, stock: 0 },
  ];
  await api(`/catalog/product-details/${prod.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prod.id, specs: [], addonItems: [],
    optionGroups: [
      { id: 'og-storage', name: 'Storage', displayType: 'pills', values: ['32GB', '64GB'] },
      { id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['1GB', '2GB'] },
      { id: 'og-strap', name: 'Strap Material', displayType: 'pills', values: ['Silicone', 'Leather'], custom: true },
    ],
    productVariants: combos.map((c, i) => ({
      id: `screens-${vids[i]}-${RID}`,
      sku: `SW-${vids[i].toUpperCase()}-${RID}`,
      price: c.price,
      originalPrice: c.price + 600,
      stock: c.stock,
      options: { Storage: c.Storage, RAM: c.RAM, 'Strap Material': c['Strap Material'] },
      images: c['Strap Material'] === 'Leather' ? LEATHER_IMGS : SILICONE_IMGS,
      status: c.stock === 0 ? 'inactive' : 'active',
    })),
    sizeGuide: {
      enabled: true, guideType: 'size', type: 'image',
      title: 'Wrist Fit Guide',
      imageUrl: 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=700',
      description: 'Measure your wrist circumference; S fits 140–170mm, M fits 170–200mm.',
    },
  }) }, seller.token);

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('choosify_auth_token', t as string); } catch {} }, seller.token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 160)));

  // ── 1. Options & Variants editor ──────────────────────────────────────
  await page.goto(`${BASE}/admin/products/${prod.id}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /Options & Variants/i.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
  await settle(page);

  // click the Edit pill that belongs to the Options & Variants section — the one
  // whose section wrapper contains the VariantSummaryView text.
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
  await page.waitForFunction(() => /PRODUCT CATEGORY|Category product options/i.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
  await settle(page);
  // make sure the generated matrix is present
  await page.locator('button:has-text("Generate missing combinations")').first().click({ timeout: 4000 }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: join(OUT, '1 studio-options-editor.png'), fullPage: true });

  // ── 2. category search open ───────────────────────────────────────────
  await page.locator('text=PRODUCT CATEGORY').first().scrollIntoViewIfNeeded().catch(() => {});
  const catButton = page.locator('button:has-text("Screens Wearables"), button:has-text("Search a category")').first();
  await catButton.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Search categories…"]').fill('watch').catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Search categories…"]').fill('wear').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '2 studio-category-search.png'), fullPage: true });

  // ── 3. storefront-parity preview ──────────────────────────────────────
  await page.goto(`${BASE}/admin/products/${prod.id}/preview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /combination|Options & Variants|Guide/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: join(OUT, '3 storefront-preview.png'), fullPage: true });

  // ── 4. Product Listings — variant stock summary + expanded breakdown ──
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /Studio Screens Watch/i.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(4500); // let the per-product inventory hydrate
  // expand the variant stock breakdown for our fixture row
  await page.locator('button:has-text("variant")').first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, '4 product-listings-variant-stock.png'), fullPage: true });

  await browser.close();

  // ── 5+6. real Choosify-Web storefront: gallery/price/stock swap on option
  //         change — only if the web dev server is up on :5173 ─────────────
  const webUp = await fetch('http://localhost:5173').then((r) => r.ok).catch(() => false);
  if (webUp) {
    const b2 = await chromium
      .launch({ headless: true, channel: 'chrome' })
      .catch(() => chromium.launch({ headless: true }));
    const wp = await (await b2.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
    await wp.goto(`http://localhost:5173/products/${prod.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wp.waitForTimeout(6500);
    await wp.locator('button:has-text("Silicone")').first().click({ timeout: 3000 }).catch(() => {});
    await wp.waitForTimeout(1800);
    await wp.screenshot({ path: join(OUT, '5 web-storefront-silicone.png'), fullPage: true });
    await wp.locator('button:has-text("Leather")').first().click({ timeout: 3000 }).catch(() => {});
    await wp.waitForTimeout(1800);
    await wp.screenshot({ path: join(OUT, '6 web-storefront-leather.png'), fullPage: true });
    await b2.close();
    console.log('web storefront screens written');
  } else {
    console.log('web dev :5173 not running — skipped storefront gallery screens 5+6');
  }

  console.log('screens written to', OUT);
  console.log('product:', prod.id, ' category:', cat.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
