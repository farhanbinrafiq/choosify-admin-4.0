import React, { useState } from 'react';
import { useOrders, Order, OrderStatus } from '../../contexts/OrdersContext';
import { 
  ListOrdered, 
  Search, 
  CheckCircle, 
  XCircle, 
  Truck, 
  Notebook, 
  AlertCircle,
  Clock, 
  Filter, 
  Plus, 
  DollarSign, 
  User, 
  Tag, 
  ChevronRight,
  Send,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Loader
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function OrdersPage() {
  const { profile } = useAuth();
  const { 
    orders, 
    approveOrder, 
    declineOrder, 
    cancelOrder, 
    dispatchOrder, 
    addCustomerNotes,
    updateOrderStatus 
  } = useOrders();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | OrderStatus>('All');

  // Modal / Drawer state for actions
  const [actioningOrder, setActioningOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'decline' | 'cancel' | 'dispatch' | 'note' | null>(null);
  const [inputText, setInputText] = useState('');
  const [inputTextSecondary, setInputTextSecondary] = useState('');

  // Seller orders filter (only show orders for this seller if logged in as seller)
  // Let's check: profile?.id is "seller_001" which corresponds to sellerId in products.
  const sellerId = profile?.role === 'seller' ? profile.id : 'seller_001'; 
  const sellerOrders = orders.filter(o => o.product.sellerId === sellerId);

  // Search & Tab filtering
  const filteredOrders = sellerOrders.filter(o => {
    const matchesSearch = 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'All') return matchesSearch;
    return matchesSearch && o.status === activeTab;
  });

  const getStatusStyle = (status: OrderStatus) => {
    const styles: Record<OrderStatus, string> = {
      'Pending': 'bg-amber-500/10 text-amber-500 border-amber-500/25',
      'Confirmed': 'bg-blue-500/10 text-blue-500 border-blue-500/25',
      'Dispatched': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25',
      'In Transit': 'bg-purple-500/10 text-purple-500 border-purple-500/25',
      'Delivered': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
      'Cancelled': 'bg-rose-500/10 text-rose-500 border-rose-500/25',
    };
    return styles[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/25';
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actioningOrder || !actionType) return;

    if (actionType === 'decline') {
      if (!inputText.trim()) return;
      declineOrder(actioningOrder.id, inputText);
    } else if (actionType === 'cancel') {
      if (!inputText.trim()) return;
      cancelOrder(actioningOrder.id, inputText);
    } else if (actionType === 'dispatch') {
      if (!inputText.trim()) return; // partner
      dispatchOrder(actioningOrder.id, inputText, inputTextSecondary || 'https://choosify.com.bd/track/' + actioningOrder.id);
    } else if (actionType === 'note') {
      if (!inputText.trim()) return;
      addCustomerNotes(actioningOrder.id, inputText);
    }

    // Reset
    setActioningOrder(null);
    setActionType(null);
    setInputText('');
    setInputTextSecondary('');
  };

  const openAction = (order: Order, type: 'decline' | 'cancel' | 'dispatch' | 'note') => {
    setActioningOrder(order);
    setActionType(type);
    setInputText('');
    setInputTextSecondary('');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl font-black text-app-text-primary tracking-tight flex items-center gap-3">
            <ListOrdered className="w-7 h-7 text-app-accent" /> Orders Console
          </h1>
          <p className="text-xs text-app-text-secondary">
            Manage incoming customer purchases, track logistics lifecycles, and dispatch packages.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 relative z-10">
          <div className="bg-app-bg border border-app-border rounded-2xl px-6 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Incoming</span>
            <span className="text-xl font-bold text-amber-500">{sellerOrders.filter(o => o.status === 'Pending').length}</span>
          </div>
          <div className="bg-app-bg border border-app-border rounded-2xl px-6 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active</span>
            <span className="text-xl font-bold text-app-accent">{sellerOrders.filter(o => ['Confirmed', 'Dispatched', 'In Transit'].includes(o.status)).length}</span>
          </div>
          <div className="bg-app-bg border border-app-border rounded-2xl px-6 py-4 flex flex-col justify-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Delivered</span>
            <span className="text-xl font-bold text-emerald-500">{sellerOrders.filter(o => o.status === 'Delivered').length}</span>
          </div>
        </div>
      </div>

      {/* Control Area: Search + Quick Filter Tabs */}
      <div className="bg-app-card border border-app-border rounded-[2rem] p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent transition-colors" />
            <input 
              type="text"
              placeholder="Search by ID, Product, or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-app-bg border border-app-border rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-app-accent/60 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-app-text-secondary uppercase tracking-widest">
            <Filter className="w-3.5 h-3.5 text-app-accent" /> Filter Storefront
          </div>
        </div>

        {/* Tab Scroller */}
        <div className="flex border-b border-app-border overflow-x-auto pb-1 gap-1 custom-scrollbar">
          {(['All', 'Pending', 'Confirmed', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled'] as const).map((tab) => {
            const count = tab === 'All' 
              ? sellerOrders.length 
              : sellerOrders.filter(o => o.status === tab).length;
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`active-tab-item px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all rounded-t-xl whitespace-nowrap flex items-center gap-2 border-b-2 ${
                  isActive 
                    ? 'border-app-accent text-white bg-app-accent/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {tab}
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-app-accent text-white' : 'bg-white/5 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List / Workspace */}
      <div className="space-y-6">
        {filteredOrders.length === 0 ? (
          <div className="bg-app-card border border-app-border rounded-[2rem] p-16 text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-md font-bold text-white mb-1">No Orders Found</h3>
            <p className="text-xs text-app-text-secondary max-w-sm mx-auto">
              We couldn't find any orders matching the selected filter tab or query.
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden hover:border-app-accent/30 transition-all group"
            >
              {/* Top Banner Indicator */}
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-app-accent via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Order Row Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-app-border/60">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-app-sidebar border border-app-border flex items-center justify-center font-mono font-bold text-white shadow-inner">
                    📦
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-black text-white">{order.id}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                        order.paymentStatus === 'Paid' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                      Purchased on: {new Date(order.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Quick Status Modifiers */}
                <div className="flex flex-wrap gap-2">
                  {order.status === 'Pending' && (
                    <>
                      <button 
                        onClick={() => approveOrder(order.id)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve Order
                      </button>
                      <button 
                        onClick={() => openAction(order, 'decline')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}

                  {order.status === 'Confirmed' && (
                    <>
                      <button 
                        onClick={() => openAction(order, 'dispatch')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-app-accent to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-app-accent/20 transition-all active:scale-95"
                      >
                        <Truck className="w-3.5 h-3.5" /> Mark Dispatched
                      </button>
                      <button 
                        onClick={() => openAction(order, 'cancel')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.status === 'Dispatched' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'In Transit')}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Transit ➔
                      </button>
                    </div>
                  )}

                  {order.status === 'In Transit' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'Delivered')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  )}

                  <button 
                    onClick={() => openAction(order, 'note')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-app-border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    <Notebook className="w-3.5 h-3.5 text-app-accent" /> Add Note
                  </button>
                </div>
              </div>

              {/* Order Body Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
                {/* Product Detail Preview */}
                <div className="space-y-3">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Product Ordered</span>
                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-app-border shrink-0 bg-black/40">
                      <img src={order.product.image} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold text-white">{order.product.name}</h4>
                      <p className="text-[10px] text-app-accent-light font-bold mt-1">৳ {order.product.price.toLocaleString()}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Brand: {order.product.brand}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Profiler & Behavior Audit */}
                <div className="space-y-3 border-t md:border-t-0 md:border-x border-app-border/40 md:px-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">Customer Details</span>
                    {order.customer.flagged && (
                      <span className="bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-red-500/20 animate-pulse flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> FLAGGED
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-app-accent text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {order.customer.avatar}
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-white">{order.customer.name}</h5>
                      <p className="text-[9px] text-slate-400 truncate">{order.customer.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-slate-500 font-medium">Risk Grade:</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                          order.customer.behavior === 'Good' 
                            ? 'text-emerald-500 bg-emerald-500/10'
                            : order.customer.behavior === 'Risk'
                            ? 'text-rose-500 bg-rose-500/10'
                            : 'text-amber-500 bg-amber-500/10'
                        }`}>
                          {order.customer.behavior}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logistics or Tracking Hub */}
                <div className="space-y-3">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Fulfillment Details</span>
                  {order.deliveryPartner ? (
                    <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Courier Partner</span>
                        <span className="text-[10px] font-bold text-white">{order.deliveryPartner}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Live Route</span>
                        <a 
                          href={order.trackingUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] font-black text-app-accent hover:underline flex items-center gap-1"
                        >
                          Track URL <ChevronRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-relaxed italic pt-1">
                      No logistics courier assigned yet. Complete confirmation to hook delivery gateway.
                    </p>
                  )}
                </div>
              </div>

              {/* Sub-section: Customer Notes & Interactive Logs */}
              {(order.customerNotes || order.declineReason || order.cancelReason) && (
                <div className="mt-6 pt-4 border-t border-app-border/40 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.customerNotes && order.customerNotes.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Customer Conversation & Notes:</span>
                      {order.customerNotes.map((cn, idx) => (
                        <div key={idx} className="bg-white/5 border border-app-border rounded-xl p-3 text-[11px] text-slate-200 flex gap-2">
                          <span className="text-app-accent font-bold">💬</span>
                          <span>{cn}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(order.declineReason || order.cancelReason) && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider block">Cancellation Notes / Reason:</span>
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300">
                        {order.declineReason || order.cancelReason}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Future commission Preparation system telemetry representation */}
              <div className="absolute right-4 bottom-4 text-[8px] font-mono text-slate-500 uppercase flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                <span>COMM: {order.earnings.commissionPercent}%</span>
                <span>FUTURE DEDUCT: ৳{order.earnings.futureAutomatedDeduction}</span>
                <span>NET: ৳{order.earnings.sellerNet}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Dialog Modal Drawer */}
      {actioningOrder && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActioningOrder(null)} />
          
          {/* Box */}
          <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-white capitalize">
                {actionType === 'decline' ? 'Decline Request' : actionType === 'cancel' ? 'Cancel Order' : actionType === 'dispatch' ? 'Fulfill Shipment' : 'Customer Notes'}
              </h3>
              <p className="text-xs text-app-text-secondary mt-1">
                Order Reference: <span className="font-mono text-white font-bold">{actioningOrder.id}</span>
              </p>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-5">
              {actionType === 'decline' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mandatory Reason for Decline</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="E.g. Damaged stock or delivery route not accessible."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-red-500/50"
                  />
                </div>
              )}

              {actionType === 'cancel' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Post-Approval Cancel Reason Note</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Detail the circumstances necessitating cancellation."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-rose-500/50"
                  />
                </div>
              )}

              {actionType === 'dispatch' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivery Partner Name</label>
                    <input 
                      required
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="E.g. Pathao, Paperfly, RedX, Sundarban"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking URL Link</label>
                    <input 
                      type="url"
                      value={inputTextSecondary}
                      onChange={(e) => setInputTextSecondary(e.target.value)}
                      placeholder="E.g. https://track.pathao.com/id"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {actionType === 'note' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message Note (Syncs to Chat & Customer Visible)</label>
                  <textarea 
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Say something to the customer regarding shipment sizing, timelines..."
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-app-accent/50"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setActioningOrder(null)}
                  className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button 
                  type="submit"
                  className={`px-6 py-3 text-[10px] font-black uppercase text-white rounded-xl shadow-lg transition-all ${
                    actionType === 'decline' ? 'bg-red-600 hover:bg-red-50' : actionType === 'cancel' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-app-accent hover:bg-orange-500'
                  }`}
                >
                  Save & Apply Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
