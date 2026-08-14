/**
 * Browser regression: Login As must stay on cms-mirror universal profiles.
 * Run: npx tsx scripts/probe-login-as-universal-routing.ts
 */
import { chromium, type Page } from 'playwright-core';
import {
  canonicalImpersonationReturnPath,
  isLegacyInspectionPath,
  inspectionUniversalPath,
  safeImpersonationReturnPath,
  IMPERSONATION_DASHBOARD_PATH,
} from '../src/lib/impersonationRouting';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';

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

const ROLE_EMAIL: Record<'consumer' | 'seller' | 'creator', string> = {
  consumer: 'consumer@choosify.com.bd',
  seller: 'seller@choosify.com.bd',
  creator: 'creator@choosify.com.bd',
};

async function resolveTarget(adminToken: string, role: 'consumer' | 'seller' | 'creator') {
  const direct = await login(ROLE_EMAIL[role]).catch(() => null);
  if (direct?.uid) return direct;
  const queries = role === 'consumer' ? ['CF-', 'consumer', '@'] : [role, ROLE_EMAIL[role]];
  for (const q of queries) {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&limitPerGroup=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      groups?: Array<{ items: Array<{ id: string; title: string; subtitle?: string; type: string; route?: string }> }>;
    };
    const users = (body.groups || []).flatMap((g) => g.items).filter((i) => i.type === 'User');
    const hit = users.find((u) => {
      const hay = `${u.subtitle || ''} ${u.title} ${u.route || ''}`;
      if (role === 'seller') return /seller/i.test(hay);
      if (role === 'creator') return /creator/i.test(hay);
      return /consumer|user/i.test(hay) && !/seller|creator|admin/i.test(hay);
    }) || (role === 'consumer' ? users[0] : null);
    if (hit?.id) return { token: '', uid: hit.id };
  }
  return null;
}

async function bootAdmin(page: Page, token: string) {
  await page.addInitScript(
    ({ t }) => {
      // Seed admin JWT only when no session exists. Never clobber an active
      // impersonation token or return path on later navigations/reloads.
      if (!localStorage.getItem('choosify_auth_token')) {
        localStorage.setItem('choosify_auth_token', t);
      }
    },
    { t: token },
  );
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  const iframeVisible = await page
    .waitForSelector('iframe[title="Choosify Admin CMS"]', { timeout: 40000 })
    .then(() => true)
    .catch(() => false);
  if (iframeVisible) return;

  const info = await page.evaluate(() => ({
    href: location.href,
    text: document.body?.innerText?.slice(0, 400) || '',
  }));
  console.error('bootAdmin failed', info);
  throw new Error('cms-mirror iframe did not appear');
}

function legacyMarkers(pathname: string, html: string) {
  return {
    legacyPath: isLegacyInspectionPath(pathname),
    farhanMock: /Farhan Bin Rafiq/i.test(html),
    upeLoading: /Loading Unified Profile/i.test(html),
    consumerLegacyRoute: /^\/consumer\//.test(pathname),
  };
}

async function waitIframe(page: Page) {
  await page.waitForSelector('iframe[title="Choosify Admin CMS"]', { timeout: 20000 });
  const frame = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  for (let i = 0; i < 24; i++) {
    const loginAs = await frame.locator('button', { hasText: 'Login As User' }).count().catch(() => 0);
    if (loginAs > 0) return frame;
    const row = frame.locator('table tbody tr, [sc-camel-on-click]').first();
    if (await row.count().catch(() => 0)) {
      await row.click({ timeout: 2000 }).catch(() => undefined);
    }
    await page.waitForTimeout(400);
  }
  return frame;
}

async function snapshot(page: Page) {
  const pathname = await page.evaluate(() => window.location.pathname + window.location.search);
  const html = await page.content();
  const iframe = await page.locator('iframe[title="Choosify Admin CMS"]').count();
  const modal = await page.locator('[role="dialog"]').filter({ hasText: /Login As User/i }).count();
  const banner = await page.locator('.cms-mirror-impersonation-banner').count();
  return { pathname, iframe, modal, banner, ...legacyMarkers(pathname.split('?')[0], html) };
}

async function flowForRole(
  page: Page,
  role: 'consumer' | 'seller' | 'creator',
  route: string,
  targetUserId: string,
) {
  const prefix = role.toUpperCase();
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('iframe[title="Choosify Admin CMS"]', { timeout: 25000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const before = await snapshot(page);
  mark(before.iframe > 0, `${prefix} A. cms-mirror iframe before Login As (${before.pathname})`);
  mark(!before.legacyPath, `${prefix} A. not a legacy inspection path`);
  mark(before.modal === 0, `${prefix} A. modal closed before click`);

  const frame = await waitIframe(page).catch(() => null);
  if (!frame) {
    mark(false, `${prefix} cms-mirror iframe missing after navigation (${(await snapshot(page)).pathname})`);
    return;
  }
  if (role === 'seller') {
    await frame.getByText('All Brands', { exact: false }).first().click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(700);
    await frame.locator('table tbody tr').first().click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
  const loginBtn = frame.locator('button', { hasText: 'Login As User' }).first();
  const visible = (await loginBtn.count().catch(() => 0)) > 0;
  if (visible) mark(true, `${prefix} Login As User button visible on universal profile`);
  else console.log(`WARN ${prefix} Login As button not in iframe after deep link (overlay/start/exit still tested)`);
  if (visible) {
    await loginBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.evaluate((payload) => {
    window.postMessage({ type: 'cms-mirror-login-as-user', ...payload }, '*');
  }, {
    targetUserId,
    displayName: `${role} probe`,
    roleLabel: role[0].toUpperCase() + role.slice(1),
  });
  await page.waitForTimeout(800);
  const modalOpen = await snapshot(page);
  mark(modalOpen.modal > 0, `${prefix} B. confirmation modal open`);
  mark(modalOpen.pathname === before.pathname, `${prefix} B. URL unchanged while modal open (${modalOpen.pathname})`);
  mark(modalOpen.iframe > 0, `${prefix} B. cms-mirror still mounted under modal`);
  mark(!modalOpen.legacyPath && !modalOpen.farhanMock, `${prefix} B. no legacy Farhan/UPE shell under modal`);
  if (!modalOpen.modal) return;

  const cancel = page.locator('[role="dialog"] button', { hasText: 'Cancel' }).first();
  if (await cancel.count()) await cancel.click();
  else await page.getByRole('button', { name: 'Cancel' }).click({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const afterCancel = await snapshot(page);
  mark(afterCancel.modal === 0, `${prefix} Cancel closes modal`);
  mark(afterCancel.pathname === before.pathname, `${prefix} Cancel does not navigate`);

  await page.evaluate((payload) => {
    window.postMessage({ type: 'cms-mirror-login-as-user', ...payload }, '*');
  }, {
    targetUserId,
    displayName: `${role} probe`,
    roleLabel: role[0].toUpperCase() + role.slice(1),
  });
  await page.waitForTimeout(600);
  const cont = page.locator('[role="dialog"] button', { hasText: 'Continue' }).first();
  if (await cont.count()) await cont.click();
  else   await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .locator('.cms-mirror-impersonation-banner, .cms-mirror-impersonation-banner__exit')
    .first()
    .waitFor({ timeout: 25000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  const afterContinue = await snapshot(page);
  if (!afterContinue.banner) {
    const dbg = await page.evaluate(() => ({
      href: location.href,
      returnPath: localStorage.getItem('choosify_impersonation_return_path'),
      hasOriginal: Boolean(localStorage.getItem('choosify_impersonation_original_token')),
      text: document.body?.innerText?.slice(0, 500) || '',
    }));
    console.log(`${prefix} after Continue debug`, dbg);
  }
  mark(
    afterContinue.pathname.split('?')[0] === IMPERSONATION_DASHBOARD_PATH,
    `${prefix} C. Continue lands on ${IMPERSONATION_DASHBOARD_PATH} (${afterContinue.pathname})`,
  );
  mark(afterContinue.banner > 0, `${prefix} C. impersonation banner visible`);
  mark(!afterContinue.legacyPath, `${prefix} C. not a legacy path after start`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const afterRefresh = await snapshot(page);
  mark(afterRefresh.banner > 0, `${prefix} refresh still impersonating`);

  const exit = page.locator('button', { hasText: 'Exit Impersonation' }).first();
  if (await exit.count()) {
    page.once('dialog', (d) => d.accept().catch(() => undefined));
    await exit.click();
    await page.waitForSelector('iframe[title="Choosify Admin CMS"]', { timeout: 25000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
  } else {
    console.log(`${prefix} Exit Impersonation button missing`);
  }
  const afterExit = await snapshot(page);
  const expectedReturn = route.split('?')[0];
  mark(
    afterExit.pathname.startsWith(expectedReturn) || afterExit.pathname === route,
    `${prefix} D. exit restored universal route (got ${afterExit.pathname}, expected ${route})`,
  );
  mark(!afterExit.legacyPath && !afterExit.farhanMock, `${prefix} D. exit did not land on legacy profile`);
  mark(afterExit.banner === 0, `${prefix} D. impersonation banner gone`);
}

async function securityChecks(adminToken: string, targetUserId: string) {
  const noAuth = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, reason: 'probe' }),
  });
  mark(noAuth.status === 401, `unauthenticated start → 401 (${noAuth.status})`);

  const seller = await login('seller@choosify.com.bd').catch(() => null);
  if (seller) {
    const forbidden = await fetch(`${API}/auth/impersonate/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, reason: 'probe' }),
    });
    mark(forbidden.status === 403, `non-admin start → 403 (${forbidden.status})`);
  } else {
    mark(false, 'seller login for 403 check');
  }

  const nested = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId, reason: 'Universal routing probe' }),
  });
  const nestedBody = (await nested.json().catch(() => ({}))) as { accessToken?: string; success?: boolean };
  mark(nested.ok && Boolean(nestedBody.accessToken), `admin start still authorized (${nested.status})`);
  if (nestedBody.accessToken) {
    const again = await fetch(`${API}/auth/impersonate/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nestedBody.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, reason: 'nested' }),
    });
    mark(again.status === 403 || again.status === 400 || !again.ok, `nested impersonation blocked (${again.status})`);
    await fetch(`${API}/auth/impersonate/exit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nestedBody.accessToken}` },
    });
  }
}

async function main() {
  mark(
    canonicalImpersonationReturnPath('/consumer/abc-123') === inspectionUniversalPath('consumer', 'abc-123'),
    'helper maps /consumer/:id → /admin/consumers/:id',
  );
  mark(
    canonicalImpersonationReturnPath('/seller/s1') === inspectionUniversalPath('seller', 's1'),
    'helper maps /seller/:id → brand-studio?sellerId=',
  );
  mark(
    canonicalImpersonationReturnPath('/creator/c1') === inspectionUniversalPath('creator', 'c1'),
    'helper maps /creator/:id → /admin/creators/:id',
  );
  mark(
    canonicalImpersonationReturnPath('/admin/consumers/u1') === '/admin/consumers/u1',
    'helper keeps universal consumer path',
  );
  mark(safeImpersonationReturnPath('/consumer/x') === '/admin/consumers/x', 'safe exit rewrites legacy consumer');
  mark(safeImpersonationReturnPath('https://evil.example/') === IMPERSONATION_DASHBOARD_PATH, 'safe exit rejects absolute URL');
  mark(isLegacyInspectionPath('/consumer/u1'), 'legacy detector flags /consumer/:id');
  mark(!isLegacyInspectionPath('/admin/consumers/u1'), 'legacy detector allows universal consumer');

  const admin = await login(ADMIN_EMAIL);
  const consumer = await resolveTarget(admin.token, 'consumer');
  const seller = await resolveTarget(admin.token, 'seller');
  const creator = await resolveTarget(admin.token, 'creator');
  if (!consumer?.uid) throw new Error('no consumer target');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  try {
    await bootAdmin(page, admin.token);
    await flowForRole(page, 'consumer', inspectionUniversalPath('consumer', consumer.uid), consumer.uid);
    if (seller) await flowForRole(page, 'seller', inspectionUniversalPath('seller', seller.uid), seller.uid);
    else mark(false, 'SELLER login missing');
    if (creator) await flowForRole(page, 'creator', inspectionUniversalPath('creator', creator.uid), creator.uid);
    else mark(false, 'CREATOR login missing');

    await page.goto(`${BASE}${inspectionUniversalPath('consumer', consumer.uid)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const refreshProfile = await snapshot(page);
    mark(refreshProfile.iframe > 0 && !refreshProfile.legacyPath, 'refresh on universal consumer profile stays cms-mirror');
    await securityChecks(admin.token, consumer.uid);
  } finally {
    await browser.close();
  }

  if (fails.length) {
    console.error(`\nFAILED ${fails.length}\n${fails.map((f) => ` - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\nLOGIN-AS UNIVERSAL ROUTING PROBE GREEN');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
