/**
 * "Consumer adds a local password via email OTP" — security regression.
 *
 * HTTP-surface + guard checks always run. The full OTP issue/verify/set path is
 * DB-backed (local_password_setups) and runs only once migration 0006 is applied
 * locally; until then those checks WARN-skip, exactly like probe-social-auth did
 * for 0005.
 *
 * Requires: local server on :3001 + the seeded dev admin.
 * Usage: npm run test:local-password-setup
 */
import { randomUUID, randomInt, createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users, userIdentities, localPasswordSetups, refreshTokens } from '../server/db/schema';
import { hashPassword } from '../server/auth/jwtTokens';
import { allocateNextChoosifyUserId } from '../server/auth/choosifyUserId';
import { resolveOrCreateUserForSocialIdentity } from '../server/auth/socialAuth';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const RID = Date.now();

const fails: string[] = [];
const warns: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}
function warn(label: string) {
  warns.push(label);
  console.log('WARN', label);
}

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, any> };
}
const post = (p: string, b?: unknown, t?: string) => req('POST', p, b, t);
const patch = (p: string, b?: unknown, t?: string) => req('PATCH', p, b, t);
const getAuthed = (p: string, t: string) => req('GET', p, undefined, t);

async function login(email: string, password: string) {
  const r = await post('/auth/login', { email, password });
  return { ok: r.ok, token: (r.data.accessToken as string) || '' };
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const r: any = await db.execute(sql.raw(`select to_regclass('public.${name}') is not null as x`));
    return Boolean((r.rows ?? r)[0]?.x);
  } catch {
    return false;
  }
}

/** Create a passwordless Consumer directly (mirrors a Google-only account). */
async function makePasswordlessConsumer() {
  const id = randomUUID();
  const email = `lps-google-${RID}-${randomInt(1e6)}@probe.local`.toLowerCase();
  await db.transaction(async (tx) => {
    const cf = await allocateNextChoosifyUserId(tx);
    await tx.insert(users).values({
      id,
      email,
      passwordHash: null,
      displayName: 'LPS Google Only',
      role: 'user',
      emailVerified: true,
      choosifyUserId: cf,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  return { id, email };
}

async function tokenForUser(userId: string): Promise<string> {
  // Sign a real access token the same way the app does.
  const { signAccessToken } = await import('../server/auth/jwtTokens');
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0]!;
  return signAccessToken({ id: u.id, email: u.email, emailVerified: u.emailVerified });
}

async function main() {
  const admin = await login(ADMIN_EMAIL, DEV_PASS);
  assert(admin.ok, 'baseline: admin login still works');

  // ── unauth / role guards (no DB table needed) ───────────────────────────
  const noAuth = await post('/auth/local-password/request-otp', {});
  assert(noAuth.status === 401, 'request-otp without a token -> 401', noAuth.status);

  const asAdmin = await post('/auth/local-password/request-otp', {}, admin.token);
  assert(
    asAdmin.status === 403 && asAdmin.data.code === 'NOT_CONSUMER',
    'request-otp as a non-Consumer (admin) -> 403 NOT_CONSUMER',
    asAdmin.data,
  );
  const asAdminSet = await post('/auth/local-password/set', { setupToken: 'x', newPassword: 'abcd12345', confirmPassword: 'abcd12345' }, admin.token);
  assert(asAdminSet.status === 403 && asAdminSet.data.code === 'NOT_CONSUMER', 'set as a non-Consumer -> 403 NOT_CONSUMER', asAdminSet.data);

  // A Consumer WITH a password (registered) must be refused the setup flow.
  const pwEmail = `lps-haspw-${RID}@probe.local`.toLowerCase();
  const reg = await post('/auth/register', { email: pwEmail, password: 'ProbePass!2026', fullName: 'LPS Has Password' });
  assert(reg.ok, 'helper: registered a password Consumer', reg.status);
  const pwToken = (reg.data.customToken as string) || '';
  const hasPwReq = await post('/auth/local-password/request-otp', {}, pwToken);
  assert(
    hasPwReq.status === 409 && hasPwReq.data.code === 'PASSWORD_ALREADY_SET',
    'request-otp for a Consumer who already has a password -> 409 PASSWORD_ALREADY_SET',
    hasPwReq.data,
  );

  // ── /auth/me canonical account/security fields ──────────────────────────
  const me = await getAuthed('/auth/me', pwToken);
  assert(me.ok, '/auth/me works for a Consumer (200, not 403)', me.status);
  assert(me.data.hasPassword === true, '/auth/me hasPassword=true for a password Consumer', me.data.hasPassword);
  assert(me.data.phone === null, '/auth/me phone=null when none set', me.data.phone);
  assert(Array.isArray(me.data.identities), '/auth/me identities is an array', me.data.identities);
  assert(!('password_hash' in me.data) && !('passwordHash' in me.data), '/auth/me never exposes a password hash');

  // ── primary phone: add / normalize / edit / delete (sidecar, no migration) ──
  const badPhone = await patch('/auth/profile', { phone: 'not a phone' }, pwToken);
  assert(badPhone.status === 400 && badPhone.data.code === 'INVALID_PHONE', 'PATCH /auth/profile rejects a malformed phone -> 400', badPhone.data);

  const addPhone = await patch('/auth/profile', { phone: '01712345678' }, pwToken);
  assert(addPhone.ok && addPhone.data?.data?.phone === '+8801712345678', 'phone 01712345678 normalizes to +8801712345678', addPhone.data?.data);
  const meAfterAdd = await getAuthed('/auth/me', pwToken);
  assert(meAfterAdd.data.phone === '+8801712345678', 'phone persists on /auth/me after add', meAfterAdd.data.phone);

  const editPhone = await patch('/auth/profile', { phone: '+8801898765432' }, pwToken);
  assert(editPhone.ok && editPhone.data?.data?.phone === '+8801898765432', 'phone edit persists (E.164 input kept)', editPhone.data?.data);

  const delPhone = await patch('/auth/profile', { phone: null }, pwToken);
  assert(delPhone.ok && (delPhone.data?.data?.phone ?? null) === null, 'phone delete -> null', delPhone.data?.data);
  const meAfterDel = await getAuthed('/auth/me', pwToken);
  assert(meAfterDel.data.phone === null, 'phone cleared on /auth/me after delete', meAfterDel.data.phone);

  // editing the phone did not create a password or change role
  assert(meAfterDel.data.hasPassword === true && meAfterDel.data.role === 'user', 'phone edits never touched password/role');

  // manipulated userId cannot target another account (non-admin, non-self -> 403)
  const otherId = randomUUID();
  const spoof = await patch('/auth/profile', { userId: otherId, phone: '01712345678' }, pwToken);
  assert(spoof.status === 403, 'PATCH /auth/profile with a spoofed userId is refused for a non-admin', spoof.status);

  // ── DB-backed OTP flow (migration 0006) ───────────────────────────────
  const has0006 = await tableExists('local_password_setups');
  if (!has0006) {
    warn('local_password_setups table missing — migration 0006 not applied; skipping OTP issue/verify/set checks');
  } else {
    const {
      requestSetupOtp,
      verifySetupOtp,
      consumeSetupGrant,
      _clearLocalPasswordSetups,
      LOCAL_PASSWORD_SETUP_LIMITS,
      SET_LOCAL_PASSWORD_PURPOSE,
    } = await import('../server/auth/localPasswordSetup');

    const PEPPER = process.env.JWT_REFRESH_SECRET?.trim() || '';
    const expectHash = (uid: string, secret: string) =>
      createHash('sha256').update(`${PEPPER}:${uid}:${SET_LOCAL_PASSWORD_PURPOSE}:${secret}`).digest('hex');
    // Backdate via JS Dates (same serialization the app uses) so times stay
    // consistent — a raw SQL now() would be the DB session's local tz and drift.
    const backdateLastSent = (uid: string) =>
      db.update(localPasswordSetups).set({ lastSentAt: new Date(Date.now() - 5 * 60_000) })
        .where(and(eq(localPasswordSetups.userId, uid), sql`consumed_at is null`));
    const expireCode = (uid: string) =>
      db.update(localPasswordSetups).set({ codeExpiresAt: new Date(Date.now() - 60_000) })
        .where(and(eq(localPasswordSetups.userId, uid), sql`consumed_at is null`));
    const expireGrant = (uid: string) =>
      db.update(localPasswordSetups).set({ grantExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(localPasswordSetups.userId, uid));

    // ── storage / hashing / binding / expiry (inspect the row directly) ──
    const c0 = await makePasswordlessConsumer();
    const t0 = await tokenForUser(c0.id);
    const r0 = await post('/auth/local-password/request-otp', {}, t0);
    assert(r0.ok && typeof r0.data.email === 'string' && r0.data.email.includes('@probe.local'), 'request-otp: 200 + masked account email', r0.data);
    assert(!('code' in r0.data) && !('otp' in r0.data), 'request-otp response never contains the raw code');
    await backdateLastSent(c0.id); // step past the 60s resend spacing so the test can mint a code it knows
    const known = await requestSetupOtp(c0.id); // returns raw code to THE TEST only
    const row0 = (await db.select().from(localPasswordSetups).where(and(eq(localPasswordSetups.userId, c0.id), sql`consumed_at is null`)).limit(1))[0];
    assert(!!row0 && !/^\d{6}$/.test(row0.codeHash), 'stored code_hash is a hash, not the 6-digit plaintext OTP', row0?.codeHash?.slice(0, 12));
    assert(row0?.codeHash === expectHash(c0.id, known.code), 'stored hash == sha256(pepper : userId : purpose : code) — user + purpose bound', row0?.codeHash === expectHash(c0.id, known.code));
    assert(row0?.codeHash !== expectHash(randomUUID(), known.code), 'the same code hashed under a different userId does NOT match (bound to the account)');
    assert(row0?.purpose === SET_LOCAL_PASSWORD_PURPOSE, "row purpose is 'SET_LOCAL_PASSWORD'", row0?.purpose);
    const ttlMin = row0 ? Math.round((new Date(row0.codeExpiresAt).getTime() - new Date(row0.lastSentAt).getTime()) / 60000) : -1;
    assert(ttlMin === 10, 'OTP expiry is 10 minutes from issue', ttlMin);
    assert(/^\d{6}$/.test(known.code), 'generated OTP is exactly 6 digits');

    // ── wrong code + attempt counter + 5-strike lock ──
    const w1 = await verifySetupOtp(c0.id, '000000').then(() => 'ok').catch((e: any) => e?.code);
    assert(w1 === 'INVALID_CODE', 'wrong OTP -> INVALID_CODE', w1);
    const afterOne = (await db.select().from(localPasswordSetups).where(eq(localPasswordSetups.id, row0!.id)).limit(1))[0];
    assert(afterOne?.attempts === 1, 'attempt counter increments on a wrong code', afterOne?.attempts);
    for (let i = 0; i < LOCAL_PASSWORD_SETUP_LIMITS.MAX_VERIFY_ATTEMPTS; i++) {
      // eslint-disable-next-line no-await-in-loop
      await verifySetupOtp(c0.id, String(200000 + i)).catch(() => {});
    }
    const lock = await verifySetupOtp(c0.id, known.code).then(() => 'ok').catch((e: any) => e?.code);
    assert(lock === 'TOO_MANY_ATTEMPTS', 'the challenge locks after 5 wrong attempts — even the correct code is now refused', lock);

    // ── expiry rejected ──
    await _clearLocalPasswordSetups(c0.id);
    const exp = await requestSetupOtp(c0.id);
    await expireCode(c0.id);
    const expRes = await verifySetupOtp(c0.id, exp.code).then(() => 'ok').catch((e: any) => e?.code);
    assert(expRes === 'CODE_EXPIRED', 'an expired OTP is rejected', expRes);

    // ── resend spacing + newest-invalidates-previous ──
    await _clearLocalPasswordSetups(c0.id);
    const codeA = (await requestSetupOtp(c0.id)).code;
    const tooSoon = await requestSetupOtp(c0.id).then(() => 'ok').catch((e: any) => e?.code);
    assert(tooSoon === 'RESEND_TOO_SOON', 'a second code within 60s is throttled (RESEND_TOO_SOON)', tooSoon);
    await backdateLastSent(c0.id);
    const codeB = (await requestSetupOtp(c0.id)).code;
    const aDead = await verifySetupOtp(c0.id, codeA).then(() => 'ok').catch((e: any) => e?.code);
    assert(['INVALID_CODE', 'NO_ACTIVE_CODE'].includes(String(aDead)), 'issuing a new code invalidates the previous one', aDead);

    // ── max resend limit ──
    await _clearLocalPasswordSetups(c0.id);
    let resendCap = 'not-hit';
    for (let i = 0; i < LOCAL_PASSWORD_SETUP_LIMITS.RESEND_MAX_PER_EPISODE + 2; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await requestSetupOtp(c0.id).then(() => null).catch((e: any) => e?.code);
      // eslint-disable-next-line no-await-in-loop
      await backdateLastSent(c0.id);
      if (res === 'RESEND_LIMIT') { resendCap = 'RESEND_LIMIT'; break; }
    }
    assert(resendCap === 'RESEND_LIMIT', 'the maximum number of resends per episode is enforced (RESEND_LIMIT)', resendCap);
    void codeB;

    // ── correct OTP -> grant; forged / expired / reused grant ──
    await _clearLocalPasswordSetups(c0.id);
    const good = (await requestSetupOtp(c0.id)).code;
    const verified = await verifySetupOtp(c0.id, good);
    assert(typeof verified.grant === 'string' && verified.grant.length >= 32, 'correct OTP -> a server-generated setup authorization (grant) is minted');
    assert((await consumeSetupGrant(c0.id, 'deadbeef'.repeat(8))) === false, 'a forged setup authorization is rejected');
    const firstConsume = await consumeSetupGrant(c0.id, verified.grant);
    const secondConsume = await consumeSetupGrant(c0.id, verified.grant);
    assert(firstConsume === true && secondConsume === false, 'the setup authorization is single-use');
    await _clearLocalPasswordSetups(c0.id);
    const g2code = (await requestSetupOtp(c0.id)).code;
    const g2 = await verifySetupOtp(c0.id, g2code);
    await expireGrant(c0.id);
    assert((await consumeSetupGrant(c0.id, g2.grant)) === false, 'an expired setup authorization is rejected');
    await _clearLocalPasswordSetups(c0.id);
    await db.delete(users).where(eq(users.id, c0.id));

    // ── FULL HTTP HAPPY PATH on a Google-only Consumer ──────────────────
    const gc = await makePasswordlessConsumer();
    await db.insert(userIdentities).values({
      userId: gc.id, provider: 'google', providerSubject: `lps-sub-${RID}-${randomInt(1e6)}`,
      providerEmail: gc.email, providerEmailVerified: true, linkedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    const gcToken = await tokenForUser(gc.id);

    // 1) request via HTTP, 2) mint a known code via the primitive (backdate first)
    await post('/auth/local-password/request-otp', {}, gcToken);
    await backdateLastSent(gc.id);
    const hp = await requestSetupOtp(gc.id);

    // mismatch validation first (must not consume anything)
    const mm = await post('/auth/local-password/set', { setupToken: 'x', newPassword: 'abcdefg1', confirmPassword: 'abcdefg2' }, gcToken);
    assert(mm.status === 400 && mm.data.code === 'PASSWORD_MISMATCH', 'set: New != Confirm -> 400 PASSWORD_MISMATCH', mm.data);
    const wk = await post('/auth/local-password/set', { setupToken: 'x', newPassword: 'short', confirmPassword: 'short' }, gcToken);
    assert(wk.status === 400 && wk.data.code === 'WEAK_PASSWORD', 'set: < 8 chars -> 400 WEAK_PASSWORD', wk.data);

    const v = await post('/auth/local-password/verify-otp', { code: hp.code }, gcToken);
    assert(v.ok && typeof v.data.setupToken === 'string', 'verify-otp (HTTP): correct code -> setupToken', { ok: v.ok });

    // give the consumer two live refresh sessions before setting the password
    await db.insert(refreshTokens).values({ userId: gc.id, tokenHash: `probe-old-a-${RID}`, expiresAt: new Date(Date.now() + 8.64e7), createdAt: new Date() });
    await db.insert(refreshTokens).values({ userId: gc.id, tokenHash: `probe-old-b-${RID}`, expiresAt: new Date(Date.now() + 8.64e7), createdAt: new Date() });

    const cfBefore = (await db.select().from(users).where(eq(users.id, gc.id)).limit(1))[0]?.choosifyUserId;
    const setR = await post('/auth/local-password/set', { setupToken: v.data.setupToken, newPassword: 'FreshPass!2026', confirmPassword: 'FreshPass!2026' }, gcToken);
    assert(setR.ok && typeof setR.data.accessToken === 'string', 'set: password established, fresh access token returned', { ok: setR.ok, code: setR.data.code });

    const gcRow = (await db.select().from(users).where(eq(users.id, gc.id)).limit(1))[0];
    assert(Boolean(gcRow?.passwordHash), 'users.password_hash is now set (Argon2 — see login check below)');
    assert(gcRow?.role === 'user', 'role is still "user" (no escalation)');
    assert(gcRow?.choosifyUserId === cfBefore, 'choosify_user_id unchanged');
    const idRows = await db.select().from(userIdentities).where(eq(userIdentities.userId, gc.id));
    assert(idRows.length === 1 && idRows[0].provider === 'google', 'the Google identity is still linked after setting a password', idRows.length);
    const usersWithEmail = (await db.select().from(users).where(eq(users.email, gc.email))).length;
    assert(usersWithEmail === 1, 'no duplicate user row was created');

    // /auth/me now reports hasPassword=true, identity still present
    const meAfter = await getAuthed('/auth/me', setR.data.accessToken as string);
    assert(meAfter.data.hasPassword === true, '/auth/me now reports hasPassword=true', meAfter.data.hasPassword);
    assert(Array.isArray(meAfter.data.identities) && meAfter.data.identities.some((i: any) => i.provider === 'google'), '/auth/me still shows Google connected', meAfter.data.identities);

    // session policy: current device token still valid, the two old sessions revoked
    const meCurrent = await getAuthed('/auth/me', setR.data.accessToken as string);
    assert(meCurrent.ok, 'the setup device stays authenticated (its fresh access token works)');
    const liveRefresh = await db.select().from(refreshTokens).where(and(eq(refreshTokens.userId, gc.id), sql`revoked_at is null`));
    assert(liveRefresh.length === 1, 'other refresh sessions were revoked; exactly one (the setup device) remains', liveRefresh.length);

    // dual login: email+password AND Google both resolve the SAME account
    const pwLogin = await post('/auth/login', { email: gc.email, password: 'FreshPass!2026' });
    assert(pwLogin.ok, 'email + password login now works for the same account (Argon2 verify ok)');
    assert(pwLogin.data.uid === gc.id, 'password login resolves the exact same users.id');
    const googleAgain = await resolveOrCreateUserForSocialIdentity({
      provider: 'google', subject: idRows[0].providerSubject, email: gc.email, emailVerified: true, name: 'LPS Google', picture: undefined,
    });
    assert(googleAgain.userId === gc.id && googleAgain.created === false, 'Google login still resolves the SAME account, creates nothing', googleAgain);
    const idRowsAfterGoogle = await db.select().from(userIdentities).where(eq(userIdentities.userId, gc.id));
    assert(idRowsAfterGoogle.length === 1, 'still exactly one Google identity row (repeat Google login created nothing)', idRowsAfterGoogle.length);

    // second setup attempt refused + spent grant cannot overwrite
    const gcToken2 = await tokenForUser(gc.id);
    const again = await post('/auth/local-password/request-otp', {}, gcToken2);
    assert(again.status === 409 && again.data.code === 'PASSWORD_ALREADY_SET', 'a second setup attempt is refused once a password exists', again.data);
    const reuse = await post('/auth/local-password/set', { setupToken: v.data.setupToken, newPassword: 'Attacker!2026', confirmPassword: 'Attacker!2026' }, gcToken2);
    assert([401, 409].includes(reuse.status), 'a spent setupToken cannot set/overwrite a password', reuse.status);

    // cleanup
    await _clearLocalPasswordSetups(gc.id);
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, gc.id));
    await db.delete(userIdentities).where(eq(userIdentities.userId, gc.id));
    await db.delete(users).where(eq(users.id, gc.id));
  }

  // cleanup the two HTTP-surface probe users
  await db.delete(users).where(eq(users.email, pwEmail));
  await db.delete(users).where(eq(users.email, `lps-haspw-${RID}@probe.local`.toLowerCase()));

  console.log('\n=== LOCAL PASSWORD SETUP PROBE SUMMARY ===');
  if (warns.length) console.log(`WARNINGS (${warns.length}):`, warns.join(' | '));
  console.log(fails.length ? `RESULT: ${fails.length} FAILED` : 'RESULT: ALL PASSED');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('PROBE ERROR', e);
  process.exit(1);
});
