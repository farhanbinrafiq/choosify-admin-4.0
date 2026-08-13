/**
 * Partner review consolidation: pending login, same UID/CF, Requests identity,
 * marketplace lock until grant, identity approve does not mint a new account.
 */
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users } from '../server/db/schema';

const API = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS =
  process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;
const fails: string[] = [];

function soft(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
}

function marketplaceDenied(body: Json) {
  return body.code === 'MARKETPLACE_ACCESS_REQUIRED' || body.code === 'MARKETPLACE_ACCESS_PENDING';
}

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Json; raw: string }> {
  const res = await fetch(`${API}${path}`, {
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
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${r.raw}`);
  return r;
}

async function main() {
  const stamp = Date.now();
  const password = `ReviewPass-${stamp}!`;
  const sellerEmail = `review.seller.${stamp}@test.choosify.bd`;
  const creatorEmail = `review.creator.${stamp}@test.choosify.bd`;
  const storeName = `Review Store ${stamp}`;

  const apply = await req('/auth/partner-apply', {
    body: {
      applicantType: 'seller',
      email: sellerEmail,
      password,
      displayName: 'Review Seller',
      businessOrChannelName: storeName,
      phone: '+8801711222333',
      category: 'Fashion',
      city: 'Dhaka',
    },
  });
  soft(apply.status === 201, `seller apply ${apply.status}`);

  const creatorApply = await req('/auth/partner-apply', {
    body: {
      applicantType: 'creator',
      email: creatorEmail,
      password,
      displayName: 'Review Creator',
      businessOrChannelName: `Review Channel ${stamp}`,
      phone: '+8801711999000',
      category: 'Beauty',
      city: 'Dhaka',
      niche: 'Beauty',
    },
  });
  soft(creatorApply.status === 201, `creator apply ${creatorApply.status}`);

  const pendingLogin = await login(sellerEmail, password);
  soft(pendingLogin.body.role === 'seller', `pending role=${pendingLogin.body.role}`);
  soft(pendingLogin.body.marketplaceAccess === false, 'pending marketplace locked');
  soft(pendingLogin.body.partnerApplicationStatus === 'pending', 'pending application status');
  const pendingToken = String(pendingLogin.body.accessToken || '');
  const pendingUid = String(pendingLogin.body.uid || '');
  const pendingCf = String(pendingLogin.body.choosifyUserId || '');
  soft(/^CF-\d{5,}$/.test(pendingCf), `pending CF ${pendingCf}`);

  const lockedCash = await req('/cashbooks', { method: 'POST', token: pendingToken, body: { name: 'x' } });
  soft(
    lockedCash.status === 403 && marketplaceDenied(lockedCash.body),
    `pending cashbook ${lockedCash.status} ${lockedCash.body.code}`,
  );
  const lockedBrand = await req('/catalog/brands', {
    method: 'POST',
    token: pendingToken,
    body: { name: 'Extra Brand', category: 'Fashion' },
  });
  soft(
    lockedBrand.status === 403 && marketplaceDenied(lockedBrand.body),
    `pending create brand ${lockedBrand.status} ${lockedBrand.body.code}`,
  );
  const meOk = await req('/auth/me', { token: pendingToken });
  soft(meOk.status === 200 && meOk.body.role === 'seller', 'pending /auth/me');

  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = String(admin.body.accessToken || '');
  const list = await req('/operations/partner-applications?status=pending', { token: adminToken });
  const apps = (list.body.applications as Json[]) || [];
  const sellerApp = apps.find((a) => a.email === sellerEmail);
  const creatorApp = apps.find((a) => a.email === creatorEmail);
  soft(Boolean(sellerApp), 'seller in Requests/pending list');
  soft(Boolean(creatorApp), 'creator in pending list');
  soft(String(sellerApp?.provisionedUserId || '') === pendingUid, 'same UID at apply');
  soft(Boolean(sellerApp?.catalogEntityId), 'identity brand created at apply');

  const ownBrandId = String(sellerApp?.catalogEntityId || '');
  if (ownBrandId) {
    const profilePatch = await req(`/catalog/brands/${encodeURIComponent(ownBrandId)}`, {
      method: 'PATCH',
      token: pendingToken,
      body: { overview: { phone: '+8801711222333', email: sellerEmail } },
    });
    soft(profilePatch.status === 200, `pending profile patch ${profilePatch.status}`);
    const selfGrant = await req(`/catalog/brands/${encodeURIComponent(ownBrandId)}/marketplace-access`, {
      method: 'PATCH',
      token: pendingToken,
      body: { status: 'granted' },
    });
    soft(selfGrant.status === 403, `seller self-grant ${selfGrant.status} ${selfGrant.body.code}`);
  }

  const ownApp = await req('/auth/partner-applications/me', { token: pendingToken });
  soft(ownApp.status === 200 && (ownApp.body.application as Json)?.status === 'pending', 'applicant can read own application');
  const prematureResub = await req('/auth/partner-applications/me/resubmit', {
    method: 'POST',
    token: pendingToken,
    body: { note: 'too soon' },
  });
  soft(prematureResub.status === 409, `resubmit without request ${prematureResub.status}`);

  const approve = await req(`/operations/partner-applications/${sellerApp!.id}/approve`, {
    method: 'POST',
    token: adminToken,
    body: { note: 'identity ok' },
  });
  soft(approve.status === 200, `approve ${approve.status}`);
  const afterApprove = await req('/auth/me', { token: pendingToken });
  soft(afterApprove.body.uid === pendingUid, 'approve did not mint a new UID');
  soft(afterApprove.body.choosifyUserId === pendingCf, 'approve did not mint a new CF ID');
  soft(afterApprove.body.identityVerified === true, 'identity verified');
  soft(afterApprove.body.marketplaceAccess === false, 'still locked until marketplace grant');

  const stillLocked = await req('/cashbooks', { method: 'POST', token: pendingToken, body: { name: 'y' } });
  soft(marketplaceDenied(stillLocked.body), 'locked after identity-only approve');

  const grant = await req(
    `/catalog/brands/${encodeURIComponent(String(sellerApp!.catalogEntityId || ''))}/marketplace-access`,
    { method: 'PATCH', token: adminToken, body: { status: 'granted' } },
  );
  soft(grant.status === 200, `grant ${grant.status}`);
  const unlockedMe = await req('/auth/me', { token: pendingToken });
  soft(unlockedMe.body.marketplaceAccess === true, 'marketplace enabled');
  const cash = await req('/cashbooks', { method: 'POST', token: pendingToken, body: { name: `Live ${stamp}` } });
  soft(cash.status === 201 || cash.status === 200, `cashbook after grant ${cash.status}`);

  const creatorLogin = await login(creatorEmail, password);
  soft(creatorLogin.body.role === 'creator', 'pending creator login');
  soft(creatorLogin.body.marketplaceAccess === false, 'pending creator marketplace locked');
  const creatorToken = String(creatorLogin.body.accessToken || '');
  const creatorUid = String(creatorLogin.body.uid || '');
  const creatorCf = String(creatorLogin.body.choosifyUserId || '');
  const creatorCash = await req('/cashbooks', { method: 'POST', token: creatorToken, body: { name: 'c' } });
  soft(creatorCash.status === 403 && marketplaceDenied(creatorCash.body), 'pending creator cashbook locked');
  const creatorEntityId = String(creatorApp?.catalogEntityId || '');
  if (creatorEntityId) {
    const liveAttempt = await req(`/catalog/creators/${encodeURIComponent(creatorEntityId)}`, {
      method: 'PATCH',
      token: creatorToken,
      body: { status: 'live', bio: 'pending bio' },
    });
    const savedStatus = String(((liveAttempt.body.data as Json) || {}).status || '');
    soft(liveAttempt.status === 200 && savedStatus !== 'live', `creator cannot self-publish while pending (${liveAttempt.status} ${savedStatus})`);
  }
  const creatorApprove = await req('/operations/partner-applications/x/approve', {
    method: 'POST',
    token: creatorToken,
    body: {},
  });
  soft(creatorApprove.status === 403, `creator cannot approve ${creatorApprove.status}`);

  const rejectEmail = `review.reject.${stamp}@test.choosify.bd`;
  const rejectApply = await req('/auth/partner-apply', {
    body: {
      applicantType: 'seller',
      email: rejectEmail,
      password,
      displayName: 'Reject Seller',
      businessOrChannelName: `Reject Store ${stamp}`,
      phone: '+8801711000111',
      category: 'Fashion',
      city: 'Dhaka',
    },
  });
  soft(rejectApply.status === 201, `reject-path apply ${rejectApply.status}`);
  const list2 = await req('/operations/partner-applications?status=pending', { token: adminToken });
  const rejectApp = ((list2.body.applications as Json[]) || []).find((a) => a.email === rejectEmail);
  if (rejectApp) {
    const resub = await req(`/operations/partner-applications/${rejectApp.id}/resubmit`, {
      method: 'POST',
      token: adminToken,
      body: { note: 'need docs' },
    });
    soft(resub.status === 200 && (resub.body.application as Json)?.resubmissionRequested === true, `resubmit ${resub.status}`);
    const rejectLogin = await login(rejectEmail, password);
    const rejectToken = String(rejectLogin.body.accessToken || '');
    const applicantResub = await req('/auth/partner-applications/me/resubmit', {
      method: 'POST',
      token: rejectToken,
      body: { note: 'docs updated' },
    });
    soft(applicantResub.status === 200 && (applicantResub.body.application as Json)?.resubmissionRequested === false, `applicant resubmit ${applicantResub.status}`);
    const rej = await req(`/operations/partner-applications/${rejectApp.id}/reject`, {
      method: 'POST',
      token: adminToken,
      body: { note: 'incomplete' },
    });
    soft(rej.status === 200 && (rej.body.application as Json)?.status === 'rejected', `reject ${rej.status}`);
    const rejectedLogin = await login(rejectEmail, password);
    soft(rejectedLogin.body.marketplaceAccess === false, 'rejected seller still locked');
  } else {
    fails.push('reject-path seller missing from pending list');
  }

  const seeded = await login('seller@choosify.com.bd', ADMIN_PASS).catch(() => null);
  if (seeded) {
    soft(seeded.body.marketplaceAccess !== false, 'grandfathered/approved seller remains unlocked');
  }

  const row = (await db.select().from(users).where(eq(users.email, sellerEmail)).limit(1))[0];
  soft(row?.id === pendingUid, 'single users row');
  const creatorRow = (await db.select().from(users).where(eq(users.email, creatorEmail)).limit(1))[0];
  soft(creatorRow?.id === creatorUid, 'creator UID preserved');
  soft(creatorRow?.choosifyUserId === creatorCf, 'creator CF preserved');

  if (fails.length) {
    console.error('FAILS\n' + fails.map((f) => `- ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('probe-partner-review-profile PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
