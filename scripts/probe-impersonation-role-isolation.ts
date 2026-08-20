/**
 * Sprint 10 — Login As (impersonation) role-isolation recheck.
 * Confirms Admin -> Login As Consumer shows the Consumer dashboard (not a residual
 * Platform Command Center), and Exit correctly restores the Admin's own dashboard.
 *
 * Usage: npm run test:impersonation-role-isolation
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
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
  // 1. Register a fresh consumer as the impersonation target.
  const stamp = Date.now();
  const email = `imp-target-${stamp}@test.choosify.bd`;
  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'RoleTest!2026', fullName: 'Impersonation Target' }),
  });
  if (!reg.ok) throw new Error(`consumer register failed: ${reg.status}`);
  const regBody = await reg.json();
  const targetUserId = regBody.uid;
  assert(!!targetUserId, 'consumer target registered with uid', regBody);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await Promise.all([
    page.waitForURL('**/admin/**', { timeout: 8000 }).catch(() => {}),
    page.click('form button[type="submit"]').catch(() => page.keyboard.press('Enter')),
  ]);
  await page.waitForTimeout(2000);

  async function dashText(): Promise<string> {
    const frame = page.frames().find((f) => f.url().includes('cms-mirror'));
    if (frame) return frame.evaluate(() => document.body.innerText).catch(() => '');
    return page.evaluate(() => document.body.innerText).catch(() => '');
  }

  const adminTextBefore = await dashText();
  assert(/Platform Command Center/i.test(adminTextBefore), 'Admin sees Platform Command Center before impersonation');

  // 2. Start impersonation exactly the way the UI does: call the API with the admin's
  //    current token, then swap localStorage token to the returned target accessToken.
  const impResult = await page.evaluate(
    async ({ targetUserId, reason }) => {
      const token = localStorage.getItem('choosify_auth_token');
      const res = await fetch('/api/v1/auth/impersonate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId, reason }),
      });
      const body = await res.json();
      if (!res.ok) return { ok: false, status: res.status, body };
      localStorage.setItem('choosify_impersonation_original_token', token || '');
      localStorage.setItem('choosify_auth_token', body.accessToken);
      return { ok: true, targetRole: body.targetRole };
    },
    { targetUserId, reason: 'Role isolation regression check' },
  );
  assert(impResult.ok, 'impersonate/start succeeded', impResult);
  assert(impResult.targetRole === 'user', 'impersonation targetRole is user (consumer)', impResult);

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const impersonatedText = await dashText();
  assert(/My Dashboard/i.test(impersonatedText), 'Impersonated Consumer view shows My Dashboard');
  for (const marker of ADMIN_ONLY_MARKERS) {
    assert(!impersonatedText.includes(marker), `Impersonated Consumer view does NOT contain "${marker}"`);
  }

  // 3. Exit impersonation and confirm Admin's own Platform Command Center is restored.
  await page.evaluate(async () => {
    const token = localStorage.getItem('choosify_auth_token');
    await fetch('/api/v1/auth/impersonate/exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {});
    const original = localStorage.getItem('choosify_impersonation_original_token');
    if (original) localStorage.setItem('choosify_auth_token', original);
    localStorage.removeItem('choosify_impersonation_original_token');
  });
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  // Poll instead of a fixed wait: the CMS-mirror dashboard's own client-side
  // fetches (nav-attention counts, platform stats) can take a few seconds,
  // and a too-tight fixed timeout here samples the page mid-render.
  let restoredText = '';
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(750);
    restoredText = await dashText();
    if (/Platform Command Center/i.test(restoredText)) break;
  }
  assert(/Platform Command Center/i.test(restoredText), 'Exit impersonation restores Platform Command Center for Admin');
  assert(/GMV/i.test(restoredText), 'Exit impersonation restores GMV visibility for Admin');

  await browser.close();

  console.log('\n=== IMPERSONATION ROLE ISOLATION SUMMARY ===');
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
