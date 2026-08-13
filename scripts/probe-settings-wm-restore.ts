/**
 * Regression probe: avatar Account Settings SoT, role-scoped Settings tabs,
 * Website Manager horizontal navigation, Preview Website / Live Preview wiring.
 *
 * Static always. Browser UAT when PROBE_BASE_URL (default http://localhost:3001) is up.
 *
 * Run: npx tsx scripts/probe-settings-wm-restore.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { getMyProfilePath, getSettingsPath } from '../src/lib/userDisplay';
import { canAccessPath, DEFAULT_ROLE_PERMISSIONS } from '../src/lib/rbac';
import { ROLE_ALLOWED_PAGE_KEYS } from '../src/cms-mirror/nav';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const ROOT = resolve(process.cwd());
const fails: string[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
}

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function staticAudit() {
  const dropdown = read('src/components/account/UserProfileDropdown.tsx');
  const app = read('src/App.tsx');
  const userDisplay = read('src/lib/userDisplay.ts');
  const storefront = read('src/lib/storefrontUrls.ts');
  const host = read('src/cms-mirror/CmsMirrorHost.tsx');
  const html = read('public/cms-mirror/app.html');
  const rbac = read('src/lib/rbac.ts');

  assert(dropdown.includes("label: 'My Profile'"), 'Dropdown missing My Profile');
  assert(dropdown.includes("label: 'Account Settings'"), 'Dropdown missing Account Settings');
  assert(dropdown.includes('Log Out'), 'Dropdown missing Log Out');
  assert(!/label:\s*'Security'/.test(dropdown), 'Dropdown still has Security item');
  assert(!/account\/security/.test(dropdown), 'Dropdown still routes to /admin/account/security');
  assert(!/account\/settings/.test(dropdown), 'Dropdown still routes to legacy /admin/account/settings');
  assert(dropdown.includes('getSettingsPath()'), 'Account Settings must use getSettingsPath()');
  assert(dropdown.includes('getMyProfilePath(profile)'), 'My Profile must use getMyProfilePath');
  assert(dropdown.includes("event.key === 'Escape'"), 'Dropdown must close on Escape');
  assert(dropdown.includes('isClickOutside'), 'Dropdown must close on outside click');

  assert(userDisplay.includes("return '/admin/settings'"), 'getSettingsPath must be /admin/settings');
  assert(getSettingsPath() === '/admin/settings', `getSettingsPath() === ${getSettingsPath()}`);
  assert(getMyProfilePath({ id: 'a', role: 'admin' }) === '/admin/profile', 'Admin My Profile path');
  assert(getMyProfilePath({ id: 's', role: 'seller' }) === '/admin/brand-profile', 'Seller My Profile path');
  assert(getMyProfilePath({ id: 'c', role: 'creator' }) === '/admin/creator-profile', 'Creator My Profile path');
  assert(getMyProfilePath({ id: 'u', role: 'consumer' }) === '/admin/consumer-profile', 'Consumer My Profile path');

  assert(app.includes('path="/admin/account/settings"'), 'Legacy account settings route missing');
  assert(app.includes('path="/admin/account/security"'), 'Legacy account security route missing');
  assert(
    /path="\/admin\/account\/settings"[\s\S]{0,80}Navigate to="\/admin\/settings"/.test(app),
    'account/settings must redirect to /admin/settings',
  );
  assert(
    /path="\/admin\/account\/security"[\s\S]{0,80}Navigate to="\/admin\/settings"/.test(app),
    'account/security must redirect to /admin/settings',
  );
  assert(!app.includes('AccountComingSoon'), 'App.tsx must not mount AccountComingSoon');
  assert(!app.includes("import('./pages/admin/Settings')"), 'App.tsx must not mount legacy Settings.tsx');
  assert(
    !app.includes("import('./pages/admin/WebsiteCMSStudio')"),
    'App.tsx must not mount legacy WebsiteCMSStudio.tsx',
  );
  assert(app.includes('path="/admin/*"'), 'cms-mirror catch-all /admin/* must remain');

  assert(storefront.includes('VITE_CHOOSIFY_WEB_URL'), 'Published URL must read VITE_CHOOSIFY_WEB_URL');
  assert(storefront.includes('VITE_CHOOSIFY_WEB_PREVIEW_URL'), 'Preview URL must read VITE_CHOOSIFY_WEB_PREVIEW_URL');
  assert(storefront.includes("'https://choosify.bd'"), 'Production fallback https://choosify.bd');
  assert(!/window\.open\(\s*'https:\/\/choosify\.bd'/.test(html), 'Preview Website must not hardcode open() host in live HTML');

  assert(host.includes('getPublishedStorefrontUrl()'), 'CmsMirrorHost must post storefrontUrl');
  assert(host.includes('getLivePreviewStorefrontUrl()'), 'CmsMirrorHost must post previewUrl');
  assert(host.includes('storefrontUrl:'), 'postMessage storefrontUrl');
  assert(host.includes('previewUrl:'), 'postMessage previewUrl');

  const cmsSubnav = html.match(/static CMS_SUBNAV = \[([\s\S]*?)\];/);
  assert(!!cmsSubnav, 'CMS_SUBNAV missing');
  const tabLabels = [...(cmsSubnav?.[1].matchAll(/label:'([^']+)'/g) || [])].map((m) => m[1]);
  const expectedTabs = [
    'Content Management Studio',
    'Pages',
    'Search Experience',
    'Product Badges',
    'Promotional Sections',
    'Website Assets',
    'SEO Manager',
    'Global Settings',
  ];
  assert(
    JSON.stringify(tabLabels) === JSON.stringify(expectedTabs),
    `CMS_SUBNAV tabs=${JSON.stringify(tabLabels)}`,
  );
  assert(!html.includes('cmsSubNavGroups'), 'Legacy cmsSubNavGroups left rail must be gone');
  assert(html.includes('cmsTopTabs'), 'Horizontal cmsTopTabs required');
  assert(html.includes('display:flex;align-items:stretch'), 'Top tabs must be horizontal flex');
  assert(html.includes('openPreviewWebsite'), 'Preview Website handler required');
  assert(html.includes("window.open(url, '_blank'"), 'Preview Website must open new tab');
  assert(html.includes('iframe title="Choosify-Web live preview"'), 'Live Preview must iframe real storefront');
  assert(html.includes('cmsLivePreviewUrl'), 'Live Preview URL bag required');
  assert(!/LIVE PREVIEW[\s\S]{0,400}cmsSectionRows/.test(html.replace(/\n/g, ' ')), 'Live Preview must not be the old mock section list');

  assert(html.includes('SETTINGS_TABS_BY_ROLE'), 'Role-scoped settings tabs required');
  assert(html.includes("key:'platform', label:'PLATFORM CONFIG'"), 'Admin platform tab');
  assert(html.includes("key:'store', label:'STORE / BRAND'"), 'Seller store tab');
  assert(html.includes("key:'creator', label:'CREATOR / CONTENT'"), 'Creator content tab');
  assert(html.includes("key:'communication', label:'COMMUNICATION'"), 'Consumer communication tab');
  assert(html.includes('isSettingsAdminShell && settingsTab === \'platform\''), 'Platform panel must be admin-gated');
  assert(html.includes('cmsMirrorIsPlatformAdmin'), 'Client mutation guard required');
  assert(html.includes('rejectPartnerAdminSettings'), 'Partner reject helper required');

  assert(rbac.includes('consumer:'), 'RBAC must include consumer');
  for (const role of ['admin', 'seller', 'creator', 'consumer'] as const) {
    assert(
      canAccessPath(role, '/admin/settings', DEFAULT_ROLE_PERMISSIONS),
      `${role} must be able to open /admin/settings`,
    );
    const keys = ROLE_ALLOWED_PAGE_KEYS[role];
    if (keys === null) continue;
    assert(keys.includes('settings'), `${role} left-nav allowlist must include settings`);
  }
  assert(
    !(ROLE_ALLOWED_PAGE_KEYS.seller || []).includes('websiteCmsStudio'),
    'Seller must not receive Website Manager',
  );
  assert(
    !(ROLE_ALLOWED_PAGE_KEYS.creator || []).includes('websiteCmsStudio'),
    'Creator must not receive Website Manager',
  );
}

async function browserUat(): Promise<Record<string, unknown>> {
  const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
  const API = `${BASE}/api/v1`;
  const password = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

  let healthOk = false;
  try {
    const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2500) });
    healthOk = health.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    return { skipped: true, reason: `server not reachable at ${BASE}` };
  }

  const { chromium } = await import('playwright-core');
  const roles: Array<{
    label: string;
    email: string;
    profilePath: string;
    adminControls: boolean;
    websiteManager: boolean;
  }> = [
    {
      label: 'admin',
      email: 'admin@choosify.com.bd',
      profilePath: '/admin/profile',
      adminControls: true,
      websiteManager: true,
    },
    {
      label: 'seller',
      email: 'seller@choosify.com.bd',
      profilePath: '/admin/brand-profile',
      adminControls: false,
      websiteManager: false,
    },
    {
      label: 'creator',
      email: 'creator@choosify.com.bd',
      profilePath: '/admin/creator-profile',
      adminControls: false,
      websiteManager: false,
    },
    {
      label: 'consumer',
      email: 'rc.consumer.stable@choosify.test',
      profilePath: '/admin/consumer-profile',
      adminControls: false,
      websiteManager: false,
    },
  ];

  const results: Record<string, unknown>[] = [];

  async function login(email: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { accessToken?: string; error?: string };
    if (!res.ok || !body.accessToken) throw new Error(`login failed ${email}: ${res.status} ${body.error || ''}`);
    return body.accessToken;
  }

  for (const role of roles) {
    const browser = await chromium
      .launch({ headless: true, channel: 'chrome' })
      .catch(() => chromium.launch({ headless: true }));
    const page = await browser.newPage();
    const row: Record<string, unknown> = { role: role.label };
    try {
      const token = await login(role.email);
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.evaluate((t) => {
        localStorage.setItem('choosify_auth_token', t);
        localStorage.removeItem('choosify_mock_role');
      }, token);
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);

      const trigger = page.locator('.cms-mirror-profile-trigger').first();
      await trigger.click({ timeout: 15000 });
      await page.waitForTimeout(400);
      const menu = page.locator('[role="menu"][aria-label="Account menu"]');
      const labels = await menu.locator('[role="menuitem"]').allInnerTexts();
      row.dropdownLabels = labels.map((t) => t.trim());
      row.hasSecurity = labels.some((t) => /^Security$/i.test(t.trim()));
      row.hasAccountSettings = labels.some((t) => /Account Settings/i.test(t));
      row.hasMyProfile = labels.some((t) => /My Profile/i.test(t));
      row.hasLogOut = labels.some((t) => /Log Out|Logout/i.test(t));

      await menu.locator('[role="menuitem"]').filter({ hasText: 'Account Settings' }).first().click();
      await page.waitForTimeout(1800);
      row.settingsUrl = page.url();
      row.settingsParity = String(page.url()).includes('/admin/settings');
      row.notLegacyAccount = !String(page.url()).includes('/admin/account/');

      const iframe = page.frameLocator('iframe[title="Choosify Admin CMS"]');
      const settingsText = await iframe.locator('body').innerText().catch(() => '');
      row.settingsHasPlatform = /PLATFORM CONFIG|Maintenance Mode|SMTP Configuration|Danger Zone|Admin Invite|Roles & Access/i.test(
        settingsText,
      );
      row.settingsHasSeller = /STORE \/ BRAND|ORDER & FULFILLMENT|FEATURE ACCESS STATUS/i.test(settingsText);
      row.settingsHasCreator = /CREATOR \/ CONTENT|PUBLISHING/i.test(settingsText);
      if (role.adminControls) {
        assert(row.settingsHasPlatform, `${role.label} Settings missing Admin platform controls`);
      } else {
        assert(!row.settingsHasPlatform, `${role.label} Settings leaked Admin platform controls`);
      }

      await trigger.click({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.locator('[role="menuitem"]').filter({ hasText: 'My Profile' }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
      row.profileUrl = page.url();
      row.profileOk = String(page.url()).includes(role.profilePath);

      if (role.websiteManager) {
        await page.goto(`${BASE}/admin/website-cms`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2200);
        const wm = await iframe.locator('body').innerText().catch(() => '');
        row.wmHasHorizontalTabs =
          /Content Management Studio/.test(wm) &&
          /Pages/.test(wm) &&
          /Search Experience/.test(wm) &&
          /Product Badges/.test(wm) &&
          /Promotional Sections/.test(wm) &&
          /Website Assets/.test(wm) &&
          /SEO Manager/.test(wm) &&
          /Global Settings/.test(wm);
        row.wmHasPreview = /PREVIEW WEBSITE/.test(wm);
        row.wmHasLivePreview = /LIVE PREVIEW/.test(wm);
        row.wmNotLeftRail = !/Homepage Manager[\s\S]{0,40}Hero Banners[\s\S]{0,40}Navigation/i.test(wm);
        assert(row.wmHasHorizontalTabs, 'Website Manager missing approved horizontal tabs');
        assert(row.wmHasPreview, 'Preview Website button missing');
        assert(row.wmHasLivePreview, 'Live Preview button missing');
      }
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      fails.push(`${role.label} browser: ${row.error}`);
    } finally {
      await browser.close();
    }
    results.push(row);
  }

  return { skipped: false, results };
}

async function main() {
  staticAudit();
  const browser = await browserUat();
  const payload = { fails, browser };
  console.log(JSON.stringify(payload, null, 2));
  if (fails.length) {
    console.log('RESTORE_FAIL');
    process.exit(1);
  }
  console.log('RESTORE_PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
