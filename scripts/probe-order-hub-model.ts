/**
 * Order Hub presentation-model regression — PURE functions, no server.
 *
 * Focus: the multi-seller total correction (Sprint 14, Option B). The canonical
 * Operations API returns the whole order — every sub-order + the full
 * overallTotal — to every sub-order owner (server/operations/operationsStore.ts
 * listOrders filters by "has a sub-order for sellerId", it does NOT trim the
 * record). So the Order Hub must never present order.overallTotal as a seller's
 * own value on a shared order. This probe locks that, plus the KPI / status-tab
 * / search derivations.
 *
 * Usage: npx tsx scripts/probe-order-hub-model.ts   (npm run test:order-hub-model)
 */
import type { OpsStorefrontOrder } from '../src/services/operationsApi';
import {
  resolveOrderHubViewer,
  sellerAttributableValue,
  visibleOrderValue,
  visibleSubOrders,
  otherSellerCount,
  isMultiSeller,
  derivedFulfillment,
  orderHubStats,
  tabCounts,
  orderMatchesTab,
  orderSearchMatches,
  orderHubBasePath,
  orderDetailsPath,
  buildOperationsTimeline,
  scopedFinancials,
  isStaffRole,
  conversationDeepLink,
  viewCustomerPath,
  invoicePath,
  productStudioPath,
  canAdministrativelyCorrect,
  validateDispatchForm,
  supportCorrectionPath,
  shipmentStatusLabel,
  EMPTY_DISPATCH_FORM,
  lifecyclePanel,
  deriveHubStatus,
  hubStatusLabel,
  isActiveOrder,
  filterCapabilities,
  activeFilterCount,
  orderMatchesFilters,
  filtersFromSearchParams,
  applyFiltersToSearchParams,
  buildFilterDictionaries,
  type OrderHubFilters,
} from '../src/pages/admin/orderHubModel';
import type { CommerceOrderLite } from '../src/services/operationsApi';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

const SELLER_A = 'uid-seller-a';
const SELLER_B = 'uid-seller-b';

function baseOrder(over: Partial<OpsStorefrontOrder>): OpsStorefrontOrder {
  return {
    id: 'row-1',
    orderId: 'CHO-1',
    buyerId: 'uid-buyer-1',
    isCOD: false,
    isSplit: false,
    overallTotal: 0,
    subOrders: [],
    status: 'active',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...over,
  };
}

/** Multi-seller order: A = 2×1000 + 60 delivery; B = 1×2500 + 40 delivery; promo -100. */
const multi = baseOrder({
  orderId: 'CHO-MULTI',
  isSplit: true,
  promoCode: 'EID100',
  promoDiscount: 100,
  overallTotal: 2 * 1000 + 60 + 2500 + 40 - 100, // 4500
  subtotal: 4500,
  subOrders: [
    {
      sellerId: SELLER_A,
      sellerBusinessName: 'Alpha Traders',
      deliveryFee: 60,
      trackingStatus: 'pending',
      invoiceId: 'INV-A-1',
      items: [
        { itemId: 'a1', productId: 'pA', productTitle: 'Alpha Widget', quantity: 2, price: 1000 },
      ],
    },
    {
      sellerId: SELLER_B,
      sellerBusinessName: 'Beta Goods',
      deliveryFee: 40,
      trackingStatus: 'pending',
      invoiceId: 'INV-B-1',
      items: [
        { itemId: 'b1', productId: 'pB', productTitle: 'Beta Gadget', quantity: 1, price: 2500 },
      ],
    },
  ],
});

// ── viewer resolution ──────────────────────────────────────────────────────
assert(resolveOrderHubViewer({ id: SELLER_A, role: 'seller' }).mode === 'seller', 'seller role → seller mode');
assert(
  resolveOrderHubViewer({ id: SELLER_A, role: 'verified_seller' }).sellerId === SELLER_A,
  'verified_seller carries its own uid as sellerId',
);
assert(resolveOrderHubViewer({ id: 'x', role: 'admin' }).mode === 'admin', 'admin role → admin mode');
assert(resolveOrderHubViewer({ id: 'x', role: 'super_admin' }).sellerId === null, 'staff has null sellerId');
assert(resolveOrderHubViewer(null).mode === 'admin', 'no profile → admin mode (least data)');

const adminV = resolveOrderHubViewer({ id: 's', role: 'admin' });
const sellerAV = resolveOrderHubViewer({ id: SELLER_A, role: 'seller' });
const sellerBV = resolveOrderHubViewer({ id: SELLER_B, role: 'seller' });

// ── the core correction ────────────────────────────────────────────────────
assert(visibleOrderValue(multi, adminV) === 4500, 'admin sees the whole-order overallTotal (4500)');
assert(
  sellerAttributableValue(multi, SELLER_A) === 2060,
  'Seller A attributable = 2×1000 + 60 delivery = 2060',
  sellerAttributableValue(multi, SELLER_A),
);
assert(
  sellerAttributableValue(multi, SELLER_B) === 2540,
  'Seller B attributable = 2500 + 40 delivery = 2540',
  sellerAttributableValue(multi, SELLER_B),
);
assert(visibleOrderValue(multi, sellerAV) === 2060, 'Seller A visible value = its own slice, NOT 4500');
assert(visibleOrderValue(multi, sellerBV) === 2540, 'Seller B visible value = its own slice, NOT 4500');
assert(
  visibleOrderValue(multi, sellerAV) < multi.overallTotal &&
    visibleOrderValue(multi, sellerBV) < multi.overallTotal,
  'no seller is ever shown a value >= overallTotal on a shared order',
);
assert(
  sellerAttributableValue(multi, SELLER_A) + sellerAttributableValue(multi, SELLER_B) ===
    multi.overallTotal + multi.promoDiscount!,
  'the two slices reconcile to overallTotal + order-level promo (promo not prorated to a seller)',
);

// ── scoping of visible detail ──────────────────────────────────────────────
assert(visibleSubOrders(multi, adminV).length === 2, 'admin sees both sub-orders');
assert(
  visibleSubOrders(multi, sellerAV).length === 1 &&
    visibleSubOrders(multi, sellerAV)[0].sellerId === SELLER_A,
  'Seller A sees only its own sub-order',
);
assert(otherSellerCount(multi, sellerAV) === 1, 'Seller A: 1 other seller on the order');
assert(otherSellerCount(multi, adminV) === 0, 'admin: otherSellerCount is 0 (not seller mode)');
assert(isMultiSeller(multi), 'multi-seller order detected');

// ── single-seller order: seller value == overallTotal minus any promo ──────
const single = baseOrder({
  orderId: 'CHO-SOLO',
  overallTotal: 1000 + 50,
  subOrders: [
    {
      sellerId: SELLER_A,
      sellerBusinessName: 'Alpha Traders',
      deliveryFee: 50,
      items: [{ itemId: 's1', productId: 'pA', productTitle: 'Alpha Widget', quantity: 1, price: 1000 }],
    },
  ],
});
assert(sellerAttributableValue(single, SELLER_A) === 1050, 'solo order: seller slice = 1000 + 50 = 1050');
assert(visibleOrderValue(single, sellerAV) === 1050, 'solo order: seller visible value = overallTotal');
assert(!isMultiSeller(single), 'solo order not flagged multi-seller');
assert(otherSellerCount(single, sellerAV) === 0, 'solo order: no other sellers');

// ── a seller with NO sub-order on the row gets 0, never overallTotal ───────
assert(
  sellerAttributableValue(multi, 'uid-seller-c') === 0,
  'unrelated seller attributable value is 0 (defensive — server would not send this row anyway)',
);

// ── derived fulfillment (canonical item.deliveredAt only) ─────────────────
const partiallyDelivered = baseOrder({
  subOrders: [
    {
      sellerId: SELLER_A,
      deliveryFee: 0,
      items: [
        { itemId: 'd1', productTitle: 'X', quantity: 1, price: 100, deliveredAt: '2026-08-02T00:00:00.000Z' },
        { itemId: 'd2', productTitle: 'Y', quantity: 1, price: 100 },
      ],
    },
  ],
});
assert(derivedFulfillment(partiallyDelivered, adminV) === 'partial', 'one of two items delivered → partial');
const allDelivered = baseOrder({
  subOrders: [
    {
      sellerId: SELLER_A,
      deliveryFee: 0,
      items: [{ itemId: 'e1', productTitle: 'X', quantity: 1, price: 100, deliveredAt: '2026-08-02T00:00:00.000Z' }],
    },
  ],
});
assert(derivedFulfillment(allDelivered, adminV) === 'delivered', 'all items delivered → delivered');
assert(derivedFulfillment(baseOrder({ subOrders: [] }), adminV) === 'none', 'no items → none');
// seller-scoped fulfillment ignores the other seller's undelivered items
const mixedDelivery = baseOrder({
  subOrders: [
    {
      sellerId: SELLER_A,
      deliveryFee: 0,
      items: [{ itemId: 'f1', productTitle: 'A', quantity: 1, price: 100, deliveredAt: '2026-08-02T00:00:00.000Z' }],
    },
    { sellerId: SELLER_B, deliveryFee: 0, items: [{ itemId: 'f2', productTitle: 'B', quantity: 1, price: 100 }] },
  ],
});
assert(
  derivedFulfillment(mixedDelivery, sellerAV) === 'delivered' &&
    derivedFulfillment(mixedDelivery, sellerBV) === 'awaiting',
  'fulfillment is computed per viewer scope, not across sibling sellers',
);

// ── lifecycle-accurate KPI strip + tabs (Sprint 14) ─────────────────────
// The status strip is the REAL workflow: a freshly placed order is Pending and
// is NOT counted in "Active Orders". Statuses join the Commerce FSM.
function co(status: CommerceOrderLite['status'], over: Partial<CommerceOrderLite> = {}): CommerceOrderLite {
  return { id: 'c', orderNumber: 'n', status, sellerId: SELLER_A, consumerId: 'b', items: [{ listingType: 'product' }], ...over };
}
type ModelRow = { order: OpsStorefrontOrder; ctx?: any };
const dataset: ModelRow[] = [
  // 4 Pending
  { order: baseOrder({ orderId: 'p1', status: 'pending_payment' }), ctx: { commerce: co('pending') } },
  { order: baseOrder({ orderId: 'p2', status: 'pending_payment' }), ctx: { commerce: co('pending') } },
  { order: baseOrder({ orderId: 'p3', status: 'pending_payment' }), ctx: { commerce: co('pending') } },
  { order: baseOrder({ orderId: 'p4' }), ctx: { commerce: co('pending') } },
  // 3 Confirmed
  { order: baseOrder({ orderId: 'c1', status: 'confirmed' }), ctx: { commerce: co('confirmed') } },
  { order: baseOrder({ orderId: 'c2', status: 'confirmed' }), ctx: { commerce: co('confirmed') } },
  { order: baseOrder({ orderId: 'c3', status: 'confirmed' }), ctx: { commerce: co('confirmed') } },
  // 2 Processing (packed)
  { order: baseOrder({ orderId: 'pr1', status: 'active' }), ctx: { commerce: co('packed') } },
  { order: baseOrder({ orderId: 'pr2', status: 'active' }), ctx: { commerce: co('packed') } },
  // 1 Dispatched (shipped, no in_transit shipment)
  { order: baseOrder({ orderId: 'd1', status: 'active' }), ctx: { commerce: co('shipped') } },
  // 1 In transit (shipped + shipment in_transit)
  { order: baseOrder({ orderId: 't1', status: 'active' }), ctx: { commerce: co('shipped'), shipment: { status: 'in_transit' } } },
  // 1 Delivered (commerce delivered — still open, not completed)
  { order: baseOrder({ orderId: 'dv1', status: 'active' }), ctx: { commerce: co('delivered') } },
  // 1 Completed (history)
  { order: baseOrder({ orderId: 'done1', status: 'completed' }), ctx: { commerce: co('completed') } },
  // 1 Cancelled
  { order: baseOrder({ orderId: 'x1', status: 'cancelled' }), ctx: { commerce: co('cancelled') } },
  // 1 Rejected (seller declined a pending order)
  {
    order: baseOrder({ orderId: 'r1', status: 'cancelled', cancelledBy: 'seller' }),
    ctx: { commerce: co('cancelled', { cancelledBy: 'seller', statusBeforeCancel: 'pending' }) },
  },
  // 1 Returned cross-cut (delivered + has a return request)
  { order: baseOrder({ orderId: 'ret1', status: 'active' }), ctx: { commerce: co('delivered'), hasReturn: true } },
];

const stats = Object.fromEntries(orderHubStats(dataset).map((s) => [s.key, s.value]));
assert(stats.pending === 4, 'KPI Pending = 4 (freshly placed, NOT active)', stats.pending);
assert(
  stats.active === 3 + 2 + 1 + 1 + 1 + 1,
  'KPI Active Orders = confirmed+processing+dispatched+in_transit+delivered = 9 (Pending excluded)',
  stats.active,
);
assert(stats.awaitingDispatch === 3 + 2, 'KPI Awaiting Dispatch = confirmed + processing = 5');
assert(stats.inTransit === 1 + 1, 'KPI Dispatched = dispatched + in_transit = 2 (matches the DISPATCHED umbrella tab)');
assert(stats.deliveredOpen === 2, 'KPI Delivered (open) = commerce-delivered & not completed = 2 (dv1 + ret1)');

const tc = tabCounts(dataset);
assert(tc.all === dataset.length, 'tab "Order History" counts every order');
assert(tc.pending === 4, 'tab Pending = 4');
assert(tc.active === 9, 'tab Active Orders = 9 — Pending NOT included');
assert(tc.confirmed === 3, 'tab Confirmed = 3');
assert(tc.processing === 2, 'tab Processing = 2 (commerce packed)');
assert(tc.dispatched === 2, 'tab Dispatched = dispatched + in_transit rows = 2');
assert(tc.in_transit === 1, 'tab In Transit = shipment webhook in_transit = 1');
assert(tc.delivered === 2, 'tab Delivered = commerce delivered = 2');
assert(tc.completed === undefined, 'no standalone "Completed" tab — completed orders live in Order History per the completion rule');
assert(
  orderMatchesTab(baseOrder({ orderId: 'done1', status: 'completed' }), 'all', { commerce: co('completed') }) &&
    !orderMatchesTab(baseOrder({ orderId: 'done1', status: 'completed' }), 'active', { commerce: co('completed') }),
  'a completed order is in Order History and NOT in the active queue',
);
assert(tc.cancelled === 1, 'tab Cancelled = 1 (rejected is split out)');
assert(tc.rejected === 1, 'tab Rejected = 1 (seller declined a pending order)');
assert(tc.returned === 1, 'tab Returned = orders carrying a return request = 1');

// acceptance moves a pending order out of Pending and into Confirmed + Active
const pendingRow: ModelRow = { order: baseOrder({ orderId: 'acc', status: 'pending_payment' }), ctx: { commerce: co('pending') } };
assert(orderMatchesTab(pendingRow.order, 'pending', pendingRow.ctx), 'newly placed → matches Pending tab');
assert(!orderMatchesTab(pendingRow.order, 'active', pendingRow.ctx), 'newly placed → NOT in Active Orders');
const acceptedRow: ModelRow = { order: baseOrder({ orderId: 'acc', status: 'confirmed' }), ctx: { commerce: co('confirmed') } };
assert(!orderMatchesTab(acceptedRow.order, 'pending', acceptedRow.ctx), 'after acceptance → leaves Pending');
assert(
  orderMatchesTab(acceptedRow.order, 'confirmed', acceptedRow.ctx) && orderMatchesTab(acceptedRow.order, 'active', acceptedRow.ctx),
  'after acceptance → enters Confirmed AND Active Orders',
);
// cancelled / rejected / completed never sit in the active queue
for (const s of ['cancelled', 'rejected', 'completed'] as const) {
  assert(!orderMatchesTab(baseOrder({ orderId: 'z' }), 'active', { commerce: co(s === 'rejected' ? 'cancelled' : s, s === 'rejected' ? { cancelledBy: 'seller', statusBeforeCancel: 'pending' } : {}) }), `${s} order is never in Active Orders`);
}
// no-commerce fallback (service booking): pending_payment → Pending, active+allDelivered → Delivered
assert(deriveHubStatus(baseOrder({ status: 'pending_payment' }), undefined) === 'pending', 'no-commerce fallback: pending_payment → Pending');
assert(
  deriveHubStatus(
    baseOrder({
      status: 'active',
      subOrders: [{ sellerId: SELLER_A, deliveryFee: 0, items: [{ itemId: 'q', productTitle: 'q', quantity: 1, price: 1, deliveredAt: '2026-08-01T00:00:00Z' }] }],
    }),
    undefined,
  ) === 'delivered',
  'no-commerce fallback: active + all items delivered → Delivered',
);

// ── search (over already-authorized rows) ──────────────────────────────
assert(orderSearchMatches(multi, 'CHO-MULTI', adminV), 'search matches order id');
assert(orderSearchMatches(multi, 'beta goods', adminV), 'search matches seller business name (any sub-order)');
assert(orderSearchMatches(multi, 'INV-A-1', adminV), 'search matches invoice id');
assert(
  orderSearchMatches(multi, 'Beta Gadget', adminV) && !orderSearchMatches(multi, 'Beta Gadget', sellerAV),
  "product-title search is scoped: admin matches sibling's product, Seller A does not (presentation honesty)",
);
assert(orderSearchMatches(multi, 'Alpha Widget', sellerAV), 'Seller A can still search its own product title');
assert(orderSearchMatches(multi, '', sellerAV), 'empty query matches everything');

// ── hybrid detail routing (auth is NOT route-dependent) ────────────────────
assert(orderHubBasePath(adminV) === '/admin/orders', 'admin hub base path');
assert(orderHubBasePath(sellerAV) === '/admin/platform-orders', 'seller hub base path');
assert(
  orderDetailsPath(adminV, 'CHO MULTI/1') === '/admin/orders/CHO%20MULTI%2F1',
  'admin full-details path is encoded',
  orderDetailsPath(adminV, 'CHO MULTI/1'),
);
assert(
  orderDetailsPath(sellerAV, 'CHO-1') === '/admin/platform-orders/CHO-1',
  'seller full-details path uses the seller hub base',
);

// ── operations timeline (canonical state only) ───────────────────────────
const paidDelivered = baseOrder({
  status: 'completed',
  paymentStatus: 'paid',
  paidAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
  subOrders: [
    {
      sellerId: SELLER_A,
      deliveryFee: 0,
      items: [{ itemId: 't1', productTitle: 'X', quantity: 1, price: 100, deliveredAt: '2026-08-04T00:00:00.000Z' }],
    },
  ],
});
const tl = buildOperationsTimeline(paidDelivered, adminV);
assert(
  tl.map((s) => s.key).join(',') === 'placed,paid,confirmed,delivered,completed',
  'timeline steps for a paid+delivered+completed order',
  tl.map((s) => s.key),
);
assert(tl.every((s) => s.done), 'every timeline step done for a completed order');

const codAtDoor = baseOrder({
  status: 'active',
  isCOD: true,
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
});
const tlCod = buildOperationsTimeline(codAtDoor, adminV);
assert(
  !tlCod.some((s) => s.key === 'paid'),
  'COD-at-door order (never prepaid) omits the Paid milestone instead of showing it perpetually open',
  tlCod.map((s) => s.key),
);
assert(
  tlCod.find((s) => s.key === 'delivered')?.done === false,
  'timeline never manufactures Delivered completion',
);

const cancelledTl = buildOperationsTimeline(baseOrder({ status: 'cancelled', cancelledAt: '2026-08-02T00:00:00.000Z' }), adminV);
assert(
  cancelledTl.map((s) => s.key).join(',') === 'placed,cancelled',
  'cancelled order collapses to Placed → Cancelled',
);

// ── scoped financials ────────────────────────────────────────────────────
const finA = scopedFinancials(multi, sellerAV);
assert(finA.itemsSubtotal === 2000 && finA.deliveryTotal === 60, 'Seller A financials: 2000 items + 60 delivery');
assert(finA.scopedTotal === 2060, 'Seller A scoped total 2060 (not the 4500 whole-order)');
assert(finA.wholeOrderTotal === 4500, 'wholeOrderTotal still exposed for the field, but UI shows it to admin only');
const finAdmin = scopedFinancials(multi, adminV);
assert(
  finAdmin.itemsSubtotal === 4500 && finAdmin.deliveryTotal === 100,
  'admin financials span every sub-order: 4500 items + 100 delivery',
);

// ── staff / conversation / customer / invoice route helpers ──────────────
assert(isStaffRole('admin') && isStaffRole('super_admin') && isStaffRole('support_agent'), 'staff roles recognised');
assert(!isStaffRole('seller') && !isStaffRole('verified_seller') && !isStaffRole('creator'), 'partner roles are NOT staff');
assert(
  conversationDeepLink('uid-buyer-1') === '/admin/conversations?buyerId=uid-buyer-1',
  'conversation deep link targets the canonical Seller-Inbox route, not the storefront',
);
assert(
  conversationDeepLink('a/b c') === '/admin/conversations?buyerId=a%2Fb%20c',
  'conversation deep link encodes the buyerId',
);
assert(
  viewCustomerPath(adminV, 'uid-b') === '/admin/consumers/uid-b',
  'admin View Customer → canonical Consumer profile',
);
assert(
  viewCustomerPath(sellerAV, 'uid-b') === '/admin/customers',
  'seller View Customer → My Customers (no global consumer access)',
);
assert(
  invoicePath('CHO-1', 'uid-seller-a') === '/admin/invoice/op/CHO-1/uid-seller-a',
  'invoice route is per-seller-sub-order',
);
assert(invoicePath('CHO-1', 'uid-seller-a', true).endsWith('?autoprint=1'), 'invoice print route carries ?autoprint=1');

// ── ordered-item → Product Studio deep link (management shortcut only) ────
assert(productStudioPath('prod-123') === '/admin/products/prod-123/edit', 'ordered item → canonical Product Studio edit route');
assert(productStudioPath('a/b c') === '/admin/products/a%2Fb%20c/edit', 'product deep link is URI-encoded');
assert(productStudioPath(undefined) === null, 'no productId (service line / purged product) → no link (row still renders)');
assert(productStudioPath('') === null && productStudioPath('   ') === null, 'blank productId → no link');

// ── lifecycle panel (mirrors server/commerce/orderLifecycle.ts) ──────────
function commerceOrder(over: Partial<CommerceOrderLite>): CommerceOrderLite {
  return {
    id: 'c-1',
    orderNumber: 'CHO-1',
    status: 'pending',
    sellerId: SELLER_A,
    consumerId: 'uid-buyer-1',
    items: [{ listingType: 'product' }],
    ...over,
  };
}

const secKinds = (p: ReturnType<typeof lifecyclePanel>) => p.secondaryActions.map((a) => a.kind).sort();

assert(lifecyclePanel(null, adminV).available === false, 'no commerce order → lifecycle panel unavailable (honest gap)');

// PRIMARY button label derives from canonical state
const lcPending = lifecyclePanel(commerceOrder({ status: 'pending' }), adminV);
assert(lcPending.primaryAction?.to === 'confirmed' && lcPending.primaryAction?.label === 'Accept order', 'pending → primary "Accept order" (→confirmed)');
assert(secKinds(lcPending).join(',') === 'reject', 'pending → secondary is "Reject" (no Cancel, no Return-to-Pending)');

const lcConfirmedSeller = lifecyclePanel(commerceOrder({ status: 'confirmed' }), sellerAV);
assert(lcConfirmedSeller.primaryAction?.to === 'packed' && lcConfirmedSeller.primaryAction?.label === 'Start processing', 'confirmed → primary "Start processing" (→packed)');
assert(secKinds(lcConfirmedSeller).join(',') === 'cancel,return_to_pending', 'confirmed (seller) → secondary: Cancel + Return to Pending');

const lcConfirmedAdmin = lifecyclePanel(commerceOrder({ status: 'confirmed' }), adminV);
assert(secKinds(lcConfirmedAdmin).join(',') === 'cancel,return_to_pending', 'confirmed (admin) → secondary: Cancel + Return to Pending');

const lcPacked = lifecyclePanel(commerceOrder({ status: 'packed' }), sellerAV);
assert(lcPacked.primaryAction?.to === 'shipped' && lcPacked.primaryAction?.label === 'Mark dispatched', 'packed → primary "Mark dispatched" (→shipped)');
assert(secKinds(lcPacked).join(',') === 'cancel', 'packed (seller) → Cancel only — NO Return to Pending (has shipped past confirmed)');

const lcShippedSeller = lifecyclePanel(commerceOrder({ status: 'shipped' }), sellerAV);
assert(lcShippedSeller.primaryAction?.to === 'delivered' && lcShippedSeller.primaryAction?.label === 'Mark delivered', 'shipped → primary "Mark delivered" (→delivered)');
assert(secKinds(lcShippedSeller).join(',') === 'request_correction', 'shipped (seller) → NO backward transition; only "Request status correction" (→ Support)');
assert(lcShippedSeller.adminActions.length === 0, 'shipped (seller) → NO admin actions (staff-only)');
const lcShippedAdmin = lifecyclePanel(commerceOrder({ status: 'shipped' }), adminV);
assert(secKinds(lcShippedAdmin).join(',') === 'cancel', 'shipped (admin) → still Cancel; NO Return to Pending');
assert(
  lcShippedAdmin.adminActions.map((a) => a.to).join(',') === 'packed',
  'shipped (admin) → Admin action: "Retract dispatch → packed" ONLY (server 409s if courier moved)',
);

const lcDelivered = lifecyclePanel(commerceOrder({ status: 'delivered' }), adminV);
assert(lcDelivered.primaryAction?.to === 'completed' && lcDelivered.primaryAction?.label === 'Complete order', 'delivered → primary "Complete order" (→completed)');
assert(secKinds(lcDelivered).join(',') === 'cancel', 'delivered (admin) → Cancel only; NO Return to Pending');
assert(lcDelivered.adminActions.length === 0, 'delivered (admin) → NO admin correction (delivered→shipped is NOT in the approved allow-list)');
assert(
  secKinds(lifecyclePanel(commerceOrder({ status: 'delivered' }), sellerAV)).join(',') === 'request_correction',
  'delivered (seller) → only "Request status correction"',
);

// ── Administrative Status Correction — approved allow-list only ──────────
assert(!canAdministrativelyCorrect(sellerAV), 'seller cannot administratively correct');
assert(canAdministrativelyCorrect(adminV), 'admin can administratively correct');
assert(!canAdministrativelyCorrect(resolveOrderHubViewer({ id: 'x', role: 'moderator' })), 'moderator cannot administratively correct');
assert(
  lifecyclePanel(commerceOrder({ status: 'confirmed' }), adminV).adminActions.map((a) => a.to).join(',') === 'pending',
  'confirmed (admin) → Admin action: → pending only',
);
assert(
  lifecyclePanel(commerceOrder({ status: 'packed' }), adminV).adminActions.map((a) => a.to).join(',') === 'confirmed,pending',
  'packed (admin) → Admin actions: → confirmed, → pending (both restock)',
);
assert(
  lifecyclePanel(commerceOrder({ status: 'pending' }), adminV).adminActions.length === 0,
  'pending (admin) → no admin correction (nothing to reverse)',
);
assert(
  lifecyclePanel(commerceOrder({ status: 'completed' }), adminV).adminActions.length === 0 &&
    lifecyclePanel(commerceOrder({ status: 'cancelled' }), adminV).adminActions.length === 0,
  'completed / cancelled (admin) → NO admin correction (terminal; not in the allow-list)',
);

// ── Dispatch Details gate ──────────────────────────────────────────────
assert(
  lifecyclePanel(commerceOrder({ status: 'packed' }), adminV).primaryAction?.requiresDispatchForm === true,
  'packed → primary "Mark dispatched" requires the Dispatch Details form (no blind click)',
);
assert(
  lifecyclePanel(commerceOrder({ status: 'confirmed' }), adminV).primaryAction?.requiresDispatchForm !== true,
  'other transitions do NOT require the dispatch form',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'courier' })).sort().join(',') === 'courier,trackingNumber',
  'courier method: BOTH courier AND tracking number are required (no "no tracking" bypass)',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: 'TRK9' })).length === 0,
  'courier method: courier + tracking → valid',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'seller_delivery' })).length === 1,
  'seller delivery: a method/reference is required...',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'seller_delivery', courier: 'Own rider' })).length === 0,
  '...but NO fabricated tracking number',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'pickup' })).length === 0,
  'pickup: nothing required (no fake tracking)',
);
assert(
  Object.keys(validateDispatchForm({ ...EMPTY_DISPATCH_FORM, fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: 'X', estimatedDelivery: 'not-a-date' })).join(',') === 'estimatedDelivery',
  'estimated delivery must be a valid date when supplied',
);
assert(
  supportCorrectionPath('CHO-1', 'Shipped', 'wrong parcel').startsWith('/admin/support?') &&
    supportCorrectionPath('CHO-1', 'Shipped').includes('orderId=CHO-1'),
  'request-correction routes into /admin/support with order context',
);
assert(
  shipmentStatusLabel('awaiting_dispatch') === 'Awaiting dispatch' && shipmentStatusLabel('dispatched') === 'Dispatched',
  'shipment status labels for the new awaiting_dispatch / dispatched states',
);

// ── DISPATCHED ≠ IN TRANSIT in deriveHubStatus ────────────────────────
const shippedNoMove = { commerce: co('shipped'), shipment: { status: 'dispatched' } } as any;
const shippedMoving = { commerce: co('shipped'), shipment: { status: 'in_transit' } } as any;
const shippedPickedUp = { commerce: co('shipped'), shipment: { status: 'picked_up' } } as any;
assert(deriveHubStatus(baseOrder({ status: 'active' }), shippedNoMove) === 'dispatched', 'commerce shipped + shipment "dispatched" → Dispatched (NOT In Transit)');
assert(deriveHubStatus(baseOrder({ status: 'active' }), shippedMoving) === 'in_transit', 'commerce shipped + shipment "in_transit" → In Transit');
assert(deriveHubStatus(baseOrder({ status: 'active' }), shippedPickedUp) === 'in_transit', 'commerce shipped + shipment "picked_up" → In Transit (courier collected = movement)');
// a legacy synthetic TRK-… must NOT count as dispatched/movement
assert(
  deriveHubStatus(baseOrder({ status: 'active' }), { commerce: null, shipment: { status: 'awaiting_dispatch', trackingNumber: 'TRK-LEGACY' } } as any) === 'confirmed',
  'legacy synthetic TRK-… with awaiting_dispatch status is NOT treated as dispatched',
);

const lcCompleted = lifecyclePanel(commerceOrder({ status: 'completed' }), adminV);
assert(lcCompleted.primaryAction === null && lcCompleted.terminal && lcCompleted.secondaryActions.length === 0, 'completed is terminal — no primary, no secondary');
const lcCancelled = lifecyclePanel(commerceOrder({ status: 'cancelled' }), adminV);
assert(lcCancelled.terminal && lcCancelled.primaryAction === null && lcCancelled.secondaryActions.length === 0, 'cancelled is terminal — no CTA');

const lcServiceConfirmed = lifecyclePanel(
  commerceOrder({ status: 'confirmed', items: [{ listingType: 'service' }] }),
  adminV,
);
assert(
  lcServiceConfirmed.primaryAction?.to === 'completed' && lcServiceConfirmed.primaryAction?.label === 'Complete order',
  'service-only order: confirmed → primary "Complete order" (no pack/ship path)',
);

// "Return to Pending" is offered ONLY from exactly confirmed — never packed/shipped/delivered
for (const st of ['pending', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'] as const) {
  assert(
    !lifecyclePanel(commerceOrder({ status: st }), sellerAV).secondaryActions.some((a) => a.kind === 'return_to_pending'),
    `Return to Pending is NOT offered from "${st}"`,
  );
}
assert(
  lifecyclePanel(commerceOrder({ status: 'confirmed' }), sellerAV).secondaryActions.find((a) => a.kind === 'return_to_pending')?.reasonRequired === true,
  'Return to Pending requires a reason',
);

// ── role-aware advanced filters ─────────────────────────────────────────
const adminCaps = filterCapabilities(adminV);
const sellerCaps = filterCapabilities(sellerAV);
assert(adminCaps.includes('seller'), 'admin filter caps include the Seller/merchant selector');
assert(!sellerCaps.includes('seller'), 'seller filter caps do NOT include a Seller selector');
assert(sellerCaps.includes('brand') && sellerCaps.includes('invoice'), 'seller caps include owned Brand + Invoice status');
assert(!sellerCaps.includes('invoice') === false, 'seller has invoice filter'); // sanity
assert(!adminCaps.includes('invoice'), 'admin filter caps omit the seller-only Invoice status control');
assert(
  ['region', 'paymentMethod', 'paymentStatus', 'fulfillment', 'courier', 'source', 'cod', 'hasReturn', 'dateFrom', 'dateTo'].every(
    (k) => adminCaps.includes(k as any) && sellerCaps.includes(k as any),
  ),
  'shared filter controls available to both roles',
);

const fOrder = baseOrder({
  orderId: 'F1',
  isCOD: true,
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  platformSource: 'WhatsApp',
  isManual: true,
  createdAt: '2026-08-15T10:00:00.000Z',
  shipping: { fullName: 'X', phone: '1', address: 'a', region: 'Dhaka' },
  subOrders: [
    { sellerId: SELLER_A, sellerBusinessName: 'Alpha', brandId: 'brand-a', deliveryFee: 0, invoiceId: 'INV-1', items: [{ itemId: 'i', productTitle: 'W', quantity: 1, price: 100 }] },
  ],
});
const fCtx = { shipment: { courier: 'Pathao', status: 'in_transit' }, hasReturn: false } as any;

// AND semantics — all must match
assert(
  orderMatchesFilters(fOrder, fCtx, { region: 'Dhaka', paymentMethod: 'cod', cod: 'cod_unpaid', courier: 'Pathao', source: 'whatsapp' }, adminV),
  'AND semantics: order matching every filter passes',
);
assert(
  !orderMatchesFilters(fOrder, fCtx, { region: 'Dhaka', paymentMethod: 'online' }, adminV),
  'AND semantics: one non-matching filter (payment method) fails the row',
);
assert(!orderMatchesFilters(fOrder, fCtx, { region: 'Chittagong' }, adminV), 'region filter narrows');
assert(orderMatchesFilters(fOrder, fCtx, { brand: 'brand-a' }, sellerAV), 'seller brand filter matches an owned-brand sub-order');
assert(!orderMatchesFilters(fOrder, fCtx, { brand: 'brand-z' }, sellerAV), 'seller brand filter excludes a non-matching brand');
assert(orderMatchesFilters(fOrder, fCtx, { invoice: 'issued' }, sellerAV), 'seller invoice=issued matches (sub-order has invoiceId)');
assert(!orderMatchesFilters(fOrder, fCtx, { invoice: 'none' }, sellerAV), 'seller invoice=none excludes an invoiced order');
assert(orderMatchesFilters(fOrder, fCtx, { dateFrom: '2026-08-01', dateTo: '2026-08-31' }, adminV), 'date window includes an in-range order');
assert(!orderMatchesFilters(fOrder, fCtx, { dateFrom: '2026-09-01' }, adminV), 'date window excludes an out-of-range order');

// a seller URL carrying an admin-only filter cannot use it to widen — the
// server is the boundary, and the model also ignores caps a role lacks
assert(
  orderMatchesFilters(fOrder, fCtx, { seller: 'uid-seller-b' } as OrderHubFilters, sellerAV),
  'seller-mode ignores a smuggled `seller=` filter (not in seller caps) — it cannot filter to another seller',
);
assert(activeFilterCount({ region: 'Dhaka', paymentMethod: 'cod' }) === 2, 'active filter count = number of set values');
assert(activeFilterCount({ region: '', paymentMethod: undefined }) === 0, 'empty/undefined values are not counted');

// URL round-trip (survives navigate → Full Details → Back)
const sp = applyFiltersToSearchParams(new URLSearchParams(), { region: 'Dhaka', paymentMethod: 'cod', hasReturn: 'yes' }, 'confirmed');
assert(sp.get('rg') === 'Dhaka' && sp.get('pm') === 'cod' && sp.get('ret') === 'yes' && sp.get('tab') === 'confirmed', 'filters + tab serialize to short query keys');
const back = filtersFromSearchParams(sp);
assert(
  back.filters.region === 'Dhaka' && back.filters.paymentMethod === 'cod' && back.filters.hasReturn === 'yes' && back.tab === 'confirmed',
  'filters + tab round-trip from the query string',
);
const spDefault = applyFiltersToSearchParams(new URLSearchParams(), {}, 'active');
assert(!spDefault.toString(), 'the default tab ("active") + no filters produce an empty query string');

// dictionaries built from loaded rows; seller mode constrains brand options to owned brands
const dict = buildFilterDictionaries(
  [{ order: fOrder, ctx: fCtx }],
  [{ id: 'brand-a', name: 'Alpha Brand' }],
);
assert(dict.sellers.some((s) => s.value === SELLER_A), 'seller dictionary derived from sub-order sellerIds');
assert(dict.brands.length === 1 && dict.brands[0].label === 'Alpha Brand', 'seller brand dictionary is the owned-brands list only');
assert(dict.regions.some((r) => r.value === 'Dhaka') && dict.couriers.some((c) => c.value === 'Pathao'), 'region + courier dictionaries derived from data');

if (failed) {
  console.log(`\n=== ${failed} FAILED ===`);
  process.exit(1);
}
console.log('\nALL ORDER-HUB MODEL CHECKS PASSED');
