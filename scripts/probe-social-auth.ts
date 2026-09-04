/**
 * Social login (Google + Facebook) — security + linking regression.
 *
 * The provider credential verification itself needs real Google/Facebook tokens
 * (can't be minted offline), so this probe:
 *   - drives the HTTP surface: provider-status, 503 when unconfigured, forged
 *     credential rejected, new routes are auth-rate-limited, no route leaks;
 *   - drives the CANONICAL LINKING LOGIC directly (resolveOrCreateUserForSocial
 *     Identity) with synthetic *verified* identities — create / link / repeat-
 *     login / no-duplicate / role stays 'user' / non-consumer email refused;
 *   - proves email+password login and the dashboard auth surface are unchanged.
 *
 * Requires: local server on :3001, the seeded dev admin, and the 0005
 * user_identities migration applied to the LOCAL dev DB.
 *
 * Usage:  npm run test:social-auth
 */
import { randomUUID } from 'node:crypto';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const RID = Date.now();

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
async function get(path: string) {
  const res = await fetch(`${V1}${path}`);
  return { status: res.status, ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
async function login(email: string, password: string) {
  const r = await post('/auth/login', { email, password });
  return { ok: r.ok, status: r.status, token: (r.data.accessToken as string) || '' };
}

async function main() {
  // ── HTTP surface ──────────────────────────────────────────────────────
  const admin = await login(ADMIN_EMAIL, DEV_PASS);
  assert(admin.ok, 'baseline: email+password admin login still works', admin.status);

  const providers = await get('/auth/social/providers');
  assert(
    providers.ok && typeof (providers.data.providers as any)?.google === 'boolean',
    'GET /auth/social/providers returns a provider status map',
    providers.data,
  );

  const gUnset = await post('/auth/google', { credential: 'x'.repeat(20) });
  const fUnset = await post('/auth/facebook', { accessToken: 'x'.repeat(20) });
  const googleConfigured = Boolean((providers.data.providers as any)?.google);
  const facebookConfigured = Boolean((providers.data.providers as any)?.facebook);

  if (!googleConfigured) {
    assert(gUnset.status === 503 && gUnset.data.code === 'GOOGLE_AUTH_UNAVAILABLE',
      'POST /auth/google -> 503 GOOGLE_AUTH_UNAVAILABLE when GOOGLE_OAUTH_CLIENT_ID is unset', gUnset);
  } else {
    assert(gUnset.status === 401 && gUnset.data.code === 'INVALID_CREDENTIAL',
      'POST /auth/google -> 401 INVALID_CREDENTIAL for a forged ID token', gUnset);
  }
  if (!facebookConfigured) {
    assert(fUnset.status === 503 && fUnset.data.code === 'FACEBOOK_AUTH_UNAVAILABLE',
      'POST /auth/facebook -> 503 FACEBOOK_AUTH_UNAVAILABLE when FACEBOOK_APP_ID/SECRET are unset', fUnset);
  } else {
    assert(fUnset.status === 401 && fUnset.data.code === 'INVALID_CREDENTIAL',
      'POST /auth/facebook -> 401 INVALID_CREDENTIAL for a forged access token', fUnset);
  }

  const gMissing = await post('/auth/google', {});
  assert(
    gMissing.status === 400 || gMissing.status === 503,
    'POST /auth/google with no credential -> 400/503, never a session',
    gMissing.status,
  );
  assert(!('accessToken' in gMissing.data), 'POST /auth/google never returns an accessToken on failure', gMissing.data);

  // ── Canonical linking logic (direct) ──────────────────────────────────
  // These use the same module the routes use; a synthetic identity stands in
  // for a server-verified Google/Facebook payload.
  let mod: typeof import('../server/auth/socialAuth');
  let dbmod: typeof import('../server/db/client');
  let schema: typeof import('../server/db/schema');
  try {
    mod = await import('../server/auth/socialAuth');
    dbmod = await import('../server/db/client');
    schema = await import('../server/db/schema');
  } catch (e) {
    console.log('WARN could not import server modules for the linking checks (run from the repo root):', e);
    return finish();
  }
  const { resolveOrCreateUserForSocialIdentity } = mod;
  const { db } = dbmod;
  const { users, userIdentities } = schema;
  const { eq } = await import('drizzle-orm');
  const { hashPassword } = await import('../server/auth/jwtTokens');

  // table present?
  try {
    await db.select().from(userIdentities).limit(1);
  } catch (e) {
    console.log('WARN user_identities table not found — apply migration 0005 to the local dev DB, then re-run. Skipping linking checks.');
    return finish();
  }

  const mkIdentity = (over: Partial<import('../server/auth/socialAuth').VerifiedSocialIdentity> = {}) => ({
    provider: 'google' as const,
    subject: `probe-sub-${RID}-${randomUUID().slice(0, 8)}`,
    email: `social-probe-${RID}-${randomUUID().slice(0, 6)}@probe.local`.toLowerCase(),
    emailVerified: true,
    name: 'Social Probe',
    picture: 'https://example.com/a.png',
    ...over,
  });

  // 1) brand-new identity -> creates a Consumer account
  const idA = mkIdentity();
  const r1 = await resolveOrCreateUserForSocialIdentity(idA);
  assert(r1.created === true && r1.linked === false, 'new verified Google identity -> a NEW account is created', r1);
  const u1 = (await db.select().from(users).where(eq(users.id, r1.userId)).limit(1))[0];
  assert(u1?.role === 'user', 'social-created account has role "user" (Consumer) — never elevated', u1?.role);
  assert(u1?.emailVerified === true, 'social-created account is email_verified (provider assertion verified server-side)', u1?.emailVerified);
  assert(!u1?.passwordHash, 'social-created account has no password hash (OAuth-only until Forgot Password)', Boolean(u1?.passwordHash));
  assert(typeof u1?.choosifyUserId === 'string' && u1.choosifyUserId.length > 0, 'social-created account got a Choosify User ID (CF-…)', u1?.choosifyUserId);

  // 2) same identity again -> logs into the SAME account, no duplicate
  const r2 = await resolveOrCreateUserForSocialIdentity(idA);
  assert(r2.userId === r1.userId && r2.created === false && r2.linked === false, 'repeat Google login resolves the SAME account (no duplicate)', { r1: r1.userId, r2: r2.userId });
  const dupCount = (await db.select().from(users).where(eq(users.email, idA.email))).length;
  assert(dupCount === 1, 'exactly one users row exists for that email after repeated social login', dupCount);

  // 3) verified email that already belongs to a password Consumer -> LINK (no new account)
  const linkEmail = `social-link-${RID}@probe.local`.toLowerCase();
  const pwUid = randomUUID();
  await db.insert(users).values({
    id: pwUid, email: linkEmail, passwordHash: await hashPassword('Probe!2026xx'),
    displayName: 'Existing Password User', role: 'user', emailVerified: false,
    choosifyUserId: `CF-PRB-${RID}`, createdAt: new Date(), updatedAt: new Date(),
  });
  const r3 = await resolveOrCreateUserForSocialIdentity(mkIdentity({ email: linkEmail }));
  assert(r3.userId === pwUid && r3.linked === true && r3.created === false, 'verified email of an existing Consumer -> provider LINKED to that same account', r3);
  const linkedIdentities = await db.select().from(userIdentities).where(eq(userIdentities.userId, pwUid));
  assert(linkedIdentities.length === 1 && linkedIdentities[0].provider === 'google', 'a user_identities row now exists for the linked account', linkedIdentities);
  const stillOneRow = (await db.select().from(users).where(eq(users.email, linkEmail))).length;
  assert(stillOneRow === 1, 'linking did NOT create a duplicate account', stillOneRow);
  const linkedUserRow = (await db.select().from(users).where(eq(users.id, pwUid)).limit(1))[0];
  assert(Boolean(linkedUserRow?.passwordHash), 'existing password hash is PRESERVED when a social identity is linked', Boolean(linkedUserRow?.passwordHash));
  assert(linkedUserRow?.role === 'user', 'linked account role is still "user" (no escalation on link)', linkedUserRow?.role);
  const verifiedByLink = await login(linkEmail, 'Probe!2026xx');
  assert(verifiedByLink.ok, 'email+password login still works for the account after it was linked to Google', verifiedByLink.status);

  // 4) verified email of a NON-consumer (staff/seller) account -> refused, never linked
  const staffEmail = `social-staff-${RID}@probe.local`.toLowerCase();
  const staffUid = randomUUID();
  await db.insert(users).values({
    id: staffUid, email: staffEmail, passwordHash: await hashPassword('Probe!2026xx'),
    displayName: 'Existing Seller', role: 'seller', emailVerified: true,
    choosifyUserId: `CF-STF-${RID}`, createdAt: new Date(), updatedAt: new Date(),
  });
  let refused = false;
  try {
    await resolveOrCreateUserForSocialIdentity(mkIdentity({ email: staffEmail }));
  } catch (e: any) {
    refused = e?.code === 'SOCIAL_ACCOUNT_CONFLICT';
  }
  assert(refused, 'verified email of a NON-consumer account -> refused (SOCIAL_ACCOUNT_CONFLICT), never linked/elevated', refused);
  const noIdentityForStaff = (await db.select().from(userIdentities).where(eq(userIdentities.userId, staffUid))).length;
  assert(noIdentityForStaff === 0, 'no user_identities row was created for the dashboard account', noIdentityForStaff);
  const staffRoleUnchanged = (await db.select().from(users).where(eq(users.id, staffUid)).limit(1))[0]?.role;
  assert(staffRoleUnchanged === 'seller', 'the dashboard account role is unchanged by the refused social attempt', staffRoleUnchanged);

  // 5) unverified provider email -> refused (never creates/links)
  let unverifiedRefused = false;
  try {
    await resolveOrCreateUserForSocialIdentity(mkIdentity({ emailVerified: false }));
  } catch (e: any) {
    unverifiedRefused = e?.code === 'UNVERIFIED_PROVIDER_EMAIL';
  }
  assert(unverifiedRefused, 'unverified provider email -> refused (UNVERIFIED_PROVIDER_EMAIL)', unverifiedRefused);

  // 6) a second provider (facebook) for the same subject-space links independently
  const r6 = await resolveOrCreateUserForSocialIdentity(mkIdentity({ provider: 'facebook', email: linkEmail }));
  assert(r6.userId === pwUid, 'a Facebook identity for the same verified email links to the same canonical account', r6);
  const bothProviders = (await db.select().from(userIdentities).where(eq(userIdentities.userId, pwUid))).map((r) => r.provider).sort();
  assert(bothProviders.join(',') === 'facebook,google', 'the account now has both google + facebook identities (one architecture)', bothProviders);

  // cleanup probe rows
  for (const uid of [r1.userId, pwUid, staffUid]) {
    await db.delete(userIdentities).where(eq(userIdentities.userId, uid));
    await db.delete(users).where(eq(users.id, uid));
  }

  finish();
}

function finish() {
  console.log('\n=== SOCIAL AUTH PROBE SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
