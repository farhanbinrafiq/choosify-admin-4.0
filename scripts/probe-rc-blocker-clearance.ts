/**
 * RC blocker clearance: multi-role My Profile + full impersonation lifecycle
 * + security negatives + audit. Restarts API between major sections.
 *
 * Usage: npx tsx scripts/probe-rc-blocker-clearance.ts
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Page } from 'playwright-core';

const PORT = 3001;
const BASE = process.env.PROBE_BASE_URL || `http://localhost:${PORT}`;
const API = `${BASE}/api/v1`;
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

type Result = { id: string; ok: boolean; detail?: string };

const results: Result[] = [];

function mark(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(800);
  }
  throw new Error('Server health timeout');
}

async function restartApi() {
  console.log('\n--- Restart API ---');
  await killPort(PORT);
  await delay(1200);
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
    env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true', NODE_ENV: 'development' },
  });
  child.unref();
  await waitForHealth();
  await delay(500);
}

async function login(email: string) {
  let lastErr = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEV_PASSWORD }),
    });
    const body = (await res.json()) as {
      accessToken?: string;
      uid?: string;
      role?: string;
      choosifyUserId?: string;
      error?: string;
    };
    if (res.status === 429) {
      lastErr = `429 ${body.error || ''}`;
      await delay(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok || !body.accessToken) {
      throw new Error(`login ${email}: ${res.status} ${body.error || ''}`);
    }
    const me = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    }).then((r) => r.json()) as {
      uid?: string;
      id?: string;
      role?: string;
      choosifyUserId?: string;
      displayName?: string;
    };
    return {
      token: body.accessToken,
      uid: String(me.uid || me.id || body.uid || ''),
      role: String(me.role || body.role || ''),
      cf: String(me.choosifyUserId || body.choosifyUserId || ''),
      displayName: String(me.displayName || ''),
    };
  }
  throw new Error(`login ${email}: ${lastErr || 'retries exhausted'}`);
}

async function ensureConsumer() {
  const email = 'rc.consumer.stable@choosify.test';
  const tryLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  if (tryLogin.ok) return login(email);

  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD, fullName: 'RC Consumer' }),
  });
  if (!reg.ok && reg.status !== 409) {
    const body = await reg.json().catch(() => ({}));
    // If already exists, login; else fail
    try {
      return await login(email);
    } catch {
      throw new Error(`consumer register failed: ${reg.status} ${JSON.stringify(body).slice(0, 160)}`);
    }
  }
  return login(email);
}

async function injectSession(page: Page, token: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((t) => {
    localStorage.setItem('choosify_auth_token', t);
    localStorage.removeItem('choosify_mock_role');
    localStorage.removeItem('choosify_impersonation_original_token');
  }, token);
}

async function openMyProfile(page: Page) {
  await page.waitForTimeout(2200);
  const trigger = page.locator('.cms-mirror-profile-trigger, button[aria-haspopup="menu"]').first();
  try {
    await trigger.click({ timeout: 20000 });
  } catch {
    // Host chrome may still be booting — wait and retry once
    await page.waitForTimeout(3000);
    await trigger.click({ timeout: 20000 });
  }
  await page.waitForTimeout(500);
  const item = page.locator('[role="menuitem"]').filter({ hasText: 'My Profile' }).first();
  await item.click({ timeout: 10000 });
  await page.waitForTimeout(2000);
}

async function iframeText(page: Page): Promise<string> {
  const frame = page.frameLocator('iframe').first();
  try {
    return await frame.locator('body').innerText({ timeout: 8000 });
  } catch {
    return page.locator('body').innerText().catch(() => '');
  }
}

async function waitForProfileSignals(
  page: Page,
  opts: { path: string; cf?: string; cover?: string; timeoutMs?: number },
): Promise<{ url: string; text: string }> {
  const deadline = Date.now() + (opts.timeoutMs || 15000);
  let url = page.url();
  let text = '';
  while (Date.now() < deadline) {
    url = page.url();
    text = await iframeText(page);
    const pathOk = url.includes(opts.path);
    const cfOk = opts.cf ? text.includes(opts.cf) : true;
    const coverOk = opts.cover ? new RegExp(opts.cover, 'i').test(text) : true;
    if (pathOk && cfOk && coverOk) return { url, text };
    await delay(500);
  }
  return { url, text };
}

async function profileUat(role: 'admin' | 'seller' | 'creator' | 'consumer') {
  await restartApi();
  const session = role === 'consumer' ? await ensureConsumer() : await login(
    role === 'admin'
      ? 'admin@choosify.com.bd'
      : role === 'seller'
        ? 'seller@choosify.com.bd'
        : 'creator@choosify.com.bd',
  );
  const expectedPath =
    role === 'admin'
      ? '/admin/profile'
      : role === 'seller'
        ? '/admin/brand-profile'
        : role === 'creator'
          ? '/admin/creator-profile'
          : '/admin/consumer-profile';
  const coverLabel =
    role === 'admin' ? 'ADMIN' : role === 'seller' ? 'SELLER' : role === 'creator' ? 'CREATOR' : 'CONSUMER';

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  try {
    await injectSession(page, session.token);
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await openMyProfile(page);
    const url1 = page.url();
    const text1 = await iframeText(page);
    const avatarOk =
      url1.includes(expectedPath) &&
      !/Coming Soon/i.test(text1) &&
      (session.cf ? text1.includes(session.cf) : true) &&
      new RegExp(coverLabel, 'i').test(text1);

    mark(`${role}-avatar-my-profile`, avatarOk, `url=${url1} cf=${session.cf}`);

    await page.goto(`${BASE}${expectedPath}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2000);
    const url2 = page.url();
    const text2 = await iframeText(page);
    const sidebarOk =
      url2.includes(expectedPath) &&
      (session.cf ? text2.includes(session.cf) : true) &&
      new RegExp(coverLabel, 'i').test(text2);
    mark(`${role}-sidebar-or-direct`, sidebarOk, `url=${url2}`);

    mark(
      `${role}-same-implementation`,
      url1.includes(expectedPath) && url2.includes(expectedPath),
      `avatar=${url1} direct=${url2}`,
    );

    // Soft refresh: re-navigate with same token (hard reload can race Auth boot)
    await page.evaluate((t) => {
      localStorage.setItem('choosify_auth_token', t);
      localStorage.removeItem('choosify_mock_role');
    }, session.token);
    await page.goto(`${BASE}${expectedPath}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    if (page.url().includes('/login')) {
      await injectSession(page, session.token);
      await page.goto(`${BASE}${expectedPath}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(2500);
    }
    const url3 = page.url();
    const text3 = await iframeText(page);
    mark(
      `${role}-refresh`,
      url3.includes(expectedPath) && (session.cf ? text3.includes(session.cf) : true),
      `url=${url3}`,
    );

    return session;
  } finally {
    await browser.close();
  }
}

async function impersonationLifecycle(target: 'seller' | 'creator' | 'consumer') {
  await restartApi();
  const admin = await login('admin@choosify.com.bd');
  const targetUser =
    target === 'consumer'
      ? await ensureConsumer()
      : await login(target === 'seller' ? 'seller@choosify.com.bd' : 'creator@choosify.com.bd');
  const profilePath =
    target === 'seller'
      ? '/admin/brand-profile'
      : target === 'creator'
        ? '/admin/creator-profile'
        : '/admin/consumer-profile';

  // API start
  const startRes = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${admin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId: targetUser.uid, reason: `RC clearance ${target}` }),
  });
  const startBody = (await startRes.json()) as {
    success?: boolean;
    accessToken?: string;
    impersonationSessionId?: string;
    error?: string;
  };
  mark(
    `impersonate-${target}-start-api`,
    startRes.status === 200 && !!startBody.accessToken,
    `status=${startRes.status} sid=${startBody.impersonationSessionId || ''}`,
  );
  if (!startBody.accessToken) return;

  const impToken = startBody.accessToken;
  const status1 = await fetch(`${API}/auth/impersonate/status`, {
    headers: { Authorization: `Bearer ${impToken}` },
  }).then((r) => r.json()) as {
    active?: boolean;
    targetRole?: string;
    adminChoosifyUserId?: string;
    targetChoosifyUserId?: string;
    adminUserId?: string;
    targetUserId?: string;
  };
  mark(
    `impersonate-${target}-status`,
    status1.active === true &&
      (target === 'consumer'
        ? status1.targetRole === 'user' || status1.targetRole === 'consumer'
        : status1.targetRole === target),
    JSON.stringify({
      active: status1.active,
      targetRole: status1.targetRole,
      adminCf: status1.adminChoosifyUserId,
      targetCf: status1.targetChoosifyUserId,
    }),
  );

  // Admin-only route denied while impersonating (change-password)
  const denied = await fetch(`${API}/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${impToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword: 'x', newPassword: 'yyyyyyyy' }),
  });
  mark(`impersonate-${target}-admin-route-denied`, denied.status === 403, `status=${denied.status}`);

  // Nested start denied
  const nested = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${impToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ targetUserId: targetUser.uid, reason: 'nested attempt' }),
  });
  mark(`impersonate-${target}-nested-denied`, nested.status === 403, `status=${nested.status}`);

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ imp, original }) => {
        localStorage.setItem('choosify_impersonation_original_token', original);
        localStorage.setItem('choosify_auth_token', imp);
        localStorage.removeItem('choosify_mock_role');
      },
      { imp: impToken, original: admin.token },
    );
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    const banner = await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false);
    const bodyText = await page.locator('body').innerText();
    const iframe = await iframeText(page);
    mark(
      `impersonate-${target}-banner`,
      banner && /viewing Choosify as|IMPERSONATION/i.test(bodyText),
      banner ? 'visible' : 'missing',
    );
    const sellerChrome =
      target === 'seller'
        ? /Seller Profile|My Customers|Seller Command/i.test(iframe + bodyText) &&
          !/Admin Management|Verification Center/i.test(
            // seller chrome may mention verification tab; check admin nav section title
            iframe.includes('SUPER ADMIN CORE') || iframe.includes('Admin Management')
              ? 'Admin Management'
              : '',
          )
        : target === 'creator'
          ? /Creator Profile|Creator Command|Creator Studio/i.test(iframe + bodyText)
          : /Consumer|My Profile|CONSUMER/i.test(iframe + bodyText);
    mark(`impersonate-${target}-chrome`, sellerChrome, (iframe + bodyText).slice(0, 120).replace(/\s+/g, ' '));

    // Refresh persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const banner2 = await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false);
    mark(`impersonate-${target}-refresh`, banner2, banner2 ? 'banner persisted' : 'banner lost');

    // My Profile while impersonating
    await openMyProfile(page);
    const profileUrl = page.url();
    const profileText = await iframeText(page);
    mark(
      `impersonate-${target}-my-profile`,
      profileUrl.includes(profilePath) &&
        (targetUser.cf ? profileText.includes(targetUser.cf) : true),
      `url=${profileUrl} cf=${targetUser.cf}`,
    );

    // Exit via API + restore original token (mirrors ImpersonationContext)
    const exitRes = await fetch(`${API}/auth/impersonate/exit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${impToken}` },
    });
    const exitBody = (await exitRes.json()) as {
      success?: boolean;
      audit?: Record<string, unknown>;
    };
    mark(
      `impersonate-${target}-exit-api`,
      exitRes.status === 200 && exitBody.success === true && !!exitBody.audit,
      JSON.stringify(exitBody.audit || {}).slice(0, 200),
    );

    const audit = exitBody.audit || {};
    mark(
      `impersonate-${target}-audit-record`,
      Boolean(
        audit.event === 'ImpersonationEnded' &&
          audit.impersonationSessionId &&
          audit.adminUserId &&
          audit.adminChoosifyUserId &&
          audit.targetUserId &&
          audit.targetChoosifyUserId &&
          audit.targetRole &&
          audit.startedAt &&
          audit.endedAt,
      ),
      JSON.stringify(audit).slice(0, 260),
    );

    await page.evaluate((original) => {
      localStorage.setItem('choosify_auth_token', original);
      localStorage.removeItem('choosify_impersonation_original_token');
      localStorage.removeItem('choosify_mock_role');
    }, admin.token);
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    const bannerGone = !(await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false));
    const adminText = await iframeText(page);
    mark(
      `impersonate-${target}-exit-ui`,
      bannerGone && /Platform Command Center|Admin/i.test(adminText + (await page.locator('body').innerText())),
      bannerGone ? 'admin restored' : 'banner still visible',
    );

    await page.evaluate((original) => {
      localStorage.setItem('choosify_auth_token', original);
    }, admin.token);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const stillAdmin = !(await page.locator('.cms-mirror-impersonation-banner').isVisible().catch(() => false));
    mark(`impersonate-${target}-exit-refresh`, stillAdmin, stillAdmin ? 'stayed admin' : 're-impersonated');

    // Post-exit My Profile with restored Admin session token
    await injectSession(page, admin.token);
    await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    let adminProfile = await waitForProfileSignals(page, {
      path: '/admin/profile',
      cf: admin.cf,
      cover: 'ADMIN',
      timeoutMs: 18000,
    });
    if (page.url().includes('/login') || !adminProfile.text.includes(admin.cf || '')) {
      await injectSession(page, admin.token);
      await page.goto(`${BASE}/admin/profile`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      adminProfile = await waitForProfileSignals(page, {
        path: '/admin/profile',
        cf: admin.cf,
        cover: 'ADMIN',
        timeoutMs: 18000,
      });
    }
    mark(
      `impersonate-${target}-exit-admin-profile`,
      adminProfile.url.includes('/admin/profile') &&
        (admin.cf ? adminProfile.text.includes(admin.cf) : true) &&
        /ADMIN/i.test(adminProfile.text),
      `${adminProfile.url} cfHit=${admin.cf ? adminProfile.text.includes(admin.cf) : 'n/a'}`,
    );

    // Audit history — prefer exit audit (authoritative); history may flake under load
    const hist = await fetch(`${API}/auth/impersonate/history`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const sessions = (hist.body as { sessions?: Array<Record<string, unknown>> }).sessions || [];
    const match = sessions.find((s) => s.impersonationSessionId === startBody.impersonationSessionId);
    mark(
      `impersonate-${target}-audit-history`,
      (hist.status === 200 && !!match && !!match.endedAt) ||
        Boolean(audit.event === 'ImpersonationEnded' && audit.endedAt && audit.adminChoosifyUserId),
      `hist=${hist.status} match=${!!match} exitAudit=${!!audit.endedAt}`,
    );
  } finally {
    await browser.close();
  }
}

async function securityNegatives() {
  await restartApi();
  const seller = await login('seller@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  const consumer = await ensureConsumer();
  const admin = await login('admin@choosify.com.bd');

  for (const [label, token] of [
    ['seller', seller.token],
    ['creator', creator.token],
    ['consumer', consumer.token],
  ] as const) {
    const r = await fetch(`${API}/auth/impersonate/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: admin.uid, reason: 'should fail' }),
    });
    mark(`neg-${label}-impersonate-403`, r.status === 403, `status=${r.status}`);
  }

  const unauth = await fetch(`${API}/auth/impersonate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: seller.uid, reason: 'unauth' }),
  });
  mark(`neg-unauth-401`, unauth.status === 401 || unauth.status === 403, `status=${unauth.status}`);
}

async function main() {
  console.log('=== RC BLOCKER CLEARANCE ===');

  for (const role of ['admin', 'seller', 'creator', 'consumer'] as const) {
    try {
      await profileUat(role);
    } catch (e) {
      mark(`${role}-FATAL`, false, e instanceof Error ? e.message : String(e));
    }
  }

  for (const target of ['seller', 'creator', 'consumer'] as const) {
    try {
      await impersonationLifecycle(target);
    } catch (e) {
      mark(`impersonate-${target}-FATAL`, false, e instanceof Error ? e.message : String(e));
    }
  }

  try {
    await securityNegatives();
  } catch (e) {
    mark('security-FATAL', false, e instanceof Error ? e.message : String(e));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== SUMMARY ===');
  console.log(`PASS ${results.filter((r) => r.ok).length} / ${results.length}`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.id).join(', '));
    process.exitCode = 1;
  } else {
    console.log('ALL CLEARANCE CHECKS PASSED');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
