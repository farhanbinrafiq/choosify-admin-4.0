/**
 * Sprint 11 — Manual Order completion regression (step 5 of the approved
 * implementation order). Confirms the full chain:
 *
 *   conversation-context order (source != checkout)
 *   -> POST /orders/manual (canonical commerce architecture, not a separate
 *      messaging-only store)
 *   -> order appears in Orders Hub (GET /orders)
 *   -> a real catalog product (not the old hardcoded 4-SKU fixture) can be used
 *   -> the order's conversation exists SYNCHRONOUSLY, immediately after the
 *      create call returns — no reliance on the batch reconcile endpoint or
 *      the fire-and-forget OrderCreated event subscriber's own timing.
 *
 * Usage: npx tsx scripts/probe-manual-order-conversation-sync.ts
 * Or:    npm run test:manual-order-conversation-sync
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
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

async function login(email: string, password: string): Promise<{ token: string; uid: string }> {
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok || typeof body.accessToken !== 'string') {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  }
  return { token: body.accessToken as string, uid: String(body.uid || '') };
}

async function main() {
  const admin = await login(ADMIN_EMAIL, DEV_PASS);

  // Use a real catalog product (proves the "no fictional SKU dependency" fix at
  // the API layer — the frontend fix is covered separately by tsc + manual UAT).
  // Fetch unauthenticated/public since GET /catalog/products auto-scopes to the
  // caller's own products when a non-admin token is attached, and admin needs a
  // product it can legitimately create a manual order for on any seller's behalf.
  const productsRes = await fetch(`${V1}/catalog/products`);
  const productsBody = (await productsRes.json()) as { data?: Array<{ id: string; title: string; brandId: string; sellerId?: string }> };
  const realProduct = (productsBody.data || []).find((p) => !!p.sellerId);
  assert(!!realProduct, 'a real catalog product exists to use in the manual order', productsBody.data?.length);
  if (!realProduct) throw new Error('cannot continue without a real product fixture');

  const createRes = await fetch(`${V1}/orders/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({
      sellerId: realProduct.sellerId,
      brandId: realProduct.brandId,
      listingType: 'product',
      listingId: realProduct.id,
      quantity: 1,
      source: 'external_whatsapp',
      shipping: { fullName: 'Probe Customer', phone: '01700000000', address: 'Dhaka, Bangladesh' },
      notes: 'manual order conversation-sync probe',
    }),
  });
  const createBody = (await createRes.json()) as { success?: boolean; data?: { id: string; orderNumber?: string } };
  assert(createRes.ok && createBody.success && createBody.data?.id, 'POST /orders/manual creates a real canonical order', createBody);
  const orderId = createBody.data!.id;

  // No delay here on purpose — this is exactly the race the sync fix closes.
  const ordersHubRes = await fetch(`${V1}/orders?sellerId=${encodeURIComponent(String(realProduct.sellerId))}`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const ordersHubBody = (await ordersHubRes.json()) as { data?: Array<{ id: string }> } | { success?: boolean; data?: { orders?: Array<{ id: string }> } };
  const hubOrders =
    (ordersHubBody as { data?: Array<{ id: string }> }).data && Array.isArray((ordersHubBody as { data?: Array<{ id: string }> }).data)
      ? (ordersHubBody as { data?: Array<{ id: string }> }).data!
      : ((ordersHubBody as { data?: { orders?: Array<{ id: string }> } }).data?.orders || []);
  assert(
    hubOrders.some((o) => o.id === orderId),
    'manual order appears in Orders Hub immediately',
    { orderId, hubCount: hubOrders.length },
  );

  const convRes = await fetch(`${V1}/conversations?contextType=manual_order`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const convBody = (await convRes.json()) as { success?: boolean; data?: Array<{ id: string; orderId?: string; contextType?: string }> };
  assert(convRes.ok && convBody.success, 'GET /conversations?contextType=manual_order succeeds', convRes.status);
  const linkedConv = (convBody.data || []).find((c) => c.orderId === orderId);
  assert(!!linkedConv, 'order conversation exists synchronously, no delay/reconcile needed', {
    orderId,
    conversationsReturned: convBody.data?.length,
  });
  assert(linkedConv?.contextType === 'manual_order', 'conversation has contextType manual_order', linkedConv);

  console.log('\n=== MANUAL ORDER CONVERSATION SYNC SUMMARY ===');
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
