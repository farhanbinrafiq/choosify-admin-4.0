/**
 * Customer invoice authorization QA — a Consumer must only be able to
 * view/print/download invoices belonging to their own orders. Verifies the
 * SERVER (GET /operations/orders/:id), not just the client-side UI check in
 * Choosify-Web's InvoicePage.tsx, rejects a different consumer's attempt to
 * read someone else's order/invoice.
 *
 * Usage: npx tsx scripts/probe-customer-invoice-authorization.ts
 */
const API_BASE = process.env.PROBE_API_BASE || 'http://localhost:3001';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function api(path: string, init: RequestInit = {}, token?: string) {
  const r = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}

async function main() {
  const admin = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@choosify.com.bd', password: PW }) })).body;
  if (!admin.accessToken) throw new Error('admin login failed');

  // Find a real order with a buyerId to target.
  const orders = (await api('/operations/orders', {}, admin.accessToken)).body;
  const list: any[] = orders.data || orders.orders || [];
  const targetOrder = list.find((o) => o.buyerId && (o.subOrders || []).some((s: any) => s.invoiceId));
  if (!targetOrder) throw new Error('no invoiced order with a buyerId found to test against');
  console.log('target order:', targetOrder.orderId, 'buyerId:', targetOrder.buyerId);

  // 1. The actual owner CAN read it (sanity check the endpoint works at all
  //    for a legitimate viewer -- admin is staff so this always passes;
  //    included only to confirm the order/endpoint itself is reachable).
  const asAdmin = await api(`/operations/orders/${targetOrder.orderId}`, {}, admin.accessToken);
  assert(asAdmin.status === 200, 'A1: staff (admin) can read the order', asAdmin.status);

  // 2. A DIFFERENT, unrelated consumer must be REJECTED by the server.
  //    Register a fresh throwaway consumer account (guaranteed not to be
  //    this order's buyer) and attempt the same read.
  const rid = Date.now();
  const email = `probe-invoice-auth-${rid}@example.com`;
  const signup = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: PW, fullName: 'Probe Outsider', role: 'consumer' }),
  });
  const outsiderToken = signup.body?.accessToken || signup.body?.customToken;
  if (!outsiderToken) {
    console.log('signup response:', signup.status, JSON.stringify(signup.body).slice(0, 300));
    throw new Error('could not create a throwaway outsider consumer account to test with');
  }
  console.log('outsider consumer created:', email);

  const asOutsider = await api(`/operations/orders/${targetOrder.orderId}`, {}, outsiderToken);
  assert(asOutsider.status === 403 || asOutsider.status === 404, 'B1: an unrelated consumer is REJECTED (403/404) reading another buyer\'s order', asOutsider.status);
  assert(!asOutsider.body?.data, 'B2: no order data was leaked in the rejection response', JSON.stringify(asOutsider.body).slice(0, 200));

  // 3. No auth token at all -- must also be rejected, not fall through to
  //    some anonymous-read path.
  const noAuth = await api(`/operations/orders/${targetOrder.orderId}`, {});
  assert(noAuth.status === 401 || noAuth.status === 403, 'C1: an unauthenticated request is rejected', noAuth.status);

  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
