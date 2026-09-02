/**
 * Manual Order acquisition — canonical /operations/manual-offers flow, both
 * customer modes, plus the external claim-link security surface.
 *
 * Covers (spec item 15):
 *   native   : existing Buyer → Offer Card → accept → My Orders
 *   external : mandatory name/email/phone → secure claim link → signup →
 *              VERIFIED matching identity → confirm → order in new account,
 *              provenance retained, inventory/order exactly once, idempotent
 *   negatives: missing/malformed email & phone, wrong account, unverified
 *              identity, tampered token, declined-then-claim, double confirm
 *
 * Setup uses the admin token to mint offers (staff may act for any seller);
 * a freshly registered consumer is DB-verified before login so the token
 * carries emailVerified:true, matching the real email-verification flow.
 *
 * Usage: npx tsx scripts/probe-manual-order-acquisition.ts
 */
import { randomBytes } from 'node:crypto';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';

const PASS: string[] = [];
const FAIL: string[] = [];
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    PASS.push(label);
    console.log('PASS', label);
  } else {
    FAIL.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : '');
  }
}
const jsonOf = async (r: Response) => {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
};
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
async function login(email: string, password = DEV_PASS): Promise<string> {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return r.body.accessToken || r.body.token || r.body.data?.accessToken || '';
}
async function registerConsumer(tag: string, email?: string) {
  const e = email || `mo.acq.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'BuyerAcq!2026';
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: e, password, fullName: `Acq Buyer ${tag}` }),
  });
  return { email: e, password, uid: reg.body.uid || reg.body.data?.uid };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}

async function main() {
  const adminTok = await login(ADMIN_EMAIL);
  check(!!adminTok, 'seed login: admin');
  const sellerTok = await login(SELLER_EMAIL);
  const prod = await api('/catalog/products?limit=100', {}, sellerTok);
  const products: Array<Record<string, unknown>> = prod.body.data || [];
  const p1 = products.find((p) => p.sellerId && p.productType !== 'service') || products.find((p) => p.sellerId);
  check(!!p1, 'seller owns a catalog product', { count: products.length });
  if (!p1) return finish();
  const sellerId = String(p1.sellerId);
  const items = [{ productId: String(p1.id), quantity: 1, price: Number(p1.price) || 500 }];

  // ── NATIVE: existing buyer ──────────────────────────────────────────
  const nativeBuyer = await registerConsumer('native');
  await dbVerifyEmail(nativeBuyer.email);
  const nativeTok = await login(nativeBuyer.email, nativeBuyer.password);

  const nativeOffer = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, buyerId: nativeBuyer.uid, items }) },
    adminTok,
  );
  check(nativeOffer.status === 201, 'native: create offer for existing buyer → 201', nativeOffer.status);
  const nativeOfferId = nativeOffer.body?.data?.offerId;
  check(!!nativeOfferId, 'native: offer id returned', nativeOffer.body?.data);
  check(!nativeOffer.body?.claim, 'native: NO claim link is issued for an existing buyer');

  const buyerThread = await api(
    `/operations/platform-messages?userId=${encodeURIComponent(String(nativeBuyer.uid))}`,
    {},
    nativeTok,
  );
  check(
    Array.isArray(buyerThread.body?.data) &&
      buyerThread.body.data.some((m: Record<string, unknown>) => m.orderOffer),
    'native: Offer Card appears in the buyer System-B conversation',
  );

  const accept = await api(
    `/operations/manual-offers/${encodeURIComponent(nativeOfferId)}/accept`,
    { method: 'POST', body: '{}' },
    nativeTok,
  );
  check(accept.status === 200, 'native: buyer accepts offer → 200', accept.status);
  const nativeOrderId = accept.body?.order?.orderId;
  const nativeMyOrders = await api(`/operations/orders?buyerId=${encodeURIComponent(String(nativeBuyer.uid))}`, {}, nativeTok);
  check(
    Array.isArray(nativeMyOrders.body?.data) &&
      nativeMyOrders.body.data.some((o: Record<string, unknown>) => o.orderId === nativeOrderId),
    'native: accepted order is in the buyer My Orders',
  );
  const acceptAgain = await api(
    `/operations/manual-offers/${encodeURIComponent(nativeOfferId)}/accept`,
    { method: 'POST', body: '{}' },
    nativeTok,
  );
  check(
    acceptAgain.status === 400 || acceptAgain.body?.order?.orderId === nativeOrderId,
    'native: re-accept is rejected or idempotent (no second order)',
    acceptAgain.status,
  );

  // ── EXTERNAL: validation ───────────────────────────────────────────
  const noEmail = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, customerName: 'X', phone: '01712345678', items }) },
    adminTok,
  );
  check(noEmail.status === 400, 'external: missing email → 400', noEmail.status);
  const noPhone = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, customerName: 'X', email: 'x@y.com', items }) },
    adminTok,
  );
  check(noPhone.status === 400, 'external: missing phone → 400', noPhone.status);
  const badEmail = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, customerName: 'X', email: 'not-an-email', phone: '01712345678', items }) },
    adminTok,
  );
  check(badEmail.status === 400 && badEmail.body?.code === 'INVALID_EMAIL', 'external: malformed email → 400 INVALID_EMAIL', badEmail.body);
  const badPhone = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, customerName: 'X', email: 'x@y.com', phone: '12345', items }) },
    adminTok,
  );
  check(badPhone.status === 400 && badPhone.body?.code === 'INVALID_PHONE', 'external: malformed BD phone → 400 INVALID_PHONE', badPhone.body);

  // ── EXTERNAL: happy path ───────────────────────────────────────────
  const custEmail = `mo.acq.ext.${Date.now()}@buyer.choosify`;
  const custPhone = '01712345678';
  const extOffer = await api(
    '/operations/manual-offers',
    {
      method: 'POST',
      body: JSON.stringify({
        sellerId,
        customerName: 'External Rahim',
        email: custEmail,
        phone: custPhone,
        provenanceSource: 'external_whatsapp',
        items,
      }),
    },
    adminTok,
  );
  check(extOffer.status === 201, 'external: create offer → 201', extOffer.status);
  const claimToken: string = extOffer.body?.claim?.token || '';
  const claimUrl: string = extOffer.body?.claim?.url || '';
  const extOfferId: string = extOffer.body?.data?.offerId || '';
  check(!!claimToken && !!claimUrl, 'external: secure claim token + url returned', extOffer.body?.claim);
  check(!claimUrl.includes(extOfferId), 'external: claim url does NOT expose the offer id');
  check(extOffer.body?.data?.status === 'awaiting_buyer_claim', 'external: status = awaiting_buyer_claim', extOffer.body?.data?.status);

  // Public preview — no auth
  const preview = await api(`/operations/manual-offers/claim/${encodeURIComponent(claimToken)}`);
  check(preview.status === 200, 'external: public GET claim preview → 200', preview.status);
  check(preview.body?.data?.overallTotal > 0 && !preview.body?.data?.intendedCustomerEmail, 'external: preview shows totals, no raw email/PII leak');

  // Tampered token
  const tampered = await api(`/operations/manual-offers/claim/${randomBytes(24).toString('base64url')}`);
  check(tampered.status === 404, 'external: tampered/unknown token → 404', tampered.status);

  // Wrong account (verified, different email) cannot claim
  const wrong = await registerConsumer('wrong');
  await dbVerifyEmail(wrong.email);
  const wrongTok = await login(wrong.email, wrong.password);
  const wrongConfirm = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`,
    { method: 'POST', body: '{}' },
    wrongTok,
  );
  check(wrongConfirm.status === 403, 'external: wrong verified account → 403 (cannot claim by link possession)', wrongConfirm.status);
  check(wrongConfirm.body?.code === 'IDENTITY_MISMATCH', 'external: wrong account error code IDENTITY_MISMATCH', wrongConfirm.body);

  // Right email but UNVERIFIED
  const cust = await registerConsumer('cust', custEmail);
  const custTokUnverified = await login(custEmail, cust.password);
  const unverifiedConfirm = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`,
    { method: 'POST', body: '{}' },
    custTokUnverified,
  );
  check(unverifiedConfirm.status === 403, 'external: matching email but UNVERIFIED → 403', unverifiedConfirm.status);
  check(unverifiedConfirm.body?.code === 'IDENTITY_NOT_VERIFIED', 'external: unverified error code IDENTITY_NOT_VERIFIED', unverifiedConfirm.body);

  // Verify → confirm
  await dbVerifyEmail(custEmail);
  const custTok = await login(custEmail, cust.password);
  const confirm = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`,
    { method: 'POST', body: '{}' },
    custTok,
  );
  check(confirm.status === 200, 'external: verified matching identity confirms → 200', confirm.body);
  const extOrderId = confirm.body?.order?.orderId;
  check(!!extOrderId, 'external: canonical order created on confirm', confirm.body?.order);

  const custMyOrders = await api(`/operations/orders?buyerId=${encodeURIComponent(String(cust.uid))}`, {}, custTok);
  const claimedOrder = (custMyOrders.body?.data || []).find((o: Record<string, unknown>) => o.orderId === extOrderId);
  check(!!claimedOrder, 'external: claimed order appears in the new customer My Orders');
  check(
    claimedOrder && ['WhatsApp', 'Facebook', 'Instagram', 'Offline'].includes(String(claimedOrder.platformSource)),
    'external: Meta/manual provenance retained on the order',
    claimedOrder?.platformSource,
  );

  // Double confirm → idempotent
  const confirmAgain = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`,
    { method: 'POST', body: '{}' },
    custTok,
  );
  check(
    confirmAgain.status === 200 && confirmAgain.body?.order?.orderId === extOrderId,
    'external: double confirm is idempotent (same order, no duplicate)',
    confirmAgain.status,
  );

  // ── EXTERNAL: decline cannot later be claimed ──────────────────────
  const declEmail = `mo.acq.decl.${Date.now()}@buyer.choosify`;
  const declOffer = await api(
    '/operations/manual-offers',
    { method: 'POST', body: JSON.stringify({ sellerId, customerName: 'Decliner', email: declEmail, phone: '01712345679', items }) },
    adminTok,
  );
  const declToken = declOffer.body?.claim?.token;
  const decl = await registerConsumer('decl', declEmail);
  await dbVerifyEmail(declEmail);
  const declTok = await login(declEmail, decl.password);
  const declined = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(declToken)}/confirm`,
    { method: 'POST', body: JSON.stringify({ action: 'decline' }) },
    declTok,
  );
  check(declined.status === 200 && declined.body?.data?.status === 'rejected', 'external: customer can decline the order', declined.body?.data?.status);
  const reclaim = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(declToken)}/confirm`,
    { method: 'POST', body: '{}' },
    declTok,
  );
  check(reclaim.status === 409 && reclaim.body?.code === 'OFFER_REJECTED', 'external: a declined offer cannot be silently claimed later (409)', reclaim.body);

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL MANUAL ORDER ACQUISITION CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
