import { chromium } from 'playwright-core';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_directory-qa');

async function main() {
  const admin = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@choosify.com.bd', password: PW }),
  }).then((r) => r.json());
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  await page.addInitScript((t: string) => { try { localStorage.setItem('choosify_auth_token', t); } catch {} }, admin.accessToken);

  await page.goto(`${BASE}/admin/consumers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.locator('input[placeholder*="Search consumers" i]').first().fill('ezbooking.farhan');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, '2-consumer-row-with-photo.png'), fullPage: false });

  await page.locator('tbody tr').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT, '4b-consumer-profile-with-photo.png'), fullPage: true });

  await browser.close();
  console.log('done');
}
main().catch((e) => { console.error(e); process.exit(1); });
