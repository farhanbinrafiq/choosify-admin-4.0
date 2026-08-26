import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Truck,
  MessageSquare,
} from 'lucide-react';
import { operationsApi, type OpsStorefrontOrder, type OpsShipment } from '../../services/operationsApi';
import type { ReturnRequest } from '../../contexts/ReturnsContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';

/**
 * Admin platform Order hub — real Operations order engine (Sprint 11 rewrite).
 * Previously this screen read from the legacy, effectively-dead Commerce
 * engine (5 synthetic orders, no real customers) via commerceApi. It now
 * reads/actions the canonical Operations orders that every real Choosify-Web
 * checkout and booking actually creates (server/operationsRouter.ts,
 * server/operations/operationsStore.ts).
 */

const CHOOSIFY_WEB_URL = 'https://choosify.bd';

type ToastState = { kind: 'success' | 'error'; message: string } | null;

function formatCurrency(n?: number): string {
  return `৳ ${Number(n || 0).toLocaleString()}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function sellerNamesLabel(order: OpsStorefrontOrder): string {
  const names = (order.subOrders || [])
    .map((s) => s.sellerBusinessName || s.sellerId)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return '—';
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'confirmed':
    case 'active':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending_payment':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export default function PlatformOrdersPage() {
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<OpsStorefrontOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [shipment, setShipment] = useState<OpsShipment | null>(null);
  const [shipmentChecked, setShipmentChecked] = useState(false);

  const [linkedReturns, setLinkedReturns] = useState<ReturnRequest[]>([]);

  const [markingItemId, setMarkingItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await operationsApi.listOrders();
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) => o.orderId.toLowerCase().includes(q) || (o.buyerId || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  const closeModal = useCallback(() => {
    setSelectedOrderId(null);
    setDetailOrder(null);
    setDetailError(null);
    setShipment(null);
    setShipmentChecked(false);
    setLinkedReturns([]);
  }, []);

  const loadDetail = useCallback(async (orderId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setShipment(null);
    setShipmentChecked(false);
    setLinkedReturns([]);

    let order: OpsStorefrontOrder;
    try {
      order = await operationsApi.getOrder(orderId);
      setDetailOrder(order);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load order');
      setDetailLoading(false);
      return;
    }
    setDetailLoading(false);

    // A 404/error here just means no shipment exists yet — not a real error state.
    try {
      const found = await operationsApi.getShipment(orderId);
      setShipment(found);
    } catch {
      setShipment(null);
    } finally {
      setShipmentChecked(true);
    }

    // No orderId filter on the returns endpoint — staff sees everything, filter client-side.
    try {
      const all = await operationsApi.listReturns();
      setLinkedReturns(all.filter((r) => r.orderId === order.orderId));
    } catch {
      setLinkedReturns([]);
    }
  }, []);

  const openOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    void loadDetail(orderId);
  };

  const handleMarkDelivered = async (orderId: string, itemId: string) => {
    setMarkingItemId(itemId);
    try {
      const updated = await operationsApi.markOrderItemDelivered(orderId, itemId);
      setDetailOrder(updated);
      setOrders((prev) => prev.map((o) => (o.orderId === updated.orderId ? updated : o)));
      showToast('success', 'Item marked delivered.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark item delivered');
    } finally {
      setMarkingItemId(null);
    }
  };

  const columns: DataTableColumn<OpsStorefrontOrder>[] = [
    {
      key: 'order',
      header: 'Order ID',
      render: (order) => (
        <button
          type="button"
          onClick={() => openOrder(order.orderId)}
          className="font-extrabold text-app-accent text-[12px] hover:underline cursor-pointer"
        >
          {order.orderId}
        </button>
      ),
      sortValue: (order) => order.orderId,
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (order) => (
        <div>
          <div className="font-semibold text-app-text-secondary text-[12px]">
            {order.shipping?.fullName || order.buyerId}
          </div>
          {order.shipping?.fullName && (
            <div className="text-[10px] text-app-text-muted">{order.buyerId}</div>
          )}
        </div>
      ),
      sortValue: (order) => order.buyerId,
    },
    {
      key: 'sellers',
      header: 'Seller(s)',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">{sellerNamesLabel(order)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => (
        <span className="font-extrabold text-app-text-primary text-[12px]">
          {formatCurrency(order.overallTotal)}
        </span>
      ),
      sortValue: (order) => Number(order.overallTotal || 0),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(order.status)}`}
        >
          {order.status.replace('_', ' ')}
        </span>
      ),
      sortValue: (order) => order.status,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (order) => (
        <div>
          <div className="font-semibold text-app-text-secondary text-[12px] capitalize">
            {order.paymentMethod || '—'}
          </div>
          <div className="text-[10px] text-app-text-muted capitalize">{order.paymentStatus || '—'}</div>
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">{formatDate(order.createdAt)}</span>
      ),
      sortValue: (order) => order.createdAt,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-app-accent/10 border border-app-accent/20">
            <Package className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight">Platform Orders</h1>
            <p className="text-xs text-app-text-secondary">
              Live Operations order engine — the platform's real order data
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-app-border text-[10px] font-black uppercase tracking-wider text-app-text-secondary hover:text-app-text-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <GlassCard className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID or Buyer ID…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-app-border text-[12px] text-app-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-app-accent/30"
          />
        </div>
      </GlassCard>

      <GlassCard>
        {loading && <p className="text-xs text-app-text-muted p-4">Loading orders…</p>}
        {error && (
          <p className="text-xs text-rose-500 p-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={filteredOrders}
            getRowId={(o) => o.orderId}
            emptyMessage="No Operations orders found."
          />
        )}
      </GlassCard>

      <Modal
        isOpen={Boolean(selectedOrderId)}
        onClose={closeModal}
        title={selectedOrderId ? `Order ${selectedOrderId}` : undefined}
        maxWidth="max-w-3xl"
      >
        {detailLoading && (
          <div className="flex items-center gap-2 text-app-text-muted text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading order…
          </div>
        )}
        {detailError && (
          <p className="text-xs text-rose-500 flex items-center gap-2 py-4">
            <AlertCircle className="w-4 h-4" /> {detailError}
          </p>
        )}
        {!detailLoading && !detailError && detailOrder && (
          <div className="space-y-6">
            {/* Header / status */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-block px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(detailOrder.status)}`}
              >
                {detailOrder.status.replace('_', ' ')}
              </span>
              <span className="text-[11px] text-app-text-muted">Created {formatDate(detailOrder.createdAt)}</span>
              <span className="text-[11px] text-app-text-muted">Updated {formatDate(detailOrder.updatedAt)}</span>
            </div>

            {(detailOrder.cancelledAt || detailOrder.cancelReason) && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700">
                <div className="font-bold uppercase tracking-wide text-[10px] mb-1">Cancellation</div>
                <div>Cancelled at: {formatDate(detailOrder.cancelledAt)}</div>
                {detailOrder.cancelledBy && <div>Cancelled by: {detailOrder.cancelledBy}</div>}
                {detailOrder.cancelReason && <div>Reason: {detailOrder.cancelReason}</div>}
              </div>
            )}

            {/* Buyer */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2">Buyer</div>
              <GlassCard hoverLift={false} className="p-3 text-[12px] space-y-1">
                <div>
                  <span className="text-app-text-muted">Buyer ID: </span>
                  <span className="font-semibold text-app-text-primary">{detailOrder.buyerId}</span>
                </div>
                {detailOrder.shipping && (
                  <>
                    <div>
                      <span className="text-app-text-muted">Name: </span>
                      <span className="font-semibold text-app-text-primary">{detailOrder.shipping.fullName}</span>
                    </div>
                    <div>
                      <span className="text-app-text-muted">Phone: </span>
                      <span className="font-semibold text-app-text-primary">{detailOrder.shipping.phone}</span>
                    </div>
                    <div>
                      <span className="text-app-text-muted">Address: </span>
                      <span className="font-semibold text-app-text-primary">
                        {detailOrder.shipping.address}, {detailOrder.shipping.region}
                      </span>
                    </div>
                    {detailOrder.shipping.deliveryNotes && (
                      <div>
                        <span className="text-app-text-muted">Notes: </span>
                        <span className="font-semibold text-app-text-primary">
                          {detailOrder.shipping.deliveryNotes}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="pt-1">
                  <a
                    href={`${CHOOSIFY_WEB_URL}/messages/conv_platform_${encodeURIComponent(detailOrder.buyerId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-app-accent font-bold text-[11px] hover:underline"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> View conversation
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </GlassCard>
            </div>

            {/* Sub-orders / items */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2">
                Sub-orders
              </div>
              <div className="space-y-3">
                {(detailOrder.subOrders || []).map((sub, subIdx) => (
                  <GlassCard hoverLift={false} key={`${sub.sellerId}-${subIdx}`} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-[12px] text-app-text-primary">
                        {sub.sellerBusinessName || sub.sellerId}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-app-text-muted">
                        {sub.invoiceId && <span>Invoice: {sub.invoiceId}</span>}
                        <span>Delivery fee: {formatCurrency(sub.deliveryFee)}</span>
                        <span className="uppercase font-bold">{sub.trackingStatus || 'pending'}</span>
                      </div>
                    </div>
                    <div className="divide-y divide-app-border">
                      {(sub.items || []).map((item) => {
                        const isDelivered = Boolean(item.deliveredAt);
                        const isMarking = markingItemId === item.itemId;
                        return (
                          <div
                            key={item.itemId}
                            className="py-2 flex flex-wrap items-center justify-between gap-2 text-[12px]"
                          >
                            <div>
                              <div className="font-semibold text-app-text-primary">{item.productTitle}</div>
                              <div className="text-[10px] text-app-text-muted">
                                Qty {item.quantity} · {formatCurrency(item.price)} ·{' '}
                                {item.productType || 'physical'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isDelivered ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-bold uppercase">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Delivered {formatDate(item.deliveredAt)}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isMarking}
                                  onClick={() => void handleMarkDelivered(detailOrder.orderId, item.itemId)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-app-accent text-white text-[10px] font-bold uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  {isMarking ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  Mark Delivered
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* Payment */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2">Payment</div>
              <GlassCard hoverLift={false} className="p-3 text-[12px] space-y-1">
                <div>
                  <span className="text-app-text-muted">Method: </span>
                  <span className="font-semibold text-app-text-primary capitalize">
                    {detailOrder.paymentMethod || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-app-text-muted">Status: </span>
                  <span className="font-semibold text-app-text-primary capitalize">
                    {detailOrder.paymentStatus || '—'}
                  </span>
                </div>
                {typeof detailOrder.paidAmount === 'number' && (
                  <div>
                    <span className="text-app-text-muted">Paid amount: </span>
                    <span className="font-semibold text-app-text-primary">
                      {formatCurrency(detailOrder.paidAmount)}
                    </span>
                  </div>
                )}
                {detailOrder.paidAt && (
                  <div>
                    <span className="text-app-text-muted">Paid at: </span>
                    <span className="font-semibold text-app-text-primary">{formatDate(detailOrder.paidAt)}</span>
                  </div>
                )}
                {detailOrder.paymentDueAt && !detailOrder.paidAt && (
                  <div>
                    <span className="text-app-text-muted">Payment due: </span>
                    <span className="font-semibold text-app-text-primary">
                      {formatDate(detailOrder.paymentDueAt)}
                    </span>
                  </div>
                )}
                <div className="pt-1 font-extrabold text-app-text-primary">
                  Total: {formatCurrency(detailOrder.overallTotal)}
                </div>
              </GlassCard>
            </div>

            {/* Shipment / tracking */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Shipment
              </div>
              <GlassCard hoverLift={false} className="p-3 text-[12px] space-y-2">
                {!shipmentChecked && (
                  <div className="flex items-center gap-2 text-app-text-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking shipment…
                  </div>
                )}
                {shipmentChecked && !shipment && (
                  <div className="text-app-text-muted">No shipment record.</div>
                )}
                {shipmentChecked && shipment && (
                  <>
                    <div>
                      <span className="text-app-text-muted">Courier: </span>
                      <span className="font-semibold text-app-text-primary">{shipment.courier || '—'}</span>
                    </div>
                    <div>
                      <span className="text-app-text-muted">Tracking #: </span>
                      <span className="font-semibold text-app-text-primary">{shipment.trackingNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-app-text-muted">Status: </span>
                      <span className="font-semibold text-app-text-primary uppercase">{shipment.status}</span>
                    </div>
                    {shipment.trackingEvents && shipment.trackingEvents.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted mb-1">
                          Checkpoint history
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                          {shipment.trackingEvents.map((ev) => (
                            <div key={ev.id} className="flex justify-between gap-2 text-[11px]">
                              <span className="text-app-text-primary font-semibold">{ev.description}</span>
                              <span className="text-app-text-muted whitespace-nowrap">{formatDate(ev.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </GlassCard>
            </div>

            {/* Linked returns */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2">
                Linked returns
              </div>
              <GlassCard hoverLift={false} className="p-3 text-[12px] space-y-2">
                {linkedReturns.length === 0 ? (
                  <div className="text-app-text-muted">No return requests for this order.</div>
                ) : (
                  <div className="space-y-1.5">
                    {linkedReturns.map((r) => (
                      <div key={r.id} className="flex justify-between gap-2">
                        <span className="font-semibold text-app-text-primary capitalize">
                          {r.reason.replace(/_/g, ' ')}
                        </span>
                        <span className="uppercase font-bold text-app-text-muted">{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  to="/admin/returns"
                  className="inline-flex items-center gap-1.5 text-app-accent font-bold text-[11px] hover:underline"
                >
                  Go to Returns &amp; Refunds <ExternalLink className="w-3 h-3" />
                </Link>
              </GlassCard>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2 z-[600] text-white ${
            toast.kind === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-white" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
