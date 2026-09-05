/**
 * Seller-controlled variant combinations — generic, arbitrary-dimension proof.
 *
 * Core rule under test: Choosify must never treat a mathematically possible
 * combination of option values as a real sellable variant. Only the specific
 * combinations the seller actually persists in productVariants[] are real.
 * This is proven here with deliberately NONSENSE dimension names (Zone/Span/
 * Alpha/Beta/Gamma/Delta/Only) — if any of this worked because of a
 * Size/Color/Origin/Fashion special case, these would fail.
 *
 * Covers:
 *  A. Irregular/uneven combination tree (2 dims) — some values appear in only
 *     ONE combination, others in several — persists and reads back EXACTLY,
 *     no phantom combinations invented.
 *  B. The exact reported example shape (Size x Origin), same proof.
 *  C. Server-side duplicate-combination rejection (PUT 400) — the backstop
 *     for the Studio's own client-side duplicate check.
 *  D. A candidate/incomplete variant (no stock ever set by the seller) can
 *     NOT be added to cart even via a direct, real variantId, and does NOT
 *     silently borrow the base product's healthy stock number.
 *  E. 4-dimension sparse tree, arbitrary names.
 *  F. 1-dimension product (no cross-dimension logic to go wrong).
 *
 * Requires the local server on :3001 and the seeded dev accounts
 * (admin@choosify.com.bd / seller@choosify.com.bd, ChoosifyDev!2026,
 * ALLOW_DEV_LOGIN=true).
 *
 * Usage: npx tsx scripts/probe-seller-controlled-variants.ts
 * Or:    npm run test:seller-controlled-variants
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

async function makeProduct(token: string, brandId: string, categoryId: string, title: string, stock: number) {
  const r = await fetch(`${base}/catalog/products`, {
    method: 'POST', headers: H(token),
    body: JSON.stringify({
      title, brandId, categoryId, categoryName: 'General', price: 500, originalPrice: 600,
      stock, status: 'live', modeType: 'retail',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
      description: 'probe fixture',
    }),
  });
  const b = (await j(r)) as { data?: { id: string } };
  if (!r.ok || !b.data?.id) throw new Error(`create product failed: ${r.status}`);
  return b.data.id;
}

async function putDetail(token: string, productId: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT', headers: H(token),
    body: JSON.stringify({ productId, specs: [], optionGroups: [], productVariants: [], addonItems: [], ...body }),
  });
  return { status: r.status, body: (await j(r)) as { error?: string } };
}

async function getPublicProduct(productId: string) {
  const r = await fetch(`${base}/catalog/products/${productId}`);
  const b = (await j(r)) as { productVariants?: Array<{ id: string; options: Record<string, string> }> };
  return b.productVariants ?? [];
}

function keyOf(options: Record<string, string>): string {
  return Object.keys(options).sort().map((k) => `${k}=${options[k]}`).join('|');
}

async function addToCart(token: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/cart/items`, { method: 'POST', headers: H(token), body: JSON.stringify(body) });
  return { status: r.status, body: (await j(r)) as any };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const brands = (await j(await fetch(`${base}/catalog/brands`, { headers: H(seller.token) }))) as { data?: Array<{ id: string }> };
  const brandId = brands.data?.[0]?.id;
  if (!brandId) throw new Error('seeded seller has no brand');
  const cat = (await j(await fetch(`${base}/catalog/categories`, {
    method: 'POST', headers: H(admin.token),
    body: JSON.stringify({ name: `Generic SCV ${RID}`, slug: `generic-scv-${RID}`, parentId: null, enabled: true }),
  }))) as { data?: { id: string } };
  const categoryId = cat.data!.id;

  // ═══ A. Irregular/uneven tree, nonsense dimension names ═══════════════════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV Irregular A ${RID}`, 100);
    // Zone: Alpha (used with 2 Span values), Beta (used with only 1) —
    // deliberately uneven, mirroring the user's Black/White example shape.
    const combos = [
      { Zone: 'Alpha', Span: '10' },
      { Zone: 'Alpha', Span: '20' },
      { Zone: 'Beta', Span: '30' },
    ];
    const put = await putDetail(seller.token, pid, {
      optionGroups: [
        { id: 'og-zone', name: 'Zone', displayType: 'pills', values: ['Alpha', 'Beta'], custom: true },
        { id: 'og-span', name: 'Span', displayType: 'pills', values: ['10', '20', '30'], custom: true },
      ],
      productVariants: combos.map((c, i) => ({
        id: `scv-a-${i}-${RID}`, sku: `A-${i}-${RID}`, price: 500 + i * 10, stock: 5 + i, options: c, status: 'active',
      })),
    });
    ok(put.status === 200, 'A: irregular tree saves without error', put.body);

    const variants = await getPublicProduct(pid);
    ok(variants.length === 3, 'A: exactly 3 variants persisted, not the full 2x3=6 matrix', { length: variants.length });
    const keys = new Set(variants.map((v) => keyOf(v.options)));
    ok(keys.has(keyOf({ Zone: 'Alpha', Span: '10' })), 'A: Alpha/10 present');
    ok(keys.has(keyOf({ Zone: 'Alpha', Span: '20' })), 'A: Alpha/20 present');
    ok(keys.has(keyOf({ Zone: 'Beta', Span: '30' })), 'A: Beta/30 present');
    // The invented, never-configured combinations must NOT exist.
    ok(!keys.has(keyOf({ Zone: 'Alpha', Span: '30' })), 'A: Alpha/30 NOT invented (Alpha never paired with 30)');
    ok(!keys.has(keyOf({ Zone: 'Beta', Span: '10' })), 'A: Beta/10 NOT invented (Beta only ever paired with 30)');
    ok(!keys.has(keyOf({ Zone: 'Beta', Span: '20' })), 'A: Beta/20 NOT invented');
  }

  // ═══ B. The exact reported shape: Size x Origin, uneven ══════════════════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV Reported-Shape B ${RID}`, 100);
    const combos = [
      { Size: 'EU39', Origin: 'UK' },
      { Size: 'EU39', Origin: 'USA' },
      { Size: 'EU40', Origin: 'UK' },
      { Size: 'EU41', Origin: 'Vietnam' },
    ];
    const put = await putDetail(seller.token, pid, {
      optionGroups: [
        { id: 'og-size', name: 'Size', displayType: 'pills', values: ['EU39', 'EU40', 'EU41'], custom: true },
        { id: 'og-origin', name: 'Origin', displayType: 'pills', values: ['UK', 'USA', 'Vietnam'], custom: true },
      ],
      productVariants: combos.map((c, i) => ({
        id: `scv-b-${i}-${RID}`, sku: `B-${i}-${RID}`, price: 500 + i * 5, stock: 5, options: c, status: 'active',
      })),
    });
    ok(put.status === 200, 'B: uneven Size x Origin tree saves without error');

    const variants = await getPublicProduct(pid);
    ok(variants.length === 4, 'B: exactly 4 of the 9 mathematically-possible combinations exist', { length: variants.length });
    const keys = new Set(variants.map((v) => keyOf(v.options)));
    const missing = [
      { Size: 'EU39', Origin: 'Vietnam' },
      { Size: 'EU40', Origin: 'USA' },
      { Size: 'EU40', Origin: 'Vietnam' },
      { Size: 'EU41', Origin: 'UK' },
      { Size: 'EU41', Origin: 'USA' },
    ];
    ok(missing.every((c) => !keys.has(keyOf(c))), 'B: all 5 non-configured combinations are genuinely absent, not invented', {
      missingStillAbsent: missing.map((c) => !keys.has(keyOf(c))),
    });
  }

  // ═══ C. Server-side duplicate-combination rejection ══════════════════════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV Duplicate C ${RID}`, 50);
    const put = await putDetail(seller.token, pid, {
      optionGroups: [{ id: 'og-hue', name: 'Hue', displayType: 'pills', values: ['Crimson', 'Azure'], custom: true }],
      productVariants: [
        { id: `scv-c-0-${RID}`, sku: 'C-0', price: 500, stock: 5, options: { Hue: 'Crimson' }, status: 'active' },
        { id: `scv-c-1-${RID}`, sku: 'C-1', price: 550, stock: 5, options: { Hue: 'Crimson' }, status: 'active' },
      ],
    });
    ok(put.status === 400, 'C: two rows with the identical combination (Hue=Crimson) are rejected server-side', put);
  }

  // ═══ D. Candidate variant (no stock ever set) cannot be purchased ════════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV Candidate D ${RID}`, 500); // healthy BASE stock
    const candidateId = `scv-d-candidate-${RID}`;
    await putDetail(seller.token, pid, {
      optionGroups: [{ id: 'og-model', name: 'Model', displayType: 'pills', values: ['X1', 'X2'], custom: true }],
      productVariants: [
        // A row the seller generated/added but never gave a stock number —
        // exactly the "candidate, not yet reviewed" state this task protects.
        { id: candidateId, sku: 'D-CAND', price: 500, options: { Model: 'X1' }, status: 'active' },
      ],
    });
    const cart = await addToCart(seller.token, { listingType: 'product', listingId: pid, variantId: candidateId, quantity: 1 });
    ok(cart.status !== 201, 'D: adding the stockless candidate variant to cart is rejected, not silently accepted', cart);
    ok(
      /insufficient stock/i.test(cart.body?.error || ''),
      'D: rejection reason is insufficient stock (0), not a forged/invalid-variant error',
      cart.body,
    );
    // Confirm it did not borrow the base product's 500 units.
    const invRes = await fetch(`${base}/catalog/products/${pid}/inventory?variantId=${candidateId}`, { headers: H(seller.token) });
    const invBody = (await j(invRes)) as { data?: { availableQuantity?: number; quantity?: number } };
    const seeded = invBody.data?.quantity ?? invBody.data?.availableQuantity;
    ok(
      seeded === undefined || seeded === 0,
      "D: the candidate variant's inventory record (if created at all) was NOT seeded from the base product's 500 units",
      invBody,
    );
  }

  // ═══ E. 4-dimension sparse tree, arbitrary names ══════════════════════════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV FourDim E ${RID}`, 100);
    const combos = [
      { Alpha: 'A1', Beta: 'B1', Gamma: 'G1', Delta: 'D1' },
      { Alpha: 'A1', Beta: 'B2', Gamma: 'G1', Delta: 'D2' },
      { Alpha: 'A2', Beta: 'B1', Gamma: 'G2', Delta: 'D1' },
    ];
    const put = await putDetail(seller.token, pid, {
      optionGroups: [
        { id: 'og-a', name: 'Alpha', displayType: 'pills', values: ['A1', 'A2'], custom: true },
        { id: 'og-b', name: 'Beta', displayType: 'pills', values: ['B1', 'B2'], custom: true },
        { id: 'og-g', name: 'Gamma', displayType: 'pills', values: ['G1', 'G2'], custom: true },
        { id: 'og-d', name: 'Delta', displayType: 'pills', values: ['D1', 'D2'], custom: true },
      ],
      productVariants: combos.map((c, i) => ({
        id: `scv-e-${i}-${RID}`, sku: `E-${i}-${RID}`, price: 500, stock: 5, options: c, status: 'active',
      })),
    });
    ok(put.status === 200, 'E: 4-dimension sparse tree saves without error');
    const variants = await getPublicProduct(pid);
    ok(variants.length === 3, 'E: exactly 3 of the 2^4=16 possible combinations exist', { length: variants.length });
    const keys = new Set(variants.map((v) => keyOf(v.options)));
    ok(
      combos.every((c) => keys.has(keyOf(c))) && !keys.has(keyOf({ Alpha: 'A2', Beta: 'B2', Gamma: 'G2', Delta: 'D2' })),
      'E: all 3 configured combinations present, an uninvolved 4th combination is not invented',
    );
  }

  // ═══ F. 1-dimension product (no cross-dimension logic to go wrong) ═══════
  {
    const pid = await makeProduct(seller.token, brandId, categoryId, `SCV OneDim F ${RID}`, 100);
    const put = await putDetail(seller.token, pid, {
      optionGroups: [{ id: 'og-only', name: 'Only', displayType: 'pills', values: ['One', 'Two', 'Three'], custom: true }],
      productVariants: ['One', 'Two', 'Three'].map((v, i) => ({
        id: `scv-f-${i}-${RID}`, sku: `F-${i}-${RID}`, price: 500, stock: 5, options: { Only: v }, status: 'active',
      })),
    });
    ok(put.status === 200, 'F: 1-dimension product saves without error');
    const variants = await getPublicProduct(pid);
    ok(variants.length === 3, 'F: all 3 single-dimension variants present', { length: variants.length });
  }

  console.log('\n=== Seller-controlled variants probe DONE ===');
  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('ALL SELLER-CONTROLLED VARIANT CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
