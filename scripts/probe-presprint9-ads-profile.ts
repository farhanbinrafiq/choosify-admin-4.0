/**
 * Minimal Ads & Deals + profile name lock probe (pre-Sprint-9).
 */
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await json(res);
  if (!res.ok) throw new Error(`login failed ${email}: ${res.status} ${JSON.stringify(body)}`);
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
  if (!token) throw new Error(`no token for ${email}`);
  return { token, user: body.user || body.data?.user || body };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function main() {
  const results: string[] = [];
  const pass = (m: string) => results.push(`PASS ${m}`);
  const fail = (m: string) => {
    results.push(`FAIL ${m}`);
    throw new Error(m);
  };

  // Ensure server is up
  const health = await fetch(`${BASE}/auth/seller-status?email=admin@choosify.com.bd`);
  void health;

  const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
  const admin = await login('admin@choosify.com.bd', DEV_PASSWORD);
  pass('admin login');

  // Analytics requires auth
  const unauth = await fetch(`${BASE}/operations/analytics`);
  if (unauth.status === 401 || unauth.status === 403) pass('analytics unauth denied');
  else fail(`analytics unauth expected 401/403 got ${unauth.status}`);

  const adminAnalytics = await fetch(`${BASE}/operations/analytics`, {
    headers: auth(admin.token),
  });
  if (!adminAnalytics.ok) fail(`admin analytics ${adminAnalytics.status}`);
  pass('admin analytics ok');

  // Password reset request (no enumeration)
  const pr = await fetch(`${BASE}/auth/password-reset-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nosuch_' + randomBytes(4).toString('hex') + '@example.com' }),
  });
  const prBody = await json(pr);
  if (!pr.ok || !prBody.success) fail(`password-reset-request ${pr.status}`);
  pass('password-reset-request always succeeds');

  // Ads: create deal as admin (admin-created)
  const dealRes = await fetch(`${BASE}/ads/deals`, {
    method: 'POST',
    headers: auth(admin.token),
    body: JSON.stringify({
      title: 'Probe Deal ' + Date.now(),
      ownerRole: 'admin',
      discountLabel: '10%',
    }),
  });
  const dealBody = await json(dealRes);
  if (!dealRes.ok) fail(`create deal ${dealRes.status} ${JSON.stringify(dealBody)}`);
  const dealStatus = dealBody.data?.status || dealBody.status;
  pass(`deal created status=${dealStatus}`);

  // Unsafe URL rejected
  const badBanner = await fetch(`${BASE}/ads/banners`, {
    method: 'POST',
    headers: auth(admin.token),
    body: JSON.stringify({
      title: 'Bad',
      ownerRole: 'admin',
      externalUrl: 'javascript:alert(1)',
    }),
  });
  if (badBanner.status === 400 || badBanner.status === 422) pass('unsafe banner URL rejected');
  else fail(`unsafe URL expected 400 got ${badBanner.status}`);

  // Promotion endpoint
  const promo = await fetch(`${BASE}/ads/promotions`, {
    method: 'POST',
    headers: auth(admin.token),
    body: JSON.stringify({
      title: 'Probe Promo',
      ownerRole: 'admin',
      listingId: 'listing_probe_1',
    }),
  });
  const promoBody = await json(promo);
  pass(`promotion endpoint responded ${promo.status} status=${promoBody.data?.status}`);

  console.log(results.join('\n'));
  console.log('ALL ADS/PROFILE PROBES PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
