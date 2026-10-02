/**
 * Feature Access & Entitlements — Phase 2A foundation probe.
 *
 * Part 1 (always, offline): the pure evaluator's precedence matrix.
 * Part 2 (only with PROBE_DISPOSABLE_DATABASE_URL, a LOCAL throwaway database that
 * already has migration 0011): schema constraints, admin writes + audit rows in one
 * transaction, no-op handling, actor/real actor, transaction rollback, platform
 * missing-row semantics, plan-controlled validation and the context query count.
 * Part 2 temporarily renames entitlement_audit_events and always renames it back.
 *
 *   npx tsx scripts/probe-entitlement-phase2.ts
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_upgrade npx tsx scripts/probe-entitlement-phase2.ts
 */
const DISPOSABLE = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
if (DISPOSABLE) {
  const host = new URL(DISPOSABLE).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    console.error('Refusing: PROBE_DISPOSABLE_DATABASE_URL must point at a local throwaway database.');
    process.exit(2);
  }
  process.env.DATABASE_URL = DISPOSABLE;
} else {
  process.env.DATABASE_URL = 'postgres://probe:probe@127.0.0.1:1/unreachable_phase2_probe';
}

const fails: string[] = [];
let passes = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passes += 1;
    return;
  }
  fails.push(`${label}${detail === undefined ? '' : ` :: ${JSON.stringify(detail).slice(0, 300)}`}`);
}
async function expectReject(fn: () => Promise<unknown>, code: string, label: string) {
  try {
    await fn();
    check(false, `${label} (no error)`);
  } catch (e) {
    const got = (e as { code?: string }).code;
    check(got === code, label, { expected: code, got, message: (e as Error).message });
  }
}

async function partOneOffline() {
  const { evaluateFeature } = await import('../server/entitlements/entitlementEvaluator');
  const reg = await import('../shared/entitlements/registry');
  type Ctx = Parameters<typeof evaluateFeature>[1];
  const now = new Date('2026-10-01T00:00:00Z');
  const future = new Date('2026-10-05T00:00:00Z');
  const past = new Date('2026-09-20T00:00:00Z');
  const ctx = (o: Partial<{ role: 'seller' | 'creator' | null; rd: Record<string, boolean>; pf: Record<string, boolean>; ov: Record<string, { effect: 'grant' | 'revoke' | 'restrict'; expiresAt: Date | null }>; plan: Record<string, boolean> | null }>): Ctx => ({
    partnerRole: o.role === undefined ? 'seller' : o.role,
    roleDefaults: new Map(Object.entries(o.rd ?? {})),
    platformStates: new Map(Object.entries(o.pf ?? {})),
    overrides: new Map(Object.entries(o.ov ?? {})),
    planEntitlements: o.plan === undefined || o.plan === null ? null : new Map(Object.entries(o.plan)),
  });
  const ev = (key: string, c: Ctx) => evaluateFeature(key, c, now);

  // 1. core wins over platform off + revoke + role false
  let d = ev('notifications', ctx({ pf: { notifications: false }, ov: { notifications: { effect: 'revoke', expiresAt: null } }, rd: { notifications: false } }));
  check(d.enabled && d.source === 'core', '1 core + platform off + revoke + role false → allowed (core)', d);
  // 2. platform off beats grant + plan true
  d = ev('customerInsights', ctx({ pf: { customerInsights: false }, ov: { customerInsights: { effect: 'grant', expiresAt: null } }, plan: { customerInsights: true }, rd: { customerInsights: true } }));
  check(!d.enabled && d.source === 'platform', '2 platform off + grant + plan true → denied (platform)', d);
  // 3. permanent revoke beats plan true + role true
  d = ev('customerInsights', ctx({ ov: { customerInsights: { effect: 'revoke', expiresAt: null } }, plan: { customerInsights: true }, rd: { customerInsights: true } }));
  check(!d.enabled && d.source === 'override' && d.detail?.effect === 'revoke', '3 revoke + plan true + role true → denied (override revoke)', d);
  // 4. future restriction
  d = ev('cashbooks', ctx({ ov: { cashbooks: { effect: 'restrict', expiresAt: future } }, rd: { cashbooks: true } }));
  check(!d.enabled && d.source === 'override' && d.detail?.effect === 'restrict' && d.detail?.expiresAt === future.toISOString(), '4 future restriction → denied with expiresAt', d);
  // 5. expired restriction falls through
  d = ev('cashbooks', ctx({ ov: { cashbooks: { effect: 'restrict', expiresAt: past } }, rd: { cashbooks: true } }));
  check(d.enabled && d.source === 'role_default', '5 expired restriction → falls through to role default', d);
  d = ev('customerInsights', ctx({ ov: { customerInsights: { effect: 'restrict', expiresAt: past } }, plan: { customerInsights: false }, rd: { customerInsights: true } }));
  check(!d.enabled && d.source === 'plan', '5b expired restriction → falls through to plan', d);
  // 6. grant beats role false
  d = ev('cashbooks', ctx({ ov: { cashbooks: { effect: 'grant', expiresAt: null } }, rd: { cashbooks: false } }));
  check(d.enabled && d.source === 'override', '6 grant + role false → allowed (override grant)', d);
  // 7. plan-controlled + open subscription + plan false
  d = ev('customerInsights', ctx({ plan: { customerInsights: false }, rd: { customerInsights: true } }));
  check(!d.enabled && d.source === 'plan', '7 plan-controlled + plan row false → denied (plan)', d);
  // 8. plan-controlled + no subscription → role default (decision A)
  d = ev('customerInsights', ctx({ plan: null, rd: { customerInsights: true } }));
  check(d.enabled && d.source === 'role_default', '8 plan-controlled + no subscription → role default', d);
  d = ev('customerInsights', ctx({ plan: {}, rd: { customerInsights: true } }));
  check(d.enabled && d.source === 'role_default', '8b open subscription without a row for the key → role default', d);
  // 9. operational feature ignores plan rows
  d = ev('cashbooks', ctx({ plan: { cashbooks: false }, rd: { cashbooks: true } }));
  check(d.enabled && d.source === 'role_default', '9 operational + plan row false → plan ignored', d);
  // 10. role default respected
  d = ev('cashbooks', ctx({ rd: { cashbooks: false } }));
  check(!d.enabled && d.source === 'role_default', '10 role default false → denied', d);
  // 11. missing role default
  d = ev('cashbooks', ctx({ rd: {} }));
  check(!d.enabled && d.source === 'role_default' && d.detail?.missing === true, '11 missing role default → denied', d);
  // 12. deprecated + grant
  d = ev('advancedAnalytics', ctx({ ov: { advancedAnalytics: { effect: 'grant', expiresAt: null } }, rd: { advancedAnalytics: true } }));
  check(!d.enabled && d.source === 'deprecated', '12 deprecated advancedAnalytics + grant → denied', d);
  // 13. unknown key
  d = ev('totallyUnknownFeature', ctx({ rd: { totallyUnknownFeature: true } }));
  check(!d.enabled && d.source === 'unknown', '13 unknown key → denied', d);
  // 14. role-ineligible (returnsRefunds is seller-only)
  d = ev('returnsRefunds', ctx({ role: 'creator', rd: { returnsRefunds: true } }));
  check(!d.enabled && d.source === 'role_ineligible', '14 role-ineligible → denied in evaluator', d);
  // 15. dependency
  d = ev('promotionRequests', ctx({ ov: { promotionRequests: { effect: 'grant', expiresAt: null }, adsDeals: { effect: 'restrict', expiresAt: future } }, rd: { promotionRequests: false, adsDeals: true } }));
  check(!d.enabled && d.source === 'dependency' && d.detail?.requires === 'adsDeals', '15 promotionRequests granted but adsDeals restricted → dependency denial', d);
  d = ev('promotionRequests', ctx({ rd: { promotionRequests: true, adsDeals: true } }));
  check(d.enabled, '15b promotionRequests with adsDeals available → allowed', d);
  d = ev('promotionRequests', ctx({ pf: { adsDeals: false }, rd: { promotionRequests: true, adsDeals: true } }));
  check(!d.enabled && d.source === 'dependency' && d.detail?.dependencySource === 'platform', '15c adsDeals platform-off → dependency denial', d);
  // 16. staff/admin/consumer unaffected
  d = ev('cashbooks', ctx({ role: null, pf: { cashbooks: false }, rd: { cashbooks: false } }));
  check(d.enabled && d.source === 'not_partner', '16 non-partner roles → allowed regardless of controls', d);
  // reserved: controls ignored, role default applies
  d = ev('logistics', ctx({ pf: { logistics: false }, ov: { logistics: { effect: 'revoke', expiresAt: null } }, rd: { logistics: true } }));
  check(d.enabled && d.source === 'role_default', 'reserved logistics ignores platform/override controls', d);
  // dependency graph is acyclic and only evidenced
  const deps = reg.PARTNER_FEATURES.filter((f) => f.requires?.length).map((f) => `${f.key}->${f.requires!.join('|')}`);
  check(deps.join() === 'promotionRequests->adsDeals', 'only dependency is promotionRequests -> adsDeals', deps);
  const visiting = new Set<string>();
  const acyclic = (k: string): boolean => {
    if (visiting.has(k)) return false;
    visiting.add(k);
    const ok = (reg.featureByKey(k)?.requires || []).every(acyclic);
    visiting.delete(k);
    return ok;
  };
  check(reg.PARTNER_FEATURES.every((f) => acyclic(f.key)), 'dependency graph acyclic');
  check(
    reg.planControlledFeatureKeysForRole('seller').sort().join() === 'customerInsights,logisticsAnalytics,metaMessaging,promotionRequests',
    'plan-controlled seller keys are exactly the approved four',
    reg.planControlledFeatureKeysForRole('seller'),
  );
}

async function partTwoDatabase() {
  const { sql, eq, and } = await import('drizzle-orm');
  const { db } = await import('../server/db/client');
  const schema = await import('../server/db/schema');
  const admin = await import('../server/entitlements/entitlementAdminStore');
  const store = await import('../server/entitlements/entitlementStore');
  const { planService } = await import('../server/subscriptions/planService');

  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Array<Record<string, unknown>>;
  const users = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role }).from(schema.users);
  const seller = users.find((u) => u.email === 'seller@choosify.com.bd');
  const creator = users.find((u) => u.email === 'creator@choosify.com.bd');
  const superAdmin = users.find((u) => u.role === 'super_admin');
  // Any non-partner account (consumer if present, else a staff account) — never created by this probe.
  const consumer = users.find((u) => u.role === 'user') ?? users.find((u) => !['seller', 'verified_seller', 'creator', 'super_admin', 'admin'].includes(u.role));
  if (!seller || !creator || !superAdmin || !consumer) throw new Error('seeded dev users missing (run server/db/seedDevUsers.ts)');
  const actor = { userId: superAdmin.id, realActorUserId: null, source: 'admin_api' as const };
  const auditCount = async () => Number((await rows(sql`select count(*)::int n from entitlement_audit_events`))[0].n);
  const lastAudit = async () => (await rows(sql`select * from entitlement_audit_events order by created_at desc limit 1`))[0];
  const cleanup = async () => {
    await db.delete(schema.accountEntitlementOverrides).where(eq(schema.accountEntitlementOverrides.userId, seller.id));
    await db.delete(schema.accountEntitlementOverrides).where(eq(schema.accountEntitlementOverrides.userId, creator.id));
    await db.delete(schema.platformFeatureStates);
    await db.execute(sql`delete from entitlement_audit_events`);
  };
  await cleanup();

  // ── schema / constraints ──
  const tables = await rows(sql`select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
  check(tables[0].n === 31, 'schema: 31 public tables', tables[0]);
  const migrations = await rows(sql`select count(*)::int n from drizzle.__drizzle_migrations`);
  check(migrations[0].n === 14, 'schema: 14 migrations', migrations[0]);
  const idx = (await rows(sql`select indexname from pg_indexes where schemaname='public' and tablename in ('account_entitlement_overrides','platform_feature_states','entitlement_audit_events') order by 1`)).map((r) => r.indexname);
  for (const name of [
    'account_entitlement_overrides_user_feature_unique',
    'entitlement_audit_events_target_user_created_idx',
    'entitlement_audit_events_feature_created_idx',
    'entitlement_audit_events_created_idx',
  ]) check(idx.includes(name), `index ${name} exists`, idx);
  const fks = await rows(sql`select conrelid::regclass::text t, conname from pg_constraint where contype='f' and conrelid::regclass::text in ('account_entitlement_overrides','platform_feature_states','entitlement_audit_events') order by 1,2`);
  check(fks.filter((f) => f.t === 'entitlement_audit_events').length === 0, 'audit table has NO foreign keys', fks);
  check(fks.filter((f) => f.t === 'account_entitlement_overrides').length === 3, 'overrides: user (cascade) + created_by/updated_by (set null) FKs', fks);
  const rawReject = async (q: ReturnType<typeof sql>, label: string) => {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(q);
        throw new Error('__no_error__');
      });
      check(false, label);
    } catch (e) {
      check(!String((e as Error).message).includes('__no_error__'), label, (e as Error).message);
    }
  };
  await rawReject(sql`insert into account_entitlement_overrides (user_id, feature_key, effect, reason) values (${seller.id}, 'cashbooks', 'restrict', 'x')`, 'constraint: restrict without expiry rejected');
  await rawReject(sql`insert into account_entitlement_overrides (user_id, feature_key, effect, expires_at, reason) values (${seller.id}, 'cashbooks', 'grant', now() + interval '1 day', 'x')`, 'constraint: grant with expiry rejected');
  await rawReject(sql`insert into account_entitlement_overrides (user_id, feature_key, effect, reason) values (${seller.id}, 'cashbooks', 'revoke', '   ')`, 'constraint: blank reason rejected');
  await rawReject(sql`insert into account_entitlement_overrides (user_id, feature_key, effect, reason) values (${seller.id}, 'cashbooks', 'pause', 'x')`, 'constraint: unknown effect rejected');
  await rawReject(sql`insert into platform_feature_states (feature_key, enabled) values ('cashbooks', false)`, 'constraint: platform off without reason rejected');
  await rawReject(sql`insert into entitlement_audit_events (action, source, target_scope, feature_key) values ('something.else', 'admin_api', 'role', 'x')`, 'constraint: unknown audit action rejected');
  await rawReject(
    sql`insert into account_entitlement_overrides (user_id, feature_key, effect, reason) values (${seller.id}, 'cashbooks', 'revoke', 'a'), (${seller.id}, 'cashbooks', 'grant', 'b')`,
    'constraint: one override per (account, feature)',
  );

  // ── write validation ──
  const future = new Date(Date.now() + 3 * 86_400_000);
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'notifications', effect: 'revoke', reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'override on core rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'advancedAnalytics', effect: 'grant', reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'override on deprecated rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'logistics', effect: 'grant', reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'override on reserved rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'nope', effect: 'grant', reason: 'x' }, actor), 'ENTITLEMENT_UNKNOWN_FEATURE', 'override on unknown feature rejected');
  await expectReject(() => admin.setAccountOverride({ userId: creator.id, featureKey: 'returnsRefunds', effect: 'grant', reason: 'x' }, actor), 'ENTITLEMENT_ROLE_INELIGIBLE', 'override on role-ineligible feature rejected');
  await expectReject(() => admin.setAccountOverride({ userId: consumer.id, featureKey: 'cashbooks', effect: 'grant', reason: 'x' }, actor), 'ENTITLEMENT_TARGET_NOT_PARTNER', 'override on non-partner account rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'restrict', reason: 'x' }, actor), 'ENTITLEMENT_EXPIRY_REQUIRED', 'restriction without expiry rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'restrict', expiresAt: new Date(Date.now() - 1000), reason: 'x' }, actor), 'ENTITLEMENT_EXPIRY_IN_PAST', 'restriction with past expiry rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'grant', expiresAt: future, reason: 'x' }, actor), 'ENTITLEMENT_EXPIRY_NOT_ALLOWED', 'grant with expiry rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'revoke', expiresAt: future, reason: 'x' }, actor), 'ENTITLEMENT_EXPIRY_NOT_ALLOWED', 'revoke with expiry rejected');
  await expectReject(() => admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'revoke', reason: '   ' }, actor), 'ENTITLEMENT_REASON_REQUIRED', 'blank reason rejected');
  await expectReject(() => admin.setPlatformFeatureState({ featureKey: 'analytics', enabled: false, reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'platform switch on core rejected');
  await expectReject(() => admin.setPlatformFeatureState({ featureKey: 'advancedAnalytics', enabled: false, reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'platform switch on deprecated rejected');
  await expectReject(() => admin.setPlatformFeatureState({ featureKey: 'logistics', enabled: false, reason: 'x' }, actor), 'FEATURE_NOT_SWITCHABLE', 'platform switch on reserved rejected');
  await expectReject(() => admin.setPlatformFeatureState({ featureKey: 'cashbooks', enabled: false, reason: '' }, actor), 'ENTITLEMENT_REASON_REQUIRED', 'platform off without reason rejected');
  await expectReject(() => admin.setRoleDefaults({ role: 'seller', changes: { notifications: false }, actor, strict: true }), 'FEATURE_NOT_SWITCHABLE', 'role default on core rejected (strict)');
  check((await auditCount()) === 0, 'no audit rows from rejected writes');

  // ── audit rows, actor / real actor, no-ops ──
  const impersonating = { userId: seller.id, realActorUserId: superAdmin.id, source: 'admin_api' as const };
  let r = await admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'restrict', expiresAt: future, reason: 'Chargeback review' }, impersonating);
  check(r.changed, 'override restrict created');
  let a = await lastAudit();
  check(
    a.action === 'account_override.set' && a.target_scope === 'account' && a.target_user_id === seller.id && a.feature_key === 'cashbooks' && a.previous_state === null &&
      (a.new_state as { effect?: string }).effect === 'restrict' && a.reason === 'Chargeback review' && a.actor_user_id === seller.id && a.real_actor_user_id === superAdmin.id && a.source === 'admin_api',
    'audit account_override.set: target, states, reason, actor + real actor',
    a,
  );
  const before = await auditCount();
  r = await admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'restrict', expiresAt: future, reason: 'Chargeback review' }, actor);
  check(!r.changed && (await auditCount()) === before, 'identical override is a no-op (no audit row)');
  r = await admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'revoke', reason: 'Confirmed fraud' }, actor);
  a = await lastAudit();
  check(r.changed && (a.previous_state as { effect?: string }).effect === 'restrict' && (a.new_state as { effect?: string }).effect === 'revoke', 'override change records previous → new', a);
  const overrideRows = await db.select().from(schema.accountEntitlementOverrides).where(and(eq(schema.accountEntitlementOverrides.userId, seller.id), eq(schema.accountEntitlementOverrides.featureKey, 'cashbooks')));
  check(overrideRows.length === 1 && overrideRows[0].effect === 'revoke' && overrideRows[0].expiresAt === null, 'override uniqueness: one row updated in place', overrideRows);
  r = await admin.removeAccountOverride({ userId: seller.id, featureKey: 'cashbooks', reason: 'Resolved' }, actor);
  a = await lastAudit();
  check(r.changed && a.action === 'account_override.removed' && a.new_state === null && (a.previous_state as { effect?: string }).effect === 'revoke', 'audit account_override.removed', a);
  const beforeRemove = await auditCount();
  r = await admin.removeAccountOverride({ userId: seller.id, featureKey: 'cashbooks', reason: 'Resolved' }, actor);
  check(!r.changed && (await auditCount()) === beforeRemove, 'removing a missing override is a no-op');

  const beforePlatform = await auditCount();
  r = await admin.setPlatformFeatureState({ featureKey: 'cashbooks', enabled: true }, actor);
  check(!r.changed && (await auditCount()) === beforePlatform, 'enabling a feature with no platform row is a no-op (missing row = enabled)');
  check((await db.select().from(schema.platformFeatureStates)).length === 0, 'no platform row created by the no-op');
  r = await admin.setPlatformFeatureState({ featureKey: 'cashbooks', enabled: false, reason: 'Ledger incident' }, actor);
  a = await lastAudit();
  check(r.changed && a.action === 'platform_state.set' && a.target_scope === 'platform' && a.previous_state === null && (a.new_state as { enabled?: boolean }).enabled === false, 'audit platform_state.set', a);
  r = await admin.setPlatformFeatureState({ featureKey: 'cashbooks', enabled: true }, actor);
  check(r.changed, 'platform re-enable recorded');

  const roleBefore = (await store.entitlementStore.getRoleDefaults()).seller.reviews;
  const beforeRole = await auditCount();
  const same = await admin.setRoleDefaults({ role: 'seller', changes: { reviews: roleBefore !== false }, actor, strict: true });
  check(same.changed.length === 0 && (await auditCount()) === beforeRole, 'role default set to its current value is a no-op');
  const flipped = await admin.setRoleDefaults({ role: 'seller', changes: { reviews: roleBefore === false }, actor, reason: 'probe', strict: true });
  a = await lastAudit();
  check(flipped.changed.join() === 'reviews' && a.action === 'role_default.set' && a.target_role === 'seller' && a.target_scope === 'role', 'audit role_default.set', a);
  await admin.setRoleDefaults({ role: 'seller', changes: { reviews: roleBefore !== false }, actor, reason: 'probe restore', strict: true });

  // ── transaction rollback: audit insert failure undoes the state change ──
  await db.execute(sql`alter table entitlement_audit_events rename to entitlement_audit_events_probe_offline`);
  try {
    let threw = false;
    try {
      await admin.setAccountOverride({ userId: seller.id, featureKey: 'reviews', effect: 'grant', reason: 'should roll back' }, actor);
    } catch {
      threw = true;
    }
    const leaked = await db.select().from(schema.accountEntitlementOverrides).where(and(eq(schema.accountEntitlementOverrides.userId, seller.id), eq(schema.accountEntitlementOverrides.featureKey, 'reviews')));
    check(threw && leaked.length === 0, 'audit failure rolls back the override write (same transaction)', { threw, leaked: leaked.length });
    let roleThrew = false;
    const roleNow = (await store.entitlementStore.getRoleDefaults()).seller.reviews;
    try {
      await admin.setRoleDefaults({ role: 'seller', changes: { reviews: roleNow === false }, actor, strict: true });
    } catch {
      roleThrew = true;
    }
    check(roleThrew && (await store.entitlementStore.getRoleDefaults()).seller.reviews === roleNow, 'audit failure rolls back the role-default write');
  } finally {
    await db.execute(sql`alter table entitlement_audit_events_probe_offline rename to entitlement_audit_events`);
  }

  // ── resolver against real rows ──
  const decisions = await store.getEntitlementDecisions({ role: 'seller', userId: seller.id, featureKeys: ['cashbooks', 'notifications', 'advancedAnalytics'] });
  check(decisions.cashbooks.enabled && decisions.cashbooks.source === 'role_default', 'no platform row → enabled (role default)', decisions.cashbooks);
  check(decisions.notifications.source === 'core' && !decisions.advancedAnalytics.enabled, 'core allowed, deprecated denied via loaded context');
  await admin.setAccountOverride({ userId: seller.id, featureKey: 'cashbooks', effect: 'restrict', expiresAt: future, reason: 'probe restrict' }, actor);
  const gated = await store.isApiPathEntitled({ role: 'seller', userId: seller.id, path: '/api/v1/cashbooks', method: 'GET' });
  check(!gated.ok && gated.featureKey === 'cashbooks' && gated.source === 'override', 'restricted account denied on the gated route', gated);
  const creatorRoute = await store.isApiPathEntitled({ role: 'creator', userId: creator.id, path: '/api/v1/operations/returns', method: 'GET' });
  check(creatorRoute.ok, 'role-ineligible route still not entitlement-gated for creators (Phase 1 behavior kept)', creatorRoute);
  await admin.removeAccountOverride({ userId: seller.id, featureKey: 'cashbooks', reason: 'probe cleanup' }, actor);

  // ── query count: /entitlements/me loads its context once ──
  const pool = (db as unknown as { $client: { query: (...args: unknown[]) => unknown } }).$client;
  const originalQuery = pool.query.bind(pool);
  let queries = 0;
  pool.query = (...args: unknown[]) => {
    queries += 1;
    return originalQuery(...args);
  };
  try {
    await store.getEnabledMapForActor({ role: 'seller', userId: seller.id });
    const mapQueries = queries;
    queries = 0;
    await store.isApiPathEntitled({ role: 'seller', userId: seller.id, path: '/api/v1/cashbooks', method: 'GET' });
    const routeQueries = queries;
    queries = 0;
    await store.isApiPathEntitled({ role: 'seller', userId: seller.id, path: '/api/v1/operations/orders', method: 'GET' });
    const coreRouteQueries = queries;
    console.log(`query count: /entitlements/me map=${mapQueries} gated route (operational)=${routeQueries} core route=${coreRouteQueries}`);
    check(mapQueries <= 4, 'getEnabledMapForActor ≤ 4 queries (role, platform, overrides, plan)', mapQueries);
    check(routeQueries <= 3, 'operational gated route ≤ 3 queries (no plan query)', routeQueries);
    check(coreRouteQueries === 0, 'core/unmapped route makes no entitlement queries', coreRouteQueries);
  } finally {
    pool.query = originalQuery;
  }

  // ── plan-controlled validation on Plan Version writes ──
  const plan = await planService.createPlan({ role: 'seller', name: 'PHASE2A PROBE PLAN', actorUserId: superAdmin.id });
  try {
    const v = await planService.createDraftVersion(plan.id, { nameSnapshot: 'PHASE2A PROBE v1' }, superAdmin.id);
    let rejected = '';
    try {
      await planService.setDraftEntitlements(plan.id, v.id, [{ featureKey: 'cashbooks', enabled: true }]);
    } catch (e) {
      rejected = (e as Error).message;
    }
    check(/not plan-controlled/.test(rejected), 'plan version rejects operational key (cashbooks)', rejected);
    const saved = await planService.setDraftEntitlements(plan.id, v.id, [{ featureKey: 'customerInsights', enabled: true }, { featureKey: 'promotionRequests', enabled: false }]);
    check(saved.length === 2, 'plan version accepts plan-controlled keys', saved);
  } finally {
    await db.execute(sql`delete from plan_entitlements where plan_version_id in (select id from plan_versions where plan_id = ${plan.id})`);
    await db.execute(sql`delete from plan_versions where plan_id = ${plan.id}`);
    await db.execute(sql`delete from plans where id = ${plan.id}`);
  }

  await cleanup();
}

(async () => {
  await partOneOffline();
  if (DISPOSABLE) await partTwoDatabase();
  else console.log('Part 2 (database) skipped — set PROBE_DISPOSABLE_DATABASE_URL to a local throwaway DB with migration 0011.');
  if (fails.length) {
    console.error(`\nFAIL probe-entitlement-phase2 (${fails.length} failed, ${passes} passed)`);
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase2 (${passes} checks${DISPOSABLE ? ', incl. database' : ', offline only'})`);
  process.exit(0);
})().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
