/**
 * Public Identity Phase C3 — catalog integration probe (live HTTP + database).
 *
 * Spawns its own API process against a DISPOSABLE LOCAL database and checks how
 * catalog operations interact with public handles:
 *  - catalog reads carry the ACTIVE handle (publicHandle) for exactly the items
 *    the requester may already see; drafts stay invisible to anonymous readers;
 *    Products are untouched; a handle-store outage never breaks a catalog read;
 *  - the approved slug lock (D2): with an active handle only a Super Admin may
 *    change a Brand / Creator slug; unchanged slugs always save;
 *  - a slug can never equal another same-type entity's handle (active or retired)
 *    on create, edit or automated creation (Creator workspace) — Brand and Creator
 *    URL spaces stay separate;
 *  - ownership transfer keeps the handle; suspension / unpublishing / archiving
 *    hide the entity but never retire its handle;
 *  - deleting a Brand retires its handle and supersedes pending requests, and a
 *    failure there never undoes the delete;
 *  - creation never assigns a handle; handle rows are keyed by the entity id
 *    (never a seller or user); catalog writes cannot set or overwrite a handle;
 *  - publishing / unpublishing across every marketplace state, and Creator
 *    live ↔ draft; duplicate and concurrent operations; no Seller, User,
 *    Product or Guide handles;
 *  - ownership transfer vs approval with BOTH orderings forced via database locks;
 *  - the real partner-application flow (POST /auth/partner-apply), including a
 *    handle-store outage mid-application.
 *
 * SAFETY (as probe-public-handle-lifecycle.ts): PROBE_DISPOSABLE_DATABASE_URL must
 * be 127.0.0.1/localhost with migration 0013 applied (no override flag); every
 * file the API could write is redirected to a temp directory; per-run fixtures;
 * temporary accounts are deleted at the end.
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-public-handle-catalog.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import pg from 'pg';

const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const PORT = Number(process.env.PROBE_PORT || 3093);
const API = `http://127.0.0.1:${PORT}/api/v1`;
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

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

type Res = { status: number; body: Record<string, any> };
let requestCount = 0;
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  requestCount += 1;
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
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
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error('API did not become healthy');
}

async function main() {
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
  const q = async <T = Record<string, any>>(text: string, params: unknown[] = []) => (await db.query(text, params)).rows as T[];
  const lockConn = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await lockConn.connect();
  const applicantEmails: string[] = [];
  if (!(await q(`select to_regclass('public.public_handle_requests') is not null as ok`))[0]?.ok) {
    console.error('Refusing to run: migration 0013 (public_handle_requests) is not applied to this database.');
    process.exit(2);
  }

  // ── Per-run fixtures ──
  const sfx = Date.now().toString(36);
  const h = (base: string) => `${base}-${sfx}`;
  const tempPassword = `CatalogProbe!${sfx}`;
  const passwordHash = await argon2.hash(tempPassword);
  const tempUsers: string[] = [];
  const mkUser = async (label: string, role: string, displayName = `C3 Probe ${label}`) => {
    const email = `c3.${label}.${sfx}@probe.local`;
    const [row] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1, $2, $3, $4, true) returning id`,
      [email, passwordHash, displayName, role],
    );
    tempUsers.push(row.id);
    return { id: row.id, email };
  };
  const u = {
    admin: await mkUser('admin', 'admin'),
    sellerA: await mkUser('seller-a', 'seller'),
    sellerB: await mkUser('seller-b', 'seller'),
    creatorX: await mkUser('creator-x', 'creator'),
    // Display name whose slug equals another Creator's handle (workspace creation path).
    creatorNew: await mkUser('creator-new', 'creator', `Zeta ${sfx}`),
  };

  const now = new Date().toISOString();
  const brand = (key: string, sellerId: string | null, extra: Record<string, unknown> = {}) => ({
    id: `brand-c3probe-${sfx}-${key}`,
    slug: `c3b${key}-${sfx}`,
    name: `C3 Probe ${key.toUpperCase()} ${sfx}`,
    category: 'General',
    description: 'C3 probe fixture',
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
    id: `creator-c3probe-${sfx}-${key}`,
    slug: `c3c${key}-${sfx}`,
    name: `C3 Probe Creator ${key.toUpperCase()}`,
    handle: `@c3probe${key}`,
    avatar: '',
    score: 50,
    bestFor: 'Tech',
    bestForTags: [],
    platforms: [],
    bio: 'C3 probe fixture',
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
    nh: brand('nh', u.sellerA.id),
    draft: brand('draft', u.sellerA.id, { marketplaceStatus: 'not_granted', marketplaceAccess: false }),
    t: brand('t', u.sellerA.id),
    del: brand('del', null),
    del2: brand('del2', null),
    del3: brand('del3', null),
    pub: brand('pub', u.sellerA.id, { marketplaceStatus: 'not_granted', marketplaceAccess: false }),
    junk: brand('junk', null, { publicHandle: `junk-${sfx}` }),
    cc: brand('cc', u.sellerA.id),
    dd: brand('dd', null),
    vv: brand('vv', null),
    r1: brand('r1', u.sellerA.id),
    r2: brand('r2', u.sellerA.id),
    pab: brand('pab', null),
  };
  const C = {
    x: creator('x', u.creatorX.id, 'live'),
    y: creator('y', null, 'live'),
    w: creator('w', null, 'draft'),
    z: creator('z', null, 'live'),
    v: creator('v', u.creatorX.id, 'live'),
    cd: creator('cd', null, 'live'),
    pac: creator('pac', null, 'live'),
  };

  const tmp = mkdtempSync(join(tmpdir(), 'handle-catalog-probe-'));
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
  let renamedTable = false;

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
    const SA = await login('admin@choosify.com.bd', DEV_PASSWORD);
    const ADMIN = await login(u.admin.email, tempPassword);
    const SELLER_A = await login(u.sellerA.email, tempPassword);
    const SELLER_B = await login(u.sellerB.email, tempPassword);
    const CREATOR_X = await login(u.creatorX.email, tempPassword);
    check(SA.uid && ADMIN.uid && SELLER_A.uid === u.sellerA.id, 'setup: accounts signed in');

    const assign = (type: string, entityId: string, handle: string) =>
      call('/public-handles/admin/assign', SA.token, 'POST', { entityType: type, entityId, handle, reason: 'C3 probe' });
    const rename = (type: string, entityId: string, handle: string) =>
      call('/public-handles/admin/rename', SA.token, 'POST', { entityType: type, entityId, handle, reason: 'C3 probe' });
    const brandsAs = async (token: string | null) => ((await call('/catalog/brands', token)).body.data || []) as Array<Record<string, any>>;
    const creatorsAs = async (token: string | null, query = '') => ((await call(`/catalog/creators${query}`, token)).body.data || []) as Array<Record<string, any>>;
    const find = (list: Array<Record<string, any>>, id: string) => list.find((x) => x.id === id);
    const activeOf = async (type: string, id: string) =>
      (await q<{ handle: string }>(`select handle from public_handles where entity_type=$1 and entity_id=$2 and status='active'`, [type, id]))[0]?.handle ?? null;
    const brandSlugAs = async (token: string, id: string) => find(await brandsAs(token), id)?.slug;
    const rowsForHandle = async (handle: string) => q(`select * from public_handles where handle=$1`, [handle]);

    for (const [type, id, handle] of [
      ['brand', B.a.id, h('ha')],
      ['brand', B.draft.id, h('hdraft')],
      ['brand', B.t.id, h('ht')],
      ['brand', B.del.id, h('hdel')],
      ['brand', B.del2.id, h('hdel2')],
      ['creator', C.x.id, h('hx')],
      ['creator', C.w.id, h('hw')],
      ['creator', C.z.id, `zeta-${sfx}`],
      ['brand', B.pub.id, h('hpub')],
      ['brand', B.cc.id, h('hcc')],
      ['brand', B.dd.id, h('hdd')],
      ['brand', B.vv.id, h('hvv')],
      ['creator', C.cd.id, h('hcd')],
      ['brand', B.r1.id, h('r1a')],
      ['brand', B.r2.id, h('r2a')],
      ['brand', B.pab.id, h('pab')],
      ['creator', C.pac.id, h('pac')],
    ] as const) {
      const r = await assign(type, id, handle);
      if (r.status !== 200) throw new Error(`fixture assign ${type} ${id} failed: ${JSON.stringify(r.body)}`);
    }
    // Brand A also gets a retired handle (rename ha → ha2).
    check(is(await rename('brand', B.a.id, h('ha2')), 200), 'setup: Brand A renamed (ha retired, ha2 active)');

    // ── 1. Catalog reads carry the active handle, scoped like the catalog itself ──
    {
      const anon = await brandsAs(null);
      check(find(anon, B.a.id)?.publicHandle === h('ha2'), '1 anonymous /catalog/brands: active handle on a published Brand', find(anon, B.a.id)?.publicHandle);
      check(find(anon, B.nh.id)?.publicHandle === null, '1 anonymous /catalog/brands: published Brand without a handle → publicHandle null');
      check(!find(anon, B.draft.id), '1 anonymous /catalog/brands: draft Brand (and its handle) not listed');
      check(!JSON.stringify(anon).includes(h('hdraft')), '1 anonymous brand list never contains the draft Brand’s handle');
      check(!JSON.stringify(anon).includes(`"${h('ha')}"`), '1 retired handles never appear in catalog responses');
      const extraKeys = Object.keys(find(anon, B.a.id) || {}).filter((k) => !(k in B.a) && !['brandReferenceId', 'publicHandle'].includes(k));
      check(!Object.keys(find(anon, B.a.id) || {}).some((k) => /^(handleStatus|handleHistory|retired|createdByUserId|handles)$/.test(k)), '1 only publicHandle is added (no handle-management fields)', extraKeys);
      const owner = await brandsAs(SELLER_A.token);
      check(find(owner, B.draft.id)?.publicHandle === h('hdraft'), '1 the owner sees their own draft Brand’s handle');
      check(!find(owner, B.b.id), '1 the owner list stays owner-scoped');
      const adminList = await brandsAs(ADMIN.token);
      check(find(adminList, B.draft.id)?.publicHandle === h('hdraft') && find(adminList, B.a.id)?.publicHandle === h('ha2'), '1 Admin list carries handles for every Brand');
      const live = await creatorsAs(null, '?status=live');
      check(find(live, C.x.id)?.publicHandle === h('hx'), '1 anonymous /catalog/creators?status=live: active Creator handle');
      check(find(live, C.y.id)?.publicHandle === null, '1 live Creator without a handle → null');
      check(!find(live, C.w.id) && !JSON.stringify(live).includes(h('hw')), '1 draft Creator and its handle are not exposed');
      const snap = await call('/catalog/snapshot', null);
      check(find(snap.body.brands || [], B.a.id)?.publicHandle === h('ha2'), '1 /catalog/snapshot brands carry the active handle');
      const products = await call('/catalog/products?limit=5', null);
      const plist = (products.body.data || products.body.products || []) as Array<Record<string, any>>;
      check(products.status === 200 && plist.every((p) => !('publicHandle' in p)), '1 Products are untouched (no handle field; slugs unchanged)', { status: products.status, n: plist.length });
    }

    // ── 2. Slug lock (D2) ──
    {
      const lockedOwner = await call(`/catalog/brands/${B.a.id}`, SELLER_A.token, 'PATCH', { slug: h('newslug') });
      check(is(lockedOwner, 409, 'HANDLE_SLUG_LOCKED'), '2 owner cannot change the slug of a Brand with a handle', lockedOwner.body);
      check((await brandSlugAs(SA.token, B.a.id)) === B.a.slug, '2 the refused slug change was not saved');
      const desc = await call(`/catalog/brands/${B.a.id}`, SELLER_A.token, 'PATCH', { description: 'Updated by owner', slug: B.a.slug });
      check(is(desc, 200) && desc.body.data?.slug === B.a.slug, '2 owner saves with the unchanged slug resent (editor behaviour) → allowed', desc.body);
      // Owners may not send Marketplace Access fields at all (existing rule), so the editor-style PUT omits them.
      const { marketplaceAccess: _ma, marketplaceStatus: _ms, ...ownerFields } = B.a;
      const put = await call(`/catalog/brands/${B.a.id}`, SELLER_A.token, 'PUT', { ...ownerFields, description: 'PUT by owner' });
      check(is(put, 200) && put.body.data?.slug === B.a.slug, '2 owner full PUT with the same slug → allowed', put.body);
      const lockedAdmin = await call(`/catalog/brands/${B.a.id}`, ADMIN.token, 'PATCH', { slug: h('adminslug') });
      check(is(lockedAdmin, 409, 'HANDLE_SLUG_LOCKED'), '2 Admin (cms:edit, not Super Admin) cannot change it either', lockedAdmin.body);
      const saSlug = await call(`/catalog/brands/${B.a.id}`, SA.token, 'PATCH', { slug: h('saslug') });
      check(is(saSlug, 200) && saSlug.body.data?.slug === h('saslug'), '2 Super Admin can change the slug', saSlug.body);
      check((await activeOf('brand', B.a.id)) === h('ha2'), '2 changing the slug never changes the handle');
      const noHandle = await call(`/catalog/brands/${B.nh.id}`, SELLER_A.token, 'PATCH', { slug: h('nhslug') });
      check(is(noHandle, 200) && noHandle.body.data?.slug === h('nhslug'), '2 a Brand without a handle keeps normal slug editing', noHandle.body);
      const creatorLocked = await call(`/catalog/creators/${C.x.id}`, CREATOR_X.token, 'PATCH', { slug: h('xslug') });
      check(is(creatorLocked, 409, 'HANDLE_SLUG_LOCKED'), '2 Creator owner cannot change the slug of a Creator with a handle', creatorLocked.body);
      const creatorSame = await call(`/catalog/creators/${C.x.id}`, CREATOR_X.token, 'PATCH', { bio: 'Updated', slug: C.x.slug });
      check(is(creatorSame, 200) && creatorSame.body.data?.slug === C.x.slug, '2 Creator owner edits with the unchanged slug → allowed', creatorSame.body);
      const creatorFree = await call(`/catalog/creators/${C.v.id}`, CREATOR_X.token, 'PATCH', { slug: h('vslug') });
      check(is(creatorFree, 200) && creatorFree.body.data?.slug === h('vslug'), '2 a Creator without a handle keeps normal slug editing', creatorFree.body);
    }

    // ── 3. A slug never equals another same-type entity's handle ──
    {
      const toActive = await call(`/catalog/brands/${B.b.id}`, SELLER_B.token, 'PATCH', { slug: h('ha2') });
      check(is(toActive, 200) && toActive.body.data?.slug !== h('ha2') && String(toActive.body.data?.slug).startsWith(h('ha2')), '3 Brand slug equal to another Brand’s ACTIVE handle is suffixed', toActive.body.data?.slug);
      const toRetired = await call(`/catalog/brands/${B.b.id}`, SELLER_B.token, 'PATCH', { slug: h('ha') });
      check(is(toRetired, 200) && toRetired.body.data?.slug !== h('ha'), '3 Brand slug equal to another Brand’s RETIRED handle is suffixed', toRetired.body.data?.slug);
      const toCreatorHandle = await call(`/catalog/brands/${B.b.id}`, SELLER_B.token, 'PATCH', { slug: h('hx') });
      check(is(toCreatorHandle, 200) && toCreatorHandle.body.data?.slug === h('hx'), '3 a Brand slug may equal a CREATOR handle (separate URL spaces)', toCreatorHandle.body.data?.slug);
      const created = await call('/catalog/brands', SA.token, 'POST', { name: `C3 New ${sfx}`, slug: h('ht'), category: 'General' });
      check(is(created, 201) && created.body.data?.slug !== h('ht'), '3 a new Brand cannot take another Brand’s handle as its slug', created.body.data?.slug);
      const ownHandle = await call(`/catalog/brands/${B.t.id}`, SA.token, 'PATCH', { slug: h('ht') });
      check(is(ownHandle, 200) && ownHandle.body.data?.slug === h('ht'), '3 a Brand may use its OWN handle as its slug', ownHandle.body.data?.slug);
      const creatorToHandle = await call(`/catalog/creators/${C.v.id}`, CREATOR_X.token, 'PATCH', { slug: h('hw') });
      check(is(creatorToHandle, 200) && creatorToHandle.body.data?.slug !== h('hw'), '3 Creator slug equal to another Creator’s handle is suffixed', creatorToHandle.body.data?.slug);
      const newCreator = await call(`/catalog/creators/creator-c3probe-${sfx}-new`, SA.token, 'PUT', { name: 'C3 New Creator', slug: h('hx'), status: 'draft' });
      check(is(newCreator, 200) && newCreator.body.data?.slug !== h('hx'), '3 a new Creator (PUT) cannot take another Creator’s handle as its slug', newCreator.body.data?.slug);
      // Automated creation: Creator workspace from a display name whose slug is someone's handle.
      const NEW = await login(u.creatorNew.email, tempPassword);
      const ensured = await call('/catalog/workspace/creator/ensure', NEW.token, 'POST', {});
      const createdCreator = (ensured.body.data?.creators || ensured.body.creators || [])[0] || (await creatorsAs(NEW.token)).find((c) => c.userId === u.creatorNew.id);
      check(
        ensured.status < 300 && createdCreator && createdCreator.slug !== `zeta-${sfx}` && String(createdCreator.slug).startsWith(`zeta-${sfx}`),
        '3 automated Creator workspace creation avoids another Creator’s handle',
        { status: ensured.status, slug: createdCreator?.slug },
      );
    }

    // ── 4. Ownership transfer keeps the handle ──
    {
      const transfer = await call(`/catalog/brands/${B.t.id}`, SA.token, 'PATCH', { sellerId: u.sellerB.id });
      check(is(transfer, 200) && transfer.body.data?.sellerId === u.sellerB.id, '4 Brand T transferred to seller B');
      check((await activeOf('brand', B.t.id)) === h('ht'), '4 the handle is unchanged after the transfer');
      check(find(await brandsAs(SELLER_B.token), B.t.id)?.publicHandle === h('ht'), '4 the new owner sees the Brand with its handle');
      check(!find(await brandsAs(SELLER_A.token), B.t.id), '4 the former owner no longer sees the Brand');
      const ownerSlug = await call(`/catalog/brands/${B.t.id}`, SELLER_B.token, 'PATCH', { slug: h('tslug') });
      check(is(ownerSlug, 409, 'HANDLE_SLUG_LOCKED'), '4 the new owner is bound by the same slug lock');
      check((await q(`select count(*)::int n from public_handle_events where entity_id=$1 and created_at > now() - interval '1 hour' and action <> 'assigned'`, [B.t.id]))[0].n === 0, '4 the transfer wrote no handle history (handles belong to the Brand id)');
    }

    // ── 5. Suspension, unpublishing and archiving hide the entity but keep the handle ──
    {
      const resolve = (handle: string) => call(`/catalog/handles/${handle}/resolve`, null);
      check(is(await resolve(h('ha2')), 200), '5 published Brand A resolves');
      const susp = await call(`/catalog/brands/${B.a.id}/marketplace-access`, SA.token, 'PATCH', { status: 'suspended' });
      check(is(susp, 200), '5 Brand A suspended');
      check(!find(await brandsAs(null), B.a.id), '5 suspended Brand leaves the anonymous list');
      check(is(await resolve(h('ha2')), 404, 'HANDLE_NOT_FOUND'), '5 suspended Brand does not resolve');
      check((await activeOf('brand', B.a.id)) === h('ha2'), '5 suspension does not retire the handle');
      const restore = await call(`/catalog/brands/${B.a.id}/marketplace-access`, SA.token, 'PATCH', { status: 'restored' });
      check(is(restore, 200) && find(await brandsAs(null), B.a.id)?.publicHandle === h('ha2') && is(await resolve(h('ha2')), 200), '5 restored Brand is listed and resolves with the same handle');
      const pub = await call(`/catalog/creators/${C.w.id}`, SA.token, 'PATCH', { status: 'live' });
      check(is(pub, 200) && find(await creatorsAs(null, '?status=live'), C.w.id)?.publicHandle === h('hw') && is(await resolve(h('hw')), 200), '5 publishing a draft Creator exposes it with its handle');
      const arch = await call(`/catalog/creators/${C.w.id}`, SA.token, 'PATCH', { status: 'archived' });
      check(is(arch, 200) && !find(await creatorsAs(null, '?status=live'), C.w.id) && is(await resolve(h('hw')), 404), '5 archiving hides it again (list and resolve)');
      check((await activeOf('creator', C.w.id)) === h('hw'), '5 archiving does not retire the handle');
    }

    // ── 6. Deleting a Brand retires its handle ──
    {
      const req = await call(`/public-handles/brand/${B.del.id}`, SA.token);
      check(is(req, 200) && req.body.data.activeHandle?.handle === h('hdel'), '6 Brand DEL has an active handle before deletion');
      // A pending owner request is superseded by the deletion (request seeded directly: the fixture has no owner).
      await q(`insert into public_handle_requests (entity_type, entity_id, requested_handle, status, requested_by_user_id) values ('brand', $1, $2, 'pending', $3)`, [B.del.id, h('hdelx'), u.sellerA.id]);
      const del = await call(`/catalog/brands/${B.del.id}`, SA.token, 'DELETE');
      check(is(del, 200) && !del.body.warning, '6 Super Admin deletes the Brand', del.body);
      const row = (await q(`select status, retired_at from public_handles where handle=$1`, [h('hdel')]))[0];
      check(row?.status === 'retired' && row?.retired_at, '6 the deleted Brand’s handle is retired', row);
      const ev = (await q(`select action, actor_user_id, reason from public_handle_events where entity_id=$1 order by created_at, id`, [B.del.id])).map((e) => e.action);
      check(ev.join() === 'assigned,retired,request_superseded', '6 history: assigned → retired → pending request superseded', ev);
      check((await q(`select status from public_handle_requests where entity_id=$1`, [B.del.id]))[0]?.status === 'superseded', '6 the pending request is superseded');
      check(is(await call(`/catalog/handles/${h('hdel')}/resolve`, null), 404), '6 the deleted Brand’s handle does not resolve');
      check(is(await assign('brand', B.b.id, h('hdel')), 409, 'HANDLE_UNAVAILABLE'), '6 the retired handle can never be issued again');
      const delNoHandle = await call(`/catalog/brands/${B.nh.id}`, SA.token, 'DELETE');
      check(is(delNoHandle, 200) && (await q(`select count(*)::int n from public_handle_events where entity_id=$1`, [B.nh.id]))[0].n === 0, '6 deleting a Brand without a handle writes no handle history');
      const byAdmin = await call(`/catalog/brands/${B.del3.id}`, ADMIN.token, 'DELETE');
      check(is(byAdmin, 200), '6 Admin deletion keeps its existing cms:edit authority (no handle involved)');
      // Failure injection: the retirement cannot be written → the delete still succeeds, with a warning.
      const constraint = `probe_c3_inject_${sfx}`.replace(/[^a-z0-9_]/g, '_');
      await q(`alter table public_handle_events add constraint ${constraint} check (action <> 'retired' or entity_id is distinct from '${B.del2.id}') not valid`);
      injected.push(constraint);
      const delFail = await call(`/catalog/brands/${B.del2.id}`, SA.token, 'DELETE');
      check(is(delFail, 200) && typeof delFail.body.warning === 'string' && !/constraint|violat|probe_c3/i.test(delFail.body.warning), '6 retirement failure never undoes the delete (200 + clean warning)', delFail.body);
      check((await activeOf('brand', B.del2.id)) === h('hdel2'), '6 after the failed retirement the handle row is unchanged (transaction rolled back)');
      check(is(await call(`/catalog/handles/${h('hdel2')}/resolve`, null), 404), '6 …and it still cannot resolve (its Brand no longer exists)');
      await q(`alter table public_handle_events drop constraint ${constraint}`);
      injected.pop();
    }

    // ── 8. Creation never assigns a handle; assigned handles belong to the entity id ──
    let madeBrandId = '';
    let madeBrandSlug = '';
    {
      const before = (await q(`select count(*)::int n from public_handles`))[0].n;
      const sellerBrand = await call('/catalog/brands', SELLER_A.token, 'POST', { name: `C3 Seller Made ${sfx}`, category: 'General' });
      const adminBrand = await call('/catalog/brands', SA.token, 'POST', { name: `C3 Admin Made ${sfx}`, category: 'General' });
      const madeCreatorId = `creator-c3probe-${sfx}-made`;
      const madeCreator = await call(`/catalog/creators/${madeCreatorId}`, SA.token, 'PUT', { name: `C3 Made Creator ${sfx}`, status: 'live', userId: u.creatorX.id });
      check(is(sellerBrand, 201) && is(adminBrand, 201) && is(madeCreator, 200), '8 a seller Brand, an admin Brand and a Creator are created', [sellerBrand.status, adminBrand.status, madeCreator.status]);
      check((await q(`select count(*)::int n from public_handles`))[0].n === before, '8 creating Brands and Creators assigns no handle (no automatic slug-to-handle)');
      madeBrandId = String(sellerBrand.body.data?.id);
      madeBrandSlug = String(sellerBrand.body.data?.slug);
      check(sellerBrand.body.data?.sellerId === u.sellerA.id && find(await brandsAs(SELLER_A.token), madeBrandId)?.publicHandle === null, '8 the new seller Brand starts with publicHandle null');
      check(is(await assign('brand', madeBrandId, h('made')), 200), '8 Super Admin assigns the new Brand a handle');
      const brandRow = (await rowsForHandle(h('made')))[0];
      check(brandRow?.entity_type === 'brand' && brandRow?.entity_id === madeBrandId && brandRow?.entity_id !== u.sellerA.id, '8 the handle row is keyed by the Brand id, never the seller', brandRow);
      check(is(await assign('creator', madeCreatorId, h('madec')), 200), '8 Super Admin assigns the new Creator a handle');
      const creatorRow = (await rowsForHandle(h('madec')))[0];
      check(creatorRow?.entity_type === 'creator' && creatorRow?.entity_id === madeCreatorId && creatorRow?.entity_id !== u.creatorX.id, '8 a Creator handle is keyed by the Creator id, never its user', creatorRow);
    }

    // ── 9. Edits never reassign, overwrite or bypass a handle ──
    {
      const renamed = await call(`/catalog/brands/${madeBrandId}`, SELLER_A.token, 'PATCH', { name: `Renamed ${sfx}`, description: 'Renamed' });
      check(is(renamed, 200) && renamed.body.data?.slug === madeBrandSlug && (await activeOf('brand', madeBrandId)) === h('made'), '9 renaming a Brand keeps its slug and its handle', renamed.body.data?.slug);
      const smuggle = await call(`/catalog/brands/${madeBrandId}`, SELLER_A.token, 'PATCH', { description: 'Smuggle', publicHandle: h('evil') });
      check(is(smuggle, 200) && !('publicHandle' in (smuggle.body.data || {})), '9 a publicHandle sent to a Brand write is not stored', smuggle.body.data?.publicHandle);
      check(
        (await rowsForHandle(h('evil'))).length === 0 && (await activeOf('brand', madeBrandId)) === h('made') && find(await brandsAs(SELLER_A.token), madeBrandId)?.publicHandle === h('made'),
        '9 the handle store stays authoritative after the attempt',
      );
      const smuggleSa = await call(`/catalog/brands/${madeBrandId}`, SA.token, 'PUT', { name: `Renamed ${sfx}`, slug: madeBrandSlug, category: 'General', publicHandle: h('evil2') });
      check(is(smuggleSa, 200) && (await rowsForHandle(h('evil2'))).length === 0 && (await activeOf('brand', madeBrandId)) === h('made'), '9 not even a Super Admin catalog write can set a handle (only the handle API can)');
      const creatorEdit = await call(`/catalog/creators/${C.x.id}`, CREATOR_X.token, 'PATCH', { name: 'Renamed Creator X', publicHandle: h('evilc') });
      check(
        is(creatorEdit, 200) && creatorEdit.body.data?.slug === C.x.slug && !('publicHandle' in (creatorEdit.body.data || {})) && (await activeOf('creator', C.x.id)) === h('hx') && (await rowsForHandle(h('evilc'))).length === 0,
        '9 renaming a Creator keeps its slug and handle; a smuggled publicHandle is ignored',
      );
      check(find(await brandsAs(null), B.junk.id)?.publicHandle === null, '9 a publicHandle stored inside catalog data is never served (the handle store wins)');
    }

    // ── 10. Publishing and unpublishing ──
    {
      const resolve = (handle: string) => call(`/catalog/handles/${handle}/resolve`, null);
      const visible = async (id: string, handle: string) => Boolean(find(await brandsAs(null), id)) && (await resolve(handle)).status === 200;
      const hidden = async (id: string, handle: string) => !find(await brandsAs(null), id) && (await resolve(handle)).status === 404;
      check(await hidden(B.pub.id, h('hpub')), '10 an unpublished (not granted) Brand with a handle is neither listed nor resolvable');
      check(is(await call(`/catalog/brands/${B.pub.id}/marketplace-access`, SA.token, 'PATCH', { status: 'granted' }), 200) && (await visible(B.pub.id, h('hpub'))), '10 publishing (granted) exposes it with its handle');
      for (const status of ['not_granted', 'revoked', 'restricted'] as const) {
        const r = await call(`/catalog/brands/${B.pub.id}/marketplace-access`, SA.token, 'PATCH', { status });
        check(is(r, 200) && (await hidden(B.pub.id, h('hpub'))) && (await activeOf('brand', B.pub.id)) === h('hpub'), `10 ${status}: hidden from list and resolve; handle kept`);
      }
      check(is(await call(`/catalog/brands/${B.pub.id}/marketplace-access`, SA.token, 'PATCH', { status: 'granted' }), 200) && (await visible(B.pub.id, h('hpub'))), '10 re-publishing restores it with the same handle');
      const unpublish = await call(`/catalog/creators/${C.cd.id}`, SA.token, 'PATCH', { status: 'draft' });
      check(is(unpublish, 200) && !find(await creatorsAs(null, '?status=live'), C.cd.id) && (await resolve(h('hcd'))).status === 404 && (await activeOf('creator', C.cd.id)) === h('hcd'), '10 unpublishing a Creator (live → draft) hides it; handle kept');
      const republish = await call(`/catalog/creators/${C.cd.id}`, SA.token, 'PATCH', { status: 'live' });
      check(is(republish, 200) && find(await creatorsAs(null, '?status=live'), C.cd.id)?.publicHandle === h('hcd') && (await resolve(h('hcd'))).status === 200, '10 re-publishing the Creator restores it with the same handle');
    }

    // ── 11. Duplicate and concurrent operations ──
    {
      // 11a. The same Brand deleted twice at once: the handle is retired exactly once.
      const dels = await Promise.all([call(`/catalog/brands/${B.dd.id}`, SA.token, 'DELETE'), call(`/catalog/brands/${B.dd.id}`, SA.token, 'DELETE')]);
      const retiredEvents = (await q(`select count(*)::int n from public_handle_events where entity_id=$1 and action='retired'`, [B.dd.id]))[0].n;
      check(dels.every((d) => d.status === 200) && retiredEvents === 1 && (await rowsForHandle(h('hdd')))[0]?.status === 'retired', '11a concurrent duplicate deletes retire the handle exactly once', { statuses: dels.map((d) => d.status), retiredEvents });
      // 11b. Ownership transfer racing the approval of the former owner's request.
      const pending = await call(`/public-handles/brand/${B.cc.id}/requests`, SELLER_A.token, 'POST', { handle: h('ccnew') });
      check(is(pending, 201), '11b former owner has a pending request', pending.body);
      const rid = String(pending.body.data?.id);
      const [xfer, appr] = await Promise.all([
        call(`/catalog/brands/${B.cc.id}`, SA.token, 'PATCH', { sellerId: u.sellerB.id }),
        call(`/public-handles/admin/requests/${rid}/approve`, SA.token, 'POST', {}),
      ]);
      const reqRow = (await q(`select status from public_handle_requests where id=$1`, [rid]))[0];
      const active = await q(`select handle, entity_id from public_handles where entity_type='brand' and entity_id=$1 and status='active'`, [B.cc.id]);
      const consistent =
        (reqRow.status === 'approved' && appr.status === 200 && active.length === 1 && active[0].handle === h('ccnew')) ||
        (reqRow.status === 'superseded' && appr.body.code === 'HANDLE_REQUESTER_NOT_OWNER' && active.length === 1 && active[0].handle === h('hcc'));
      check(is(xfer, 200) && consistent, '11b transfer + approval race: one consistent outcome, one active handle, still keyed by the Brand', { xfer: xfer.status, appr: appr.status, req: reqRow.status, active });
      check(find(await brandsAs(SELLER_B.token), B.cc.id)?.publicHandle === active[0]?.handle, '11b the new owner sees the Brand with that handle');
      // 11c. Publish / suspend racing: list visibility and handle resolution always agree.
      let agree = 0;
      for (let i = 0; i < 3; i++) {
        await Promise.all([
          call(`/catalog/brands/${B.vv.id}/marketplace-access`, SA.token, 'PATCH', { status: 'suspended' }),
          call(`/catalog/brands/${B.vv.id}/marketplace-access`, SA.token, 'PATCH', { status: 'granted' }),
        ]);
        const listed = Boolean(find(await brandsAs(null), B.vv.id));
        const resolvable = (await call(`/catalog/handles/${h('hvv')}/resolve`, null)).status === 200;
        if (listed === resolvable) agree += 1;
      }
      check(agree === 3 && (await activeOf('brand', B.vv.id)) === h('hvv'), '11c concurrent publish/suspend: listing and resolution always agree; handle kept', { agree });
      // 11d. A catalog edit racing a Super Admin rename of the same Brand.
      const [edit, ren] = await Promise.all([
        call(`/catalog/brands/${madeBrandId}`, SELLER_A.token, 'PATCH', { description: 'Concurrent edit' }),
        rename('brand', madeBrandId, h('made2')),
      ]);
      check(
        is(edit, 200) && is(ren, 200) && (await activeOf('brand', madeBrandId)) === h('made2') && (await brandSlugAs(SA.token, madeBrandId)) === madeBrandSlug,
        '11d catalog edit + handle rename at once: both apply, slug untouched, new handle active',
      );
      // 11e. Two catalog writes trying to take another Brand's handle as a slug at once.
      const takes = await Promise.all([
        call(`/catalog/brands/${B.b.id}`, SELLER_B.token, 'PATCH', { slug: h('made2') }),
        call(`/catalog/brands/${B.cc.id}`, SA.token, 'PATCH', { slug: h('made2') }),
      ]);
      check(takes.every((t) => t.status === 200 && t.body.data?.slug !== h('made2')), '11e concurrent slug writes never take another Brand’s handle', takes.map((t) => t.body.data?.slug));
    }

    // ── 12. No Seller, User, Product, Guide (or other) handles ──
    {
      const types = ['seller', 'user', 'product', 'guide', 'deal', 'service', 'reserved'];
      const results = await Promise.all(types.map((t) => call('/public-handles/admin/assign', SA.token, 'POST', { entityType: t, entityId: 'x-1', handle: h(`t${t.slice(0, 3)}`), reason: 'probe' })));
      check(results.every((r) => is(r, 400, 'HANDLE_INVALID_ENTITY_TYPE')), '12 handle assignment refuses every type except brand and creator', results.map((r) => r.body.code));
      check(is(await call(`/public-handles/product/prod-1/requests`, SELLER_A.token, 'POST', { handle: h('tpr') }), 400, 'HANDLE_INVALID_ENTITY_TYPE'), '12 owners cannot request a Product handle');
      check(is(await assign('brand', 'prod-1', h('tpb')), 404, 'HANDLE_ENTITY_NOT_FOUND'), '12 a Product id is not a Brand');
      check(is(await assign('brand', u.sellerA.id, h('tsb')), 404, 'HANDLE_ENTITY_NOT_FOUND'), '12 a Seller (user) id is not a Brand');
      const typesInDb = (await q(`select distinct entity_type from public_handles order by 1`)).map((r) => r.entity_type);
      check(typesInDb.every((t) => ['brand', 'creator', 'reserved'].includes(t)), '12 the handle table holds only brand / creator / reserved rows', typesInDb);
      const guides = await call('/catalog/guides', null);
      const glist = (guides.body.data || []) as Array<Record<string, any>>;
      check(guides.status === 200 && glist.every((g) => !('publicHandle' in g)), '12 Guides are untouched (no handle field; slugs unchanged)', { status: guides.status, n: glist.length });
    }

    // ── 13. Ownership transfer vs approval — both orderings forced deterministically ──
    const waitForBlocked = async () => {
      for (let i = 0; i < 100; i++) {
        const [{ c }] = (await lockConn.query(`select count(*)::int c from pg_locks where not granted`)).rows;
        if (c >= 1) return true;
        await sleep(100);
      }
      return false;
    };
    const handleRows = async (id: string) =>
      q<{ handle: string; status: string }>(`select handle, status from public_handles where entity_type='brand' and entity_id=$1 order by created_at, id`, [id]);
    {
      // 13a. Transfer wins: the approval is held on the request lock (taken before any
      // catalog read), the transfer completes, then the approval runs and must see the new owner.
      const req = await call(`/public-handles/brand/${B.r1.id}/requests`, SELLER_A.token, 'POST', { handle: h('r1new') });
      check(is(req, 201), '13a former owner (seller A) submits a request', req.body);
      const rid = String(req.body.data?.id);
      const before = await handleRows(B.r1.id);
      await lockConn.query(`select pg_advisory_lock(hashtext($1))`, [`public_handles:request:${rid}`]);
      const approval = call(`/public-handles/admin/requests/${rid}/approve`, SA.token, 'POST', {});
      const blocked = await waitForBlocked();
      const xfer = await call(`/catalog/brands/${B.r1.id}`, SA.token, 'PATCH', { sellerId: u.sellerB.id });
      await lockConn.query(`select pg_advisory_unlock(hashtext($1))`, [`public_handles:request:${rid}`]);
      const ap = await approval;
      check(blocked && is(xfer, 200), '13a the approval was waiting while the transfer completed', { blocked, xfer: xfer.status });
      check(is(ap, 409, 'HANDLE_REQUESTER_NOT_OWNER'), '13a OUTCOME transfer-wins: approval refused (requester no longer owner)', ap.body);
      const after = await handleRows(B.r1.id);
      check(JSON.stringify(after) === JSON.stringify(before) && after.filter((r) => r.status === 'active').length === 1, '13a no partial write: same single active handle, no new row', { before, after });
      check((await rowsForHandle(h('r1new'))).length === 0, '13a the requested handle was not created');
      const rr = (await q(`select status from public_handle_requests where id=$1`, [rid]))[0];
      const ev = (await q(`select action from public_handle_events where request_id=$1 order by created_at, id`, [rid])).map((e) => e.action);
      check(rr.status === 'superseded' && ev.join() === 'request_submitted,request_superseded', '13a request superseded; no approval or rename events', { status: rr.status, ev });
      check(find(await brandsAs(SELLER_B.token), B.r1.id)?.publicHandle === h('r1a'), '13a the new owner sees the Brand with its unchanged handle');
      check(is(await call(`/public-handles/brand/${B.r1.id}/requests`, SELLER_A.token, 'POST', { handle: h('r1x') }), 403, 'HANDLE_FORBIDDEN'), '13a the former owner can no longer request');
    }
    {
      // 13b. Approval wins: the approval passes its ownership check, then waits on the
      // Brand's active-handle row (locked by the probe); the transfer completes during
      // that window; the approval then commits with the ownership it verified.
      const req = await call(`/public-handles/brand/${B.r2.id}/requests`, SELLER_A.token, 'POST', { handle: h('r2new') });
      check(is(req, 201), '13b seller A submits a request', req.body);
      const rid = String(req.body.data?.id);
      await lockConn.query('begin');
      await lockConn.query(`select id from public_handles where entity_type='brand' and entity_id=$1 and status='active' for update`, [B.r2.id]);
      const approval = call(`/public-handles/admin/requests/${rid}/approve`, SA.token, 'POST', {});
      const blocked = await waitForBlocked();
      const xfer = await call(`/catalog/brands/${B.r2.id}`, SA.token, 'PATCH', { sellerId: u.sellerB.id });
      await lockConn.query('commit');
      const ap = await approval;
      check(blocked && is(xfer, 200), '13b the transfer completed while the approval held its ownership check', { blocked, xfer: xfer.status });
      check(is(ap, 200) && ap.body.data?.previousHandle === h('r2a'), '13b OUTCOME approval-wins: approval committed (renamed r2a → r2new)', ap.body);
      const after = await handleRows(B.r2.id);
      check(
        JSON.stringify(after) === JSON.stringify([{ handle: h('r2a'), status: 'retired' }, { handle: h('r2new'), status: 'active' }]),
        '13b exactly one active handle, still keyed by the Brand; the old one retired',
        after,
      );
      const rr = (await q(`select status, decided_by_user_id from public_handle_requests where id=$1`, [rid]))[0];
      const ev = (await q(`select action from public_handle_events where request_id=$1 order by created_at, id`, [rid])).map((e) => e.action);
      check(rr.status === 'approved' && rr.decided_by_user_id === SA.uid && ev.join() === 'request_submitted,request_approved,renamed', '13b request approved by the Super Admin; complete history', { rr, ev });
      check(find(await brandsAs(SELLER_B.token), B.r2.id)?.publicHandle === h('r2new'), '13b after the transfer the NEW owner sees the Brand with the approved handle');
      check(!find(await brandsAs(SELLER_A.token), B.r2.id), '13b the former owner no longer sees the Brand');
      check(is(await call(`/public-handles/brand/${B.r2.id}/requests`, SELLER_A.token, 'POST', { handle: h('r2x') }), 403, 'HANDLE_FORBIDDEN'), '13b the former owner can no longer request');
      check(is(await call(`/catalog/brands/${B.r2.id}`, SELLER_B.token, 'PATCH', { slug: h('r2slug') }), 409, 'HANDLE_SLUG_LOCKED'), '13b the new owner is bound by the slug lock');
    }

    // ── 14. Partner-application flow (real POST /auth/partner-apply) ──
    const apply = (type: 'seller' | 'creator', key: string, businessName: string) =>
      call('/auth/partner-apply', null, 'POST', {
        applicantType: type,
        email: `c3.pa-${key}.${sfx}@probe.local`,
        password: `PartnerApply!${sfx}`,
        displayName: `C3 Applicant ${key}`,
        phone: '01700000000',
        businessOrChannelName: businessName,
        category: 'General',
        city: 'Dhaka',
      });
    const provisioned = async (key: string) =>
      (await q<{ provisioned_user_id: string | null; catalog_entity_id: string | null }>(
        `select provisioned_user_id, catalog_entity_id from partner_applications where email=$1`,
        [`c3.pa-${key}.${sfx}@probe.local`],
      ))[0];
    applicantEmails.push(...['s1', 's2', 'c1', 'off'].map((k) => `c3.pa-${k}.${sfx}@probe.local`));
    {
      const handlesBefore = (await q(`select count(*)::int n from public_handles`))[0].n;
      const ownersBefore = JSON.stringify(await q(`select handle, entity_type, entity_id, status from public_handles where handle in ($1, $2) order by handle`, [h('pab'), h('pac')]));
      const s1 = await apply('seller', 's1', `Pab ${sfx}`);
      const p1 = await provisioned('s1');
      check(is(s1, 201) && p1?.provisioned_user_id && p1?.catalog_entity_id, '14 seller application accepted (user + Brand draft provisioned)', { body: s1.body, p1 });
      const s1Brand = find(await brandsAs(SA.token), String(p1?.catalog_entity_id));
      check(s1Brand?.sellerId === p1?.provisioned_user_id, '14 the provisioned Brand belongs to the new seller');
      check(s1Brand && s1Brand.slug !== h('pab') && String(s1Brand.slug).startsWith(h('pab')), '14 the provisioned Brand draft avoids another Brand’s handle as its slug', s1Brand?.slug);
      check(s1Brand?.publicHandle === null, '14 the provisioned Brand gets no handle automatically');
      const c1 = await apply('creator', 'c1', `Pac ${sfx}`);
      const pc1 = await provisioned('c1');
      const c1Creator = find(await creatorsAs(SA.token), String(pc1?.catalog_entity_id));
      check(is(c1, 201) && c1Creator && c1Creator.slug !== h('pac') && String(c1Creator.slug).startsWith(h('pac')), '14 the provisioned Creator draft avoids another Creator’s handle as its slug', { status: c1.status, slug: c1Creator?.slug });
      check(c1Creator?.publicHandle === null, '14 the provisioned Creator gets no handle automatically');
      const s2 = await apply('seller', 's2', `Pac ${sfx}`);
      const s2Brand = find(await brandsAs(SA.token), String((await provisioned('s2'))?.catalog_entity_id));
      check(is(s2, 201) && s2Brand?.slug === h('pac'), '14 a Brand slug may equal a CREATOR handle (separate URL spaces)', s2Brand?.slug);
      check((await q(`select count(*)::int n from public_handles`))[0].n === handlesBefore, '14 the applications created no handle rows');
      check(
        JSON.stringify(await q(`select handle, entity_type, entity_id, status from public_handles where handle in ($1, $2) order by handle`, [h('pab'), h('pac')])) === ownersBefore,
        '14 existing handle ownership is unchanged',
      );
      const brandsBefore = (await brandsAs(SA.token)).length;
      const dup = await apply('seller', 's1', `Pab ${sfx}`);
      check(dup.status === 409 && (await brandsAs(SA.token)).length === brandsBefore, '14 a duplicate application is refused and creates no Brand', { status: dup.status, code: dup.body.code });
    }

    // ── 7. Handle store unavailable (run last: it takes the table offline briefly) ──
    {
      await q(`alter table public_handles rename to public_handles_probe_offline`);
      renamedTable = true;
      const brands = await call('/catalog/brands', null);
      const item = ((brands.body.data || []) as Array<Record<string, any>>).find((b) => b.id === B.a.id);
      check(brands.status === 200 && item && !('publicHandle' in item), '7 catalog reads still succeed without handles (field omitted → slug URLs)', { status: brands.status });
      const junk = ((brands.body.data || []) as Array<Record<string, any>>).find((b) => b.id === B.junk.id);
      check(junk && !('publicHandle' in junk), '7 …and a publicHandle stored in catalog data is removed, never passed through', junk?.publicHandle);
      const write = await call(`/catalog/brands/${B.b.id}`, SA.token, 'PATCH', { slug: h('offline') });
      check(is(write, 503, 'HANDLES_UNAVAILABLE') && !/relation|does not exist|public_handles/i.test(String(write.body.error)), '7 a slug write fails closed with 503 HANDLES_UNAVAILABLE (no internal detail)', write.body);
      const off = await call('/auth/partner-apply', null, 'POST', {
        applicantType: 'seller', email: `c3.pa-off.${sfx}@probe.local`, password: `PartnerApply!${sfx}`, displayName: 'C3 Applicant off',
        phone: '01700000000', businessOrChannelName: `Paoff ${sfx}`, category: 'General', city: 'Dhaka',
      });
      const offApp = (await q(`select status, provisioned_user_id, catalog_entity_id from partner_applications where email=$1`, [`c3.pa-off.${sfx}@probe.local`]))[0];
      const offBrand = offApp?.catalog_entity_id ? (await call(`/catalog/brands`, SA.token)).body.data?.find((b: Record<string, any>) => b.id === offApp.catalog_entity_id) : null;
      check(
        is(off, 201) && offApp?.provisioned_user_id && offBrand && offBrand.sellerId === offApp.provisioned_user_id && String(offBrand.slug).startsWith(`paoff-${sfx}-`),
        '7 partner application during a handle-store outage completes (user, application and Brand; slug suffixed, no half-provisioned applicant)',
        { status: off.status, offApp, slug: offBrand?.slug },
      );
      await q(`alter table public_handles_probe_offline rename to public_handles`);
      renamedTable = false;
      check(find(await brandsAs(null), B.a.id)?.publicHandle === h('ha2'), '7 handles return as soon as the store is back');
    }

    check(requestCount < 280, `budget: ${requestCount} API requests (< 300 public rate-limit budget)`);
  } finally {
    if (renamedTable) await db.query(`alter table public_handles_probe_offline rename to public_handles`).catch(() => undefined);
    await lockConn.query('rollback').catch(() => undefined);
    await lockConn.end().catch(() => undefined);
    if (applicantEmails.length) {
      const ids = (await db.query(`select id from users where email = any($1::text[])`, [applicantEmails])).rows.map((r) => r.id);
      await db.query(`delete from partner_applications where email = any($1::text[])`, [applicantEmails]).catch(() => undefined);
      if (ids.length) await db.query(`delete from users where id = any($1::uuid[])`, [ids]).catch((e) => console.log('applicant cleanup:', e.message));
      const leftApplicants = (await db.query(`select count(*)::int n from users where email = any($1::text[])`, [applicantEmails])).rows[0]?.n;
      check(leftApplicants === 0, 'cleanup: partner-application accounts deleted');
    }
    for (const c of injected) await db.query(`alter table public_handle_events drop constraint if exists ${c}`).catch(() => undefined);
    child.kill();
    if (tempUsers.length) await db.query(`delete from users where id = any($1::uuid[])`, [tempUsers]).catch(() => undefined);
    const left = (await db.query(`select count(*)::int n from users where id = any($1::uuid[])`, [tempUsers])).rows[0]?.n;
    check(left === 0, 'cleanup: temporary accounts deleted');
    const tableOk = (await db.query(`select to_regclass('public.public_handles') is not null as ok`)).rows[0]?.ok;
    check(tableOk, 'cleanup: public_handles table is in place');
    await db.end();
  }

  console.log(`\n${fails.length === 0 ? 'PASS' : 'FAIL'} probe-public-handle-catalog (${passes} passed, ${fails.length} failed)`);
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
