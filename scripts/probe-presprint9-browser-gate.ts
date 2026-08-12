/**
 * Pre-Sprint-9 browser release-gate smoke for critical routes.
 * Uses mock admin role (no JWT) to verify cms-mirror renders without CF crashes.
 * Run: npx tsx scripts/probe-presprint9-browser-gate.ts
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';

const ROUTES: Array<{ path: string; expect?: RegExp; note: string }> = [
  { path: '/admin/dashboard', expect: /OVERVIEW|Dashboard/i, note: 'Admin dashboard' },
  { path: '/admin/brand-studio', expect: /Brand Management|Seller Management|Brand Studio/i, note: 'Brand Management Studio' },
  { path: '/admin/brand-profile', expect: /Seller Profile|Brand Profile|OVERVIEW/i, note: 'Seller Profile' },
  { path: '/admin/creator-studio', expect: /Creator|OVERVIEW/i, note: 'Creator Studio / management' },
  { path: '/admin/creator-profile', expect: /Creator Profile|OVERVIEW/i, note: 'Creator Profile' },
  { path: '/admin/content-studio', expect: /Guide|Content|OVERVIEW/i, note: 'Guide Management' },
  { path: '/admin/products', expect: /Product|Inventory|OVERVIEW/i, note: 'Products & Inventory' },
  { path: '/admin/orders', expect: /Order|OVERVIEW/i, note: 'Orders Hub' },
  { path: '/admin/ads-deals-studio', expect: /Ads|Deals|OVERVIEW/i, note: 'Ads & Deals Studio' },
  { path: '/admin/verification-center', expect: /Verification|OVERVIEW/i, note: 'Verification Center' },
  { path: '/admin/customers', expect: /Consumer|Customer|OVERVIEW/i, note: 'Consumers' },
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(async () =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('choosify_mock_role', 'admin');
    localStorage.removeItem('choosify_auth_token');
  });

  const results: Array<{ note: string; path: string; ok: boolean; detail: string }> = [];

  for (const route of ROUTES) {
    pageErrors.length = 0;
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
      pageErrors.push(`nav:${e}`);
    });
    await page.waitForTimeout(2800);

    const info = await page.evaluate((expectSrc) => {
      const expectRe = expectSrc ? new RegExp(expectSrc, 'i') : null;
      const ifr = document.querySelector('iframe') as HTMLIFrameElement | null;
      if (!ifr || !ifr.contentDocument) {
        const body = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120);
        return { mode: 'host', textLen: body.length, text: body, hasCfCrash: false, helpers: 'n/a' };
      }
      const t = ifr.contentDocument.body?.innerText || '';
      const w = ifr.contentWindow as Window & { cfIdLabelForUid?: unknown };
      return {
        mode: 'iframe',
        textLen: t.length,
        text: t.replace(/\s+/g, ' ').slice(0, 140),
        hasCfCrash: /cfIdLabelForUid is not defined/i.test(t),
        helpers: typeof w.cfIdLabelForUid,
        matched: expectRe ? expectRe.test(t) : t.length > 200,
      };
    }, route.expect ? route.expect.source : null);

    const cfCrash = pageErrors.some((e) => /cfIdLabelForUid is not defined/i.test(e)) || info.hasCfCrash;
    const blank = info.mode === 'iframe' && info.textLen < 100;
    const ok =
      !cfCrash &&
      !blank &&
      (info.mode === 'iframe'
        ? info.matched !== false && info.helpers === 'function'
        : /TEMP|dashboard|Brand|Studio|404/i.test(info.text));

    results.push({
      note: route.note,
      path: route.path,
      ok,
      detail: JSON.stringify({ cfCrash, blank, pageErrors: pageErrors.slice(0, 2), ...info }),
    });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${route.note} (${route.path})`);
  }

  // Seller mock: brand-studio must render
  await page.evaluate(() => {
    localStorage.setItem('choosify_mock_role', 'seller');
  });
  await page.goto(`${BASE}/admin/brand-studio`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  const sellerStudio = await page.evaluate(() => {
    const ifr = document.querySelector('iframe') as HTMLIFrameElement | null;
    if (!ifr?.contentDocument) return { ok: false, detail: 'no iframe' };
    const t = ifr.contentDocument.body?.innerText || '';
    return {
      ok: /Brand Management|Seller Profile|OVERVIEW/i.test(t) && !/cfIdLabelForUid is not defined/i.test(t),
      detail: t.replace(/\s+/g, ' ').slice(0, 100),
      helpers: typeof (ifr.contentWindow as Window & { cfIdLabelForUid?: unknown }).cfIdLabelForUid,
    };
  });
  results.push({
    note: 'Seller Brand Management Studio',
    path: '/admin/brand-studio (seller mock)',
    ok: sellerStudio.ok && sellerStudio.helpers === 'function',
    detail: JSON.stringify(sellerStudio),
  });
  console.log(`${sellerStudio.ok ? 'PASS' : 'FAIL'} Seller Brand Management Studio`);

  // Creator mock
  await page.evaluate(() => {
    localStorage.setItem('choosify_mock_role', 'creator');
  });
  await page.goto(`${BASE}/admin/creator-profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  const creatorProfile = await page.evaluate(() => {
    const ifr = document.querySelector('iframe') as HTMLIFrameElement | null;
    if (!ifr?.contentDocument) return { ok: false, detail: 'no iframe' };
    const t = ifr.contentDocument.body?.innerText || '';
    return {
      ok: /Creator|OVERVIEW/i.test(t) && !/cfIdLabelForUid is not defined/i.test(t),
      detail: t.replace(/\s+/g, ' ').slice(0, 100),
    };
  });
  results.push({
    note: 'Creator Profile',
    path: '/admin/creator-profile (creator mock)',
    ok: creatorProfile.ok,
    detail: JSON.stringify(creatorProfile),
  });
  console.log(`${creatorProfile.ok ? 'PASS' : 'FAIL'} Creator Profile`);

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- BROWSER GATE SUMMARY ---');
  console.log(`PASS ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.note).join(', '));
    for (const f of failed) console.log(' ', f.path, f.detail);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
