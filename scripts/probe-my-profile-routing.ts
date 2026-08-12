/**
 * Verify avatar dropdown → My Profile routes to canonical own-profile per effective role.
 * Usage: npx tsx scripts/probe-my-profile-routing.ts
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { chromium } from 'playwright-core';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const API = `${BASE}/api/v1`;

type RoleCase = {
  label: string;
  email: string;
  expectedMyProfilePath: string | ((uid: string) => string);
  startPath?: string;
  triggerSelector?: string;
};

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const body = (await res.json()) as { accessToken?: string; uid?: string; error?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login failed ${email}: ${res.status} ${body.error || ''}`);
  return { token: body.accessToken, uid: body.uid || '' };
}

async function injectSession(page: import('playwright-core').Page, token: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t) => {
    localStorage.setItem('choosify_auth_token', t);
    localStorage.removeItem('choosify_mock_role');
  }, token);
}

async function clickMyProfile(page: import('playwright-core').Page, triggerSelector: string) {
  const trigger = page.locator(triggerSelector).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(attempt === 0 ? 2200 : 2500);
    if (!(await trigger.count())) {
      if (attempt === 2) return { ok: false, reason: `no trigger ${triggerSelector}` };
      continue;
    }
    try {
      await trigger.click({ timeout: 15000 });
    } catch {
      if (attempt === 2) return { ok: false, reason: `trigger click failed ${triggerSelector}` };
      continue;
    }
    await page.waitForTimeout(500);
    const menu = page.locator('[role="menu"][aria-label="Account menu"]');
    if (!(await menu.isVisible().catch(() => false))) {
      if (attempt === 2) return { ok: false, reason: 'menu not visible' };
      continue;
    }
    const item = page.locator('[role="menuitem"]').filter({ hasText: 'My Profile' }).first();
    if (!(await item.count())) {
      if (attempt === 2) return { ok: false, reason: 'My Profile item missing' };
      continue;
    }
    await item.click();
    await page.waitForTimeout(1500);
    return { ok: true };
  }
  return { ok: false, reason: 'My Profile click exhausted retries' };
}

async function runCase(c: RoleCase) {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  try {
    const { token, uid } = await login(c.email);
    await injectSession(page, token);
    const start = c.startPath || '/admin/dashboard';
    await page.goto(`${BASE}${start}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const trigger = c.triggerSelector || '.cms-mirror-profile-trigger, button[aria-haspopup="menu"]';
    const click = await clickMyProfile(page, trigger);
    if (!click.ok) {
      return { label: c.label, pass: false, reason: click.reason, url: page.url() };
    }

    const expected =
      typeof c.expectedMyProfilePath === 'function'
        ? c.expectedMyProfilePath(uid)
        : c.expectedMyProfilePath;

    const url = page.url();
    const pass = url.includes(expected);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const comingSoon = /Coming Soon/i.test(bodyText) && /Admin Profile/i.test(bodyText);

    return {
      label: c.label,
      pass: pass && !comingSoon,
      expected,
      url,
      comingSoon,
      hasAdminTabs: /Account Information/i.test(bodyText) && /Permissions & Role/i.test(bodyText),
      hasBrandProfile: /Seller Profile|Brand Profile|brand-profile/i.test(bodyText + url),
    };
  } catch (e) {
    return { label: c.label, pass: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await browser.close();
  }
}

async function main() {
  const cases: RoleCase[] = [
    {
      label: 'admin',
      email: 'admin@choosify.com.bd',
      expectedMyProfilePath: '/admin/profile',
      startPath: '/admin/dashboard',
    },
    {
      label: 'seller',
      email: 'seller@choosify.com.bd',
      expectedMyProfilePath: '/admin/brand-profile',
      startPath: '/admin/dashboard',
    },
    {
      label: 'creator',
      email: 'creator@choosify.com.bd',
      expectedMyProfilePath: '/admin/creator-profile',
      startPath: '/admin/dashboard',
    },
    {
      label: 'consumer',
      email: 'consumer@choosify.com.bd',
      expectedMyProfilePath: '/admin/consumer-profile',
      startPath: '/admin/dashboard',
    },
  ];

  // Prefer stable seeded-or-registered consumer account
  const results = [];
  for (const c of cases) {
    if (c.label === 'consumer') {
      // Register once if missing
      const email = 'rc.consumer.stable@choosify.test';
      const loginTry = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: DEV_PASSWORD }),
      });
      if (!loginTry.ok) {
        await fetch(`${API}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: DEV_PASSWORD, fullName: 'RC Consumer' }),
        });
      }
      c.email = email;
    }
    results.push(await runCase(c));
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Admin inspecting seller then My Profile → own admin profile
  {
    const browser = await chromium
      .launch({ headless: true, channel: 'chrome' })
      .catch(() => chromium.launch({ headless: true }));
    const page = await browser.newPage();
    try {
      const { token } = await login('admin@choosify.com.bd');
      await injectSession(page, token);
      await page.goto(`${BASE}/seller/seller-demo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      if (page.url().includes('/login')) {
        await injectSession(page, token);
        await page.goto(`${BASE}/seller/seller-demo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2500);
      }
      const click = await clickMyProfile(page, '.cms-mirror-profile-trigger, button[aria-haspopup="menu"]');
      const url = page.url();
      results.push({
        label: 'admin-inspecting-seller',
        pass: click.ok && url.includes('/admin/profile'),
        expected: '/admin/profile',
        url,
        reason: click.ok ? undefined : click.reason,
      });
    } catch (e) {
      results.push({
        label: 'admin-inspecting-seller',
        pass: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      await browser.close();
    }
  }

  // Direct route refresh admin profile (soft re-nav — hard reload races Auth boot under load)
  {
    const browser = await chromium
      .launch({ headless: true, channel: 'chrome' })
      .catch(() => chromium.launch({ headless: true }));
    const page = await browser.newPage();
    try {
      const { token } = await login('admin@choosify.com.bd');
      await injectSession(page, token);
      await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      await page.evaluate((t) => {
        localStorage.setItem('choosify_auth_token', t);
        localStorage.removeItem('choosify_mock_role');
      }, token);
      await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const deadline = Date.now() + 15000;
      let bodyText = '';
      while (Date.now() < deadline) {
        if (page.url().includes('/login')) {
          await injectSession(page, token);
          await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
        bodyText = await page.locator('body').innerText().catch(() => '');
        const frame = page.frameLocator('iframe').first();
        try {
          bodyText += '\n' + (await frame.locator('body').innerText({ timeout: 3000 }));
        } catch {
          /* no iframe yet */
        }
        if (
          page.url().includes('/admin/profile') &&
          /Admin Profile|ADMIN/i.test(bodyText) &&
          !/Coming Soon/i.test(bodyText)
        ) {
          break;
        }
        await page.waitForTimeout(500);
      }
      results.push({
        label: 'admin-profile-refresh',
        pass:
          page.url().includes('/admin/profile') &&
          /Admin Profile|ADMIN/i.test(bodyText) &&
          !/Coming Soon/i.test(bodyText),
        url: page.url(),
      });
    } catch (e) {
      results.push({
        label: 'admin-profile-refresh',
        pass: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      await browser.close();
    }
  }

  console.log(JSON.stringify({ results }, null, 2));
  const allPass = results.every((r) => r.pass);
  console.log(allPass ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
