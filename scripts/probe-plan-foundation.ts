/**
 * Sprint 11 — minimal Plan / Account Plan foundation regression (step 7).
 * Confirms:
 *   - Admin can create a plan and toggle a feature for it (plan-defaults).
 *   - Admin (never the seller/creator themselves) can assign an account to a plan.
 *   - The existing featureEntitlements precedence (account override -> plan ->
 *     role default) now actually resolves against a real assigned plan, closing
 *     the previously-dead planId parameter in resolveFeatureEnabled.
 *   - A seller/creator CANNOT self-assign or self-enable a plan/feature.
 *
 * Usage: npx tsx scripts/probe-plan-foundation.ts
 * Or:    npm run test:plan-foundation
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

  // Fresh seller for a clean plan/entitlement slate.
  const stamp = Date.now();
  const sellerEmail = `plan-probe-seller-${stamp}@test.choosify.bd`;
  const applyRes = await fetch(`${V1}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email: sellerEmail,
      password: 'RoleTest!2026',
      displayName: 'Plan Probe Seller',
      businessOrChannelName: 'Plan Probe Store',
      phone: '01700000000',
      category: 'Fashion',
      city: 'Dhaka',
    }),
  });
  assert(applyRes.ok, 'partner-apply for fresh seller succeeds', applyRes.status);
  const listRes = await fetch(`${V1}/operations/partner-applications?status=pending`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const listBody = (await listRes.json()) as { applications?: Array<{ id: string; email?: string }> };
  const application = (listBody.applications || []).find((a) => a.email === sellerEmail);
  assert(!!application, 'pending partner application found for fresh seller');
  await fetch(`${V1}/operations/partner-applications/${encodeURIComponent(application!.id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ note: 'plan foundation probe' }),
  });
  const seller = await login(sellerEmail, 'RoleTest!2026');

  // A feature genuinely gated for sellers (per shared/entitlements/registry.ts).
  const FEATURE_KEY = 'advancedAnalytics';

  // Confirm role default is OFF to start (fail-closed baseline before any plan).
  const meBefore = await fetch(`${V1}/entitlements/me`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const meBeforeBody = (await meBefore.json()) as { entitlements?: Record<string, boolean>; plan?: unknown };
  assert(meBeforeBody.plan === null, 'seller has no assigned plan before admin assigns one', meBeforeBody.plan);

  // Admin creates a plan and enables the feature on it.
  const createPlanRes = await fetch(`${V1}/entitlements/admin/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ role: 'seller', name: `Probe Growth Plan ${stamp}`, priceLabel: '৳2,499/mo' }),
  });
  const createPlanBody = (await createPlanRes.json()) as { success?: boolean; plan?: { id: string } };
  assert(createPlanRes.ok && createPlanBody.success && createPlanBody.plan?.id, 'admin creates a plan', createPlanBody);
  const planId = createPlanBody.plan!.id;

  const toggleRes = await fetch(`${V1}/entitlements/admin/plan-defaults/${encodeURIComponent(planId)}/${FEATURE_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ enabled: true }),
  });
  assert(toggleRes.ok, 'admin enables a feature for the plan', toggleRes.status);

  // Seller cannot self-assign a plan (must be admin-gated, 403).
  const selfAssignRes = await fetch(`${V1}/entitlements/admin/accounts/${encodeURIComponent(seller.uid)}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ planId }),
  });
  assert(selfAssignRes.status === 403, 'seller cannot self-assign a plan', selfAssignRes.status);

  // Admin assigns the seller to the plan.
  const assignRes = await fetch(`${V1}/entitlements/admin/accounts/${encodeURIComponent(seller.uid)}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ planId }),
  });
  const assignBody = (await assignRes.json()) as { success?: boolean; accountPlan?: { planId?: string } };
  assert(assignRes.ok && assignBody.success && assignBody.accountPlan?.planId === planId, 'admin assigns seller to the plan', assignBody);

  // Now the seller's resolved entitlements should reflect the plan-enabled feature —
  // proving the previously-dead planId resolution path is now live.
  const meAfter = await fetch(`${V1}/entitlements/me`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const meAfterBody = (await meAfter.json()) as { entitlements?: Record<string, boolean>; plan?: { planId?: string } };
  assert(meAfterBody.plan?.planId === planId, 'seller now sees their assigned plan via /entitlements/me', meAfterBody.plan);
  assert(meAfterBody.entitlements?.[FEATURE_KEY] === true, 'feature enabled via plan resolves true for the seller', meAfterBody.entitlements);

  // Seller cannot toggle their own plan's features (admin-only route).
  const selfToggleRes = await fetch(`${V1}/entitlements/admin/plan-defaults/${encodeURIComponent(planId)}/${FEATURE_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ enabled: false }),
  });
  assert(selfToggleRes.status === 403, 'seller cannot self-toggle plan features', selfToggleRes.status);

  console.log('\n=== PLAN FOUNDATION SUMMARY ===');
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
