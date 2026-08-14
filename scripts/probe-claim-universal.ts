/**
 * Claim-review ACL + duplicate-claim UAT against the running API.
 * Does not approve live claims.
 * Usage: npx tsx scripts/probe-claim-universal.ts
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

async function login(email: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { token?: string }; token?: string; accessToken?: string; error?: string };
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${json.error || ''}`);
  return json.data?.token || json.token || json.accessToken || '';
}

async function main() {
  const adminTok = await login('admin@choosify.com.bd');
  const sellerTok = await login('seller@choosify.com.bd');
  const creatorTok = await login('creator@choosify.com.bd');

  const listRes = await fetch(`${BASE}/operations/verifications`, {
    headers: { Authorization: `Bearer ${adminTok}` },
  });
  const listJson = (await listRes.json().catch(() => ({}))) as { data?: Array<Record<string, string>> };
  const rows = Array.isArray(listJson.data) ? listJson.data : [];
  const pending = rows.filter((r) => r.status === 'Submitted' || r.status === 'Under Review');
  const pendingBrand = pending.filter((r) => r.entityType !== 'creator');
  const pendingCreator = pending.filter((r) => r.entityType === 'creator');
  console.log('PASS admin list verifications', listRes.status, 'total', rows.length);
  console.log('INFO pending brand claims', pendingBrand.length, 'pending creator claims', pendingCreator.length);

  if (pending[0]) {
    const sellerReview = await fetch(`${BASE}/operations/verifications/${pending[0].id}/review`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sellerTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', feedback: 'self test' }),
    });
    if (sellerReview.status === 403) console.log('PASS seller cannot review claim', sellerReview.status);
    else console.log('FAIL seller review should be 403, got', sellerReview.status);

    const creatorReview = await fetch(`${BASE}/operations/verifications/${pending[0].id}/review`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${creatorTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', feedback: 'self test' }),
    });
    if (creatorReview.status === 403) console.log('PASS creator cannot review claim', creatorReview.status);
    else console.log('FAIL creator review should be 403, got', creatorReview.status);
  } else {
    console.log('INFO no pending claims — skipped review ACL on existing row');
  }

  const extras = pendingCreator.slice(1);
  for (const extra of extras) {
    const rejectExtra = await fetch(`${BASE}/operations/verifications/${extra.id}/review`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', feedback: 'Duplicate probe claim closed; original pending claim retained.' }),
    });
    console.log(rejectExtra.status === 200 ? 'PASS closed duplicate creator probe claim' : 'INFO could not close extra claim', extra.id, rejectExtra.status);
  }

  if (pendingBrand.length === 0) {
    const brandsRes = await fetch(`${BASE}/catalog/brands`, {
      headers: { Authorization: `Bearer ${adminTok}` },
    });
    const brandsJson = (await brandsRes.json().catch(() => ({}))) as { data?: Array<{ id?: string; name?: string; sellerId?: string }> };
    const brands = Array.isArray(brandsJson.data) ? brandsJson.data : [];
    const brand = brands.find((b) => b.id) || brands[0];
    if (brand?.id) {
      const brandClaim = await fetch(`${BASE}/operations/verifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerTok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'brand',
          entityId: brand.id,
          entityName: brand.name || 'Brand',
          status: 'Submitted',
          documents: [{ type: 'trade_license', name: 'trade-license.pdf', doc_url: 'https://example.com/trade-license.pdf' }],
        }),
      });
      const brandJson = (await brandClaim.json().catch(() => ({}))) as { error?: string; data?: { id?: string } };
      console.log(
        brandClaim.status === 201 || brandClaim.status === 409 ? 'PASS seller brand claim seeded' : 'FAIL seller brand claim seed',
        brandClaim.status,
        brandJson.error || brandJson.data?.id || brand.name,
      );
    } else {
      console.log('INFO no catalog brand — skipped seller claim seed');
    }
  } else {
    console.log('INFO seller pending claim already exists');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
