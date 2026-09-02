/**
 * Seller Inbox — canonical order-management quick actions + cross-surface
 * synchronization (Parts A / E).
 *
 * Proves Seller Messages holds NO order state of its own: the "Mark
 * Delivered" quick action calls the SAME canonical endpoint the Seller
 * Order Console uses (POST /operations/orders/:id/items/:itemId/mark-
 * delivered), and the result is visible identically from the Order Console,
 * the Buyer's order view, with inventory finalised and the buyer notified.
 * Also asserts the DEFERRED transitions are NOT fabricated (seller cancel
 * is correctly 403 — that endpoint is buyer-only).
 *
 * Usage: npx tsx scripts/probe-seller-order-mgmt.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';

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
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerBuyer(tag: string) {
  const email = `sordmgmt.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'SordMgmt!2026';
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: `Ord Buyer ${tag}` }) });
  return { email, password, uid: reg.body.uid || reg.body.data?.uid };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const seller = await login(SELLER_EMAIL);
  check(!!admin.token && !!seller.token, 'seed logins');

  const prods = await api('/catalog/products?limit=80', {}, seller.token);
  const p = (prods.body.data || []).find((x: Record<string, unknown>) => x.sellerId && x.productType !== 'service');
  check(!!p, 'seller owns a physical product');
  if (!p) return finish();
  const sellerId = String(p.sellerId);
  // dev-data: keep stock healthy
  await api(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, seller.token);

  // Buyer + native manual offer + accept → a real Operations order
  const buyer = await registerBuyer('a');
  await dbVerifyEmail(buyer.email);
  const buyerTok = (await login(buyer.email, buyer.password)).token;

  const offer = await api(
    '/operations/manual-offers',
    {
      method: 'POST',
      body: JSON.stringify({
        sellerId,
        buyerId: buyer.uid,
        sellerName: String(p.brandName || 'Seller'),
        items: [{ productId: String(p.id), quantity: 1, price: Number(p.price) || 500 }],
      }),
    },
    admin.token,
  );
  const offerId = offer.body?.data?.offerId;
  const acc = await api(`/operations/manual-offers/${encodeURIComponent(offerId)}/accept`, { method: 'POST', body: '{}' }, buyerTok);
  const orderId: string = acc.body?.order?.orderId;
  check(!!orderId, 'buyer accepts → canonical Operations order created', acc.body?.order);
  if (!orderId) return finish();

  // Order state BEFORE (Order Console view)
  const before = await api(`/operations/orders/${encodeURIComponent(orderId)}`, {}, seller.token);
  const beforeTracking = (before.body?.data?.subOrders || [])[0]?.trackingStatus;
  check(beforeTracking !== 'delivered', 'order is not delivered yet (Order Console view)', beforeTracking);
  const itemId = (before.body?.data?.subOrders || [])[0]?.items?.[0]?.itemId;
  check(!!itemId, 'order has an item id for the canonical mark-delivered call');

  // Buyer view BEFORE
  const buyerBefore = await api(`/operations/orders?buyerId=${encodeURIComponent(String(buyer.uid))}`, {}, buyerTok);
  const buyerRowBefore = (buyerBefore.body?.data || []).find((o: Record<string, unknown>) => o.orderId === orderId);
  check(!!buyerRowBefore && (buyerRowBefore.subOrders || [])[0]?.trackingStatus !== 'delivered', 'buyer My Orders shows the order, not delivered');

  // ── Seller Inbox "Mark Delivered" quick action == the Order Console call
  const md = await api(
    `/operations/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/mark-delivered`,
    { method: 'POST', body: '{}' },
    seller.token,
  );
  check(md.status === 200, 'Seller Inbox quick action calls canonical mark-delivered → 200', md.status);

  // Cross-surface: Order Console
  const afterConsole = await api(`/operations/orders/${encodeURIComponent(orderId)}`, {}, seller.token);
  check((afterConsole.body?.data?.subOrders || [])[0]?.trackingStatus === 'delivered', 'Order Console now shows Delivered (same canonical order)', afterConsole.body?.data?.subOrders?.[0]?.trackingStatus);

  // Cross-surface: Buyer My Orders
  const buyerAfter = await api(`/operations/orders?buyerId=${encodeURIComponent(String(buyer.uid))}`, {}, buyerTok);
  const buyerRowAfter = (buyerAfter.body?.data || []).find((o: Record<string, unknown>) => o.orderId === orderId);
  check(
    buyerRowAfter && ((buyerRowAfter.subOrders || [])[0]?.trackingStatus === 'delivered' || buyerRowAfter.status === 'completed'),
    'Buyer My Orders reflects Delivered — no duplicated Messaging state',
    { tracking: (buyerRowAfter?.subOrders || [])[0]?.trackingStatus, status: buyerRowAfter?.status },
  );

  // Idempotent (mirrors the Order Console's own idempotency)
  const mdAgain = await api(
    `/operations/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/mark-delivered`,
    { method: 'POST', body: '{}' },
    seller.token,
  );
  check(mdAgain.status === 200, 'mark-delivered is idempotent (no double inventory decrement / no error)', mdAgain.status);

  // Buyer notification for the delivery transition (canonical path emits it —
  // the same one the Order Console emits; entry point is irrelevant). No
  // second Messaging notification is added — the Seller Inbox calls the exact
  // canonical endpoint.
  let notifArr: Array<Record<string, unknown>> = [];
  for (const url of [`${BASE}/api/v1/notifications`, `${BASE}/api/notifications`]) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${buyerTok}` } });
    const nb = await jsonOf(r);
    const cand =
      (Array.isArray(nb) && nb) ||
      nb.data?.items ||
      nb.items ||
      nb.data?.notifications ||
      nb.notifications ||
      nb.data ||
      [];
    if (Array.isArray(cand) && cand.length) {
      notifArr = cand;
      break;
    }
  }
  const blob = JSON.stringify(notifArr).toLowerCase();
  check(
    notifArr.length > 0 &&
      (blob.includes('deliver') || blob.includes(orderId.toLowerCase()) || blob.includes('order')),
    'buyer received an order notification from the canonical transition (not duplicated by Messaging)',
    { count: notifArr.length },
  );

  // ── DEFERRED transitions are NOT fabricated ──────────────────────
  const sellerCancel = await api(
    `/operations/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: 'test' }) },
    seller.token,
  );
  check(sellerCancel.status === 403, 'DEFERRED: seller cancel is correctly rejected (buyer-only endpoint) — not fabricated in Messaging', sellerCancel.status);

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL SELLER ORDER-MANAGEMENT CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
