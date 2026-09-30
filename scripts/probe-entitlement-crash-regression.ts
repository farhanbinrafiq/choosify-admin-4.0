/**
 * Regression probe (U): an entitlement-lookup DB failure must return
 * 503 ENTITLEMENT_CHECK_UNAVAILABLE and must NOT terminate the API process.
 *
 * Before the Phase 1 fix, requirePartnerEntitlement awaited the resolver outside
 * try/catch; Express 4 does not catch async rejections, so Node 22 exited on the
 * unhandled rejection and every in-flight request (and debounced JSON writes) died.
 *
 * SAFETY: runs ONLY against a disposable database you name explicitly. It spawns
 * its own API process (separate port, every *_SNAPSHOT_PATH redirected to a temp
 * dir), temporarily renames feature_entitlements in that database, and always
 * renames it back.
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-entitlement-crash-regression.ts
 */
import { spawn, type ChildProcess } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import pg from 'pg';

const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const PORT = Number(process.env.PROBE_PORT || 3098);
const ROOT = `http://127.0.0.1:${PORT}`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function check(cond: unknown, label: string, detail?: unknown) {
  console.log(cond ? 'PASS' : 'FAIL', label, cond ? '' : JSON.stringify(detail ?? '').slice(0, 300));
  if (!cond) fails.push(label);
}

function snapshotEnvNames(): string[] {
  const names = new Set<string>();
  (function walk(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|dist/.test(e.name)) walk(p);
      } else if (/\.ts$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/process\.env\.(\w+SNAPSHOT_PATH)/g)) names.add(m[1]);
      }
    }
  })(join(process.cwd(), 'server'));
  (function walk(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/process\.env\.(\w+SNAPSHOT_PATH)/g)) names.add(m[1]);
      }
    }
  })(join(process.cwd(), 'lib'));
  return [...names];
}

async function waitForHealth(child: ChildProcess, ms = 120_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`API exited during startup (${child.exitCode})`);
    try {
      const r = await fetch(`${ROOT}/health`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API did not become healthy');
}

async function req(path: string, token?: string, method = 'GET', body?: unknown) {
  const r = await fetch(`${ROOT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

async function main() {
  const url = new URL(DB_URL || 'postgres://invalid');
  if (!DB_URL || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    console.error('Refusing to run: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const tmp = mkdtempSync(join(tmpdir(), 'ent-crash-probe-'));
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: DB_URL, PORT: String(PORT), NODE_ENV: 'development' };
  for (const name of snapshotEnvNames()) env[name] = join(tmp, `${name.toLowerCase()}.json`);
  let output = '';
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d) => (output += String(d)));
  child.stderr?.on('data', (d) => (output += String(d)));

  let renamed = false;
  let offline = '';
  try {
    await waitForHealth(child);
    const login = await req('/api/v1/auth/login', undefined, 'POST', { email: 'seller@choosify.com.bd', password: PASS_ });
    const token = String(login.body.accessToken || '');
    check(Boolean(token), 'seller login on disposable DB', login.status);

    const baseline = await req('/api/v1/cashbooks', token);
    check(baseline.status !== 503, `baseline gated request (${baseline.status})`);

    await db.query('ALTER TABLE feature_entitlements RENAME TO feature_entitlements_probe_offline');
    renamed = true;

    const gated = await req('/api/v1/cashbooks', token);
    check(gated.status === 503 && gated.body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE', 'gated request → 503 ENTITLEMENT_CHECK_UNAVAILABLE', gated);
    const me = await req('/api/v1/entitlements/me', token);
    check(me.status === 503 && me.body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE', '/entitlements/me → 503 ENTITLEMENT_CHECK_UNAVAILABLE', me);
    // A second failure in a row must not crash either.
    const gated2 = await req('/api/v1/ads/deals', token);
    check(gated2.status === 503, 'second gated request → 503', gated2.status);

    await new Promise((r) => setTimeout(r, 1500));
    check(child.exitCode === null && child.signalCode === null, 'API process still alive');
    const health = await fetch(`${ROOT}/health`).then((r) => r.status).catch((e) => `DOWN ${e}`);
    check(health === 200, '/health remains 200', health);
    const orders = await req('/api/v1/operations/orders', token);
    check(orders.status === 200, 'core endpoint GET /operations/orders reachable', orders.status);
    const notif = await req('/api/notifications', token);
    check(notif.status !== 503, `core notifications reachable without entitlement table (${notif.status})`);
    check(/\[Entitlements\] Entitlement check failed/.test(output), 'failure logged via [Entitlements] logger');

    await db.query('ALTER TABLE feature_entitlements_probe_offline RENAME TO feature_entitlements');
    renamed = false;

    // Phase 2A foundation tables (migration 0011): each missing table must give the
    // same controlled 503, never a crash.
    const has0011 = (await db.query("select to_regclass('public.account_entitlement_overrides') is not null as ok")).rows[0]?.ok;
    if (has0011) {
      for (const table of ['account_entitlement_overrides', 'platform_feature_states']) {
        await db.query(`ALTER TABLE ${table} RENAME TO ${table}_probe_offline`);
        offline = table;
        const g = await req('/api/v1/cashbooks', token);
        check(g.status === 503 && g.body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE', `${table} missing → gated request 503`, g);
        const m = await req('/api/v1/entitlements/me', token);
        check(m.status === 503 && m.body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE', `${table} missing → /entitlements/me 503`, m);
        const o = await req('/api/v1/operations/orders', token);
        check(o.status === 200, `${table} missing → core orders route still 200`, o.status);
        await db.query(`ALTER TABLE ${table}_probe_offline RENAME TO ${table}`);
        offline = '';
      }

      // Audit table missing: an admin write must fail in a controlled way and
      // leave the role default unchanged (state change + audit are one transaction).
      const adminLogin = await req('/api/v1/auth/login', undefined, 'POST', { email: 'admin@choosify.com.bd', password: PASS_ });
      const adminToken = String(adminLogin.body.accessToken || '');
      check(Boolean(adminToken), 'super admin login on disposable DB', adminLogin.status);
      const beforeRow = await db.query("select enabled from feature_entitlements where scope='role' and scope_key='seller' and feature_key='reviews'");
      const before = beforeRow.rows[0]?.enabled !== false;
      await db.query('ALTER TABLE entitlement_audit_events RENAME TO entitlement_audit_events_probe_offline');
      offline = 'entitlement_audit_events';
      const w = await req('/api/v1/entitlements/admin/role-defaults/seller/reviews', adminToken, 'PATCH', { enabled: !before });
      check(w.status === 503 && w.body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE', 'audit table missing → admin write 503 (controlled)', w);
      const afterRow = await db.query("select enabled from feature_entitlements where scope='role' and scope_key='seller' and feature_key='reviews'");
      check((afterRow.rows[0]?.enabled !== false) === before, 'audit table missing → role default NOT changed (transaction rolled back)', afterRow.rows[0]);
      const seller2 = await req('/api/v1/cashbooks', token);
      check(seller2.status === 200, 'audit table missing → partner reads unaffected', seller2.status);
      await db.query('ALTER TABLE entitlement_audit_events_probe_offline RENAME TO entitlement_audit_events');
      offline = '';
      await new Promise((r) => setTimeout(r, 1000));
      check(child.exitCode === null && child.signalCode === null, 'API process still alive after 0011 table outages');
      check((await fetch(`${ROOT}/health`).then((r) => r.status).catch(() => 0)) === 200, '/health 200 after 0011 table outages');
    } else {
      console.log('(migration 0011 not applied on this database — Phase 2A table outage checks skipped)');
    }
    const unhandled = /unhandledrejection|UnhandledPromiseRejection/i.test(output);
    check(!unhandled, 'no unhandled rejection logged');
  } finally {
    if (renamed) await db.query('ALTER TABLE feature_entitlements_probe_offline RENAME TO feature_entitlements');
    if (offline) await db.query(`ALTER TABLE ${offline}_probe_offline RENAME TO ${offline}`);
    const t = await db.query(
      "select to_regclass('public.feature_entitlements') is not null as fe, to_regclass('public.account_entitlement_overrides') is not null as ov, to_regclass('public.platform_feature_states') is not null as pf, to_regclass('public.entitlement_audit_events') is not null as au",
    );
    console.log('tables restored:', JSON.stringify(t.rows[0]));
    await db.end();
    child.kill();
  }

  if (fails.length) {
    console.error(`\nFAIL probe-entitlement-crash-regression (${fails.length})`);
    process.exit(1);
  }
  console.log('\nPASS probe-entitlement-crash-regression');
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
