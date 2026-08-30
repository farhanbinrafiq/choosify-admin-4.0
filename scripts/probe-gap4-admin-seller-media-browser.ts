/**
 * Final gap-closure — real headed-capable browser UAT for Admin + Seller
 * media upload via the actually-reachable live surface.
 *
 * IMPORTANT FINDING FROM THIS PROBE'S DEVELOPMENT: the product-creation flow
 * a real user reaches by clicking the live "+ Add Product" button
 * (cms-mirror -> /admin/products/new -> ProductEditStudio.tsx, "Choosify
 * Product Visual Builder") has NO local-disk upload control — its media
 * drawer only offers paste-a-URL text fields. The components that DO have
 * real ProductImageUploader device-upload (src/pages/admin/ProductStudio.tsx,
 * AddProductModal.tsx) are not mounted on any route in src/App.tsx — dead
 * code, unreachable from the live app. This is a pre-existing product gap,
 * unrelated to this session's Consumer-media-migration scope, and is NOT
 * fixed here per "do not redesign architecture" — see the final report.
 *
 * Brand Studio (/admin/brand-studio/new, BrandEditStudio.tsx) IS reachable
 * and DOES have a real device-upload control (BrandImageUploadField, behind
 * the header section's "Edit" drawer) funneling through the same canonical
 * `/catalog/media/upload` chokepoint — used here as the real Admin/Seller
 * device-upload UAT surface instead.
 *
 * Usage: npx tsx scripts/probe-gap4-admin-seller-media-browser.ts
 */
import { chromium, type Page } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const PORT = Number(process.env.PORT || 3001);
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
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
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {}),
    page.click('form button[type="submit"]').catch(() => page.keyboard.press('Enter')),
  ]);
  await page.waitForTimeout(2000);
}

async function apiLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { accessToken?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login failed: ${res.status}`);
  return body.accessToken;
}

/** Real UI upload flow on the reachable Brand Studio route. */
async function uploadOneBrandImage(
  page: Page,
  label: string,
): Promise<{ ok: boolean; status?: number; url?: string; mediaId?: string }> {
  await page.goto(`${BASE}/admin/brand-studio/new`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  await page.getByRole('button', { name: 'Edit', exact: true }).first().click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1200);

  // index 0 is an unrelated topbar/import control; index 1 is the real
  // BrandImageUploadField cover-image input, confirmed by direct inspection.
  const fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0);
  assert(fileInputCount >= 2, `${label}: Brand Studio exposes a real local-disk file input`, fileInputCount);
  if (fileInputCount < 2) return { ok: false };

  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/catalog/media/upload'), { timeout: 20000 }).catch(() => null),
    page.locator('input[type="file"]').nth(1).setInputFiles(TEST_IMAGE),
  ]);
  assert(uploadResponse?.ok(), `${label}: real file picked from disk reaches POST /catalog/media/upload (2xx)`, uploadResponse?.status());
  if (!uploadResponse?.ok()) return { ok: false, status: uploadResponse?.status() };

  const body = (await uploadResponse.json().catch(() => ({}))) as { url?: string; mediaId?: string };
  await page.waitForTimeout(800);

  const imgSrc = await page
    .evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src') || '');
      return imgs.find((s) => s.includes('/media/')) || '';
    })
    .catch(() => '');
  assert(
    !!imgSrc && !imgSrc.startsWith('blob:'),
    `${label}: uploaded image renders via a real server URL, not a blob: local-only preview`,
    imgSrc,
  );

  return { ok: true, url: body.url, mediaId: body.mediaId };
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  // ================= ADMIN: real brand-image upload =================
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await login(adminPage, ADMIN_EMAIL, DEV_PASS);
  assert(adminPage.url().includes('/admin/'), 'Admin: real login reaches an /admin/ route', adminPage.url());
  await uploadOneBrandImage(adminPage, 'Admin');
  await adminPage.close();

  // ================= SELLER: real brand-image upload + persistence =================
  const sellerPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await login(sellerPage, SELLER_EMAIL, DEV_PASS);
  assert(sellerPage.url().includes('/admin/'), 'Seller: real login reaches an /admin/ route', sellerPage.url());
  const sellerUpload = await uploadOneBrandImage(sellerPage, 'Seller');
  await sellerPage.close();

  const uploadedMediaId = sellerUpload.mediaId || null;
  const uploadedUrl = sellerUpload.url || null;
  assert(!!uploadedMediaId && !!uploadedUrl, 'Seller upload returned a real media id + URL for restart/cross-account checks', {
    uploadedMediaId,
    uploadedUrl,
  });

  // ================= Persistence: immediately fetchable =================
  if (uploadedUrl) {
    const beforeRestart = await fetch(uploadedUrl.startsWith('http') ? uploadedUrl : `${BASE}${uploadedUrl}`);
    assert(beforeRestart.ok, 'Uploaded media is fetchable immediately after upload', beforeRestart.status);
  }

  // ================= Cross-account isolation: a DIFFERENT account cannot delete it =================
  if (uploadedMediaId) {
    const otherToken = await apiLogin('creator@choosify.com.bd', DEV_PASS).catch(() => null);
    if (otherToken) {
      const denyRes = await fetch(`${BASE}/api/v1/catalog/media/${encodeURIComponent(uploadedMediaId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert(denyRes.status === 403 || denyRes.status === 404, 'Cross-account: a different account cannot delete the seller-owned media', denyRes.status);
    } else {
      assert(false, 'Cross-account isolation check skipped — could not log in as a second account', 'creator login failed');
    }
  }

  // ================= Real API process restart, confirm persistence =================
  console.log('Restarting API server on port', PORT, '… (genuinely new OS process)');
  await killPort(PORT);
  await delay(2000);
  const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'ignore', shell: true, detached: true });
  child.unref();
  await waitForHealth();
  console.log('Server healthy after restart');

  if (uploadedUrl) {
    const afterRestart = await fetch(uploadedUrl.startsWith('http') ? uploadedUrl : `${BASE}${uploadedUrl}`);
    assert(afterRestart.ok, 'Uploaded media survives a real API process restart', afterRestart.status);
  }

  // Owner (seller) CAN delete their own upload — real API call, same auth the UI uses.
  if (uploadedMediaId) {
    const ownerToken = await apiLogin(SELLER_EMAIL, DEV_PASS);
    const ownDeleteRes = await fetch(`${BASE}/api/v1/catalog/media/${encodeURIComponent(uploadedMediaId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(ownDeleteRes.ok, 'Owner (seller) can delete their own uploaded media', ownDeleteRes.status);
  }

  console.log('\n=== GAP 4 ADMIN/SELLER MEDIA BROWSER UAT SUMMARY ===');
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
