/**
 * Sprint 10 security regression — dashboard role isolation.
 * Catches reintroduction of the "!seller && !creator => admin" fail-open pattern
 * in public/cms-mirror/app.html (and any future equivalent).
 *
 * Usage: npx tsx scripts/probe-role-isolation.ts
 * Or:    npm run test:role-isolation
 */
import { chromium } from 'playwright-core';

const ADMIN_BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

const ADMIN_ONLY_MARKERS = [
  'Platform Command Center',
  'GMV / REVENUE',
  'FINANCIAL OPERATIONS',
  'MARKETPLACE HEALTH',
  'PLATFORM ACTION CENTER',
  'CMS PUBLISH HEALTH',
  'Pending Payouts',
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  async function login(email: string, password: string) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await Promise.all([
      page.waitForURL('**/admin/**', { timeout: 8000 }).catch(() => {}),
      page.click('form button[type="submit"]').catch(() => page.keyboard.press('Enter')),
    ]);
    await page.waitForTimeout(2200);
    return page;
  }

  async function dashText(page: import('playwright-core').Page): Promise<string> {
    const frame = page.frames().find((f) => f.url().includes('cms-mirror'));
    if (frame) return frame.evaluate(() => document.body.innerText).catch(() => '');
    return page.evaluate(() => document.body.innerText).catch(() => '');
  }

  // --- Admin: MUST see platform-wide data ---
  {
    const page = await login(ADMIN_EMAIL, ADMIN_PASS);
    const txt = await dashText(page);
    assert(/Platform Command Center/i.test(txt), 'Admin dashboard shows Platform Command Center');
    assert(/GMV/i.test(txt), 'Admin dashboard shows GMV');
    await page.close();
  }

  // --- Approved Seller: seller dashboard, no admin markers ---
  {
    const page = await login('seller@choosify.com.bd', ADMIN_PASS);
    const txt = await dashText(page);
    assert(/Seller Command Center/i.test(txt), 'Seller dashboard shows Seller Command Center');
    for (const marker of ADMIN_ONLY_MARKERS) {
      assert(!txt.includes(marker), `Seller dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  // --- Approved Creator: creator dashboard, no admin markers ---
  {
    const page = await login('creator@choosify.com.bd', ADMIN_PASS);
    const txt = await dashText(page);
    assert(/Creator Command Center/i.test(txt), 'Creator dashboard shows Creator Command Center');
    for (const marker of ADMIN_ONLY_MARKERS) {
      assert(!txt.includes(marker), `Creator dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  // --- Consumer (role 'user'): dedicated personal dashboard, no admin markers ---
  {
    const stamp = Date.now();
    const email = `role-isolation-consumer-${stamp}@test.choosify.bd`;
    const reg = await fetch(`${ADMIN_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'RoleTest!2026', fullName: 'Role Isolation Consumer' }),
    });
    if (!reg.ok) throw new Error(`consumer register failed: ${reg.status}`);
    const page = await login(email, 'RoleTest!2026');
    const txt = await dashText(page);
    assert(/My Dashboard/i.test(txt), 'Consumer dashboard shows My Dashboard (not Platform Command Center)');
    for (const marker of ADMIN_ONLY_MARKERS) {
      assert(!txt.includes(marker), `Consumer dashboard does NOT contain "${marker}"`);
    }
    await page.close();
  }

  await browser.close();

  console.log('\n=== ROLE ISOLATION REGRESSION SUMMARY ===');
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
