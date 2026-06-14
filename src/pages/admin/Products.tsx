import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Smartphone, 
  Tv, 
  Shirt, 
  Box, 
  MoreVertical, 
  Eye, 
  Trash2, 
  CheckCircle,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ShoppingBag,
  ExternalLink,
  Tag
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AddProductModal from '../../components/admin/AddProductModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

const mockProducts = [
  { id: '1', name: 'Samsung S25 Ultra', brand: 'Samsung Bangladesh', category: 'Mobile', seller: 'TechZone BD', price: '৳ 139,999', status: 'Pending', views: 842, icon: Smartphone, color: 'text-blue-500 bg-blue-500/10' },
  { id: '2', name: 'Vision Smart TV 55"', brand: 'Vision', category: 'Electronics', seller: 'Meena Bazar', price: '৳ 68,500', status: 'Live', views: 12840, icon: Tv, color: 'text-indigo-500 bg-indigo-500/10' },
  { id: '3', name: 'Aarong Jamdani Saree', brand: 'Aarong', category: 'Fashion', seller: 'Aarong Digital', price: '৳ 4,200', status: 'Flagged', views: 3210, icon: Shirt, color: 'text-purple-500 bg-purple-500/10' },
  { id: '4', name: 'Walton 2-Door Fridge', brand: 'Walton', category: 'Home', seller: 'ElectroBD', price: '৳ 29,990', status: 'Live', views: 8912, icon: Box, color: 'text-green-500 bg-green-500/10' },
  { id: 'apex-1', name: 'Apex Men Royal Loafer', brand: 'Apex', category: 'Footwear & Apparel', seller: 'Rahim Uddin', price: '৳ 4,500', status: 'Live', views: 2450, icon: Shirt, color: 'text-orange-500 bg-orange-500/10' },
  { id: 'apex-2', name: 'Apex Leather Formal Dress Shoes', brand: 'Apex', category: 'Footwear & Apparel', seller: 'Rahim Uddin', price: '৳ 6,200', status: 'Live', views: 1820, icon: Shirt, color: 'text-orange-500 bg-orange-500/10' },
  { id: 'urbanfit-1', name: 'Urban Fit Elite Compression Tee', brand: 'Urban Fit', category: 'Active Wear', seller: 'Rahim Uddin', price: '৳ 1,800', status: 'Live', views: 980, icon: Shirt, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'urbanfit-2', name: 'Urban Fit Comfort Joggers', brand: 'Urban Fit', category: 'Active Wear', seller: 'Rahim Uddin', price: '৳ 2,400', status: 'Live', views: 1205, icon: Shirt, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'techcore-1', name: 'TechCore Wireless Charging Pad', brand: 'TechCore', category: 'Consumer Tech', seller: 'Rahim Uddin', price: '৳ 1,200', status: 'Live', views: 3410, icon: Smartphone, color: 'text-blue-500 bg-blue-500/10' },
  { id: 'techcore-2', name: 'TechCore Bluetooth Smart Watch V2', brand: 'TechCore', category: 'Consumer Tech', seller: 'Rahim Uddin', price: '৳ 3,800', status: 'Live', views: 5690, icon: Smartphone, color: 'text-blue-500 bg-blue-500/10' },
];

export default function ProductsPage() {
  const { profile, activeBrandId, allBrands, sellerBrands } = useAuth();
  const location = useLocation();
  const isContentStudio = location.pathname.includes("content-studio");
  const [isModalOpen, setIsModalOpen] = useState(location.state?.openAddModal || false);
  const [products, setProducts] = useState(mockProducts);
  const [toast, setToast] = useState<string | null>(null);

  // Filter products based on user role and active seller brand context
  const activeBrand = allBrands.find(b => b.id === activeBrandId);
  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map(r => r.brand_id);

  const displayedProducts = products.filter(p => {
    if (profile?.role === 'seller') {
      if (!activeBrand) return false;
      return p.brand && p.brand.toLowerCase() === activeBrand.name.toLowerCase();
    }
    return true;
  });

  const handleAddProduct = (data: any) => {
    const newProduct = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.productName,
      brand: data.brandName || data.customBrand,
      category: data.category,
      seller: 'Platform Admin',
      price: `৳ ${data.discountedPrice.toLocaleString()}`,
      status: 'Pending',
      views: 0,
      icon: data.category === 'Mobile' ? Smartphone : Box,
      color: 'text-app-accent bg-app-accent/10'
    };
    setProducts([newProduct, ...products]);
    showToast('Product added successfully as Draft');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-xl font-bold text-white tracking-tight">
             {isContentStudio ? 'Product Studio (Visual Product CMS)' : 'Inventory Management'}
           </h1>
           <p className="text-app-text-secondary text-[12px]">
             {isContentStudio ? 'Live experience builder, storefront mockups, and dynamic catalog releases' : 'Manage platform catalog, pricing and seller listings'}
           </p>
        </div>
        <div className="flex items-center gap-3">
           <button className="p-2.5 bg-white/5 border border-app-border rounded-xl text-app-text-secondary hover:text-white transition-all">
              <Filter className="w-4 h-4" />
           </button>
           {isContentStudio ? (
             <Link 
               to="/dashboard/content-studio/products/new"
               className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-light text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
             >
                <Plus className="w-4 h-4" /> Add Visual Product
             </Link>
           ) : (
             <button 
               onClick={() => setIsModalOpen(true)}
               className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-light text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
             >
                <Plus className="w-4 h-4" /> Add Product
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Products', val: '94,520', color: 'border-blue-500', change: '+1.2k this wk' },
          { label: 'Active Products', val: '89,244', color: 'border-green-500', change: '94.4% of catalog' },
          { label: 'Pending Approval', val: '412', color: 'border-orange-500', change: '8.4 hrs avg wait' },
          { label: 'Flagged Products', val: '88', color: 'border-red-500', change: '-12% vs last wk' },
          { label: 'Conversion Avg', val: '3.42%', color: 'border-purple-500', change: '+0.15% trend' },
        ].map(s => (
          <div key={s.label} className={`bg-app-card p-4 rounded-2xl border border-app-border border-l-[4px] shadow-lg ${s.color}`}>
            <div className="text-2xl font-bold text-white tracking-tight">{s.val}</div>
            <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-60">{s.label}</div>
            <div className="text-[9px] text-[#EB4501] font-semibold mt-1 bg-white/[0.02] inline-block px-1.5 py-0.5 rounded border border-white/5">{s.change}</div>
          </div>
        ))}
      </div>

      {/* Advanced Product Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popularity Metrics */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">🔥 Popularity Insights</h4>
            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-app-text-secondary font-semibold">Real-time</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-white/[0.02] pb-2">
              <span className="text-app-text-secondary font-medium">Most Viewed</span>
              <div className="text-right">
                <span className="block font-bold text-white text-[12px] truncate max-w-[150px]">Samsung S25 Ultra</span>
                <span className="text-[10px] text-green-500 font-mono">12,840 views</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-white/[0.02] pb-2">
              <span className="text-app-text-secondary font-medium">Most Searched</span>
              <div className="text-right">
                <span className="block font-bold text-white text-[12px] truncate max-w-[150px]">Aarong Jamdani</span>
                <span className="text-[10px] text-app-accent-light font-mono">8,410 queries</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary font-medium">Most Saved</span>
              <div className="text-right">
                <span className="block font-bold text-white text-[12px] truncate max-w-[150px]">Walton 2-Door Fridge</span>
                <span className="text-[10px] text-blue-400 font-mono">1,920 saves</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing Categories */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">📊 Top Performing Categories</h4>
            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-app-text-secondary font-semibold">MTD</span>
          </div>
          <div className="space-y-2.5">
            {[
              { cat: 'Fashion & Apparel', share: '42%', val: '৳ 6.2M', width: 'w-[84%]' },
              { cat: 'Mobile & Electronics', share: '33%', val: '৳ 4.8M', width: 'w-[66%]' },
              { cat: 'Home Appliances', share: '15%', val: '৳ 2.2M', width: 'w-[30%]' },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-white">{item.cat}</span>
                  <span className="text-app-text-secondary font-mono">{item.val} ({item.share})</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-app-accent to-[#F4631E] ${item.width} rounded-full`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion trends */}
        <div className="bg-app-card rounded-2xl border border-app-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-[#EB4501] uppercase tracking-wider">📈 Conversion & Engagement</h4>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">+18.4% YoY</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary">Detail-to-Cart Conversion</span>
              <span className="font-mono font-bold text-white text-[12px]">8.24%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary">Cart-to-Checkout Conversion</span>
              <span className="font-mono font-bold text-white text-[12px]">41.5%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary font-semibold text-white">Net Conversion Trend</span>
              <span className="font-mono font-bold text-green-500 text-[12px]">3.42%</span>
            </div>
            {/* Simple sparkline visualizer */}
            <div className="flex items-end gap-1 h-6 pt-1 max-w-[150px]">
              {[30, 45, 35, 60, 55, 70, 85, 80].map((v, i) => (
                <div key={i} className="flex-1 bg-app-accent/20 hover:bg-app-accent transition-colors rounded-t" style={{ height: `${v}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-app-card border border-app-border rounded-2xl p-2 gap-2 overflow-x-auto scrollbar-hide">
        <div className="flex-1 min-w-[240px] relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent transition-colors" />
          <input 
            placeholder="Search products, brands, sellers..." 
            className="w-full bg-app-sidebar border border-app-border rounded-xl pl-11 pr-4 py-2.5 text-[12px] text-white outline-none focus:border-app-accent/40 transition-all font-medium" 
          />
        </div>
        <div className="flex gap-2">
           <select className="bg-app-sidebar border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-white font-medium outline-none focus:border-app-accent/40">
             <option>All Categories</option>
             <option>Mobile</option>
             <option>Electronics</option>
             <option>Fashion</option>
           </select>
           <select className="bg-app-sidebar border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-white font-medium outline-none focus:border-app-accent/40">
             <option>Status: Any</option>
             <option>Live</option>
             <option>Pending</option>
             <option>Flagged</option>
           </select>
        </div>
      </div>

      <div className="bg-app-card rounded-[2rem] border border-app-border overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] border-b border-app-border">
            <tr>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Product Details</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Category</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Affiliate Price</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Status</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayedProducts.map((p) => {
              const Icon = p.icon;
              return (
                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner ${p.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-white group-hover:text-app-accent-light transition-colors">{p.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-app-text-secondary opacity-50 font-bold uppercase tracking-widest">{p.brand}</span>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span className="text-[10px] text-app-accent font-bold">{p.views.toLocaleString()} views</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-[10px] px-3 py-1 rounded-lg bg-app-sidebar border border-app-border text-app-text-primary font-bold uppercase tracking-widest">{p.category}</span>
                  </td>
                  <td className="p-6">
                    <div className="text-[14px] font-extrabold text-white">{p.price}</div>
                    <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-widest">Est. Commission: ৳ 420</div>
                  </td>
                  <td className="p-6">
                    <span className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-widest border ${
                      p.status === 'Live' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      p.status === 'Pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2">
                       <Link 
                        to={isContentStudio ? `/dashboard/content-studio/products/${p.id}/edit` : `/admin/products/${p.id}/edit`}
                        className="p-2.5 bg-white/5 border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/40 transition-all"
                       >
                         <Tag className="w-4 h-4" />
                       </Link>
                       <Link 
                        to={isContentStudio ? `/dashboard/content-studio/products/${p.id}/edit` : `/admin/products/${p.id}`}
                        className="p-2.5 bg-app-accent/10 border border-app-accent/20 rounded-xl text-app-accent-light hover:bg-app-accent/20 transition-all"
                       >
                         <Eye className="w-4 h-4" />
                       </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleAddProduct}
      />

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-app-accent text-white rounded-2xl shadow-2xl shadow-app-accent/40 font-bold text-sm flex items-center gap-3 z-[100]"
          >
            <CheckCircle className="w-5 h-5" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

