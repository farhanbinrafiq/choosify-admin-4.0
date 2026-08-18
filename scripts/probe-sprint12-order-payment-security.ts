/**
 * Sprint 12 pre-beta audit — P0 regression: real, live-verified security defects
 * found during Sprint 12 beta-readiness audit, now fixed:
 *
 *   1. POST /operations/orders (the storefront's ACTUAL live checkout path —
 *      Choosify-Web CheckoutPage.tsx -> operationsApi.createOrder) trusted
 *      client-supplied item price / subtotal / overallTotal verbatim with zero
 *      server-side recomputation. A real ৳145,000 product could be checked out
 *      for ৳1. Fixed: prices are now recomputed server-side from the real
 *      catalog record for buyer-initiated orders (manual/staff orders keep the
 *      deliberate price-override feature, a different trust boundary).
 *   2. GET /operations/shipments and /operations/shipments/:id and
 *      /operations/shipments/track/:orderId had NO authentication at all —
 *      any unauthenticated caller could dump every shipment's
 *      recipientName/recipientPhone/deliveryAddress/codAmount/buyerId across
 *      the whole platform. Fixed: now requires auth + ownership scoping
 *      (staff/order-seller/order-buyer only).
 *   3. deliveryFee within each sub-order was still client-supplied (only
 *      floored at >=0) even after fix #1 — a spoofed deliveryFee:0 could
 *      shave the real flat per-seller parcel fee off the total. Fixed:
 *      recomputed server-side (flat rate for any sub-order containing a
 *      physical product, 0 for pure-service sub-orders), matching the
 *      storefront's own DELIVERY_FEE_PER_SELLER logic.
 *
 * Also covers dedicated malicious-input cases beyond the original exploit:
 * negative price, negative/zero quantity, a huge forged promoDiscount against
 * a nonexistent coupon, and a spoofed free-shipping deliveryFee — none of
 * these may lower the payable total below the real, server-computed value.
 *
 * Usage: npx tsx scripts/probe-sprint12-order-payment-security.ts
 * Or:    npm run test:sprint12-order-payment-security
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

type Json = Record<string, unknown>;

async function register(email: string): Promise<{ token: string; uid: string }> {
  await fetch(`${V1}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'RoleTest!2026', fullName: 'Sprint12 Probe' }),
  });
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'RoleTest!2026' }),
  });
  const body = (await res.json()) as Json;
  if (!res.ok || typeof body.accessToken !== 'string') throw new Error(`login failed: ${res.status}`);
  return { token: body.accessToken as string, uid: String(body.uid || '') };
}

async function login(email: string, password: string): Promise<{ token: string; uid: string }> {
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as Json;
  if (!res.ok || typeof body.accessToken !== 'string') throw new Error(`login failed: ${res.status}`);
  return { token: body.accessToken as string, uid: String(body.uid || '') };
}

async function main() {
  const stamp = Date.now();

  // --- 1. Checkout price-trust exploit is closed ---
  const buyer = await register(`sprint12-order-security-${stamp}@test.choosify.bd`);

  const productsRes = await fetch(`${V1}/catalog/products`);
  const productsBody = (await productsRes.json()) as { data?: Array<{ id: string; title: string; price: number }> };
  const realProduct = (productsBody.data || []).find((p) => p.price > 1000);
  assert(!!realProduct, 'a real, non-trivially-priced catalog product exists for the exploit test', productsBody.data?.length);
  if (!realProduct) throw new Error('cannot continue without a real product fixture');

  const exploitOrderId = `ORD-SPRINT12-PROBE-EXPLOIT-${stamp}`;
  const exploitRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: exploitOrderId,
      overallTotal: 1,
      subtotal: 1,
      deliveryTotal: 0,
      subOrders: [
        {
          sellerId: 'attacker-controlled',
          items: [{ productId: realProduct.id, productTitle: realProduct.title, quantity: 1, price: 1 }],
          deliveryFee: 0,
        },
      ],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const exploitBody = (await exploitRes.json()) as { data?: { overallTotal?: number; subOrders?: Array<{ items?: Array<{ price?: number }> }> } };
  assert(exploitRes.ok, 'order creation with a spoofed price still succeeds (order gets created honestly)', exploitRes.status);
  assert(
    exploitBody.data?.overallTotal === realProduct.price + 120,
    'server ignores the spoofed overallTotal:1 and recomputes the real price + real delivery fee',
    { spoofed: 1, real: realProduct.price + 120, got: exploitBody.data?.overallTotal },
  );
  assert(
    exploitBody.data?.subOrders?.[0]?.items?.[0]?.price === realProduct.price,
    'server ignores the spoofed item price:1 and recomputes the real per-item price',
    exploitBody.data?.subOrders,
  );

  // --- Regression: a numeric (not string) productId must not be discarded as
  // "missing" — a pre-commit live UAT pass found the storefront's own cart
  // sometimes carries a numeric product id, and a too-strict `typeof ===
  // 'string'` check in the P0 fix silently treated it as empty, turning a
  // real checkout attempt into a false "missing productId/serviceId" 400
  // instead of a correct "product not found" 400. Prove the id is genuinely
  // being read (and only rejected because it doesn't match a real product),
  // not being discarded outright. ---
  const numericIdRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-NUMERICID-${stamp}`,
      subOrders: [{ sellerId: 'x', items: [{ productId: 999999, quantity: 1, price: 1 }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const numericIdBody = (await numericIdRes.json()) as { error?: string };
  assert(
    numericIdRes.status === 400 && /999999/.test(numericIdBody.error || '') && !/missing productId/i.test(numericIdBody.error || ''),
    'a numeric (non-string) productId is read correctly, not silently discarded as "missing"',
    numericIdBody,
  );

  // --- Honest checkout still works correctly (no regression) ---
  const honestOrderId = `ORD-SPRINT12-PROBE-HONEST-${stamp}`;
  const honestRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: honestOrderId,
      overallTotal: realProduct.price + 120,
      subtotal: realProduct.price,
      deliveryTotal: 120,
      subOrders: [
        {
          sellerId: 'attacker-controlled',
          items: [{ productId: realProduct.id, productTitle: realProduct.title, quantity: 1, price: realProduct.price }],
          deliveryFee: 120,
        },
      ],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const honestBody = (await honestRes.json()) as { data?: { overallTotal?: number } };
  assert(honestRes.ok && honestBody.data?.overallTotal === realProduct.price + 120, 'honest checkout with real prices still computes the correct total (no regression)', honestBody);

  // --- Negative price is discarded (server recomputes from catalog regardless) ---
  const negPriceRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-NEGPRICE-${stamp}`,
      overallTotal: -500,
      subOrders: [{ sellerId: 'x', items: [{ productId: realProduct.id, quantity: 1, price: -500 }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const negPriceBody = (await negPriceRes.json()) as { data?: { overallTotal?: number } };
  assert(
    negPriceRes.ok && negPriceBody.data?.overallTotal === realProduct.price + 120,
    'negative spoofed price is discarded; server still charges the real price + real delivery',
    negPriceBody,
  );

  // --- Negative/zero quantity is clamped to a minimum of 1, cannot zero the order ---
  const negQtyRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-NEGQTY-${stamp}`,
      subOrders: [{ sellerId: 'x', items: [{ productId: realProduct.id, quantity: -5, price: 1 }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const negQtyBody = (await negQtyRes.json()) as { data?: { overallTotal?: number; subOrders?: Array<{ items?: Array<{ quantity?: number }> }> } };
  assert(
    negQtyRes.ok && negQtyBody.data?.subOrders?.[0]?.items?.[0]?.quantity === 1 && negQtyBody.data?.overallTotal === realProduct.price + 120,
    'negative quantity is clamped to 1, cannot be used to zero/negate the order total',
    negQtyBody,
  );

  // --- Huge forged promoDiscount cannot wipe out the order (clamped to <=90% of real subtotal) ---
  const hugeDiscountRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-HUGEDISCOUNT-${stamp}`,
      promoCode: 'DOES-NOT-EXIST-PROBE',
      promoDiscount: 99999999,
      subOrders: [{ sellerId: 'x', items: [{ productId: realProduct.id, quantity: 1, price: 1 }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const hugeDiscountBody = (await hugeDiscountRes.json()) as { data?: { overallTotal?: number; promoDiscount?: number } };
  assert(
    hugeDiscountRes.ok && hugeDiscountBody.data?.promoDiscount === 0 && hugeDiscountBody.data?.overallTotal === realProduct.price + 120,
    'a forged promoDiscount against a nonexistent coupon code is ignored entirely (0 discount applied)',
    hugeDiscountBody,
  );

  // --- Tampered deliveryFee is discarded; server charges the real flat per-seller rate ---
  const freeShippingRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-FREESHIP-${stamp}`,
      subOrders: [{ sellerId: 'x', items: [{ productId: realProduct.id, quantity: 1, price: realProduct.price }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  const freeShippingBody = (await freeShippingRes.json()) as {
    data?: { deliveryTotal?: number; overallTotal?: number; subOrders?: Array<{ deliveryFee?: number }> };
  };
  assert(
    freeShippingRes.ok &&
      freeShippingBody.data?.subOrders?.[0]?.deliveryFee === 120 &&
      freeShippingBody.data?.deliveryTotal === 120 &&
      freeShippingBody.data?.overallTotal === realProduct.price + 120,
    'a spoofed deliveryFee:0 on a product sub-order is discarded; server charges the real flat delivery fee',
    freeShippingBody,
  );

  // --- Nonexistent product is rejected cleanly, not silently accepted ---
  const badRes = await fetch(`${V1}/operations/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-BADPRODUCT-${stamp}`,
      overallTotal: 1,
      subOrders: [{ sellerId: 'x', items: [{ productId: 'prod-does-not-exist-probe', quantity: 1, price: 1 }], deliveryFee: 0 }],
      shipping: { fullName: 'Probe', phone: '01700000000', address: 'Dhaka', region: 'Dhaka' },
    }),
  });
  assert(badRes.status === 400, 'a nonexistent productId is rejected with a clean 400, not silently accepted', badRes.status);

  // --- 2. Shipment endpoints require auth + ownership scoping ---
  const unauthList = await fetch(`${V1}/operations/shipments`);
  assert(unauthList.status === 401, 'unauthenticated GET /operations/shipments -> 401', unauthList.status);

  const unauthTrack = await fetch(`${V1}/operations/shipments/track/${encodeURIComponent(honestOrderId)}`);
  assert(unauthTrack.status === 401, 'unauthenticated GET /operations/shipments/track/:orderId -> 401', unauthTrack.status);

  const otherBuyer = await register(`sprint12-order-security-other-${stamp}@test.choosify.bd`);
  const crossTrack = await fetch(`${V1}/operations/shipments/track/${encodeURIComponent(honestOrderId)}`, {
    headers: { Authorization: `Bearer ${otherBuyer.token}` },
  });
  assert(crossTrack.status === 403, 'a different authenticated buyer cannot view this order\'s shipment -> 403', crossTrack.status);

  const ownTrack = await fetch(`${V1}/operations/shipments/track/${encodeURIComponent(honestOrderId)}`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(ownTrack.ok, 'the order\'s own buyer CAN view their own shipment tracking', ownTrack.status);

  const admin = await login('admin@choosify.com.bd', DEV_PASS);
  const adminList = await fetch(`${V1}/operations/shipments`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert(adminList.ok, 'staff (admin) can list all shipments', adminList.status);

  console.log('\n=== SPRINT 12 ORDER/PAYMENT SECURITY SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
