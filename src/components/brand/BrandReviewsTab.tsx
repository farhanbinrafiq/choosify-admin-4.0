import React from 'react';
import { Star, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

interface BrandReviewsTabProps {
  ratingDistribution: any[];
  complaintsList: any[];
  showToast: (msg: string) => void;
}

export const BrandReviewsTab: React.FC<BrandReviewsTabProps> = ({
  ratingDistribution,
  complaintsList,
  showToast
}) => {
  return (
    <div className="space-y-6 text-left" id="reviews_score_panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">🛡️ Reviews & Score Performance</h2>
        <p className="text-slate-500 text-xs mt-1">Operational audit parameters, brand rating indices, disputes, and customer satisfaction audits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rating index card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left col-span-1">
          <div className="space-y-1.5">
            <span className="text-[9px] font-black tracking-widest text-[#F4631E] uppercase">Total Rating Score</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-950 font-mono">4.92</span>
              <span className="text-slate-400 font-bold">/ 5.0</span>
            </div>
            
            <div className="flex gap-0.5 text-amber-500 pt-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-500" />)}
            </div>
            <p className="text-[10px] text-slate-450 pt-1.5">Calculated across 1,420 registered reviews.</p>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-6 space-y-2">
            {ratingDistribution.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-[10px] font-medium text-slate-550">
                <span className="w-10 text-right">{r.stars}</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded" 
                    style={{ width: `${(r.count / 1420) * 100}%` }} 
                  />
                </div>
                <span className="w-8 font-mono text-slate-450">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Health Metrics Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm col-span-2 text-left space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ongoing SLA Operational Metrics</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
            {[
              { title: 'On-Time Dispatch Rate', val: '99.4%', status: 'Outstanding' },
              { title: 'Order Acceptance Delta', val: '8 mins', status: 'Immediate' },
              { title: 'Response Time Index', val: '1.2 Hours', status: 'Optimal' },
              { title: 'RMA Return Processing', val: '98.8%', status: 'Optimal' }
            ].map((stat, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-205 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-slate-500">{stat.title}</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-lg font-black text-slate-950 font-mono">{stat.val}</span>
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase">{stat.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Active Disputes & Complaints summary list */}
          <div className="border-t border-slate-150 pt-4 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Logged Customer Complaints</span>
            
            <div className="divide-y divide-slate-100">
              {complaintsList.map((c, i) => (
                <div key={i} className="py-2 text-[11px] flex justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800">{c.reason}</span>
                    <p className="text-[10px] text-slate-405 font-medium">Filer: {c.filer} &middot; Date: {c.date} &middot; ID: <span className="font-mono">{c.id}</span></p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      c.severity === 'High' ? 'bg-red-50 text-red-650' : 'bg-yellow-50 text-yellow-650'
                    }`}>
                      {c.severity} Severity
                    </span>
                    <button 
                      onClick={() => showToast('Disputed logs reviewed.')}
                      className="p-1 text-slate-400 hover:text-slate-650"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-550" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
