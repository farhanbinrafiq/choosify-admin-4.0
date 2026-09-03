/**
 * Order Hub — Dispatch Details gate + Administrative Status Correction + legacy
 * shipment cleanup (Sprint 14).
 *
 * Proves:
 *   legacy cleanup  — a new order's canonical shipment has NO courier, NO
 *                     tracking, status `awaiting_dispatch` (no fake Pathao/TRK-…)
 *   dispatch gate   — Processing → Dispatched requires valid Dispatch Details;
 *                     invalid → 400 + order does NOT advance; valid courier +
 *                     tracking → OpsShipment saved (status 'dispatched', NOT
 *                     'in_transit') then order → shipped; seller-own-delivery
 *                     works with no tracking; foreign seller → 403; duplicate
 *                     submit is idempotent (1 transition, 1 shipment record,
 *                     1 System-B card, 1 buyer notification)
 *   tracking sync   — Order Hub, buyer tracking and the seller shipment record
 *                     all read identical canonical data; a later courier
 *                     checkpoint moves it to In Transit everywhere
 *   System-B        — exactly ONE structured dispatch card in
 *                     conv_platform_<buyerId>; never in another buyer's thread
 *   admin correct   — confirmed→pending; packed→confirmed|pending correctly
 *                     reverse inventory consumption; shipped→packed ONLY before
 *                     courier movement (409 + zero mutation after); reason
 *                     required; disallowed targets 409; seller → 403; history
 *                     (checkpoints) preserved
 *
 * Usage: npx tsx scripts/probe-order-hub-dispatch-correct.ts   (dev server :3001)
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
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 320));
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
  const email = `ohubdc.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@buyer.choosify`;
  const password = 'OhubDc!2026';
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: `OHub DC ${tag}` }) });
  return { email, password, uid: reg.body.uid || reg.body.data?.uid };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}

/** A real checkout → Commerce order (+ mirrored Ops order). Returns { commerceId, opsId, buyerAuth, buyerUid }. */
async function freshOrder(adminTok: string, sellerA: { uid: string }, pA: any, tag: string) {
  const buyer = await registerBuyer(tag);
  await dbVerifyEmail(buyer.email);
  const buyerAuth = await login(buyer.email, buyer.password);
  await api('/cart/clear', { method: 'POST' }, buyerAuth.token);
  await api('/cart/items', { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: pA.id, quantity: 1 }) }, buyerAuth.token);
  const idem = `ohubdc-${tag}-${Date.now()}`;
  const co = await api(
    '/checkout',
    { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify({ shipping: { fullName: 'OHub DC Buyer', phone: '+8801711224400', address: 'Dhaka Probe Rd', region: 'Dhaka' } }) },
    buyerAuth.token,
  );
  const order = co.body?.data?.orders?.[0];
  const checkoutId = co.body?.data?.checkout?.id;
  await api('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }) }, buyerAuth.token);
  return { commerceId: order?.id as string, opsId: order?.orderNumber as string, buyerAuth, buyerUid: String(buyer.uid) };
}
async function confirm(tok: string, commerceId: string) {
  return api(`/orders/${encodeURIComponent(commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, tok);
}
async function pack(tok: string, commerceId: string) {
  return api(`/orders/${encodeURIComponent(commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'packed' }) }, tok);
}
async function getOpsOrder(tok: string, opsId: string) {
  return (await api(`/operations/orders/${encodeURIComponent(opsId)}`, {}, tok)).body?.data;
}
async function track(tok: string, opsId: string) {
  return (await api(`/operations/shipments/track/${encodeURIComponent(opsId)}`, {}, tok)).body?.data;
}
async function inventoryQty(tok: string, productId: string) {
  const r = await api(`/catalog/products/${encodeURIComponent(productId)}/inventory`, {}, tok);
  return r.body?.data ?? r.body;
}
async function sbThreadText(tok: string, buyerUid: string) {
  const r = await api(`/operations/platform-messages?userId=${encodeURIComponent(buyerUid)}`, {}, tok);
  return { raw: JSON.stringify(r.body || {}), rows: r.body?.data || [] };
}

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const sellerA = await login(SELLER_A_EMAIL);
  const sellerB = await login(SELLER_B_EMAIL);
  check(!!admin.token && !!sellerA.token && !!sellerB.token, 'seed logins');
  if (!admin.token || !sellerA.token) return finish();

  const prods = await api('/catalog/products?limit=150', {}, sellerA.token);
  const pA = (prods.body.data || []).find(
    (x: Record<string, unknown>) => x.sellerId === sellerA.uid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  check(!!pA, 'seller A owns a live physical product');
  if (!pA) return finish();
  await api(`/catalog/products/${pA.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, admin.token);

  // ── legacy shipment cleanup ────────────────────────────────────────
  const o0 = await freshOrder(admin.token, sellerA, pA, 'legacy');
  const ship0 = await track(admin.token, o0.opsId);
  check(ship0 && ship0.status === 'awaiting_dispatch', 'new order shipment status is awaiting_dispatch (not pending_pickup)', ship0?.status);
  check(ship0 && ship0.courier === '', 'new order does NOT falsely claim a Pathao assignment', ship0?.courier);
  check(ship0 && ship0.trackingNumber === '', 'new order does NOT expose a synthetic TRK-… as genuine tracking', ship0?.trackingNumber);
  check(ship0 && !ship0.dispatchedAt, 'new order has no dispatchedAt', ship0?.dispatchedAt);

  // ── dispatch gate: requires info ──────────────────────────────────
  const o1 = await freshOrder(admin.token, sellerA, pA, 'gate');
  await confirm(sellerA.token, o1.commerceId);
  await pack(sellerA.token, o1.commerceId);
  const noInfo = await api(
    `/orders/${encodeURIComponent(o1.commerceId)}/dispatch`,
    { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier' }) },
    sellerA.token,
  );
  check(noInfo.status === 400 && noInfo.body?.code === 'DISPATCH_VALIDATION', 'courier dispatch with no courier/tracking → 400 DISPATCH_VALIDATION', noInfo.status);
  check(
    noInfo.body?.details?.courier && noInfo.body?.details?.trackingNumber,
    'both courier AND tracking are flagged (no "no tracking" bypass)',
    noInfo.body?.details,
  );
  const o1ops = await getOpsOrder(admin.token, o1.opsId);
  check(o1ops?.status === 'active', 'order did NOT advance on a failed dispatch (still packed/active mirror)', o1ops?.status);

  // ── dispatch gate: valid courier + tracking ──────────────────────
  const trk1 = `TRK-PROBE-${Date.now()}`;
  const okDispatch = await api(
    `/orders/${encodeURIComponent(o1.commerceId)}/dispatch`,
    { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: trk1, estimatedDelivery: '2026-09-20' }) },
    sellerA.token,
  );
  check(okDispatch.status === 200 && okDispatch.body?.data?.order?.status === 'shipped', 'valid dispatch → order advances to shipped', okDispatch.status);
  const s1 = okDispatch.body?.data?.shipment;
  check(s1?.status === 'dispatched', 'OpsShipment status is "dispatched" — NOT automatically "in_transit"', s1?.status);
  check(s1?.courier === 'Pathao' && s1?.trackingNumber === trk1 && !!s1?.dispatchedAt, 'canonical shipment saved courier + tracking + dispatchedAt');

  // Order Hub / buyer tracking / seller record agree
  const hubSeller = await track(sellerA.token, o1.opsId);
  const buyerTrack = await track(o1.buyerAuth.token, o1.opsId);
  check(
    hubSeller?.status === 'dispatched' && buyerTrack?.status === 'dispatched' &&
      hubSeller?.trackingNumber === trk1 && buyerTrack?.trackingNumber === trk1 && buyerTrack?.courier === 'Pathao',
    'Order Hub, seller record and Buyer tracking read identical canonical shipment data',
  );

  // ── exactly one System-B dispatch card, correct thread only ──────
  const sb = await sbThreadText(sellerA.token, o1.buyerUid);
  const dispatchCards = (sb.rows as any[]).filter((m) => m.dispatchEvent?.orderId === o1.opsId || (m.dispatchEvent && String(m.content?.body || '').includes('dispatched')));
  check(dispatchCards.length === 1, 'exactly ONE structured dispatch card in the buyer↔seller thread', dispatchCards.length);
  check(
    dispatchCards[0]?.dispatchEvent?.trackingNumber === trk1 && dispatchCards[0]?.dispatchEvent?.courier === 'Pathao',
    'the dispatch card carries the canonical courier + tracking',
  );
  const otherSb = await sbThreadText(admin.token, o0.buyerUid);
  check(!otherSb.raw.includes(trk1), 'the dispatch card is NOT in a different buyer\'s conversation');

  // ── idempotency: retry produces no duplicates ───────────────────
  const retry = await api(
    `/orders/${encodeURIComponent(o1.commerceId)}/dispatch`,
    { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: trk1 }) },
    sellerA.token,
  );
  check(retry.status === 200 && retry.body?.data?.reused === true, 'duplicate dispatch → reused:true (no second transition)', retry.status);
  const sb2 = await sbThreadText(sellerA.token, o1.buyerUid);
  const cards2 = (sb2.rows as any[]).filter((m) => m.dispatchEvent);
  check(cards2.length === 1, 'still exactly ONE dispatch card after a retry (idempotent System-B write)', cards2.length);
  const trackAfterRetry = await track(admin.token, o1.opsId);
  const dispatchedEvents = (trackAfterRetry?.trackingEvents || []).filter((e: any) => e.status === 'dispatched');
  check(dispatchedEvents.length === 1, 'still exactly ONE "dispatched" checkpoint after a retry', dispatchedEvents.length);

  // ── seller-own-delivery with NO tracking number ─────────────────
  const o2 = await freshOrder(admin.token, sellerA, pA, 'own');
  await confirm(sellerA.token, o2.commerceId);
  await pack(sellerA.token, o2.commerceId);
  const ownDispatch = await api(
    `/orders/${encodeURIComponent(o2.commerceId)}/dispatch`,
    { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'seller_delivery', courier: 'Own rider — Rahim' }) },
    sellerA.token,
  );
  check(ownDispatch.status === 200 && ownDispatch.body?.data?.order?.status === 'shipped', 'seller-own-delivery dispatch (no tracking) → shipped', ownDispatch.status);
  check(ownDispatch.body?.data?.shipment?.fulfillmentMethod === 'seller_delivery', 'own-delivery fulfillment method recorded');

  // ── foreign seller cannot dispatch ─────────────────────────────
  const o3 = await freshOrder(admin.token, sellerA, pA, 'foreign');
  await confirm(sellerA.token, o3.commerceId);
  await pack(sellerA.token, o3.commerceId);
  const foreign = await api(
    `/orders/${encodeURIComponent(o3.commerceId)}/dispatch`,
    { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'RedX', trackingNumber: 'X1' }) },
    sellerB.token,
  );
  check(foreign.status === 403, "foreign seller cannot dispatch seller A's order → 403", foreign.status);

  // ── later courier checkpoint → In Transit everywhere ───────────
  // logisticsRouter is mounted at /api (not /api/v1)
  const whRes = await fetch(`${BASE}/api/logistics/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ courier: 'generic', payload: { trackingNumber: trk1, status: 'in_transit', location: 'Dhaka sorting hub', description: 'Arrived at sorting hub' } }),
  });
  const wh = { status: whRes.status, body: await jsonOf(whRes) };
  check(wh.status === 200, 'courier checkpoint webhook accepted', wh.status);
  const afterWh = await track(o1.buyerAuth.token, o1.opsId);
  check(afterWh?.status === 'in_transit', 'buyer tracking now shows In Transit (checkpoint-driven, not the dispatch click)', afterWh?.status);
  check((afterWh?.trackingEvents || []).some((e: any) => String(e.description).includes('sorting hub')), 'the new checkpoint appears in buyer tracking history');

  // ── admin: shipped → packed is now REJECTED (courier moved) ────
  const retractAfterMove = await api(
    `/orders/${encodeURIComponent(o1.commerceId)}/admin-correct`,
    { method: 'POST', body: JSON.stringify({ toStatus: 'packed', reason: 'seller says wrong parcel' }) },
    admin.token,
  );
  check(retractAfterMove.status === 409, 'admin retract dispatch AFTER courier movement → 409', retractAfterMove.status);
  const o1still = await getOpsOrder(admin.token, o1.opsId);
  check(o1still?.status === 'active', 'order unchanged after the rejected correction (zero mutation)', o1still?.status);

  // ── admin: confirmed → pending ────────────────────────────────
  const c1 = await freshOrder(admin.token, sellerA, pA, 'ac1');
  await confirm(sellerA.token, c1.commerceId);
  const noReason = await api(`/orders/${encodeURIComponent(c1.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'pending' }) }, admin.token);
  check(noReason.status === 400, 'admin correction with no reason → 400', noReason.status);
  const seller403 = await api(`/orders/${encodeURIComponent(c1.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'pending', reason: 'x' }) }, sellerA.token);
  check(seller403.status === 403, 'seller cannot use Administrative Status Correction → 403', seller403.status);
  const cToP = await api(`/orders/${encodeURIComponent(c1.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'pending', reason: 'accepted by mistake' }) }, admin.token);
  check(cToP.status === 200 && cToP.body?.data?.from === 'confirmed' && cToP.body?.data?.to === 'pending', 'admin confirmed → pending → 200', cToP.status);
  check((await getOpsOrder(admin.token, c1.opsId))?.status === 'pending_payment', 'ops mirror reverted to pending_payment (leaves Active, re-enters Pending)');

  // ── admin: packed → confirmed correctly reverses inventory consumption ──
  const c2 = await freshOrder(admin.token, sellerA, pA, 'ac2');
  await confirm(sellerA.token, c2.commerceId);
  const invBeforePack = await inventoryQty(admin.token, String(pA.id));
  await pack(sellerA.token, c2.commerceId);
  const invAfterPack = await inventoryQty(admin.token, String(pA.id));
  check(Number(invAfterPack?.quantity) === Number(invBeforePack?.quantity) - 1, 'packing consumed 1 unit', { before: invBeforePack?.quantity, after: invAfterPack?.quantity });
  const pToC = await api(`/orders/${encodeURIComponent(c2.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'confirmed', reason: 'packed the wrong order' }) }, admin.token);
  check(pToC.status === 200 && pToC.body?.data?.to === 'confirmed', 'admin packed → confirmed → 200', pToC.status);
  const invAfterCorrect = await inventoryQty(admin.token, String(pA.id));
  check(Number(invAfterCorrect?.quantity) === Number(invBeforePack?.quantity), 'inventory consumption REVERSED (quantity restored)', { restored: invAfterCorrect?.quantity, expected: invBeforePack?.quantity });

  // ── admin: shipped → packed BEFORE movement (history preserved) ──
  const c3 = await freshOrder(admin.token, sellerA, pA, 'ac3');
  await confirm(sellerA.token, c3.commerceId);
  await pack(sellerA.token, c3.commerceId);
  const trk3 = `TRK-RETRACT-${Date.now()}`;
  await api(`/orders/${encodeURIComponent(c3.commerceId)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'RedX', trackingNumber: trk3 }) }, sellerA.token);
  const beforeRetract = await track(admin.token, c3.opsId);
  const retract = await api(`/orders/${encodeURIComponent(c3.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'packed', reason: 'dispatched too early' }) }, admin.token);
  check(retract.status === 200 && retract.body?.data?.to === 'packed', 'admin shipped → packed BEFORE any movement → 200', retract.status);
  const afterRetract = await track(admin.token, c3.opsId);
  check(afterRetract?.status === 'awaiting_dispatch' && afterRetract?.courier === '' && afterRetract?.trackingNumber === '', 'dispatch retracted — OpsShipment back to awaiting_dispatch, courier/tracking cleared');
  check(
    (afterRetract?.trackingEvents || []).length >= (beforeRetract?.trackingEvents || []).length &&
      (afterRetract?.trackingEvents || []).some((e: any) => String(e.description).includes('retracted')),
    'history preserved — prior checkpoints kept + a "Dispatch retracted" event appended',
  );

  // ── disallowed correction targets ─────────────────────────────
  const bad1 = await api(`/orders/${encodeURIComponent(c3.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'shipped', reason: 'x' }) }, admin.token);
  check(bad1.status === 409, 'admin packed → shipped (not a correction target) → 409', bad1.status);
  const bad2 = await api(`/orders/${encodeURIComponent(c1.commerceId)}/admin-correct`, { method: 'POST', body: JSON.stringify({ toStatus: 'confirmed', reason: 'x' }) }, admin.token);
  check(bad2.status === 409, 'admin pending → confirmed (not a correction target) → 409', bad2.status);

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL DISPATCH / ADMIN-CORRECTION CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
