/**
 * Phase C.1 — Studio write atomicity: check/write races, the atomic Product
 * Studio save, and authorization-before-version ordering.
 *
 * LOCAL + ISOLATED ONLY: part L needs nothing; parts R/S/Z need an Admin dev
 * server (PROBE_BASE_URL_ROOT, default http://localhost:3001) against a
 * DISPOSABLE local database, also given in PROBE_DISPOSABLE_DATABASE_URL
 * (127.0.0.1 / localhost). Refuses otherwise. Creates "PC1 …" records in the
 * disposable catalog; its throwaway users and brands are deleted at the end.
 *
 *  L  record lock (pure): check → await I/O → write, run concurrently
 *     L1 without the lock several writers pass the same check (control: the race is real)
 *     L2 with the lock exactly one passes; L3 opposite key orders do not deadlock;
 *     L4 a throwing holder releases the lock
 *  R  every guarded Studio write endpoint, N requests fired together with the SAME
 *     expected version: exactly one 200, the rest 409 STALE_WRITE, and the stored
 *     record is the winner's (incl. Brand + Creator PUT/PATCH WITH slug changes)
 *  S  POST /catalog/products/:id/studio-save (product + detail in one operation)
 *     S1 success writes both halves, keeps unrelated fields, returns both versions
 *     S2 stale product version → 409, neither half written
 *     S3 stale detail version → 409, neither half written
 *     S4 competing writes fired while the save validates: never half of it stored
 *     S5 a refused detail half (403) → product half not written either
 *     S6 a refused product half (403 brand change) → detail half not written either
 *  Z  authorization before the version check (stale header + forbidden change → 403)
 *     Z1 product brand change to an unowned brand; Z2 related-info edit while locked;
 *     Z3 Guide publisher claimed by a creator account; Z4 a seller's coerced publisher
 *     with a stale version → 409 and nothing written
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-studio-atomicity.ts
 */
import argon2 from 'argon2';
import pg from 'pg';
import { withRecordLocks } from '../server/catalog/recordLock';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const IMG = 'https://example.invalid/pc1.jpg';
const V = 'X-Expected-Updated-At';
const VD = 'X-Expected-Detail-Updated-At';
const N = 8;

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 400));
}
type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const data = (r: Res, what: string) => {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return (r.body.data ?? r.body) as any;
};
async function apiLogin(email: string, password: string) {
  const r = await call('/auth/login', null, 'POST', { email, password });
  if (!r.body.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return String(r.body.accessToken);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statuses = (rs: Res[]) => rs.map((r) => (r.status === 409 ? `409:${r.body?.code}` : String(r.status))).join(',');

// ════════ L — the lock itself (deterministic, no server) ════════
async function partL() {
  console.log('\n── L: record lock ──');
  const race = async (locked: boolean) => {
    let version = 0;
    let winners = 0;
    const one = async (expected: number) => {
      const body = async () => {
        if (version !== expected) return; // version check
        await sleep(5); // the I/O that used to separate check and write
        version += 1; // write
        winners += 1;
      };
      if (locked) await withRecordLocks(['brand:x'], body);
      else await body();
    };
    await Promise.all(Array.from({ length: N }, () => one(0)));
    return winners;
  };
  const unlocked = await race(false);
  check(unlocked > 1, `L1 control: without the lock ${unlocked}/${N} writers pass the same version check`, unlocked);
  const locked = await race(true);
  check(locked === 1, `L2 with the lock exactly one of ${N} writers passes`, locked);
  const order: string[] = [];
  const ab = withRecordLocks(['product:p', 'productDetail:p'], async () => { order.push('ab'); await sleep(10); });
  const ba = withRecordLocks(['productDetail:p', 'product:p'], async () => { order.push('ba'); await sleep(10); });
  const done = await Promise.race([Promise.all([ab, ba]).then(() => true), sleep(2000).then(() => false)]);
  check(done && order.length === 2, 'L3 opposite key orders complete (no deadlock)', order);
  await withRecordLocks(['guide:g'], async () => { throw new Error('boom'); }).catch(() => undefined);
  const after = await Promise.race([withRecordLocks(['guide:g'], async () => true), sleep(1000).then(() => false)]);
  check(after === true, 'L4 a holder that throws releases the lock');
}

async function main() {
  await partL();

  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname) || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: database or server is not local.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
  if (!(await q(`select id from users where email='admin@choosify.com.bd'`))[0]) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }
  const sfx = Date.now().toString(36);
  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const users: string[] = [];
  const mkUser = async (tag: string, role: string) => {
    const pw = `Pc1${tag}!${sfx}`;
    const email = `pc1.${tag}.${sfx}@probe.local`;
    const [u] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,$4,true) returning id`,
      [email, await argon2.hash(pw), `PC1 ${tag} ${sfx}`, role],
    );
    users.push(u.id);
    return { id: u.id, token: await apiLogin(email, pw) };
  };
  const brandIds: string[] = [];

  try {
    // ── fixtures ──
    const seller = await mkUser('seller', 'seller');
    const mkBrand = async (name: string, extra: Record<string, unknown> = {}) => {
      const b = data(await call('/catalog/brands', SA, 'POST', { name, category: 'General', tagline: 'base tagline', website: 'https://base.example', ...extra }), 'brand');
      brandIds.push(b.id);
      return b;
    };
    const brand = await mkBrand(`PC1 Brand ${sfx}`);
    const sellerBrand = await mkBrand(`PC1 Seller Brand ${sfx}`, { sellerId: seller.id, marketplaceAccess: true, marketplaceStatus: 'granted' });
    const cats = data(await call('/catalog/categories', null), 'categories') as Array<{ id: string }>;
    let cat = '';
    for (const c of cats) {
      const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
      if (!((s.attributes ?? []) as Array<{ required?: boolean }>).some((a) => a.required)) {
        cat = c.id;
        break;
      }
    }
    const mkProduct = async (token: string, b: { id: string; name: string }, title: string) => {
      const p = data(await call('/catalog/products', token, 'POST', { title, brandId: b.id, brandName: b.name, categoryId: cat, image: IMG, gallery: [IMG], price: 100, stock: 5, description: 'base description' }), 'product');
      data(await call(`/catalog/product-details/${p.id}`, token, 'PUT', { about: 'base about', pros: ['base pro'] }), 'detail');
      return p;
    };
    const product = await mkProduct(SA, brand, `PC1 Product ${sfx}`);
    const getP = async (id = product.id, t = SA) => data(await call(`/catalog/products/${id}`, t), 'p');
    const getD = async (id = product.id, t = SA) => {
      const b = (await call(`/catalog/product-details/${id}`, t)).body;
      return b && b.productId ? b : (b?.data ?? null);
    };
    const creatorId = `creator-pc1-${sfx}`;
    data(await call(`/catalog/creators/${creatorId}`, SA, 'PUT', { id: creatorId, slug: creatorId, name: `PC1 Creator ${sfx}`, bio: 'base bio', location: 'base location' }), 'creator');
    const guide = data(await call('/catalog/guides', SA, 'POST', { title: `PC1 Guide ${sfx}`, excerpt: 'base excerpt', body: 'base body' }), 'guide');
    const listOne = async (list: string, id: string) => (data(await call(list, SA), list) as any[]).find((x) => x.id === id);
    const getBrand = () => listOne('/catalog/brands', brand.id);
    const getCreator = () => listOne('/catalog/creators', creatorId);
    const getGuide = async () => data(await call(`/catalog/guides/${guide.id}`, SA), 'g');

    // ════════ R — simultaneous requests with the same expected version ════════
    console.log(`\n── R: ${N} simultaneous saves per endpoint, same expected version ──`);
    type Race = {
      name: string;
      get: () => Promise<any>;
      fire: (i: number, rec: any, h: Record<string, string>) => Promise<Res>;
      stored: (rec: any) => string; // the field the racers wrote
      wrote: (i: number) => string; // what racer i wrote to it
      headers?: (rec: any) => Promise<Record<string, string>>;
    };
    const strip = (rec: any) => {
      const { updatedAt: _u, createdAt: _c, ...rest } = rec;
      return rest;
    };
    const races: Race[] = [
      { name: 'product PATCH', get: () => getP(), fire: (i, _r, h) => call(`/catalog/products/${product.id}`, SA, 'PATCH', { title: `PC1 race ${i} ${sfx}` }, h), stored: (r) => r.title, wrote: (i) => `PC1 race ${i} ${sfx}` },
      {
        name: 'product PATCH + detail version',
        get: () => getP(),
        headers: async () => ({ [VD]: (await getD()).updatedAt }),
        fire: (i, _r, h) => call(`/catalog/products/${product.id}`, SA, 'PATCH', { description: `race desc ${i}` }, h),
        stored: (r) => r.description,
        wrote: (i) => `race desc ${i}`,
      },
      { name: 'product-detail PUT', get: () => getD(), fire: (i, _r, h) => call(`/catalog/product-details/${product.id}`, SA, 'PUT', { about: `race about ${i}` }, h), stored: (r) => r.about, wrote: (i) => `race about ${i}` },
      { name: 'product-detail PATCH', get: () => getD(), fire: (i, _r, h) => call(`/catalog/product-details/${product.id}`, SA, 'PATCH', { about: `race patch about ${i}` }, h), stored: (r) => r.about, wrote: (i) => `race patch about ${i}` },
      { name: 'brand PATCH', get: getBrand, fire: (i, _r, h) => call(`/catalog/brands/${brand.id}`, SA, 'PATCH', { tagline: `race tagline ${i}` }, h), stored: (r) => r.tagline, wrote: (i) => `race tagline ${i}` },
      { name: 'brand PATCH with slug change', get: getBrand, fire: (i, _r, h) => call(`/catalog/brands/${brand.id}`, SA, 'PATCH', { slug: `pc1-brand-${sfx}-s${i}`, tagline: `slug race ${i}` }, h), stored: (r) => `${r.slug}|${r.tagline}`, wrote: (i) => `pc1-brand-${sfx}-s${i}|slug race ${i}` },
      { name: 'brand PUT', get: getBrand, fire: (i, rec, h) => call(`/catalog/brands/${brand.id}`, SA, 'PUT', { ...strip(rec), tagline: `put race ${i}` }, h), stored: (r) => r.tagline, wrote: (i) => `put race ${i}` },
      { name: 'brand PUT with slug change', get: getBrand, fire: (i, rec, h) => call(`/catalog/brands/${brand.id}`, SA, 'PUT', { ...strip(rec), slug: `pc1-brandput-${sfx}-s${i}`, tagline: `put slug ${i}` }, h), stored: (r) => `${r.slug}|${r.tagline}`, wrote: (i) => `pc1-brandput-${sfx}-s${i}|put slug ${i}` },
      { name: 'creator PATCH', get: getCreator, fire: (i, _r, h) => call(`/catalog/creators/${creatorId}`, SA, 'PATCH', { bio: `race bio ${i}` }, h), stored: (r) => r.bio, wrote: (i) => `race bio ${i}` },
      { name: 'creator PATCH with slug change', get: getCreator, fire: (i, _r, h) => call(`/catalog/creators/${creatorId}`, SA, 'PATCH', { slug: `pc1-creator-${sfx}-s${i}`, bio: `slug bio ${i}` }, h), stored: (r) => `${r.slug}|${r.bio}`, wrote: (i) => `pc1-creator-${sfx}-s${i}|slug bio ${i}` },
      { name: 'creator PUT', get: getCreator, fire: (i, rec, h) => call(`/catalog/creators/${creatorId}`, SA, 'PUT', { ...strip(rec), bio: `put bio ${i}` }, h), stored: (r) => r.bio, wrote: (i) => `put bio ${i}` },
      { name: 'creator PUT with slug change', get: getCreator, fire: (i, rec, h) => call(`/catalog/creators/${creatorId}`, SA, 'PUT', { ...strip(rec), slug: `pc1-creatorput-${sfx}-s${i}`, bio: `put slug bio ${i}` }, h), stored: (r) => `${r.slug}|${r.bio}`, wrote: (i) => `pc1-creatorput-${sfx}-s${i}|put slug bio ${i}` },
      { name: 'guide PATCH', get: getGuide, fire: (i, _r, h) => call(`/catalog/guides/${guide.id}`, SA, 'PATCH', { excerpt: `race excerpt ${i}` }, h), stored: (r) => r.excerpt, wrote: (i) => `race excerpt ${i}` },
      { name: 'guide PUT', get: getGuide, fire: (i, rec, h) => call(`/catalog/guides/${guide.id}`, SA, 'PUT', { ...strip(rec), excerpt: `put excerpt ${i}` }, h), stored: (r) => r.excerpt, wrote: (i) => `put excerpt ${i}` },
      {
        name: 'product studio-save',
        get: () => getP(),
        headers: async () => ({ [VD]: (await getD()).updatedAt }),
        fire: (i, _r, h) => call(`/catalog/products/${product.id}/studio-save`, SA, 'POST', { product: { title: `PC1 studio ${i} ${sfx}` }, detail: { about: `studio about ${i}` } }, h),
        stored: (r) => r.title,
        wrote: (i) => `PC1 studio ${i} ${sfx}`,
      },
    ];
    for (const race of races) {
      // Two passes: a pair (the exact "two requests" case) and a burst of N.
      for (const n of [2, N]) {
        try {
          const rec = await race.get();
          const extra = race.headers ? await race.headers(rec) : {};
          const hdr = { [V]: rec.updatedAt, ...extra };
          const fired = Array.from({ length: n }, (_, i) => i);
          // All in flight together, every racer carrying the same expected version(s).
          const rs = await Promise.all(fired.map((i) => race.fire(i, rec, hdr)));
          const ok = rs.filter((r) => r.status === 200);
          const stale = rs.filter((r) => r.status === 409 && r.body?.code === 'STALE_WRITE');
          const after = await race.get();
          const winner = fired.find((i) => rs[i].status === 200);
          check(ok.length === 1 && stale.length === n - 1, `R ${race.name} ×${n}: exactly one 200, ${n - 1}× 409 STALE_WRITE`, statuses(rs));
          check(winner !== undefined && race.stored(after) === race.wrote(winner), `R ${race.name} ×${n}: the stored record is the winner’s`, { stored: race.stored(after), winner });
        } catch (e) {
          check(false, `R ${race.name} ×${n} threw`, e instanceof Error ? e.message : String(e));
        }
      }
    }
    // ════════ S — atomic Product Studio save ════════
    console.log('\n── S: atomic Product Studio save ──');
    const save = (body: unknown, h: Record<string, string>, t = SA, id = product.id) => call(`/catalog/products/${id}/studio-save`, t, 'POST', body, h);
    {
      const p0 = await getP();
      const d0 = await getD();
      const r = await save({ product: { title: `PC1 S1 ${sfx}` }, detail: { about: 'S1 about' } }, { [V]: p0.updatedAt, [VD]: d0.updatedAt });
      const p1 = await getP();
      const d1 = await getD();
      check(r.status === 200 && p1.title === `PC1 S1 ${sfx}` && d1.about === 'S1 about', 'S1 both halves written', { status: r.status, title: p1.title, about: d1.about });
      check(p1.description === p0.description && p1.price === p0.price && JSON.stringify(d1.pros) === JSON.stringify(d0.pros), 'S1 unrelated product + detail fields kept', { desc: p1.description, pros: d1.pros });
      check(r.body?.data?.product?.updatedAt === p1.updatedAt && r.body?.data?.detail?.updatedAt === d1.updatedAt && p1.updatedAt !== p0.updatedAt && d1.updatedAt !== d0.updatedAt,
        'S1 response carries both new versions', r.body?.data && { p: r.body.data.product?.updatedAt, d: r.body.data.detail?.updatedAt });
    }
    {
      const p0 = await getP();
      const d0 = await getD();
      const r = await save({ product: { title: 'S2 must not land' }, detail: { about: 'S2 must not land' } }, { [V]: 'stale-product-version', [VD]: d0.updatedAt });
      const p1 = await getP();
      const d1 = await getD();
      check(r.status === 409 && r.body?.code === 'STALE_WRITE' && p1.updatedAt === p0.updatedAt && d1.updatedAt === d0.updatedAt && p1.title === p0.title && d1.about === d0.about,
        'S2 stale PRODUCT version → 409, neither half written', { status: r.status, title: p1.title, about: d1.about });
    }
    {
      const p0 = await getP();
      const d0 = await getD();
      const r = await save({ product: { title: 'S3 must not land' }, detail: { about: 'S3 must not land' } }, { [V]: p0.updatedAt, [VD]: 'stale-detail-version' });
      const p1 = await getP();
      const d1 = await getD();
      check(r.status === 409 && r.body?.code === 'STALE_WRITE' && p1.updatedAt === p0.updatedAt && d1.updatedAt === d0.updatedAt && p1.title === p0.title && d1.about === d0.about,
        'S3 stale DETAIL version → 409, neither half written', { status: r.status, title: p1.title, about: d1.about });
    }
    {
      // S4: competing single-record writes land while the save is validating
      // (fired 0–13 ms after it — or, for negative values, that long BEFORE it —
      // same versions). Whatever wins, the stored pair must never contain exactly
      // one half of the Studio save.
      const delays = [0, 0, 1, 2, 3, 5, 8, 13, -1, -2, -4, -8, 0, 1, 2, 4];
      let halves = 0;
      let both = 0;
      let none = 0;
      let doubleWins = 0;
      for (const [k, ms] of delays.entries()) {
        const p0 = await getP();
        const d0 = await getD();
        const X = `PC1 S4 save ${k} ${sfx}`;
        const Y = `S4 save about ${k}`;
        const fireSave = () => save({ product: { title: X }, detail: { about: Y } }, { [V]: p0.updatedAt, [VD]: d0.updatedAt });
        const fireRivals = () => [
          call(`/catalog/product-details/${product.id}`, SA, 'PUT', { about: `S4 rival about ${k}` }, { [V]: d0.updatedAt }),
          call(`/catalog/products/${product.id}`, SA, 'PATCH', { title: `PC1 S4 rival ${k} ${sfx}` }, { [V]: p0.updatedAt }),
        ];
        let saveP: Promise<Res>;
        let rivals: Promise<Res>[];
        if (ms >= 0) {
          saveP = fireSave();
          await sleep(ms);
          rivals = fireRivals();
        } else {
          rivals = fireRivals();
          await sleep(-ms);
          saveP = fireSave();
        }
        const [rs, rd, rp] = await Promise.all([saveP, ...rivals]);
        const p1 = await getP();
        const d1 = await getD();
        const hasX = p1.title === X;
        const hasY = d1.about === Y;
        if (hasX !== hasY) halves += 1;
        if (rs.status === 200) {
          if (hasX && hasY && rd.status === 409 && rp.status === 409) both += 1;
          else halves += 1;
        } else if (rs.status === 409) {
          if (!hasX && !hasY) none += 1;
          else halves += 1;
        } else halves += 1;
        if (rs.status === 200 && (rd.status === 200 || rp.status === 200)) doubleWins += 1;
      }
      check(halves === 0 && doubleWins === 0, `S4 ${delays.length} rounds with competing writes mid-save: never half a save, never two winners (save won ${both}, lost ${none})`, { halves, doubleWins, both, none });
    }
    // S5 / S6 — seller-owned product; a refused half means nothing is written.
    const sp = await mkProduct(seller.token, sellerBrand, `PC1 Seller Product ${sfx}`);
    data(await call(`/catalog/product-details/${sp.id}/related-info/admin`, SA, 'PUT', { relatedInfoLockedByAdmin: true }), 'lock related info');
    check((await getD(sp.id, SA))?.relatedInfoLockedByAdmin === true, 'setup: related information admin-locked on the seller product');
    {
      const p0 = await getP(sp.id, seller.token);
      const d0 = await getD(sp.id, seller.token);
      const r = await save({ product: { title: 'S5 must not land' }, detail: { relatedInfoType: 'before_your_visit' } }, { [V]: p0.updatedAt, [VD]: d0.updatedAt }, seller.token, sp.id);
      const p1 = await getP(sp.id, seller.token);
      const d1 = await getD(sp.id, seller.token);
      check(r.status === 403 && p1.updatedAt === p0.updatedAt && p1.title === p0.title && d1.updatedAt === d0.updatedAt,
        'S5 refused detail half (related info locked, 403) → product half not written', { status: r.status, title: p1.title });
    }
    {
      const p0 = await getP(sp.id, seller.token);
      const d0 = await getD(sp.id, seller.token);
      const r = await save({ product: { brandId: brand.id, brandName: brand.name }, detail: { about: 'S6 must not land' } }, { [V]: p0.updatedAt, [VD]: d0.updatedAt }, seller.token, sp.id);
      const p1 = await getP(sp.id, seller.token);
      const d1 = await getD(sp.id, seller.token);
      check(r.status === 403 && p1.brandId === sellerBrand.id && d1.about === d0.about && d1.updatedAt === d0.updatedAt,
        'S6 refused product half (brand not owned, 403) → detail half not written', { status: r.status, brandId: p1.brandId, about: d1.about });
    }

    // ════════ Z — authorization precedes the version check ════════
    console.log('\n── Z: authorization before version ──');
    {
      const r = await call(`/catalog/products/${sp.id}`, seller.token, 'PATCH', { brandId: brand.id, brandName: brand.name }, { [V]: 'stale' });
      check(r.status === 403, 'Z1 product PATCH: brand change to an unowned brand with a stale version → 403 (not 409)', r);
      const s = await save({ product: { brandId: brand.id, brandName: brand.name } }, { [V]: 'stale' }, seller.token, sp.id);
      check(s.status === 403, 'Z1 studio-save: same → 403 (not 409)', s);
    }
    {
      const put = await call(`/catalog/product-details/${sp.id}`, seller.token, 'PUT', { relatedInfoType: 'whats_nearby' }, { [V]: 'stale' });
      const patch = await call(`/catalog/product-details/${sp.id}`, seller.token, 'PATCH', { relatedInfoType: 'whats_nearby' }, { [V]: 'stale' });
      const s = await save({ detail: { relatedInfoType: 'whats_nearby' } }, { [VD]: 'stale' }, seller.token, sp.id);
      check(put.status === 403 && patch.status === 403 && s.status === 403, 'Z2 related-info edit while admin-locked with a stale version → 403 (detail PUT, detail PATCH, studio-save)', [put.status, patch.status, s.status]);
    }
    {
      // Z3: a creator account claiming a brand publisher it does not own.
      const creatorUser = await mkUser('creator', 'creator');
      const own = await call('/catalog/guides', creatorUser.token, 'POST', { title: `PC1 Creator Guide ${sfx}`, excerpt: 'x', body: 'x' });
      if (own.status >= 300) {
        console.log(`  (skip) Z3: a creator account cannot create a guide here (HTTP ${own.status}) — case not reachable`);
      } else {
        const g = own.body.data;
        const r = await call(`/catalog/guides/${g.id}`, creatorUser.token, 'PATCH', { publisherType: 'brand', publisherBrandId: brand.id }, { [V]: 'stale' });
        check(r.status === 403, 'Z3 guide PATCH: creator claims an unowned brand publisher with a stale version → 403 (not 409)', r);
      }
    }
    {
      // Z4: a seller's publisher is coerced to a brand it owns; with a stale version nothing is written.
      const sg = data(await call('/catalog/guides', seller.token, 'POST', { title: `PC1 Seller Guide ${sfx}`, excerpt: 'seller excerpt', body: 'x', publisherType: 'brand', publisherBrandId: sellerBrand.id }), 'seller guide');
      const before = data(await call(`/catalog/guides/${sg.id}`, SA), 'g');
      const r = await call(`/catalog/guides/${sg.id}`, seller.token, 'PATCH', { publisherBrandId: brand.id, excerpt: 'Z4 must not land' }, { [V]: 'stale' });
      const after = data(await call(`/catalog/guides/${sg.id}`, SA), 'g');
      check(r.status === 409 && after.updatedAt === before.updatedAt && after.excerpt === before.excerpt && after.publisherBrandId === sellerBrand.id,
        'Z4 seller guide: coerced publisher + stale version → 409, nothing written, publisher still the owned brand', { status: r.status, pub: after.publisherBrandId });
    }
    {
      // A5 regression: a non-owner still gets 403 on every guarded endpoint.
      const other = await mkUser('other', 'seller');
      const rs = [
        await call(`/catalog/products/${product.id}`, other.token, 'PATCH', { title: 'x' }, { [V]: 'stale' }),
        await call(`/catalog/products/${product.id}/studio-save`, other.token, 'POST', { product: { title: 'x' } }, { [V]: 'stale' }),
        await call(`/catalog/product-details/${product.id}`, other.token, 'PUT', { about: 'x' }, { [V]: 'stale' }),
        await call(`/catalog/brands/${brand.id}`, other.token, 'PATCH', { tagline: 'x' }, { [V]: 'stale' }),
        await call(`/catalog/guides/${guide.id}`, other.token, 'PATCH', { excerpt: 'x' }, { [V]: 'stale' }),
      ];
      check(rs.every((r) => r.status === 403), 'Z5 non-owner with a stale version → 403 on product PATCH, studio-save, detail PUT, brand PATCH, guide PATCH', rs.map((r) => r.status));
    }
  } catch (e) {
    check(false, 'probe step threw', e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA, 'DELETE').catch(() => undefined);
    for (const id of users) await q(`delete from users where id=$1`, [id]).catch(() => undefined);
    await db.end();
  }
  console.log(`\n${FAIL.length ? 'FAIL' : 'PASS'} probe-studio-atomicity (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) {
    for (const f of FAIL) console.log('  -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
