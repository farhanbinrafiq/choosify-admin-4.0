/**
 * Seller Order Hub — server-side ownership isolation + tracking cross-surface
 * (Option B, Sprint 14, Parts A2 / A4).
 *
 * The shared React Order Hub (<PlatformOrdersPage>, /admin/orders +
 * /admin/platform-orders) is only a presentation layer over the canonical
 * Operations API. This probe proves the security boundary is the SERVER, not
 * React filtering:
 *
 *   - Seller A cannot list Seller B's orders (?sellerId=<B> -> 403)
 *   - Seller A's own list never contains a Seller-B-only order (search parity:
 *     the Hub search runs over this scoped set, so it cannot reach B either)
 *   - Seller A cannot open Seller B's order by direct id (-> 403)
 *   - Seller A cannot mark-delivered an item on Seller B's order (-> 403)
 *   - Seller A cannot PATCH the courier/tracking of Seller B's shipment (-> 403)
 *   - Seller A CAN update the courier/tracking of its OWN order's shipment, and
 *     that change is visible on the canonical shipment record the Seller Inbox
 *     order rail and the buyer tracking view both read (A4 cross-surface).
 *
 * "Seller B" is modelled by the seeded creator account's uid used as a
 * sub-order sellerId (staff manual-offer creation bypasses product ownership),
 * which is sufficient to exercise every ownership gate.
 *
 * Usage: npx tsx scripts/probe-seller-order-hub-ownership.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_A_EMAIL = 'seller@choosify.com.bd';
const SELLER_B_EMAIL = 'creator@choosify.com.bd'; // uid stands in as a second sub-order owner

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
  const email = `ohubown.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'OhubOwn!2026';
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName: `OHub Buyer ${tag}` }),
  });
  return { email, password, uid: reg.body.uid || reg.body.data?.uid };
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

/** Admin (staff) creates a native manual offer for `ownerUid`; buyer accepts -> canonical order. */
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

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const sellerA = await login(SELLER_A_EMAIL);
  const sellerB = await login(SELLER_B_EMAIL);
  check(!!admin.token && !!sellerA.token && !!sellerB.uid, 'seed logins (admin, seller A, owner B)');
  if (!admin.token || !sellerA.token || !sellerB.uid) return finish();

  const aProds = await api('/catalog/products?limit=120', {}, sellerA.token);
  const pA = (aProds.body.data || []).find(
    (x: Record<string, unknown>) => x.sellerId === sellerA.uid && x.productType !== 'service',
  );
  check(!!pA, 'seller A owns a physical product');
  if (!pA) return finish();

  const buyer = await registerBuyer('x');
  await dbVerifyEmail(buyer.email);
  const buyerTok = (await login(buyer.email, buyer.password)).token;
  const buyerCtx = { uid: String(buyer.uid), token: buyerTok };

  // Seller B's order must carry a product NOT owned by A, so the mark-delivered
  // "true product owner" fallback (server/operationsRouter.ts findOrderItem)
  // cannot authorise A. Real sub-orders always satisfy this — a sub-order's
  // items are that seller's own products. Any physical product whose sellerId
  // is not A's (seeded platform product, other seller) works.
  const pubProds = await api('/catalog/products?limit=120', {}, buyerTok);
  const pB = (pubProds.body.data || []).find(
    (x: Record<string, unknown>) =>
      x.productType !== 'service' && String(x.sellerId || '') !== sellerA.uid,
  );
  check(!!pB, "a physical product not owned by Seller A exists (for B's order)");
  if (!pB) return finish();
  for (const prod of [pA, pB]) {
    await api(
      `/catalog/products/${prod.id}/inventory`,
      { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) },
      admin.token,
    );
  }

  const orderA = await makeOrderForOwner(
    admin.token,
    sellerA.uid,
    String(pA.id),
    Number(pA.price) || 500,
    buyerCtx,
  );
  const orderB = await makeOrderForOwner(
    admin.token,
    sellerB.uid,
    String(pB.id),
    Number(pB.price) || 500,
    buyerCtx,
  );
  check(!!orderA && !!orderB && orderA !== orderB, 'created one order for A and one for B', { orderA, orderB });
  if (!orderA || !orderB) return finish();

  // ── A2: list scoping ────────────────────────────────────────────────
  const aListOwn = await api('/operations/orders', {}, sellerA.token);
  const aRows: Array<Record<string, unknown>> = aListOwn.body?.data || [];
  const aRowIds = new Set(aRows.map((o) => o.orderId));
  check(aListOwn.status === 200 && aRowIds.has(orderA), "Seller A's own list contains A's order", {
    status: aListOwn.status,
  });
  check(
    !aRowIds.has(orderB),
    "Seller A's list does NOT contain Seller B's order (search parity: Hub search runs over this set)",
    { count: aRows.length },
  );
  const everyRowTouchesA = aRows.every((o) =>
    ((o.subOrders as Array<{ sellerId?: string }> | undefined) || []).some(
      (s) => s.sellerId === sellerA.uid,
    ),
  );
  check(everyRowTouchesA, 'every order in Seller A\'s list has an A-owned sub-order');

  const aListForgeB = await api(
    `/operations/orders?sellerId=${encodeURIComponent(sellerB.uid)}`,
    {},
    sellerA.token,
  );
  check(aListForgeB.status === 403, 'Seller A GET /operations/orders?sellerId=<B> -> 403 (cannot forge sellerId)', aListForgeB.status);

  // ── A2: direct id / mutation ────────────────────────────────────────
  const aOpenB = await api(`/operations/orders/${encodeURIComponent(orderB)}`, {}, sellerA.token);
  check(aOpenB.status === 403, "Seller A GET /operations/orders/<B's id> -> 403", aOpenB.status);

  const bDetailAsAdmin = await api(`/operations/orders/${encodeURIComponent(orderB)}`, {}, admin.token);
  const bItemId = (bDetailAsAdmin.body?.data?.subOrders || [])[0]?.items?.[0]?.itemId;
  const aMarkB = await api(
    `/operations/orders/${encodeURIComponent(orderB)}/items/${encodeURIComponent(String(bItemId))}/mark-delivered`,
    { method: 'POST', body: '{}' },
    sellerA.token,
  );
  check(aMarkB.status === 403, "Seller A mark-delivered on B's order item -> 403", aMarkB.status);

  const bShip = await api(`/operations/shipments/track/${encodeURIComponent(orderB)}`, {}, admin.token);
  const bShipId = bShip.body?.data?.id;
  const aPatchBShip = await api(
    `/operations/shipments/${encodeURIComponent(String(bShipId))}`,
    { method: 'PATCH', body: JSON.stringify({ courier: 'HijackCo', trackingNumber: 'X-1' }) },
    sellerA.token,
  );
  check(
    aPatchBShip.status === 403,
    "Seller A PATCH /operations/shipments/<B's shipment> -> 403",
    aPatchBShip.status,
  );

  // ── A4: Seller A updates its OWN order's tracking; canonical record reflects it ──
  const aShip = await api(`/operations/shipments/track/${encodeURIComponent(orderA)}`, {}, sellerA.token);
  const aShipId = aShip.body?.data?.id;
  check(aShip.status === 200 && !!aShipId, "Seller A can read its own order's shipment", aShip.status);
  const stamp = `T-${Date.now()}`;
  const aPatchOwn = await api(
    `/operations/shipments/${encodeURIComponent(String(aShipId))}`,
    { method: 'PATCH', body: JSON.stringify({ courier: 'Pathao', trackingNumber: stamp }) },
    sellerA.token,
  );
  check(aPatchOwn.status === 200, "Seller A PATCH own order's courier/tracking -> 200", aPatchOwn.status);

  // Same canonical record the Seller Inbox order rail + buyer tracking view read
  const reread = await api(`/operations/shipments/track/${encodeURIComponent(orderA)}`, {}, sellerA.token);
  check(
    reread.body?.data?.trackingNumber === stamp && reread.body?.data?.courier === 'Pathao',
    'canonical shipment record reflects the update (Order Hub / Seller Inbox / buyer all read this)',
    { courier: reread.body?.data?.courier, trackingNumber: reread.body?.data?.trackingNumber },
  );
  const buyerSeesTracking = await api(
    `/operations/shipments/track/${encodeURIComponent(orderA)}`,
    {},
    buyerTok,
  );
  check(
    buyerSeesTracking.status === 200 && buyerSeesTracking.body?.data?.trackingNumber === stamp,
    'buyer-visible tracking view shows the same courier/tracking (no duplicated state)',
    { status: buyerSeesTracking.status },
  );

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL SELLER ORDER-HUB OWNERSHIP CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
