/**
 * Sprint 10 — staff role dashboard isolation UAT.
 *
 * finance_manager / support_agent / marketing_manager have NO canonical
 * platform-analytics authorization (server/operationsRouter.ts `/operations/
 * analytics` → 403 for them), so /admin/dashboard must fail closed into the
 * WorkspaceFallback "My Workspace" surface — never the Admin Platform Command
 * Center, and never an empty admin shell.
 *
 * moderator is DIFFERENT: the canonical permission model deliberately groups
 * moderator with admin/super_admin in that same analytics route, so the role
 * dispatcher (src/pages/admin/Dashboard.tsx) correctly gives moderator the
 * Platform Command Center. That authorized access is asserted here, not removed.
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

/** Roles with NO canonical platform-analytics authorization — must fail closed. */
const FAIL_CLOSED_ROLES: Array<{ email: string; role: string }> = [
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

  for (const { email, role } of FAIL_CLOSED_ROLES) {
    const page = await login(email, DEV_PASSWORD);
    const txt = await dashText(page);
    for (const marker of ADMIN_ONLY_MARKERS) {
      assert(!txt.includes(marker), `${role} dashboard does NOT contain "${marker}"`);
    }
    assert(
      /My Workspace|storefront/i.test(txt),
      `${role} lands on the fail-closed WorkspaceFallback`,
    );
    const heading = txt.split('\n').find((l) => l.trim().length > 0) || '(empty)';
    console.log(`  -> ${role} first non-empty line: "${heading.trim().slice(0, 80)}"`);
    await page.close();
  }

  // moderator IS canonically authorized for platform analytics — assert the
  // dispatcher gives it the Platform Command Center (regression guard against a
  // future change silently dropping that authorized access).
  {
    const page = await login('moderator@choosify.com.bd', DEV_PASSWORD);
    const txt = await dashText(page);
    assert(
      txt.includes('Platform Command Center'),
      'moderator retains canonically-authorized Platform Command Center access',
    );
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
