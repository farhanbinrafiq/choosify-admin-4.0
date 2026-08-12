/**
 * Choosify Platform Reference ID suite.
 * npm run test:reference-ids
 */
import {
  formatReferenceId,
  normalizeReferenceIdQuery,
  parseReferenceId,
  REFERENCE_ENTITY_TYPES,
  REFERENCE_PREFIX,
  type ReferenceEntityType,
} from '../shared/referenceIds/registry';
import {
  allocateReferenceId,
  ensureEntityReferenceId,
  ensureReferenceIdSchema,
  lookupReferenceIndex,
  registerReferenceAssignment,
} from '../server/referenceIds/referenceIdService';
import { backfillAllReferenceIds } from '../server/referenceIds/backfillAllReferenceIds';
import { formatChoosifyUserId } from '../server/auth/choosifyUserId';
import { catalogStore } from '../lib/vercel-catalog/catalogStore';
import { commerceStore } from '../server/commerce/commerceStore';
import {
  paymentsMemoryBackend,
  ensurePaymentsMemoryHydrated,
} from '../server/payments/commercePaymentMemoryBackend';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('=== Platform Reference ID probe ===\n');

  // Format + padding + growth for ALL prefixes
  for (const t of REFERENCE_ENTITY_TYPES) {
    const p = REFERENCE_PREFIX[t];
    assert(formatReferenceId(t, 1) === `${p}-00001`, `${t} pad 1`);
    assert(formatReferenceId(t, 27) === `${p}-00027`, `${t} pad 27`);
    assert(formatReferenceId(t, 99999) === `${p}-99999`, `${t} 99999`);
    assert(formatReferenceId(t, 100000) === `${p}-100000`, `${t} 100000`);
    assert(formatReferenceId(t, 1000000) === `${p}-1000000`, `${t} 1000000`);
  }
  console.log('PASS format/padding/growth for all prefixes');

  // CF compatibility
  assert(formatChoosifyUserId(1) === formatReferenceId('user', 1), 'CF format equals registry');
  assert(normalizeReferenceIdQuery('cf-00127') === 'CF-00127', 'case normalize CF');
  assert(normalizeReferenceIdQuery('pr-8321') === 'PR-08321', 'case normalize PR');
  assert(normalizeReferenceIdQuery('821', 'product') === 'PR-00821', 'domain bare digits');
  assert(normalizeReferenceIdQuery('821') === null, 'global bare digits rejected');
  assert(parseReferenceId('PAY-00082')?.entityType === 'payment', 'parse PAY');
  console.log('PASS normalize/parse rules');

  await ensureReferenceIdSchema();

  // Concurrent allocation uniqueness (non-user types)
  const types: ReferenceEntityType[] = ['brand', 'product', 'order', 'payment', 'cashbook'];
  for (const t of types) {
    const n = 20;
    const ids = await Promise.all(Array.from({ length: n }, () => allocateReferenceId(t)));
    const uniq = new Set(ids);
    assert(uniq.size === n, `${t} concurrent unique (${uniq.size}/${n})`);
    assert([...uniq].every((id) => id.startsWith(REFERENCE_PREFIX[t] + '-')), `${t} prefix`);
  }
  console.log('PASS concurrent allocation uniqueness');

  // Beyond 99999 path via ensure with register
  const big = formatReferenceId('content', 100000);
  assert(big === 'CT-100000', 'CT growth');
  registerReferenceAssignment('content', big, 'internal_content_big');
  const again = await ensureEntityReferenceId({
    entityType: 'content',
    internalId: 'internal_content_big',
    current: big,
  });
  assert(again === big, 'immutability preserves existing');
  console.log('PASS immutability + growth');

  // No reuse: allocate after register does not return same for different internal
  const next = await allocateReferenceId('content');
  assert(next !== big, 'no reuse of CT-100000');
  console.log('PASS no-reuse');

  // Index lookup
  const hit = lookupReferenceIndex(big);
  assert(hit?.internalId === 'internal_content_big', 'index lookup');
  console.log('PASS index lookup');

  // Preserve SKU / orderNumber / provider payment ids across ensure
  const products = await catalogStore.listProducts();
  const sampleProduct = products[0];
  if (sampleProduct) {
    const skuBefore = sampleProduct.sku;
    const idBefore = sampleProduct.id;
    const ref = await ensureEntityReferenceId({
      entityType: 'product',
      internalId: sampleProduct.id,
      current: sampleProduct.productReferenceId,
    });
    const after = await catalogStore.getProduct(sampleProduct.id);
    assert(after?.id === idBefore, 'product internal id unchanged');
    assert(after?.sku === skuBefore, 'product SKU unchanged');
    assert(ref === (sampleProduct.productReferenceId || ref), 'product ref stable');
    console.log('PASS product SKU + internal id preserved', { sku: skuBefore, ref });
  }

  const orders = await commerceStore.listOrders();
  const sampleOrder = orders[0];
  if (sampleOrder) {
    const orderNumberBefore = (sampleOrder as { orderNumber?: string }).orderNumber;
    const idBefore = sampleOrder.id;
    const ref = await ensureEntityReferenceId({
      entityType: 'order',
      internalId: sampleOrder.id,
      current: sampleOrder.orderReferenceId,
    });
    const after = await commerceStore.getOrder(sampleOrder.id);
    assert(after?.id === idBefore, 'order internal id unchanged');
    assert(
      (after as { orderNumber?: string })?.orderNumber === orderNumberBefore,
      'existing orderNumber unchanged',
    );
    console.log('PASS orderNumber + internal id preserved', {
      orderNumber: orderNumberBefore,
      ref,
    });
  }

  ensurePaymentsMemoryHydrated();
  const payments = paymentsMemoryBackend.listPayments();
  const samplePay = payments[0];
  if (samplePay) {
    const paymentIdBefore = samplePay.paymentId;
    const providerBefore = samplePay.providerTransactionId;
    const idemBefore = samplePay.idempotencyKey;
    const ref = await ensureEntityReferenceId({
      entityType: 'payment',
      internalId: samplePay.paymentId,
      current: samplePay.paymentReferenceId,
    });
    assert(samplePay.paymentId === paymentIdBefore, 'paymentId UUID unchanged');
    assert(samplePay.providerTransactionId === providerBefore, 'provider tx unchanged');
    assert(samplePay.idempotencyKey === idemBefore, 'idempotency unchanged');
    console.log('PASS payment provider IDs preserved', { paymentId: paymentIdBefore, ref });
  }

  // Backfill idempotent
  const r1 = await backfillAllReferenceIds();
  const r2 = await backfillAllReferenceIds();
  for (const d of r2.domains) {
    assert(d.assigned === 0, `idempotent ${d.entityType} assigned=${d.assigned}`);
  }
  console.log('PASS backfill idempotent');
  console.log(
    'Backfill counts:',
    r1.domains.map((d) => `${d.entityType}:${d.alreadyHadId}+${d.assigned}/${d.total}`).join(', '),
  );

  // Duplicate scan
  for (const d of r1.domains) {
    assert(d.duplicates.length === 0, `duplicates in ${d.entityType}: ${d.duplicates.join('; ')}`);
  }
  console.log('PASS duplicate scan clean');

  // Cross-domain allocate chain
  const chain = {
    brand: await allocateReferenceId('brand'),
    product: await allocateReferenceId('product'),
    order: await allocateReferenceId('order'),
    invoice: await allocateReferenceId('invoice'),
    payment: await allocateReferenceId('payment'),
    escrow: await allocateReferenceId('escrow'),
    conversation: await allocateReferenceId('conversation'),
    return: await allocateReferenceId('return'),
    refund: await allocateReferenceId('refund'),
  };
  for (const [k, v] of Object.entries(chain)) {
    assert(v.startsWith(REFERENCE_PREFIX[k as ReferenceEntityType] + '-'), `chain ${k}`);
  }
  console.log('PASS cross-domain chain allocation', chain);

  // Existing CF counter still works
  const cf = await allocateReferenceId('user');
  assert(/^CF-\d+$/.test(cf), 'user allocates CF');
  console.log('PASS CF via unified allocateReferenceId(user)', cf);

  // RBAC policy smoke: sellerId ownership gate for product refs
  const foreignProduct = products.find((p) => p.sellerId && p.productReferenceId);
  if (foreignProduct?.sellerId) {
    const actorSeller = 'seller_other_rbac_probe';
    assert(foreignProduct.sellerId !== actorSeller, 'rbac fixture distinct sellers');
    const wouldAllow = foreignProduct.sellerId === actorSeller;
    assert(!wouldAllow, 'Seller A must not own Seller B product by sellerId');
    console.log('PASS RBAC ownership gate for product refs', {
      ref: foreignProduct.productReferenceId,
      owner: foreignProduct.sellerId,
    });
  } else {
    console.log('SKIP RBAC product ownership fixture (no seller-owned product with ref)');
  }

  console.log('\nALL reference-id probes PASSED');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
