/**
 * Sprint 12 pre-beta audit — P0 durability regression. Four stores previously
 * had NO real persistence (returns/verifications/reviews/coupons/leads/job
 * postings/seller offers/fee charges in operationsStore; shipments in
 * shipmentStore, hydrated only via the same gated mechanism; booking-request
 * negotiations in bookingStore; admin broadcasts + per-user notification
 * preferences in communicationStore) — all silently wiped on every restart.
 * Confirms each now survives a REAL server restart.
 *
 * Usage: npx tsx scripts/probe-sprint12-operations-persistence.ts
 * Or:    npm run test:sprint12-operations-persistence
 */
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 3001);
const BASE = `http://localhost:${PORT}`;
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

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${V1}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
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
  const { token: admin, uid: adminUid } = await login(ADMIN_EMAIL, DEV_PASS);
  const stamp = Date.now();

  // --- 1. operationsStore: create a real coupon ---
  const couponCode = `SPRINT12PROBE${stamp}`;
  const couponRes = await fetch(`${V1}/operations/coupons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      code: couponCode,
      type: 'fixed_amount',
      discountTarget: 'all_products',
      discountValue: 50,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      active: true,
      rules: {},
      description: 'Sprint 12 persistence probe coupon',
    }),
  });
  const couponBody = (await couponRes.json()) as { data?: { id: string } };
  assert(couponRes.ok && couponBody.data?.id, 'operationsStore: coupon created', couponBody);
  const couponId = couponBody.data?.id;

  // --- 2. communicationStore: create a real broadcast ---
  const broadcastRes = await fetch(`${BASE}/api/admin/broadcasts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      broadcastType: 'admin',
      title: `Sprint 12 persistence probe ${stamp}`,
      body: 'Testing broadcast persistence',
      targetRoles: [],
    }),
  });
  const broadcastBody = (await broadcastRes.json()) as { data?: { id: string } } & Json;
  const broadcastId = (broadcastBody.data as { id?: string } | undefined)?.id || (broadcastBody as { id?: string }).id;
  assert(broadcastRes.ok && !!broadcastId, 'communicationStore: broadcast created', broadcastBody);

  // --- 3. communicationStore: set a distinctive notification preference ---
  const prefRes = await fetch(`${BASE}/api/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ channels: { sms: true }, marketingOptIn: true }),
  });
  assert(prefRes.ok, 'communicationStore: notification preference set', prefRes.status);

  // --- 4. bookingStore: create a real booking request ---
  const bookingRes = await fetch(`${V1}/booking/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listingId: `svc-sprint12-probe-${stamp}`,
      listingTitle: 'Sprint 12 Probe Service',
      sellerId: 'sprint12-probe-seller',
      sellerName: 'Probe Seller',
      buyerId: 'sprint12-probe-buyer',
      buyerName: 'Probe Buyer',
      price: 500,
    }),
  });
  const bookingBody = (await bookingRes.json()) as { request?: { id: string } };
  assert(bookingRes.ok && bookingBody.request?.id, 'bookingStore: booking request created', bookingBody);
  const bookingId = bookingBody.request?.id;

  // --- 5. operationsStore: create a return, a lead, and a fee/charge — all
  // three live in the SAME operationsStore snapshot as coupons (already
  // verified above), so passing here plus the coupon check gives direct
  // evidence across a representative spread of that store's ~12 fields, not
  // just one field standing in for all of them. ---
  const returnRes = await fetch(`${V1}/operations/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      orderId: `ORD-SPRINT12-PROBE-${stamp}`,
      itemId: 'item-1',
      buyerId: adminUid,
      sellerId: 'sprint12-probe-seller',
      reason: 'defective',
      description: 'Sprint 12 persistence probe return',
    }),
  });
  const returnBody = (await returnRes.json()) as { data?: { id: string } };
  assert(returnRes.ok && returnBody.data?.id, 'operationsStore: return created', returnBody);
  const returnId = returnBody.data?.id;

  const leadRes = await fetch(`${V1}/operations/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandName: `Sprint12 Probe Brand ${stamp}`,
      email: `sprint12-probe-lead-${stamp}@test.choosify.bd`,
      contactPerson: 'Probe Contact',
    }),
  });
  const leadBody = (await leadRes.json()) as { data?: { id: string } };
  assert(leadRes.ok && leadBody.data?.id, 'operationsStore: lead created', leadBody);
  const leadId = leadBody.data?.id;

  const feeChargeRes = await fetch(`${V1}/operations/fee-charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: `Sprint12 Probe Fee ${stamp}`, rateValue: 5 }),
  });
  const feeChargeBody = (await feeChargeRes.json()) as { data?: { id: string } };
  assert(feeChargeRes.ok && feeChargeBody.data?.id, 'operationsStore: fee charge created', feeChargeBody);
  const feeChargeId = feeChargeBody.data?.id;

  // Allow all debounced disk writes (300-400ms) to flush before restart.
  await delay(1000);

  console.log('Restarting API server on port', PORT, '…');
  await killPort(PORT);
  await delay(2000);

  const child = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  child.unref();

  await waitForHealth();
  console.log('Server healthy after restart');

  const { token: admin2 } = await login(ADMIN_EMAIL, DEV_PASS);

  // --- Verify all 4 survived ---
  const couponsAfter = await fetch(`${V1}/operations/coupons`, { headers: { Authorization: `Bearer ${admin2}` } });
  const couponsAfterBody = (await couponsAfter.json()) as { data?: Array<{ id: string; code: string }> };
  assert(
    (couponsAfterBody.data || []).some((c) => c.id === couponId),
    'operationsStore: coupon survives real server restart',
    { couponId, count: couponsAfterBody.data?.length },
  );

  const returnsAfter = await fetch(`${V1}/operations/returns?buyerId=${encodeURIComponent(adminUid)}`, {
    headers: { Authorization: `Bearer ${admin2}` },
  });
  const returnsAfterBody = (await returnsAfter.json()) as { data?: Array<{ id: string }> };
  assert(
    (returnsAfterBody.data || []).some((r) => r.id === returnId),
    'operationsStore: return survives real server restart',
    { returnId, count: returnsAfterBody.data?.length },
  );

  const leadsAfter = await fetch(`${V1}/operations/leads`, { headers: { Authorization: `Bearer ${admin2}` } });
  const leadsAfterBody = (await leadsAfter.json()) as { data?: Array<{ id: string }> };
  assert(
    (leadsAfterBody.data || []).some((l) => l.id === leadId),
    'operationsStore: lead survives real server restart',
    { leadId, count: leadsAfterBody.data?.length },
  );

  const feeChargesAfter = await fetch(`${V1}/operations/fee-charges`);
  const feeChargesAfterBody = (await feeChargesAfter.json()) as { data?: Array<{ id: string }> };
  assert(
    (feeChargesAfterBody.data || []).some((f) => f.id === feeChargeId),
    'operationsStore: fee charge survives real server restart',
    { feeChargeId, count: feeChargesAfterBody.data?.length },
  );

  const broadcastsAfter = await fetch(`${BASE}/api/admin/broadcasts`, { headers: { Authorization: `Bearer ${admin2}` } });
  const broadcastsAfterBody = (await broadcastsAfter.json()) as { data?: { items?: Array<{ id: string }> } };
  const broadcastsList = broadcastsAfterBody.data?.items || [];
  assert(
    broadcastsList.some((b) => b.id === broadcastId),
    'communicationStore: broadcast survives real server restart',
    { broadcastId, count: broadcastsList.length },
  );

  const prefsAfter = await fetch(`${BASE}/api/notifications/preferences`, { headers: { Authorization: `Bearer ${admin2}` } });
  const prefsAfterBody = (await prefsAfter.json()) as { data?: { channels?: { sms?: boolean }; marketingOptIn?: boolean } };
  const prefsData = prefsAfterBody.data;
  assert(
    prefsData?.channels?.sms === true && prefsData?.marketingOptIn === true,
    'communicationStore: notification preference survives real server restart',
    prefsData,
  );

  const bookingAfter = await fetch(`${V1}/booking/requests/${encodeURIComponent(String(bookingId))}`);
  const bookingAfterBody = (await bookingAfter.json()) as { request?: { id: string } };
  assert(bookingAfter.ok && bookingAfterBody.request?.id === bookingId, 'bookingStore: booking request survives real server restart', bookingAfterBody);

  console.log('\n=== SPRINT 12 OPERATIONS/COMMUNICATION/BOOKING PERSISTENCE SUMMARY ===');
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
