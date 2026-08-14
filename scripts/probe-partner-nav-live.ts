/**
 * Live Seller/Creator sidebar capture + entitlement OFF/ON + refresh + impersonation.
 * Requires admin API on :3001.
 *
 * Run: npx tsx scripts/probe-partner-nav-live.ts
 */
import { chromium, type Page } from 'playwright-core';
import {
  ADMIN_ONLY_PAGE_KEYS,
  CREATOR_NAV_GROUPS,
  SELLER_NAV_GROUPS,
  pageKeysFromNavGroups,
} from '../src/cms-mirror/nav';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function mark(ok: unknown, msg: string) {
  if (!ok) fails.push(msg);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
}

async function login(email: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const body = (await res.json()) as { accessToken?: string; uid?: string; error?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login ${email}: ${res.status} ${body.error || ''}`);
  return { token: body.accessToken, uid: body.uid || '' };
}

async function setEnt(adminToken: string, role: 'seller' | 'creator', feature: string, enabled: boolean) {
  const r = await fetch(`${API}/entitlements/admin/role-defaults/${role}/${feature}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!r.ok) throw new Error(`setEnt ${role}/${feature}=${enabled} → ${r.status}`);
}

type CapturedNav = { categories: string[]; keys: string[]; labels: string[] };

async function captureNav(page: Page): Promise<CapturedNav> {
  await page.waitForTimeout(1800);
  for (let i = 0; i < 12; i++) {
    const authenticating = await page.locator('text=AUTHENTICATING').count().catch(() => 0);
    const iframe = await page.locator('iframe').count().catch(() => 0);
    if (!authenticating && iframe) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    const win = iframe?.contentWindow as Window & {
      __CMS_MIRROR_NAV_GROUPS__?: Array<{ title: string; items: Array<{ key: string; label: string }> }>;
      __CMS_MIRROR_FILTER_NAV__?: (defs: unknown, allowed?: string[]) => Array<{
        title: string;
        items: Array<{ key: string; label: string }>;
      }>;
      __CMS_MIRROR_ALLOWED_KEYS__?: string[];
      __CMS_MIRROR_ROLE__?: string;
    } | null;
    const groups = win?.__CMS_MIRROR_NAV_GROUPS__;
    if (groups?.length) {
      return {
        categories: groups.map((g) => g.title),
        keys: groups.flatMap((g) => g.items.map((i) => i.key)),
        labels: groups.flatMap((g) => g.items.map((i) => i.label)),
      };
    }
    const filtered = win?.__CMS_MIRROR_FILTER_NAV__?.([], win.__CMS_MIRROR_ALLOWED_KEYS__);
    if (filtered?.length) {
      return {
        categories: filtered.map((g) => g.title),
        keys: filtered.flatMap((g) => g.items.map((i) => i.key)),
        labels: filtered.flatMap((g) => g.items.map((i) => i.label)),
      };
    }
    const doc = iframe?.contentDocument;
    const text = doc?.body?.innerText || document.body.innerText || '';
    return { categories: [], keys: [], labels: text.replace(/\s+/g, ' ').slice(0, 240).split(' ') };
  });
}

async function openAs(page: Page, opts: { mockRole?: string; token?: string; path?: string }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ mockRole, token }) => {
    if (token) {
      localStorage.setItem('choosify_auth_token', token);
      localStorage.removeItem('choosify_mock_role');
    } else if (mockRole) {
      localStorage.removeItem('choosify_auth_token');
      localStorage.setItem('choosify_mock_role', mockRole);
    }
  }, { mockRole: opts.mockRole || '', token: opts.token || '' });
  await page.goto(`${BASE}${opts.path || '/admin/dashboard'}`, { waitUntil: 'domcontentloaded' });
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  const report: Record<string, unknown> = {};

  try {
    // --- Mock role switch (the previous regression path) ---
    await openAs(page, { mockRole: 'super_admin' });
    report.adminMock = await captureNav(page);

    await openAs(page, { mockRole: 'seller' });
    const sellerMock = await captureNav(page);
    report.sellerMock = sellerMock;

    await openAs(page, { mockRole: 'creator' });
    const creatorMock = await captureNav(page);
    report.creatorMock = creatorMock;

    const sellerExpected = pageKeysFromNavGroups(SELLER_NAV_GROUPS);
    const creatorExpected = pageKeysFromNavGroups(CREATOR_NAV_GROUPS);

    for (const k of sellerExpected) {
      mark(sellerMock.keys.includes(k), `mock seller has ${k}`);
    }
    for (const k of creatorExpected) {
      mark(creatorMock.keys.includes(k), `mock creator has ${k}`);
    }
    for (const k of ADMIN_ONLY_PAGE_KEYS) {
      mark(!sellerMock.keys.includes(k), `mock seller lacks admin ${k}`);
      mark(!creatorMock.keys.includes(k), `mock creator lacks admin ${k}`);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    const creatorRefresh = await captureNav(page);
    mark(creatorRefresh.keys.includes('creators') && creatorRefresh.keys.includes('myEarnings'), 'creator mock nav survives refresh');

    // --- JWT seller/creator ---
    let adminToken = '';
    let sellerToken = '';
    let creatorToken = '';
    let sellerUid = '';
    let creatorUid = '';
    try {
      const admin = await login('admin@choosify.com.bd');
      adminToken = admin.token;
      await new Promise((r) => setTimeout(r, 800));
      const seller = await login('seller@choosify.com.bd');
      sellerToken = seller.token;
      sellerUid = seller.uid;
      await new Promise((r) => setTimeout(r, 800));
      const creator = await login('creator@choosify.com.bd');
      creatorToken = creator.token;
      creatorUid = creator.uid;
    } catch (e) {
      console.warn('JWT login skipped:', e);
    }

    if (sellerToken) {
      await openAs(page, { token: sellerToken });
      const sellerJwt = await captureNav(page);
      report.sellerJwt = sellerJwt;
      mark(sellerJwt.keys.includes('products') && sellerJwt.keys.includes('myCashbook'), 'JWT seller baseline products+cashbooks');

      await page.reload({ waitUntil: 'domcontentloaded' });
      const sellerJwtRefresh = await captureNav(page);
      mark(sellerJwtRefresh.keys.includes('products'), 'JWT seller nav survives refresh');

      if (adminToken) {
        await setEnt(adminToken, 'seller', 'cashbooks', false);
        await page.reload({ waitUntil: 'domcontentloaded' });
        const offNav = await captureNav(page);
        report.sellerCashbooksOff = offNav;
        mark(!offNav.keys.includes('myCashbook'), 'seller cashbooks OFF hides Cashbooks');
        mark(offNav.keys.includes('dashboard') && offNav.keys.includes('products'), 'seller cashbooks OFF keeps core+products');

        await page.goto(`${BASE}/admin/cashbook`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        mark(!page.url().includes('/admin/cashbook'), `seller cashbooks OFF blocks route (url=${page.url()})`);

        const apiOff = await fetch(`${API}/cashbooks`, { headers: { Authorization: `Bearer ${sellerToken}` } });
        mark(apiOff.status === 403, `seller cashbooks OFF API ${apiOff.status}`);

        await setEnt(adminToken, 'seller', 'cashbooks', true);
        await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
        const onNav = await captureNav(page);
        report.sellerCashbooksOn = onNav;
        mark(onNav.keys.includes('myCashbook'), 'seller cashbooks ON restores Cashbooks');
        await page.goto(`${BASE}/admin/cashbook`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        mark(page.url().includes('/admin/cashbook'), `seller cashbooks ON route (url=${page.url()})`);
        const apiOn = await fetch(`${API}/cashbooks`, { headers: { Authorization: `Bearer ${sellerToken}` } });
        mark(apiOn.status === 200, `seller cashbooks ON API ${apiOn.status}`);
      }
    }

    if (creatorToken) {
      await new Promise((r) => setTimeout(r, 1500));
      await openAs(page, { token: creatorToken });
      let creatorJwt = await captureNav(page);
      if (!creatorJwt.keys.length && adminToken && creatorUid) {
        const cStart = await fetch(`${API}/auth/impersonate/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: creatorUid, reason: 'Nav probe creator JWT fallback' }),
        });
        const cBody = (await cStart.json()) as { accessToken?: string };
        if (cBody.accessToken) {
          creatorToken = cBody.accessToken;
          await openAs(page, { token: creatorToken });
          creatorJwt = await captureNav(page);
          report.creatorJwtViaImpersonation = true;
        }
      }
      report.creatorJwt = creatorJwt;
      mark(creatorJwt.keys.includes('creators') && creatorJwt.keys.includes('creatorEconomy'), 'JWT creator baseline studio+economy');

      if (adminToken) {
        await setEnt(adminToken, 'creator', 'creatorEconomy', false);
        await page.reload({ waitUntil: 'domcontentloaded' });
        const offNav = await captureNav(page);
        report.creatorEconomyOff = offNav;
        mark(!offNav.keys.includes('creatorEconomy'), 'creatorEconomy OFF hides nav');
        mark(offNav.keys.includes('creators') && offNav.keys.includes('creatorProfile'), 'creatorEconomy OFF keeps studio+profile');

        await page.goto(`${BASE}/admin/creator-hub`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        mark(!page.url().includes('/admin/creator-hub'), `creatorEconomy OFF blocks route (url=${page.url()})`);

        await setEnt(adminToken, 'creator', 'creatorEconomy', true);
        await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
        const onNav = await captureNav(page);
        report.creatorEconomyOn = onNav;
        mark(onNav.keys.includes('creatorEconomy'), 'creatorEconomy ON restores nav');
        await page.goto(`${BASE}/admin/creator-hub`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        mark(page.url().includes('/admin/creator-hub') || onNav.keys.includes('creatorEconomy'), `creatorEconomy ON route (url=${page.url()})`);
      }
      if (report.creatorJwtViaImpersonation && creatorToken) {
        await fetch(`${API}/auth/impersonate/exit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${creatorToken}` },
        }).catch(() => {});
      }
    }

    // Impersonation: admin → seller → exit
    if (adminToken && sellerUid) {
      const start = await fetch(`${API}/auth/impersonate/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: sellerUid, reason: 'Nav regression probe' }),
      });
      const startBody = (await start.json()) as { accessToken?: string };
      mark(Boolean(startBody.accessToken), `impersonate seller start ${start.status}`);
      if (startBody.accessToken) {
        // Apply the impersonation JWT on the current origin. Do not round-trip
        // /login — LoginPage/AuthContext can race-clear the token we just set.
        await page.evaluate(
          ({ original, token }) => {
            localStorage.setItem('choosify_impersonation_original_token', original);
            localStorage.setItem('choosify_auth_token', token);
            localStorage.removeItem('choosify_mock_role');
          },
          { original: adminToken, token: startBody.accessToken },
        );
        await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        let impNav = await captureNav(page);
        if (!impNav.keys.length) {
          await page.waitForTimeout(2000);
          await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
          impNav = await captureNav(page);
        }
        report.impersonateSeller = impNav;
        mark(
          impNav.keys.includes('products') &&
            impNav.keys.includes('brandProfile') &&
            !impNav.keys.includes('featureAccess') &&
            !impNav.keys.includes('websiteCmsStudio'),
          'impersonate seller nav is seller not admin',
        );

        const exit = await fetch(`${API}/auth/impersonate/exit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${startBody.accessToken}` },
        });
        mark(exit.ok, `impersonate exit ${exit.status}`);
        await page.evaluate((original) => {
          localStorage.setItem('choosify_auth_token', original);
          localStorage.removeItem('choosify_impersonation_original_token');
        }, adminToken);
        await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3500);
        const afterExit = await captureNav(page);
        report.afterImpersonationExit = afterExit;
        mark(
          afterExit.keys.includes('featureAccess') ||
            afterExit.keys.includes('adminManagement') ||
            afterExit.labels.includes('Consumers') ||
            afterExit.labels.includes('Category'),
          'exit impersonation restores admin nav',
        );
      }

      if (creatorUid) {
        const cStart = await fetch(`${API}/auth/impersonate/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: creatorUid, reason: 'Nav regression probe creator' }),
        });
        const cBody = (await cStart.json()) as { accessToken?: string };
        if (cBody.accessToken) {
          await page.evaluate((token) => {
            localStorage.setItem('choosify_auth_token', token);
            localStorage.removeItem('choosify_mock_role');
          }, cBody.accessToken);
          await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
          const cNav = await captureNav(page);
          report.impersonateCreator = cNav;
          mark(cNav.keys.includes('creators') && !cNav.keys.includes('featureAccess'), 'impersonate creator nav is creator not admin');
          await fetch(`${API}/auth/impersonate/exit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cBody.accessToken}` },
          });
        }
      }
    }

    // Entitlements API failure must not persist as OFF override (401 with no token already covered by mock).
    if (sellerToken) {
      const r401 = await fetch(`${API}/entitlements/me`);
      mark(r401.status === 401, `/entitlements/me no token → ${r401.status}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n--- CAPTURE ---');
  console.log(JSON.stringify(report, null, 2));

  if (fails.length) {
    console.error('\nFAIL probe-partner-nav-live');
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log('\nPASS probe-partner-nav-live');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
