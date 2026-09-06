/**
 * Creator Economy removal QA -- confirms the placeholder route/nav entries
 * are gone for both super_admin and creator roles, the old URL redirects to
 * the canonical Creators Management page instead of 404ing, and Creators
 * Management / Creator Studio / Feature Access still work normally.
 *
 * Usage: npx tsx scripts/probe-creator-economy-removal-qa.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.PROBE_API_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_creator-economy-removal-qa');
mkdirSync(OUT, { recursive: true });

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function loginAndGoto(page: any, email: string, url: string) {
  await page.goto(`${API_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await page.fill('input[type="email"], input[name="email"]', email).catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', PW).catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  // ---- Super Admin: sidebar + redirect ----
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await loginAndGoto(adminPage, 'admin@choosify.com.bd', `${API_BASE}/admin/dashboard`);
  await adminPage.screenshot({ path: join(OUT, '1-admin-dashboard-sidebar.png'), fullPage: false });
  const adminSidebarHasCreatorEconomy = await adminPage.evaluate(() =>
    Array.from(document.querySelectorAll('.admin-workspace__nav-label')).some((el) => el.textContent?.trim() === 'Creator Economy'),
  );
  assert(!adminSidebarHasCreatorEconomy, 'A1: Super Admin sidebar no longer shows "Creator Economy"');

  await adminPage.goto(`${API_BASE}/admin/creator-hub`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForTimeout(1500);
  console.log('redirect result URL:', adminPage.url());
  await adminPage.screenshot({ path: join(OUT, '2-creator-hub-redirect-result.png'), fullPage: false });
  assert(adminPage.url().includes('/admin/creator-studio'), 'A2: /admin/creator-hub redirects to /admin/creator-studio (canonical Creators Management)', adminPage.url());
  const bodyTextAfterRedirect = await adminPage.evaluate(() => document.body.innerText.slice(0, 200));
  assert(!bodyTextAfterRedirect.includes('404') && !bodyTextAfterRedirect.toLowerCase().includes('not found'), 'A3: redirected page is not a 404/broken page', bodyTextAfterRedirect);

  // ---- Creators Management page itself still works ----
  await adminPage.goto(`${API_BASE}/admin/creator-studio`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.screenshot({ path: join(OUT, '3-creator-studio-still-works.png'), fullPage: false });
  const creatorStudioLoaded = await adminPage.evaluate(() => document.body.innerText.length > 200);
  assert(creatorStudioLoaded, 'A4: Creator Studio / Creators Management page still loads real content');

  // ---- Feature Access Entitlements: Creator tab no longer offers "Creator Economy" toggle ----
  await adminPage.goto(`${API_BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForTimeout(1500);
  await adminPage.locator('button:has-text("CREATOR")').first().click({ timeout: 8000 }).catch(() => {});
  await adminPage.waitForTimeout(800);
  await adminPage.screenshot({ path: join(OUT, '4-feature-access-creator-tab.png'), fullPage: true });
  const hasCreatorEconomyToggle = await adminPage.evaluate(() => document.body.innerText.includes('Creator Economy'));
  assert(!hasCreatorEconomyToggle, 'A5: Feature Access Entitlements no longer lists a "Creator Economy" toggle');
  await adminPage.close();

  // ---- Creator role: sidebar no longer shows Creator Economy/Collaborations-to-nowhere ----
  const creatorPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await loginAndGoto(creatorPage, 'creator@choosify.com.bd', `${API_BASE}/admin/dashboard`);
  await creatorPage.screenshot({ path: join(OUT, '5-creator-role-sidebar.png'), fullPage: false });
  const creatorSidebarText = await creatorPage.evaluate(() => document.body.innerText);
  console.log('creator sidebar text sample:', creatorSidebarText.slice(0, 500));
  assert(!creatorSidebarText.includes('Creator Economy'), 'B1: Creator role sidebar no longer shows "Creator Economy"');
  await creatorPage.close();

  await browser.close();
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
