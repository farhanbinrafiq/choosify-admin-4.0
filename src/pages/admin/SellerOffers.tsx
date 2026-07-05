import React, { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { operationsApi } from '../../services/operationsApi';

type SellerOffer = {
  id: string;
  productName: string;
  category: string;
  brand: string;
  price: string;
  sellerName: string;
  sellerPhone: string;
  sellerRegion: string;
  status: string;
  createdAt: string;
};

export default function SellerOffersPage() {
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setOffers((await operationsApi.listSellerOffers()) as SellerOffer[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: 'reviewing' | 'approved' | 'rejected') => {
    await operationsApi.updateSellerOffer(id, { status });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-app-accent" />
            Seller Offer Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">Post-offer submissions from the public storefront.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading offers...</td></tr>
            ) : offers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No seller offers yet.</td></tr>
            ) : (
              offers.map((offer) => (
                <tr key={offer.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{offer.productName}</td>
                  <td className="px-4 py-3 text-slate-600">{offer.sellerName}<br /><span className="text-xs">{offer.sellerPhone}</span></td>
                  <td className="px-4 py-3">{offer.category}</td>
                  <td className="px-4 py-3">{offer.price || '—'}</td>
                  <td className="px-4 py-3 capitalize">{offer.status}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button type="button" onClick={() => updateStatus(offer.id, 'approved')} className="text-xs font-bold text-green-600">Approve</button>
                    <button type="button" onClick={() => updateStatus(offer.id, 'rejected')} className="text-xs font-bold text-red-600">Reject</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
