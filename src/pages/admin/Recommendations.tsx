import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

export interface Recommendation {
  id: string;
  creator: string;
  creatorId: string;
  creatorHandle?: string;
  title: string;
  body: string;
  tags: string[];
  status: 'Pending' | 'Live' | 'Rejected' | 'Flagged' | 'Archived';
  views: number;
  initials: string;
  flagged: boolean;
  submittedAt: string; // ISO string
  rejectionReason?: string;
  category?: string;
  subCategory?: string;
  products?: { id: string; name: string; price: string; brand: string; }[];
}

// Module-level shared in-memory state repository
export const sharedRecommendations: Recommendation[] = [
  { 
    id: 'rec-1', 
    creator: 'Rifat Hasan', 
    creatorId: '1', 
    creatorHandle: '@rifat_hasan',
    title: 'Best phones under ৳20,000 in Bangladesh — May 2026', 
    body: 'Comprehensive guide covering 8 smartphones with hands-on comparisons. Includes Xiaomi, Samsung A-series, and realme. Personally tested camera and battery performance under Dhaka Dhaka heat.', 
    tags: ['Mobile', 'Budget', 'Comparison'], 
    status: 'Pending', 
    views: 452, 
    initials: 'RH',
    flagged: false,
    submittedAt: '2026-06-21T08:00:00.000Z',
    category: 'Technology',
    subCategory: 'Smartphones',
    products: [
      { id: 'p1', name: 'Xiaomi Redmi Note 13', price: '৳ 18,990', brand: 'Xiaomi' },
      { id: 'p2', name: 'Samsung Galaxy A15', price: '৳ 19,500', brand: 'Samsung' },
    ]
  },
  { 
    id: 'rec-2', 
    creator: 'Sifat Tanvir', 
    creatorId: '4', 
    creatorHandle: '@sifat_reviews',
    title: 'Top 5 Flagship Smartphones for Content Creators in 2025', 
    body: 'Choosing the right smartphone for content creation in Bangladesh can be challenging. You need a device that doesn\'t just have a great camera, but also has the processing power for quick mobile exports and a battery that lasts all day during outdoor shoots.\n\nIn this list, I\'m focusing on "Video Dynamic Range" and "Microphone Quality" which are often overlooked but crucial for 2025 content formats like high-fidelity Reels and long-form YouTube cinematic vlogs. I\'ve personally tested these models across Dhaka\'s varying lighting conditions — from the bright daylight of Dhanmondi Lake to the tricky indoor neon of Banani\'s cafes.', 
    tags: ['Tech', 'Creator', 'Mobile'], 
    status: 'Pending', 
    views: 1240, 
    initials: 'ST',
    flagged: false,
    submittedAt: '2026-06-21T09:24:00.000Z',
    category: 'Technology',
    subCategory: 'Mobile Portfolio',
    products: [
      { id: 'p1', name: 'Samsung Galaxy S24 Ultra', price: '৳ 145,000', brand: 'Samsung' },
      { id: 'p2', name: 'iPhone 15 Pro Max', price: '৳ 158,000', brand: 'Apple' },
      { id: 'p3', name: 'Google Pixel 9 Pro', price: '৳ 115,000', brand: 'Google' },
    ]
  },
  { 
    id: 'rec-3', 
    creator: 'Tahmina Begum', 
    creatorId: '10', 
    creatorHandle: '@tahmina_designs',
    title: 'Eid fashion must-haves 2026 — traditional meets modern', 
    body: 'Curated list of 15 outfit picks for Eid, from Aarong\'s exquisite jamdani silk collection to contemporary fusion wear from local homegrown labels like Sarah Karim and Taaga.', 
    tags: ['Fashion', 'Eid'], 
    status: 'Pending', 
    views: 890, 
    initials: 'TB',
    flagged: false,
    submittedAt: '2026-06-20T14:30:00.000Z',
    category: 'Fashion',
    subCategory: 'Ethnic Collectives',
    products: [
      { id: 'p4', name: 'Aarong Jamdani Saree', price: '৳ 14,500', brand: 'Aarong' },
      { id: 'p5', name: 'Taaga Embroidered Kurti', price: '৳ 3,800', brand: 'Taaga' }
    ]
  },
  { 
    id: 'rec-4', 
    creator: 'Anonymous K.', 
    creatorId: '11', 
    creatorHandle: '@bargain_hunter',
    title: 'Top 10 phones you MUST buy NOW — exclusive deals!', 
    body: 'Click-bait style content. Contains 6 external affiliate links to unverified stores. Duplicate of previously rejected posts promoting non-approved products.', 
    tags: ['Mobile', 'Spam'], 
    status: 'Flagged', 
    views: 14, 
    initials: 'AK', 
    flagged: true,
    submittedAt: '2026-06-19T21:05:00.000Z',
    category: 'Technology',
    subCategory: 'Hot Deals',
    products: [
      { id: 'p6', name: 'Clone Phone G5', price: '৳ 4,500', brand: 'Generic Store' }
    ]
  },
  { 
    id: 'rec-5', 
    creator: 'Farhan bin Rafiq', 
    creatorId: '12', 
    creatorHandle: '@farhan_coders',
    title: 'Best Mechanical Keyboards for Programming in Dhaka', 
    body: 'A deep dive into custom mechanical keyboards available locally in BD. Switch actuation, keycaps, and hot-swappable stabilizers compared for programmers.', 
    tags: ['Tech', 'Keyboard', 'Coding'], 
    status: 'Live', 
    views: 4509, 
    initials: 'FR',
    flagged: false,
    submittedAt: '2026-06-18T10:00:00.000Z',
    category: 'Technology',
    subCategory: 'Peripherals',
    products: [
      { id: 'k1', name: 'Keychron Q1 Pro', price: '৳ 18,500', brand: 'Keychron' },
      { id: 'k2', name: 'Royal Kludge RK61', price: '৳ 4,800', brand: 'Royal Kludge' }
    ]
  },
  { 
    id: 'rec-6', 
    creator: 'Nafis Iqbal', 
    creatorId: '13', 
    creatorHandle: '@nafis_eats',
    title: 'Dhaka Foodie Guide: Best Biryani spots under ৳300', 
    body: 'Old Dhaka legacy spots versus modern outlets in Dhanmondi. Real mutton portion scale, basmati rice quality, and saffron-ghee check.', 
    tags: ['Food', 'Dhaka', 'Budget'], 
    status: 'Live', 
    views: 12450, 
    initials: 'NI',
    flagged: false,
    submittedAt: '2026-06-17T12:00:00.000Z',
    category: 'Lifestyle',
    subCategory: 'Local Dining',
    products: [
      { id: 'f1', name: 'Nanna Biryani Voucher', price: '৳ 220', brand: 'Nanna Biryani' }
    ]
  },
  { 
    id: 'rec-7', 
    creator: 'Sanya Zaman', 
    creatorId: '14', 
    creatorHandle: '@sanya_studies',
    title: 'Minimalist Study Desk Setup Guide 2026', 
    body: 'Clean up cable management on a low budget structure. Includes dual monitor mounts, desk shelf materials, and LED strip products available in Dhaka shops.', 
    tags: ['Lifestyle', 'Productivity'], 
    status: 'Archived', 
    views: 3120, 
    initials: 'SZ',
    flagged: false,
    submittedAt: '2026-06-16T15:20:00.000Z',
    category: 'Lifestyle',
    subCategory: 'Home Decor',
    products: [
      { id: 'd1', name: 'Felt Desk Pad XL', price: '৳ 850', brand: 'BD Office' }
    ]
  },
  { 
    id: 'rec-8', 
    creator: 'ElectroBD Dhaka', 
    creatorId: '15', 
    creatorHandle: '@electro_dhaka',
    title: 'Scam Alert: Fake Power Banks in BD Markets', 
    body: 'Comprehensive diagnostic on identifying fake lithium cells, weight fraud tricks, and false barcode serial certifications in local markets.', 
    tags: ['Tech', 'Alert'], 
    status: 'Rejected', 
    views: 240, 
    initials: 'EB',
    flagged: false,
    submittedAt: '2026-06-15T09:30:00.000Z',
    rejectionReason: 'Content does not focus on explicit recommendations, violates educational template guidelines',
    category: 'Technology',
    subCategory: 'Diagnostic Alert',
    products: [
      { id: 'p7', name: 'Cloned Anker Power Bank', price: '৳ 1,200', brand: 'Unverified Shop' }
    ]
  }
];

export default function RecommendationsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Create state of recommendations seeded with sharedRecommendations
  const [recs, setRecs] = useState<Recommendation[]>(() => {
    return [...sharedRecommendations];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'Pending' | 'Live' | 'Archived' | 'Moderated'>('Pending');
  
  // Track open reject inline popovers
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Handle callback triggers from Interactive Preview page passed via Router location state
  useEffect(() => {
    if (location.state && location.state.action && location.state.id) {
      const { action, id, reason } = location.state;
      
      const index = sharedRecommendations.findIndex(r => r.id === id);
      if (index !== -1) {
        if (action === 'approve') {
          sharedRecommendations[index].status = 'Live';
          sharedRecommendations[index].flagged = false;
        } else if (action === 'reject') {
          sharedRecommendations[index].status = 'Rejected';
          sharedRecommendations[index].rejectionReason = reason || 'Rejected via interactive moderation terminal';
        }
      }
      
      // Update local state and persist back memory
      setRecs([...sharedRecommendations]);
      
      // Clear location state securely to prevent loops
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  // Sync back local updates to shared module array Helper
  const updateRecStatus = (id: string, updates: Partial<Recommendation>) => {
    const idx = sharedRecommendations.findIndex(r => r.id === id);
    if (idx !== -1) {
      sharedRecommendations[idx] = { ...sharedRecommendations[idx], ...updates };
    }
    setRecs([...sharedRecommendations]);
  };

  // Dynamically compute tab counts from state
  const pendingCount = useMemo(() => recs.filter(r => r.status === 'Pending' && !r.flagged).length, [recs]);
  const liveCount = useMemo(() => recs.filter(r => r.status === 'Live' && !r.flagged).length, [recs]);
  const archivedCount = useMemo(() => recs.filter(r => r.status === 'Archived' && !r.flagged).length, [recs]);
  const moderatedCount = useMemo(() => recs.filter(r => r.status === 'Rejected' || r.status === 'Flagged' || r.flagged).length, [recs]);

  // Stat cards dynamically calculated from state
  const statTotalContent = recs.length;
  const statLiveGuides = recs.filter(r => r.status === 'Live' && !r.flagged).length;
  const statPendingReview = recs.filter(r => r.status === 'Pending').length;
  const statHighConflict = recs.filter(r => r.flagged || r.status === 'Flagged').length;

  // Perform search & tab filtering using useMemo
  const filteredRecs = useMemo(() => {
    return recs.filter(rec => {
      // 1. Search term check (filters by title or creator name)
      const matchesSearch = 
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.creator.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Tab filter check
      if (activeTab === 'Pending') {
        return rec.status === 'Pending' && !rec.flagged;
      }
      if (activeTab === 'Live') {
        return rec.status === 'Live' && !rec.flagged;
      }
      if (activeTab === 'Archived') {
        return rec.status === 'Archived' && !rec.flagged;
      }
      if (activeTab === 'Moderated') {
        return rec.status === 'Rejected' || rec.status === 'Flagged' || rec.flagged;
      }

      return true;
    });
  }, [recs, searchTerm, activeTab]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight animate-fade-in">Recommendation Moderation</h1>
          <p className="text-app-text-secondary text-[12px]">Approve, reject or flag expert-curated content</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light transition-colors" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or creator..."
              className="pl-10 pr-4 py-2 bg-app-card border border-app-border rounded-lg text-sm w-full md:w-64 focus:outline-none focus:border-app-accent/50 transition-all text-white placeholder-app-text-secondary/40 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Content', val: statTotalContent, trend: '+12%', color: 'border-l-blue-500' },
          { label: 'Live Guides', val: statLiveGuides, trend: '+4%', color: 'border-l-green-500' },
          { label: 'Pending Review', val: statPendingReview, trend: '-2%', color: 'border-l-orange-500' },
          { label: 'High Conflict', val: statHighConflict, trend: '+20%', color: 'border-l-red-500' },
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

      {/* Tabs with badge counts computed dynamically */}
      <div className="flex border-b border-app-border overflow-x-auto scrollbar-none">
        {[
          { key: 'Pending', label: `Pending Review (${pendingCount})` },
          { key: 'Live', label: `Live Feed (${liveCount})` },
          { key: 'Archived', label: `Archived (${archivedCount})` },
          { key: 'Moderated', label: `Moderated (${moderatedCount})` }
        ].map((tab) => (
          <button 
            key={tab.key} 
            onClick={() => {
              setActiveTab(tab.key as any);
              setRejectingId(null);
            }}
            className={`px-6 py-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-all whitespace-nowrap hover:text-white ${
              activeTab === tab.key 
                ? 'text-app-accent-light border-b-2 border-app-accent' 
                : 'text-app-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRecs.map(rec => (
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
                       <span className="text-[10px] text-app-text-secondary opacity-40 font-bold uppercase tracking-widest">
                         Submitted {new Date(rec.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                       </span>
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

               {rec.rejectionReason && (
                 <div className="bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-xl mb-4 text-[11px] text-red-400">
                   <strong className="uppercase font-bold tracking-wider">Rejection Reason:</strong> {rec.rejectionReason}
                 </div>
               )}
               
               <div className="flex flex-wrap gap-2">
                  {rec.tags.map(t => (
                    <span key={t} className={`text-[10px] px-3 py-1 rounded-lg border font-bold uppercase tracking-widest ${t === 'Spam' || t === 'Alert' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-lg shadow-red-500/10' : 'bg-app-sidebar text-app-text-primary border-app-border'}`}>
                       {t}
                    </span>
                  ))}
               </div>
            </div>

            <div className="xl:w-[240px] flex flex-col xl:items-end justify-center gap-3 border-t xl:border-t-0 xl:border-l border-white/5 pt-4 xl:pt-0 xl:pl-6 shrink-0">
                <div className="flex items-center justify-between xl:flex-col xl:items-end w-full mb-2">
                   <span className={`text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-widest border ${rec.status === 'Live' ? 'bg-green-500/10 text-green-500 border-green-500/20' : rec.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                      {rec.status}
                   </span>
                   <div className="flex items-center gap-2 text-[11px] text-app-text-secondary mt-2 opacity-50">
                      <Eye className="w-4 h-4" /> {rec.views.toLocaleString()} views
                   </div>
                </div>
                
                {/* Dynamically controlled Action button matrix */}
                <div className="grid grid-cols-2 xl:flex xl:flex-col gap-2 w-full">
                   {rec.status === 'Live' ? (
                     // Only visible on Live items
                     <button 
                       onClick={() => updateRecStatus(rec.id, { status: 'Flagged', flagged: true })}
                       className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-650/10 border border-red-500/30 hover:bg-red-550/20 text-red-500 rounded-xl text-xs font-bold transition-all active:scale-95"
                     >
                        <ShieldAlert className="w-4 h-4" /> Flag Content
                     </button>
                   ) : (
                     // Visible on Pending / Rejected / Archived to Approve & schedule Live
                     <button 
                       onClick={() => updateRecStatus(rec.id, { status: 'Live', flagged: false })}
                       className="flex items-center justify-center gap-2 px-4 py-2.5 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/10 active:scale-95"
                     >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                     </button>
                   )}

                   <Link 
                     to={`/admin/recommendations/${rec.id}`}
                     className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-app-border text-white hover:bg-white/10 rounded-xl text-xs font-bold transition-all active:scale-95"
                   >
                      <ArrowUpRight className="w-4 h-4" /> Interactive Preview
                   </Link>
                </div>

                {/* Inline Popover for Reject Reason Input */}
                {rec.status !== 'Rejected' && (
                  <div className="w-full">
                    {rejectingId === rec.id ? (
                      <div className="bg-app-sidebar border border-red-500/20 p-3 rounded-xl space-y-2 text-left w-full mt-1">
                        <textarea 
                          value={rejectionReasonInput}
                          onChange={(e) => setRejectionReasonInput(e.target.value)}
                          placeholder="Rejection reason details..."
                          rows={2}
                          className="w-full px-2 py-1.5 bg-app-card border border-app-border rounded-lg text-xs text-white focus:outline-none focus:border-red-500/50 resize-none font-medium text-left"
                          required
                        />
                        <div className="flex gap-2 justify-end">
                          <button 
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectionReasonInput(''); }}
                            className="px-2.5 py-1 text-app-text-secondary hover:text-white text-[10px] uppercase font-bold"
                          >
                            Cancel
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              if (!rejectionReasonInput.trim()) return;
                              updateRecStatus(rec.id, { status: 'Rejected', rejectionReason: rejectionReasonInput });
                              setRejectingId(null);
                              setRejectionReasonInput('');
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] uppercase font-bold rounded-md"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setRejectingId(rec.id); setRejectionReasonInput(''); }}
                        className="w-full py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all text-center"
                      >
                         Reject Content
                      </button>
                    )}
                  </div>
                )}
            </div>
          </div>
        ))}

        {filteredRecs.length === 0 && (
          <div className="bg-app-card border border-app-border rounded-2xl p-8 text-center text-xs text-app-text-secondary italic">
            No recommendation guides match is found under current search filter attributes.
          </div>
        )}
      </div>
    </div>
  );
}
