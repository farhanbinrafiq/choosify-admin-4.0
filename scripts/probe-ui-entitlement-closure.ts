/**
 * Browser-closure helper: toggle entitlements + verify API + print tokens for UI checks.
 * Does not weaken rate limits.
 */
const API = 'http://127.0.0.1:3001/api/v1';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SELLER_EMAIL = process.env.PROBE_SELLER_EMAIL || 'seller@choosify.com.bd';
const CREATOR_EMAIL = process.env.PROBE_CREATOR_EMAIL || 'creator@choosify.com.bd';
const PARTNER_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; base?: string } = {},
) {
  const res = await fetch(`${opts.base || API}${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, body };
}

async function login(email: string, password: string) {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} ${r.status} ${JSON.stringify(r.body)}`);
  return String(r.body.accessToken || r.body.customToken || '');
}

async function setEnt(admin: string, role: 'seller' | 'creator', feature: string, enabled: boolean) {
  const r = await req(`/entitlements/admin/role-defaults/${role}/${feature}`, {
    method: 'PATCH',
    token: admin,
    body: { enabled },
  });
  if (r.status !== 200) throw new Error(`setEnt ${role}/${feature}=${enabled} → ${r.status}`);
}

async function main() {
  const cmd = process.argv[2] || 'prep';

  if (cmd === 'tokens') {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    await new Promise((r) => setTimeout(r, 800));
    const seller = await login(SELLER_EMAIL, PARTNER_PASS);
    await new Promise((r) => setTimeout(r, 800));
    const creator = await login(CREATOR_EMAIL, PARTNER_PASS);
    console.log(JSON.stringify({ admin, seller, creator }, null, 2));
    return;
  }

  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);

  if (cmd === 'admin-state') {
    const r = await req('/entitlements/admin', { token: admin });
    console.log(JSON.stringify(r.body.roleDefaults, null, 2));
    return;
  }

  const needSeller = cmd.startsWith('seller-');
  const needCreator = cmd.startsWith('creator-');
  const seller = needSeller ? await login(SELLER_EMAIL, PARTNER_PASS) : '';
  const creator = needCreator ? await login(CREATOR_EMAIL, PARTNER_PASS) : '';

  if (cmd === 'seller-cashbooks-off') {
    const before = await req('/cashbooks', { token: seller });
    console.log('cashbooks before', before.status);
    if (before.status === 200) {
      const create = await req('/cashbooks', {
        method: 'POST',
        token: seller,
        body: { name: `UI-Closure ${Date.now()}` },
      });
      console.log('create', create.status, JSON.stringify(create.body).slice(0, 220));
    }
    await setEnt(admin, 'seller', 'cashbooks', false);
    const denied = await req('/cashbooks', { token: seller });
    const adminOk = await req('/cashbooks', { token: admin });
    const me = await req('/entitlements/me', { token: seller });
    console.log(
      JSON.stringify({
        sellerCashbooksApi: denied.status,
        code: denied.body.code,
        adminCashbooksApi: adminOk.status,
        sellerEntCashbooks: (me.body.entitlements as Json)?.cashbooks,
      }),
    );
    return;
  }

  if (cmd === 'seller-cashbooks-on') {
    await setEnt(admin, 'seller', 'cashbooks', true);
    const list = await req('/cashbooks', { token: seller });
    console.log(JSON.stringify({ status: list.status, preview: JSON.stringify(list.body).slice(0, 600) }));
    return;
  }

  if (cmd === 'seller-ads-off') {
    await setEnt(admin, 'seller', 'adsDeals', false);
    const denied = await req('/ads/deals', { token: seller });
    const me = await req('/entitlements/me', { token: seller });
    console.log(
      JSON.stringify({
        status: denied.status,
        code: denied.body.code,
        adsDeals: (me.body.entitlements as Json)?.adsDeals,
      }),
    );
    return;
  }

  if (cmd === 'seller-ads-on') {
    await setEnt(admin, 'seller', 'adsDeals', true);
    const ok = await req('/ads/deals', { token: seller });
    console.log(JSON.stringify({ status: ok.status, code: ok.body.code }));
    return;
  }

  if (cmd === 'creator-messaging-off') {
    await setEnt(admin, 'creator', 'messaging', false);
    const denied = await req('/conversations', { token: creator });
    const me = await req('/entitlements/me', { token: creator });
    console.log(
      JSON.stringify({
        status: denied.status,
        code: denied.body.code,
        messaging: (me.body.entitlements as Json)?.messaging,
      }),
    );
    return;
  }

  if (cmd === 'creator-messaging-on') {
    await setEnt(admin, 'creator', 'messaging', true);
    const ok = await req('/conversations', { token: creator });
    console.log(JSON.stringify({ status: ok.status }));
    return;
  }

  console.log('commands: tokens|seller-cashbooks-off|on|seller-ads-off|on|creator-messaging-off|on|admin-state');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
