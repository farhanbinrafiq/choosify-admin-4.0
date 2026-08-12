/**
 * Quick multi-route cms-mirror render check after CF-ID hotfix.
 * Run: npx tsx scripts/probe-cms-mirror-routes.ts
 */
import { chromium } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const routes = [
  '/admin/brand-studio',
  '/admin/brands',
  '/admin/creators',
  '/admin/creator-studio',
  '/admin/products',
  '/admin/orders',
  '/admin/customers',
  '/admin/brand-profile',
  '/admin/creator-profile',
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
    localStorage.setItem('choosify_mock_role', 'seller');
    localStorage.removeItem('choosify_auth_token');
  });

  let failed = 0;
  for (const route of routes) {
    pageErrors.length = 0;
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
      pageErrors.push(`nav:${e}`);
    });
    await page.waitForTimeout(2800);
    const info = await page.evaluate(() => {
      const ifr = document.querySelector('iframe') as HTMLIFrameElement | null;
      if (!ifr) {
        return {
          hasIframe: false,
          body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 100),
        };
      }
      try {
        const doc = ifr.contentDocument;
        const t = doc && doc.body ? doc.body.innerText : '';
        const w = ifr.contentWindow as Window & {
          cfIdLabelForUid?: unknown;
        };
        return {
          hasIframe: true,
          textLen: t.length,
          hasNav: /OVERVIEW|Dashboard|BRAND|Products|Orders|Creators/i.test(t),
          hasCfErr: /cfIdLabelForUid is not defined/.test(t),
          helpers: typeof w.cfIdLabelForUid,
          snippet: t.replace(/\s+/g, ' ').slice(0, 100),
        };
      } catch (e) {
        return { hasIframe: true, accessErr: String(e) };
      }
    });
    const cfCrash = pageErrors.some((e) => /cfIdLabelForUid is not defined/i.test(e));
    const ok =
      !cfCrash &&
      !(info as { hasCfErr?: boolean }).hasCfErr &&
      ((info as { hasNav?: boolean }).hasNav === true ||
        ((info as { hasIframe?: boolean }).hasIframe === false &&
          /Loading|Brand|Studio|TEMP/i.test((info as { body?: string }).body || '')));
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${route} — ${JSON.stringify({ cfCrash, pageErrors: pageErrors.slice(0, 2), ...info })}`);
  }

  await browser.close();
  console.log(`\n--- SUMMARY ---\nPASS ${routes.length - failed} / ${routes.length}`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
