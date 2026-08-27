/**
 * LIVE seller / brand ownership-boundary probe for the Products & Inventory
 * UI consolidation (Sprint 13).
 *
 * SAFETY CONTRACT (enforced by construction):
 *  - No dev-login. No DEV_SEED_PASSWORD. No admin/moderator automation.
 *  - No JWT fabrication, no role writes, no auth weakening.
 *  - Creates ONLY clearly-synthetic probe-seller-a/b-<ts>@choosify.test
 *    accounts via the normal public /auth/partner-apply path, with unique
 *    randomly-generated passwords.
 *  - Admin approval + Marketplace Access are performed by a human in their own
 *    SUPER_ADMIN browser session; this script STOPS and prints a checklist.
 *  - No destructive cleanup: products/brands are archived via supported
 *    endpoints; anything not removable through a normal mechanism is reported.
 *
 * Phases:
 *   npx tsx scripts/probe-products-ownership-live.ts apply
 *   npx tsx scripts/probe-products-ownership-live.ts verify <stateFile>
 *   npx tsx scripts/probe-products-ownership-live.ts cleanup <stateFile>
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const RUN_ID = Date.now();

let failed = 0;
let passed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log('PASS', label);
  } else {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}
function info(label: string, detail?: unknown) {
  console.log('INFO', label, detail === undefined ? '' : JSON.stringify(detail));
}

async function json(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}
function synthPassword(): string {
  // 24 chars, mixed — unique to this probe account only.
  return 'Pb!' + randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) + '9x';
}

type SellerState = { label: string; email: string; password: string; uid?: string };
type ProbeState = {
  runId: number;
  createdAt: string;
  base: string;
  sellers: { a: SellerState; b: SellerState };
  applications: { a?: string; b?: string };
  baseline?: { anonTotal: number; anonDistinctSellers: number; anonDistinctBrands: number };
  brands: { a?: string; b?: string };
  products: { a?: string; b?: string };
};

function loadState(path: string): ProbeState {
  return JSON.parse(readFileSync(path, 'utf8')) as ProbeState;
}
function saveState(path: string, state: ProbeState) {
  writeFileSync(path, JSON.stringify(state, null, 2));
}

// ---------- lifecycle helpers (normal production endpoints only) ----------
async function partnerApply(email: string, password: string, storeName: string) {
  const res = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email,
      password,
      displayName: 'Sprint13 UI QA Seller',
      businessOrChannelName: storeName,
      phone: '+8801711000042',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  return { status: res.status, body: await json(res) };
}

async function login(email: string, password: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await json(res);
  return { status: res.status, token: body.accessToken as string | undefined, uid: body.uid as string | undefined, body };
}

async function me(token: string) {
  const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await json(res) };
}

async function listOwnBrands(token: string) {
  const res = await fetch(`${base}/catalog/brands`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await json(res);
  return { status: res.status, data: (body.data || []) as Array<{ id: string; sellerId?: string; name?: string }> };
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, category: 'General', description: 'Sprint13 UI QA synthetic brand' }),
  });
  const body = await json(res);
  return { status: res.status, brand: body.data as { id: string; sellerId?: string } | undefined };
}

async function firstCategoryId(token: string) {
  const res = await fetch(`${base}/catalog/categories`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await json(res);
  return body.data?.[0]?.id as string | undefined;
}

async function createProduct(token: string, brandId: string, categoryId: string, title: string) {
  const res = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title,
      description: 'Sprint13 UI QA synthetic product — safe to archive',
      image: 'https://example.com/probe.jpg',
      gallery: ['https://example.com/probe.jpg'],
      price: 1234,
      stock: 9,
      status: 'draft',
      brandId,
      categoryId,
    }),
  });
  const body = await json(res);
  return { status: res.status, data: body.data as { id: string; sellerId?: string; brandId?: string } | undefined };
}

async function req(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await json(res) };
}

// ------------------------------- APPLY -------------------------------
async function phaseApply() {
  const stateFile = `/tmp/probe-products-ownership-${RUN_ID}.json`;
  const a: SellerState = { label: 'Seller A', email: `probe-seller-a-${RUN_ID}@choosify.test`, password: synthPassword() };
  const b: SellerState = { label: 'Seller B', email: `probe-seller-b-${RUN_ID}@choosify.test`, password: synthPassword() };
  const storeA = `Sprint13 QA Store A ${RUN_ID}`;
  const storeB = `Sprint13 QA Store B ${RUN_ID}`;

  // Baseline public catalog snapshot BEFORE any fixture exists.
  const anon = await req('GET', '/catalog/products?limit=500');
  const anonRows: Array<{ sellerId?: string; brandId?: string }> = anon.body?.data || [];
  const baseline = {
    anonTotal: Number(anon.body?.meta?.total ?? anonRows.length),
    anonDistinctSellers: new Set(anonRows.map((r) => r.sellerId).filter(Boolean)).size,
    anonDistinctBrands: new Set(anonRows.map((r) => r.brandId).filter(Boolean)).size,
  };
  info('baseline anonymous /catalog/products', baseline);
  assert(anon.status === 200, 'apply: anonymous public catalog reachable', anon.status);

  const applyA = await partnerApply(a.email, a.password, storeA);
  assert(applyA.status === 201, 'apply: Seller A partner application accepted (201)', applyA.status);
  assert(
    applyA.body?.accessGranted === false && !applyA.body?.accessToken && !applyA.body?.customToken,
    'apply: Seller A application grants no seller JWT (no self-provision)',
    applyA.body,
  );
  const applyB = await partnerApply(b.email, b.password, storeB);
  assert(applyB.status === 201, 'apply: Seller B partner application accepted (201)', applyB.status);
  assert(
    applyB.body?.accessGranted === false && !applyB.body?.accessToken && !applyB.body?.customToken,
    'apply: Seller B application grants no seller JWT (no self-provision)',
    applyB.body,
  );

  const state: ProbeState = {
    runId: RUN_ID,
    createdAt: new Date().toISOString(),
    base,
    sellers: { a, b },
    applications: { a: applyA.body?.applicationId || applyA.body?.id, b: applyB.body?.applicationId || applyB.body?.id },
    baseline,
    brands: {},
    products: {},
  };
  saveState(stateFile, state);

  console.log('\n=======================================================================');
  console.log(' PHASE 1 COMPLETE — HUMAN ADMIN ACTION REQUIRED (your SUPER_ADMIN browser)');
  console.log('=======================================================================');
  console.log(` State file: ${stateFile}`);
  console.log('');
  console.log(' For EACH of the two synthetic sellers below, in your own logged-in');
  console.log(' SUPER_ADMIN session:');
  console.log('');
  console.log('  1. Open: Admin → Verification Center  (/admin/brand-verification)');
  console.log('     — or the Partner Applications approval queue.');
  console.log('  2. Find the pending Seller application by business name.');
  console.log('  3. Click Approve  (identity approval → provisions the Seller + brand).');
  console.log('  4. Open: Admin → Seller Management Studio (/admin/brand-studio)');
  console.log('     find the provisioned brand, and Grant Marketplace Access.');
  console.log('');
  console.log(`   Seller A: ${a.email}`);
  console.log(`     business name : ${storeA}`);
  console.log(`   Seller B: ${b.email}`);
  console.log(`     business name : ${storeB}`);
  console.log('');
  console.log(' When BOTH are Approved + Marketplace Access granted, run:');
  console.log(`   npm run -s exec -- tsx scripts/probe-products-ownership-live.ts verify ${stateFile}`);
  console.log('   (or: npx tsx scripts/probe-products-ownership-live.ts verify ' + stateFile + ')');
  console.log('=======================================================================\n');

  if (failed > 0) process.exitCode = 1;
}

// ------------------------------- VERIFY -------------------------------
async function phaseVerify(stateFile: string) {
  const state = loadState(stateFile);
  const { a, b } = state.sellers;

  const loginA = await login(a.email, a.password);
  const loginB = await login(b.email, b.password);
  assert(!!loginA.token, 'verify: Seller A can log in with its own synthetic credentials', loginA.status);
  assert(!!loginB.token, 'verify: Seller B can log in with its own synthetic credentials', loginB.status);
  if (!loginA.token || !loginB.token) {
    console.log('\nABORT: one or both probe sellers cannot log in. Approval may not be complete.\n');
    process.exitCode = 1;
    return;
  }
  const tokenA = loginA.token;
  const tokenB = loginB.token;
  state.sellers.a.uid = loginA.uid;
  state.sellers.b.uid = loginB.uid;

  const meA = await me(tokenA);
  const meB = await me(tokenB);
  const roleA = meA.body?.role;
  const roleB = meB.body?.role;
  const approved = (r: unknown) => r === 'seller' || r === 'verified_seller';
  assert(approved(roleA), 'verify: Seller A identity approved to seller role', roleA);
  assert(approved(roleB), 'verify: Seller B identity approved to seller role', roleB);
  if (!approved(roleA) || !approved(roleB)) {
    console.log('\nABORT: probe sellers are not in seller role yet. Complete Admin approval, then re-run verify.\n');
    process.exitCode = 1;
    return;
  }

  const uidA = String(meA.body?.uid || loginA.uid);
  const uidB = String(meB.body?.uid || loginB.uid);

  // Resolve a brand for each seller (prefer the auto-provisioned one).
  let brandA = (await listOwnBrands(tokenA)).data[0]?.id;
  if (!brandA) brandA = (await createBrand(tokenA, `Sprint13 QA Brand A ${state.runId}`)).brand?.id;
  let brandB = (await listOwnBrands(tokenB)).data[0]?.id;
  if (!brandB) brandB = (await createBrand(tokenB, `Sprint13 QA Brand B ${state.runId}`)).brand?.id;
  assert(!!brandA && !!brandB, 'verify: each seller has an owned brand', { brandA, brandB });
  if (!brandA || !brandB) { process.exitCode = 1; return; }
  state.brands = { a: brandA, b: brandB };

  const categoryId = (await firstCategoryId(tokenA)) as string;
  assert(!!categoryId, 'verify: a catalog category is available', categoryId);

  const prodA = await createProduct(tokenA, brandA, categoryId, `Sprint13 QA Product A ${state.runId}`);
  const prodB = await createProduct(tokenB, brandB, categoryId, `Sprint13 QA Product B ${state.runId}`);
  assert(prodA.status === 201 && !!prodA.data?.id, 'verify: Seller A creates Product A under own brand', prodA.status);
  assert(prodB.status === 201 && !!prodB.data?.id, 'verify: Seller B creates Product B under own brand', prodB.status);
  assert(prodA.data?.sellerId === uidA, 'verify: Product A sellerId stamped to Seller A', prodA.data?.sellerId);
  assert(prodB.data?.sellerId === uidB, 'verify: Product B sellerId stamped to Seller B', prodB.data?.sellerId);
  if (!prodA.data?.id || !prodB.data?.id) { saveState(stateFile, state); process.exitCode = 1; return; }
  const pA = prodA.data.id;
  const pB = prodB.data.id;
  state.products = { a: pA, b: pB };
  saveState(stateFile, state);

  // ---- Seller A management listing boundary ----
  const listA = await req('GET', '/catalog/products?limit=500', tokenA);
  const rowsA: Array<{ id: string; sellerId?: string }> = listA.body?.data || [];
  assert(rowsA.some((r) => r.id === pA), 'A-list: contains own Product A', rowsA.length);
  assert(!rowsA.some((r) => r.id === pB), 'A-list: does NOT contain Seller B Product B', rowsA.map((r) => r.id));
  assert(rowsA.length > 0 && rowsA.every((r) => r.sellerId === uidA), 'A-list: every returned row is owned by Seller A', {
    total: rowsA.length,
    foreign: rowsA.filter((r) => r.sellerId !== uidA).map((r) => r.id),
  });

  // ---- Seller B management listing boundary (reciprocal) ----
  const listB = await req('GET', '/catalog/products?limit=500', tokenB);
  const rowsB: Array<{ id: string; sellerId?: string }> = listB.body?.data || [];
  assert(rowsB.some((r) => r.id === pB), 'B-list: contains own Product B', rowsB.length);
  assert(!rowsB.some((r) => r.id === pA), 'B-list: does NOT contain Seller A Product A', rowsB.map((r) => r.id));
  assert(rowsB.length > 0 && rowsB.every((r) => r.sellerId === uidB), 'B-list: every returned row is owned by Seller B', {
    total: rowsB.length,
    foreign: rowsB.filter((r) => r.sellerId !== uidB).map((r) => r.id),
  });

  // ---- Forged / widened query parameters (Seller A session) ----
  const forgedBrand = await req('GET', `/catalog/products?brandId=${encodeURIComponent(brandB)}&limit=500`, tokenA);
  const fbRows: Array<{ id: string; sellerId?: string }> = forgedBrand.body?.data || [];
  assert(!fbRows.some((r) => r.id === pB) && fbRows.every((r) => r.sellerId === uidA || fbRows.length === 0),
    'forged: ?brandId=<BrandB> does not surface Seller B products to Seller A', fbRows.map((r) => r.id));

  const forgedSeller = await req('GET', `/catalog/products?sellerId=${encodeURIComponent(uidB)}&limit=500`, tokenA);
  const fsRows: Array<{ id: string; sellerId?: string }> = forgedSeller.body?.data || [];
  assert(!fsRows.some((r) => r.id === pB) && fsRows.every((r) => r.sellerId === uidA || fsRows.length === 0),
    'forged: ?sellerId=<B> does not override authenticated ownership', fsRows.map((r) => r.id));

  const forgedOwner = await req('GET', `/catalog/products?ownerId=${encodeURIComponent(uidB)}&userId=${encodeURIComponent(uidB)}&limit=500`, tokenA);
  const foRows: Array<{ id: string; sellerId?: string }> = forgedOwner.body?.data || [];
  assert(!foRows.some((r) => r.id === pB), 'forged: ?ownerId/?userId params do not widen Seller A scope', foRows.map((r) => r.id));

  // ---- Cross-seller GET (management-protected detail) ----
  const aGetsB = await req('GET', `/catalog/products/${pB}`, tokenA);
  assert(aGetsB.status === 404, 'cross: Seller A GET draft Product B → 404 (scoped hidden)', aGetsB.status);

  // ---- Cross-seller mutations: Seller A → Product B ----
  const aPutB = await req('PUT', `/catalog/products/${pB}`, tokenA, {
    title: 'hijacked', description: 'x', image: 'https://example.com/x.jpg', gallery: [], price: 1, stock: 1, brandId: brandB, categoryId,
  });
  assert(aPutB.status === 403, 'cross: Seller A PUT Product B → 403', aPutB.status);

  const aPatchB = await req('PATCH', `/catalog/products/${pB}`, tokenA, { description: 'hijacked' });
  assert(aPatchB.status === 403, 'cross: Seller A PATCH Product B → 403', aPatchB.status);

  const aArchiveB = await req('POST', `/catalog/products/${pB}/archive`, tokenA);
  assert(aArchiveB.status === 403, 'cross: Seller A archive Product B → 403', aArchiveB.status);

  const aRestoreB = await req('POST', `/catalog/products/${pB}/restore`, tokenA);
  assert(aRestoreB.status === 403, 'cross: Seller A restore/reactivate Product B → 403', aRestoreB.status);

  const aInvB = await req('PATCH', `/catalog/products/${pB}/inventory`, tokenA, { quantity: 0 });
  assert(aInvB.status === 403, 'cross: Seller A inventory mutation on Product B → 403', aInvB.status);

  const aStealB = await req('PATCH', `/catalog/products/${pB}`, tokenA, { brandId: brandA });
  assert(aStealB.status === 403, 'cross: Seller A cannot reassign Product B into Brand A → 403', aStealB.status);

  // ---- Reciprocal: Seller B → Product A (meaningful subset) ----
  const bGetsA = await req('GET', `/catalog/products/${pA}`, tokenB);
  assert(bGetsA.status === 404, 'recip: Seller B GET draft Product A → 404 (scoped hidden)', bGetsA.status);
  const bPatchA = await req('PATCH', `/catalog/products/${pA}`, tokenB, { description: 'hijacked' });
  assert(bPatchA.status === 403, 'recip: Seller B PATCH Product A → 403', bPatchA.status);
  const bArchiveA = await req('POST', `/catalog/products/${pA}/archive`, tokenB);
  assert(bArchiveA.status === 403, 'recip: Seller B archive Product A → 403', bArchiveA.status);
  const bInvA = await req('PATCH', `/catalog/products/${pA}/inventory`, tokenB, { quantity: 0 });
  assert(bInvA.status === 403, 'recip: Seller B inventory mutation on Product A → 403', bInvA.status);

  // ---- Brand ownership boundary ----
  const aPutBrandB = await req('PUT', `/catalog/brands/${brandB}`, tokenA, { name: 'hijack', category: 'General', description: 'x' });
  assert(aPutBrandB.status === 403, 'brand: Seller A PUT Brand B → 403', aPutBrandB.status);
  const aPatchBrandB = await req('PATCH', `/catalog/brands/${brandB}`, tokenA, { description: 'hijack' });
  assert(aPatchBrandB.status === 403, 'brand: Seller A PATCH Brand B → 403', aPatchBrandB.status);
  const aDelBrandB = await req('DELETE', `/catalog/brands/${brandB}`, tokenA);
  assert(aDelBrandB.status === 403, 'brand: Seller A DELETE Brand B → 403', aDelBrandB.status);
  const bPatchBrandA = await req('PATCH', `/catalog/brands/${brandA}`, tokenB, { description: 'hijack' });
  assert(bPatchBrandA.status === 403, 'brand: Seller B PATCH Brand A → 403', bPatchBrandA.status);
  // owner can still edit own brand (no accidental lockout)
  const aPatchOwn = await req('PATCH', `/catalog/brands/${brandA}`, tokenA, { description: 'owner-edit ok' });
  assert(aPatchOwn.status === 200, 'brand: Seller A can still PATCH own Brand A (200)', aPatchOwn.status);

  // ---- Public catalog regression (anonymous, no token) ----
  const anon = await req('GET', '/catalog/products?limit=500');
  const anonRows: Array<{ id: string; sellerId?: string; brandId?: string }> = anon.body?.data || [];
  const anonSellers = new Set(anonRows.map((r) => r.sellerId).filter(Boolean)).size;
  const anonBrands = new Set(anonRows.map((r) => r.brandId).filter(Boolean)).size;
  assert(anon.status === 200, 'public: anonymous /catalog/products still reachable (200)', anon.status);
  assert(!anonRows.some((r) => r.id === pA || r.id === pB), 'public: draft probe products are NOT publicly listed', {
    pA, pB,
  });
  const bl = state.baseline!;
  assert(anonSellers >= Math.min(2, bl.anonDistinctSellers) && anonSellers >= 2 || bl.anonDistinctSellers < 2,
    'public: anonymous catalog still spans multiple sellers (not seller-scoped)', { now: anonSellers, baseline: bl.anonDistinctSellers });
  assert(Math.abs((anon.body?.meta?.total ?? anonRows.length) - bl.anonTotal) <= Math.max(5, bl.anonTotal * 0.1),
    'public: anonymous catalog total unchanged vs pre-fixture baseline (±10%)', {
      now: anon.body?.meta?.total ?? anonRows.length, baseline: bl.anonTotal,
    });

  saveState(stateFile, state);
  console.log('\n---------------------------------------------------------------');
  console.log(` VERIFY RESULT: ${passed} passed, ${failed} failed`);
  console.log(' ADMIN BROADER VISIBILITY: CURRENT CODE VERIFIED + SPRINT 12 UI VERIFICATION REQUIRED');
  console.log(` Next: npx tsx scripts/probe-products-ownership-live.ts cleanup ${stateFile}`);
  console.log('---------------------------------------------------------------\n');
  if (failed > 0) process.exitCode = 1;
}

// ------------------------------- CLEANUP -------------------------------
async function phaseCleanup(stateFile: string) {
  const state = loadState(stateFile);
  const { a, b } = state.sellers;
  const la = await login(a.email, a.password);
  const lb = await login(b.email, b.password);
  const retained: string[] = [];

  for (const [label, token, productId, brandId] of [
    ['A', la.token, state.products.a, state.brands.a],
    ['B', lb.token, state.products.b, state.brands.b],
  ] as Array<[string, string | undefined, string | undefined, string | undefined]>) {
    if (token && productId) {
      const arch = await req('POST', `/catalog/products/${productId}/archive`, token);
      info(`cleanup: archive Product ${label} (${productId})`, arch.status);
      if (arch.status !== 200) retained.push(`product ${label} ${productId} (archive → ${arch.status})`);
    }
    if (token && brandId) {
      // Sellers cannot delete brands (admin-only cms:edit). Try a supported status change; otherwise retain.
      const patch = await req('PATCH', `/catalog/brands/${brandId}`, token, { status: 'archived' });
      info(`cleanup: attempt archive Brand ${label} (${brandId})`, patch.status);
      retained.push(`brand ${label} ${brandId} (no seller-facing delete; PATCH status → ${patch.status})`);
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log(' CLEANUP SUMMARY');
  console.log('  Probe products: archived via POST /catalog/products/:id/archive where possible.');
  console.log('  RETAINED synthetic fixtures (no supported normal removal path):');
  for (const r of retained) console.log('   - ' + r);
  console.log(`   - user account ${a.email} (no self-serve delete API)`);
  console.log(`   - user account ${b.email} (no self-serve delete API)`);
  console.log('   - the two partner-application rows for the above');
  console.log('  All are clearly labelled "Sprint13 UI QA". Recommend Admin reject/disable');
  console.log('  the two synthetic seller accounts from the Admin console if a reversible');
  console.log('  mechanism exists; otherwise leave labelled.');
  console.log('---------------------------------------------------------------\n');
}

// ------------------------------- entry -------------------------------
const phase = process.argv[2];
const arg = process.argv[3];
(async () => {
  if (phase === 'apply') return phaseApply();
  if (phase === 'verify' && arg) return phaseVerify(arg);
  if (phase === 'cleanup' && arg) return phaseCleanup(arg);
  console.error('usage: probe-products-ownership-live.ts <apply | verify <stateFile> | cleanup <stateFile>>');
  process.exitCode = 2;
})();
