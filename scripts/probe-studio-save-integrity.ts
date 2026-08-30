/**
 * Product Studio — save-integrity regression (data-integrity hazards).
 *
 * Proves two fixes:
 *
 *  A. SPECIFICATIONS vs CATEGORY ATTRIBUTES
 *     Free-form Studio "Specifications" (detail.specs) are presentation data.
 *     They must save even when their label is NOT a category-schema attribute,
 *     must never be folded into the schema-validated product.attributes, and
 *     Category / Brand must not be auto-fabricated as specification rows.
 *     Unknown *category attributes* must still be rejected.
 *
 *  B. UNRELATED-SAVE PRESERVATION
 *     A Studio save of one section must not wipe canonical fields the Studio
 *     does not edit (storeComparisonList, physicalStores, pros, cons,
 *     publicReviews). Explicit clears of edited fields must still take effect.
 *
 * Requires a running local server (:3001) and the seeded variant-acceptance
 * fixtures (npm run seed:variant-acceptance). Uses the sneaker fixture whose
 * category carries a real attribute schema.
 *
 * Usage: npx tsx scripts/probe-studio-save-integrity.ts
 * Or:    npm run test:studio-save-integrity
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import {
  editorModelToDetailPayload,
  editorModelToProductPatch,
  mapCatalogProductToEditor,
} from '../src/pages/admin/productEditorModel';
import { mergeRelatedStores } from '../lib/vercel-catalog/relatedInfoMerge';
import type { CatalogProduct, CatalogProductDetail } from '../src/types/catalog';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const SELLER_EMAIL = process.env.PROBE_SELLER_EMAIL || 'variant-accept-202608291244@probe.local';
const SELLER_PASSWORD = process.env.PROBE_SELLER_PASSWORD || 'Accept!2026xx';
const SNEAKER_SLUG_RE = /acceptance-runner-sneaker/;

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}
const j = (r: Response) => r.json().catch(() => ({}));

async function main() {
  console.log('=== Product Studio save-integrity probe ===');

  const login = (await j(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SELLER_EMAIL, password: SELLER_PASSWORD }),
    }),
  )) as { accessToken?: string };
  if (!login.accessToken) throw new Error('seller login failed');
  const H = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  // locate the sneaker fixture (schema-bearing category)
  const all: CatalogProduct[] = [];
  for (const off of [0, 100, 200, 300, 400, 500]) {
    const page = (await j(await fetch(`${base}/catalog/products?limit=100&offset=${off}`))) as {
      data?: CatalogProduct[];
    };
    all.push(...(page.data || []));
  }
  const product = all
    .filter((p) => SNEAKER_SLUG_RE.test(p.slug))
    .sort((a, b) => b.slug.localeCompare(a.slug))[0];
  if (!product) throw new Error('sneaker fixture not found — run npm run seed:variant-acceptance');
  console.log('fixture:', product.id, product.slug, '· category', product.categoryId);

  const getDetail = async () =>
    (await j(await fetch(`${base}/catalog/product-details/${product.id}`))) as CatalogProductDetail;
  const getProduct = async () =>
    (await j(await fetch(`${base}/catalog/products/${product.id}`))) as CatalogProduct;

  // ---- Seed canonical fields the Studio does NOT edit, straight through PATCH ----
  const SENTINEL_STORES = [
    { id: 'sc-1', storeName: 'Daraz', price: 6490, availability: 'In stock', storeUrl: 'https://daraz.com.bd/x', isFeatured: true },
    { id: 'sc-2', storeName: 'Pickaboo', price: 6600, availability: 'Limited', storeUrl: 'https://pickaboo.com/x' },
  ];
  const SENTINEL_PHYSICAL = [
    { id: 'ps-1', storeName: 'Bashundhara Outlet', address: 'Level 4, Block C', city: 'Dhaka' },
  ];
  const SENTINEL_PROS = ['Durable outsole', 'True to size'];
  const SENTINEL_CONS = ['Runs warm'];
  const SENTINEL_REVIEWS = [
    { id: 'rev-1', reviewerName: 'Verified Buyer', rating: 5, comment: 'Great grip on wet roads.' },
  ];
  const seedRes = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({
      productId: product.id,
      specs: [],
      storeComparisonList: SENTINEL_STORES,
      physicalStores: SENTINEL_PHYSICAL,
      pros: SENTINEL_PROS,
      cons: SENTINEL_CONS,
      publicReviews: SENTINEL_REVIEWS,
    }),
  });
  assert(seedRes.status === 200, 'seed PATCH of non-Studio canonical fields accepted', seedRes.status);
  let detail = await getDetail();
  assert(detail.storeComparisonList?.length === 2, 'seed: storeComparisonList stored', detail.storeComparisonList);
  assert(detail.physicalStores?.length === 1, 'seed: physicalStores stored', detail.physicalStores);

  // ---- A4. Category / Brand not fabricated as specifications ----
  const model = mapCatalogProductToEditor(product, { ...detail, specs: [] });
  assert(
    Array.isArray(model.specs) && model.specs.length === 0,
    'A4. mapCatalogProductToEditor does NOT fabricate Category/Brand spec rows',
    model.specs,
  );

  // ---- A1. Free-form specification with non-schema labels saves via the Studio path ----
  model.specs = [
    { key: 'Shell', value: 'Recycled PET knit' },
    { key: 'Outsole height', value: '32 mm' },
    { key: 'Weight', value: '312 g' },
  ];
  const studioPayload = editorModelToDetailPayload(model) as Record<string, unknown>;
  assert(
    !('physicalStores' in studioPayload) &&
      !('pros' in studioPayload) &&
      !('cons' in studioPayload) &&
      !('publicReviews' in studioPayload) &&
      !('adminPromotedStores' in studioPayload) &&
      !('relatedInfoLockedByAdmin' in studioPayload),
    'B0. editorModelToDetailPayload omits every field the Studio does not own',
    Object.keys(studioPayload),
  );
  const saveRes = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(studioPayload),
  });
  assert(saveRes.status === 200, 'A1. free-form specification (non-schema labels) saves 200', {
    status: saveRes.status,
    body: await j(saveRes.clone?.() ?? saveRes),
  });
  detail = await getDetail();
  const specKeys = (detail.specs || []).map((s) => s.key).sort();
  assert(
    specKeys.join(',') === 'Outsole height,Shell,Weight',
    'A1b. all three free-form spec rows round-tripped',
    detail.specs,
  );

  // ---- A3. Specifications did NOT become category attributes ----
  const prodAfter = await getProduct();
  const attrKeys = Object.keys((prodAfter.attributes as Record<string, unknown>) || {});
  assert(
    !attrKeys.includes('shell') && !attrKeys.includes('weight') && !attrKeys.includes('outsole_height'),
    'A3. free-form specs are NOT folded into product.attributes',
    attrKeys,
  );

  // ---- B1..B5. Unrelated Studio save preserved the non-Studio canonical fields ----
  const projectStores = (list: CatalogProductDetail['storeComparisonList'] | undefined) =>
    (list || []).map((s) => `${s.storeName}|${s.price}|${s.availability}|${s.storeUrl || ''}|${s.isFeatured ? 1 : 0}`);
  assert(
    JSON.stringify(projectStores(detail.storeComparisonList)) ===
      JSON.stringify(projectStores(SENTINEL_STORES as CatalogProductDetail['storeComparisonList'])) &&
      (detail.storeComparisonList || []).every((s) => s.source === 'seller'),
    'B1. seller storeComparisonList round-tripped faithfully through an unrelated save (source pinned "seller")',
    detail.storeComparisonList,
  );
  assert(
    JSON.stringify(detail.physicalStores) === JSON.stringify(SENTINEL_PHYSICAL),
    'B2. physicalStores survived the Studio save',
    detail.physicalStores,
  );
  assert(JSON.stringify(detail.pros) === JSON.stringify(SENTINEL_PROS), 'B3. pros survived', detail.pros);
  assert(JSON.stringify(detail.cons) === JSON.stringify(SENTINEL_CONS), 'B4. cons survived', detail.cons);
  assert(
    JSON.stringify(detail.publicReviews) === JSON.stringify(SENTINEL_REVIEWS),
    'B5. publicReviews survived',
    detail.publicReviews,
  );

  // ---- A5. Existing specs round-trip on a second identical save ----
  const model2 = mapCatalogProductToEditor(await getProduct(), detail);
  const payload2 = editorModelToDetailPayload(model2);
  const save2 = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(payload2),
  });
  assert(save2.status === 200, 'A5. second Studio save accepted', save2.status);
  detail = await getDetail();
  assert(
    (detail.specs || []).map((s) => s.key).sort().join(',') === 'Outsole height,Shell,Weight',
    'A5b. existing specifications still intact after a second save',
    detail.specs,
  );

  // ---- A2. Unknown CATEGORY ATTRIBUTE is still rejected ----
  const badAttr = await fetch(`${base}/catalog/products/${product.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ attributes: { totally_made_up_attr: 'x' } }),
  });
  const badBody = (await j(badAttr)) as { error?: string };
  assert(
    badAttr.status === 400 && /schema/i.test(badBody.error || ''),
    'A2. unknown category attribute still fails schema validation',
    { status: badAttr.status, error: badBody.error },
  );

  // ---- B6. Explicit clear of an EDITED field still takes effect ----
  const model3 = mapCatalogProductToEditor(await getProduct(), await getDetail());
  model3.additionalSpecs = [];
  model3.boxContents = [];
  const clearRes = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(model3)),
  });
  assert(clearRes.status === 200, 'B6. explicit-clear save accepted', clearRes.status);
  detail = await getDetail();
  assert(
    (detail.additionalSpecs || []).length === 0 && (detail.boxContents || []).length === 0,
    'B6b. explicit user clear of an edited field is honoured (not treated as "unedited")',
    { additionalSpecs: detail.additionalSpecs, boxContents: detail.boxContents },
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  C. RELATED INFORMATION — seller vs admin ownership + section lock
  // ════════════════════════════════════════════════════════════════════════════
  const adminEmail = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
  const adminPassword = process.env.PROBE_ADMIN_PASSWORD || process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
  const adminLogin = (await j(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    }),
  )) as { accessToken?: string };
  if (!adminLogin.accessToken) throw new Error('admin login failed');
  const A = { Authorization: `Bearer ${adminLogin.accessToken}`, 'Content-Type': 'application/json' };
  const adminRoute = `${base}/catalog/product-details/${product.id}/related-info/admin`;

  // Defensive reset — a prior aborted run may have left the fixture locked or
  // with stale promoted rows.
  await fetch(adminRoute, {
    method: 'PUT',
    headers: A,
    body: JSON.stringify({ relatedInfoLockedByAdmin: false, adminPromotedStores: [] }),
  });

  // C0. reset to a known related-info state through the seller Studio path
  const seedModel = mapCatalogProductToEditor(await getProduct(), await getDetail());
  seedModel.relatedInfoType = 'price_across_stores';
  seedModel.priceAcrossStoresEnabled = true;
  seedModel.relatedStores = [
    { id: 'sc-a', storeName: 'Seller Shop A', storeUrl: 'https://a.example', price: 6000, availability: 'In stock', storeRating: 4.5, isFeatured: true, logoUrl: '' },
    { id: 'sc-b', storeName: 'Seller Shop B', storeUrl: 'https://b.example', price: 6100, availability: 'Limited', storeRating: 0, isFeatured: false, logoUrl: '' },
  ];
  await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(seedModel)),
  });
  detail = await getDetail();
  assert(
    (detail.storeComparisonList || []).length === 2 &&
      (detail.storeComparisonList || []).every((s) => s.source === 'seller'),
    'C1. seller can create own related-info entries',
    detail.storeComparisonList,
  );

  // C2. seller update + C3 delete own entry
  const m2 = mapCatalogProductToEditor(await getProduct(), await getDetail());
  m2.relatedStores = m2.relatedStores
    .filter((s) => s.storeName !== 'Seller Shop B')
    .map((s) => (s.storeName === 'Seller Shop A' ? { ...s, price: 5555 } : s));
  await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(m2)),
  });
  detail = await getDetail();
  assert(
    (detail.storeComparisonList || []).length === 1 && detail.storeComparisonList![0].price === 5555,
    'C2/C3. seller can update and delete own related-info entries',
    detail.storeComparisonList,
  );

  // C4. seller cannot spoof source=admin / mark own row as sponsored
  const spoof = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({
      productId: product.id,
      storeComparisonList: [
        { id: 'sc-a', storeName: 'Seller Shop A', price: 5555, availability: 'In stock', source: 'admin', promoLabel: 'Featured by Choosify', priority: 0, adRef: 'AD-99999' },
      ],
    }),
  });
  detail = await getDetail();
  assert(
    spoof.status === 200 &&
      (detail.storeComparisonList || []).every((s) => s.source === 'seller' && !s.promoLabel && s.priority === undefined && s.adRef === undefined),
    'C4. seller cannot spoof source=admin or self-sponsor a row (admin decoration stripped)',
    detail.storeComparisonList,
  );

  // C5. seller adminPromotedStores / lock writes are ignored — the stored
  //     admin list and lock are left exactly as they were (this fixture may
  //     already carry admin rows from a prior run; the point is "unchanged").
  const adminBeforeC5 = JSON.stringify(detail.adminPromotedStores ?? null);
  const lockBeforeC5 = detail.relatedInfoLockedByAdmin ?? null;
  const sellerTriesAdmin = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({
      productId: product.id,
      adminPromotedStores: [{ id: 'x', storeName: 'Seller-injected promo', price: 1, availability: 'x', source: 'admin' }],
      relatedInfoLockedByAdmin: true,
    }),
  });
  detail = await getDetail();
  const injected = (detail.adminPromotedStores || []).some((s) => s.storeName === 'Seller-injected promo');
  assert(
    sellerTriesAdmin.status === 200 &&
      !injected &&
      JSON.stringify(detail.adminPromotedStores ?? null) === adminBeforeC5 &&
      (detail.relatedInfoLockedByAdmin ?? null) === lockBeforeC5,
    'C5. seller cannot write adminPromotedStores or set the section lock (both left unchanged)',
    { admin: detail.adminPromotedStores, locked: detail.relatedInfoLockedByAdmin },
  );

  // C6. admin creates promoted entries via the admin route (seller rows untouched)
  const sellerRowsBefore = JSON.stringify(detail.storeComparisonList);
  const adminPut = await fetch(adminRoute, {
    method: 'PUT',
    headers: A,
    body: JSON.stringify({
      adminPromotedStores: [
        { id: 'ap-1', storeName: 'Choosify Partner — Daraz', price: 5990, availability: 'Sponsored deal', storeUrl: 'https://daraz.com.bd/promo', promoLabel: 'Sponsored', priority: 0, logoUrl: 'https://logo.example/daraz.png' },
        { id: 'ap-2', storeName: 'Choosify Partner — Pickaboo', price: 6050, availability: 'Nationwide', storeUrl: 'https://pickaboo.com/promo' },
      ],
    }),
  });
  detail = await getDetail();
  assert(
    adminPut.status === 200 &&
      (detail.adminPromotedStores || []).length === 2 &&
      (detail.adminPromotedStores || []).every((s) => s.source === 'admin') &&
      JSON.stringify(detail.storeComparisonList) === sellerRowsBefore,
    'C6. admin can create promoted entries; seller-owned rows untouched',
    { admin: detail.adminPromotedStores, sellerUnchanged: JSON.stringify(detail.storeComparisonList) === sellerRowsBefore },
  );

  // C7. deterministic merge order
  const merged = mergeRelatedStores(detail.storeComparisonList, detail.adminPromotedStores);
  assert(
    merged.map((s) => s.storeName).join(' > ') ===
      'Choosify Partner — Daraz > Seller Shop A > Choosify Partner — Pickaboo',
    'C7. merge order = prioritized admin → seller featured → seller rest → admin rest',
    merged.map((s) => `${s.storeName}${s.sponsored ? '(promo)' : ''}`),
  );

  // C8. unrelated seller save preserves BOTH ownership classes
  const m8 = mapCatalogProductToEditor(await getProduct(), await getDetail());
  m8.warrantyMonths = 24; // unrelated section
  await fetch(`${base}/catalog/products/${product.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify(editorModelToProductPatch(m8)),
  });
  await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(m8)),
  });
  detail = await getDetail();
  assert(
    (detail.adminPromotedStores || []).length === 2 && (detail.storeComparisonList || []).length === 1,
    'C8. an unrelated Studio save preserves BOTH seller and admin related-info lists',
    { admin: (detail.adminPromotedStores || []).length, seller: (detail.storeComparisonList || []).length },
  );

  // C9. admin locks the section
  const lockRes = await fetch(adminRoute, {
    method: 'PUT',
    headers: A,
    body: JSON.stringify({ relatedInfoLockedByAdmin: true }),
  });
  detail = await getDetail();
  assert(
    lockRes.status === 200 && detail.relatedInfoLockedByAdmin === true,
    'C9. admin can lock the Related Information section',
    detail.relatedInfoLockedByAdmin,
  );

  // C10. seller cannot edit related-info while locked, and cannot unlock it
  const lockedSellerRows = JSON.stringify(detail.storeComparisonList);
  const lockedEdit = mapCatalogProductToEditor(await getProduct(), await getDetail());
  lockedEdit.relatedStores = [
    ...lockedEdit.relatedStores,
    { id: 'sc-hack', storeName: 'Sneaked in while locked', storeUrl: '', price: 1, availability: 'x', storeRating: 0, isFeatured: false, logoUrl: '' },
  ];
  lockedEdit.relatedInfoLockedByAdmin = false;
  const lockedTry = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(lockedEdit)),
  });
  detail = await getDetail();
  assert(
    lockedTry.status === 403 &&
      detail.relatedInfoLockedByAdmin === true &&
      JSON.stringify(detail.storeComparisonList) === lockedSellerRows,
    'C10. locked: seller related-info edit is rejected (403); section stays locked; no partial write',
    { status: lockedTry.status, locked: detail.relatedInfoLockedByAdmin },
  );

  // C11. an UNRELATED seller save is still allowed while locked, and does not
  //      touch the admin campaign data.
  const lockedUnrelated = mapCatalogProductToEditor(await getProduct(), await getDetail());
  lockedUnrelated.description = 'Locked-section unrelated edit ' + Date.now();
  const lockedOk = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(lockedUnrelated)),
  });
  detail = await getDetail();
  assert(
    lockedOk.status === 200 && (detail.adminPromotedStores || []).length === 2,
    'C11. locked: an unrelated seller save still succeeds and admin campaign data survives',
    { status: lockedOk.status, admin: (detail.adminPromotedStores || []).length },
  );

  // C12. admin unlocks + disabling the seller panel does not delete admin data
  await fetch(adminRoute, { method: 'PUT', headers: A, body: JSON.stringify({ relatedInfoLockedByAdmin: false }) });
  const disableModel = mapCatalogProductToEditor(await getProduct(), await getDetail());
  disableModel.priceAcrossStoresEnabled = false;
  await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(disableModel)),
  });
  detail = await getDetail();
  assert(
    detail.priceAcrossStoresEnabled === false && (detail.adminPromotedStores || []).length === 2,
    'C12. seller disabling their own panel does NOT delete admin campaign data',
    { enabled: detail.priceAcrossStoresEnabled, admin: (detail.adminPromotedStores || []).length },
  );

  // C13. non-admin cannot call the admin route
  const sellerHitsAdminRoute = await fetch(adminRoute, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ relatedInfoLockedByAdmin: true }),
  });
  assert(sellerHitsAdminRoute.status === 403, 'C13. non-admin is refused by the admin related-info route', sellerHitsAdminRoute.status);

  // C14. Custom section round-trips (title + heading/bullet blocks)
  const cm = mapCatalogProductToEditor(await getProduct(), await getDetail());
  cm.relatedInfoType = 'custom';
  cm.customRelatedInfoTitle = 'Licensing & Compliance';
  cm.customRelatedBlocks = [
    { id: 'crb-1', heading: 'Certifications', items: ['BSTI approved', 'ISO 9001'] },
    { id: 'crb-2', heading: 'Import papers', items: ['LC copy on request'] },
  ];
  const cSave = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(cm)),
  });
  detail = await getDetail();
  assert(
    cSave.status === 200 &&
      detail.relatedInfoType === 'custom' &&
      (detail as unknown as { customRelatedInfo?: { title?: string; blocks?: unknown[] } }).customRelatedInfo?.title ===
        'Licensing & Compliance' &&
      ((detail as unknown as { customRelatedInfo?: { blocks?: unknown[] } }).customRelatedInfo?.blocks?.length ?? 0) === 2,
    'C14. Custom Related Information section round-trips (title + blocks)',
    (detail as unknown as { customRelatedInfo?: unknown }).customRelatedInfo,
  );

  // C15. Before Your Visit — seller custom fields round-trip alongside presets
  const bvm = mapCatalogProductToEditor(await getProduct(), await getDetail());
  bvm.relatedInfoType = 'before_your_visit';
  bvm.beforeYourVisit = {
    parkingAvailability: 'Basement lot',
    cancellationPolicy: '24h notice',
    whatToBring: 'Passport',
    wheelchairAccess: 'Ramp at side entrance',
    insuranceAccepted: 'MetLife',
    customFields: [
      { id: 'bvc-1', label: 'Dress code', value: 'Smart casual' },
      { id: 'bvc-2', label: 'Languages spoken', value: 'Bangla, English' },
    ],
  };
  const bvSave = await fetch(`${base}/catalog/product-details/${product.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(editorModelToDetailPayload(bvm)),
  });
  detail = await getDetail();
  const bvOut = (detail as unknown as { beforeYourVisit?: { customFields?: Array<{ label: string; value: string }> } }).beforeYourVisit;
  assert(
    bvSave.status === 200 &&
      (bvOut?.customFields?.length ?? 0) === 2 &&
      bvOut?.customFields?.[0].label === 'Dress code' &&
      bvOut?.customFields?.[1].value === 'Bangla, English',
    'C15. Before Your Visit seller custom fields round-trip alongside the presets',
    bvOut?.customFields,
  );

  console.log(failed === 0 ? '\nALL STUDIO SAVE-INTEGRITY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
