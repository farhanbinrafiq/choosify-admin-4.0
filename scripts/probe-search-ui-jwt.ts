import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const b = (await r.json()) as { accessToken?: string };
  if (!r.ok || !b.accessToken) throw new Error(`${email} ${r.status}`);
  return b.accessToken;
}

async function main() {
  const token = await login('admin@choosify.com.bd');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem('choosify_auth_token', t), token);
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const searchOk = await page
    .locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]')
    .isVisible();
  await page.locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]').click();
  await page.waitForTimeout(300);
  const idle = await page.locator('.choosify-omni-search-dropdown').innerText();
  await page.locator('.cms-mirror-search-anchor input[aria-label="Search dashboard"]').fill('CF-00005');
  await page.waitForTimeout(1200);
  const live = await page.locator('.choosify-omni-search-dropdown').innerText();

  // click first result if any
  const resultBtn = page.locator('.choosify-omni-search-dropdown button, .choosify-omni-search-dropdown [role="option"], .choosify-omni-search-dropdown a').first();
  let navigated = '';
  if (await resultBtn.count()) {
    await resultBtn.click().catch(() => {});
    await page.waitForTimeout(1200);
    navigated = page.url();
  }

  await page.goto(`${BASE}/seller/rahim`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const loginAsCount = await page.locator('button', { hasText: 'Login As User' }).count();

  await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const ownLoginAs = await page.locator('button', { hasText: 'Login As User' }).count();

  const orSearch = await fetch(`${API}/search?q=OR-&limitPerGroup=5`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  console.log(
    JSON.stringify(
      {
        searchOk,
        idleHasRecent: /Recent Searches/i.test(idle),
        idleHasClear: /Clear search history/i.test(idle),
        idleHasQuick: /Quick Access/i.test(idle),
        liveHasUsers: /Users|CF-00005|Admin|Super/i.test(live),
        liveSnippet: live.slice(0, 400),
        navigated,
        loginAsCount,
        ownLoginAs,
        orGroups: (orSearch.data?.groups || orSearch.groups || []).map((g: any) => ({
          g: g.group,
          n: g.items?.length,
        })),
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
