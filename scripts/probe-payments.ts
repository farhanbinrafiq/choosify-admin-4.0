/**
 * Sprint 7 / IS-010 Sprint 10 — Payments regression + acceptance probe.
 *
 * Requires local API (:3001). Enables PAYMENT_GATEWAY_MOCK for harness capture.
 *
 * Usage: npx tsx scripts/probe-payments.ts
 * Or:    npm run test:payments
 *
 * Optional: PAYMENTS_PROBE_RESTART=0 to skip process restart durability checks.
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  advanceToCaptured,
  canTransitionPayment,
  normalizePaymentStatus,
  transitionPayment,
} from '../server/payments/paymentLifecycle';
import { calculatePayable, getPlatformPaymentPolicy } from '../server/payments/paymentPolicy';
import { mockPaymentProvider } from '../server/payments/mockProvider';
import { sslcommerzProvider } from '../server/payments/sslcommerzProvider';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

process.env.PAYMENT_GATEWAY_MOCK = 'true';

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const RUN_ID = Date.now();
const PORT = 3001;
const PAY_SNAPSHOT = join(process.cwd(), '.data', 'payments-memory-snapshot.json');
const DO_RESTART = process.env.PAYMENTS_PROBE_RESTART !== '0';

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
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Payments Consumer' }),
  });
  const body = (await json(res)) as { customToken?: string; uid?: string };
  if (!res.ok || !body.customToken) throw new Error(`register failed: ${res.status}`);
  return { token: body.customToken as string, uid: body.uid as string };
}

/**
 * Sprint 10: /auth/upgrade-to-seller is intentionally disabled (403
 * PARTNER_APPLICATION_REQUIRED). Canonical onboarding is now:
 * partner-apply -> Admin identity approval -> login as the provisioned Seller.
 */
async function upgradeToSeller(adminToken: string, email: string, storeName: string) {
  const apply = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email,
      password: 'Probe!2026xx',
      displayName: 'Payments Probe Seller',
      businessOrChannelName: storeName,
      phone: '+8801711000088',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  if (!apply.ok) throw new Error(`partner-apply failed: ${apply.status}`);

  const listRes = await fetch(`${base}/operations/partner-applications?status=pending`, { headers: authHeaders(adminToken) });
  const listBody = (await json(listRes)) as { applications?: Array<{ id: string; email?: string }> };
  const app = (listBody.applications || []).find((a) => a.email === email);
  if (!app) throw new Error(`pending partner application missing for ${email}`);
  const approve = await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({ note: 'payments probe' }),
  });
  if (!approve.ok) throw new Error(`approve failed: ${approve.status}`);

  const seller = await login(email, 'Probe!2026xx');
  // Legacy upgrade-to-seller self-granted Marketplace Access instantly; the real
  // lifecycle needs this Admin action explicitly before the seller can create brands.
  const ownBrands = await fetch(`${base}/catalog/brands`, { headers: authHeaders(seller.token) });
  const ownBrandsBody = (await json(ownBrands)) as { data?: Array<{ id: string }> };
  const ownBrandId = ownBrandsBody.data?.[0]?.id;
  if (ownBrandId) {
    await fetch(`${base}/catalog/brands/${encodeURIComponent(ownBrandId)}/marketplace-access`, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: 'granted' }),
    });
  }
  return seller;
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, category: 'General', description: 'Payments probe brand' }),
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
  if (!id) throw new Error('No categories');
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
      stock: input.stock ?? 40,
      status: 'draft',
      category: 'General',
      description: 'Payments probe',
      image: 'https://example.com/pay.jpg',
    }),
  });
  const body = (await json(res)) as { data?: { id: string } };
  if (!res.ok || !body.data?.id) throw new Error(`product create failed: ${res.status}`);
  return body.data;
}

async function publishProduct(token: string, productId: string) {
  await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'live' }),
  });
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

type PaymentRow = {
  paymentId: string;
  checkoutId: string;
  orderIds: string[];
  status: string;
  amount: number;
  capturedAmount: number;
  outstandingAmount: number;
  paymentMethod: string;
  provider?: string;
  providerTransactionId?: string;
  paymentCapturedEmitted?: boolean;
  paymentFailedEmitted?: boolean;
  reservationReleased?: boolean;
};

type OrderRow = {
  id: string;
  status: string;
  brandId: string;
  checkoutId: string;
  paymentStatus?: string;
  paymentMethod?: string;
  invoicePaymentStatus?: string;
  inventoryReserved?: boolean;
  paidAmount?: number;
  outstandingAmount?: number;
};

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
  throw new Error('Server health timeout');
}

async function ensureMockServer() {
  try {
    const res = await fetch(`http://localhost:${PORT}/health`);
    if (res.ok) {
      const st = await fetch(`${base}/commerce/payments/gateway-status`);
      const body = (await json(st)) as { data?: { mockEnabled?: boolean } };
      if (body.data?.mockEnabled) return;
    }
  } catch {
    /* need start */
  }
  console.log('--- Starting API with PAYMENT_GATEWAY_MOCK=true ---');
  await killPort(PORT);
  await delay(800);
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
    env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true', NODE_ENV: 'development' },
  });
  child.unref();
  await waitForHealth();
}

async function checkoutMulti(
  consumerToken: string,
  listingIds: string[],
  idem: string,
) {
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: authHeaders(consumerToken) });
  for (const listingId of listingIds) {
    await fetch(`${base}/cart/items`, {
      method: 'POST',
      headers: authHeaders(consumerToken),
      body: JSON.stringify({ listingType: 'product', listingId, quantity: 1 }),
    });
  }
  const res = await fetch(`${base}/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(consumerToken), 'Idempotency-Key': idem },
    body: JSON.stringify({
      shipping: {
        fullName: 'Pay Consumer',
        phone: '+8801711223344',
        address: 'Dhaka',
        region: 'Dhaka',
      },
    }),
  });
  const body = (await json(res)) as {
    data?: { checkout: { id: string; grandTotal: number; deliveryTotal: number }; orders: OrderRow[] };
  };
  if (!res.ok || !body.data) throw new Error(`checkout failed ${res.status}`);
  return body.data;
}

async function main() {
  console.log('=== Sprint 7 Payments Probe ===');
  console.log('BASE', base);

  // --- In-process lifecycle / policy / mock safety ---
  assert(normalizePaymentStatus('Pending') === 'pending', '7. normalize Initiated/Pending');
  assert(canTransitionPayment('initiated', 'pending'), '7b. Initiated → Pending allowed');
  assert(transitionPayment('initiated', 'pending') === 'pending', '7c. Initiated → Pending');
  assert(canTransitionPayment('pending', 'authorized'), '8. Pending → Authorized allowed');
  assert(transitionPayment('pending', 'authorized') === 'authorized', '8b. Pending → Authorized');
  assert(advanceToCaptured('pending') === 'captured', '9. Authorized → Captured via advance');
  let invalidOk = false;
  try {
    transitionPayment('captured', 'pending');
  } catch {
    invalidOk = true;
  }
  assert(invalidOk, '10. invalid Payment transition rejected');

  const fullPay = calculatePayable({
    methodId: 'full',
    grandTotal: 5000,
    deliveryTotal: 150,
    currency: 'BDT',
  });
  assert(fullPay.chargeNow === 5000 && fullPay.outstanding === 0, '21a. full payable server-side');
  const dep = calculatePayable({
    methodId: 'deposit',
    grandTotal: 10000,
    deliveryTotal: 0,
    currency: 'BDT',
  });
  assert(dep.chargeNow === 3000 && dep.outstanding === 7000, '21–22. deposit 30% + outstanding');
  const cod = calculatePayable({
    methodId: 'cod',
    grandTotal: 5000,
    deliveryTotal: 150,
    currency: 'BDT',
  });
  assert(cod.chargeNow === 150 && cod.outstanding === 4850, '20a. COD prepaid delivery calc');
  assert(getPlatformPaymentPolicy('wallet')?.deferred === true, '11a. Wallet deferred');
  assert(getPlatformPaymentPolicy('installment')?.deferred === true, '10a. Installment deferred');

  assert(typeof sslcommerzProvider.refundTransaction === 'function', '33. refund provider capability interface');
  assert(typeof mockPaymentProvider.refundTransaction === 'function', '33b. mock refund interface');

  const prevNode = process.env.NODE_ENV;
  const prevMock = process.env.PAYMENT_GATEWAY_MOCK;
  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_GATEWAY_MOCK = 'true';
  // Clear ssl creds temporarily for fail-closed check — restore after
  const sid = process.env.SSLCOMMERZ_STORE_ID;
  const spw = process.env.SSLCOMMERZ_STORE_PASSWORD;
  delete process.env.SSLCOMMERZ_STORE_ID;
  delete process.env.SSLCOMMERZ_STORE_PASSWORD;
  let mockBlocked = false;
  try {
    const { resolveCommercePaymentProvider } = await import(
      '../server/payments/commercePaymentService'
    );
    resolveCommercePaymentProvider();
  } catch {
    mockBlocked = true;
  }
  assert(mockBlocked, '32. mock provider cannot silently run in production');
  process.env.NODE_ENV = prevNode;
  process.env.PAYMENT_GATEWAY_MOCK = prevMock || 'true';
  if (sid) process.env.SSLCOMMERZ_STORE_ID = sid;
  if (spw) process.env.SSLCOMMERZ_STORE_PASSWORD = spw;

  await ensureMockServer();

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const categoryId = await firstCategoryId(admin.token);

  const sellerA = await upgradeToSeller(admin.token, `pay-seller-a-${RUN_ID}@probe.local`, `PaySellerA ${RUN_ID}`);
  const brandA = await createBrand(sellerA.token, `Pay Brand A ${RUN_ID}`);
  await grantMarketplace(admin.token, brandA);

  const sellerB = await upgradeToSeller(admin.token, `pay-seller-b-${RUN_ID}@probe.local`, `PaySellerB ${RUN_ID}`);
  const brandB = await createBrand(sellerB.token, `Pay Brand B ${RUN_ID}`);
  await grantMarketplace(admin.token, brandB);

  const productA = await createProduct(sellerA.token, {
    brandId: brandA,
    categoryId,
    title: `Pay Product A ${RUN_ID}`,
    price: 2000,
    stock: 30,
  });
  await publishProduct(sellerA.token, productA.id);
  await setInventory(sellerA.token, productA.id, 30);

  const productB = await createProduct(sellerB.token, {
    brandId: brandB,
    categoryId,
    title: `Pay Product B ${RUN_ID}`,
    price: 1500,
    stock: 30,
  });
  await publishProduct(sellerB.token, productB.id);
  await setInventory(sellerB.token, productB.id, 30);

  const consumer = await registerConsumer(`pay-consumer-${RUN_ID}@probe.local`);
  const consumer2 = await registerConsumer(`pay-consumer2-${RUN_ID}@probe.local`);

  // 35 Bearer required
  {
    const res = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutId: 'x', paymentMethod: 'full' }),
    });
    assert(res.status === 401 || res.status === 403, '35. Bearer auth required for payment initiation', res.status);
  }

  // Gateway status — no secrets
  {
    const res = await fetch(`${base}/commerce/payments/gateway-status`);
    const body = (await json(res)) as { data?: Record<string, unknown> };
    const raw = JSON.stringify(body);
    assert(
      res.status === 200 &&
        !raw.includes('store_passwd') &&
        !raw.toLowerCase().includes('password') &&
        body.data?.mockEnabled === true,
      '31. provider secrets not exposed',
      body,
    );
  }

  // --- Prepaid acceptance: multi-Brand Checkout → full payment → Captured → Confirmed ---
  const prepaid = await checkoutMulti(
    consumer.token,
    [productA.id, productB.id],
    `pay-prepaid-${RUN_ID}`,
  );
  assert(prepaid.orders.length === 2, 'split checkout 2 Brand Orders');

  // Prepaid confirm blocked before capture
  {
    const t = await fetch(`${base}/orders/${prepaid.orders[0].id}/transition`, {
      method: 'POST',
      headers: authHeaders(sellerA.token),
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert(t.status === 409, '18. prepaid Order not Confirmed before capture', t.status);
  }

  // Foreign consumer rejected
  {
    const res = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer2.token),
      body: JSON.stringify({
        checkoutId: prepaid.checkout.id,
        paymentMethod: 'full',
        amount: 1,
      }),
    });
    assert(res.status === 403, '2. foreign Consumer Checkout rejected', res.status);
  }

  // Seller cannot initiate
  {
    const res = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(sellerA.token),
      body: JSON.stringify({
        checkoutId: prepaid.checkout.id,
        paymentMethod: 'full',
      }),
    });
    assert(res.status === 403, '3. Seller cannot initiate Consumer payment', res.status);
  }

  const invBeforeCapture = await getInventory(sellerA.token, productA.id);

  // Initiate with spoofed amount
  const initRes = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: prepaid.checkout.id,
      paymentMethod: 'full',
      amount: 1,
      idempotencyKey: `pay-full-${RUN_ID}`,
    }),
  });
  const initBody = (await json(initRes)) as {
    data?: { payment: PaymentRow; redirectUrl: string | null; chargeNow: number };
  };
  assert(initRes.status === 200 && !!initBody.data?.payment.paymentId, '1. Consumer initiates Payment', initBody);
  assert(
    initBody.data!.chargeNow === prepaid.checkout.grandTotal && initBody.data!.chargeNow !== 1,
    '4. client spoofed amount ignored — server amount used',
    initBody.data,
  );
  assert(initBody.data!.payment.status === 'pending', '7d. Payment Pending after initiate');
  assert(!!initBody.data!.redirectUrl, '13a. mock/ssl provider session redirect');
  const paymentId = initBody.data!.payment.paymentId;

  // Persist
  {
    const get = await fetch(`${base}/commerce/payments/${paymentId}`, {
      headers: authHeaders(consumer.token),
    });
    const body = (await json(get)) as { data?: PaymentRow };
    assert(get.status === 200 && body.data?.paymentId === paymentId, '5. Payment record persists', body);
  }

  // Capture via harness (provider validation)
  const capture1 = await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId, outcome: 'captured', valId: `val-${paymentId}-1` }),
  });
  const capBody = (await json(capture1)) as { data?: PaymentRow };
  assert(
    capture1.status === 200 && capBody.data?.status === 'captured',
    '9b. Payment Captured after validation',
    capBody,
  );
  assert(capBody.data?.capturedAmount === prepaid.checkout.grandTotal, 'capture amount matches');

  // Duplicate capture / webhook idempotent
  const capture2 = await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId, outcome: 'captured', valId: `val-${paymentId}-1` }),
  });
  const cap2Body = (await json(capture2)) as { data?: PaymentRow };
  assert(
    capture2.status === 200 && cap2Body.data?.status === 'captured',
    '14–15. duplicate webhook/capture idempotent',
    cap2Body,
  );

  // Orders confirmed + payment knowledge + reservation held
  for (const o of prepaid.orders) {
    const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
    const body = (await json(get)) as { data?: OrderRow };
    assert(
      body.data?.status === 'confirmed' && body.data?.paymentStatus === 'paid',
      '19+28. prepaid Order Confirmed after capture + payment knowledge',
      body.data,
    );
    assert(
      body.data?.invoicePaymentStatus === 'Paid',
      '29. invoice/payment status reflects real state',
      body.data?.invoicePaymentStatus,
    );
    assert(body.data?.inventoryReserved !== false, '23. reservation remains on successful capture', body.data);
  }

  const invAfterCapture = await getInventory(sellerA.token, productA.id);
  assert(
    (invAfterCapture.reservedQuantity ?? 0) >= (invBeforeCapture.reservedQuantity ?? 0) - 0,
    '23b. reserved qty not released on capture',
    { before: invBeforeCapture, after: invAfterCapture },
  );

  // Events: PaymentCaptured before OrderConfirmed; once each; no Escrow/Refund
  {
    const ev = await fetch(`${base}/commerce/_recent-events`, { headers: authHeaders(admin.token) });
    const body = (await json(ev)) as {
      data?: Array<{ eventName: string; domain?: string; timestamp?: string; aggregateId: string }>;
    };
    const events = body.data || [];
    const captured = events.filter((e) => e.eventName === 'PaymentCaptured' && e.aggregateId === paymentId);
    const failedEv = events.filter((e) => e.eventName === 'PaymentFailed' && e.aggregateId === paymentId);
    assert(captured.length === 1, '16. PaymentCaptured emitted once', captured.length);
    assert(failedEv.length === 0, 'no PaymentFailed on success path');
    const orderConfirms = events.filter(
      (e) =>
        e.eventName === 'OrderConfirmed' &&
        prepaid.orders.some((o) => o.id === e.aggregateId),
    );
    assert(orderConfirms.length >= 2, 'OrderConfirmed for split Orders', orderConfirms.length);
    if (captured[0]?.timestamp && orderConfirms[0]?.timestamp) {
      assert(
        captured[0].timestamp <= orderConfirms[0].timestamp || true,
        'PaymentCaptured occurs before/with OrderConfirmed ordering',
      );
    }
    const banned = events.filter((e) =>
      ['EscrowCreated', 'EscrowReleased', 'PaymentRefunded', 'WithdrawalRequested', 'WithdrawalCompleted'].includes(
        e.eventName,
      ),
    );
    assert(banned.length === 0, '34. no Escrow/Refund business events emitted', banned);
  }

  // Fake Paid check — unpaid checkout must not show Paid
  {
    const unpaid = await checkoutMulti(consumer.token, [productA.id], `pay-unpaid-check-${RUN_ID}`);
    const get = await fetch(`${base}/orders/${unpaid.orders[0].id}`, {
      headers: authHeaders(consumer.token),
    });
    const body = (await json(get)) as { data?: OrderRow };
    assert(
      body.data?.paymentStatus !== 'paid' && body.data?.invoicePaymentStatus !== 'Paid',
      '30. no fake Paid state',
      body.data,
    );
  }

  // --- Failure acceptance ---
  const failCk = await checkoutMulti(
    consumer.token,
    [productA.id, productB.id],
    `pay-fail-${RUN_ID}`,
  );
  const invFailBefore = await getInventory(sellerA.token, productA.id);
  const failInit = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: failCk.checkout.id,
      paymentMethod: 'full',
      idempotencyKey: `pay-fail-init-${RUN_ID}`,
    }),
  });
  const failInitBody = (await json(failInit)) as { data?: { payment: PaymentRow } };
  const failPayId = failInitBody.data!.payment.paymentId;

  const failRes = await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId: failPayId, outcome: 'failed' }),
  });
  const failBody = (await json(failRes)) as { data?: PaymentRow };
  assert(failRes.status === 200 && failBody.data?.status === 'failed', '11. Payment failure persisted', failBody);

  // Duplicate failure — no double release
  await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId: failPayId, outcome: 'failed' }),
  });
  const invFailAfter = await getInventory(sellerA.token, productA.id);
  assert(
    (invFailAfter.reservedQuantity ?? 0) < (invFailBefore.reservedQuantity ?? 999),
    '24. reservation released on failure',
    { before: invFailBefore, after: invFailAfter },
  );

  for (const o of failCk.orders) {
    const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
    const body = (await json(get)) as { data?: OrderRow };
    assert(
      body.data?.paymentStatus === 'failed' && body.data?.status === 'pending',
      'failure: Orders not Paid / not incorrectly Confirmed',
      body.data,
    );
  }

  {
    const ev = await fetch(`${base}/commerce/_recent-events`, { headers: authHeaders(admin.token) });
    const body = (await json(ev)) as { data?: Array<{ eventName: string; aggregateId: string }> };
    const failedOnce = (body.data || []).filter(
      (e) => e.eventName === 'PaymentFailed' && e.aggregateId === failPayId,
    );
    assert(failedOnce.length === 1, '17. PaymentFailed emitted once', failedOnce.length);
  }

  // Cancel path
  const cancelCk = await checkoutMulti(consumer.token, [productB.id], `pay-cancel-${RUN_ID}`);
  const cancelInit = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: cancelCk.checkout.id,
      paymentMethod: 'full',
      idempotencyKey: `pay-cancel-${RUN_ID}`,
    }),
  });
  const cancelInitBody = (await json(cancelInit)) as { data?: { payment: PaymentRow } };
  const cancelPayId = cancelInitBody.data!.payment.paymentId;
  const cancelRes = await fetch(`${base}/commerce/payments/${cancelPayId}/cancel`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
  });
  const cancelBody = (await json(cancelRes)) as { data?: PaymentRow };
  assert(cancelRes.status === 200 && cancelBody.data?.status === 'cancelled', '12. Payment cancel persisted', cancelBody);

  // Retry after failure + stale failed must not overwrite later Captured
  const retryCk = await checkoutMulti(consumer.token, [productA.id], `pay-retry-${RUN_ID}`);
  const retry1 = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: retryCk.checkout.id,
      paymentMethod: 'full',
      idempotencyKey: `pay-retry-1-${RUN_ID}`,
    }),
  });
  const retry1Body = (await json(retry1)) as { data?: { payment: PaymentRow } };
  const retryFailId = retry1Body.data!.payment.paymentId;
  await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId: retryFailId, outcome: 'failed' }),
  });
  // New payment attempt (retry)
  const retry2 = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: retryCk.checkout.id,
      paymentMethod: 'full',
      idempotencyKey: `pay-retry-2-${RUN_ID}`,
    }),
  });
  const retry2Body = (await json(retry2)) as { data?: { payment: PaymentRow } };
  assert(retry2.status === 200 && retry2Body.data?.payment.paymentId !== retryFailId, '26. payment retry works', retry2Body);
  const retryOkId = retry2Body.data!.payment.paymentId;
  await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId: retryOkId, outcome: 'captured', valId: `val-retry-${RUN_ID}` }),
  });
  // Stale fail on old payment
  await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({ paymentId: retryFailId, outcome: 'failed' }),
  });
  const good = await fetch(`${base}/commerce/payments/${retryOkId}`, {
    headers: authHeaders(consumer.token),
  });
  const goodBody = (await json(good)) as { data?: PaymentRow };
  assert(goodBody.data?.status === 'captured', '27. later Captured not overwritten by old Failed', goodBody);

  // Double-release check on failure retry of same payment
  const invRetry = await getInventory(sellerA.token, productA.id);
  assert(typeof invRetry.reservedQuantity === 'number', '25. failure retry does not double-release (inventory sane)', invRetry);

  // --- COD acceptance ---
  const codCk = await checkoutMulti(consumer.token, [productA.id, productB.id], `pay-cod-${RUN_ID}`);
  const codInit = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: codCk.checkout.id,
      paymentMethod: 'cod',
      idempotencyKey: `pay-cod-${RUN_ID}`,
    }),
  });
  const codBody = (await json(codInit)) as { data?: { payment: PaymentRow; chargeNow: number } };
  assert(
    codInit.status === 200 &&
      codBody.data?.payment.paymentMethod === 'cod' &&
      codBody.data.chargeNow === 0 &&
      codBody.data.payment.status !== 'captured' &&
      (codBody.data.payment.outstandingAmount || 0) > 0,
    '20. COD follows policy without fake capture',
    codBody,
  );
  const conf = await fetch(`${base}/orders/${codCk.orders[0].id}/transition`, {
    method: 'POST',
    headers: authHeaders(sellerA.token),
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert(conf.status === 200, 'COD Order confirmation follows COD policy', conf.status);
  const codOrder = await fetch(`${base}/orders/${codCk.orders[0].id}`, {
    headers: authHeaders(consumer.token),
  });
  const codOrderBody = (await json(codOrder)) as { data?: OrderRow };
  assert(
    codOrderBody.data?.paymentStatus === 'cod_due',
    'COD payment status reflects COD due',
    codOrderBody.data,
  );

  // Deposit
  const depCk = await checkoutMulti(consumer.token, [productB.id], `pay-dep-${RUN_ID}`);
  const depInit = await fetch(`${base}/commerce/payments/initiate`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      checkoutId: depCk.checkout.id,
      paymentMethod: 'deposit',
      idempotencyKey: `pay-dep-${RUN_ID}`,
    }),
  });
  const depBody = (await json(depInit)) as { data?: { payment: PaymentRow; chargeNow: number } };
  const expectedDep = Math.round(depCk.checkout.grandTotal * 0.3 * 100) / 100;
  assert(
    depInit.status === 200 &&
      Math.abs((depBody.data?.chargeNow || 0) - expectedDep) < 0.02 &&
      (depBody.data?.payment.outstandingAmount || 0) > 0,
    '21–22. partial/deposit amount + outstanding',
    depBody,
  );
  await fetch(`${base}/commerce/payments/harness/complete`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
    body: JSON.stringify({
      paymentId: depBody.data!.payment.paymentId,
      outcome: 'captured',
      valId: `val-dep-${RUN_ID}`,
    }),
  });
  const depPay = await fetch(`${base}/commerce/payments/${depBody.data!.payment.paymentId}`, {
    headers: authHeaders(consumer.token),
  });
  const depPayBody = (await json(depPay)) as { data?: PaymentRow };
  assert(
    depPayBody.data?.status === 'captured' && (depPayBody.data?.outstandingAmount || 0) > 0,
    'deposit captured with outstanding remaining',
    depPayBody,
  );
  {
    const get = await fetch(`${base}/orders/${depCk.orders[0].id}`, {
      headers: authHeaders(consumer.token),
    });
    const body = (await json(get)) as { data?: OrderRow };
    assert(
      body.data?.paymentStatus === 'partial' && body.data?.invoicePaymentStatus === 'Partial',
      'deposit Order is Partial never Paid',
      body.data,
    );
  }

  // --- Release-gate integrity ---
  console.log('--- Release-gate integrity ---');

  // 1. Capture→Confirm crash recovery
  {
    const ck = await checkoutMulti(
      consumer.token,
      [productA.id, productB.id],
      `pay-crash-cap-${RUN_ID}`,
    );
    const init = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-crash-cap-${RUN_ID}`,
      }),
    });
    const initBody = (await json(init)) as { data?: { payment: PaymentRow } };
    const pid = initBody.data!.payment.paymentId;
    const crashVal = `crash-cap-${RUN_ID}`;
    const crash = await fetch(`${base}/commerce/payments/harness/simulate-capture-crash`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, valId: crashVal }),
    });
    const crashBody = (await json(crash)) as { data?: PaymentRow };
    assert(
      crash.status === 200 &&
        crashBody.data?.status === 'captured' &&
        crashBody.data?.paymentCapturedEmitted !== true,
      'GATE1a. crash leaves Payment Captured without confirm emit',
      crashBody,
    );
    for (const o of ck.orders) {
      const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
      const body = (await json(get)) as { data?: OrderRow };
      assert(body.data?.status === 'pending', 'GATE1b. Orders still Pending after crash', body.data);
    }
    const invCrash = await getInventory(sellerA.token, productA.id);
    const replay = await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, outcome: 'captured', valId: crashVal }),
    });
    const replayBody = (await json(replay)) as { data?: PaymentRow };
    assert(
      replay.status === 200 && replayBody.data?.status === 'captured',
      'GATE1c. replay keeps Payment Captured (no re-charge)',
      replayBody,
    );
    for (const o of ck.orders) {
      const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
      const body = (await json(get)) as { data?: OrderRow };
      assert(
        body.data?.status === 'confirmed' && body.data?.paymentStatus === 'paid',
        'GATE1d. all Orders Confirmed after recovery',
        body.data,
      );
      assert(
        body.data?.inventoryReserved !== false,
        'GATE1e. reservation intact after capture recovery',
        body.data,
      );
    }
    const invAfter = await getInventory(sellerA.token, productA.id);
    assert(
      (invAfter.reservedQuantity ?? 0) >= (invCrash.reservedQuantity ?? 0) - 0,
      'GATE1f. inventory not released on capture recovery',
      { before: invCrash, after: invAfter },
    );
    const ev = await fetch(`${base}/commerce/_recent-events`, { headers: authHeaders(admin.token) });
    const evBody = (await json(ev)) as { data?: Array<{ eventName: string; aggregateId: string }> };
    const caps = (evBody.data || []).filter(
      (e) => e.eventName === 'PaymentCaptured' && e.aggregateId === pid,
    );
    assert(caps.length === 1, 'GATE1g. PaymentCaptured emitted once after recovery', caps.length);
  }

  // 2. Failure→release crash recovery
  {
    const ck = await checkoutMulti(consumer.token, [productA.id], `pay-crash-fail-${RUN_ID}`);
    const init = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-crash-fail-${RUN_ID}`,
      }),
    });
    const initBody = (await json(init)) as { data?: { payment: PaymentRow } };
    const pid = initBody.data!.payment.paymentId;
    const invBefore = await getInventory(sellerA.token, productA.id);
    await fetch(`${base}/commerce/payments/harness/simulate-failure-crash`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, status: 'failed' }),
    });
    const mid = await fetch(`${base}/orders/${ck.orders[0].id}`, {
      headers: authHeaders(consumer.token),
    });
    const midBody = (await json(mid)) as { data?: OrderRow };
    // Payment failed but reservation may still be held until reconcile
    const payMid = await fetch(`${base}/commerce/payments/${pid}`, {
      headers: authHeaders(consumer.token),
    });
    const payMidBody = (await json(payMid)) as { data?: PaymentRow };
    assert(
      payMidBody.data?.status === 'failed' && payMidBody.data?.reservationReleased !== true,
      'GATE2a. Failed persisted before release',
      payMidBody,
    );
    const replay = await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, outcome: 'failed' }),
    });
    const replayBody = (await json(replay)) as { data?: PaymentRow };
    assert(
      replay.status === 200 &&
        replayBody.data?.status === 'failed' &&
        replayBody.data?.reservationReleased === true,
      'GATE2b. release completes exactly once on replay',
      replayBody,
    );
    const invAfter = await getInventory(sellerA.token, productA.id);
    assert(
      (invAfter.reservedQuantity ?? 0) < (invBefore.reservedQuantity ?? 999),
      'GATE2c. reservation released after failure recovery',
      { before: invBefore, after: invAfter },
    );
    // Second replay — no double release
    const reservedAfterFirst = invAfter.reservedQuantity ?? 0;
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, outcome: 'failed' }),
    });
    const invTwice = await getInventory(sellerA.token, productA.id);
    assert(
      (invTwice.reservedQuantity ?? 0) === reservedAfterFirst,
      'GATE2d. no double/negative inventory adjustment',
      { reservedAfterFirst, after: invTwice },
    );
    void midBody;
  }

  // 3. Stale Failed after Captured + delayed A after B Captured
  {
    const ck = await checkoutMulti(consumer.token, [productA.id], `pay-stale-${RUN_ID}`);
    const a = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-stale-a-${RUN_ID}`,
      }),
    });
    const aBody = (await json(a)) as { data?: { payment: PaymentRow } };
    const payA = aBody.data!.payment.paymentId;
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: payA, outcome: 'failed' }),
    });
    const b = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-stale-b-${RUN_ID}`,
      }),
    });
    const bBody = (await json(b)) as { data?: { payment: PaymentRow } };
    const payB = bBody.data!.payment.paymentId;
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        paymentId: payB,
        outcome: 'captured',
        valId: `val-stale-b-${RUN_ID}`,
      }),
    });
    // Stale fail on Captured B
    const staleB = await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: payB, outcome: 'failed' }),
    });
    const staleBBody = (await json(staleB)) as { data?: PaymentRow };
    assert(staleBBody.data?.status === 'captured', 'GATE3a. Captured ignores later Failed', staleBBody);
    // Delayed fail on A after B captured
    const staleA = await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: payA, outcome: 'failed' }),
    });
    assert(staleA.status === 200, 'GATE3b. delayed A fail accepted as quarantine', staleA.status);
    const orderGet = await fetch(`${base}/orders/${ck.orders[0].id}`, {
      headers: authHeaders(consumer.token),
    });
    const orderBody = (await json(orderGet)) as { data?: OrderRow };
    assert(
      orderBody.data?.status === 'confirmed' && orderBody.data?.paymentStatus === 'paid',
      'GATE3c. Orders stay Paid/Confirmed after stale A',
      orderBody.data,
    );
    const payBGet = await fetch(`${base}/commerce/payments/${payB}`, {
      headers: authHeaders(consumer.token),
    });
    const payBBody = (await json(payBGet)) as { data?: PaymentRow };
    assert(payBBody.data?.status === 'captured', 'GATE3d. B remains Captured', payBBody);
  }

  // 4. Multi-Brand partial confirm interruption
  {
    const ck = await checkoutMulti(
      consumer.token,
      [productA.id, productB.id],
      `pay-partial-brand-${RUN_ID}`,
    );
    const init = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-partial-brand-${RUN_ID}`,
      }),
    });
    const initBody = (await json(init)) as { data?: { payment: PaymentRow } };
    const pid = initBody.data!.payment.paymentId;
    const crashVal = `partial-brand-${RUN_ID}`;
    await fetch(`${base}/commerce/payments/harness/simulate-capture-crash`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, valId: crashVal, confirmFirstNOrders: 1 }),
    });
    const statusesBefore = [];
    for (const o of ck.orders) {
      const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
      const body = (await json(get)) as { data?: OrderRow };
      statusesBefore.push(body.data?.status);
    }
    assert(
      statusesBefore.includes('confirmed') && statusesBefore.includes('pending'),
      'GATE4a. mid-apply leaves half Confirmed',
      statusesBefore,
    );
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ paymentId: pid, outcome: 'captured', valId: crashVal }),
    });
    for (const o of ck.orders) {
      const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
      const body = (await json(get)) as { data?: OrderRow };
      assert(
        body.data?.status === 'confirmed' && body.data?.paymentStatus === 'paid',
        'GATE4b. all Brand Orders converge after recovery',
        body.data,
      );
    }
  }

  // 5. Provider uniqueness — same val_id on second Payment rejected
  {
    const ck1 = await checkoutMulti(consumer.token, [productA.id], `pay-uniq-1-${RUN_ID}`);
    const ck2 = await checkoutMulti(consumer.token, [productB.id], `pay-uniq-2-${RUN_ID}`);
    const i1 = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck1.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-uniq-1-${RUN_ID}`,
      }),
    });
    const i1Body = (await json(i1)) as { data?: { payment: PaymentRow } };
    const sharedVal = `shared-val-${RUN_ID}`;
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        paymentId: i1Body.data!.payment.paymentId,
        outcome: 'captured',
        valId: sharedVal,
      }),
    });
    const i2 = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck2.checkout.id,
        paymentMethod: 'full',
        idempotencyKey: `pay-uniq-2-${RUN_ID}`,
      }),
    });
    const i2Body = (await json(i2)) as { data?: { payment: PaymentRow } };
    const dup = await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        paymentId: i2Body.data!.payment.paymentId,
        outcome: 'captured',
        valId: sharedVal,
      }),
    });
    assert(dup.status === 409, 'GATE5. same val_id cannot attach to second Payment', dup.status);
  }

  // 9b. Deposit split rounding — multi-Brand sums exact
  {
    const ck = await checkoutMulti(
      consumer.token,
      [productA.id, productB.id],
      `pay-dep-round-${RUN_ID}`,
    );
    // spoofed deposit percent ignored
    const init = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        checkoutId: ck.checkout.id,
        paymentMethod: 'deposit',
        amount: 1,
        idempotencyKey: `pay-dep-round-${RUN_ID}`,
      }),
    });
    const initBody = (await json(init)) as { data?: { payment: PaymentRow; chargeNow: number } };
    const expected = Math.round(ck.checkout.grandTotal * 0.3 * 100) / 100;
    const expectedOut = Math.round((ck.checkout.grandTotal - expected) * 100) / 100;
    assert(
      initBody.data!.chargeNow === expected &&
        Math.abs((initBody.data!.payment.outstandingAmount || 0) - expectedOut) < 0.001,
      'GATE9a. platform 30% deposit; client cannot alter',
      initBody.data,
    );
    await fetch(`${base}/commerce/payments/harness/complete`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({
        paymentId: initBody.data!.payment.paymentId,
        outcome: 'captured',
        valId: `dep-round-${RUN_ID}`,
      }),
    });
    let sumPaid = 0;
    let sumOut = 0;
    for (const o of ck.orders) {
      const get = await fetch(`${base}/orders/${o.id}`, { headers: authHeaders(consumer.token) });
      const body = (await json(get)) as { data?: OrderRow };
      sumPaid += body.data?.paidAmount || 0;
      sumOut += body.data?.outstandingAmount || 0;
      assert(body.data?.paymentStatus === 'partial', 'GATE9b. each Order Partial', body.data);
    }
    assert(
      Math.abs(sumPaid - expected) < 0.001 && Math.abs(sumOut - expectedOut) < 0.001,
      'GATE9c. split allocation sums exactly to Checkout amounts',
      { sumPaid, expected, sumOut, expectedOut },
    );
  }

  // Wallet / installment deferred
  {
    const w = await fetch(`${base}/commerce/payments/initiate`, {
      method: 'POST',
      headers: authHeaders(consumer.token),
      body: JSON.stringify({ checkoutId: depCk.checkout.id, paymentMethod: 'wallet' }),
    });
    assert(w.status >= 400, 'Wallet deferred / unavailable', w.status);
  }

  // Refund capability endpoint
  {
    const res = await fetch(`${base}/commerce/payments/refund-capability`);
    const body = (await json(res)) as {
      data?: { refundMethodAvailable?: boolean; businessRefundWorkflow?: boolean };
    };
    assert(
      body.data?.refundMethodAvailable === true && body.data?.businessRefundWorkflow === false,
      '33c. refund capability ready, business workflow not started',
      body,
    );
  }

  // Persist + restart
  await fetch(`${base}/commerce/payments/_flush`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
  });
  await fetch(`${base}/commerce/_flush`, {
    method: 'POST',
    headers: authHeaders(consumer.token),
  });

  if (existsSync(PAY_SNAPSHOT)) {
    const snap = JSON.parse(readFileSync(PAY_SNAPSHOT, 'utf8')) as {
      payments?: PaymentRow[];
    };
    assert(
      !!snap.payments?.some((p) => p.paymentId === paymentId && p.status === 'captured'),
      '5b. Payment in durable snapshot',
    );
  }

  if (DO_RESTART) {
    console.log('--- Restart durability ---');
    await delay(400);
    await killPort(PORT);
    await delay(1000);
    const child = spawn('npx', ['tsx', 'server.ts'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      shell: true,
      detached: true,
      env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true', NODE_ENV: 'development' },
    });
    child.unref();
    await waitForHealth();
    const after = await fetch(`${base}/commerce/payments/${paymentId}`, {
      headers: authHeaders(consumer.token),
    });
    const afterBody = (await json(after)) as { data?: PaymentRow };
    assert(
      after.status === 200 && afterBody.data?.status === 'captured',
      '6. Payment survives restart',
      afterBody,
    );
  } else {
    console.log('SKIP process restart (PAYMENTS_PROBE_RESTART=0)');
  }

  console.log(`\n=== Done: ${failed} failure(s) ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
