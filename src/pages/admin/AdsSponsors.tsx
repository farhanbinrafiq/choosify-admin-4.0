import React, { useState } from 'react';
import { 
  Megaphone, 
  Star, 
  ShoppingBag, 
  Building2, 
  Tag as TagIcon, 
  Lightbulb, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  Eye, 
  MousePointer2, 
  BarChart2,
  Clock,
  Target,
  Image as ImageIcon,
  Check,
  CheckCircle,
  X,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sparkles,
  Award,
  ChevronRight,
  Filter,
  Activity,
  History,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAds, Promotion, PromotionType, PromotionStatus, PromotionRequest } from '../../contexts/AdsContext';

const typeIcons: Record<PromotionType, any> = {
  AD: Megaphone,
  POST: Star,
  PRODUCT: ShoppingBag,
  BRAND: Building2,
  DEAL: TagIcon,
  RECOMMENDATION: Lightbulb
};

const typeColors: Record<PromotionType, string> = {
  AD: 'bg-orange-500',
  POST: 'bg-purple-500',
  PRODUCT: 'bg-blue-500',
  BRAND: 'bg-indigo-500',
  DEAL: 'bg-emerald-500',
  RECOMMENDATION: 'bg-rose-500'
};

export default function AdsSponsorsPage() {
  const { 
    promotions, 
    promotionRequests, 
    loading, 
    addPromotion, 
    updatePromotion, 
    deletePromotion,
    approvePromotionRequest,
    rejectPromotionRequest,
    deletePromotionRequest,
    trackImpression,
    trackClick
  } = useAds();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'requests' | 'analytics' | 'archived'>('campaigns');
  const [activeType, setActiveType] = useState<PromotionType | 'ALL'>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Approve dialog builder state
  const [reviewingRequest, setReviewingRequest] = useState<PromotionRequest | null>(null);

  // Forms state
  const [formData, setFormData] = useState<Omit<Promotion, 'id' | 'analytics'>>({
    type: 'AD',
    title: '',
    subtitle: '',
    imageUrl: '',
    linkUrl: '',
    status: 'ACTIVE',
    placement: 'homepage_banner',
    targeting: ['General'],
    priority: 50,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const [reviewForm, setReviewForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    placement: 'homepage_banner',
    priority: 50,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    targeting: 'General, Fashion'
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updatePromotion(editingId, formData);
      setEditingId(null);
      showToast('Campaign successfully updated!');
    } else {
      await addPromotion(formData);
      setIsAdding(false);
      showToast('Campaign launched successfully!');
    }
    resetForm();
  };

  const handleReviewApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;

    const targetingList = reviewForm.targeting.split(',').map(s => s.trim()).filter(Boolean);

    await approvePromotionRequest(reviewingRequest.id, {
      type: reviewingRequest.contentType as PromotionType,
      targetId: reviewingRequest.contentId,
      title: reviewForm.title,
      subtitle: reviewForm.subtitle,
      imageUrl: reviewForm.imageUrl,
      linkUrl: reviewingRequest.contentType === 'PRODUCT' ? `/products/${reviewingRequest.contentId}` : `/deals/${reviewingRequest.contentId}`,
      status: 'ACTIVE',
      placement: reviewForm.placement,
      targeting: targetingList,
      priority: reviewForm.priority,
      startDate: reviewForm.startDate,
      endDate: reviewForm.endDate
    });

    setReviewingRequest(null);
    showToast('Promotion request approved and campaign launched!');
  };

  const handleRejectRequest = async (requestId: string) => {
    if (window.confirm('Are you sure you want to reject this request?')) {
      await rejectPromotionRequest(requestId);
      showToast('Sponsorship request was rejected.');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'AD',
      title: '',
      subtitle: '',
      imageUrl: '',
      linkUrl: '',
      status: 'ACTIVE',
      placement: 'homepage_banner',
      targeting: ['General'],
      priority: 50,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  };

  const startEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    setFormData({
      type: promo.type,
      title: promo.title,
      subtitle: promo.subtitle || '',
      imageUrl: promo.imageUrl || '',
      linkUrl: promo.linkUrl || '',
      status: promo.status,
      placement: promo.placement,
      targeting: promo.targeting || ['General'],
      priority: promo.priority || 50,
      startDate: promo.startDate || new Date().toISOString(),
      endDate: promo.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  };

  const openReviewDialog = (req: PromotionRequest) => {
    setReviewingRequest(req);
    
    // Derive initial values from requested tier
    const basePriorities: Record<string, number> = {
      'Standard Featured': 30,
      'Trending Boost': 45,
      'Premium Featured': 60,
      'Editor Pick': 80,
      'Homepage Featured': 95
    };
    const calculatedPriority = basePriorities[req.featurePriority] || 50;

    setReviewForm({
      title: req.contentName,
      subtitle: `Sponsor recommendation for ${req.contentName} (${req.requestedPromotionType})`,
      imageUrl: req.contentType === 'PRODUCT' ? 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80' : 'https://images.unsplash.com/photo-1707201366969-952467d5813f?w=600&q=80',
      placement: req.placementRequest || 'trending_section',
      priority: calculatedPriority,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + (req.duration || 7) * 24 * 60 * 60 * 1000).toISOString(),
      targeting: 'General'
    });
  };

  const activePromosFiltered = promotions.filter(p => p.status === 'ACTIVE' || p.status === 'SCHEDULED' || p.status === 'INACTIVE');
  const archivedPromos = promotions.filter(p => p.status === 'EXPIRED');

  const filteredPromos = activeType === 'ALL' 
    ? activePromosFiltered 
    : activePromosFiltered.filter(p => p.type === activeType);

  const pendingRequests = promotionRequests.filter(r => r.approvalStatus === 'PENDING');

  // Perform quick metrics aggregates
  const totalImpressions = promotions.reduce((acc, p) => acc + (p.analytics?.impressions || 0), 0);
  const totalClicks = promotions.reduce((acc, p) => acc + (p.analytics?.clicks || 0), 0);
  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div className="space-y-6 text-white pb-16">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-app-border pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Megaphone className="text-app-accent" /> Ads & Sponsors Engine
          </h2>
          <p className="text-sm text-app-text-secondary mt-1">
            Unbiased internal promotion system matching vendor requests to organic trust metrics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setIsAdding(true); resetForm(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-app-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-app-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Launch Campaign
          </button>
        </div>
      </div>

      {/* Main Stats Hub */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Promotions', value: activePromosFiltered.length, icon: Activity, color: 'text-orange-500' },
          { label: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: Eye, color: 'text-blue-500' },
          { label: 'Total Clicks Recorded', value: totalClicks.toLocaleString(), icon: MousePointer2, color: 'text-purple-500' },
          { label: 'Platform CTR Avg', value: averageCtr.toFixed(2) + '%', icon: BarChart2, color: 'text-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-app-card border border-app-border rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="text-xl font-black text-app-text-primary">{stat.value}</div>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-app-bg border border-app-border flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Sub Navigation Tab Rails */}
      <div className="flex border-b border-app-border gap-6">
        {[
          { id: 'campaigns', label: 'Active Campaigns', badge: activePromosFiltered.length },
          { id: 'requests', label: 'Promotion Requests', badge: pendingRequests.length, highlight: pendingRequests.length > 0 },
          { id: 'analytics', label: 'Performance Analytics', icon: BarChart2 },
          { id: 'archived', label: 'Campaign Archive (Expired)', icon: Archive }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 px-1 text-sm font-bold tracking-tight relative transition-all ${
              activeTab === tab.id 
                ? 'text-app-accent font-black' 
                : 'text-app-text-secondary hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-extrabold ${
                  tab.highlight ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 text-app-text-secondary'
                }`}>
                  {tab.badge}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <motion.div layoutId="activeTabBorder" className="absolute bottom-0 left-0 right-0 h-0.5 bg-app-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Main interactive workflow column */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* TAB 1: ACTIVE CAMPAIGNS LIST */}
          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              {/* Type Category selection */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-app-card border border-app-border rounded-xl w-fit">
                {['ALL', 'AD', 'PRODUCT', 'DEAL', 'RECOMMENDATION', 'BRAND'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveType(type as any)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      activeType === type 
                        ? 'active-filter-item bg-app-accent text-white shadow-lg' 
                        : 'text-app-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {type}s
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {filteredPromos.map((promo) => {
                  const Icon = typeIcons[promo.type];
                  return (
                    <div 
                      key={promo.id}
                      className="bg-app-card border border-app-border rounded-2xl p-5 flex gap-6 hover:border-app-accent/30 transition-all group"
                    >
                      <div className="w-20 h-20 rounded-xl bg-app-bg border border-app-border shrink-0 overflow-hidden relative">
                        {promo.imageUrl ? (
                          <img src={promo.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-30">
                            <Icon className="w-6 h-6" />
                          </div>
                        )}
                        <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-white ${typeColors[promo.type]}`}>
                          {promo.type}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-extrabold truncate text-white">{promo.title}</h4>
                            <div className="flex items-center gap-2 ml-4">
                              <button 
                                onClick={() => startEdit(promo)}
                                className="p-1.5 text-app-text-secondary hover:text-white hover:bg-white/5 rounded-lg"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deletePromotion(promo.id)}
                                className="p-1.5 text-app-text-secondary hover:text-red-500 hover:bg-red-500/5 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-app-text-secondary truncate mt-0.5">{promo.subtitle}</p>

                          <div className="flex flex-wrap gap-4 text-[10px] mt-2 font-semibold">
                            <span className="text-app-accent-light flex items-center gap-1">
                              <Target className="w-3 h-3" /> {promo.placement}
                            </span>
                            <span className="text-app-text-secondary flex items-center gap-1">
                              <ArrowRightCircle className="w-3 h-3 text-white" /> Priority Priority: {promo.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                              promo.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'
                            }`}>
                              {promo.status}
                            </span>
                          </div>
                        </div>

                        {/* Impressions, clicks, ctr stats */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-app-border bg-app-bg/30 p-2 rounded-xl">
                          <div>
                            <span className="text-[8px] font-black uppercase text-app-text-secondary block">Impressions</span>
                            <span className="text-xs font-bold">{(promo.analytics?.impressions || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase text-app-text-secondary block">Clicks</span>
                            <span className="text-xs font-bold">{(promo.analytics?.clicks || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase text-app-text-secondary block">CTR Match</span>
                            <span className="text-xs font-bold text-app-accent">{(promo.analytics?.ctr || 0)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredPromos.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed border-app-border rounded-[2rem] text-app-text-secondary">
                    <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium italic">No active promotional campaigns found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PENDING SPONSOR REQUESTS FROM SELLER/CREATOR */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="p-4 bg-app-accent/15 border border-app-accent/20 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-app-accentshrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-extrabold block text-app-accent">Visions & Trust Guidelines</span>
                  <p className="text-[11px] text-app-text-secondary mt-1">
                    Sellers can boost store products and flash sales. Creators can boost recommendation guides. All approvals instantly spawn database documents pushing scores organically.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {pendingRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="p-5 bg-app-card border border-app-border rounded-2xl relative overflow-hidden flex flex-col justify-between hover:border-app-accent/20 transition-all"
                  >
                    <div className="absolute top-0 right-0 h-10 w-10 flex items-center justify-center">
                      <span className={`text-[8px] font-bold px-2.5 py-1 rounded bg-white/5 uppercase ${
                        req.requesterRole === 'seller' ? 'text-blue-400' : 'text-purple-400'
                      }`}>
                        {req.requesterRole}
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-app-bg border border-app-border flex items-center justify-center shrink-0">
                        {req.contentType === 'PRODUCT' ? <ShoppingBag className="w-5 h-5 text-blue-400" /> : <Lightbulb className="w-5 h-5 text-purple-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">
                          Request from {req.requesterName} ({req.requesterRole})
                        </div>
                        <h4 className="text-sm font-extrabold truncate mt-1">{req.contentName}</h4>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 bg-app-bg p-3 rounded-xl border border-app-border text-[10px]">
                          <div>
                            <span className="text-[8px] text-app-text-secondary uppercase block font-bold">Promo Type</span>
                            <span className="font-extrabold text-app-accent">{req.requestedPromotionType}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-app-text-secondary uppercase block font-bold">Target Placement</span>
                            <span className="font-bold">{req.placementRequest}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-app-text-secondary uppercase block font-bold">Duration</span>
                            <span className="font-bold">{req.duration} Days</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-app-text-secondary uppercase block font-bold">Visibility Tier</span>
                            <span className="font-bold text-emerald-400">{req.featurePriority}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-app-border">
                      <button 
                        onClick={() => handleRejectRequest(req.id)}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500/20 transition-all"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => openReviewDialog(req)}
                        className="px-4 py-2 bg-app-accent text-white text-[10px] font-black uppercase rounded-xl hover:scale-102 hover:shadow-lg hover:shadow-app-accent/20 transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Review & Approve
                      </button>
                    </div>
                  </div>
                ))}

                {pendingRequests.length === 0 && (
                  <div className="py-16 text-center border-2 border-dashed border-app-border rounded-[2rem] text-app-text-secondary">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-10 text-emerald-400" />
                    <p className="text-sm font-medium italic">All caught up! No pending promotion requests.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PROMOTION ANALYTICS PANEL */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="bg-app-card border border-app-border rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-app-accent" /> Click-Through Rate & Performance Ledger
                </h3>

                <div className="space-y-3">
                  {promotions.sort((a,b) => (b.analytics?.ctr || 0) - (a.analytics?.ctr || 0)).map((promo, index) => (
                    <div key={promo.id} className="p-4 bg-app-bg border border-app-border rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-app-text-secondary font-mono w-4">#{index + 1}</span>
                        <div>
                          <div className="text-[12px] font-extrabold text-white">{promo.title}</div>
                          <div className="text-[9px] text-app-text-secondary font-mono">ID: {promo.id} • Placement: {promo.placement}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <span className="text-[8px] uppercase font-black text-app-text-secondary">Views / Clicks</span>
                          <span className="text-xs font-bold block">{promo.analytics?.impressions || 0} / {promo.analytics?.clicks || 0}</span>
                        </div>
                        <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg">
                          <span className="text-[8px] uppercase font-black text-app-text-secondary block">CTR</span>
                          <span className="text-xs font-black text-app-accent">{promo.analytics?.ctr || 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CAMPAIGN ARCHIVE */}
          {activeTab === 'archived' && (
            <div className="space-y-4">
              {archivedPromos.map((promo) => (
                <div key={promo.id} className="p-4 bg-app-card/40 border border-app-border border-dashed rounded-xl flex justify-between items-center opacity-80">
                  <div>
                    <h5 className="text-[12px] font-bold text-white line-clamp-1">{promo.title}</h5>
                    <p className="text-[10px] text-app-text-secondary mt-1">Placement: {promo.placement} • Priority Score {promo.priority}</p>
                    <p className="text-[8px] text-red-400 font-mono mt-0.5">Expired on: {promo.endDate ? new Date(promo.endDate).toLocaleString() : 'Past'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-app-text-secondary px-2 py-0.5 rounded bg-white/5">{promo.status}</span>
                    <div className="text-[10px] mt-1 text-app-accent font-black">{promo.analytics?.clicks || 0} Clicks</div>
                  </div>
                </div>
              ))}

              {archivedPromos.length === 0 && (
                <div className="py-12 text-center border border-dashed border-app-border/40 rounded-xl text-app-text-secondary italic text-xs">
                  No expired campaigns inside database archive.
                </div>
              )}
            </div>
          )}

        </div>

        {/* SIDEBAR - Create Campaign / Edit Campaign Forms */}
        <div className="lg:col-span-4 h-fit sticky top-24">
          <AnimatePresence mode="wait">
            {(isAdding || editingId) ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-app-card border border-app-border rounded-[2rem] p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-white flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4 text-app-accent" />
                    {editingId ? 'Modify Campaign' : 'Launch Campaign'}
                  </h3>
                  <button 
                    onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}
                    className="p-1 px-2 hover:bg-white/5 rounded text-xs text-app-text-secondary hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Campaign Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as PromotionType})}
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                    >
                      <option value="AD">Sponsored Ad Banner</option>
                      <option value="POST">Featured Post</option>
                      <option value="PRODUCT">Featured Product</option>
                      <option value="BRAND">Featured Brand</option>
                      <option value="DEAL">Featured Deal</option>
                      <option value="RECOMMENDATION">Featured Guide / Recommendation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Promotion Title</label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g. Pohela Boishakh Exclusive"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Subtitle / Description</label>
                    <input 
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                      placeholder="e.g. 15% discount storewide this week"
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Creative Asset URL (Image/Video)</label>
                    <input 
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      placeholder="Image or video link content..."
                      className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Placement</label>
                      <select
                        value={formData.placement}
                        onChange={(e) => setFormData({...formData, placement: e.target.value})}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                      >
                        <option value="homepage_banner">Homepage Banner</option>
                        <option value="trending_section">Trending Now Grid</option>
                        <option value="category_top">Category Top Banner</option>
                        <option value="listing_boost">Listing Boost Spotlight</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Priority / Weight</label>
                      <input 
                        type="number"
                        min={1}
                        max={100}
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Start Date</label>
                      <input 
                        type="date"
                        value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-app-accent"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">End Date</label>
                      <input 
                        type="date"
                        value={formData.endDate ? formData.endDate.split('T')[0] : ''}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                        className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-app-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1.5">Status Check</label>
                    <div className="flex gap-2">
                      {['ACTIVE', 'INACTIVE', 'SCHEDULED'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, status: s as PromotionStatus})}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${
                            formData.status === s 
                              ? 'bg-app-accent text-white shadow shadow-app-accent/20' 
                              : 'bg-app-bg border border-app-border text-app-text-secondary hover:border-app-accent/20'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-app-accent text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-app-accent/20 hover:scale-[1.01] active:scale-95 transition-all mt-4"
                  >
                    {editingId ? 'Modify Campaign' : 'Confirm & Launch'}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-app-bg/30 border border-app-border border-dashed rounded-[2rem] p-8 text-center"
              >
                <div className="w-16 h-16 bg-app-card border border-app-border rounded-full flex items-center justify-center mx-auto mb-6">
                   <Target className="w-8 h-8 text-app-text-secondary opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-app-text-primary mb-2">Campaign Sandbox Panel</h4>
                <p className="text-[11px] text-app-text-secondary leading-relaxed mb-6">
                  Select a registered campaign card to make fast edits or click "Launch Campaign" to configure manual slots.
                </p>
                <div className="p-4 bg-app-card/60 rounded-2xl border border-app-border flex items-start gap-2 text-left">
                  <Star className="w-4 h-4 text-app-accent mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[9px] font-black tracking-wider uppercase text-app-text-secondary block">Trust Factor Guard</span>
                    <p className="text-[10px] leading-snug mt-0.5 text-app-text-secondary">
                      Our ranking engine prioritizes verified ratings! Items with below 3.5 reviews have active boost caps applied.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Modal dialog for review and approval workflow */}
      {reviewingRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-app-card border border-app-border w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setReviewingRequest(null)} 
              className="absolute top-6 right-6 p-2 text-app-text-secondary hover:text-white rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-app-accent flex items-center justify-center">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white leading-tight">Validate Authorization Request</h4>
                <p className="text-[10px] text-app-text-secondary uppercase mt-0.5">Approve and launch merchant/creator promotion</p>
              </div>
            </div>

            <form onSubmit={handleReviewApprove} className="space-y-4 text-white">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Approved Promo Title</label>
                <input 
                  type="text"
                  required
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:border-app-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Subtitle Banner Text</label>
                <input 
                  type="text"
                  required
                  value={reviewForm.subtitle}
                  onChange={(e) => setReviewForm({ ...reviewForm, subtitle: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:border-app-accent outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Campaign Resource Link (Creative URL)</label>
                <input 
                  type="text"
                  required
                  value={reviewForm.imageUrl}
                  onChange={(e) => setReviewForm({ ...reviewForm, imageUrl: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2.5 text-xs text-white focus:border-app-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Placement slot</label>
                  <select 
                    value={reviewForm.placement}
                    onChange={(e) => setReviewForm({ ...reviewForm, placement: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:border-app-accent outline-none"
                  >
                    <option value="homepage_banner">Homepage Banner</option>
                    <option value="trending_section">Trending Now</option>
                    <option value="category_top">Category Top Banner</option>
                    <option value="listing_boost">Listing Boost Spotlight</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Campaign priority weight</label>
                  <input 
                    type="number"
                    min={1}
                    max={100}
                    value={reviewForm.priority}
                    onChange={(e) => setReviewForm({ ...reviewForm, priority: parseInt(e.target.value) })}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:border-app-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Star Date</label>
                  <input 
                    type="date"
                    value={reviewForm.startDate.split('T')[0]}
                    onChange={(e) => setReviewForm({ ...reviewForm, startDate: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:border-app-accent outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Deactivation Date (expiry)</label>
                  <input 
                    type="date"
                    value={reviewForm.endDate.split('T')[0]}
                    onChange={(e) => setReviewForm({ ...reviewForm, endDate: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-white focus:border-app-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-1">Targeting Channels (comma separated)</label>
                <input 
                  type="text"
                  value={reviewForm.targeting}
                  onChange={(e) => setReviewForm({ ...reviewForm, targeting: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2 text-xs text-white focus:border-app-accent outline-none"
                />
              </div>

              <div className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Approving will move request Status to APPROVED and launch active campaign automatically.</span>
              </div>

              <button 
                type="submit"
                className="w-full bg-app-accent text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow shadow-app-accent/20 hover:scale-101 active:scale-95 transition-all mt-4"
              >
                Approve & Launch Promotion
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert Feedback */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-app-accent text-white rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2 z-[100] animate-bounce">
          <CheckCircle className="w-5 h-5 text-white" />
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
}

// Inline fallback since arrow-right isn't in original import
function ArrowRightCircle(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16l4-4-4-4"/><path d="M8 12h8"/></svg>
  );
}
