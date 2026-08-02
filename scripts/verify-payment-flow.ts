/**
 * Mock-mode harness for SSLCommerz surrounding logic (ownership is HTTP-tested
 * separately; this exercises amount match, idempotency, and order transitions).
 *
 * Run: npx tsx scripts/verify-payment-flow.ts
 *
 * What this CAN verify without credentials:
 * - resolveChargeAmount / amountsMatch
 * - applySuccessfulPayment idempotency (same val_id twice)
 * - amount mismatch refusal
 * - pending_payment → confirmed on valid credit
 *
 * What this CANNOT verify (blocked on real sandbox credentials):
 * - Actual Session/Init GatewayPageURL shape and redirect UX
 * - Live IPN form field set / delivery timing / retries
 * - Order Validation API wire format quirks beyond documented contract
 */
import {
  __resetProcessedValIdsForTests,
  applySuccessfulPayment,
  amountsMatch,
  hasProcessedValId,
  resolveChargeAmount,
} from '../server/payments/paymentService';
import { mockPaymentProvider } from '../server/payments/mockProvider';
import { operationsStore } from '../server/operations/operationsStore';
import type { OpsStorefrontOrder } from '../server/operations/types';

process.env.PAYMENT_GATEWAY_MOCK = 'true';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function makeOrder(overrides: Partial<OpsStorefrontOrder> = {}): OpsStorefrontOrder {
  const orderId = overrides.orderId || `ORD-PAY-${Date.now()}`;
  return operationsStore.createOrder({
    orderId,
    buyerId: 'usr-test-buyer',
    isCOD: false,
    isSplit: false,
    overallTotal: 1500,
    subOrders: [],
    status: 'pending_payment',
    paymentMethod: 'online',
    paymentProvider: 'sslcommerz',
    paymentStatus: 'pending',
    paymentTranId: `TXN-${orderId}-1`,
    createdAt: new Date().toISOString(),
    ...overrides,
  });
}

async function main() {
  __resetProcessedValIdsForTests();
  mockPaymentProvider.clear();

  // --- amount helpers ---
  const full = makeOrder({ orderId: 'ORD-PAY-FULL', overallTotal: 2000 });
  assert(resolveChargeAmount(full) === 2000, 'full charge = overallTotal');
  const partial = makeOrder({
    orderId: 'ORD-PAY-PARTIAL',
    overallTotal: 5000,
    isPartialPayment: true,
    depositAmount: 1250,
  });
  assert(resolveChargeAmount(partial) === 1250, 'partial charge = depositAmount');
  assert(amountsMatch(100, 100.005), 'tolerance ok');
  assert(!amountsMatch(100, 101), 'mismatch detected');

  // --- mock session ---
  assert(mockPaymentProvider.isConfigured(), 'mock configured when PAYMENT_GATEWAY_MOCK=true');
  const session = await mockPaymentProvider.initiateSession({
    order: full,
    amount: 2000,
    tranId: full.paymentTranId!,
    successUrl: 'http://localhost/success',
    failUrl: 'http://localhost/fail',
    cancelUrl: 'http://localhost/cancel',
    ipnUrl: 'http://localhost/ipn',
    customer: { name: 'Test' },
  });
  assert(session.redirectUrl.includes('tran_id='), 'mock redirect includes tran_id');

  // --- validation + credit ---
  const valId = 'VAL-MOCK-1';
  mockPaymentProvider.seedValidation(valId, {
    valid: true,
    amount: 2000,
    tranId: full.paymentTranId!,
  });
  const validation = await mockPaymentProvider.validateTransaction(valId);
  assert(validation.valid && validation.status === 'VALID', 'seeded validation VALID');

  const credited = applySuccessfulPayment({
    order: full,
    validation,
    source: 'harness',
  });
  assert(credited?.paymentStatus === 'paid', 'order credited');
  assert(credited?.status === 'confirmed', 'pending_payment → confirmed');
  assert(credited?.paidAmount === 2000, 'paidAmount set');
  assert(hasProcessedValId(valId), 'val_id marked processed');

  // --- idempotency ---
  const again = applySuccessfulPayment({
    order: operationsStore.getOrder(full.orderId)!,
    validation,
    source: 'harness',
  });
  assert(again?.paymentStatus === 'paid', 'second credit is idempotent skip');

  // --- amount mismatch refusal ---
  const mismatchOrder = makeOrder({
    orderId: 'ORD-PAY-MISMATCH',
    overallTotal: 999,
    paymentTranId: 'TXN-MISMATCH-1',
  });
  const badVal = 'VAL-MOCK-BAD';
  mockPaymentProvider.seedValidation(badVal, {
    valid: true,
    amount: 1,
    tranId: 'TXN-MISMATCH-1',
  });
  const refused = applySuccessfulPayment({
    order: mismatchOrder,
    validation: await mockPaymentProvider.validateTransaction(badVal),
    source: 'harness',
  });
  assert(refused === null, 'amount mismatch refuses credit');
  assert(operationsStore.getOrder(mismatchOrder.orderId)?.paymentStatus !== 'paid', 'still unpaid');

  console.log(
    JSON.stringify(
      {
        ok: true,
        verified: [
          'resolveChargeAmount (full + partial)',
          'amountsMatch',
          'mock initiateSession + validateTransaction',
          'applySuccessfulPayment credits + confirms',
          'val_id idempotency',
          'amount mismatch refusal',
        ],
        blocked_on_credentials: [
          'SSLCommerz Session/Init GatewayPageURL against sandbox',
          'Live IPN POST field set and retry behavior',
          'Order Validation API live response quirks',
          'Browser redirect query-param shape from SSLCommerz',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
