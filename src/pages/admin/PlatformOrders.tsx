import React, { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { operationsApi, type OpsStorefrontOrder } from '../../services/operationsApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';

export default function PlatformOrdersPage() {
  const [orders, setOrders] = useState<OpsStorefrontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await operationsApi.listOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const columns: DataTableColumn<OpsStorefrontOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => <span className="font-extrabold text-app-text-primary text-[12px]">{order.orderId}</span>,
      sortValue: (order) => order.orderId,
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">
          {order.shipping?.fullName || order.buyerId}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => (
        <span className="font-extrabold text-app-text-primary text-[12px]">
          ৳ {Number(order.overallTotal || 0).toLocaleString()}
        </span>
      ),
      sortValue: (order) => Number(order.overallTotal || 0),
    },
    {
      key: 'mode',
      header: 'Mode',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px] capitalize">
          {order.sourceMode || 'retail'}
        </span>
      ),
    },
    {
      key: 'promo',
      header: 'Promo',
      render: (order) => (
        <span className="font-semibold text-app-text-muted text-[12px]">{order.promoCode || '—'}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (order) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">
          {new Date(order.createdAt).toLocaleString()}
        </span>
      ),
      sortValue: (order) => order.createdAt,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[17px] font-extrabold text-app-text-primary tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-app-accent" />
            Platform Orders (Storefront)
          </h1>
          <p className="text-[12px] font-semibold text-app-text-secondary mt-1">
            Live orders submitted through Choosify checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-app-border bg-white text-app-text-secondary text-[11px] font-extrabold uppercase tracking-wider hover:text-app-accent transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[12px] font-semibold text-[#DC2626]">
          {error}
        </div>
      )}

      <GlassCard hoverLift={false} className="p-0 overflow-hidden">
        <DataTable
          columns={columns}
          rows={orders}
          getRowId={(order) => order.id}
          showRowNumbers={false}
          isLoading={loading}
          loadingMessage="Loading orders..."
          emptyMessage="No storefront orders yet."
        />
      </GlassCard>
    </div>
  );
}
