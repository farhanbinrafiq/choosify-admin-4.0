/**
 * Sprint 3 final-pass API checks: multi-brand scope + lifecycle/stock consistency.
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const RUN_ID = Date.now();
let failed = 0;
function assert(c: boolean, label: string, d?: unknown) {
  if (c) console.log('PASS', label);
  else {
    failed++;
    console.log('FAIL', label, d ?? '');
  }
}
async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function main() {
  const reg = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `probe.final.${RUN_ID}@choosify.test`,
      password: 'Probe!2026xx',
      fullName: 'Final Probe',
    }),
  });
  const regBody = (await json(reg)) as { customToken?: string };
  const up = await fetch(`${base}/auth/upgrade-to-seller`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regBody.customToken}`,
    },
    body: JSON.stringify({
      storeName: `Final ${RUN_ID}`,
      phone: '+8801711222333',
      category: 'General',
      city: 'Dhaka',
    }),
  });
  const upBody = (await json(up)) as { accessToken?: string };
  const token = upBody.accessToken!;
  const adminLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@choosify.com.bd', password: DEV_PASSWORD }),
  });
  const admin = (await json(adminLogin)) as { accessToken?: string };

  const mkBrand = async (name: string) => {
    const res = await fetch(`${base}/catalog/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, category: 'General' }),
    });
    const body = (await json(res)) as { data?: { id: string } };
    return body.data!.id;
  };
  const brandA = await mkBrand(`Final Brand A ${RUN_ID}`);
  const brandB = await mkBrand(`Final Brand B ${RUN_ID}`);
  const cats = (await json(await fetch(`${base}/catalog/categories`))) as {
    data?: Array<{ id: string }>;
  };
  const categoryId = cats.data![0].id;

  const createProd = async (brandId: string, title: string) => {
    const res = await fetch(`${base}/catalog/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title,
        description: 'final',
        image: 'https://example.com/x.jpg',
        gallery: ['https://example.com/x.jpg'],
        price: 10,
        stock: 3,
        status: 'draft',
        brandId,
        categoryId,
      }),
    });
    const body = (await json(res)) as { data?: { id: string; brandId: string } };
    return body.data!;
  };

  const prodA = await createProd(brandA, `Product A ${RUN_ID}`);
  const listA = (await json(
    await fetch(`${base}/catalog/products?brandId=${brandA}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )) as { data?: Array<{ id: string }> };
  assert(
    !!listA.data?.some((p) => p.id === prodA.id) && listA.data.every((p) => p.id !== 'never'),
    'Brand A scope lists Product A',
  );

  const listBempty = (await json(
    await fetch(`${base}/catalog/products?brandId=${brandB}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )) as { data?: Array<{ id: string }> };
  assert(!listBempty.data?.some((p) => p.id === prodA.id), 'Product A does not leak into Brand B');

  const prodB = await createProd(brandB, `Product B ${RUN_ID}`);
  const listB = (await json(
    await fetch(`${base}/catalog/products?brandId=${brandB}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )) as { data?: Array<{ id: string }> };
  assert(
    !!listB.data?.some((p) => p.id === prodB.id) && !listB.data?.some((p) => p.id === prodA.id),
    'Brand B shows Product B only',
  );

  const listA2 = (await json(
    await fetch(`${base}/catalog/products?brandId=${brandA}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )) as { data?: Array<{ id: string }> };
  assert(
    !!listA2.data?.some((p) => p.id === prodA.id) && !listA2.data?.some((p) => p.id === prodB.id),
    'Switch back to Brand A: Product A returns, B absent',
  );

  // Archived + restock stays archived
  await fetch(`${base}/catalog/brands/${brandA}/marketplace-access`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
    body: JSON.stringify({ status: 'granted' }),
  });
  await fetch(`${base}/catalog/products/${prodA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'live' }),
  });
  await fetch(`${base}/catalog/products/${prodA.id}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const archRestock = await fetch(`${base}/catalog/products/${prodA.id}/inventory`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quantity: 50 }),
  });
  const archBody = (await json(archRestock)) as { product?: { status: string } };
  assert(
    archRestock.status === 200 && archBody.product?.status === 'archived',
    'Archived + restock stays Archived',
    archBody.product,
  );

  // Mock leakage: seller list has no seed samsung without sellerId
  const sellerList = (await json(
    await fetch(`${base}/catalog/products`, { headers: { Authorization: `Bearer ${token}` } }),
  )) as { data?: Array<{ id: string; sellerId?: string; title: string }> };
  assert(
    (sellerList.data || []).every((p) => p.sellerId) &&
      !(sellerList.data || []).some((p) => p.id.startsWith('prod-s24')),
    'Seller list does not leak seed Products',
    sellerList.data?.map((p) => p.id),
  );

  const mode = (await json(await fetch(`${base}/catalog/persistence-mode`))) as { mode?: string };
  assert(mode.mode === 'memory-disk' || mode.mode === 'firestore-admin', 'Persistence mode reported', mode);

  if (failed) {
    console.error('Final API checks FAILED', failed);
    process.exit(1);
  }
  console.log('Final API checks PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
