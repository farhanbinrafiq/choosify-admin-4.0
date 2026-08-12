/**
 * Probe: Seller/Creator My Customers scoping + privacy + ownership.
 * Run: npx tsx scripts/probe-my-customers.ts
 */
import { listMyCustomersForOwner, getMyCustomerForOwner } from '../server/catalog/sellerWorkspace';
import { operationsStore } from '../server/operations/operationsStore';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const sellerA = 'seller-probe-a';
  const sellerB = 'seller-probe-b';
  const buyerShared = 'buyer-shared-1';
  const buyerAOnly = 'buyer-a-only';
  const buyerBOnly = 'buyer-b-only';

  // Seed relationship-scoped orders (in-memory ops store).
  const now = new Date().toISOString();
  operationsStore.createOrder({
    id: 'ord-a1',
    orderId: 'ord-a1',
    buyerId: buyerAOnly,
    claimedByName: 'Buyer A Only',
    isCOD: false,
    isSplit: false,
    overallTotal: 5000,
    subOrders: [{ sellerId: sellerA, brandId: 'brand-a1', title: 'Product A1', quantity: 1, lineTotal: 5000 }],
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as any);
  operationsStore.createOrder({
    id: 'ord-b1',
    orderId: 'ord-b1',
    buyerId: buyerBOnly,
    claimedByName: 'Buyer B Only',
    isCOD: false,
    isSplit: false,
    overallTotal: 9000,
    subOrders: [{ sellerId: sellerB, brandId: 'brand-b1', title: 'Product B1', quantity: 1, lineTotal: 9000 }],
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as any);
  operationsStore.createOrder({
    id: 'ord-shared-a',
    orderId: 'ord-shared-a',
    buyerId: buyerShared,
    claimedByName: 'Shared Buyer',
    isCOD: false,
    isSplit: false,
    overallTotal: 18600,
    subOrders: [{ sellerId: sellerA, brandId: 'brand-a1', title: 'Shared via A', quantity: 1, lineTotal: 18600 }],
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as any);
  operationsStore.createOrder({
    id: 'ord-shared-b',
    orderId: 'ord-shared-b',
    buyerId: buyerShared,
    claimedByName: 'Shared Buyer',
    isCOD: false,
    isSplit: false,
    overallTotal: 100000,
    subOrders: [{ sellerId: sellerB, brandId: 'brand-b1', title: 'Shared via B', quantity: 1, lineTotal: 100000 }],
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as any);

  const listA = await listMyCustomersForOwner(sellerA, { includeBookings: false });
  const listB = await listMyCustomersForOwner(sellerB, { includeBookings: false });

  assert(listA.some((c) => c.id === buyerAOnly), 'Seller A should see buyerAOnly');
  assert(!listA.some((c) => c.id === buyerBOnly), 'Seller A must NOT see buyerBOnly');
  assert(listB.some((c) => c.id === buyerBOnly), 'Seller B should see buyerBOnly');
  assert(!listB.some((c) => c.id === buyerAOnly), 'Seller B must NOT see buyerAOnly');

  const sharedA = listA.find((c) => c.id === buyerShared);
  const sharedB = listB.find((c) => c.id === buyerShared);
  assert(sharedA, 'Seller A sees shared buyer');
  assert(sharedB, 'Seller B sees shared buyer');
  assert(sharedA!.totalSpend === 18600, `Seller A spend must be relationship-scoped (got ${sharedA!.totalSpend})`);
  assert(sharedB!.totalSpend === 100000, `Seller B spend must be relationship-scoped (got ${sharedB!.totalSpend})`);
  assert(!('phone' in sharedA!), 'phone must not be present on customer row');

  const denied = await getMyCustomerForOwner(sellerA, buyerBOnly, { includeBookings: false });
  assert(denied === null, 'Seller A must not load Seller B customer profile');

  const ok = await getMyCustomerForOwner(sellerA, buyerAOnly, { includeBookings: false });
  assert(ok && ok.id === buyerAOnly, 'Seller A can load own customer');

  // Brand scope: only brand-a1 for seller A
  const brandScoped = await listMyCustomersForOwner(sellerA, { brandId: 'brand-a1', includeBookings: false });
  assert(brandScoped.some((c) => c.id === buyerAOnly), 'brand filter still includes owned brand customers');

  console.log('PASS my-customers probe');
  console.log(
    JSON.stringify(
      {
        sellerACount: listA.length,
        sellerBCount: listB.length,
        sharedASpend: sharedA!.totalSpend,
        sharedBSpend: sharedB!.totalSpend,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
