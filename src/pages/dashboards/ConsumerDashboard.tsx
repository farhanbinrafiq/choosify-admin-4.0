import React from 'react';
import {
  ShoppingBag,
  Heart,
  Zap,
  MapPin,
  ChevronRight,
  Star,
  Clock,
  Tag,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { useOrders } from '../../contexts/OrdersContext';
import { useAuth } from '../../contexts/AuthContext';

export default function ConsumerDashboard() {
  const { orders, cancelOrder, ordersLoading, ordersError, refreshOrders, commerceAuthoritative } =
    useOrders();
  const { profile } = useAuth();
  const customerOrders = orders.filter(
    (o) => profile?.id && o.customer.id === profile.id,
  );

  // Group by checkoutId for unified history without collapsing Brand statuses
  const byCheckout = customerOrders.reduce<Record<string, typeof customerOrders>>((acc, o) => {
    const key = o.checkoutId || o.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">
            Assalamu Alaikum{profile?.displayName ? `, ${profile.displayName}` : ''}!
          </h1>
          <p className="text-sm font-semibold text-app-text-primary">
            Choosify User ID{' '}
            <span className="font-mono tracking-wide">{profile?.choosifyUserId || '—'}</span>
          </p>
          <p className="text-sm text-app-text-secondary">
            Explore your handpicked deals and order status today.
          </p>
          {ordersLoading && (
            <p className="text-[10px] text-app-text-muted font-mono uppercase">Loading orders…</p>
          )}
          {ordersError && (
            <p className="text-[10px] text-rose-400">
              {ordersError}{' '}
              <button type="button" className="underline" onClick={() => void refreshOrders()}>
                Retry
              </button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-app-accent/10 border border-app-accent/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-2.5 bg-app-accent rounded-xl">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] text-app-accent-light font-bold uppercase tracking-widest">
                Choosify Points
              </div>
              <div className="text-lg font-bold text-app-text-primary">2,450</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-app-text-primary tracking-tight flex items-center gap-3">
                <Clock className="w-5 h-5 text-app-accent-light" /> Track My Orders
              </h3>
              <button
                type="button"
                onClick={() => void refreshOrders()}
                className="text-[10px] font-bold text-app-text-secondary uppercase hover:text-white transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-6">
              {commerceAuthoritative && customerOrders.length === 0 && !ordersLoading && (
                <p className="text-sm text-app-text-muted">No orders yet.</p>
              )}
              {Object.entries(byCheckout).map(([checkoutId, group]) => (
                <div key={checkoutId} className="space-y-3">
                  {group.length > 1 && (
                    <div className="text-[10px] font-mono text-app-text-muted uppercase tracking-wider">
                      Checkout {checkoutId}
                    </div>
                  )}
                  {group.map((order) => {
                    const statusMap: Record<string, { width: string; color: string; eta: string }> = {
                      Pending: { width: '15%', color: 'bg-amber-500', eta: 'Awaiting Merchant Confirmation' },
                      Confirmed: { width: '40%', color: 'bg-blue-500', eta: 'Approved & Packing' },
                      Processing: { width: '50%', color: 'bg-sky-500', eta: 'Packed' },
                      Dispatched: { width: '60%', color: 'bg-indigo-500', eta: 'Handed to Delivery Courier' },
                      'In Transit': { width: '80%', color: 'bg-purple-500', eta: 'Out for dispatch today' },
                      Delivered: { width: '100%', color: 'bg-emerald-500', eta: 'Concluded item delivery' },
                      Cancelled: { width: '100%', color: 'bg-rose-500', eta: 'Order request voided' },
                    };
                    const currentConfig = statusMap[order.status] || {
                      width: '20%',
                      color: 'bg-amber-500',
                      eta: 'Processing',
                    };
                    return (
                      <div
                        key={order.id}
                        className="group p-6 bg-app-bg border border-app-border rounded-2xl flex flex-col md:flex-row gap-6 hover:border-app-accent/30 transition-all"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-app-border bg-black/40">
                          {order.product.image ? (
                            <img
                              src={order.product.image}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              alt=""
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-app-text-muted text-[10px]">
                              {order.product.brand}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div>
                              <div className="text-sm font-bold text-app-text-primary mb-0.5">
                                {order.product.name}
                              </div>
                              <div className="text-[10px] text-app-text-secondary font-mono uppercase tracking-tighter">
                                Order {order.id} · {order.product.brand}
                              </div>
                            </div>
                            <div className="text-right flex flex-col gap-2 items-end">
                              <span
                                className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                                  order.status === 'Delivered'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : order.status === 'Cancelled'
                                      ? 'bg-rose-500/10 text-rose-400'
                                      : 'bg-app-accent/10 text-app-accent-light'
                                }`}
                              >
                                {order.status}
                              </span>
                              {order.status === 'Pending' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    cancelOrder(order.id, 'Cancelled by consumer')
                                  }
                                  className="text-[10px] font-bold uppercase text-rose-400 hover:underline"
                                >
                                  Cancel Order
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-app-border rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full ${currentConfig.color}`}
                              style={{ width: currentConfig.width }}
                            />
                          </div>
                          <div className="text-[10px] text-app-text-muted">{currentConfig.eta}</div>
                          <div className="text-[10px] text-app-text-secondary mt-2">
                            ৳ {(order.total_payable || order.product.price).toLocaleString()} · Payment{' '}
                            {order.paymentStatus}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-app-card border border-app-border rounded-[2rem] p-6">
            <h4 className="text-sm font-bold text-app-text-primary mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-app-accent" /> Quick Links
            </h4>
            <div className="space-y-2 text-xs text-app-text-secondary">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> Marketplace
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5" /> Saved items
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Addresses
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" /> Deals
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5" /> Reviews
              </div>
              <div className="flex items-center gap-2 text-app-accent-light">
                <ArrowRight className="w-3.5 h-3.5" />
                <ChevronRight className="w-3.5 h-3.5" /> Order history above
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
