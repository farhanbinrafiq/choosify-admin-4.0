/**
 * Product Studio — existing-product load-safety regression (data-integrity hazard).
 *
 * Proves that when an EXISTING product id cannot be authoritatively loaded
 * (catalog list call fails, or the id is absent from the caller's catalog),
 * the Studio NEVER produces a blank editable model and every persistence path
 * is gated shut — so a later Save/Publish can't PATCH empty data over the real
 * listing. createBlankProductModel() stays reachable only for the New flow.
 *
 * Pure-function probe (no server, no browser) — exercises the exact helpers the
 * component uses: resolveExistingProductLoad() + isSafeToPersist(), the five-state
 * lifecycle mapping and the section / create save payloads (Phase 0 integrity).
 *
 * Usage: npx tsx scripts/probe-product-studio-load.ts
 * Or:    npm run test:product-studio-load
 */
import { readFileSync } from 'node:fs';
import type { CatalogProduct, CatalogProductDetail } from '../src/types/catalog';
import {
  PRODUCT_STATUS_LABEL,
  checkCategorySchemaCompatibility,
  createBlankProductModel,
  detailPayloadChanged,
  detailSaveRequired,
  editorModelToCreatePatch,
  editorModelToProductPatch,
  editorModelToSectionPatch,
  isSafeToPersist,
  productStatusFromServer,
  resolveExistingProductLoad,
  type ProductEditorModel,
  type ProductEditorStatus,
} from '../src/pages/admin/productEditorModel';

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    console.log('PASS', label);
  } else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

const EXISTING_ID = 'prod-existing-42';
const realProduct = {
  id: EXISTING_ID,
  title: 'Real Listing 42',
  slug: 'real-listing-42',
  price: 4200,
  originalPrice: 5000,
  stock: 9,
  status: 'live',
  image: 'https://example.com/42.jpg',
  gallery: ['https://example.com/42.jpg'],
} as unknown as CatalogProduct;

const noDetail = async (): Promise<CatalogProductDetail | null> => null;

async function main() {
  console.log('=== Product Studio load-safety probe ===');

  // 1. authoritative fetch throws an infra error → explicit error, NO model.
  {
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => {
        throw new Error('network down');
      },
      getProductDetail: noDetail,
    });
    assert(res.status === 'error', 'fetch failure → status "error"', res);
    assert(!('model' in res), 'fetch failure → no model returned', res);
    const safe = isSafeToPersist(null, { isNew: false, activeId: EXISTING_ID, hasLoadError: true });
    assert(safe === false, 'fetch failure → Save/Publish gated shut', safe);
  }

  // 2. API says the product is not found → notfound, NO model.
  {
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => {
        throw new Error('Product not found');
      },
      getProductDetail: noDetail,
    });
    assert(res.status === 'notfound', '404 → status "notfound"', res);
    assert(!('model' in res), '404 → no model returned', res);
    assert(
      isSafeToPersist(null, { isNew: false, activeId: EXISTING_ID, hasLoadError: true }) === false,
      '404 → Save/Publish gated shut',
    );
  }

  // 3. fetch returns a different / malformed record → notfound, NO model.
  {
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => ({ id: 'some-other', title: 'Other' } as unknown as CatalogProduct),
      getProductDetail: noDetail,
    });
    assert(res.status === 'notfound', 'id mismatch → status "notfound"', res);
  }

  // 4. the blank fallback is NEVER what a failed existing-load produces.
  {
    const blank = createBlankProductModel(EXISTING_ID);
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => {
        throw new Error('boom');
      },
      getProductDetail: noDetail,
    });
    assert(
      res.status !== 'ok',
      'failed existing-load never returns an ok model (no blank substitution)',
      res,
    );
    // And even if some other code path handed a blank model with the right id,
    // a load error must still gate persistence.
    assert(
      isSafeToPersist(blank, { isNew: false, activeId: EXISTING_ID, hasLoadError: true }) === false,
      'blank model + load error → still gated shut',
    );
  }

  // 5. happy path — real product loads, persistence allowed.
  {
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => realProduct,
      getProductDetail: noDetail,
    });
    assert(res.status === 'ok', 'real product → status "ok"', res);
    const model = res.status === 'ok' ? res.model : null;
    assert(!!model && model.id === EXISTING_ID, 'real product → model with correct id', model?.id);
    assert(!!model && model.title === 'Real Listing 42', 'real product → model carries server values', model?.title);
    assert(
      isSafeToPersist(model, { isNew: false, activeId: EXISTING_ID, hasLoadError: false }) === true,
      'real product loaded → Save/Publish allowed',
    );
  }

  // 6. id mismatch (stale model from a previous route) → gated shut.
  {
    const stale = createBlankProductModel('prod-different');
    assert(
      isSafeToPersist(stale, { isNew: false, activeId: EXISTING_ID, hasLoadError: false }) === false,
      'model id ≠ route id → gated shut',
    );
  }

  // 7. genuine New flow — blank model is allowed.
  {
    const blank = createBlankProductModel('new');
    assert(
      isSafeToPersist(blank, { isNew: true, activeId: 'new', hasLoadError: false }) === true,
      'New flow → blank model allowed to persist',
    );
  }

  // 8. the server record is authoritative: the load takes no cache / snapshot input,
  //    so a stale local copy can never carry status, price or stock into a save.
  {
    const archivedOnServer = { ...realProduct, status: 'archived', price: 150, stock: 3 } as unknown as CatalogProduct;
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => archivedOnServer,
      getProductDetail: noDetail,
      // A caller that still hands over a stale cached model must not change the result.
      ...({ readCache: () => ({ ...createBlankProductModel(EXISTING_ID), status: 'LIVE', price: 100, stock: 50, title: 'Stale' }) } as object),
    });
    const model = res.status === 'ok' ? res.model : null;
    assert(
      model?.status === 'ARCHIVED' && model.price === 150 && model.stock === 3 && model.title === 'Real Listing 42',
      'stale cache cannot override status / price / stock / title — server values win',
      model && { status: model.status, price: model.price, stock: model.stock, title: model.title },
    );
    assert(!/readCache/.test(resolveExistingProductLoad.toString()), 'load has no cache overlay path at all');
  }

  // 9. all five server lifecycle states map one-to-one (none folded into Draft/Archived).
  {
    const pairs: Array<[string, ProductEditorStatus]> = [
      ['draft', 'DRAFT'], ['live', 'LIVE'], ['active', 'LIVE'], ['out_of_stock', 'OUT_OF_STOCK'],
      ['suspended', 'SUSPENDED'], ['archived', 'ARCHIVED'], ['', 'DRAFT'], ['bogus', 'DRAFT'],
    ];
    const got = pairs.map(([wire]) => productStatusFromServer(wire));
    assert(JSON.stringify(got) === JSON.stringify(pairs.map((p) => p[1])), 'productStatusFromServer maps every wire state', got);
    const viaLoad = await Promise.all(['out_of_stock', 'suspended', 'archived'].map(async (st) => {
      const r = await resolveExistingProductLoad(EXISTING_ID, { getProduct: async () => ({ ...realProduct, status: st }) as unknown as CatalogProduct, getProductDetail: noDetail });
      return r.status === 'ok' ? r.model.status : null;
    }));
    assert(JSON.stringify(viaLoad) === JSON.stringify(['OUT_OF_STOCK', 'SUSPENDED', 'ARCHIVED']), 'loaded out_of_stock / suspended / archived keep their own state', viaLoad);
    const back = (['DRAFT', 'LIVE', 'OUT_OF_STOCK', 'SUSPENDED', 'ARCHIVED'] as ProductEditorStatus[]).map((s) => editorModelToProductPatch({ ...createBlankProductModel(EXISTING_ID), status: s }).status);
    assert(JSON.stringify(back) === JSON.stringify(['draft', 'live', 'out_of_stock', 'suspended', 'archived']), 'editor status → wire status round-trips all five', back);
    assert(Object.keys(PRODUCT_STATUS_LABEL).length === 5 && PRODUCT_STATUS_LABEL.OUT_OF_STOCK === 'Out of stock', 'a display label exists for each state', PRODUCT_STATUS_LABEL);
  }

  // 10. section saves never send `status`; only a changed Inventory section sends `stock`.
  {
    const persisted = { ...createBlankProductModel(EXISTING_ID), status: 'OUT_OF_STOCK' as const, stock: 7, title: 'T' };
    const sections = ['core', 'basic', 'description', 'pricing', 'inventory', 'options', 'addons', 'specs', 'addlspecs', 'box', 'overview', 'tags', 'delivery', 'influencer', 'warranty', 'relatedinfo', 'thingsToKnow'];
    const withStatus = sections.filter((s) => 'status' in editorModelToSectionPatch({ ...persisted, description: 'x' }, s, persisted));
    assert(withStatus.length === 0, 'no section-save payload carries status', withStatus);
    const withStock = sections.filter((s) => 'stock' in editorModelToSectionPatch({ ...persisted, description: 'x' }, s, persisted));
    assert(withStock.length === 0, 'no section save sends stock when stock is unchanged (incl. Inventory)', withStock);
    const changed = sections.filter((s) => 'stock' in editorModelToSectionPatch({ ...persisted, stock: 12 }, s, persisted));
    assert(JSON.stringify(changed) === '["inventory"]', 'only the Inventory section sends a changed stock', changed);
    assert(editorModelToSectionPatch({ ...persisted, stock: 12 }, 'inventory', persisted).stock === 12, 'Inventory section keeps its semantics: the entered value is sent as-is', 12);
  }

  // 11. Create always makes a Draft, whatever status the model carries.
  {
    const live = { ...createBlankProductModel('new'), status: 'LIVE' as const };
    assert(editorModelToCreatePatch(live).status === 'draft', 'create payload status is draft even if the model says LIVE', editorModelToCreatePatch(live).status);
  }

  // 12. detail PUT is needed only when detail data changed (it re-asserts variant inventory).
  {
    const base = { ...createBlankProductModel(EXISTING_ID), specs: [{ key: 'A', value: '1' }] };
    assert(detailPayloadChanged({ ...base }, base) === false, 'identical model → no detail PUT (updatedAt ignored)');
    assert(detailPayloadChanged({ ...base, price: 999, originalPrice: 1200, stock: 4, title: 'New', image: 'https://x/y.jpg' }, base) === false, 'product-level edits (price / MRP / stock / title / image) → no detail PUT');
    assert(detailPayloadChanged({ ...base, description: 'new' }, base) === true, 'description edit → detail PUT (it is mirrored to detail.about)');
    assert(detailPayloadChanged({ ...base, specs: [{ key: 'A', value: '2' }] }, base) === true, 'detail edit (specs) → detail PUT');
    assert(
      detailPayloadChanged({ ...base, productVariants: [{ id: 'v1', sku: 'S', options: { Size: 'M' }, stock: 3 }] as ProductEditorModel['productVariants'] }, base) === true,
      'variant edit → detail PUT',
    );
  }

  // 12b. a category change still goes through the detail PUT when the product has
  //      options / variants — that is where the server validates them against the
  //      new category schema (categoryId is not part of the detail payload).
  {
    const groups = [{ id: 'og-size', name: 'Size', displayType: 'pills', values: ['M'] }] as ProductEditorModel['optionGroups'];
    const variants = [{ id: 'v1', sku: 'S', options: { Size: 'M' }, stock: 3 }] as ProductEditorModel['productVariants'];
    const base = { ...createBlankProductModel(EXISTING_ID), categoryId: 'cat-a' };
    assert(detailSaveRequired({ ...base }, base) === false, 'category unchanged + detail unchanged → detail PUT skipped');
    assert(detailSaveRequired({ ...base, optionGroups: groups, categoryId: 'cat-b' }, { ...base, optionGroups: groups }) === true, 'category changed + option groups → detail PUT');
    assert(detailSaveRequired({ ...base, productVariants: variants, categoryId: 'cat-b' }, { ...base, productVariants: variants }) === true, 'category changed + variants → detail PUT');
    assert(detailSaveRequired({ ...base, categoryId: 'cat-b' }, base) === false, 'category changed, no options / variants → detail PUT still skipped');
    assert(detailSaveRequired({ ...base, optionGroups: groups, price: 50 }, { ...base, optionGroups: groups }) === false, 'options present but category unchanged (price edit) → detail PUT skipped');
    assert(
      detailSaveRequired({ ...base, optionGroups: groups, categoryId: '' }, { ...base, optionGroups: groups }) === true,
      'category cleared on a product with options → detail PUT',
    );
  }

  // 13. source guards — Studio wiring that the pure helpers cannot prove on their own.
  {
    const studio = readFileSync('src/pages/admin/ProductEditStudio.tsx', 'utf8');
    assert(!/readCache|choosify_product_published_|setModel\(backendDraft\)/.test(studio), 'Studio never reads a cached / snapshot model into the editor');
    assert(/editorModelToSectionPatch\(merged, editingId, model\)/.test(studio) && /editorModelToCreatePatch\(merged\)/.test(studio), 'Studio saves through the section / create payload builders');
    assert(/creatingProduct \|\| detailSaveRequired\(merged, model\)/.test(studio), 'Studio decides the detail PUT with detailSaveRequired against the server-loaded model');
    assert(/addEventListener\('beforeunload'/.test(studio) && /if \(!dirty\) return;/.test(studio), 'Studio registers beforeunload only while dirty');
    assert(!/<option value="LIVE">/.test(studio), 'no Listing Status dropdown (create mode or sections)');
    for (const f of ['src/pages/admin/GuideEditStudio.tsx', 'src/pages/admin/GuideManagementList.tsx']) {
      const src = readFileSync(f, 'utf8');
      assert(!src.includes('localhost:5173') && /\$\{getPublishedStorefrontUrl\(\)\}\/spotlight\//.test(src), `${f.split('/').pop()}: public link uses getPublishedStorefrontUrl()`);
    }
  }

  // ── Hybrid model: category-change compatibility skips seller custom dimensions ──
  {
    const newSchemaDims = [
      { key: 'size', name: 'Size', type: 'select', options: ['S', 'M', 'L'] },
      { key: 'color', name: 'Color', type: 'select', options: ['Black', 'White'] },
    ];
    const optionGroups = [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['S', 'M'] }, // canonical, compatible
      { id: 'og-legacy', name: 'Storage', displayType: 'pills', values: ['128GB'] }, // canonical, NOT in new schema
      { id: 'og-strap', name: 'Strap Material', displayType: 'pills', values: ['Leather'], custom: true }, // custom — must be ignored
    ];
    const productVariants = [
      { id: 'v1', sku: 'A', options: { Size: 'M', Storage: '128GB', 'Strap Material': 'Leather' } },
      { id: 'v2', sku: 'B', options: { Size: 'S', 'Strap Material': 'Leather' } },
    ];
    const compat = checkCategorySchemaCompatibility(optionGroups as any, productVariants as any, newSchemaDims as any);
    assert(compat.invalidGroups.includes('Storage'), 'category change flags the canonical mismatch (Storage)', compat);
    assert(!compat.invalidGroups.includes('Strap Material'), 'category change IGNORES the seller custom dimension', compat);
    assert(
      compat.invalidVariantIds.includes('v1') && !compat.invalidVariantIds.includes('v2'),
      'only the variant referencing the incompatible canonical dim is flagged; custom-only variant is fine',
      compat,
    );
  }

  // ── Hybrid: seller-appended value on a canonical select dim survives a category change ──
  {
    const newSchemaDims = [{ key: 'size', name: 'Size', type: 'select', options: ['S', 'M', 'L'] }];
    const optionGroups = [
      { id: 'og-size', name: 'Size', displayType: 'pills', values: ['M', 'M(42)'], customValues: ['M(42)'] },
    ];
    const productVariants = [
      { id: 'v1', sku: 'A', options: { Size: 'M' } },
      { id: 'v2', sku: 'B', options: { Size: 'M(42)' } }, // seller-added value
    ];
    const compat = checkCategorySchemaCompatibility(optionGroups as any, productVariants as any, newSchemaDims as any);
    assert(compat.compatible === true, 'seller-appended select value ("M(42)") is not flagged on a category change', compat);
    assert(!compat.invalidValues.length && !compat.invalidVariantIds.length, 'no invalid values / variants from the custom value', compat);
  }

  console.log(
    failed === 0 ? '\nALL PRODUCT STUDIO LOAD-SAFETY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
