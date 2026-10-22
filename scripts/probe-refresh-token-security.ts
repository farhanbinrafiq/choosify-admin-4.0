/**
 * Refresh-token security regression probe (rotation, logout, reuse, concurrency).
 *
 * Runs against a live API (PROBE_BASE_URL, default http://localhost:3001/api/v1)
 * on an ISOLATED database: it registers disposable accounts, plants an expired
 * token and deletes a disposable user directly through server/db (DATABASE_URL).
 * Never point it at production. Token values are never printed; when
 * PROBE_SERVER_LOG names the server's stdout log, the probe also checks that no
 * issued refresh token appears in it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../server/db/client';
import { refreshTokens, users } from '../server/db/schema';
import { hashRefreshToken } from '../server/auth/jwtTokens';
import { issueAuthToken } from '../server/auth/authTokens';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const SERVER_LOG = process.env.PROBE_SERVER_LOG || '';
const PASSWORD = 'QaRefresh!2026x';
const issued: string[] = [];
const results: Array<{ id: string; ok: boolean }> = [];
const mark = (id: string, ok: boolean, detail?: unknown) => {
  results.push({ id, ok });
  console.log(ok ? 'PASS' : 'FAIL', id, ok ? '' : String(detail ?? '').slice(0, 240));
};

type Res = { status: number; body: Record<string, any>; cookie: string | null; clears: boolean };

async function call(path: string, opts: { cookie?: string | null; token?: string; body?: unknown } = {}): Promise<Res> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.cookie !== undefined && opts.cookie !== null ? { Cookie: `choosify_refresh=${opts.cookie}` } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 429 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const setCookie = res.headers.get('set-cookie') || '';
    const m = setCookie.match(/choosify_refresh=([^;]*)/);
    const cookie = m && m[1] ? decodeURIComponent(m[1]) : null;
    if (cookie) issued.push(cookie);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any>, cookie, clears: Boolean(m) && !m[1] };
  }
}

const refresh = (cookie: string | null) => call('/auth/refresh', { cookie });

async function newAccount(tag: string): Promise<{ email: string; uid: string }> {
  const email = `qa-refresh-${Date.now()}-${tag}@testers.choosify.bd`;
  const r = await call('/auth/register', { body: { email, password: PASSWORD, fullName: `QA Refresh ${tag}` } });
  if (r.status >= 300) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  // Registration signs the new account in; end that session so each scenario starts with none.
  if (r.cookie) await call('/auth/logout', { cookie: r.cookie });
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return { email, uid: u.id };
}

async function login(email: string): Promise<{ access: string; refresh: string }> {
  const r = await call('/auth/login', { body: { email, password: PASSWORD } });
  if (r.status !== 200 || !r.cookie) throw new Error(`login failed ${r.status}`);
  return { access: String(r.body.accessToken), refresh: r.cookie };
}

async function liveTokens(uid: string): Promise<number> {
  const rows = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.userId, uid), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
  return rows.length;
}

async function main() {
  // A. Rotation ---------------------------------------------------------------
  const a = await newAccount('a');
  const sA = await login(a.email);
  const r1 = sA.refresh;
  const first = await refresh(r1);
  mark('A1 refresh with R1 returns 200 + new access token + rotated cookie R2', first.status === 200 && Boolean(first.body.accessToken) && Boolean(first.cookie) && first.cookie !== r1, first.status);
  const r2 = first.cookie;
  const replay = await refresh(r1);
  mark('A2 reusing rotated R1 is rejected (401)', replay.status === 401, replay.status);
  mark('A3 the rejected reuse issues no new refresh cookie', !replay.cookie, 'cookie issued');
  // A revoked token's 401 must not clear the cookie: in a lost race it can land after the
  // winner's new cookie and would sign the browser out. Unknown tokens still clear it.
  mark('A3b the 401 for a rotated token does not clear the browser cookie', !replay.clears, 'cleared');
  const next = await refresh(r2);
  mark('A4 R2 still rotates normally (200, R3)', next.status === 200 && Boolean(next.cookie), next.status);
  mark('A5 exactly one live refresh token remains for the session', (await liveTokens(a.uid)) === 1, await liveTokens(a.uid));

  // B. Logout -----------------------------------------------------------------
  const b = await newAccount('b');
  const sB = await login(b.email);
  const out = await call('/auth/logout', { cookie: sB.refresh });
  mark('B1 logout returns 200 and clears the refresh cookie', out.status === 200 && out.clears, `${out.status} clears=${out.clears}`);
  const afterLogout = await refresh(sB.refresh);
  mark('B2 refresh with the logged-out token is rejected (401) immediately', afterLogout.status === 401, afterLogout.status);
  mark('B3 no live refresh tokens remain after logout', (await liveTokens(b.uid)) === 0, await liveTokens(b.uid));
  const again = await login(b.email);
  const fresh = await refresh(again.refresh);
  mark('B4 logout followed by a new sign-in gives a working session', fresh.status === 200, fresh.status);
  mark('B5 the old logged-out token stays rejected after the new sign-in', (await refresh(sB.refresh)).status === 401);

  // C. Reuse + concurrency ----------------------------------------------------
  const c = await newAccount('c');
  const sC = await login(c.email);
  const burst = await Promise.all(Array.from({ length: 6 }, () => refresh(sC.refresh)));
  const wins = burst.filter((x) => x.status === 200).length;
  mark('C1 six concurrent refreshes with one token: exactly one succeeds', wins === 1, `successes=${wins} statuses=${burst.map((x) => x.status).join(',')}`);
  mark('C2 concurrent losers get 401 (not 500)', burst.every((x) => x.status === 200 || x.status === 401), burst.map((x) => x.status).join(','));
  mark('C3 the session ends with exactly one live refresh token', (await liveTokens(c.uid)) === 1, await liveTokens(c.uid));
  const winner = burst.find((x) => x.status === 200)?.cookie || null;
  mark('C4 the winning successor token works', (await refresh(winner)).status === 200);

  // D. Additional cases -------------------------------------------------------
  const d = await newAccount('d');
  const rawExpired = randomBytes(32).toString('base64url');
  await db.insert(refreshTokens).values({ userId: d.uid, tokenHash: hashRefreshToken(rawExpired), expiresAt: new Date(Date.now() - 60_000) });
  mark('D1 expired refresh token is rejected (401)', (await refresh(rawExpired)).status === 401);
  mark('D2 missing refresh cookie is rejected (401)', (await refresh(null)).status === 401);
  const unknownTok = await refresh('not-a-real-token');
  mark('D3 random/invalid token is rejected (401) and its cookie cleared', unknownTok.status === 401 && unknownTok.clears, `${unknownTok.status} clears=${unknownTok.clears}`);
  const sD = await login(d.email);
  const tampered = sD.refresh.slice(0, -1) + (sD.refresh.endsWith('A') ? 'B' : 'A');
  mark('D4 tampered token (one character changed) is rejected (401)', (await refresh(tampered)).status === 401);
  const huge = await refresh('x'.repeat(8000));
  mark('D5 oversized token is rejected without a server error', huge.status === 401 || huge.status === 431 || huge.status === 400, huge.status);
  mark('D6 the untampered original still works after those attempts', (await refresh(sD.refresh)).status === 200);

  // Independent sessions on two devices
  const e = await newAccount('e');
  const dev1 = await login(e.email);
  const dev2 = await login(e.email);
  await call('/auth/logout', { cookie: dev1.refresh });
  const dev2r = await refresh(dev2.refresh);
  mark('D7 logging out device 1 leaves device 2 signed in (session isolation)', dev2r.status === 200, dev2r.status);
  mark('D8 device 1 token is rejected after its logout', (await refresh(dev1.refresh)).status === 401);

  // Account revocation event: password reset ends every session (revokeAllRefreshTokensForUser).
  const f = await newAccount('f');
  const f1 = await login(f.email);
  const f2 = await login(f.email);
  const { rawToken: resetToken } = await issueAuthToken(f.uid, 'password_reset');
  const reset = await call('/auth/reset-password', { body: { token: resetToken, newPassword: `${PASSWORD}-2` } });
  mark('D9 password reset succeeds', reset.status === 200, `${reset.status} ${JSON.stringify(reset.body).slice(0, 120)}`);
  mark('D10 after a password reset, an existing device token is rejected', (await refresh(f2.refresh)).status === 401);
  mark('D11 after a password reset, the other existing device token is rejected', (await refresh(f1.refresh)).status === 401);

  // "Sign out other devices" keeps this device and ends the others.
  const h = await newAccount('h');
  const h1 = await login(h.email);
  const h2 = await login(h.email);
  const others = await call('/auth/sessions/revoke-others', { token: h1.access, cookie: h1.refresh });
  mark('D11b sign-out-other-devices succeeds', others.status === 200, others.status);
  mark('D11c the other device is rejected after sign-out-other-devices', (await refresh(h2.refresh)).status === 401);
  mark('D11d this device still refreshes after sign-out-other-devices', (await refresh(h1.refresh)).status === 200);

  // Password change: the changing session stays signed in, every other session ends.
  const k = await newAccount('k');
  const k1 = await login(k.email);
  const k2 = await login(k.email);
  const changed = await call('/auth/change-password', { token: k1.access, cookie: k1.refresh, body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}-3` } });
  mark('D11e change-password succeeds', changed.status === 200, `${changed.status} ${JSON.stringify(changed.body).slice(0, 120)}`);
  mark('D11f after a password change, the other device token is rejected', (await refresh(k2.refresh)).status === 401);
  mark('D11g after a password change, the changing session still refreshes', (await refresh(k1.refresh)).status === 200);
  mark('D11h after a password change, exactly one live session remains', (await liveTokens(k.uid)) === 1, await liveTokens(k.uid));

  // No identifiable current session (no refresh cookie sent): every session ends (fail secure).
  const m = await newAccount('m');
  const m1 = await login(m.email);
  const m2 = await login(m.email);
  const changedNoCookie = await call('/auth/change-password', { token: m1.access, body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}-4` } });
  mark('D11i change-password without a refresh cookie succeeds', changedNoCookie.status === 200, changedNoCookie.status);
  mark('D11j ...and revokes every session (no current one to keep)', (await refresh(m1.refresh)).status === 401 && (await refresh(m2.refresh)).status === 401 && (await liveTokens(m.uid)) === 0);

  // A wrong current password changes nothing.
  const n = await newAccount('n');
  const n1 = await login(n.email);
  const n2 = await login(n.email);
  const wrong = await call('/auth/change-password', { token: n1.access, cookie: n1.refresh, body: { currentPassword: 'wrong-password-123', newPassword: `${PASSWORD}-5` } });
  mark('D11k change-password with a wrong current password is refused and revokes nothing', wrong.status === 401 && (await refresh(n2.refresh)).status === 200);

  // Account removal: deleting the user removes their sessions
  const g = await newAccount('g');
  const sG = await login(g.email);
  await db.delete(users).where(eq(users.id, g.uid));
  mark('D12 refresh for a deleted account is rejected (401)', (await refresh(sG.refresh)).status === 401);

  // Information disclosure
  const generic = await refresh('not-a-real-token');
  mark('D13 401 body is generic (no token, hash or user details)', !/hash|user|uid|@/i.test(JSON.stringify(generic.body)), JSON.stringify(generic.body));

  if (SERVER_LOG && existsSync(SERVER_LOG)) {
    const log = readFileSync(SERVER_LOG, 'utf8');
    const leaked = issued.filter((t) => t.length > 20 && log.includes(t)).length;
    mark(`D14 no issued refresh token appears in the server log (${issued.length} checked)`, leaked === 0, `leaked=${leaked}`);
  } else console.log('SKIP D14 (PROBE_SERVER_LOG not set)');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('PROBE ERROR', e instanceof Error ? e.message : e);
  process.exit(1);
});
