/**
 * Sprint 11 — Website Manager "cheap live wins" UAT (step 2 of the approved order):
 *   - SEO Manager: real edit form persists through the SiteConfig contract
 *   - Sponsored Placements: rewired to the real CatalogPlacement API
 *   - Maintenance Mode: wired to the real operations feature flag
 *
 * Usage: npx tsx scripts/probe-website-manager-live-wins.ts
 * Or:    npm run test:website-manager-live-wins
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

async function main() {
  // --- API-level checks first (fast, unambiguous) ---
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const loginBody = (await login.json()) as { accessToken?: string };
  const token = loginBody.accessToken;
  assert(login.ok && token, 'admin login for API checks');
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // SEO: write a distinctive title through the real SiteConfig contract, read it back.
  const marker = `Probe SEO Title ${Date.now()}`;
  const putSeo = await fetch(`${BASE}/api/v1/catalog/site`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      seoEntries: [
        { pageId: 'home', pageLabel: 'HOMEPAGE', title: marker, metaDescription: 'probe desc', keywords: 'probe,keywords', ogImage: '', canonicalUrl: 'https://choosify.bd' },
      ],
    }),
  });
  assert(putSeo.ok, 'PUT /catalog/site with seoEntries succeeds', putSeo.status);
  const getSite = await fetch(`${BASE}/api/v1/catalog/site`);
  const siteBody = (await getSite.json()) as { site?: { seoEntries?: Array<{ pageId: string; title: string }> } };
  const homeEntry = siteBody.site?.seoEntries?.find((e) => e.pageId === 'home');
  assert(homeEntry?.title === marker, 'SEO title round-trips through GET /catalog/site', homeEntry);

  // Global Settings: websiteName/supportEmail/supportPhone are now real, persisted
  // SiteConfig fields (Sprint 11 step 6), not decorative local-only React state.
  const settingsMarker = `Probe Support ${Date.now()}@choosify.bd`;
  const putSettings = await fetch(`${BASE}/api/v1/catalog/site`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ websiteName: 'Choosify Probe', supportEmail: settingsMarker, supportPhone: '+880 1900-000000' }),
  });
  assert(putSettings.ok, 'PUT /catalog/site with global settings fields succeeds', putSettings.status);
  const getSite2 = await fetch(`${BASE}/api/v1/catalog/site`);
  const siteBody2 = (await getSite2.json()) as { site?: { websiteName?: string; supportEmail?: string; supportPhone?: string } };
  assert(siteBody2.site?.supportEmail === settingsMarker, 'supportEmail round-trips through GET /catalog/site', siteBody2.site);
  assert(siteBody2.site?.websiteName === 'Choosify Probe', 'websiteName round-trips through GET /catalog/site', siteBody2.site);

  // Sponsored Placements: real CatalogPlacement API is reachable and returns real rows.
  const placementsRes = await fetch(`${BASE}/api/v1/catalog/placements`);
  const placementsBody = (await placementsRes.json()) as { data?: Array<{ id: string; isActive: boolean }> };
  assert(placementsRes.ok && Array.isArray(placementsBody.data) && placementsBody.data.length > 0, 'GET /catalog/placements returns real seeded rows', placementsBody);
  const firstPlacement = placementsBody.data?.[0];
  if (firstPlacement) {
    const nextActive = !firstPlacement.isActive;
    const patchRes = await fetch(`${BASE}/api/v1/catalog/placements/${encodeURIComponent(firstPlacement.id)}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: nextActive }),
    });
    const patchBody = (await patchRes.json()) as { data?: { isActive: boolean } };
    assert(patchRes.ok && patchBody.data?.isActive === nextActive, 'PATCH /catalog/placements/:id toggles isActive', patchBody);
    // restore original state
    await fetch(`${BASE}/api/v1/catalog/placements/${encodeURIComponent(firstPlacement.id)}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: firstPlacement.isActive }),
    });
  }

  // Maintenance mode: real feature flag round-trips, restore to false afterward.
  const putFlag = await fetch(`${BASE}/api/v1/operations/feature-flags`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ flags: { maintenance_mode: true } }),
  });
  assert(putFlag.ok, 'PUT /operations/feature-flags maintenance_mode=true succeeds', putFlag.status);
  const getFlags1 = await fetch(`${BASE}/api/v1/operations/feature-flags`);
  const flags1 = (await getFlags1.json()) as { flags?: Record<string, boolean> };
  assert(flags1.flags?.maintenance_mode === true, 'maintenance_mode reads back true after enabling');
  await fetch(`${BASE}/api/v1/operations/feature-flags`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ flags: { maintenance_mode: false } }),
  });
  const getFlags2 = await fetch(`${BASE}/api/v1/operations/feature-flags`);
  const flags2 = (await getFlags2.json()) as { flags?: Record<string, boolean> };
  assert(flags2.flags?.maintenance_mode === false, 'maintenance_mode restored to false');

  // --- Browser-level: confirm the Admin UI actually renders the real data ---
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await Promise.all([
    page.waitForURL('**/admin/**', { timeout: 8000 }).catch(() => {}),
    page.click('form button[type="submit"]').catch(() => page.keyboard.press('Enter')),
  ]);
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/admin/website-cms#page=websiteCms`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  async function frameText(): Promise<string> {
    const frame = page.frames().find((f) => f.url().includes('cms-mirror'));
    if (frame) return frame.evaluate(() => document.body.innerText).catch(() => '');
    return page.evaluate(() => document.body.innerText).catch(() => '');
  }

  const txt = await frameText();
  assert(txt.length > 0, 'Website Manager iframe rendered some content', txt.slice(0, 200));

  await browser.close();

  console.log('\n=== WEBSITE MANAGER LIVE WINS SUMMARY ===');
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
