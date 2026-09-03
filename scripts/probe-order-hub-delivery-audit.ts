/**
 * Order Hub — canonical delivery synchronisation (Sprint 14 fix).
 *
 * This probe was the pre-commit AUDIT probe; it is now the VERIFICATION probe
 * for the delivery-synchronisation fix. It proves the three "delivered" triggers
 * converge on ONE canonical state and that the fulfillment-aware presentation is
 * honest.
 *
 * Covered:
 *   A) COURIER webhook "delivered"  → OpsShipment delivered + Commerce order
 *      delivered + every Operations item.deliveredAt + Hub "Delivered" +
 *      "Complete order" next action + Delivered tab + ONE buyer System-B card;
 *      replay is idempotent; inventory is NOT consumed a second time.
 *   B) Lifecycle "Mark delivered" CTA → same convergence; replay idempotent.
 *   C) Per-item "Mark Delivered" on a REAL checkout order (stable itemIds):
 *      a partial delivery does NOT settle the whole order (no shipment flip,
 *      no Commerce advance, no buyer card); the FINAL item settles everything;
 *      re-marking is idempotent; inventory consumed exactly once (at Packed).
 *   D) A foreign seller cannot settle delivery on someone else's order.
 *   E) PICKUP: presentation reads "Ready for pickup" / "Mark collected" /
 *      "Collected" — never "Dispatched" / "In transit"; the buyer event says
 *      "collected"; the internal Commerce FSM is unchanged.
 *   F) failed_delivery / returned: NO ordinary "Mark delivered" — an exception
 *      + a Returns/Support path; nothing is settled.
 *   G) Seller-delivery keeps its manual Mark-delivered path (no webhook).
 *
 * Usage: npx tsx scripts/probe-order-hub-delivery-audit.ts   (dev server :3001)
 */
import {
  deriveHubStatus,
  lifecyclePanel,
  fulfillmentStatusLabel,
  orderMatchesTab,
  type OrderHubViewer,
} from '../src/pages/admin/orderHubModel';

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
  try { return t ? JSON.parse(t) : {}; } catch { return { _raw: t }; }
}
async function api(path: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string, password = DEV_PASS) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerBuyer(tag: string) {
  const email = `ohubds.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@buyer.choosify`;
  const password = 'OhubDs!2026';
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: `OHub DS ${tag}` }) });
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
  const li = await login(email, password);
  return { token: li.token, uid: String(reg.body.uid || reg.body.data?.uid) };
}
async function packedOrder(sellerTok: string, adminTok: string, listings: { id: string }[], tag: string) {
  const buyer = await registerBuyer(tag);
  await api('/cart/clear', { method: 'POST' }, buyer.token);
  for (const l of listings) {
    await api('/cart/items', { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: l.id, quantity: 1 }) }, buyer.token);
  }
  const idem = `ohubds-${tag}-${Date.now()}`;
  const co = await api('/checkout', { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify({ shipping: { fullName: 'DS Buyer', phone: '+8801711221100', address: 'Dhaka Rd', region: 'Dhaka' } }) }, buyer.token);
  const order = co.body?.data?.orders?.[0];
  const checkoutId = co.body?.data?.checkout?.id;
  await api('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }) }, buyer.token);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'packed' }) }, sellerTok);
  return { commerceId: order.id as string, opsId: order.orderNumber as string, buyer };
}
async function dispatch(tok: string, commerceId: string, method: string, courier?: string, trk?: string) {
  return api(`/orders/${encodeURIComponent(commerceId)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: method, courier, trackingNumber: trk }) }, tok);
}
async function webhook(adminTok: string, trk: string, status: string, desc: string) {
  const r = await fetch(`${BASE}/api/logistics/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTok}` },
    body: JSON.stringify({ courier: 'generic', payload: { trackingNumber: trk, status, location: 'Dhaka', description: desc } }),
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function commerceOrder(tok: string, commerceId: string) {
  return (await api(`/orders/${encodeURIComponent(commerceId)}`, {}, tok)).body?.data;
}
async function opsOrder(tok: string, opsId: string) {
  return (await api(`/operations/orders/${encodeURIComponent(opsId)}`, {}, tok)).body?.data;
}
async function track(tok: string, opsId: string) {
  return (await api(`/operations/shipments/track/${encodeURIComponent(opsId)}`, {}, tok)).body?.data;
}
async function inventoryQty(tok: string, productId: string) {
  const r = await api(`/catalog/products/${encodeURIComponent(productId)}/inventory`, {}, tok);
  return Number((r.body?.data ?? r.body)?.quantity);
}
async function deliveredCards(tok: string, buyerUid: string, opsId: string) {
  const r = await api(`/operations/platform-messages?userId=${encodeURIComponent(buyerUid)}`, {}, tok);
  const rows = (r.body?.data || []) as Array<Record<string, unknown>>;
  return rows.filter((m) => {
    const body = String((m.content as Record<string, unknown>)?.body ?? m.body ?? '').toLowerCase();
    const pid = String((m as Record<string, unknown>).platformMessageId ?? '');
    return pid === `sys_delivered_${opsId}` || ((body.includes('delivered') || body.includes('collected')) && body.includes('order'));
  });
}
const items = (o: Record<string, unknown> | null | undefined) =>
  (((o?.subOrders as Array<Record<string, unknown>>) || []).flatMap((s) => (s.items as Array<Record<string, unknown>>) || []));
const allDelivered = (o: Record<string, unknown> | null | undefined) => {
  const it = items(o);
  return it.length > 0 && it.every((x) => Boolean(x.deliveredAt));
};
const anyDelivered = (o: Record<string, unknown> | null | undefined) => items(o).some((x) => Boolean(x.deliveredAt));

const ADMIN_VIEWER: OrderHubViewer = { mode: 'admin', sellerId: null, role: 'admin' };
const sellerViewer = (uid: string): OrderHubViewer => ({ mode: 'seller', sellerId: uid, role: 'seller' });

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const sellerA = await login(SELLER_A_EMAIL);
  const sellerB = await login(SELLER_B_EMAIL);
  check(!!admin.token && !!sellerA.token && !!sellerB.token, 'seed logins');
  if (!admin.token || !sellerA.token) return finish();

  const prods = await api('/catalog/products?limit=200', {}, sellerA.token);
  const mine = (prods.body.data || []).filter(
    (x: Record<string, unknown>) => x.sellerId === sellerA.uid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  const pA = mine[0];
  const pB = mine[1] || mine[0];
  check(!!pA, 'seller A owns a live physical product');
  if (!pA) return finish();
  for (const p of [pA, pB]) {
    await api(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, admin.token);
  }
  const twoDistinct = pB.id !== pA.id;

  // ═══ A) COURIER webhook "delivered" drives full canonical settlement ═══
  console.log('\n─── A) courier webhook delivered ───────────────────────────────────');
  const A = await packedOrder(sellerA.token, admin.token, [pA], 'courier');
  const trkA = `TRK-DS-A-${Date.now()}`;
  await dispatch(sellerA.token, A.commerceId, 'courier', 'Pathao', trkA);
  const invAfterPackA = await inventoryQty(admin.token, String(pA.id));
  await webhook(admin.token, trkA, 'in_transit', 'At sorting hub');
  const wDel = await webhook(admin.token, trkA, 'delivered', 'Delivered to recipient');
  check(wDel.status === 200, 'courier "delivered" webhook accepted', wDel.status);

  const cA = await commerceOrder(admin.token, A.commerceId);
  const oA = await opsOrder(admin.token, A.opsId);
  const tA = await track(A.buyer.token, A.opsId);
  check(tA?.status === 'delivered', 'A: OpsShipment.status = delivered', tA?.status);
  check(cA?.status === 'delivered', 'A: Commerce order advanced shipped → delivered', cA?.status);
  check(allDelivered(oA), 'A: every Operations item has deliveredAt');
  const hubA = deriveHubStatus(oA, { commerce: cA, shipment: tA });
  check(hubA === 'delivered', 'A: deriveHubStatus → "delivered" (no Dispatched/Delivered contradiction)', hubA);
  check(orderMatchesTab(oA, 'delivered', { commerce: cA, shipment: tA }), 'A: order appears under the Delivered tab');
  const lcA = lifecyclePanel(cA, sellerViewer(sellerA.uid), tA);
  check(lcA.primaryAction?.label === 'Complete order', 'A: next lifecycle action is "Complete order"', lcA.primaryAction?.label);
  const cardsA = await deliveredCards(sellerA.token, A.buyer.uid, A.opsId);
  check(cardsA.length === 1, 'A: exactly ONE buyer "delivered" System-B card', cardsA.length);
  const invAfterDelA = await inventoryQty(admin.token, String(pA.id));
  check(invAfterDelA === invAfterPackA, 'A: inventory NOT consumed again on delivery (consumed once at Packed)', { afterPack: invAfterPackA, afterDeliver: invAfterDelA });

  // replay
  const wDel2 = await webhook(admin.token, trkA, 'delivered', 'Delivered to recipient (dup)');
  const cardsA2 = await deliveredCards(sellerA.token, A.buyer.uid, A.opsId);
  const cA2 = await commerceOrder(admin.token, A.commerceId);
  check(wDel2.status === 200 && cA2?.status === 'delivered', 'A: replayed "delivered" webhook → still delivered, no error', { s: wDel2.status, st: cA2?.status });
  check(cardsA2.length === 1, 'A: replay produced NO duplicate buyer card', cardsA2.length);
  const invReplayA = await inventoryQty(admin.token, String(pA.id));
  check(invReplayA === invAfterPackA, 'A: replay did NOT decrement inventory', { expected: invAfterPackA, actual: invReplayA });

  // Complete Order actually works now
  const compA = await api(`/orders/${encodeURIComponent(A.commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'completed' }) }, sellerA.token);
  check(compA.status === 200 && compA.body?.data?.order?.status === 'completed', 'A: "Complete order" transition succeeds', { s: compA.status, st: compA.body?.data?.order?.status });

  // ═══ B) Lifecycle "Mark delivered" CTA converges ═════════════════════
  console.log('\n─── B) lifecycle "Mark delivered" CTA ──────────────────────────────');
  const B = await packedOrder(sellerA.token, admin.token, [pA], 'lccta');
  await dispatch(sellerA.token, B.commerceId, 'courier', 'RedX', `TRK-DS-B-${Date.now()}`);
  const invAfterPackB = await inventoryQty(admin.token, String(pA.id));
  const bDel = await api(`/orders/${encodeURIComponent(B.commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerA.token);
  check(bDel.status === 200 && bDel.body?.data?.order?.status === 'delivered', 'B: CTA → Commerce order delivered', { s: bDel.status, st: bDel.body?.data?.order?.status });
  const oB = await opsOrder(admin.token, B.opsId);
  const tB = await track(admin.token, B.opsId);
  check(allDelivered(oB), 'B: CTA also set every Operations item.deliveredAt');
  check(tB?.status === 'delivered', 'B: CTA also synced OpsShipment → delivered', tB?.status);
  const cardsB = await deliveredCards(sellerA.token, B.buyer.uid, B.opsId);
  check(cardsB.length === 1, 'B: exactly ONE buyer "delivered" card', cardsB.length);
  check(await inventoryQty(admin.token, String(pA.id)) === invAfterPackB, 'B: no double inventory consumption');
  const bDel2 = await api(`/orders/${encodeURIComponent(B.commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerA.token);
  check(bDel2.body?.data?.reused === true && bDel2.body?.data?.order?.status === 'delivered', 'B: repeat "delivered" is a no-op (reused:true — not a second settlement)', { reused: bDel2.body?.data?.reused });
  check((await deliveredCards(sellerA.token, B.buyer.uid, B.opsId)).length === 1, 'B: repeat produced NO duplicate card');

  // ═══ C) Per-item "Mark Delivered" on a REAL checkout order ═══════════
  console.log('\n─── C) per-item "Mark Delivered" (checkout order, partial → final) ──');
  const C = await packedOrder(sellerA.token, admin.token, twoDistinct ? [pA, pB] : [pA], 'peritem');
  await dispatch(sellerA.token, C.commerceId, 'courier', 'Sundarban', `TRK-DS-C-${Date.now()}`);
  const oC0 = await opsOrder(admin.token, C.opsId);
  const cItems = items(oC0);
  const withId = cItems.filter((x) => x.itemId);
  check(withId.length === cItems.length && cItems.length > 0, 'C: every mirrored checkout item has a stable itemId', { total: cItems.length, withId: withId.length });
  const invAfterPackC = await inventoryQty(admin.token, String(pA.id));

  // first item
  const mark1 = await api(`/operations/orders/${encodeURIComponent(C.opsId)}/items/${encodeURIComponent(String(cItems[0].itemId))}/mark-delivered`, { method: 'POST', body: '{}' }, sellerA.token);
  check(mark1.status === 200, 'C: per-item Mark Delivered WORKS on a real checkout order (200)', mark1.status);
  const oC1 = await opsOrder(admin.token, C.opsId);
  const cC1 = await commerceOrder(admin.token, C.commerceId);
  const tC1 = await track(admin.token, C.opsId);
  if (twoDistinct) {
    check(items(oC1)[0].deliveredAt && !items(oC1)[1].deliveredAt, 'C: only the first item is delivered (partial)');
    check(!allDelivered(oC1), 'C: order NOT fully delivered after one of two items');
    check(cC1?.status === 'shipped', 'C: partial delivery does NOT advance the Commerce order', cC1?.status);
    check(tC1?.status !== 'delivered', 'C: partial delivery does NOT flip the OpsShipment', tC1?.status);
    check((await deliveredCards(sellerA.token, C.buyer.uid, C.opsId)).length === 0, 'C: partial delivery posts NO order-level buyer card');
  }

  // final item
  const lastId = String(cItems[cItems.length - 1].itemId);
  const mark2 = await api(`/operations/orders/${encodeURIComponent(C.opsId)}/items/${encodeURIComponent(lastId)}/mark-delivered`, { method: 'POST', body: '{}' }, sellerA.token);
  check(mark2.status === 200, 'C: final item Mark Delivered → 200', mark2.status);
  const oC2 = await opsOrder(admin.token, C.opsId);
  const cC2 = await commerceOrder(admin.token, C.commerceId);
  const tC2 = await track(admin.token, C.opsId);
  check(allDelivered(oC2), 'C: final item settles → every item delivered');
  check(tC2?.status === 'delivered', 'C: final item settles → OpsShipment delivered', tC2?.status);
  check(cC2?.status === 'delivered', 'C: final item settles → Commerce order delivered', cC2?.status);
  const cardsC = await deliveredCards(sellerA.token, C.buyer.uid, C.opsId);
  check(cardsC.length === 1, 'C: exactly ONE buyer "delivered" card after full settlement', cardsC.length);
  check(await inventoryQty(admin.token, String(pA.id)) === invAfterPackC, 'C: per-item settlement did NOT re-consume inventory (checkout already consumed at Packed)');
  const reMark = await api(`/operations/orders/${encodeURIComponent(C.opsId)}/items/${encodeURIComponent(lastId)}/mark-delivered`, { method: 'POST', body: '{}' }, sellerA.token);
  check(reMark.status === 200, 'C: re-marking an already-delivered item is idempotent (200)', reMark.status);
  check((await deliveredCards(sellerA.token, C.buyer.uid, C.opsId)).length === 1, 'C: re-mark produced NO duplicate card');

  // ═══ D) foreign seller cannot settle delivery ═══════════════════════
  console.log('\n─── D) foreign seller cannot settle delivery ───────────────────────');
  const D = await packedOrder(sellerA.token, admin.token, [pA], 'foreign');
  await dispatch(sellerA.token, D.commerceId, 'courier', 'Pathao', `TRK-DS-D-${Date.now()}`);
  const oD0 = await opsOrder(admin.token, D.opsId);
  const foreign = await api(`/operations/orders/${encodeURIComponent(D.opsId)}/items/${encodeURIComponent(String(items(oD0)[0].itemId))}/mark-delivered`, { method: 'POST', body: '{}' }, sellerB.token);
  check(foreign.status === 403, "D: foreign seller → 403 on someone else's order item", foreign.status);
  check(!anyDelivered(await opsOrder(admin.token, D.opsId)), 'D: nothing was settled by the rejected call');

  // ═══ E) PICKUP presentation ════════════════════════════════════════
  console.log('\n─── E) pickup presentation ─────────────────────────────────────────');
  const E = await packedOrder(sellerA.token, admin.token, [pA], 'pickup');
  await dispatch(sellerA.token, E.commerceId, 'pickup');
  const cE0 = await commerceOrder(admin.token, E.commerceId);
  const tE0 = await track(admin.token, E.opsId);
  check(tE0?.fulfillmentMethod === 'pickup', 'E: shipment fulfillmentMethod = pickup', tE0?.fulfillmentMethod);
  const hubE0 = deriveHubStatus(await opsOrder(admin.token, E.opsId), { commerce: cE0, shipment: tE0 });
  const labelE0 = fulfillmentStatusLabel(hubE0, tE0);
  check(labelE0 === 'Ready for pickup', 'E: Hub badge reads "Ready for pickup" (never "Dispatched")', labelE0);
  check(!/transit/i.test(labelE0), 'E: pickup badge never says "In transit"');
  const lcE0 = lifecyclePanel(cE0, sellerViewer(sellerA.uid), tE0);
  check(lcE0.primaryAction?.label === 'Mark collected', 'E: pickup next action reads "Mark collected"', lcE0.primaryAction?.label);
  // collect it
  await api(`/orders/${encodeURIComponent(E.commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerA.token);
  const cE1 = await commerceOrder(admin.token, E.commerceId);
  const tE1 = await track(admin.token, E.opsId);
  const labelE1 = fulfillmentStatusLabel(deriveHubStatus(await opsOrder(admin.token, E.opsId), { commerce: cE1, shipment: tE1 }), tE1);
  check(labelE1 === 'Collected', 'E: after collection the badge reads "Collected"', labelE1);
  check(cE1?.status === 'delivered', 'E: internal Commerce FSM still uses packed→shipped→delivered (unchanged)', cE1?.status);
  const cardsE = await deliveredCards(sellerA.token, E.buyer.uid, E.opsId);
  check(cardsE.length === 1 && /collect/i.test(String((cardsE[0].content as Record<string, unknown>)?.body ?? cardsE[0].body ?? '')), 'E: the buyer event says "collected" (not "delivered")');

  // ═══ F) failed_delivery / returned suppress "Mark delivered" ════════
  console.log('\n─── F) failed_delivery / returned ─────────────────────────────────');
  for (const exc of ['failed_delivery', 'returned'] as const) {
    const F = await packedOrder(sellerA.token, admin.token, [pA], `exc-${exc}`);
    const trkF = `TRK-DS-F-${exc}-${Date.now()}`;
    await dispatch(sellerA.token, F.commerceId, 'courier', 'Pathao', trkF);
    await webhook(admin.token, trkF, exc, `Courier reported ${exc}`);
    const cF = await commerceOrder(admin.token, F.commerceId);
    const tF = await track(admin.token, F.opsId);
    const oF = await opsOrder(admin.token, F.opsId);
    check(tF?.status === exc, `F(${exc}): OpsShipment records the exception honestly`, tF?.status);
    check(cF?.status === 'shipped' && !anyDelivered(oF), `F(${exc}): nothing settled — Commerce still shipped, no item deliveredAt`, cF?.status);
    const lcF = lifecyclePanel(cF, sellerViewer(sellerA.uid), tF);
    check(lcF.primaryAction?.label !== 'Mark delivered' && lcF.primaryAction?.label !== 'Mark collected', `F(${exc}): NO ordinary "Mark delivered" CTA`, lcF.primaryAction?.label);
    check(lcF.exception?.kind === exc, `F(${exc}): lifecycle panel exposes the exception`, lcF.exception);
    check(lcF.secondaryActions.some((a) => a.kind === 'request_correction'), `F(${exc}): a Returns / Support correction path is offered`);
  }

  // ═══ G) seller-delivery keeps its manual Mark-delivered path ════════
  console.log('\n─── G) seller-delivery manual path ────────────────────────────────');
  const G = await packedOrder(sellerA.token, admin.token, [pA], 'sellerdel');
  await dispatch(sellerA.token, G.commerceId, 'seller_delivery', 'Own rider — Karim');
  const cG0 = await commerceOrder(admin.token, G.commerceId);
  const tG0 = await track(admin.token, G.opsId);
  const lcG0 = lifecyclePanel(cG0, sellerViewer(sellerA.uid), tG0);
  check(lcG0.primaryAction?.label === 'Mark delivered', 'G: seller-delivery keeps a manual "Mark delivered" CTA (no webhook)', lcG0.primaryAction?.label);
  const gDel = await api(`/orders/${encodeURIComponent(G.commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerA.token);
  const oG = await opsOrder(admin.token, G.opsId);
  const tG = await track(admin.token, G.opsId);
  check(gDel.status === 200 && allDelivered(oG) && tG?.status === 'delivered', 'G: manual "Mark delivered" settles the whole order', { s: gDel.status, ship: tG?.status });
  check((await deliveredCards(sellerA.token, G.buyer.uid, G.opsId)).length === 1, 'G: one buyer "delivered" card');

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) { for (const f of FAIL) console.log(' -', f); process.exit(1); }
  console.log('ALL DELIVERY-SYNCHRONISATION CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
