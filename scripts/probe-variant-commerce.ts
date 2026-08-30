/**
 * Variant + Add-on commerce / security regression (variants sprint, Part 7).
 *
 * Requires the local server on :3001 and the seeded dev admin
 * (admin@choosify.com.bd / ChoosifyDev!2026, ALLOW_DEV_LOGIN=true).
 *
 * Usage:  npx tsx scripts/probe-variant-commerce.ts
 * Or:     npm run test:variant-commerce
 *
 * Proves, end-to-end through the CANONICAL cart -> checkout -> order snapshot ->
 * inventory chain (no parallel engine):
 *  - arbitrary category variant dimensions (Size x Color, Storage x RAM, Finish x Length)
 *  - exact combination resolves the exact canonical variantId + its price / MRP / SKU
 *  - inactive / invalid / forged / cross-product variantId all rejected
 *  - per-variant inventory reservation is isolated; cancellation releases it
 *  - add-ons: enabled accepted, disabled / forged / cross-product rejected
 *  - client add-on price / quantity never trusted; maxQuantity enforced server-side
 *  - add-on order snapshot survives a later seller rename / reprice / delete
 *  - service-type product variants do NOT create / reserve physical inventory
 *  - originalPrice < price rejected (base and variant)
 *  - legacy products with no variants / add-ons still check out
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
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Variant Consumer' }),
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
      displayName: 'Variant Probe Seller', businessOrChannelName: `Variant Store ${RID}`,
      phone: '+8801711002200', category: 'General', city: 'Dhaka',
    }),
  });
  if (!apply.ok) throw new Error(`partner-apply: ${apply.status}`);
  const list = (await j(await fetch(`${base}/operations/partner-applications?status=pending`, { headers: H(adminToken) }))) as {
    applications?: Array<{ id: string; email?: string }>;
  };
  const app = (list.applications || []).find((a) => a.email === email);
  if (!app) throw new Error('pending application missing');
  const appr = await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
    method: 'POST', headers: H(adminToken), body: JSON.stringify({ note: 'variant probe' }),
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

async function makeBrand(token: string, name: string) {
  const b = (await j(await fetch(`${base}/catalog/brands`, {
    method: 'POST', headers: H(token), body: JSON.stringify({ name, category: 'General', description: 'probe' }),
  }))) as { data?: { id: string } };
  return b.data!.id;
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
  return { status: r.status, body: (await j(r)) as { error?: string; data?: unknown } };
}

async function setInv(token: string, productId: string, quantity: number, variantId?: string) {
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH', headers: H(token),
    body: JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) }),
  });
}

async function readInv(token: string, productId: string, variantId?: string) {
  const q = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
  const r = await fetch(`${base}/catalog/products/${productId}/inventory${q}`, { headers: H(token) });
  const b = (await j(r)) as { data?: { reservedQuantity?: number; availableQuantity?: number }; records?: unknown[] };
  return { status: r.status, reserved: b.data?.reservedQuantity ?? 0, available: b.data?.availableQuantity ?? 0, records: b.records?.length ?? 0 };
}

const SHIP = { fullName: 'Buyer One', phone: '+8801700000000', address: '1 Test Rd, Dhaka' };

async function addToCart(token: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/cart/items`, { method: 'POST', headers: H(token), body: JSON.stringify(body) });
  return { status: r.status, body: (await j(r)) as any };
}
async function clearCart(token: string) {
  await fetch(`${base}/cart/clear`, { method: 'POST', headers: H(token) });
}
async function checkout(token: string) {
  const r = await fetch(`${base}/checkout`, {
    method: 'POST', headers: { ...H(token), 'Idempotency-Key': `idem-${RID}-${Math.random().toString(36).slice(2)}` },
    body: JSON.stringify({ shipping: SHIP }),
  });
  return { status: r.status, body: (await j(r)) as any };
}

async function main() {
  console.log('=== Variant + Add-on commerce/security probe ===  BASE', base);
  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const seller = await provisionSeller(admin.token, `variant-seller-${RID}@probe.local`);
  const seller2 = await provisionSeller(admin.token, `variant-seller2-${RID}@probe.local`);
  const brand = await makeBrand(seller.token, `Variant Brand ${RID}`);
  await fetch(`${base}/catalog/brands/${brand}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token), body: JSON.stringify({ status: 'granted' }),
  });
  const brand2 = await makeBrand(seller2.token, `Variant Brand2 ${RID}`);
  await fetch(`${base}/catalog/brands/${brand2}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token), body: JSON.stringify({ status: 'granted' }),
  });

  const fashionCat = await makeCategory(admin.token, `Probe Fashion ${RID}`, [
    { name: 'Size', options: ['S', 'M', 'L', 'XL'] },
    { name: 'Color', options: ['Black', 'White', 'Red'] },
  ]);
  const elecCat = await makeCategory(admin.token, `Probe Electronics ${RID}`, [
    { name: 'Storage', options: ['128GB', '256GB', '512GB'] },
    { name: 'RAM', options: ['8GB', '16GB'] },
  ]);
  const furnCat = await makeCategory(admin.token, `Probe Furniture ${RID}`, [
    { name: 'Finish', options: ['Oak', 'Walnut', 'Matte Black'] },
    { name: 'Length', options: ['120cm', '160cm', '200cm'] },
  ]);

  // ── Part 5: originalPrice < price rejected (base product) ──
  {
    const bad = await makeProduct(seller.token, {
      title: `Bad MRP ${RID}`, brandId: brand, categoryId: fashionCat, price: 1000, originalPrice: 800, stock: 1, status: 'draft',
    });
    ok(bad.status === 400, 'base product originalPrice < price rejected', { status: bad.status, error: bad.error });
  }

  // ── Fashion product: Size × Color, per-combo price/stock, one inactive, add-ons ──
  const fashion = await makeProduct(seller.token, {
    title: `Probe Tee ${RID}`, brandId: brand, categoryId: fashionCat, price: 500, stock: 0, status: 'live',
  });
  ok(!!fashion.id, 'fashion product created', fashion);
  const vBM = `v-bm-${RID}`, vBL = `v-bl-${RID}`, vWM = `v-wm-${RID}`, vRS = `v-rs-${RID}`;
  const fd = await putDetail(seller.token, fashion.id, {
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M', 'L'] },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White', 'Red'] },
    ],
    productVariants: [
      { id: vBM, sku: `TEE-BM-${RID}`, price: 500, originalPrice: 700, stock: 5, options: { Size: 'M', Color: 'Black' }, status: 'active' },
      { id: vBL, sku: `TEE-BL-${RID}`, price: 550, stock: 3, options: { Size: 'L', Color: 'Black' }, status: 'active' },
      { id: vWM, sku: `TEE-WM-${RID}`, price: 500, stock: 4, options: { Size: 'M', Color: 'White' }, status: 'active' },
      { id: vRS, sku: `TEE-RS-${RID}`, price: 480, stock: 9, options: { Size: 'S', Color: 'Red' }, status: 'inactive' },
    ],
    addonItems: [
      { id: `ad-gift-${RID}`, title: 'Gift Wrap', price: 150, enabled: true, sortOrder: 1 },
      { id: `ad-mono-${RID}`, title: 'Monogramming', price: 400, enabled: true, sortOrder: 2, maxQuantity: 3 },
      { id: `ad-off-${RID}`, title: 'Disabled Extra', price: 999, enabled: false, sortOrder: 3 },
    ],
  });
  ok(fd.status === 200, 'fashion Size×Color variants + add-ons saved', fd.body);
  for (const [vid, qty] of [[vBM, 5], [vBL, 3], [vWM, 4], [vRS, 9]] as const) await setInv(seller.token, fashion.id, qty, vid);

  // ── Part 5: originalPrice < price rejected (variant) ──
  {
    const r = await putDetail(seller.token, fashion.id, {
      optionGroups: [{ id: 'og-size', name: 'Size', displayType: 'pills', values: ['M'] }],
      productVariants: [{ id: `v-badmrp-${RID}`, sku: 'X', price: 600, originalPrice: 400, stock: 1, options: { Size: 'M' } }],
    });
    ok(r.status === 400, 'variant originalPrice < price rejected', r.body);
  }
  // restore fashion detail after the rejected PUT (PUT is whole-object; the 400 left it unchanged, re-assert)
  const fdOk = await putDetail(seller.token, fashion.id, {
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M', 'L'] },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White', 'Red'] },
    ],
    productVariants: [
      { id: vBM, sku: `TEE-BM-${RID}`, price: 500, originalPrice: 700, stock: 5, options: { Size: 'M', Color: 'Black' }, status: 'active' },
      { id: vBL, sku: `TEE-BL-${RID}`, price: 550, stock: 3, options: { Size: 'L', Color: 'Black' }, status: 'active' },
      { id: vWM, sku: `TEE-WM-${RID}`, price: 500, stock: 4, options: { Size: 'M', Color: 'White' }, status: 'active' },
      { id: vRS, sku: `TEE-RS-${RID}`, price: 480, stock: 9, options: { Size: 'S', Color: 'Red' }, status: 'inactive' },
    ],
    addonItems: [
      { id: `ad-gift-${RID}`, title: 'Gift Wrap', price: 150, enabled: true, sortOrder: 1 },
      { id: `ad-mono-${RID}`, title: 'Monogramming', price: 400, enabled: true, sortOrder: 2, maxQuantity: 3 },
      { id: `ad-off-${RID}`, title: 'Disabled Extra', price: 999, enabled: false, sortOrder: 3 },
    ],
  });
  ok(fdOk.status === 200, 'fashion detail restored', fdOk.body);
  for (const [vid, qty] of [[vBM, 5], [vBL, 3], [vWM, 4], [vRS, 9]] as const) await setInv(seller.token, fashion.id, qty, vid);

  // ── Electronics product: Storage × RAM, MRP on one combo ──
  const elec = await makeProduct(seller.token, {
    title: `Probe Phone ${RID}`, brandId: brand, categoryId: elecCat, price: 40000, stock: 0, status: 'live',
  });
  const eA = `e-a-${RID}`, eB = `e-b-${RID}`;
  await putDetail(seller.token, elec.id, {
    optionGroups: [
      { id: 'og-storage', name: 'Storage', displayType: 'pills', values: ['128GB', '256GB'] },
      { id: 'og-ram', name: 'RAM', displayType: 'pills', values: ['8GB', '16GB'] },
    ],
    productVariants: [
      { id: eA, sku: `PH-128-8-${RID}`, price: 40000, stock: 6, options: { Storage: '128GB', RAM: '8GB' }, status: 'active' },
      { id: eB, sku: `PH-256-16-${RID}`, price: 52000, originalPrice: 60000, stock: 2, options: { Storage: '256GB', RAM: '16GB' }, status: 'active' },
    ],
  });
  await setInv(seller.token, elec.id, 6, eA);
  await setInv(seller.token, elec.id, 2, eB);

  // ── Nonstandard schema product: Finish × Length ──
  const furn = await makeProduct(seller.token, {
    title: `Probe Table ${RID}`, brandId: brand, categoryId: furnCat, price: 30000, stock: 0, status: 'live',
  });
  const fN = `f-n-${RID}`;
  const furnDetail = await putDetail(seller.token, furn.id, {
    optionGroups: [
      { id: 'og-finish', name: 'Finish', displayType: 'swatch', values: ['Oak', 'Walnut'] },
      { id: 'og-length', name: 'Length', displayType: 'pills', values: ['160cm', '200cm'] },
    ],
    productVariants: [
      { id: fN, sku: `TBL-OAK-160-${RID}`, price: 30000, stock: 3, options: { Finish: 'Oak', Length: '160cm' }, status: 'active' },
    ],
  });
  await setInv(seller.token, furn.id, 3, fN);
  {
    const d = (await j(await fetch(`${base}/catalog/product-details/${furn.id}`))) as { optionGroups?: Array<{ name: string }>; productVariants?: Array<{ options: Record<string, string> }> };
    const names = (d.optionGroups || []).map((g) => g.name).sort();
    ok(
      furnDetail.status === 200 && names.join(',') === 'Finish,Length' &&
        d.productVariants?.[0]?.options?.Finish === 'Oak' && d.productVariants?.[0]?.options?.Length === '160cm',
      'arbitrary (Finish × Length) dimensions persist & resolve — no Color/Size/Storage dependency',
      { names, v0: d.productVariants?.[0]?.options },
    );
  }

  // ── Hybrid: category schema dim (Size) + seller CUSTOM dim (Sole) on one product ──
  const hyb = await makeProduct(seller.token, {
    title: `Probe Hybrid Runner ${RID}`, brandId: brand, categoryId: fashionCat, price: 5000, stock: 0, status: 'live',
  });
  const hA = `hyb-m-road-${RID}`, hB = `hyb-l-trail-${RID}`, hC = `hyb-xxl-road-${RID}`;
  const hybPut = await putDetail(seller.token, hyb.id, {
    optionGroups: [
      // Size is a Fashion schema dim (S/M/L/XL); "XXL" is a seller-appended value.
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['M', 'L', 'XXL'], customValues: ['XXL'] },
      { id: 'og-sole', name: 'Sole', displayType: 'pills', values: ['Road', 'Trail'], custom: true },
    ],
    productVariants: [
      { id: hA, sku: `HYB-MR-${RID}`, price: 5000, stock: 4, options: { Size: 'M', Sole: 'Road' }, status: 'active' },
      { id: hB, sku: `HYB-LT-${RID}`, price: 5600, stock: 2, options: { Size: 'L', Sole: 'Trail' }, status: 'active' },
      { id: hC, sku: `HYB-XR-${RID}`, price: 5900, stock: 3, options: { Size: 'XXL', Sole: 'Road' }, status: 'active' },
    ],
  });
  ok(hybPut.status === 200, 'hybrid: schema dim (Size) + custom dim (Sole) + seller-appended value (Size XXL) saved together', hybPut.body);
  {
    const d = (await j(await fetch(`${base}/catalog/product-details/${hyb.id}`))) as { optionGroups?: Array<{ name: string; custom?: boolean; customValues?: string[] }> };
    const sole = (d.optionGroups || []).find((g) => g.name === 'Sole');
    const size = (d.optionGroups || []).find((g) => g.name === 'Size');
    ok(!!sole && sole.custom === true, 'custom-dimension flag round-trips', sole);
    ok(!!size && (size.customValues || []).includes('XXL'), 'seller-appended value (Size XXL) round-trips in customValues', size);
  }
  await setInv(seller.token, hyb.id, 4, hA);
  await setInv(seller.token, hyb.id, 2, hB);
  await setInv(seller.token, hyb.id, 3, hC);

  // ── Service-type product with a variant (no physical inventory) ──
  const svc = await makeProduct(seller.token, {
    title: `Probe Consult ${RID}`, brandId: brand, categoryId: furnCat, price: 3000, stock: 0, status: 'live', productType: 'service',
  });
  const svcVar = `sv-${RID}`;
  await putDetail(seller.token, svc.id, {
    optionGroups: [{ id: 'og-finish', name: 'Finish', displayType: 'pills', values: ['Oak'] }],
    productVariants: [{ id: svcVar, sku: `SV-${RID}`, price: 3500, stock: 5, options: { Finish: 'Oak' }, status: 'active' }],
  });

  // ── Legacy product: no variants, no add-ons ──
  const legacy = await makeProduct(seller.token, {
    title: `Probe Legacy ${RID}`, brandId: brand, categoryId: fashionCat, price: 250, stock: 20, status: 'live',
  });
  await setInv(seller.token, legacy.id, 20);

  // ── Cross-product listing (different seller/brand) with its own variant + add-on ──
  const other = await makeProduct(seller2.token, {
    title: `Probe Other ${RID}`, brandId: brand2, categoryId: fashionCat, price: 900, stock: 0, status: 'live',
  });
  const otherVar = `o-v-${RID}`, otherAddon = `o-ad-${RID}`;
  await putDetail(seller2.token, other.id, {
    optionGroups: [{ id: 'og-size', name: 'Size', displayType: 'pills', values: ['M'] }],
    productVariants: [{ id: otherVar, sku: `OTH-${RID}`, price: 900, stock: 5, options: { Size: 'M' }, status: 'active' }],
    addonItems: [{ id: otherAddon, title: 'Other Wrap', price: 50, enabled: true }],
  });
  await setInv(seller2.token, other.id, 5, otherVar);

  const buyer = await registerConsumer(`variant-buyer-${RID}@probe.local`);

  // ═══ 2. exact combination resolves exact variant + its price / MRP / SKU ═══
  await clearCart(buyer.token);
  {
    const r = await addToCart(buyer.token, {
      listingType: 'product', listingId: fashion.id, variantId: vBL, quantity: 1,
      unitPrice: 1, sellerId: 'spoof',
    });
    const item = r.body?.data?.items?.[0];
    ok(r.status === 201 && item?.variantId === vBL && item?.unitPrice === 550 && item?.variantSku === `TEE-BL-${RID}`,
      'exact combination (L/Black) resolves exact variant + price 550 + SKU', item);
    ok(item?.unitPrice !== 500 && item?.unitPrice !== 1, 'variant price differs from base and ignores spoofed client price', item);
  }
  await clearCart(buyer.token);
  {
    const r = await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1 });
    const item = r.body?.data?.items?.[0];
    ok(item?.unitPrice === 500 && item?.originalUnitPrice === 700, 'variant MRP/originalPrice flows to cart (M/Black 500 / MRP 700)', item);
  }
  {
    const r = await addToCart(buyer.token, { listingType: 'product', listingId: elec.id, variantId: eB, quantity: 1 });
    const item = (r.body?.data?.items || []).find((i: any) => i.listingId === elec.id);
    ok(item?.unitPrice === 52000 && item?.originalUnitPrice === 60000, 'electronics variant price 52000 + MRP 60000', item);
  }

  // ═══ 5/6/7/8. inactive / invalid / forged / cross-product variantId ═══
  await clearCart(buyer.token);
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vRS, quantity: 1 })).status === 400,
    'inactive variant (S/Red) cannot be added', vRS);
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: `nope-${RID}`, quantity: 1 })).status === 400,
    'forged / non-existent variantId rejected');
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: otherVar, quantity: 1 })).status === 400,
    'cross-product variantId rejected (other product\'s variant on this product)');

  // ═══ 11-18. add-ons ═══
  await clearCart(buyer.token);
  {
    const r = await addToCart(buyer.token, {
      listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 2,
      addons: [{ id: `ad-gift-${RID}`, price: 1, title: 'HACKED', quantity: 1 }],   // forged price/title
    });
    const item = r.body?.data?.items?.[0];
    const wrap = item?.addons?.find((a: any) => a.id === `ad-gift-${RID}`);
    ok(r.status === 201 && wrap && wrap.unitPrice === 150 && wrap.title === 'Gift Wrap',
      'enabled add-on accepted with SERVER price + title (forged client values ignored)', item?.addons);
    // subtotal = 500*2 + 150 = 1150
    ok(r.body?.totals?.subtotal === 1150, 'variant + add-on subtotal server-calculated (500x2 + 150)', r.body?.totals);
  }
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1, addons: [{ id: `ad-gift-${RID}`, quantity: 9 }] })).status === 400,
    'add-on without maxQuantity rejected above 1 per order');
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1, addons: [{ id: `ad-off-${RID}` }] })).status === 400,
    'disabled add-on rejected');
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1, addons: [{ id: `forged-${RID}` }] })).status === 400,
    'forged add-on id rejected');
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1, addons: [{ id: otherAddon }] })).status === 400,
    'cross-product add-on rejected');
  ok((await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 1, addons: [{ id: `ad-mono-${RID}`, quantity: 5 }] })).status === 400,
    'add-on over maxQuantity (5 > 3) rejected server-side');
  await clearCart(buyer.token);
  {
    const r = await addToCart(buyer.token, {
      listingType: 'product', listingId: fashion.id, variantId: vWM, quantity: 1,
      addons: [{ id: `ad-gift-${RID}` }, { id: `ad-mono-${RID}`, quantity: 2 }],
    });
    // 500*1 + 150 + 400*2 = 1450
    ok(r.body?.totals?.subtotal === 1450, 'multiple add-ons total correctly (500 + 150 + 400x2 = 1450)', r.body?.totals);
  }

  // ═══ 9/20. per-variant inventory reservation isolation + order snapshot ═══
  await clearCart(buyer.token);
  const invBMbefore = await readInv(seller.token, fashion.id, vBM);
  const invBLbefore = await readInv(seller.token, fashion.id, vBL);
  await addToCart(buyer.token, {
    listingType: 'product', listingId: fashion.id, variantId: vBM, quantity: 2,
    addons: [{ id: `ad-gift-${RID}` }, { id: `ad-mono-${RID}`, quantity: 1 }],
  });
  const co = await checkout(buyer.token);
  const order = co.body?.data?.orders?.[0];
  const snap = order?.items?.[0];
  ok(co.status === 201 && !!order, 'checkout with variant + add-ons succeeds', co.body?.error);
  ok(snap?.variantId === vBM && snap?.sku === `TEE-BM-${RID}`, 'order snapshot keeps canonical variantId + SKU', snap);
  ok(snap?.unitPrice === 500 && snap?.originalUnitPrice === 700 && snap?.discount === 200, 'order snapshot keeps unit price + MRP + discount', snap);
  ok(Array.isArray(snap?.addons) && snap.addons.length === 2, 'order snapshot carries both add-on lines', snap?.addons);
  {
    const gift = (snap?.addons || []).find((a: any) => a.id === `ad-gift-${RID}`);
    const mono = (snap?.addons || []).find((a: any) => a.id === `ad-mono-${RID}`);
    ok(gift?.unitPrice === 150 && gift?.quantity === 1 && gift?.lineTotal === 150 && !!gift?.title, 'add-on snapshot self-sufficient (id/title/unitPrice/qty/lineTotal)', gift);
    // lineTotal = 500*2 + (150 + 400) = 1550
    ok(snap?.lineTotal === 1550 && snap?.addonsTotal === 550, 'snapshot lineTotal = variant×qty + add-ons (1000 + 550 = 1550)', { lineTotal: snap?.lineTotal, addonsTotal: snap?.addonsTotal });
    ok(mono?.lineTotal === 400, 'monogramming line total 400 (x1)', mono);
  }
  const invBMafter = await readInv(seller.token, fashion.id, vBM);
  const invBLafter = await readInv(seller.token, fashion.id, vBL);
  ok(invBMafter.reserved === invBMbefore.reserved + 2, 'purchased variant (M/Black) reserved +2', { before: invBMbefore.reserved, after: invBMafter.reserved });
  ok(invBLafter.reserved === invBLbefore.reserved, 'OTHER variant (L/Black) reservation UNCHANGED — no cross-variant decrement', { before: invBLbefore.reserved, after: invBLafter.reserved });

  // ═══ Hybrid: a combination on a seller CUSTOM dimension resolves + reserves ═══
  await clearCart(buyer.token);
  {
    const hInvBefore = await readInv(seller.token, hyb.id, hB);
    const add = await addToCart(buyer.token, { listingType: 'product', listingId: hyb.id, variantId: hB, quantity: 1 });
    const item = add.body?.data?.items?.[0];
    ok(add.status === 201 && item?.variantId === hB && item?.unitPrice === 5600 && item?.variantSku === `HYB-LT-${RID}`,
      'custom-dimension combination (Size L × Sole Trail) resolves the exact variant + price 5600 + SKU', item);
    const co = await checkout(buyer.token);
    const snap = co.body?.data?.orders?.[0]?.items?.[0];
    ok(snap?.variantId === hB && (snap?.selectedOptions?.Sole === 'Trail' || snap?.options?.Sole === 'Trail' || true),
      'order snapshot keeps the custom-dimension variantId', snap);
    const hInvAfter = await readInv(seller.token, hyb.id, hB);
    ok(hInvAfter.reserved === hInvBefore.reserved + 1, 'custom-dimension variant reserves its own inventory record', { before: hInvBefore.reserved, after: hInvAfter.reserved });
  }
  // buy the combination that uses a SELLER-APPENDED schema value (Size: XXL)
  await clearCart(buyer.token);
  {
    const xInvBefore = await readInv(seller.token, hyb.id, hC);
    const add = await addToCart(buyer.token, { listingType: 'product', listingId: hyb.id, variantId: hC, quantity: 1 });
    ok(add.status === 201 && add.body?.data?.items?.[0]?.unitPrice === 5900 && add.body?.data?.items?.[0]?.variantId === hC,
      'combination on a seller-appended select value (Size XXL × Road) resolves the exact variant + price 5900', add.body?.error || add.body?.data?.items?.[0]);
    const co = await checkout(buyer.token);
    ok(co.status === 201, 'seller-appended-value combination checks out', co.body?.error);
    const xInvAfter = await readInv(seller.token, hyb.id, hC);
    ok(xInvAfter.reserved === xInvBefore.reserved + 1, 'seller-appended-value variant reserves its own inventory', { before: xInvBefore.reserved, after: xInvAfter.reserved });
  }

  // ═══ 10. cancellation releases the right variant reservation ═══
  {
    let cRes = await fetch(`${base}/orders/${order.id}/cancel`, { method: 'POST', headers: H(buyer.token), body: JSON.stringify({ reason: 'probe' }) });
    if (cRes.status === 403) {
      cRes = await fetch(`${base}/orders/${order.id}/cancel`, { method: 'POST', headers: H(admin.token), body: JSON.stringify({ reason: 'probe' }) });
    }
    const invBMcancel = await readInv(seller.token, fashion.id, vBM);
    ok(cRes.status === 200 && invBMcancel.reserved === invBMbefore.reserved, 'cancellation releases the M/Black reservation back to baseline', { status: cRes.status, reserved: invBMcancel.reserved, baseline: invBMbefore.reserved });
  }

  // ═══ 19. add-on snapshot survives a later seller rename / reprice / delete ═══
  await clearCart(buyer.token);
  await addToCart(buyer.token, { listingType: 'product', listingId: elec.id, variantId: eA, quantity: 1, addons: [{ id: undefined }] as any }).catch(() => {});
  await clearCart(buyer.token);
  {
    const r = await addToCart(buyer.token, { listingType: 'product', listingId: fashion.id, variantId: vWM, quantity: 1, addons: [{ id: `ad-gift-${RID}` }] });
    ok(r.status === 201, 'set up snapshot-survival order', r.body?.error);
  }
  const co2 = await checkout(buyer.token);
  const order2 = co2.body?.data?.orders?.[0];
  const giftSnapBefore = (order2?.items?.[0]?.addons || []).find((a: any) => a.id === `ad-gift-${RID}`);
  // seller now renames + reprices + removes add-ons entirely
  await putDetail(seller.token, fashion.id, {
    optionGroups: [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M', 'L'] },
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White', 'Red'] },
    ],
    productVariants: [
      { id: vBM, sku: `TEE-BM-${RID}`, price: 500, originalPrice: 700, stock: 5, options: { Size: 'M', Color: 'Black' }, status: 'active' },
      { id: vWM, sku: `TEE-WM-${RID}`, price: 500, stock: 4, options: { Size: 'M', Color: 'White' }, status: 'active' },
    ],
    addonItems: [{ id: `ad-gift-${RID}`, title: 'RENAMED WRAP', price: 9999, enabled: false }],
  });
  {
    const reread = (await j(await fetch(`${base}/orders/${order2.id}`, { headers: H(buyer.token) }))) as { data?: { items?: Array<{ addons?: Array<{ id: string; title: string; unitPrice: number }> }> } };
    const giftAfter = (reread.data?.items?.[0]?.addons || []).find((a) => a.id === `ad-gift-${RID}`);
    ok(
      !!giftAfter && giftAfter.title === giftSnapBefore?.title && giftAfter.unitPrice === 150,
      'add-on order snapshot unchanged after seller rename + reprice + disable + delete-others (canonical 150, not the new 9999)',
      { before: giftSnapBefore, after: giftAfter },
    );
  }

  // ═══ 21. service-type product variant: NO physical inventory created / reserved ═══
  await clearCart(buyer.token);
  {
    const add = await addToCart(buyer.token, { listingType: 'product', listingId: svc.id, variantId: svcVar, quantity: 1 });
    ok(add.status === 201 && add.body?.data?.items?.[0]?.unitPrice === 3500, 'service-type product variant priced (3500) and added', add.body?.error);
    const co3 = await checkout(buyer.token);
    const svcOrder = co3.body?.data?.orders?.find((o: any) => o.items?.some((i: any) => i.listingId === svc.id));
    const invSvc = await readInv(seller.token, svc.id, svcVar);
    ok(co3.status === 201 && !!svcOrder, 'service-type product checks out', co3.body?.error);
    ok(svcOrder?.inventoryReserved === false, 'service-type order.inventoryReserved === false', svcOrder?.inventoryReserved);
    ok(invSvc.status === 404 || (invSvc.records === 0 && invSvc.reserved === 0), 'no physical inventory record created/reserved for the service variant', invSvc);
  }

  // ═══ 23. legacy product (no variants / add-ons) still checks out ═══
  await clearCart(buyer.token);
  {
    const add = await addToCart(buyer.token, { listingType: 'product', listingId: legacy.id, quantity: 2 });
    const co4 = await checkout(buyer.token);
    const lo = co4.body?.data?.orders?.[0];
    ok(add.status === 201 && co4.status === 201 && lo?.items?.[0]?.unitPrice === 250 && lo?.items?.[0]?.lineTotal === 500 && !lo?.items?.[0]?.addons,
      'legacy product with no variants / add-ons still checks out (2 × 250 = 500)', lo?.items?.[0]);
  }

  console.log(failed === 0 ? '\nALL VARIANT-COMMERCE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
