import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Eye,
  Award,
  Sparkles,
  Link as LinkIcon,
  PlusCircle,
  ThumbsUp
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  category: string;
  clicks: string;
  status: 'Live' | 'Reviewing' | 'Draft';
  date: string;
  thumbnail: string;
}

interface ContentGroup {
  date: string;
  campaignId: string;
  items: ContentItem[];
}

interface Activity {
  iconType: 'chat' | 'rating' | 'order' | 'warning';
  title: string;
  subtitle: string;
}

interface CreatorProfileData {
  id: string;
  name: string;
  handle: string;
  status: 'Active' | 'Banned' | 'Inactive';
  verificationStatus: 'Verified' | 'Pending' | 'None';
  avatarUrl: string;
  persona: string;
  email: string;
  address: string;
  phone: string;
  lastActive: string;
  totalViews: string;
  totalContent: number;
  revenueGenerated: string;
  followers: string;
  engagementRate: string;
  specialties: string[];
  recentActivities: Activity[];
  contentGroups: ContentGroup[];
  campaignParticipationCount: number;
  conversionRate: string;
}

export default function CreatorProfile() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'All' | 'Live' | 'Reviewing' | 'Draft'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const profilesData: Record<string, CreatorProfileData> = {
    '1': {
      id: '1',
      name: 'Rifat Hasan',
      handle: '@rifat_reviews',
      status: 'Active',
      verificationStatus: 'Verified',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'High-Value Fashion & Saree Curator',
      email: 'rifat.h@choosify.com',
      address: '34, Orchard Road East, Dhanmondi, Dhaka 1209, Bangladesh',
      phone: '+880 1819-223344',
      lastActive: '10 May, 2026',
      totalViews: '45.2K views',
      totalContent: 142,
      revenueGenerated: '৳ 142k',
      followers: '42.5k',
      engagementRate: '12.4%',
      campaignParticipationCount: 8,
      conversionRate: '5.8%',
      specialties: ['Mobile Phones', 'Laptops', 'Audio', 'Traditional Fabrics'],
      recentActivities: [
        { iconType: 'rating', title: 'Content Approved', subtitle: 'Friday, Sep 6, 2026 | 12:24am' },
        { iconType: 'chat', title: 'Collaged Brand Pitch', subtitle: 'Thursday, Sep 5, 2026 | 10:15am' },
        { iconType: 'order', title: 'Affiliate Payout Recieved', subtitle: 'Tuesday, Sep 3, 2026 | 09:30pm' }
      ],
      contentGroups: [
        {
          date: 'Date of Submission 10 May, 2026',
          campaignId: 'Campaign ID: CAM-99410',
          items: [
            {
              id: 'c-rifat-1',
              title: 'Top Summer Jamdani Closets 2026',
              category: 'Boutique Closets',
              clicks: '42.5K views',
              status: 'Live',
              date: '10 May, 2026',
              thumbnail: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        },
        {
          date: 'Date of Submission 02 Apr, 2026',
          campaignId: 'Campaign ID: CAM-99214',
          items: [
            {
              id: 'c-rifat-2',
              title: 'Top 5 ANC Headphones under 10K',
              category: 'Gadget Overviews',
              clicks: '12.8K views',
              status: 'Reviewing',
              date: '02 Apr, 2026',
              thumbnail: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    },
    '6': {
      id: '6',
      name: 'Sumaiya Rahman',
      handle: '@sumaiya_closets',
      status: 'Active',
      verificationStatus: 'Verified',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'Boutique Fashion Specialist',
      email: 'sumaiya@creators.bd',
      address: 'House 14, Road 2, Gulshan 1, Dhaka, Bangladesh',
      phone: '+880 1819-555666',
      lastActive: '5 min ago',
      totalViews: '38.1K views',
      totalContent: 95,
      revenueGenerated: '৳ 98k',
      followers: '18.4k',
      engagementRate: '15.2%',
      campaignParticipationCount: 5,
      conversionRate: '4.9%',
      specialties: ['Boutique Closets', 'Traditional Wear', 'Jewelry'],
      recentActivities: [
        { iconType: 'chat', title: 'Review Submitted', subtitle: 'Today | 11:24am' },
        { iconType: 'order', title: 'New Recommendation Live', subtitle: 'Yesterday | 08:12pm' }
      ],
      contentGroups: [
        {
          date: 'Date of Submission 08 Jun, 2026',
          campaignId: 'Campaign ID: CAM-99410',
          items: [
            {
              id: 'c-sumaiya-1',
              title: 'Must-Have Tech Gear Bangladesh',
              category: 'Tech Reviewing',
              clicks: '38.1K views',
              status: 'Live',
              date: '08 Jun, 2026',
              thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    },
    '7': {
      id: '7',
      name: 'Tahmid Alvi',
      handle: '@tahmid_alvi',
      status: 'Active',
      verificationStatus: 'Verified',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256',
      persona: 'Premium Tech Guru & Unboxer',
      email: 'tahmid.alvi@creators.bd',
      address: 'Suite 4C, Concord Tower, Banani, Dhaka, Bangladesh',
      phone: '+880 1712-456123',
      lastActive: '1 day ago',
      totalViews: '29.3K views',
      totalContent: 68,
      revenueGenerated: '৳ 74k',
      followers: '22.1k',
      engagementRate: '9.8%',
      campaignParticipationCount: 4,
      conversionRate: '3.5%',
      specialties: ['Laptops', 'Mobiles', 'Home Automation'],
      recentActivities: [
        { iconType: 'order', title: 'Video Upload Complete', subtitle: '3 days ago' },
        { iconType: 'rating', title: 'Commission Calculated', subtitle: '4 days ago' }
      ],
      contentGroups: [
        {
          date: 'Date of Submission 28 May, 2026',
          campaignId: 'Campaign ID: CAM-99220',
          items: [
            {
              id: 'c-tahmid-1',
              title: 'Aarong Silk Heritage Review',
              category: 'Traditional Wear',
              clicks: '29.3K views',
              status: 'Live',
              date: '28 May, 2026',
              thumbnail: 'https://images.unsplash.com/photo-1597983073492-bc24159b4c03?auto=format&fit=crop&q=80&w=120&h=120'
            }
          ]
        }
      ]
    }
  };

  const profile = profilesData[id || ''] || profilesData['1'];

  const getFilteredGroups = () => {
    return profile.contentGroups
      .map(group => {
        const filteredItems = group.items.filter(item => {
          let tabMatch = true;
          if (activeTab === 'Live') tabMatch = item.status === 'Live';
          else if (activeTab === 'Reviewing') tabMatch = item.status === 'Reviewing'; 
          else if (activeTab === 'Draft') tabMatch = item.status === 'Draft';

          const s = searchQuery.toLowerCase();
          const searchMatch = !searchQuery || 
            item.title.toLowerCase().includes(s) || 
            group.campaignId.toLowerCase().includes(s) || 
            item.category.toLowerCase().includes(s);

          return tabMatch && searchMatch;
        });

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'rating':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <Star className="w-4 h-4 text-app-accent-light" fill="currentColor" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <ShoppingBag className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <Link to="/admin/consumers" className="hover:text-app-accent transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <Link to="/admin/consumers?tab=creators" className="hover:text-app-accent transition-colors">Users</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">
              {profile.name} (Creator)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Creator Profile</h1>
          <p className="text-app-text-secondary text-[12px]">Expert influencer ecosystem alignment & campaign performance metrics</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => showToast(`Featured Creator: ${profile.name} pushed to spotlight`, 'success')}
            className="px-3.5 py-2 bg-app-accent text-white hover:bg-app-accent-light rounded-[4px] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Feature Creator</span>
          </button>
          <Link 
            to="/admin/consumers?tab=creators"
            className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent" />
            <span>All Creators</span>
          </Link>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Creator 360 profile card & recent activities */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Profile Identity Card */}
          <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
            
            {/* Top Banner gradient compatible with Choosify colors */}
            <div className="h-24 bg-gradient-to-r from-emerald-600/30 via-app-card to-app-gradient-end opacity-90 relative" />

            {/* Profile Avatar & Details Box */}
            <div className="px-5 pb-5 relative">
              
              <div className="-mt-10 mb-4 flex items-end justify-between">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name}
                  className="w-20 h-20 rounded-full border-2 border-app-border object-cover bg-app-card shrink-0" 
                />

                {/* Styled action triggers */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => showToast(`Dialed Phone Trigger: ${profile.phone}`, 'info')}
                    className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                    title="Call Creator"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => showToast(`Initiated Creator Collaboration Workspace`, 'info')}
                    className="p-2 rounded-[4px] bg-app-accent text-white hover:bg-app-accent-light transition-all shadow-sm cursor-pointer"
                    title="Message Creator"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Identity Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold tracking-tight text-white">{profile.name}</h2>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-green-500/10 text-green-400 border-green-500/20">
                    {profile.verificationStatus}
                  </span>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {profile.status}
                  </span>
                </div>
                <p className="text-[9.5px] font-semibold text-app-accent-light font-mono block">
                  {profile.handle}
                </p>
                <p className="text-[11px] text-app-text-secondary leading-relaxed">
                  {profile.persona}
                </p>
              </div>

              {/* Creator 360 Information Fields */}
              <div className="mt-5 space-y-3.5 pt-4 border-t border-white/[0.04]">
                
                <div>
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Email address
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.email}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Geography Base
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block leading-relaxed line-clamp-2" title={profile.address}>
                    {profile.address}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Primary Phone
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono">
                    {profile.phone}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Last active timestamp
                  </label>
                  <span className="text-xs text-app-accent-light font-bold mt-0.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{profile.lastActive}</span>
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Social Connectivity & Specialties */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center justify-between">
              <span>Primary Category Tags</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-[2px] border border-emerald-500/20">SPECIALTY</span>
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {profile.specialties.map((spec) => (
                <span key={spec} className="px-2 py-1 rounded-[2px] bg-white/[0.02] border border-white/[0.04] text-[10.5px] font-bold text-emerald-400">
                  ⚡ {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Activities Timeline card */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Recent Content Trail
            </h3>

            <div className="space-y-3 pt-1">
              {profile.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start p-1.5 hover:bg-white/[0.01] transition-all rounded-[3px]">
                  {getActivityIcon(act.iconType)}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <p className="text-[9.5px] text-app-text-secondary font-mono mt-0.5">{act.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Search controls, metric cards & Submissions list */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input box */}
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
              <input 
                type="text" 
                placeholder="Search submission titles or campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/[0.02] border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
              />
            </div>

            {/* Actions and Export options */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={() => showToast('Generated campaign audit report', 'success')}
                className="px-3.5 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary flex items-center gap-1.5 hover:border-app-accent hover:text-white shadow-sm transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-app-accent" />
                <span>Select Audit Range</span>
              </button>
              
              <button 
                onClick={() => showToast('Exported affiliate logs', 'success')}
                className="p-1.5 bg-app-card border border-app-border rounded-[4px] hover:border-app-accent hover:text-white text-app-text-secondary shadow-sm transition-all cursor-pointer"
                title="Action Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* METRIC CARDS ROW - EXACTLY ALIGNED */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Reach stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Total Reach & Views</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.totalViews}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  Followers: {profile.followers}
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 25 Q 25 10, 45 35 T 85 15 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Engagement Rate stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Engagement Rate</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.engagementRate}
                </span>
                <span className="text-[9px] text-app-text-secondary block font-medium">
                  Conversion: {profile.conversionRate} avg
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-indigo-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10 Q 30 35, 55 15 T 85 30 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Generated Revenue stats */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Brand LTV Generated</span>
                <span className="text-xl font-bold text-emerald-400 tracking-tight block font-mono">
                  {profile.revenueGenerated}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  Participation in {profile.campaignParticipationCount} Campaigns
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 30 Q 25 5, 45 25 T 85 10 T 95 5" />
                </svg>
              </div>
            </div>

          </div>

          {/* ALL SUBMISSIONS TABLE PANEL */}
          <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5">
            
            {/* Table Header and Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Expert Content Recommendations
              </span>

              {/* Underlying Tab Switchers */}
              <div className="flex flex-wrap items-center gap-1">
                {(['All', 'Live', 'Reviewing', 'Draft'] as const).map((tab) => {
                  let count = 0;
                  if (tab === 'All') {
                    count = profile.contentGroups.reduce((sum, g) => sum + g.items.length, 0);
                  } else {
                    count = profile.contentGroups.reduce((sum, g) => sum + g.items.filter(i => i.status === tab).length, 0);
                  }

                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                          : 'text-app-text-secondary hover:text-white'
                      }`}
                    >
                      <span className="mr-1">
                        {tab === 'All' ? 'All Content' : tab}
                      </span>
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Table layout matching Choosify look */}
            {filteredGroups.length > 0 ? (
              <div className="space-y-4">
                
                {/* Headers */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/[0.04]">
                  <div className="col-span-6">Content Detail</div>
                  <div className="col-span-2 text-right">Category</div>
                  <div className="col-span-2 pl-4">Engagement Views</div>
                  <div className="col-span-2 text-right">Verification Status</div>
                </div>

                {/* Date groups */}
                <div className="space-y-6">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-3">
                      
                      {/* Date Indicator Line */}
                      <div className="flex items-center justify-between border-b border-dashed border-white/[0.04] pb-1.5 font-mono text-[10px]">
                        <span className="text-app-text-secondary font-bold uppercase">
                          {group.date}
                        </span>
                        <span className="text-white font-semibold">
                          {group.campaignId}
                        </span>
                      </div>

                      {/* Items loop */}
                      <div className="space-y-2.5">
                        {group.items.map((item) => (
                          <div 
                            key={item.id}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-white/[0.02]"
                          >
                            {/* Content Details */}
                            <div className="col-span-1 md:col-span-6 flex items-center gap-3">
                              <img 
                                src={item.thumbnail} 
                                alt={item.title}
                                className="w-12 h-12 rounded-[4px] object-cover bg-white/5 border border-white/10 shrink-0 shadow-sm" 
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                                <p className="text-[10px] text-app-text-secondary font-medium truncate">
                                  Published / Submitted Ref {item.id}
                                </p>
                              </div>
                            </div>

                            {/* Category Column */}
                            <div className="col-span-1 md:col-span-2 md:text-right">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Category</span>
                              <span className="text-xs font-bold text-white">
                                {item.category}
                              </span>
                            </div>

                            {/* Engagement views Column */}
                            <div className="col-span-1 md:col-span-2 md:pl-4">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Reach</span>
                              <span className="text-xs font-medium text-emerald-400 font-mono">
                                {item.clicks}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="col-span-1 md:col-span-2 md:text-right flex md:justify-end">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mr-2 mb-0.5">Status</span>
                              {item.status === 'Reviewing' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-app-accent/20 text-app-accent border border-app-accent/30 shrink-0 w-24 text-center">
                                  Reviewing
                                </span>
                              )}
                              {item.status === 'Live' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border-green-500/20 shrink-0 w-24 text-center">
                                  Live
                                </span>
                              )}
                              {item.status === 'Draft' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20 shrink-0 w-24 text-center">
                                  Draft
                                </span>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center space-y-2 bg-white/[0.01] rounded-[4px] border border-dashed border-white/[0.04]">
                <ShoppingBag className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
                <h4 className="text-xs font-bold text-white">No content submissions match filter</h4>
                <p className="text-[11px] text-app-text-secondary opacity-60">Try selecting another filter status or refining query keywords</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
