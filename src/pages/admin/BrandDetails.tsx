import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  ArrowLeft, 
  Package, 
  Star, 
  TrendingUp, 
  Users, 
  Calendar, 
  Globe, 
  Eye, 
  MousePointer2, 
  BarChart3,
  ExternalLink,
  Ban,
  CheckCircle2,
  ChevronRight,
  User
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';

const analyticsData = [
  { name: 'Mon', views: 2400, clicks: 400, conv: 2.1 },
  { name: 'Tue', views: 1398, clicks: 300, conv: 1.8 },
  { name: 'Wed', views: 9800, clicks: 2000, conv: 2.5 },
  { name: 'Thu', views: 3908, clicks: 800, conv: 2.2 },
  { name: 'Fri', views: 4800, clicks: 1200, conv: 2.8 },
  { name: 'Sat', views: 3800, clicks: 1100, conv: 2.6 },
  { name: 'Sun', views: 4300, clicks: 1300, conv: 2.9 },
];

const mockBrandProducts = [
  { id: '101', name: 'Galaxy S24 Ultra', price: '৳ 142,999', rating: 4.9, stock: 'In Stock', visibility: 'Live', image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80' },
  { id: '102', name: 'Galaxy Watch 6', price: '৳ 32,500', rating: 4.7, stock: 'In Stock', visibility: 'Live', image: 'https://images.unsplash.com/photo-1544117518-30dd5f2f309e?w=400&q=80' },
  { id: '103', name: 'Galaxy Buds 2 Pro', price: '৳ 18,900', rating: 4.8, stock: 'Low Stock', visibility: 'Live', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&q=80' },
  { id: '104', name: 'Samsung 65" QLED TV', price: '৳ 185,000', rating: 4.6, stock: 'Out of Stock', visibility: 'Hidden', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&q=80' },
];

export default function BrandDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-app-card border border-app-border rounded-2xl text-app-text-secondary hover:text-white transition-all shadow-xl active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-2xl border border-white/10">
              SB
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Samsung Bangladesh</h1>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                  isActive 
                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {isActive ? 'Active' : 'Deactivated'}
                </span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                   <ShieldCheck className="w-3 h-3" /> VERIFIED
                </span>
              </div>
              <p className="text-app-text-secondary text-sm mt-1">Electronics · Mobile · Smart Home Ecosystem</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
           <button 
              onClick={() => setIsActive(!isActive)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                isActive 
                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-red-500 hover:text-white' 
                  : 'bg-green-500 text-white border-transparent hover:bg-green-600'
              }`}
            >
              {isActive ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {isActive ? 'Deactivate Brand' : 'Activate Brand'}
           </button>
           <button className="flex items-center gap-2 px-5 py-2.5 bg-app-card border border-app-border text-white rounded-xl text-xs font-bold hover:bg-white/5 transition-all">
              <Edit3 className="w-4 h-4 text-app-accent" /> Edit Info
           </button>
           <button 
             onClick={() => setShowDeleteModal(true)}
             className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
           >
              <Trash2 className="w-4 h-4" /> Delete
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column - Overview & Analytics */}
        <div className="xl:col-span-2 space-y-8">
           {/* Overview Stats */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Followers', val: '12.4k', icon: Users, color: 'text-blue-400' },
                { label: 'Live Products', val: '48', icon: Package, color: 'text-orange-400' },
                { label: 'Avg Rating', val: '4.9/5.0', icon: Star, color: 'text-yellow-400' },
                { label: 'Conv Rate', val: '2.4%', icon: TrendingUp, color: 'text-green-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-app-card border border-app-border rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className={`w-5 h-5 ${stat.color} opacity-80`} />
                    <span className="text-[10px] text-green-500 font-bold">+4.2%</span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">{stat.val}</div>
                  <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-50">{stat.label}</div>
                </div>
              ))}
           </div>

           {/* Brand Metadata Section */}
           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Building2 className="w-32 h-32" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight mb-8">Brand Profile Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 gap-x-12">
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Legal Entity ID</span>
                    <span className="text-sm font-mono text-app-accent-light mt-1">BRD-2026-SAM01</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Primary Category</span>
                    <span className="text-sm font-bold text-white mt-1">Consumer Electronics</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Origin / Country</span>
                    <span className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                       <Globe className="w-4 h-4 text-blue-500" /> South Korea
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Onboarded Since</span>
                    <span className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                       <Calendar className="w-4 h-4 text-app-text-secondary opacity-40" /> May 15, 2024
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Ownership Info</span>
                    <Link to="/admin/sellers/1" className="text-sm font-bold text-app-accent-light mt-1 flex items-center gap-2 group">
                       <User className="w-4 h-4" /> Global Tech Distrib.
                       <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-50">Seller Status</span>
                    <span className="text-[11px] font-bold text-green-500 mt-1 uppercase tracking-widest">Premium Merchant</span>
                  </div>
                </div>
              </div>
           </section>

           {/* Analytics Section */}
           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Performance Analytics</h3>
                    <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Brand Visibility & Engagement Trends</p>
                 </div>
                 <div className="flex bg-app-sidebar/50 p-1 rounded-xl border border-app-border">
                    {['7D', '30D', '90D'].map(t => (
                      <button key={t} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${t === '7D' ? 'active-filter-item bg-app-accent text-white' : 'text-app-text-secondary hover:text-white'}`}>{t}</button>
                    ))}
                 </div>
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F4631E" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#F4631E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#888888" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0D1B2A', border: '1px solid #1f2937', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="views" stroke="#F4631E" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t border-app-border">
                 <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-white font-bold mb-1">
                       <Eye className="w-4 h-4 text-app-accent" /> 342,890
                    </div>
                    <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest">Impressions</div>
                 </div>
                 <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-white font-bold mb-1">
                       <MousePointer2 className="w-4 h-4 text-blue-500" /> 18,240
                    </div>
                    <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest">Total Clicks</div>
                 </div>
                 <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-white font-bold mb-1">
                       <BarChart3 className="w-4 h-4 text-green-500" /> 2.8%
                    </div>
                    <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest">Avg Conv. Rate</div>
                 </div>
              </div>
           </section>
        </div>

        {/* Right Column - Top Products & Quick Info */}
        <div className="space-y-8">
           {/* Top Products Grid */}
           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-app-accent" />
                  Top Products
                </h3>
                <Link to="/admin/products" className="text-[10px] text-app-accent-light font-bold uppercase tracking-widest hover:underline">View All</Link>
              </div>

              <div className="space-y-4">
                 {mockBrandProducts.map((product) => (
                   <Link 
                     key={product.id} 
                     to={`/admin/products/${product.id}`}
                     className="flex items-center gap-4 bg-app-sidebar/30 border border-app-border rounded-2xl p-3 group hover:border-app-accent/30 transition-all"
                   >
                     <div className="w-12 h-12 rounded-xl border border-app-border overflow-hidden shrink-0">
                        <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="text-[12px] font-bold text-white truncate group-hover:text-app-accent-light transition-colors">{product.name}</h4>
                        <div className="flex items-center gap-3 mt-1">
                           <span className="text-[11px] font-bold text-app-accent-light">{product.price}</span>
                           <span className="text-[10px] text-app-text-secondary flex items-center gap-1">
                             <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {product.rating}
                           </span>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-app-text-secondary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                   </Link>
                 ))}
              </div>
           </section>

           {/* Brand Policy / Store Highlights */}
           <section className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl bg-gradient-to-b from-app-card to-app-sidebar">
              <h3 className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mb-6 opacity-60">Operations & Logistics</h3>
              <div className="space-y-6">
                <div className="p-4 bg-app-bg border border-app-border rounded-xl">
                   <div className="text-[10px] text-app-text-secondary font-bold uppercase mb-2">Primary Warehouse</div>
                   <div className="text-sm text-white font-bold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" /> Gazipur Distribution Hub
                   </div>
                </div>
                <div className="p-4 bg-app-bg border border-app-border rounded-xl">
                   <div className="text-[10px] text-app-text-secondary font-bold uppercase mb-2">Fulfillment Mode</div>
                   <div className="text-sm text-white font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Choosify Express Enabled
                   </div>
                </div>
                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                   <div className="text-[10px] text-orange-500 font-bold uppercase mb-2">Special Campaign</div>
                   <div className="text-sm text-white font-bold">Summer Tech Fiesta (Ongoing)</div>
                </div>
              </div>
           </section>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-app-card border border-app-border rounded-[2rem] p-10 max-w-md w-full text-center shadow-2xl"
           >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Are you absolutely sure?</h3>
              <p className="text-app-text-secondary text-sm mb-10 leading-relaxed italic">
                 "This will permanently delete 'Samsung Bangladesh' and all 48 associated products. This action is irreversible."
              </p>
              <div className="flex gap-4">
                 <button 
                   onClick={() => setShowDeleteModal(false)}
                   className="flex-1 py-4 bg-app-sidebar border border-app-border text-white rounded-2xl font-bold text-sm hover:bg-white/5 transition-all"
                 >
                   No, Keep It
                 </button>
                 <button 
                   className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all"
                   onClick={() => navigate('/admin/brands')}
                 >
                   Yes, Delete Brand
                 </button>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
}
