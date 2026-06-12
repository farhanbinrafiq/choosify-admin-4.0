import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle, 
  XSquare, 
  Eye, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Layers, 
  Sliders, 
  Search, 
  Star, 
  Calendar, 
  Percent, 
  Tag, 
  Activity, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

type PromoTab = 
  | 'brands' 
  | 'products' 
  | 'homepage' 
  | 'requests' 
  | 'approvals' 
  | 'active' 
  | 'expired' 
  | 'revenue';

const initPromotedBrands = [
  { id: 'sb_001', brandName: 'Apex Footwear Ltd', bidDaily: '৳ 4,500', duration: '14 Days', currentRank: 1, category: 'Footwear & Accessories', impressions: '185,400', clicks: '9,840' },
  { id: 'sb_002', brandName: 'Anjans Fashion Hub', bidDaily: '৳ 3,200', duration: '30 Days', currentRank: 2, category: 'Traditional Outfits', impressions: '142,000', clicks: '5,103' },
  { id: 'sb_003', brandName: 'Khaas Food Organics', bidDaily: '৳ 2,800', duration: '7 Days', currentRank: 3, category: 'Organic Grocery', impressions: '98,000', clicks: '4,120' }
];

const initPromoRequests = [
  { id: 'pr_req_101', vendor: 'Otobi Living furniture', promotionalType: 'Featured Product Slot', item: 'Otobi Executive Ergonomic Swivel Chair', dailyBid: '৳ 1,800', plan: '10-Day Run', submitted: '1h ago', status: 'Pending Approval' },
  { id: 'pr_req_102', vendor: 'Meena Bazar Supermarkets', promotionalType: 'Homepage Slideshow Hero', item: 'Premium Grocery Grocer Eid Campaign Slider', dailyBid: '৳ 5,500', plan: '5-Day Run', submitted: 'Yesterday', status: 'Pending Approval' },
  { id: 'pr_req_103', vendor: 'TechLand Electronics', promotionalType: 'Brand Spotlight Carousel', item: 'Asus ROG Gaming Latop series bulk list', dailyBid: '৳ 3,000', plan: '12-Day Run', submitted: '2 days ago', status: 'Expired' }
];

const promotionalRevenueData = [
  { month: 'Week 1', sponsorsRev: 85000, activeBrands: 4 },
  { month: 'Week 2', sponsorsRev: 124000, activeBrands: 6 },
  { month: 'Week 3', sponsorsRev: 148000, activeBrands: 7 },
  { month: 'Week 4', sponsorsRev: 212000, activeBrands: 9 },
];

export default function SponsoredPromotionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'brands') as PromoTab;

  const [brands, setBrands] = useState(initPromotedBrands);
  const [requests, setRequests] = useState(initPromoRequests);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<typeof initPromoRequests[0] | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApproveSponsor = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Active' } : r));
    showToast('✓ Campaign approved! Core index assigned bidding order weight.');
  };

  const handleDeclineSponsor = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Declined' } : r));
    showToast('❌ Sponsorship proposal returned to merchant.');
  };

  return (
    <div className="space-y-6 text-white pb-16 animate-fade-in animate-duration-300">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-app-border pb-6">
        <div>
          <span className="text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2.5 py-1 rounded font-black tracking-widest uppercase block w-fit mb-1">
            NATIVE ADS & SPONSORS
          </span>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Award className="text-pink-400" /> Choosify Sponsored Promotions
          </h2>
          <p className="text-xs text-app-text-secondary mt-1">
            Coordinate featured product queues, brand auction bids, slideshow positions, and sponsorship payment grids.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-3 py-1.5 rounded-lg">
          ACTIVE_SPONSORS_WEIGHTS: program_active
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Featured Subscriptions', value: '৳ 569,400', pct: '+22.4% yield mom', icon: DollarSign, color: 'text-pink-400' },
          { label: 'Active Sponsored Brands', value: brands.length, pct: 'Avg auction: ৳ 3.5k/day', icon: Award, color: 'text-indigo-400' },
          { label: 'Featured Product Items', value: '28 Products', pct: 'Product level bids synced', icon: ShoppingBag, color: 'text-emerald-400' },
          { label: 'Active Slider Campaigns', value: '4 Sliders', pct: 'Homepage placements 100%', icon: Layers, color: 'text-orange-400' }
        ].map((node, i) => (
          <div key={i} className="bg-app-card border border-app-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{node.label}</p>
              <div className="text-xl font-black text-white">{node.value}</div>
              <p className="text-[9px] text-[#A2A9B2] mt-1 italic">{node.pct}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-app-bg border border-app-border flex items-center justify-center ${node.color}`}>
              <node.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs list mapped to matching submenus */}
      <div className="flex border-b border-app-border gap-6 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'brands', label: 'Sponsored Brands Pool' },
          { id: 'products', label: 'Featured Products Listings' },
          { id: 'homepage', label: 'Homepage Hero Sliders' },
          { id: 'requests', label: 'Promotion Requests Queue', badge: requests.filter(r => r.status === 'Pending Approval').length },
          { id: 'approvals', label: 'Campaign Approvals' },
          { id: 'active', label: 'Active Promotions' },
          { id: 'expired', label: 'Expired Promotion Logs' },
          { id: 'revenue', label: 'Sponsorship Income Sheets' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSearchParams({ tab: tab.id })}
            className={`pb-4 px-1 text-xs font-bold tracking-tight shrink-0 relative transition-all whitespace-nowrap cursor-pointer ${
              currentTab === tab.id 
                ? 'text-pink-400 font-extrabold' 
                : 'text-app-text-secondary hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-pink-500 font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </span>
            {currentTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500" />
            )}
          </button>
        ))}
      </div>

      {/* Layout Split Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Column */}
        <div className="xl:col-span-8 space-y-6">

          {/* TAB: SPONSORED BRANDS POOL */}
          {currentTab === 'brands' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Active Brand Bid Auctions Leaderboard</span>
              
              <div className="space-y-3">
                {brands.map((b) => (
                  <div key={b.id} className="p-4 bg-app-bg rounded-xl border border-app-border flex items-center justify-between hover:border-pink-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center font-bold text-xs shrink-0">
                        #{b.currentRank}
                      </div>
                      <div>
                        <span className="font-bold text-white text-xs block">{b.brandName}</span>
                        <span className="text-[10px] text-slate-500">Category: {b.category} • Bid contract: {b.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-500 block">Auction Bid Target</span>
                        <span className="text-xs font-black text-pink-400">{b.bidDaily} / Day</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-500 block">Impressions Sync</span>
                        <span className="text-xs font-bold text-white">{b.impressions}</span>
                      </div>
                      <div className="bg-white/5 py-1 px-2.5 rounded border border-white/5 font-mono text-[10px] font-bold">
                        CTR: {((parseInt(b.clicks.replace(',', '')) / parseInt(b.impressions.replace(',', ''))) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: FEATURED PRODUCTS LISTINGS */}
          {currentTab === 'products' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Featured product ranking positions catalog</span>
              
              <div className="p-8 bg-app-bg rounded-xl border border-white/[0.02] text-center space-y-3">
                <ShoppingBag className="w-12 h-12 text-pink-400 mx-auto opacity-80" />
                <span className="font-extrabold text-white text-xs block">Native Featured Products Feed Active</span>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">Products are positioned dynamically inside consumer search results based on historical bidding CPC parameters and available budgets.</p>
              </div>
            </div>
          )}

          {/* TAB: HERO SLIDERS PLANNER */}
          {currentTab === 'homepage' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Homepage slideshow promo planner layout</span>
              
              <p className="text-xs text-slate-400">Sliders are allocated in modular 24-hour slots. Below represents active slots layout grids:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { pos: 'Slide 1 - Primetime Hero', brand: 'Apex Eid Footwear', price: '৳ 6,000 / Day', status: 'Booked' },
                  { pos: 'Slide 2 - Mid Spot slider', brand: 'Daraz Summer Apparel', price: '৳ 4,500 / Day', status: 'Booked' },
                  { pos: 'Slide 3 - Side Spotlight Left', brand: 'Samsung Galaxy fold', price: '৳ 3,800 / Day', status: 'Available' },
                  { pos: 'Slide 4 - Promo footer card slot', brand: 'Khaas Honey organics', price: '৳ 2,500 / Day', status: 'Booked' }
                ].map((sNode, i) => (
                  <div key={i} className="p-4 bg-app-bg rounded-xl border border-[#343A40] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-white">{sNode.pos}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${sNode.status === 'Booked' ? 'bg-pink-500/10 text-pink-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{sNode.status}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#A2A9B2] pt-1 border-t border-white/[0.02]">
                      <span>Advertiser: {sNode.brand}</span>
                      <strong>{sNode.price}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PROMOTION REQUEST EVENTS */}
          {(currentTab === 'requests' || currentTab === 'approvals' || currentTab === 'active' || currentTab === 'expired') && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4 border-b border-app-border pb-2">Promotions moderation & vetting queue</span>
              
              <div className="space-y-3">
                {requests.filter(r => currentTab === 'expired' ? r.status === 'Expired' : currentTab === 'active' ? r.status === 'Active' : true).map((r) => (
                  <div key={r.id} className="p-4 bg-app-bg rounded-xl border border-app-border flex items-center justify-between hover:border-pink-500/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-xs">{r.vendor}</span>
                        <span className="text-[9px] font-mono text-pink-400">ID: {r.id}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Item: {r.item} • Action: <strong className="text-white font-sans">{r.promotionalType}</strong></p>
                      <span className="text-[9px] text-[#A2A9B2] block mt-0.5 font-mono">daily pricing bid: {r.dailyBid} ({r.plan}) • Recieved {r.submitted}</span>
                    </div>

                    <div className="flex gap-2 pl-4 border-l border-white/[0.04] items-center">
                      {r.status === 'Pending Approval' ? (
                        <>
                          <button
                            onClick={() => handleApproveSponsor(r.id)}
                            className="p-1.5 px-3 bg-pink-500 text-white font-extrabold text-[10px] rounded hover:scale-102 cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDeclineSponsor(r.id)}
                            className="p-1.5 px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] rounded cursor-pointer"
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <span className={`text-[9px] font-black uppercase py-0.5 px-2 rounded ${r.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                          {r.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SPONSORSHIP INCOME GRAPH AREA */}
          {currentTab === 'revenue' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-6">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Sponsorship Revenue analytics</span>
              
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={promotionalRevenueData}>
                    <defs>
                      <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EC4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                    <XAxis dataKey="month" stroke="#A2A9B2" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#A2A9B2" fontSize={11} axisLine={false} tickLine={false} />
                    <ChartTooltip />
                    <Area type="monotone" dataKey="sponsorsRev" name="Weekly Revenue (৳)" stroke="#EC4899" strokeWidth={2} fillOpacity={1} fill="url(#pinkGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>

        {/* Right sidebar */}
        <div className="xl:col-span-4 space-y-6 h-fit sticky top-24">
          <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">💡 Native promotion auctions rules</span>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Merchants auction keywords organically. Higher bids receive priority top ranks during category search queries splits.
            </p>
          </div>
        </div>

      </div>

      {/* Dynamic toast tracker */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-pink-500 text-white rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2 z-[100] animate-bounce">
          <CheckCircle className="w-5 h-5 text-white" />
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
}
