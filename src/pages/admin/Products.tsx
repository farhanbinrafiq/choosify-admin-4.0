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
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AddProductModal from '../../components/admin/AddProductModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogProduct } from '../../types/catalog';

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  seller: string;
  price: string;
  status: string;
  views: number;
  icon: typeof Smartphone;
  color: string;
};

const categoryIcon = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('mobile') || normalized.includes('tech')) {
    return { icon: Smartphone, color: 'text-blue-500 bg-blue-500/10' };
  }
  if (normalized.includes('electronic') || normalized.includes('tv')) {
    return { icon: Tv, color: 'text-indigo-500 bg-indigo-500/10' };
  }
  if (normalized.includes('fashion') || normalized.includes('apparel') || normalized.includes('wear')) {
    return { icon: Shirt, color: 'text-purple-500 bg-purple-500/10' };
  }
  return { icon: Box, color: 'text-green-500 bg-green-500/10' };
};

const mapCatalogProduct = (product: CatalogProduct): ProductRow => {
  const { icon, color } = categoryIcon(product.categoryName || '');
  return {
    id: product.id,
    name: product.title,
    brand: product.brandName,
    category: product.categoryName,
    seller: 'Platform Admin',
    price: `৳ ${Number(product.price || 0).toLocaleString()}`,
    status: product.status === 'live' ? 'Live' : product.status === 'draft' ? 'Pending' : 'Flagged',
    views: 0,
    icon,
    color,
  };
};

export default function ProductsPage() {
  const { profile, activeBrandId, allBrands, sellerBrands } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isContentStudio = location.pathname.includes("content-studio");
  const [isModalOpen, setIsModalOpen] = useState(location.state?.openAddModal || false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(activeBrandId);

  const handleBulkApprove = () => {
    setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'Live' } : p));
    showToast(`Approved ${selectedIds.size} products to Live`);
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'Rejected' } : p));
    showToast(`Rejected ${selectedIds.size} products`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
    showToast(`Deleted ${selectedIds.size} products from catalog`);
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["ID,Product Name,Brand,Category,Price,Status,Views"].join(",") + "\n"
      + selectedProducts.map(p => `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand.replace(/"/g, '""')}","${p.category}","${p.price}","${p.status}","${p.views}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_bulk_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${selectedIds.size} products to CSV`);
  };

  React.useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setCatalogError(null);
      try {
        const catalogProducts = await catalogApi.listProducts();
        if (!cancelled) {
          setProducts(catalogProducts.map(mapCatalogProduct));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load catalog products.';
          setCatalogError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (isModalOpen) {
      setIsModalOpen(false);
      navigate("/dashboard/content-studio/products/new");
    }
  }, [isModalOpen, navigate]);

  React.useEffect(() => {
    setSelectedBrandFilter(activeBrandId);
  }, [activeBrandId]);

  // Filter products based on user role and active seller brand context
  const targetBrand = allBrands.find(b => b.id === selectedBrandFilter);
  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map(r => r.brand_id);
  const ownedBrandNames = allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => b.name.toLowerCase());

  const displayedProducts = products.filter(p => {
    if (profile?.role === 'seller') {
      if (targetBrand) {
        const targetBrandNameLower = targetBrand.name.toLowerCase();
        return p.brand && (p.brand.toLowerCase() === targetBrandNameLower || p.brand.toLowerCase().includes(targetBrandNameLower) || targetBrandNameLower.includes(p.brand.toLowerCase()));
      }
      return p.brand && ownedBrandNames.some(name => p.brand.toLowerCase() === name || p.brand.toLowerCase().includes(name) || name.includes(p.brand.toLowerCase()));
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
           <h1 className="text-xl font-bold text-app-text-primary tracking-tight">
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
               className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-light text-app-text-primary px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
             >
                <Plus className="w-4 h-4" /> Add Visual Product
             </Link>
           ) : (
             <button 
               onClick={() => navigate("/dashboard/content-studio/products/new")}
               className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-light text-app-text-primary px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
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
          <div key={s.label} className={`bg-app-card p-4 rounded-2xl border border-app-border border-l-[4px] shadow-lg${s.color}`}>
            <div className="text-2xl font-bold text-app-text-primary tracking-tight">{s.val}</div>
            <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-60">{s.label}</div>
            <div className="text-[9px] text-[#EB4501] font-semibold mt-1 bg-white/[0.02] inline-block px-1.5 py-0.5 rounded border border-app-border">{s.change}</div>
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
            <div className="flex items-center justify-between text-xs border-b border-app-border pb-2">
              <span className="text-app-text-secondary font-medium">Most Viewed</span>
              <div className="text-right">
                <span className="block font-bold text-app-text-primary text-[12px] truncate max-w-[150px]">Samsung S25 Ultra</span>
                <span className="text-[10px] text-green-500 font-mono">12,840 views</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-app-border pb-2">
              <span className="text-app-text-secondary font-medium">Most Searched</span>
              <div className="text-right">
                <span className="block font-bold text-app-text-primary text-[12px] truncate max-w-[150px]">Aarong Jamdani</span>
                <span className="text-[10px] text-app-accent-light font-mono">8,410 queries</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary font-medium">Most Saved</span>
              <div className="text-right">
                <span className="block font-bold text-app-text-primary text-[12px] truncate max-w-[150px]">Walton 2-Door Fridge</span>
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
                  <span className="text-app-text-primary">{item.cat}</span>
                  <span className="text-app-text-secondary font-mono">{item.val} ({item.share})</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-app-accent to-[#F4631E]${item.width}rounded-full`} />
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
              <span className="font-mono font-bold text-app-text-primary text-[12px]">8.24%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary">Cart-to-Checkout Conversion</span>
              <span className="font-mono font-bold text-app-text-primary text-[12px]">41.5%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-app-text-secondary font-semibold text-app-text-primary">Net Conversion Trend</span>
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
            className="w-full bg-app-sidebar border border-app-border rounded-xl pl-11 pr-4 py-2.5 text-[12px] text-app-text-primary outline-none focus:border-app-accent/40 transition-all font-medium" 
          />
        </div>
        <div className="flex gap-2">
           {profile?.role === 'seller' && (
             <select 
               value={selectedBrandFilter || ''}
               onChange={(e) => setSelectedBrandFilter(e.target.value || null)}
               className="bg-app-sidebar border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent/40 cursor-pointer"
             >
               <option value="">All Brands</option>
               {allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => (
                 <option key={b.id} value={b.id}>{b.name}</option>
               ))}
             </select>
           )}
           <select className="bg-app-sidebar border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent/40">
             <option>All Categories</option>
             <option>Mobile</option>
             <option>Electronics</option>
             <option>Fashion</option>
           </select>
           <select className="bg-app-sidebar border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent/40">
             <option>Status: Any</option>
             <option>Live</option>
             <option>Pending</option>
             <option>Flagged</option>
           </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-app-card text-app-text-primary px-4 py-3 rounded-xl flex items-center justify-between gap-3 mb-3 text-[12px] font-bold border border-app-border shadow-lg animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-app-accent/20 text-app-accent-light px-2.5 py-1 rounded-lg font-mono">
              {selectedIds.size} items selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Approve All
              </button>
              <button
                onClick={handleBulkReject}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Reject All
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Delete All
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer font-sans"
              >
                Export Selected (CSV)
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-app-text-secondary hover:text-white px-3 py-1 cursor-pointer transition-colors uppercase text-[10px]"
          >
            ✕ Clear selection
          </button>
        </div>
      )}

      <div className="bg-app-card rounded-[2rem] border border-app-border overflow-hidden shadow-2xl">
        {catalogError && (
          <div className="px-6 py-4 border-b border-app-border text-[12px] text-amber-400 bg-amber-500/10">
            Could not load catalog products: {catalogError.slice(0, 180)}
          </div>
        )}
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] border-b border-app-border">
            <tr>
              <th className="p-6 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-app-border bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                  checked={displayedProducts.length > 0 && displayedProducts.every(p => selectedIds.has(p.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set([...selectedIds, ...displayedProducts.map(p => p.id)]));
                    } else {
                      const newSelected = new Set(selectedIds);
                      displayedProducts.forEach(p => newSelected.delete(p.id));
                      setSelectedIds(newSelected);
                    }
                  }}
                />
              </th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Product Details</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Category</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Affiliate Price</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em]">Status</th>
              <th className="p-6 text-[10px] font-bold text-app-text-secondary uppercase tracking-[0.2em] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoadingProducts ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-app-text-secondary text-sm">
                  Loading catalog products...
                </td>
              </tr>
            ) : displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-app-text-secondary text-sm">
                  No products in catalog yet. Publish one from Product Studio.
                </td>
              </tr>
            ) : displayedProducts.map((p) => {
              const Icon = p.icon;
              return (
                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-6 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-app-border bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedIds);
                        if (e.target.checked) {
                          newSelected.add(p.id);
                        } else {
                          newSelected.delete(p.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                    />
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-app-border shadow-inner${p.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-app-text-primary group-hover:text-app-accent-light transition-colors">
                          <Link to={`/dashboard/content-studio/products/${p.id}/edit`} className="hover:underline">
                            {p.name}
                          </Link>
                        </div>
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
                    <div className="text-[14px] font-extrabold text-app-text-primary">{p.price}</div>
                    <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-widest">Est. Commission: ৳ 420</div>
                  </td>
                  <td className="p-6">
                    <span className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-widest border${
                      p.status === 'Live' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      p.status === 'Pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2">
                       <Link 
                        to={`/dashboard/content-studio/products/${p.id}/edit`}
                        className="p-2.5 bg-white/5 border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:border-app-accent/40 transition-all"
                       >
                         <Tag className="w-4 h-4" />
                       </Link>
                       <Link 
                        to={`/dashboard/content-studio/products/${p.id}/edit`}
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
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-app-accent text-app-text-primary rounded-2xl shadow-2xl shadow-app-accent/40 font-bold text-sm flex items-center gap-3 z-[100]"
          >
            <CheckCircle className="w-5 h-5" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

