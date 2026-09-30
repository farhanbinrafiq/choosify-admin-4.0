/**
 * Feature Access & Entitlements — Phase 2B admin API probe (live HTTP).
 *
 * Needs the dev API (:3001) with migration 0011 applied to its LOCAL database.
 * Uses the seeded dev accounts plus two throwaway LOCAL accounts it creates and
 * deletes (an `admin`-role user, and a seller used for the deleted-user audit
 * check). Every override, platform switch and role default it touches is
 * restored. Write calls that pass the gate use invalid bodies, so no business
 * data is created. Refuses to run against a non-local database.
 *
 * Covers: authorization, account overrides (grant / revoke / restrict + expiry
 * without a job / remove / validation), platform switches, dependency denial,
 * audit history (contents, no-op, filtering, pagination, read-only, deleted
 * user), Meta Messaging read/write split, the first-write race lock, and the
 * 403 detail.
 *
 * Run: npx tsx scripts/probe-entitlement-phase2b-http.ts   (restart the API first: auth rate limit)
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../server/db/client';
import { accountEntitlementOverrides, platformFeatureStates, users } from '../server/db/schema';
import { hashPassword } from '../server/auth/jwtTokens';

const ROOT = process.env.PROBE_BASE_URL_ROOT || 'http://127.0.0.1:3001';
const API = `${ROOT}/api/v1`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
let passes = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passes += 1;
    console.log('PASS', label);
    return;
  }
  fails.push(label);
  console.log('FAIL', label, JSON.stringify(detail ?? '').slice(0, 400));
}

type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const denied = (r: Res, key?: string) =>
  r.status === 403 && r.body.code === 'FEATURE_ENTITLEMENT_DENIED' && (!key || r.body.featureKey === key);
const notEntitlementDenied = (r: Res) => !(r.status === 403 && r.body.code === 'FEATURE_ENTITLEMENT_DENIED') && r.status < 500;

async function login(email: string, password = PASS_) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = (await r.json()) as Record<string, any>;
  if (!b.accessToken) throw new Error(`login ${email} failed (${r.status})`);
  return { token: String(b.accessToken), uid: String(b.uid || '') };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(2);
  }
  const stamp = Date.now();
  const tempPassword = `Phase2b!${stamp}`;
  const [tempAdmin] = await db
    .insert(users)
    .values({
      email: `phase2b.admin.${stamp}@probe.local`,
      passwordHash: await hashPassword(tempPassword),
      displayName: 'Phase2B Probe Admin',
      role: 'admin',
      emailVerified: true,
    })
    .returning({ id: users.id, email: users.email });
  const [tempSeller] = await db
    .insert(users)
    .values({
      email: `phase2b.seller.${stamp}@probe.local`,
      passwordHash: await hashPassword(tempPassword),
      displayName: 'Phase2B Probe Seller',
      role: 'seller',
      emailVerified: true,
    })
    .returning({ id: users.id });
  let tempSellerDeleted = false;

  const superAdmin = await login('admin@choosify.com.bd');
  const admin = await login(tempAdmin.email, tempPassword);
  const seller = await login('seller@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  const moderator = await login('moderator@choosify.com.bd');
  const finance = await login('finance@choosify.com.bd');
  const [moderatorRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'moderator@choosify.com.bd'));

  const S = superAdmin.token;
  const probeUsers = [seller.uid, creator.uid, tempSeller.id];
  const snapshot = await call('/entitlements/admin', S);
  const originalSellerCashbooks = snapshot.body.roleDefaults?.seller?.cashbooks !== false;
  // Start from a clean, known state (local DB only).
  await db.delete(accountEntitlementOverrides).where(inArray(accountEntitlementOverrides.userId, probeUsers));
  await db.delete(platformFeatureStates);

  const putOverride = (token: string | null, userId: string, key: string, body: unknown) =>
    call(`/entitlements/admin/accounts/${userId}/overrides/${key}`, token, 'PUT', body);
  const delOverride = (token: string | null, userId: string, key: string, reason = 'probe cleanup') =>
    call(`/entitlements/admin/accounts/${userId}/overrides/${key}`, token, 'DELETE', { reason });
  const putPlatform = (token: string | null, key: string, body: unknown) =>
    call(`/entitlements/admin/platform-states/${key}`, token, 'PUT', body);
  const auditCount = async () => {
    let n = 0;
    let before: string | null = null;
    for (let i = 0; i < 100; i++) {
      const r = await call(`/entitlements/admin/audit?limit=200${before ? `&before=${before}` : ''}`, S);
      n += (r.body.events || []).length;
      before = r.body.nextBefore;
      if (!before) break;
    }
    return n;
  };

  try {
    // ── Authorization ─────────────────────────────────────────────────────
    const anyUser = seller.uid;
    check((await call('/entitlements/admin/audit', null)).status === 401, 'auth: no token → 401 (audit read)');
    check((await putOverride(null, anyUser, 'cashbooks', { effect: 'revoke', reason: 'x' })).status === 401, 'auth: no token → 401 (override write)');
    for (const [name, t] of [['seller', seller.token], ['creator', creator.token], ['moderator', moderator.token], ['finance', finance.token]] as const) {
      check((await call('/entitlements/admin/audit', t)).status === 403, `auth: ${name} cannot read audit (403)`);
      check((await call(`/entitlements/admin/accounts/${anyUser}`, t)).status === 403, `auth: ${name} cannot read account summary (403)`);
      check((await putOverride(t, anyUser, 'cashbooks', { effect: 'revoke', reason: 'x' })).status === 403, `auth: ${name} cannot write overrides (403)`);
    }
    check((await call('/entitlements/admin/audit', admin.token)).status === 200, 'auth: admin reads audit (200)');
    check((await call(`/entitlements/admin/accounts/${anyUser}`, admin.token)).status === 200, 'auth: admin reads account summary (200)');
    check((await call('/entitlements/admin/platform-states', admin.token)).status === 200, 'auth: admin reads platform states (200)');
    check((await putOverride(admin.token, anyUser, 'cashbooks', { effect: 'revoke', reason: 'x' })).status === 403, 'auth: admin cannot write overrides (403)');
    check((await delOverride(admin.token, anyUser, 'cashbooks')).status === 403, 'auth: admin cannot delete overrides (403)');
    check((await putPlatform(admin.token, 'cashbooks', { enabled: false, reason: 'x' })).status === 403, 'auth: admin cannot write platform states (403)');

    // ── Validation (all 400/404, and none may create an audit row) ─────────
    const auditBeforeRejects = await auditCount();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    const expectCode = async (r: Promise<Res>, status: number, code: string, label: string) => {
      const x = await r;
      check(x.status === status && x.body.code === code, label, x);
    };
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'revoke' }), 400, 'ENTITLEMENT_REASON_REQUIRED', 'override: reason required');
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'revoke', reason: '   ' }), 400, 'ENTITLEMENT_REASON_REQUIRED', 'override: blank reason rejected');
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'restrict', reason: 'x' }), 400, 'ENTITLEMENT_EXPIRY_REQUIRED', 'override: restrict needs expiresAt');
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'restrict', expiresAt: past, reason: 'x' }), 400, 'ENTITLEMENT_EXPIRY_IN_PAST', 'override: past expiry rejected');
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'grant', expiresAt: future, reason: 'x' }), 400, 'ENTITLEMENT_EXPIRY_NOT_ALLOWED', 'override: grant cannot expire');
    await expectCode(putOverride(S, seller.uid, 'cashbooks', { effect: 'revoke', expiresAt: future, reason: 'x' }), 400, 'ENTITLEMENT_EXPIRY_NOT_ALLOWED', 'override: revoke cannot expire');
    await expectCode(putOverride(S, '00000000-0000-4000-8000-000000000000', 'cashbooks', { effect: 'revoke', reason: 'x' }), 404, 'ENTITLEMENT_ACCOUNT_NOT_FOUND', 'override: unknown account → 404');
    await expectCode(putOverride(S, 'not-a-uuid', 'cashbooks', { effect: 'revoke', reason: 'x' }), 404, 'ENTITLEMENT_ACCOUNT_NOT_FOUND', 'override: malformed account id → 404');
    await expectCode(putOverride(S, creator.uid, 'returnsRefunds', { effect: 'grant', reason: 'x' }), 400, 'ENTITLEMENT_ROLE_INELIGIBLE', 'override: role-ineligible feature rejected');
    await expectCode(putOverride(S, moderatorRow.id, 'cashbooks', { effect: 'grant', reason: 'x' }), 400, 'ENTITLEMENT_TARGET_NOT_PARTNER', 'override: staff target rejected');
    await expectCode(putOverride(S, seller.uid, 'notifications', { effect: 'revoke', reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'override: core rejected');
    await expectCode(putOverride(S, seller.uid, 'advancedAnalytics', { effect: 'grant', reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'override: deprecated rejected');
    await expectCode(putOverride(S, seller.uid, 'logistics', { effect: 'grant', reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'override: reserved rejected');
    await expectCode(putOverride(S, seller.uid, 'noSuchFeature', { effect: 'grant', reason: 'x' }), 400, 'ENTITLEMENT_UNKNOWN_FEATURE', 'override: unknown feature rejected');
    check((await putOverride(S, seller.uid, 'cashbooks', { effect: 'pause', reason: 'x' })).status === 400, 'override: invalid effect rejected');
    await expectCode(call('/entitlements/admin/accounts/00000000-0000-4000-8000-000000000000', S), 404, 'ENTITLEMENT_ACCOUNT_NOT_FOUND', 'summary: unknown account → 404');
    await expectCode(delOverride(S, '00000000-0000-4000-8000-000000000000', 'cashbooks'), 404, 'ENTITLEMENT_ACCOUNT_NOT_FOUND', 'delete: unknown account → 404');
    await expectCode(call(`/entitlements/admin/accounts/${seller.uid}/overrides/cashbooks`, S, 'DELETE', {}), 400, 'ENTITLEMENT_REASON_REQUIRED', 'delete: reason required');
    await expectCode(putPlatform(S, 'cashbooks', { enabled: false }), 400, 'ENTITLEMENT_REASON_REQUIRED', 'platform: disable needs reason');
    await expectCode(putPlatform(S, 'cashbooks', { enabled: false, reason: '  ' }), 400, 'ENTITLEMENT_REASON_REQUIRED', 'platform: blank reason rejected');
    await expectCode(putPlatform(S, 'analytics', { enabled: false, reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'platform: core cannot be disabled');
    await expectCode(putPlatform(S, 'notifications', { enabled: false, reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'platform: notifications (core) cannot be disabled');
    await expectCode(putPlatform(S, 'advancedAnalytics', { enabled: false, reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'platform: deprecated cannot be disabled');
    await expectCode(putPlatform(S, 'logistics', { enabled: false, reason: 'x' }), 400, 'FEATURE_NOT_SWITCHABLE', 'platform: reserved cannot be disabled');
    await expectCode(putPlatform(S, 'noSuchFeature', { enabled: false, reason: 'x' }), 400, 'ENTITLEMENT_UNKNOWN_FEATURE', 'platform: unknown cannot be disabled');
    await expectCode(call('/entitlements/admin/platform-states/notifications', S), 400, 'FEATURE_NOT_SWITCHABLE', 'platform GET: core key not a platform switch');
    await expectCode(call('/entitlements/admin/audit?userId=abc', S), 400, 'ENTITLEMENT_INVALID_QUERY', 'audit: malformed userId → 400');
    await expectCode(call('/entitlements/admin/audit?before=not-a-cursor', S), 400, 'ENTITLEMENT_INVALID_QUERY', 'audit: malformed before → 400');
    check((await auditCount()) === auditBeforeRejects, 'audit: rejected/unauthorized writes created no audit rows');

    // ── Platform states: missing row = enabled ────────────────────────────
    const states = await call('/entitlements/admin/platform-states', S);
    const cashState = (states.body.states || []).find((s: any) => s.featureKey === 'cashbooks');
    check(cashState && cashState.enabled === true && cashState.explicit === false, 'platform: missing row reported as enabled', cashState);
    check(!(states.body.states || []).some((s: any) => ['notifications', 'analytics', 'advancedAnalytics', 'logistics'].includes(s.featureKey)), 'platform: only switchable features listed');
    const beforeNoop = await auditCount();
    const enableNoop = await putPlatform(S, 'cashbooks', { enabled: true });
    check(enableNoop.status === 200 && enableNoop.body.changed === false && (await auditCount()) === beforeNoop, 'platform: enabling a missing row is a no-op (no audit)');

    // ── Account overrides: revoke / grant / remove ────────────────────────
    let r = await call('/cashbooks', seller.token);
    check(r.status === 200, 'baseline: seller cashbooks open', r.status);
    r = await putOverride(S, seller.uid, 'cashbooks', { effect: 'revoke', reason: 'Probe revoke' });
    check(r.status === 200 && r.body.changed === true && r.body.override?.effect === 'revoke' && r.body.decision?.source === 'override', 'override: revoke set (response has override + decision)', r.body);
    r = await call('/cashbooks', seller.token);
    check(denied(r, 'cashbooks') && r.body.source === 'override' && r.body.detail?.effect === 'revoke', '403 detail: revoke → source override, detail.effect revoke', r.body);
    check(!JSON.stringify(r.body).includes('Probe revoke'), '403 detail: admin reason is not exposed to the partner');
    const noop = await putOverride(S, seller.uid, 'cashbooks', { effect: 'revoke', reason: 'Probe revoke' });
    check(noop.status === 200 && noop.body.changed === false, 'override: identical PUT is a no-op');
    r = await delOverride(S, seller.uid, 'cashbooks', 'Probe remove');
    check(r.status === 200 && r.body.changed === true, 'override: removed');
    check((await call('/cashbooks', seller.token)).status === 200, 'override removed → role default restored');
    r = await delOverride(S, seller.uid, 'cashbooks', 'Probe remove again');
    check(r.status === 200 && r.body.changed === false, 'override: removing a missing override is a no-op');

    await call('/entitlements/admin/role-defaults/seller/cashbooks', S, 'PATCH', { enabled: false, reason: 'probe' });
    r = await call('/cashbooks', seller.token);
    check(denied(r, 'cashbooks') && r.body.source === 'role_default', 'role default off → 403 source role_default', r.body);
    await putOverride(S, seller.uid, 'cashbooks', { effect: 'grant', reason: 'Probe grant' });
    check((await call('/cashbooks', seller.token)).status === 200, 'override: grant beats role default off');

    // ── Platform switch ───────────────────────────────────────────────────
    r = await putPlatform(S, 'cashbooks', { enabled: false, reason: 'Probe platform incident' });
    check(r.status === 200 && r.body.changed === true && r.body.state?.enabled === false && r.body.state?.explicit === true, 'platform: disabled with reason', r.body);
    r = await call('/cashbooks', seller.token);
    check(denied(r, 'cashbooks') && r.body.source === 'platform', 'platform OFF beats grant (403 source platform)', r.body);
    check(denied(await call('/cashbooks', creator.token), 'cashbooks'), 'platform OFF denies creators too');
    check(notEntitlementDenied(await call('/cashbooks', S)), 'platform OFF: staff not entitlement-gated');
    check((await call('/entitlements/admin/platform-states/cashbooks', admin.token)).body.state?.enabled === false, 'platform GET one: reflects disabled state');
    r = await putPlatform(S, 'cashbooks', { enabled: true, reason: 'Probe restore' });
    check(r.status === 200 && r.body.changed === true, 'platform: re-enabled');
    check((await call('/cashbooks', seller.token)).status === 200, 'platform re-enabled → access restored (grant applies again)');
    await delOverride(S, seller.uid, 'cashbooks');
    await call('/entitlements/admin/role-defaults/seller/cashbooks', S, 'PATCH', { enabled: originalSellerCashbooks, reason: 'probe restore' });

    // ── Temporary restriction expires without any background job ─────────
    const expiresAt = new Date(Date.now() + 4000).toISOString();
    r = await putOverride(S, seller.uid, 'cashbooks', { effect: 'restrict', expiresAt, reason: 'Probe short restriction' });
    check(r.status === 200 && r.body.override?.expiresAt === expiresAt, 'restrict: set with expiry');
    r = await call('/cashbooks', seller.token);
    check(denied(r, 'cashbooks') && r.body.source === 'override' && r.body.expiresAt === expiresAt && r.body.detail?.effect === 'restrict', '403 detail: active restriction includes expiresAt', r.body);
    const summary = await call(`/entitlements/admin/accounts/${seller.uid}`, admin.token);
    const ov = (summary.body.overrides || []).find((o: any) => o.featureKey === 'cashbooks');
    const dec = (summary.body.entitlements || []).find((e: any) => e.featureKey === 'cashbooks');
    check(
      summary.body.account?.userId === seller.uid && summary.body.account?.partnerRole === 'seller' && ov?.active === true && dec?.enabled === false && dec?.source === 'override',
      'summary: identity, active restriction, effective decision',
      summary.body,
    );
    await sleep(4600);
    check((await call('/cashbooks', seller.token)).status === 200, 'restrict: expired restriction ignored (no job ran)');
    const summary2 = await call(`/entitlements/admin/accounts/${seller.uid}`, admin.token);
    check((summary2.body.overrides || []).find((o: any) => o.featureKey === 'cashbooks')?.active === false, 'summary: expired restriction shown inactive');
    await delOverride(S, seller.uid, 'cashbooks');

    // ── Dependency ─────────────────────────────────────────────────────────
    await putOverride(S, seller.uid, 'promotionRequests', { effect: 'grant', reason: 'Probe dependency grant' });
    await putPlatform(S, 'adsDeals', { enabled: false, reason: 'Probe dependency' });
    const depSummary = await call(`/entitlements/admin/accounts/${seller.uid}`, S);
    const promo = (depSummary.body.entitlements || []).find((e: any) => e.featureKey === 'promotionRequests');
    check(promo?.enabled === false && promo?.source === 'dependency' && promo?.detail?.requires === 'adsDeals', 'dependency: granted promotionRequests denied while adsDeals is platform-off', promo);
    r = await call('/ads/deals/x1/promotion-requests', seller.token, 'POST', {});
    check(r.status === 403 && r.body.code === 'FEATURE_ENTITLEMENT_DENIED', 'dependency: promotion-request write blocked', r.body);
    await putPlatform(S, 'adsDeals', { enabled: true, reason: 'Probe dependency restore' });
    await delOverride(S, seller.uid, 'promotionRequests');

    // ── Meta Messaging read/write split ───────────────────────────────────
    await putOverride(S, seller.uid, 'metaMessaging', { effect: 'revoke', reason: 'Probe Meta downgrade' });
    check((await call('/seller/social-inbox/status', seller.token)).status === 200, 'meta: status readable with metaMessaging off');
    check((await call('/conversations?contextType=external_social', seller.token)).status === 200, 'meta: history (external_social threads) readable');
    r = await call('/seller/social-inbox/connect', seller.token, 'POST', { channel: 'invalid' });
    check(denied(r, 'metaMessaging'), 'meta: connect blocked (403 metaMessaging)', r.body);
    r = await call('/seller/social-inbox/facebook?brandId=probe-none', seller.token, 'DELETE');
    check(notEntitlementDenied(r), `meta: disconnect allowed when off (not entitlement-denied, ${r.status})`, r.body);
    await putOverride(S, seller.uid, 'metaMessaging', { effect: 'grant', reason: 'Probe Meta restore' });
    r = await call('/seller/social-inbox/connect', seller.token, 'POST', { channel: 'invalid' });
    check(notEntitlementDenied(r) && r.status === 400, `meta: restored feature passes the connect gate (${r.status})`, r.body);
    await delOverride(S, seller.uid, 'metaMessaging');

    // ── Race: simultaneous first-time writes of the same override ─────────
    const raceKey = 'reviews';
    const [ra, rb] = await Promise.all([
      putOverride(S, tempSeller.id, raceKey, { effect: 'revoke', reason: 'Race A' }),
      putOverride(S, tempSeller.id, raceKey, { effect: 'grant', reason: 'Race B' }),
    ]);
    check(ra.status === 200 && rb.status === 200 && ra.body.changed && rb.body.changed, 'race: both concurrent writes succeed');
    const raceAudit = await call(`/entitlements/admin/audit?userId=${tempSeller.id}&featureKey=${raceKey}&limit=10`, S);
    const [second, first] = raceAudit.body.events || [];
    const finalRow = (await db.select().from(accountEntitlementOverrides).where(eq(accountEntitlementOverrides.userId, tempSeller.id)))[0];
    check(raceAudit.body.events?.length === 2 && first.previousState === null, 'race: first audit event saw no previous state', raceAudit.body);
    check(second && JSON.stringify(second.previousState) === JSON.stringify(first.newState), 'race: second audit event sees the first write as previous state', { first, second });
    check(finalRow && finalRow.reason === (second?.newState as any)?.reason && finalRow.effect === (second?.newState as any)?.effect, 'race: final state = last audited write', finalRow);

    // ── Audit contents, filtering, pagination, read-only, deleted user ─────
    const sellerAudit = await call(`/entitlements/admin/audit?userId=${seller.uid}&featureKey=cashbooks&limit=200`, admin.token);
    const evs = sellerAudit.body.events || [];
    const revokeEv = evs.find((e: any) => e.action === 'account_override.set' && e.newState?.effect === 'revoke' && e.reason === 'Probe revoke');
    check(
      revokeEv && revokeEv.targetScope === 'account' && revokeEv.target?.userId === seller.uid && revokeEv.actor?.userId === superAdmin.uid &&
        revokeEv.actor?.displayName && revokeEv.previousState === null && revokeEv.source === 'admin_api',
      'audit: override event has target, actor (with display data), previous/new state, reason',
      revokeEv,
    );
    const removedEv = evs.find((e: any) => e.action === 'account_override.removed' && e.reason === 'Probe remove');
    check(removedEv && removedEv.previousState?.effect === 'revoke' && removedEv.newState === null, 'audit: removal event records previous state', removedEv);
    check(evs.every((e: any) => e.featureKey === 'cashbooks' && e.target?.userId === seller.uid), 'audit: userId + featureKey filters applied');
    const platEv = (await call('/entitlements/admin/audit?featureKey=cashbooks&limit=200', S)).body.events?.find(
      (e: any) => e.action === 'platform_state.set' && e.reason === 'Probe platform incident',
    );
    check(platEv && platEv.targetScope === 'platform' && platEv.previousState === null && platEv.newState?.enabled === false, 'audit: platform event', platEv);
    const roleEv = (await call('/entitlements/admin/audit?featureKey=cashbooks&limit=200', S)).body.events?.find((e: any) => e.action === 'role_default.set');
    check(roleEv && roleEv.targetScope === 'role' && roleEv.targetRole === 'seller', 'audit: role-default event', roleEv);
    // pagination: page through this seller's events 2 at a time
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    let ordered = true;
    let lastTs = '';
    do {
      const page = await call(`/entitlements/admin/audit?userId=${seller.uid}&limit=2${cursor ? `&before=${cursor}` : ''}`, admin.token);
      for (const e of page.body.events || []) {
        if (lastTs && e.createdAt > lastTs) ordered = false;
        lastTs = e.createdAt;
        seen.push(e.id);
      }
      cursor = page.body.nextBefore;
      pages += 1;
    } while (cursor && pages < 100);
    const all = (await call(`/entitlements/admin/audit?userId=${seller.uid}&limit=200`, admin.token)).body.events || [];
    check(pages > 1 && seen.length === all.length && new Set(seen).size === seen.length && ordered, 'audit: cursor pagination returns every event once, newest first', { pages, seen: seen.length, all: all.length });
    check((await call('/entitlements/admin/audit?limit=500', S)).body.events.length <= 200, 'audit: limit clamped to 200');
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const x = await call('/entitlements/admin/audit', S, m, {});
      check(x.status === 404, `audit: no ${m} route (read-only, ${x.status})`);
    }
    // deleted user: history survives, display data simply absent
    await db.delete(users).where(eq(users.id, tempSeller.id));
    tempSellerDeleted = true;
    const ghost = await call(`/entitlements/admin/audit?userId=${tempSeller.id}&limit=10`, S);
    check(
      ghost.body.events?.length === 2 && ghost.body.events.every((e: any) => e.target?.userId === tempSeller.id && e.target?.displayName === undefined),
      'audit: history survives deletion of the target user (raw id kept, no display data)',
      ghost.body,
    );
  } finally {
    await db.delete(accountEntitlementOverrides).where(inArray(accountEntitlementOverrides.userId, [seller.uid, creator.uid]));
    await db.delete(platformFeatureStates);
    await call('/entitlements/admin/role-defaults/seller/cashbooks', S, 'PATCH', { enabled: originalSellerCashbooks, reason: 'probe restore' });
    if (!tempSellerDeleted) await db.delete(users).where(eq(users.id, tempSeller.id));
    await db.delete(users).where(eq(users.id, tempAdmin.id));
    const after = await call('/entitlements/admin', S);
    check((after.body.roleDefaults?.seller?.cashbooks !== false) === originalSellerCashbooks, 'cleanup: seller cashbooks role default restored');
  }

  if (fails.length) {
    console.error(`\nFAIL probe-entitlement-phase2b-http (${fails.length} failed, ${passes} passed)`);
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase2b-http (${passes} checks)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
