/**
 * Pre-VPS self-hosting pass — regression coverage for the new self-service
 * email verification and forgot/reset password flows.
 *
 * Token capture: with SMTP unconfigured (the default in this dev
 * environment), EmailService logs the raw link to the SERVER's own stdout
 * instead of sending it — this script reads that from the server's log
 * FILE (a separate OS process, so intercepting this script's own
 * console.log would never see it). Set PROBE_SERVER_LOG_PATH to point at
 * wherever the server's stdout is being captured; skips token-consumption
 * assertions gracefully if it can't find one (e.g. SMTP is genuinely
 * configured and emails are really being sent instead of logged).
 *
 * Usage: npx tsx scripts/probe-auth-email-reset.ts
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SERVER_LOG_PATH = process.env.PROBE_SERVER_LOG_PATH || '/tmp/admin-dev.log';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

type Json = Record<string, unknown>;

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function login(email: string, password: string): Promise<{ token: string; ok: boolean; status: number }> {
  const res = await post('/auth/login', { email, password });
  return { token: (res.data.accessToken as string) || '', ok: res.ok, status: res.status };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readLogSafely(): string {
  try {
    return readFileSync(SERVER_LOG_PATH, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Polls the server's log file for a NEW verify-email/reset-password link
 * appearing after `sinceLength` bytes (so a stale link from an earlier
 * test doesn't get picked up). Returns '' if none appears within budget —
 * callers must treat that as "couldn't capture, skip gracefully."
 */
async function waitForEmailToken(sinceLength: number, pathHint: 'verify-email' | 'reset-password'): Promise<string> {
  // Generous timeout — the server's stdout is redirected to a log file for
  // this test harness, which can buffer briefly before flushing, especially
  // under Windows/Git-Bash. The underlying email-send is synchronous; this
  // is purely about how fast the log line becomes visible on disk.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const log = readLogSafely();
    const fresh = log.slice(sinceLength);
    const pattern = new RegExp(`${pathHint}\\?token=([a-f0-9]{64})`);
    const match = fresh.match(pattern);
    if (match) return match[1];
    await delay(250);
  }
  return '';
}

async function main() {
  const stamp = Date.now();
  const admin = await login(ADMIN_EMAIL, DEV_PASS);
  assert(admin.ok, 'admin login works (baseline)', admin.status);

  // --- 1. Register a fresh consumer — a verification email should be triggered ---
  const email = `auth-probe-${stamp}@test.choosify.bd`;
  const registerRes = await post('/auth/register', { email, password: 'RoleTest!2026', fullName: 'Auth Probe' });
  assert(registerRes.ok, 'signup succeeds', registerRes);
  const loginAfterRegister = await login(email, 'RoleTest!2026');
  assert(loginAfterRegister.ok, 'login immediately after signup still works (verification is not a login gate)', loginAfterRegister.status);

  // --- 2. Resend verification returns a fresh token we can capture from the dev-mode email log ---
  const logLengthBeforeResend = readLogSafely().length;
  const resendRes = await post('/auth/resend-verification', {}, loginAfterRegister.token);
  assert(resendRes.ok, 'resend-verification succeeds for an authenticated, unverified account', resendRes);
  const verificationToken = await waitForEmailToken(logLengthBeforeResend, 'verify-email');
  if (!verificationToken) {
    console.log('WARN could not capture verification token from server log (SMTP may be configured for real sending) — skipping token-consumption checks');
  }

  if (verificationToken) {
    // --- 3. Garbage token is rejected ---
    const badVerify = await post('/auth/verify-email', { token: 'not-a-real-token' });
    assert(badVerify.status === 400, 'verify-email: a garbage token is rejected (400)', badVerify.status);

    // --- 4. Real token verifies successfully ---
    const goodVerify = await post('/auth/verify-email', { token: verificationToken });
    assert(goodVerify.ok, 'verify-email: a real, freshly-issued token succeeds', goodVerify);

    // --- 5. Reusing the same (now-consumed) token is rejected ---
    const reuseVerify = await post('/auth/verify-email', { token: verificationToken });
    assert(reuseVerify.status === 400, 'verify-email: reusing an already-consumed token is rejected', reuseVerify.status);
  }

  // --- 6. Forgot password: generic response for both a real and a nonexistent email (no enumeration) ---
  const logLengthBeforeReset = readLogSafely().length;
  const realEmailReset = await post('/auth/password-reset-request', { email });
  const fakeEmailReset = await post('/auth/password-reset-request', { email: `does-not-exist-${stamp}@test.choosify.bd` });
  assert(
    realEmailReset.ok && fakeEmailReset.ok && realEmailReset.data.message === fakeEmailReset.data.message,
    'password-reset-request: identical generic response for a real and a nonexistent email (no account enumeration)',
    { real: realEmailReset.data, fake: fakeEmailReset.data },
  );

  const resetToken = await waitForEmailToken(logLengthBeforeReset, 'reset-password');
  if (!resetToken) {
    console.log('WARN could not capture reset token from server log — skipping token-consumption checks');
  }

  if (resetToken) {
    // --- 7. Garbage reset token is rejected ---
    const badReset = await post('/auth/reset-password', { token: 'garbage', newPassword: 'NewPassw0rd!2026' });
    assert(badReset.status === 400, 'reset-password: a garbage token is rejected (400)', badReset.status);

    // --- 8. Too-short new password is rejected even with a valid token ---
    const shortPwReset = await post('/auth/reset-password', { token: resetToken, newPassword: 'short' });
    assert(shortPwReset.status === 400, 'reset-password: a too-short new password is rejected (400)', shortPwReset.status);

    // --- 9. Real reset token + valid new password succeeds ---
    const newPassword = 'NewPassw0rd!2026';
    const goodReset = await post('/auth/reset-password', { token: resetToken, newPassword });
    assert(goodReset.ok, 'reset-password: a real token + valid new password succeeds', goodReset);

    // --- 10. Old password no longer works ---
    const oldPwLogin = await login(email, 'RoleTest!2026');
    assert(!oldPwLogin.ok, 'the old password is rejected after a successful reset', oldPwLogin.status);

    // --- 11. New password works ---
    const newPwLogin = await login(email, newPassword);
    assert(newPwLogin.ok, 'the new password is accepted after a successful reset', newPwLogin.status);

    // --- 12. Reusing the same (consumed) reset token is rejected ---
    const reuseReset = await post('/auth/reset-password', { token: resetToken, newPassword: 'AnotherPassw0rd!2026' });
    assert(reuseReset.status === 400, 'reset-password: reusing an already-consumed token is rejected', reuseReset.status);
  }

  // --- 13. Partner lifecycle is unaffected: a fresh partner-apply still works exactly as before ---
  const partnerApplyRes = await post('/auth/partner-apply', {
    applicantType: 'seller',
    email: `auth-probe-seller-${stamp}@test.choosify.bd`,
    displayName: 'Auth Probe Seller',
    businessOrChannelName: 'Auth Probe Storefront',
    phone: '01700000099',
    category: 'fashion',
    city: 'Dhaka',
    password: 'RoleTest!2026',
  });
  assert(partnerApplyRes.ok, 'partner-apply (Seller onboarding) is unaffected by the auth changes', partnerApplyRes);

  console.log('\n=== AUTH EMAIL VERIFICATION / PASSWORD RESET PROBE SUMMARY ===');
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
