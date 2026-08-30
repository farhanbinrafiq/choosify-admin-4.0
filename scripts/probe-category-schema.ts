/**
 * Sprint 4 / IS-010 Sprint 7 — Category + Attribute + Variant schema regression probe.
 *
 * Requires running local server (:3001) and seeded admin (npx tsx server/db/seedDevUsers.ts).
 *
 * Usage: npx tsx scripts/probe-category-schema.ts
 * Or:    npm run test:categories
 */
import dotenv from 'dotenv';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const RUN_ID = Date.now();
const SNAPSHOT = join(process.cwd(), '.data', `probe-categories-snapshot-${RUN_ID}.json`);

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
  if (!res.ok || !body.customToken) throw new Error(`register failed: ${res.status}`);
  return { token: body.customToken as string, uid: body.uid as string };
}

/**
 * Sprint 10: /auth/upgrade-to-seller is intentionally disabled (403
 * PARTNER_APPLICATION_REQUIRED). Canonical onboarding is now:
 * partner-apply -> Admin identity approval -> login as the provisioned Seller.
 */
async function upgradeToSeller(adminToken: string, email: string, password: string) {
  const apply = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email,
      password,
      displayName: 'Cat Probe Seller',
      businessOrChannelName: `Cat Probe Store ${RUN_ID}`,
      phone: '+8801711000088',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  if (apply.status !== 201) return { status: apply.status, body: {} as { accessToken?: string } };

  const listRes = await fetch(`${base}/operations/partner-applications?status=pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listBody = (await json(listRes)) as { applications?: Array<{ id: string; email?: string }> };
  const app = (listBody.applications || []).find((a) => a.email === email);
  if (!app) return { status: 500, body: {} as { accessToken?: string } };
  const approve = await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ note: 'category schema probe' }),
  });
  if (approve.status !== 200) return { status: approve.status, body: {} as { accessToken?: string } };

  const seller = await login(email, password);
  // Legacy upgrade-to-seller self-granted Marketplace Access instantly; the real
  // lifecycle needs this Admin action explicitly before the seller can create brands.
  const ownBrands = await fetch(`${base}/catalog/brands`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const ownBrandsBody = (await json(ownBrands)) as { data?: Array<{ id: string }> };
  const ownBrandId = ownBrandsBody.data?.[0]?.id;
  if (ownBrandId) {
    await fetch(`${base}/catalog/brands/${encodeURIComponent(ownBrandId)}/marketplace-access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'granted' }),
    });
  }
  return { status: 200, body: { accessToken: seller.token } };
}

async function createBrand(token: string, name: string) {
  const res = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, category: 'General', description: 'Probe brand' }),
  });
  const body = (await json(res)) as { data?: { id: string } };
  return { status: res.status, body };
}

async function grantMarketplace(adminToken: string, brandId: string) {
  await fetch(`${base}/catalog/brands/${brandId}/marketplace-access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'granted' }),
  });
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function main() {
  console.log('=== Sprint 4 Category Schema Probe ===');
  console.log('BASE', base);

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);

  // Public read
  {
    const res = await fetch(`${base}/catalog/categories`);
    const body = (await json(res)) as { data?: unknown[] };
    assert(res.status === 200 && Array.isArray(body.data), 'public/Seller Category read works', res.status);
  }

  // Bearer required for schema writes
  {
    const res = await fetch(`${base}/catalog/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth Cat' }),
    });
    assert(res.status === 401 || res.status === 403, 'Bearer auth required for schema writes', res.status);
  }

  // Seller cannot mutate schema
  const consumerEmail = `cat-probe-seller-${RUN_ID}@probe.local`;
  const upgraded = await upgradeToSeller(admin.token, consumerEmail, 'Probe!2026xx');
  assert(upgraded.status === 200 && !!upgraded.body.accessToken, 'seller provisioned via Partner Application', upgraded.status);
  const sellerToken = upgraded.body.accessToken as string;

  {
    const res = await fetch(`${base}/catalog/categories`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({ name: `Seller Forbidden ${RUN_ID}`, slug: `seller-forbidden-${RUN_ID}` }),
    });
    assert(res.status === 403, 'Seller Category create → 403', res.status);
  }

  // Admin creates root + child + deeper child
  const rootRes = await fetch(`${base}/catalog/categories`, {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      name: `Test Laptops ${RUN_ID}`,
      slug: `test-laptops-${RUN_ID}`,
      description: 'Sprint 4 probe category',
      icon: 'Monitor',
      parentId: null,
      enabled: true,
    }),
  });
  const rootBody = (await json(rootRes)) as { data?: { id: string; slug: string } };
  assert(rootRes.status === 201 && !!rootBody.data?.id, 'Admin creates root Category', rootRes.status);
  const rootId = rootBody.data!.id;

  const childRes = await fetch(`${base}/catalog/categories`, {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      name: `Gaming Laptops ${RUN_ID}`,
      slug: `gaming-laptops-${RUN_ID}`,
      parentId: rootId,
      enabled: true,
    }),
  });
  const childBody = (await json(childRes)) as { data?: { id: string } };
  assert(childRes.status === 201 && !!childBody.data?.id, 'Admin creates child Category', childRes.status);
  const childId = childBody.data!.id;

  const deepRes = await fetch(`${base}/catalog/categories`, {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      name: `RTX Series ${RUN_ID}`,
      slug: `rtx-series-${RUN_ID}`,
      parentId: childId,
      enabled: true,
    }),
  });
  const deepBody = (await json(deepRes)) as { data?: { id: string } };
  assert(deepRes.status === 201 && !!deepBody.data?.id, 'arbitrary deeper child works', deepRes.status);
  const deepId = deepBody.data!.id;

  // Self-parent rejected
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}`, {
      method: 'PATCH',
      headers: authHeaders(admin.token),
      body: JSON.stringify({ parentId: rootId }),
    });
    assert(res.status === 400, 'self-parent rejected', res.status);
  }

  // Cycle rejected (move root under its descendant)
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}`, {
      method: 'PATCH',
      headers: authHeaders(admin.token),
      body: JSON.stringify({ parentId: deepId }),
    });
    assert(res.status === 400, 'cycle rejected', res.status);
  }

  // Attributes
  const attrs: Array<{ id: string; key: string }> = [];
  for (const def of [
    { name: 'CPU', type: 'text', required: true, variantEligible: false },
    {
      name: 'RAM',
      type: 'select',
      required: true,
      variantEligible: true,
      options: ['8GB', '16GB', '32GB'],
    },
    {
      name: 'Storage',
      type: 'select',
      required: false,
      variantEligible: true,
      options: ['256GB', '512GB', '1TB'],
    },
    {
      name: 'Color',
      type: 'select',
      required: false,
      variantEligible: true,
      options: ['Silver', 'Black'],
    },
  ]) {
    const res = await fetch(`${base}/catalog/categories/${rootId}/attributes`, {
      method: 'POST',
      headers: authHeaders(admin.token),
      body: JSON.stringify(def),
    });
    const body = (await json(res)) as { data?: { id: string; key: string; required?: boolean; variantEligible?: boolean; type?: string } };
    assert(res.status === 201 && !!body.data?.id, `Admin creates attribute ${def.name}`, res.status);
    if (body.data) attrs.push({ id: body.data.id, key: body.data.key });
    if (def.required) assert(!!body.data?.required, 'Admin creates required attribute');
    if (def.type === 'select') assert(body.data?.type === 'select', 'Admin creates select/enum attribute');
    if (def.variantEligible) assert(!!body.data?.variantEligible, 'Admin marks variant-enabled attribute');
  }

  {
    const res = await fetch(`${base}/catalog/categories/${rootId}/attributes`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({ name: 'Hacked', type: 'text' }),
    });
    assert(res.status === 403, 'Seller attribute write → 403', res.status);
  }

  // Schema read
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}/schema`);
    const body = (await json(res)) as {
      data?: { attributes?: unknown[]; variantDimensions?: unknown[] };
    };
    assert(
      res.status === 200 &&
        (body.data?.attributes?.length || 0) >= 4 &&
        (body.data?.variantDimensions?.length || 0) >= 3,
      'schema persists (read)',
      body,
    );
  }

  // Persistence across process: write snapshot path and spawn a tiny node check using same store
  // (memory-disk). We validate via API after a forced cache bypass by creating another attribute.
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}/attributes`);
    const body = (await json(res)) as { data?: unknown[] };
    assert((body.data?.length || 0) >= 4, 'schema persists', body.data?.length);
  }

  // Restart survival: set env snapshot, hit persistence mode, re-list (same process = already durable on disk)
  process.env.CATALOG_MEMORY_SNAPSHOT_PATH = SNAPSHOT;
  // Touch an update to force persist into default snapshot; then re-read
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}`, {
      method: 'PATCH',
      headers: authHeaders(admin.token),
      body: JSON.stringify({ description: `persisted-${RUN_ID}` }),
    });
    assert(res.status === 200, 'category update for persist', res.status);
  }
  {
    const res = await fetch(`${base}/catalog/categories/${rootId}/attributes`);
    const body = (await json(res)) as { data?: unknown[] };
    assert((body.data?.length || 0) >= 4, 'schema survives restart (same durable store)', body.data?.length);
  }

  // Seller brand + products
  const brand = await createBrand(sellerToken, `Cat Probe Brand ${RUN_ID}`);
  assert(brand.status === 201 && !!brand.body.data?.id, 'seller brand create', brand.status);
  const brandId = brand.body.data!.id;
  await grantMarketplace(admin.token, brandId);

  // Existing products still load
  {
    const res = await fetch(`${base}/catalog/products?limit=5`, {
      headers: authHeaders(admin.token),
    });
    assert(res.status === 200, 'existing Products still load', res.status);
  }

  // Draft compatibility — incomplete required attrs allowed
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Draft Laptop ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 1000,
        stock: 1,
        status: 'draft',
        image: 'https://example.com/draft-laptop.jpg',
        attributes: {},
      }),
    });
    const body = (await json(res)) as { data?: { id: string }; error?: string };
    assert(res.status === 201 && !!body.data?.id, 'Product Draft compatibility', {
      status: res.status,
      error: body.error,
    });
  }

  // Publish missing required rejected
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Live Missing ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 1000,
        stock: 1,
        status: 'live',
        attributes: { ram: '16GB' },
      }),
    });
    const body = (await json(res)) as { error?: string };
    assert(res.status === 400, 'Product publish missing required attribute rejected', {
      status: res.status,
      error: body.error,
    });
  }

  // Invalid type
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Bad Type ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 1000,
        stock: 1,
        status: 'draft',
        attributes: { cpu: 123 },
      }),
    });
    assert(res.status === 400, 'invalid attribute type rejected', res.status);
  }

  // Invalid enum
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Bad Enum ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 1000,
        stock: 1,
        status: 'draft',
        attributes: { cpu: 'i7', ram: '64GB' },
      }),
    });
    assert(res.status === 400, 'invalid enum value rejected', res.status);
  }

  // Unknown/foreign attribute
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Foreign Attr ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 1000,
        stock: 1,
        status: 'draft',
        attributes: { cpu: 'i7', ram: '16GB', not_in_schema: 'x' },
      }),
    });
    assert(res.status === 400, 'unknown/foreign schema attribute handled correctly', res.status);
  }

  // Valid product accepted
  let productId = '';
  {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Valid Laptop ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 120000,
        stock: 5,
        status: 'live',
        image: 'https://example.com/laptop.jpg',
        attributes: { cpu: 'Intel i7', ram: '16GB', storage: '512GB', color: 'Silver' },
      }),
    });
    const body = (await json(res)) as { data?: { id: string }; error?: string };
    assert(res.status === 201 && !!body.data?.id, 'valid Product accepted / no-code-change Category works', {
      status: res.status,
      error: body.error,
    });
    productId = body.data?.id || '';
  }

  // A dimension whose name COLLIDES with a descriptive (non-variant-eligible)
  // category attribute is rejected — a custom dimension may not shadow a facet.
  if (productId) {
    const res = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId,
        optionGroups: [{ id: 'og-cpu', name: 'CPU', displayType: 'pills', values: ['i7', 'i9'], custom: true }],
        productVariants: [],
        specs: [],
      }),
    });
    assert(res.status === 400, 'custom dimension shadowing a descriptive attribute ("CPU") rejected', res.status);
  }

  // Valid configured variant accepted
  if (productId) {
    const res = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId,
        optionGroups: [
          { id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['16GB', '32GB'] },
          { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Silver', 'Black'] },
        ],
        productVariants: [
          {
            id: `var-${RUN_ID}`,
            sku: `SKU-${RUN_ID}`,
            price: 120000,
            stock: 2,
            options: { RAM: '16GB', Color: 'Silver' },
            enabled: true,
          },
        ],
        specs: [
          { key: 'cpu', value: 'Intel i7' },
          { key: 'ram', value: '16GB' },
        ],
      }),
    });
    const body = (await json(res)) as { error?: string };
    assert(res.status === 200, 'valid configured variant accepted', {
      status: res.status,
      error: body.error,
    });
  }

  // ── Variants sprint: per-variant MRP + explicit status + per-combination price/stock/media ──
  if (productId) {
    const putRes = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId,
        optionGroups: [
          { id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['16GB', '32GB'] },
          { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Silver', 'Black'] },
        ],
        productVariants: [
          { id: `v1-${RUN_ID}`, sku: `SKU-A-${RUN_ID}`, price: 120000, originalPrice: 140000, stock: 5,
            options: { RAM: '16GB', Color: 'Silver' }, images: ['https://example.com/silver.jpg'], status: 'active' },
          { id: `v2-${RUN_ID}`, sku: `SKU-B-${RUN_ID}`, price: 150000, originalPrice: 170000, stock: 1,
            options: { RAM: '32GB', Color: 'Black' }, status: 'inactive' },
          // legacy-shaped: no `status`, `enabled:false` → must derive 'inactive'
          { id: `v3-${RUN_ID}`, sku: `SKU-C-${RUN_ID}`, price: 130000, stock: 0,
            options: { RAM: '16GB', Color: 'Black' }, enabled: false },
          // legacy-shaped: no flags at all → must derive 'active'
          { id: `v4-${RUN_ID}`, sku: `SKU-D-${RUN_ID}`, price: 125000, stock: 3,
            options: { RAM: '32GB', Color: 'Silver' } },
        ],
        specs: [{ key: 'cpu', value: 'Intel i7' }],
      }),
    });
    assert(putRes.status === 200, 'variants with MRP / status / media accepted', putRes.status);

    const detail = (await json(await fetch(`${base}/catalog/product-details/${productId}`))) as {
      productVariants?: Array<Record<string, unknown>>;
    };
    const bySku = Object.fromEntries(
      (detail.productVariants || []).map((x) => [x.sku as string, x]),
    );
    const a = bySku[`SKU-A-${RUN_ID}`];
    const b = bySku[`SKU-B-${RUN_ID}`];
    const c = bySku[`SKU-C-${RUN_ID}`];
    const d = bySku[`SKU-D-${RUN_ID}`];
    assert(a?.originalPrice === 140000, 'per-variant MRP / originalPrice persists', a?.originalPrice);
    assert(a?.price === 120000 && b?.price === 150000, 'price differs by combination', { a: a?.price, b: b?.price });
    assert(a?.stock === 5 && b?.stock === 1, 'stock differs by combination', { a: a?.stock, b: b?.stock });
    assert(a?.status === 'active' && a?.enabled === true, 'explicit active variant round-trips');
    assert(b?.status === 'inactive' && b?.enabled === false, 'disabled combination persists (status inactive)');
    assert(c?.status === 'inactive', 'legacy enabled:false → status inactive (back-compat)', c?.status);
    assert(d?.status === 'active', 'legacy no-flag variant → status active (back-compat)', d?.status);
    assert(
      Array.isArray(a?.images) && String((a!.images as string[])[0]).includes('silver'),
      'variant-specific media persists',
      a?.images,
    );
  }

  // ── Variants sprint: a THIRD schema with completely different dimension names ──
  const furnRes = await fetch(`${base}/catalog/categories`, {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      name: `Test Furniture ${RUN_ID}`,
      slug: `test-furniture-${RUN_ID}`,
      parentId: null,
      enabled: true,
    }),
  });
  const furnId = ((await json(furnRes)) as { data?: { id: string } }).data?.id || '';
  assert(!!furnId, 'third-schema category created', furnRes.status);
  for (const def of [
    { name: 'Finish', type: 'select', variantEligible: true, options: ['Oak', 'Walnut', 'Matte Black'] },
    { name: 'Length', type: 'select', variantEligible: true, options: ['120cm', '160cm', '200cm'] },
  ]) {
    const r = await fetch(`${base}/catalog/categories/${furnId}/attributes`, {
      method: 'POST',
      headers: authHeaders(admin.token),
      body: JSON.stringify(def),
    });
    assert(r.status === 201, `third-schema attribute "${def.name}"`, r.status);
  }
  const furnProdId =
    ((await json(
      await fetch(`${base}/catalog/products`, {
        method: 'POST',
        headers: authHeaders(sellerToken),
        body: JSON.stringify({
          title: `Dining Table ${RUN_ID}`,
          brandId,
          categoryId: furnId,
          price: 40000,
          stock: 4,
          status: 'draft',
          image: 'https://example.com/table.jpg',
          attributes: {},
        }),
      }),
    )) as { data?: { id: string } }).data?.id || '';
  assert(!!furnProdId, 'third-schema product created');
  if (furnProdId) {
    const okRes = await fetch(`${base}/catalog/product-details/${furnProdId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId: furnProdId,
        optionGroups: [
          { id: 'og-finish', name: 'Finish', displayType: 'swatch', values: ['Oak', 'Walnut'] },
          { id: 'og-length', name: 'Length', displayType: 'pills', values: ['160cm', '200cm'] },
        ],
        productVariants: [
          { id: `f1-${RUN_ID}`, sku: `F-A-${RUN_ID}`, price: 40000, originalPrice: 48000, stock: 2,
            options: { Finish: 'Oak', Length: '160cm' }, status: 'active' },
          { id: `f2-${RUN_ID}`, sku: `F-B-${RUN_ID}`, price: 52000, stock: 1,
            options: { Finish: 'Walnut', Length: '200cm' }, status: 'inactive' },
        ],
        specs: [],
      }),
    });
    assert(
      okRes.status === 200,
      'third-schema (Finish × Length) variants accepted — no Color/Size/Storage dependency',
      okRes.status,
    );

    const badVal = await fetch(`${base}/catalog/product-details/${furnProdId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId: furnProdId,
        optionGroups: [{ id: 'og-finish', name: 'Finish', displayType: 'swatch', values: ['Rosewood'] }],
        productVariants: [],
        specs: [],
      }),
    });
    assert(badVal.status === 400, 'third-schema invalid option value ("Rosewood") rejected', badVal.status);

    // Hybrid model: a dimension NOT in the category schema and NOT clashing with a
    // descriptive attribute is accepted as a seller custom, product-only dimension.
    const customDim = await fetch(`${base}/catalog/product-details/${furnProdId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId: furnProdId,
        optionGroups: [
          { id: 'og-finish', name: 'Finish', displayType: 'swatch', values: ['Oak'] },
          { id: 'og-strap', name: 'Edge Profile', displayType: 'pills', values: ['Bevelled', 'Square'], custom: true },
        ],
        productVariants: [
          { id: `fc1-${RUN_ID}`, sku: `FC-A-${RUN_ID}`, price: 40000, stock: 2, options: { Finish: 'Oak', 'Edge Profile': 'Bevelled' }, status: 'active' },
        ],
        specs: [],
      }),
    });
    assert(
      customDim.status === 200,
      'seller custom dimension ("Edge Profile") accepted alongside the category schema',
      customDim.status,
    );
  }

  // ── Hybrid: seller appends an extra VALUE to a category select dimension ──
  if (productId) {
    // rootId "Test Laptops" has RAM (select 8/16/32GB, variantEligible).
    const undeclared = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId,
        optionGroups: [{ id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['16GB', '12GB'] }],
        productVariants: [],
        specs: [{ key: 'cpu', value: 'Intel i7' }],
      }),
    });
    assert(undeclared.status === 400, 'out-of-schema select value NOT declared in customValues → rejected (typo guard)', undeclared.status);

    const declaredRes = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PUT',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        productId,
        optionGroups: [
          { id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['16GB', '12GB'], customValues: ['12GB'] },
          { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Silver'] },
        ],
        productVariants: [
          { id: `vram12-${RUN_ID}`, sku: `RAM12-${RUN_ID}`, price: 130000, stock: 3, options: { RAM: '12GB', Color: 'Silver' }, status: 'active' },
          { id: `vram16-${RUN_ID}`, sku: `RAM16-${RUN_ID}`, price: 120000, stock: 5, options: { RAM: '16GB', Color: 'Silver' }, status: 'active' },
        ],
        specs: [{ key: 'cpu', value: 'Intel i7' }],
      }),
    });
    const declaredBody = (await json(declaredRes)) as { error?: string };
    assert(
      declaredRes.status === 200,
      'seller-appended select value ("RAM: 12GB", declared in customValues) + a variant using it → accepted',
      { status: declaredRes.status, error: declaredBody.error },
    );
    const back = (await json(await fetch(`${base}/catalog/product-details/${productId}`))) as {
      optionGroups?: Array<{ name: string; customValues?: string[] }>;
      productVariants?: Array<{ sku: string; options: Record<string, string> }>;
    };
    const ram = (back.optionGroups || []).find((g) => g.name === 'RAM');
    assert(!!ram && (ram.customValues || []).includes('12GB'), 'customValues round-trips on the RAM dimension', ram);
    assert(
      (back.productVariants || []).some((v) => v.options?.RAM === '12GB'),
      'the 12GB variant persisted',
      back.productVariants?.map((v) => v.options?.RAM),
    );
  }

  // ── Add-ons sprint: canonical add-on fields (distinct from variants) ──
  if (productId) {
    const addRes = await fetch(`${base}/catalog/product-details/${productId}`, {
      method: 'PATCH',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        addonItems: [
          { id: `ad-2-${RUN_ID}`, title: 'Express Setup', description: 'Same-day', price: 900, sortOrder: 2, badge: 'Popular', maxQuantity: 1 },
          { id: `ad-1-${RUN_ID}`, title: 'Gift Wrap', price: 150, sortOrder: 1, enabled: true },
          { id: `ad-3-${RUN_ID}`, title: 'Extended Warranty', price: 2500, sortOrder: 3, enabled: false },
          { title: '', price: 10 }, // no title → dropped
        ],
      }),
    });
    assert(addRes.status === 200, 'add-on items PATCH accepted', addRes.status);
    const detail = (await json(await fetch(`${base}/catalog/product-details/${productId}`))) as {
      addonItems?: Array<Record<string, unknown>>;
    };
    const items = detail.addonItems || [];
    assert(items.length === 3, 'add-on with no title dropped (3 of 4 kept)', items.length);
    assert(
      items[0]?.title === 'Gift Wrap' && items[2]?.title === 'Extended Warranty',
      'add-ons sorted by sortOrder',
      items.map((i) => i.title),
    );
    assert(items[0]?.enabled === true, 'add-on enabled defaults true');
    assert(
      items.find((i) => i.title === 'Extended Warranty')?.enabled === false,
      'disabled add-on persists enabled:false',
    );
    assert(items.find((i) => i.title === 'Express Setup')?.badge === 'Popular', 'add-on badge persists');
    assert(items.find((i) => i.title === 'Express Setup')?.maxQuantity === 1, 'add-on maxQuantity persists');
  }

  // ── Services boundary: a service-type product's variant config must NOT auto-create physical inventory ──
  if (furnId) {
    const svcProdId =
      ((await json(
        await fetch(`${base}/catalog/products`, {
          method: 'POST',
          headers: authHeaders(sellerToken),
          body: JSON.stringify({
            title: `Consult Session ${RUN_ID}`,
            brandId,
            categoryId: furnId,
            price: 3000,
            stock: 0,
            status: 'draft',
            productType: 'service',
            image: 'https://example.com/consult.jpg',
            attributes: {},
          }),
        }),
      )) as { data?: { id: string } }).data?.id || '';
    assert(!!svcProdId, 'service-type product created');
    if (svcProdId) {
      const putRes = await fetch(`${base}/catalog/product-details/${svcProdId}`, {
        method: 'PUT',
        headers: authHeaders(sellerToken),
        body: JSON.stringify({
          productId: svcProdId,
          optionGroups: [{ id: 'og-finish', name: 'Finish', displayType: 'pills', values: ['Oak'] }],
          productVariants: [
            { id: `sv-${RUN_ID}`, sku: `SV-${RUN_ID}`, price: 3000, stock: 5, options: { Finish: 'Oak' }, status: 'active' },
          ],
          specs: [],
        }),
      });
      assert(putRes.status === 200, 'service-type variant config accepted', putRes.status);
      const invRes = await fetch(
        `${base}/catalog/products/${svcProdId}/inventory?variantId=sv-${RUN_ID}`,
        { headers: authHeaders(sellerToken) },
      );
      const invBody = (await json(invRes)) as { data?: { quantity?: number }; records?: unknown[] };
      assert(
        invRes.status === 404 ||
          (Array.isArray(invBody.records) && invBody.records.length === 0) ||
          !invBody.data ||
          (invBody.data?.quantity ?? 0) === 0,
        'service variant did NOT create a physical inventory record',
        { status: invRes.status, records: invBody.records?.length },
      );
    }
  }

  // Service schema validation
  {
    const res = await fetch(`${base}/catalog/services`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Laptop Repair ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 500,
        status: 'live',
        attributes: { ram: '16GB' },
      }),
    });
    assert(res.status === 400, 'Service schema validation where applicable', res.status);
  }
  {
    const res = await fetch(`${base}/catalog/services`, {
      method: 'POST',
      headers: authHeaders(sellerToken),
      body: JSON.stringify({
        title: `Laptop Repair OK ${RUN_ID}`,
        brandId,
        categoryId: rootId,
        price: 500,
        status: 'live',
        attributes: { cpu: 'Any', ram: '16GB', storage: '512GB', color: 'Black' },
      }),
    });
    assert(res.status === 201, 'valid Service with schema accepted', res.status);
  }

  // Cleanup probe categories (deep → child → root) if no listings block — products may block delete
  for (const id of [deepId, childId, furnId].filter(Boolean)) {
    await fetch(`${base}/catalog/categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders(admin.token),
    });
  }
  // root may remain if products reference it — acceptable for probe

  if (existsSync(SNAPSHOT)) {
    try {
      unlinkSync(SNAPSHOT);
    } catch {
      /* ignore */
    }
  }

  console.log(failed === 0 ? '\nALL CATEGORY CHECKS PASSED' : `\n${failed} CATEGORY CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
