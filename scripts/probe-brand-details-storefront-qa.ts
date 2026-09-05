/**
 * Browser QA for the Brand Details page fixes:
 *  - Logo-fit on the Brands listing card (object-contain, no crop).
 *  - Correct brand resolved from the listing card link (no "Apple" fallback
 *    for an unrelated brand).
 *  - Real name/logo/claim-state rendered on the Brand Details page for the
 *    just-reconciled seller-owned brand (no "Claim this brand", no
 *    prototype Apple content).
 *
 * Usage: npx tsx scripts/probe-brand-details-storefront-qa.ts
 * (needs :3001 and :5173 dev servers running, and the reconcile probe
 *  having been run first so a verified, seller-owned brand exists)
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const WEB = BASE.replace('3001', '5173');
const OUT = join(process.cwd(), 'scripts', '_tmp_brand-details-artifacts');
mkdirSync(OUT, { recursive: true });

const RECONCILE_SLUG = process.argv[2];
if (!RECONCILE_SLUG) {
  console.error('Usage: npx tsx scripts/probe-brand-details-storefront-qa.ts <reconciled-brand-slug>');
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

  // --- Part A: Brands listing card logo fit ---
  await page.goto(`${WEB}/brands`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(OUT, '1 brands-listing.png'), fullPage: false });
  console.log('A1: brands listing loaded, screenshot taken.');

  // Navigate directly via the brand's real SLUG (not a numeric id) — this is
  // exactly one of the identifier forms the id-matching fix must accept.
  await page.goto(`${WEB}/brands/${encodeURIComponent(RECONCILE_SLUG)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('B1: Details page shows the REAL brand name (not Apple)?', /Reconcile Probe Brand/i.test(bodyText));
  console.log('B2: Details page does NOT show "Apple"?', !/\bApple\b/.test(bodyText));
  console.log('B3: Details page does NOT show "Claim this brand" / "Claim Ownership" CTA (should be owned/verified)?', !/Claim (this brand|Ownership)/i.test(bodyText));
  console.log('B4: Details page shows "Verified Brand Owner" (owned state)?', /Verified Brand Owner/i.test(bodyText));
  await page.screenshot({ path: join(OUT, '3 reconcile-brand-details.png'), fullPage: true });

  // --- Part C: A pre-existing, unrelated brand (Samsung) navigated to via
  // its catalog id "brand-samsung" (exactly what a real card link uses) —
  // proves the fix isn't accidentally scoped to only the reconciled brand.
  await page.goto(`${WEB}/brands/brand-samsung`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const samsungText = await page.evaluate(() => document.body.innerText);
  console.log('C1: /brands/brand-samsung shows "Samsung" (not Apple)?', /Samsung/i.test(samsungText));
  console.log('C2: does NOT show "Apple" as the page brand?', !new RegExp('^\\s*Apple\\b', 'm').test(samsungText));
  await page.screenshot({ path: join(OUT, '4 samsung-details.png'), fullPage: true });

  await browser.close();
  console.log('screens written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
