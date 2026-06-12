import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle, 
  XCircle, 
  Eye, 
  BarChart3, 
  Lock, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Star, 
  ThumbsUp, 
  TrendingUp, 
  History, 
  MessageCircle, 
  Search, 
  Sliders, 
  ChevronRight,
  AlertTriangle,
  Info,
  Package,
  Tag,
  Plus
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

type ActiveTab = 'requests' | 'active' | 'banned' | 'flagged' | 'performance' | 'orders' | 'warnings' | 'suspended' | 'products' | 'deals';

const initProducts = [
  { id: 'p_1', name: 'Samsung S25 Ultra', category: 'Mobile', seller: 'TechZone BD', price: '৳ 139,999', status: 'Pending', views: 842 },
  { id: 'p_2', name: 'Vision Smart TV 55"', category: 'Electronics', seller: 'Meena Bazar Online', price: '৳ 68,500', status: 'Live', views: 12840 },
  { id: 'p_3', name: 'Aarong Jamdani Saree', category: 'Fashion', seller: 'Aarong Digital Ltd', price: '৳ 4,200', status: 'Flagged', views: 3210 },
  { id: 'p_4', name: 'Walton 2-Door Fridge', category: 'Home', seller: 'Otobi Furniture', price: '৳ 29,990', status: 'Live', views: 8912 },
];

const initDeals = [
  { id: 'dl_1', name: 'Eid Mega Tech Sale 2026', seller: 'TechZone BD', discount: '30% off', category: 'Electronics', expiry: 'May 31, 2026', clicks: '8,420', status: 'Pending' },
  { id: 'dl_2', name: 'Walton AC Summer Flash', seller: 'Otobi Furniture', discount: '40% off', category: 'Home', expiry: '18h left', clicks: '12,100', status: 'Live' },
  { id: 'dl_3', name: 'Aarong Jamdani Weekend', seller: 'Meena Bazar Online', discount: '20% off', category: 'Fashion', expiry: 'Jun 5, 2026', clicks: '4,240', status: 'Live' },
];

// Initial Mock Datasets
const initSellerRequests = [
  { id: '1', name: 'Aarong Digital Ltd', category: 'Clothing & Lifestyle', status: 'Pending', contact: 'Rahim Uddin', phone: '01711-XXXXXX', submitted: 'May 14, 2026', docs: { license: true, nid: true, bank: false } },
  { id: '2', name: 'TechZone BD', category: 'Electronics & Gadgets', status: 'Pending', contact: 'Kamal Hossain', phone: '01912-XXXXXX', submitted: 'May 15, 2026', docs: { license: true, nid: true, bank: true } },
  { id: '3', name: 'Khaas Food Organic', category: 'Organic Groceries', status: 'Pending', contact: 'Maksud Alam', phone: '01511-XXXXXX', submitted: 'May 18, 2026', docs: { license: true, nid: true, bank: true } },
];

const initActiveSellers = [
  { id: '4', name: 'Meena Bazar Online', category: 'Groceries & FMCG', status: 'Approved', contact: 'Selina Parvin', phone: '01611-XXXXXX', revenue: '৳ 480,000', products: 248, followers: '12,400', rating: '4.8/5.0', growth: '+14% mom' },
  { id: '5', name: 'Anjans Fashion Accent', category: 'Fashion & Apparel', status: 'Approved', contact: 'Shaheen Ahmed', phone: '01811-XXXXXX', revenue: '৳ 620,000', products: 180, followers: '8,920', rating: '4.7/5.0', growth: '+22% mom' },
  { id: '6', name: 'Otobi Furniture', category: 'Home & Living', status: 'Approved', contact: 'Sabbir Hasan', phone: '01712-XXXXXX', revenue: '৳ 1,240,000', products: 95, followers: '6,150', rating: '4.6/5.0', growth: '+9% mom' },
];

const initBannedSellers = [
  { id: '7', name: 'FakeStore BD', category: 'General Merchandise', status: 'Banned', contact: 'Ripon Khan', phone: '01311-XXXXXX', bannedAt: 'May 08, 2026', reason: 'Repeatedly selling replica products & counterfeit goods', logs: 'Deactivated permanently after 3 consumer arbitrations.' },
  { id: '8', name: 'Gadget Scam Mart', category: 'Electronics Copy', status: 'Suspended', contact: 'Fahim Ahmed', phone: '01411-XXXXXX', bannedAt: 'Apr 24, 2026', reason: 'High chargeback rates and fraudulent shipping records', logs: 'Held pending cyber audit investigation.' }
];

const initFlaggedSellers = [
  { 
    id: '9', 
    name: 'FashionBD Co.', 
    category: 'Fashion & Accessories', 
    status: 'Flagged', 
    contact: 'Arif Chowdhury', 
    reportsCount: 14, 
    level: 'High',
    reason: 'Shipping duplicate synthetic sarees instead of pure thread silk', 
    reporterInfo: 'User @nusrat_bd & 13 others',
    timestamp: 'May 19, 2026',
    history: [
      { comment: 'Received absolute low quality lace instead of Jamdani', reporter: '@sultana_j', time: '1d ago' },
      { comment: 'Seller refuse refunds and blocked my customer profile', reporter: '@farhan_s', time: '2d ago' },
    ]
  },
  { 
    id: '10', 
    name: 'ElectroBD Express', 
    category: 'Refurbished Mobiles', 
    status: 'Flagged', 
    contact: 'Munir Patwary', 
    reportsCount: 5, 
    level: 'Medium',
    reason: 'Unverified refurbished batteries listed as brand new stock', 
    reporterInfo: 'User @mahin_619 & 4 others',
    timestamp: 'May 17, 2026',
    history: [
      { comment: 'Battery health was already 68% on day one of purchase', reporter: '@imtiaz_ahmed', time: '3d ago' }
    ]
  }
];

export default function SellersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTab = searchParams.get('tab') || 'requests';
  const activeTab = (searchTab === 'requests' || searchTab === 'active' || searchTab === 'banned' || searchTab === 'flagged' || searchTab === 'performance' || searchTab === 'orders' || searchTab === 'warnings' || searchTab === 'suspended' || searchTab === 'products' || searchTab === 'deals') ? searchTab as ActiveTab : 'requests';

  const setActiveTab = (tab: ActiveTab) => {
    setSearchParams({ tab });
  };
  const [requests, setRequests] = useState(initSellerRequests);
  const [activeSellers, setActiveSellers] = useState(initActiveSellers);
  const [bannedSellers, setBannedSellers] = useState(initBannedSellers);
  const [flaggedSellers, setFlaggedSellers] = useState(initFlaggedSellers);
  const [products, setProducts] = useState(initProducts);
  const [deals, setDeals] = useState(initDeals);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const simulateOnboardingWorkflow = (sellerName: string, category: string, productName: string, price: string, isApproved: boolean) => {
    if (isApproved) {
      // Case 2: Approved Seller -> Auto-approve product
      const newProduct = {
        id: `p_sim_${Date.now()}`,
        name: productName,
        category,
        seller: sellerName,
        price,
        status: 'Live',
        views: 0
      };
      setProducts(prev => [newProduct, ...prev]);
      showToast(`✓ AUTO-APPROVED: Approved Brand "${sellerName}" posted "${productName}". Live instantly without admin review (Case 2 rule).`);
    } else {
      // Case 1: Unapproved Seller -> Dual verification request
      const reqId = `sel_${Date.now()}`;
      const newReq = {
        id: reqId,
        name: sellerName,
        category,
        status: 'Pending',
        contact: 'New Brand Lead',
        phone: '01888-XXXXXXXX',
        submitted: 'Just Now',
        docs: { license: true, nid: true, bank: false }
      };
      const newProduct = {
        id: `p_sim_${Date.now()}`,
        name: productName,
        category,
        seller: sellerName,
        price,
        status: 'Pending',
        views: 0
      };
      setRequests(prev => [newReq, ...prev]);
      setProducts(prev => [newProduct, ...prev]);
      showToast(`⚠️ DUAL VERIFICATION FLOW TRIGGERED: Created Seller Onboarding request AND Pending Product Listing request linked to "${sellerName}" (Case 1 rule).`);
    }
  };

  // State manipulation handlers
  const handleApprove = (id: string) => {
    const promo = requests.find(r => r.id === id);
    if (!promo) return;
    setRequests(requests.filter(r => r.id !== id));
    setActiveSellers([
      ...activeSellers, 
      {
        id: promo.id,
        name: promo.name,
        category: promo.category,
        status: 'Approved',
        contact: promo.contact,
        phone: promo.phone,
        revenue: '৳ 0',
        products: 0,
        followers: '0',
        rating: '5.0/5.0',
        growth: '+0% new'
      }
    ]);
    showToast(`✓ Approved ${promo.name}. They are now converted and listed in the Brands system!`);
  };

  const handleDecline = (id: string) => {
    const p = requests.find(r => r.id === id);
    if (!p) return;
    setRequests(requests.filter(r => r.id !== id));
    setBannedSellers([
      ...bannedSellers,
      {
        id: p.id,
        name: p.name,
        category: p.category,
        status: 'Declined',
        contact: p.contact,
        phone: p.phone,
        bannedAt: 'Today',
        reason: 'Failed initial merchant documentation verification criteria',
        logs: 'Application declined by platform administrator review.'
      }
    ]);
    showToast(`✗ Declined seller application for ${p.name}.`);
  };

  const handleSuspend = (id: string) => {
    const p = activeSellers.find(r => r.id === id);
    if (!p) return;
    setActiveSellers(activeSellers.filter(r => r.id !== id));
    setBannedSellers([
      ...bannedSellers,
      {
        id: p.id,
        name: p.name,
        category: p.category,
        status: 'Banned',
        contact: p.contact,
        phone: p.phone,
        bannedAt: 'Today',
        reason: 'Violated seller terms / Suspended by administrator',
        logs: 'Suspended from active state. Products hidden from client discovery.'
      }
    ]);
    showToast(`🔒 Suspended active seller ${p.name}.`);
  };

  const handleIgnoreFlags = (id: string) => {
    const p = flaggedSellers.find(r => r.id === id);
    if (!p) return;
    setFlaggedSellers(flaggedSellers.filter(r => r.id !== id));
    showToast(`✓ Cleared flags for ${p.name}. Mark as safe.`);
  };

  const handleSuspendFlagged = (id: string) => {
    const p = flaggedSellers.find(r => r.id === id);
    if (!p) return;
    setFlaggedSellers(flaggedSellers.filter(r => r.id !== id));
    setBannedSellers([
      ...bannedSellers,
      {
        id: p.id,
        name: p.name,
        category: p.category,
        status: 'Banned',
        contact: p.contact,
        phone: p.phone,
        bannedAt: 'Today',
        reason: p.reason,
        logs: `Flagged suspension. Triggered by: ${p.reporterInfo}`
      }
    ]);
    showToast(`🔒 Suspended flagged merchant ${p.name} permanently.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {toastMessage && (
        <div className="fixed top-8 right-8 z-[100] bg-[#EB4501] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl tracking-wide uppercase border border-white/10 animate-pulse">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Retail Sellers Control Center</h1>
            <span className="text-[9px] bg-app-accent/15 border border-app-accent/20 text-app-accent-light px-2.5 py-0.5 rounded font-black tracking-widest uppercase">
              Retail Mode
            </span>
          </div>
          <p className="text-app-text-secondary text-[12px]">Unified moderation, brand conversion system, and dynamic merchant performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-app-card border border-app-border rounded-lg px-4 py-2 flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
             <span className="text-[11px] font-bold text-white uppercase tracking-widest">{requests.length} Requests Pending</span>
           </div>
        </div>
      </div>

      {/* 📊 ANALYTICS OVERVIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Core KPIs & Activity Metrics */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h3 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">📈 Core Registry & Activity</h3>
            <span className="text-[9px] bg-white/5 text-app-text-secondary px-2 py-0.5 rounded font-bold">Standard MTD</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block">Seller Requests</span>
              <span className="text-2xl font-bold text-white">{requests.length + 31} <span className="text-[10px] text-green-500 font-mono font-normal">({requests.length} new)</span></span>
            </div>
            <div>
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block">Active Sellers / Brands</span>
              <span className="text-2xl font-bold text-green-400">1,847</span>
            </div>
            <div>
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block">Inactive Sellers</span>
              <span className="text-2xl font-bold text-yellow-500">210</span>
            </div>
            <div>
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block">Banned / Suspended</span>
              <span className="text-2xl font-bold text-red-500">{bannedSellers.length + 7}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-white/[0.02] space-y-1">
            <div className="flex justify-between text-xs text-app-text-secondary">
              <span>System Activity Rate</span>
              <span className="text-white font-semibold flex items-center gap-1">
                384d / 1,120w / 1,640m <span className="text-[9px] text-green-500">Up 12.5%</span>
              </span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-app-accent to-emerald-500 h-full w-[88%]" />
            </div>
          </div>
        </div>

        {/* Popularity & Discovery Metrics */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h3 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">🔥 Popularity & Brands Discovery</h3>
            <span className="text-[9px] bg-white/5 text-app-text-secondary px-2 py-0.5 rounded font-bold">Live</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-app-text-secondary">Most Popular Brands</span>
              <span className="text-white font-bold text-[12px]">Samsung BD, Aarong</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-app-text-secondary">Most Followed Brand</span>
              <span className="text-green-400 font-bold text-[12px]">Aarong Digital (12.4k followers)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-app-text-secondary">Most Searched Brand</span>
              <span className="text-white font-bold text-[12px]">Xiaomi Bangladesh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-app-text-secondary">Highest Viewed Brand</span>
              <span className="text-app-accent-light font-bold text-[12px]">Samsung BD (98k views)</span>
            </div>
          </div>
        </div>

        {/* Behavioral Insights & Timeline */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <h3 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">⚡ Behavioral Timeline & Heatmap</h3>
            <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-bold border border-orange-500/10">Growth Peak</span>
          </div>
          <div className="space-y-3.5">
            <div className="space-y-1">
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest block opacity-50">Top Seller Growth Trend</span>
              <div className="flex justify-between text-xs items-center">
                <span className="text-white font-medium">Anjans Fashion Accent</span>
                <span className="text-emerald-500 font-bold font-mono">+22% mom peak</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest block opacity-50">Recent Platform Logs</span>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[10px] text-app-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>Seller Meena Bazar uploaded 48 new SKUs • 1h ago</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-app-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EB4501]" />
                  <span>Khaas Food submitted Trade License proof • 4h ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-app-border overflow-x-auto scrollbar-hide gap-1 pb-1">
        {[
          { id: 'requests', label: `🆕 Seller Requests (${requests.length})` },
          { id: 'active', label: `🏪 Active Sellers (${activeSellers.length})` },
          { id: 'performance', label: '📈 Seller Performance' },
          { id: 'products', label: `📦 Retail Products (${products.length})` },
          { id: 'deals', label: `🏷️ Retail Deals (${deals.length})` },
          { id: 'orders', label: '📦 Retail Orders' },
          { id: 'flagged', label: `🚩 Flagged Sellers (${flaggedSellers.length})` },
          { id: 'warnings', label: '⚠️ Seller Warnings' },
          { id: 'suspended', label: '🔒 Suspended' },
          { id: 'banned', label: `🚫 Blacklisted Sellers (${bannedSellers.length})` }
        ].map(tb => (
          <button 
            key={tb.id}
            onClick={() => setActiveTab(tb.id as ActiveTab)}
            className={`px-5 py-3.5 border-b-2 text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tb.id 
                ? 'active-tab-item border-app-accent text-app-accent-light bg-app-accent/5' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Dynamic Content Views */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* TAB 1: SELLER REQUESTS */}
        {activeTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requests.length === 0 ? (
              <div className="col-span-2 bg-app-card rounded-2xl border border-app-border p-12 text-center text-app-text-secondary text-xs">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                All seller approval requests have been reviewed!
              </div>
            ) : (
              requests.map((seller) => (
                <div key={seller.id} className="bg-app-card rounded-xl border border-app-border p-6 relative overflow-hidden group hover:border-app-accent/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 bg-app-sidebar border border-app-border rounded-lg flex items-center justify-center">
                          <Building2 className="text-app-accent-light w-6 h-6" />
                        </div>
                        <div>
                          <Link to={`/admin/sellers/pending/${seller.id}`}>
                            <h3 className="text-[16px] font-bold text-white tracking-tight group-hover:text-app-accent-light transition-colors">{seller.name}</h3>
                          </Link>
                          <p className="text-[11px] text-app-text-secondary font-medium">{seller.category}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-widest bg-orange-500/10 text-orange-500 border border-orange-500/10">
                        {seller.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
                       <div className="space-y-1">
                          <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Contact Agent</span>
                          <span className="block text-[13px] font-semibold text-white">{seller.contact}</span>
                       </div>
                       <div className="space-y-1">
                          <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Phone Registry</span>
                          <span className="block text-[13px] font-semibold text-white truncate">{seller.phone}</span>
                       </div>
                       <div className="space-y-1">
                          <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Application Date</span>
                          <span className="block text-[13px] font-bold text-app-accent-light">{seller.submitted}</span>
                       </div>
                       <div className="space-y-1">
                          <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Verifications</span>
                          <span className="block text-[13px] font-semibold text-emerald-400">Credentials Present</span>
                       </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                      <DocBadge label="Trade License" verified={seller.docs.license} />
                      <DocBadge label="NID Verified" verified={seller.docs.nid} />
                      <DocBadge label="Bank Verified" verified={seller.docs.bank} />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleApprove(seller.id)}
                      className="flex-1 py-2.5 bg-[#EB4501] hover:bg-[#EB4501]/85 text-white rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#EB4501]/20 active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4" /> 
                      <span>Approve & Convert</span>
                    </button>
                    <button 
                      onClick={() => handleDecline(seller.id)}
                      className="flex-1 py-2.5 bg-white/5 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> 
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE SELLERS / BRANDS */}
        {activeTab === 'active' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeSellers.map((seller) => (
              <div key={seller.id} className="bg-app-card rounded-xl border border-app-border p-6 relative overflow-hidden group hover:border-app-accent/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 bg-app-sidebar border border-app-border rounded-lg flex items-center justify-center">
                        <Building2 className="text-app-accent-light w-6 h-6" />
                      </div>
                      <div>
                        <Link to={`/admin/sellers/${seller.id}`}>
                          <h3 className="text-[16px] font-bold text-white tracking-tight group-hover:text-app-accent-light transition-colors">{seller.name}</h3>
                        </Link>
                        <p className="text-[11px] text-app-text-secondary font-medium">{seller.category} • <span className="text-green-500 font-bold uppercase tracking-wide text-[9px]">Verified Brand</span></p>
                      </div>
                    </div>
                    <span className="text-[9px] px-2.5 py-1 rounded font-bold uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">
                      Active Brand
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
                     <div className="space-y-1">
                        <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Authorized Agent</span>
                        <span className="block text-[13px] font-semibold text-white">{seller.contact}</span>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Active Catalog</span>
                        <span className="block text-[13px] font-semibold text-white">{seller.products} SKU Items</span>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Followers & Love</span>
                        <span className="block text-[13px] font-bold text-app-accent-light">{seller.followers} followers</span>
                     </div>
                     <div className="space-y-1">
                        <span className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold opacity-50">Performance Rating</span>
                        <span className="block text-[13px] font-bold text-white flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" /> {seller.rating} <span className="text-[9px] text-green-400">({seller.growth})</span>
                        </span>
                     </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link 
                    to={`/admin/sellers/${seller.id}`}
                    className="flex-1 py-2 bg-white/5 border border-app-border text-white hover:text-app-accent-light hover:bg-app-accent/5 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all text-center"
                  >
                    <Eye className="w-4 h-4" /> 
                    <span>Developer Sandbox</span>
                  </Link>
                  <button 
                    onClick={() => handleSuspend(seller.id)}
                    className="flex-1 py-2 bg-white/5 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <Lock className="w-4 h-4" /> 
                    <span>Deactivate</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: BANNED AND DEACTIVATED */}
        {activeTab === 'banned' && (
          <div className="bg-app-card rounded-2xl border border-app-border overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02] border-b border-app-border">
                  <tr>
                    <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Banned / Suspended Seller</th>
                    <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Primary Rep</th>
                    <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Incident Timeline</th>
                    <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Audit & Enforcement Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[13px]">
                  {bannedSellers.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
                            <UserX className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-[14px]">{s.name}</div>
                            <div className="text-[10px] text-app-text-secondary">{s.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="block font-semibold text-white">{s.contact}</span>
                        <span className="text-[10px] text-app-text-secondary">{s.phone}</span>
                      </td>
                      <td className="p-6 font-mono text-[11px] text-red-400">
                        Banned: {s.bannedAt}
                      </td>
                      <td className="p-6">
                        <span className="block text-white text-xs font-semibold leading-relaxed">{s.reason}</span>
                        <span className="block text-[10px] text-[#EB4501] mt-1 font-semibold italic">{s.logs}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: FLAGGED SELLERS MODERATION */}
        {activeTab === 'flagged' && (
          <div className="space-y-6">
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="block font-bold text-white uppercase tracking-wider">🔒 Moderation Isolation Protocol</span>
                <p className="text-app-text-secondary leading-relaxed">
                  The merchants listed below have crossed the system threshold limit for active risk parameters or multiple customer fraud complaints. 
                  Investigation must occur immediately before full shop deactivation is completed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {flaggedSellers.length === 0 ? (
                <div className="col-span-2 bg-app-card rounded-2xl border border-app-border p-12 text-center text-app-text-secondary text-xs">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  Pristine Status! No seller/brand accounts currently flagged by customers.
                </div>
              ) : (
                flaggedSellers.map((item) => (
                  <div key={item.id} className="bg-app-card rounded-xl border border-red-500/20 p-6 flex flex-col justify-between hover:border-red-500/40 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#EB4501]">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-white tracking-tight leading-snug">{item.name}</h4>
                            <span className="text-[10px] text-app-text-secondary">{item.category} • Rep: {item.contact}</span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-extrabold tracking-widest uppercase border px-2 py-0.5 rounded ${
                          item.level === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {item.level} Severity
                        </span>
                      </div>

                      {/* Flag Trigger Cause */}
                      <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3.5 mb-4 text-xs">
                        <div className="flex items-center justify-between font-bold uppercase text-[9px] tracking-wider text-app-text-secondary mb-1">
                          <span>Primary Reported Reason</span>
                          <span className="text-red-400">{item.reportsCount} Reports Live</span>
                        </div>
                        <p className="text-white font-medium leading-relaxed">{item.reason}</p>
                        <div className="text-[9px] text-app-text-secondary mt-2">
                          Submitted by: <span className="text-white font-semibold">{item.reporterInfo}</span> • {item.timestamp}
                        </div>
                      </div>

                      {/* Complaint History Log list */}
                      <div className="mb-6">
                        <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block mb-2">Complaint History Timeline</span>
                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                          {item.history.map((log, lidx) => (
                            <div key={lidx} className="bg-white/5 rounded p-2.5 text-[11px] border-l-[3px] border-[#EB4501]">
                              <div className="flex justify-between text-[10px] font-medium text-app-text-secondary mb-1">
                                <span>Reporter: {log.reporter}</span>
                                <span>{log.time}</span>
                              </div>
                              <p className="text-white italic leading-relaxed">"{log.comment}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleIgnoreFlags(item.id)}
                        className="flex-1 py-2 border border-app-border text-app-text-secondary hover:text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        Ignore Cases
                      </button>
                      <button 
                        onClick={() => {
                          showToast(`✓ Investigation ticket initialized for ${item.name}. Status set to UNDER_PLATFORM_AUDIT.`);
                        }}
                        className="flex-1 py-2 bg-white/5 border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 rounded-lg text-[11px] font-bold transition-all"
                      >
                        Investigate SKU
                      </button>
                      <button 
                        onClick={() => handleSuspendFlagged(item.id)}
                        className="flex-1 py-2 bg-red-500/15 border border-red-500/30 text-red-500 hover:bg-red-500/30 rounded-lg text-[11px] font-bold transition-all"
                      >
                        Deactivate Store
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SELLER PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="bg-app-card rounded-xl border border-app-border p-6 space-y-4 text-white">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Merchant SLA Performance Metrics</span>
            <p className="text-xs text-app-text-secondary">Track standard shipping, fulfillment rate, reject percentages, and user ratings metrics live.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'Meena Bazar Online', speed: '98.5% shipped within 24h', reject: '0.2% Cancel rate', score: 'Level A+' },
                { name: 'Anjans Fashion Hub', speed: '94.2% shipped within 24h', reject: '1.1% Cancel rate', score: 'Level A' },
                { name: 'Otobi Furniture', speed: '85.4% shipped within 72h', reject: '2.5% Cancel rate', score: 'Level B' }
              ].map((perf, i) => (
                <div key={i} className="p-4 bg-app-bg rounded-lg border border-white/[0.02]">
                  <span className="font-bold text-white text-xs block">{perf.name}</span>
                  <div className="text-[11px] text-slate-500 space-y-1 mt-2">
                    <p>Dispatch Speed: <strong className="text-white">{perf.speed}</strong></p>
                    <p>Defects rate: <strong className="text-white">{perf.reject}</strong></p>
                    <p>Rank Badge: <strong className="text-app-accent-light">{perf.score}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: RETAIL ORDERS WITH SPLIT SHIPMENT & COD RISK */}
        {activeTab === 'orders' && (
          <div className="bg-app-card rounded-xl border border-app-border p-6 space-y-4 text-white">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Retail orders splits & COD indicators</span>
            <div className="space-y-3">
              {[
                { id: 'ORD-9021', buyer: 'Nusrat Jahan', items: 'Jamdani Saree & Premium Jhumka Pair', total: '৳ 6,800', splits: 2, codRisk: 'High', msg: 'Multiple same-day pending COD requests' },
                { id: 'ORD-9022', buyer: 'Mahmudul Hasan', items: 'Panjabi cotton premium collection x1', total: '৳ 2,400', splits: 1, codRisk: 'Low', msg: 'Verified mobile billing profile' }
              ].map((ord, idx) => (
                <div key={idx} className="p-4 bg-app-bg rounded-xl border border-app-border flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{ord.buyer}</span>
                      <span className="text-[9px] font-mono text-slate-500">ID: {ord.id}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Package contains: {ord.items} • Total: <strong className="text-white font-sans">{ord.total}</strong></p>
                    <span className="text-[9px] text-[#A2A9B2] block mt-1 italic font-semibold border-t border-white/[0.02] pt-1">
                      COD Abuse risk: <span className={ord.codRisk === 'High' ? 'text-red-500 font-bold' : 'text-emerald-400 font-bold'}>{ord.codRisk} ({ord.msg})</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] bg-app-accent/10 border border-app-accent/25 text-app-accent-light px-2.5 py-0.5 rounded font-black font-mono">
                      ROUTED_SPLITS: {ord.splits}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: SELLER WARNING CENTRE */}
        {activeTab === 'warnings' && (
          <div className="bg-app-card rounded-xl border border-app-border p-6 space-y-4 text-white">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">warnings registry locker</span>
            <div className="space-y-3.5">
              {[
                { firm: 'FashionBD Co.', warningText: 'Issued warning for shipping replica synthetic cotton instead of pure Jamdani silk thread.', date: '1d ago', level: 'Level 2 Audit Warning' }
              ].map((warn, i) => (
                <div key={i} className="p-4 bg-app-bg rounded-xl border border-yellow-500/10 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-xs block">{warn.firm}</span>
                    <p className="text-[11px] text-slate-400 mt-1">{warn.warningText}</p>
                    <span className="text-[9px] text-slate-500 block mt-1">Authorized on: {warn.date}</span>
                  </div>
                  <span className="text-[9px] font-bold bg-yellow-500/15 text-orange-400 px-2 py-0.5 rounded font-mono uppercase">
                    {warn.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: SUSPENDED RETAIL MERCHANTS */}
        {activeTab === 'suspended' && (
          <div className="bg-app-card rounded-xl border border-app-border p-6 space-y-4 text-white">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Suspended Merchants Database</span>
            <div className="space-y-3">
              {[
                { name: 'Gadget Scam Mart', category: 'Consumer Electronics', suspendedOn: 'Apr 24, 2026', reason: 'Abnormally high order cancel logs & chargebacks' }
              ].map((susp, i) => (
                <div key={i} className="p-4 bg-app-bg rounded-xl border border-red-500/10 flex justify-between items-center hover:border-red-500/20 transition-all">
                  <div>
                    <span className="font-bold text-white text-xs block">{susp.name}</span>
                    <span className="text-[10px] text-slate-500 block">{susp.category} • Deactivated on {susp.suspendedOn}</span>
                    <p className="text-[11px] text-red-400 mt-1.5 italic font-semibold">Security grounds: "{susp.reason}"</p>
                  </div>
                  <button 
                    onClick={() => {
                      showToast(`✓ Active status restored for ${susp.name}. Listing cache purged.`);
                    }}
                    className="p-1 px-3 bg-green-500 text-white font-extrabold text-[10px] rounded hover:scale-102 cursor-pointer"
                  >
                    Restore Store
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: RETAIL PRODUCTS WITH WORKFLOW AUTO-APPROVAL SIMULATOR */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Case Simulation Board */}
            <div className="bg-[#EB4501]/5 border border-[#EB4501]/15 rounded-2xl p-6 text-white space-y-4">
              <span className="text-[10px] bg-[#EB4501]/10 border border-[#EB4501]/25 text-[#EB4501] px-2.5 py-1 rounded font-black tracking-widest uppercase block w-fit">
                WORKFLOW SIMULATOR — CASE 1 & CASE 2 RULES
              </span>
              <h3 className="text-md font-bold text-white tracking-tight">Interactive Seller Lifecycle & Auto-Approval Engine</h3>
              <p className="text-xs text-app-text-secondary leading-relaxed">
                Experience unified seller onboarding logic directly. Submit products from an <strong>Approved Brand</strong> (such as <em>Meena Bazar Online</em>) to trigger <strong>Case 2 Auto-Approval</strong>, or submit from a <strong>New Seller</strong> to see <strong>Case 1 Dual Verification Pending Request</strong> creation in real-time.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-app-bg/50 rounded-xl p-4 border border-white/[0.04] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Test Scenario A (Approved Brand)</span>
                    <span className="text-[8px] bg-green-500/10 text-green-400 uppercase font-black px-2 py-0.5 rounded border border-green-500/20">Case 2 rule</span>
                  </div>
                  <p className="text-[11px] text-[#A2A9B2]">Post product as approved brand <strong className="text-white">Meena Bazar Online</strong>. It is posted instantly without any admin review or manual moderation.</p>
                  <button
                    onClick={() => simulateOnboardingWorkflow('Meena Bazar Online', 'Groceries & FMCG', 'Organic Premium Mangoes (Export Quality)', '৳ 350', true)}
                    className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-[11px] rounded-lg transition-all"
                  >
                    Simulate Case 2 Product Post
                  </button>
                </div>

                <div className="bg-app-bg/50 rounded-xl p-4 border border-white/[0.04] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Test Scenario B (New Unregistered Seller)</span>
                    <span className="text-[8px] bg-orange-500/10 text-orange-400 uppercase font-black px-2 py-0.5 rounded border border-orange-500/20">Case 1 rule</span>
                  </div>
                  <p className="text-[11px] text-[#A2A9B2]">Post product as <strong className="text-white">Jamuna Electronics BD</strong>. Triggers seller approval and product pending status dual listing queues.</p>
                  <button
                    onClick={() => simulateOnboardingWorkflow('Jamuna Electronics BD', 'Electronics & Appliances', 'Jamuna Smart Split AC 1.5Ton', '৳ 54,000', false)}
                    className="w-full py-2 bg-[#EB4501] hover:bg-[#EB4501]/90 text-white font-bold text-[11px] rounded-lg transition-all"
                  >
                    Simulate Case 1 Product Post (Dual Queue)
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory table */}
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Active Catalog & Moderation Desk</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-white">
                  <thead>
                    <tr className="border-b border-app-border/60 text-slate-500 font-bold">
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Product Name</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Authorized Seller</th>
                      <th className="py-2.5">Unit Price</th>
                      <th className="py-2.5">SLA Check Ratio</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-mono text-[10px] text-slate-500">{p.id}</td>
                        <td className="py-3 font-bold">{p.name}</td>
                        <td className="py-3 text-[11px] text-slate-300">{p.category}</td>
                        <td className="py-3 font-extrabold text-[#EB4501]">{p.seller}</td>
                        <td className="py-3 font-mono font-bold">{p.price}</td>
                        <td className="py-3 font-mono text-[10px] text-emerald-400">99.2% green</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            p.status === 'Live' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            p.status === 'Pending' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400 animate-pulse' :
                            'bg-red-500/10 border border-red-500/20 text-red-500'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {p.status === 'Pending' && (
                              <button 
                                onClick={() => {
                                  setProducts(prev => prev.map(item => item.id === p.id ? { ...item, status: 'Live' } : item));
                                  showToast(`✓ Product "${p.name}" has been approved and published to client marketplace!`);
                                }}
                                className="px-2 py-1 bg-green-500 text-white font-bold text-[10px] rounded hover:scale-102"
                              >
                                Approve
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setProducts(products.filter(item => item.id !== p.id));
                                showToast(`✓ Deleted product "${p.name}" from active list.`);
                              }}
                              className="px-2 py-1 bg-white/5 border border-white/5 hover:border-red-500/20 hover:text-red-500 text-[10px] rounded text-slate-400 transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 10: RETAIL DEALS */}
        {activeTab === 'deals' && (
          <div className="space-y-6">
            <div className="bg-[#EB4501]/5 border border-[#EB4501]/15 rounded-xl p-5 text-white flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">Interactive Retail Deal Room</h4>
                <p className="text-[11px] text-app-text-secondary mt-1">
                  Manage seller-specific flash campaigns, coupon pools, and auto-approval rules. Deals are checked against active seller status.
                </p>
              </div>
              <button
                onClick={() => {
                  const newDl = {
                    id: `dl_${Date.now()}`,
                    name: 'Simulated 50% AC Flash Discount',
                    seller: 'Otobi Furniture',
                    discount: '50% off',
                    category: 'Home',
                    expiry: '2 days left',
                    clicks: '0',
                    status: 'Live'
                  };
                  setDeals(prev => [newDl, ...prev]);
                  showToast('✓ Simulated active retail discount deal created for Otobi Furniture!');
                }}
                className="px-4 py-2 bg-[#EB4501] hover:bg-[#EB4501]/90 rounded-lg text-xs font-mono font-bold text-white shrink-0 active:scale-95"
              >
                + Simulate Direct Deal
              </button>
            </div>

            <div className="bg-app-card border border-app-border rounded-xl p-5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2 mb-3">Flash Deals Pipeline Directory</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-white">
                  <thead>
                    <tr className="border-b border-app-border text-slate-500 font-bold">
                      <th className="py-2.5">Deal Details</th>
                      <th className="py-2.5">Seller</th>
                      <th className="py-2.5">Campaign Category</th>
                      <th className="py-2.5">Discount Ratio</th>
                      <th className="py-2.5">Remaining Lifetime</th>
                      <th className="py-2.5 text-center">Interactions Count</th>
                      <th className="py-2.5">Status Check</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {deals.map(dl => (
                      <tr key={dl.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-bold">{dl.name}</td>
                        <td className="py-3 font-semibold text-[#EB4501]">{dl.seller}</td>
                        <td className="py-3 text-[11px] text-slate-300">{dl.category}</td>
                        <td className="py-3">
                          <span className="bg-red-500/20 text-red-500 border border-red-500/20 font-black px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {dl.discount}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-orange-400">{dl.expiry}</td>
                        <td className="py-3 text-center font-mono text-slate-300">{dl.clicks || 0}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            dl.status === 'Live' ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' :
                            'bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 animate-pulse'
                          }`}>
                            {dl.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {dl.status === 'Pending' && (
                              <button 
                                onClick={() => {
                                  setDeals(prev => prev.map(item => item.id === dl.id ? { ...item, status: 'Live' } : item));
                                  showToast(`✓ Deal campaign "${dl.name}" is now live!`);
                                }}
                                className="px-2 py-1 bg-green-500 text-white font-bold text-[10px] rounded hover:scale-102"
                              >
                                Activate
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setDeals(deals.filter(item => item.id !== dl.id));
                                showToast(`✓ Deal campaign "${dl.name}" closed.`);
                              }}
                              className="px-2 py-1 bg-white/5 text-slate-400 text-[10px] hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                            >
                              Terminate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function DocBadge({ label, verified }: { label: string, verified: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all ${
      verified 
        ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
        : 'bg-white/5 text-app-text-secondary border border-white/5 opacity-50'
    }`}>
      {verified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );
}
