/**
 * Final gap-closure — real headed-capable browser UAT for the Consumer
 * avatar upload migration: real registration on the Web storefront, real
 * navigation to Dashboard > Settings, a real file picked from local disk,
 * confirms the resulting avatar is server-backed (not a data: URL / blob:
 * local-only preview), confirms it persists across a refresh AND a fresh
 * login, then confirms it survives a genuine Admin API process restart.
 *
 * Usage: npx tsx scripts/probe-gap4-consumer-avatar-browser.ts
 */
import { chromium, type Page } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';

const WEB_BASE = process.env.WEB_BASE || 'http://localhost:5173';
const API_BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const PORT = Number(process.env.PORT || 3001);
const TEST_IMAGE = path.join(process.env.TEMP || '/tmp', 'gap4-test-image.png');

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

async function loginOnWeb(page: Page, email: string, password: string) {
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  const loginBtn = page.locator('form').filter({ has: page.locator('#password') }).locator('button[type="submit"]');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
    loginBtn.click(),
  ]);
  await page.waitForTimeout(1500);
}

/**
 * The access token lives only in memory (never localStorage — see
 * authSession.ts) so a hard `page.goto('/dashboard...')` right after login
 * wipes it and bounces ProtectedRoute back to /login. Real users reach
 * Settings via the account-menu click, which is client-side SPA routing and
 * preserves the in-memory token — use that here instead of a URL navigation.
 */
async function goToDashboardSettings(page: Page) {
  await page.getByLabel('Open account menu', { exact: false }).click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.getByText('My Dashboard', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.getByText('Settings', { exact: false }).first().click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const stamp = Date.now();
  const email = `gap4-consumer-avatar-${stamp}@test.choosify.bd`;
  const password = 'Gap4Consumer!2026';

  // --- Real registration via the actual UI ---
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.click('text=Sign up');
  await page.fill('#full-name', 'Gap4 Avatar Probe');
  await page.fill('#email', email);
  await page.fill('#password', password);
  const [registerResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/register'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  assert(registerResponse?.ok(), 'Consumer: real UI registration reaches POST /auth/register (2xx)', registerResponse?.status());
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => undefined);

  // --- Real navigation to Dashboard > Settings (client-side, preserves the in-memory token) ---
  await goToDashboardSettings(page);

  const uploadBtn = page.getByText('Upload new photo', { exact: false }).first();
  const hasUploadBtn = await uploadBtn.count().catch(() => 0);
  assert(hasUploadBtn > 0, 'Consumer: Settings page exposes a real "Upload new photo" control', hasUploadBtn);

  let avatarUrl: string | null = null;
  if (hasUploadBtn > 0) {
    const fileInput = page.locator('input[type="file"]').first();
    const [uploadResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/catalog/media/upload'), { timeout: 20000 }).catch(() => null),
      fileInput.setInputFiles(TEST_IMAGE),
    ]);
    assert(uploadResponse?.ok(), 'Consumer: real file picked from disk reaches POST /catalog/media/upload (2xx) via the consumer-safe category gate', uploadResponse?.status());

    const [profileResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/profile'), { timeout: 15000 }).catch(() => null),
    ]);
    assert(profileResponse?.ok(), 'Consumer: avatarUrl is persisted via PATCH /auth/profile', profileResponse?.status());

    await page.waitForTimeout(1000);
    avatarUrl = await page
      .evaluate(() => {
        const img = document.querySelector('img[alt="Profile"]') as HTMLImageElement | null;
        return img?.src || null;
      })
      .catch(() => null);
    assert(
      !!avatarUrl && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('blob:') && avatarUrl.includes('/media/'),
      'Consumer: avatar renders via a real server media URL, not a data:/blob: local-only preview',
      avatarUrl,
    );
  }

  // --- Persistence: refresh the page (relies on GlobalStateContext's silent
  // cookie-based refreshSession() bootstrap to restore the in-memory token) ---
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const avatarAfterRefresh = await page
    .evaluate(() => (document.querySelector('img[alt="Profile"]') as HTMLImageElement | null)?.src || null)
    .catch(() => null);
  assert(avatarAfterRefresh === avatarUrl, 'Consumer: avatar survives a page refresh (server-fetched, not lost)', {
    before: avatarUrl,
    after: avatarAfterRefresh,
  });

  // --- Persistence: fresh login (new page context, no cached client state) ---
  const freshPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await loginOnWeb(freshPage, email, password);
  await goToDashboardSettings(freshPage);
  const avatarAfterFreshLogin = await freshPage
    .evaluate(() => (document.querySelector('img[alt="Profile"]') as HTMLImageElement | null)?.src || null)
    .catch(() => null);
  assert(avatarAfterFreshLogin === avatarUrl, 'Consumer: avatar survives a completely fresh login session', {
    before: avatarUrl,
    after: avatarAfterFreshLogin,
  });
  await freshPage.close();
  await page.close();

  // --- Real API process restart, confirm persistence ---
  console.log('Restarting API server on port', PORT, '… (genuinely new OS process)');
  await killPort(PORT);
  await delay(2000);
  const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'ignore', shell: true, detached: true });
  child.unref();
  await waitForHealth();
  console.log('Server healthy after restart');

  if (avatarUrl) {
    const afterRestart = await fetch(avatarUrl);
    assert(afterRestart.ok, 'Consumer avatar media file survives a real API process restart', afterRestart.status);
  }

  const restartPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await loginOnWeb(restartPage, email, password);
  await goToDashboardSettings(restartPage);
  const avatarAfterRestart = await restartPage
    .evaluate(() => (document.querySelector('img[alt="Profile"]') as HTMLImageElement | null)?.src || null)
    .catch(() => null);
  assert(avatarAfterRestart === avatarUrl, 'Consumer: /auth/me returns the same avatarUrl after a real server restart', {
    before: avatarUrl,
    after: avatarAfterRestart,
  });
  await restartPage.close();

  await browser.close();

  console.log('\n=== GAP 4 CONSUMER AVATAR BROWSER UAT SUMMARY ===');
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
