import React from 'react';
import { Search, Plus, Trash2, Edit3, Package } from 'lucide-react';

interface BrandProductsTabProps {
  productSearch: string;
  setProductSearch: (val: string) => void;
  productFilterStatus: string;
  setProductFilterStatus: (val: string) => void;
  filteredProducts: any[];
  toggleProductStatus: (id: string) => void;
  removeProduct: (id: string) => void;
  showToast: (msg: string) => void;
}

export const BrandProductsTab: React.FC<BrandProductsTabProps> = ({
  productSearch,
  setProductSearch,
  productFilterStatus,
  setProductFilterStatus,
  filteredProducts,
  toggleProductStatus,
  removeProduct,
  showToast
}) => {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  return (
    <div className="space-y-6 text-left hover:no-underline" id="product_listings_panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📦 Product Listings</h2>
        <p className="text-slate-500 text-xs mt-1">Audit active, pending, or blacklisted listings catalogued by this merchant.</p>
      </div>

      {/* Search & Filter bar styled identical to Seller Profile / Orders */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by SKU or Name..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:bg-white"
          />
        </div>

        <div className="flex gap-2.5 overflow-x-auto">
          {['All', 'Active', 'Pending', 'Draft', 'Rejected'].map(status => (
            <button
              key={status}
              onClick={() => setProductFilterStatus(status)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                productFilterStatus === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid/Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase tracking-wider">
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price Value</th>
                <th className="px-6 py-4">Warehouse Stock</th>
                <th className="px-6 py-4">Review Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                    No matching products available inside brand catalog.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block leading-tight">{p.name}</span>
                        <span className="text-[10px] text-slate-405 font-mono block mt-1">SKU ID: <strong>{p.sku}</strong></span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-bold">{p.category}</td>
                    <td className="px-6 py-4 text-slate-900 font-extrabold font-mono">{p.price}</td>
                    <td className="px-6 py-4 font-mono">{p.stock} units</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                        p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-green-150' :
                        p.status === 'Draft' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        p.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 animate-pulse' :
                        'bg-red-50 text-red-650 border-red-200'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => toggleProductStatus(p.id)}
                            className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-[10px] transition-all"
                          >
                            {p.status === 'Active' ? 'Archive' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setConfirmingId(p.id)}
                            className="p-1.5 border border-red-100 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                            title="Delete catalog entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {confirmingId === p.id && (
                          <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex flex-col items-end gap-1.5 z-10">
                            <span className="text-[9px] font-black text-red-600">Delete this product?</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { removeProduct(p.id); setConfirmingId(null); }}
                                className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded hover:bg-red-600 transition-colors border border-transparent"
                              >Confirm</button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="px-2 py-1 bg-white text-slate-600 border border-slate-200 text-[8px] font-black uppercase rounded hover:bg-slate-50 transition-colors"
                              >Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
