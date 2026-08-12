/**
 * Sprint 1 (IS-001) authentication regression probe.
 *
 * Exercises the live dev server's real Postgres-backed auth flows —
 * follows the same convention as scripts/probe-tier1-auth.ts.
 *
 * Requires seeded Postgres users (npx tsx server/db/seedDevUsers.ts)
 * and a running local server (npm run dev on :3001).
 *
 * Usage: npx tsx scripts/probe-auth-regression.ts
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import jwt from 'jsonwebtoken';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const SELLER_EMAIL = 'seller@choosify.com.bd';

let failed = 0;

function pass(label: string) {
  console.log('PASS', label);
}

function fail(label: string, detail?: unknown) {
  failed += 1;
  console.log('FAIL', label, detail ?? '');
}

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

/** Extracts the raw value of a single cookie from a Set-Cookie response header. */
function extractCookie(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

async function main() {
  // --- 1. Successful login -------------------------------------------------
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SELLER_EMAIL, password: DEV_PASSWORD }),
  });
  const loginBody = (await loginRes.json()) as {
    accessToken?: string;
    uid?: string;
    role?: string;
    error?: string;
  };
  const refreshCookie = extractCookie(loginRes.headers.get('set-cookie'), 'choosify_refresh');
  assert(
    loginRes.status === 200 && Boolean(loginBody.accessToken) && Boolean(refreshCookie),
    'successful login returns 200 + accessToken + refresh cookie',
    { status: loginRes.status },
  );
  const accessToken = loginBody.accessToken || '';

  // --- 2. Wrong password -----------------------------------------------------
  const wrongPasswordRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SELLER_EMAIL, password: 'definitely-not-the-password' }),
  });
  const wrongPasswordBody = (await wrongPasswordRes.json()) as { accessToken?: string };
  assert(
    wrongPasswordRes.status === 401 && !wrongPasswordBody.accessToken,
    'wrong password returns 401 with no accessToken',
    { status: wrongPasswordRes.status },
  );

  // --- 3. Unknown account -----------------------------------------------------
  const unknownRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `nonexistent-${Date.now()}@choosify.invalid`, password: 'whatever123' }),
  });
  assert(unknownRes.status === 401, 'unknown account returns 401', { status: unknownRes.status });

  // --- 4. Legacy seller self-register is closed (Partner Application required) ---
  const freshEmail = `probe-seller-${Date.now()}@choosify-test.bd`;
  const registerRes = await fetch(`${base}/auth/seller-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: freshEmail,
      password: 'ProbeSellerPass!123',
      displayName: 'Probe Seller',
      storeName: 'Probe Store',
      phone: '+8801700000000',
      category: 'Electronics',
      city: 'Dhaka',
    }),
  });
  const registerBody = (await registerRes.json()) as {
    customToken?: string;
    accessToken?: string;
    role?: string;
    code?: string;
  };
  assert(
    registerRes.status === 403 &&
      registerBody.code === 'PARTNER_APPLICATION_REQUIRED' &&
      !registerBody.customToken &&
      !registerBody.accessToken &&
      registerBody.role !== 'seller',
    'seller-register closed: 403 PARTNER_APPLICATION_REQUIRED (no JWT / no Seller role)',
    { status: registerRes.status, code: registerBody.code, role: registerBody.role },
  );
  // Confirm the closed path did not provision a Seller account for that email.
  const sneakLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: freshEmail, password: 'ProbeSellerPass!123' }),
  });
  assert(
    sneakLogin.status === 401,
    'seller-register did not provision a loginable Seller account',
    { status: sneakLogin.status },
  );

  // --- 5. Session restore (GET /auth/me with a just-issued token) --------------
  const restoreRes = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const restoreBody = (await restoreRes.json()) as { uid?: string; role?: string };
  assert(
    restoreRes.status === 200 && restoreBody.uid === loginBody.uid,
    'session restore (/auth/me) returns the same uid that logged in',
    { status: restoreRes.status },
  );

  // --- 6. Expired access token ---------------------------------------------------
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  if (!accessSecret) {
    fail('expired access token rejected', 'JWT_ACCESS_SECRET not set — cannot construct test token');
  } else {
    const expiredToken = jwt.sign(
      { uid: loginBody.uid, email: SELLER_EMAIL, emailVerified: true },
      accessSecret,
      { expiresIn: -10, subject: loginBody.uid },
    );
    const expiredRes = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredRes.status === 401, '/auth/me: expired token -> 401', {
      status: expiredRes.status,
    });

    // Wrong signature: structurally a valid JWT, signed with a key the server never issued.
    const wrongSignatureToken = jwt.sign(
      { uid: loginBody.uid, email: SELLER_EMAIL, emailVerified: true },
      'definitely-not-the-real-access-secret',
      { expiresIn: '15m', subject: loginBody.uid },
    );
    const wrongSigRes = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${wrongSignatureToken}` },
    });
    assert(wrongSigRes.status === 401, '/auth/me: invalid signature -> 401', {
      status: wrongSigRes.status,
    });
  }

  // --- 6b. /auth/me status normalization (401 vs 403) ---------------------------------
  // Malformed, invalid, expired, or missing credentials must always be 401. 403 is
  // reserved exclusively for a successfully-authenticated request lacking the required
  // role — never used as a stand-in for "the token itself was bad".
  const meMissingTokenRes = await fetch(`${base}/auth/me`);
  assert(meMissingTokenRes.status === 401, '/auth/me: missing token -> 401', {
    status: meMissingTokenRes.status,
  });

  const meMalformedRes = await fetch(`${base}/auth/me`, {
    headers: { Authorization: 'Bearer not-a-real-jwt' },
  });
  const meMalformedBody = (await meMalformedRes.json()) as Record<string, unknown>;
  assert(
    meMalformedRes.status === 401 && !('uid' in meMalformedBody) && !('role' in meMalformedBody),
    '/auth/me: malformed token -> 401 (no profile data leaked)',
    { status: meMalformedRes.status, body: meMalformedBody },
  );

  const meValidRes = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert(meValidRes.status === 200, '/auth/me: valid token -> 200', {
    status: meValidRes.status,
  });

  // --- 7. Valid refresh --------------------------------------------------------
  let rotatedRefreshCookie: string | null = null;
  if (!refreshCookie) {
    fail('valid refresh returns a new accessToken', 'no refresh cookie captured from login');
  } else {
    const refreshRes = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `choosify_refresh=${refreshCookie}` },
    });
    const refreshBody = (await refreshRes.json()) as { accessToken?: string };
    rotatedRefreshCookie = extractCookie(refreshRes.headers.get('set-cookie'), 'choosify_refresh');
    assert(
      refreshRes.status === 200 && Boolean(refreshBody.accessToken) && Boolean(rotatedRefreshCookie),
      'valid refresh returns a new accessToken + rotated refresh cookie',
      { status: refreshRes.status },
    );

    // Rotation must invalidate the token that was just spent.
    const reuseRes = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `choosify_refresh=${refreshCookie}` },
    });
    assert(
      reuseRes.status === 401,
      'reusing an already-rotated refresh token is rejected with 401',
      { status: reuseRes.status },
    );
  }

  // --- 8. Invalid refresh --------------------------------------------------------
  const invalidRefreshRes = await fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: 'choosify_refresh=not-a-real-token' },
  });
  assert(invalidRefreshRes.status === 401, 'garbage refresh token returns 401', {
    status: invalidRefreshRes.status,
  });

  // --- 9. Logout + refresh-token revocation ---------------------------------------
  if (!rotatedRefreshCookie) {
    fail('logout revokes the refresh token', 'no rotated refresh cookie available from step 7');
  } else {
    const logoutRes = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `choosify_refresh=${rotatedRefreshCookie}` },
    });
    const logoutBody = (await logoutRes.json()) as { ok?: boolean };
    assert(logoutRes.status === 200 && logoutBody.ok === true, 'logout returns 200 { ok: true }', {
      status: logoutRes.status,
    });

    const postLogoutRefreshRes = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `choosify_refresh=${rotatedRefreshCookie}` },
    });
    assert(
      postLogoutRefreshRes.status === 401,
      'refresh token is unusable after logout (revoked)',
      { status: postLogoutRefreshRes.status },
    );
  }

  // --- 10. /auth/me with a valid token (bearer token persistence across calls) ----
  const meAgainRes = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert(
    meAgainRes.status === 200,
    '/auth/me succeeds again on the same still-valid access token (bearer persistence)',
    { status: meAgainRes.status },
  );

  // --- 11. Protected route without token -------------------------------------------
  const noTokenRes = await fetch(`${base}/operations/orders`);
  assert(noTokenRes.status === 401, 'protected route without a token returns 401', {
    status: noTokenRes.status,
  });

  // --- 12. Protected route with invalid token ---------------------------------------
  const badTokenRes = await fetch(`${base}/operations/orders`, {
    headers: { Authorization: 'Bearer not-a-real-jwt' },
  });
  assert(badTokenRes.status === 401, 'protected route with an invalid token returns 401', {
    status: badTokenRes.status,
  });

  // --- 13/14. Seller & Admin role-guard authorization --------------------------------
  // Already covered end-to-end (unit-level, in-process) by scripts/probe-tier1-roles.ts,
  // which this suite's npm script runs alongside this file — not duplicated here.
  console.log(
    'INFO seller/admin role-guard authorization: see scripts/probe-tier1-roles.ts (run as part of `npm run test:auth`)',
  );

  // --- 15. Dev login isolation -------------------------------------------------------
  // Covered by scripts/probe-dev-login-isolation.ts (spins its own ephemeral,
  // deliberately-misconfigured server — must not share this live :3001 instance).
  console.log(
    'INFO dev-login production isolation: see scripts/probe-dev-login-isolation.ts (run as part of `npm run test:auth`)',
  );

  // --- 16. No mock fallback on a real session -----------------------------------------
  // Frontend-only behavior (AuthContext.restoreSession clearing choosify_mock_role on both
  // success and failure paths). No browser/DOM test runner exists in this repo and adding
  // one is out of Sprint 1 scope. Backend-verifiable proxy already asserted in §6b above
  // ("/auth/me: malformed token -> 401 (no profile data leaked)") — a failed /auth/me now
  // consistently returns 401 with no profile-shaped payload, which is the contract the
  // frontend depends on to safely clear state rather than falling back to a mock profile.
  console.log('INFO no-mock-fallback proxy: see §6b "/auth/me: malformed token" assertion above');

  // --- 17. Bearer token persists correctly after real login (already asserted in #10) --
  // See assertion above ("bearer token persistence").

  // --- 18. Bearer token cleared after true auth failure --------------------------------
  // Frontend-only (localStorage.removeItem in AuthContext's restoreSession catch branch).
  // Backend-verifiable proxy: a failed login response never includes an accessToken key,
  // so the frontend never has a token to persist in the first place on that path.
  assert(
    !('accessToken' in wrongPasswordBody),
    'failed login response contains no accessToken for the frontend to persist',
  );

  console.log('');
  if (failed > 0) {
    console.log(`${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('All auth regression checks passed.');
}

main().catch((err) => {
  console.error('probe-auth-regression crashed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
