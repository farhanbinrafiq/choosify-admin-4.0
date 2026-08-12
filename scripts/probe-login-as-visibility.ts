import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3001';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const admin = page.getByRole('button', { name: 'Admin', exact: true });
  if (await admin.count()) await admin.click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const searchOk = await page.locator('.cms-mirror-search-anchor input').isVisible();
  await page.locator('.cms-mirror-search-anchor input').click();
  await page.waitForTimeout(400);
  const idle = await page.locator('.choosify-omni-search-dropdown').innerText().catch(() => '');

  // Open brands page and select first brand if possible
  await page.goto(`${BASE}/admin/brand-studio`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const frame = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  // Try click a brand row/card
  const brandClickables = frame.locator('text=/Aarong|Brand|Digital/i').first();
  let brandLoginAs = 0;
  try {
    if (await brandClickables.count()) {
      await brandClickables.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  } catch {
    /* ignore */
  }
  brandLoginAs = await frame.locator('button', { hasText: 'Login As User' }).count();

  // Creator list
  await page.goto(`${BASE}/admin/creators`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);
  const creatorLoginAs = await frame.locator('button', { hasText: 'Login As User' }).count();

  // Consumers
  await page.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);
  const customerLoginAs = await frame.locator('button', { hasText: 'Login As User' }).count();

  // UPE seller
  await page.goto(`${BASE}/seller/rahim`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const upeLoginAs = await page.locator('button', { hasText: 'Login As User' }).count();

  console.log(
    JSON.stringify(
      {
        searchOk,
        idleHasRecent: /Recent Searches/i.test(idle),
        idleHasClear: /Clear search history/i.test(idle),
        idleHasQuick: /Quick Access/i.test(idle),
        brandLoginAs,
        creatorLoginAs,
        customerLoginAs,
        upeLoginAs,
        canImpersonateFlag: await page.evaluate(() => {
          const iframe = document.querySelector('iframe[title="Choosify Admin CMS"]') as HTMLIFrameElement | null;
          try {
            return (iframe?.contentWindow as any)?.__CMS_MIRROR_CAN_IMPERSONATE__;
          } catch {
            return 'cross-origin-or-missing';
          }
        }),
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
