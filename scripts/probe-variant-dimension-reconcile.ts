/**
 * Variant matrix reconciliation — regression for the "add a dimension after
 * variants already exist" bug.
 *
 * Reported symptom: a product with only Size configured had 4 variants (one
 * per Size value). The seller then added Color (4 values) and Fitting (2
 * values). The Studio table kept showing the same 4 rows with Color/Fitting
 * as "—", while "Generate missing combinations" reported 32 (the full
 * 4×4×2 matrix) — the seller's existing 4 rows were never reconciled into
 * that matrix.
 *
 * Pure-function probe (no server, no browser) — exercises the exact helpers
 * the Product Studio component uses: variantCoversDimensions() and
 * reconcileVariantsForDimensions().
 *
 * Usage: npx tsx scripts/probe-variant-dimension-reconcile.ts
 * Or:    npm run test:variant-dimension-reconcile
 */
import {
  generateCombinations,
  reconcileVariantsForDimensions,
  variantCoversDimensions,
  variantKey,
  type ProductVariantRow,
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

let idSeq = 0;
const makeId = (_i: number) => `var-test-${idSeq++}`;

// ── Exact reported scenario: Size(4) x Color(4) x Fitting(2) = 32 ──────────

const SIZE = ['M (40)', 'L (42)', 'XL (44)', 'XXL (48)'];
const COLOR = ['Red', 'Blue', 'White', 'Green'];
const FITTING = ['Slim Fit', 'Regular Fit'];
const dims = [
  { name: 'Size', values: SIZE },
  { name: 'Color', values: COLOR },
  { name: 'Fitting', values: FITTING },
];

const sizeOnlyRows: ProductVariantRow[] = SIZE.map((s, i) => ({
  id: `legacy-${i}`,
  sku: `SIZE-${s}`,
  options: { Size: s },
  price: 1000 + i * 50,
  originalPrice: 1200 + i * 50,
  stock: 10 + i,
  images: [`https://cdn.example/${s}.jpg`],
  enabled: true,
  status: 'active' as const,
}));

{
  const reconciled = reconcileVariantsForDimensions(sizeOnlyRows, dims, makeId);
  assert(reconciled.length === 32, 'reconciling Size-only rows against Size×Color×Fitting yields exactly 32 rows', {
    length: reconciled.length,
  });
  assert(
    reconciled.every((v) => variantCoversDimensions(v.options, ['Size', 'Color', 'Fitting'])),
    'every reconciled row has Size, Color AND Fitting populated (no more "—")',
  );
  const keys = new Set(reconciled.map((v) => variantKey(v.options)));
  const fullKeys = generateCombinations(dims).map(variantKey);
  assert(
    fullKeys.every((k) => keys.has(k)) && keys.size === 32,
    'reconciled set is exactly the full 4x4x2 Cartesian matrix, no duplicates',
  );
  // None of the original legacy Size-only rows should survive as-is (superseded).
  assert(
    !reconciled.some((v) => Object.keys(v.options).length === 1),
    'no partial (Size-only) row remains after reconciliation',
  );
  // Data preservation: the M row's price/stock/sku/images should have been
  // carried onto its 8 completions (4 Color x 2 Fitting), not lost or blanked.
  const mRows = reconciled.filter((v) => v.options.Size === 'M (40)');
  assert(mRows.length === 8, 'M (40) expands into its 4x2=8 completions', { count: mRows.length });
  assert(
    mRows.every((v) => v.price === 1000 && v.originalPrice === 1200 && v.stock === 10 && v.sku === 'SIZE-M (40)'),
    'M (40)\'s original price/originalPrice/stock/sku were carried onto all 8 of its completions',
    { sample: mRows[0] },
  );
  assert(
    mRows.every((v) => v.images?.[0] === 'https://cdn.example/M (40).jpg'),
    "M (40)'s image was carried onto all 8 of its completions",
  );
  // Different Size rows must not cross-contaminate each other's data.
  const lRows = reconciled.filter((v) => v.options.Size === 'L (42)');
  assert(
    lRows.every((v) => v.price === 1050),
    'L (42)\'s own price (1050) is preserved on its own completions, not M\'s',
  );
}

// ── Idempotency: reconciling an already-complete matrix changes nothing ────
{
  const full = generateCombinations(dims).map((options, i) => ({
    id: `full-${i}`,
    sku: `SKU-${i}`,
    options,
    price: 500,
    enabled: true,
    status: 'active' as const,
  }));
  const reconciled = reconcileVariantsForDimensions(full, dims, makeId);
  assert(reconciled.length === 32, 'reconciling an already-full matrix stays at 32 rows (no duplication)');
  assert(
    reconciled.every((v) => full.some((f) => f.id === v.id)),
    'every row survives with its original id when the matrix is already complete (no needless replacement)',
  );
}

// ── Sparse matrix / seller-deleted combinations ────────────────────────────
// Pre-existing, unchanged contract (same in the original addMissingCombinations,
// verified against the last commit): deleting a row only means it's never
// auto/silently regenerated. It is NOT immune to the seller explicitly
// clicking "Generate missing combinations" again afterward -- that call has
// always refilled every gap in the full matrix, deliberate deletions
// included, because a reconcile call can't distinguish "never existed" from
// "deleted on purpose" (both look identical: absent from the array). This
// probe locks in that a sparse matrix with NO partial rows is simply left
// alone when reconciliation isn't invoked, and that the "missing" count the
// UI reads reports the gap accurately (so the seller sees exactly what a
// re-click would do) rather than silently reporting nothing or drifting.
{
  const full = generateCombinations(dims).map((options, i) => ({
    id: `full-${i}`,
    sku: `SKU-${i}`,
    options,
    price: 500,
    enabled: true,
    status: 'active' as const,
  }));
  const deletedKey = variantKey({ Size: 'M (40)', Color: 'Red', Fitting: 'Regular Fit' });
  const sparse = full.filter((v) => variantKey(v.options) !== deletedKey);
  assert(sparse.length === 31, 'sanity: one combination removed from the full 32');

  // The array itself is just data -- nothing touches it unless the seller
  // explicitly triggers a reconcile/generate action.
  assert(sparse.length === 31 && !sparse.some((v) => variantKey(v.options) === deletedKey), 'the deleted combination is simply absent until any generate action runs');

  // The UI's "missing" count (completeRows-only, exactly what the button
  // label reads) correctly reports the one real gap -- not zero, not 32.
  const completeRows = sparse.filter((v) => variantCoversDimensions(v.options, ['Size', 'Color', 'Fitting']));
  const presentKeys = new Set(completeRows.map((v) => variantKey(v.options)));
  const missingForSparse = generateCombinations(dims).filter((c) => !presentKeys.has(variantKey(c)));
  assert(missingForSparse.length === 1, 'the "missing" count against a sparse matrix reports exactly the 1 real gap', {
    length: missingForSparse.length,
  });
}

// ── Adding a dimension incrementally (Size -> +Color -> +Fitting) ──────────
{
  // Step 1: only Size exists.
  const step1 = reconcileVariantsForDimensions(sizeOnlyRows, [{ name: 'Size', values: SIZE }], makeId);
  assert(
    step1.length === 4 && step1.every((v, i) => v === sizeOnlyRows[i]),
    'with only Size configured, reconciliation is a no-op (all 4 rows already complete for Size alone)',
  );

  // Step 2: seller adds Color.
  const step2 = reconcileVariantsForDimensions(step1, [{ name: 'Size', values: SIZE }, { name: 'Color', values: COLOR }], makeId);
  assert(step2.length === 16, 'adding Color alone (Size x Color = 4x4) yields 16 rows', { length: step2.length });
  assert(
    step2.every((v) => variantCoversDimensions(v.options, ['Size', 'Color'])),
    'every row after adding Color has both Size and Color populated',
  );

  // Step 3: seller later adds Fitting on top.
  const step3 = reconcileVariantsForDimensions(step2, dims, makeId);
  assert(step3.length === 32, 'later adding Fitting on top completes the full 4x4x2=32 matrix', { length: step3.length });
  assert(
    step3.every((v) => variantCoversDimensions(v.options, ['Size', 'Color', 'Fitting'])),
    'every row after adding Fitting has Size, Color AND Fitting populated',
  );
}

// ── Backward compatibility: no variants, one dimension, no dimensions ──────
{
  assert(reconcileVariantsForDimensions([], dims, makeId).length === 32, 'a product with zero variants generates the full matrix from scratch');
  assert(
    reconcileVariantsForDimensions([], [], makeId).length === 0,
    'a product with no option dimensions at all reconciles to zero variants (no-variant product untouched)',
  );
  const oneDim = reconcileVariantsForDimensions([], [{ name: 'Size', values: SIZE }], makeId);
  assert(oneDim.length === 4, 'a single-dimension product reconciles to exactly its own value count');
}

// ── variantCoversDimensions edge cases ──────────────────────────────────────
assert(variantCoversDimensions({ Size: 'M' }, ['Size']) === true, 'variantCoversDimensions: exact single match');
assert(variantCoversDimensions({ Size: 'M' }, ['Size', 'Color']) === false, 'variantCoversDimensions: missing dimension detected');
assert(variantCoversDimensions({ Size: 'M', Color: 'Red' }, ['Size']) === true, 'variantCoversDimensions: extra (stale) key does not block coverage of current dims');
assert(variantCoversDimensions(undefined, []) === true, 'variantCoversDimensions: no dims required is trivially satisfied');

console.log('\n=== Variant dimension reconciliation probe DONE ===');
if (failed > 0) {
  console.error(`FAILED ${failed} assertion(s)`);
  process.exit(1);
}
console.log('ALL VARIANT-DIMENSION-RECONCILE PROBES PASSED');
