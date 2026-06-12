import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Users, 
  Package, 
  TrendingUp, 
  AlertCircle,
  Eye,
  MessageSquare,
  BarChart3,
  Calendar,
  ChevronRight,
  MousePointer2
} from 'lucide-react';

export default function SellerDashboardPreview() {
  const { id } = useParams();

  // Mock stats for the seller preview
  const stats = [
    { label: 'Merchant Sales', value: '৳ 2.4M', trend: '+12.5%', color: 'text-green-500' },
    { label: 'Store Visitors', value: '42.8k', trend: '+8.2%', color: 'text-green-500' },
    { label: 'Order Volume', value: '1,420', trend: '-2.4%', color: 'text-red-500' },
    { label: 'Comm. Earned', value: '৳ 120k', trend: '+5.1%', color: 'text-app-accent-light' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Simulation Header */}
      <div className="bg-app-accent/10 border border-app-accent/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white shadow-lg">
              <Eye className="w-5 h-5" />
           </div>
           <div>
              <h4 className="text-sm font-bold text-white">Merchant Dashboard Simulation</h4>
              <p className="text-[11px] text-app-text-secondary">Viewing live analytics for Electronics Zone BD (UID: {id})</p>
           </div>
        </div>
        <div className="flex items-center gap-2">
           <Link to={`/admin/sellers/${id}`} className="px-4 py-2 bg-white/5 border border-app-border text-white hover:bg-white/10 rounded-lg text-xs font-bold transition-all">
              Return to Profile
           </Link>
           <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95">
              Force Suspension
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-app-card border border-app-border p-5 rounded-2xl group hover:border-app-accent/40 transition-all">
             <p className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mb-1 opacity-60 group-hover:opacity-100">{s.label}</p>
             <div className="text-2xl font-bold text-white mb-2">{s.value}</div>
             <div className={`text-[11px] font-bold ${s.color}`}>
                {s.trend} <span className="text-app-text-secondary opacity-40">vs last 30d</span>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Live Inventory */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden">
               <div className="p-4 px-6 border-b border-app-border flex justify-between items-center bg-white/5">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                     <Package className="w-4 h-4 text-app-accent-light" />
                     Live Inventory Review
                  </h4>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] bg-app-sidebar px-2 py-1 rounded text-app-text-secondary font-bold border border-app-border">All Status</span>
                  </div>
               </div>
               <div className="p-6">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40 border-b border-app-border">
                           <th className="pb-4">Product Unit</th>
                           <th className="pb-4">Price / Deal</th>
                           <th className="pb-4">Stock</th>
                           <th className="pb-4">CTR</th>
                           <th className="pb-4 text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 text-[13px]">
                        {[
                          { name: 'iPhone 15 Pro Max', p: '৳ 145,000', s: 12, ctr: '4.2%' },
                          { name: 'MacBook Air M3', p: '৳ 158,000', s: 0, ctr: '2.8%' },
                          { name: 'AirPods Pro 2', p: '৳ 22,500', s: 48, ctr: '8.4%' },
                        ].map((item, i) => (
                          <tr key={i} className="group hover:bg-white/[0.02]">
                             <td className="py-4">
                                <div className="font-bold text-white">{item.name}</div>
                                <div className="text-[10px] text-app-text-secondary font-medium">SKU: PROD-821-{i}</div>
                             </td>
                             <td className="py-4 font-bold text-app-accent-light">{item.p}</td>
                             <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.s === 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                   {item.s === 0 ? 'OUT OF STOCK' : `${item.s} UNITS`}
                                </span>
                             </td>
                             <td className="py-4 font-mono text-[11px] text-white/50">{item.ctr}</td>
                             <td className="py-4 text-right">
                                <button className="p-1.5 text-app-text-secondary hover:text-white bg-white/5 rounded-md">
                                   <ChevronRight className="w-4 h-4" />
                                </button>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-app-card border border-app-border rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                     <h4 className="text-sm font-bold text-white">Audience Engagement</h4>
                     <MousePointer2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="space-y-4">
                     {[
                       { label: 'Click to Conversion', value: '4.2%', color: 'bg-blue-500' },
                       { label: 'Average Session', value: '3m 42s', color: 'bg-purple-500' },
                       { label: 'Bounce Rate', value: '32%', color: 'bg-orange-500' },
                     ].map((item, i) => (
                       <div key={i} className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-app-text-secondary">
                             <span>{item.label}</span>
                             <span className="text-white">{item.value}</span>
                          </div>
                          <div className="h-1.5 w-full bg-app-sidebar rounded-full overflow-hidden">
                             <div className={`h-full ${item.color} w-[65%]`} />
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="bg-app-card border border-app-border rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                     <h4 className="text-sm font-bold text-white">Deal Performance</h4>
                     <BarChart3 className="w-5 h-5 text-app-accent-light" />
                  </div>
                  <div className="flex flex-col items-center justify-center h-full pb-8">
                     <div className="relative w-24 h-24 mb-4">
                        <svg className="w-full h-full transform -rotate-90">
                           <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                           <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="60" className="text-app-accent" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">74%</div>
                     </div>
                     <p className="text-[11px] text-app-text-secondary text-center max-w-[140px]">Deals reaching 74% of target conversion volume.</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Alerts & Monitoring */}
         <div className="space-y-6">
            <div className="bg-app-card border border-app-border rounded-2xl p-6">
               <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  Security Alerts
               </h4>
               <div className="space-y-4">
                  {[
                    { msg: 'Abnormal traffic spike detected', time: '2h ago', level: 'warning' },
                    { msg: 'Unauthorized SKU attempt', time: '1d ago', level: 'urgent' },
                  ].map((alert, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${alert.level === 'urgent' ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                       <p className={`text-[12px] font-bold ${alert.level === 'urgent' ? 'text-red-500' : 'text-orange-500'}`}>{alert.msg}</p>
                       <span className="text-[10px] text-app-text-secondary opacity-60">{alert.time}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-2xl p-6">
               <h4 className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mb-6">Recent Customer Queries</h4>
               <div className="space-y-4">
                  {[
                    { user: 'Rahat I.', msg: 'Is the warranty applicable in BD?', time: '14 min ago' },
                    { user: 'Sultana R.', msg: 'Order update needed please.', time: '52 min ago' },
                    { user: 'Tanvir A.', msg: 'Can I pay via SSLCommerz?', time: '2 hr ago' },
                  ].map((q, i) => (
                    <div key={i} className="flex gap-3 pb-4 border-b border-app-border last:border-0 last:pb-0">
                       <div className="w-8 h-8 rounded-lg bg-app-sidebar flex items-center justify-center text-[10px] font-bold text-app-accent-light shrink-0">
                          {q.user[0]}
                       </div>
                       <div>
                          <p className="text-[12px] font-bold text-white leading-none mb-1">{q.user}</p>
                          <p className="text-[11px] text-app-text-secondary line-clamp-1">{q.msg}</p>
                       </div>
                    </div>
                  ))}
               </div>
               <button className="w-full mt-6 py-2 bg-white/5 border border-app-border text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all">
                  Inspect All Tickets
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
