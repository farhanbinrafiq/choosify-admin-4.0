/**
 * Browser QA for the "Edit Variant" modal — comfortable full editor replacing
 * the old cramped inline row inputs.
 *
 * Captures:
 *   1 table-overview.png       — the readable table (SKU/price/MRP/stock text,
 *       Active toggle, thumbnail+count, Edit/Delete actions).
 *   2 modal-open.png           — modal freshly opened on M(40)/Red/Slim Fit,
 *       combination chips, SKU/price/MRP/stock/active/images all visible.
 *   3 modal-edited.png         — after changing SKU, price, stock, toggling
 *       Active off, uploading a 2nd image.
 *   4 table-after-save.png     — table reflects the saved values immediately.
 *   5 modal-cancel-dirty.png   — editing a second variant, then Cancel with
 *       unsaved changes triggers the native confirm dialog (captured via the
 *       dialog handler, not a screenshot — see console output).
 *
 * Usage: npx tsx scripts/probe-variant-edit-modal-qa.ts   (needs dev :3001)
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_variant-edit-modal-artifacts');
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

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  if (!admin.token || !seller.token) throw new Error('dev login failed — is ALLOW_DEV_LOGIN=true?');

  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.token)).body?.data || [];
  const brand = brands[0];
  if (!brand) throw new Error('seeded seller has no brand');

  const cat = (await api('/catalog/categories', { method: 'POST', body: JSON.stringify({
    name: `QA Modal Apparel ${RID}`, slug: `qa-modal-apparel-${RID}`, parentId: null, enabled: true,
  }) }, admin.token)).body?.data;

  const prod = (await api('/catalog/products', { method: 'POST', body: JSON.stringify({
    title: `QA Edit-Modal Shirt ${RID}`, brandId: brand.id, brandName: brand.name,
    categoryId: cat.id, categoryName: cat.name, price: 1000, originalPrice: 1200,
    stock: 0, status: 'live', modeType: 'retail',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
    description: 'QA fixture for the Edit Variant modal.',
  }) }, seller.token)).body?.data;

  const SIZE = ['M (40)', 'L (42)'];
  const COLOR = ['Red', 'Blue'];
  const FITTING = ['Slim Fit', 'Regular Fit'];
  const combos: Array<{ Size: string; Color: string; Fitting: string }> = [];
  for (const s of SIZE) for (const c of COLOR) for (const f of FITTING) combos.push({ Size: s, Color: c, Fitting: f });

  await api(`/catalog/product-details/${prod.id}`, { method: 'PUT', body: JSON.stringify({
    productId: prod.id, specs: [], addonItems: [],
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: SIZE, custom: true },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: COLOR, custom: true },
      { id: 'og-fitting', name: 'Fitting', displayType: 'pills', values: FITTING, custom: true },
    ],
    productVariants: combos.map((c, i) => ({
      id: `qa-modal-${i}-${RID}`,
      sku: `QAM-${i}-${RID}`,
      price: 1000 + i * 25,
      originalPrice: 1200 + i * 25,
      stock: 10 + i,
      options: c,
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700'],
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

  let lastDialogMessage = '';
  page.on('dialog', async (dialog) => {
    lastDialogMessage = dialog.message();
    console.log('DIALOG:', dialog.type(), '-', dialog.message());
    await dialog.dismiss();
  });

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

  // ── 1. table overview ─────────────────────────────────────────────────────
  await page.screenshot({ path: join(OUT, '1 table-overview.png'), fullPage: true });
  const tableText = await page.evaluate(() => {
    const table = document.querySelector('table');
    return table ? table.innerText : '';
  });
  console.log('table shows readable SKU (QAM-0)?', tableText.includes(`QAM-0-${RID}`));
  console.log('table shows readable price (৳1,000)?', /৳1,000/.test(tableText));
  console.log('table has Edit buttons?', /Edit/.test(tableText));

  // ── 2. open modal on the first row ────────────────────────────────────────
  const firstEditBtn = page.locator('table tbody tr').first().locator('button:has-text("Edit")');
  await firstEditBtn.click({ timeout: 6000 });
  await settle(page);
  const modalTitleText = await page.evaluate(() => document.body.innerText);
  console.log('modal shows "Edit Variant"?', /Edit Variant/.test(modalTitleText));
  console.log('modal shows combination "M (40) / Red / Slim Fit"?', /M \(40\)\s*\/\s*Red\s*\/\s*Slim Fit/.test(modalTitleText));
  console.log('modal shows read-only combination note?', /Read-only/.test(modalTitleText));
  await page.screenshot({ path: join(OUT, '2 modal-open.png'), fullPage: false });

  // ── 3. edit SKU, price, stock, toggle Active off, add a 2nd image URL ────
  const modal = page.locator('div.fixed.inset-0.z-\\[300\\]');
  const skuInput = modal.locator('input[placeholder*="SHIRT-M-RED"]');
  await skuInput.fill('EDITED-SKU-9999');
  const numberInputs = modal.locator('input[type="number"]');
  await numberInputs.nth(0).fill('4999'); // price
  await numberInputs.nth(2).fill('77'); // stock (price, MRP, stock order)
  await modal.locator('button[role="switch"]').click(); // toggle Active off
  await modal.locator('input[placeholder*="paste an image URL"]').fill('https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=700');
  await modal.locator('input[placeholder*="paste an image URL"]').press('Enter');
  await settle(page, 800);
  await page.screenshot({ path: join(OUT, '3 modal-edited.png'), fullPage: false });

  await modal.locator('button:has-text("Save Variant")').click();
  await settle(page, 1200);

  // ── 4. table reflects saved values ────────────────────────────────────────
  const afterSaveText = await page.evaluate(() => document.querySelector('table')?.innerText || '');
  console.log('table shows edited SKU?', afterSaveText.includes('EDITED-SKU-9999'));
  console.log('table shows edited price (৳4,999)?', /৳4,999/.test(afterSaveText));
  console.log('table shows edited stock (77)?', /\b77\b/.test(afterSaveText));
  console.log('table shows 2 images for that row?', /\b2\b/.test(afterSaveText));
  await page.screenshot({ path: join(OUT, '4 table-after-save.png'), fullPage: true });

  // ── 5. open a DIFFERENT variant, make a change, Cancel -> unsaved guard ──
  const secondEditBtn = page.locator('table tbody tr').nth(1).locator('button:has-text("Edit")');
  await secondEditBtn.click({ timeout: 6000 });
  await settle(page);
  const modal2 = page.locator('div.fixed.inset-0.z-\\[300\\]');
  await modal2.locator('input').first().fill('SHOULD-BE-DISCARDED');
  lastDialogMessage = '';
  await modal2.locator('button:has-text("Cancel")').click();
  await settle(page, 500);
  console.log('Cancel-with-dirty triggered a confirm dialog?', /Discard unsaved changes/.test(lastDialogMessage));
  // dialog was DISMISSED (Cancel-the-confirm) above, so the modal should still be open
  const stillOpenAfterDismiss = await page.evaluate(() => /Edit Variant/i.test(document.body.innerText));
  console.log('after dismissing the confirm, modal is still open (change not lost)?', stillOpenAfterDismiss);

  await page.close();
  await browser.close();

  console.log('screens written to', OUT);
  console.log('product:', prod.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
