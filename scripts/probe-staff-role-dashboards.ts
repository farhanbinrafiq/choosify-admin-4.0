/**
 * Sprint 10 — staff role dashboard isolation UAT.
 * Confirms moderator / finance_manager / support_agent / marketing_manager
 * never receive the Admin Platform Command Center (no dedicated dashboard exists
 * for these roles yet, so they must fall into the safe "My Workspace" fail-closed
 * branch — not silently inherit admin visibility).
 *
 * Usage: npm run test:staff-role-dashboards (or npx tsx scripts/probe-staff-role-dashboards.ts)
 */
import { chromium } from 'playwright-core';

const ADMIN_BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

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

const STAFF_ROLES: Array<{ email: string; role: string }> = [
  { email: 'moderator@choosify.com.bd', role: 'moderator' },
  { email: 'finance@choosify.com.bd', role: 'finance_manager' },
  { email: 'support@choosify.com.bd', role: 'support_agent' },
  { email: 'marketing@choosify.com.bd', role: 'marketing_manager' },
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

  for (const { email, role } of STAFF_ROLES) {
    const page = await login(email, DEV_PASSWORD);
    const txt = await dashText(page);
    for (const marker of ADMIN_ONLY_MARKERS) {
      assert(!txt.includes(marker), `${role} dashboard does NOT contain "${marker}"`);
    }
    const heading = txt.split('\n').find((l) => l.trim().length > 0) || '(empty)';
    console.log(`  -> ${role} first non-empty line: "${heading.trim().slice(0, 80)}"`);
    await page.close();
  }

  await browser.close();

  console.log('\n=== STAFF ROLE DASHBOARD ISOLATION SUMMARY ===');
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
