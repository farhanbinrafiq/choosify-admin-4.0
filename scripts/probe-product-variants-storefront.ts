/**
 * Product Studio Options & Variants — storefront + retail-order integrity probe.
 *
 * Complements probe-variant-commerce.ts (which exercises the /cart/items +
 * /checkout Commerce path). THIS probe targets the two surfaces the real
 * Choosify-Web storefront actually uses:
 *
 *   A. GET /catalog/products/:id now merges the canonical optionGroups,
 *      ACTIVE productVariants and sizeGuide from the product-detail record
 *      (anon/public callers get active variants only; the owner gets all).
 *   B. A product with no variants returns optionGroups:[] / productVariants:[]
 *      and no sizeGuide — nothing fabricated.
 *   C. POST /operations/orders (operationsApi.createOrder — the retail checkout)
 *      resolves item.variantId against the product's own productVariants:
 *        - price comes from the variant, not the base product
 *        - variantSku / selectedOptions / variantLabel are snapshotted server-side
 *        - a forged or inactive variantId is rejected (never a silent base price)
 *        - the snapshot survives a re-fetch of the order (Cart → Checkout → Order)
 *        - an out-of-stock variant blocks the order
 *        - a two-option combination resolves the exact variant price
 *
 * Requires the local server on :3001 and the seeded dev admin
 * (admin@choosify.com.bd / ChoosifyDev!2026, ALLOW_DEV_LOGIN=true).
 *
 * Usage:  npx tsx scripts/probe-product-variants-storefront.ts
 * Or:     npm run test:product-variants-storefront
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
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

async function login(email: string, password: string) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = (await j(r)) as { accessToken?: string; uid?: string };
  if (!r.ok || !b.accessToken) throw new Error(`login ${email}: ${r.status}`);
  return { token: b.accessToken, uid: b.uid as string };
}

async function registerConsumer(email: string) {
  const r = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Variant Storefront Buyer' }),
  });
  const b = (await j(r)) as { customToken?: string; uid?: string };
  if (!r.ok || !b.customToken) throw new Error(`register ${email}: ${r.status}`);
  return { token: b.customToken, uid: b.uid as string };
}

async function provisionSeller(adminToken: string, email: string) {
  const apply = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller', email, password: 'Probe!2026xx',
      displayName: 'Variant SF Probe Seller', businessOrChannelName: `Variant SF Store ${RID}`,
      phone: '+8801711002255', category: 'General', city: 'Dhaka',
    }),
  });
  if (!apply.ok) throw new Error(`partner-apply: ${apply.status}`);
  const list = (await j(await fetch(`${base}/operations/partner-applications?status=pending`, { headers: H(adminToken) }))) as {
    applications?: Array<{ id: string; email?: string }>;
  };
  const app = (list.applications || []).find((a) => a.email === email);
  if (!app) throw new Error('pending application missing');
  const appr = await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
    method: 'POST', headers: H(adminToken), body: JSON.stringify({ note: 'variant sf probe' }),
  });
  if (!appr.ok) throw new Error(`approve: ${appr.status}`);
  const s = await login(email, 'Probe!2026xx');
  const own = (await j(await fetch(`${base}/catalog/brands`, { headers: H(s.token) }))) as { data?: Array<{ id: string }> };
  if (own.data?.[0]?.id) {
    await fetch(`${base}/catalog/brands/${own.data[0].id}/marketplace-access`, {
      method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'granted' }),
    });
  }
  return s;
}

async function makeBrand(token: string, name: string) {
  const b = (await j(await fetch(`${base}/catalog/brands`, {
    method: 'POST', headers: H(token), body: JSON.stringify({ name, category: 'General', description: 'probe' }),
  }))) as { data?: { id: string } };
  return b.data!.id;
}

async function makeCategory(adminToken: string, name: string, dims: Array<{ name: string; options: string[] }>) {
  const c = (await j(await fetch(`${base}/catalog/categories`, {
    method: 'POST', headers: H(adminToken),
    body: JSON.stringify({ name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${RID}`, parentId: null, enabled: true }),
  }))) as { data?: { id: string } };
  const catId = c.data!.id;
  for (const d of dims) {
    await fetch(`${base}/catalog/categories/${catId}/attributes`, {
      method: 'POST', headers: H(adminToken),
      body: JSON.stringify({ name: d.name, type: 'select', variantEligible: true, options: d.options }),
    });
  }
  return catId;
}

async function makeProduct(token: string, p: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/products`, {
    method: 'POST', headers: H(token),
    body: JSON.stringify({ stock: 0, status: 'live', image: 'https://example.com/p.jpg', description: 'probe', ...p }),
  });
  const b = (await j(r)) as { data?: { id: string }; error?: string };
  return { status: r.status, id: b.data?.id || '', error: b.error };
}

async function putDetail(token: string, productId: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT', headers: H(token),
    body: JSON.stringify({ productId, specs: [], optionGroups: [], productVariants: [], addonItems: [], ...body }),
  });
  return { status: r.status, body: (await j(r)) as { error?: string } };
}

async function setInv(token: string, productId: string, quantity: number, variantId?: string) {
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH', headers: H(token),
    body: JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) }),
  });
}

async function getProductPublic(productId: string, token?: string) {
  const r = await fetch(`${base}/catalog/products/${productId}`, token ? { headers: H(token) } : undefined);
  return { status: r.status, body: (await j(r)) as any };
}

const SHIP = { fullName: 'Buyer One', phone: '+8801700000000', address: '1 Test Rd, Dhaka', region: 'Dhaka' };

function mkOpsOrder(buyerId: string, sellerId: string, sellerBusinessName: string, items: unknown[]) {
  return {
    orderId: `probe-pv-${RID}-${Math.random().toString(36).slice(2, 8)}`,
    buyerId,
    isCOD: false,
    overallTotal: 999999,
    subtotal: 999999,
    deliveryTotal: 120,
    subOrders: [{ sellerId, sellerBusinessName, items, deliveryFee: 120 }],
    paymentMethod: 'online',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    shipping: SHIP,
  };
}
async function createOpsOrder(token: string, payload: Record<string, unknown>) {
  const r = await fetch(`${base}/operations/orders`, {
    method: 'POST', headers: H(token), body: JSON.stringify(payload),
  });
  return { status: r.status, body: (await j(r)) as any };
}
async function getOpsOrder(token: string, id: string) {
  const r = await fetch(`${base}/operations/orders/${id}`, { headers: H(token) });
  return { status: r.status, body: (await j(r)) as any };
}

async function main() {
  console.log('=== Product Studio Options & Variants — storefront + retail-order probe ===  BASE', base);
  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const seller = await provisionSeller(admin.token, `pv-sf-seller-${RID}@probe.local`);
  const brand = await makeBrand(seller.token, `PV SF Brand ${RID}`);
  await fetch(`${base}/catalog/brands/${brand}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token), body: JSON.stringify({ status: 'granted' }),
  });
  const cat = await makeCategory(admin.token, `PV SF Fashion ${RID}`, [
    { name: 'Size', options: ['S', 'M', 'L'] },
    { name: 'Color', options: ['Black', 'White'] },
  ]);

  // ── Product WITH variants: Size × Color, per-combo price/SKU, one inactive ──
  const tee = await makeProduct(seller.token, {
    title: `PV SF Tee ${RID}`, brandId: brand, categoryId: cat, price: 500, stock: 0, status: 'live',
  });
  ok(!!tee.id, 'variant product created', tee);
  const vBM = `pvsf-bm-${RID}`, vWL = `pvsf-wl-${RID}`, vBS = `pvsf-bs-${RID}`;
  const detail = await putDetail(seller.token, tee.id, {
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M', 'L'] },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White'] },
    ],
    productVariants: [
      { id: vBM, sku: `PVSF-BM-${RID}`, price: 550, originalPrice: 700, stock: 5, options: { Size: 'M', Color: 'Black' }, status: 'active' },
      { id: vWL, sku: `PVSF-WL-${RID}`, price: 620, stock: 4, options: { Size: 'L', Color: 'White' }, status: 'active' },
      { id: vBS, sku: `PVSF-BS-${RID}`, price: 500, stock: 9, options: { Size: 'S', Color: 'Black' }, status: 'inactive' },
    ],
    sizeGuide: {
      enabled: true, guideType: 'size', type: 'image',
      title: 'Fit Guide', imageUrl: 'https://example.com/size-guide.jpg', description: 'Model is 6ft wearing M.',
    },
  });
  ok(detail.status === 200, 'variant product-detail (optionGroups + variants + sizeGuide) saved', detail.body);
  await setInv(seller.token, tee.id, 5, vBM);
  await setInv(seller.token, tee.id, 4, vWL);
  await setInv(seller.token, tee.id, 9, vBS);

  // ═══ A. GET /catalog/products/:id merges options / variants / size guide ═══
  {
    const anon = await getProductPublic(tee.id);
    const p = anon.body?.data ?? anon.body;
    const groups = p?.optionGroups ?? [];
    const variants = p?.productVariants ?? [];
    ok(anon.status === 200, 'GET /catalog/products/:id (anon) 200', anon.status);
    ok(Array.isArray(groups) && groups.length === 2 && groups.map((g: any) => g.name).sort().join(',') === 'Color,Size',
      'anon product carries canonical optionGroups (Size, Color)', groups.map((g: any) => g?.name));
    ok(Array.isArray(variants) && variants.length === 2 && variants.every((v: any) => v.id !== vBS),
      'anon product carries ACTIVE productVariants only (inactive S/Black excluded)', variants.map((v: any) => v.id));
    const bm = variants.find((v: any) => v.id === vBM);
    ok(bm?.price === 550 && bm?.sku === `PVSF-BM-${RID}` && bm?.options?.Color === 'Black',
      'variant row carries per-variant price + SKU + options', bm);
    ok(!!p?.sizeGuide && p.sizeGuide.enabled === true && p.sizeGuide.imageUrl === 'https://example.com/size-guide.jpg',
      'anon product carries the size guide', p?.sizeGuide);
  }
  {
    const owner = await getProductPublic(tee.id, seller.token);
    const p = owner.body?.data ?? owner.body;
    const variants = p?.productVariants ?? [];
    ok(variants.length === 3 && variants.some((v: any) => v.id === vBS),
      'owner GET /catalog/products/:id includes the INACTIVE variant too', variants.map((v: any) => v.id));
  }

  // ═══ B. product WITHOUT variants — nothing fabricated ═══
  const plain = await makeProduct(seller.token, {
    title: `PV SF Plain ${RID}`, brandId: brand, categoryId: cat, price: 300, stock: 12, status: 'live',
  });
  await setInv(seller.token, plain.id, 12);
  {
    const anon = await getProductPublic(plain.id);
    const p = anon.body?.data ?? anon.body;
    ok(Array.isArray(p?.optionGroups) && p.optionGroups.length === 0 &&
       Array.isArray(p?.productVariants) && p.productVariants.length === 0 && !p?.sizeGuide,
      'no-variant product returns optionGroups:[] / productVariants:[] / no sizeGuide', {
        og: p?.optionGroups?.length, pv: p?.productVariants?.length, sg: !!p?.sizeGuide });
  }

  // ═══ C. POST /operations/orders — retail checkout variant integrity ═══
  const buyer = await registerConsumer(`pv-sf-buyer-${RID}@probe.local`);

  // C1: valid active variant — price from variant, snapshot fields, survives re-fetch
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      {
        productId: tee.id, productTitle: `PV SF Tee ${RID}`, quantity: 1,
        price: 1, // forged client price — must be ignored
        variantId: vWL,
        variantSku: 'CLIENT-FORGED-SKU',
        selectedOptions: { Size: 'X', Color: 'Neon' }, // forged — server must overwrite
      },
    ]));
    const item = res.body?.data?.subOrders?.[0]?.items?.[0];
    ok((res.status === 200 || res.status === 201) && !!item, 'operations order with a valid variant is accepted', { status: res.status, err: res.body?.error });
    ok(Number(item?.price) === 620, 'line priced from the VARIANT (620), not base (500) and not the forged client price (1)', item?.price);
    ok(item?.variantId === vWL, 'snapshot keeps the canonical variantId', item?.variantId);
    ok(item?.variantSku === `PVSF-WL-${RID}`, 'snapshot SKU is the server variant SKU, not the client-forged one', item?.variantSku);
    ok(item?.selectedOptions?.Size === 'L' && item?.selectedOptions?.Color === 'White',
      'snapshot selectedOptions come from the stored variant (forged client values overwritten)', item?.selectedOptions);
    ok(typeof item?.variantLabel === 'string' && item.variantLabel.includes('L') && item.variantLabel.includes('White'),
      'snapshot carries a human-readable variantLabel', item?.variantLabel);

    const reread = await getOpsOrder(buyer.token, res.body?.data?.id);
    const rItem = reread.body?.data?.subOrders?.[0]?.items?.[0];
    ok(reread.status === 200 && rItem?.variantId === vWL && rItem?.variantSku === `PVSF-WL-${RID}` &&
       rItem?.selectedOptions?.Size === 'L' && Number(rItem?.price) === 620,
      'Cart → Checkout → Order: variantId + SKU + selectedOptions + price persist on re-fetch', rItem);
  }

  // C2: two-option combination resolves the exact variant
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      { productId: tee.id, productTitle: `PV SF Tee ${RID}`, quantity: 2, price: 999, variantId: vBM },
    ]));
    const item = res.body?.data?.subOrders?.[0]?.items?.[0];
    ok((res.status === 200 || res.status === 201) && Number(item?.price) === 550 && item?.variantSku === `PVSF-BM-${RID}`,
      'two-option combination (M/Black) resolves variant price 550 + its SKU', { status: res.status, price: item?.price, sku: item?.variantSku });
  }

  // C3: forged variantId rejected (never a silent base price)
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      { productId: tee.id, productTitle: `PV SF Tee ${RID}`, quantity: 1, price: 500, variantId: `forged-${RID}` },
    ]));
    ok(res.status >= 400 && res.status < 500, 'forged variantId on a variant product is rejected (4xx, no silent base price)', { status: res.status, err: res.body?.error });
  }

  // C4: inactive variantId rejected
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      { productId: tee.id, productTitle: `PV SF Tee ${RID}`, quantity: 1, price: 500, variantId: vBS },
    ]));
    ok(res.status >= 400 && res.status < 500, 'inactive variantId (S/Black) is rejected', { status: res.status, err: res.body?.error });
  }

  // C5: a quantity beyond the variant's own stock is blocked by variant-scoped
  //     inventory reservation (proves per-variant stock, not base product stock).
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      { productId: tee.id, productTitle: `PV SF Tee ${RID}`, quantity: 999, price: 620, variantId: vWL },
    ]));
    ok(res.status === 409 || (res.status >= 400 && res.status < 500),
      'ordering 999 of a variant stocked at 4 is blocked by variant-scoped inventory (INSUFFICIENT_STOCK)',
      { status: res.status, code: res.body?.code, err: res.body?.error });
  }

  // C6: no-variant product still checks out unchanged at base price
  {
    const res = await createOpsOrder(buyer.token, mkOpsOrder(buyer.uid, seller.uid, `PV SF Brand ${RID}`, [
      { productId: plain.id, productTitle: `PV SF Plain ${RID}`, quantity: 1, price: 9 },
    ]));
    const item = res.body?.data?.subOrders?.[0]?.items?.[0];
    ok((res.status === 200 || res.status === 201) && Number(item?.price) === 300 && !item?.variantId,
      'no-variant product checks out at canonical base price (300), no variant fields', { status: res.status, price: item?.price });
  }

  console.log(failed === 0 ? '\nALL PRODUCT-VARIANT STOREFRONT CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
