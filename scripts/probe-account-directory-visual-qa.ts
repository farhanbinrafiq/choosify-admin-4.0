/**
 * Visual QA for the Account Directory & Profile Consistency pass.
 * Usage: npx tsx scripts/probe-account-directory-visual-qa.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_directory-qa');
mkdirSync(OUT, { recursive: true });

async function login(email: string) {
  const b = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  }).then((r) => r.json());
  if (!b.accessToken) throw new Error(`login failed for ${email}`);
  return b as { accessToken: string; uid: string };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  // ---- Admin session ----
  const adminCtx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.addInitScript((t: string) => { try { localStorage.setItem('choosify_auth_token', t); } catch {} }, admin.accessToken);

  await adminPage.goto(`${BASE}/admin/consumers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForTimeout(4000);
  await adminPage.screenshot({ path: join(OUT, '1-consumer-management.png'), fullPage: false });

  // Find a directory row with a real photo (img) vs one with initials (no img in the avatar slot).
  const rowsInfo = await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    return rows.slice(0, 12).map((r) => ({
      hasImg: Boolean(r.querySelector('img')),
      text: (r.textContent || '').slice(0, 60),
    }));
  });
  console.log('directory rows (first 12):', JSON.stringify(rowsInfo));

  // Screenshot the whole table for the with/without-photo comparison (item 2/3).
  await adminPage.screenshot({ path: join(OUT, '2-3-directory-rows.png'), fullPage: false });

  // Open a Consumer Profile.
  const firstRowLink = adminPage.locator('tbody tr').first();
  await firstRowLink.click({ timeout: 8000 }).catch(() => {});
  await adminPage.waitForTimeout(3000);
  await adminPage.screenshot({ path: join(OUT, '4-consumer-profile.png'), fullPage: true });

  // Seller/Creator tabs on the same directory page (avatar reuse proof).
  // NOTE: the query param is `viewMode`, not `view` — Consumers.tsx reads
  // searchParams.get('viewMode').
  await adminPage.goto(`${BASE}/admin/consumers?viewMode=creators`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await adminPage.waitForTimeout(3000);
  await adminPage.screenshot({ path: join(OUT, '9-creator-directory.png'), fullPage: false });

  await adminCtx.close();

  // ---- Seller session ----
  const sellerCtx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const sellerPage = await sellerCtx.newPage();
  await sellerPage.addInitScript((t: string) => { try { localStorage.setItem('choosify_auth_token', t); } catch {} }, seller.accessToken);

  // This dashboard shell keeps background network activity going
  // (notifications polling etc.) so `networkidle` never resolves —
  // domcontentloaded + an explicit wait for known page content is the
  // reliable strategy here, not a longer timeout.
  await sellerPage.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sellerPage.waitForSelector('text=My Customers', { timeout: 20000 }).catch(() => {});
  await sellerPage.waitForTimeout(5000);
  await sellerPage.screenshot({ path: join(OUT, '5-seller-my-customers.png'), fullPage: false });

  const custRowsInfo = await sellerPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"]'));
    return rows.slice(0, 10).map((r) => ({ hasImg: Boolean(r.querySelector('img')), text: (r.textContent || '').slice(0, 60) }));
  });
  console.log('seller customer rows:', JSON.stringify(custRowsInfo));
  await sellerPage.screenshot({ path: join(OUT, '6-seller-customer-row-avatar.png'), fullPage: false });

  // Open the first customer's profile.
  const firstViewBtn = sellerPage.locator('button:has-text("View")').first();
  await firstViewBtn.click({ timeout: 8000 }).catch(() => {});
  await sellerPage.waitForTimeout(3000);
  await sellerPage.screenshot({ path: join(OUT, '7-seller-customer-profile.png'), fullPage: true });
  console.log('final URL after View click:', sellerPage.url());

  await browser.close();
  console.log('screens written to', OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
