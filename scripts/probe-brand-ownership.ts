/**
 * Sprint 2 (IS-002) Seller Workspace & Brand Ownership regression probe.
 *
 * Exercises the live dev server's real Postgres + catalog-store-backed
 * flows — same convention as scripts/probe-auth-regression.ts. Requires a
 * running local server (npm run dev on :3001) and the seeded dev admin/
 * moderator accounts (npx tsx server/db/seedDevUsers.ts).
 *
 * Registers fresh Consumer/Seller accounts per run (randomized emails) so it
 * is safe to re-run without manual cleanup.
 *
 * Usage: npx tsx scripts/probe-brand-ownership.ts
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const MODERATOR_EMAIL = 'moderator@choosify.com.bd';
const RUN_ID = Date.now();

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    console.log('PASS', label);
  } else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function login(email: string, password: string) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await json(res)) as { accessToken?: string; uid?: string };
  if (!res.ok || !body.accessToken) throw new Error(`login failed for ${email}: ${res.status}`);
  return { token: body.accessToken as string, uid: body.uid as string };
}

async function registerConsumer(email: string) {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Probe Consumer' }),
  });
  const body = (await json(res)) as { customToken?: string; uid?: string };
  if (!res.ok || !body.customToken) throw new Error(`register failed for ${email}: ${res.status}`);
  return { token: body.customToken as string, uid: body.uid as string };
}

async function upgradeToSeller(token: string) {
  const res = await fetch(`${base}/auth/upgrade-to-seller`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      storeName: `Probe Store ${RUN_ID}`,
      phone: '+8801711000000',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  const body = await json(res);
  return { status: res.status, body };
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, category: 'General', description: 'Probe brand' }),
  });
  const body = (await json(res)) as {
    data?: { id: string; name: string; sellerId?: string; marketplaceAccess?: boolean; claimStatus?: string };
  };
  return { status: res.status, brand: body.data };
}

async function listBrands(token?: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = (await json(res)) as { data?: Array<{ id: string; name: string; sellerId?: string }> };
  return { status: res.status, brands: body.data || [] };
}

async function main() {
  // --- Setup: two fresh sellers (via Consumer->Seller upgrade), one via
  // standalone seller-register, plus seeded admin/moderator.
  const consumerAEmail = `probe.consumer.a.${RUN_ID}@choosify.test`;
  const consumerA = await registerConsumer(consumerAEmail);

  // 1/2: Consumer -> Seller upgrade keeps the same uid, no duplicate identity.
  const upgradeA = await upgradeToSeller(consumerA.token);
  assert(upgradeA.status === 200, 'Consumer upgrades to Seller using same account', upgradeA);
  assert(
    upgradeA.body?.uid === consumerA.uid,
    'Consumer identity/uid is not duplicated across the upgrade',
    { before: consumerA.uid, after: upgradeA.body?.uid },
  );
  const sellerAToken = upgradeA.body?.accessToken as string;
  const sellerAUid = upgradeA.body?.uid as string;

  // Re-upgrading an already-Seller account must be rejected, not silently duplicated.
  const reUpgrade = await upgradeToSeller(sellerAToken);
  assert(reUpgrade.status === 409, 'Re-upgrading an already-Seller account is rejected (409)', reUpgrade);

  // 3: standalone new-Seller signup still works independently of the upgrade path.
  const sellerRegisterRes = await fetch(`${base}/auth/seller-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `probe.seller.b.${RUN_ID}@choosify.test`,
      password: 'Probe!2026xx',
      displayName: 'Probe Seller B',
      storeName: `Probe Store B ${RUN_ID}`,
      phone: '+8801711000001',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  const sellerRegisterBody = (await json(sellerRegisterRes)) as { customToken?: string; uid?: string };
  assert(
    sellerRegisterRes.status === 201 && Boolean(sellerRegisterBody.customToken),
    'Standalone new-Seller signup still works',
    { status: sellerRegisterRes.status },
  );
  const sellerBToken = sellerRegisterBody.customToken as string;
  const sellerBUid = sellerRegisterBody.uid as string;

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const moderator = await login(MODERATOR_EMAIL, DEV_PASSWORD);

  // 4/23: brand-new Seller has zero Brands — no auto-created draft, no mock/seeded names.
  const freshList = await listBrands(sellerAToken);
  assert(freshList.status === 200 && freshList.brands.length === 0, 'Seller with zero Brands gets no auto-created Brand', freshList);
  const leakedNames = ['walton', 'aarong', 'samsung', 'apex', 'xiaomi', 'unilever'];
  assert(
    !freshList.brands.some((b) => leakedNames.some((n) => b.name.toLowerCase().includes(n))),
    'Mock/seeded platform brand names never leak into a real Seller workspace',
    freshList.brands.map((b) => b.name),
  );

  // 5/6/7: Seller can create a first and second Brand; both stamped with own sellerId.
  const brand1 = await createBrand(sellerAToken, `Probe Brand One ${RUN_ID}`);
  assert(
    brand1.status === 201 && brand1.brand?.sellerId === sellerAUid && brand1.brand?.marketplaceAccess === false,
    'Seller can create first Brand (server-stamped sellerId, marketplaceAccess off by default)',
    brand1,
  );
  const brand2 = await createBrand(sellerAToken, `Probe Brand Two ${RUN_ID}`);
  assert(brand2.status === 201 && brand2.brand?.sellerId === sellerAUid, 'Seller can create a second Brand', brand2);

  const ownedList = await listBrands(sellerAToken);
  assert(
    ownedList.brands.length === 2 && ownedList.brands.every((b) => b.sellerId === sellerAUid || b.sellerId === undefined),
    'Seller sees only their own owned Brands',
    ownedList,
  );

  // 24: real uid is a Postgres identity, not a dev_-prefixed temp-role id.
  assert(!sellerAUid.startsWith('dev_'), 'Real Seller ownership uses a real uid, isolated from Temp/dev role identities', sellerAUid);

  // 8/22: another Seller cannot edit this Brand, and never receives cms:edit.
  const brand1Id = brand1.brand!.id;
  const foreignEditRes = await fetch(`${base}/catalog/brands/${brand1Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerBToken}` },
    body: JSON.stringify({ description: 'hijack attempt' }),
  });
  assert(foreignEditRes.status === 403, "Seller cannot edit another Seller's Brand (403)", foreignEditRes.status);

  const foreignDeleteRes = await fetch(`${base}/catalog/brands/${brand1Id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  assert(foreignDeleteRes.status === 403, 'Seller never receives cms:edit (brand delete is admin-only, 403 for owner too)', foreignDeleteRes.status);

  // 9: Admin can access/edit an authorized (any) Brand.
  const adminEditRes = await fetch(`${base}/catalog/brands/${brand1Id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ description: 'admin edit' }),
  });
  assert(adminEditRes.status === 200, 'Admin can access/edit an authorized Brand', adminEditRes.status);

  // 21: omitting the Bearer token on a protected write is rejected.
  const noAuthRes = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'No Auth Brand', category: 'General' }),
  });
  assert(noAuthRes.status === 401, 'Authenticated Brand write requires a valid Bearer token (401 without one)', noAuthRes.status);

  // 10: Brand verification submission (re-verification of an already-owned Brand).
  const verifySubmitRes = await fetch(`${base}/operations/verifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      entityType: 'brand',
      entityId: brand1Id,
      entityName: brand1.brand!.name ?? 'Probe Brand One',
      status: 'Submitted',
      documents: [{ type: 'trade_license', name: 'License', doc_url: 'https://example.com/doc.pdf' }],
    }),
  });
  assert(verifySubmitRes.status === 201, 'Brand verification submission', verifySubmitRes.status);

  // 11/12: Brand claim submission (SellerB claims SellerA's Brand2) + claim approval assigns ownership.
  const brand2Id = brand2.brand!.id;
  const claimSubmitRes = await fetch(`${base}/operations/verifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerBToken}` },
    body: JSON.stringify({
      entityType: 'brand',
      entityId: brand2Id,
      entityName: brand2.brand!.name ?? 'Probe Brand Two',
      status: 'Submitted',
      documents: [{ type: 'trade_license', name: 'License', doc_url: 'https://example.com/doc.pdf' }],
    }),
  });
  const claimSubmitBody = (await json(claimSubmitRes)) as { data?: { id: string } };
  assert(claimSubmitRes.status === 201, 'Brand ownership claim submission', claimSubmitRes.status);

  const claimApproveRes = await fetch(`${base}/operations/verifications/${claimSubmitBody.data?.id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${moderator.token}` },
    body: JSON.stringify({ status: 'approved', feedback: 'Documents verified' }),
  });
  assert(claimApproveRes.status === 200, 'Claim approval request succeeds', claimApproveRes.status);
  const brand2AfterApproval = await listBrands(admin.token);
  const brand2Row = brand2AfterApproval.brands.find((b) => b.id === brand2Id);
  assert(
    brand2Row?.sellerId === sellerBUid,
    'Claim approval assigns ownership to the claiming Seller',
    brand2Row,
  );

  // 13: Claim rejection does not assign/retain ownership for the rejected claimant.
  const brand3 = await createBrand(sellerAToken, `Probe Brand Three ${RUN_ID}`);
  const brand3Id = brand3.brand!.id;
  const rejectClaimSubmitRes = await fetch(`${base}/operations/verifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerBToken}` },
    body: JSON.stringify({
      entityType: 'brand',
      entityId: brand3Id,
      entityName: brand3.brand!.name ?? 'Probe Brand Three',
      status: 'Submitted',
      documents: [{ type: 'trade_license', name: 'License', doc_url: 'https://example.com/doc.pdf' }],
    }),
  });
  const rejectClaimBody = (await json(rejectClaimSubmitRes)) as { data?: { id: string } };
  const claimRejectRes = await fetch(`${base}/operations/verifications/${rejectClaimBody.data?.id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${moderator.token}` },
    body: JSON.stringify({ status: 'rejected', feedback: 'Documents insufficient' }),
  });
  assert(claimRejectRes.status === 200, 'Claim rejection request succeeds', claimRejectRes.status);
  const brand3AfterRejection = await listBrands(admin.token);
  const brand3Row = brand3AfterRejection.brands.find((b) => b.id === brand3Id);
  assert(
    brand3Row?.sellerId === sellerAUid && brand3Row?.sellerId !== sellerBUid,
    'Claim rejection does not assign or retain ownership for the rejected claimant',
    brand3Row,
  );

  // 14/15: Marketplace Access off hides the Brand publicly but Seller keeps edit access.
  const publicList = await listBrands();
  assert(
    !publicList.brands.some((b) => b.id === brand3Id),
    'Marketplace Access off hides the Brand from public/anonymous listing',
    publicList.brands.map((b) => b.id),
  );
  const ownerStillEditsRes = await fetch(`${base}/catalog/brands/${brand3Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ description: 'still editable while not public' }),
  });
  assert(
    ownerStillEditsRes.status === 200,
    'Marketplace Access off does not remove the Seller’s own Brand Studio edit access',
    ownerStillEditsRes.status,
  );

  // 16/17: Marketplace suspension transition runs the active-order guard and returns a warning slot.
  const suspendRes = await fetch(`${base}/catalog/brands/${brand3Id}/marketplace-access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'suspended' }),
  });
  const suspendBody = (await json(suspendRes)) as { data?: { marketplaceStatus?: string; marketplaceAccess?: boolean }; warning?: unknown };
  assert(
    suspendRes.status === 200 && suspendBody.data?.marketplaceStatus === 'suspended' && suspendBody.data?.marketplaceAccess === false,
    'Admin can suspend Marketplace Access; active-order guard field is present on the response',
    suspendBody,
  );
  assert(
    Object.prototype.hasOwnProperty.call(suspendBody, 'warning'),
    'Active-order suspension warning slot exists on the transition response',
    suspendBody,
  );
  const ownerStillEditsAfterSuspendRes = await fetch(`${base}/catalog/brands/${brand3Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ description: 'still editable after suspension' }),
  });
  assert(
    ownerStillEditsAfterSuspendRes.status === 200,
    'Suspension preserves the Seller’s ability to keep managing the Brand (no data deletion, no ownership loss)',
    ownerStillEditsAfterSuspendRes.status,
  );
  const sellerCannotSelfLiftSuspensionRes = await fetch(`${base}/catalog/brands/${brand3Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ marketplaceAccess: true }),
  });
  const sellerCannotSelfLiftBody = (await json(sellerCannotSelfLiftSuspensionRes)) as { data?: { marketplaceAccess?: boolean } };
  assert(
    sellerCannotSelfLiftBody.data?.marketplaceAccess === false,
    'Seller cannot self-lift an admin-imposed suspension via the plain marketplaceAccess toggle',
    sellerCannotSelfLiftBody,
  );

  console.log('');
  console.log(
    'Note: scenarios 18-20 (Active Brand switching by id, Brand Studio using the selected id,\n' +
      'logo/cover writes requiring edit mode) are frontend UI-state behaviors verified by code\n' +
      'review of AuthContext.tsx/BrandsStudioList.tsx/BrandEditStudio.tsx this sprint, not by this\n' +
      'HTTP probe — see the Sprint 2 report for details.',
  );

  if (failed > 0) {
    console.log(`\n${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll Sprint 2 brand-ownership checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
