/**
 * Sprint 3 persistence probe — create catalog entities, restart API process,
 * confirm Product / Inventory / Variants / Service survive.
 *
 * Works against memory-disk (.data/catalog-memory-snapshot.json) or Firestore.
 *
 * Usage: npx tsx scripts/probe-catalog-persistence.ts
 * Or:    npm run test:catalog-persist
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const RUN_ID = Date.now();
const PORT = 3001;

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) console.log('PASS', label);
  else {
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
  if (!res.ok || !body.accessToken) throw new Error(`login failed: ${res.status}`);
  return { token: body.accessToken as string, uid: body.uid as string };
}

/**
 * Sprint 10: /auth/upgrade-to-seller is intentionally disabled (403
 * PARTNER_APPLICATION_REQUIRED). Canonical onboarding is now:
 * partner-apply -> Admin identity approval -> login as the provisioned Seller.
 */
async function registerSeller() {
  const email = `probe.persist.${RUN_ID}@choosify.test`;
  const password = 'Probe!2026xx';
  const apply = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller',
      email,
      password,
      displayName: 'Persist Probe',
      businessOrChannelName: `Persist Store ${RUN_ID}`,
      phone: '+8801711999888',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  if (!apply.ok) throw new Error(`partner-apply failed: ${apply.status}`);

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const listRes = await fetch(`${base}/operations/partner-applications?status=pending`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const listBody = (await json(listRes)) as { applications?: Array<{ id: string; email?: string }> };
  const app = (listBody.applications || []).find((a) => a.email === email);
  if (!app) throw new Error(`pending partner application missing for ${email}`);
  const approve = await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ note: 'catalog persistence probe' }),
  });
  if (!approve.ok) throw new Error(`approve failed: ${approve.status}`);

  const seller = await login(email, password);
  // Legacy upgrade-to-seller self-granted Marketplace Access instantly; the real
  // lifecycle needs this Admin action explicitly before the seller can create brands.
  const ownBrands = await fetch(`${base}/catalog/brands`, { headers: { Authorization: `Bearer ${seller.token}` } });
  const ownBrandsBody = (await json(ownBrands)) as { data?: Array<{ id: string }> };
  const ownBrandId = ownBrandsBody.data?.[0]?.id;
  if (ownBrandId) {
    await fetch(`${base}/catalog/brands/${encodeURIComponent(ownBrandId)}/marketplace-access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ status: 'granted' }),
    });
  }
  return seller.token;
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

async function main() {
  const modeRes = await fetch(`${base}/catalog/persistence-mode`);
  const modeBody = (await json(modeRes)) as { mode?: string };
  console.log('Persistence mode:', modeBody.mode || 'unknown');

  const sellerToken = await registerSeller();
  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);

  const brandRes = await fetch(`${base}/catalog/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ name: `Persist Brand ${RUN_ID}`, category: 'General' }),
  });
  const brandBody = (await json(brandRes)) as { data?: { id: string } };
  assert(brandRes.status === 201 && !!brandBody.data?.id, 'Create Brand for persistence fixture', brandRes.status);
  const brandId = brandBody.data!.id;

  await fetch(`${base}/catalog/brands/${brandId}/marketplace-access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'granted' }),
  });

  const cats = (await json(await fetch(`${base}/catalog/categories`))) as {
    data?: Array<{ id: string }>;
  };
  const categoryId = cats.data![0].id;

  const prodRes = await fetch(`${base}/catalog/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      title: `Persist Product ${RUN_ID}`,
      description: 'persistence fixture',
      image: 'https://example.com/p.jpg',
      gallery: ['https://example.com/p.jpg'],
      price: 500,
      stock: 12,
      status: 'draft',
      brandId,
      categoryId,
    }),
  });
  const prodBody = (await json(prodRes)) as { data?: { id: string } };
  assert(prodRes.status === 201 && !!prodBody.data?.id, '1. Create Product', prodBody);
  const productId = prodBody.data!.id;

  const invRes = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ quantity: 42, sku: `PERSIST-${RUN_ID}` }),
  });
  const invBody = (await json(invRes)) as { data?: { availableQuantity: number; sku?: string } };
  assert(invRes.status === 200 && invBody.data?.availableQuantity === 42, '2. Set inventory', invBody);

  const variantId = `var-persist-${RUN_ID}`;
  const detailRes = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      productId,
      specs: [],
      pros: [],
      cons: [],
      bestForTags: [],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [{ id: 'og-c', name: 'Color', displayType: 'swatch', values: ['Red'] }],
      productVariants: [
        { id: variantId, sku: `V-${RUN_ID}`, price: 510, stock: 8, options: { Color: 'Red' } },
      ],
      creatorContent: [],
    }),
  });
  assert(detailRes.status === 200, '3. Create variant', detailRes.status);

  const varInv = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ variantId, quantity: 8 }),
  });
  assert(varInv.status === 200, '4. Set variant stock', varInv.status);

  const svcRes = await fetch(`${base}/catalog/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      title: `Persist Service ${RUN_ID}`,
      brandId,
      categoryId,
      price: 200,
      status: 'draft',
      description: 'persist me',
    }),
  });
  const svcBody = (await json(svcRes)) as { data?: { id: string } };
  assert(svcRes.status === 201 && !!svcBody.data?.id, '5. Create Service', svcBody);
  const serviceId = svcBody.data!.id;

  // Allow memory-disk debounce flush
  await delay(800);

  console.log('Restarting API server on port', PORT, '…');
  await killPort(PORT);
  await delay(2000);

  const child = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  child.unref();

  await waitForHealth();
  console.log('Server healthy after restart');

  const productAfter = await fetch(`${base}/catalog/products/${productId}`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const productAfterBody = (await json(productAfter)) as { id?: string; title?: string };
  assert(
    productAfter.status === 200 && productAfterBody.id === productId,
    '9. Product still exists after restart',
    productAfterBody,
  );

  const invAfter = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const invAfterBody = (await json(invAfter)) as {
    data?: { availableQuantity: number };
    records?: Array<{ variantId?: string; availableQuantity: number }>;
  };
  assert(
    invAfter.status === 200 &&
      (invAfterBody.records?.some((r) => !r.variantId && r.availableQuantity === 42) ||
        invAfterBody.data?.availableQuantity === 42),
    '10. Inventory remains after restart',
    invAfterBody,
  );

  const detailAfter = await fetch(`${base}/catalog/product-details/${productId}`);
  const detailAfterBody = (await json(detailAfter)) as {
    productVariants?: Array<{ id: string; stock?: number }>;
  };
  assert(
    detailAfter.status === 200 &&
      detailAfterBody.productVariants?.some((v) => v.id === variantId),
    '11. Variant remains after restart',
    detailAfterBody.productVariants,
  );

  const varInvAfter = await fetch(
    `${base}/catalog/products/${productId}/inventory?variantId=${encodeURIComponent(variantId)}`,
    { headers: { Authorization: `Bearer ${sellerToken}` } },
  );
  const varInvAfterBody = (await json(varInvAfter)) as { data?: { availableQuantity: number } };
  assert(
    varInvAfter.status === 200 && varInvAfterBody.data?.availableQuantity === 8,
    '12. Variant inventory remains after restart',
    varInvAfterBody,
  );

  const svcAfter = await fetch(`${base}/catalog/services/${serviceId}`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const svcAfterBody = (await json(svcAfter)) as { id?: string };
  assert(
    svcAfter.status === 200 && svcAfterBody.id === serviceId,
    '13. Service remains after restart',
    svcAfterBody,
  );

  // Lifecycle consistency: suspended + restock stays suspended
  await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ status: 'live' }),
  });
  await fetch(`${base}/catalog/products/${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ status: 'suspended' }),
  });
  const restockSuspended = await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ quantity: 99 }),
  });
  const restockSuspendedBody = (await json(restockSuspended)) as { product?: { status: string } };
  assert(
    restockSuspended.status === 200 && restockSuspendedBody.product?.status === 'suspended',
    'Suspended + restock stays Suspended',
    restockSuspendedBody.product,
  );

  if (failed > 0) {
    console.error(`\nPersistence probe FAILED (${failed})`);
    process.exit(1);
  }
  console.log('\nPersistence probe PASSED');
}

main().catch((err) => {
  console.error('Persistence probe crashed:', err);
  process.exit(1);
});
