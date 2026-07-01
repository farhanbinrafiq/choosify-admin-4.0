import React from 'react';
import { Plus, Search, Filter, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const mockBrands = [
  { id: '1', name: 'Samsung Bangladesh', category: 'Electronics · Mobile', status: 'Verified', followers: '12,400', products: 48, initials: 'SB', color: 'bg-blue-600 text-white' },
  { id: '2', name: 'Aarong', category: 'Fashion & Lifestyle', status: 'Verified', followers: '8,920', products: 124, initials: 'AB', color: 'bg-orange-100 text-orange-700' },
  { id: '3', name: 'Walton', category: 'Electronics · Home', status: 'Verified', followers: '7,310', products: 87, initials: 'WB', color: 'bg-blue-100 text-blue-800' },
  { id: '4', name: 'Xiaomi', category: 'Mobile · Smart Home', status: 'Pending', followers: '3,840', products: 22, initials: 'XM', color: 'bg-orange-500 text-white' },
  { id: '5', name: 'Unilever BD', category: 'Beauty & FMCG', status: 'Verified', followers: '5,200', products: 63, initials: 'UB', color: 'bg-green-100 text-green-800' },
];

export default function BrandsPage() {
  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div className="flex gap-4">
             <div className="bg-app-card px-5 py-3 rounded-xl border border-app-border shadow-sm">
                <div className="text-2xl font-bold text-app-text-primary">2,140</div>
                <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider mt-0.5">Total Brands</div>
             </div>
             <div className="bg-app-card px-5 py-3 rounded-xl border border-app-border shadow-sm border-l-[3px] border-l-green-500">
                <div className="text-2xl font-bold text-green-600">1,892</div>
                <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider mt-0.5">Verified</div>
             </div>
          </div>
          <button className="bg-[#F4631E] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform">
             <Plus className="w-4 h-4" /> Add Brand
          </button>
       </div>

       {/* Admin Tabs */}
       <div className="flex border-b border-app-border overflow-x-auto scrollbar-hide">
         <Link to="/admin/sellers" className="px-8 py-4 text-app-text-secondary hover:text-app-text-primary text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap">
           Sellers
         </Link>
         <button className="px-8 py-4 border-b-2 border-app-accent text-app-accent text-[11px] font-bold uppercase tracking-widest bg-app-accent/5 whitespace-nowrap">
           Brands
         </button>
       </div>

       <div className="flex gap-2">
          <div className="flex-1 bg-app-card border border-app-border rounded-lg flex items-center px-3 gap-2">
            <Search className="w-4 h-4 text-app-text-secondary" />
            <input placeholder="Search brand by name or category..." className="flex-1 py-2 text-[12px] bg-transparent outline-none text-app-text-primary placeholder:text-app-text-secondary/50" />
          </div>
          <button className="bg-app-card border border-app-border px-4 py-2 rounded-lg text-xs font-semibold text-app-text-secondary hover:text-app-text-primary transition-colors">Filter</button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {mockBrands.map(brand => (
           <div key={brand.id} className="bg-app-card rounded-xl border border-app-border p-5 hover:border-app-accent/30 transition-all group">
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm ${brand.color}`}>
                     {brand.initials}
                   </div>
                   <div>
                      <Link to={`/admin/brands/${brand.id}`} className="hover:text-app-accent transition-colors">
                        <h4 className="text-[13px] font-bold text-app-text-primary">{brand.name}</h4>
                      </Link>
                      <p className="text-[11px] text-app-text-secondary">{brand.category}</p>
                   </div>
                </div>
                {brand.status === 'Verified' ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-bold border border-green-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> VERIFIED
                  </span>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20">
                    PENDING
                  </span>
                )}
             </div>

             <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-app-bg rounded-lg p-2 text-center transition-colors">
                   <div className="text-xs font-bold text-app-text-primary flex items-center justify-center gap-1">
                     <Users className="w-3 h-3 text-app-text-secondary" /> {brand.followers}
                   </div>
                   <div className="text-[9px] text-app-text-secondary uppercase font-semibold">Followers</div>
                </div>
                <div className="bg-app-bg rounded-lg p-2 text-center transition-colors">
                   <div className="text-xs font-bold text-app-text-primary flex items-center justify-center gap-1">
                     <TrendingUp className="w-3 h-3 text-app-text-secondary" /> {brand.products}
                   </div>
                   <div className="text-[9px] text-app-text-secondary uppercase font-semibold">Products</div>
                </div>
             </div>

              <div className="flex gap-2">
                 <Link to={`/admin/brands/${brand.id}`} className="flex-1 py-2 bg-app-sidebar text-white rounded-lg text-[11px] font-bold opacity-90 hover:opacity-100 text-center transition-colors">View Details</Link>
                 <button className="flex-1 py-2 border border-app-border text-app-text-secondary rounded-lg text-[11px] font-bold hover:bg-app-bg transition-colors">Edit Page</button>
              </div>
           </div>
         ))}
       </div>
    </div>
  );
}
