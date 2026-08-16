/**
 * Sprint 11 — event-driven notification regression (step 9). The discovery
 * audit found that nav-attention counters were real but the notification
 * center was mostly disconnected: seller/creator applications, ownership
 * claims, and marketplace approval/rejection never generated an actual
 * notification object, only a passive counter. Confirms these now fire real,
 * persisted notifications with a valid actionUrl pointing at a live route:
 *   - New seller application -> admins notified, actionUrl /admin/brand-studio
 *   - Approved application -> applicant notified, actionUrl /admin/brand-profile
 *   - Ownership claim submitted -> admins/moderators notified, actionUrl /upe/...
 *   - Feature request submitted -> admins notified, actionUrl /admin/feature-access
 *
 * Usage: npx tsx scripts/probe-event-notifications.ts
 * Or:    npm run test:event-notifications
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

async function listMyNotifications(token: string): Promise<Array<{ title: string; actionUrl?: string; summary?: string }>> {
  const res = await fetch(`${BASE}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { items?: Array<{ title: string; actionUrl?: string; summary?: string }> } | Array<{ title: string; actionUrl?: string; summary?: string }>;
  };
  if (Array.isArray(body.data)) return body.data;
  return body.data?.items || [];
}

async function main() {
  const admin = await login(ADMIN_EMAIL, DEV_PASS);
  const stamp = Date.now();

  // --- New seller application notifies admins ---
  const sellerEmail = `event-notif-seller-${stamp}@test.choosify.bd`;
  const applyRes = await fetch(`${V1}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email: sellerEmail,
      password: 'RoleTest!2026',
      displayName: 'Event Notif Seller',
      businessOrChannelName: `Event Notif Store ${stamp}`,
      phone: '01700000000',
      category: 'Fashion',
      city: 'Dhaka',
    }),
  });
  assert(applyRes.ok, 'partner-apply for fresh seller succeeds', applyRes.status);

  const adminNotifsAfterApply = await listMyNotifications(admin.token);
  const applicationNotif = adminNotifsAfterApply.find((n) => n.title === 'New Seller Application' && n.summary?.includes(`Event Notif Store ${stamp}`));
  assert(!!applicationNotif, 'admin receives a real "New Seller Application" notification', adminNotifsAfterApply.slice(0, 3));
  assert(applicationNotif?.actionUrl === '/admin/brand-studio', 'application notification actionUrl points at a live current route', applicationNotif);

  // --- Approval notifies the applicant ---
  const listRes = await fetch(`${V1}/operations/partner-applications?status=pending`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const listBody = (await listRes.json()) as { applications?: Array<{ id: string; email?: string }> };
  const application = (listBody.applications || []).find((a) => a.email === sellerEmail);
  assert(!!application, 'pending partner application found for fresh seller');
  await fetch(`${V1}/operations/partner-applications/${encodeURIComponent(application!.id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ note: 'event notification probe' }),
  });
  const seller = await login(sellerEmail, 'RoleTest!2026');
  const sellerNotifs = await listMyNotifications(seller.token);
  const approvalNotif = sellerNotifs.find((n) => n.title === 'Marketplace Access Approved');
  assert(!!approvalNotif, 'applicant receives a real approval notification', sellerNotifs.slice(0, 3));
  assert(approvalNotif?.actionUrl === '/admin/brand-profile', 'approval notification actionUrl points at a live current route', approvalNotif);

  // --- Ownership claim / verification submission notifies admins+moderators ---
  const brandsRes = await fetch(`${V1}/catalog/brands`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const brandsBody = (await brandsRes.json()) as { data?: Array<{ id: string; sellerId?: string; name?: string }> };
  const ownBrand = (brandsBody.data || []).find((b) => b.sellerId === seller.uid);
  assert(!!ownBrand, 'fresh seller has an auto-provisioned brand to verify', brandsBody.data?.length);
  if (ownBrand) {
    const verifyRes = await fetch(`${V1}/operations/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        entityType: 'brand',
        entityId: ownBrand.id,
        entityName: ownBrand.name || `Event Notif Store ${stamp}`,
        documents: [{ type: 'Trade License', name: 'license.pdf', doc_url: 'https://example.com/license.pdf' }],
      }),
    });
    assert(verifyRes.status === 201, 'ownership/verification claim submits successfully', verifyRes.status);
    const adminNotifsAfterClaim = await listMyNotifications(admin.token);
    const claimNotif = adminNotifsAfterClaim.find((n) => n.title === 'Ownership Claim Submitted' || n.title === 'Creator Verification Submitted');
    assert(!!claimNotif, 'admin receives a real claim/verification notification', adminNotifsAfterClaim.slice(0, 3));
    assert(!!claimNotif?.actionUrl?.startsWith('/upe/'), 'claim notification actionUrl points at the live Universal Profile route, not a legacy layout', claimNotif);
  }

  // --- Feature request submission notifies admins ---
  const featureRes = await fetch(`${V1}/entitlements/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ featureKey: 'adsDeals', message: 'event notification probe' }),
  });
  assert(featureRes.status === 201, 'feature request submits successfully', featureRes.status);
  const adminNotifsAfterFeature = await listMyNotifications(admin.token);
  const featureNotif = adminNotifsAfterFeature.find((n) => n.title === 'Feature Request Awaiting Review');
  assert(!!featureNotif, 'admin receives a real feature-request notification', adminNotifsAfterFeature.slice(0, 3));
  assert(featureNotif?.actionUrl === '/admin/feature-access', 'feature request notification actionUrl points at a live current route', featureNotif);

  console.log('\n=== EVENT NOTIFICATIONS SUMMARY ===');
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
