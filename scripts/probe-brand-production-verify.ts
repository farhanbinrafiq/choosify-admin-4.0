/**
 * Read-only production verification for the Brand Details fixes, against
 * the real "Test" brand at https://choosify.bd/brands/test.
 * Usage: npx tsx scripts/probe-brand-production-verify.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'scripts', '_tmp_prod-verify');
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  await page.goto('https://choosify.bd/brands/test', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Shows "Test" as the page brand name?', /^Test\b/m.test(bodyText));
  console.log('Shows "Apple" as the PAGE brand (bad)?', /^Apple\b/m.test(bodyText));
  console.log('Shows "Claim this brand" / "Claim Ownership" CTA (should be false - owned)?', /Claim this brand|Claim Ownership/i.test(bodyText));
  console.log('Shows "Verified Brand Owner" (owned state)?', /Verified Brand Owner/i.test(bodyText));
  console.log('Shows the fake trust-strip ("Happy Customers")?', /Happy Customers/i.test(bodyText));
  await page.screenshot({ path: join(OUT, 'prod-test-brand.png'), fullPage: true });
  await browser.close();
  console.log('screenshot:', join(OUT, 'prod-test-brand.png'));
}
main().catch((e) => { console.error(e); process.exit(1); });
