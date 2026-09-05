/**
 * Optional convenience script: reframes the real "Test" brand's logo
 * (brand-cb4ec847-ee87-4184-8659-84959c4c9ef9) using the admin-side Brand
 * Logo framing editor, via the actual deployed production dashboard.
 *
 * Requires real production admin credentials (not the local dev seed
 * account) — set them as env vars, never hardcode:
 *   ADMIN_EMAIL=<production admin email>
 *   ADMIN_PASSWORD=<production admin password>
 *
 * Doing this by hand in the browser (Brand Studio → Photo → Edit logo →
 * pick a shape → Save → Save Changes) works exactly the same and needs no
 * script — this is only here for repeatability.
 *
 * Usage: npx tsx scripts/probe-test-brand-logo-normalize-prod.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'https://dashboard.choosify.bd';
const OUT = join(process.cwd(), 'scripts', '_tmp_prod-verify');
mkdirSync(OUT, { recursive: true });
const TEST_BRAND_ID = 'brand-cb4ec847-ee87-4184-8659-84959c4c9ef9';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (real production admin credentials) as env vars first.');
    process.exit(1);
  }
  const admin = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json()).catch(() => ({}));
  if (!admin.accessToken) {
    console.error('admin login failed.', admin);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await page.addInitScript((token: string) => { try { localStorage.setItem('choosify_auth_token', token); } catch {} }, admin.accessToken);

  await page.goto(`${BASE}/admin/brand-studio/${TEST_BRAND_ID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(OUT, 'A-studio-before.png'), fullPage: false });

  const photoBtn = page.locator('button[title="Upload / change brand logo"]');
  await photoBtn.waitFor({ timeout: 15000 });
  await photoBtn.click();
  await page.waitForTimeout(1000);

  // Re-frame the EXISTING saved logo (no re-upload) — "Edit logo".
  const editLogoBtn = page.locator('button:has-text("Edit logo")');
  await editLogoBtn.waitFor({ timeout: 10000 });
  await editLogoBtn.click();
  await page.waitForTimeout(1200);

  const modal = page.locator('div[aria-label="Edit brand logo"]');
  const modalOpened = await modal.isVisible().catch(() => false);
  console.log('Edit-logo modal opened on the existing saved logo?', modalOpened);
  if (!modalOpened) {
    await page.screenshot({ path: join(OUT, 'B-edit-logo-failed.png'), fullPage: false });
    await browser.close();
    return;
  }
  await page.screenshot({ path: join(OUT, 'B-crop-modal-square-default.png'), fullPage: false });

  await modal.locator('button:has-text("Wide")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'C-crop-modal-wide.png'), fullPage: false });

  await modal.locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(500);
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'D-after-crop-save.png'), fullPage: false });

  await page.locator('button:has-text("Save Changes")').first().click({ timeout: 8000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, 'E-studio-after.png'), fullPage: false });

  await browser.close();

  const afterList = await fetch(`${BASE}/api/v1/catalog/brands`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  }).then((r) => r.json());
  const testBrand = (afterList.data || []).find((b: any) => b.id === TEST_BRAND_ID);
  console.log('Test brand logo URL after normalization:', testBrand?.logo);
}
main().catch((e) => { console.error(e); process.exit(1); });
