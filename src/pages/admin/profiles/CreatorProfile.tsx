import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useContact } from '../../../contexts/ContactInteractionContext';
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
  ThumbsUp,
  FileText
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
  const { triggerPhone, triggerMessage } = useContact();
  const [activeTab, setActiveTab] = useState<'All' | 'Live' | 'Reviewing' | 'Draft'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  
  // Unified Role-Based Access controls
  const [primaryTab, setPrimaryTab] = useState<'Submissions' | 'Guides'>('Submissions');
  const [guides, setGuides] = useState<any[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<any | null>(null);
  const [guideStatusFilter, setGuideStatusFilter] = useState<'All' | 'Live' | 'Draft' | 'Archived'>('All');

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const cached = localStorage.getItem("choosify_guides_studio_list");
    if (cached) {
      try {
        setGuides(JSON.parse(cached));
      } catch (_) {
        setGuides([]);
      }
    } else {
      const defaults = [
        {
          id: "g1",
          guideTitle: "ULTIMATE FLAGSHIP SMARTPHONE ROUNDUP 2026",
          slug: "ultimate-flagship-smartphone-2026",
          category: "Mobile Phones",
          status: "Live",
          publishDate: "June 12, 2026",
          readTime: "8 min read",
          audienceType: "Power Users & Tech Enthusiasts",
          authorName: "Rifat Hasan",
          authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
          verifiedContributor: true,
          contributorBadgeLevel: "VERIFIED EXPERT",
          winnerProduct: "Samsung Galaxy S24 Ultra",
          bestBudgetPick: "Xiaomi Redmi Note 13 Pro+",
          productsReviewed: 8,
          lastUpdated: "June 12, 2026"
        },
        {
          id: "g2",
          guideTitle: "BEST NOISE CANCELLING HEADPHONES CHAMPIONSHIP",
          slug: "noise-cancelling-headphones-championship",
          category: "Audio Equipment",
          status: "Draft",
          publishDate: "June 15, 2026",
          readTime: "6 min read",
          audienceType: "Commuters & Audiophiles",
          authorName: "Sumaiya Rahman",
          authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
          verifiedContributor: true,
          contributorBadgeLevel: "TOP CONTRIBUTOR",
          winnerProduct: "Sony WH-1000XM5",
          bestBudgetPick: "Anker Soundcore Space Q45",
          productsReviewed: 6,
          lastUpdated: "June 10, 2026"
        },
        {
          id: "g3",
          guideTitle: "BEST VALUE LAPTOPS FOR BANGLADESHI CODERS",
          slug: "valuble-developer-laptops-bd",
          category: "Laptops & Computing",
          status: "Live",
          publishDate: "June 08, 2026",
          readTime: "11 min read",
          audienceType: "CS Students & Freelance Developers",
          authorName: "Tahmid Alvi",
          authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
          verifiedContributor: true,
          contributorBadgeLevel: "SENIOR EDITOR",
          winnerProduct: "ASUS Zenbook 14 OLED",
          bestBudgetPick: "Lenovo IdeaPad Slim 3 Gen 8",
          productsReviewed: 10,
          lastUpdated: "June 08, 2026"
        }
      ];
      setGuides(defaults);
      localStorage.setItem("choosify_guides_studio_list", JSON.stringify(defaults));
    }
  }, []);

  const handleSaveModeration = (guideId: string, updatedProps: any) => {
    const updatedGuides = guides.map(g => {
      if (g.id === guideId) {
        return {
          ...g,
          ...updatedProps
        };
      }
      return g;
    });
    setGuides(updatedGuides);
    localStorage.setItem("choosify_guides_studio_list", JSON.stringify(updatedGuides));
    setSelectedGuide(null);
    showToast("Moderation overrides synced successfully with CMS core registry!", "success");
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

  const getCreatorGuidesFiltered = () => {
    const list = guides.filter(g => g.authorName.toLowerCase() === profile.name.toLowerCase());
    if (list.length > 0) return list;
    // Fallback: assign this profile as author of g1 for demo/inspect context if none exists for this name
    return guides.map((g, idx) => {
      if (idx === 0) {
        return {
          ...g,
          authorName: profile.name,
          authorAvatar: profile.avatarUrl,
        };
      }
      return null;
    }).filter(Boolean);
  };
  
  const creatorGuides = getCreatorGuidesFiltered();
  
  const filteredCreatorGuides = creatorGuides.filter(g => {
    if (!g) return false;
    let statusMatch = true;
    if (guideStatusFilter !== 'All') statusMatch = g.status === guideStatusFilter;
    
    const s = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      g.guideTitle.toLowerCase().includes(s) || 
      g.category.toLowerCase().includes(s) ||
      g.winnerProduct.toLowerCase().includes(s);
      
    return statusMatch && searchMatch;
  });

  const renderSubmissions = () => {
    return (
      <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5">
        
        {/* Table Header and Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Expert Content Recommendations
          </span>

          {/* Underlying Tab Switchers */}
          <div className="flex flex-wrap items-center gap-1 font-sans">
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
            <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/10">
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
                  <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-1.5 font-mono text-[10px]">
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
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/5 hover:bg-white/10 transition-all border border-white/10"
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
          <div className="py-12 text-center space-y-2 bg-white/5 rounded-[4px] border border-dashed border-white/10">
            <ShoppingBag className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
            <h4 className="text-xs font-bold text-white">No content submissions match filter</h4>
            <p className="text-[11px] text-app-text-secondary opacity-60">Try selecting another filter status or refining query keywords</p>
          </div>
        )}

      </div>
    );
  };

  const renderGuides = () => {
    return (
      <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5 animate-in fade-in duration-200">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <span className="text-sm font-bold text-white uppercase tracking-wider block">
              Guide Studio Portfolio
            </span>
            <span className="text-[10px] text-app-text-secondary opacity-60">Verified author portfolio matching unified CMS database</span>
          </div>

          {/* Guide Filter buttons */}
          <div className="flex flex-wrap items-center gap-1 font-sans">
            {(['All', 'Live', 'Draft', 'Archived'] as const).map((tab) => {
              const cnt = creatorGuides.filter(g => tab === 'All' ? true : g.status === tab).length;
              const isSel = guideStatusFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setGuideStatusFilter(tab)}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    isSel 
                      ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                      : 'text-app-text-secondary hover:text-white'
                  }`}
                >
                  {tab} <span className="opacity-50">({cnt})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guides list rendering */}
        {filteredCreatorGuides.length > 0 ? (
          <div className="space-y-4">
            <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/10">
              <div className="col-span-5">Guide Title & Meta</div>
              <div className="col-span-2 text-right">Category</div>
              <div className="col-span-3 text-right">Highlights (Winner/Budget)</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="space-y-3 font-sans">
              {filteredCreatorGuides.map((guide) => (
                <div key={guide.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/5 hover:bg-white/10 transition-all border border-white/10">
                  
                  {/* Title & info column */}
                  <div className="col-span-1 md:col-span-5 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white truncate max-w-[280px]">{guide.guideTitle}</h4>
                      {guide.status === 'Live' && (
                        <span className="px-1.5 py-0.5 rounded-[2px] text-[7.5px] font-extrabold uppercase bg-green-500/10 text-green-400 border border-green-500/20">LIVE</span>
                      )}
                      {guide.status === 'Draft' && (
                        <span className="px-1.5 py-0.5 rounded-[2px] text-[7.5px] font-extrabold uppercase bg-white/10 text-white border border-white/20">DRAFT</span>
                      )}
                      {guide.status === 'Archived' && (
                        <span className="px-1.5 py-0.5 rounded-[2px] text-[7.5px] font-extrabold uppercase bg-neutral-500/15 text-neutral-400 border border-neutral-500/10">ARCHIVED</span>
                      )}
                      {guide.flaggedByModerator && (
                        <span className="px-1.5 py-0.5 rounded-[2px] text-[7.5px] font-extrabold uppercase bg-red-400/20 text-red-400 border border-red-500/30">⚠️ FLAGGED</span>
                      )}
                    </div>
                    <p className="text-[10px] text-app-text-secondary font-mono leading-relaxed">
                      {guide.readTime} | Targeted: {guide.audienceType}
                    </p>
                  </div>

                  {/* Category Column */}
                  <div className="col-span-1 md:col-span-2 md:text-right">
                    <span className="text-xs font-bold text-white block">{guide.category}</span>
                    <span className="text-[10px] text-app-text-secondary font-mono block">Ref: {guide.id}</span>
                  </div>

                  {/* Winners / Budget highlights Column */}
                  <div className="col-span-1 md:col-span-3 md:text-right space-y-0.5">
                    <span className="text-[10px] text-emerald-400 font-bold block leading-none">🏆 Winner: {guide.winnerProduct || "N/A"}</span>
                    <span className="text-[10px] text-indigo-400 block font-semibold leading-none">Budget: {guide.bestBudgetPick || "N/A"}</span>
                  </div>

                  {/* Actions button */}
                  <div className="col-span-1 md:col-span-2 md:text-right">
                    <button
                      onClick={() => setSelectedGuide(guide)}
                      className="px-3 py-1.5 bg-app-card border border-app-border rounded-[4px] text-[10px] font-bold text-app-accent-light hover:border-app-accent hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer w-full"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Guide</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>

          </div>
        ) : (
          <div className="py-12 text-center space-y-2 bg-white/5 rounded-[4px] border border-dashed border-white/10">
            <FileText className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
            <h4 className="text-xs font-bold text-white">No Guides Found</h4>
            <p className="text-[11px] text-app-text-secondary opacity-60">This creator has no guides matching the criteria.</p>
          </div>
        )}

      </div>
    );
  };

  const renderInspectModal = () => {
    if (!selectedGuide) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-app-card border border-app-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-all font-sans">
          
          {/* Modal Header */}
          <div className="p-5 border-b border-app-border flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono text-app-accent px-2 py-0.5 bg-app-accent/5 border border-app-accent/20">
                  AUDIT PANEL
                </span>
                <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono text-white/50">
                  ID: {selectedGuide.id}
                </span>
                {selectedGuide.flaggedByModerator && (
                  <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5">
                    ⚠️ VIOLATION REPORTED
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white leading-tight">
                {selectedGuide.guideTitle}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedGuide(null)}
              className="p-1 px-2.5 rounded-[4px] hover:bg-white/5 border border-transparent hover:border-app-border text-app-text-secondary hover:text-white transition-all cursor-pointer font-bold text-sm"
            >
              ✕ Close
            </button>
          </div>

          {/* Modal Content Grid */}
          <div className="p-6 space-y-6 animate-in fade-in duration-200">
            
            {/* Content Performance Segment */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-1.5 font-sans">
                <Star className="w-4 h-4" />
                <span>Real-Time Performance Stats</span>
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950/30 border border-white/5 p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Audience CTR</span>
                  <span className="text-base font-bold text-white block mt-0.5">14.8%</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">1.2% vs last mo</span>
                </div>
                <div className="bg-slate-950/30 border border-white/5 p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Avg Reading Time</span>
                  <span className="text-base font-bold text-white block mt-0.5">3m 48s</span>
                  <span className="text-[8.5px] text-app-text-secondary/50 block font-mono">Target: 4m max</span>
                </div>
                <div className="bg-slate-950/30 border border-white/5 p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Total Clickouts</span>
                  <span className="text-base font-bold text-white block mt-0.5">1,245 clicks</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">92% Completion</span>
                </div>
                <div className="bg-slate-950/30 border border-white/5 p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Earnings Influenced</span>
                  <span className="text-base font-bold text-emerald-400 block mt-0.5">৳38,200</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">8.4% Comm. split</span>
                </div>
              </div>
            </div>

            {/* Grid section for meta details and core values */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Information Checklist */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-white/10 pb-2">
                  CMS Registry Properties
                </h4>
                <div className="space-y-3 font-medium">
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Category Segment:</span>
                    <span className="text-white font-bold">{selectedGuide.category}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Target Audience:</span>
                    <span className="text-white">{selectedGuide.audienceType}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Read Time Estimate:</span>
                    <span className="text-white font-mono">{selectedGuide.readTime}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Winner Champion:</span>
                    <span className="text-emerald-400 font-bold">{selectedGuide.winnerProduct || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Best budget alternate:</span>
                    <span className="text-indigo-400 font-bold">{selectedGuide.bestBudgetPick || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Contributor Badge Level:</span>
                    <span className="text-app-accent-light font-bold font-mono text-[10px]">{selectedGuide.contributorBadgeLevel || "VERIFIED EXPERT"}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Publisher:</span>
                    <span className="text-white font-semibold">{selectedGuide.authorName}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Last synchronized:</span>
                    <span className="text-white font-mono">{selectedGuide.lastUpdated || "June 12, 2026"}</span>
                  </div>
                </div>
              </div>

              {/* Edit History & Audit trail */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-white/10 pb-2">
                  Audit Verification Trail
                </h4>
                <div className="space-y-3.5">
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5" />
                    <div>
                      <span className="text-xs font-bold text-white block">Published Live State Verified</span>
                      <span className="text-[10px] text-app-text-secondary font-mono block mt-0.5">14 June, 2026 | 02:44 pm by automated sync agent</span>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                    <div>
                      <span className="text-xs font-bold text-white block">Winner Product Modified</span>
                      <span className="text-[10px] text-app-text-secondary font-mono block mt-0.5 font-sans">12 June, 2026 | 10:15 am by {selectedGuide.authorName} (Author)</span>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5" />
                    <div>
                      <span className="text-xs font-bold text-white block">Draft Created & Outline Saved</span>
                      <span className="text-[10px] text-app-text-secondary font-mono block mt-0.5 font-sans">10 June, 2026 | 09:12 am by {selectedGuide.authorName} (Author)</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* OVERRIDE MODERATION CONTROLS (Step 3/4 mandates) */}
            <div className="border-t border-app-border pt-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-app-accent-light block font-mono">
                  MODERATOR CONTROL OVERRIDES
                </h4>
                <p className="text-[11px] text-app-text-secondary mb-4 opacity-75">
                  Manage publication standing, set flags on content terms violations, or toggle creator expert credentials. Altered parameters sync back to main catalog immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                
                {/* Status Toggle Override */}
                <div className="bg-slate-950/40 p-4 rounded-lg border border-app-border space-y-2">
                  <label className="text-[10px] font-bold text-white uppercase tracking-wider block">Publications Standing</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Live', 'Draft', 'Archived'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => {
                          const updated = { ...selectedGuide, status: st };
                          setSelectedGuide(updated);
                        }}
                        className={`px-1 py-1 rounded-[3px] text-[10px] font-bold cursor-pointer transition-colors border leading-[14px] ${
                          selectedGuide.status === st 
                            ? "bg-app-accent border-app-accent text-white" 
                            : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flag Content Toggle */}
                <div className="bg-slate-950/40 p-4 rounded-lg border border-app-border flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider block">Content Flag & Quarantine</span>
                    <span className="text-[9px] text-app-text-secondary block mt-1 leading-snug">Reported for inappropriate suggestions or terms violation</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...selectedGuide, flaggedByModerator: !selectedGuide.flaggedByModerator };
                      setSelectedGuide(updated);
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-[10px] font-bold border transition-colors mt-2 cursor-pointer ${
                      selectedGuide.flaggedByModerator
                        ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                        : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {selectedGuide.flaggedByModerator ? '⚠️ Remove Flag' : '☠️ Flag for Moderation Review'}
                  </button>
                </div>

                {/* Verified Contributor override */}
                <div className="bg-slate-950/40 p-4 rounded-lg border border-app-border flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider block">Expert Badge Verification</span>
                    <span className="text-[9px] text-app-text-secondary block mt-1 leading-snug">Confirm reviewer authenticity for public display</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...selectedGuide, verifiedContributor: !selectedGuide.verifiedContributor };
                      setSelectedGuide(updated);
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-[10px] font-bold border transition-colors mt-2 cursor-pointer ${
                      selectedGuide.verifiedContributor
                        ? "bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-400/30"
                        : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {selectedGuide.verifiedContributor ? '✓ Revoke Verification Badge' : '★ Approve Contributor Badge'}
                  </button>
                </div>

              </div>

            </div>

          </div>

          {/* Modal Actions Footer */}
          <div className="p-5 border-t border-app-border bg-slate-950/20 flex items-center justify-between font-mono">
            <span className="text-[10px] text-app-text-secondary opacity-60">
              Double-check rules before committing alterations.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-4 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-secondary hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Cancel Override
              </button>
              <button
                onClick={() => handleSaveModeration(selectedGuide.id, {
                  status: selectedGuide.status,
                  flaggedByModerator: selectedGuide.flaggedByModerator,
                  verifiedContributor: selectedGuide.verifiedContributor
                })}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-light rounded-[4px] text-xs font-bold text-white cursor-pointer shadow-md"
              >
                Save Sync Overrides
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

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
            <Link to="/admin/consumers?tab=creators" className="hover:text-app-accent transition-colors">Consumers</Link>
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
            <div className="h-24 bg-gradient-to-r from-emerald-600/30 via-app-card to-app-gradient-end opacity-90 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-xl sm:text-2xl md:text-xl lg:text-xl xl:text-2xl font-black text-white uppercase tracking-[0.22em] select-none text-center max-w-full truncate">CREATOR</span>
              </div>
            </div>

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
                    onClick={() => triggerPhone({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Creator' })}
                    className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                    title="Call Creator"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => triggerMessage({ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, phone: profile.phone, status: profile.status, role: 'Creator' })}
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
              <div className="mt-5 space-y-3.5 pt-4 border-t border-white/5">
                
                <div>
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Email address
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.email}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Geography Base
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block leading-relaxed line-clamp-2" title={profile.address}>
                    {profile.address}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Primary Phone
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono">
                    {profile.phone}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5">
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
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center justify-between">
              <span>Primary Category Tags</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-[2px] border border-emerald-500/20">SPECIALTY</span>
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {profile.specialties.map((spec) => (
                <span key={spec} className="px-2 py-1 rounded-[2px] bg-white/5 border border-white/5 text-[10.5px] font-bold text-emerald-400">
                  ⚡ {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Activities Timeline card */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              Recent Content Trail
            </h3>

            <div className="space-y-3 pt-1">
              {profile.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start p-1.5 hover:bg-white/5 transition-all rounded-[3px]">
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
                className="pl-9 pr-4 py-1.5 bg-white/5 border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
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

          {/* Primary View Segmenter Tabs */}
          <div className="flex border-b border-white/5 gap-4 mb-3">
            <button
              onClick={() => setPrimaryTab('Submissions')}
              className={`pb-3 text-[11.5px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                primaryTab === 'Submissions'
                  ? 'border-app-accent text-white font-black'
                  : 'border-transparent text-app-text-secondary hover:text-white'
              }`}
            >
              Recommendations Feed ({profile.contentGroups.reduce((sum, g) => sum + g.items.length, 0)})
            </button>
            <button
              onClick={() => setPrimaryTab('Guides')}
              className={`pb-3 text-[11.5px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                primaryTab === 'Guides'
                  ? 'border-app-accent text-white font-black'
                  : 'border-transparent text-app-text-secondary hover:text-white'
              }`}
            >
              Guide Studio (Creator Content) ({creatorGuides.length})
            </button>
          </div>

          {primaryTab === 'Submissions' ? renderSubmissions() : renderGuides()}

        </div>

      </div>

      {renderInspectModal()}

    </div>
  );
}
