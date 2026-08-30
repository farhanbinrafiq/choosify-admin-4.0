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
 * component uses: resolveExistingProductLoad() + isSafeToPersist().
 *
 * Usage: npx tsx scripts/probe-product-studio-load.ts
 * Or:    npm run test:product-studio-load
 */
import type { CatalogProduct, CatalogProductDetail } from '../src/types/catalog';
import {
  checkCategorySchemaCompatibility,
  createBlankProductModel,
  isSafeToPersist,
  resolveExistingProductLoad,
  type ProductEditorModel,
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

  // 8. local cache may OVERLAY but never SUBSTITUTE the authoritative record.
  {
    const cachedOverlay = {
      ...createBlankProductModel(EXISTING_ID),
      title: 'Locally edited title',
    } as ProductEditorModel;
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => realProduct,
      getProductDetail: noDetail,
      readCache: () => cachedOverlay,
    });
    assert(res.status === 'ok', 'cache overlay + real product → ok', res);
    const model = res.status === 'ok' ? res.model : null;
    assert(model?.title === 'Locally edited title', 'cache overlays edited fields', model?.title);
    assert(model?.slug === 'real-listing-42', 'authoritative fields still come from server', model?.slug);
  }
  {
    // cache present but the authoritative fetch fails → still an error, cache is NOT promoted.
    const cachedOverlay = createBlankProductModel(EXISTING_ID);
    const res = await resolveExistingProductLoad(EXISTING_ID, {
      getProduct: async () => {
        throw new Error('offline');
      },
      getProductDetail: noDetail,
      readCache: () => cachedOverlay,
    });
    assert(res.status === 'error', 'cache present + fetch fails → still error (no cache promotion)', res);
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
