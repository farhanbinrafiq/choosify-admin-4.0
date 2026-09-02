/**
 * Product Guide (Size / Measurement / Compatibility / Fitment / Feature) probe.
 * Permanent suite member — `npm run test:product-guide`.
 *
 * The guide is seller-authored informational metadata on CatalogProductDetail.
 * It must:
 *  - round-trip guideType / label / imageUrl / title / description
 *  - drop an unsafe imageUrl (javascript:/data:/non-http)
 *  - coerce an unknown guideType to 'size' and clamp an over-long label
 *  - be preserved when an unrelated Studio section save omits the key
 *  - NEVER change optionGroups / productVariants / price / SKU / stock
 *
 * Deterministic; safe to re-run. Needs the dev API on :3001 and the
 * acceptance-runner-sneaker fixture (`npm run seed:variant-acceptance`).
 */
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { editorModelToDetailPayload, mapCatalogProductToEditor } from '../src/pages/admin/productEditorModel';
import type { CatalogProduct, CatalogProductDetail } from '../src/types/catalog';

if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const SELLER_PASSWORD = process.env.PROBE_SELLER_PASSWORD || 'Accept!2026xx';
const SNEAKER_SLUG_RE = /acceptance-runner-sneaker-(\d+)/;

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}
const j = (r: Response) => r.json().catch(() => ({}));

async function main() {
  console.log('=== Product Guide probe ===');

  const all: CatalogProduct[] = [];
  for (const off of [0, 100, 200, 300, 400, 500]) {
    const page = (await j(await fetch(`${base}/catalog/products?limit=100&offset=${off}`))) as { data?: CatalogProduct[] };
    all.push(...(page.data || []));
  }
  const product = all
    .filter((p) => SNEAKER_SLUG_RE.test(p.slug))
    .sort((a, b) => b.slug.localeCompare(a.slug))[0];
  if (!product) throw new Error('sneaker fixture not found — run npm run seed:variant-acceptance');
  const tag = (product.slug.match(SNEAKER_SLUG_RE) || [])[1];
  const sellerEmail = process.env.PROBE_SELLER_EMAIL || `variant-accept-${tag}@probe.local`;
  console.log('fixture:', product.id, product.slug, '· seller', sellerEmail);

  const login = (await j(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail, password: SELLER_PASSWORD }),
    }),
  )) as { accessToken?: string };
  if (!login.accessToken) throw new Error(`seller login failed for ${sellerEmail} — run npm run seed:variant-acceptance`);
  const H = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  const getDetail = async () =>
    (await j(await fetch(`${base}/catalog/product-details/${product.id}`))) as CatalogProductDetail;
  const putDetail = (payload: unknown) =>
    fetch(`${base}/catalog/product-details/${product.id}`, { method: 'PUT', headers: H, body: JSON.stringify(payload) });

  const detail0 = await getDetail();
  const optionGroups0 = JSON.stringify(detail0.optionGroups ?? []);
  const productVariants0 = JSON.stringify(detail0.productVariants ?? []);

  // ── 1. Studio path: configure a compatibility guide with an uploaded image ──
  const model = mapCatalogProductToEditor(product, { ...detail0, specs: [] });
  model.sizeGuide = {
    enabled: true,
    guideType: 'compatibility',
    label: '',
    type: 'image',
    imageUrl: 'https://cdn.example.com/guides/fitment-chart.png',
    title: 'Fitment — 2018-2024 models',
    description: 'Check your model year against the chart before selecting a variant.',
  };
  const payload = editorModelToDetailPayload(model) as Record<string, unknown>;
  assert('sizeGuide' in payload, 'editorModelToDetailPayload emits sizeGuide once the seller configures it', Object.keys(payload));
  const save1 = await putDetail(payload);
  assert(save1.status === 200, 'guide save → 200', save1.status);

  let detail = await getDetail();
  assert(detail.sizeGuide?.enabled === true, 'guide: enabled persisted', detail.sizeGuide);
  assert(detail.sizeGuide?.guideType === 'compatibility', 'guide: guideType round-trips', detail.sizeGuide?.guideType);
  assert(detail.sizeGuide?.imageUrl === 'https://cdn.example.com/guides/fitment-chart.png', 'guide: https imageUrl round-trips', detail.sizeGuide?.imageUrl);
  assert(
    detail.sizeGuide?.title === 'Fitment — 2018-2024 models' &&
      (detail.sizeGuide?.description || '').startsWith('Check your model year'),
    'guide: title + description round-trip',
    detail.sizeGuide,
  );
  assert(
    JSON.stringify(detail.optionGroups ?? []) === optionGroups0 &&
      JSON.stringify(detail.productVariants ?? []) === productVariants0,
    'guide save does NOT alter optionGroups / productVariants',
  );

  // ── 2. Unsafe imageUrl is dropped; unknown guideType → 'size'; label clamped ──
  await putDetail({
    productId: product.id,
    sizeGuide: {
      enabled: true,
      guideType: 'totally-bogus',
      label: 'x'.repeat(120),
      type: 'image',
      imageUrl: 'javascript:alert(document.cookie)',
    },
  });
  detail = await getDetail();
  assert(!detail.sizeGuide?.imageUrl, 'guide: javascript: imageUrl rejected', detail.sizeGuide?.imageUrl);
  assert(detail.sizeGuide?.guideType === 'size', 'guide: unknown guideType coerced to "size"', detail.sizeGuide?.guideType);
  assert((detail.sizeGuide?.label || '').length <= 40, 'guide: over-long custom label clamped to <=40', detail.sizeGuide?.label?.length);

  // ── 3. Preserve on an unrelated section save (key omitted) ──────────────────
  await putDetail({
    productId: product.id,
    sizeGuide: {
      enabled: true,
      guideType: 'measurement',
      imageUrl: 'https://cdn.example.com/guides/keep.png',
      title: 'Keep me',
    },
  });
  const beforeUnrelated = await getDetail();
  const unrelatedModel = mapCatalogProductToEditor(product, { ...beforeUnrelated, specs: [] });
  // mapCatalogProductToEditor loads sizeGuide, so the omit-path is: never touch it
  // and confirm a DIFFERENT section's save (which still emits sizeGuide from the
  // loaded model) keeps it byte-identical.
  unrelatedModel.bestForTags = ['probe-tag-a', 'probe-tag-b'];
  await putDetail(editorModelToDetailPayload(unrelatedModel));
  detail = await getDetail();
  assert(
    detail.sizeGuide?.guideType === 'measurement' &&
      detail.sizeGuide?.title === 'Keep me' &&
      detail.sizeGuide?.imageUrl === 'https://cdn.example.com/guides/keep.png',
    'guide: survives an unrelated Studio section save',
    detail.sizeGuide,
  );

  // A save that never loaded a sizeGuide (fresh blank model) omits the key entirely.
  const blankish = mapCatalogProductToEditor(product, null);
  const blankPayload = editorModelToDetailPayload(blankish) as Record<string, unknown>;
  assert(!('sizeGuide' in blankPayload), 'guide: a model with no guide omits sizeGuide (server preserves)', Object.keys(blankPayload));

  // ── 4. Remove ("enabled:false") disables storefront exposure ────────────────
  await putDetail({ productId: product.id, sizeGuide: { enabled: false } });
  detail = await getDetail();
  assert(detail.sizeGuide?.enabled === false, 'guide: remove → stored disabled (storefront hides it)', detail.sizeGuide);

  console.log(failed === 0 ? '\nALL PRODUCT GUIDE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
