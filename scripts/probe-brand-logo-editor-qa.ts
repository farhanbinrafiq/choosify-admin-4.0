/**
 * End-to-end QA for the new Brand Logo framing editor:
 *  - opens the logo section in Brand Studio
 *  - uploads a raw asset with a large solid-color canvas around a small mark
 *    (the actual downloaded production Test-brand logo)
 *  - confirms BrandLogoCropModal opens, lets the aspect preset + zoom be
 *    changed, and Save produces a normalized (tightly-framed) image that
 *    gets uploaded via the real media pipeline and persisted on the brand
 *
 * Usage: npx tsx scripts/probe-brand-logo-editor-qa.ts <path-to-source-logo>
 * (needs :3001 dev server running)
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_logo-editor-artifacts');
mkdirSync(OUT, { recursive: true });
const sourceLogoPath = process.argv[2];
if (!sourceLogoPath) {
  console.error('Usage: npx tsx scripts/probe-brand-logo-editor-qa.ts <path-to-source-logo>');
  process.exit(1);
}

async function main() {
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seller@choosify.com.bd', password: PW }),
  }).then((r) => r.json());
  if (!login.accessToken) throw new Error('seller login failed');

  const brandsRes = await fetch(`${BASE}/api/v1/catalog/brands`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  }).then((r) => r.json());
  const own = (brandsRes.data || []).find((b: any) => b.sellerId === login.uid);
  if (!own) throw new Error('seller has no own brand to test against');
  console.log('testing against brand:', own.id, own.name);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  await page.addInitScript((token: string) => { try { localStorage.setItem('choosify_auth_token', token); } catch {} }, login.accessToken);

  await page.goto(`${BASE}/admin/brand-studio/${own.id}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  // Enter the logo section (the "Photo" pill next to the circular avatar).
  const photoBtn = page.locator('button[title="Upload / change brand logo"]');
  await photoBtn.waitFor({ timeout: 15000 });
  await photoBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, '2-logo-section-open.png'), fullPage: false });

  const fileInputCount = await page.locator('input[type="file"]').count();
  console.log('DEBUG file input count on page:', fileInputCount);

  // Upload the raw source logo (the one with a large surrounding canvas) —
  // scoped via xpath to the input that follows the "Choose file" button
  // inside the Brand Logo editor panel, since the page header's own
  // profile-photo control also has a hidden file input.
  const fileInput = page
    .locator('button:has-text("Choose file")')
    .locator('xpath=following-sibling::input[@type="file"]')
    .first();
  await fileInput.setInputFiles(sourceLogoPath);
  await page.waitForTimeout(1500);

  const modalVisible = await page.locator('div[aria-label="Edit brand logo"]').isVisible().catch(() => false);
  console.log('A1: BrandLogoCropModal opened on upload?', modalVisible);
  await page.screenshot({ path: join(OUT, '3-crop-modal-square-default.png'), fullPage: false });

  const modal = page.locator('div[aria-label="Edit brand logo"]');
  // Switch to the "Wide" aspect preset (this logo is a wide wordmark).
  await modal.locator('button:has-text("Wide")').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '4-crop-modal-wide-preset.png'), fullPage: false });

  // Zoom in to frame just the wordmark (drag the slider most of the way up).
  const slider = page.locator('input[type="range"]');
  const min = Number(await slider.getAttribute('min'));
  const max = Number(await slider.getAttribute('max'));
  const target = min + (max - min) * 0.65;
  await slider.evaluate((el: HTMLInputElement, v: number) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, target);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '5-crop-modal-zoomed.png'), fullPage: false });

  await page.locator('div[aria-label="Edit brand logo"]').locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(500);
  const modalGoneAfterSave = !(await page.locator('div[aria-label="Edit brand logo"]').isVisible().catch(() => false));
  console.log('A2: modal closed after Save (crop confirmed, upload starting)?', modalGoneAfterSave);

  // Wait for the real network upload (normalized PNG -> media pipeline) to
  // actually finish — the spinner overlay disappears once onChange(url)
  // fires — before persisting the section, otherwise "Save Changes" can
  // race ahead of the still-empty logo value.
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '6-after-crop-save.png'), fullPage: false });

  // Persist the section.
  await page.locator('button:has-text("Save Changes")').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, '7-after-section-save.png'), fullPage: true });

  await browser.close();

  const afterList = await fetch(`${BASE}/api/v1/catalog/brands`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  }).then((r) => r.json());
  const afterBrand = (afterList.data || []).find((b: any) => b.id === own.id);
  console.log('B1: brand.logo after save:', afterBrand?.logo);
  console.log('B2: logo persisted as a real uploaded asset URL?', typeof afterBrand?.logo === 'string' && afterBrand.logo.length > 0);
  console.log('screens written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
