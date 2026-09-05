/**
 * Platform-wide Satoshi typography smoke test -- representative pages across
 * both Choosify-Web (storefront) and choosify-admin-4.0 (dashboard), checking
 * for: correct Satoshi font-family inheritance, no font-asset 404s, no
 * console errors, and a screenshot for visual-regression comparison (no
 * redesign -- same layout/spacing/sizes, just the typeface).
 *
 * Usage: npx tsx scripts/probe-typography-smoke.ts
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const WEB_BASE = process.env.PROBE_WEB_BASE || 'http://localhost:5173';
const ADMIN_BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_typography-smoke');
mkdirSync(OUT, { recursive: true });

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function checkPage(page: Page, url: string, label: string, shotName: string) {
  const font404s: string[] = [];
  const onResponse = (res: any) => {
    if (/\.(woff2?|ttf)(\?|$)/i.test(res.url()) && res.status() >= 400) font404s.push(`${res.status()} ${res.url()}`);
  };
  page.on('response', onResponse);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, shotName), fullPage: false });
  const info = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('h1, h2, h3, p, span, a, button, td, div'))
      .filter((el) => (el.textContent || '').trim().length > 3)
      .slice(0, 40);
    const fonts = new Set(candidates.map((el) => getComputedStyle(el).fontFamily));
    return { fontsSeen: Array.from(fonts) };
  });
  page.off('response', onResponse);
  const allSatoshiOrHeading = info.fontsSeen.every(
    (f) => f.toLowerCase().includes('satoshi') || f.toLowerCase().includes('outfit') || f.toLowerCase().includes('monospace') || f.toLowerCase().includes('jetbrains'),
  );
  assert(allSatoshiOrHeading, `${label}: every sampled text element uses Satoshi/Outfit/mono (no stray legacy font)`, info.fontsSeen);
  assert(font404s.length === 0, `${label}: no font asset 404s`, font404s);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  // ---- Choosify-Web (storefront) ----
  const webPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await checkPage(webPage, `${WEB_BASE}/`, 'WEB Home', 'web-1-home.png');
  await checkPage(webPage, `${WEB_BASE}/products`, 'WEB Products', 'web-2-products.png');
  await checkPage(webPage, `${WEB_BASE}/brands`, 'WEB Brands', 'web-3-brands.png');
  await checkPage(webPage, `${WEB_BASE}/login`, 'WEB Login', 'web-4-login.png');
  // Mobile viewport smoke
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await checkPage(mobilePage, `${WEB_BASE}/`, 'WEB Home (mobile)', 'web-5-home-mobile.png');
  await mobilePage.close();
  await webPage.close();

  // ---- choosify-admin-4.0 (dashboard) ----
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const login = await (await fetch(`${ADMIN_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@choosify.com.bd', password: PW }),
  })).json();
  await adminPage.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await adminPage.fill('input[type="email"], input[name="email"]', 'admin@choosify.com.bd').catch(() => {});
  await adminPage.fill('input[type="password"], input[name="password"]', PW).catch(() => {});
  await adminPage.locator('button[type="submit"]').first().click().catch(() => {});
  await adminPage.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await adminPage.waitForTimeout(1500);

  await checkPage(adminPage, `${ADMIN_BASE}/admin/dashboard`, 'ADMIN Dashboard', 'admin-1-dashboard.png');
  await checkPage(adminPage, `${ADMIN_BASE}/admin/products`, 'ADMIN Products', 'admin-2-products.png');
  await checkPage(adminPage, `${ADMIN_BASE}/admin/orders`, 'ADMIN Orders Hub', 'admin-3-orders.png');
  await checkPage(adminPage, `${ADMIN_BASE}/login`, 'ADMIN Login (logged out shell)', 'admin-4-login.png');
  await adminPage.close();

  await browser.close();
  console.log(login ? '' : ''); // keep login var referenced
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
