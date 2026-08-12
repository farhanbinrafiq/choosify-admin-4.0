/**
 * JWT-backed search + impersonation probe (after rate-limit reset).
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const body = (await res.json()) as { accessToken?: string; uid?: string; error?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login ${email}: ${res.status} ${body.error || ''}`);
  return { token: body.accessToken, uid: body.uid || '' };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${admin.token}` } }).then((r) =>
    r.json(),
  );
  const sellerMe = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${seller.token}` } }).then((r) =>
    r.json(),
  );

  const search = await fetch(`${API}/search?q=CF-&limitPerGroup=5`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const searchBody = await search.json().catch(() => ({}));

  const orderSearch = await fetch(`${API}/search?q=CH-&limitPerGroup=5`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const orderBody = await orderSearch.json().catch(() => ({}));

  const productSearch = await fetch(`${API}/search?q=Sony&limitPerGroup=5`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const productBody = await productSearch.json().catch(() => ({}));

  const sellerSearch = await fetch(`${API}/search?q=order&limitPerGroup=5`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  const sellerSearchBody = await sellerSearch.json().catch(() => ({}));

  const start = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: seller.uid || sellerMe?.id || sellerMe?.data?.id, reason: 'Probe support' }),
  });
  const startBody = await start.json().catch(() => ({}));

  let bannerOk = false;
  let myProfileDuring = '';
  let exitOk = false;
  let bannerGone = false;

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  try {
    if (startBody.accessToken) {
      await page.goto(`${BASE}/login`);
      await page.evaluate(
        ({ token, original }) => {
          localStorage.setItem('choosify_impersonation_original_token', original);
          localStorage.setItem('choosify_auth_token', token);
        },
        { token: startBody.accessToken as string, original: admin.token },
      );
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      bannerOk = await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const bannerAfterRefresh = await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false);
      bannerOk = bannerOk && bannerAfterRefresh;

      // My Profile during impersonation
      const trigger = page.locator('.cms-mirror-profile-trigger').first();
      if (await trigger.count()) {
        await trigger.click();
        await page.waitForTimeout(400);
        await page.getByRole('menuitem', { name: 'My Profile' }).click();
        await page.waitForTimeout(1500);
        myProfileDuring = page.url();
      }

      const exit = await fetch(`${API}/auth/impersonate/exit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${startBody.accessToken}` },
      });
      exitOk = exit.ok;
      await page.evaluate((original) => {
        localStorage.setItem('choosify_auth_token', original);
        localStorage.removeItem('choosify_impersonation_original_token');
      }, admin.token);
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      bannerGone = !(await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false));

      // Search UI with JWT
      const searchVisible = await page
        .locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]')
        .isVisible()
        .catch(() => false);
      if (searchVisible) {
        await page.locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]').click();
        await page.waitForTimeout(300);
        await page.locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]').fill('CF-');
        await page.waitForTimeout(1200);
      }
      const dropText = (await page.locator('.choosify-omni-search-dropdown').innerText().catch(() => '')).slice(0, 600);

      console.log(
        JSON.stringify(
          {
            adminRole: me?.role || me?.data?.role,
            adminCf: me?.choosifyUserId || me?.data?.choosifyUserId,
            sellerUid: seller.uid,
            sellerCf: sellerMe?.choosifyUserId || sellerMe?.data?.choosifyUserId,
            searchCfStatus: search.status,
            searchCfGroups: (searchBody?.data?.groups || searchBody?.groups || []).map((g: any) => ({
              group: g.group,
              n: (g.items || []).length,
              sample: (g.items || [])[0],
            })),
            orderSearchStatus: orderSearch.status,
            orderGroups: (orderBody?.data?.groups || orderBody?.groups || []).map((g: any) => ({
              group: g.group,
              n: (g.items || []).length,
            })),
            productSearchStatus: productSearch.status,
            productGroups: (productBody?.data?.groups || productBody?.groups || []).map((g: any) => ({
              group: g.group,
              n: (g.items || []).length,
            })),
            sellerSearchStatus: sellerSearch.status,
            sellerSearchGroups: (sellerSearchBody?.data?.groups || sellerSearchBody?.groups || []).map((g: any) => ({
              group: g.group,
              n: (g.items || []).length,
            })),
            impersonateStart: start.status,
            impersonateStartOk: Boolean(startBody.success),
            bannerOk,
            myProfileDuring,
            exitOk,
            bannerGone,
            searchVisible,
            dropText,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(JSON.stringify({ startStatus: start.status, startBody }, null, 2));
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
