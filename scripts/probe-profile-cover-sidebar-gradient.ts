/**
 * Verify profile covers match live left-nav sidebar gradient (host or iframe).
 */
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:3001';

async function measure(role: string, path: string) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  if (role === 'Consumer') {
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-temp-role-switcher] button', { hasText: 'Consumer' }).click();
  } else {
    await page.getByRole('button', { name: role, exact: true }).click();
  }
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);

  const cms = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  if (!cms) {
    await browser.close();
    return { role, error: 'no frame' };
  }

  // Host React sidebar (AdminWorkspaceLayout) OR iframe sidebar
  const hostSidebar = await page.evaluate(() => {
    const el =
      (document.querySelector('.admin-workspace-sidebar, aside.sidebar, .sidebar, [class*="sidebar"]') as HTMLElement | null) ||
      Array.from(document.querySelectorAll('div')).find((d) => {
        const r = d.getBoundingClientRect();
        const cs = getComputedStyle(d);
        return r.width >= 220 && r.width <= 260 && r.height > 400 && cs.backgroundImage.includes('radial-gradient');
      });
    if (!el) return null;
    const cs = getComputedStyle(el as HTMLElement);
    return { bgImage: cs.backgroundImage, bgColor: cs.backgroundColor, width: Math.round((el as HTMLElement).getBoundingClientRect().width) };
  });

  const cover = await cms.evaluate(() => {
    const el = document.querySelector('.cms-profile-identity-cover') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const label = el.querySelector('span');
    return {
      bgImage: cs.backgroundImage,
      bgColor: cs.backgroundColor,
      height: Math.round(el.getBoundingClientRect().height),
      label: label?.textContent?.trim() || null,
      labelColor: label ? getComputedStyle(label).color : null,
    };
  });

  const iframeSidebar = await cms.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find((d) => {
      const s = d.getAttribute('style') || '';
      return s.includes('width:240px') && s.includes('radial-gradient');
    }) as HTMLElement | undefined;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { bgImage: cs.backgroundImage, bgColor: cs.backgroundColor };
  });

  const sidebar = hostSidebar || iframeSidebar;
  const coverOk = !!cover;
  const hasSidebarGrad =
    !!cover &&
    cover.bgImage.includes('radial-gradient(1200px 500px at 15% 0%') &&
    cover.bgImage.includes('radial-gradient(900px 500px at 90% 20%');
  // solid base layer of the sidebar stack
  const hasDarkBase =
    !!cover &&
    (cover.bgColor === 'rgba(10, 10, 31, 0.96)' ||
      cover.bgColor === 'rgba(10,10,31,0.96)' ||
      /rgba\(10,\s*10,\s*31/.test(cover.bgColor));
  const noOldLight =
    !!cover &&
    !/#c4b5fd|rgb\(196,\s*181,\s*253\)|#fde68a|rgb\(253,\s*230,\s*138\)/i.test(cover.bgImage);
  const matchesSidebarImages =
    !!cover &&
    !!sidebar &&
    cover.bgImage.replace(/\s+/g, '') === sidebar.bgImage.replace(/\s+/g, '');
  // Allow match via shared token layers even if host sidebar uses same images
  const exactOrTokenMatch = matchesSidebarImages || (hasSidebarGrad && hasDarkBase);

  await browser.close();
  return {
    role,
    path,
    cover,
    sidebarSource: hostSidebar ? 'host' : iframeSidebar ? 'iframe' : null,
    sidebar,
    hasSidebarGrad,
    hasDarkBase,
    noOldLight,
    matchesSidebarImages,
    exactOrTokenMatch,
    labelWhite: cover?.labelColor === 'rgb(255, 255, 255)',
    heightOk: cover?.height === 80,
  };
}

async function main() {
  mkdirSync('.data', { recursive: true });
  const rows = [
    await measure('Admin', '/admin/profile'),
    await measure('Seller', '/admin/brand-profile'),
    await measure('Creator', '/admin/creator-profile'),
    await measure('Consumer', '/admin/consumer-profile'),
  ];
  const gate = rows.every(
    (r: any) => r.exactOrTokenMatch && r.noOldLight && r.labelWhite && r.heightOk && r.hasDarkBase,
  );
  const out = { rows, gate, FINAL: gate ? 'YES' : 'NO', at: new Date().toISOString() };
  writeFileSync('.data/probe-profile-cover-sidebar-gradient.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(gate ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
