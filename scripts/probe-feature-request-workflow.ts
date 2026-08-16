/**
 * Sprint 11 — Feature Request workflow regression (step 8). Confirms:
 *   - Seller can submit a feature request; it's persisted.
 *   - Duplicate active (pending) requests for the same feature are prevented.
 *   - Admin can list and review (approve/decline) it.
 *   - Approving a request does NOT itself enable the feature — that stays a
 *     separate explicit Admin action, never automatic.
 *   - Consumer/unauthenticated cannot submit or review requests.
 *   - nav-attention reflects the pending count for Admin.
 *
 * Usage: npx tsx scripts/probe-feature-request-workflow.ts
 * Or:    npm run test:feature-request-workflow
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
  const seller = await login('seller@choosify.com.bd', DEV_PASS);
  const FEATURE_KEY = 'customerInsights';

  // Consumer cannot request a partner feature.
  const stamp = Date.now();
  const consumerEmail = `feature-req-consumer-${stamp}@test.choosify.bd`;
  await fetch(`${V1}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: consumerEmail, password: 'RoleTest!2026', fullName: 'Feature Req Consumer' }),
  });
  const consumer = await login(consumerEmail, 'RoleTest!2026');
  const consumerRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consumer.token}` },
    body: JSON.stringify({ featureKey: FEATURE_KEY }),
  });
  assert(consumerRes.status === 403, 'consumer cannot submit a feature request', consumerRes.status);

  // Unauthenticated cannot submit.
  const unauthRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featureKey: FEATURE_KEY }),
  });
  assert(unauthRes.status === 401, 'unauthenticated cannot submit a feature request', unauthRes.status);

  // Seller submits a real request.
  const createRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ featureKey: FEATURE_KEY, message: 'Would like customer insights please' }),
  });
  const createBody = (await createRes.json()) as { success?: boolean; featureRequest?: { id: string; status: string } };
  assert(createRes.ok && createBody.success && createBody.featureRequest?.status === 'pending', 'seller submits a real, persisted request', createBody);
  const requestId = createBody.featureRequest!.id;

  // Duplicate active request is deduped, not a second row.
  const dupRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ featureKey: FEATURE_KEY }),
  });
  const dupBody = (await dupRes.json()) as { featureRequest?: { id: string } };
  assert(dupBody.featureRequest?.id === requestId, 'duplicate active request for same feature is deduped, not a second row', dupBody);

  // Seller can see their own request via /mine.
  const mineRes = await fetch(`${V1}/entitlements/feature-requests/mine`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  const mineBody = (await mineRes.json()) as { featureRequests?: Array<{ id: string }> };
  assert((mineBody.featureRequests || []).some((r) => r.id === requestId), 'seller sees their own request via /entitlements/feature-requests/mine');

  // Seller cannot review (admin-only).
  const selfReviewRes = await fetch(`${V1}/entitlements/admin/feature-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ status: 'approved' }),
  });
  assert(selfReviewRes.status === 403, 'seller cannot review their own request', selfReviewRes.status);

  // Admin sees the pending request in nav-attention.
  const navRes = await fetch(`${V1}/dashboard/nav-attention`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const navBody = (await navRes.json()) as { counts?: { featureRequests?: { count: number } } };
  assert((navBody.counts?.featureRequests?.count || 0) >= 1, 'admin nav-attention reflects pending feature requests', navBody.counts?.featureRequests);

  // Admin lists pending requests.
  const adminListRes = await fetch(`${V1}/entitlements/admin/feature-requests?status=pending`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const adminListBody = (await adminListRes.json()) as { featureRequests?: Array<{ id: string }> };
  assert((adminListBody.featureRequests || []).some((r) => r.id === requestId), 'admin sees the request in the pending queue');

  // Feature is NOT enabled just because a request exists (no self-enable / no auto-grant).
  const meBefore = await fetch(`${V1}/entitlements/me`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const meBeforeBody = (await meBefore.json()) as { entitlements?: Record<string, boolean> };
  const enabledBeforeApproval = meBeforeBody.entitlements?.[FEATURE_KEY];

  // Admin approves — records a decision only.
  const approveRes = await fetch(`${V1}/entitlements/admin/feature-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'approved', reviewNote: 'Approved by probe' }),
  });
  const approveBody = (await approveRes.json()) as { success?: boolean; featureRequest?: { status: string } };
  assert(approveRes.ok && approveBody.success && approveBody.featureRequest?.status === 'approved', 'admin approves the request', approveBody);

  const meAfter = await fetch(`${V1}/entitlements/me`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const meAfterBody = (await meAfter.json()) as { entitlements?: Record<string, boolean> };
  assert(
    meAfterBody.entitlements?.[FEATURE_KEY] === enabledBeforeApproval,
    'approving a request does NOT itself grant the feature (still requires a separate explicit entitlement action)',
    { before: enabledBeforeApproval, after: meAfterBody.entitlements?.[FEATURE_KEY] },
  );

  // A new request for the same feature can be created now that the old one is resolved (not pending).
  const newReqRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ featureKey: FEATURE_KEY }),
  });
  const newReqBody = (await newReqRes.json()) as { featureRequest?: { id: string } };
  assert(newReqBody.featureRequest?.id !== requestId, 'a new request can be filed after the previous one was resolved', newReqBody);

  console.log('\n=== FEATURE REQUEST WORKFLOW SUMMARY ===');
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
