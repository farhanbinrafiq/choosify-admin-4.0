import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useContact } from '../../../contexts/ContactInteractionContext';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Package,
  FileText,
  Percent
} from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  stock: number;
  price: string;
  revenue: string;
  status: 'Live' | 'Reviewing' | 'Flagged';
  views: string;
  thumbnail: string;
}

interface ProductGroup {
  date: string;
  batchId: string;
  items: ProductItem[];
}

interface Activity {
  iconType: 'chat' | 'rating' | 'order' | 'warning';
  title: string;
  subtitle: string;
}

interface SellerProfileData {
  id: string;
  name: string;
  owner: string;
  status: 'Approved' | 'Suspended' | 'Pending';
  verificationStatus: 'Verified Merchant' | 'Unverified';
  avatarUrl: string;
  category: string;
  email: string;
  address: string;
  phone: string;
  lastActive: string;
  revenue: string;
  productCount: number;
  reputation: string;
  conversionRate: string;
  fulfillmentRate: string;
  returnRate: string;
  recentActivities: Activity[];
  productGroups: ProductGroup[];
  payoutStatus: string;
}

export default function SellerProfile() {
  const { id } = useParams();
  const { triggerPhone, triggerMessage } = useContact();
  const [activeTab, setActiveTab] = useState<'All' | 'Live' | 'Reviewing' | 'Flagged'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const profilesData: Record<string, SellerProfileData> = {
    '2': {
      id: '2',
      name: 'Nadia Akter',
      owner: 'Nadia Akter',
      status: 'Approved',
      verificationStatus: 'Verified Merchant',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
      category: 'Core Merchant / Fashion',
      email: 'nadia.akter@choosify.com',
      address: '4140 Parker Rd. Allentown, New Mexico 31134',
      phone: '+222 01 414 8447',
      lastActive: 'Within 24 hours',
      revenue: '৳ 14.8M',
      productCount: 342,
      reputation: '4.8 rating',
      conversionRate: '8.2%',
      fulfillmentRate: '99.1%',
      returnRate: '0.8%',
      payoutStatus: 'Priority Fast-track',
      recentActivities: [
        { iconType: 'order', title: 'Product Inventory Updated', subtitle: 'Friday, Sep 6, 2026 | 12:24am' },
        { iconType: 'chat', title: 'Support Call Resolved', subtitle: 'Friday, Sep 6, 2026 | 10:15am' },
        { iconType: 'rating', title: '5 Star Customer review', subtitle: 'Thursday, Sep 5, 2026 | 09:30pm' }
      ],
      productGroups: [
        {
          date: 'Date of Update 10 May, 2026',
          batchId: 'Catalog Batch: CAT-342',
          items: [
            {
              id: 'p-nadia-1',
              name: 'Samsung Galaxy S24 Ultra',
              stock: 45,
              price: '৳ 139,999',
              revenue: '৳ 2.4M',
              status: 'Live',
              views: '12.4K clicks',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        },
        {
          date: 'Date of Update 02 Apr, 2026',
          batchId: 'Catalog Batch: CAT-340',
          items: [
            {
              id: 'p-nadia-2',
              name: 'Sony PlayStation 5 Slim',
              stock: 12,
              price: '৳ 62,500',
              revenue: '৳ 1.8M',
              status: 'Live',
              views: '8.2K clicks',
              thumbnail: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    },
    '4': {
      id: '4',
      name: 'Meena Bazar Online',
      owner: 'Selina Parvin',
      status: 'Approved',
      verificationStatus: 'Verified Merchant',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
      category: 'Groceries & FMCG',
      email: 'meena.online@fmcg.bd',
      address: 'House 32, Sector 4, Uttara, Dhaka, Bangladesh',
      phone: '+880 1611-334455',
      lastActive: 'Today | 2 hr ago',
      revenue: '৳ 4.8M',
      productCount: 248,
      reputation: '4.8 rating',
      conversionRate: '9.4%',
      fulfillmentRate: '98.5%',
      returnRate: '1.2%',
      payoutStatus: 'Weekly Settlement',
      recentActivities: [
        { iconType: 'order', title: 'Batch restock completed', subtitle: 'Today | 11:15am' },
        { iconType: 'chat', title: 'Custom delivery flow activated', subtitle: 'Yesterday | 03:22pm' }
      ],
      productGroups: [
        {
          date: 'Date of Update 08 Jun, 2026',
          batchId: 'Catalog Batch: CAT-248',
          items: [
            {
              id: 'p-meena-1',
              name: 'Organic Premium Basmati Rice',
              stock: 154,
              price: '৳ 1,200',
              revenue: '৳ 420K',
              status: 'Live',
              views: '24.1K clicks',
              thumbnail: 'https://images.unsplash.com/photo-1597983073492-bc24159b4c03?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    }
  };

  const profile = profilesData[id || ''] || profilesData['2'];

  const getFilteredGroups = () => {
    return profile.productGroups
      .map(group => {
        const filteredItems = group.items.filter(item => {
          let tabMatch = true;
          if (activeTab === 'Live') tabMatch = item.status === 'Live';
          else if (activeTab === 'Reviewing') tabMatch = item.status === 'Reviewing'; 
          else if (activeTab === 'Flagged') tabMatch = item.status === 'Flagged';

          const s = searchQuery.toLowerCase();
          const searchMatch = !searchQuery || 
            item.name.toLowerCase().includes(s) || 
            group.batchId.toLowerCase().includes(s) || 
            item.status.toLowerCase().includes(s);

          return tabMatch && searchMatch;
        });

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'rating':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <Star className="w-4 h-4 text-app-accent-light" fill="currentColor" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <ShoppingBag className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <Link to="/admin/consumers" className="hover:text-app-accent transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <Link to="/admin/consumers?tab=sellers" className="hover:text-app-accent transition-colors">Users</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">
              {profile.name} (Seller)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Seller Management</h1>
          <p className="text-app-text-secondary text-[12px]">Complete over-the-horizon oversight of merchant activity and operational health metrics</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Link 
            to={`/admin/sellers/${profile.id}/dashboard`}
            className="px-3.5 py-2 bg-app-accent text-white hover:bg-app-accent-light rounded-[4px] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Seller Dashboard Preview</span>
          </Link>
          <Link 
            to="/admin/consumers?tab=sellers"
            className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent" />
            <span>All Sellers</span>
          </Link>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Seller profile card & recent activities */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Profile Identity Card */}
          <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
            
            {/* Top Banner gradient compatible with Choosify colors */}
            <div className="h-24 bg-gradient-to-r from-orange-600/30 via-app-card to-app-gradient-end opacity-90 relative" />

            {/* Profile Avatar & Details Box */}
            <div className="px-5 pb-5 relative">
              
              <div className="-mt-10 mb-4 flex items-end justify-between">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name}
                  className="w-20 h-20 rounded-[4px] border-2 border-app-border object-cover bg-app-card shrink-0 shadow-lg" 
                />

                {/* Styled action triggers */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => triggerPhone({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Seller' })}
                    className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                    title="Call Seller"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => triggerMessage({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Seller' })}
                    className="p-2 rounded-[4px] bg-app-accent text-white hover:bg-app-accent-light transition-all shadow-sm cursor-pointer"
                    title="Message Seller"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Identity Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold tracking-tight text-white">{profile.name}</h2>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-orange-500/10 text-orange-400 border-orange-500/20">
                    {profile.verificationStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-green-500/10 text-green-400 border-green-500/20">
                    {profile.status}
                  </span>
                </div>
                <p className="text-[9.5px] font-bold tracking-wider text-app-text-secondary uppercase bg-white/5 px-2 py-1 rounded-[2px] inline-block">
                  {profile.category}
                </p>
              </div>

              {/* Seller 360 Information Fields */}
              <div className="mt-5 space-y-3.5 pt-4 border-t border-white/[0.04]">
                
                <div>
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Store Email Contact
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.email}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Registered Officer (NID / KYC Verified)
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.owner}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Merchant Warehousing Address
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block leading-relaxed line-clamp-2" title={profile.address}>
                    {profile.address}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Merchant Phone Line
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono">
                    {profile.phone}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Last active timestamp
                  </label>
                  <span className="text-xs text-app-accent-light font-bold mt-0.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{profile.lastActive}</span>
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Operational Health KPIs */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center justify-between">
              <span>Operational Risk Health</span>
              <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-[2px] border border-amber-500/20">COMPLIANT</span>
            </h3>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Fulfillment Rate</div>
                <div className="text-sm font-bold text-green-400 mt-0.5 font-mono">{profile.fulfillmentRate}</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Consumer Return Rate</div>
                <div className="text-sm font-bold text-amber-500 mt-0.5 font-mono">{profile.returnRate}</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Settlement Plan</div>
                <div className="text-[11px] font-bold text-white mt-0.5 truncate">{profile.payoutStatus}</div>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-[3px] border border-white/[0.02]">
                <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider">Audit Reputation</div>
                <div className="text-sm font-bold text-green-400 mt-0.5 font-mono">{profile.reputation}</div>
              </div>
            </div>
          </div>

          {/* Recent Activities Timeline card */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Recent Activity Trail
            </h3>

            <div className="space-y-3 pt-1">
              {profile.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start p-1.5 hover:bg-white/[0.01] transition-all rounded-[3px]">
                  {getActivityIcon(act.iconType)}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <p className="text-[9.5px] text-app-text-secondary font-mono mt-0.5">{act.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Search controls, metric cards & Products list */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input box */}
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
              <input 
                type="text" 
                placeholder="Search products, catalog id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/[0.02] border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
              />
            </div>

            {/* Date Filtering and Export dot button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={() => showToast('Refined inventory report dates', 'success')}
                className="px-3.5 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary flex items-center gap-1.5 hover:border-app-accent hover:text-white shadow-sm transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-app-accent" />
                <span>Select Inventory Cycle</span>
              </button>
              
              <button 
                onClick={() => showToast('Exported CSV record queue', 'success')}
                className="p-1.5 bg-app-card border border-app-border rounded-[4px] hover:border-app-accent hover:text-white text-app-text-secondary shadow-sm transition-all cursor-pointer"
                title="Action Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* METRIC CARDS ROW - EXACTLY ALIGNED */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Revenue LTV */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Total Revenue Sales</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.revenue}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  Growth: +12.4% mom
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 25 Q 25 10, 45 35 T 85 15 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Product count stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Live Products Catalog</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.productCount} skus
                </span>
                <span className="text-[9px] text-app-text-secondary block font-medium">
                  Active in shop directory
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10 Q 30 35, 55 15 T 85 30 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Conversion stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Listing Conversion</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.conversionRate} avg
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  Excellent checkout conversion
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-app-accent" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 30 Q 25 5, 45 25 T 85 10 T 95 5" />
                </svg>
              </div>
            </div>

          </div>

          {/* SELLER CATALOG PANEL */}
          <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5">
            
            {/* Table Header and Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Store Catalog listings
              </span>

              {/* Underlying Tab Switchers */}
              <div className="flex flex-wrap items-center gap-1">
                {(['All', 'Live', 'Reviewing', 'Flagged'] as const).map((tab) => {
                  let count = 0;
                  if (tab === 'All') {
                    count = profile.productGroups.reduce((sum, g) => sum + g.items.length, 0);
                  } else {
                    count = profile.productGroups.reduce((sum, g) => sum + g.items.filter(i => i.status === tab).length, 0);
                  }

                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                          : 'text-app-text-secondary hover:text-white'
                      }`}
                    >
                      <span className="mr-1">
                        {tab === 'All' ? 'All Products' : tab}
                      </span>
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Table layout matching Choosify look */}
            {filteredGroups.length > 0 ? (
              <div className="space-y-4">
                
                {/* Headers */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/[0.04]">
                  <div className="col-span-6">Catalog SKU Details</div>
                  <div className="col-span-2 text-right">Selling Price</div>
                  <div className="col-span-2 pl-4">Sales LTV</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {/* Date groups */}
                <div className="space-y-6">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-3">
                      
                      {/* Date Indicator Line */}
                      <div className="flex items-center justify-between border-b border-dashed border-white/[0.04] pb-1.5 font-mono text-[10px]">
                        <span className="text-app-text-secondary font-bold uppercase">
                          {group.date}
                        </span>
                        <span className="text-white font-semibold">
                          {group.batchId}
                        </span>
                      </div>

                      {/* Items loop */}
                      <div className="space-y-2.5">
                        {group.items.map((item) => (
                          <div 
                            key={item.id}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-white/[0.02]"
                          >
                            {/* Product column */}
                            <div className="col-span-1 md:col-span-6 flex items-center gap-3">
                              <img 
                                src={item.thumbnail} 
                                alt={item.name}
                                className="w-12 h-12 rounded-[4px] object-cover bg-white/5 border border-white/10 shrink-0 shadow-sm" 
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                                <p className="text-[10px] text-app-text-secondary font-medium truncate">
                                  SKU: {item.id} | Stock: {item.stock} in warehouse
                                </p>
                              </div>
                            </div>

                            {/* Price column */}
                            <div className="col-span-1 md:col-span-2 md:text-right">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Price</span>
                              <span className="text-xs font-bold text-white font-mono">
                                {item.price}
                              </span>
                            </div>

                            {/* Revenue Column */}
                            <div className="col-span-1 md:col-span-2 md:pl-4">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Sales LTV</span>
                              <span className="text-[11px] font-bold text-app-accent-light">
                                {item.revenue}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="col-span-1 md:col-span-2 md:text-right flex md:justify-end">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mr-2 mb-0.5">Status</span>
                              {item.status === 'Reviewing' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-app-accent/20 text-app-accent border border-app-accent/30 shrink-0 w-24 text-center">
                                  Reviewing
                                </span>
                              )}
                              {item.status === 'Live' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border-green-500/20 shrink-0 w-24 text-center">
                                  Live
                                </span>
                              )}
                              {item.status === 'Flagged' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border-red-500/20 shrink-0 w-24 text-center">
                                  Flagged
                                </span>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center space-y-2 bg-white/[0.01] rounded-[4px] border border-dashed border-white/[0.04]">
                <ShoppingBag className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
                <h4 className="text-xs font-bold text-white">No products match filter selection</h4>
                <p className="text-[11px] text-app-text-secondary opacity-60">Try selecting another filter status or refining query keywords</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
