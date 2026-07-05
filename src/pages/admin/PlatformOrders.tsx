import React, { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { operationsApi, type OpsStorefrontOrder } from '../../services/operationsApi';

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-app-accent" />
            Platform Orders (Storefront)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live orders submitted through Choosify checkout.</p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Promo</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No storefront orders yet.</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{order.orderId}</td>
                  <td className="px-4 py-3 text-slate-600">{order.shipping?.fullName || order.buyerId}</td>
                  <td className="px-4 py-3">৳ {Number(order.overallTotal || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{order.sourceMode || 'retail'}</td>
                  <td className="px-4 py-3">{order.promoCode || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
