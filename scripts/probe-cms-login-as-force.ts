import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3001';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/admin/consumers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  const opened = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title="Choosify Admin CMS"]') as HTMLIFrameElement | null;
    const w = iframe?.contentWindow as any;
    const inst = w?.__CMS_MIRROR_INSTANCE__;
    const users = w?.Component?.USERS || [];
    const name = users[0]?.name;
    if (inst && name && typeof inst.selectCustomer === 'function') {
      inst.selectCustomer(name);
      return { name, userId: users[0]?.userId || users[0]?.id || null, total: users.length };
    }
    return { name: null, err: !inst ? 'no-instance' : 'no-users', total: users.length };
  });

  await page.waitForTimeout(1500);
  const frame = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  const loginAs = await frame.locator('button', { hasText: 'Login As User' }).count();
  const detailText = await frame.locator('body').innerText().then((t) => t.slice(0, 800)).catch(() => '');

  // Brand detail force
  await page.goto(`${BASE}/admin/dashboard`);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title="Choosify Admin CMS"]') as HTMLIFrameElement | null;
    const w = iframe?.contentWindow as any;
    const inst = w?.__CMS_MIRROR_INSTANCE__;
    const brands = w?.Component?.BRANDS || [];
    const b = brands.find((x: any) => x.sellerId) || brands[0];
    if (inst && b && typeof inst.setPage === 'function') {
      // open brands page then select
      inst.setState({ page: 'brands', selectedBrandName: b.name });
      if (typeof inst.selectBrand === 'function') inst.selectBrand(b.name);
      else if (typeof inst.openBrand === 'function') inst.openBrand(b.name);
    }
    return b ? { name: b.name, sellerId: b.sellerId } : null;
  });
  await page.waitForTimeout(1500);
  const brandLoginAs = await frame.locator('button', { hasText: 'Login As User' }).count();

  console.log(JSON.stringify({ opened, loginAs, detailHasConsumer: /Consumer Profile|CONSUMER/i.test(detailText), brandLoginAs }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
