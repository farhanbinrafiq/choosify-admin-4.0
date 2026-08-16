/**
 * Sprint 11 — final headed-equivalent UAT sweep (Phase 20). Uses headless real
 * Chrome (headed hangs in this sandboxed Windows environment, established in
 * Sprint 10) with full DOM text extraction as verification evidence.
 *
 * Usage: npx tsx scripts/probe-sprint11-uat.ts
 * Or:    npm run test:sprint11-uat
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  async function loginAndGoto(email: string, password: string, path?: string) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await Promise.all([
      page.waitForURL('**/admin/**', { timeout: 8000 }).catch(() => {}),
      page.click('form button[type="submit"]').catch(() => page.keyboard.press('Enter')),
    ]);
    await page.waitForTimeout(2200);
    if (path) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }
    return page;
  }

  async function frameText(page: import('playwright-core').Page): Promise<string> {
    const frame = page.frames().find((f) => f.url().includes('cms-mirror'));
    if (frame) return frame.evaluate(() => document.body.innerText).catch(() => '');
    return page.evaluate(() => document.body.innerText).catch(() => '');
  }

  // --- ADMIN ---
  {
    const page = await loginAndGoto(ADMIN_EMAIL, DEV_PASS);
    const dashText = await frameText(page);
    assert(/Platform Command Center/i.test(dashText), 'Admin: Dashboard shows Platform Command Center');
    assert(/GMV/i.test(dashText), 'Admin: Dashboard shows GMV');

    await page.goto(`${BASE}/admin/website-cms`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const wmText = await frameText(page);
    assert(wmText.length > 0, 'Admin: Website Manager renders');

    await page.goto(`${BASE}/admin/feature-access`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const featAccessText = await page.evaluate(() => document.body.innerText).catch(() => '');
    assert(featAccessText.length > 0, 'Admin: Feature Access & Entitlements page renders');

    await page.close();
  }

  // --- SELLER ---
  {
    const page = await loginAndGoto('seller@choosify.com.bd', DEV_PASS);
    const dashText = await frameText(page);
    assert(/Seller Command Center/i.test(dashText), 'Seller: Dashboard shows Seller Command Center');
    for (const marker of ['Platform Command Center', 'GMV / REVENUE', 'FINANCIAL OPERATIONS', 'MARKETPLACE HEALTH', 'PLATFORM ACTION CENTER']) {
      assert(!dashText.includes(marker), `Seller: Dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  // --- CREATOR ---
  {
    const page = await loginAndGoto('creator@choosify.com.bd', DEV_PASS);
    const dashText = await frameText(page);
    assert(/Creator Command Center/i.test(dashText), 'Creator: Dashboard shows Creator Command Center');
    for (const marker of ['Platform Command Center', 'GMV / REVENUE', 'FINANCIAL OPERATIONS', 'MARKETPLACE HEALTH', 'PLATFORM ACTION CENTER']) {
      assert(!dashText.includes(marker), `Creator: Dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  // --- CONSUMER ---
  {
    const stamp = Date.now();
    const email = `sprint11-uat-consumer-${stamp}@test.choosify.bd`;
    await fetch(`${BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'RoleTest!2026', fullName: 'Sprint11 UAT Consumer' }),
    });
    const page = await loginAndGoto(email, 'RoleTest!2026');
    const dashText = await frameText(page);
    assert(/My Dashboard/i.test(dashText), 'Consumer: Dashboard shows My Dashboard');
    for (const marker of ['Platform Command Center', 'GMV / REVENUE', 'FINANCIAL OPERATIONS', 'MARKETPLACE HEALTH', 'PLATFORM ACTION CENTER']) {
      assert(!dashText.includes(marker), `Consumer: Dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  await browser.close();

  console.log('\n=== SPRINT 11 UAT SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
