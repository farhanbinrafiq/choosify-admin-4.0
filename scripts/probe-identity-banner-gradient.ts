import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.removeItem('choosify_auth_token');
    localStorage.setItem('choosify_mock_role', 'admin');
  });

  const routes: [string, string][] = [
    ['ADMIN', 'http://localhost:3001/admin/profile'],
    ['CONSUMER', 'http://localhost:3001/consumer/1'],
    ['SELLER', 'http://localhost:3001/seller/1'],
    ['CREATOR', 'http://localhost:3001/creator/1'],
  ];

  for (const [label, url] of routes) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const sidebar = document.querySelector('aside.sidebar, .sidebar') as HTMLElement | null;
      const banner = document.querySelector('.profile-identity-banner') as HTMLElement | null;
      const labelEl = banner?.querySelector('span') as HTMLElement | null;
      const sb = sidebar ? getComputedStyle(sidebar).backgroundImage : null;
      const bb = banner ? getComputedStyle(banner).backgroundImage : null;
      const labelColor = labelEl ? getComputedStyle(labelEl).color : null;
      const br = banner?.getBoundingClientRect();
      return {
        hasBanner: !!banner,
        hasSidebar: !!sidebar,
        sameGradient: Boolean(sb && bb && sb === bb && sb !== 'none'),
        sidebarBg: sb?.slice(0, 160) || null,
        bannerBg: bb?.slice(0, 160) || null,
        labelText: (labelEl?.textContent || '').trim(),
        labelColor,
        bannerH: br ? Math.round(br.height) : null,
        bannerW: br ? Math.round(br.width) : null,
        tokenCheck: getComputedStyle(document.documentElement).getPropertyValue('--gradient-sidebar').trim().slice(0, 80),
      };
    });
    console.log(label, JSON.stringify(m));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
