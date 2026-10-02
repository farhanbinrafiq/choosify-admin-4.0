/**
 * Public Identity — owner username set / change, Facebook-style
 * (PUT /public-handles/:type/:entityId/handle), live HTTP + database probe.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that
 * same database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost, with
 * migration 0013). Refuses otherwise; no override. Throwaway accounts and Brands
 * are deleted at the end; handle history stays (append-only, per-run names). A
 * temporary NOT VALID check constraint is used to inject a failure and is always
 * dropped again.
 *
 *   1  first username (Brand + Creator): active at once, no request, audit
 *      'assigned' by the owner, publicPath, catalog + resolve
 *   2  change (Brand + Creator): active at once, old one retired permanently
 *      (resolves as retired → current), audit 'renamed', no request
 *   3  same / taken (same + cross type) / retired / invalid / reserved /
 *      prefix / another profile's URL → refused, nothing written
 *   4  concurrency forced with the server's own advisory locks: two entities,
 *      one handle; one entity, two saves; unforced three-way race
 *   5  unauthenticated / non-owner / other type / staff / Super Admin /
 *      impersonated → refused, nothing written
 *   6  suspended / restricted Brand → refused; restored → works
 *   7  ownership transfer: username stays; old owner refused, new owner can change
 *   8  injected failure in the last statement → rolled back, old username active
 *   9  a legacy pending request is superseded; an admin-retired entity can set a
 *      new one; Super Admin assign / rename still work
 *  10  30-day change cooldown: initial not blocked, change before 30 days refused,
 *      after 30 days allowed, failed saves neither start nor extend it, Super
 *      Admin corrections exempt, concurrent changes cannot bypass it
 *  11  retired owner request routes answer 410; legacy records stay decidable
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-public-handle-owner-username.ts
 */
import argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OWNER_REASON = 'Set by the owner';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
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
async function apiLogin(email: string, password: string) {
  const r = await call('/auth/login', null, 'POST', { email, password });
  if (!r.body.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return String(r.body.accessToken);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
    console.error('REFUSING: PROBE_DISPOSABLE_DATABASE_URL is not local.');
    process.exit(2);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: PROBE_BASE_URL_ROOT is not a local server.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
  if (!(await q(`select to_regclass('public.public_handle_events') is not null as ok`))[0]?.ok) {
    console.error('REFUSING: migration 0013 is not applied to this database.');
    process.exit(2);
  }
  if (!(await q(`select id from users where email='admin@choosify.com.bd'`))[0]) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const sfx = Date.now().toString(36);
  const h = (b: string) => `${b}-${sfx}`;
  const pw = `PiOwner!${sfx}`;
  const hash = await argon2.hash(pw);
  const tempUsers: string[] = [];
  const mkUser = async (label: string, role: string) => {
    const email = `pio.${label}.${sfx}@probe.local`;
    const [row] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,$4,true) returning id`,
      [email, hash, `PIO ${label} ${sfx}`, role],
    );
    tempUsers.push(row.id);
    return { id: row.id, email };
  };
  const uSeller = await mkUser('seller', 'seller');
  const uSeller2 = await mkUser('seller2', 'seller');
  const uCreatorA = await mkUser('creatora', 'creator');
  const uCreatorB = await mkUser('creatorb', 'creator');
  const uAdmin = await mkUser('admin', 'admin');
  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const SELLER = await apiLogin(uSeller.email, pw);
  const SELLER2 = await apiLogin(uSeller2.email, pw);
  const CA = await apiLogin(uCreatorA.email, pw);
  const CB = await apiLogin(uCreatorB.email, pw);
  const ADMIN = await apiLogin(uAdmin.email, pw);

  const brandIds: string[] = [];
  const mkBrand = async (key: string, sellerId: string) => {
    const r = await call('/catalog/brands', SA, 'POST', { name: `PIO ${key.toUpperCase()} ${sfx}`, category: 'General', sellerId, marketplaceAccess: true, marketplaceStatus: 'granted' });
    if (r.status !== 201) throw new Error(`brand ${key}: ${JSON.stringify(r.body)}`);
    brandIds.push(r.body.data.id);
    return r.body.data as { id: string; name: string; slug: string };
  };
  const mkCreator = async (key: string, userId: string) => {
    const id = `creator-pioprobe-${key}-${sfx}`;
    const r = await call(`/catalog/creators/${id}`, SA, 'PUT', { name: `PIO Creator ${key} ${sfx}`, slug: `pio-${key}-${sfx}`, status: 'live', userId });
    if (r.status !== 200) throw new Error(`creator ${key}: ${JSON.stringify(r.body)}`);
    return id;
  };
  const B1 = await mkBrand('one', uSeller.id);
  const B2 = await mkBrand('two', uSeller.id);
  const B3 = await mkBrand('other', uSeller2.id);
  const B4 = await mkBrand('four', uSeller.id);
  const B5 = await mkBrand('five', uSeller.id);
  const B6 = await mkBrand('six', uSeller.id);
  const B7 = await mkBrand('seven', uSeller.id);
  const C1 = await mkCreator('one', uCreatorA.id);
  const C2 = await mkCreator('two', uCreatorB.id);
  const C3 = await mkCreator('three', uCreatorB.id);

  const put = (token: string | null, type: string, id: string, handle: unknown) => call(`/public-handles/${type}/${encodeURIComponent(id)}/handle`, token, 'PUT', { handle });
  const activeOf = async (type: string, id: string) =>
    (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;
  const rowsFor = async (type: string, id: string) => (await q<{ n: number }>(`select count(*)::int n from public_handles where entity_type=$1 and entity_id=$2`, [type, id]))[0].n;
  const activeCount = async (type: string, id: string) => (await q<{ n: number }>(`select count(*)::int n from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0].n;
  const rowsForHandle = async (handle: string) => (await q<{ n: number }>(`select count(*)::int n from public_handles where handle=$1`, [handle]))[0].n;
  const statusOfHandle = async (handle: string) => (await q<{ status: string }>(`select status from public_handles where handle=$1`, [handle]))[0]?.status ?? null;
  const requestsFor = async (type: string, id: string) => (await q<{ n: number }>(`select count(*)::int n from public_handle_requests where entity_type=$1 and entity_id=$2`, [type, id]))[0].n;
  const eventsFor = async (type: string, id: string) =>
    q<{ action: string; from_handle: string | null; to_handle: string; actor_user_id: string; real_actor_user_id: string | null; reason: string | null; request_id: string | null }>(
      `select action, from_handle, to_handle, actor_user_id, real_actor_user_id, reason, request_id from public_handle_events where entity_type=$1 and entity_id=$2 order by created_at`,
      [type, id],
    );
  const injected: string[] = [];
  /** A legacy pending request as the retired owner route wrote it (owner submit is disabled now). */
  const seedLegacyRequest = async (ownerUserId: string, type: string, id: string, handle: string) => {
    const [row] = await q<{ id: string }>(
      `insert into public_handle_requests (entity_type, entity_id, requested_handle, status, requested_by_user_id, created_at) values ($1,$2,$3,'pending',$4,clock_timestamp()) returning id`,
      [type, id, handle, ownerUserId],
    );
    await q(
      `insert into public_handle_events (action, entity_type, entity_id, to_handle, request_id, actor_user_id, created_at) values ('request_submitted',$1,$2,$3,$4,$5,clock_timestamp())`,
      [type, id, handle, row.id, ownerUserId],
    );
    return row.id;
  };
  /** Test-only: move this entity's owner-change events back in time (disposable database). */
  const ageOwnerChanges = (type: string, id: string, interval: string) =>
    q(`update public_handle_events set created_at = clock_timestamp() - $3::interval where entity_type=$1 and entity_id=$2 and action='renamed' and request_id is null and reason=$4`, [type, id, interval, OWNER_REASON]);
  const ownerState = async (token: string, type: string, id: string) => (await call(`/public-handles/${type}/${encodeURIComponent(id)}`, token)).body.data;

  try {
    // ── 1. First username ──
    const b1 = await put(SELLER, 'brand', B1.id, h('b1'));
    check(b1.status === 200 && b1.body.data?.handle?.handle === h('b1') && b1.body.data.previousHandle === null, '1 Brand first username → 200, no previous', b1.body);
    check(b1.body.data?.publicPath === `/brands/${h('b1')}`, '1 response carries the canonical public path', b1.body.data?.publicPath);
    check((await activeOf('brand', B1.id)) === h('b1') && (await requestsFor('brand', B1.id)) === 0, '1 active at once, no approval request');
    const e1 = await eventsFor('brand', B1.id);
    check(e1.length === 1 && e1[0].action === 'assigned' && e1[0].actor_user_id === uSeller.id && e1[0].real_actor_user_id === null && e1[0].reason === OWNER_REASON, '1 audit: assigned by the owner', e1);
    check((await call('/catalog/brands', null)).body.data?.find((b: any) => b.id === B1.id)?.publicHandle === h('b1'), '1 catalog shows it immediately');
    check((await call(`/catalog/handles/${h('b1')}/resolve`, null)).body.data?.entityId === B1.id, '1 public resolve finds the Brand');
    const c1 = await put(CA, 'creator', C1, h('c1'));
    check(c1.status === 200 && c1.body.data?.publicPath === `/creators/${h('c1')}` && (await activeOf('creator', C1)) === h('c1') && (await requestsFor('creator', C1)) === 0, '1 Creator first username → active at once', c1.body);
    check((await eventsFor('creator', C1))[0]?.actor_user_id === uCreatorA.id, '1 Creator audit by its owner');
    check((await activeOf('brand', B2.id)) === null, '1 the seller’s other Brand is unaffected');

    // ── 2. Change ──
    const b1c = await put(SELLER, 'brand', B1.id, h('b1new'));
    check(b1c.status === 200 && b1c.body.data?.previousHandle === h('b1') && b1c.body.data?.handle?.handle === h('b1new'), '2 Brand change → 200 with the previous username', b1c.body);
    check((await activeOf('brand', B1.id)) === h('b1new') && (await statusOfHandle(h('b1'))) === 'retired' && (await activeCount('brand', B1.id)) === 1, '2 new active, old retired, exactly one active');
    check((await requestsFor('brand', B1.id)) === 0, '2 no request / approval involved');
    const e2 = await eventsFor('brand', B1.id);
    check(e2.length === 2 && e2[1].action === 'renamed' && e2[1].from_handle === h('b1') && e2[1].to_handle === h('b1new') && e2[1].actor_user_id === uSeller.id, '2 audit: renamed old → new by the owner', e2);
    const rOld = await call(`/catalog/handles/${h('b1')}/resolve`, null);
    check(rOld.status === 200 && rOld.body.data?.status === 'retired' && rOld.body.data?.currentHandle === h('b1new'), '2 old username resolves as retired → new (C4 redirect)', rOld.body);
    check((await call('/catalog/brands', null)).body.data?.find((b: any) => b.id === B1.id)?.publicHandle === h('b1new'), '2 catalog / public URL use the new username');
    const c1c = await put(CA, 'creator', C1, h('c1new'));
    check(c1c.status === 200 && (await activeOf('creator', C1)) === h('c1new') && (await statusOfHandle(h('c1'))) === 'retired', '2 Creator change → old retired', c1c.body);
    check((await activeOf('brand', B1.id)) === h('b1new'), '2 Creator change did not affect any Brand');

    // ── 3. Refusals ──
    const same = await put(SELLER, 'brand', B1.id, h('b1new'));
    check(same.status === 409 && same.body.code === 'HANDLE_NO_CHANGE', '3 same username → 409 HANDLE_NO_CHANGE', same.body);
    const back = await put(SELLER, 'brand', B1.id, h('b1'));
    check(back.status === 409 && back.body.code === 'HANDLE_UNAVAILABLE', '3 its own retired username can never come back', back.body);
    check((await put(SELLER, 'brand', B2.id, h('b1'))).body.code === 'HANDLE_UNAVAILABLE', '3 a retired username is refused for everyone');
    check((await put(SELLER, 'brand', B2.id, h('b1new'))).body.code === 'HANDLE_UNAVAILABLE', '3 taken (Brand → Brand) refused');
    check((await put(CB, 'creator', C2, h('b1new'))).body.code === 'HANDLE_UNAVAILABLE', '3 taken across types (Creator → Brand’s) refused');
    for (const [input, reason] of [['ab', 'too_short'], ['admin', 'reserved'], ['brand-shop', 'reserved_prefix'], ['creator-x1', 'reserved_prefix'], ['my shop', 'invalid_characters'], ['ঢাকা', 'non_ascii'], ['a--b', 'consecutive_hyphens'], ['a'.repeat(31), 'too_long'], ['', 'empty']] as const) {
      const r = await put(SELLER, 'brand', B2.id, input);
      check(r.status === 400 && r.body.code === 'HANDLE_INVALID' && r.body.reason === reason, `3 ${JSON.stringify(input).slice(0, 14)} → ${reason}`, r.body);
    }
    const ns = await put(SELLER, 'brand', B2.id, B3.slug);
    check(ns.status === 409 && ns.body.code === 'HANDLE_NAMESPACE_CONFLICT', '3 another Brand’s slug (its live URL) refused', ns.body);
    check((await rowsFor('brand', B2.id)) === 0 && (await activeOf('brand', B1.id)) === h('b1new'), '3 refusals wrote nothing and changed nothing');

    // ── 4. Concurrency ──
    {
      const H = h('race1');
      const key = `public_handles:handle:${H}`;
      await q(`select pg_advisory_lock(hashtext($1))`, [key]);
      const pA = put(SELLER, 'brand', B2.id, H);
      const pB = put(CB, 'creator', C2, H);
      await sleep(1500);
      check((await rowsForHandle(H)) === 0, '4a both saves held at the handle lock (forced overlap)');
      await q(`select pg_advisory_unlock(hashtext($1))`, [key]);
      const [rA, rB] = await Promise.all([pA, pB]);
      const loser = [rA, rB].find((r) => r.status !== 200);
      check([rA, rB].filter((r) => r.status === 200).length === 1 && loser?.status === 409 && loser.body.code === 'HANDLE_UNAVAILABLE', '4a exactly one concurrent save wins; the other gets HANDLE_UNAVAILABLE', [rA.status, rB.status, loser?.body]);
      check((await rowsForHandle(H)) === 1, '4a exactly one row for the handle');
    }
    {
      const key = `public_handles:entity:brand:${B4.id}`;
      await q(`select pg_advisory_lock(hashtext($1))`, [key]);
      const p1 = put(SELLER, 'brand', B4.id, h('r2a'));
      const p2 = put(SELLER, 'brand', B4.id, h('r2b'));
      await sleep(1500);
      check((await rowsFor('brand', B4.id)) === 0, '4b both saves for one entity held at the entity lock');
      await q(`select pg_advisory_unlock(hashtext($1))`, [key]);
      const rs = await Promise.all([p1, p2]);
      check(rs.every((r) => r.status === 200), '4b serialized: both saves apply in turn (set, then change)', rs.map((r) => r.body));
      check((await activeCount('brand', B4.id)) === 1 && (await rowsFor('brand', B4.id)) === 2, '4b never two active usernames: one active, one retired');
    }
    {
      const H = h('race3');
      const rs = await Promise.all([put(SELLER, 'brand', B7.id, H), put(CB, 'creator', C3, H), put(SELLER, 'brand', B6.id, H)]);
      check(rs.filter((r) => r.status === 200).length === 1 && (await rowsForHandle(H)) === 1, '4c unforced three-way race: exactly one winner', rs.map((r) => r.status));
    }

    // ── 5. Authorization ──
    const target = (await activeOf('brand', B6.id)) === null ? B6 : B7;
    const before = await rowsFor('brand', target.id);
    check((await put(null, 'brand', target.id, h('anon'))).status === 401, '5 unauthenticated → 401');
    const other = await put(SELLER2, 'brand', target.id, h('steal'));
    check(other.status === 403 && other.body.code === 'HANDLE_FORBIDDEN', '5 another seller → 403', other.body);
    check((await put(CA, 'brand', target.id, h('steal2'))).status === 403, '5 a Creator owner cannot set a Brand’s username');
    check((await put(SELLER, 'creator', C2, h('steal3'))).status === 403, '5 a seller cannot set a Creator’s username');
    check((await put(ADMIN, 'brand', target.id, h('staff'))).status === 403, '5 staff (Admin) cannot use the owner route');
    check((await put(SA, 'brand', target.id, h('sa'))).status === 403, '5 Super Admin is not the owner (uses admin assign / rename)');
    check((await put(SELLER, 'brand', 'brand-does-not-exist', h('ghost'))).status === 403, '5 unknown profile → 403 (no probing)');
    const imp = await call('/auth/impersonate/start', SA, 'POST', { targetUserId: uSeller.id, reason: 'Public Identity owner username probe' });
    check(imp.status === 200 && imp.body.accessToken, '5 setup: Super Admin impersonates the seller', imp.body);
    const ir = await put(String(imp.body.accessToken), 'brand', target.id, h('imp'));
    check(ir.status === 403 && ir.body.code === 'HANDLE_IMPERSONATION_NOT_ALLOWED', '5 impersonated save → 403', ir.body);
    await call('/auth/impersonate/exit', String(imp.body.accessToken), 'POST', {}).catch(() => undefined);
    check((await rowsFor('brand', target.id)) === before, '5 refused saves wrote nothing');

    // ── 6. Suspended / restricted ──
    for (const status of ['suspended', 'restricted']) {
      check((await call(`/catalog/brands/${B5.id}/marketplace-access`, SA, 'PATCH', { status })).status === 200, `6 setup: Brand ${status}`);
      const r = await put(SELLER, 'brand', B5.id, h(`b5${status.slice(0, 3)}`));
      check(r.status === 403 && r.body.code === 'HANDLE_OWNER_SUSPENDED', `6 ${status} Brand cannot set a username`, r.body);
    }
    check((await rowsFor('brand', B5.id)) === 0, '6 nothing written while blocked');
    check((await call(`/catalog/brands/${B5.id}/marketplace-access`, SA, 'PATCH', { status: 'restored' })).status === 200, '6 setup: restored');
    check((await put(SELLER, 'brand', B5.id, h('b5ok'))).status === 200, '6 restored Brand can set it');

    // ── 7. Ownership transfer ──
    check((await call(`/catalog/brands/${B5.id}`, SA, 'PATCH', { sellerId: uSeller2.id })).status === 200, '7 setup: Brand five transferred to another seller');
    check((await activeOf('brand', B5.id)) === h('b5ok'), '7 the username stays with the Brand after transfer');
    const oldOwner = await put(SELLER, 'brand', B5.id, h('b5old'));
    check(oldOwner.status === 403 && oldOwner.body.code === 'HANDLE_FORBIDDEN', '7 former owner can no longer change it', oldOwner.body);
    const newOwner = await put(SELLER2, 'brand', B5.id, h('b5new'));
    check(newOwner.status === 200 && (await activeOf('brand', B5.id)) === h('b5new'), '7 new owner can change it', newOwner.body);

    // ── 8. Injected failure in the final statement ──
    {
      await ageOwnerChanges('brand', B1.id, '721 hours'); // the cooldown from section 2 is not what this section measures
      const beforeActive = await activeOf('brand', B1.id);
      const rowsBefore = await rowsFor('brand', B1.id);
      const eventsBefore = (await eventsFor('brand', B1.id)).length;
      const constraint = `probe_pio_inject_${sfx}`.replace(/[^a-z0-9_]/g, '_');
      await q(`alter table public_handle_events add constraint ${constraint} check (action <> 'renamed' or to_handle is distinct from '${h('inj')}') not valid`);
      injected.push(constraint);
      const r = await put(SELLER, 'brand', B1.id, h('inj'));
      check(r.status === 409 && r.body.code === 'HANDLE_CONFLICT', '8 failure in the audit insert → controlled 409', r.body);
      check(!JSON.stringify(r.body).match(/constraint|violat|insert|probe_pio/i), '8 database error not exposed', r.body);
      check((await activeOf('brand', B1.id)) === beforeActive && (await rowsForHandle(h('inj'))) === 0, '8 rolled back: old username still active, no new row');
      check((await rowsFor('brand', B1.id)) === rowsBefore && (await eventsFor('brand', B1.id)).length === eventsBefore, '8 no retire, no event kept');
      await q(`alter table public_handle_events drop constraint ${constraint}`);
      injected.pop();
      check((await put(SELLER, 'brand', B1.id, h('inj'))).status === 200, '8 after the fault is removed the same save works');
    }

    // ── 9. Legacy request, admin-retired entity, admin tools ──
    {
      const B8 = await mkBrand('eight', uSeller.id);
      const legacyId = await seedLegacyRequest(uSeller.id, 'brand', B8.id, h('b8req'));
      check((await put(SELLER, 'brand', B8.id, h('b8'))).status === 200, '9 direct save works with a request pending');
      const st = (await q<{ status: string }>(`select status from public_handle_requests where id=$1`, [legacyId]))[0]?.status;
      check(st === 'superseded', '9 the legacy request is closed as superseded', st);
      const B9 = await mkBrand('nine', uSeller.id);
      check((await call('/public-handles/admin/assign', SA, 'POST', { entityType: 'brand', entityId: B9.id, handle: h('b9a'), reason: 'Probe: admin assign' })).status === 200, '9 Super Admin assign still works');
      check((await call('/public-handles/admin/rename', SA, 'POST', { entityType: 'brand', entityId: B9.id, handle: h('b9b'), reason: 'Probe: admin rename' })).status === 200, '9 Super Admin rename still works');
      check((await call('/public-handles/admin/retire', SA, 'POST', { entityType: 'brand', entityId: B9.id, reason: 'Probe: admin retire' })).status === 200, '9 Super Admin retire still works');
      const after = await put(SELLER, 'brand', B9.id, h('b9c'));
      check(after.status === 200 && (await activeOf('brand', B9.id)) === h('b9c'), '9 after an admin retire the owner can set a new username', after.body);
      check((await statusOfHandle(h('b9a'))) === 'retired' && (await statusOfHandle(h('b9b'))) === 'retired', '9 admin-retired usernames stay retired');
      check((await call('/public-handles/admin/events?entityType=brand&entityId=' + encodeURIComponent(B1.id), SA)).body.data?.length >= 3, '9 Super Admin can still read the full history');
    }

    // ── 10. 30-day change cooldown (database clock; 720 h after the last owner change) ──
    {
      const ownerChangeEvents = async (id: string) =>
        (await q<{ n: number }>(`select count(*)::int n from public_handle_events where entity_type='brand' and entity_id=$1 and action='renamed' and request_id is null and reason=$2`, [id, OWNER_REASON]))[0].n;
      const B10 = await mkBrand('cooldown', uSeller.id);
      // a) first registration is never blocked
      check((await put(SELLER, 'brand', B10.id, h('cd1'))).status === 200, '10a initial username is not blocked');
      check((await ownerState(SELLER, 'brand', B10.id)).ownerChangeAvailableAt === null, '10a no cooldown after the initial registration');
      // b) the first change is allowed and starts the cooldown
      check((await put(SELLER, 'brand', B10.id, h('cd2'))).status === 200, '10b first change is allowed');
      const st = await ownerState(SELLER, 'brand', B10.id);
      const expected = (await q<{ ms: string }>(
        `select floor(extract(epoch from max(created_at) + interval '720 hours') * 1000)::bigint ms from public_handle_events where entity_type='brand' and entity_id=$1 and action='renamed' and request_id is null and reason=$2`,
        [B10.id, OWNER_REASON],
      ))[0].ms;
      check(st.ownerChangeAvailableAt && new Date(st.ownerChangeAvailableAt).getTime() === Number(expected), '10b next allowed change = last owner change + exactly 720 hours (server value)', { api: st.ownerChangeAvailableAt, db: new Date(Number(expected)).toISOString() });
      // c) a change before 30 days is rejected; nothing written
      const evBefore = (await eventsFor('brand', B10.id)).length;
      const early = await put(SELLER, 'brand', B10.id, h('cd3'));
      check(early.status === 409 && early.body.code === 'HANDLE_CHANGE_COOLDOWN' && early.body.nextChangeAt === st.ownerChangeAvailableAt, '10c change within 30 days → 409 HANDLE_CHANGE_COOLDOWN with the next allowed time', early.body);
      check((await activeOf('brand', B10.id)) === h('cd2') && (await rowsForHandle(h('cd3'))) === 0 && (await eventsFor('brand', B10.id)).length === evBefore, '10c nothing written; current username unchanged');
      // d) failed saves never extend the cooldown
      await put(SELLER, 'brand', B10.id, h('cd3'));
      await put(SELLER, 'brand', B10.id, 'admin');
      await put(SELLER, 'brand', B10.id, h('b1new'));
      check((await ownerState(SELLER, 'brand', B10.id)).ownerChangeAvailableAt === st.ownerChangeAvailableAt && (await eventsFor('brand', B10.id)).length === evBefore, '10d refused / invalid / unavailable saves do not extend the cooldown');
      // e) failed saves never START a cooldown
      const B11 = await mkBrand('cooldown-two', uSeller.id);
      check((await put(SELLER, 'brand', B11.id, h('ce1'))).status === 200, '10e setup: initial username');
      await put(SELLER, 'brand', B11.id, h('b1new')); // taken
      await put(SELLER, 'brand', B11.id, 'ab'); // invalid
      await put(SELLER, 'brand', B11.id, h('ce1')); // no change
      check((await ownerState(SELLER, 'brand', B11.id)).ownerChangeAvailableAt === null && (await ownerChangeEvents(B11.id)) === 0, '10e failed attempts did not start a cooldown');
      check((await put(SELLER, 'brand', B11.id, h('ce2'))).status === 200, '10e the first real change still works');
      // f) Super Admin corrections are exempt — not blocked, and they neither start nor extend the owner cooldown
      const saRename = await call('/public-handles/admin/rename', SA, 'POST', { entityType: 'brand', entityId: B10.id, handle: h('cdadm'), reason: 'Probe: admin correction during cooldown' });
      check(saRename.status === 200 && (await activeOf('brand', B10.id)) === h('cdadm'), '10f Super Admin rename works during the owner cooldown');
      check((await ownerState(SELLER, 'brand', B10.id)).ownerChangeAvailableAt === st.ownerChangeAvailableAt, '10f the admin rename did not change the owner cooldown');
      // The owner marker cannot be forged by an administrator (any case / spacing), so the cooldown never counts admin events.
      const evMark = (await eventsFor('brand', B10.id)).length;
      for (const forged of [OWNER_REASON, '  set by the OWNER ', 'Set  by  the  owner']) {
        const fr = await call('/public-handles/admin/rename', SA, 'POST', { entityType: 'brand', entityId: B10.id, handle: h('cdforge'), reason: forged });
        check(fr.status === 400 && fr.body.code === 'HANDLE_REASON_RESERVED', `10f admin reason ${JSON.stringify(forged)} → 400 HANDLE_REASON_RESERVED`, fr.body);
      }
      check((await call('/public-handles/admin/retire', SA, 'POST', { entityType: 'brand', entityId: B10.id, reason: OWNER_REASON })).body.code === 'HANDLE_REASON_RESERVED', '10f the marker is refused as a retire reason too');
      const forgedRid = await seedLegacyRequest(uSeller.id, 'brand', B10.id, h('cdlegacy'));
      check((await call(`/public-handles/admin/requests/${forgedRid}/approve`, SA, 'POST', { note: OWNER_REASON })).body.code === 'HANDLE_REASON_RESERVED', '10f …and as an approval note');
      check((await call(`/public-handles/admin/requests/${forgedRid}/reject`, SA, 'POST', { note: 'Probe: close' })).status === 200, '10f setup: legacy request closed');
      check((await eventsFor('brand', B10.id)).length === evMark + 2 && (await activeOf('brand', B10.id)) === h('cdadm'), '10f refused admin inputs wrote nothing (only the seeded request + its rejection)');
      // Classification: the cooldown predicate sees exactly the owner's changes.
      const cls = await q<{ action: string; actor_user_id: string; request_id: string | null; reason: string | null }>(
        `select action, actor_user_id, request_id, reason from public_handle_events where entity_type='brand' and entity_id=$1 and action in ('assigned','renamed') order by created_at`,
        [B10.id],
      );
      const counted = cls.filter((e) => e.action === 'renamed' && e.request_id === null && e.reason === OWNER_REASON);
      check(counted.length === 1 && counted.every((e) => e.actor_user_id === uSeller.id), '10f cooldown counts exactly the one owner change', cls);
      check(cls.some((e) => e.action === 'renamed' && e.actor_user_id !== uSeller.id && e.reason !== OWNER_REASON), '10f the Super Admin rename is recorded but not counted');
      const B12 = await mkBrand('cooldown-three', uSeller.id);
      check((await call('/public-handles/admin/assign', SA, 'POST', { entityType: 'brand', entityId: B12.id, handle: h('cf1'), reason: 'Probe: admin assign' })).status === 200, '10f setup: Super Admin assigns');
      check((await call('/public-handles/admin/rename', SA, 'POST', { entityType: 'brand', entityId: B12.id, handle: h('cf2'), reason: 'Probe: admin rename' })).status === 200, '10f setup: Super Admin renames');
      check((await ownerState(SELLER, 'brand', B12.id)).ownerChangeAvailableAt === null, '10f admin assign / rename start no owner cooldown');
      check((await put(SELLER, 'brand', B12.id, h('cf3'))).status === 200, '10f the owner can change right after an admin rename');
      // g) the 30-day boundary
      await ageOwnerChanges('brand', B10.id, '719 hours 59 minutes');
      check((await put(SELLER, 'brand', B10.id, h('cd4'))).body.code === 'HANDLE_CHANGE_COOLDOWN', '10g one minute before 30 days → still refused');
      await ageOwnerChanges('brand', B10.id, '720 hours 1 second');
      check((await ownerState(SELLER, 'brand', B10.id)).ownerChangeAvailableAt === null, '10g after 30 days no cooldown is reported');
      const late = await put(SELLER, 'brand', B10.id, h('cd4'));
      check(late.status === 200 && (await activeOf('brand', B10.id)) === h('cd4'), '10g after 30 days the change is allowed', late.body);
      check(Boolean((await ownerState(SELLER, 'brand', B10.id)).ownerChangeAvailableAt), '10g …and starts a new cooldown');
      // h) concurrent changes cannot bypass it
      const B13 = await mkBrand('cooldown-race', uSeller.id);
      check((await put(SELLER, 'brand', B13.id, h('cg0'))).status === 200, '10h setup: initial username');
      const key = `public_handles:entity:brand:${B13.id}`;
      await q(`select pg_advisory_lock(hashtext($1))`, [key]);
      const pa = put(SELLER, 'brand', B13.id, h('cga'));
      const pb = put(SELLER, 'brand', B13.id, h('cgb'));
      await sleep(1500);
      check((await ownerChangeEvents(B13.id)) === 0, '10h both changes held at the entity lock (forced overlap)');
      await q(`select pg_advisory_unlock(hashtext($1))`, [key]);
      const rs = await Promise.all([pa, pb]);
      const loser = rs.find((r) => r.status !== 200);
      check(rs.filter((r) => r.status === 200).length === 1 && loser?.body.code === 'HANDLE_CHANGE_COOLDOWN', '10h exactly one of two concurrent changes succeeds; the other hits the cooldown', rs.map((r) => r.body));
      check((await ownerChangeEvents(B13.id)) === 1 && (await activeCount('brand', B13.id)) === 1, '10h one owner change recorded, one active username');
    }

    // ── 11. Retired owner request routes ──
    {
      const B14 = await mkBrand('legacy', uSeller.id);
      const sub = await call(`/public-handles/brand/${B14.id}/requests`, SELLER, 'POST', { handle: h('lg1') });
      check(sub.status === 410 && sub.body.code === 'HANDLE_REQUESTS_DISABLED', '11 owner request submission → 410 HANDLE_REQUESTS_DISABLED', sub.body);
      check((await requestsFor('brand', B14.id)) === 0 && (await rowsFor('brand', B14.id)) === 0, '11 nothing written by the disabled route');
      const rid = await seedLegacyRequest(uSeller.id, 'brand', B14.id, h('lg2'));
      const can = await call(`/public-handles/requests/${rid}/cancel`, SELLER, 'POST', {});
      check(can.status === 410 && can.body.code === 'HANDLE_REQUESTS_DISABLED', '11 owner cancellation → 410', can.body);
      check((await q<{ status: string }>(`select status from public_handle_requests where id=$1`, [rid]))[0]?.status === 'pending', '11 the legacy record is untouched (still pending)');
      check((await call(`/public-handles/brand/${B14.id}/requests`, null, 'POST', { handle: h('lg3') })).status === 401, '11 unauthenticated → 401');
      const queue = await call(`/public-handles/admin/requests?status=pending&entityType=brand&entityId=${encodeURIComponent(B14.id)}`, ADMIN);
      check(queue.status === 200 && queue.body.data?.length === 1, '11 the Admin queue still lists the legacy record', queue.body);
      const rej = await call(`/public-handles/admin/requests/${rid}/reject`, SA, 'POST', { note: 'Probe: legacy request closed' });
      check(rej.status === 200 && rej.body.data?.status === 'rejected', '11 a Super Admin can still decide a legacy record', rej.body);
    }
  } finally {
    for (const c of injected) await db.query(`alter table public_handle_events drop constraint if exists ${c}`).catch(() => undefined);
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA, 'DELETE').catch(() => undefined);
    await q(`delete from users where id = any($1::uuid[])`, [tempUsers]).catch((e) => console.log('cleanup:', e.message));
    const left = (await q<{ n: number }>(`select count(*)::int n from users where id = any($1::uuid[])`, [tempUsers]))[0]?.n;
    check(left === 0, 'cleanup: temporary accounts deleted');
    await db.end();
  }

  console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-public-handle-owner-username (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
