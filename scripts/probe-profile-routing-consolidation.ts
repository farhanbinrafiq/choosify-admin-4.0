/**
 * Browser verify: Avatar My Profile + sidebar converge on cms-mirror Image 1 shell.
 */
import { chromium, type Page } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:3001';

async function tempRole(page: Page, role: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.waitForTimeout(1400);
}

async function openAvatarMyProfile(page: Page) {
  // CmsMirror overlay avatar or workspace avatar
  const overlay = page.locator('.cms-mirror-profile-trigger, button[aria-label*="profile" i], .cms-mirror-profile-anchor button').first();
  if (await overlay.count()) {
    await overlay.click({ force: true });
  } else {
    // AdminWorkspace / AdminLayout avatar button
    const candidates = page.locator('button').filter({ hasText: /Seller|Admin|Creator|Consumer|Rahim|User/i });
    if (await candidates.count()) await candidates.first().click({ force: true });
  }
  await page.waitForTimeout(400);
  const myProfile = page.getByText('My Profile', { exact: true }).first();
  await myProfile.click({ force: true });
  await page.waitForTimeout(3500);
}

function detectShell(body: string, url: string) {
  const isCmsMirror = url.includes('cms-mirror') || /Choosify Profile Complete|CMS Profile Complete|Search records\.\.\.|Ecosystem Partner Badge|In-App Referral/i.test(body);
  const isLegacyUpe =
    /DASHBOARD\s*>\s*DASHBOARD\s*>\s*SELLERS|Total Transacted Qty|Merchant Trust Score|Active SKU Feed/i.test(body);
  const isAdminNew =
    /Admin Profile/i.test(body) &&
    /Account Information/i.test(body) &&
    /Security & Sessions|PERMISSIONS|Permissions & Role/i.test(body) &&
    !/Total Transacted Qty/i.test(body);
  return {
    url,
    isCmsMirrorLike: isCmsMirror || isAdminNew || /Seller Profile|Creator Profile|My Profile/i.test(body),
    isLegacyUpe,
    hasBreadcrumbHeavy: /DASHBOARD\s*>\s*DASHBOARD/i.test(body),
    hasSearchRecords: /Search records/i.test(body),
    title: (/Seller Profile|Creator Profile|Admin Profile|My Profile/.exec(body) || [])[0] || null,
    snippet: body.replace(/\s+/g, ' ').slice(0, 220),
  };
}

async function measureFrame(page: Page) {
  const cms = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  if (cms) {
    const body = await cms.locator('body').innerText();
    return detectShell(body, cms.url());
  }
  const body = await page.locator('body').innerText();
  return detectShell(body, page.url());
}

async function probeRole(page: Page, role: string, sidebarPath: string | null, sidebarLabel: string | null) {
  await tempRole(page, role);
  const out: Record<string, unknown> = { role };

  if (sidebarPath) {
    await page.goto(`${BASE}${sidebarPath}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    out.sidebar = await measureFrame(page);
    out.sidebarUrl = page.url();
  }

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await openAvatarMyProfile(page);
  out.avatar = await measureFrame(page);
  out.avatarUrl = page.url();

  out.samePath =
    sidebarPath && out.avatarUrl
      ? String(out.avatarUrl).includes(sidebarPath.replace('/admin/', '')) ||
        String(out.avatarUrl).endsWith(sidebarPath) ||
        (out.sidebar as any)?.title === (out.avatar as any)?.title
      : null;
  out.bothNew =
    !(out.avatar as any)?.isLegacyUpe &&
    (!(out.sidebar as any) || !(out.sidebar as any)?.isLegacyUpe) &&
    ((out.avatar as any)?.isCmsMirrorLike || (out.avatar as any)?.title);
  return out;
}

async function main() {
  mkdirSync('.data', { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  const seller = await probeRole(page, 'Seller', '/admin/brand-profile', 'Seller Profile');
  const creator = await probeRole(page, 'Creator', '/admin/creator-profile', 'Creator Profile');
  const admin = await probeRole(page, 'Admin', '/admin/profile', 'Admin Profile');
  // Consumer may not be on TempRole — try if present
  let consumer: Record<string, unknown> | null = null;
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    if (await page.getByRole('button', { name: 'Consumer', exact: true }).count()) {
      consumer = await probeRole(page, 'Consumer', '/admin/consumer-profile', 'My Profile');
    } else {
      consumer = { skipped: true, reason: 'no TempRole Consumer button' };
    }
  } catch (e) {
    consumer = { error: String(e) };
  }

  const gates = {
    A_sellerSameNew:
      !(seller.sidebar as any)?.isLegacyUpe &&
      !(seller.avatar as any)?.isLegacyUpe &&
      /brand-profile|Seller Profile/i.test(String(seller.avatarUrl) + String((seller.avatar as any)?.title)),
    B_creatorSameNew:
      !(creator.sidebar as any)?.isLegacyUpe &&
      !(creator.avatar as any)?.isLegacyUpe &&
      /creator-profile|Creator Profile/i.test(String(creator.avatarUrl) + String((creator.avatar as any)?.title)),
    C_consumerNew:
      consumer && !(consumer as any).skipped
        ? !(consumer.avatar as any)?.isLegacyUpe &&
          /consumer-profile|My Profile/i.test(String(consumer.avatarUrl) + String((consumer.avatar as any)?.title))
        : false,
    D_adminNewShell:
      !(admin.avatar as any)?.isLegacyUpe &&
      /Admin Profile/i.test(String((admin.avatar as any)?.title || '') + String((admin.avatar as any)?.snippet || '')) &&
      /profile/i.test(String(admin.avatarUrl)),
    E_legacySelfNavRemoved:
      !/\/seller\//.test(String(seller.avatarUrl)) &&
      !/\/creator\//.test(String(creator.avatarUrl)) &&
      !/Unified Profile|Total Transacted Qty/.test(String((admin.avatar as any)?.snippet || '')),
  };

  const out = { seller, creator, admin, consumer, gates, at: new Date().toISOString() };
  writeFileSync('.data/probe-profile-routing-consolidation.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(Object.values(gates).every(Boolean) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
