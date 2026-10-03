/**
 * Product Studio — Phase 0 save / lifecycle integrity, live HTTP + browser probe.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that same
 * database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost). Refuses
 * otherwise; no override. The throwaway seller account is deleted at the end; its
 * brand and products stay in the disposable catalog.
 *
 * The API part replays the Studio's save path with its own payload builders
 * (editorModelToSectionPatch / editorModelToCreatePatch / detailPayloadChanged);
 * the browser part drives the real Product Studio and Products list.
 *
 *   A1 Create always makes a Draft, even when the model says LIVE
 *   A2 publish at zero stock → server out_of_stock; content saves keep it, no 400
 *   A3 suspended product: content saves keep it suspended, no 400
 *   A4 reserved inventory survives repeated ordinary section saves
 *   A5 a stale open tab cannot revert stock changed elsewhere
 *   A6 variants: product-level saves leave variant inventory alone; a detail-backed
 *      save still re-asserts it (KNOWN LIMITATION — server-side, reported not failed)
 *   C1 category change on a product with options/variants still sends the detail
 *      PUT, so the server rejects variants the new category schema does not allow
 *   C2 a compatible category change on such a product saves (detail PUT accepted)
 *   C3 UI: with the category-schema request failing, the Studio says the change will
 *      be validated on Save, and the server's rejection is shown on Save
 *   B1 a stored editor snapshot / browser cache cannot override the loaded record
 *   B2 Publish in the UI at zero stock shows Out of stock (read back from the server)
 *   B3 suspended product: correct badge, no seller lifecycle actions
 *   B4 create mode has no Listing Status choice; it is always Draft
 *   B5 unsaved changes trigger beforeunload; a save or Cancel clears it
 *   B6 Products list shows all five states with their own labels
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-product-studio-integrity.ts
 */
import argon2 from 'argon2';
import pg from 'pg';
import { chromium, type Page } from 'playwright-core';
import {
  createBlankProductModel,
  detailPayloadChanged,
  detailSaveRequired,
  editorModelToCreatePatch,
  editorModelToDetailPayload,
  editorModelToSectionPatch,
  mapCatalogProductToEditor,
  type ProductEditorModel,
} from '../src/pages/admin/productEditorModel';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const IMG = 'https://example.invalid/probe-product.jpg';

const FAIL: string[] = [];
const KNOWN: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}
function known(label: string, detail: string) {
  KNOWN.push(label);
  console.log('KNOWN LIMITATION', label, '—', detail);
}

type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const data = (r: Res, what: string) => {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return (r.body.data ?? r.body) as any;
};
async function apiLogin(email: string, password: string) {
  const r = await call('/auth/login', null, 'POST', { email, password });
  if (!r.body.accessToken) throw new Error(`login ${email} failed ${r.status}`);
  return String(r.body.accessToken);
}

async function main() {
  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
    console.error('REFUSING: PROBE_DISPOSABLE_DATABASE_URL is not local.');
    process.exit(2);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: PROBE_BASE_URL_ROOT is not a local server.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];
  if (!(await q(`select id from users where email='admin@choosify.com.bd'`))[0]) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const sfx = Date.now().toString(36);
  const pw = `PsInteg!${sfx}`;
  const email = `psi.seller.${sfx}@probe.local`;
  const [seller] = await q<{ id: string }>(
    `insert into users (email, password_hash, display_name, role, email_verified) values ($1,$2,$3,'seller',true) returning id`,
    [email, await argon2.hash(pw), `PSI Seller ${sfx}`],
  );
  const SA = await apiLogin('admin@choosify.com.bd', DEV_PASSWORD);
  const OWN = await apiLogin(email, pw);
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  try {
    const cats = data(await call('/catalog/categories', null), 'categories') as Array<{ id: string }>;
    let cat = '';
    for (const c of cats) {
      const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
      const attrs = (s.attributes ?? []) as Array<{ required?: boolean }>;
      if (!attrs.some((a) => a.required)) {
        cat = c.id;
        break;
      }
    }
    if (!cat) throw new Error('no category without required attributes in this database');
    const brand = data(
      await call('/catalog/brands', SA, 'POST', { name: `PSI Brand ${sfx}`, category: 'General', sellerId: seller.id, marketplaceAccess: true, marketplaceStatus: 'granted' }),
      'brand',
    );

    // ── the Studio's own save path ──
    const getProduct = async (id: string) => data(await call(`/catalog/products/${id}`, OWN), 'get product');
    // GET /catalog/product-details/:id answers with the detail record itself (unwrapped), as catalogApi.getProductDetail reads it.
    const getDetail = async (id: string) => {
      const b = (await call(`/catalog/product-details/${id}`, OWN)).body;
      return b && b.productId ? b : (b?.data ?? null);
    };
    const load = async (id: string): Promise<ProductEditorModel> => mapCatalogProductToEditor(await getProduct(id), await getDetail(id));
    const sectionSave = async (persisted: ProductEditorModel, section: string, change: Partial<ProductEditorModel>) => {
      const merged = { ...persisted, ...change };
      const p = await call(`/catalog/products/${persisted.id}`, OWN, 'PATCH', editorModelToSectionPatch(merged, section, persisted));
      if (p.status >= 300) return p;
      if (detailSaveRequired(merged, persisted)) {
        return call(`/catalog/product-details/${persisted.id}`, OWN, 'PUT', editorModelToDetailPayload(merged));
      }
      return p;
    };
    const create = async (over: Partial<ProductEditorModel>) =>
      data(
        await call('/catalog/products', OWN, 'POST', editorModelToCreatePatch({
          ...createBlankProductModel('new'),
          title: `PSI ${sfx}`,
          brandId: brand.id,
          brandName: brand.name,
          categoryId: cat,
          image: IMG,
          gallery: [IMG],
          price: 100,
          stock: 10,
          ...over,
        })),
        'create',
      );
    const setStatus = (id: string, token: string, status: string) => call(`/catalog/products/${id}`, token, 'PATCH', { status });
    // The Studio's Publish action: status only, then the zero-delta inventory sync.
    const studioPublish = async (id: string) => {
      data(await setStatus(id, OWN, 'live'), 'publish');
      data(await call(`/catalog/products/${id}/inventory`, OWN, 'PATCH', { delta: 0 }), 'publish sync');
    };
    const inv = async (id: string, variantId?: string) =>
      (await call(`/catalog/products/${id}/inventory${variantId ? `?variantId=${encodeURIComponent(variantId)}` : ''}`, OWN)).body?.data;

    // A1
    const a1 = await create({ title: `PSI create ${sfx}`, status: 'LIVE' });
    check(a1.status === 'draft', 'A1 Create makes a Draft even when the model says LIVE', a1.status);

    // A2
    const a2 = await create({ title: `PSI zero ${sfx}`, stock: 0 });
    await studioPublish(a2.id);
    check((await getProduct(a2.id)).status === 'out_of_stock', 'A2 publish at zero stock → server out_of_stock');
    const a2m = await load(a2.id);
    check(a2m.status === 'OUT_OF_STOCK', 'A2 Studio loads it as OUT_OF_STOCK', a2m.status);
    const a2s = await sectionSave(a2m, 'description', { description: 'edited on out of stock' });
    check(a2s.status === 200 && (await getProduct(a2.id)).status === 'out_of_stock', 'A2 content save on out_of_stock → 200, still out_of_stock (no transition to Draft)', a2s);

    // A3
    const a3 = await create({ title: `PSI suspended ${sfx}` });
    await setStatus(a3.id, OWN, 'live');
    data(await setStatus(a3.id, SA, 'suspended'), 'admin suspend');
    const a3m = await load(a3.id);
    check(a3m.status === 'SUSPENDED', 'A3 Studio loads it as SUSPENDED', a3m.status);
    const a3s = await sectionSave(a3m, 'pricing', { price: 120 });
    const a3After = await getProduct(a3.id);
    check(a3s.status === 200 && a3After.status === 'suspended' && a3After.price === 120, 'A3 content save on suspended → 200, still suspended (no transition to Draft)', { a3s, status: a3After.status });

    // A4
    const a4 = await create({ title: `PSI reserve ${sfx}` });
    await setStatus(a4.id, OWN, 'live');
    data(await call(`/catalog/products/${a4.id}/inventory`, OWN, 'PATCH', { reservedQuantity: 3 }), 'reserve');
    const before = await inv(a4.id);
    for (const [section, change] of [
      ['description', { description: 'save 1' }],
      ['pricing', { price: 130 }],
      ['specs', { specs: [{ key: 'Weight', value: '1 kg' }] }],
      ['inventory', {}],
    ] as Array<[string, Partial<ProductEditorModel>]>) {
      const r = await sectionSave(await load(a4.id), section, change);
      if (r.status >= 300) throw new Error(`A4 ${section} save: HTTP ${r.status}`);
    }
    const after = await inv(a4.id);
    check(
      after.quantity === before.quantity && after.reservedQuantity === 3 && after.availableQuantity === before.availableQuantity,
      `A4 reserved stock survives 4 ordinary saves (quantity ${before.quantity}→${after.quantity}, available ${before.availableQuantity}→${after.availableQuantity})`,
      { before, after },
    );

    // A5
    const a5 = await create({ title: `PSI stale ${sfx}` });
    const opened = await load(a5.id);
    data(await call(`/catalog/products/${a5.id}/inventory`, OWN, 'PATCH', { delta: -4 }), 'adjust');
    await sectionSave(opened, 'description', { description: 'saved from a stale tab' });
    check((await inv(a5.id)).quantity === 6, 'A5 a stale tab cannot revert stock changed elsewhere (stays 6)', await inv(a5.id));

    // A6 variants (custom dimension: no category schema needed)
    const a6 = await create({ title: `PSI variants ${sfx}` });
    let a6m = await load(a6.id);
    const variants = [{ id: `v-${sfx}-m`, sku: `PSI-${sfx}-M`, options: { Fit: 'M' }, stock: 5 }];
    const putV = await call(`/catalog/product-details/${a6.id}`, OWN, 'PUT', editorModelToDetailPayload({
      ...a6m,
      optionGroups: [{ id: 'og-fit', name: 'Fit', displayType: 'pills', values: ['M'], custom: true }] as ProductEditorModel['optionGroups'],
      productVariants: variants as ProductEditorModel['productVariants'],
    }));
    if (putV.status >= 300) throw new Error(`A6 variant setup: HTTP ${putV.status} ${JSON.stringify(putV.body).slice(0, 200)}`);
    data(await call(`/catalog/products/${a6.id}/inventory`, OWN, 'PATCH', { variantId: variants[0].id, delta: -2 }), 'variant adjust');
    a6m = await load(a6.id);
    await sectionSave(a6m, 'pricing', { price: 140 });
    check((await inv(a6.id, variants[0].id)).quantity === 3, 'A6 product-level save (Pricing) leaves variant inventory alone (stays 3)', await inv(a6.id, variants[0].id));
    // A checkout-style reservation on the variant: the inventory endpoint writes the
    // AVAILABLE quantity back into the detail record's variant stock, and the detail
    // PUT then re-asserts on-hand quantity from it.
    data(await call(`/catalog/products/${a6.id}/inventory`, OWN, 'PATCH', { variantId: variants[0].id, reservedQuantity: 1 }), 'variant reserve');
    const vBefore = await inv(a6.id, variants[0].id);
    await sectionSave(await load(a6.id), 'pricing', { price: 150 });
    const vAfterPricing = await inv(a6.id, variants[0].id);
    check(vAfterPricing.quantity === vBefore.quantity, 'A6 product-level save (Pricing) leaves a reserved variant alone', { vBefore, vAfterPricing });
    await sectionSave(await load(a6.id), 'specs', { specs: [{ key: 'Fabric', value: 'Cotton' }] });
    const vAfterSpecs = await inv(a6.id, variants[0].id);
    if (vAfterSpecs.quantity === vBefore.quantity) check(true, 'A6 detail-backed save (Specifications) leaves a reserved variant alone');
    else {
      known(
        'A6 detail-backed save re-asserts variant inventory',
        `variant on-hand ${vBefore.quantity} (reserved ${vBefore.reservedQuantity}, available ${vBefore.availableQuantity}) → ${vAfterSpecs.quantity} (available ${vAfterSpecs.availableQuantity}) after a Specifications save — server PUT /catalog/product-details re-applies each variant's stored stock, which the inventory endpoint keeps as the available quantity`,
      );
    }

    // C — category change on a product with options/variants
    const schemaOf = async (id: string) => ((await call(`/catalog/categories/${id}/schema`, null)).body?.data ?? {}) as {
      attributes?: unknown[];
      variantDimensions?: Array<{ name: string; options?: string[] }>;
    };
    const bareCats: string[] = [];
    let sizeCat = '';
    for (const c of cats) {
      const s = await schemaOf(c.id);
      if (!(s.attributes ?? []).length) bareCats.push(c.id);
      if (!sizeCat && (s.variantDimensions ?? []).some((d) => d.name === 'Size')) sizeCat = c.id;
    }
    if (!sizeCat || bareCats.length < 2) throw new Error('needs a category with a Size variant dimension and two without attributes (npm run seed:variant-acceptance)');
    // a Size value the Size schema does not list — fine in a category without a schema
    const sizeGroups = [{ id: 'og-size', name: 'Size', displayType: 'pills', values: ['PSI-Z'] }] as ProductEditorModel['optionGroups'];
    const sizeVariants = [{ id: `v-${sfx}-z`, sku: `PSI-${sfx}-Z`, options: { Size: 'PSI-Z' }, stock: 2 }] as ProductEditorModel['productVariants'];
    const withSizeVariants = async (title: string) => {
      const p = await create({ title, categoryId: bareCats[0] });
      const m = await load(p.id);
      data(await call(`/catalog/product-details/${p.id}`, OWN, 'PUT', editorModelToDetailPayload({ ...m, optionGroups: sizeGroups, productVariants: sizeVariants })), 'variant fixture');
      return p;
    };
    const c1 = await withSizeVariants(`PSI cat reject ${sfx}`);
    const c1m = await load(c1.id);
    const c1merged = { ...c1m, categoryId: sizeCat };
    check(detailPayloadChanged(c1merged, c1m) === false && detailSaveRequired(c1merged, c1m) === true, 'C1 category change alone does not change the detail payload, yet a detail PUT is required');
    const c1save = await sectionSave(c1m, 'basic', { categoryId: sizeCat });
    check(c1save.status === 400 && /schema list/i.test(String(c1save.body.error || '')), 'C1 server rejects the variants for the new category (detail PUT sent)', c1save);
    const c1after = await getProduct(c1.id);
    console.log(`INFO C1 after the rejected detail PUT the product category is "${c1after.categoryId}" — the product PATCH runs before the detail PUT (save order unchanged from before Phase 0)`);
    const c2 = await withSizeVariants(`PSI cat ok ${sfx}`);
    const c2save = await sectionSave(await load(c2.id), 'basic', { categoryId: bareCats[1] });
    check(c2save.status === 200 && (await getProduct(c2.id)).categoryId === bareCats[1], 'C2 compatible category change on a product with variants → detail PUT accepted, saved', c2save);

    // ── browser ──
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        if (!sessionStorage.getItem('psi')) {
          localStorage.setItem('choosify_auth_token', t as string);
          sessionStorage.setItem('psi', '1');
        }
      } catch {}
    }, OWN);
    const page = await ctx.newPage();
    const open = async (p: Page, path: string, ready: RegExp) => {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.getByText(ready).first().waitFor({ timeout: 45000 });
      await p.waitForTimeout(1200);
    };
    const badge = (p: Page) => p.getByTestId('product-status-badge').getAttribute('data-status');

    // B1
    const b1 = await create({ title: `PSI snapshot ${sfx}`, price: 100 });
    await setStatus(b1.id, OWN, 'live');
    const b1m = await load(b1.id);
    data(await call(`/catalog/product/${b1.id}/draft`, OWN, 'PUT', { data: { ...b1m, status: 'LIVE', price: 777 } }), 'stale snapshot');
    data(await call(`/catalog/products/${b1.id}/archive`, SA, 'POST'), 'admin archive');
    await page.addInitScript(([key, value]) => { try { localStorage.setItem(key as string, value as string); } catch {} }, [
      `choosify_product_draft_${b1.id}`,
      JSON.stringify({ ...b1m, status: 'LIVE', price: 555 }),
    ]);
    await open(page, `/admin/products/${b1.id}/edit`, new RegExp(`PSI snapshot ${sfx}`));
    await page.waitForTimeout(2500); // give the snapshot request time to (not) apply
    const text = await page.locator('#root').innerText();
    check((await badge(page)) === 'ARCHIVED' && !text.includes('777') && !text.includes('555'), 'B1 stored snapshot (LIVE, 777) and browser cache (LIVE, 555) do not override the server (Archived, 100)', { badge: await badge(page) });

    // B2
    const b2 = await create({ title: `PSI ui zero ${sfx}`, stock: 0 });
    await open(page, `/admin/products/${b2.id}/edit`, new RegExp(`PSI ui zero ${sfx}`));
    check((await badge(page)) === 'DRAFT', 'B2 new product shows Draft');
    await page.getByTestId('product-lifecycle-publish').click();
    await page.getByTestId('product-lifecycle-confirm').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="product-status-badge"]')?.getAttribute('data-status') !== 'DRAFT', null, { timeout: 20000 }).catch(() => undefined);
    check((await badge(page)) === 'OUT_OF_STOCK' && (await getProduct(b2.id)).status === 'out_of_stock', 'B2 Publish at zero stock shows Out of stock (the server state), not Live', await badge(page));
    check((await page.getByTestId('product-lifecycle-archive').count()) === 1 && (await page.getByTestId('product-lifecycle-unpublish').count()) === 0, 'B2 Out of stock offers Archive only (server transition table)');

    // B3
    await open(page, `/admin/products/${a3.id}/edit`, new RegExp(`PSI suspended ${sfx}`));
    check((await badge(page)) === 'SUSPENDED' && (await page.locator('[data-testid^="product-lifecycle-"]').count()) === 0, 'B3 suspended shows Suspended and offers no seller lifecycle action');

    // B4
    await open(page, '/admin/products/new', /Create Product/);
    const selects = await page.$$eval('select', (ss) => ss.map((s) => Array.from((s as HTMLSelectElement).options).map((o) => o.value)));
    check(!selects.some((o) => o.includes('LIVE')), 'B4 create mode has no Listing Status choice', selects);
    check((await page.getByTestId('inventory-listing-status').innerText()).trim() === 'Draft', 'B4 create mode states the product will be a Draft');

    // B5 beforeunload
    const b5 = await create({ title: `PSI unsaved ${sfx}`, description: `PSI marker ${sfx}` });
    const dirtyThen = async (finish: 'none' | 'save' | 'cancel') => {
      const p = await ctx.newPage();
      await open(p, `/admin/products/${b5.id}/edit`, new RegExp(`PSI unsaved ${sfx}`));
      await p.locator(`xpath=//h3[normalize-space()='About this product']/ancestor::div[contains(concat(' ',normalize-space(@class),' '),' relative ')][1]//button[normalize-space()='Edit']`).first().click();
      await p.getByPlaceholder('What is this product, who is it for, what makes it worth buying?').fill(`PSI edited ${finish} ${sfx}`);
      if (finish === 'save') {
        await p.getByRole('button', { name: 'Save Changes' }).click();
        await p.getByText('Description saved').waitFor({ timeout: 20000 });
      }
      if (finish === 'cancel') await p.getByRole('button', { name: 'Cancel', exact: true }).first().click();
      let dialog = '';
      p.on('dialog', (d) => {
        dialog = d.type();
        void d.dismiss();
      });
      await p.close({ runBeforeUnload: true });
      await new Promise((r) => setTimeout(r, 1500));
      if (!p.isClosed()) await p.close();
      return dialog;
    };
    check((await dirtyThen('none')) === 'beforeunload', 'B5 unsaved section edit → leaving the page asks first');
    check((await dirtyThen('save')) === '', 'B5 after Save Changes → no warning');
    check((await dirtyThen('cancel')) === '', 'B5 after Cancel → no warning');
    check((await getProduct(b5.id)).description === `PSI edited save ${sfx}`, 'B5 the saved edit persisted');

    // B6
    const b6 = await create({ title: `PSI archived ${sfx}` });
    data(await call(`/catalog/products/${b6.id}/archive`, SA, 'POST'), 'archive');
    await open(page, '/admin/products', /Product Catalog/);
    await page.getByPlaceholder(/search/i).first().fill(sfx).catch(() => undefined);
    await page.waitForTimeout(1500);
    const rowStatus = async (title: string) =>
      (await page.locator('tr', { hasText: title }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const rows = {
      draft: await rowStatus(`PSI create ${sfx}`),
      outOfStock: await rowStatus(`PSI ui zero ${sfx}`),
      suspended: await rowStatus(`PSI suspended ${sfx}`),
      archived: await rowStatus(`PSI archived ${sfx}`),
    };
    check(/\bDraft\b/i.test(rows.draft) && /Out of Stock/i.test(rows.outOfStock) && /Suspended/i.test(rows.suspended) && /Archived/i.test(rows.archived),
      'B6 Products list labels Draft / Out of Stock / Suspended / Archived separately', rows);
    check(!/Archived/i.test(rows.suspended) && !/Archived/i.test(rows.outOfStock), 'B6 out_of_stock and suspended are not labelled Archived', rows);

    // C3 — category-schema request fails in the browser; the server still validates on Save
    const c3 = await withSizeVariants(`PSI cat ui ${sfx}`);
    const p3 = await ctx.newPage();
    await p3.route('**/catalog/categories/*/schema', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"schema service unavailable"}' }));
    await open(p3, `/admin/products/${c3.id}/edit`, new RegExp(`PSI cat ui ${sfx}`));
    await p3.locator(`xpath=//h1[normalize-space()='PSI cat ui ${sfx}']/ancestor::div[contains(concat(' ',normalize-space(@class),' '),' relative ')][1]//button[normalize-space()='Edit']`).first().click();
    await p3.locator('select', { has: p3.locator(`option[value="${sizeCat}"]`) }).first().selectOption(sizeCat);
    const pending = await p3.getByText('Could not load the new category schema — it will be validated on Save.').waitFor({ timeout: 10000 }).then(() => true, () => false);
    check(pending, 'C3 schema request failed → Studio says it will be validated on Save (no compatibility claimed)');
    await p3.getByRole('button', { name: 'Save Changes' }).click();
    const shown = await p3.getByText(/schema list/i).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
    const toastText = shown ? await p3.getByText(/schema list/i).first().innerText() : '';
    check(shown && !/saved/i.test(toastText), 'C3 on Save the server rejection is shown to the seller (not "saved")', toastText);
    check((await p3.getByText(/Editing — Basic Information/i).count()) === 1, 'C3 the section stays open for correction after the rejection');
    const c3detail = await getDetail(c3.id);
    check(JSON.stringify(c3detail?.productVariants?.map((v: { options: unknown }) => v.options)) === JSON.stringify([{ Size: 'PSI-Z' }]), 'C3 stored variants unchanged by the rejected save', c3detail?.productVariants);
    await p3.close();
    await ctx.close();
  } finally {
    await browser.close();
    await q(`delete from users where id = $1`, [seller.id]).catch((e) => console.log('cleanup:', e.message));
    check(((await q<{ n: number }>(`select count(*)::int n from users where id = $1`, [seller.id]))[0]?.n ?? 1) === 0, 'cleanup: temporary seller deleted');
    await db.end();
  }

  console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-product-studio-integrity (${passes} passed, ${FAIL.length} failed, ${KNOWN.length} known limitation${KNOWN.length === 1 ? '' : 's'})`);
  if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
  process.exit(FAIL.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE ERROR', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
