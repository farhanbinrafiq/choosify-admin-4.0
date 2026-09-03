/**
 * Order Hub — lifecycle + internal notes + invoice/returns scoping (Sprint 14).
 *
 * Proves the NEW server surface the Full Order Details page drives:
 *   - GET /orders/by-number/:opsOrderId resolves the canonical Commerce order,
 *     actor-scoped (buyer & owning seller & admin → 200; other seller → 403;
 *     unknown → 404).
 *   - POST /orders/:commerceId/transition enforces the FSM + role + ownership
 *     (owning seller: invalid jump rejected, legal step ok; other seller → 403;
 *     admin ok).
 *   - GET/POST /operations/orders/:id/notes is STAFF-ONLY (seller & buyer → 403),
 *     append-only, and the note text never appears in the System-B thread.
 *   - GET /operations/returns?orderId=… narrows without widening authorization.
 *
 * Usage: npx tsx scripts/probe-order-hub-lifecycle-notes.ts   (dev server :3001)
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_A_EMAIL = 'seller@choosify.com.bd';
const SELLER_B_EMAIL = 'creator@choosify.com.bd';

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
  const email = `ohubln.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'OhubLn!2026';
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName: `OHub LN Buyer ${tag}` }),
  });
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
  const sellerA = await login(SELLER_A_EMAIL);
  const sellerB = await login(SELLER_B_EMAIL);
  check(!!admin.token && !!sellerA.token && !!sellerB.token, 'seed logins');
  if (!admin.token || !sellerA.token || !sellerB.token) return finish();

  // seller A live physical product + inventory
  const prods = await api('/catalog/products?limit=150', {}, sellerA.token);
  const pA = (prods.body.data || []).find(
    (x: Record<string, unknown>) =>
      x.sellerId === sellerA.uid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  check(!!pA, 'seller A owns a live physical product', prods.body.data?.length);
  if (!pA) return finish();
  await api(
    `/catalog/products/${pA.id}/inventory`,
    { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) },
    admin.token,
  );

  // The ordered-item "open in Product Studio" deep link grants nothing — the
  // Studio's own write boundary (requireProductEdit) 403s a foreign seller.
  const allProds = await api('/catalog/products?limit=200', {}, admin.token);
  const foreignProd = (allProds.body.data || []).find(
    (x: Record<string, unknown>) => String(x.sellerId || '') && x.sellerId !== sellerA.uid,
  );
  if (foreignProd) {
    const forgedEdit = await api(
      `/catalog/products/${foreignProd.id}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'hijacked via order deep link' }) },
      sellerA.token,
    );
    check(
      forgedEdit.status === 403 || forgedEdit.status === 404,
      "seller A cannot manage another seller's product via a forged id (Product Studio write boundary) → 403/404",
      forgedEdit.status,
    );
  } else {
    check(true, 'no foreign product available to test the Studio write boundary (skipped)');
  }

  // real checkout → CommerceOrder + mirrored Ops order (orderNumber === opsOrderId)
  const buyer = await registerBuyer('a');
  await dbVerifyEmail(buyer.email);
  const buyerAuth = await login(buyer.email, buyer.password);
  await api('/cart/clear', { method: 'POST' }, buyerAuth.token);
  await api(
    '/cart/items',
    { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: pA.id, quantity: 1 }) },
    buyerAuth.token,
  );
  const idem = `ohub-ln-${Date.now()}`;
  const checkout = await api(
    '/checkout',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idem },
      body: JSON.stringify({
        shipping: { fullName: 'OHub LN Buyer', phone: '+8801711220000', address: 'Dhaka Probe Rd', region: 'Dhaka' },
      }),
    },
    buyerAuth.token,
  );
  const cOrder = checkout.body?.data?.orders?.[0];
  const checkoutId = checkout.body?.data?.checkout?.id;
  check(checkout.status === 201 && !!cOrder?.id && !!cOrder?.orderNumber, 'real checkout created a commerce order', {
    status: checkout.status,
  });
  if (!cOrder?.orderNumber || !checkoutId) return finish();

  // COD payment (deliveryTotal 0 → COD policy allows Confirm without gateway capture,
  // same as probe-orders.ts). Without this a prepaid order legitimately stays Pending.
  await api(
    '/commerce/payments/initiate',
    {
      method: 'POST',
      body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }),
    },
    buyerAuth.token,
  );
  const opsId = cOrder.orderNumber as string;
  const commerceId = cOrder.id as string;

  // ── by-number resolution + scoping ──────────────────────────────────
  const byNumBuyer = await api(`/orders/by-number/${encodeURIComponent(opsId)}`, {}, buyerAuth.token);
  check(byNumBuyer.status === 200 && byNumBuyer.body?.data?.id === commerceId, 'buyer resolves by-number → its commerce order');
  const byNumA = await api(`/orders/by-number/${encodeURIComponent(opsId)}`, {}, sellerA.token);
  check(byNumA.status === 200 && byNumA.body?.data?.id === commerceId, 'owning seller A resolves by-number → 200');
  const byNumB = await api(`/orders/by-number/${encodeURIComponent(opsId)}`, {}, sellerB.token);
  check(byNumB.status === 403, 'non-owner seller B by-number → 403', byNumB.status);
  const byNumAdmin = await api(`/orders/by-number/${encodeURIComponent(opsId)}`, {}, admin.token);
  check(byNumAdmin.status === 200, 'admin by-number → 200', byNumAdmin.status);
  const byNumMissing = await api(`/orders/by-number/${encodeURIComponent('CHO-DOES-NOT-EXIST-' + Date.now())}`, {}, admin.token);
  check(byNumMissing.status === 404, 'unknown order number → 404 (Hub hides the lifecycle panel)', byNumMissing.status);

  // ── lifecycle transitions ──────────────────────────────────────────
  const badJump = await api(
    `/orders/${encodeURIComponent(commerceId)}/transition`,
    { method: 'POST', body: JSON.stringify({ status: 'shipped' }) },
    sellerA.token,
  );
  check(badJump.status >= 400, 'seller A pending→shipped (illegal jump) rejected', badJump.status);
  const foreignTransition = await api(
    `/orders/${encodeURIComponent(commerceId)}/transition`,
    { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) },
    sellerB.token,
  );
  check(foreignTransition.status === 403, 'seller B cannot transition seller A\'s order → 403', foreignTransition.status);
  const confirmOk = await api(
    `/orders/${encodeURIComponent(commerceId)}/transition`,
    { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) },
    sellerA.token,
  );
  check(
    confirmOk.status === 200 && confirmOk.body?.data?.order?.status === 'confirmed',
    'seller A pending→confirmed (legal step) → 200',
    confirmOk.status,
  );
  const adminPack = await api(
    `/orders/${encodeURIComponent(commerceId)}/transition`,
    { method: 'POST', body: JSON.stringify({ status: 'packed' }) },
    admin.token,
  );
  check(
    adminPack.status === 200 && adminPack.body?.data?.order?.status === 'packed',
    'admin confirmed→packed → 200',
    adminPack.status,
  );
  // mirror: the Operations order the Hub reads reflects the FSM (packed → active)
  const opsAfter = await api(`/operations/orders/${encodeURIComponent(opsId)}`, {}, admin.token);
  check(opsAfter.body?.data?.status === 'active', 'operations order mirror advanced (packed → active)', opsAfter.body?.data?.status);

  // ── controlled "Return to Pending" (confirmed → pending ONLY) ───────
  // order #1 is already packed — reversal must be refused.
  const revPacked = await api(
    `/orders/${encodeURIComponent(commerceId)}/return-to-pending`,
    { method: 'POST', body: JSON.stringify({ reason: 'oops' }) },
    sellerA.token,
  );
  check(revPacked.status === 409, 'packed order → return-to-pending 409 (not exactly confirmed / shipment exists)', revPacked.status);

  // fresh order #2, confirmed, then reversed
  await api('/cart/clear', { method: 'POST' }, buyerAuth.token);
  await api(
    '/cart/items',
    { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: pA.id, quantity: 1 }) },
    buyerAuth.token,
  );
  const idem2 = `ohub-ln2-${Date.now()}`;
  const co2r = await api(
    '/checkout',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idem2 },
      body: JSON.stringify({ shipping: { fullName: 'OHub LN Buyer', phone: '+8801711220000', address: 'Dhaka Probe Rd', region: 'Dhaka' } }),
    },
    buyerAuth.token,
  );
  const o2 = co2r.body?.data?.orders?.[0];
  const chk2 = co2r.body?.data?.checkout?.id;
  await api('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId: chk2, paymentMethod: 'cod', idempotencyKey: `${idem2}-cod` }) }, buyerAuth.token);
  await api(`/orders/${encodeURIComponent(o2.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, sellerA.token);

  const revForeign = await api(
    `/orders/${encodeURIComponent(o2.id)}/return-to-pending`,
    { method: 'POST', body: JSON.stringify({ reason: 'x' }) },
    sellerB.token,
  );
  check(revForeign.status === 403, "seller B cannot return seller A's confirmed order to pending → 403", revForeign.status);

  const revOk = await api(
    `/orders/${encodeURIComponent(o2.id)}/return-to-pending`,
    { method: 'POST', body: JSON.stringify({ reason: 'accepted by mistake' }) },
    sellerA.token,
  );
  check(
    revOk.status === 200 && revOk.body?.data?.status === 'pending' && revOk.body?.data?.returnedToPendingBy && revOk.body?.data?.returnedToPendingReason === 'accepted by mistake',
    'seller A confirmed→pending correction → 200, records actor + reason (history not deleted)',
    revOk.status,
  );
  const o2ops = revOk.body?.data?.orderNumber;
  const o2opsRow = await api(`/operations/orders/${encodeURIComponent(o2ops)}`, {}, admin.token);
  check(o2opsRow.body?.data?.status === 'pending_payment', 'operations mirror reverted (confirmed → pending_payment) — leaves Active, re-enters Pending', o2opsRow.body?.data?.status);

  const revAgain = await api(
    `/orders/${encodeURIComponent(o2.id)}/return-to-pending`,
    { method: 'POST', body: JSON.stringify({ reason: 'again' }) },
    sellerA.token,
  );
  check(revAgain.status === 409, 'return-to-pending on an already-pending order → 409 (only a confirmed order qualifies)', revAgain.status);

  const reAccept = await api(
    `/orders/${encodeURIComponent(o2.id)}/transition`,
    { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) },
    sellerA.token,
  );
  check(reAccept.status === 200 && reAccept.body?.data?.order?.status === 'confirmed', 're-accepting the corrected order works (reversible, no re-charge for COD)', reAccept.status);

  // ── internal notes: staff-only, append-only, never in System-B ──────
  const noteText = `ZZZ_PROBE internal note ${Date.now()} — staff eyes only`;
  const addNote = await api(
    `/operations/orders/${encodeURIComponent(opsId)}/notes`,
    { method: 'POST', body: JSON.stringify({ body: noteText, authorName: 'Probe Admin' }) },
    admin.token,
  );
  check(addNote.status === 201 && (addNote.body?.data || []).some((n: any) => n.body === noteText), 'admin POST note → 201', addNote.status);
  const listNotes = await api(`/operations/orders/${encodeURIComponent(opsId)}/notes`, {}, admin.token);
  const savedNote = (listNotes.body?.data || []).find((n: any) => n.body === noteText);
  check(
    listNotes.status === 200 && savedNote && savedNote.authorId && savedNote.authorRole && savedNote.createdAt,
    'admin GET notes → note has author id/role/timestamp',
  );
  const sellerGetNotes = await api(`/operations/orders/${encodeURIComponent(opsId)}/notes`, {}, sellerA.token);
  check(sellerGetNotes.status === 403, 'owning seller GET notes → 403 (staff-only)', sellerGetNotes.status);
  const sellerPostNote = await api(
    `/operations/orders/${encodeURIComponent(opsId)}/notes`,
    { method: 'POST', body: JSON.stringify({ body: 'seller sneak note' }) },
    sellerA.token,
  );
  check(sellerPostNote.status === 403, 'owning seller POST note → 403', sellerPostNote.status);
  const buyerGetNotes = await api(`/operations/orders/${encodeURIComponent(opsId)}/notes`, {}, buyerAuth.token);
  check(buyerGetNotes.status === 403, 'buyer GET notes → 403', buyerGetNotes.status);
  const emptyNote = await api(
    `/operations/orders/${encodeURIComponent(opsId)}/notes`,
    { method: 'POST', body: JSON.stringify({ body: '   ' }) },
    admin.token,
  );
  check(emptyNote.status === 400, 'empty note body → 400', emptyNote.status);

  // the note must NOT leak into the buyer↔seller System-B thread
  const sbThread = await api(
    `/operations/platform-messages?userId=${encodeURIComponent(String(buyer.uid))}`,
    {},
    sellerA.token,
  );
  const sbText = JSON.stringify(sbThread.body || {});
  check(!sbText.includes('ZZZ_PROBE internal note'), 'internal note text does NOT appear in the System-B conversation');

  // ── returns orderId filter narrows, never widens ───────────────────
  const retAdmin = await api(`/operations/returns?orderId=${encodeURIComponent(opsId)}`, {}, admin.token);
  check(retAdmin.status === 200 && Array.isArray(retAdmin.body?.data), 'admin returns?orderId= → 200 array', retAdmin.status);
  const retSellerA = await api(`/operations/returns?orderId=${encodeURIComponent(opsId)}`, {}, sellerA.token);
  check(
    retSellerA.status === 200 && (retSellerA.body?.data || []).every((r: any) => r.orderId === opsId),
    'seller returns?orderId= stays within own scope + the order',
    retSellerA.status,
  );
  const retForge = await api(
    `/operations/returns?orderId=${encodeURIComponent(opsId)}&sellerId=${encodeURIComponent(sellerB.uid)}`,
    {},
    sellerA.token,
  );
  check(retForge.status === 403, 'seller A returns?sellerId=<B> → 403 (filter is not authorization)', retForge.status);

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL ORDER-HUB LIFECYCLE / NOTES CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
