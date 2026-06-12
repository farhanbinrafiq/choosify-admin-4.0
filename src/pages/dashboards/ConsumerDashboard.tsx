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
  ArrowRight
} from 'lucide-react';
import { useOrders } from '../../contexts/OrdersContext';

export default function ConsumerDashboard() {
  const { orders } = useOrders();
  const customerOrders = orders.filter(o => o.customer.id === 'cust_001');

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
         <div className="space-y-1">
            <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">Assalamu Alaikum, Farhan!</h1>
            <p className="text-sm text-app-text-secondary">Explore your handpicked deals and order status today.</p>
         </div>
         <div className="flex items-center gap-3">
            <div className="bg-app-accent/10 border border-app-accent/20 rounded-2xl p-4 flex items-center gap-4">
               <div className="p-2.5 bg-app-accent rounded-xl">
                  <Gift className="w-5 h-5 text-white" />
               </div>
               <div>
                  <div className="text-[10px] text-app-accent-light font-bold uppercase tracking-widest">Choosify Points</div>
                  <div className="text-lg font-bold text-app-text-primary">2,450</div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         <div className="xl:col-span-2 space-y-8">
            {/* Active Orders */}
            <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-app-text-primary tracking-tight flex items-center gap-3">
                     <Clock className="w-5 h-5 text-app-accent-light" /> Track My Orders
                  </h3>
                  <button className="text-[10px] font-bold text-app-text-secondary uppercase hover:text-white transition-colors">View All History</button>
               </div>

               <div className="space-y-6">
                  {customerOrders.map((order, i) => {
                     const statusMap: Record<string, { width: string; color: string; eta: string }> = {
                       'Pending': { width: '15%', color: 'bg-amber-500', eta: 'Awaiting Merchant Confirmation' },
                       'Confirmed': { width: '40%', color: 'bg-blue-500', eta: 'Approved & Packing' },
                       'Dispatched': { width: '60%', color: 'bg-indigo-500', eta: 'Handed to Delivery Courier' },
                       'In Transit': { width: '80%', color: 'bg-purple-500', eta: 'Out for dispatch today' },
                       'Delivered': { width: '100%', color: 'bg-emerald-500', eta: 'Concluded item delivery' },
                       'Cancelled': { width: '100%', color: 'bg-rose-500', eta: 'Order request voided' },
                     };
                     const currentConfig = statusMap[order.status] || { width: '20%', color: 'bg-amber-500', eta: 'Processing' };
                     return (
                       <div key={i} className="group p-6 bg-app-bg border border-app-border rounded-2xl flex flex-col md:flex-row gap-6 hover:border-app-accent/30 transition-all">
                          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-app-border bg-black/40">
                             <img src={order.product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                <div>
                                   <div className="text-sm font-bold text-app-text-primary mb-0.5">{order.product.name}</div>
                                   <div className="text-[10px] text-app-text-secondary font-mono uppercase tracking-tighter">Order {order.id}</div>
                                </div>
                                <div className="text-right">
                                   <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                                      order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400' 
                                      : order.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400'
                                      : 'bg-app-accent/10 text-app-accent-light'
                                   }`}>{order.status}</span>
                                </div>
                             </div>
                             
                             {/* Stepper Mock */}
                             <div className="relative pt-2">
                                <div className="absolute top-[5px] left-0 right-0 h-[2px] bg-white/5" />
                                <div className={`absolute top-[5px] left-0 h-[2px] ${currentConfig.color}`} style={{ width: currentConfig.width }} />
                                <div className="flex justify-between relative">
                                   <div className={`w-2.5 h-2.5 rounded-full ${order.status !== 'Cancelled' ? 'bg-app-accent shadow-[0_0_8px_#F4631E]' : 'bg-rose-500'}`} />
                                   <div className={`w-2.5 h-2.5 rounded-full ${['Confirmed', 'Dispatched', 'In Transit', 'Delivered'].includes(order.status) ? 'bg-app-accent shadow-[0_0_8px_#F4631E]' : 'bg-white/10'}`} />
                                   <div className={`w-2.5 h-2.5 rounded-full ${['Dispatched', 'In Transit', 'Delivered'].includes(order.status) ? 'bg-app-accent shadow-[0_0_8px_#F4631E]' : 'bg-white/10'}`} />
                                   <div className={`w-2.5 h-2.5 rounded-full ${order.status === 'Delivered' ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : (order.status === 'Cancelled' ? 'bg-rose-500' : 'bg-white/10')}`} />
                                </div>
                             </div>
                             <div className="mt-4 text-[11px] text-app-text-secondary font-medium">
                                Status Note: <span className="text-app-text-primary font-bold">{order.cancelReason || order.declineReason || currentConfig.eta}</span>
                                {order.deliveryPartner && (
                                  <span className="block text-[10px] text-slate-500 mt-1">
                                    Courier: <strong className="text-white">{order.deliveryPartner}</strong> (Track URL: <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-app-accent underline">{order.trackingUrl}</a>)
                                  </span>
                                )}
                             </div>
                          </div>
                       </div>
                     );
                  })}
               </div>
            </section>

            {/* Recommended for You */}
            <section className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-app-text-primary tracking-tight">Picked for You</h3>
                  <button className="flex items-center gap-2 text-[10px] font-bold text-app-accent-light uppercase group">
                     Explore Discovery <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: 'Essential Grooming Kit', price: '৳ 2,450', brand: 'Beardo', image: 'https://images.unsplash.com/photo-1626285861696-9f0bf5a49c6d?w=400&q=80' },
                    { title: 'Digital Smart Weigh', price: '৳ 1,200', brand: 'Xiaomi', image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&q=80' },
                  ].map((item, i) => (
                    <div key={i} className="group bg-app-card border border-app-border rounded-[2rem] overflow-hidden shadow-xl hover:translate-y-[-4px] transition-all">
                       <div className="h-48 relative overflow-hidden bg-app-sidebar/50 flex items-center justify-center">
                          <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                          <button className="absolute top-4 right-4 p-3 bg-white/10 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-app-accent">
                             <Heart className="w-4 h-4" />
                          </button>
                       </div>
                       <div className="p-8">
                          <div className="text-[9px] text-app-text-secondary uppercase font-bold tracking-widest mb-1">{item.brand}</div>
                          <h4 className="text-sm font-bold text-app-text-primary mb-4 line-clamp-1">{item.title}</h4>
                          <div className="flex items-center justify-between">
                             <span className="text-lg font-bold text-app-accent-light">{item.price}</span>
                             <button className="p-2.5 bg-app-sidebar border border-app-border rounded-xl hover:bg-white/5 transition-all">
                                <ShoppingBag className="w-4 h-4 text-white" />
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
         </div>

         <div className="space-y-8">
            {/* Wishlist Highlight */}
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-sm font-bold text-app-text-primary mb-6 uppercase tracking-widest opacity-50">Saved Items (12)</h3>
               <div className="space-y-4">
                  {[
                    { name: 'Casual Summer Polo', price: '৳ 850', brand: 'Sailor' },
                    { name: 'Noise-Canceling Pods', price: '৳ 4,500', brand: 'Remax' },
                    { name: 'Heritage Leather Wallet', price: '৳ 1,200', brand: 'Apex' },
                  ].map((fav, i) => (
                    <div key={i} className="flex items-center gap-4 group cursor-pointer">
                       <div className="w-12 h-12 rounded-xl bg-app-bg border border-app-border shrink-0" />
                       <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-app-text-primary truncate group-hover:text-app-accent-light transition-colors">{fav.name}</div>
                          <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest">{fav.brand}</div>
                       </div>
                       <div className="text-[11px] font-bold text-app-text-primary">{fav.price}</div>
                    </div>
                  ))}
               </div>
               <button className="w-full mt-8 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-app-border rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all">
                  Manage Wishlist
               </button>
            </div>

            {/* Vouchers */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
               <div className="relative z-10">
                  <span className="text-[9px] font-extrabold uppercase bg-black/20 px-2 py-0.5 rounded tracking-widest mb-4 inline-block italic">Special Offer</span>
                  <h3 className="text-xl font-bold mb-2 tracking-tight">৳ 500 Discount</h3>
                  <p className="text-xs text-white/70 mb-6 leading-relaxed">Available on your next purchase above ৳ 2,500 at Aarong Official.</p>
                  <div className="flex items-center gap-2 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                     <code className="text-xs font-bold flex-1 text-center tracking-[4px] uppercase">CHOOSY500</code>
                     <button className="px-4 py-1 bg-white text-indigo-600 rounded-lg text-[10px] font-bold hover:scale-105 active:scale-95 transition-all">COPY</button>
                  </div>
               </div>
               <Zap className="absolute -bottom-10 -right-10 w-40 h-40 opacity-10" />
            </div>
         </div>
      </div>
    </div>
  );
}
