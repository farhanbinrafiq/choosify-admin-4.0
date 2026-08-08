import React, { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { commerceApi } from '../../services/commerceApi';
import { getAuthToken, mapCommerceOrderToUi, type CommerceOrderDto } from '../../lib/commerceOrderAdapter';
import { GlassCard } from '../../components/ui/GlassCard';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import type { Order } from '../../contexts/OrdersContext';

/**
 * Admin platform Order list — Commerce Order API (Sprint 6 wiring).
 * Layout unchanged from prior PlatformOrders table.
 */
export default function PlatformOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required');
        setOrders([]);
        return;
      }
      const res = await commerceApi.listOrders(token);
      if (!res.ok) {
        setError((res.body as { error?: string })?.error || `Failed (${res.status})`);
        setOrders([]);
        return;
      }
      const rows = ((res.body as { data?: CommerceOrderDto[] }).data || []).map((r) =>
        mapCommerceOrderToUi(r),
      );
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const columns: DataTableColumn<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => <span className="font-extrabold text-app-text-primary text-[12px]">{order.id}</span>,
      sortValue: (order) => order.id,
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">
          {order.customer.name || order.customer.id}
        </span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">{order.product.brand}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => (
        <span className="font-extrabold text-app-text-primary text-[12px]">
          ৳ {Number(order.total_payable || order.earnings.totalRevenue || 0).toLocaleString()}
        </span>
      ),
      sortValue: (order) => Number(order.total_payable || 0),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">{order.status}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (order) => (
        <span className="font-semibold text-app-text-muted text-[12px]">
          {order.platformSource || order.commerceSource || 'checkout'}
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (order) => (
        <span className="font-semibold text-app-text-muted text-[12px]">{order.paymentStatus}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">
          {new Date(order.timestamp).toLocaleString()}
        </span>
      ),
      sortValue: (order) => order.timestamp,
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
            <p className="text-xs text-app-text-secondary">Commerce Order source of truth</p>
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

      <GlassCard>
        {loading && <p className="text-xs text-app-text-muted p-4">Loading…</p>}
        {error && <p className="text-xs text-rose-400 p-4">{error}</p>}
        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={orders}
            getRowId={(o) => o.id}
            emptyMessage="No platform Commerce Orders yet."
          />
        )}
      </GlassCard>
    </div>
  );
}
