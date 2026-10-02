/**
 * Public Identity Phase C2 — public handle lifecycle probe (live HTTP + database).
 *
 * Spawns its own API process against a DISPOSABLE LOCAL database and drives the
 * real routes: role boundaries, Super Admin vs Admin, impersonation, Brand /
 * Creator ownership (incl. a former owner after transfer), suspension rules,
 * legacy request decisions (owner submit / cancel now answer 410; legacy
 * requests are seeded in the database), owner direct saves, direct assignment / rename / retirement / reservation /
 * release, normalization and reserved rules, namespace conflicts, retired-handle
 * non-reuse, history, concurrency (forced overlap via database locks), rollback
 * after unique conflicts and an injected failure, the public routes, Brand
 * suspension re-checked at approval, and that public resolution hides
 * unpublished Brands / Creators.
 *
 * SAFETY
 *  - Runs ONLY when PROBE_DISPOSABLE_DATABASE_URL points at 127.0.0.1/localhost
 *    and the database already has migration 0013. There is no override flag.
 *  - Talks to Postgres only through its own client on that URL (never the app's
 *    db client, which reads .env). The spawned API gets the same URL.
 *  - Every file the API could write (*_SNAPSHOT_PATH, profile extras, id
 *    sequences) is redirected to a temp directory; the catalog is a temp copy of
 *    the local snapshot (or empty) plus per-run fixture Brands / Creators.
 *  - Handles, entity ids and accounts are unique per run; the probe's temporary
 *    accounts and partner application are deleted at the end. Handle history is
 *    left in the disposable database (retired handles can never be reused).
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-public-handle-lifecycle.ts
 *
 * Needs the seeded dev Super Admin (server/db/seedDevUsers.ts) in that database.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import pg from 'pg';

const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const PORT = Number(process.env.PROBE_PORT || 3094);
const API = `http://127.0.0.1:${PORT}/api/v1`;
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SUPER_ADMIN_EMAIL = 'admin@choosify.com.bd';

let passes = 0;
const fails: string[] = [];
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passes += 1;
    console.log('PASS', label);
    return;
  }
  fails.push(label);
  console.log('FAIL', label, JSON.stringify(detail ?? '').slice(0, 500));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Res = { status: number; body: Record<string, any>; headers: Headers };
const errorBodies: Array<{ label: string; body: Record<string, any> }> = [];
let requestCount = 0;
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  requestCount += 1;
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (r.status >= 400) errorBodies.push({ label: `${method} ${path}`, body: parsed });
  return { status: r.status, body: parsed, headers: r.headers };
}
const is = (r: Res, status: number, code?: string) => r.status === status && (!code || r.body.code === code);

function snapshotEnvNames(): string[] {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|dist/.test(e.name)) walk(p);
      } else if (/\.ts$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/process\.env\.(\w+SNAPSHOT_PATH)/g)) names.add(m[1]);
      }
    }
  };
  walk(join(process.cwd(), 'server'));
  walk(join(process.cwd(), 'lib'));
  return [...names];
}

async function waitForHealth(child: ChildProcess, output: () => string, ms = 180_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`API exited early:\n${output().slice(-2000)}`);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error('API did not become healthy');
}

async function main() {
  // ── Safety guards (no bypass) ──
  let url: URL;
  try {
    url = new URL(DB_URL);
  } catch {
    console.error('Refusing to run: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    console.error('Refusing to run: PROBE_DISPOSABLE_DATABASE_URL must point at 127.0.0.1 or localhost.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const lockConn = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await lockConn.connect();
  const q = async <T = Record<string, any>>(text: string, params: unknown[] = []) => (await db.query(text, params)).rows as T[];
  const hasLifecycle = await q(`select to_regclass('public.public_handle_requests') is not null as ok`);
  if (!hasLifecycle[0]?.ok) {
    console.error('Refusing to run: migration 0013 (public_handle_requests) is not applied to this database.');
    process.exit(2);
  }

  // ── Per-run fixtures ──
  const sfx = Date.now().toString(36);
  const h = (base: string) => `${base}-${sfx}`;
  const tempPassword = `HandleProbe!${sfx}`;
  const passwordHash = await argon2.hash(tempPassword);
  const mkUser = async (label: string, role: string) => {
    const email = `c2.${label}.${sfx}@probe.local`;
    const [row] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1, $2, $3, $4, true) returning id`,
      [email, passwordHash, `C2 Probe ${label}`, role],
    );
    return { id: row.id, email };
  };
  const tempUsers: string[] = [];
  const u = {
    admin: await mkUser('admin', 'admin'),
    sellerA: await mkUser('seller-a', 'seller'),
    sellerB: await mkUser('seller-b', 'seller'),
    sellerC: await mkUser('seller-c', 'seller'),
    applicant: await mkUser('applicant', 'seller'),
    creatorX: await mkUser('creator-x', 'creator'),
  };
  tempUsers.push(...Object.values(u).map((x) => x.id));
  const appId = `papp_c2probe_${sfx}`;
  await q(
    `insert into partner_applications (id, applicant_type, status, email, password_hash, display_name, phone, business_or_channel_name, category, city, existing_user_id)
     values ($1, 'seller', 'pending', $2, '[provisioned]', 'C2 Probe Applicant', '01700000000', 'C2 Probe Store', 'General', 'Dhaka', $3)`,
    [appId, u.applicant.email, u.applicant.id],
  );

  const now = new Date().toISOString();
  const brand = (key: string, sellerId: string | null, extra: Record<string, unknown> = {}) => ({
    id: `brand-c2probe-${sfx}-${key}`,
    slug: `c2b${key}-${sfx}`,
    name: `C2 Probe ${key.toUpperCase()} ${sfx}`,
    category: 'General',
    description: 'C2 probe fixture',
    logo: '',
    featuredFlag: false,
    sponsoredFlag: false,
    verifiedStatus: false,
    claimStatus: 'community',
    followers: 0,
    ratings: 0,
    ...(sellerId ? { sellerId } : {}),
    marketplaceAccess: true,
    marketplaceStatus: 'granted',
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  const creator = (key: string, userId: string | null, status: 'live' | 'archived' | 'draft') => ({
    id: `creator-c2probe-${sfx}-${key}`,
    slug: `c2c${key}-${sfx}`,
    name: `C2 Probe Creator ${key.toUpperCase()}`,
    handle: `@c2probe${key}`,
    avatar: '',
    score: 50,
    bestFor: 'Tech',
    bestForTags: [],
    platforms: [],
    bio: 'C2 probe fixture',
    followers: {},
    videos: [],
    reels: [],
    blogs: [],
    featuredFlag: false,
    verifiedStatus: false,
    status,
    ...(userId ? { userId } : {}),
    createdAt: now,
    updatedAt: now,
  });
  const B = {
    a: brand('a', u.sellerA.id),
    b: brand('b', u.sellerB.id),
    s: brand('s', u.sellerC.id, { marketplaceStatus: 'suspended', marketplaceAccess: false }),
    r: brand('r', u.sellerC.id, { marketplaceStatus: 'restricted', marketplaceAccess: false }),
    v: brand('v', u.sellerC.id, { marketplaceStatus: 'revoked', marketplaceAccess: false }),
    p: brand('p', u.applicant.id, { marketplaceStatus: 'not_granted', marketplaceAccess: false }),
    n: brand('n', null, { name: `C2 Nova ${sfx}` }),
    q1: brand('q1', u.sellerC.id),
    q2: brand('q2', u.sellerC.id),
    q3: brand('q3', u.sellerC.id),
    d: brand('d', u.sellerC.id, { marketplaceStatus: 'not_granted', marketplaceAccess: false }),
  };
  const C = {
    x: creator('x', u.creatorX.id, 'live'),
    z: creator('z', u.creatorX.id, 'archived'),
    y: creator('y', null, 'live'),
    w: creator('w', u.creatorX.id, 'draft'),
  };

  // ── Isolated API process ──
  const tmp = mkdtempSync(join(tmpdir(), 'handle-lifecycle-probe-'));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: DB_URL,
    PORT: String(PORT),
    NODE_ENV: 'development',
    CATALOG_USE_FIRESTORE: 'false',
    OPERATIONS_USE_FIRESTORE: 'false',
    AUTH_PROFILE_EXTRAS_PATH: join(tmp, 'auth-profile-extras.json'),
    CHOOSIFY_USER_ID_SEQUENCE_PATH: join(tmp, 'choosify-user-id-sequence.json'),
    CHOOSIFY_REFERENCE_ID_INDEX_PATH: join(tmp, 'reference-id-index.json'),
    CHOOSIFY_REFERENCE_ID_SEQUENCE_PATH: join(tmp, 'reference-id-sequences.json'),
  };
  for (const name of snapshotEnvNames()) env[name] = join(tmp, `${name.toLowerCase()}.json`);
  const catalogPath = join(tmp, 'catalog_memory_snapshot_path.json');
  const localCatalog = join(process.cwd(), '.data', 'catalog-memory-snapshot.json');
  let snapshot: Record<string, any>;
  if (existsSync(localCatalog)) {
    copyFileSync(localCatalog, catalogPath);
    snapshot = JSON.parse(readFileSync(catalogPath, 'utf8').replace(/^﻿/, ''));
  } else {
    snapshot = { version: 1, savedAt: now, products: [], categories: [], categoryAttributes: [], brands: [], deals: [], creators: [], guides: [], placements: [], productDetails: [], brandPosts: [], inventory: [], services: [], homepage: null, site: null };
  }
  snapshot.brands = [...(snapshot.brands || []), ...Object.values(B)];
  snapshot.creators = [...(snapshot.creators || []), ...Object.values(C)];
  writeFileSync(catalogPath, JSON.stringify(snapshot));
  env.CATALOG_MEMORY_SNAPSHOT_PATH = catalogPath;

  let output = '';
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d) => (output += String(d)));
  child.stderr?.on('data', (d) => (output += String(d)));
  const injected: string[] = [];

  try {
    await waitForHealth(child, () => output);
    const login = async (email: string, password: string) => {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const b = (await r.json()) as Record<string, any>;
      if (!b.accessToken) throw new Error(`login ${email} failed (${r.status})`);
      return { token: String(b.accessToken), uid: String(b.uid || '') };
    };
    const SA = await login(SUPER_ADMIN_EMAIL, DEV_PASSWORD);
    const ADMIN = await login(u.admin.email, tempPassword);
    const SELLER_A = await login(u.sellerA.email, tempPassword);
    const SELLER_B = await login(u.sellerB.email, tempPassword);
    const SELLER_C = await login(u.sellerC.email, tempPassword);
    const APPLICANT = await login(u.applicant.email, tempPassword);
    const CREATOR_X = await login(u.creatorX.email, tempPassword);
    check(SA.uid && ADMIN.uid && SELLER_A.uid === u.sellerA.id, 'setup: Super Admin, Admin and temporary owners signed in', { SA: SA.uid });

    const submit = (token: string | null, type: string, id: string, handle: unknown) =>
      call(`/public-handles/${type}/${encodeURIComponent(id)}/requests`, token, 'POST', { handle });
    const approve = (token: string | null, requestId: string, note?: string) =>
      call(`/public-handles/admin/requests/${requestId}/approve`, token, 'POST', note ? { note } : {});
    const reject = (token: string | null, requestId: string, note?: string) =>
      call(`/public-handles/admin/requests/${requestId}/reject`, token, 'POST', note === undefined ? {} : { note });
    const cancel = (token: string | null, requestId: string) => call(`/public-handles/requests/${requestId}/cancel`, token, 'POST', {});
    const put = (token: string | null, type: string, id: string, handle: unknown) =>
      call(`/public-handles/${type}/${encodeURIComponent(id)}/handle`, token, 'PUT', { handle });
    // Owner submit / cancel are retired (410). Legacy pending requests are seeded exactly as the
    // old route wrote them, so the Super Admin decision paths that still serve legacy records stay covered.
    const seed = async (ownerUserId: string, type: string, id: string, handle: string): Promise<Res> => {
      const [row] = await q<{ id: string; status: string; requested_handle: string }>(
        `insert into public_handle_requests (entity_type, entity_id, requested_handle, status, requested_by_user_id, created_at) values ($1,$2,$3,'pending',$4,clock_timestamp()) returning id, status, requested_handle`,
        [type, id, handle, ownerUserId],
      );
      await q(
        `insert into public_handle_events (action, entity_type, entity_id, to_handle, request_id, actor_user_id, created_at) values ('request_submitted',$1,$2,$3,$4,$5,clock_timestamp())`,
        [type, id, handle, row.id, ownerUserId],
      );
      return { status: 201, body: { success: true, data: { id: row.id, status: row.status, requestedHandle: row.requested_handle } }, headers: new Headers() };
    };
    const admin = (token: string | null, op: string, body: Record<string, unknown>) => call(`/public-handles/admin/${op}`, token, 'POST', body);
    const activeOf = async (type: string, id: string) =>
      (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;
    const requestRow = async (id: string) => (await q(`select * from public_handle_requests where id=$1`, [id]))[0];
    const eventsFor = async (type: string, id: string) =>
      q(`select action, from_handle, to_handle, actor_user_id, real_actor_user_id, request_id, reason from public_handle_events where entity_type=$1 and entity_id=$2 order by created_at, id`, [type, id]);
    const eventsForRequest = async (rid: string) => q(`select action from public_handle_events where request_id=$1 order by created_at, id`, [rid]);
    const rowsForHandle = async (handle: string) => q(`select status, entity_type, entity_id from public_handles where handle=$1`, [handle]);

    // ── 1. Authentication and role boundaries ──
    check(is(await put(null, 'brand', B.a.id, h('pa1')), 401), '1 owner username save requires sign-in (401)');
    check(is(await call('/public-handles/admin/requests', null), 401), '1 admin queue requires sign-in (401)');
    check(is(await call('/public-handles/admin/requests', SELLER_A.token), 403), '1 seller cannot read the admin queue (403)');
    check(is(await call('/public-handles/admin/requests', CREATOR_X.token), 403), '1 creator cannot read the admin queue (403)');
    check(is(await call('/public-handles/admin/requests?status=pending', ADMIN.token), 200), '1 Admin can read the request queue');
    check(is(await call('/public-handles/admin/events', ADMIN.token), 200), '1 Admin can read handle history');
    check(is(await call('/public-handles/admin/handles', ADMIN.token), 200), '1 Admin can read the handle list');
    {
      const rsvByAdmin = await admin(ADMIN.token, 'reserve', { handle: h('adm'), reason: 'probe' });
      check(rsvByAdmin.status === 403 && (await rowsForHandle(h('adm'))).length === 0, '1 Admin (not Super Admin) cannot reserve; nothing written', rsvByAdmin);
      const assignByAdmin = await admin(ADMIN.token, 'assign', { entityType: 'brand', entityId: B.n.id, handle: h('adm'), reason: 'probe' });
      check(assignByAdmin.status === 403 && (await activeOf('brand', B.n.id)) === null, '1 Admin cannot assign', assignByAdmin);
      check((await admin(SELLER_A.token, 'retire', { entityType: 'brand', entityId: B.a.id, reason: 'x' })).status === 403, '1 owner cannot use Super Admin retire');
    }
    check(is(await call('/public-handles/admin/requests?status=bogus', ADMIN.token), 400, 'HANDLE_INVALID_FILTER'), '1 invalid queue filter → 400');

    // ── 2. Validation and normalization ──
    for (const [input, reason] of [
      ['ab', 'too_short'],
      ['brand-apple', 'reserved_prefix'],
      [`creator-${sfx}`, 'reserved_prefix'],
      ['products', 'reserved'],
      ['café-x', 'non_ascii'],
      ['bad_name', 'invalid_characters'],
      ['', 'empty'],
    ] as const) {
      const r = await put(SELLER_A.token, 'brand', B.a.id, input);
      check(is(r, 400, 'HANDLE_INVALID') && r.body.reason === reason, `2 rejects ${JSON.stringify(input)} (${reason})`, r.body);
    }
    check(is(await put(SELLER_A.token, 'seller', B.a.id, h('x')), 400, 'HANDLE_INVALID_ENTITY_TYPE'), '2 entity type seller is refused');
    check(is(await put(SELLER_A.token, 'user', u.sellerA.id, h('x')), 400, 'HANDLE_INVALID_ENTITY_TYPE'), '2 entity type user is refused');
    check(is(await cancel(SELLER_A.token, 'not-a-uuid'), 410, 'HANDLE_REQUESTS_DISABLED'), '2 owner cancellation route is retired (410), whatever the id');

    // ── 3. Ownership ──
    check(is(await put(SELLER_B.token, 'brand', B.a.id, h('pa1')), 403, 'HANDLE_FORBIDDEN'), '3 another seller cannot set Brand A’s username');
    check(is(await put(CREATOR_X.token, 'brand', B.a.id, h('pa1')), 403, 'HANDLE_FORBIDDEN'), '3 a creator cannot set a Brand’s username');
    check(is(await put(SA.token, 'brand', B.a.id, h('pa1')), 403, 'HANDLE_FORBIDDEN'), '3 Super Admin is not an owner (uses assign instead)');
    check(is(await put(SELLER_A.token, 'creator', C.x.id, h('pa1')), 403, 'HANDLE_FORBIDDEN'), '3 a seller cannot set a Creator’s username');
    check(is(await put(SELLER_A.token, 'brand', `brand-c2probe-${sfx}-missing`, h('pa1')), 403, 'HANDLE_FORBIDDEN'), '3 unknown Brand is refused like a foreign one');
    check(is(await call(`/public-handles/brand/${B.b.id}`, SELLER_A.token), 403, 'HANDLE_FORBIDDEN'), '3 owner cannot read another Brand’s handle state');
    check(is(await call(`/public-handles/brand/${B.a.id}`, SELLER_A.token), 200), '3 owner reads own Brand handle state');
    check(is(await call(`/public-handles/brand/${B.a.id}`, ADMIN.token), 200), '3 Admin reads any Brand handle state');
    check((await q(`select ((select count(*) from public_handles where entity_id like $1) + (select count(*) from public_handle_events where entity_id like $1) + (select count(*) from public_handle_requests where entity_id like $1))::int n`, [`%c2probe-${sfx}%`]))[0].n === 0, '3 refused saves wrote nothing');

    // ── 4. Suspension and applicant rules ──
    for (const [key, status] of [['s', 'suspended'], ['r', 'restricted'], ['v', 'revoked']] as const) {
      const r = await put(SELLER_C.token, 'brand', B[key].id, h(`ps${key}`));
      check(is(r, 403, 'HANDLE_OWNER_SUSPENDED') && r.body.marketplaceStatus === status, `4 Brand with marketplaceStatus ${status} cannot set a username`, r.body);
    }
    const zPut = await put(CREATOR_X.token, 'creator', C.z.id, h('cz1'));
    check(is(zPut, 200) && (await activeOf('creator', C.z.id)) === h('cz1'), '4 voluntarily archived Creator may still set a username (archived is not a suspension)', zPut.body);
    {
      const gated = await call('/cashbooks', APPLICANT.token);
      check(gated.status === 403, '4 pending seller applicant is blocked by an operational marketplace route', { status: gated.status, code: gated.body.code });
      const pPut = await put(APPLICANT.token, 'brand', B.p.id, h('pp0'));
      check(is(pPut, 200) && (await activeOf('brand', B.p.id)) === h('pp0'), '4 pending seller applicant may set a username for its unpublished Brand', pPut.body);
      check(is(await call(`/catalog/handles/${h('pp0')}/resolve`, null), 404, 'HANDLE_NOT_FOUND'), '4 …but it stays hidden from public resolution while the Brand is unpublished');
      check(is(await admin(SA.token, 'retire', { entityType: 'brand', entityId: B.p.id, reason: 'probe: reset for section 9' }), 200), '4 setup: Super Admin retires it again (section 9 assigns this Brand)');
    }

    // ── 5. Legacy requests: owner submit / cancel retired; Super Admin decisions remain ──
    {
      const sub = await submit(SELLER_A.token, 'brand', B.a.id, h('pa1'));
      check(is(sub, 410, 'HANDLE_REQUESTS_DISABLED'), '5 owner request submission is retired (410)', sub.body);
      check((await q(`select count(*)::int n from public_handle_requests where entity_id=$1`, [B.a.id]))[0].n === 0, '5 the retired route wrote nothing');
    }
    const r1 = await seed(u.sellerA.id, 'brand', B.a.id, h('pa1'));
    const r1id = String(r1.body.data?.id);
    check(is(await cancel(SELLER_A.token, r1id), 410, 'HANDLE_REQUESTS_DISABLED') && (await requestRow(r1id)).status === 'pending', '5 owner cancellation is retired; the legacy request stays pending');
    const a2 = await approve(SA.token, r1id, 'Looks right');
    check(is(a2, 200) && a2.body.data.handle.handle === h('pa1') && a2.body.data.previousHandle === null, '5 Super Admin approves a legacy request → first active handle', a2.body);
    check((await activeOf('brand', B.a.id)) === h('pa1'), '5 Brand A active handle in the database');
    {
      const rr = await requestRow(r1id);
      check(rr.status === 'approved' && rr.decided_by_user_id === SA.uid && rr.decision_note === 'Looks right', '5 request approved with the deciding Super Admin', rr);
      const ev = await eventsForRequest(r1id);
      check(JSON.stringify(ev.map((e) => e.action)) === JSON.stringify(['request_submitted', 'request_approved', 'assigned']), '5 history: submitted → approved → assigned', ev);
    }
    check(is(await approve(SA.token, r1id), 409, 'HANDLE_REQUEST_NOT_PENDING'), '5 an approved request cannot be approved again');
    check(is(await reject(SA.token, r1id, 'late'), 409, 'HANDLE_REQUEST_NOT_PENDING'), '5 an approved request cannot be rejected');
    check(is(await put(SELLER_A.token, 'brand', B.a.id, `@${h('PA1').toUpperCase()}`), 409, 'HANDLE_NO_CHANGE'), '5 owner save normalizes (@, upper case) and recognises the current handle');
    const r3 = await seed(u.sellerA.id, 'brand', B.a.id, h('pa2'));
    const r3id = String(r3.body.data?.id);
    check(is(await reject(SA.token, r3id), 400, 'HANDLE_NOTE_REQUIRED'), '5 rejection requires a note');
    check(is(await reject(SA.token, r3id, '   '), 400, 'HANDLE_NOTE_REQUIRED'), '5 a blank note is not a note');
    const j3 = await reject(SA.token, r3id, 'Name belongs to another company');
    check(is(j3, 200) && j3.body.data.status === 'rejected', '5 Super Admin rejects with a note');
    check((await activeOf('brand', B.a.id)) === h('pa1'), '5 rejection leaves the active handle unchanged');
    {
      const ev = await eventsForRequest(r3id);
      check(ev.map((e) => e.action).join() === 'request_submitted,request_rejected', '5 history: submitted → rejected', ev);
    }
    const r4 = await seed(u.sellerA.id, 'brand', B.a.id, h('pa3'));
    const a4 = await approve(SA.token, String(r4.body.data?.id));
    check(is(a4, 200) && a4.body.data.previousHandle === h('pa1'), '5 approving a second legacy request renames', a4.body);
    {
      const rows = await rowsForHandle(h('pa1'));
      check(rows.length === 1 && rows[0].status === 'retired' && rows[0].entity_id === B.a.id, '5 the old handle is retired on the SAME row (never re-pointed)', rows);
      check((await activeOf('brand', B.a.id)) === h('pa3'), '5 the new handle is active');
    }

    // ── 6. Retired-handle non-reuse and the global namespace ──
    check(is(await put(SELLER_A.token, 'brand', B.a.id, h('pa1')), 409, 'HANDLE_UNAVAILABLE'), '6 an entity cannot reclaim its own retired handle');
    check(is(await put(CREATOR_X.token, 'creator', C.x.id, h('pa1')), 409, 'HANDLE_UNAVAILABLE'), '6 a Creator cannot take a retired Brand handle');
    check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.n.id, handle: h('pa1'), reason: 'probe' }), 409, 'HANDLE_UNAVAILABLE'), '6 Super Admin cannot assign a retired handle');
    check(is(await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.a.id, handle: h('pa1'), reason: 'probe' }), 409, 'HANDLE_UNAVAILABLE'), '6 Super Admin cannot rename back to a retired handle');
    const x1 = await seed(u.creatorX.id, 'creator', C.x.id, h('cx1'));
    check(is(await approve(SA.token, String(x1.body.data?.id)), 200) && (await activeOf('creator', C.x.id)) === h('cx1'), '6 Creator X gets an active handle');
    check(is(await put(SELLER_B.token, 'brand', B.b.id, h('cx1')), 409, 'HANDLE_UNAVAILABLE'), '6 a Brand cannot take an active Creator handle (one namespace)');
    check(is(await put(SELLER_B.token, 'brand', B.b.id, h('pa3')), 409, 'HANDLE_UNAVAILABLE'), '6 a Brand cannot take another Brand’s active handle');

    // ── 7. Catalog (namespace) conflicts ──
    {
      const slugB = await put(SELLER_A.token, 'brand', B.a.id, B.b.slug);
      check(is(slugB, 409, 'HANDLE_NAMESPACE_CONFLICT'), '7 another Brand’s slug is refused', slugB.body);
      const nova = await put(SELLER_A.token, 'brand', B.a.id, `c2-nova-${sfx}`);
      check(is(nova, 409, 'HANDLE_NAMESPACE_CONFLICT'), '7 another Brand’s name alias is refused', nova.body);
      const avOwn = await call(`/catalog/handles/availability?type=brand&entityId=${B.a.id}&handle=${B.a.slug}`, null);
      check(avOwn.body.data?.available === true, '7 an entity’s own slug is available to it', avOwn.body);
      const avOther = await call(`/catalog/handles/availability?type=brand&handle=${B.a.slug}`, null);
      check(avOther.body.data?.available === false && avOther.body.data?.reason === 'namespace_conflict', '7 the same slug is a conflict for anyone else', avOther.body);
      const crossType = await call(`/catalog/handles/availability?type=creator&handle=${B.b.slug}`, null);
      check(crossType.body.data?.available === true, '7 a Brand slug does not block a Creator handle (separate URL spaces)', crossType.body);
      const creatorSlug = await put(CREATOR_X.token, 'creator', C.x.id, C.y.slug);
      check(is(creatorSlug, 409, 'HANDLE_NAMESPACE_CONFLICT'), '7 another Creator’s slug is refused', creatorSlug.body);
    }

    // ── 8. Ownership transfer ──
    const r5 = await seed(u.sellerA.id, 'brand', B.a.id, h('pa4'));
    const r5id = String(r5.body.data?.id);
    check(is(r5, 201), '8 a legacy request by the former owner exists before the transfer');
    const transfer = await call(`/catalog/brands/${B.a.id}`, SA.token, 'PATCH', { sellerId: u.sellerB.id });
    check(transfer.status === 200 && transfer.body.data?.sellerId === u.sellerB.id, '8 Brand A transferred to seller B (catalog sellerId)', { status: transfer.status, sellerId: transfer.body.data?.sellerId });
    check((await activeOf('brand', B.a.id)) === h('pa3'), '8 transfer leaves the Brand handle unchanged');
    {
      const before = (await q(`select count(*)::int n from public_handles where entity_id=$1`, [B.a.id]))[0].n;
      const ap = await approve(SA.token, r5id);
      check(is(ap, 409, 'HANDLE_REQUESTER_NOT_OWNER'), '8 approving the former owner’s request → requester not owner', ap.body);
      const rr = await requestRow(r5id);
      check(rr.status === 'superseded' && rr.decided_by_user_id === SA.uid, '8 that request is closed as superseded', rr);
      const ev = await eventsForRequest(r5id);
      check(ev.map((e) => e.action).join() === 'request_submitted,request_superseded', '8 history: submitted → superseded (no success events)', ev);
      const after = (await q(`select count(*)::int n from public_handles where entity_id=$1`, [B.a.id]))[0].n;
      check(before === after && (await activeOf('brand', B.a.id)) === h('pa3'), '8 no handle row was written or retired', { before, after });
    }
    check(is(await put(SELLER_A.token, 'brand', B.a.id, h('pa5')), 403, 'HANDLE_FORBIDDEN'), '8 former owner can no longer set the username');
    check(is(await call(`/public-handles/brand/${B.a.id}`, SELLER_A.token), 403), '8 former owner can no longer read the Brand handle state');
    const r6 = await seed(u.sellerB.id, 'brand', B.a.id, h('pa5'));
    const a6 = await approve(SA.token, String(r6.body.data?.id));
    check(is(a6, 200) && (await activeOf('brand', B.a.id)) === h('pa5'), '8 a legacy request by the new owner is approved');

    // ── 9. Direct Super Admin operations ──
    await seed(u.applicant.id, 'brand', B.p.id, h('pp0x')); // a legacy pending request, superseded below
    check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.p.id, handle: h('pp1') }), 400, 'HANDLE_REASON_REQUIRED'), '9 direct actions require a reason');
    check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: `brand-c2probe-${sfx}-none`, handle: h('pp1'), reason: 'x' }), 404, 'HANDLE_ENTITY_NOT_FOUND'), '9 assign to an unknown Brand → 404');
    const pPending = (await q(`select id from public_handle_requests where entity_id=$1 and status='pending'`, [B.p.id]))[0]?.id;
    const as1 = await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.p.id, handle: h('pp1'), reason: 'Verified by phone' });
    check(is(as1, 200) && (await activeOf('brand', B.p.id)) === h('pp1'), '9 Super Admin assigns directly');
    check(pPending && (await requestRow(pPending)).status === 'superseded', '9 the owner’s pending request is superseded by the direct assignment');
    check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.p.id, handle: h('pp9'), reason: 'x' }), 409, 'HANDLE_ALREADY_ASSIGNED'), '9 assign refuses an entity that already has a handle');
    check(is(await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.n.id, handle: h('pn1'), reason: 'x' }), 404, 'HANDLE_NOT_ASSIGNED'), '9 rename refuses an entity without a handle');
    const rn = await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.p.id, handle: h('pp2'), reason: 'Rebrand' });
    check(is(rn, 200) && rn.body.data.previousHandle === h('pp1'), '9 Super Admin renames directly');
    check(is(await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.p.id, handle: h('pp2'), reason: 'x' }), 409, 'HANDLE_NO_CHANGE'), '9 rename to the current handle → no change');
    const rsv = await admin(SA.token, 'reserve', { handle: h('rsv'), reason: 'Held for verified claim' });
    check(is(rsv, 201) && rsv.body.data.status === 'reserved' && rsv.body.data.entityType === 'reserved', '9 Super Admin reserves a name', rsv.body);
    check(is(await admin(SA.token, 'reserve', { handle: h('rsv'), reason: 'x' }), 409, 'HANDLE_UNAVAILABLE'), '9 reserving twice → unavailable');
    check(is(await admin(SA.token, 'reserve', { handle: h('pa5'), reason: 'x' }), 409, 'HANDLE_UNAVAILABLE'), '9 an active handle cannot be reserved');
    {
      const ownerTry = await put(SELLER_B.token, 'brand', B.b.id, h('rsv'));
      check(is(ownerTry, 409, 'HANDLE_UNAVAILABLE'), '9 owners cannot take a reserved name');
      const noConvert = await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.p.id, handle: h('rsv'), reason: 'x' });
      check(is(noConvert, 409, 'HANDLE_UNAVAILABLE') && noConvert.body.reason === 'reserved', '9 Super Admin needs explicit conversion for a reserved name', noConvert.body);
      const rsvId = rsv.body.data.id;
      const conv = await admin(SA.token, 'rename', { entityType: 'brand', entityId: B.p.id, handle: h('rsv'), reason: 'Claim verified', convertReserved: true });
      check(is(conv, 200) && conv.body.data.handle.id === rsvId && (await activeOf('brand', B.p.id)) === h('rsv'), '9 explicit conversion turns the reserved row into the active handle', conv.body);
      const ev = await eventsFor('brand', B.p.id);
      const last = ev[ev.length - 1];
      check(last?.action === 'reserved_assigned' && last?.from_handle === h('pp2'), '9 history records reserved_assigned from the previous handle', last);
    }
    const rs2 = await admin(SA.token, 'reserve', { handle: h('rs2'), reason: 'Temporary hold' });
    check(is(rs2, 201), '9 reserve a second name');
    check(is(await admin(SA.token, 'release', { handle: h('pa5'), reason: 'x' }), 409, 'HANDLE_NOT_RESERVED'), '9 an active handle cannot be released');
    check(is(await admin(SA.token, 'release', { handle: h('pa1'), reason: 'x' }), 409, 'HANDLE_NOT_RESERVED'), '9 a retired handle cannot be released');
    check(is(await admin(SA.token, 'release', { handle: h('rs2'), reason: 'Hold no longer needed' }), 200) && (await rowsForHandle(h('rs2'))).length === 0, '9 Super Admin releases a reserved name');
    check(is(await admin(SA.token, 'release', { handle: h('rs2'), reason: 'x' }), 404, 'HANDLE_NOT_FOUND'), '9 releasing an unknown name → 404');
    {
      const ev = await q(`select action from public_handle_events where entity_type is null and (to_handle=$1 or from_handle=$1) order by created_at, id`, [h('rs2')]);
      check(ev.map((e) => e.action).join() === 'reserved,released', '9 bare-name history: reserved → released', ev);
      const free = await call(`/catalog/handles/availability?type=brand&entityId=${B.b.id}&handle=${h('rs2')}`, null);
      check(free.body.data?.available === true, '9 a released name is available again', free.body);
    }
    const rt = await admin(SA.token, 'retire', { entityType: 'brand', entityId: B.p.id, reason: 'Store closed' });
    check(is(rt, 200) && (await activeOf('brand', B.p.id)) === null && (await rowsForHandle(h('rsv')))[0]?.status === 'retired', '9 Super Admin retires; the entity has no handle');
    check(is(await admin(SA.token, 'retire', { entityType: 'brand', entityId: B.p.id, reason: 'x' }), 404, 'HANDLE_NOT_ASSIGNED'), '9 retiring twice → not assigned');
    check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.n.id, handle: h('rsv'), reason: 'x', convertReserved: true }), 409, 'HANDLE_UNAVAILABLE'), '9 a retired (formerly reserved) name can never be issued again');

    // ── 10. Impersonation ──
    const imp = await call('/auth/impersonate/start', SA.token, 'POST', { targetUserId: u.sellerB.id, reason: 'C2 handle probe' });
    check(is(imp, 200) && imp.body.accessToken, '10 Super Admin starts impersonating seller B', imp.body);
    const IMP = String(imp.body.accessToken || '');
    check(is(await admin(IMP, 'reserve', { handle: h('imp'), reason: 'x' }), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 reserve refused while impersonating');
    check(is(await admin(IMP, 'assign', { entityType: 'brand', entityId: B.n.id, handle: h('imp'), reason: 'x' }), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 assign refused while impersonating');
    {
      // Owner mutations are refused while impersonating too; nothing may be written.
      const counts = async () =>
        JSON.stringify(
          (
            await q(
              `select (select count(*) from public_handle_requests where entity_id=$1)::int r,
                      (select count(*) from public_handle_events where entity_id=$1)::int e,
                      (select count(*) from public_handles where entity_id=$1)::int h`,
              [B.a.id],
            )
          )[0],
        );
      const before = await counts();
      const impReq = await put(IMP, 'brand', B.a.id, h('pa6'));
      check(is(impReq, 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 owner username save refused while impersonating', impReq.body);
      check((await counts()) === before, '10 the refused save wrote no request, event or handle row', { before, after: await counts() });
      const own = await seed(u.sellerB.id, 'brand', B.a.id, h('pa6'));
      check(is(own, 201), '10 setup: a legacy pending request by the real owner', own.body);
      const rid = String(own.body.data?.id);
      const mid = await counts();
      const impCancel = await cancel(IMP, rid);
      check(is(impCancel, 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 owner cancellation refused while impersonating', impCancel.body);
      check((await requestRow(rid)).status === 'pending' && (await counts()) === mid, '10 the refused cancellation changed nothing (still pending, no event)');
      check(is(await approve(IMP, rid), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 approve refused while impersonating');
      check(is(await reject(IMP, rid, 'x'), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 reject refused while impersonating');
      check(is(await admin(IMP, 'rename', { entityType: 'brand', entityId: B.a.id, handle: h('imp'), reason: 'x' }), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 rename refused while impersonating');
      check(is(await admin(IMP, 'retire', { entityType: 'brand', entityId: B.a.id, reason: 'x' }), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 retire refused while impersonating');
      check(is(await admin(IMP, 'release', { handle: h('late'), reason: 'x' }), 403, 'HANDLE_IMPERSONATION_NOT_ALLOWED'), '10 release refused while impersonating');
      check((await requestRow(rid)).status === 'pending' && (await counts()) === mid, '10 the refused Super Admin actions changed nothing');
      check(is(await call(`/public-handles/brand/${B.a.id}`, IMP), 200), '10 read-only owner state stays available while impersonating');
      check(is(await cancel(SELLER_B.token, rid), 410, 'HANDLE_REQUESTS_DISABLED'), '10 the real owner gets the retired-route answer (410), not a cancellation');
      check(is(await reject(SA.token, rid, 'Probe: close legacy request'), 200), '10 a Super Admin closes the legacy request');
      const impEvents = await q(`select count(*)::int n from public_handle_events where real_actor_user_id is not null and (entity_id like $1 or to_handle like $2)`, [`%c2probe-${sfx}%`, `%-${sfx}`]);
      check(impEvents[0].n === 0, '10 no handle event of this run came from an impersonated session');
      const impRequests = await q(`select count(*)::int n from public_handle_requests where requested_real_actor_user_id is not null and entity_id like $1`, [`%c2probe-${sfx}%`]);
      check(impRequests[0].n === 0, '10 no request of this run came from an impersonated session');
    }
    check(is(await call('/public-handles/admin/requests', IMP), 403), '10 the impersonated session cannot read admin queues');

    // ── 11. Concurrency (overlap forced with database locks) ──
    const waiters = async (n: number) => {
      for (let i = 0; i < 80; i++) {
        const [{ c }] = (await lockConn.query(`select count(*)::int c from pg_locks where not granted`)).rows;
        if (c >= n) return true;
        await sleep(100);
      }
      return false;
    };
    // 11a (two simultaneous owner submissions) went with the retired request route; concurrent owner
    // saves are covered by probe-public-handle-owner-username (4a–4c, 10h).
    const lockRequest = async (rid: string) => lockConn.query(`select pg_advisory_lock(hashtext($1))`, [`public_handles:request:${rid}`]);
    const unlockRequest = async (rid: string) => lockConn.query(`select pg_advisory_unlock(hashtext($1))`, [`public_handles:request:${rid}`]);
    {
      // 11b. Two reviewers approve the same request at once.
      const req = await seed(u.creatorX.id, 'creator', C.x.id, h('cx2'));
      const rid = String(req.body.data?.id);
      await lockRequest(rid);
      const both = Promise.all([approve(SA.token, rid), approve(SA.token, rid)]);
      const overlapped = await waiters(2);
      await unlockRequest(rid);
      const res = await both;
      check(overlapped, '11b both approvals were waiting on the request at the same time');
      const codes = res.map((r) => `${r.status}:${r.body.code ?? ''}`).sort();
      check(codes.join() === '200:,409:HANDLE_REQUEST_NOT_PENDING', '11b exactly one approval succeeds', codes);
      const ev = await eventsForRequest(rid);
      check(ev.map((e) => e.action).join() === 'request_submitted,request_approved,renamed', '11b one decision in history (no duplicate events)', ev);
      check((await activeOf('creator', C.x.id)) === h('cx2'), '11b one rename applied');
    }
    {
      // 11c. Approve and reject race for the same request.
      const req = await seed(u.creatorX.id, 'creator', C.x.id, h('cx3'));
      const rid = String(req.body.data?.id);
      await lockRequest(rid);
      const both = Promise.all([approve(SA.token, rid), reject(SA.token, rid, 'Declined in race')]);
      const overlapped = await waiters(2);
      await unlockRequest(rid);
      const [ap, rj] = await both;
      check(overlapped, '11c approve and reject were waiting at the same time');
      const winners = [ap, rj].filter((r) => r.status === 200).length;
      const loser = [ap, rj].find((r) => r.status !== 200);
      check(winners === 1 && loser?.body.code === 'HANDLE_REQUEST_NOT_PENDING', '11c exactly one decision wins', [ap.status, rj.status, loser?.body.code]);
      const rr = await requestRow(rid);
      const ev = (await eventsForRequest(rid)).map((e) => e.action);
      const decided = ev.filter((a) => a === 'request_approved' || a === 'request_rejected');
      check(decided.length === 1 && (rr.status === 'approved') === (ap.status === 200), '11c the stored status matches the single winning decision', { status: rr.status, ev });
      if (rr.status === 'approved') check((await activeOf('creator', C.x.id)) === h('cx3'), '11c approval won: rename applied');
      else check((await activeOf('creator', C.x.id)) === h('cx2'), '11c rejection won: handle unchanged');
    }
    {
      // 11d. Two different requests compete for the same handle (both renames).
      await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.b.id, handle: h('pb1'), reason: 'probe baseline' });
      const xBefore = await activeOf('creator', C.x.id);
      const qb = await seed(u.sellerB.id, 'brand', B.b.id, h('race'));
      const qx = await seed(u.creatorX.id, 'creator', C.x.id, h('race'));
      check(is(qb, 201) && is(qx, 201), '11d two legacy requests for the same handle (pending holds nothing)');
      const [bid, xid] = [String(qb.body.data?.id), String(qx.body.data?.id)];
      await lockConn.query('begin');
      await lockConn.query('lock table public_handles in exclusive mode');
      const both = Promise.all([approve(SA.token, bid), approve(SA.token, xid)]);
      const overlapped = await waiters(2);
      await lockConn.query('commit');
      const [ab, ax] = await both;
      check(overlapped, '11d both approvals were in flight at the same time');
      const codes = [ab, ax].map((r) => `${r.status}:${r.body.code ?? ''}`).sort();
      check(codes.join() === '200:,409:HANDLE_UNAVAILABLE', '11d exactly one wins; the other gets HANDLE_UNAVAILABLE', codes);
      const winnerIsBrand = ab.status === 200;
      const loserType = winnerIsBrand ? 'creator' : 'brand';
      const loserId = winnerIsBrand ? C.x.id : B.b.id;
      const loserReq = winnerIsBrand ? xid : bid;
      const loserBefore = winnerIsBrand ? xBefore : h('pb1');
      check((await activeOf(loserType, loserId)) === loserBefore, '11d the loser’s previous handle is still active (its retire was rolled back)');
      check((await requestRow(loserReq)).status === 'pending', '11d the losing request stays pending');
      check((await eventsForRequest(loserReq)).map((e) => e.action).join() === 'request_submitted', '11d no success events for the loser');
      const raceRows = await rowsForHandle(h('race'));
      check(raceRows.length === 1 && raceRows[0].status === 'active' && raceRows[0].entity_id === (winnerIsBrand ? B.b.id : C.x.id), '11d exactly one holder of the handle', raceRows);
      check(is(await reject(SA.token, loserReq, 'Handle taken'), 200), '11d the losing request can still be decided normally');
    }
    {
      // 11e. Injected failure at the last statement of an approval.
      const before = await activeOf('brand', B.a.id);
      const req = await seed(u.sellerB.id, 'brand', B.a.id, h('inj'));
      const rid = String(req.body.data?.id);
      const handlesBefore = (await q(`select count(*)::int n from public_handles where entity_id=$1`, [B.a.id]))[0].n;
      const constraint = `probe_c2_inject_${sfx}`.replace(/[^a-z0-9_]/g, '_');
      await q(`alter table public_handle_events add constraint ${constraint} check (action <> 'renamed' or to_handle is distinct from '${h('inj')}') not valid`);
      injected.push(constraint);
      const ap = await approve(SA.token, rid);
      check(ap.status === 409 && ap.body.code === 'HANDLE_CONFLICT', '11e a failure in the final history insert fails the approval (controlled 409)', ap.body);
      check(!JSON.stringify(ap.body).match(/constraint|violat|select|insert|probe_c2/i), '11e the database error is not exposed to the client', ap.body);
      check((await activeOf('brand', B.a.id)) === before, '11e the previous handle is still active (retire rolled back)');
      check((await rowsForHandle(h('inj'))).length === 0, '11e no replacement handle row exists');
      check((await requestRow(rid)).status === 'pending', '11e the request is still pending');
      check((await eventsForRequest(rid)).map((e) => e.action).join() === 'request_submitted', '11e no success events were kept (request_approved rolled back too)');
      check((await q(`select count(*)::int n from public_handles where entity_id=$1`, [B.a.id]))[0].n === handlesBefore, '11e handle row count unchanged');
      await q(`alter table public_handle_events drop constraint ${constraint}`);
      injected.pop();
      check(is(await approve(SA.token, rid), 200) && (await activeOf('brand', B.a.id)) === h('inj'), '11e after the fault is removed the same request approves normally');
    }
    {
      // 11f. A conflict discovered at approval time leaves the request pending.
      const req = await seed(u.creatorX.id, 'creator', C.x.id, h('late'));
      check(is(req, 201), '11f a legacy request for a free handle', req.body);
      const rid = String(req.body.data?.id);
      await admin(SA.token, 'reserve', { handle: h('late'), reason: 'Taken meanwhile' });
      const ap = await approve(SA.token, rid);
      check(is(ap, 409, 'HANDLE_UNAVAILABLE'), '11f approval refused when the handle was taken meanwhile', ap.body);
      check((await requestRow(rid)).status === 'pending', '11f the request stays pending for a decision');
      check((await eventsForRequest(rid)).map((e) => e.action).join() === 'request_submitted', '11f no events beyond the submission');
      await reject(SA.token, rid, 'Name was reserved');
    }

    // ── 12. History correctness ──
    {
      const ev = await eventsFor('brand', B.a.id);
      const handleEvents = ev.filter((e) => ['assigned', 'renamed', 'retired', 'reserved_assigned'].includes(e.action)).map((e) => `${e.action}:${e.from_handle ?? '-'}>${e.to_handle ?? '-'}`);
      check(
        JSON.stringify(handleEvents) ===
          JSON.stringify([`assigned:->${h('pa1')}`, `renamed:${h('pa1')}>${h('pa3')}`, `renamed:${h('pa3')}>${h('pa5')}`, `renamed:${h('pa5')}>${h('inj')}`]),
        '12 Brand A handle history is complete and ordered',
        handleEvents,
      );
      const byActor = ev.filter((e) => e.action === 'assigned' || e.action === 'renamed').every((e) => e.actor_user_id === SA.uid && e.real_actor_user_id === null);
      check(byActor, '12 handle changes are attributed to the approving Super Admin');
      const submitted = ev.filter((e) => e.action === 'request_submitted');
      check(submitted.every((e) => e.actor_user_id === u.sellerA.id || e.actor_user_id === u.sellerB.id), '12 submissions are attributed to the owner who made them');
      const apiEvents = await call(`/public-handles/admin/events?entityType=brand&entityId=${B.a.id}&limit=200`, ADMIN.token);
      check(is(apiEvents, 200) && apiEvents.body.data.length === ev.length, '12 the Admin history API returns the same events', { api: apiEvents.body.data?.length, db: ev.length });
      const state = await call(`/public-handles/brand/${B.a.id}`, SELLER_B.token);
      check(
        is(state, 200) && state.body.data.activeHandle?.handle === h('inj') && state.body.data.handles.length === 4 && state.body.data.events.length === ev.length,
        '12 the owner state shows the active handle, all 4 handle rows and the full history',
        { active: state.body.data?.activeHandle?.handle, handles: state.body.data?.handles?.length },
      );
      const src = readFileSync(join(process.cwd(), 'server', 'publicHandles', 'publicHandleStore.ts'), 'utf8');
      check(!/\.update\(publicHandleEvents\)|\.delete\(publicHandleEvents\)/.test(src), '12 the store has no update or delete path for history events (append-only by code)');
      const orphanEvents = await q(`select count(*)::int n from public_handle_events where entity_id like $1 and action not in ('assigned','renamed','retired','reserved_assigned','request_submitted','request_approved','request_rejected','request_cancelled','request_superseded')`, [`%c2probe-${sfx}%`]);
      check(orphanEvents[0].n === 0, '12 entity events use only entity actions');
    }

    // ── 13. Public routes ──
    {
      const res = await call(`/catalog/handles/${h('inj')}/resolve`, null);
      check(is(res, 200) && res.body.data.status === 'active' && res.body.data.entityId === B.a.id && res.body.data.entityType === 'brand', '13 resolve: active handle → entity', res.body);
      check(Boolean(res.headers.get('ratelimit-limit') || res.headers.get('ratelimit-policy') || res.headers.get('ratelimit')), '13 public resolve carries rate-limit headers (existing middleware)');
      const old = await call(`/catalog/handles/${h('pa1')}/resolve`, null);
      check(is(old, 200) && old.body.data.status === 'retired' && old.body.data.currentHandle === h('inj'), '13 resolve: retired handle → current handle of the same entity', old.body);
      check(is(await call(`/catalog/handles/${h('late')}/resolve`, null), 404, 'HANDLE_NOT_FOUND'), '13 resolve: reserved name → 404');
      check(is(await call(`/catalog/handles/${h('inj')}/resolve?type=creator`, null), 404, 'HANDLE_NOT_FOUND'), '13 resolve: wrong type → 404');
      check(is(await call(`/catalog/handles/${h('inj')}/resolve?type=seller`, null), 400, 'HANDLE_INVALID_ENTITY_TYPE'), '13 resolve: invalid type → 400');
      check(is(await call(`/catalog/handles/${h('zzz')}/resolve`, null), 404, 'HANDLE_NOT_FOUND'), '13 resolve: unknown handle → 404');
      check(is(await call(`/catalog/handles/products/resolve`, null), 404, 'HANDLE_NOT_FOUND'), '13 resolve: reserved word → 404');
      check(is(await call(`/catalog/handles/a_b/resolve`, null), 400, 'HANDLE_INVALID'), '13 resolve: malformed input → 400');
      const upper = await call(`/catalog/handles/${encodeURIComponent('@' + h('INJ').toUpperCase())}/resolve`, null);
      check(is(upper, 200) && upper.body.data.handle === h('inj'), '13 resolve normalizes @ and case', upper.body);

      const free = await call(`/catalog/handles/availability?type=brand&handle=${h('free')}`, null);
      check(is(free, 200) && free.body.data.available === true && free.body.data.handle === h('free'), '13 availability: free handle', free.body);
      check(Boolean(free.headers.get('ratelimit-limit') || free.headers.get('ratelimit-policy') || free.headers.get('ratelimit')), '13 availability carries rate-limit headers');
      const taken = await call(`/catalog/handles/availability?type=creator&handle=${h('inj')}`, null);
      check(taken.body.data?.available === false && taken.body.data?.reason === 'unavailable', '13 availability (public): taken → generic "unavailable"', taken.body);
      const retiredPub = await call(`/catalog/handles/availability?type=brand&handle=${h('pa1')}`, null);
      check(retiredPub.body.data?.reason === 'unavailable', '13 availability (public): retired → generic "unavailable"', retiredPub.body);
      const detail = await Promise.all([
        call(`/catalog/handles/availability?type=creator&handle=${h('inj')}`, ADMIN.token),
        call(`/catalog/handles/availability?type=brand&handle=${h('pa1')}`, ADMIN.token),
        call(`/catalog/handles/availability?type=brand&handle=${h('late')}`, SA.token),
      ]);
      check(detail.map((d) => d.body.data?.reason).join() === 'taken,retired,reserved', '13 availability (Admin): taken / retired / reserved detail', detail.map((d) => d.body.data));
      const current = await call(`/catalog/handles/availability?type=brand&entityId=${B.a.id}&handle=${h('inj')}`, SELLER_B.token);
      check(current.body.data?.reason === 'current_handle', '13 availability: the entity’s own current handle', current.body);
      const invalid = await call(`/catalog/handles/availability?type=brand&handle=brand-x`, null);
      check(invalid.body.data?.available === false && invalid.body.data?.reason === 'reserved_prefix', '13 availability: validator reason passed through', invalid.body);
      check(is(await call(`/catalog/handles/availability?handle=${h('x')}`, null), 400, 'HANDLE_INVALID_ENTITY_TYPE'), '13 availability: type is required');
      check(is(await call(`/catalog/handles/availability?type=brand`, null), 400, 'HANDLE_INVALID'), '13 availability: handle is required');
      const long = await call(`/catalog/handles/availability?type=brand&handle=${'a'.repeat(500)}`, null);
      check(long.body.data?.available === false && long.body.data?.reason === 'too_long', '13 availability: oversized input is rejected cheaply');
    }

    // ── 15. Brand suspension is re-checked at approval time ──
    {
      const pendingBy: Record<string, string> = {};
      for (const [key, status] of [['q1', 'suspended'], ['q2', 'revoked'], ['q3', 'restricted']] as const) {
        const id = B[key].id;
        const base = await admin(SA.token, 'assign', { entityType: 'brand', entityId: id, handle: h(`${key}a`), reason: 'probe baseline' });
        const req = await seed(u.sellerC.id, 'brand', id, h(`${key}b`));
        check(is(base, 200) && is(req, 201), `15 ${status}: Brand active at submission (has a handle; request accepted)`, req.body);
        const rid = String(req.body.data?.id);
        pendingBy[key] = rid;
        const ma = await call(`/catalog/brands/${id}/marketplace-access`, SA.token, 'PATCH', { status });
        check(ma.status === 200, `15 ${status}: marketplace status changed before approval`, ma.body);
        const rowsBefore = (await q(`select count(*)::int n from public_handles where entity_id=$1`, [id]))[0].n;
        const ap = await approve(SA.token, rid);
        check(is(ap, 409, 'HANDLE_OWNER_SUSPENDED') && ap.body.marketplaceStatus === status, `15 ${status}: approval refused (HANDLE_OWNER_SUSPENDED)`, ap.body);
        const rowsAfter = (await q(`select count(*)::int n from public_handles where entity_id=$1`, [id]))[0].n;
        check(
          (await activeOf('brand', id)) === h(`${key}a`) && rowsAfter === rowsBefore && (await rowsForHandle(h(`${key}b`))).length === 0,
          `15 ${status}: existing handle still active; no replacement row`,
          { rowsBefore, rowsAfter },
        );
        check(
          (await requestRow(rid)).status === 'pending' && (await eventsForRequest(rid)).map((e) => e.action).join() === 'request_submitted',
          `15 ${status}: request still pending; no approval or assignment events`,
        );
      }
      const restored = await call(`/catalog/brands/${B.q1.id}/marketplace-access`, SA.token, 'PATCH', { status: 'restored' });
      check(restored.status === 200, '15 suspended Brand restored');
      const ap = await approve(SA.token, pendingBy.q1);
      check(is(ap, 200) && (await activeOf('brand', B.q1.id)) === h('q1b'), '15 once restored, the same pending request approves', ap.body);
      check((await eventsForRequest(pendingBy.q1)).map((e) => e.action).join() === 'request_submitted,request_approved,renamed', '15 restored approval history: submitted → approved → renamed');
      const activeReq = await seed(u.sellerB.id, 'brand', B.b.id, h('pb2'));
      const activeAp = await approve(SA.token, String(activeReq.body.data?.id));
      check(is(activeAp, 200) && (await activeOf('brand', B.b.id)) === h('pb2'), '15 an active (granted) Brand approves normally', activeAp.body);
      await reject(SA.token, pendingBy.q2, 'Brand revoked');
      await reject(SA.token, pendingBy.q3, 'Brand restricted');
    }

    // ── 16. Public resolution hides unpublished Brands and Creators ──
    {
      const unknown = await call(`/catalog/handles/${h('nope')}/resolve`, null);
      const sameAsUnknown = (r: Res) => r.status === unknown.status && JSON.stringify(r.body) === JSON.stringify(unknown.body);
      check(is(unknown, 404, 'HANDLE_NOT_FOUND') && !('data' in unknown.body), '16 unknown handle → 404 without data');

      const pub = await call(`/catalog/handles/${h('inj')}/resolve`, null);
      check(
        is(pub, 200) && JSON.stringify(Object.keys(pub.body.data).sort()) === JSON.stringify(['currentHandle', 'entityId', 'entityType', 'handle', 'status']),
        '16 a published Brand resolves with routing fields only (no name, slug or catalog content)',
        pub.body,
      );

      check(is(await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.d.id, handle: h('pd1'), reason: 'probe' }), 200), '16 a draft Brand can hold a handle (assignment is not publication)');
      const draft = await call(`/catalog/handles/${h('pd1')}/resolve`, null);
      check(sameAsUnknown(draft), '16 draft Brand: anonymous resolve is identical to an unknown handle', draft.body);
      check(!JSON.stringify(draft.body).includes(B.d.id) && !JSON.stringify(draft.body).includes(B.d.slug) && !JSON.stringify(draft.body).includes(B.d.name), '16 draft Brand: no id, slug or name in the response');
      check(sameAsUnknown(await call(`/catalog/handles/${h('pd1')}/resolve?type=brand`, SA.token)), '16 draft Brand: hidden on this public route even for a signed-in Super Admin');
      check(sameAsUnknown(await call(`/catalog/handles/${h('rsv')}/resolve`, null)), '16 a retired handle of an unpublished Brand → same 404');
      check(sameAsUnknown(await call(`/catalog/handles/${h('q2a')}/resolve`, null)), '16 a revoked Brand’s handle → same 404');
      const granted = await call(`/catalog/brands/${B.d.id}/marketplace-access`, SA.token, 'PATCH', { status: 'granted' });
      const nowPublic = await call(`/catalog/handles/${h('pd1')}/resolve`, null);
      check(granted.status === 200 && is(nowPublic, 200) && nowPublic.body.data.entityId === B.d.id, '16 once published, the same Brand resolves', nowPublic.body);

      check(is(await admin(SA.token, 'assign', { entityType: 'creator', entityId: C.w.id, handle: h('cw1'), reason: 'probe' }), 200), '16 a draft Creator can hold a handle');
      const draftCreator = await call(`/catalog/handles/${h('cw1')}/resolve`, null);
      check(sameAsUnknown(draftCreator) && !JSON.stringify(draftCreator.body).includes(C.w.id), '16 draft Creator: identical to an unknown handle, no id', draftCreator.body);
      check(sameAsUnknown(await call(`/catalog/handles/${h('cz1')}/resolve`, null)), '16 archived Creator (not live) → same 404');
      const liveCreator = await call(`/catalog/handles/${String(await activeOf('creator', C.x.id))}/resolve`, null);
      check(is(liveCreator, 200) && liveCreator.body.data.entityId === C.x.id && liveCreator.body.data.entityType === 'creator', '16 a live Creator resolves', liveCreator.body);

      await admin(SA.token, 'assign', { entityType: 'brand', entityId: B.n.id, handle: h('pn1'), reason: 'probe' });
      await admin(SA.token, 'retire', { entityType: 'brand', entityId: B.n.id, reason: 'probe' });
      const noneLeft = await call(`/catalog/handles/${h('pn1')}/resolve`, null);
      check(is(noneLeft, 200) && noneLeft.body.data.status === 'retired' && noneLeft.body.data.currentHandle === null, '16 published Brand, retired handle, no current handle → currentHandle null', noneLeft.body);
    }
    check(requestCount < 300, `budget: the probe made ${requestCount} API requests (< 300 public rate-limit budget)`);

    // ── 14. Error hygiene ──
    {
      const leaks = errorBodies.filter(({ body }) => {
        const text = JSON.stringify(body);
        return body.success !== false || /stack|DrizzleQueryError|duplicate key|violates|at Object\./i.test(text);
      });
      // 401/403 from the shared auth helpers use their own envelope; everything else must be ours.
      const handleErrors = errorBodies.filter(({ body }) => typeof body.code === 'string' && body.code.startsWith('HANDLE'));
      check(leaks.filter(({ body }) => typeof body.code === 'string' && body.code.startsWith('HANDLE')).length === 0, '14 no handle error leaks internal details', leaks.slice(0, 3));
      check(handleErrors.every(({ body }) => typeof body.error === 'string' && /^HANDLES?_[A-Z_]+$/.test(body.code)), '14 every handle error uses { success:false, error, code: HANDLE_* }');
      check(!/HANDLES_UNAVAILABLE/.test(JSON.stringify(errorBodies)), '14 no request hit the 503 fallback (no unexpected server error)');
    }
  } finally {
    for (const c of injected) await db.query(`alter table public_handle_events drop constraint if exists ${c}`).catch(() => undefined);
    await lockConn.query('rollback').catch(() => undefined);
    await lockConn.end().catch(() => undefined);
    child.kill();
    await db.query(`delete from partner_applications where id=$1`, [appId]).catch(() => undefined);
    if (tempUsers.length) await db.query(`delete from users where id = any($1::uuid[])`, [tempUsers]).catch(() => undefined);
    const left = (await db.query(`select count(*)::int n from users where id = any($1::uuid[])`, [tempUsers])).rows[0]?.n;
    check(left === 0, 'cleanup: temporary accounts deleted');
    await db.end();
  }

  console.log(`\n${fails.length === 0 ? 'PASS' : 'FAIL'} probe-public-handle-lifecycle (${passes} passed, ${fails.length} failed)`);
  if (fails.length) {
    for (const f of fails) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
