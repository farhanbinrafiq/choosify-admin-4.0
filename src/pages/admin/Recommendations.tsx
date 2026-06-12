import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Lightbulb, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowUpRight, 
  Clock, 
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';

const mockRecs = [
  { id: 'rec-1', creator: 'Rifat Hasan', creatorId: '1', title: 'Best phones under ৳20,000 in Bangladesh — May 2026', body: 'Comprehensive guide covering 8 smartphones with hands-on comparisons. Includes Xiaomi, Samsung A-series...', tags: ['Mobile', 'Budget', 'Comparison'], status: 'Pending', views: 'Preview ready', initials: 'RH' },
  { id: 'rec-2', creator: 'Sifat Tanvir', creatorId: '4', title: 'Top 5 Flagship Smartphones for Content Creators in 2025', body: 'Personal testing across Dhaka lighting conditions for high-fidelity Reels and cinematic vlogs.', tags: ['Tech', 'Creator', 'Mobile'], status: 'Pending', views: 'Preview ready', initials: 'ST' },
  { id: 'rec-3', creator: 'Tahmina Begum', creatorId: '10', title: 'Eid fashion must-haves 2026 — traditional meets modern', body: 'Curated list of 15 outfit picks for Eid, from Aarong\'s jamdani collection to contemporary fusion wear...', tags: ['Fashion', 'Eid'], status: 'Pending', views: 'Preview ready', initials: 'TB' },
  { id: 'rec-4', creator: 'Anonymous K.', creatorId: '11', title: 'Top 10 phones you MUST buy NOW — exclusive deals!', body: 'Click-bait style content. Contains 6 external affiliate links to unverified stores. Duplicate of previously rejected...', tags: ['Mobile', 'Spam'], status: 'Flagged', views: '4 reports', initials: 'AK', flagged: true },
];

export default function RecommendationsPage() {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Recommendation Moderation</h1>
          <p className="text-app-text-secondary text-[12px]">Approve, reject or flag expert-curated content</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light transition-colors" />
            <input 
              type="text" 
              placeholder="Search content..."
              className="pl-10 pr-4 py-2 bg-app-card border border-app-border rounded-lg text-sm w-full md:w-64 focus:outline-none focus:border-app-accent/50 transition-all text-white placeholder-app-text-secondary/40 font-medium"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Content', val: '4,820', trend: '+12%', color: 'border-l-blue-500' },
          { label: 'Live Guides', val: '4,341', trend: '+4%', color: 'border-l-green-500' },
          { label: 'Pending Review', val: '312', trend: '-2%', color: 'border-l-orange-500' },
          { label: 'High Conflict', val: '44', trend: '+20%', color: 'border-l-red-500' },
        ].map(s => (
          <div key={s.label} className={`bg-app-card p-5 rounded-2xl border border-app-border border-l-[4px] shadow-lg ${s.color}`}>
             <div className="text-2xl font-bold text-white tracking-tight">{s.val}</div>
             <div className="flex items-center justify-between mt-1">
                <div className="text-[10px] text-app-text-secondary font-bold uppercase tracking-widest">{s.label}</div>
                <div className={`text-[10px] font-bold ${s.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{s.trend}</div>
             </div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-app-border">
        {['Pending Review (312)', 'Live Feed', 'Archived', 'Moderated (44)'].map((tab, i) => (
          <button 
            key={i} 
            className={`px-6 py-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-all hover:text-white ${i === 0 ? 'text-app-accent-light border-b-2 border-app-accent' : 'text-app-text-secondary'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {mockRecs.map(rec => (
          <div key={rec.id} className={`bg-app-card border rounded-2xl p-6 flex flex-col xl:flex-row gap-6 transition-all hover:bg-white/[0.02] relative group ${rec.flagged ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,44,44,0.05)]' : 'border-app-border focus-within:border-app-accent/40 shadow-xl'}`}>
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-3 mb-4">
                  <Link to={`/admin/creators/${rec.creatorId}`} className="w-8 h-8 rounded-lg bg-app-sidebar border border-app-border text-app-accent flex items-center justify-center text-[11px] font-bold hover:border-app-accent/50 transition-all">
                    {rec.initials}
                  </Link>
                  <div>
                    <Link to={`/admin/creators/${rec.creatorId}`} className="text-[12px] font-bold text-white hover:text-app-accent-light transition-colors leading-none block">{rec.creator}</Link>
                    <div className="flex items-center gap-2 mt-1">
                       <Clock className="w-3 h-3 text-app-text-secondary opacity-40" />
                       <span className="text-[10px] text-app-text-secondary opacity-40 font-bold uppercase tracking-widest">Submitted 2 hours ago</span>
                    </div>
                  </div>
                  {rec.flagged && (
                    <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold uppercase tracking-widest animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" /> High Spam Confidence
                    </span>
                  )}
               </div>
               
               <h3 className="text-[16px] font-extrabold text-white mb-2 leading-tight group-hover:text-app-accent-light transition-colors">{rec.title}</h3>
               <p className="text-[12px] text-app-text-secondary leading-relaxed mb-6 line-clamp-2 opacity-70 group-hover:opacity-100 italic transition-all">
                 "{rec.body}"
               </p>
               
               <div className="flex flex-wrap gap-2">
                  {rec.tags.map(t => (
                    <span key={t} className={`text-[10px] px-3 py-1 rounded-lg border font-bold uppercase tracking-widest ${t === 'Spam' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-lg shadow-red-500/10' : 'bg-app-sidebar text-app-text-primary border-app-border'}`}>
                       {t}
                    </span>
                  ))}
               </div>
            </div>

            <div className="xl:w-[240px] flex flex-col xl:items-end justify-center gap-3 border-t xl:border-t-0 xl:border-l border-white/5 pt-4 xl:pt-0 xl:pl-6 shrink-0">
                <div className="flex items-center justify-between xl:flex-col xl:items-end w-full mb-2">
                   <span className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-widest border ${rec.flagged ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                      {rec.status}
                   </span>
                   <div className="flex items-center gap-2 text-[11px] text-app-text-secondary mt-2 opacity-50">
                      <Eye className="w-4 h-4" /> {rec.views}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 xl:flex xl:flex-col gap-2 w-full">
                   <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/10 active:scale-95">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                   </button>
                   <Link 
                     to={`/admin/recommendations/${rec.id}`}
                     className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-app-border text-white hover:bg-white/10 rounded-xl text-xs font-bold transition-all active:scale-95"
                   >
                      <ArrowUpRight className="w-4 h-4" /> Interactive Preview
                   </Link>
                </div>
                <button className="w-full py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all">
                   Reject Content
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
