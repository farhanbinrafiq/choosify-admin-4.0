/**
 * LOCAL visual-acceptance fixtures for the variants + add-ons sprint.
 *
 * Creates — through the CANONICAL schema / catalog / detail / inventory APIs only
 * (no snapshot poking, no mock data) — a dedicated seller + brand + three
 * categories with real variant schemas, and six listings:
 *
 *   1. Fashion tee        — Size × Color, per-combo price/stock, 1 inactive combo, + add-ons
 *   2. Electronics phone  — Storage × RAM, one combo carries an MRP
 *   3. Furniture table    — Finish × Length  (proves arbitrary dimension names)
 *   4. Consultation       — service-type product, Tier variant, NO physical stock
 *   5. Gift hamper        — add-ons only, no variants
 *   6. Sneaker            — Size × Color variants AND add-ons together
 *
 * Prints the Product Studio + storefront URLs and the click-through script.
 *
 * Usage:  npx tsx scripts/seed-variant-acceptance.ts
 * Or:     npm run seed:variant-acceptance
 *
 * Local dev only (guards on .env pointing at the local dev DB).
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });
if (!/choosify_admin_dev/.test(readFileSync('.env', 'utf8'))) {
  console.error('ABORT — .env is not the local dev database.');
  process.exit(1);
}

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const STUDIO = 'http://localhost:3001';
const STORE = 'http://localhost:5173';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const TAG = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

const j = (r: Response) => r.json().catch(() => ({}));
const H = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

async function login(email: string, password: string) {
  const b = (await j(await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  }))) as { accessToken?: string; uid?: string };
  if (!b.accessToken) throw new Error(`login ${email} failed`);
  return { token: b.accessToken, uid: b.uid as string };
}

async function provisionSeller(adminToken: string, email: string) {
  const apply = await fetch(`${base}/auth/partner-apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicantType: 'seller', email, password: 'Accept!2026xx',
      displayName: 'Variant Acceptance Seller', businessOrChannelName: `Variant Acceptance Store ${TAG}`,
      phone: '+8801711009900', category: 'General', city: 'Dhaka',
    }),
  });
  if (!apply.ok && apply.status !== 409) throw new Error(`partner-apply: ${apply.status}`);
  const list = (await j(await fetch(`${base}/operations/partner-applications?status=pending`, { headers: H(adminToken) }))) as {
    applications?: Array<{ id: string; email?: string }>;
  };
  const app = (list.applications || []).find((a) => a.email === email);
  if (app) {
    await fetch(`${base}/operations/partner-applications/${app.id}/approve`, {
      method: 'POST', headers: H(adminToken), body: JSON.stringify({ note: 'variant acceptance seed' }),
    });
  }
  const s = await login(email, 'Accept!2026xx');
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
    body: JSON.stringify({ name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${TAG}`, parentId: null, enabled: true }),
  }))) as { data?: { id: string } };
  const id = c.data!.id;
  for (const d of dims) {
    await fetch(`${base}/catalog/categories/${id}/attributes`, {
      method: 'POST', headers: H(adminToken),
      body: JSON.stringify({ name: d.name, type: 'select', variantEligible: true, options: d.options }),
    });
  }
  return id;
}

async function makeBrand(token: string, name: string) {
  const b = (await j(await fetch(`${base}/catalog/brands`, {
    method: 'POST', headers: H(token), body: JSON.stringify({ name, category: 'General', description: 'Variant acceptance brand' }),
  }))) as { data?: { id: string } };
  return b.data!.id;
}

async function makeProduct(token: string, p: Record<string, unknown>) {
  const b = (await j(await fetch(`${base}/catalog/products`, {
    method: 'POST', headers: H(token),
    body: JSON.stringify({ status: 'live', stock: 0, image: 'https://picsum.photos/seed/' + Math.random().toString(36).slice(2) + '/640/480', description: 'Variant acceptance fixture', ...p }),
  }))) as { data?: { id: string; slug: string }; error?: string };
  if (!b.data?.id) throw new Error(`product: ${b.error}`);
  return b.data;
}

async function putDetail(token: string, productId: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/catalog/product-details/${productId}`, {
    method: 'PUT', headers: H(token),
    body: JSON.stringify({ productId, specs: [], optionGroups: [], productVariants: [], addonItems: [], enableOptions: true, enableAddonItems: true, ...body }),
  });
  const b = (await j(r)) as { error?: string };
  if (!r.ok) throw new Error(`detail ${productId}: ${b.error}`);
}

async function setInv(token: string, productId: string, quantity: number, variantId?: string) {
  await fetch(`${base}/catalog/products/${productId}/inventory`, {
    method: 'PATCH', headers: H(token),
    body: JSON.stringify({ quantity, ...(variantId ? { variantId } : {}) }),
  });
}

async function main() {
  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const seller = await provisionSeller(admin.token, `variant-accept-${TAG}@probe.local`);
  const brand = await makeBrand(seller.token, `Variant Acceptance ${TAG}`);
  await fetch(`${base}/catalog/brands/${brand}/marketplace-access`, {
    method: 'PATCH', headers: H(admin.token), body: JSON.stringify({ status: 'granted' }),
  });

  const fashionCat = await makeCategory(admin.token, `Acceptance Fashion ${TAG}`, [
    { name: 'Size', options: ['S', 'M', 'L', 'XL'] },
    { name: 'Color', options: ['Black', 'White', 'Sunset Orange'] },
  ]);
  const elecCat = await makeCategory(admin.token, `Acceptance Electronics ${TAG}`, [
    { name: 'Storage', options: ['128GB', '256GB', '512GB'] },
    { name: 'RAM', options: ['8GB', '12GB'] },
    { name: 'Color', options: ['Midnight', 'Silver', 'Starlight'] },
  ]);
  const furnCat = await makeCategory(admin.token, `Acceptance Furniture ${TAG}`, [
    { name: 'Finish', options: ['Oak', 'Walnut', 'Matte Black'] },
    { name: 'Length', options: ['120cm', '160cm', '200cm'] },
  ]);
  const footwearCat = await makeCategory(admin.token, `Acceptance Footwear ${TAG}`, [
    { name: 'Size (EU)', options: ['EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43'] },
    { name: 'Colour', options: ['Black', 'White', 'Volt'] },
  ]);
  const servicesCat = await makeCategory(admin.token, `Acceptance Services ${TAG}`, [
    { name: 'Service Tier', options: ['Standard', 'Premium', 'Enterprise'] },
    { name: 'Duration', options: ['30 min', '60 min', '90 min'] },
  ]);

  const out: Array<{ label: string; id: string; slug: string; note: string }> = [];

  // 1. Fashion tee — Size × Color, per-combo price/stock, 1 inactive, + add-ons
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Linen Tee ${TAG}`, brandId: brand, categoryId: fashionCat, price: 900 });
    const v = (s: string, c: string) => `tee-${s}-${c}-${TAG}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M', 'L'] },
        { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Black', 'White', 'Sunset Orange'] },
      ],
      productVariants: [
        { id: v('M', 'Black'), sku: `TEE-MB-${TAG}`, price: 900, originalPrice: 1200, stock: 8, options: { Size: 'M', Color: 'Black' }, status: 'active' },
        { id: v('L', 'Black'), sku: `TEE-LB-${TAG}`, price: 990, stock: 4, options: { Size: 'L', Color: 'Black' }, status: 'active' },
        { id: v('M', 'White'), sku: `TEE-MW-${TAG}`, price: 900, stock: 6, options: { Size: 'M', Color: 'White' }, status: 'active' },
        { id: v('S', 'Sunset Orange'), sku: `TEE-SO-${TAG}`, price: 850, stock: 10, options: { Size: 'S', Color: 'Sunset Orange' }, status: 'inactive' },
      ],
      addonItems: [
        { id: `tee-ad-gift-${TAG}`, title: 'Gift Wrap', description: 'Premium festive wrap', price: 150, enabled: true, sortOrder: 1, badge: 'Popular' },
        { id: `tee-ad-mono-${TAG}`, title: 'Monogramming', description: 'Your initials, embroidered', price: 400, enabled: true, sortOrder: 2, maxQuantity: 3 },
        { id: `tee-ad-off-${TAG}`, title: 'Seasonal Add-on (paused)', price: 999, enabled: false, sortOrder: 3 },
      ],
    });
    await setInv(seller.token, p.id, 8, v('M', 'Black'));
    await setInv(seller.token, p.id, 4, v('L', 'Black'));
    await setInv(seller.token, p.id, 6, v('M', 'White'));
    out.push({ label: '1. Fashion tee (Size × Color + add-ons)', id: p.id, slug: p.slug, note: 'M/Black 900 (MRP 1200) · L/Black 990 · S/Sunset Orange = inactive · Gift Wrap +150 / Monogramming +400 (max 3)' });
  }

  // 2. Electronics phone — Storage + Color (schema) + custom "Origin" (USA/UK/Japan/India/Dubai), sparse
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Phone ${TAG}`, brandId: brand, categoryId: elecCat, price: 42000 });
    let n = 0;
    const nv = () => `phone-${TAG}-${n++}`;
    const rows: Array<{ id: string; sku: string; price: number; originalPrice?: number; stock: number; options: Record<string, string>; status: 'active' | 'inactive' }> = [
      { id: nv(), sku: `PH-128MI-${TAG}`, price: 38000, stock: 6, options: { Storage: '128GB', Color: 'Midnight', Origin: 'India' }, status: 'active' },
      { id: nv(), sku: `PH-128SD-${TAG}`, price: 40000, stock: 4, options: { Storage: '128GB', Color: 'Silver', Origin: 'Dubai' }, status: 'active' },
      { id: nv(), sku: `PH-128MU-${TAG}`, price: 44000, stock: 3, options: { Storage: '128GB', Color: 'Midnight', Origin: 'USA' }, status: 'active' },
      { id: nv(), sku: `PH-256MU-${TAG}`, price: 52000, originalPrice: 60000, stock: 3, options: { Storage: '256GB', Color: 'Midnight', Origin: 'USA' }, status: 'active' },
      { id: nv(), sku: `PH-256SJ-${TAG}`, price: 54000, stock: 2, options: { Storage: '256GB', Color: 'Starlight', Origin: 'Japan' }, status: 'active' },
      { id: nv(), sku: `PH-256SU-${TAG}`, price: 51000, stock: 5, options: { Storage: '256GB', Color: 'Silver', Origin: 'UK' }, status: 'active' },
      { id: nv(), sku: `PH-512MU-${TAG}`, price: 68000, stock: 1, options: { Storage: '512GB', Color: 'Midnight', Origin: 'USA' }, status: 'active' },
      { id: nv(), sku: `PH-512SD-${TAG}`, price: 65000, stock: 0, options: { Storage: '512GB', Color: 'Starlight', Origin: 'Dubai' }, status: 'active' },
    ];
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-storage', name: 'Storage', displayType: 'pills', values: ['128GB', '256GB', '512GB'] },
        { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Midnight', 'Silver', 'Starlight'] },
        { id: 'og-origin', name: 'Origin', displayType: 'pills', values: ['USA', 'UK', 'Japan', 'India', 'Dubai'], custom: true },
      ],
      productVariants: rows,
    });
    for (const r of rows) await setInv(seller.token, p.id, r.stock, r.id);
    out.push({ label: '2. Phone — Storage + Color (schema) + custom "Origin" USA/UK/Japan/India/Dubai (sparse)', id: p.id, slug: p.slug, note: 'Storage + Color from the Electronics schema; "Origin" is a seller custom dimension (marked *) — grey-market imports. India 128 = 38000 · USA 256 = 52000 (MRP 60000) · Japan 256 = 54000 · USA 512 = 68000 · Dubai 512 = out of stock. Sparse — only ~8 of 45 Storage×Color×Origin combos are stocked.' });
  }

  // 3. Furniture table — Finish × Length (arbitrary dimension names)
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Dining Table ${TAG}`, brandId: brand, categoryId: furnCat, price: 30000 });
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-finish', name: 'Finish', displayType: 'swatch', values: ['Oak', 'Walnut', 'Matte Black'] },
        { id: 'og-length', name: 'Length', displayType: 'pills', values: ['160cm', '200cm'] },
      ],
      productVariants: [
        { id: `tbl-oak-160-${TAG}`, sku: `TBL-O160-${TAG}`, price: 30000, stock: 3, options: { Finish: 'Oak', Length: '160cm' }, status: 'active' },
        { id: `tbl-oak-200-${TAG}`, sku: `TBL-O200-${TAG}`, price: 36000, stock: 2, options: { Finish: 'Oak', Length: '200cm' }, status: 'active' },
        { id: `tbl-wal-200-${TAG}`, sku: `TBL-W200-${TAG}`, price: 41000, originalPrice: 45000, stock: 1, options: { Finish: 'Walnut', Length: '200cm' }, status: 'active' },
        { id: `tbl-mb-160-${TAG}`, sku: `TBL-M160-${TAG}`, price: 33000, stock: 0, options: { Finish: 'Matte Black', Length: '160cm' }, status: 'active' },
      ],
    });
    for (const [vid, q] of [['tbl-oak-160', 3], ['tbl-oak-200', 2], ['tbl-wal-200', 1], ['tbl-mb-160', 0]] as const)
      await setInv(seller.token, p.id, q, `${vid}-${TAG}`);
    out.push({ label: '3. Furniture table (Finish × Length — arbitrary names)', id: p.id, slug: p.slug, note: 'Oak/160 30000 · Oak/200 36000 · Walnut/200 41000 (MRP 45000) · Matte Black/160 out of stock' });
  }

  // 4. Consultation — service: Service Tier × Duration drives price, NO physical stock
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Design Consultation ${TAG}`, brandId: brand, categoryId: servicesCat, price: 2500, productType: 'service' });
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-tier', name: 'Service Tier', displayType: 'pills', values: ['Standard', 'Premium'] },
        { id: 'og-duration', name: 'Duration', displayType: 'pills', values: ['30 min', '60 min', '90 min'] },
      ],
      productVariants: [
        { id: `svc-std-30-${TAG}`, sku: `SVC-S30-${TAG}`, price: 2500, options: { 'Service Tier': 'Standard', Duration: '30 min' }, status: 'active' },
        { id: `svc-std-60-${TAG}`, sku: `SVC-S60-${TAG}`, price: 4000, options: { 'Service Tier': 'Standard', Duration: '60 min' }, status: 'active' },
        { id: `svc-prm-60-${TAG}`, sku: `SVC-P60-${TAG}`, price: 7000, originalPrice: 8500, options: { 'Service Tier': 'Premium', Duration: '60 min' }, status: 'active' },
        { id: `svc-prm-90-${TAG}`, sku: `SVC-P90-${TAG}`, price: 10000, options: { 'Service Tier': 'Premium', Duration: '90 min' }, status: 'active' },
      ],
      addonItems: [
        { id: `svc-ad-rush-${TAG}`, title: 'Rush turnaround (48h)', price: 1500, enabled: true, sortOrder: 1, badge: 'Popular' },
        { id: `svc-ad-rec-${TAG}`, title: 'Recorded session + notes', price: 500, enabled: true, sortOrder: 2 },
      ],
    });
    out.push({ label: '4. Service consultation — Service Tier × Duration (NO stock)', id: p.id, slug: p.slug, note: 'Standard/30 = 2500 · Standard/60 = 4000 · Premium/60 = 7000 (MRP 8500) · Premium/90 = 10000. No stock badges, no inventory reservation. Rush +1500 / Recorded +500. Sparse — Standard/90 & Premium/30 simply don\'t exist.' });
  }

  // 5. Gift hamper — add-ons only, no variants
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Gift Hamper ${TAG}`, brandId: brand, categoryId: fashionCat, price: 2500, stock: 25 });
    await putDetail(seller.token, p.id, {
      addonItems: [
        { id: `hmp-ad-card-${TAG}`, title: 'Handwritten Card', description: 'We write your message', price: 100, enabled: true, sortOrder: 1 },
        { id: `hmp-ad-choc-${TAG}`, title: 'Add Belgian Chocolates', price: 600, enabled: true, sortOrder: 2, badge: 'Best Value' },
        { id: `hmp-ad-bal-${TAG}`, title: 'Balloon Bundle', price: 350, enabled: true, sortOrder: 3, maxQuantity: 2 },
      ],
    });
    await setInv(seller.token, p.id, 25);
    out.push({ label: '5. Gift hamper (add-ons only, no variants)', id: p.id, slug: p.slug, note: 'Base 2500 · Card +100 · Chocolates +600 · Balloons +350 (max 2) — total updates as you toggle' });
  }

  // 6. Sneaker — Size (EU) schema + seller-added "UK 8" value + custom "Grade" dim + add-ons, sparse matrix
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Runner Sneaker ${TAG}`, brandId: brand, categoryId: footwearCat, price: 6800 });
    let n = 0;
    const nv = () => `snk-${TAG}-${n++}`;
    const rows: Array<{ id: string; sku: string; price: number; originalPrice?: number; stock: number; options: Record<string, string>; status: 'active' | 'inactive' }> = [
      { id: nv(), sku: `SNK-41BR-${TAG}`, price: 6800, stock: 5, options: { 'Size (EU)': 'EU 41', Colour: 'Black', Grade: 'Retail' }, status: 'active' },
      { id: nv(), sku: `SNK-42BR-${TAG}`, price: 6800, stock: 4, options: { 'Size (EU)': 'EU 42', Colour: 'Black', Grade: 'Retail' }, status: 'active' },
      { id: nv(), sku: `SNK-41BO-${TAG}`, price: 5200, originalPrice: 6000, stock: 8, options: { 'Size (EU)': 'EU 41', Colour: 'Black', Grade: 'OEM' }, status: 'active' },
      { id: nv(), sku: `SNK-42WO-${TAG}`, price: 5200, stock: 6, options: { 'Size (EU)': 'EU 42', Colour: 'White', Grade: 'OEM' }, status: 'active' },
      { id: nv(), sku: `SNK-41V1-${TAG}`, price: 4200, stock: 3, options: { 'Size (EU)': 'EU 41', Colour: 'Volt', Grade: '1:1' }, status: 'active' },
      { id: nv(), sku: `SNK-UK8BO-${TAG}`, price: 5200, stock: 2, options: { 'Size (EU)': 'UK 8', Colour: 'Black', Grade: 'OEM' }, status: 'active' },
      { id: nv(), sku: `SNK-42B1-${TAG}`, price: 4200, stock: 0, options: { 'Size (EU)': 'EU 42', Colour: 'Black', Grade: '1:1' }, status: 'active' },
    ];
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-size-eu', name: 'Size (EU)', displayType: 'pills', values: ['EU 41', 'EU 42', 'UK 8'], customValues: ['UK 8'] },
        { id: 'og-colour', name: 'Colour', displayType: 'swatch', values: ['Black', 'White', 'Volt'] },
        { id: 'og-grade', name: 'Grade', displayType: 'pills', values: ['Retail', 'OEM', '1:1'], custom: true },
      ],
      productVariants: rows,
      addonItems: [
        { id: `snk-ad-socks-${TAG}`, title: 'Performance Socks (2 pack)', price: 450, enabled: true, sortOrder: 1 },
        { id: `snk-ad-care-${TAG}`, title: 'Shoe Care Kit', price: 800, enabled: true, sortOrder: 2, badge: 'Recommended' },
      ],
    });
    for (const r of rows) await setInv(seller.token, p.id, r.stock, r.id);
    out.push({ label: '6. Sneaker — Size (EU) + seller-added "UK 8" + custom "Grade" + add-ons (sparse)', id: p.id, slug: p.slug, note: 'Size (EU) is the Footwear schema; "UK 8" is a seller-appended value (dashed "· yours" chip). "Grade" (Retail / OEM / 1:1) is a seller custom dimension (marked *). Retail 6800 · OEM 5200 (EU 41/Black MRP 6000) · 1:1 4200 · EU 42/Black/1:1 out of stock. Sparse — most EU×Colour×Grade combos simply don\'t exist.' });
  }

  // 7. Smartwatch — Storage + Colour (Electronics schema) + custom Connectivity + custom Strap Material, sparse
  {
    const p = await makeProduct(seller.token, { title: `Acceptance Smartwatch ${TAG}`, brandId: brand, categoryId: elecCat, price: 12000 });
    let n = 0;
    const nv = () => `sw-${TAG}-${n++}`;
    const rows: Array<{ id: string; sku: string; price: number; originalPrice?: number; stock: number; options: Record<string, string>; status: 'active' | 'inactive' }> = [
      { id: nv(), sku: `SW-A-${TAG}`, price: 12000, stock: 6, options: { Storage: '128GB', Color: 'Midnight', Connectivity: 'Bluetooth', 'Strap Material': 'Silicone' }, status: 'active' },
      { id: nv(), sku: `SW-B-${TAG}`, price: 12000, stock: 4, options: { Storage: '128GB', Color: 'Starlight', Connectivity: 'Bluetooth', 'Strap Material': 'Silicone' }, status: 'active' },
      { id: nv(), sku: `SW-C-${TAG}`, price: 14000, stock: 3, options: { Storage: '256GB', Color: 'Midnight', Connectivity: 'Bluetooth', 'Strap Material': 'Silicone' }, status: 'active' },
      { id: nv(), sku: `SW-D-${TAG}`, price: 15500, originalPrice: 17000, stock: 2, options: { Storage: '256GB', Color: 'Midnight', Connectivity: 'Bluetooth', 'Strap Material': 'Milanese' }, status: 'active' },
      { id: nv(), sku: `SW-E-${TAG}`, price: 17000, stock: 5, options: { Storage: '256GB', Color: 'Midnight', Connectivity: 'Wi-Fi + Cellular (4G)', 'Strap Material': 'Silicone' }, status: 'active' },
      { id: nv(), sku: `SW-F-${TAG}`, price: 19000, stock: 2, options: { Storage: '256GB', Color: 'Starlight', Connectivity: 'Wi-Fi + Cellular (4G)', 'Strap Material': 'Milanese' }, status: 'active' },
      { id: nv(), sku: `SW-G-${TAG}`, price: 17000, stock: 0, options: { Storage: '256GB', Color: 'Starlight', Connectivity: 'Wi-Fi + Cellular (4G)', 'Strap Material': 'Silicone' }, status: 'active' },
    ];
    await putDetail(seller.token, p.id, {
      optionGroups: [
        { id: 'og-storage', name: 'Storage', displayType: 'pills', values: ['128GB', '256GB'] },
        { id: 'og-color', name: 'Color', displayType: 'swatch', values: ['Midnight', 'Starlight'] },
        { id: 'og-conn', name: 'Connectivity', displayType: 'pills', values: ['Bluetooth', 'Wi-Fi + Cellular (4G)'], custom: true },
        { id: 'og-strap', name: 'Strap Material', displayType: 'pills', values: ['Silicone', 'Milanese'], custom: true },
      ],
      productVariants: rows,
    });
    for (const r of rows) await setInv(seller.token, p.id, r.stock, r.id);
    out.push({ label: '7. Smartwatch — Storage + Colour (schema) + custom Connectivity + custom Strap Material (sparse)', id: p.id, slug: p.slug, note: 'Storage + Color come from the Electronics schema. "Connectivity" (Bluetooth vs Wi-Fi + Cellular 4G) and "Strap Material" are seller custom dimensions (marked *). BT 128/Midnight 12000 · BT 256/Midnight/Milanese 15500 (MRP 17000) · 4G 256/Midnight 17000 · 4G 256/Starlight/Milanese 19000 · 4G 256/Starlight/Silicone out of stock. Sparse — 4G only exists on 256GB.' });
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(' VARIANT + ADD-ON VISUAL ACCEPTANCE FIXTURES');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(` Seller login (Product Studio): variant-accept-${TAG}@probe.local  /  Accept!2026xx`);
  console.log(` Admin login:                   ${ADMIN_EMAIL}  /  ${DEV_PASSWORD}`);
  console.log('');
  for (const o of out) {
    console.log(`${o.label}`);
    console.log(`   Studio :  ${STUDIO}/admin/products/${o.id}/edit`);
    console.log(`   Store  :  ${STORE}/products/${o.slug}`);
    console.log(`   Try    :  ${o.note}`);
    console.log('');
  }
  console.log('Categories + their variant schema (admin: Category Management Studio):');
  console.log(`   Fashion ${fashionCat}      Size · Color`);
  console.log(`   Electronics ${elecCat}  Storage · RAM · Color`);
  console.log(`   Furniture ${furnCat}    Finish · Length`);
  console.log(`   Footwear ${footwearCat}     Size (EU) · Colour`);
  console.log(`   Services ${servicesCat}     Service Tier · Duration`);
  console.log('════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
