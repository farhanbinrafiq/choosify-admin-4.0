/**
 * Role-scoped nav attention counters: partner 3/2 split, live decrement,
 * refresh persistence, and RBAC isolation.
 */

function formatNavAttentionCount(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

const API = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS =
  process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;
const fails: string[] = [];

function soft(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
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

function countsOf(body: Json): Record<string, { count: number; label?: string }> {
  return (body.counts as Record<string, { count: number; label?: string }>) || {};
}

async function main() {
  soft(formatNavAttentionCount(0) === '0', 'format 0');
  soft(formatNavAttentionCount(4) === '4', 'format 4');
  soft(formatNavAttentionCount(99) === '99', 'format 99');
  soft(formatNavAttentionCount(100) === '99+', 'format 99+');
  soft(formatNavAttentionCount(250) === '99+', 'format 250');

  const stamp = Date.now();
  const password = `NavAttn-${stamp}!`;
  const sellerApps: string[] = [];
  const creatorApps: string[] = [];

  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = String(admin.body.accessToken || '');
  const baseline = countsOf((await req('/dashboard/nav-attention', { token: adminToken })).body);
  const baseBrands = baseline.brands?.count || 0;
  const baseCreators = baseline.creators?.count || 0;

  for (let i = 0; i < 3; i++) {
    const email = `nav.seller.${stamp}.${i}@test.choosify.bd`;
    const r = await req('/auth/partner-apply', {
      body: {
        applicantType: 'seller',
        email,
        password,
        displayName: `Nav Seller ${i}`,
        businessOrChannelName: `Nav Store ${stamp} ${i}`,
        phone: '+8801711000001',
        category: 'Fashion',
        city: 'Dhaka',
      },
    });
    soft(r.status === 201, `seller apply ${i} ${r.status}`);
  }
  for (let i = 0; i < 2; i++) {
    const email = `nav.creator.${stamp}.${i}@test.choosify.bd`;
    const r = await req('/auth/partner-apply', {
      body: {
        applicantType: 'creator',
        email,
        password,
        displayName: `Nav Creator ${i}`,
        businessOrChannelName: `Nav Channel ${stamp} ${i}`,
        phone: '+8801711000002',
        category: 'Beauty',
        city: 'Dhaka',
        niche: 'Beauty',
      },
    });
    soft(r.status === 201, `creator apply ${i} ${r.status}`);
  }

  const list = await req('/operations/partner-applications?status=pending', { token: adminToken });
  const apps = ((list.body.applications as Json[]) || []).filter(
    (a) => String(a.email || '').includes(`nav.seller.${stamp}`) || String(a.email || '').includes(`nav.creator.${stamp}`),
  );
  for (const a of apps) {
    if (a.applicantType === 'seller') sellerApps.push(String(a.id));
    if (a.applicantType === 'creator') creatorApps.push(String(a.id));
  }
  soft(sellerApps.length === 3, `pending seller apps ${sellerApps.length}`);
  soft(creatorApps.length === 2, `pending creator apps ${creatorApps.length}`);

  const before = await req('/dashboard/nav-attention', { token: adminToken });
  soft(before.status === 200, `admin attention ${before.status}`);
  const beforeCounts = countsOf(before.body);
  soft(
    beforeCounts.brands?.count === baseBrands + 3,
    `admin brands count=${beforeCounts.brands?.count} want ${baseBrands + 3}`,
  );
  soft(
    beforeCounts.creators?.count === baseCreators + 2,
    `admin creators count=${beforeCounts.creators?.count} want ${baseCreators + 2}`,
  );
  if (beforeCounts.orders && beforeCounts.orders.count === 0) {
    fails.push('admin orders present at 0 — zeros must be omitted');
  }

  const approve = await req(`/operations/partner-applications/${sellerApps[0]}/approve`, {
    method: 'POST',
    token: adminToken,
    body: { note: 'nav attention' },
  });
  soft(approve.status === 200, `approve ${approve.status}`);

  const after = await req('/dashboard/nav-attention', { token: adminToken });
  const afterCounts = countsOf(after.body);
  soft(
    afterCounts.brands?.count === baseBrands + 2,
    `after approve brands=${afterCounts.brands?.count} want ${baseBrands + 2}`,
  );
  soft(
    afterCounts.creators?.count === baseCreators + 2,
    `after approve creators=${afterCounts.creators?.count} want ${baseCreators + 2}`,
  );

  const refresh = await req('/dashboard/nav-attention', { token: adminToken });
  soft(countsOf(refresh.body).brands?.count === baseBrands + 2, 'refresh persistence');

  const sellerLogin = await login(`nav.seller.${stamp}.0@test.choosify.bd`, password);
  const sellerToken = String(sellerLogin.body.accessToken || '');
  const sellerAttn = await req('/dashboard/nav-attention', { token: sellerToken });
  soft(sellerAttn.status === 200, `seller attention ${sellerAttn.status}`);
  const sellerCounts = countsOf(sellerAttn.body);
  soft(sellerCounts.brands == null, 'seller must not see platform Seller application count');
  soft(sellerCounts.creators == null, 'seller must not see Creator application count');
  soft(sellerCounts.moderationCenter == null, 'seller must not see moderation queue');

  const creatorLogin = await login(`nav.creator.${stamp}.0@test.choosify.bd`, password);
  const creatorToken = String(creatorLogin.body.accessToken || '');
  const creatorAttn = await req('/dashboard/nav-attention', { token: creatorToken });
  const creatorCounts = countsOf(creatorAttn.body);
  soft(creatorCounts.brands == null, 'creator must not see Seller application count');
  soft(creatorCounts.creators == null, 'creator must not see platform Creator application count');

  const anon = await req('/dashboard/nav-attention');
  soft(anon.status === 401, `unauth attention ${anon.status}`);

  if (fails.length) {
    console.error('FAILS\n' + fails.map((f) => `- ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('probe-nav-attention PASSED');
  console.log(
    JSON.stringify(
      {
        adminBefore: { brands: beforeCounts.brands?.count, creators: beforeCounts.creators?.count },
        adminAfterApprove: { brands: afterCounts.brands?.count, creators: afterCounts.creators?.count },
        sellerKeys: Object.keys(sellerCounts),
        creatorKeys: Object.keys(creatorCounts),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
