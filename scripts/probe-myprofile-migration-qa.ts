/**
 * My Profile migration QA -- verifies the native AdminWorkspaceLayout
 * MyProfilePage replaces the legacy CMS-mirror iframe self-profile page for
 * Super Admin/Admin, there is exactly one "My Profile" nav entry, both the
 * sidebar entry and the avatar dropdown resolve to the same route, the
 * modern shell never disappears, and Seller/Creator nav is unaffected.
 *
 * Usage: npx tsx scripts/probe-myprofile-migration-qa.ts
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_myprofile-migration-qa');
mkdirSync(OUT, { recursive: true });

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await page.fill('input[type="email"], input[name="email"]', email).catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', PW).catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function sidebarLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.admin-workspace__nav-label')).map((el) => el.textContent?.trim() || ''),
  );
}

async function shellPresent(page: Page): Promise<{ sidebar: boolean; topbar: boolean }> {
  return page.evaluate(() => ({
    sidebar: !!document.querySelector('.admin-workspace__sidebar'),
    topbar: !!document.querySelector('.admin-workspace__topbar'),
  }));
}

async function testRole(browser: any, label: string, email: string, shotPrefix: string) {
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (e: unknown) => console.log(`${label} pageerror:`, String(e).slice(0, 200)));

  await login(page, email);

  // ---- 1. Sidebar entry count + label ----
  const labels = await sidebarLabels(page);
  const profileEntries = labels.filter((l) => /profile/i.test(l));
  console.log(`${label} sidebar profile-ish entries:`, JSON.stringify(profileEntries));
  assert(profileEntries.filter((l) => l === 'My Profile').length === 1, `${label}: exactly one "My Profile" sidebar entry`, profileEntries);
  assert(!labels.includes('Admin Profile'), `${label}: no "Admin Profile" label anywhere in sidebar`, labels);

  // ---- 2. Click sidebar "My Profile" ----
  const clicked = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.admin-workspace__nav-label')).find((n) => n.textContent?.trim() === 'My Profile');
    const link = el?.closest('a') as HTMLAnchorElement | null;
    if (link) { link.click(); return true; }
    return false;
  });
  assert(clicked, `${label}: sidebar "My Profile" link found and clicked`);
  await page.waitForTimeout(1500);
  console.log(`${label} URL after sidebar click:`, page.url());
  assert(page.url().endsWith('/admin/profile'), `${label}: sidebar click navigates to /admin/profile`, page.url());

  let shell = await shellPresent(page);
  assert(shell.sidebar && shell.topbar, `${label}: modern sidebar+topbar still present after opening profile via sidebar`, shell);
  const shellLabelsAfter = await sidebarLabels(page);
  assert(shellLabelsAfter.includes('My Profile'), `${label}: "My Profile" itself remains visible in sidebar while active`, shellLabelsAfter);
  assert(shellLabelsAfter.includes('Dashboard') && shellLabelsAfter.length > 5, `${label}: other sidebar items remain visible (not reduced to just profile)`, shellLabelsAfter.length);

  const isActive = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.admin-workspace__nav-label')).find((n) => n.textContent?.trim() === 'My Profile');
    return !!el?.closest('.admin-workspace__nav-item--active');
  });
  assert(isActive, `${label}: "My Profile" nav item shows active styling while on the page`);

  const pageText = await page.evaluate(() => document.body.innerText);
  assert(pageText.includes('My Profile') && pageText.includes('Account Information'), `${label}: MyProfilePage content rendered (tabs present)`, pageText.slice(0, 120));
  const hasIframe = await page.evaluate(() => !!document.querySelector('iframe'));
  assert(!hasIframe, `${label}: profile page has NO iframe (fully native)`);

  await page.screenshot({ path: join(OUT, `${shotPrefix}-1-sidebar-my-profile.png`), fullPage: true });

  // ---- 3. Direct URL + refresh ----
  await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  shell = await shellPresent(page);
  assert(shell.sidebar && shell.topbar, `${label}: direct /admin/profile visit keeps modern shell`, shell);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  shell = await shellPresent(page);
  assert(shell.sidebar && shell.topbar, `${label}: refresh on /admin/profile keeps modern shell`, shell);
  assert(page.url().endsWith('/admin/profile'), `${label}: refresh stays on /admin/profile (no redirect loop)`, page.url());

  // ---- 4. Avatar dropdown -> My Profile (from a DIFFERENT page) ----
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  // UserProfileDropdown's trigger is the LAST aria-haspopup="menu" button in
  // the topbar (notifications/messages bells come first); its aria-controls
  // targets an element with role="menu" aria-label="Account menu".
  const avatarBtn = page.locator('button[aria-haspopup="menu"]').last();
  await avatarBtn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const dropdownItem = page.locator('[aria-label="Account menu"] button[role="menuitem"]:has-text("My Profile")').first();
  await dropdownItem.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`${label} URL after dropdown click:`, page.url());
  assert(page.url().endsWith('/admin/profile'), `${label}: avatar dropdown "My Profile" navigates to /admin/profile (same canonical route)`, page.url());
  shell = await shellPresent(page);
  assert(shell.sidebar && shell.topbar, `${label}: modern shell present after opening profile via avatar dropdown`, shell);
  await page.screenshot({ path: join(OUT, `${shotPrefix}-2-dropdown-my-profile.png`), fullPage: true });

  // ---- 5. Tabs: Security (ChangePasswordForm), Permissions (role) ----
  await page.locator('button:has-text("Security & Sessions")').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const hasPasswordForm = await page.evaluate(() => !!document.querySelector('#cp-current') && !!document.querySelector('#cp-new'));
  assert(hasPasswordForm, `${label}: Security tab embeds the real ChangePasswordForm`);
  await page.screenshot({ path: join(OUT, `${shotPrefix}-3-security-tab.png`), fullPage: true });

  await page.locator('button:has-text("Permissions & Role")').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const permText = await page.evaluate(() => document.body.innerText);
  assert(permText.includes('Effective role:'), `${label}: Permissions tab shows role`, permText.slice(0, 100));
  await page.screenshot({ path: join(OUT, `${shotPrefix}-4-permissions-tab.png`), fullPage: true });

  // ---- 6. Back/forward ----
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log(`${label} URL after back:`, page.url());
  await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log(`${label} URL after forward:`, page.url());
  shell = await shellPresent(page);
  assert(shell.sidebar && shell.topbar, `${label}: shell intact after back/forward navigation`, shell);

  await page.close();
}

async function testPartnerNavUnaffected(browser: any, label: string, email: string) {
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await login(page, email);
  const text = await page.evaluate(() => document.body.innerText);
  const hasExpectedNav = /Creator Studio|Brand Management Studio|Dashboard/.test(text);
  assert(hasExpectedNav, `${label}: dashboard nav renders normally (unaffected by nav.ts change)`, text.slice(0, 200));
  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  await testRole(browser, 'Super Admin', 'admin@choosify.com.bd', 'super-admin');
  // No separate seeded plain-'admin'-role account was found; 'admin' and
  // 'super_admin' hit the exact same code path for every change in this
  // migration (ROLE_ALLOWED_PAGE_KEYS.admin/.super_admin are both `null`,
  // getMyProfilePath's default branch, the same <RoleGuard>/<AdminWorkspaceLayout>
  // route). Using 'moderator' (a real seeded staff role that ALSO carries
  // 'adminProfile' in its own allowed-keys list) as a same-page, different-role
  // proxy for "does the shared MyProfilePage/route work for a non-super_admin
  // staff role too".
  await testRole(browser, 'Moderator (staff-role proxy for Admin)', 'moderator@choosify.com.bd', 'moderator');

  await testPartnerNavUnaffected(browser, 'Seller', 'seller@choosify.com.bd');
  await testPartnerNavUnaffected(browser, 'Creator', 'creator@choosify.com.bd');

  await browser.close();
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
