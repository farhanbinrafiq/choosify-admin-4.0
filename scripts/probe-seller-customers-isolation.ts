/**
 * Seller / Creator "My Customers" — ownership isolation + privacy DTO
 * (Option D, Sprint 14, Part B / B6).
 *
 * The React <SellerMyCustomers> page reads the EXISTING canonical route
 * GET /catalog/workspace/{seller,creator}/customers
 * (server/catalogRouter.ts -> listMyCustomersForOwner). This probe proves:
 *
 *   - Seller A sees only Consumers with an A-owned order relationship
 *   - Owner B sees only Consumers with a B-owned relationship
 *   - a Consumer shared by A and B appears for BOTH, but each owner's detail
 *     exposes ONLY that owner's own order lines
 *   - Seller A cannot open a Consumer with no A relationship (-> 403)
 *   - Seller A cannot widen scope via ?brandId=<not owned> (-> 403); the route
 *     accepts no owner/seller id param at all
 *   - Seller A cannot enumerate the global Consumer directory (a B-only buyer
 *     never appears in A's list)
 *   - the DTO is an allowlist: no phone, address, KYC, moderation/risk/suspend
 *     flags, admin notes, or private support-conversation fields
 *
 * "Owner B" is the seeded creator account (creator route); its uid is used as a
 * sub-order sellerId via staff manual-offer creation.
 *
 * Usage: npx tsx scripts/probe-seller-customers-isolation.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_A_EMAIL = 'seller@choosify.com.bd';
const OWNER_B_EMAIL = 'creator@choosify.com.bd';

const ALLOWED_DTO_KEYS = new Set([
  'id',
  'name',
  'email',
  'choosifyUserId',
  'segment',
  'totalOrders',
  'totalSpend',
  'lastPurchase',
  'flagged',
  'orders',
  'reviews',
]);
const FORBIDDEN_DTO_SUBSTRINGS = [
  'phone',
  'address',
  'kyc',
  'nid',
  'passport',
  'suspend',
  'ban',
  'moderat',
  'risk',
  'fraud',
  'adminnote',
  'internalnote',
  'supportconversation',
  'systema',
  'lifetime',
  'wallet',
  'session',
];

const PASS: string[] = [];
const FAIL: string[] = [];
function check(c: unknown, label: string, detail?: unknown) {
  (c ? PASS : FAIL).push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}
async function jsonOf(r: Response) {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
async function api(path: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string, password = DEV_PASS) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return {
    token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '',
    uid: r.body.uid || r.body.data?.uid || '',
  };
}
async function registerBuyer(tag: string) {
  const email = `custiso.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'CustIso!2026';
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName: `Cust ${tag.toUpperCase()}` }),
  });
  return { email, password, uid: String(reg.body.uid || reg.body.data?.uid || '') };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.email, email.toLowerCase()));
}
async function makeOrderForOwner(
  adminTok: string,
  ownerUid: string,
  productId: string,
  price: number,
  buyer: { uid: string; token: string },
): Promise<string> {
  const offer = await api(
    '/operations/manual-offers',
    {
      method: 'POST',
      body: JSON.stringify({
        sellerId: ownerUid,
        buyerId: buyer.uid,
        sellerName: 'Owner',
        items: [{ productId, quantity: 1, price }],
      }),
    },
    adminTok,
  );
  const offerId = offer.body?.data?.offerId;
  const acc = await api(
    `/operations/manual-offers/${encodeURIComponent(offerId)}/accept`,
    { method: 'POST', body: '{}' },
    buyer.token,
  );
  return acc.body?.order?.orderId || '';
}

function deepKeyBlob(obj: unknown): string {
  const keys: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        keys.push(k);
        walk((v as Record<string, unknown>)[k]);
      }
    }
  };
  walk(obj);
  return keys.join('|').toLowerCase();
}

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const sellerA = await login(SELLER_A_EMAIL);
  const ownerB = await login(OWNER_B_EMAIL);
  check(!!admin.token && !!sellerA.token && !!ownerB.token, 'seed logins (admin, seller A, owner B)');
  if (!admin.token || !sellerA.token || !ownerB.token) return finish();

  const prods = await api('/catalog/products?limit=80', {}, sellerA.token);
  const p = (prods.body.data || []).find(
    (x: Record<string, unknown>) => x.sellerId && x.productType !== 'service',
  );
  check(!!p, 'seller A owns a physical product');
  if (!p) return finish();
  await api(
    `/catalog/products/${p.id}/inventory`,
    { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) },
    sellerA.token,
  );
  const price = Number(p.price) || 500;

  // Buyer X: relationship with BOTH A and B.  Buyer Y: relationship with B only.
  const bx = await registerBuyer('x');
  const by = await registerBuyer('y');
  await dbVerifyEmail(bx.email);
  await dbVerifyEmail(by.email);
  const bxCtx = { uid: bx.uid, token: (await login(bx.email, bx.password)).token };
  const byCtx = { uid: by.uid, token: (await login(by.email, by.password)).token };

  const orderAX = await makeOrderForOwner(admin.token, sellerA.uid, String(p.id), price, bxCtx);
  const orderBX = await makeOrderForOwner(admin.token, ownerB.uid, String(p.id), price, bxCtx);
  const orderBY = await makeOrderForOwner(admin.token, ownerB.uid, String(p.id), price, byCtx);
  check(!!orderAX && !!orderBX && !!orderBY, 'seeded orders: A↔X, B↔X, B↔Y', { orderAX, orderBX, orderBY });
  if (!orderAX || !orderBX || !orderBY) return finish();

  // ── Seller A list ──────────────────────────────────────────────────
  const aList = await api('/catalog/workspace/seller/customers', {}, sellerA.token);
  const aRows: Array<Record<string, unknown>> = aList.body?.data || [];
  const aIds = new Set(aRows.map((r) => r.id));
  check(aList.status === 200, 'GET /catalog/workspace/seller/customers -> 200 for Seller A', aList.status);
  check(aIds.has(bx.uid), "Seller A's list contains shared customer X");
  check(!aIds.has(by.uid), "Seller A's list does NOT contain B-only customer Y (no global enumeration)");
  check(
    aRows.every((r) => typeof r.id === 'string'),
    'every A row is a customer object',
  );

  // ── Owner B (creator route) list ───────────────────────────────────
  const bList = await api('/catalog/workspace/creator/customers', {}, ownerB.token);
  const bIds = new Set((bList.body?.data || []).map((r: Record<string, unknown>) => r.id));
  check(bList.status === 200 && bIds.has(bx.uid) && bIds.has(by.uid), "Owner B's list contains X and Y", {
    status: bList.status,
  });

  // ── Shared customer, per-owner detail is scoped ────────────────────
  const aDetailX = await api(
    `/catalog/workspace/seller/customers/${encodeURIComponent(bx.uid)}`,
    {},
    sellerA.token,
  );
  const aXOrderIds = ((aDetailX.body?.data?.orders as Array<{ id?: string }>) || []).map((o) => o.id);
  check(aDetailX.status === 200, "Seller A can open shared customer X's relationship", aDetailX.status);
  check(
    aXOrderIds.includes(orderAX) && !aXOrderIds.includes(orderBX) && !aXOrderIds.includes(orderBY),
    "Seller A's view of X shows ONLY A's order line, never B's",
    { aXOrderIds, orderAX, orderBX },
  );

  const bDetailX = await api(
    `/catalog/workspace/creator/customers/${encodeURIComponent(bx.uid)}`,
    {},
    ownerB.token,
  );
  const bXOrderIds = ((bDetailX.body?.data?.orders as Array<{ id?: string }>) || []).map((o) => o.id);
  check(
    bDetailX.status === 200 && bXOrderIds.includes(orderBX) && !bXOrderIds.includes(orderAX),
    "Owner B's view of X shows ONLY B's order line, never A's",
    { bXOrderIds },
  );

  // ── Seller A cannot open a customer with no A relationship ─────────
  const aDetailY = await api(
    `/catalog/workspace/seller/customers/${encodeURIComponent(by.uid)}`,
    {},
    sellerA.token,
  );
  check(aDetailY.status === 403, "Seller A GET customers/<Y> (no A relationship) -> 403", aDetailY.status);

  // ── Cannot widen scope ────────────────────────────────────────────
  const aForgeBrand = await api(
    '/catalog/workspace/seller/customers?brandId=not-a-real-owned-brand',
    {},
    sellerA.token,
  );
  check(
    aForgeBrand.status === 403,
    'Seller A ?brandId=<not owned> -> 403 (no param can widen scope; route takes no seller id)',
    aForgeBrand.status,
  );

  // ── Privacy DTO allowlist ─────────────────────────────────────────
  const sampleRow = aRows.find((r) => r.id === bx.uid) || aRows[0] || {};
  const extraKeys = Object.keys(sampleRow).filter((k) => !ALLOWED_DTO_KEYS.has(k));
  check(extraKeys.length === 0, 'list DTO carries only the allowlisted fields', { extraKeys });

  const detailBlob = deepKeyBlob(aDetailX.body?.data);
  const leaked = FORBIDDEN_DTO_SUBSTRINGS.filter((s) => detailBlob.includes(s));
  check(
    leaked.length === 0,
    'customer DTO leaks no phone / address / KYC / moderation / risk / support-conversation field',
    { leaked, detailBlob: detailBlob.slice(0, 200) },
  );
  check(
    Array.isArray(aDetailX.body?.data?.reviews),
    'reviews field is a (seller-scoped) array, not free-form text',
  );
  check(
    aDetailX.body?.data?.flagged === false || aDetailX.body?.data?.flagged === undefined,
    'flagged is the vestigial false (the page never renders it and exposes no flag/ban control)',
    aDetailX.body?.data?.flagged,
  );

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL SELLER MY-CUSTOMERS ISOLATION/PRIVACY CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
