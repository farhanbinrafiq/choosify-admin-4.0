import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  ShoppingBag, 
  Wallet, 
  TrendingUp, 
  BarChart3, 
  Clock, 
  ArrowUpRight, 
  MoreHorizontal,
  Plus,
  Tag,
  Star,
  MousePointer2,
  Megaphone,
  CheckCircle,
  Sparkles,
  ChevronRight,
  PlusCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { useAds } from '../../contexts/AdsContext';
import { useAuth } from '../../contexts/AuthContext';
import UnifiedProfileShell from '../admin/profiles/UnifiedProfileShell';

const salesData = [
  { name: 'Mon', sales: 4000, clicks: 120 },
  { name: 'Tue', sales: 3000, clicks: 90 },
  { name: 'Wed', sales: 5000, clicks: 150 },
  { name: 'Thu', sales: 2780, clicks: 80 },
  { name: 'Fri', sales: 1890, clicks: 60 },
  { name: 'Sat', sales: 2390, clicks: 110 },
  { name: 'Sun', sales: 3490, clicks: 130 },
];

export default function SellerDashboard() {
  const { profile } = useAuth();
  const { addPromotionRequest, promotionRequests } = useAds();
  const [activeDashboardTab, setActiveDashboardTab] = useState<'sales' | 'intelligence'>('sales');
  
  // Local store items that are eligible for sponsors or features
  const [storeProducts] = useState([
    { id: 'p1', name: 'Aarong Jamdani Saree', category: 'Fashion', price: '৳ 4,200', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80' },
    { id: 'p2', name: 'Vision Smart TV 55"', category: 'Electronics', price: '৳ 68,500', image: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=400&q=80' },
    { id: 'p3', name: 'Walton 2-Door Fridge', category: 'Home', price: '৳ 29,990', image: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=400&q=80' },
  ]);

  const [storeDeals] = useState([
    { id: 'd1', name: 'Aarong Pohela Boishakh Coupon Code', discount: '৳ 1,500 Flat Off', expiry: '2026-06-01' },
    { id: 'd2', name: 'Lifestyle Summer Flash Discount', discount: '15% Storewide', expiry: '2026-06-15' },
  ]);

  // Modal / Form state
  const [promotingItem, setPromotingItem] = useState<{ id: string; name: string; type: 'PRODUCT' | 'DEAL' | 'BRAND' } | null>(null);
  const [requestedPromoType, setRequestedPromoType] = useState<'Featured' | 'Sponsored' | 'Hot' | 'Verified' | 'Trending' | 'Editor Pick'>('Sponsored');
  const [requestedTier, setRequestedTier] = useState<'Standard Featured' | 'Premium Featured' | 'Homepage Featured' | 'Trending Boost' | 'Editor Pick'>('Standard Featured');
  const [duration, setDuration] = useState<number>(7);
  const [placementRequest, setPlacementRequest] = useState<string>('homepage_banner');
  const [toast, setToast] = useState<string | null>(null);

  const myRequests = promotionRequests.filter(r => r.requesterId === (profile?.id || 'seller_001'));

  const handleOpenPromote = (id: string, name: string, type: 'PRODUCT' | 'DEAL' | 'BRAND') => {
    setPromotingItem({ id, name, type });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingItem) return;

    await addPromotionRequest({
      requesterId: profile?.id || 'seller_001',
      requesterRole: 'seller',
      requesterName: profile?.displayName || 'Rahim Uddin',
      contentType: promotingItem.type,
      contentId: promotingItem.id,
      contentName: promotingItem.name,
      requestedPromotionType: requestedPromoType,
      featurePriority: requestedTier,
      duration: duration,
      placementRequest: placementRequest
    });

    setPromotingItem(null);
    showToast('Promotion request submitted successfully! Pending admin approval.');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-8 pb-16 text-white">
      {/* Upper Command Header */}
      <div className="bg-app-card border border-app-border rounded-[2.5rem] p-6 lg:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E] block">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span>Seller Command Center</span>
          </h2>
          <p className="text-xs text-[#8E9BAE] mt-1 max-w-xl">
            Analyze business statistics, execute visibility booster campaigns, and access full-service store intelligence.
          </p>
        </div>

        <div className="flex gap-2 p-1.5 bg-app-bg/60 border border-app-border/40 rounded-2xl self-start md:self-center">
          <button
            onClick={() => setActiveDashboardTab('sales')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeDashboardTab === 'sales'
                ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Commerce & Visibility Panel
          </button>
          <button
            onClick={() => setActiveDashboardTab('intelligence')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeDashboardTab === 'intelligence'
                ? 'bg-[#F4631E] text-white shadow-lg shadow-[#F4631E]/20 font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Seller Intelligence Center
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Order Console', path: '/admin/orders' },
          { label: 'My Products', path: '/admin/products' },
          { label: 'Post an Offer', path: '/admin/seller-offers' },
          { label: 'Returns Queue', path: '/admin/returns' },
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="px-4 py-3 rounded-xl border border-app-border bg-app-card hover:border-app-accent/40 text-[11px] font-bold uppercase tracking-wider text-app-text-primary transition-all flex items-center justify-between"
          >
            {item.label}
            <ChevronRight className="w-4 h-4 text-app-text-secondary" />
          </Link>
        ))}
      </div>

      {activeDashboardTab === 'sales' ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Earnings', val: '৳ 142,500', icon: Wallet, color: 'text-green-500', trend: '+12.5%' },
              { label: 'Active Orders', val: '24', icon: ShoppingBag, color: 'text-blue-500', trend: '+2' },
              { label: 'Product Clicks', val: '1,420', icon: MousePointer2, color: 'text-app-accent', trend: '+8.2%' },
              { label: 'Store Rating', val: '4.8', icon: TrendingUp, color: 'text-yellow-500', trend: 'High' },
            ].map((stat, i) => (
              <div key={i} className="bg-app-card border border-app-border rounded-[1.5rem] p-6 shadow-xl">
                 <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-white/5 border border-app-border ${stat.color}`}>
                       <stat.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded italic">
                       {stat.trend}
                    </span>
                 </div>
                 <div className="text-2xl font-bold text-app-text-primary tracking-tight">{stat.val}</div>
                 <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-50">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <h3 className="text-xl font-bold text-app-text-primary tracking-tight">Sales Analytics</h3>
                     <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Weekly Store Performance</p>
                  </div>
                  <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                     <MoreHorizontal className="w-5 h-5 text-app-text-secondary" />
                  </button>
               </div>
               
               <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={salesData}>
                        <defs>
                           <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F4631E" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#F4631E" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#888888" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0A0E1A', border: '1px solid #1E293B', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="sales" stroke="#F4631E" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Brand Showcase Widget */}
            <div className="space-y-6">
               <div className="bg-gradient-to-br from-app-accent to-app-accent-light rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-app-accent/20">
                  <div className="relative z-10">
                      <span className="text-[9px] font-black tracking-widest uppercase bg-white/15 px-2.5 py-1 rounded mb-4 inline-block">Store Brand</span>
                      <h3 className="text-2xl font-black mb-1">Aarong Digital</h3>
                      <p className="text-xs text-white/70 mb-6 leading-relaxed">Boost your organic brand rankings or book top banner placement.</p>
                      <button 
                        onClick={() => handleOpenPromote('brand_aarong', 'Aarong Digital Brand', 'BRAND')}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-app-accent rounded-xl font-bold text-xs uppercase hover:scale-105 transition-all shadow-xl shadow-black/20 active:scale-95"
                      >
                         <Megaphone className="w-3.5 h-3.5" /> Sponsor Brand
                      </button>
                  </div>
                  <Tag className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
               </div>

               <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Unanswered Reviews</h3>
                     <span className="bg-app-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full">3 New</span>
                  </div>
                  <div className="space-y-4">
                     {[
                       { id: '1', user: 'Zubair H.', rating: 5, comment: 'Product quality is excellent! Highly recommended.' },
                       { id: '2', user: 'Nusrat J.', rating: 4, comment: 'Delivery was a bit slow, but product is good.' },
                     ].map((review) => (
                       <div key={review.id} className="p-3 bg-app-bg border border-app-border rounded-xl group hover:border-app-accent/30 transition-all">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] font-bold text-app-text-primary">{review.user}</span>
                             <div className="flex items-center gap-0.5">
                                {[...Array(review.rating)].map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />)}
                             </div>
                          </div>
                          <p className="text-[10px] text-app-text-secondary leading-tight mb-3 italic">"{review.comment}"</p>
                          <button className="text-[9px] font-bold text-app-accent hover:text-white transition-colors">Reply (1 Left)</button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Centralized Sponsor Hub for Store Merchandise */}
          <section className="bg-app-card border border-app-border rounded-[2.5rem] p-8 lg:p-10 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-app-border pb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded bg-app-accent/15 text-app-accent-light text-[8px] font-black uppercase">Internal Ecosystem</span>
                  <Sparkles className="w-4 h-4 text-app-accent-light" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white mb-1">📢 Sponsor & Visibility Booster</h3>
                <p className="text-app-text-secondary text-[12px]">Request premium placements or campaigns for products and deals inside Choosify.</p>
              </div>
              <div className="flex items-center gap-4 bg-app-bg p-2 rounded-xl border border-app-border">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase px-2">Duration options: 3d • 7d • 30d</span>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Products List for Sponsorship */}
              <div>
                <h4 className="text-sm font-bold text-app-text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-app-accent" /> Store Products
                </h4>
                <div className="space-y-3">
                  {storeProducts.map((p) => (
                    <div key={p.id} className="p-4 bg-app-bg border border-app-border rounded-2xl flex items-center justify-between hover:border-app-accent/20 transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <img src={p.image} className="w-12 h-12 rounded-xl object-cover" alt="" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold truncate">{p.name}</div>
                          <div className="text-[10px] text-app-text-secondary mt-0.5">{p.category} • <span className="font-bold text-app-accent">{p.price}</span></div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleOpenPromote(p.id, p.name, 'PRODUCT')}
                        className="px-4 py-2 bg-app-accent hover:bg-app-accent-light text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                      >
                        Promote
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deals list for Sponsor */}
              <div>
                <h4 className="text-sm font-bold text-app-text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-app-accent" /> Active Discount Coupons
                </h4>
                <div className="space-y-3">
                  {storeDeals.map((d) => (
                    <div key={d.id} className="p-4 bg-app-bg border border-app-border rounded-2xl flex items-center justify-between hover:border-app-accent/20 transition-all">
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold truncate">{d.name}</div>
                        <div className="text-[10px] text-app-text-secondary mt-0.5">Expires: {d.expiry} • <span className="font-bold text-emerald-400">{d.discount}</span></div>
                      </div>
                      <button 
                        onClick={() => handleOpenPromote(d.id, d.name, 'DEAL')}
                        className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                      >
                        Boost Visibility
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Request tracking list */}
            {myRequests.length > 0 && (
              <div className="mt-10 border-t border-app-border pt-8">
                <h4 className="text-xs font-black uppercase tracking-widest text-app-text-secondary mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-app-accent" /> Your Sponsorship Request History
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-app-bg/50 border border-app-border rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                            req.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-500' :
                            req.approvalStatus === 'PENDING' ? 'bg-orange-500/10 text-orange-500 animate-pulse' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {req.approvalStatus}
                          </span>
                          <span className="text-[8px] font-mono text-app-text-secondary">{req.createdAt.split('T')[0]}</span>
                        </div>
                        <h5 className="text-[12px] font-extrabold truncate">{req.contentName}</h5>
                        <p className="text-[10px] text-app-text-secondary mt-1">{req.requestedPromotionType} ({req.duration} Days)</p>
                        <p className="text-[9px] text-app-accent/80 font-mono mt-0.5">Target placement: {req.placementRequest}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <UnifiedProfileShell />
        </div>
      )}

      {/* Dialog Backdrop and Request Form */}
      {promotingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-app-card border border-app-border w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setPromotingItem(null)} 
              className="absolute top-6 right-6 p-2 text-app-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-app-accent flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white leading-tight">Request Sponsoring Placement</h4>
                <p className="text-[11px] text-app-text-secondary uppercase mt-0.5">Submit for platform Administrator review</p>
              </div>
            </div>

            <div className="p-4 bg-app-bg border border-app-border rounded-xl mb-6">
              <span className="text-[8px] uppercase tracking-widest font-black text-app-text-secondary">Item details</span>
              <div className="text-[13px] font-extrabold text-app-accent-light mt-1">{promotingItem.name}</div>
              <div className="text-[10px] text-app-text-secondary font-mono mt-0.5">Type ID: {promotingItem.type} / {promotingItem.id}</div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Promotion Type</label>
                  <select 
                    value={requestedPromoType}
                    onChange={(e: any) => setRequestedPromoType(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="Sponsored">Sponsored Tag</option>
                    <option value="Featured">Featured Spotlight</option>
                    <option value="Hot">Hot Deal Tag</option>
                    <option value="Verified">Verified Merchant Tag</option>
                    <option value="Trending">Trending Boost</option>
                    <option value="Editor Pick">Editor's Pick Badge</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Visibility Tier</label>
                  <select 
                    value={requestedTier}
                    onChange={(e: any) => setRequestedTier(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="Standard Featured">Standard Boost (+30 score)</option>
                    <option value="Trending Boost">Trending Boost (+45 score)</option>
                    <option value="Premium Featured">Premium Banner Spotlight (+60 score)</option>
                    <option value="Editor Pick">Editor's Pick (+80 score)</option>
                    <option value="Homepage Featured">Homepage Spotlight Hero (+95 score)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Duration</label>
                  <select 
                    value={duration} 
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value={3}>3 Days Campaign</option>
                    <option value={7}>7 Days Campaign</option>
                    <option value={30}>30 Days Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Target Placement</label>
                  <select 
                    value={placementRequest}
                    onChange={(e) => setPlacementRequest(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="homepage_banner">Homepage Hero Banner</option>
                    <option value="trending_section">Trending / Featured Now</option>
                    <option value="category_top">Category Top Inline Banner</option>
                    <option value="listing_boost">Product Listings Premium Card</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-app-text-secondary border border-app-border/40 p-3.5 rounded-xl bg-app-bg/50 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-app-accent shrink-0 mt-0.5" />
                <p className="leading-normal">
                  Our system evaluates promotions against real user engagement data. Poorly rated items (under 3.5 stars) have their boost half-capped to protect trust standards.
                </p>
              </div>

              <button 
                type="submit"
                className="w-full bg-app-accent text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-app-accent/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 uppercase tracking-wider"
              >
                Submit for approval
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 bg-app-accent text-white rounded-2xl shadow-2xl shadow-app-accent/30 font-bold text-sm flex items-center gap-3 z-[100] animate-bounce">
          <CheckCircle className="w-5 h-5 text-white" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
