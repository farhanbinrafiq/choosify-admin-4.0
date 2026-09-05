/**
 * Verifies the fix for: a seller-created, marketplace-access-approved brand
 * showing claimStatus:'pending' (and therefore the storefront's wrong
 * "Claim this brand" CTA) forever, because nothing ever reconciled
 * claimStatus once marketplace access was granted.
 *
 * Proves:
 *  - POST /catalog/brands (seller self-service) creates a brand with
 *    claimStatus:'pending', sellerId=self, marketplaceAccess:false (existing,
 *    unchanged behavior).
 *  - PATCH /catalog/brands/:id/marketplace-access -> 'granted' (admin) now
 *    ALSO reconciles claimStatus -> 'verified' and verifiedStatus -> true,
 *    since the brand has its own sellerId (it's seller-owned, not an
 *    unclaimed community profile).
 *  - A brand with NO sellerId (community profile) granted marketplace
 *    access is NOT auto-verified by this same endpoint (guard is scoped to
 *    seller-owned brands only).
 *
 * Usage: npx tsx scripts/probe-brand-ownership-claim-reconcile.ts
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const RID = Date.now();

let failed = 0;
function ok(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}
const j = (r: Response) => r.json().catch(() => ({}));
const H = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const b = (await j(r)) as { accessToken?: string; uid?: string };
  if (!r.ok || !b.accessToken) throw new Error(`login ${email}: ${r.status}`);
  return { token: b.accessToken, uid: b.uid as string };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  // 1) Seller self-service brand creation.
  const created = await fetch(`${base}/catalog/brands`, {
    method: 'POST', headers: H(seller.token),
    body: JSON.stringify({
      name: `Reconcile Probe Brand ${RID}`,
      slug: `reconcile-probe-brand-${RID}`,
      category: 'Electronics',
      description: '',
      logo: '',
    }),
  });
  ok(created.status === 200 || created.status === 201, 'seller creates a brand', { status: created.status });
  const createdBody = (await j(created)) as { data?: any };
  const brand = createdBody.data;
  ok(Boolean(brand?.id), 'created brand has an id', createdBody);
  ok(brand?.claimStatus === 'pending', 'new seller brand starts claimStatus=pending', brand);
  ok(brand?.sellerId === seller.uid, 'new seller brand is owned by the creating seller', brand);
  ok(brand?.marketplaceAccess === false, 'new seller brand starts with no marketplace access', brand);

  // 2) Admin grants marketplace access.
  const granted = await fetch(`${base}/catalog/brands/${encodeURIComponent(brand.id)}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token),
    body: JSON.stringify({ status: 'granted' }),
  });
  ok(granted.status === 200, 'admin grants marketplace access', { status: granted.status });
  const grantedBody = (await j(granted)) as { data?: any };
  const grantedBrand = grantedBody.data;
  ok(grantedBrand?.marketplaceAccess === true, 'marketplaceAccess is now true', grantedBrand);
  ok(grantedBrand?.marketplaceStatus === 'granted', 'marketplaceStatus is now granted', grantedBrand);
  ok(grantedBrand?.claimStatus === 'verified', 'FIX: claimStatus is reconciled to verified for a seller-owned brand', grantedBrand);
  ok(grantedBrand?.verifiedStatus === true, 'FIX: verifiedStatus is reconciled to true for a seller-owned brand', grantedBrand);

  // 3) A community brand (no sellerId) granted marketplace access is NOT auto-verified.
  const community = await fetch(`${base}/catalog/brands`, {
    method: 'POST', headers: H(admin.token),
    body: JSON.stringify({
      name: `Reconcile Probe Community ${RID}`,
      slug: `reconcile-probe-community-${RID}`,
      category: 'Electronics',
      description: '',
      logo: '',
      claimStatus: 'community',
    }),
  });
  const communityBody = (await j(community)) as { data?: any };
  const communityBrand = communityBody.data;
  ok(Boolean(communityBrand?.id) && !communityBrand?.sellerId, 'admin-created community brand has no sellerId', communityBrand);

  const communityGranted = await fetch(`${base}/catalog/brands/${encodeURIComponent(communityBrand.id)}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token),
    body: JSON.stringify({ status: 'granted' }),
  });
  const communityGrantedBody = (await j(communityGranted)) as { data?: any };
  ok(
    communityGrantedBody.data?.claimStatus !== 'verified',
    'a community (no-owner) brand is NOT auto-verified by marketplace-access alone',
    communityGrantedBody.data,
  );

  console.log('\n=== Brand ownership/claim reconcile probe DONE ===');
  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('ALL BRAND OWNERSHIP/CLAIM RECONCILE CHECKS PASSED');
  console.log('reconciled brand id:', brand.id, 'slug:', brand.slug);
}

main().catch((e) => { console.error(e); process.exit(1); });
