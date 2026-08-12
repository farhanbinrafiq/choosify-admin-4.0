import { chromium } from 'playwright-core';

async function measureSearch(page: import('playwright-core').Page, label: string) {
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const form =
      (document.querySelector('.choosify-navbar-hero-search form') as HTMLElement | null) ||
      (document.querySelector('.cms-mirror-search-anchor form') as HTMLElement | null) ||
      (document.querySelector('form.relative.w-full') as HTMLElement | null);
    const pill = form?.querySelector('.global-search-shell__pill, .bg-white.rounded-full') as HTMLElement | null;
    const input = form?.querySelector('input') as HTMLInputElement | null;
    const cta = form?.querySelector('button[type="submit"]') as HTMLElement | null;
    const clearSlot = form?.querySelector('.global-search-shell__clear') as HTMLElement | null;
    const anchor = document.querySelector('.cms-mirror-search-anchor') as HTMLElement | null;
    const title = document.querySelector('h1, .admin-workspace__topbar-title, [style*="font-weight:800"]') as HTMLElement | null;
    const fr = form?.getBoundingClientRect();
    const pr = pill?.getBoundingClientRect();
    const ir = input?.getBoundingClientRect();
    const cr = cta?.getBoundingClientRect();
    const ar = anchor?.getBoundingClientRect();
    return {
      hasShell: Boolean(form && pill && cta),
      submitLabel: (cta?.textContent || '').trim(),
      form: fr && { left: Math.round(fr.left), width: Math.round(fr.width), height: Math.round(fr.height), right: Math.round(fr.right) },
      pill: pr && { height: Math.round(pr.height), radius: getComputedStyle(pill!).borderRadius },
      input: ir && { height: Math.round(ir.height), width: Math.round(ir.width) },
      cta: cr && {
        height: Math.round(cr.height),
        width: Math.round(cr.width),
        bg: getComputedStyle(cta!).backgroundColor,
        color: getComputedStyle(cta!).color,
        radius: getComputedStyle(cta!).borderRadius,
      },
      clearSlotWidth: clearSlot ? Math.round(clearSlot.getBoundingClientRect().width) : null,
      anchor: ar && { left: Math.round(ar.left), width: Math.round(ar.width), right: Math.round(ar.right) },
      gapTitleToSearch: fr && title ? Math.round(fr.left - title.getBoundingClientRect().right) : null,
      viewport: window.innerWidth,
      bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
    };
  });
  console.log(label, JSON.stringify(m));
  return m;
}

async function main() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  // CMS mirror dashboard (primary)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('choosify_auth_token');
      localStorage.setItem('choosify_mock_role', 'admin');
    });
    await page.goto('http://localhost:3001/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const dash = await measureSearch(page, 'CMS_DASHBOARD');

    // Focus search + idle panel
    await page.click('input[aria-label="Search dashboard"]', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(800);
    const idle = await page.evaluate(() => {
      const drop = document.querySelector('.choosify-omni-search-dropdown') as HTMLElement | null;
      const form = document.querySelector('.choosify-navbar-hero-search form, .cms-mirror-search-anchor form') as HTMLElement | null;
      if (!drop || !form) return { hasDropdown: Boolean(drop), aligned: false };
      const dr = drop.getBoundingClientRect();
      const fr = form.getBoundingClientRect();
      return {
        hasDropdown: true,
        dropW: Math.round(dr.width),
        formW: Math.round(fr.width),
        leftDelta: Math.round(Math.abs(dr.left - fr.left)),
        rightDelta: Math.round(Math.abs(dr.right - fr.right)),
        hasRecent: /Recent Searches/i.test(drop.innerText || ''),
        hasQuick: /Quick Access/i.test(drop.innerText || ''),
        hasPopular: /Popular|Trending|Spotlight/i.test(drop.innerText || ''),
      };
    });
    console.log('CMS_IDLE_DROPDOWN', JSON.stringify(idle));

    // Type no-match query
    await page.fill('input[aria-label="Search dashboard"]', 'zzzznomatch999');
    await page.waitForTimeout(1200);
    const empty = await page.evaluate(() => {
      const drop = document.querySelector('.choosify-omni-search-dropdown') as HTMLElement | null;
      const form = document.querySelector('.choosify-navbar-hero-search form, .cms-mirror-search-anchor form') as HTMLElement | null;
      if (!drop || !form) return null;
      const dr = drop.getBoundingClientRect();
      const fr = form.getBoundingClientRect();
      return {
        text: (drop.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
        dropW: Math.round(dr.width),
        formW: Math.round(fr.width),
        dropH: Math.round(dr.height),
        leftDelta: Math.round(Math.abs(dr.left - fr.left)),
        hasNoMatches: /No matches/i.test(drop.innerText || ''),
      };
    });
    console.log('CMS_NO_MATCH', JSON.stringify(empty));
    console.log(
      'CMS_WIDTH_OK',
      JSON.stringify({
        wideEnough: Boolean(dash.form && dash.form.width >= 520),
        notPinnedRight: Boolean(dash.form && dash.form.left < 700),
        hasSearchLabel: dash.submitLabel.includes('SEARCH'),
      }),
    );
    await ctx.close();
  }

  // React AdminLayout profile route (also uses GlobalDashboardSearch)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('choosify_auth_token');
      localStorage.setItem('choosify_mock_role', 'admin');
    });
    await page.goto('http://localhost:3001/admin/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3500);
    await measureSearch(page, 'ADMIN_PROFILE_HEADER');
    await ctx.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
