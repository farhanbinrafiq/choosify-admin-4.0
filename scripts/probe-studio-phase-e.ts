/**
 * Phase E — four-Studio business rules (E1–E5).
 *
 * LOCAL + ISOLATED ONLY: part U needs nothing; the rest needs an Admin dev server
 * (PROBE_BASE_URL_ROOT, default http://localhost:3001) against a DISPOSABLE local
 * database, also given in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost).
 * Refuses otherwise. Creates "PE …" records; its throwaway users and brands are
 * deleted at the end (products / guides / creators stay in the disposable catalog).
 *
 *  U  pure: which Studio pages stay open while Marketplace Access is pending; the
 *     pending state + next step for under-review / approved / rejected / resubmit
 *  E1 guide publish never changes the author's Creator profile; a creator-authored
 *     guide publishes only once that profile is live (409 CREATOR_PROFILE_NOT_LIVE)
 *  E2 creator states: draft (pending) / live (granted) / unpublished / archived —
 *     what the creator can edit and publish; Creator Studio opens with guidance
 *  E3 first Brand: creation locks Marketplace Access; own Brand stays editable (API +
 *     Studio), more brands / products stay locked; after the Super Admin grant all opens
 *  E4 Products list: live/in-stock, live/zero, draft/zero, archived/zero, Out of Stock
 *     lifecycle — Status column = lifecycle, stock shown separately, switch + filters
 *  E5 variant product with on-hand + reservations: unrelated saves (combined Studio
 *     save, detail PUT changed-only and full payload, product PATCH) leave on-hand,
 *     reserved and available unchanged; an explicit Stock change still applies
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-studio-phase-e.ts
 */
import argon2 from 'argon2';
import pg from 'pg';
import { chromium, type Browser, type Page } from 'playwright-core';
import { identityStudioEditPath, nextStepOf, pendingStateOf } from '../src/components/marketplacePendingState';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const IMG = 'https://example.invalid/pe.jpg';
const V = 'X-Expected-Updated-At';
const VD = 'X-Expected-Detail-Updated-At';

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
const me = async (t: string) => {
  const b = (await call('/auth/me', t)).body;
  return (b.data ?? b.user ?? b) as { marketplaceAccess?: boolean; partnerApplicationStatus?: string | null };
};
const strip = (x: any) => JSON.stringify(x);

function partU() {
  console.log('\n── U: pending-access rules (pure) ──');
  check(identityStudioEditPath('seller', '/admin/brand-studio/b1/edit') && identityStudioEditPath('creator', '/admin/creator-studio/c1/edit'),
    'U1 own Brand (seller) / Creator (creator) Studio edit pages stay open while access is pending');
  check(!identityStudioEditPath('seller', '/admin/brand-studio/new') && !identityStudioEditPath('creator', '/admin/creator-studio/new'),
    'U2 creating another brand / creator profile stays locked');
  check(!identityStudioEditPath('seller', '/admin/products/p1/edit') && !identityStudioEditPath('seller', '/admin/products/new') && !identityStudioEditPath('seller', '/admin/creator-studio/c1/edit') && !identityStudioEditPath('creator', '/admin/brand-studio/b1/edit') && !identityStudioEditPath('admin', '/admin/brand-studio/b1/edit'),
    'U3 products, the other role’s Studio and non-partner roles are not opened by this rule');
  const states = [
    [pendingStateOf({ partnerApplicationStatus: 'pending' }), 'under_review'],
    [pendingStateOf({ partnerApplicationStatus: null }), 'under_review'],
    [pendingStateOf({ partnerApplicationStatus: 'approved' }), 'awaiting_activation'],
    [pendingStateOf({ partnerApplicationStatus: 'rejected' }), 'rejected'],
    [pendingStateOf({ partnerApplicationStatus: 'approved', resubmissionRequested: true }), 'resubmit'],
  ];
  check(states.every(([a, b]) => a === b), 'U4 pending state: under review / no application / approved-awaiting / rejected / resubmission', states);
  const steps = (['under_review', 'awaiting_activation', 'rejected', 'resubmit'] as const).map((s) => nextStepOf(s));
  check(new Set(steps).size === 4 && steps.every((s) => s.startsWith('Next step:')), 'U5 every pending state has its own concrete next step', steps);
}

async function main() {
  partU();
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
  const brandIds: string[] = [];
  const mkUser = async (tag: string, role: string) => {
    const pw = `Pe${tag}!${sfx}`;
    const email = `pe.${tag}.${sfx}@probe.local`;
    const [u] = await q<{ id: string }>(
      `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,$4,true) returning id`,
      [email, await argon2.hash(pw), `PE ${tag} ${sfx}`, role],
    );
    users.push(u.id);
    return { id: u.id, token: await apiLogin(email, pw) };
  };
  const creatorsOf = async (userId: string) => (data(await call('/catalog/creators', SA), 'creators') as any[]).filter((c) => c.userId === userId);
  const creatorById = async (id: string) => (data(await call('/catalog/creators', SA), 'creators') as any[]).find((c) => c.id === id);
  const guideById = async (id: string) => data(await call(`/catalog/guides/${id}`, SA), 'guide');
  let browser: Browser | null = null;
  const pageFor = async (token: string): Promise<Page> => {
    browser ??= await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        if (!sessionStorage.getItem('pe')) {
          localStorage.setItem('choosify_auth_token', t as string);
          sessionStorage.setItem('pe', '1');
        }
      } catch {}
    }, token);
    return ctx.newPage();
  };
  const goto = async (p: Page, path: string) => {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(3500);
  };
  const text = async (p: Page) => (await p.locator('#root').innerText().catch(() => '')) || '';

  try {
    const cats = data(await call('/catalog/categories', null), 'categories') as Array<{ id: string }>;
    let cat = '';
    for (const c of cats) {
      const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
      if (!((s.attributes ?? []) as Array<{ required?: boolean }>).some((a) => a.required)) {
        cat = c.id;
        break;
      }
    }

    // ════════ E1 ════════
    console.log('\n── E1: guide publish vs Creator lifecycle ──');
    {
      const cu = await mkUser('creator1', 'creator');
      const g = data(await call('/catalog/guides', cu.token, 'POST', { title: `PE Creator Guide ${sfx}`, excerpt: 'pe excerpt', body: 'pe body' }), 'creator guide');
      const [cr] = await creatorsOf(cu.id);
      check(!!cr && cr.status === 'draft' && g.creatorId === cr.id, 'E1 setup: creator-authored guide, author profile is a draft', { cr: cr?.status, gc: g.creatorId });
      const before = await creatorById(cr.id);
      const accessBefore = (await me(cu.token)).marketplaceAccess;
      const pub = await call(`/catalog/guides/${g.id}/publish`, cu.token, 'POST');
      const after = await creatorById(cr.id);
      check(pub.status === 409 && pub.body?.code === 'CREATOR_PROFILE_NOT_LIVE' && /Creator profile is live/.test(String(pub.body?.error)),
        'E1.1 creator publishing a guide while their profile is a draft → 409 CREATOR_PROFILE_NOT_LIVE with the next step', pub);
      check(strip(after) === strip(before), 'E1.2 the Creator profile is byte-identical (status, updatedAt, every field)', { before: before?.status, after: after?.status });
      check((await guideById(g.id)).status === 'draft', 'E1.3 the guide stays a draft');
      check((await me(cu.token)).marketplaceAccess === accessBefore && accessBefore === false, 'E1.4 Marketplace Access is not unlocked by a guide publish', accessBefore);
      const staffPub = await call(`/catalog/guides/${g.id}/publish`, SA, 'POST');
      check(staffPub.status === 409 && strip(await creatorById(cr.id)) === strip(before), 'E1.5 staff publishing the same guide is refused too and changes no Creator field', staffPub.status);
      data(await call(`/catalog/creators/${cr.id}`, SA, 'PATCH', { status: 'live' }), 'grant creator');
      const live = await creatorById(cr.id);
      const pub2 = await call(`/catalog/guides/${g.id}/publish`, cu.token, 'POST');
      check(pub2.status === 200 && pub2.body?.data?.status === 'live', 'E1.6 once Choosify made the profile live, the creator publishes the guide', pub2.status);
      check(strip(await creatorById(cr.id)) === strip(live), 'E1.7 publishing the guide left the live Creator profile untouched');
      data(await call(`/catalog/creators/${cr.id}`, SA, 'PATCH', { status: 'draft' }), 'creator back to draft');
      check((await guideById(g.id)).status === 'live', 'E1.8 unpublishing the Creator profile does not change the live guide either');
      // brand-authored and editorial guides are unaffected
      const seller = await mkUser('e1seller', 'seller');
      const sb = data(await call('/catalog/brands', SA, 'POST', { name: `PE E1 Brand ${sfx}`, category: 'General', sellerId: seller.id, marketplaceAccess: true, marketplaceStatus: 'granted' }), 'seller brand');
      brandIds.push(sb.id);
      const bg = data(await call('/catalog/guides', seller.token, 'POST', { title: `PE Brand Guide ${sfx}`, excerpt: 'x', body: 'x', publisherType: 'brand', publisherBrandId: sb.id }), 'brand guide');
      const bgPub = await call(`/catalog/guides/${bg.id}/publish`, seller.token, 'POST');
      const eg = data(await call('/catalog/guides', SA, 'POST', { title: `PE Editorial Guide ${sfx}`, excerpt: 'x', body: 'x' }), 'editorial guide');
      const egPub = await call(`/catalog/guides/${eg.id}/publish`, SA, 'POST');
      check(bgPub.status === 200 && egPub.status === 200, 'E1.9 brand-authored and editorial guides publish as before', [bgPub.status, egPub.status, eg.creatorId]);
    }

    // ════════ E2 ════════
    console.log('\n── E2: Creator onboarding / publishing ──');
    {
      const cu = await mkUser('creator2', 'creator');
      const ens = data(await call('/catalog/workspace/creator/ensure', cu.token, 'POST', {}), 'ensure');
      const cr = (ens.creators ?? [])[0];
      check(!!cr && cr.status === 'draft' && (await me(cu.token)).marketplaceAccess === false, 'E2.1 new creator: draft profile, Marketplace Access pending', { status: cr?.status });
      const edit = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { bio: 'PE draft bio' });
      check(edit.status === 200 && (await creatorById(cr.id)).bio === 'PE draft bio', 'E2.2 draft (pending) creator can edit and save their own profile', edit.status);
      const selfPub = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { status: 'live' });
      check(selfPub.status === 200 && (await creatorById(cr.id)).status === 'draft', 'E2.3 draft (pending) creator cannot make the profile live — status held (existing rule, unchanged)', selfPub.body?.data?.status);

      // Browser: the Creator Studio opens with guidance (it used to be replaced by the lock panel).
      const p = await pageFor(cu.token);
      await goto(p, `/admin/creator-studio/${encodeURIComponent(cr.id)}/edit`);
      const notice = p.getByTestId('marketplace-pending-notice');
      const t1 = await text(p);
      check((await notice.count()) === 1 && /Next step:/.test(await notice.innerText()) && /only Choosify can make it live/i.test(await notice.innerText()),
        'E2.4 Creator Studio opens for a pending creator, with what is held and the next step', t1.slice(0, 200));
      check(!/MARKETPLACE ACCESS PENDING\s*\n?\s*UNDER REVIEW\s*\n?\s*Marketplace Access Pending/i.test(t1) && t1.includes(cr.name), 'E2.5 the Studio itself is shown (not the full-page lock)', t1.slice(0, 160));
      await goto(p, '/admin/creator-studio/new');
      const own = p.getByTestId('marketplace-own-studios');
      check((await p.getByTestId('marketplace-next-step').count()) === 1 && (await own.count()) === 1, 'E2.6 creating another profile stays locked, and the lock panel links back to the own profile');
      if (await own.count()) {
        await own.getByRole('link').first().click();
        await p.waitForTimeout(3000);
        check(new URL(p.url()).pathname === `/admin/creator-studio/${encodeURIComponent(cr.id)}/edit` || new URL(p.url()).pathname === `/admin/creator-studio/${cr.id}/edit`, 'E2.7 “Continue editing” opens the own Creator Studio', p.url());
      }
      await p.context().close();

      // granted (live) → creator controls the lifecycle; unpublished / archived → held again
      data(await call(`/catalog/creators/${cr.id}`, SA, 'PATCH', { status: 'live' }), 'grant');
      check((await me(cu.token)).marketplaceAccess === true, 'E2.8 Choosify making the profile live grants Marketplace Access');
      const p2 = await pageFor(cu.token);
      await goto(p2, `/admin/creator-studio/${encodeURIComponent(cr.id)}/edit`);
      check((await p2.getByTestId('marketplace-pending-notice').count()) === 0, 'E2.9 live creator: no pending notice');
      await p2.context().close();
      const unpub = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { status: 'draft' });
      check(unpub.status === 200 && (await creatorById(cr.id)).status === 'draft', 'E2.10 live creator can unpublish their own profile', unpub.status);
      const repub = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { status: 'live' });
      check(repub.status === 200 && (await creatorById(cr.id)).status === 'draft' && (await me(cu.token)).marketplaceAccess === false,
        'E2.11 once unpublished, re-publishing is held again (access follows a live profile — existing rule, reported)', (await creatorById(cr.id)).status);
      data(await call(`/catalog/creators/${cr.id}`, SA, 'PATCH', { status: 'archived' }), 'archive');
      const archEdit = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { bio: 'PE archived bio' });
      const archPub = await call(`/catalog/creators/${cr.id}`, cu.token, 'PATCH', { status: 'live' });
      const arch = await creatorById(cr.id);
      check(archEdit.status === 200 && archPub.status === 200 && arch.status === 'archived' && arch.bio === 'PE archived bio', 'E2.12 restricted (archived by Choosify): edits save, publishing stays held', { status: arch.status });
    }

    // ════════ E3 ════════
    console.log('\n── E3: first Brand and Marketplace Access ──');
    {
      const s = await mkUser('seller3', 'seller');
      check((await me(s.token)).marketplaceAccess === true, 'E3 setup: new seller without a brand has access (grandfathered)');
      const p = await pageFor(s.token);
      // first Brand created in the Studio
      await goto(p, '/admin/brand-studio/new');
      await p.getByRole('button', { name: 'Edit Brand Identity' }).click({ timeout: 30000 });
      const N = `PE First Brand ${sfx}`;
      await p.getByPlaceholder('e.g. Walton').fill(N);
      await p.getByRole('button', { name: 'Save Changes' }).first().click();
      await p.waitForURL((u) => /^\/admin\/brand-studio\/[^/]+\/edit$/.test(u.pathname), { timeout: 20000 }).catch(() => undefined);
      const bid = decodeURIComponent(/^\/admin\/brand-studio\/([^/]+)\/edit$/.exec(new URL(p.url()).pathname)?.[1] ?? '');
      if (bid) brandIds.push(bid);
      const mine = (data(await call('/catalog/brands', SA), 'brands') as any[]).find((b) => b.id === bid);
      check(!!mine && mine.sellerId === s.id && mine.marketplaceStatus !== 'granted', 'E3.1 first Brand created from the Studio (private, not granted)', { bid, ms: mine?.marketplaceStatus });
      check((await me(s.token)).marketplaceAccess === false, 'E3.2 creating the first Brand locks Marketplace Access (existing rule, unchanged)');
      // reload: the account is now locked — the own Brand Studio must still open
      await goto(p, `/admin/brand-studio/${encodeURIComponent(bid)}/edit`);
      const t = await text(p);
      check(t.includes(N) && (await p.getByTestId('marketplace-pending-notice').count()) === 1, 'E3.3 after reload the own Brand Studio still opens, with the pending notice (was: full-page lock)', t.slice(0, 200));
      // edit in the Studio while pending
      await p.getByRole('button', { name: 'Edit Brand Identity' }).click({ timeout: 30000 });
      await p.getByPlaceholder('e.g. Made in Bangladesh, Trusted Nationwide').fill(`PE pending tagline ${sfx}`);
      await p.getByRole('button', { name: 'Save Changes' }).first().click();
      await p.waitForTimeout(2500);
      const afterEdit = (data(await call('/catalog/brands', SA), 'brands') as any[]).find((b) => b.id === bid);
      check(afterEdit?.tagline === `PE pending tagline ${sfx}`, 'E3.4 editing the Brand while access is pending saves', afterEdit?.tagline);
      check(afterEdit?.marketplaceStatus === mine?.marketplaceStatus && afterEdit?.marketplaceAccess === mine?.marketplaceAccess, 'E3.5 editing never changes Marketplace Access');
      const forged = await call(`/catalog/brands/${bid}`, s.token, 'PATCH', { marketplaceStatus: 'granted' });
      check(forged.status === 403, 'E3.6 the seller still cannot grant themselves access (403)', forged.status);
      const second = await call('/catalog/brands', s.token, 'POST', { name: `PE Second ${sfx}`, category: 'General' });
      const prod = await call('/catalog/products', s.token, 'POST', { title: `PE pending product ${sfx}`, brandId: bid, categoryId: cat, price: 1 });
      check(second.status === 403 && prod.status === 403, 'E3.7 another brand and products stay locked while pending (403)', [second.status, prod.status]);
      await goto(p, '/admin/brand-studio/new');
      const own = p.getByTestId('marketplace-own-studios');
      check((await p.getByTestId('marketplace-next-step').count()) === 1 && (await own.count()) === 1 && (await own.innerText()).includes(N),
        'E3.8 “new brand” shows the lock panel with the next step and a link back to the own Brand');
      if (await own.count()) {
        await own.getByRole('link').first().click();
        await p.waitForTimeout(3000);
        check(new URL(p.url()).pathname.endsWith(`/${encodeURIComponent(bid)}/edit`) || new URL(p.url()).pathname.endsWith(`/${bid}/edit`), 'E3.9 “Continue editing” returns to the own Brand Studio', p.url());
      }
      await goto(p, '/admin/products/new');
      check((await p.getByTestId('marketplace-next-step').count()) === 1, 'E3.10 the Product Studio stays locked while pending');
      // Super Admin grant
      const grant = await call(`/catalog/brands/${bid}/marketplace-access`, SA, 'PATCH', { status: 'granted' });
      check(grant.status === 200 && (await me(s.token)).marketplaceAccess === true, 'E3.11 Super Admin grant enables Marketplace Access', grant.status);
      await goto(p, `/admin/brand-studio/${encodeURIComponent(bid)}/edit`);
      check((await p.getByTestId('marketplace-pending-notice').count()) === 0 && (await text(p)).includes(N), 'E3.12 after the grant the Brand Studio opens without the pending notice');
      await goto(p, '/admin/brand-studio/new');
      check((await p.getByTestId('marketplace-next-step').count()) === 0 && (await p.getByRole('button', { name: 'Edit Brand Identity' }).count()) === 1, 'E3.13 after the grant a new brand can be started');
      const v = (data(await call('/catalog/brands', SA), 'brands') as any[]).find((b) => b.id === bid).updatedAt;
      const editAfter = await call(`/catalog/brands/${bid}`, s.token, 'PATCH', { tagline: `PE granted tagline ${sfx}` }, { [V]: v });
      check(editAfter.status === 200, 'E3.14 editing after the grant works (with the Studio version header)', editAfter.status);
      await p.context().close();
    }

    // ════════ E4 ════════
    console.log('\n── E4: zero-stock lifecycle in the list ──');
    {
      // A seller with a granted Brand (the Products list the seller works in).
      const s4 = await mkUser('seller4', 'seller');
      const brand = data(await call('/catalog/brands', SA, 'POST', { name: `PE E4 Brand ${sfx}`, category: 'General', sellerId: s4.id, marketplaceAccess: true, marketplaceStatus: 'granted' }), 'brand');
      brandIds.push(brand.id);
      const T4 = s4.token;
      const mk = async (label: string, stock: number) =>
        data(await call('/catalog/products', T4, 'POST', { title: `PE4 ${label} ${sfx}`, brandId: brand.id, brandName: brand.name, categoryId: cat, image: IMG, gallery: [IMG], price: 10, stock, description: 'pe4' }), label);
      const liveIn = await mk('live-in', 5);
      const liveZero = await mk('live-zero', 0);
      const draftZero = await mk('draft-zero', 0);
      const archZero = await mk('archived-zero', 0);
      const oos = await mk('oos', 0);
      for (const id of [liveIn.id, liveZero.id, oos.id]) data(await call(`/catalog/products/${id}`, T4, 'PATCH', { status: 'live' }), 'publish');
      data(await call(`/catalog/products/${archZero.id}`, T4, 'PATCH', { status: 'archived' }), 'archive');
      data(await call(`/catalog/products/${oos.id}/inventory`, T4, 'PATCH', { delta: 0 }), 'oos sync');
      const server = async () => Object.fromEntries(await Promise.all([liveIn, liveZero, draftZero, archZero, oos].map(async (x) => {
        const p = data(await call(`/catalog/products/${x.id}`, SA), 'p');
        return [x.id, `${p.status}|${p.stock}`];
      })));
      const before = await server();
      check(before[liveIn.id] === 'live|5' && before[liveZero.id] === 'live|0' && before[draftZero.id] === 'draft|0' && before[archZero.id] === 'archived|0' && before[oos.id] === 'out_of_stock|0',
        'E4 setup: live/in-stock, live/zero, draft/zero, archived/zero, out_of_stock lifecycle', before);
      const p = await pageFor(T4);
      await goto(p, '/admin/products');
      await p.getByPlaceholder('Search products, brands, SKU or reference id…').fill(sfx);
      await p.waitForTimeout(1200);
      const row = (label: string) => p.locator('tr', { hasText: `PE4 ${label} ${sfx}` }).first();
      const status = async (label: string) => ((await row(label).getByTestId('product-row-status').textContent().catch(() => '')) ?? '').trim() /* textContent: the pill is upper-cased by CSS */;
      const note = async (label: string) => row(label).getByTestId('product-row-stock-note').count();
      await row('oos').waitFor({ timeout: 45000 }).catch(async () => console.log('  (debug) rows not found; page text:', (await text(p)).slice(0, 600).replace(/\n/g, ' | ')));
      const sw = async (label: string) => {
        const s = row(label).getByRole('switch');
        if (!(await s.count())) return { checked: null, disabled: null, row: (await row(label).innerText().catch(() => '')).replace(/\n/g, ' | ').slice(0, 200) };
        return { checked: await s.getAttribute('aria-checked'), disabled: await s.getAttribute('aria-disabled') };
      };
      const got = {
        liveIn: [await status('live-in'), await note('live-in'), await sw('live-in')],
        liveZero: [await status('live-zero'), await note('live-zero'), await sw('live-zero')],
        draftZero: [await status('draft-zero'), await note('draft-zero'), await sw('draft-zero')],
        archZero: [await status('archived-zero'), await note('archived-zero'), await sw('archived-zero')],
        oos: [await status('oos'), await note('oos'), await sw('oos')],
      };
      check(got.liveIn[0] === 'Active' && got.liveIn[1] === 0, 'E4.1 live/in-stock: Status Active, no stock note', got.liveIn);
      check(got.liveZero[0] === 'Active' && got.liveZero[1] === 1, 'E4.2 live/zero: Status Active (not Out of Stock / Draft) + “no stock” note', got.liveZero);
      check(got.draftZero[0] === 'Draft' && got.draftZero[1] === 0, 'E4.3 draft/zero: Status Draft', got.draftZero);
      check(got.archZero[0] === 'Archived' && got.archZero[1] === 0, 'E4.4 archived/zero: Status Archived', got.archZero);
      check(got.oos[0] === 'Out of Stock', 'E4.5 out_of_stock lifecycle: Status Out of Stock', got.oos);
      check((got.liveIn[2] as any).checked === 'true' && (got.liveZero[2] as any).checked === 'true' && (got.draftZero[2] as any).checked === 'false' && (got.archZero[2] as any).checked === 'false',
        'E4.6 publish switch: ON for live listings (with or without stock), OFF for draft / archived', got);
      check((got.oos[2] as any).checked === 'true' && (got.oos[2] as any).disabled === 'true', 'E4.7 Out of Stock listing: switch ON (published) and locked — only restock or Archive (server transition table)', got.oos[2]);
      const rowsShown = async () => Promise.all(['live-in', 'live-zero', 'draft-zero', 'archived-zero', 'oos'].map(async (l) => ((await row(l).count()) > 0 && (await row(l).isVisible()) ? l : '')));
      const selects = p.locator('select');
      const statusSel = selects.filter({ has: p.locator('option[value="Out of Stock"]') }).first();
      const stockSel = p.getByLabel('Filter by stock');
      await statusSel.selectOption('Active');
      await p.waitForTimeout(500);
      check(strip((await rowsShown()).filter(Boolean)) === strip(['live-in', 'live-zero']), 'E4.8 Status filter Active: both live listings', await rowsShown());
      await statusSel.selectOption('Out of Stock');
      await p.waitForTimeout(500);
      check(strip((await rowsShown()).filter(Boolean)) === strip(['oos']), 'E4.9 Status filter Out of Stock: the out_of_stock lifecycle only', await rowsShown());
      await statusSel.selectOption('All');
      await stockSel.selectOption('No stock');
      await p.waitForTimeout(500);
      check(strip((await rowsShown()).filter(Boolean)) === strip(['live-zero', 'draft-zero', 'archived-zero', 'oos']), 'E4.10 Stock filter No stock: every zero-stock product, whatever its status', await rowsShown());
      await stockSel.selectOption('In stock');
      await p.waitForTimeout(500);
      check(strip((await rowsShown()).filter(Boolean)) === strip(['live-in']), 'E4.11 Stock filter In stock', await rowsShown());
      await p.context().close();
      check(strip(await server()) === strip(before), 'E4.12 viewing / filtering changed no status or stock on the server', await server());
      // Studio: live with no stock states both facts
      const ps = await pageFor(T4);
      await goto(ps, `/admin/products/${liveZero.id}/edit`);
      const badge = await ps.getByTestId('product-status-badge').getAttribute('data-status');
      check(badge === 'LIVE' && (await ps.getByTestId('product-stock-note').count()) === 1, 'E4.13 Product Studio: live with no stock shows LIVE plus a no-stock note', badge);
      await goto(ps, `/admin/products/${liveIn.id}/edit`);
      check((await ps.getByTestId('product-stock-note').count()) === 0, 'E4.14 Product Studio: live with stock has no stock note');
      await ps.context().close();
      check(strip(await server()) === strip(before), 'E4.15 opening the Studio changed no status or stock');
    }

    // ════════ E5 ════════
    console.log('\n── E5: variant stock vs unrelated saves ──');
    {
      const brand = data(await call('/catalog/brands', SA, 'POST', { name: `PE E5 Brand ${sfx}`, category: 'General' }), 'brand');
      brandIds.push(brand.id);
      const p = data(await call('/catalog/products', SA, 'POST', { title: `PE5 variants ${sfx}`, brandId: brand.id, brandName: brand.name, categoryId: cat, image: IMG, gallery: [IMG], price: 10, stock: 0, description: 'pe5' }), 'product');
      const vid = `v-pe5-${sfx}-m`;
      const vid2 = `v-pe5-${sfx}-l`;
      data(await call(`/catalog/product-details/${p.id}`, SA, 'PUT', {
        about: 'pe5 about',
        optionGroups: [{ id: 'og-fit', name: 'Fit', displayType: 'pills', values: ['M', 'L'], custom: true }],
        productVariants: [
          { id: vid, sku: `PE5-${sfx}-M`, options: { Fit: 'M' }, stock: 5 },
          { id: vid2, sku: `PE5-${sfx}-L`, options: { Fit: 'L' }, stock: 4 },
        ],
      }), 'variants');
      data(await call(`/catalog/products/${p.id}/inventory`, SA, 'PATCH', { variantId: vid, delta: -2 }), 'adjust');
      data(await call(`/catalog/products/${p.id}/inventory`, SA, 'PATCH', { variantId: vid, reservedQuantity: 1 }), 'reserve');
      data(await call(`/catalog/products/${p.id}/inventory`, SA, 'PATCH', { variantId: vid2, reservedQuantity: 2 }), 'reserve2');
      const inv = async () => {
        const r = data(await call(`/catalog/products/${p.id}/inventory`, SA), 'inv');
        const recs = ((await call(`/catalog/products/${p.id}/inventory`, SA)).body.records ?? []) as any[];
        void r;
        const one = (id: string) => recs.find((x) => x.variantId === id);
        return { m: [one(vid)?.quantity, one(vid)?.reservedQuantity, one(vid)?.availableQuantity], l: [one(vid2)?.quantity, one(vid2)?.reservedQuantity, one(vid2)?.availableQuantity] };
      };
      const base = await inv();
      check(strip(base) === strip({ m: [3, 1, 2], l: [4, 2, 2] }), 'E5 setup: M on-hand 3 / reserved 1 / available 2; L 4 / 2 / 2', base);
      const ver = async () => ({ [V]: data(await call(`/catalog/products/${p.id}`, SA), 'p').updatedAt, [VD]: (await call(`/catalog/product-details/${p.id}`, SA)).body?.updatedAt ?? (await call(`/catalog/product-details/${p.id}`, SA)).body?.data?.updatedAt });
      const results: Array<[string, unknown]> = [];
      for (let i = 0; i < 3; i += 1) {
        const r = await call(`/catalog/products/${p.id}/studio-save`, SA, 'POST', { product: { description: `pe5 desc ${i}` }, detail: { specs: [{ key: 'Fabric', value: `Cotton ${i}` }] } }, await ver());
        results.push([`studio-save #${i + 1} (Specifications + About)`, [r.status, await inv()]]);
      }
      { const r = await call(`/catalog/products/${p.id}/studio-save`, SA, 'POST', { product: { price: 12 } }, await ver()); results.push(['studio-save product-only (Pricing)', [r.status, await inv()]]); }
      { const r = await call(`/catalog/product-details/${p.id}`, SA, 'PUT', { pros: ['pe5 pro'] }); results.push(['detail PUT changed-only', [r.status, await inv()]]); }
      {
        const full = (await call(`/catalog/product-details/${p.id}`, SA)).body;
        const d = full?.productId ? full : full?.data;
        const { updatedAt: _u, createdAt: _c, ...rest } = d;
        const r = await call(`/catalog/product-details/${p.id}`, SA, 'PUT', { ...rest, about: 'pe5 full payload save' });
        results.push(['detail PUT full payload (stored variant stock = available)', [r.status, await inv()]]);
      }
      { const r = await call(`/catalog/products/${p.id}`, SA, 'PATCH', { description: 'pe5 product patch' }); results.push(['product PATCH', [r.status, await inv()]]); }
      { const r = await call(`/catalog/product-details/${p.id}`, SA, 'PATCH', { about: 'pe5 detail patch' }); results.push(['detail PATCH', [r.status, await inv()]]); }
      for (const [label, [status, now]] of results as Array<[string, [number, unknown]]>) {
        check(status === 200 && strip(now) === strip(base), `E5 ${label}: on-hand / reserved / available unchanged`, { status, now });
      }
      // explicit Stock change still applies (only to the variant that changed), reservations kept
      {
        const full = (await call(`/catalog/product-details/${p.id}`, SA)).body;
        const d = full?.productId ? full : full?.data;
        const variants = (d.productVariants as any[]).map((v) => (v.id === vid ? { ...v, stock: 7 } : v));
        const r = await call(`/catalog/products/${p.id}/studio-save`, SA, 'POST', { product: {}, detail: { productVariants: variants } }, await ver());
        const now = await inv();
        check(r.status === 200 && strip(now) === strip({ m: [7, 1, 6], l: base.l }), 'E5 an explicit Stock change sets that variant’s on-hand (reservations kept); the other variant is untouched', { status: r.status, now });
        const prod = data(await call(`/catalog/products/${p.id}`, SA), 'p');
        check(prod.stock === 6 + 2, 'E5 product stock = sum of variant availability after the change', prod.stock);
      }
      // a refused combined save writes nothing, inventory included
      {
        const before = await inv();
        const r = await call(`/catalog/products/${p.id}/studio-save`, SA, 'POST', { product: { description: 'must not land' }, detail: { productVariants: [{ id: vid, sku: 'X', options: { Fit: 'M' }, stock: 99 }] } }, { [V]: 'stale', [VD]: 'stale' });
        check(r.status === 409 && strip(await inv()) === strip(before) && data(await call(`/catalog/products/${p.id}`, SA), 'p').description !== 'must not land', 'E5 a refused (stale) combined save changes neither record nor inventory', r.status);
      }
      // a newly added variant gets its inventory record from its Stock
      {
        const full = (await call(`/catalog/product-details/${p.id}`, SA)).body;
        const d = full?.productId ? full : full?.data;
        const vid3 = `v-pe5-${sfx}-s`;
        const variants = [...(d.productVariants as any[]), { id: vid3, sku: `PE5-${sfx}-S`, options: { Fit: 'S' }, stock: 3 }];
        const og = [{ id: 'og-fit', name: 'Fit', displayType: 'pills', values: ['M', 'L', 'S'], custom: true }];
        const r = await call(`/catalog/products/${p.id}/studio-save`, SA, 'POST', { product: {}, detail: { optionGroups: og, productVariants: variants } }, await ver());
        const recs = ((await call(`/catalog/products/${p.id}/inventory`, SA)).body.records ?? []) as any[];
        const rec3 = recs.find((x) => x.variantId === vid3);
        check(r.status === 200 && rec3?.quantity === 3 && rec3?.reservedQuantity === 0, 'E5 a new variant gets its inventory record from its Stock', { status: r.status, rec3 });
      }
    }
  } catch (e) {
    check(false, 'probe step threw', e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    if (browser) await (browser as Browser).close().catch(() => undefined);
    for (const id of brandIds) await call(`/catalog/brands/${id}`, SA, 'DELETE').catch(() => undefined);
    for (const id of users) await q(`delete from users where id=$1`, [id]).catch(() => undefined);
    await db.end();
  }
  console.log(`\n${FAIL.length ? 'FAIL' : 'PASS'} probe-studio-phase-e (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) {
    for (const f of FAIL) console.log('  -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
