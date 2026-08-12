import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.waitForTimeout(1500);
  // Temp role switcher Consumer
  const consumerBtn = page.locator('[data-temp-role-switcher] button', { hasText: 'Consumer' });
  if (await consumerBtn.count()) {
    await consumerBtn.click();
  } else {
    await page.getByRole('button', { name: 'Consumer', exact: true }).click();
  }
  await page.waitForTimeout(1800);
  await page.goto(`${BASE}/admin/consumer-profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const cms = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  const body = cms ? await cms.locator('body').innerText() : await page.locator('body').innerText();
  const out: Record<string, unknown> = {
    url: page.url(),
    frame: cms?.url() || null,
    role: await page.evaluate(() => {
      try {
        return (document.querySelector('iframe') as any)?.contentWindow?.__CMS_MIRROR_ROLE__;
      } catch {
        return null;
      }
    }),
    hasMyProfile: /My Profile/i.test(body),
    hasConsumerBanner: /\bCONSUMER\b/.test(body),
    hasAccount: /Account Information/i.test(body),
    hasLegacy: /Total Transacted Qty/i.test(body),
    slice: body.includes('My Profile')
      ? body.slice(body.indexOf('My Profile'), body.indexOf('My Profile') + 800)
      : body.slice(0, 800),
  };

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('.cms-mirror-profile-trigger').first().click({ force: true }).catch(async () => {
    await page.locator('.cms-mirror-profile-anchor button').first().click({ force: true });
  });
  await page.waitForTimeout(500);
  await page.getByText('My Profile', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(4000);
  const cms2 = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  const body2 = cms2 ? await cms2.locator('body').innerText() : await page.locator('body').innerText();
  out.avatarUrl = page.url();
  out.avatarFrame = cms2?.url() || null;
  out.avatarHasMyProfile = /My Profile/i.test(body2);
  out.avatarHasConsumer = /\bCONSUMER\b/.test(body2);
  out.avatarLegacy = /Total Transacted Qty/i.test(body2);
  writeFileSync('.data/probe-consumer-profile.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.hasConsumerBanner && out.avatarHasConsumer && !out.hasLegacy && !out.avatarLegacy ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
