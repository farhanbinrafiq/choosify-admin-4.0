import React from 'react';
import { Tag, TrendingUp, Calendar, Globe, MousePointer2, Eye } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface BrandMarketingTabProps {
  adPerformanceData: any[];
  sponsoredAds: any[];
  couponsList: any[];
  showToast: (msg: string) => void;
}

export const BrandMarketingTab: React.FC<BrandMarketingTabProps> = ({
  adPerformanceData,
  sponsoredAds,
  couponsList,
  showToast
}) => {
  return (
    <div className="space-y-6 text-left" id="ads_sponsored_panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📢 Ads & Sponsored Studio Activity</h2>
        <p className="text-slate-500 text-xs mt-1">Configure promotions, sponsored banners, merchant-dispatched coupon vouchers, and ad revenue analytics.</p>
      </div>

      {/* Ad performance Area Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest block text-left">Sponsored Campaigns Yield Graph</h3>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={adPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" dataKey="spend" name="Budget Dispatched (৳)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              <Area type="monotone" dataKey="revenue" name="Storefront Claims Revenue (৳)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sponsored ad campaigns table list */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sponsored Channel Ad Placements</h3>
          
          <div className="overflow-hidden border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            {sponsoredAds.map((ad) => (
              <div key={ad.id} className="p-4 bg-slate-50/20 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-colors">
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 block">{ad.name}</span>
                  <p className="text-[10px] text-slate-550 font-medium">
                    Type: {ad.type} &bull; Budget: <strong className="text-slate-700">{ad.budget}</strong> &bull; Spend: {ad.spend}
                  </p>
                  <p className="text-[9px] text-slate-450 font-mono">Impressions: {ad.impressions} &bull; Clicks: {ad.clicks}</p>
                </div>

                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                  ad.status === 'Active' ? 'bg-green-50 text-green-600 border-green-150' :
                  ad.status === 'Scheduled' ? 'bg-indigo-50 text-indigo-650 border-indigo-200' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {ad.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coupons promo code voucher list */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Claims Discount Vouchers</h3>
          
          <div className="overflow-hidden border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
            {couponsList.map((cp) => (
              <div key={cp.code} className="p-4 bg-slate-50/20 hover:bg-slate-50/50 flex items-center justify-between gap-4 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black font-mono text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded text-[11px] block tracking-wider">{cp.code}</span>
                    <span className="font-bold text-slate-700">({cp.discount})</span>
                  </div>
                  <p className="text-[10px] text-slate-550 font-medium pt-0.5">Limit capacity: {cp.limit} &bull; Redeemed claims: <strong className="text-slate-700">{cp.totalUsed}</strong></p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                    cp.status === 'Active' ? 'bg-green-50 text-green-600 border-green-150' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {cp.status}
                  </span>
                  {cp.status === 'Active' && (
                    <button 
                      onClick={() => showToast(`✓ Promo code ${cp.code} paused administratively.`)}
                      className="text-[10px] bg-white hover:bg-red-50 text-red-650 border border-slate-200 rounded p-1 px-1.5 font-bold transition-all"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
