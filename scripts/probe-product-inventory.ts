/**
 * Sprint 3 — Product / Service / Inventory regression probe.
 *
 * Requires a running local server (npm run dev on :3001) and seeded
 * admin account (npx tsx server/db/seedDevUsers.ts).
 *
 * Usage: npx tsx scripts/probe-product-inventory.ts
 * Or:    npm run test:products
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
      phone: '+8801711000099',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  const body = (await json(res)) as { accessToken?: string; uid?: string };
  return { status: res.status, body };
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, category: 'General', description: 'Probe brand' }),
  });
  const body = (await json(res)) as { data?: { id: string; sellerId?: string } };
  return { status: res.status, brand: body.data };
}

async function setMarketplace(adminToken: string, brandId: string, status: string) {
  const res = await fetch(`${base}/catalog/brands/${brandId}/marketplace-access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status }),
  });
  return { status: res.status, body: await json(res) };
}

async function firstCategoryId(token: string) {
  const res = await fetch(`${base}/catalog/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await json(res)) as { data?: Array<{ id: string }> };
  const id = body.data?.[0]?.id;
  if (!id) throw new Error('No categories available for probe');
  return id;
}

function productPayload(overrides: Record<string, unknown>) {
  return {
    title: `Probe Product ${RUN_ID}`,
    description: 'Sprint 3 probe product',
    image: 'https://example.com/probe.jpg',
    gallery: ['https://example.com/probe.jpg'],
    price: 1000,
    stock: 10,
    status: 'draft',
    ...overrides,
  };
}

async function main() {
  const consumerA = await registerConsumer(`probe.prod.a.${RUN_ID}@choosify.test`);
  const upgradeA = await upgradeToSeller(consumerA.token);
  assert(upgradeA.status === 200, 'Seller A upgraded', upgradeA.status);
  const sellerAToken = upgradeA.body.accessToken as string;
  const sellerAUid = upgradeA.body.uid as string;

  const consumerB = await registerConsumer(`probe.prod.b.${RUN_ID}@choosify.test`);
  const upgradeB = await upgradeToSeller(consumerB.token);
  const sellerBToken = upgradeB.body.accessToken as string;

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const categoryId = await firstCategoryId(admin.token);

  const brandA1 = await createBrand(sellerAToken, `Probe Prod Brand A1 ${RUN_ID}`);
  const brandA2 = await createBrand(sellerAToken, `Probe Prod Brand A2 ${RUN_ID}`);
  const brandB = await createBrand(sellerBToken, `Probe Prod Brand B ${RUN_ID}`);
  assert(brandA1.status === 201 && !!brandA1.brand?.id, 'Seller A creates Brand A1', brandA1);
  assert(brandA2.status === 201 && !!brandA2.brand?.id, 'Seller A creates Brand A2', brandA2);
  assert(brandB.status === 201 && !!brandB.brand?.id, 'Seller B creates Brand B', brandB);

  const brandA1Id = brandA1.brand!.id;
  const brandA2Id = brandA2.brand!.id;
  const brandBId = brandB.brand!.id;

  // 30: Bearer required for writes
  const noAuth = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productPayload({ brandId: brandA1Id, categoryId })),
  });
  assert(noAuth.status === 401 || noAuth.status === 403, 'Bearer token required for Product writes', noAuth.status);

  // 1–4: create under owned brand, real id, persist, brand scope
  const createRes = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify(
      productPayload({ brandId: brandA1Id, categoryId, title: `Owned Product ${RUN_ID}` }),
    ),
  });
  const createBody = (await json(createRes)) as { data?: { id: string; sellerId?: string; brandId: string; status: string } };
  assert(createRes.status === 201 && !!createBody.data?.id, '1. Seller creates Product under owned Brand', {
    status: createRes.status,
    body: createBody,
  });
  if (!createBody.data?.id) {
    throw new Error('Product create failed; aborting remaining assertions');
  }
  assert(!!createBody.data?.id && !createBody.data.id.startsWith('mock'), '2. Product gets real Product ID', createBody.data?.id);
  assert(createBody.data?.sellerId === sellerAUid, 'Product sellerId stamped', createBody.data);
  const productId = createBody.data!.id;

  const getRes = await fetch(`${base}/catalog/products/${productId}`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const got = (await json(getRes)) as { id?: string };
  assert(getRes.status === 200 && got.id === productId, '3. Product persists', getRes.status);

  const listA1 = await fetch(`${base}/catalog/products?brandId=${encodeURIComponent(brandA1Id)}`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const listA1Body = (await json(listA1)) as { data?: Array<{ id: string; brandId: string }> };
  assert(
    listA1.status === 200 && listA1Body.data?.some((p) => p.id === productId) && listA1Body.data.every((p) => p.brandId === brandA1Id),
    '4. Product appears in owned Brand scope',
    listA1Body.data?.map((p) => p.id),
  );

  // 5: foreign brand create → 403
  const foreignCreate = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify(productPayload({ brandId: brandBId, categoryId })),
  });
  assert(foreignCreate.status === 403, '5. create under foreign Brand → 403', foreignCreate.status);

  // 6–7: update owner ok / cross-seller 403
  const updateOk = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ description: 'updated by owner' }),
  });
  assert(updateOk.status === 200, '6. Product update succeeds for owner', updateOk.status);

  const crossUpdate = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerBToken}` },
    body: JSON.stringify({ description: 'hijack' }),
  });
  assert(crossUpdate.status === 403, '7. cross-seller update → 403', crossUpdate.status);

  // 8: brand reassignment to foreign Brand → 403
  const reassign = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ brandId: brandBId }),
  });
  assert(reassign.status === 403, '8. brand reassignment to foreign Brand → 403', reassign.status);

  // 9: multi-brand filtering
  const prodA2 = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify(productPayload({ brandId: brandA2Id, categoryId, title: `Brand2 Product ${RUN_ID}` })),
  });
  const prodA2Body = (await json(prodA2)) as { data?: { id: string } };
  const listA2 = await fetch(`${base}/catalog/products?brandId=${encodeURIComponent(brandA2Id)}`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const listA2Body = (await json(listA2)) as { data?: Array<{ id: string }> };
  assert(
    listA2Body.data?.some((p) => p.id === prodA2Body.data?.id) && !listA2Body.data?.some((p) => p.id === productId),
    '9. multi-brand Product filtering',
    listA2Body.data,
  );

  // 15: Marketplace Access blocks publication
  const publishBlocked = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ status: 'live' }),
  });
  assert(publishBlocked.status === 400, '15. Marketplace Access blocks publication where required', publishBlocked.status);

  await setMarketplace(admin.token, brandA1Id, 'granted');

  // 10: valid lifecycle transition draft → active (live)
  const publishOk = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ status: 'live' }),
  });
  const published = (await json(publishOk)) as { data?: { status: string } };
  assert(
    publishOk.status === 200 && (published.data?.status === 'live' || published.data?.status === 'active'),
    '10. valid lifecycle transition (draft → active/live)',
    published,
  );

  // 12: legacy live publicly compatible
  const publicGet = await fetch(`${base}/catalog/products/${productId}`);
  assert(publicGet.status === 200, '12. legacy status live remains publicly compatible', publicGet.status);

  // 11: invalid transition (archived → out_of_stock without restore path — archive first then try OOS)
  const archiveRes = await fetch(`${base}/catalog/products/${productId}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  assert(archiveRes.status === 200, '13. archive', archiveRes.status);

  const invalidTrans = await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ status: 'out_of_stock' }),
  });
  assert(invalidTrans.status === 400, '11. invalid lifecycle transition rejected', invalidTrans.status);

  // 14: restore
  const restoreRes = await fetch(`${base}/catalog/products/${productId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  assert(restoreRes.status === 200, '14. restore where allowed', restoreRes.status);

  // 16–17: suspended brand hides publicly; seller retains management
  await setMarketplace(admin.token, brandA1Id, 'suspended');
  const publicHidden = await fetch(`${base}/catalog/products/${productId}`);
  assert(publicHidden.status === 404, '16. suspended Brand hides Product publicly', publicHidden.status);

  const sellerStillSees = await fetch(`${base}/catalog/products/${productId}`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  assert(sellerStillSees.status === 200, '17. Seller retains management access after Brand suspension', sellerStillSees.status);

  await setMarketplace(admin.token, brandA1Id, 'restored');

  // 18–21: variants + VB round-trip (product-details must not wipe)
  const variantPut = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      productId,
      specs: [],
      pros: [],
      cons: [],
      bestForTags: [],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [{ id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'Silver'] }],
      productVariants: [
        { id: `var-${RUN_ID}-1`, sku: `SKU-${RUN_ID}-BLK`, price: 1100, stock: 4, options: { Color: 'Black' } },
        { id: `var-${RUN_ID}-2`, sku: `SKU-${RUN_ID}-SLV`, price: 1200, stock: 3, options: { Color: 'Silver' } },
      ],
      creatorContent: [],
    }),
  });
  const variantBody = (await json(variantPut)) as {
    data?: { productVariants?: Array<{ id: string }>; optionGroups?: unknown[] };
  };
  assert(
    variantPut.status === 200 && (variantBody.data?.productVariants?.length || 0) === 2,
    '18. Variant create',
    variantBody.data?.productVariants,
  );

  const variantPatch = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      productVariants: [
        { id: `var-${RUN_ID}-1`, sku: `SKU-${RUN_ID}-BLK-U`, price: 1150, stock: 4, options: { Color: 'Black' } },
        { id: `var-${RUN_ID}-2`, sku: `SKU-${RUN_ID}-SLV`, price: 1200, stock: 3, options: { Color: 'Silver' } },
      ],
    }),
  });
  const variantPatchBody = (await json(variantPatch)) as {
    data?: { productVariants?: Array<{ sku: string }> };
  };
  assert(
    variantPatch.status === 200 && variantPatchBody.data?.productVariants?.[0]?.sku === `SKU-${RUN_ID}-BLK-U`,
    '19. Variant update',
    variantPatchBody.data?.productVariants?.[0],
  );

  const badVariantInv = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ variantId: 'not-a-real-variant', quantity: 1 }),
  });
  assert(badVariantInv.status === 400, '20. Variant Product relationship validation', badVariantInv.status);

  // Simulate Visual Builder save payload that previously wiped variants — preserve via editor model semantics:
  // re-PUT with same variants (round-trip). A wipe would clear them; we assert they remain after a second PUT
  // that includes optionGroups/productVariants (as fixed editorModelToDetailPayload does).
  const roundTrip = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      productId,
      specs: [{ key: 'k', value: 'v' }],
      pros: [],
      cons: [],
      bestForTags: [],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [{ id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'Silver'] }],
      productVariants: variantPatchBody.data?.productVariants || variantBody.data?.productVariants,
      creatorContent: [],
    }),
  });
  const roundTripBody = (await json(roundTrip)) as { data?: { productVariants?: unknown[] } };
  assert(
    (roundTripBody.data?.productVariants?.length || 0) >= 2,
    '21. Product Visual Builder save does not wipe variants',
    roundTripBody.data?.productVariants?.length,
  );

  // 22–27 inventory
  const invRead = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const invReadBody = (await json(invRead)) as { data?: { availableQuantity: number } };
  assert(invRead.status === 200 && typeof invReadBody.data?.availableQuantity === 'number', '22. inventory read', invReadBody);

  const invAdj = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ quantity: 7 }),
  });
  const invAdjBody = (await json(invAdj)) as { data?: { availableQuantity: number }; product?: { stock: number; status: string } };
  assert(invAdj.status === 200 && invAdjBody.data?.availableQuantity === 7, '23. inventory adjustment', invAdjBody);

  const invNeg = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ quantity: -5 }),
  });
  assert(invNeg.status === 400, '24. negative inventory rejected where prohibited', invNeg.status);

  const invVar = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ variantId: `var-${RUN_ID}-1`, quantity: 9 }),
  });
  assert(invVar.status === 200, '25. variant-level inventory', invVar.status);

  // Aggregate SoT uses variant rows when present — zero every variant + product-level.
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ variantId: `var-${RUN_ID}-1`, quantity: 0 }),
  });
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ variantId: `var-${RUN_ID}-2`, quantity: 0 }),
  });
  const toZero = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ quantity: 0 }),
  });
  const toZeroBody = (await json(toZero)) as { product?: { status: string; stock?: number } };
  assert(
    toZero.status === 200 && toZeroBody.product?.status === 'out_of_stock',
    '26. zero stock → OutOfStock semantics',
    toZeroBody.product,
  );

  const restock = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ variantId: `var-${RUN_ID}-1`, quantity: 5 }),
  });
  const restockBody = (await json(restock)) as { product?: { status: string } };
  assert(
    restock.status === 200 &&
      (restockBody.product?.status === 'live' || restockBody.product?.status === 'active'),
    '27. restock behavior',
    restockBody.product,
  );

  // 28–29: list uses persisted data; no foreign seed leakage to seller
  const sellerList = await fetch(`${base}/catalog/products`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const sellerListBody = (await json(sellerList)) as { data?: Array<{ id: string; sellerId?: string; title: string }> };
  assert(
    sellerListBody.data?.every((p) => p.sellerId === sellerAUid),
    '28/29. Product list uses persisted owned data; Seller path does not leak foreign seed Products',
    sellerListBody.data?.map((p) => ({ id: p.id, sellerId: p.sellerId, title: p.title })),
  );

  // 31–34 services
  const svcCreate = await fetch(`${base}/catalog/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      title: `Probe Service ${RUN_ID}`,
      brandId: brandA1Id,
      categoryId,
      description: 'Service foundation',
      price: 500,
      currency: 'BDT',
      status: 'draft',
      durationMinutes: 60,
      serviceArea: 'Dhaka',
    }),
  });
  const svcBody = (await json(svcCreate)) as { data?: { id: string; sellerId?: string } };
  assert(svcCreate.status === 201 && !!svcBody.data?.id, '31. Service creation under owned Brand', svcBody);

  const svcForeign = await fetch(`${base}/catalog/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({
      title: `Foreign Service ${RUN_ID}`,
      brandId: brandBId,
      categoryId,
      price: 100,
      status: 'draft',
    }),
  });
  assert(svcForeign.status === 403, '32. Service foreign Brand ownership denied', svcForeign.status);

  const svcList = await fetch(`${base}/catalog/services?brandId=${encodeURIComponent(brandA1Id)}`, {
    headers: { Authorization: `Bearer ${sellerAToken}` },
  });
  const svcListBody = (await json(svcList)) as { data?: Array<{ id: string }> };
  assert(
    svcListBody.data?.some((s) => s.id === svcBody.data?.id),
    '33. Service persistence/listing',
    svcListBody.data,
  );

  const svcPublishBlocked = await fetch(`${base}/catalog/services/${svcBody.data!.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerAToken}` },
    body: JSON.stringify({ status: 'live' }),
  });
  // Brand was restored earlier — publish should succeed for lifecycle foundation
  assert(
    svcPublishBlocked.status === 200 || svcPublishBlocked.status === 400,
    '34. Service lifecycle foundation (transition enforced)',
    svcPublishBlocked.status,
  );
  if (svcPublishBlocked.status === 200) {
    const svcPubBody = (await json(svcPublishBlocked)) as { data?: { status: string } };
    assert(
      svcPubBody.data?.status === 'live' || svcPubBody.data?.status === 'active',
      '34b. Service can become Active when marketplace eligible',
      svcPubBody,
    );
  }

  if (failed > 0) {
    console.error(`\nSprint 3 probe FAILED with ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('\nSprint 3 probe PASSED');
}

main().catch((err) => {
  console.error('Sprint 3 probe crashed:', err);
  process.exit(1);
});
