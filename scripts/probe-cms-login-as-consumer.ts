import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3001';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/admin/consumers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  const flag = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title="Choosify Admin CMS"]') as HTMLIFrameElement | null;
    const w = iframe?.contentWindow as any;
    return {
      canImpersonate: w?.__CMS_MIRROR_CAN_IMPERSONATE__,
      role: w?.__CMS_MIRROR_ROLE__,
      uid: w?.__CMS_MIRROR_USER_ID__,
    };
  });

  const frame = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  // Click first consumer row if present
  const row = frame.locator('table tbody tr, [sc-camel-on-click], div').filter({ hasText: /@|\.com|CF-/i }).first();
  await row.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const loginAs = await frame.locator('button', { hasText: 'Login As User' }).count();
  const bodySnippet = await frame.locator('body').innerText().then((t) => t.slice(0, 500)).catch(() => '');

  console.log(JSON.stringify({ flag, loginAs, bodySnippet }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
