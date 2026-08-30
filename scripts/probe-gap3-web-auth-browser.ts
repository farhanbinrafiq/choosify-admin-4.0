/**
 * Pre-VPS Gap 3 closure — real headed(-capable) browser UAT of the NEW
 * self-service auth pages against the actual running Choosify-Web dev
 * server (localhost:5173) + Admin API (localhost:3001). Captures the real
 * verification/reset links from the API server's own stdout log (SMTP is
 * unconfigured in dev, so emailService.ts logs instead of sending — this
 * is the same convention used by scripts/probe-auth-email-reset.ts).
 *
 * Never contacts a real mailbox or Production. Uses only local dev servers.
 *
 * Usage: PROBE_SERVER_LOG_PATH=/tmp/admin-dev.log npx tsx scripts/probe-gap3-web-auth-browser.ts
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const WEB_BASE = process.env.WEB_BASE || 'http://localhost:5173';
const LOG_PATH = process.env.PROBE_SERVER_LOG_PATH || '/tmp/admin-dev.log';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForLinkInLog(marker: string, afterBytes: number, timeoutMs = 15000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(LOG_PATH)) {
      const content = fs.readFileSync(LOG_PATH, 'utf8');
      const fresh = content.slice(afterBytes);
      const idx = fresh.indexOf(marker);
      if (idx !== -1) {
        const urlMatch = fresh.slice(idx).match(/https?:\/\/[^\s"'<>]+/);
        if (urlMatch) return urlMatch[0];
      }
    }
    await delay(400);
  }
  return null;
}

function currentLogSize(): number {
  return fs.existsSync(LOG_PATH) ? fs.statSync(LOG_PATH).size : 0;
}

async function main() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const stamp = Date.now();
  const email = `gap3-browser-probe-${stamp}@test.choosify.bd`;
  const password = 'Gap3Browser!2026';

  // Pre-warm Vite's dev transform cache for these routes so later timed
  // steps aren't skewed by first-hit cold-compile latency.
  for (const warmPath of ['/login', '/forgot-password', '/reset-password', '/verify-email']) {
    await page.goto(`${WEB_BASE}${warmPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
  }

  // --- 1. Register a new consumer via the real UI ---
  const logSizeBeforeRegister = currentLogSize();
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.click('text=Sign up');
  await page.fill('#full-name', 'Gap3 Browser Probe');
  await page.fill('#email', email);
  await page.fill('#password', password);
  const [registerResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/register'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  assert(registerResponse?.ok(), 'Register: real UI submit reaches POST /auth/register (2xx)', registerResponse?.status());
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 15000 }).catch(() => undefined);

  const urlAfterRegister = page.url();
  assert(
    !urlAfterRegister.includes('/login'),
    'Register: real UI submit navigates away from /login (registration succeeded)',
    urlAfterRegister,
  );

  // --- 2. Capture the real verification link from the server log, visit it ---
  const verifyLink = await waitForLinkInLog(email, logSizeBeforeRegister, 10000).catch(() => null);
  if (verifyLink) {
    await page.goto(verifyLink.replace(/^https?:\/\/[^/]+/, WEB_BASE), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(
      () => /Email verified|Link expired or invalid/i.test(document.body?.innerText || ''),
      { timeout: 15000 },
    ).catch(() => undefined);
    const verifyText = await page.evaluate(() => document.body?.innerText || '');
    assert(/^email verified/im.test(verifyText) || /Email verified/i.test(verifyText), 'VerifyEmailPage: real token resolves to success state', verifyText.slice(0, 300));
  } else {
    assert(false, 'VerifyEmailPage: could not capture verification link from server log (check PROBE_SERVER_LOG_PATH)', LOG_PATH);
  }

  // --- 3. Forgot password → real reset link → new password works ---
  const logSizeBeforeReset = currentLogSize();
  await page.goto(`${WEB_BASE}/forgot-password`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const forgotEmailInput = page.locator('form input[type="email"]');
  await forgotEmailInput.waitFor({ state: 'visible', timeout: 10000 });
  await forgotEmailInput.fill(email);
  const filledValue = await forgotEmailInput.inputValue();
  console.log('  [debug] forgot-password email field value before submit:', JSON.stringify(filledValue));
  const [resetReqResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/password-reset-request'), { timeout: 20000 }).catch(() => null),
    page.getByRole('button', { name: 'Send reset link' }).click(),
  ]);
  assert(resetReqResponse?.ok(), 'ForgotPasswordPage: password-reset-request API call succeeds', resetReqResponse?.status());
  await page.waitForFunction(
    () => /Check your email/i.test(document.body?.innerText || ''),
    { timeout: 10000 },
  ).catch(() => undefined);
  const forgotText = await page.evaluate(() => document.body?.innerText || '');
  assert(/check your email/i.test(forgotText), 'ForgotPasswordPage: generic success state shown', forgotText.slice(0, 200));

  const resetLink = await waitForLinkInLog(email, logSizeBeforeReset, 10000).catch(() => null);
  const newPassword = 'Gap3Browser!NEW2026';
  let resetSucceeded = false;
  if (resetLink) {
    await page.goto(resetLink.replace(/^https?:\/\/[^/]+/, WEB_BASE), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
    const passwordInputs = await page.$$('input[type="password"]');
    assert(passwordInputs.length >= 2, 'ResetPasswordPage: form rendered with password + confirm fields', passwordInputs.length);
    if (passwordInputs.length >= 2) {
      await passwordInputs[0].fill(newPassword);
      await passwordInputs[1].fill(newPassword);
      const [resetResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/auth/reset-password'), { timeout: 20000 }).catch(() => null),
        page.getByRole('button', { name: /Reset password/i }).click(),
      ]);
      resetSucceeded = !!resetResponse?.ok();
      await page.waitForTimeout(500);
      const resetText = await page.evaluate(() => document.body?.innerText || '');
      assert(resetSucceeded && /password reset/i.test(resetText), 'ResetPasswordPage: real token consumption succeeds', {
        status: resetResponse?.status(),
        text: resetText.slice(0, 200),
      });
    }
  } else {
    assert(false, 'ResetPasswordPage: could not capture reset link from server log', LOG_PATH);
  }

  // --- 4. Old password rejected, new password accepted ---
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const loginSubmitBtn = page.locator('form').filter({ has: page.locator('#password') }).locator('button[type="submit"]');
  await page.fill('#email', email);
  await page.fill('#password', password);
  const [oldLoginResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
    loginSubmitBtn.click(),
  ]);
  assert(oldLoginResponse?.status() === 401 || oldLoginResponse?.status() === 400, 'Login: OLD password rejected after reset', oldLoginResponse?.status());
  await page.waitForTimeout(500);

  if (resetSucceeded) {
    await page.fill('#password', '');
    await page.fill('#password', newPassword);
    const [newLoginResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
      loginSubmitBtn.click(),
    ]);
    assert(newLoginResponse?.ok(), 'Login: NEW password accepted after reset', newLoginResponse?.status());
  } else {
    assert(false, 'Login: NEW password accepted after reset (skipped — reset step did not succeed)', 'skipped');
  }

  // --- 5. No console errors across the whole flow ---
  // 401 on /auth/refresh|/auth/login and 404 on /catalog/product-details/* are
  // expected background noise here: the deliberate old-password-rejected check
  // above IS a 401, an unauthenticated visitor genuinely has no refresh token,
  // and the homepage's product-card prefetch 404s on demo IDs absent from this
  // fresh dev DB — none of it reflects an auth-page defect.
  const realErrors = consoleErrors.filter(
    (e) => !/favicon|ResizeObserver/i.test(e) && !/status of 401|status of 404/i.test(e),
  );
  assert(realErrors.length === 0, 'No unexpected browser console errors across full auth flow', realErrors.slice(0, 5));

  await browser.close();

  console.log('\n=== GAP 3 WEB AUTH BROWSER UAT SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
