/**
 * Order Hub — pure presentation model (Sprint 14, Option B correction).
 *
 * The Order Hub React surface (<PlatformOrdersPage>, /admin/orders +
 * /admin/platform-orders) is a *presentation* layer over the canonical
 * Operations order engine. The security boundary is the SERVER
 * (server/operationsRouter.ts userCanListOrders / userCanMutateOrder) — this
 * module never decides what a caller may see. It only:
 *
 *   1. derives the KPI strip + workflow-status tabs from the already
 *      role-scoped `orders` array, mapping ONLY to real canonical statuses;
 *   2. computes the value a SELLER may honestly attribute to itself on a
 *      (possibly multi-seller) order — never `order.overallTotal`, which is
 *      the whole-order figure the server returns intact to every sub-order
 *      owner. Admin/staff keep the whole-order total.
 *
 * Every field read here exists on OpsStorefrontOrder / OpsSubOrder /
 * OpsOrderItem (src/services/operationsApi.ts). Nothing is fabricated.
 */
import type {
  OpsStorefrontOrder,
  OpsSubOrder,
  OpsOrderItem,
  OpsShipment,
  CommerceOrderLite,
} from '../../services/operationsApi';

export type OrderHubMode = 'admin' | 'seller';

export interface OrderHubViewer {
  mode: OrderHubMode;
  /** The seller's own uid (profile.id) when mode === 'seller'; null for admin/staff. */
  sellerId: string | null;
  /** Raw lowercased role — needed to gate Administrative Status Correction. */
  role: string;
}

/** Map an auth profile role to the Order Hub viewing mode. */
export function resolveOrderHubViewer(profile: { id?: string; role?: string } | null | undefined): OrderHubViewer {
  const role = String(profile?.role || '').toLowerCase();
  if (role === 'seller' || role === 'verified_seller') {
    return { mode: 'seller', sellerId: profile?.id || null, role };
  }
  return { mode: 'admin', sellerId: null, role };
}

/** May the viewer use the Administrative Status Correction capability? */
export function canAdministrativelyCorrect(viewer: OrderHubViewer): boolean {
  return viewer.mode === 'admin' && (viewer.role === 'admin' || viewer.role === 'super_admin');
}

/** Sub-orders on this order owned by `sellerId` (empty for admin scope). */
export function sellerSubOrders(order: OpsStorefrontOrder, sellerId: string | null): OpsSubOrder[] {
  if (!sellerId) return [];
  return (order.subOrders || []).filter((s) => s.sellerId === sellerId);
}

/** The sub-orders a given viewer should actually see line-item detail for. */
export function visibleSubOrders(order: OpsStorefrontOrder, viewer: OrderHubViewer): OpsSubOrder[] {
  if (viewer.mode === 'admin') return order.subOrders || [];
  return sellerSubOrders(order, viewer.sellerId);
}

/** Count of OTHER sellers present on the order (for a "+N other sellers" hint in seller mode). */
export function otherSellerCount(order: OpsStorefrontOrder, viewer: OrderHubViewer): number {
  if (viewer.mode !== 'seller') return 0;
  const ids = new Set(
    (order.subOrders || [])
      .map((s) => s.sellerId)
      .filter((id): id is string => Boolean(id) && id !== viewer.sellerId),
  );
  return ids.size;
}

function lineItemsValue(items: OpsOrderItem[] | undefined): number {
  return (items || []).reduce(
    (sum, it) => sum + Number(it.price || 0) * Math.max(1, Math.floor(Number(it.quantity) || 1)),
    0,
  );
}

/**
 * The monetary value a seller may attribute to itself on this order:
 * its own sub-orders' line items + its own delivery fees. NOT prorated for
 * order-level promo (promo is applied at the order total, not per sub-order —
 * so this is labelled "items value", not "payout").
 */
export function sellerAttributableValue(order: OpsStorefrontOrder, sellerId: string | null): number {
  const subs = sellerSubOrders(order, sellerId);
  return subs.reduce((sum, s) => sum + lineItemsValue(s.items) + Number(s.deliveryFee || 0), 0);
}

/**
 * What the value column/line should show for this viewer.
 * Admin/staff: the canonical whole-order total.
 * Seller: only the value attributable to its own sub-orders.
 */
export function visibleOrderValue(order: OpsStorefrontOrder, viewer: OrderHubViewer): number {
  if (viewer.mode === 'admin') return Number(order.overallTotal || 0);
  return sellerAttributableValue(order, viewer.sellerId);
}

/** True when the order has sub-orders for more than one distinct seller. */
export function isMultiSeller(order: OpsStorefrontOrder): boolean {
  const ids = new Set((order.subOrders || []).map((s) => s.sellerId).filter(Boolean));
  return ids.size > 1 || Boolean(order.isSplit);
}

export type DerivedFulfillment = 'awaiting' | 'partial' | 'delivered' | 'none';

/**
 * Fulfillment progress derived purely from canonical item.deliveredAt across
 * the viewer-visible sub-orders. 'none' = no items in scope.
 */
export function derivedFulfillment(order: OpsStorefrontOrder, viewer: OrderHubViewer): DerivedFulfillment {
  const items = visibleSubOrders(order, viewer).flatMap((s) => s.items || []);
  if (items.length === 0) return 'none';
  const delivered = items.filter((it) => Boolean(it.deliveredAt)).length;
  if (delivered === 0) return 'awaiting';
  if (delivered === items.length) return 'delivered';
  return 'partial';
}

/** COD order whose payment the platform has not yet confirmed as collected. */
export function isCodUnconfirmed(order: OpsStorefrontOrder): boolean {
  if (!order.isCOD) return false;
  if (order.status === 'cancelled') return false;
  const ps = order.paymentStatus;
  return ps === undefined || ps === 'unpaid' || ps === 'pending';
}

// ════════════════════════════════════════════════════════════════════════
// Lifecycle-accurate workflow status (Sprint 14 — tabs = real workflow)
// ════════════════════════════════════════════════════════════════════════
//
// The Order Hub list reads Operations orders, whose `status` collapses
// packed/shipped/delivered into 'active'. To show a REAL operational lifecycle
// the Hub also loads (once, role-scoped by their own servers):
//   - the Commerce order list  (rich FSM: pending→confirmed→packed→shipped→
//     delivered→completed / cancelled), joined by orderNumber === orderId
//   - the shipment list        (courier + webhook status: in_transit, …)
//   - the returns list         (which orders carry a return request)
// and derives one unified status. Nothing is fabricated: an order with no
// Commerce record (a service booking / legacy Operations-only order) falls back
// to its Operations status + canonical item.deliveredAt / shipment signals.

export type HubLifecycleStatus =
  | 'pending' // placed, not yet accepted/confirmed — NOT active
  | 'confirmed' // accepted, fulfilment not started
  | 'processing' // packed (stock consumed, shipment created) — not handed to courier
  | 'dispatched' // handed to courier, not yet moving
  | 'in_transit' // shipment webhook says in_transit
  | 'delivered' // delivered, completion still pending
  | 'completed' // terminal — history
  | 'cancelled' // terminal
  | 'rejected'; // terminal — cancelled from 'pending' by the seller (declined)

/** The Commerce/shipment/returns joins for one order, resolved by the page. */
export interface OrderHubContext {
  commerce?: CommerceOrderLite | null;
  shipment?: OpsShipment | null;
  hasReturn?: boolean;
}

const ACTIVE_STATUSES: ReadonlySet<HubLifecycleStatus> = new Set<HubLifecycleStatus>([
  'confirmed',
  'processing',
  'dispatched',
  'in_transit',
  'delivered',
]);

/** Unified canonical lifecycle status for one order. */
export function deriveHubStatus(order: OpsStorefrontOrder, ctx: OrderHubContext | undefined): HubLifecycleStatus {
  const c = ctx?.commerce;
  const ship = ctx?.shipment;

  // cancellations — split "rejected" (seller declined a pending order) out of "cancelled"
  const cancelled = order.status === 'cancelled' || c?.status === 'cancelled';
  if (cancelled) {
    const declined =
      (c?.cancelledBy === 'seller' || order.cancelledBy === 'seller') &&
      (c as { statusBeforeCancel?: string } | undefined)?.statusBeforeCancel === 'pending';
    return declined ? 'rejected' : 'cancelled';
  }

  if (c) {
    switch (c.status) {
      case 'pending':
        return 'pending';
      case 'confirmed':
        return 'confirmed';
      case 'packed':
        return 'processing';
      case 'shipped':
        // Defence-in-depth: a canonical shipment that already reads `delivered`
        // (courier webhook) outranks the lagging Commerce status — never show
        // "Dispatched" over a delivered shipment. Canonical settlement normally
        // advances the Commerce order too, so this is a safety net, not the
        // primary path. `failed_delivery` / `returned` stay in the dispatched
        // bucket (needs attention) — the lifecycle panel surfaces the exception.
        if (ship?.status === 'delivered') return 'delivered';
        // DISPATCHED ≠ IN TRANSIT — only a courier movement checkpoint promotes it.
        return ship && (ship.status === 'in_transit' || ship.status === 'picked_up')
          ? 'in_transit'
          : 'dispatched';
      case 'delivered':
        return 'delivered';
      case 'completed':
        return 'completed';
    }
  }

  // No Commerce record — Operations status + canonical shipment / deliveredAt.
  if (order.status === 'completed') return 'completed';
  if (order.status === 'pending_payment') return 'pending';
  if (order.status === 'confirmed') return 'confirmed';
  if (order.status === 'active') {
    // seller-neutral fulfilment view (admin sees all sub-orders)
    const items = (order.subOrders || []).flatMap((s) => s.items || []);
    const allDelivered = items.length > 0 && items.every((it) => Boolean(it.deliveredAt));
    if (allDelivered || ship?.status === 'delivered') return 'delivered';
    if (ship?.status === 'in_transit' || ship?.status === 'picked_up') return 'in_transit';
    if (ship?.status === 'dispatched') return 'dispatched';
    return 'confirmed';
  }
  return 'pending';
}

export function hubStatusLabel(s: HubLifecycleStatus): string {
  const map: Record<HubLifecycleStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    dispatched: 'Dispatched',
    in_transit: 'In transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  };
  return map[s];
}

/** Umbrella "Active Orders" queue: accepted, non-terminal, still needs work. Excludes Pending. */
export function isActiveOrder(status: HubLifecycleStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export interface OrderHubStat {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * KPI strip — lifecycle-accurate. Pending is NOT counted inside Active.
 * Computed over the filter-narrowed rows (the caller passes those in) so the
 * screen stays operationally useful under advanced filters.
 */
export function orderHubStats(
  rows: Array<{ order: OpsStorefrontOrder; ctx?: OrderHubContext }>,
): OrderHubStat[] {
  let pending = 0;
  let active = 0;
  let awaitingDispatch = 0;
  let inTransit = 0;
  let deliveredOpen = 0;

  for (const { order, ctx } of rows) {
    const s = deriveHubStatus(order, ctx);
    if (s === 'pending') pending += 1;
    if (isActiveOrder(s)) active += 1;
    if (s === 'confirmed' || s === 'processing') awaitingDispatch += 1;
    if (s === 'dispatched' || s === 'in_transit') inTransit += 1;
    if (s === 'delivered') deliveredOpen += 1;
  }

  return [
    { key: 'pending', label: 'Pending', value: pending, color: '#B45309' },
    { key: 'active', label: 'Active Orders', value: active, color: '#2563EB' },
    { key: 'awaitingDispatch', label: 'Awaiting Dispatch', value: awaitingDispatch, color: '#7C3AED' },
    // matches the "Dispatched" umbrella tab (handed to courier + in transit)
    { key: 'inTransit', label: 'Dispatched', value: inTransit, color: '#0891B2' },
    { key: 'deliveredOpen', label: 'Delivered (open)', value: deliveredOpen, color: '#16A34A' },
  ];
}

export interface OrderStatusTab {
  key: string;
  label: string;
  icon: string;
}

/**
 * Workflow strip — the real operational lifecycle, not overlapping filters.
 * `all` = Order History (everything). `active` = the umbrella queue (excludes
 * Pending / Cancelled / Rejected / Completed). Each specific tab is one
 * canonical lifecycle state. `returned` is a cross-cut (order carries a return
 * request); `exchange` is NOT currently a distinct canonical type — folded into
 * `returned` — so it has no tab.
 */
export const ORDER_STATUS_TABS: OrderStatusTab[] = [
  { key: 'active', label: 'Active Orders', icon: '📋' },
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'confirmed', label: 'Confirmed', icon: '✓' },
  { key: 'processing', label: 'Processing', icon: '⚙' },
  { key: 'dispatched', label: 'Dispatched', icon: '🚚' },
  { key: 'in_transit', label: 'In Transit', icon: '🛫' },
  { key: 'delivered', label: 'Delivered', icon: '📦' },
  { key: 'returned', label: 'Returned', icon: '↩' },
  { key: 'cancelled', label: 'Cancelled', icon: '✕' },
  { key: 'rejected', label: 'Rejected', icon: '⛔' },
  { key: 'all', label: 'Order History', icon: '🕘' },
];

export function orderMatchesTab(
  order: OpsStorefrontOrder,
  tabKey: string,
  ctx?: OrderHubContext,
): boolean {
  if (tabKey === 'all') return true;
  if (tabKey === 'returned') return Boolean(ctx?.hasReturn);
  const s = deriveHubStatus(order, ctx);
  if (tabKey === 'active') return isActiveOrder(s);
  // "Dispatched" is the list-level umbrella for handed-to-courier orders; the
  // separate "In Transit" tab refines it with the shipment webhook signal.
  if (tabKey === 'dispatched') return s === 'dispatched' || s === 'in_transit';
  return s === tabKey;
}

export function tabCounts(
  rows: Array<{ order: OpsStorefrontOrder; ctx?: OrderHubContext }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tab of ORDER_STATUS_TABS) {
    counts[tab.key] = rows.filter(({ order, ctx }) => orderMatchesTab(order, tab.key, ctx)).length;
  }
  return counts;
}

/** Base Order Hub list route for this viewer (admin vs seller path). */
export function orderHubBasePath(viewer: OrderHubViewer): string {
  return viewer.mode === 'seller' ? '/admin/platform-orders' : '/admin/orders';
}

/** Platform-staff roles — get internal notes + full lifecycle + broad customer access. */
export function isStaffRole(role: string | undefined | null): boolean {
  const r = String(role || '').toLowerCase();
  return (
    r === 'admin' ||
    r === 'super_admin' ||
    r === 'support_agent' ||
    r === 'moderator' ||
    r === 'finance_manager'
  );
}

/**
 * Canonical System-B buyer↔seller conversation deep link — the SAME route the
 * Seller Inbox opens a thread with (src/pages/admin/SellerConversations.tsx
 * reads ?buyerId and calls selectConversation → conv_platform_<buyerId>).
 * NOT the storefront, NOT a bare messages landing, NOT System-A support.
 */
export function conversationDeepLink(buyerId: string): string {
  return `/admin/conversations?buyerId=${encodeURIComponent(buyerId)}`;
}

/** "View customer" target. Admin → canonical Consumer profile. Seller → My Customers (relationship-scoped). */
export function viewCustomerPath(viewer: OrderHubViewer, buyerId: string): string {
  return viewer.mode === 'admin'
    ? `/admin/consumers/${encodeURIComponent(buyerId)}`
    : '/admin/customers';
}

/**
 * Canonical Product Studio edit route for an ordered item's productId. This is
 * a MANAGEMENT navigation shortcut only — it never grants access: the Studio
 * loads via GET /catalog/products/:id which enforces seller ownership
 * server-side (a seller opening a foreign product hits the Studio's own
 * load-error screen). Returns null for items with no canonical productId
 * (service lines) so the caller can render the title/thumb without a link.
 */
export function productStudioPath(productId: string | undefined | null): string | null {
  const id = String(productId || '').trim();
  return id ? `/admin/products/${encodeURIComponent(id)}/edit` : null;
}

/** Per-seller-sub-order invoice route (OperationsInvoiceView authorizes to staff or that seller). */
export function invoicePath(orderId: string, sellerId: string, autoprint = false): string {
  return `/admin/invoice/op/${encodeURIComponent(orderId)}/${encodeURIComponent(sellerId)}${
    autoprint ? '?autoprint=1' : ''
  }`;
}

/**
 * Canonical full Order Details route for this viewer. Authorization is NOT
 * route-dependent — the server 403s a caller who does not own the order
 * regardless of which path was used; the two paths only keep the correct
 * sidebar item active and give Back a natural target.
 */
export function orderDetailsPath(viewer: OrderHubViewer, orderId: string): string {
  return `${orderHubBasePath(viewer)}/${encodeURIComponent(orderId)}`;
}

export interface TimelineStep {
  key: string;
  label: string;
  done: boolean;
  ts?: string;
}

/**
 * Operations timeline built ONLY from canonical order state / timestamps.
 * A step is "done" only when a real field proves it — never manufactured.
 *   Placed      → createdAt (always)
 *   Paid        → paidAt / paymentStatus === 'paid'  (skipped for COD-at-door
 *                 orders that were never prepaid: no paidAt, COD, still unpaid)
 *   Confirmed   → status is confirmed | completed, or a paid booking order
 *   Delivered   → every in-scope item has item.deliveredAt
 *   Completed   → status === 'completed'
 */
export function buildOperationsTimeline(
  order: OpsStorefrontOrder,
  viewer: OrderHubViewer,
): TimelineStep[] {
  const items = visibleSubOrders(order, viewer).flatMap((s) => s.items || []);
  const deliveredTs = items
    .map((it) => it.deliveredAt)
    .filter((v): v is string => Boolean(v))
    .sort();
  const allDelivered = items.length > 0 && deliveredTs.length === items.length;
  const paid = order.paymentStatus === 'paid' || Boolean(order.paidAt);
  const confirmed =
    order.status === 'confirmed' || order.status === 'completed' || (paid && order.status !== 'cancelled');

  const steps: TimelineStep[] = [
    { key: 'placed', label: 'Placed', done: true, ts: order.createdAt },
  ];

  // Only show a Paid milestone when payment is actually tracked for this order
  // (prepaid, or a non-COD flow). A pure COD order collected at the door has no
  // canonical "paid" timestamp — omit the step rather than show it perpetually open.
  const paymentTracked = paid || order.paymentStatus === 'pending' || order.paymentMethod !== 'cod';
  if (paymentTracked) {
    steps.push({ key: 'paid', label: 'Paid', done: paid, ts: order.paidAt });
  }

  steps.push({
    key: 'confirmed',
    label: 'Confirmed',
    done: confirmed,
    ts: confirmed && !paid ? order.updatedAt : order.paidAt,
  });
  steps.push({
    key: 'delivered',
    label: 'Delivered',
    done: allDelivered,
    ts: allDelivered ? deliveredTs[deliveredTs.length - 1] : undefined,
  });
  steps.push({
    key: 'completed',
    label: 'Completed',
    done: order.status === 'completed',
    ts: order.status === 'completed' ? order.updatedAt : undefined,
  });

  if (order.status === 'cancelled') {
    return [
      { key: 'placed', label: 'Placed', done: true, ts: order.createdAt },
      { key: 'cancelled', label: 'Cancelled', done: true, ts: order.cancelledAt || order.updatedAt },
    ];
  }
  return steps;
}

/** Item + delivery value for the viewer's in-scope sub-orders (no promo proration). */
export function scopedFinancials(
  order: OpsStorefrontOrder,
  viewer: OrderHubViewer,
): { itemsSubtotal: number; deliveryTotal: number; scopedTotal: number; wholeOrderTotal: number } {
  const subs = visibleSubOrders(order, viewer);
  const itemsSubtotal = subs.reduce(
    (sum, s) =>
      sum +
      (s.items || []).reduce(
        (a, it) => a + Number(it.price || 0) * Math.max(1, Math.floor(Number(it.quantity) || 1)),
        0,
      ),
    0,
  );
  const deliveryTotal = subs.reduce((sum, s) => sum + Number(s.deliveryFee || 0), 0);
  return {
    itemsSubtotal,
    deliveryTotal,
    scopedTotal: itemsSubtotal + deliveryTotal,
    wholeOrderTotal: Number(order.overallTotal || 0),
  };
}

// ── Canonical order lifecycle (mirrors server/commerce/orderLifecycle.ts) ──
// Client-side copy of the FSM, used ONLY to show the one legitimate next action
// and whether cancel is offered. Every transition is still enforced server-side
// (transitionOrder / cancelOrder): the button 400s/403s if this copy drifts.

type CommerceStatus = CommerceOrderLite['status'];

const COMMERCE_FORWARD: Record<string, CommerceStatus> = {
  pending: 'confirmed',
  confirmed: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
  delivered: 'completed',
};

const COMMERCE_FORWARD_SERVICE: Record<string, CommerceStatus> = {
  pending: 'confirmed',
  confirmed: 'completed',
};

export function commerceStatusLabel(s: CommerceStatus): string {
  const map: Record<CommerceStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    packed: 'Packed',
    shipped: 'Shipped / In transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[s] || s;
}

/**
 * User-friendly label for the PRIMARY action that advances FROM the current
 * state. Canonical FSM terminology is used on the wire (`to`); this is display
 * only. `pending→ACCEPT ORDER`, `confirmed→START PROCESSING`,
 * `packed→MARK DISPATCHED`, `shipped→MARK DELIVERED`, `delivered→COMPLETE ORDER`.
 */
export function primaryActionLabel(from: CommerceStatus, to: CommerceStatus): string {
  if (from === 'pending' && to === 'confirmed') return 'Accept order';
  if (from === 'confirmed' && to === 'packed') return 'Start processing';
  if (from === 'confirmed' && to === 'completed') return 'Complete order'; // service-only
  if (from === 'packed' && to === 'shipped') return 'Mark dispatched';
  if (from === 'shipped' && to === 'delivered') return 'Mark delivered';
  if (from === 'delivered' && to === 'completed') return 'Complete order';
  return `Move to ${to}`;
}

function commerceOrderIsServiceOnly(o: CommerceOrderLite): boolean {
  const items = o.items || [];
  return items.length > 0 && items.every((i) => i.listingType === 'service');
}

export type LifecycleSecondaryKind = 'reject' | 'cancel' | 'return_to_pending' | 'request_correction';

export interface LifecycleSecondaryAction {
  kind: LifecycleSecondaryKind;
  label: string;
  /** UI must collect a reason before firing. */
  reasonRequired: boolean;
  /** Extra confirm copy for destructive / unusual corrections. */
  confirmNote?: string;
}

/** Administrative Status Correction option (super-admin / admin only). */
export interface LifecycleAdminAction {
  to: AdminCorrectionTarget;
  label: string;
  /** Human consequence summary shown in the confirmation dialog. */
  consequence: string;
}
export type AdminCorrectionTarget = 'pending' | 'confirmed' | 'packed';

export interface LifecyclePanel {
  /** false → this Operations order has no Commerce lifecycle record (booking/legacy). */
  available: boolean;
  current: CommerceStatus | null;
  currentLabel: string;
  /**
   * The ONE legitimate forward transition, derived from canonical state.
   * null at a terminal state (no CTA). Never advance cosmetically — call the
   * transition endpoint and refetch. `requiresDispatchForm` → the UI must open
   * the Dispatch Details sheet instead of firing the transition directly.
   */
  primaryAction: { to: CommerceStatus; label: string; requiresDispatchForm?: boolean } | null;
  /** Server-authorized corrective alternatives for this actor/state (never a free setter). */
  secondaryActions: LifecycleSecondaryAction[];
  /** Administrative Status Correction options (staff only, explicit allow-list). */
  adminActions: LifecycleAdminAction[];
  terminal: boolean;
  /**
   * Set when the canonical shipment reports a delivery EXCEPTION
   * (`failed_delivery` / `returned`) while the order is still `shipped`. The UI
   * must surface this instead of an ordinary "Mark delivered" and route the
   * operator to the Returns / Support path.
   */
  exception: { kind: 'failed_delivery' | 'returned'; label: string } | null;
}

/**
 * Compute the lifecycle panel for a viewer. `commerceOrder === null` → the
 * Operations order has no Commerce counterpart (pure booking / legacy); the UI
 * shows an honest "not available for this order type" note. The server
 * re-validates every action this returns.
 */
export function lifecyclePanel(
  commerceOrder: CommerceOrderLite | null,
  viewer: OrderHubViewer,
  shipment?: OpsShipment | null,
): LifecyclePanel {
  if (!commerceOrder) {
    return {
      available: false,
      current: null,
      currentLabel: '—',
      primaryAction: null,
      secondaryActions: [],
      adminActions: [],
      terminal: false,
      exception: null,
    };
  }
  const status = commerceOrder.status;
  const terminal = status === 'completed' || status === 'cancelled';
  const fwd = commerceOrderIsServiceOnly(commerceOrder) ? COMMERCE_FORWARD_SERVICE : COMMERCE_FORWARD;
  const to = terminal ? undefined : fwd[status];

  // Fulfillment-aware presentation — the canonical Commerce FSM is unchanged
  // (packed → shipped → delivered → completed); only the labels / available
  // actions adapt to how the parcel is actually being fulfilled.
  const sStatus = shipment?.status;
  const isPickup = shipment?.fulfillmentMethod === 'pickup';
  const shipmentDelivered = sStatus === 'delivered';
  const shipmentException =
    status === 'shipped' && (sStatus === 'failed_delivery' || sStatus === 'returned')
      ? ({
          kind: sStatus,
          label: sStatus === 'returned' ? 'Parcel returned to sender' : 'Delivery attempt failed',
        } as const)
      : null;

  let primaryAction: LifecyclePanel['primaryAction'] = to
    ? {
        to,
        label: primaryActionLabel(status, to),
        // packed → shipped ("Mark dispatched") must go through the Dispatch Details sheet.
        requiresDispatchForm: status === 'packed' && to === 'shipped',
      }
    : null;

  if (!terminal && primaryAction) {
    if (shipmentException) {
      // No ordinary "Mark delivered" over a failed / returned parcel.
      primaryAction = null;
    } else if (status === 'shipped' && shipmentDelivered) {
      // Canonical shipment already delivered (courier webhook) — the only
      // legitimate forward step is completing the order.
      primaryAction = { to: 'completed', label: 'Complete order' };
    } else if (isPickup && status === 'packed') {
      primaryAction = { ...primaryAction, label: 'Mark ready for pickup' };
    } else if (isPickup && status === 'shipped') {
      primaryAction = { ...primaryAction, label: 'Mark collected' };
    }
  }

  const secondaryActions: LifecycleSecondaryAction[] = [];
  const adminActions: LifecycleAdminAction[] = [];

  if (!terminal) {
    // canActorCancel(): admin → any non-terminal; seller → pending|confirmed|packed.
    const canCancel =
      viewer.mode === 'admin' || status === 'pending' || status === 'confirmed' || status === 'packed';
    if (canCancel) {
      if (status === 'pending') {
        secondaryActions.push({ kind: 'reject', label: 'Reject order', reasonRequired: true });
      } else {
        secondaryActions.push({ kind: 'cancel', label: 'Cancel order', reasonRequired: true });
      }
    }
    // Controlled "undo accidental acceptance": confirmed → pending, EXACTLY.
    if (status === 'confirmed') {
      secondaryActions.push({
        kind: 'return_to_pending',
        label: 'Return to Pending',
        reasonRequired: true,
        confirmNote:
          'Corrects an accidental acceptance. Only allowed while nothing has been packed, dispatched, or delivered — the server re-checks. The original acceptance stays in the order history.',
      });
    }
    // After actual dispatch the seller has NO backward action — only an honest
    // route into Choosify Support for a manual correction request.
    if (
      viewer.mode === 'seller' &&
      (status === 'shipped' || status === 'delivered') &&
      !shipmentException
    ) {
      secondaryActions.push({
        kind: 'request_correction',
        label: 'Request status correction',
        reasonRequired: false,
        confirmNote:
          'Once dispatched, only platform staff can move an order backward. This opens a Choosify Support request with the order ID and current state attached.',
      });
    }
    // Delivery exception — the courier reported the parcel failed / returned.
    // Everyone (seller AND staff) gets an honest route into Returns / Support;
    // the ordinary "Mark delivered" CTA was suppressed above.
    if (shipmentException) {
      secondaryActions.push({
        kind: 'request_correction',
        label:
          shipmentException.kind === 'returned'
            ? 'Manage returned parcel'
            : 'Resolve failed delivery',
        reasonRequired: false,
        confirmNote:
          `The courier reported this parcel as ${
            shipmentException.kind === 'returned' ? 'returned to sender' : 'undeliverable'
          }. This opens a Choosify Support request with the order ID and shipment state attached.`,
      });
    }

    // Administrative Status Correction — explicit allow-list, staff only.
    if (canAdministrativelyCorrect(viewer)) {
      if (status === 'confirmed') {
        adminActions.push({
          to: 'pending',
          label: 'Correct → Pending',
          consequence: 'Reverts acceptance. Reservation kept, no stock/payment movement. Order re-enters the Pending queue.',
        });
      } else if (status === 'packed') {
        adminActions.push({
          to: 'confirmed',
          label: 'Correct → Confirmed',
          consequence: 'Reverses the Processing stock consumption (restocks + re-reserves) and voids the packed shipment record.',
        });
        adminActions.push({
          to: 'pending',
          label: 'Correct → Pending',
          consequence: 'Reverses stock consumption AND reverts acceptance — order returns to the Pending queue.',
        });
      } else if (status === 'shipped') {
        adminActions.push({
          to: 'packed',
          label: 'Retract dispatch → Processing',
          consequence:
            'Only allowed BEFORE any courier movement checkpoint. Clears courier/tracking, returns the order to Processing. Rejected (409, no change) if the parcel has physically progressed.',
        });
      }
    }
  }

  return {
    available: true,
    current: status,
    currentLabel: commerceStatusLabel(status),
    primaryAction,
    secondaryActions,
    adminActions,
    terminal,
    exception: shipmentException,
  };
}

// ── Dispatch Details form (client mirror of the server validation) ────────
export type DispatchFulfillmentMethod = 'courier' | 'seller_delivery' | 'pickup';

export interface DispatchForm {
  fulfillmentMethod: DispatchFulfillmentMethod;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
  dispatchNote: string;
}

export const EMPTY_DISPATCH_FORM: DispatchForm = {
  fulfillmentMethod: 'courier',
  courier: '',
  trackingNumber: '',
  trackingUrl: '',
  estimatedDelivery: '',
  dispatchNote: '',
};

/**
 * Client-side dispatch validation — mirrors server/commerce/orderService.ts
 * validateDispatchDetails. For `courier`, both courier AND tracking are
 * required (no seller-controlled "no tracking" bypass). Seller delivery needs a
 * method/reference but no fabricated tracking. Pickup needs nothing.
 */
export function validateDispatchForm(f: DispatchForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.fulfillmentMethod === 'courier') {
    if (!f.courier.trim()) e.courier = 'Courier / logistics provider is required';
    if (!f.trackingNumber.trim()) e.trackingNumber = 'Tracking / consignment number is required for courier dispatch';
  } else if (f.fulfillmentMethod === 'seller_delivery') {
    if (!f.courier.trim() && !f.trackingNumber.trim()) {
      e.courier = 'A delivery method or reference is required';
    }
  }
  if (f.estimatedDelivery.trim() && Number.isNaN(Date.parse(f.estimatedDelivery))) {
    e.estimatedDelivery = 'Estimated delivery date is invalid';
  }
  return e;
}

/**
 * "Request status correction" → the existing Choosify Support inbox
 * (/admin/support → PartnerSupportInbox), carrying the order id + current
 * state + reason so the request is pre-contextualised.
 */
export function supportCorrectionPath(orderId: string, currentState: string, reason?: string): string {
  const q = new URLSearchParams({
    topic: 'order_status_correction',
    orderId,
    state: currentState,
  });
  if (reason && reason.trim()) q.set('reason', reason.trim());
  return `/admin/support?${q.toString()}`;
}

/**
 * Human label for an OpsShipment status (incl. the new awaiting_dispatch /
 * dispatched). Pass the shipment's `fulfillmentMethod` to get pickup-honest
 * wording — a pickup order is never "Dispatched" / "In transit" to a reader.
 */
export function shipmentStatusLabel(status: string, method?: string | null): string {
  if (method === 'pickup') {
    const pickupMap: Record<string, string> = {
      awaiting_dispatch: 'Preparing',
      dispatched: 'Ready for pickup',
      pending_pickup: 'Ready for pickup',
      in_transit: 'Ready for pickup',
      picked_up: 'Collected',
      delivered: 'Collected',
      failed_delivery: 'Not collected',
      returned: 'Returned',
      cancelled: 'Cancelled',
    };
    if (pickupMap[status]) return pickupMap[status];
  }
  const map: Record<string, string> = {
    awaiting_dispatch: 'Awaiting dispatch',
    dispatched: 'Dispatched',
    pending_pickup: 'Pending pickup',
    picked_up: 'Picked up',
    in_transit: 'In transit',
    delivered: 'Delivered',
    failed_delivery: 'Failed delivery',
    returned: 'Returned',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

/**
 * The user-facing lifecycle badge for the Order Hub. Identical to
 * `hubStatusLabel` for courier / seller-delivery, but pickup orders read
 * "Ready for pickup" / "Collected" rather than "Dispatched" / "Delivered" —
 * pickup has no courier-handover or in-transit stage to show. The underlying
 * `deriveHubStatus` (tabs / counts) is unchanged.
 */
export function fulfillmentStatusLabel(
  hubStatus: HubLifecycleStatus,
  shipment?: OpsShipment | null,
): string {
  if (shipment?.fulfillmentMethod === 'pickup') {
    if (hubStatus === 'dispatched' || hubStatus === 'in_transit') return 'Ready for pickup';
    if (hubStatus === 'delivered') return 'Collected';
  }
  return hubStatusLabel(hubStatus);
}

/**
 * Operational search over the already-authorized dataset. In seller mode the
 * product-title match is limited to the seller's own sub-orders so a query
 * cannot appear to "hit" a sibling seller's line item — presentation honesty,
 * not an ownership boundary (the row is already server-authorized).
 */
export function orderSearchMatches(
  order: OpsStorefrontOrder,
  rawQuery: string,
  viewer: OrderHubViewer,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const hay: string[] = [
    order.orderId,
    order.buyerId,
    order.shipping?.fullName || '',
    order.shipping?.phone || '',
    order.promoCode || '',
    order.platformSource || '',
  ];
  for (const s of order.subOrders || []) {
    hay.push(s.sellerBusinessName || '');
    hay.push(s.invoiceId || '');
  }
  for (const s of visibleSubOrders(order, viewer)) {
    for (const it of s.items || []) hay.push(it.productTitle || '');
  }
  return hay.some((v) => v.toLowerCase().includes(q));
}

// ════════════════════════════════════════════════════════════════════════
// Role-aware advanced filters (Sprint 14)
// ════════════════════════════════════════════════════════════════════════
//
// ONE shared model. Capabilities differ by role, controls do not. All filtering
// is CLIENT-SIDE over the already-loaded, server-role-scoped dataset (the Hub
// downloads it once for the KPIs anyway). A filter value is NEVER sent as an
// authorization parameter — `GET /operations/orders` only trusts the server's
// own seller scoping; a forged `sellerId=` there 403s. AND semantics across
// controls. KPIs + tab counts are computed over the filter-narrowed rows
// (minus the active status tab + free-text search).

export interface OrderHubFilters {
  seller?: string; // admin only — a sub-order sellerId present in the data
  brand?: string; // seller: an owned brandId; admin: any brandId in the data
  region?: string; // shipping.region (BD "division" granularity — the only canonical geo field)
  paymentMethod?: string; // cod | credit | online
  paymentStatus?: string; // unpaid | pending | paid | failed | cancelled
  fulfillment?: string; // awaiting | partial | delivered (canonical item.deliveredAt)
  courier?: string; // shipment.courier
  source?: string; // manual | platform | whatsapp | facebook | instagram | offline | sslcommerz
  cod?: string; // cod | non_cod | cod_unpaid | cod_prepaid
  hasReturn?: string; // yes | no
  invoice?: string; // seller: issued | none
  dateFrom?: string; // YYYY-MM-DD (createdAt >=)
  dateTo?: string; // YYYY-MM-DD (createdAt <=, inclusive)
}

export type OrderHubFilterKey = keyof OrderHubFilters;

/** Which filter controls a role may use. */
export function filterCapabilities(viewer: OrderHubViewer): OrderHubFilterKey[] {
  const common: OrderHubFilterKey[] = [
    'region',
    'paymentMethod',
    'paymentStatus',
    'fulfillment',
    'courier',
    'source',
    'cod',
    'hasReturn',
    'dateFrom',
    'dateTo',
  ];
  return viewer.mode === 'admin'
    ? (['seller', 'brand', ...common] as OrderHubFilterKey[])
    : (['brand', ...common, 'invoice'] as OrderHubFilterKey[]);
}

export function activeFilterCount(f: OrderHubFilters): number {
  return (Object.keys(f) as OrderHubFilterKey[]).filter((k) => {
    const v = f[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
}

export const EMPTY_FILTERS: OrderHubFilters = {};

// ── URL <-> filters (survives navigate to Full Details and Back) ──────────
const URL_KEYS: Record<string, OrderHubFilterKey> = {
  sm: 'seller',
  br: 'brand',
  rg: 'region',
  pm: 'paymentMethod',
  ps: 'paymentStatus',
  ff: 'fulfillment',
  cr: 'courier',
  sc: 'source',
  cod: 'cod',
  ret: 'hasReturn',
  inv: 'invoice',
  df: 'dateFrom',
  dt: 'dateTo',
};
const KEY_TO_URL: Record<OrderHubFilterKey, string> = Object.fromEntries(
  Object.entries(URL_KEYS).map(([u, k]) => [k, u]),
) as Record<OrderHubFilterKey, string>;

export function filtersFromSearchParams(sp: URLSearchParams): { filters: OrderHubFilters; tab: string } {
  const filters: OrderHubFilters = {};
  for (const [u, k] of Object.entries(URL_KEYS)) {
    const v = sp.get(u);
    if (v != null && v !== '') (filters as Record<string, string>)[k] = v;
  }
  return { filters, tab: sp.get('tab') || 'active' };
}

export function applyFiltersToSearchParams(
  sp: URLSearchParams,
  filters: OrderHubFilters,
  tab: string,
): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const u of Object.keys(URL_KEYS)) next.delete(u);
  for (const k of Object.keys(KEY_TO_URL) as OrderHubFilterKey[]) {
    const v = filters[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') next.set(KEY_TO_URL[k], String(v));
  }
  if (tab && tab !== 'active') next.set('tab', tab);
  else next.delete('tab');
  return next;
}

// ── dictionaries (built from the loaded, role-scoped rows) ───────────────
export interface FilterOption {
  value: string;
  label: string;
}
export interface FilterDictionaries {
  sellers: FilterOption[];
  brands: FilterOption[];
  regions: FilterOption[];
  couriers: FilterOption[];
}

export function buildFilterDictionaries(
  rows: Array<{ order: OpsStorefrontOrder; ctx?: OrderHubContext }>,
  ownedBrands?: Array<{ id: string; name: string }>,
): FilterDictionaries {
  const sellers = new Map<string, string>();
  const brands = new Map<string, string>();
  const regions = new Set<string>();
  const couriers = new Set<string>();
  for (const { order, ctx } of rows) {
    for (const s of order.subOrders || []) {
      if (s.sellerId) sellers.set(s.sellerId, s.sellerBusinessName || s.sellerId);
      const bId = (s as { brandId?: string }).brandId;
      if (bId) brands.set(bId, bId);
    }
    if (order.shipping?.region) regions.add(order.shipping.region);
    if (ctx?.shipment?.courier) couriers.add(ctx.shipment.courier);
  }
  // owned-brand names win (seller mode) — and constrain the option set to owned brands
  const brandOpts = ownedBrands?.length
    ? ownedBrands.map((b) => ({ value: b.id, label: b.name }))
    : [...brands.entries()].map(([value, label]) => ({ value, label }));
  return {
    sellers: [...sellers.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    brands: brandOpts.sort((a, b) => a.label.localeCompare(b.label)),
    regions: [...regions].sort().map((r) => ({ value: r, label: r })),
    couriers: [...couriers].sort().map((c) => ({ value: c, label: c })),
  };
}

function orderSourceToken(order: OpsStorefrontOrder): string[] {
  const t: string[] = [order.isManual ? 'manual' : 'platform'];
  if (order.platformSource) t.push(order.platformSource.toLowerCase());
  if (order.paymentProvider) t.push(order.paymentProvider.toLowerCase());
  return t;
}

/**
 * AND semantics across every set control. `viewer` is used only to reject an
 * admin-only filter that a seller URL might carry (defense in depth — the
 * server is still the boundary).
 */
export function orderMatchesFilters(
  order: OpsStorefrontOrder,
  ctx: OrderHubContext | undefined,
  filters: OrderHubFilters,
  viewer: OrderHubViewer,
): boolean {
  const caps = new Set(filterCapabilities(viewer));

  if (caps.has('seller') && filters.seller) {
    if (!(order.subOrders || []).some((s) => s.sellerId === filters.seller)) return false;
  }
  if (caps.has('brand') && filters.brand) {
    if (!(order.subOrders || []).some((s) => (s as { brandId?: string }).brandId === filters.brand)) return false;
  }
  if (caps.has('region') && filters.region) {
    if ((order.shipping?.region || '') !== filters.region) return false;
  }
  if (caps.has('paymentMethod') && filters.paymentMethod) {
    if ((order.paymentMethod || '') !== filters.paymentMethod) return false;
  }
  if (caps.has('paymentStatus') && filters.paymentStatus) {
    if ((order.paymentStatus || '') !== filters.paymentStatus) return false;
  }
  if (caps.has('fulfillment') && filters.fulfillment) {
    const items = (order.subOrders || []).flatMap((s) => s.items || []);
    const delivered = items.filter((it) => Boolean(it.deliveredAt)).length;
    const ff = items.length === 0 ? 'awaiting' : delivered === 0 ? 'awaiting' : delivered === items.length ? 'delivered' : 'partial';
    if (ff !== filters.fulfillment) return false;
  }
  if (caps.has('courier') && filters.courier) {
    if ((ctx?.shipment?.courier || '') !== filters.courier) return false;
  }
  if (caps.has('source') && filters.source) {
    if (!orderSourceToken(order).includes(filters.source)) return false;
  }
  if (caps.has('cod') && filters.cod) {
    if (filters.cod === 'cod' && !order.isCOD) return false;
    if (filters.cod === 'non_cod' && order.isCOD) return false;
    if (filters.cod === 'cod_unpaid' && !isCodUnconfirmed(order)) return false;
    if (filters.cod === 'cod_prepaid' && !(order.isCOD && order.codDeliveryFeePaid)) return false;
  }
  if (caps.has('hasReturn') && filters.hasReturn) {
    const has = Boolean(ctx?.hasReturn);
    if (filters.hasReturn === 'yes' && !has) return false;
    if (filters.hasReturn === 'no' && has) return false;
  }
  if (caps.has('invoice') && filters.invoice) {
    const issued = (order.subOrders || []).some((s) => Boolean(s.invoiceId));
    if (filters.invoice === 'issued' && !issued) return false;
    if (filters.invoice === 'none' && issued) return false;
  }
  if (caps.has('dateFrom') && filters.dateFrom) {
    if (order.createdAt.slice(0, 10) < filters.dateFrom) return false;
  }
  if (caps.has('dateTo') && filters.dateTo) {
    if (order.createdAt.slice(0, 10) > filters.dateTo) return false;
  }
  return true;
}
