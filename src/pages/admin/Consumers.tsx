import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useContact } from '../../contexts/ContactInteractionContext';
import { operationsApi } from '../../services/operationsApi';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Ban, 
  UserCheck, 
  Shield, 
  Eye, 
  MessageCircle, 
  ExternalLink, 
  Award, 
  Sparkles, 
  ShieldAlert,
  Clock,
  History,
  Activity,
  UserCheck2,
  CheckCircle2,
  Lock,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: 'Consumer' | 'Creator' | 'Seller' | 'Admin';
  status: 'Active' | 'Banned' | 'Inactive';
  joined: string;
  active: string;
  initials: string;
  trustScore: number;
  behaviorSegment: string;
}

const mockUsers: MockUser[] = [];

const RoleBadge = ({ role }: { role: string }) => {
  const styles: Record<string, string> = {
    'Consumer': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Seller': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Creator': 'bg-green-500/10 text-green-400 border-green-500/20',
    'Admin': 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-wider border ${styles[role] || styles['Consumer']}`}>
      {role}
    </span>
  );
};

export default function ConsumersPage() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('viewMode') || 'consumers';

  // Route Context Identification
  const isCreatorView = viewMode === 'creators';
  const isAdminView = viewMode === 'admins';
  const isConsumerView = viewMode === 'consumers' || (!isCreatorView && !isAdminView);

  // Active user type selection matches table listing path
  const currentViewRole = isCreatorView 
    ? 'Creator' 
    : isAdminView 
      ? 'Admin' 
      : 'Consumer';

  const [usersList, setUsersList] = useState<MockUser[]>(mockUsers);
  const { triggerMessage } = useContact();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    operationsApi
      .listUsers()
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) {
          setUsersList(rows as MockUser[]);
        }
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAction = (userId: string, actionType: 'verify' | 'suspend' | 'flag') => {
    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        if (actionType === 'suspend') {
          showToast(`Account of ${u.name} has been suspended.`);
          return { ...u, status: 'Banned' as const };
        }
        if (actionType === 'verify') {
          showToast(`Account of ${u.name} is now certified active.`);
          return { ...u, status: 'Active' as const };
        }
      }
      return u;
    }));
    setActiveMenu(null);
  };

  // Filter based on currently active left sidebar route type
  const baseFiltered = usersList.filter(u => u.role === currentViewRole);

  const finalFiltered = baseFiltered.filter(u => {
    const s = searchQuery.toLowerCase();
    return !searchQuery || 
      u.name.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s) || 
      u.behaviorSegment.toLowerCase().includes(s);
  });

  const getProfilePath = (role: string, id: string) => {
    if (role === 'Seller') return `/upe/seller/${id}`;
    if (role === 'Creator') return `/upe/creator/${id}`;
    if (role === 'Admin') return `/upe/consumer/${id}`;
    return `/upe/consumer/${id}`;
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary transition-all animate-in fade-in duration-300">
      
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb Indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <span>Platform Registry</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span>Consumers</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">{currentViewRole}s Directory</span>
          </div>

           <h1 className="text-xl font-bold text-white tracking-tight">
            {isCreatorView && 'Creator Management'}
            {isAdminView && 'Security & Administration'}
            {isConsumerView && 'Consumer Management Hub'}
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            {isCreatorView && 'Monitor expert content curators, recommendation algorithms, and campaign conversion rates.'}
            {isAdminView && 'Comprehensive monitoring of credentials, assigned permission groups, and staff action logs.'}
            {isConsumerView && 'Manage registered platform buyers, behavior intent patterns, and audit safety ratings.'}
          </p>
        </div>

        {/* Filters and Inputs */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light transition-colors" />
            <input 
              type="text" 
              placeholder={`Search ${currentViewRole.toLowerCase()}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs w-full md:w-64 focus:outline-none focus:border-app-accent/50 transition-all text-white placeholder-app-text-secondary/40 font-medium"
            />
          </div>
          <button 
            onClick={() => showToast('Applied advanced filtering profiles')}
            className="flex items-center gap-1.5 bg-app-card border border-app-border hover:border-app-accent text-app-text-primary px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 hover:text-white cursor-pointer"
          >
             <Filter className="w-3.5 h-3.5 text-app-accent" />
             <span>Refine List</span>
          </button>
          <button 
            onClick={() => showToast(`Initiated onboard wrapper for ${currentViewRole}`)}
            className="flex items-center gap-1.5 bg-app-accent border border-transparent text-white px-3.5 py-1.5 rounded-[4px] text-xs font-bold transition-all shadow-md hover:bg-orange-600 cursor-pointer shrink-0"
          >
             <span>{isCreatorView ? 'Onboard Creator' : isAdminView ? 'Invite Admin' : 'Invite Consumer'}</span>
          </button>
        </div>
      </div>

      {/* CONTEXTUAL STATS BLOCK */}
      {isCreatorView && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Influencers', val: '8,410', color: 'border-l-green-500', note: 'Verified ecosystem curators' },
              { label: 'Active in 30d', val: '7,240', color: 'border-l-blue-500', note: '86% active contribution MTD' },
              { label: 'Avg Engagement Rate', val: '18.4%', color: 'border-l-purple-500', note: 'Highly resonant posts' },
              { label: 'Brand Sales Generated', val: '৳ 1.84M', color: 'border-l-orange-500', note: 'Direct marketing attribution' },
            ].map(s => (
              <div key={s.label} className={`bg-app-card p-4.5 rounded-[4px] border border-app-border border-l-[3px] shadow-lg ${s.color}`}>
                <div className="text-[20px] font-bold text-white tracking-tight font-mono">{s.val}</div>
                <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-70">{s.label}</div>
                <div className="text-[9.5px] text-app-text-secondary italic mt-1">{s.note}</div>
              </div>
            ))}
          </div>

          {/* Detailed Creator Behavioural Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-app-card rounded-[4px] border border-app-border p-5 space-y-4">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> CREATOR PERFORMANCE RANKINGS
              </h4>
              <div className="space-y-3">
                {[
                  { rank: '#1', category: 'Boutique Closets', engagement: '24.2% engagement', bg: 'bg-green-500/10 text-green-400' },
                  { rank: '#2', category: 'Gadget Overviews', engagement: '18.9% engagement', bg: 'bg-blue-500/10 text-blue-400' },
                  { rank: '#3', category: 'Traditional Wear', engagement: '15.4% engagement', bg: 'bg-purple-500/10 text-purple-400' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.04] last:border-none">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[9px] ${item.bg}`}>
                        {item.rank}
                      </span>
                      <span className="text-white font-semibold">{item.category}</span>
                    </div>
                    <span className="font-mono text-[11px] text-app-text-secondary">{item.engagement}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-app-card rounded-[4px] border border-app-border p-5 space-y-4">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" /> RESOUNDING RECOMMENDATIONS
              </h4>
              <div className="space-y-3">
                {[
                  { title: 'Top Summer Jamdani Closets 2026', views: '45.2k clicks', author: 'Rifat Hasan' },
                  { title: 'Must-Have Tech Gear Bangladesh', views: '38.1k clicks', author: 'Sumaiya Rahman' },
                  { title: 'Aarong Silk Heritage Review', views: '29.3k clicks', author: 'Tahmid Alvi' },
                ].map((post, idx) => (
                  <div key={idx} className="space-y-0.5 pb-2 border-b border-white/[0.04] last:border-none">
                    <div className="text-xs font-bold text-white truncate">{post.title}</div>
                    <div className="flex justify-between text-[10px] text-app-text-secondary font-mono">
                      <span>By {post.author}</span>
                      <span className="text-emerald-400 font-semibold">{post.views}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-app-card rounded-[4px] border border-app-border p-5 space-y-4">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" /> HIGH AFFILIATE EARNERS
              </h4>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.04]">
                  <span className="text-app-text-secondary font-medium">Top Affiliate Contributor</span>
                  <div className="text-right">
                    <span className="block font-bold text-white">Rifat Hasan</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">৳ 142k Commission Generated</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-app-text-secondary font-medium">Highest Lead Value Tag</span>
                  <div className="text-right">
                    <span className="block font-bold text-white">Traditional Fabric Saree</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-semibold">12.4k conversions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isConsumerView && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Registered Consumers', val: '142,500', color: 'border-l-indigo-500', note: 'Enrolled platform buyers' },
              { label: 'Purchased in 30d', val: '12,940', color: 'border-l-emerald-500', note: '90.8% organic conversion rate' },
              { label: 'Average Basket Value', val: '৳ 3,250', color: 'border-l-blue-500', note: 'High value retention target' },
              { label: 'Unverified Flagged Accounts', val: '5 accounts', color: 'border-l-red-500', note: 'Under observation' },
            ].map(s => (
              <div key={s.label} className={`bg-app-card p-4.5 rounded-[4px] border border-app-border border-l-[3px] shadow-lg ${s.color}`}>
                <div className="text-[20px] font-bold text-white tracking-tight font-mono">{s.val}</div>
                <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-70">{s.label}</div>
                <div className="text-[9.5px] text-app-text-secondary italic mt-1">{s.note}</div>
              </div>
            ))}
          </div>

          {/* SECTION B: Consumer Behavioral Trends (Search, View, Save) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xl space-y-3">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#F4631E] block">Most Searched Products</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white font-medium">Jamdani Silk Traditional Saree</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">8.4k searches</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-80">
                  <span className="text-white">Samsung S25 Ultra</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">6.1k searches</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-60">
                  <span className="text-slate-200">Pure Mustard Oil 1L</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">2.1k searches</span>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xl space-y-3">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">Most Viewed Products</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white font-medium">Vision Smart TV 55"</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">12.8k views</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-80">
                  <span className="text-white">Walton 2-Door Fridge</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">8.9k views</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-60">
                  <span className="text-slate-200">Samsung S25 Ultra</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">8.4k views</span>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xl space-y-3">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-400 block">Most Saved / Wishlisted</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white font-medium">Walton 2-Door Fridge</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">1.2k saves</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-80">
                  <span className="text-white">Jamdani Silk Traditional Saree</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">950 saves</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-60">
                  <span className="text-slate-200">TechCore Bluetooth Smart Watch</span>
                  <span className="text-slate-400 font-mono text-[10.5px]">810 saves</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdminView && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Administrative Staff', val: '12 active', color: 'border-l-red-500', note: 'Access level certified employees' },
              { label: 'Operations Audited (30d)', val: '1,540', color: 'border-l-amber-500', note: 'No pending security escalations' },
              { label: 'Moderation Clear Score', val: '99.8%', color: 'border-l-blue-500', note: 'Perfect response time compliance' },
              { label: 'Active Admin Logins', val: '3 live sessions', color: 'border-l-green-500', note: 'Fully authenticated access nodes' },
            ].map(s => (
              <div key={s.label} className={`bg-app-card p-4.5 rounded-[4px] border border-app-border border-l-[3px] shadow-lg ${s.color}`}>
                <div className="text-[20px] font-bold text-white tracking-tight font-mono">{s.val}</div>
                <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-70">{s.label}</div>
                <div className="text-[9.5px] text-app-text-secondary italic mt-1">{s.note}</div>
              </div>
            ))}
          </div>

          {/* Admin Security Information Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-app-card rounded-[4px] border border-app-border p-5 space-y-3 col-span-2">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/[0.04] pb-2">
                <Lock className="w-4 h-4 text-red-400" /> EMERGENCY AUDITING SCOPES ACTIVE
              </h4>
              <div className="text-xs text-app-text-secondary space-y-2 leading-relaxed">
                <p>
                  Any credentials modifications, database queries over-the-rainbow, and temporary or permanent bans are permanently logged in compliance with platform encryption protocols.
                </p>
                <div className="flex gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-[2px] bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">Level 5 Security Access Control Active</span>
                  <span className="px-2.5 py-1 rounded-[2px] bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20">RBAC Audits Synced</span>
                </div>
              </div>
            </div>

            <div className="bg-app-card rounded-[4px] border border-app-border p-5 space-y-3.5">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" /> AUDITING RECENT EVENTS
              </h4>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="flex justify-between text-app-text-secondary border-b border-white/[0.02] pb-1.5">
                  <span className="text-white font-bold">@adnan_sys</span>
                  <span>Banned FakeStore BD</span>
                </div>
                <div className="flex justify-between text-app-text-secondary">
                  <span className="text-white font-bold">@fatema_auditor</span>
                  <span>Validated Nadia Akter KYC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRY TABLE PANEL */}
      <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-app-border">
                <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Account Identification</th>
                {!isCreatorView ? (
                  <>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Role Type</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Behavior Intent Segment</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Security Trust Score</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Follower Range</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Content Count</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Verification Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Commission Tier</th>
                  </>
                )}
                <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Status Badge</th>
                {!isCreatorView && (
                  <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest">Last Access Active</th>
                )}
                <th className="px-6 py-4 text-[11px] font-bold text-app-text-secondary uppercase tracking-widest text-right">Administrative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[13px]">
              {finalFiltered.length > 0 ? (
                finalFiltered.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Link 
                          to={getProfilePath(u.role, u.id)} 
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[11.5px] font-bold bg-app-sidebar border border-app-border text-app-accent-light hover:border-app-accent/50 transition-all active:scale-95 shrink-0"
                        >
                          {u.initials}
                        </Link>
                        <div className="min-w-0">
                          <Link 
                            to={getProfilePath(u.role, u.id)} 
                            className="font-bold text-white hover:text-app-accent-light transition-colors block truncate"
                          >
                            {u.name}
                          </Link>
                          <div className="text-[10px] text-app-text-secondary/50 font-mono italic truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    {!isCreatorView ? (
                      <>
                        <td className="px-6 py-4">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-[11px] text-indigo-300 bg-indigo-500/5 px-2 py-1 rounded-[2px] border border-indigo-500/10">
                            🎯 {u.behaviorSegment || 'General User Profile'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-mono shrink-0">
                            <span className={`font-black text-[11px] ${
                              u.trustScore >= 90 ? 'text-green-400' : u.trustScore >= 75 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {u.trustScore || 85}%
                            </span>
                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className={`h-full ${u.trustScore >= 90 ? 'bg-green-500' : u.trustScore >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                style={{ width: `${u.trustScore || 85}%` }} 
                              />
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-white">
                            {u.id === '1' ? '120k' : u.id === '6' ? '85k' : '42k'} Followers
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-300">
                          {u.id === '1' ? '142' : u.id === '6' ? '98' : '64'} posts
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold ${
                            u.id === '1' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : u.id === '6' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>
                            {u.id === '1' ? 'Elite Partner' : u.id === '6' ? 'Pro Creator' : 'Approved'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-emerald-400 font-bold">
                          {u.id === '1' ? '12%' : u.id === '6' ? '10%' : '8%'} tier
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 shrink-0">
                         <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${u.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>
                           {u.status}
                         </span>
                      </div>
                    </td>
                    {!isCreatorView && (
                      <td className="px-6 py-4 text-app-text-secondary/60 shrink-0 font-mono text-[11px]">
                        {u.active} 
                        <span className="text-[9.5px] text-slate-500 block font-sans">joined {u.joined}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end relative">
                         <button 
                           onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                           className={`w-8 h-8 flex items-center justify-center rounded-[4px] border transition-all cursor-pointer ${
                             activeMenu === u.id 
                               ? 'bg-app-accent text-white border-app-accent shadow-lg' 
                               : 'bg-white/5 text-app-text-secondary border-transparent hover:text-white hover:bg-white/10'
                           }`}
                         >
                            <MoreVertical className="w-4 h-4" />
                         </button>

                         {activeMenu === u.id && (
                           <>
                             <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                             <div className="absolute right-0 top-10 w-48 bg-app-card border border-app-border rounded-[4px] shadow-2xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <Link 
                                  to={getProfilePath(u.role, u.id)} 
                                  className="flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors"
                                >
                                   <Eye className="w-3.5 h-3.5 text-app-accent" /> 
                                   <span>View Dashboard Card</span>
                                </Link>
                                <button 
                                  onClick={() => {
                                    setActiveMenu(null);
                                    triggerMessage({ id: u.id, name: u.name, avatarUrl: u.avatar, phone: u.phone || '+8801700000000', status: u.status, role: u.role });
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-medium text-app-text-primary hover:bg-app-accent/10 hover:text-app-accent-light transition-colors text-left"
                                >
                                   <MessageCircle className="w-3.5 h-3.5 text-app-accent" /> 
                                   <span>Direct Message</span>
                                </button>
                                
                                <div className="border-t border-app-border my-1" />
                                {u.status === 'Banned' ? (
                                  <button 
                                    onClick={() => handleAction(u.id, 'verify')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-bold text-green-400 hover:bg-green-500/10 transition-colors text-left"
                                  >
                                     <UserCheck className="w-3.5 h-3.5" /> 
                                     <span>Restore Profile</span>
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleAction(u.id, 'suspend')}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-[11.5px] font-bold text-red-500 hover:bg-red-500/10 transition-colors text-left"
                                  >
                                     <Ban className="w-3.5 h-3.5" /> 
                                     <span>Block User Access</span>
                                  </button>
                                )}
                             </div>
                           </>
                         )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-app-text-secondary">
                    <ShieldAlert className="w-8 h-8 text-app-text-secondary/20 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">No matches found for your search inquiry</p>
                    <p className="text-xs">Refine your keyword queries or select a different user catalog tab.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Section */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-between text-[11px] font-bold text-app-text-secondary uppercase tracking-widest bg-white/[0.01]">
           <div>Registry range: 1 — {finalFiltered.length} of {finalFiltered.length} matches</div>
           <div className="flex gap-1.5">
              <button className="px-3 py-1 bg-white/5 border border-white/5 text-white/20 cursor-not-allowed rounded-[2px]">Prev</button>
              <button className="px-3 py-1 bg-app-accent text-white shadow-sm rounded-[2px]">01</button>
              <button className="px-3 py-1 bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-all rounded-[2px]">Next</button>
           </div>
        </div>
      </div>

    </div>
  );
}
