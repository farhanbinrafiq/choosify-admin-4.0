/**
 * STRICT pre-commit gate (rate-limit aware: auth max≈20/15m).
 * Restart API before running. Do not weaken rate limits.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { featureEntitlements, partnerApplications } from '../server/db/schema';
import { resolveFeatureEnabled } from '../server/entitlements/entitlementStore';
import { PARTNER_FEATURES } from '../shared/entitlements/registry';

const API = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS =
  process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

/** Sprint 10: entitlements/applications are now authoritative in PostgreSQL — this
 * probe seeds/reads rows directly instead of the removed in-memory hydrate()/JSON
 * snapshot file. */
async function setEntitlementRow(scope: 'role' | 'plan' | 'account', scopeKey: string, featureKey: string, enabled: boolean) {
  await db
    .insert(featureEntitlements)
    .values({ scope, scopeKey, featureKey, enabled })
    .onConflictDoUpdate({
      target: [featureEntitlements.scope, featureEntitlements.scopeKey, featureEntitlements.featureKey],
      set: { enabled, updatedAt: new Date() },
    });
}
async function clearEntitlementRow(scope: 'role' | 'plan' | 'account', scopeKey: string, featureKey: string) {
  await db
    .delete(featureEntitlements)
    .where(and(eq(featureEntitlements.scope, scope), eq(featureEntitlements.scopeKey, scopeKey), eq(featureEntitlements.featureKey, featureKey)));
}

type Json = Record<string, unknown>;
const fails: string[] = [];
const notes: string[] = [];

function soft(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fails.push(msg);
    throw new Error(msg);
  }
}

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; base?: string } = {},
): Promise<{ status: number; body: Json; raw: string }> {
  const res = await fetch(`${opts.base || API}${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let body: Json = {};
  try {
    body = JSON.parse(raw) as Json;
  } catch {
    body = { raw };
  }
  return { status: res.status, body, raw };
}

async function login(email: string, password: string) {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } });
  assert(r.status === 200, `login ${email} → ${r.status} ${r.raw}`);
  const token = String(r.body.customToken || r.body.accessToken || '');
  assert(token, `no token ${email}`);
  return token;
}

async function snap() {
  const applications = await db.select().from(partnerApplications);
  return { applications };
}

async function main() {
  const stamp = Date.now();
  const password = `GatePass-${stamp}!`;

  console.log('=== A0 precedence unit ===');
  {
    const uid = `u_${stamp}`;
    await setEntitlementRow('role', 'seller', 'cashbooks', true);
    await setEntitlementRow('plan', 'plan_basic', 'cashbooks', false);
    await setEntitlementRow('plan', 'plan_pro', 'cashbooks', true);
    await setEntitlementRow('account', uid, 'cashbooks', false);
    soft(
      (await resolveFeatureEnabled({ role: 'seller', featureKey: 'cashbooks', planId: 'plan_basic' })) === false,
      'role=true plan=false → false',
    );

    await setEntitlementRow('role', 'seller', 'cashbooks', false);
    await clearEntitlementRow('account', uid, 'cashbooks');
    soft(
      (await resolveFeatureEnabled({ role: 'seller', featureKey: 'cashbooks', planId: 'plan_pro' })) === true,
      'role=false plan=true → true',
    );

    await setEntitlementRow('role', 'seller', 'cashbooks', true);
    await setEntitlementRow('account', uid, 'cashbooks', false);
    soft(
      (await resolveFeatureEnabled({
        role: 'seller',
        featureKey: 'cashbooks',
        planId: 'plan_pro',
        userId: uid,
      })) === false,
      'account=false wins',
    );

    // Reset back to catalog default (true) so this probe's writes don't linger for other roles/tests.
    await setEntitlementRow('role', 'seller', 'cashbooks', true);
    await clearEntitlementRow('account', uid, 'cashbooks');
    await clearEntitlementRow('plan', 'plan_basic', 'cashbooks');
    await clearEntitlementRow('plan', 'plan_pro', 'cashbooks');
  }

  // Auth-strict budget (~12): 1 privilege apply + 1 pwd apply + 1 dup apply + 1 dup2 + 1 seller + 1 creator
  // + seller-register + upgrade + admin login + seller login + creator login = 11

  console.log('=== B privilege field ===');
  {
    const r = await req('/auth/partner-apply', {
      body: {
        applicantType: 'seller',
        email: `priv.${stamp}@test.choosify.bd`,
        password,
        displayName: 'X',
        businessOrChannelName: 'X',
        phone: '+8801711000000',
        category: 'Fashion',
        city: 'Dhaka',
        role: 'admin',
        accessGranted: true,
        status: 'approved',
      },
    });
    soft(r.status === 400 && r.body.code === 'PRIVILEGE_FIELD_REJECTED', `privilege → ${r.status} ${r.body.code}`);
  }

  console.log('=== A password audit ===');
  const sellerEmail = `gate.seller.${stamp}@test.choosify.bd`;
  const creatorEmail = `gate.creator.${stamp}@test.choosify.bd`;
  {
    const apply = await req('/auth/partner-apply', {
      body: {
        applicantType: 'seller',
        email: sellerEmail,
        password,
        displayName: 'Gate Seller',
        businessOrChannelName: 'Seller Co',
        phone: '+8801711222333',
        category: 'Fashion',
        city: 'Dhaka',
      },
    });
    assert(apply.status === 201, `seller apply ${apply.status} ${apply.raw}`);
    soft(apply.body.accessGranted === false, 'accessGranted false');
    soft(!apply.raw.includes(password), 'apply leaked plaintext');
    soft(!('passwordHash' in apply.body), 'apply leaked hash');
    await new Promise((r) => setTimeout(r, 600));
    // Sprint 10: check the authoritative PostgreSQL row directly instead of a JSON snapshot file.
    const { applications } = await snap();
    const rawRow = JSON.stringify(applications.find((a) => (a as { email?: string }).email === sellerEmail) || {});
    soft(!rawRow.includes(password), 'DATABASE PLAINTEXT PASSWORD BLOCKER');
    // Provision-at-apply clears the application hash; argon2 must not linger on the row.
    soft(!rawRow.includes('$argon2'), 'application row retained argon2 after account provision');
    notes.push(`db-row plaintext=${rawRow.includes(password)} argon2=${rawRow.includes('$argon2')}`);
  }

  console.log('=== D duplicates ===');
  {
    const dup = await req('/auth/partner-apply', {
      body: {
        applicantType: 'creator',
        email: sellerEmail,
        password,
        displayName: 'X',
        businessOrChannelName: 'X',
        phone: '+8801711222333',
        category: 'Fashion',
        city: 'Dhaka',
        niche: 'x',
      },
    });
    soft(
      dup.status === 409 && (dup.body.code === 'APPLICATION_PENDING' || dup.body.code === 'PARTNER_EXISTS'),
      `dup pending → ${dup.status} ${dup.body.code}`,
    );

    const adminEmailApply = await req('/auth/partner-apply', {
      body: {
        applicantType: 'seller',
        email: ADMIN_EMAIL,
        password,
        displayName: 'X',
        businessOrChannelName: 'X',
        phone: '+8801711222333',
        category: 'Fashion',
        city: 'Dhaka',
      },
    });
    soft(
      adminEmailApply.status === 409 && adminEmailApply.body.code === 'EMAIL_IN_USE',
      `admin email → ${adminEmailApply.status} ${adminEmailApply.body.code}`,
    );
  }

  console.log('=== creator apply ===');
  {
    const apply = await req('/auth/partner-apply', {
      body: {
        applicantType: 'creator',
        email: creatorEmail,
        password,
        displayName: 'Gate Creator',
        businessOrChannelName: 'Creator Ch',
        phone: '+8801711999000',
        category: 'Beauty',
        city: 'Dhaka',
        niche: 'Beauty',
      },
    });
    assert(apply.status === 201, `creator apply ${apply.status} ${apply.raw}`);
  }

  console.log('=== E legacy bypass ===');
  {
    const sr = await req('/auth/seller-register', {
      body: {
        email: `legacy.${stamp}@test.choosify.bd`,
        password,
        displayName: 'L',
        storeName: 'L',
        phone: '+8801711000001',
        category: 'Fashion',
        city: 'Dhaka',
      },
    });
    soft(sr.status === 403 && sr.body.code === 'PARTNER_APPLICATION_REQUIRED', `seller-register ${sr.status}`);
    const up = await req('/auth/upgrade-to-seller', {
      method: 'POST',
      body: { storeName: 'X', phone: '+8801711000001', category: 'Fashion', city: 'Dhaka' },
    });
    soft(up.status === 403 && up.body.code === 'PARTNER_APPLICATION_REQUIRED', `upgrade ${up.status}`);
  }

  console.log('=== admin authz + approve + login ===');
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASS);
  let sellerApp: Json | undefined;
  let creatorApp: Json | undefined;
  {
    const unauth = await req('/operations/partner-applications');
    soft(unauth.status === 401, `unauth ${unauth.status}`);

    const list = await req('/operations/partner-applications?status=pending', { token: adminToken });
    assert(list.status === 200, 'list pending');
    const apps = (list.body.applications as Json[]) || [];
    sellerApp = apps.find((a) => a.email === sellerEmail);
    creatorApp = apps.find((a) => a.email === creatorEmail);
    assert(sellerApp && creatorApp, 'pending seller+creator missing');
    soft(!('passwordHash' in sellerApp!), 'admin UI/API hash leak');
    soft(!('password' in sellerApp!), 'admin password leak');

    const pendingSellerLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: sellerEmail, password },
    });
    soft(pendingSellerLogin.status === 200, `pending seller login ${pendingSellerLogin.status}`);
    soft(pendingSellerLogin.body.role === 'seller', `pending seller role=${pendingSellerLogin.body.role}`);
    soft(pendingSellerLogin.body.marketplaceAccess === false, 'pending seller marketplace locked');
    notes.push('pending seller login OK before identity approve');

    for (const app of [sellerApp!, creatorApp!]) {
      const appr = await req(`/operations/partner-applications/${app.id}/approve`, {
        method: 'POST',
        token: adminToken,
        body: { note: 'gate' },
      });
      soft(appr.status === 200, `approve ${app.email} → ${appr.status}`);
      soft(!appr.raw.includes(password), 'approve leaked plaintext');
    }

    // seller cannot approve
    // (login seller after provision)
  }

  const sellerToken = await login(sellerEmail, password);
  const creatorToken = await login(creatorEmail, password);
  notes.push('approved seller+creator login OK (argon2 hash provisioned)');

  {
    const grantedSeller = await req(
      `/catalog/brands/${encodeURIComponent(String(sellerApp!.catalogEntityId || ''))}/marketplace-access`,
      { method: 'PATCH', token: adminToken, body: { status: 'granted' } },
    );
    soft(grantedSeller.status === 200, `grant seller marketplace ${grantedSeller.status}`);
    if (creatorApp?.catalogEntityId) {
      await req(`/catalog/creators/${encodeURIComponent(String(creatorApp.catalogEntityId))}`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'live', verifiedStatus: true },
      });
    }
  }

  {
    const meS = await req('/auth/me', { token: sellerToken });
    const meC = await req('/auth/me', { token: creatorToken });
    soft(meS.body.role === 'seller', `seller role=${meS.body.role}`);
    soft(meC.body.role === 'creator', `creator role=${meC.body.role}`);
    soft(Boolean(meS.body.choosifyUserId), 'seller CF');
    soft(Boolean(meC.body.choosifyUserId), 'creator CF');

    const sellerApprove = await req('/operations/partner-applications/x/approve', {
      method: 'POST',
      token: sellerToken,
      body: {},
    });
    soft(sellerApprove.status === 403, `seller approve ${sellerApprove.status}`);

    const again = await req('/auth/partner-apply', {
      body: {
        applicantType: 'creator',
        email: sellerEmail,
        password,
        displayName: 'X',
        businessOrChannelName: 'X',
        phone: '+8801711222333',
        category: 'Fashion',
        city: 'Dhaka',
        niche: 'x',
      },
    });
    soft(again.status === 409 && again.body.code === 'PARTNER_EXISTS', `partner exists ${again.status}`);
  }

  console.log('=== API enforcement samples ===');
  const samples = [
    { role: 'seller' as const, feature: 'cashbooks', path: '/cashbooks', token: sellerToken },
    { role: 'seller' as const, feature: 'adsDeals', path: '/ads/deals', token: sellerToken },
    {
      role: 'seller' as const,
      feature: 'products',
      path: '/catalog/products',
      method: 'POST',
      token: sellerToken,
    },
    { role: 'creator' as const, feature: 'messaging', path: '/conversations', token: creatorToken },
    {
      role: 'creator' as const,
      feature: 'notifications',
      path: '/notifications',
      token: creatorToken,
      base: 'http://127.0.0.1:3001/api',
    },
  ];
  for (const s of samples) {
    await req(`/entitlements/admin/role-defaults/${s.role}/${s.feature}`, {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    const denied = await req(s.path, {
      method: s.method || 'GET',
      token: s.token,
      base: s.base,
      body: s.method === 'POST' ? { name: 'x' } : undefined,
    });
    soft(
      denied.status === 403 && denied.body.code === 'FEATURE_ENTITLEMENT_DENIED',
      `${s.role}/${s.feature} → ${denied.status} ${denied.body.code}`,
    );
    await req(`/entitlements/admin/role-defaults/${s.role}/${s.feature}`, {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: true },
    });
  }

  console.log('=== cashbook preserve ===');
  {
    const create = await req('/cashbooks', {
      method: 'POST',
      token: sellerToken,
      body: { name: `Preserve ${stamp}` },
    });
    soft(create.status === 201 || create.status === 200, `create ${create.status}`);
    const bookId = String((create.body.data as { id?: string } | undefined)?.id || '');
    await req('/entitlements/admin/role-defaults/seller/cashbooks', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    soft((await req('/cashbooks', { token: sellerToken })).status === 403, 'seller denied');
    soft((await req('/cashbooks', { token: adminToken })).status === 200, 'admin ok');
    await req('/entitlements/admin/role-defaults/seller/cashbooks', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: true },
    });
    const list = await req('/cashbooks', { token: sellerToken });
    soft(list.status === 200 && list.raw.includes(bookId), 'restored');
  }

  console.log('=== persistence ===');
  {
    await req('/entitlements/admin/role-defaults/seller/promoCodes', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: false },
    });
    // Sprint 10: verify the write landed in the authoritative PostgreSQL row directly —
    // a stronger check than the old JSON-snapshot text match, since this proves the
    // real durable store, not just a periodic disk mirror.
    const rows = await db
      .select()
      .from(featureEntitlements)
      .where(and(eq(featureEntitlements.scope, 'role'), eq(featureEntitlements.scopeKey, 'seller'), eq(featureEntitlements.featureKey, 'promoCodes')));
    soft(rows.length === 1 && rows[0].enabled === false, 'persist');
    await req('/entitlements/admin/role-defaults/seller/promoCodes', {
      method: 'PATCH',
      token: adminToken,
      body: { enabled: true },
    });
  }

  console.log('\n=== COVERAGE MATRIX ===');
  // Honest classification: logistics / advancedAnalytics have nav/route prefixes but
  // lack sufficiently broad partner API surfaces for three-layer FULL enforcement.
  const PARTIAL_FEATURES = new Set(['logistics', 'advancedAnalytics']);
  for (const f of PARTNER_FEATURES) {
    const hasApi = f.apiPrefixes.length > 0;
    const cls = PARTIAL_FEATURES.has(f.key)
      ? 'PARTIAL'
      : !hasApi
        ? 'UI/ROUTE-ONLY'
        : f.apiMethods?.length
          ? 'FULLY_ENFORCED(mut)'
          : 'FULLY_ENFORCED';
    console.log(
      `${f.key.padEnd(22)} ${cls.padEnd(18)} pages=${f.pageKeys.join('|') || '-'} api=${f.apiPrefixes.join('|') || '-'}`,
    );
  }
  soft(
    PARTIAL_FEATURES.has('logistics') && PARTIAL_FEATURES.has('advancedAnalytics'),
    'logistics + advancedAnalytics remain PARTIAL',
  );

  console.log('\nNOTES');
  for (const n of notes) console.log('-', n);

  if (fails.length) {
    console.error('\nFAILS');
    for (const f of fails) console.error('-', f);
    console.error(`\nGATE RESULT: NOT READY (${fails.length})`);
    process.exit(1);
  }
  console.log('\nGATE RESULT: SECURITY/API PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
