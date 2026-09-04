/**
 * Per-variant inventory: Studio edit persistence, live storefront stock,
 * variant-scoped Adjust Stock, aggregate roll-up, low/out-of-stock states.
 *
 * Reuses the CANONICAL inventory records (inv__<pid>__<vid>) — no new stock
 * model. Verifies:
 *   - a non-variant product's stock is untouched by variant machinery
 *   - a variant product's product.stock == Σ variant availableQuantity
 *   - editing an EXISTING variant's Stock in the Studio (PUT product-details)
 *     now lands on its canonical inventory record (was a silent no-op)
 *   - GET /catalog/products/:id (public) reports each variant's LIVE
 *     availableQuantity, not the stale detail-JSON number
 *   - PATCH .../inventory { variantId, quantity } adjusts ONLY that variant;
 *     product.stock re-sums; other variants unchanged
 *   - a low variant (< threshold 5) → inventoryState 'low_stock';
 *     a 0 variant → 'out_of_stock'; an in-stock sibling stays purchasable
 *   - the numbers Product Listings rolls up (count / totalUnits / in / low / out)
 *
 * Requires the local server on :3001 + seeded dev admin. ALLOW_DEV_LOGIN=true.
 * Usage:  npm run test:product-variants-inventory
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
const ok = (c: boolean, label: string, d?: unknown) => {
  if (c) console.log('PASS', label);
  else { failed++; console.log('FAIL', label, d === undefined ? '' : JSON.stringify(d)); }
};
const j = (r: Response) => r.json().catch(() => ({}));
const H = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

async function login(email: string, password: string) {
  const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const b = (await j(r)) as { accessToken?: string; uid?: string };
  if (!r.ok || !b.accessToken) throw new Error(`login ${email}: ${r.status}`);
  return { token: b.accessToken, uid: b.uid as string };
}
async function registerConsumer(email: string) {
  const r = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Inv Buyer' }) });
  const b = (await j(r)) as { customToken?: string; uid?: string };
  if (!r.ok || !b.customToken) throw new Error(`register ${email}: ${r.status}`);
  return { token: b.customToken, uid: b.uid as string };
}
async function provisionSeller(adminToken: string, email: string) {
  await fetch(`${base}/auth/partner-apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicantType: 'seller', email, password: 'Probe!2026xx', displayName: 'Inv Probe Seller', businessOrChannelName: `Inv Store ${RID}`, phone: '+8801711002299', category: 'General', city: 'Dhaka' }) });
  const list = (await j(await fetch(`${base}/operations/partner-applications?status=pending`, { headers: H(adminToken) }))) as { applications?: Array<{ id: string; email?: string }> };
  const app = (list.applications || []).find((a) => a.email === email);
  if (!app) throw new Error('pending application missing');
  await fetch(`${base}/operations/partner-applications/${app.id}/approve`, { method: 'POST', headers: H(adminToken), body: JSON.stringify({ note: 'inv probe' }) });
  const s = await login(email, 'Probe!2026xx');
  const own = (await j(await fetch(`${base}/catalog/brands`, { headers: H(s.token) }))) as { data?: Array<{ id: string }> };
  if (own.data?.[0]?.id) await fetch(`${base}/catalog/brands/${own.data[0].id}/marketplace-access`, { method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'granted' }) });
  return s;
}
async function makeBrand(token: string, name: string) {
  const b = (await j(await fetch(`${base}/catalog/brands`, { method: 'POST', headers: H(token), body: JSON.stringify({ name, category: 'General', description: 'probe' }) }))) as { data?: { id: string } };
  return b.data!.id;
}
async function makeCategory(adminToken: string, name: string, dims: Array<{ name: string; options: string[] }>) {
  const c = (await j(await fetch(`${base}/catalog/categories`, { method: 'POST', headers: H(adminToken), body: JSON.stringify({ name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${RID}`, parentId: null, enabled: true }) }))) as { data?: { id: string } };
  for (const d of dims) await fetch(`${base}/catalog/categories/${c.data!.id}/attributes`, { method: 'POST', headers: H(adminToken), body: JSON.stringify({ name: d.name, type: 'select', variantEligible: true, options: d.options }) });
  return c.data!.id;
}
async function makeProduct(token: string, p: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/products`, { method: 'POST', headers: H(token), body: JSON.stringify({ stock: 0, status: 'live', image: 'https://example.com/p.jpg', description: 'probe', ...p }) });
  const b = (await j(r)) as { data?: { id: string }; error?: string };
  return { status: r.status, id: b.data?.id || '', error: b.error };
}
async function putDetail(token: string, productId: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/product-details/${productId}`, { method: 'PUT', headers: H(token), body: JSON.stringify({ productId, specs: [], optionGroups: [], productVariants: [], addonItems: [], ...body }) });
  return { status: r.status, body: (await j(r)) as { error?: string } };
}
async function invPatch(token: string, productId: string, payload: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/products/${productId}/inventory`, { method: 'PATCH', headers: H(token), body: JSON.stringify(payload) });
  return { status: r.status, body: (await j(r)) as any };
}
async function invGet(token: string, productId: string, variantId?: string) {
  const q = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
  const r = await fetch(`${base}/catalog/products/${productId}/inventory${q}`, { headers: H(token) });
  return { status: r.status, body: (await j(r)) as { data?: any; records?: any[] } };
}
async function getProduct(productId: string, token?: string) {
  const r = await fetch(`${base}/catalog/products/${productId}`, token ? { headers: H(token) } : undefined);
  return { status: r.status, body: (await j(r)) as any };
}
async function createOpsOrder(token: string, buyerId: string, sellerId: string, items: unknown[]) {
  const r = await fetch(`${base}/operations/orders`, { method: 'POST', headers: H(token), body: JSON.stringify({
    orderId: `probe-inv-${RID}-${Math.random().toString(36).slice(2, 8)}`, buyerId, isCOD: false,
    overallTotal: 1, subtotal: 1, deliveryTotal: 120,
    subOrders: [{ sellerId, sellerBusinessName: 'Inv', items, deliveryFee: 120 }],
    paymentMethod: 'online', status: 'confirmed', createdAt: new Date().toISOString(),
    shipping: { fullName: 'B', phone: '+8801700000000', address: '1 Rd, Dhaka', region: 'Dhaka' },
  }) });
  return { status: r.status, body: (await j(r)) as any };
}

async function main() {
  console.log('=== Per-variant inventory probe ===  BASE', base);
  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const seller = await provisionSeller(admin.token, `inv-seller-${RID}@probe.local`);
  const brand = await makeBrand(seller.token, `Inv Brand ${RID}`);
  await fetch(`${base}/catalog/brands/${brand}/marketplace-access`, { method: 'PATCH', headers: H(admin.token), body: JSON.stringify({ status: 'granted' }) });
  const cat = await makeCategory(admin.token, `Inv Phones ${RID}`, [
    { name: 'Color', options: ['Black', 'White'] },
    { name: 'Storage', options: ['128GB', '256GB'] },
  ]);

  // ── non-variant product: stock stays exactly what the seller set ──
  const plain = await makeProduct(seller.token, { title: `Inv Plain ${RID}`, brandId: brand, categoryId: cat, price: 1000, stock: 0, status: 'live' });
  await invPatch(seller.token, plain.id, { quantity: 17 });
  {
    const g = await getProduct(plain.id);
    ok((g.body?.data ?? g.body)?.stock === 17, 'non-variant product stock = the value set (17), untouched by variant machinery', (g.body?.data ?? g.body)?.stock);
  }

  // ── variant product: 4 combos, distinct stock ──
  const phone = await makeProduct(seller.token, { title: `Inv Phone ${RID}`, brandId: brand, categoryId: cat, price: 5000, stock: 0, status: 'live' });
  const vB1 = `iv-b128-${RID}`, vB2 = `iv-b256-${RID}`, vW1 = `iv-w128-${RID}`, vW2 = `iv-w256-${RID}`;
  const detailBody = (b128: number, b256: number, w128: number, w256: number) => ({
    optionGroups: [
      { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White'] },
      { id: 'og-storage', name: 'Storage', displayType: 'pills', values: ['128GB', '256GB'] },
    ],
    productVariants: [
      { id: vB1, sku: `PH-BLK-128-${RID}`, price: 5000, stock: b128, options: { Color: 'Black', Storage: '128GB' }, status: 'active' },
      { id: vB2, sku: `PH-BLK-256-${RID}`, price: 7500, stock: b256, options: { Color: 'Black', Storage: '256GB' }, status: 'active' },
      { id: vW1, sku: `PH-WHT-128-${RID}`, price: 6000, stock: w128, options: { Color: 'White', Storage: '128GB' }, status: 'active' },
      { id: vW2, sku: `PH-WHT-256-${RID}`, price: 8000, stock: w256, options: { Color: 'White', Storage: '256GB' }, status: 'active' },
    ],
  });
  ok((await putDetail(seller.token, phone.id, detailBody(50, 25, 10, 5))).status === 200, 'variant product-detail saved (B128=50 B256=25 W128=10 W256=5)');

  // aggregate = Σ variant available
  {
    const g = await getProduct(phone.id, seller.token);
    const p = g.body?.data ?? g.body;
    ok(p?.stock === 90, 'product.stock = Σ variant availableQuantity (50+25+10+5 = 90) — no parent value used', p?.stock);
    const inv = await invGet(seller.token, phone.id);
    const vrows = (inv.body.records || []).filter((r: any) => r.variantId);
    ok(vrows.length === 4, 'four canonical variant inventory records exist', vrows.length);
    const byId = new Map(vrows.map((r: any) => [r.variantId, r]));
    ok(byId.get(vB1)?.availableQuantity === 50 && byId.get(vW2)?.availableQuantity === 5, 'individual variant quantities correct', { b1: byId.get(vB1)?.availableQuantity, w2: byId.get(vW2)?.availableQuantity });
    ok(byId.get(vB1)?.sku === `PH-BLK-128-${RID}`, 'variant inventory record carries the variant SKU', byId.get(vB1)?.sku);
  }

  // ── low-stock (< threshold 5) and out-of-stock states ──
  ok((await putDetail(seller.token, phone.id, detailBody(50, 25, 3, 0))).status === 200, 're-save with W128=3 (low) and W256=0 (out)');
  {
    const inv = await invGet(seller.token, phone.id);
    const byId = new Map((inv.body.records || []).filter((r: any) => r.variantId).map((r: any) => [r.variantId, r]));
    ok(byId.get(vW1)?.availableQuantity === 3 && byId.get(vW1)?.inventoryState === 'low_stock',
      'EXISTING variant stock edit in Studio persists to canonical inventory + state = low_stock (< 5)', { qty: byId.get(vW1)?.availableQuantity, state: byId.get(vW1)?.inventoryState });
    ok(byId.get(vW2)?.availableQuantity === 0 && byId.get(vW2)?.inventoryState === 'out_of_stock',
      'zeroed variant → inventoryState out_of_stock', { qty: byId.get(vW2)?.availableQuantity, state: byId.get(vW2)?.inventoryState });
    ok(byId.get(vB1)?.inventoryState === 'in_stock', 'sibling variant stays in_stock', byId.get(vB1)?.inventoryState);
  }

  // ── storefront GET reports LIVE availability, product stays purchasable ──
  {
    const pub = await getProduct(phone.id); // anon
    const pv = ((pub.body?.data ?? pub.body)?.productVariants || []) as any[];
    const w1 = pv.find((v) => v.id === vW1);
    const w2 = pv.find((v) => v.id === vW2);
    ok(w1?.stock === 3, 'public GET /catalog/products/:id variant.stock = LIVE availableQuantity (3), not stale detail number', w1?.stock);
    ok(w2?.stock === 0, 'public GET variant.stock = 0 for the out combination', w2?.stock);
    ok((pub.body?.data ?? pub.body)?.stock === 78 && (pub.body?.data ?? pub.body)?.status !== 'out_of_stock',
      'one OOS combination does NOT make the parent product out of stock (78 units, still active)', { stock: (pub.body?.data ?? pub.body)?.stock, status: (pub.body?.data ?? pub.body)?.status });
  }

  // ── operations orders: in-stock combo purchasable, OOS combo blocked ──
  const buyer = await registerConsumer(`inv-buyer-${RID}@probe.local`);
  {
    const good = await createOpsOrder(buyer.token, buyer.uid, seller.uid, [{ productId: phone.id, productTitle: 'p', quantity: 1, price: 5000, variantId: vB1 }]);
    ok(good.status === 200 || good.status === 201, 'in-stock combination (Black/128GB) is purchasable', { status: good.status, err: good.body?.error });
    const bad = await createOpsOrder(buyer.token, buyer.uid, seller.uid, [{ productId: phone.id, productTitle: 'p', quantity: 1, price: 8000, variantId: vW2 }]);
    ok(bad.status >= 400 && bad.status < 500, 'out-of-stock combination (White/256GB) is blocked', { status: bad.status, code: bad.body?.code });
  }

  // ── PATCH .../inventory { variantId } adjusts ONLY that variant ──
  {
    const before = await invGet(seller.token, phone.id);
    const bMap0 = new Map((before.body.records || []).filter((r: any) => r.variantId).map((r: any) => [r.variantId, r.availableQuantity]));
    await invPatch(seller.token, phone.id, { variantId: vW2, quantity: 12 });
    const after = await invGet(seller.token, phone.id);
    const bMap1 = new Map((after.body.records || []).filter((r: any) => r.variantId).map((r: any) => [r.variantId, r.availableQuantity]));
    ok(bMap1.get(vW2) === 12, 'variant-scoped Adjust Stock set White/256GB → 12', bMap1.get(vW2));
    ok(bMap1.get(vB1) === bMap0.get(vB1) && bMap1.get(vB2) === bMap0.get(vB2) && bMap1.get(vW1) === bMap0.get(vW1),
      'no other variant record changed', { b1: bMap1.get(vB1), b2: bMap1.get(vB2), w1: bMap1.get(vW1) });
    const g = await getProduct(phone.id, seller.token);
    ok((g.body?.data ?? g.body)?.stock === (bMap0.get(vB1)! + bMap0.get(vB2)! + bMap0.get(vW1)! + 12), 'product.stock re-summed after the variant adjust', (g.body?.data ?? g.body)?.stock);
  }

  // ── Product Listings roll-up numbers (what Products.tsx computes) ──
  {
    const inv = await invGet(seller.token, phone.id);
    const vrows = (inv.body.records || []).filter((r: any) => r.variantId);
    const summary = {
      count: vrows.length,
      totalUnits: vrows.reduce((s: number, r: any) => s + Math.max(0, r.availableQuantity), 0),
      inStock: vrows.filter((r: any) => r.inventoryState === 'in_stock').length,
      low: vrows.filter((r: any) => r.inventoryState === 'low_stock').length,
      out: vrows.filter((r: any) => r.inventoryState === 'out_of_stock').length,
    };
    // B128=49 (1 reserved by the earlier order), B256=25, W128=3 low, W256=12
    //   → 4 variants / 89 units / 3 In / 1 Low / 0 Out
    ok(summary.count === 4 && summary.totalUnits === 89 && summary.inStock === 3 && summary.low === 1 && summary.out === 0,
      'Product Listings variant roll-up: 4 variants · 89 units · 3 In · 1 Low · 0 Out', summary);
  }

  console.log(failed === 0 ? '\nALL PER-VARIANT INVENTORY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
