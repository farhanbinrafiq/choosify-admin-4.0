import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Truck,
  MessageSquare,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  operationsApi,
  type OpsStorefrontOrder,
  type OpsSubOrder,
  type OpsShipment,
  type CommerceOrderLite,
} from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  ACCENT,
  ACCENT_WASH,
  S,
  formatCurrency,
  formatDate,
  formatDay,
  lifecycleBadgeStyle,
  paymentBadgeStyle,
  paymentBadgeText,
  chipStyle,
  actionBtnStyle,
  ORDER_HUB_CSS,
  ProductIdentityLink,
  useOrderedItemThumbs,
} from './orderHubChrome';
import { Modal } from '../../components/ui/Modal';
import {
  resolveOrderHubViewer,
  orderHubStats,
  ORDER_STATUS_TABS,
  orderMatchesTab,
  tabCounts,
  orderSearchMatches,
  visibleSubOrders,
  visibleOrderValue,
  otherSellerCount,
  isMultiSeller,
  derivedFulfillment,
  buildOperationsTimeline,
  orderDetailsPath,
  conversationDeepLink,
  deriveHubStatus,
  fulfillmentStatusLabel,
  type OrderHubViewer,
  type OrderHubContext,
  type OrderHubFilters,
  type OrderHubFilterKey,
  filterCapabilities,
  activeFilterCount,
  EMPTY_FILTERS,
  filtersFromSearchParams,
  applyFiltersToSearchParams,
  buildFilterDictionaries,
  orderMatchesFilters,
  invoiceActionEligible,
} from './orderHubModel';

/**
 * Order Hub — the shared, role-aware React surface for /admin/orders (staff)
 * and /admin/platform-orders (seller). Backed ONLY by the canonical Operations
 * + Commerce APIs; the server owns every authorization decision.
 *
 * Sprint 14:
 *  - Hybrid detail UX: card body / "Quick View" → <Modal>; Order ID / "Manage"
 *    / "Open Full Details" → full <OrderDetailsPage> (router state carries the
 *    loaded row for instant paint).
 *  - Workflow tabs are the REAL operational lifecycle, not overlapping filters:
 *    a freshly placed order is "Pending" and is NOT counted in "Active Orders"
 *    (deriveHubStatus / isActiveOrder in orderHubModel). The Hub joins the
 *    Operations orders to the Commerce lifecycle + shipment + returns lists,
 *    all role-scoped by their own servers.
 *  - Role-aware Advanced Filters (one shared model, capabilities per role),
 *    AND semantics, Apply / Reset, active-count, query-string state that
 *    survives navigation to Full Details and Back. KPIs + tab counts react to
 *    the non-status filters.
 *  - Seller money: only the value attributable to its own sub-orders.
 */

type ToastState = { kind: 'success' | 'error'; message: string } | null;
type Row = { order: OpsStorefrontOrder; ctx: OrderHubContext };

// ── order card ──────────────────────────────────────────────────────────────
function OrderCard({ row, viewer, onQuickView }: { row: Row; viewer: OrderHubViewer; onQuickView: (r: Row) => void }) {
  const { order, ctx } = row;
  const subs = visibleSubOrders(order, viewer);
  const items = subs.flatMap((s) => s.items || []);
  const others = otherSellerCount(order, viewer);
  // Eligibility no longer requires a pre-existing invoiceId — regular checkout
  // sub-orders get one lazily minted server-side the first time the invoice is
  // actually opened (see orderHubModel.invoiceActionEligible + server/operations
  // /invoiceAssignment.ts). This only decides whether to SHOW the action.
  const invoiceEligible = invoiceActionEligible(order, viewer);
  const invoiceLinkSellerId = subs[0]?.sellerId;
  const value = visibleOrderValue(order, viewer);
  const fullPath = orderDetailsPath(viewer, order.orderId);
  const lc = deriveHubStatus(order, ctx);

  return (
    <div style={{ ...S.card, padding: '18px 20px' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link to={fullPath} state={{ order }} style={{ fontSize: 13.5, fontWeight: 800, color: ACCENT, textDecoration: 'none' }}>
              {order.orderId}
            </Link>
            <span style={lifecycleBadgeStyle(lc)}>{fulfillmentStatusLabel(lc, ctx.shipment)}</span>
            <span style={paymentBadgeStyle(order)}>{paymentBadgeText(order)}</span>
            {order.isCOD && <span style={chipStyle()}>COD</span>}
            {isMultiSeller(order) && <span style={chipStyle()}>Split</span>}
            {ctx.hasReturn && <span style={{ ...chipStyle(), background: 'rgba(220,38,38,0.10)', color: '#DC2626' }}>Return</span>}
            {order.isManual && <span style={chipStyle()}>{order.platformSource ? `Manual · ${order.platformSource}` : 'Manual'}</span>}
          </div>
          <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginTop: 4 }}>
            Placed {formatDate(order.createdAt)} · Updated {formatDate(order.updatedAt)}
            {ctx.shipment?.courier ? ` · ${ctx.shipment.courier}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={conversationDeepLink(order.buyerId)} style={actionBtnStyle(false)}>
            💬 Conversation
          </Link>
          <button type="button" onClick={() => onQuickView(row)} style={actionBtnStyle(false)}>
            Quick View
          </button>
          {invoiceEligible && invoiceLinkSellerId && (
            <Link to={`/admin/invoice/op/${order.orderId}/${invoiceLinkSellerId}`} style={actionBtnStyle(false)}>
              📄 Invoice
            </Link>
          )}
          <Link to={fullPath} state={{ order }} style={actionBtnStyle(true)}>
            Manage
          </Link>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => onQuickView(row)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onQuickView(row);
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, cursor: 'pointer' }}
      >
        <div>
          <div style={{ ...S.microLabel, marginBottom: 8 }}>
            {viewer.mode === 'seller' ? 'Your ordered products' : 'Ordered products'}
          </div>
          {items.length === 0 ? (
            <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>
              No line items in your scope for this order.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.slice(0, 4).map((it) => (
                <div key={it.itemId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: 'linear-gradient(135deg,#E8EDF2,#F1F3F5)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{it.productTitle}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>
                      {formatCurrency(it.price)} · Qty {it.quantity}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                      {it.productType || 'physical'}
                      {it.variantId ? ` · variant ${it.variantId}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {items.length > 4 && (
                <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 700 }}>+{items.length - 4} more item(s)</div>
              )}
            </div>
          )}
        </div>

        <div>
          <div style={{ ...S.microLabel, marginBottom: 8 }}>Receiver</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {(order.shipping?.fullName || order.buyerId || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{order.shipping?.fullName || order.buyerId}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{order.shipping?.region || '—'}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Buyer ID: {order.buyerId}</div>
            </div>
          </div>
          {order.shipping?.deliveryNotes && (
            <div style={{ marginTop: 8, ...S.inset, padding: '8px 10px', fontSize: 11, color: '#374151', fontWeight: 600 }}>
              💬 {order.shipping.deliveryNotes}
            </div>
          )}
        </div>

        <div>
          <div style={{ ...S.microLabel, marginBottom: 8 }}>Warehousing &amp; courier logistics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ctx.shipment && (
              <div style={{ ...S.inset, padding: '10px 12px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>{ctx.shipment.courier || 'Courier pending'}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginTop: 2 }}>
                  {ctx.shipment.status.toUpperCase()}
                  {ctx.shipment.trackingNumber ? ` · ${ctx.shipment.trackingNumber}` : ''}
                </div>
              </div>
            )}
            {subs.map((s, i) => (
              <div key={`${s.sellerId}-${i}`} style={{ ...S.inset, padding: '10px 12px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>{s.sellerBusinessName || s.sellerId || 'Sub-order'}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginTop: 2 }}>
                  Tracking: {(s.trackingStatus || 'pending').toUpperCase()} · Delivery fee {formatCurrency(s.deliveryFee)}
                </div>
              </div>
            ))}
            {!ctx.shipment && subs.length === 0 && (
              <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>
                No shipment handler assigned yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {(order.cancelledAt || order.cancelReason) && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F3F5' }}>
          <div style={{ ...S.microLabel, color: '#DC2626', marginBottom: 8 }}>
            {lc === 'rejected' ? 'Rejection notes' : 'Cancellation notes'}
          </div>
          <div style={{ background: '#FEF2F2', color: '#991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontWeight: 600 }}>
            {order.cancelReason || 'Order cancelled.'}
            {order.cancelledBy ? ` · by ${order.cancelledBy}` : ''}
            {order.cancelledAt ? ` · ${formatDate(order.cancelledAt)}` : ''}
          </div>
        </div>
      )}

      <div
        style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid #F1F3F5' }}
      >
        {viewer.mode === 'seller' && others > 0 && (
          <span style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 700 }}>
            Shared order · {others} other seller{others > 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>
          {viewer.mode === 'seller' ? 'Your items value' : 'Order total'}:
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{formatCurrency(value)}</span>
      </div>
    </div>
  );
}

// ── Quick View modal ────────────────────────────────────────────────────────
function QuickViewBody({
  row,
  viewer,
  loading,
  error,
  shipment,
  shipmentChecked,
  markingSubId,
  onMarkDelivered,
  onOpenFull,
}: {
  row: Row | null;
  viewer: OrderHubViewer;
  loading: boolean;
  error: string | null;
  shipment: OpsShipment | null;
  shipmentChecked: boolean;
  markingSubId: string | null;
  onMarkDelivered: (orderId: string, sub: OpsSubOrder) => void;
  onOpenFull: () => void;
}) {
  const qvThumbs = useOrderedItemThumbs(
    (row?.order.subOrders || []).flatMap((s) => s.items || []),
  );
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13, padding: '32px 0', justifyContent: 'center' }}>
        <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Loading order…
      </div>
    );
  }
  if (error || !row) {
    return (
      <div style={{ color: '#DC2626', fontSize: 12, display: 'flex', gap: 8, padding: '16px 0' }}>
        <AlertCircle style={{ width: 16, height: 16 }} /> {error || 'Order not available.'}
      </div>
    );
  }

  const { order } = row;
  const ctx: OrderHubContext = { ...row.ctx, shipment: shipment ?? row.ctx.shipment };
  const subs = visibleSubOrders(order, viewer);
  const timeline = buildOperationsTimeline(order, viewer);
  const others = otherSellerCount(order, viewer);
  const value = visibleOrderValue(order, viewer);
  const lc = deriveHubStatus(order, ctx);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={lifecycleBadgeStyle(lc)}>{fulfillmentStatusLabel(lc, ctx.shipment)}</span>
        <span style={paymentBadgeStyle(order)}>{paymentBadgeText(order)}</span>
        {order.isCOD && <span style={chipStyle()}>COD</span>}
        {isMultiSeller(order) && <span style={chipStyle()}>Split</span>}
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>
          Placed {formatDate(order.createdAt)} · Updated {formatDate(order.updatedAt)}
        </span>
      </div>

      <div style={{ ...S.inset, padding: '12px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {timeline.map((step) => (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: step.done ? ACCENT : '#E8EDF2',
                color: step.done ? '#fff' : '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {step.done ? '✓' : ''}
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: step.done ? '#111827' : '#9CA3AF' }}>{step.label}</span>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.microLabel, marginBottom: 6 }}>Customer</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{order.shipping?.fullName || order.buyerId}</div>
        <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>
          {order.shipping?.region ? `${order.shipping.region} · ` : ''}Buyer ID: {order.buyerId}
        </div>
        {order.shipping?.phone && <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>{order.shipping.phone}</div>}
      </div>

      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.microLabel, marginBottom: 8 }}>
          {viewer.mode === 'seller' ? 'Your ordered products' : 'Ordered products'}
        </div>
        {subs.flatMap((s) => s.items || []).length === 0 ? (
          <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>No line items in your scope.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {subs.map((sub, si) => {
              const items = sub.items || [];
              const undelivered = items.filter((it) => !it.deliveredAt);
              const allDelivered = items.length > 0 && undelivered.length === 0;
              const isMarking = markingSubId === sub.sellerId;
              return (
                <div key={sub.sellerId || si} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((item) => (
                    <div key={item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <ProductIdentityLink
                          size="md"
                          productId={item.productId}
                          title={item.productTitle}
                          imageUrl={qvThumbs.get(String(item.productId || ''))}
                          meta={`Qty ${item.quantity} · ${formatCurrency(item.price)} · ${sub.sellerBusinessName || 'seller'}`}
                        />
                      </div>
                      {item.deliveredAt && (
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16A34A', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle2 style={{ width: 12, height: 12 }} /> {formatDay(item.deliveredAt)}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* ONE action for the whole sub-order — items in a sub-order
                      ship together (one seller, one parcel). */}
                  {!allDelivered && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={isMarking}
                        onClick={() => onMarkDelivered(order.orderId, sub)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#16A34A',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: 9.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: isMarking ? 'not-allowed' : 'pointer',
                          opacity: isMarking ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isMarking ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <CheckCircle2 style={{ width: 11, height: 11 }} />}
                        Mark Delivered
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...S.inset, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>
          {viewer.mode === 'seller' ? 'Your items value' : 'Order total'}
          {viewer.mode === 'seller' && others > 0 ? ` · shared with ${others} other seller${others > 1 ? 's' : ''}` : ''}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{formatCurrency(value)}</span>
      </div>

      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.microLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Truck style={{ width: 12, height: 12 }} /> Shipment
        </div>
        {!shipmentChecked && !row.ctx.shipment && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Checking shipment…</div>}
        {shipmentChecked && !ctx.shipment && <div style={{ fontSize: 11, color: '#9CA3AF' }}>No shipment record yet.</div>}
        {ctx.shipment && (
          <div style={{ fontSize: 11.5, color: '#374151', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              Courier: <b>{ctx.shipment.courier || '—'}</b> · Tracking #: <b>{ctx.shipment.trackingNumber || '—'}</b>
            </div>
            <div>
              State: <b style={{ textTransform: 'uppercase' }}>{ctx.shipment.status}</b>
            </div>
          </div>
        )}
        <div style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600, marginTop: 6 }}>
          Lifecycle transitions, courier / tracking edits and checkpoint history live in Full Details.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link to={conversationDeepLink(order.buyerId)} style={actionBtnStyle(false)}>
          <MessageSquare style={{ width: 13, height: 13 }} /> Conversation
        </Link>
        <Link to="/admin/logistics/shipments" style={actionBtnStyle(false)}>
          <Truck style={{ width: 13, height: 13 }} /> Fulfillment
        </Link>
        <button type="button" onClick={onOpenFull} style={{ ...actionBtnStyle(true), marginLeft: 'auto', fontSize: 11.5, padding: '9px 16px' }}>
          Open Full Details <ArrowRight style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}

// ── advanced filter panel ───────────────────────────────────────────────────
const SELECT_OPTIONS: Partial<Record<OrderHubFilterKey, Array<{ value: string; label: string }>>> = {
  paymentMethod: [
    { value: 'cod', label: 'Cash on delivery' },
    { value: 'online', label: 'Online' },
    { value: 'credit', label: 'Credit' },
  ],
  paymentStatus: [
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  fulfillment: [
    { value: 'awaiting', label: 'Awaiting delivery' },
    { value: 'partial', label: 'Partially delivered' },
    { value: 'delivered', label: 'All delivered' },
  ],
  source: [
    { value: 'platform', label: 'Platform checkout' },
    { value: 'manual', label: 'Manual order' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'offline', label: 'Offline' },
    { value: 'sslcommerz', label: 'SSLCommerz' },
  ],
  cod: [
    { value: 'cod', label: 'COD orders' },
    { value: 'non_cod', label: 'Non-COD orders' },
    { value: 'cod_unpaid', label: 'COD — unconfirmed' },
    { value: 'cod_prepaid', label: 'COD — delivery prepaid' },
  ],
  hasReturn: [
    { value: 'yes', label: 'Has a return' },
    { value: 'no', label: 'No return' },
  ],
  invoice: [
    { value: 'issued', label: 'Invoice issued' },
    { value: 'none', label: 'No invoice' },
  ],
};

const FILTER_LABELS: Record<OrderHubFilterKey, string> = {
  seller: 'Seller / merchant',
  brand: 'Brand',
  region: 'BD division / region',
  paymentMethod: 'Payment method',
  paymentStatus: 'Payment status',
  fulfillment: 'Fulfillment state',
  courier: 'Courier',
  source: 'Order source / gateway',
  cod: 'COD state',
  hasReturn: 'Returns / issues',
  invoice: 'Invoice status',
  dateFrom: 'Logged from',
  dateTo: 'Logged to',
};

function FilterField({
  fkey,
  value,
  onChange,
  dictionaries,
}: {
  fkey: OrderHubFilterKey;
  value: string;
  onChange: (v: string) => void;
  dictionaries: ReturnType<typeof buildFilterDictionaries>;
}) {
  const label = <div style={{ ...S.microLabel, marginBottom: 5 }}>{FILTER_LABELS[fkey]}</div>;
  const selStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: 34,
    borderRadius: 7,
    border: '1px solid #E8EDF2',
    padding: '0 8px',
    fontSize: 11,
    color: '#111827',
    background: '#fff',
  };
  if (fkey === 'dateFrom' || fkey === 'dateTo') {
    return (
      <div>
        {label}
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={selStyle} />
      </div>
    );
  }
  let opts: Array<{ value: string; label: string }> = SELECT_OPTIONS[fkey] || [];
  if (fkey === 'seller') opts = dictionaries.sellers;
  if (fkey === 'brand') opts = dictionaries.brands;
  if (fkey === 'region') opts = dictionaries.regions;
  if (fkey === 'courier') opts = dictionaries.couriers;
  return (
    <div>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selStyle}>
        <option value="">Any</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PlatformOrdersPage() {
  const { profile, allBrands } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewer = useMemo(() => resolveOrderHubViewer(profile), [profile]);

  const { filters: urlFilters, tab: urlTab } = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState<OrderHubFilters>(urlFilters);
  const [panelOpen, setPanelOpen] = useState(activeFilterCount(urlFilters) > 0);
  useEffect(() => {
    setDraftFilters(urlFilters);
  }, [urlFilters]);

  const setTab = (tab: string) => setSearchParams(applyFiltersToSearchParams(searchParams, urlFilters, tab), { replace: false });
  const applyFilters = () => {
    setSearchParams(applyFiltersToSearchParams(searchParams, draftFilters, urlTab), { replace: false });
  };
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setSearchParams(applyFiltersToSearchParams(searchParams, EMPTY_FILTERS, urlTab), { replace: false });
  };

  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [commerceByNumber, setCommerceByNumber] = useState<Map<string, CommerceOrderLite>>(new Map());
  const [shipmentByOrder, setShipmentByOrder] = useState<Map<string, OpsShipment>>(new Map());
  const [returnOrderIds, setReturnOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [qvShipment, setQvShipment] = useState<OpsShipment | null>(null);
  const [qvShipmentChecked, setQvShipmentChecked] = useState(false);
  const [markingSubId, setMarkingSubId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [opsR, commerceR, shipR, retR] = await Promise.allSettled([
      operationsApi.listOrders(),
      operationsApi.listCommerceOrders(viewer.mode),
      operationsApi.listShipments(),
      operationsApi.listReturns(
        viewer.mode === 'seller' && viewer.sellerId ? { sellerId: viewer.sellerId } : undefined,
      ),
    ]);
    if (opsR.status === 'fulfilled') setOrders(opsR.value);
    else setError(opsR.reason instanceof Error ? opsR.reason.message : 'Failed to load orders');

    if (commerceR.status === 'fulfilled') {
      const m = new Map<string, CommerceOrderLite>();
      for (const c of commerceR.value) if (c.orderNumber) m.set(c.orderNumber, c);
      setCommerceByNumber(m);
    }
    if (shipR.status === 'fulfilled') {
      const m = new Map<string, OpsShipment>();
      for (const s of shipR.value) if (s.orderId) m.set(s.orderId, s);
      setShipmentByOrder(m);
    }
    if (retR.status === 'fulfilled') setReturnOrderIds(new Set(retR.value.map((r) => r.orderId)));
    setLoading(false);
  }, [viewer.mode, viewer.sellerId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows: Row[] = useMemo(
    () =>
      orders.map((order) => ({
        order,
        ctx: {
          commerce: commerceByNumber.get(order.orderId) ?? null,
          shipment: shipmentByOrder.get(order.orderId) ?? null,
          hasReturn: returnOrderIds.has(order.orderId),
        },
      })),
    [orders, commerceByNumber, shipmentByOrder, returnOrderIds],
  );

  const ownedBrands = useMemo(
    () => (allBrands || []).map((b) => ({ id: b.id, name: b.name })),
    [allBrands],
  );
  const dictionaries = useMemo(
    () => buildFilterDictionaries(rows, viewer.mode === 'seller' ? ownedBrands : undefined),
    [rows, viewer.mode, ownedBrands],
  );

  // narrowed by the non-status advanced filters → KPIs + tab counts + list base
  const narrowed = useMemo(
    () => rows.filter((r) => orderMatchesFilters(r.order, r.ctx, urlFilters, viewer)),
    [rows, urlFilters, viewer],
  );
  const stats = useMemo(() => orderHubStats(narrowed), [narrowed]);
  const counts = useMemo(() => tabCounts(narrowed), [narrowed]);
  const visible = useMemo(
    () =>
      narrowed
        .filter((r) => orderMatchesTab(r.order, urlTab, r.ctx))
        .filter((r) => orderSearchMatches(r.order, search, viewer)),
    [narrowed, urlTab, search, viewer],
  );

  const caps = useMemo(() => filterCapabilities(viewer), [viewer]);
  const appliedCount = activeFilterCount(urlFilters);
  const dirty = JSON.stringify(draftFilters) !== JSON.stringify(urlFilters);

  const closeModal = useCallback(() => {
    setSelected(null);
    setDetailError(null);
    setQvShipment(null);
    setQvShipmentChecked(false);
  }, []);

  const openQuickView = (row: Row) => {
    setSelected(row);
    setDetailLoading(false);
    setDetailError(null);
    setQvShipment(row.ctx.shipment ?? null);
    setQvShipmentChecked(Boolean(row.ctx.shipment));
    // background: freshen order + shipment
    void operationsApi
      .getOrder(row.order.orderId)
      .then((fresh) => setSelected((cur) => (cur && cur.order.orderId === fresh.orderId ? { ...cur, order: fresh } : cur)))
      .catch(() => {});
    if (!row.ctx.shipment) {
      void operationsApi
        .getShipment(row.order.orderId)
        .then((s) => setQvShipment(s))
        .catch(() => setQvShipment(null))
        .finally(() => setQvShipmentChecked(true));
    }
  };

  // ONE control per sub-order — see OrderDetails.tsx's handleMarkSubOrderDelivered.
  const handleMarkDelivered = async (orderId: string, sub: OpsSubOrder) => {
    const undelivered = (sub.items || []).filter((it) => !it.deliveredAt);
    if (undelivered.length === 0) return;
    setMarkingSubId(sub.sellerId);
    try {
      let updated: OpsStorefrontOrder | null = null;
      for (const it of undelivered) {
        updated = await operationsApi.markOrderItemDelivered(orderId, it.itemId);
      }
      if (updated) {
        setOrders((prev) => prev.map((o) => (o.orderId === updated!.orderId ? updated! : o)));
        setSelected((cur) => (cur && cur.order.orderId === updated!.orderId ? { ...cur, order: updated! } : cur));
      }
      showToast('success', undelivered.length > 1 ? 'Items marked delivered.' : 'Item marked delivered.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark delivered');
    } finally {
      setMarkingSubId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{ORDER_HUB_CSS}</style>
      {/* operational header */}
      <div
        style={{ ...S.card, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{ width: 38, height: 38, borderRadius: 10, background: ACCENT_WASH, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}
          >
            ☰
          </div>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#111827' }}>Order Hub</div>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>
              {viewer.mode === 'seller'
                ? 'Orders and fulfillment for your business — real workflow lifecycle, courier tracking, customer handoff.'
                : 'Platform-wide operational order management — real lifecycle queue, logistics, and history.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {stats.map((st) => (
            <div key={st.key} style={{ border: '1px solid #E8EDF2', borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 92 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em' }}>{st.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: st.color }}>{st.value}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void loadAll()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              border: '1px solid #E8EDF2',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
          </button>
        </div>
      </div>

      {/* workflow status strip */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', overflowX: 'auto' }}>
        {ORDER_STATUS_TABS.map((t, i) => {
          const active = t.key === urlTab;
          return (
            <React.Fragment key={t.key}>
              {(i === 1 || t.key === 'all') && <div style={{ width: 1, alignSelf: 'stretch', background: '#E8EDF2', flex: '0 0 auto' }} />}
              <button
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  borderRadius: 7,
                  padding: '7px 12px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: active ? ACCENT : '#F9FAFB',
                  color: active ? '#fff' : '#374151',
                }}
              >
                <span>{t.icon}</span>
                {t.label}
                <span style={{ color: active ? 'rgba(255,255,255,0.85)' : '#9CA3AF' }}>{counts[t.key] ?? 0}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* search + advanced filter toggle */}
      <div style={{ ...S.card, display: 'flex', gap: 10, padding: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9CA3AF' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within results — Order ID, customer, phone, seller, invoice, product…"
            style={{ ...S.input, width: '100%', paddingLeft: 34 }}
          />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: appliedCount > 0 ? ACCENT_WASH : '#fff',
            border: `1px solid ${appliedCount > 0 ? 'color-mix(in srgb, var(--cms-accent) 35%, transparent)' : '#E8EDF2'}`,
            color: appliedCount > 0 ? '#C2410C' : '#374151',
            borderRadius: 8,
            padding: '9px 14px',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <SlidersHorizontal style={{ width: 13, height: 13 }} /> Advanced Filters ({appliedCount})
        </button>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em' }}>{visible.length} SHOWN</span>
      </div>

      {/* advanced filter panel */}
      {panelOpen && (
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, letterSpacing: '0.03em' }}>
              ADVANCED ORDER FILTERS{viewer.mode === 'seller' ? ' — YOUR BUSINESS' : ' — PLATFORM'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={resetFilters}
                style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 14px', fontSize: 10.5, fontWeight: 800, color: '#374151', cursor: 'pointer' }}
              >
                RESET FILTERS
              </button>
              <button
                type="button"
                onClick={applyFilters}
                disabled={!dirty}
                style={{
                  background: dirty ? ACCENT : '#E8EDF2',
                  color: dirty ? '#fff' : '#9CA3AF',
                  border: 'none',
                  borderRadius: 7,
                  padding: '7px 16px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: dirty ? 'pointer' : 'not-allowed',
                }}
              >
                APPLY FILTERS
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 14px' }}>
            {caps.map((fkey) => (
              <FilterField
                key={fkey}
                fkey={fkey}
                value={(draftFilters[fkey] as string) || ''}
                onChange={(v) => setDraftFilters((f) => ({ ...f, [fkey]: v || undefined }))}
                dictionaries={dictionaries}
              />
            ))}
          </div>
          {appliedCount > 0 && (
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 10 }}>
              {appliedCount} filter{appliedCount > 1 ? 's' : ''} applied · KPIs and tab counts reflect the filtered set ·
              status tabs still switch freely · search runs inside the result.
            </div>
          )}
        </div>
      )}

      {/* list */}
      {loading && (
        <div style={{ ...S.card, padding: 16, fontSize: 12, color: '#9CA3AF', display: 'flex', gap: 8 }}>
          <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Loading orders…
        </div>
      )}
      {error && (
        <div style={{ ...S.card, padding: 16, fontSize: 12, color: '#DC2626', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle style={{ width: 16, height: 16 }} /> {error}
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div style={{ ...S.card, padding: 32, fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontWeight: 600 }}>
          {appliedCount > 0 || search
            ? 'No orders match this view. Adjust the filters, tab, or search.'
            : viewer.mode === 'seller'
              ? 'No orders for your business yet.'
              : 'No Operations orders found.'}
        </div>
      )}
      {!loading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visible.map((r) => (
            <OrderCard key={r.order.orderId} row={r} viewer={viewer} onQuickView={openQuickView} />
          ))}
        </div>
      )}

      {/* Quick View modal */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={closeModal}
        title={selected ? `Quick View · ${selected.order.orderId}` : undefined}
        maxWidth="max-w-2xl"
      >
        <QuickViewBody
          row={selected}
          viewer={viewer}
          loading={detailLoading}
          error={detailError}
          shipment={qvShipment}
          shipmentChecked={qvShipmentChecked}
          markingSubId={markingSubId}
          onMarkDelivered={handleMarkDelivered}
          onOpenFull={() => {
            if (selected) {
              const path = orderDetailsPath(viewer, selected.order.orderId);
              const row = selected.order;
              closeModal();
              navigate(path, { state: { order: row } });
            }
          }}
        />
      </Modal>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 600,
            color: '#fff',
            background: toast.kind === 'success' ? '#16A34A' : '#DC2626',
          }}
        >
          {toast.kind === 'success' ? <CheckCircle2 style={{ width: 18, height: 18 }} /> : <AlertCircle style={{ width: 18, height: 18 }} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
