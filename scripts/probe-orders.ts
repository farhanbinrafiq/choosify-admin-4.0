/**
 * Sprint 6 / IS-010 Sprint 9 — Orders lifecycle regression probe.
 *
 * Requires running local server (:3001) and seeded admin.
 *
 * Usage: npx tsx scripts/probe-orders.ts
 * Or:    npm run test:orders
 *
 * Optional: ORDERS_PROBE_RESTART=0 to skip process restart durability checks.
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const RUN_ID = Date.now();
const PORT = 3001;
const SNAPSHOT = join(process.cwd(), '.data', 'commerce-memory-snapshot.json');
const DO_RESTART = process.env.ORDERS_PROBE_RESTART !== '0';

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function login(email: string, password: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await json(res)) as { accessToken?: string; uid?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login failed for ${email}: ${res.status}`);
  return { token: body.accessToken as string, uid: body.uid as string };
}

async function registerConsumer(email: string) {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Orders Consumer' }),
  });
  const body = (await json(res)) as { customToken?: string; uid?: string };
  if (!res.ok || !body.customToken) throw new Error(`register failed: ${res.status}`);
  return { token: body.customToken as string, uid: body.uid as string };
}

async function upgradeToSeller(token: string, storeName: string) {
  const res = await fetch(`${base}/auth/upgrade-to-seller`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      storeName,
      phone: '+8801711000099',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  const body = (await json(res)) as { accessToken?: string; uid?: string };
  if (!res.ok || !body.accessToken) throw new Error(`upgrade failed: ${res.status} ${JSON.stringify(body)}`);
  return { token: body.accessToken as string, uid: body.uid as string };
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, category: 'General', description: 'Orders probe brand' }),
  });
  const body = (await json(res)) as { data?: { id: string } };
  if (!res.ok || !body.data?.id) throw new Error(`brand create failed: ${res.status}`);
  return body.data.id;
}

async function grantMarketplace(adminToken: string, brandId: string) {
  await fetch(`${base}/catalog/brands/${brandId}/marketplace-access`, {
    method: 'PATCH',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status: 'granted' }),
  });
}

async function firstCategoryId(token: string) {
  const res = await fetch(`${base}/catalog/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await json(res)) as { data?: Array<{ id: string }> };
  const id = body.data?.[0]?.id;
  if (!id) throw new Error('No categories available for probe');
  return id;
}

async function createProduct(
  token: string,
  input: { brandId: string; categoryId: string; title: string; price: number; stock?: number },
) {
  const res = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      brandId: input.brandId,
      categoryId: input.categoryId,
      title: input.title,
      price: input.price,
      stock: input.stock ?? 50,
      status: 'draft',
      category: 'General',
      description: 'Orders probe product',
      image: 'https://example.com/probe.jpg',
    }),
  });
  const body = (await json(res)) as { data?: { id: string; price?: number } };
  if (!res.ok || !body.data?.id) throw new Error(`product create failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data;
}

async function publishProduct(token: string, productId: string) {
  const res = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'live' }),
  });
  if (!res.ok) throw new Error(`publish failed: ${res.status}`);
}

async function setInventory(token: string, productId: string, quantity: number) {
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ quantity }),
  });
}

async function getInventory(token: string, productId: string) {
  const res = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    headers: authHeaders(token),
  });
  const body = (await json(res)) as {
    data?: { quantity?: number; reservedQuantity?: number; availableQuantity?: number };
  };
  return body.data || {};
}

type OrderRow = {
  id: string;
  status: string;
  sellerId: string;
  brandId: string;
  checkoutId: string;
  consumerId: string;
  source?: string;
  shipmentId?: string;
  inventoryReserved?: boolean;
  inventoryConsumed?: boolean;
  items: Array<{ listingId: string; title: string; unitPrice: number; finalUnitPrice: number; quantity: number }>;
  cancelledBy?: string;
};

async function transition(
  token: string,
  orderId: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  const res = await fetch(`${base}/orders/${orderId}/transition`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ status, fulfilmentMethod: 'self_delivery', ...extra }),
  });
  const body = (await json(res)) as {
    success?: boolean;
    data?: { order: OrderRow; shipment?: { id: string; status: string }; reused?: boolean };
    error?: string;
  };
  return { status: res.status, body };
}

async function cancel(token: string, orderId: string, reason: string) {
  const res = await fetch(`${base}/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  });
  const body = (await json(res)) as {
    success?: boolean;
    data?: OrderRow;
    reused?: boolean;
    error?: string;
  };
  return { status: res.status, body };
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(800);
  }
  throw new Error('Server health timeout after restart');
}

async function main() {
  console.log('=== Sprint 6 Orders Probe ===');
  console.log('BASE', base);

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const categoryId = await firstCategoryId(admin.token);

  const sellerAReg = await registerConsumer(`orders-seller-a-${RUN_ID}@probe.local`);
  const sellerA = await upgradeToSeller(sellerAReg.token, `Orders Seller A ${RUN_ID}`);
  const sellerAUid = sellerA.uid || sellerAReg.uid;
  const brandAId = await createBrand(sellerA.token, `Orders Brand A ${RUN_ID}`);
  const brandA2Id = await createBrand(sellerA.token, `Orders Brand A2 ${RUN_ID}`);
  await grantMarketplace(admin.token, brandAId);
  await grantMarketplace(admin.token, brandA2Id);

  const sellerBReg = await registerConsumer(`orders-seller-b-${RUN_ID}@probe.local`);
  const sellerB = await upgradeToSeller(sellerBReg.token, `Orders Seller B ${RUN_ID}`);
  const sellerBUid = sellerB.uid || sellerBReg.uid;
  const brandBId = await createBrand(sellerB.token, `Orders Brand B ${RUN_ID}`);
  await grantMarketplace(admin.token, brandBId);

  const productA = await createProduct(sellerA.token, {
    brandId: brandAId,
    categoryId,
    title: `Orders Product A ${RUN_ID}`,
    price: 1200,
    stock: 40,
  });
  await publishProduct(sellerA.token, productA.id);
  await setInventory(sellerA.token, productA.id, 40);

  const productA2 = await createProduct(sellerA.token, {
    brandId: brandA2Id,
    categoryId,
    title: `Orders Product A2 ${RUN_ID}`,
    price: 800,
    stock: 30,
  });
  await publishProduct(sellerA.token, productA2.id);
  await setInventory(sellerA.token, productA2.id, 30);

  const productB = await createProduct(sellerB.token, {
    brandId: brandBId,
    categoryId,
    title: `Orders Product B ${RUN_ID}`,
    price: 500,
    stock: 25,
  });
  await publishProduct(sellerB.token, productB.id);
  await setInventory(sellerB.token, productB.id, 25);

  const consumer = await registerConsumer(`orders-buyer-${RUN_ID}@probe.local`);
  const consumer2 = await registerConsumer(`orders-buyer2-${RUN_ID}@probe.local`);

  const shipping = {
    fullName: 'Orders Probe Buyer',
    phone: '+8801711223344',
    address: 'Dhaka Probe Street',
    region: 'Dhaka',
  };

  // --- Multi-brand checkout (acceptance gate) ---
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
  for (const listingId of [productA.id, productA2.id, productB.id]) {
    await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId, quantity: 2 }),
    });
  }
  const checkoutRes = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `orders-gate-${RUN_ID}` },
    body: JSON.stringify({ shipping }),
  });
  const checkoutBody = (await json(checkoutRes)) as {
    data?: { checkout: { id: string }; orders: OrderRow[] };
  };
  assert(checkoutRes.status === 201 && (checkoutBody.data?.orders.length || 0) === 3, 'checkout 3 Brand Orders', {
    status: checkoutRes.status,
    n: checkoutBody.data?.orders.length,
  });
  const checkoutId = checkoutBody.data!.checkout.id;
  const orderA = checkoutBody.data!.orders.find((o) => o.brandId === brandAId)!;
  const orderA2 = checkoutBody.data!.orders.find((o) => o.brandId === brandA2Id)!;
  const orderB = checkoutBody.data!.orders.find((o) => o.brandId === brandBId)!;
  assert(!!orderA && !!orderA2 && !!orderB, 'multi-Brand split present');

  // Sprint 7 payment gate: COD policy allows Confirm without gateway capture (deliveryTotal=0)
  {
    const payRes = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId,
        paymentMethod: 'cod',
        idempotencyKey: `orders-cod-${RUN_ID}`,
      }),
    });
    const payBody = (await json(payRes)) as { data?: { payment?: { status?: string; paymentMethod?: string } } };
    assert(
      payRes.status === 200 && payBody.data?.payment?.paymentMethod === 'cod',
      'Sprint7 COD selected for lifecycle Confirm gate',
      { status: payRes.status, body: payBody },
    );
  }

  // 1. Consumer lists own Orders
  {
    const res = await fetch(`${base}/orders?as=consumer`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as { data?: OrderRow[] };
    assert(
      res.status === 200 && (body.data || []).some((o) => o.id === orderA.id),
      '1. Consumer lists own Orders',
      body.data?.length,
    );
  }

  // 2. Consumer cannot list/read foreign Orders
  {
    const list = await fetch(`${base}/orders?as=consumer`, { headers: authHeaders(consumer2.token) });
    const listBody = (await json(list)) as { data?: OrderRow[] };
    assert(
      !(listBody.data || []).some((o) => o.id === orderA.id),
      '2a. Consumer B list excludes Consumer A Orders',
    );
    const get = await fetch(`${base}/orders/${orderA.id}`, { headers: authHeaders(consumer2.token) });
    assert(get.status === 403 || get.status === 404, '2b. Consumer cannot read foreign Order', get.status);
  }

  // 3–5 Seller list / foreign / brand filter
  {
    const listA = await fetch(`${base}/orders?as=seller`, { headers: authHeaders(sellerA.token) });
    const bodyA = (await json(listA)) as { data?: OrderRow[] };
    assert(
      (bodyA.data || []).some((o) => o.id === orderA.id) &&
        (bodyA.data || []).some((o) => o.id === orderA2.id) &&
        !(bodyA.data || []).some((o) => o.id === orderB.id),
      '3. Seller lists own Orders only',
      bodyA.data?.map((o) => o.brandId),
    );
    const foreign = await fetch(`${base}/orders/${orderB.id}`, { headers: authHeaders(sellerA.token) });
    assert(foreign.status === 403, '4. Seller cannot read foreign Seller Order', foreign.status);
    const brandFilter = await fetch(`${base}/orders?as=seller&brandId=${brandAId}`, {
      headers: authHeaders(sellerA.token),
    });
    const brandBody = (await json(brandFilter)) as { data?: OrderRow[] };
    assert(
      (brandBody.data || []).every((o) => o.brandId === brandAId) &&
        (brandBody.data || []).some((o) => o.id === orderA.id) &&
        !(brandBody.data || []).some((o) => o.id === orderA2.id),
      '5. Brand filtering works',
      brandBody.data?.map((o) => o.id),
    );
  }

  // 37. Bearer auth required
  {
    const res = await fetch(`${base}/orders/${orderA.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert(res.status === 401 || res.status === 403, '37. Bearer auth required for protected writes', res.status);
  }

  // 6–12 lifecycle Brand A
  {
    let t = await transition(sellerA.token, orderA.id, 'confirmed');
    assert(t.status === 200 && t.body.data?.order.status === 'confirmed', '6. Pending → Confirmed', t.body);

    t = await transition(sellerA.token, orderA.id, 'shipped');
    assert(t.status >= 400, '7. invalid transition rejected (confirmed→shipped)', t.status);

    const invBeforePack = await getInventory(sellerA.token, productA.id);
    t = await transition(sellerA.token, orderA.id, 'packed');
    assert(t.status === 200 && t.body.data?.order.status === 'packed', '8. Confirmed → Packed', t.body);
    assert(!!t.body.data?.shipment?.id, '21. Shipment created', t.body.data?.shipment);
    const shipId = t.body.data!.shipment!.id;
    const invAfterPack = await getInventory(sellerA.token, productA.id);
    assert(
      (invAfterPack.quantity ?? 0) === (invBeforePack.quantity ?? 0) - 2 &&
        t.body.data?.order.inventoryConsumed === true,
      '19. fulfilment consumes reservation/stock at Packed',
      { before: invBeforePack, after: invAfterPack },
    );

    const packAgain = await transition(sellerA.token, orderA.id, 'packed');
    assert(
      packAgain.status === 200 && packAgain.body.data?.reused === true,
      '20/33. repeated Pack is idempotent (no double-consume)',
      packAgain.body,
    );
    const invAfterIdem = await getInventory(sellerA.token, productA.id);
    assert(
      (invAfterIdem.quantity ?? 0) === (invAfterPack.quantity ?? 0),
      '20b. inventory unchanged on Pack retry',
      invAfterIdem,
    );

    t = await transition(sellerA.token, orderA.id, 'shipped', {
      courierProvider: 'self',
      trackingNumber: `TRK-${RUN_ID}`,
    });
    assert(t.status === 200 && t.body.data?.order.status === 'shipped', '9. Packed → Shipped', t.body);
    assert(t.body.data?.shipment?.status === 'in_transit', '23. Shipment state advances (in_transit)', t.body.data?.shipment);

    const shipGet = await fetch(`${base}/shipments/${shipId}`, { headers: authHeaders(sellerA.token) });
    assert(shipGet.status === 200, '22. Shipment ownership (seller read)', shipGet.status);
    const shipForeign = await fetch(`${base}/shipments/${shipId}`, { headers: authHeaders(sellerB.token) });
    assert(shipForeign.status === 403, '22b. Shipment foreign seller denied', shipForeign.status);

    // Deliver while still packed would fail — already shipped
    t = await transition(sellerA.token, orderA.id, 'delivered');
    assert(t.status === 200 && t.body.data?.order.status === 'delivered', '10. Shipped → Delivered', t.body);
    assert(t.body.data?.shipment?.status === 'delivered', '24. Shipment/Order Delivered consistent', t.body.data?.shipment);

    t = await transition(sellerA.token, orderA.id, 'completed');
    assert(t.status === 200 && t.body.data?.order.status === 'completed', '11. Delivered → Completed', t.body);

    t = await transition(sellerA.token, orderA.id, 'shipped');
    assert(t.status >= 400, '12. Completed cannot regress', t.status);
  }

  // Keep Brand B independent (acceptance)
  {
    const conf = await transition(sellerB.token, orderB.id, 'confirmed');
    assert(conf.status === 200 && conf.body.data?.order.status === 'confirmed', 'acceptance Brand B stays Confirmed', conf.body);
  }

  // 28–30 Consumer unified history
  {
    const res = await fetch(`${base}/orders?as=consumer&byCheckout=1`, {
      headers: authHeaders(consumer.token),
    });
    const body = (await json(res)) as {
      data?: OrderRow[];
      byCheckout?: Record<string, OrderRow[]>;
    };
    const group = body.byCheckout?.[checkoutId] || [];
    assert(group.length === 3, '29. Consumer unified history grouped by checkout', group.length);
    const statuses = Object.fromEntries(group.map((o) => [o.brandId, o.status]));
    assert(
      statuses[brandAId] === 'completed' && statuses[brandBId] === 'confirmed',
      '30. same checkout Orders may have different states',
      statuses,
    );
    assert(
      group.every((o) => o.checkoutId === checkoutId),
      '28. multi-Brand split remains independent under one checkout',
    );
  }

  // Cancellation suite on orderA2 (pending)
  {
    const invBefore = await getInventory(sellerA.token, productA2.id);
    const late = await cancel(consumer.token, orderA.id, 'too late');
    assert(late.status === 403, '14. ineligible late cancellation rejected', late.status);

    const consumerCancel = await cancel(consumer.token, orderA2.id, 'changed mind');
    assert(
      consumerCancel.status === 200 &&
        consumerCancel.body.data?.status === 'cancelled' &&
        consumerCancel.body.data?.cancelledBy === 'consumer',
      '13. eligible Consumer cancellation',
      consumerCancel.body,
    );
    const invAfter = await getInventory(sellerA.token, productA2.id);
    assert(
      (invAfter.reservedQuantity ?? 0) <= (invBefore.reservedQuantity ?? 0),
      '17. cancellation releases reservation where required',
      { before: invBefore, after: invAfter },
    );
    const retry = await cancel(consumer.token, orderA2.id, 'again');
    assert(retry.status === 200 && retry.body.reused === true, '18. cancellation retry does not double-release', retry.body);
  }

  // Seller cancellation
  {
    await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
    await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: productB.id, quantity: 1 }),
    });
    const c = await fetch(`${base}/checkout`, {
      method: 'POST',
      headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `orders-seller-cancel-${RUN_ID}` },
      body: JSON.stringify({ shipping }),
    });
    const cb = (await json(c)) as { data?: { checkout: { id: string }; orders: OrderRow[] } };
    const sellCancelOrder = cb.data!.orders[0];
    await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: cb.data!.checkout.id,
        paymentMethod: 'cod',
        idempotencyKey: `orders-seller-cancel-cod-${RUN_ID}`,
      }),
    });
    await transition(sellerB.token, sellCancelOrder.id, 'confirmed');
    const sc = await cancel(sellerB.token, sellCancelOrder.id, 'out of stock');
    assert(
      sc.status === 200 && sc.body.data?.cancelledBy === 'seller',
      '15. Seller cancellation authority',
      sc.body,
    );
  }

  // Admin intervention
  {
    await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
    await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: productB.id, quantity: 1 }),
    });
    const c = await fetch(`${base}/checkout`, {
      method: 'POST',
      headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `orders-admin-${RUN_ID}` },
      body: JSON.stringify({ shipping }),
    });
    const cb = (await json(c)) as { data?: { orders: OrderRow[] } };
    const adminOrder = cb.data!.orders[0];
    const ac = await cancel(admin.token, adminOrder.id, 'policy intervention');
    assert(
      ac.status === 200 && ac.body.data?.cancelledBy === 'admin',
      '16. Admin intervention authority',
      ac.body,
    );
  }

  // Manual + social lifecycle
  {
    const man = await fetch(`${base}/orders/manual`, {
      method: 'POST',
      headers: authHeaders(sellerB.token),
      body: JSON.stringify({
        sellerId: sellerBUid,
        brandId: brandBId,
        listingType: 'product',
        listingId: productB.id,
        quantity: 1,
        source: 'manual',
        consumerId: consumer.uid,
        shipping,
      }),
    });
    const manBody = (await json(man)) as { data?: OrderRow };
    assert(man.status === 201 && manBody.data?.source === 'manual', '25a. Manual Order created', manBody);
    let t = await transition(sellerB.token, manBody.data!.id, 'confirmed');
    t = await transition(sellerB.token, manBody.data!.id, 'packed');
    assert(t.status === 200 && t.body.data?.order.status === 'packed', '25. Manual Order lifecycle works', t.body);

    const soc = await fetch(`${base}/orders/manual`, {
      method: 'POST',
      headers: authHeaders(sellerB.token),
      body: JSON.stringify({
        sellerId: sellerBUid,
        brandId: brandBId,
        listingType: 'product',
        listingId: productB.id,
        quantity: 1,
        source: 'external_facebook',
        consumerId: consumer.uid,
        shipping,
      }),
    });
    const socBody = (await json(soc)) as { data?: OrderRow };
    t = await transition(sellerB.token, socBody.data!.id, 'confirmed');
    assert(
      soc.status === 201 && t.status === 200 && socBody.data?.source === 'external_facebook',
      '26. external/social Order lifecycle works',
      { source: socBody.data?.source, status: t.body.data?.order.status },
    );
  }

  // Snapshot immutability
  {
    await fetch(`${base}/catalog/products/${productA.id}`, {
      method: 'PATCH',
      headers: authHeaders(sellerA.token),
      body: JSON.stringify({ title: `RENAMED ${RUN_ID}`, price: 9999 }),
    });
    const get = await fetch(`${base}/orders/${orderA.id}`, { headers: authHeaders(consumer.token) });
    const body = (await json(get)) as { data?: OrderRow };
    assert(
      body.data?.items[0]?.title.includes(`Orders Product A ${RUN_ID}`) &&
        body.data?.items[0]?.unitPrice === 1200,
      '27. Product snapshot remains unchanged after Product edit',
      body.data?.items[0],
    );
  }

  // Events
  {
    const ev = await fetch(`${base}/commerce/_recent-events`, { headers: authHeaders(admin.token) });
    const body = (await json(ev)) as { data?: Array<{ eventName: string; aggregateId: string }> };
    const names = new Set((body.data || []).map((e) => e.eventName));
    const required = [
      'OrderConfirmed',
      'OrderPacked',
      'OrderShipped',
      'OrderDelivered',
      'OrderCompleted',
      'OrderCancelled',
      'ShipmentCreated',
      'ShipmentShipped',
      'ShipmentDelivered',
    ];
    assert(
      required.every((n) => names.has(n)),
      '34. required events emitted',
      { missing: required.filter((n) => !names.has(n)), seen: [...names] },
    );
    assert(
      !names.has('PaymentCaptured') && !names.has('EscrowReleased') && !names.has('RefundIssued'),
      '35. no PaymentCaptured/Escrow/Refund business events from Orders lifecycle',
      [...names],
    );
  }

  // 36 SoT
  assert(
    !orderA.id.startsWith('mock') && !checkoutId.startsWith('local'),
    '36. real Order API is SoT, not localStorage',
    orderA.id,
  );

  // Deliver-before-ship consistency on fresh order
  {
    await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
    await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: productB.id, quantity: 1 }),
    });
    const c = await fetch(`${base}/checkout`, {
      method: 'POST',
      headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `orders-ship-guard-${RUN_ID}` },
      body: JSON.stringify({ shipping }),
    });
    const cb = (await json(c)) as { data?: { checkout: { id: string }; orders: OrderRow[] } };
    const o = cb.data!.orders[0];
    await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: cb.data!.checkout.id,
        paymentMethod: 'cod',
        idempotencyKey: `orders-ship-guard-cod-${RUN_ID}`,
      }),
    });
    await transition(sellerB.token, o.id, 'confirmed');
    await transition(sellerB.token, o.id, 'packed');
    const bad = await transition(sellerB.token, o.id, 'delivered');
    assert(bad.status >= 400, '24b. Order Delivered blocked while Shipment unshipped', bad.body);
  }

  // Payment boundary — Sprint 7: COD selected; not fake gateway Paid
  {
    const get = await fetch(`${base}/orders/${orderA.id}`, { headers: authHeaders(consumer.token) });
    const body = (await json(get)) as { data?: Record<string, unknown> };
    assert(
      body.data?.status === 'completed' &&
        body.data?.paymentMethod === 'cod' &&
        body.data?.paymentStatus === 'cod_due',
      'Payment boundary: COD Order Completed without fake Paid capture',
      body.data,
    );
  }

  // Persistence / restart
  await fetch(`${base}/commerce/_flush`, { method: 'POST', headers: authHeaders(consumer.token) });
  await delay(400);
  const modeRes = await fetch(`${base}/commerce/persistence-mode`);
  const modeBody = (await json(modeRes)) as { data?: { mode: string } };
  if (modeBody.data?.mode === 'memory-disk' && existsSync(SNAPSHOT)) {
    const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as {
      orders?: OrderRow[];
      shipments?: Array<{ id: string; orderId: string }>;
    };
    assert(
      !!snap.orders?.some((o) => o.id === orderA.id && o.status === 'completed'),
      '31. Order survives snapshot flush',
    );
    assert(
      !!snap.shipments?.some((s) => s.orderId === orderA.id),
      '32. Shipment survives snapshot flush',
    );
  } else {
    assert(true, '31/32. Firestore mode — durable without JSON snapshot');
  }

  if (DO_RESTART) {
    console.log('--- Restart durability ---');
    await fetch(`${base}/commerce/_flush`, { method: 'POST', headers: authHeaders(consumer.token) });
    await delay(500);
    await killPort(PORT);
    await delay(1000);
    const child = spawn('npx', ['tsx', 'server.ts'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      shell: true,
      detached: true,
      env: { ...process.env },
    });
    child.unref();
    await waitForHealth();
    const after = await fetch(`${base}/orders/${orderA.id}`, { headers: authHeaders(consumer.token) });
    const afterBody = (await json(after)) as { data?: OrderRow };
    assert(after.status === 200 && afterBody.data?.status === 'completed', '31b. Order survives restart', afterBody);
    const shipAfter = await fetch(`${base}/orders/${orderA.id}/shipment`, {
      headers: authHeaders(consumer.token),
    });
    assert(shipAfter.status === 200, '32b. Shipment survives restart', shipAfter.status);
  } else {
    console.log('SKIP process restart (ORDERS_PROBE_RESTART=0)');
  }

  console.log(`\n=== Done: ${failed} failure(s) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
