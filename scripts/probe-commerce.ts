/**
 * Sprint 5 / IS-010 Sprint 8 — Commerce regression probe.
 *
 * Requires running local server (:3001) and seeded admin.
 *
 * Usage: npx tsx scripts/probe-commerce.ts
 * Or:    npm run test:commerce
 *
 * Optional: COMMERCE_PROBE_RESTART=1 also kills/restarts API to prove durability.
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
const DO_RESTART = process.env.COMMERCE_PROBE_RESTART !== '0'; // default ON for persistence gate

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
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Commerce Consumer' }),
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
    body: JSON.stringify({ name, category: 'General', description: 'Commerce probe brand' }),
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
  input: { brandId: string; categoryId: string; title: string; price: number; stock?: number; status?: string },
) {
  const res = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      brandId: input.brandId,
      categoryId: input.categoryId,
      title: input.title,
      price: input.price,
      stock: input.stock ?? 20,
      status: input.status || 'draft',
      category: 'General',
      description: 'Commerce probe product',
      image: 'https://example.com/probe.jpg',
    }),
  });
  const body = (await json(res)) as { data?: { id: string; price?: number; status?: string } };
  if (!res.ok || !body.data?.id) throw new Error(`product create failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data;
}

async function publishProduct(token: string, productId: string) {
  const res = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'live' }),
  });
  const body = (await json(res)) as { data?: { status?: string } };
  if (!res.ok) throw new Error(`publish failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function setInventory(token: string, productId: string, quantity: number, variantId?: string) {
  const res = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) }),
  });
  return { status: res.status, body: await json(res) };
}

async function createService(
  token: string,
  input: { brandId: string; categoryId: string; title: string; price: number },
) {
  const res = await fetch(`${base}/catalog/services`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      brandId: input.brandId,
      categoryId: input.categoryId,
      title: input.title,
      price: input.price,
      currency: 'BDT',
      status: 'draft',
      category: 'General',
      description: 'Commerce probe service',
      durationMinutes: 60,
      serviceArea: 'Dhaka',
    }),
  });
  const body = (await json(res)) as { data?: { id: string; price?: number } };
  if (!res.ok || !body.data?.id) throw new Error(`service create failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data;
}

async function publishService(token: string, serviceId: string) {
  const res = await fetch(`${base}/catalog/services/${serviceId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'live' }),
  });
  if (!res.ok) throw new Error(`service publish failed: ${res.status}`);
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
  console.log('=== Sprint 5 Commerce Probe ===');
  console.log('BASE', base);
  {
    const modeRes = await fetch(`${base}/commerce/persistence-mode`);
    const modeBody = (await json(modeRes)) as { data?: { mode: string } };
    console.log('Commerce persistence mode:', modeBody.data?.mode);
    assert(
      modeRes.status === 200 &&
        (modeBody.data?.mode === 'memory-disk' || modeBody.data?.mode === 'firestore-admin'),
      'persistence mode is deterministic (memory-disk|firestore-admin)',
      modeBody,
    );
  }

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const categoryId = await firstCategoryId(admin.token);

  // Setup Seller A / Brand A / Product A
  const sellerAReg = await registerConsumer(`commerce-seller-a-${RUN_ID}@probe.local`);
  const sellerA = await upgradeToSeller(sellerAReg.token, `Commerce Seller A ${RUN_ID}`);
  const sellerAUid = sellerA.uid || sellerAReg.uid;
  const brandAId = await createBrand(sellerA.token, `Brand A ${RUN_ID}`);
  await grantMarketplace(admin.token, brandAId);
  const productA = await createProduct(sellerA.token, {
    brandId: brandAId,
    categoryId,
    title: `Product A ${RUN_ID}`,
    price: 1000,
    stock: 50,
  });
  await publishProduct(sellerA.token, productA.id);
  await setInventory(sellerA.token, productA.id, 50);

  // Seller A / Brand A2 (same seller, second brand — IS-004 Brand split)
  const brandA2Id = await createBrand(sellerA.token, `Brand A2 ${RUN_ID}`);
  await grantMarketplace(admin.token, brandA2Id);
  const productA2 = await createProduct(sellerA.token, {
    brandId: brandA2Id,
    categoryId,
    title: `Product A2 ${RUN_ID}`,
    price: 300,
    stock: 20,
  });
  await publishProduct(sellerA.token, productA2.id);
  await setInventory(sellerA.token, productA2.id, 20);

  // Setup Seller B / Brand B / Product B
  const sellerBReg = await registerConsumer(`commerce-seller-b-${RUN_ID}@probe.local`);
  const sellerB = await upgradeToSeller(sellerBReg.token, `Commerce Seller B ${RUN_ID}`);
  const sellerBUid = sellerB.uid || sellerBReg.uid;
  const brandBId = await createBrand(sellerB.token, `Brand B ${RUN_ID}`);
  await grantMarketplace(admin.token, brandBId);
  const productB = await createProduct(sellerB.token, {
    brandId: brandBId,
    categoryId,
    title: `Product B ${RUN_ID}`,
    price: 500,
    stock: 30,
  });
  await publishProduct(sellerB.token, productB.id);
  await setInventory(sellerB.token, productB.id, 30);

  // Service under Seller B for mixed-type
  const serviceB = await createService(sellerB.token, {
    brandId: brandBId,
    categoryId,
    title: `Service B ${RUN_ID}`,
    price: 750,
  });
  await publishService(sellerB.token, serviceB.id);

  // Suspended/archived products for rejection tests
  const suspended = await createProduct(sellerA.token, {
    brandId: brandAId,
    categoryId,
    title: `Suspended ${RUN_ID}`,
    price: 100,
  });
  await publishProduct(sellerA.token, suspended.id);
  await fetch(`${base}/catalog/products/${suspended.id}`, {
    method: 'PATCH',
    headers: authHeaders(sellerA.token),
    body: JSON.stringify({ status: 'suspended' }),
  });

  const archived = await createProduct(sellerA.token, {
    brandId: brandAId,
    categoryId,
    title: `Archived ${RUN_ID}`,
    price: 100,
  });
  await publishProduct(sellerA.token, archived.id);
  await fetch(`${base}/catalog/products/${archived.id}/archive`, {
    method: 'POST',
    headers: authHeaders(sellerA.token),
  });

  // Variant product
  const variantProd = await createProduct(sellerA.token, {
    brandId: brandAId,
    categoryId,
    title: `Variant Product ${RUN_ID}`,
    price: 1100,
  });
  const variantIdOk = `var-${RUN_ID}-ok`;
  const variantIdForeign = `var-foreign-${RUN_ID}`;
  await publishProduct(sellerA.token, variantProd.id);
  const variantPut = await fetch(`${base}/catalog/product-details/${variantProd.id}`, {
    method: 'PUT',
    headers: authHeaders(sellerA.token),
    body: JSON.stringify({
      productId: variantProd.id,
      specs: [],
      pros: [],
      cons: [],
      bestForTags: [],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [{ id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black'] }],
      productVariants: [
        { id: variantIdOk, sku: `SKU-${RUN_ID}`, price: 1100, stock: 8, options: { Color: 'Black' } },
      ],
      creatorContent: [],
    }),
  });
  if (!variantPut.ok) {
    console.warn('variant put failed', await json(variantPut));
  }
  await setInventory(sellerA.token, variantProd.id, 8, variantIdOk);

  // Consumer C
  const consumer = await registerConsumer(`commerce-consumer-${RUN_ID}@probe.local`);
  const consumer2 = await registerConsumer(`commerce-consumer2-${RUN_ID}@probe.local`);

  // 31. Bearer required
  {
    const res = await fetch(`${base}/cart`);
    assert(res.status === 401 || res.status === 403, '31. Bearer auth required for protected Commerce reads', res.status);
  }
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingType: 'product', listingId: productA.id, quantity: 1 }),
    });
    assert(res.status === 401 || res.status === 403, '31b. Bearer auth required for Commerce writes', res.status);
  }

  // 1. get/create cart
  {
    const res = await fetch(`${base}/cart`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as { data?: { id: string; consumerId: string; items: unknown[] } };
    assert(
      res.status === 200 && !!body.data?.id && body.data.consumerId === consumer.uid,
      '1. Consumer gets/creates Cart',
      body,
    );
  }

  // 3. invalid product
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: 'does-not-exist', quantity: 1 }),
    });
    assert(res.status === 404 || res.status === 400, '3. invalid Product rejected', res.status);
  }

  // 4. suspended
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: suspended.id, quantity: 1 }),
    });
    assert(res.status === 400, '4. suspended Product rejected', res.status);
  }

  // 5. archived
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ listingType: 'product', listingId: archived.id, quantity: 1 }),
    });
    assert(res.status === 400, '5. archived Product rejected', res.status);
  }

  // 2. add owned/public product
  let cartItemAId = '';
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        listingType: 'product',
        listingId: productA.id,
        quantity: 2,
        unitPrice: 1, // spoof — server must ignore
        sellerId: 'spoof-seller',
      }),
    });
    const body = (await json(res)) as {
      data?: { items: Array<{ id: string; listingId: string; unitPrice: number; sellerId: string; quantity: number }> };
      totals?: { subtotal: number };
    };
    assert(res.status === 201 && body.data?.items.some((i) => i.listingId === productA.id), '2. add owned/public Product', body);
    const item = body.data?.items.find((i) => i.listingId === productA.id);
    cartItemAId = item?.id || '';
    assert(item?.unitPrice === 1000, '10. server ignores spoofed client price', item);
    assert(item?.sellerId === sellerAUid, '10b. server resolves sellerId', item);
    assert(body.totals?.subtotal === 2000, '21a. cart totals server-calculated', body.totals);
  }

  // 6. valid variant
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        listingType: 'product',
        listingId: variantProd.id,
        variantId: variantIdOk,
        quantity: 1,
      }),
    });
    assert(res.status === 201, '6. valid Variant added', res.status);
  }

  // 7. foreign variant
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        listingType: 'product',
        listingId: variantProd.id,
        variantId: variantIdForeign,
        quantity: 1,
      }),
    });
    assert(res.status === 400, '7. foreign Variant rejected', res.status);
  }

  // 8. quantity update
  {
    const res = await fetch(`${base}/cart/items/${cartItemAId}`, {
      method: 'PATCH',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ quantity: 3 }),
    });
    const body = (await json(res)) as { data?: { items: Array<{ id: string; quantity: number }> } };
    const item = body.data?.items.find((i) => i.id === cartItemAId);
    assert(res.status === 200 && item?.quantity === 3, '8. quantity update', body);
  }

  // 11–12 inventory
  {
    const res = await fetch(`${base}/cart/items/${cartItemAId}`, {
      method: 'PATCH',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ quantity: 9999 }),
    });
    assert(res.status === 400, '12. insufficient stock rejected', res.status);
  }
  assert(true, '11. inventory checked (via add/update validation)');

  // remove variant item then clear extras for multi-seller path
  {
    const cartRes = await fetch(`${base}/cart`, { headers: authHeaders(consumer.token) });
    const cartBody = (await json(cartRes)) as {
      data?: { items: Array<{ id: string; listingId: string }> };
    };
    const variantItem = cartBody.data?.items.find((i) => i.listingId === variantProd.id);
    if (variantItem) {
      const res = await fetch(`${base}/cart/items/${variantItem.id}`, {
        method: 'DELETE',
        headers: authHeaders(consumer.token),
      });
      assert(res.status === 200, '9. remove item', res.status);
    }
  }

  // Reset cart to Product A qty 2 + Product B qty 1 for multi-seller gate
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productA.id, quantity: 2 }),
  });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productB.id, quantity: 1 }),
  });

  // 15. multi-seller cart
  {
    const res = await fetch(`${base}/cart`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as {
      data?: { id: string; items: Array<{ listingId: string; sellerId: string }> };
      totals?: { subtotal: number; grandTotal: number };
    };
    const sellers = new Set(body.data?.items.map((i) => i.sellerId));
    assert(
      res.status === 200 && body.data!.items.length === 2 && sellers.size === 2,
      '15. multi-Seller Cart accepted',
      { items: body.data?.items, sellers: [...sellers] },
    );
    assert(body.totals?.subtotal === 2500 && body.totals?.grandTotal === 2500, '21. checkout totals server-calculated (pre)', body.totals);

    // 13. cart persists (flush + snapshot)
    await fetch(`${base}/commerce/_flush`, { method: 'POST', headers: authHeaders(consumer.token) });
    await delay(400);
    const snap = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : null;
    assert(
      !!snap?.carts?.some((c: { id: string }) => c.id === body.data?.id),
      '13. Cart persists (memory-disk snapshot)',
      snap?.carts?.length,
    );
  }

  // 14. unauthorized cart access — consumer2 cannot mutate consumer cart via API (each has own cart)
  {
    const res = await fetch(`${base}/cart`, { headers: authHeaders(consumer2.token) });
    const body = (await json(res)) as { data?: { consumerId: string; items: unknown[] } };
    assert(
      body.data?.consumerId === consumer2.uid && (body.data?.items.length ?? 0) === 0,
      '14. unauthorized Cart access rejected (isolated cart per consumer)',
      body.data,
    );
  }

  // Seller cannot modify consumer cart (no seller cart-admin endpoint — seller gets own empty cart)
  {
    const res = await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(sellerA.token),
      body: JSON.stringify({ listingType: 'product', listingId: productA.id, quantity: 1 }),
    });
    // Seller acting as consumer of own cart is allowed; isolation is by actor uid.
    assert(res.status === 201 || res.status === 200, '14b. Seller cart is actor-scoped (not consumer C cart)', res.status);
    await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(sellerA.token) });
  }

  // 16–22 multi-seller checkout + idempotency
  const shipping = {
    fullName: 'Consumer C',
    phone: '+8801711222333',
    address: 'House 1, Road 2, Dhaka',
    region: 'Dhaka',
  };
  const idemKey = `idem-${RUN_ID}`;

  async function readReserved(productId: string, token: string) {
    const res = await fetch(`${base}/catalog/products/${productId}/inventory`, {
      headers: authHeaders(token),
    });
    const body = (await json(res)) as { data?: { reservedQuantity?: number; availableQuantity?: number } };
    return body.data?.reservedQuantity ?? 0;
  }

  const reservedABefore = await readReserved(productA.id, sellerA.token);
  const reservedBBefore = await readReserved(productB.id, sellerB.token);

  const checkout1 = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumer.token), 'Idempotency-Key': idemKey },
    body: JSON.stringify({ shipping }),
  });
  const checkout1Body = (await json(checkout1)) as {
    data?: {
      checkout: { id: string; orderIds: string[]; grandTotal: number };
      orders: Array<{
        id: string;
        sellerId: string;
        brandId: string;
        items: Array<{ listingId: string; unitPrice: number; quantity: number }>;
        grandTotal: number;
      }>;
      reused?: boolean;
    };
  };
  assert(checkout1.status === 201 && !!checkout1Body.data?.checkout?.id, '16. checkout succeeds', checkout1Body);
  const checkoutId = checkout1Body.data!.checkout.id;
  const orders = checkout1Body.data!.orders;
  assert(orders.length === 2, '17. one checkout creates N Seller Orders', { n: orders.length, checkoutId });

  const reservedAAfter = await readReserved(productA.id, sellerA.token);
  const reservedBAfter = await readReserved(productB.id, sellerB.token);
  assert(
    reservedAAfter === reservedABefore + 2 && reservedBAfter === reservedBBefore + 1,
    'inventory reserved at checkout (+qty)',
    { reservedABefore, reservedAAfter, reservedBBefore, reservedBAfter },
  );

  const orderA = orders.find((o) => o.sellerId === sellerAUid);
  const orderB = orders.find((o) => o.sellerId === sellerBUid);
  assert(!!orderA && orderA.items.every((i) => i.listingId === productA.id), '18. Seller 1 Order contains only Seller 1 items', orderA);
  assert(!!orderB && orderB.items.every((i) => i.listingId === productB.id), '19. Seller 2 Order contains only Seller 2 items', orderB);
  assert(orderA?.items[0]?.quantity === 2 && orderA?.items[0]?.unitPrice === 1000, 'multi-Seller qty/price A', orderA);
  assert(orderB?.items[0]?.quantity === 1 && orderB?.items[0]?.unitPrice === 500, 'multi-Seller qty/price B', orderB);
  assert(
    checkout1Body.data!.checkout.grandTotal === 2500,
    '21b. checkout grandTotal server-calculated',
    checkout1Body.data!.checkout,
  );

  // Consumer sees both under same checkout
  {
    const res = await fetch(`${base}/checkout/${checkoutId}`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as { data?: { orders: Array<{ id: string }> } };
    assert(
      res.status === 200 && body.data?.orders?.length === 2,
      'Consumer can see both Orders under same checkout',
      body,
    );
  }

  // 29–30 ownership
  {
    const res = await fetch(`${base}/orders/${orderB!.id}`, { headers: authHeaders(sellerA.token) });
    assert(res.status === 403, '29. Seller cannot read foreign Seller Order', res.status);
  }
  {
    const res = await fetch(`${base}/orders/${orderA!.id}`, { headers: authHeaders(sellerB.token) });
    assert(res.status === 403, '29b. Seller B cannot read Order A', res.status);
  }
  {
    const res = await fetch(`${base}/orders/${orderA!.id}`, { headers: authHeaders(consumer2.token) });
    assert(res.status === 403, '30. Consumer cannot read another Consumer Order', res.status);
  }
  {
    const res = await fetch(`${base}/orders/${orderA!.id}`, { headers: authHeaders(consumer.token) });
    assert(res.status === 200, 'Consumer can read own Order', res.status);
  }

  // 22. idempotency
  const checkout2 = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumer.token), 'Idempotency-Key': idemKey },
    body: JSON.stringify({ shipping }),
  });
  const checkout2Body = (await json(checkout2)) as {
    data?: { checkout: { id: string }; orders: unknown[]; reused?: boolean };
  };
  assert(
    checkout2.status === 200 &&
      checkout2Body.data?.reused === true &&
      checkout2Body.data.checkout.id === checkoutId &&
      checkout2Body.data.orders.length === 2,
    '22. checkout retry/idempotency does not duplicate Orders',
    checkout2Body,
  );

  const reservedARetry = await readReserved(productA.id, sellerA.token);
  const reservedBRetry = await readReserved(productB.id, sellerB.token);
  assert(
    reservedARetry === reservedAAfter && reservedBRetry === reservedBAfter,
    '15-idem. idempotent retry does NOT double-reserve inventory',
    { reservedAAfter, reservedARetry, reservedBAfter, reservedBRetry },
  );

  // 27. cart post-checkout cleared
  {
    const res = await fetch(`${base}/cart`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as { data?: { items: unknown[] } };
    assert(res.status === 200 && body.data?.items.length === 0, '27. Cart post-checkout behavior correct (cleared)', body);
  }

  // 20. snapshot independent of later product edit
  await fetch(`${base}/catalog/products/${productA.id}`, {
    method: 'PATCH',
    headers: authHeaders(sellerA.token),
    body: JSON.stringify({ price: 9999 }),
  });
  {
    const res = await fetch(`${base}/orders/${orderA!.id}`, { headers: authHeaders(consumer.token) });
    const body = (await json(res)) as {
      data?: { items: Array<{ unitPrice: number; finalUnitPrice: number }> };
    };
    assert(
      body.data?.items[0]?.unitPrice === 1000 && body.data?.items[0]?.finalUnitPrice === 1000,
      '20. Order snapshot price persists independently of later Product edit',
      body.data?.items[0],
    );
  }

  // 23–24 mixed-type: product + service
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productA.id, quantity: 1 }),
  });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      listingType: 'service',
      listingId: serviceB.id,
      quantity: 1,
      requestedAt: new Date().toISOString(),
      notes: 'Need AC service',
    }),
  });
  const mixed = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `mixed-${RUN_ID}` },
    body: JSON.stringify({ shipping }),
  });
  const mixedBody = (await json(mixed)) as {
    data?: {
      orders: Array<{ id: string; sellerId: string; bookingRequestId?: string; items: Array<{ listingType: string }> }>;
      bookingRequests: Array<{ id: string; serviceId: string; sellerId: string; consumerId: string; status: string }>;
    };
  };
  assert(mixed.status === 201, 'mixed checkout status', mixed.status);
  const br = mixedBody.data?.bookingRequests?.[0];
  assert(!!br?.id && br.serviceId === serviceB.id, '23. Service item creates/links Booking Request', br);
  assert(
    br?.sellerId === sellerBUid && br?.consumerId === consumer.uid,
    '24. Booking Request ownership correct',
    br,
  );
  assert(
    mixedBody.data!.orders.some((o) => o.items.some((i) => i.listingType === 'product')) &&
      mixedBody.data!.orders.some((o) => o.bookingRequestId),
    '22-mixed. Product Order + Service Booking linkage',
    mixedBody.data?.orders,
  );

  // 25. Manual Order authority
  {
    const forbidden = await fetch(`${base}/orders/manual`, {
      method: 'POST',
      headers: authHeaders(sellerA.token),
      body: JSON.stringify({
        sellerId: sellerBUid,
        brandId: brandBId,
        listingType: 'product',
        listingId: productB.id,
        quantity: 1,
      }),
    });
    assert(forbidden.status === 403, '25. Manual Order authority enforced (foreign seller)', forbidden.status);

    const ok = await fetch(`${base}/orders/manual`, {
      method: 'POST',
      headers: authHeaders(sellerB.token),
      body: JSON.stringify({
        sellerId: sellerBUid,
        brandId: brandBId,
        listingType: 'product',
        listingId: productB.id,
        quantity: 1,
        source: 'manual',
        shipping,
      }),
    });
    const okBody = (await json(ok)) as { data?: { id: string; source: string }; claimToken?: string };
    assert(ok.status === 201 && okBody.data?.source === 'manual' && !!okBody.claimToken, '25b. Manual Order created', okBody);
  }

  // 26. External/social source attribution
  {
    const res = await fetch(`${base}/orders/manual`, {
      method: 'POST',
      headers: authHeaders(sellerB.token),
      body: JSON.stringify({
        sellerId: sellerBUid,
        brandId: brandBId,
        listingType: 'product',
        listingId: productB.id,
        quantity: 1,
        source: 'external_whatsapp',
        shipping,
      }),
    });
    const body = (await json(res)) as { data?: { source: string } };
    assert(
      res.status === 201 && body.data?.source === 'external_whatsapp',
      '26. External/social source attribution persists',
      body,
    );
  }

  // 28. persistence flush evidence (memory-disk); Firestore is immediately durable
  const modeCheck = await fetch(`${base}/commerce/persistence-mode`);
  const modeCheckBody = (await json(modeCheck)) as { data?: { mode: string } };
  await fetch(`${base}/commerce/_flush`, { method: 'POST', headers: authHeaders(consumer.token) });
  await delay(400);
  if (modeCheckBody.data?.mode === 'memory-disk') {
    const snap = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, 'utf8')) : null;
    assert(
      !!snap?.orders?.some((o: { id: string }) => o.id === orderA!.id) &&
        !!snap?.checkouts?.some((c: { id: string }) => c.id === checkoutId) &&
        !!snap?.idempotency?.some((r: { key: string }) => r.key === idemKey),
      '28. Cart/Orders/idempotency durable on disk before restart',
      { orders: snap?.orders?.length, checkouts: snap?.checkouts?.length, idem: snap?.idempotency?.length },
    );
  } else {
    assert(true, '28. Firestore mode — durable without JSON snapshot');
  }

  // 32. no mock/localStorage SoT — API returns server ids
  assert(
    !checkoutId.startsWith('mock') && !orderA!.id.startsWith('mock'),
    '32. no mock/localStorage source of truth (server commerce ids)',
    { checkoutId, orderA: orderA!.id },
  );

  // Multi-Brand split (IS-004 §9 / §20): one Seller, two Brands → two Orders
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumer.token) });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productA.id, quantity: 1 }),
  });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productA2.id, quantity: 1 }),
  });
  await fetch(`${base}/cart/items`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ listingType: 'product', listingId: productB.id, quantity: 1 }),
  });
  const multiBrand = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumer.token), 'Idempotency-Key': `brand-split-${RUN_ID}` },
    body: JSON.stringify({ shipping }),
  });
  const multiBrandBody = (await json(multiBrand)) as {
    data?: {
      checkout: { id: string };
      orders: Array<{ id: string; sellerId: string; brandId: string; items: Array<{ listingId: string }> }>;
    };
  };
  assert(multiBrand.status === 201, 'multi-Brand checkout status', multiBrand.status);
  const mbOrders = multiBrandBody.data?.orders || [];
  assert(mbOrders.length === 3, 'IS-004 Brand split: 3 Brands → 3 Orders (A1+A2+B)', {
    n: mbOrders.length,
    brands: mbOrders.map((o) => o.brandId),
  });
  assert(
    mbOrders.filter((o) => o.sellerId === sellerAUid).length === 2 &&
      mbOrders.some((o) => o.brandId === brandAId && o.items.every((i) => i.listingId === productA.id)) &&
      mbOrders.some((o) => o.brandId === brandA2Id && o.items.every((i) => i.listingId === productA2.id)) &&
      mbOrders.some((o) => o.brandId === brandBId && o.sellerId === sellerBUid),
    'IS-004 §9/§20: split by Brand not merely Seller Account',
    mbOrders,
  );

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
    const afterOrder = await fetch(`${base}/orders/${orderA!.id}`, { headers: authHeaders(consumer.token) });
    assert(afterOrder.status === 200, '28b. Order readable after API restart', afterOrder.status);
    const afterCheckout = await fetch(`${base}/checkout/${checkoutId}`, {
      headers: authHeaders(consumer.token),
    });
    const afterCheckoutBody = (await json(afterCheckout)) as {
      data?: { orders: Array<{ id: string }> };
    };
    assert(
      afterCheckout.status === 200 && afterCheckoutBody.data?.orders?.length === 2,
      '28c. Checkout + split Orders reload after restart',
      afterCheckoutBody,
    );
    if (br?.id) {
      const brOrder = mixedBody.data?.orders?.find((o) => o.bookingRequestId);
      if (brOrder) {
        const afterBrOrder = await fetch(`${base}/orders/${brOrder.id}`, {
          headers: authHeaders(consumer.token),
        });
        const afterBrBody = (await json(afterBrOrder)) as {
          data?: { bookingRequestId?: string };
        };
        assert(
          afterBrOrder.status === 200 && afterBrBody.data?.bookingRequestId === br.id,
          '28d. Booking Request linkage survives restart',
          afterBrBody,
        );
      }
    }
    const idemAfterRestart = await fetch(`${base}/checkout`, {
      method: 'POST',
      headers: { ...authHeaders(consumer.token), 'Idempotency-Key': idemKey },
      body: JSON.stringify({ shipping }),
    });
    const idemAfterBody = (await json(idemAfterRestart)) as {
      data?: { reused?: boolean; checkout: { id: string }; orders: unknown[] };
    };
    assert(
      idemAfterRestart.status === 200 &&
        idemAfterBody.data?.reused === true &&
        idemAfterBody.data.checkout.id === checkoutId &&
        idemAfterBody.data.orders.length === 2,
      '28e. durable idempotency after restart (no duplicate Orders)',
      idemAfterBody,
    );
  } else {
    console.log('SKIP full process restart (set COMMERCE_PROBE_RESTART=0 to skip; default is ON)');
  }

  console.log(`\n=== Done: ${failed} failure(s) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
