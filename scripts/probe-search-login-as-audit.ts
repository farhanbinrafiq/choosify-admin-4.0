/**
 * Browser audit: dashboard Global Search overlay + Login As User visibility.
 * Prefer TempRole for UI checks; JWT login for impersonation when not rate-limited.
 */
import { chromium, type Page } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

async function launch() {
  return chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
}

async function ensureAdminTemp(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  const adminBtn = page.getByRole('button', { name: 'Admin', exact: true });
  if (await adminBtn.count()) {
    await adminBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await launch();
  const page = await browser.newPage();
  const report: Record<string, unknown> = {};

  try {
    await ensureAdminTemp(page);

    // --- SEARCH ---
    const searchAnchor = page.locator('.cms-mirror-search-anchor');
    const searchInput = page.locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]');
    const searchBtn = page.locator('.cms-mirror-search-anchor button', { hasText: 'SEARCH' });
    report.searchAnchorVisible = await searchAnchor.isVisible().catch(() => false);
    report.searchInputVisible = await searchInput.isVisible().catch(() => false);
    report.searchButtonVisible = await searchBtn.isVisible().catch(() => false);
    report.oldIframeSearchHidden = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[title="Choosify Admin CMS"]') as HTMLIFrameElement | null;
      const doc = iframe?.contentDocument;
      if (!doc) return 'no-iframe-doc';
      const dead = Array.from(doc.querySelectorAll('input')).find((el) =>
        (el.getAttribute('placeholder') || '').toLowerCase().includes('search catalog'),
      );
      return dead ? 'OLD_INPUT_STILL_PRESENT' : 'old_input_gone';
    });

    if (report.searchInputVisible) {
      await searchInput.click();
      await page.waitForTimeout(400);
      const dropdown = page.locator('.choosify-omni-search-dropdown');
      report.dropdownOpenOnFocus = await dropdown.isVisible().catch(() => false);
      const dropdownText = report.dropdownOpenOnFocus
        ? await dropdown.innerText().catch(() => '')
        : '';
      report.emptyHasRecent = /Recent Searches/i.test(dropdownText);
      report.emptyHasQuickAccess = /Quick Access/i.test(dropdownText);
      report.emptyHasClear = /Clear/i.test(dropdownText);

      await searchInput.fill('CF-');
      await page.waitForTimeout(900);
      const afterType = await dropdown.innerText().catch(() => '');
      report.typedCfText = afterType.slice(0, 400);
      report.hasLiveGroups = /USERS|ORDERS|PRODUCTS|Pages|Customers|Brands/i.test(afterType);
      report.noResultsOrLoading = /No results|Searching|Loading/i.test(afterType) || afterType.length > 0;

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      report.closedOnEscape = !(await dropdown.isVisible().catch(() => false));
    }

    // --- LOGIN AS on UnifiedProfileShell ---
    await page.goto(`${BASE}/seller/rahim`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const loginAsUpe = page.getByRole('button', { name: /Login As User/i });
    report.upeLoginAsVisible = await loginAsUpe.isVisible().catch(() => false);

    // Own admin profile should NOT show Login As
    await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    report.adminOwnLoginAsVisible = await page
      .getByRole('button', { name: /Login As User/i })
      .isVisible()
      .catch(() => false);

    // --- JWT impersonation (best effort) ---
    try {
      const loginRes = await page.request.post(`${BASE}/api/v1/auth/login`, {
        data: { email: 'admin@choosify.com.bd', password: DEV_PASSWORD },
      });
      report.jwtLoginStatus = loginRes.status();
      if (loginRes.ok()) {
        const body = await loginRes.json();
        await page.goto(`${BASE}/login`);
        await page.evaluate((t) => localStorage.setItem('choosify_auth_token', t), body.accessToken);
        await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        report.jwtSearchVisible = await page
          .locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]')
          .isVisible()
          .catch(() => false);

        // Try start impersonation against a seller if we can find seller uid
        const me = await page.request.get(`${BASE}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${body.accessToken}` },
        });
        report.meStatus = me.status();

        const sellerLogin = await page.request.post(`${BASE}/api/v1/auth/login`, {
          data: { email: 'seller@choosify.com.bd', password: DEV_PASSWORD },
        });
        if (sellerLogin.ok()) {
          const sellerBody = await sellerLogin.json();
          const sellerUid = sellerBody.uid;
          const start = await page.request.post(`${BASE}/api/v1/auth/impersonate/start`, {
            headers: { Authorization: `Bearer ${body.accessToken}` },
            data: { targetUserId: sellerUid, reason: 'Probe support session' },
          });
          report.impersonateStartStatus = start.status();
          const startBody = await start.json().catch(() => ({}));
          report.impersonateStartOk = Boolean(startBody.success && startBody.accessToken);
          if (startBody.accessToken) {
            await page.evaluate(
              ({ token, original }) => {
                localStorage.setItem('choosify_impersonation_original_token', original);
                localStorage.setItem('choosify_auth_token', token);
              },
              { token: startBody.accessToken as string, original: body.accessToken as string },
            );
            await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            report.bannerVisible = await page
              .locator('.cms-mirror-impersonation-banner')
              .isVisible()
              .catch(() => false);
            report.bannerText = report.bannerVisible
              ? await page.locator('.cms-mirror-impersonation-banner').innerText()
              : '';

            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            report.bannerAfterRefresh = await page
              .locator('.cms-mirror-impersonation-banner')
              .isVisible()
              .catch(() => false);

            // Exit
            const exit = await page.request.post(`${BASE}/api/v1/auth/impersonate/exit`, {
              headers: { Authorization: `Bearer ${startBody.accessToken}` },
            });
            report.impersonateExitStatus = exit.status();
            await page.evaluate((original) => {
              localStorage.setItem('choosify_auth_token', original);
              localStorage.removeItem('choosify_impersonation_original_token');
            }, body.accessToken as string);
            await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1500);
            report.bannerGoneAfterExit = !(await page
              .locator('.cms-mirror-impersonation-banner')
              .isVisible()
              .catch(() => false));
          } else {
            report.impersonateStartBody = startBody;
          }
        }
      }
    } catch (e) {
      report.jwtError = e instanceof Error ? e.message : String(e);
    }

    const searchPass =
      report.searchInputVisible === true &&
      report.searchButtonVisible === true &&
      report.dropdownOpenOnFocus === true &&
      report.emptyHasRecent === true &&
      report.oldIframeSearchHidden === 'old_input_gone';

    const loginAsPass = report.upeLoginAsVisible === true && report.adminOwnLoginAsVisible === false;

    report.SEARCH_PASS = searchPass;
    report.LOGIN_AS_UI_PASS = loginAsPass;
    console.log(JSON.stringify(report, null, 2));
    console.log(searchPass && loginAsPass ? 'PROBE_PASS' : 'PROBE_PARTIAL_OR_FAIL');
    process.exit(searchPass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
