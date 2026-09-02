/**
 * One-off dev-data op: grant Marketplace Access to the seed partner accounts.
 * Staff roles already have unconditional access (resolvePartnerLifecycle),
 * so only seller@ / creator@ have anything to change.
 *
 * Usage: npx tsx scripts/grant-marketplace-access.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS = 'ChoosifyDev!2026';

const STAFF = [
  'admin@choosify.com.bd',
  'finance@choosify.com.bd',
  'support@choosify.com.bd',
  'marketing@choosify.com.bd',
  'moderator@choosify.com.bd',
];

async function j(r: Response) {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
async function login(email: string) {
  const b = await j(
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASS }),
    }),
  );
  return { token: b.accessToken || b.token || b.data?.accessToken || '', uid: b.uid || b.data?.uid || '' };
}
async function get(path: string, token: string) {
  return j(await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }));
}
async function patch(path: string, token: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await j(r) };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  if (!admin.token) throw new Error('admin login failed');

  for (const email of STAFF) {
    console.log(`STAFF  ${email.padEnd(28)} → not a partner role; Marketplace Access is already unconditional (no-op).`);
  }

  // ── seller@ ─────────────────────────────────────────────────────────
  const seller = await login('seller@choosify.com.bd');
  const brandsBody = await get('/catalog/brands', admin.token);
  const brands: Array<{ id: string; name: string; sellerId?: string; marketplaceStatus?: string }> =
    brandsBody.data || [];
  const sellerBrands = brands.filter((b) => b.sellerId === seller.uid);
  if (sellerBrands.length === 0) {
    console.log(`SELLER seller@choosify.com.bd     → no brand owned by this seller (uid ${seller.uid}); cannot grant.`);
  }
  for (const b of sellerBrands) {
    const res = await patch(`/catalog/brands/${b.id}/marketplace-access`, admin.token, { status: 'granted' });
    console.log(
      `SELLER brand "${b.name}" (${b.id}) → PATCH marketplace-access {granted}: ${res.status} ` +
        `(now marketplaceStatus=${res.body?.data?.marketplaceStatus ?? '?'})`,
    );
  }

  // ── creator@ ────────────────────────────────────────────────────────
  const creator = await login('creator@choosify.com.bd');
  const creatorsBody = await get('/catalog/creators', admin.token);
  const creators: Array<{ id: string; name?: string; displayName?: string; userId?: string; status?: string }> =
    creatorsBody.data || [];
  const mine = creators.filter((c) => c.userId === creator.uid);
  if (mine.length === 0) {
    console.log(`CREATOR creator@choosify.com.bd    → no creator profile for uid ${creator.uid}; cannot grant.`);
  }
  for (const c of mine) {
    const res = await patch(`/catalog/creators/${c.id}`, admin.token, { status: 'live' });
    console.log(
      `CREATOR "${c.displayName || c.name || c.id}" (${c.id}) → PATCH {status:live}: ${res.status} ` +
        `(now status=${res.body?.data?.status ?? '?'})`,
    );
  }

  // ── verify via each account's own profile facts ─────────────────────
  console.log('\n── verification (GET /auth/me marketplaceAccess) ──');
  for (const email of ['seller@choosify.com.bd', 'creator@choosify.com.bd']) {
    const { token } = await login(email);
    const me = await get('/auth/me', token);
    const ma = me?.marketplaceAccess ?? me?.data?.marketplaceAccess ?? me?.profile?.marketplaceAccess;
    console.log(`  ${email.padEnd(28)} marketplaceAccess=${ma}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
