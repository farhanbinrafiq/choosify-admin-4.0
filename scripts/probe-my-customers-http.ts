const BASE = 'http://localhost:3001/api/v1';
const pass = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

async function login(email: string) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, any>;
  return {
    status: r.status,
    token: String(j.accessToken || j.token || ''),
    role: j.role || j.user?.role,
    body: j,
  };
}

async function get(path: string, token: string) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, any>;
  return { status: r.status, body: j };
}

async function main() {
  const candidates = [
    'seller@choosify.com.bd',
    'rahim@choosify.com.bd',
    'seller1@choosify.com.bd',
    'creator@choosify.com.bd',
    'sumaiya@choosify.com.bd',
  ];
  for (const email of candidates) {
    const res = await login(email);
    console.log('login', email, res.status, res.role, !!res.token);
    if (!res.token) continue;
    if (String(res.role).includes('seller')) {
      const list = await get('/catalog/workspace/seller/customers', res.token);
      const n = Array.isArray(list.body.data) ? list.body.data.length : 'n/a';
      console.log('  seller list', list.status, n);
      const denied = await get('/catalog/workspace/seller/customers/not-a-real-customer', res.token);
      console.log('  seller foreign', denied.status, denied.body.error || denied.body);
      const sample = Array.isArray(list.body.data) && list.body.data[0];
      if (sample) {
        console.log('  sample fields', {
          name: sample.name,
          email: sample.email,
          choosifyUserId: sample.choosifyUserId,
          hasPhone: 'phone' in sample,
          totalSpend: sample.totalSpend,
        });
      }
    }
    if (String(res.role).includes('creator')) {
      const list = await get('/catalog/workspace/creator/customers', res.token);
      const n = Array.isArray(list.body.data) ? list.body.data.length : 'n/a';
      console.log('  creator list', list.status, n);
      const denied = await get('/catalog/workspace/creator/customers/not-a-real-customer', res.token);
      console.log('  creator foreign', denied.status, denied.body.error || denied.body);
      const cross = await get('/catalog/workspace/seller/customers', res.token);
      console.log('  creator->seller endpoint', cross.status, cross.body.error || 'ok');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
