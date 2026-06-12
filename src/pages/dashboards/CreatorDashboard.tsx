import React, { useState } from 'react';
import { 
  FileText, 
  Users, 
  Zap, 
  TrendingUp, 
  MoreHorizontal,
  Plus,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Megaphone,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useAds } from '../../contexts/AdsContext';
import { useAuth } from '../../contexts/AuthContext';

const engagementData = [
  { name: 'Views', value: 45000, color: '#EB4501' },
  { name: 'Likes', value: 12400, color: '#ff5d1a' },
  { name: 'Shares', value: 3200, color: '#ff8c42' },
  { name: 'Earnings', value: 28000, color: '#000435' },
];

export default function CreatorDashboard() {
  const { profile } = useAuth();
  const { addPromotionRequest, promotionRequests } = useAds();

  // Creator's published posts / recommendations
  const [recommendations] = useState([
    { id: 'r1', title: 'Top 5 Gadgets for University Students', views: '12k', date: '2 days ago', thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', status: 'published' },
    { id: 'r2', title: 'Aarong Summer Collection Review', views: '8.4k', date: '5 days ago', thumbnail: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=400&q=80', status: 'published' },
  ]);

  // Modal / Request form state
  const [promotingItem, setPromotingItem] = useState<{ id: string; name: string; type: 'RECOMMENDATION' | 'POST' } | null>(null);
  const [requestedPromoType, setRequestedPromoType] = useState<'Featured' | 'Sponsored' | 'Hot' | 'Verified' | 'Trending' | 'Editor Pick'>('Featured');
  const [requestedTier, setRequestedTier] = useState<'Standard Featured' | 'Premium Featured' | 'Homepage Featured' | 'Trending Boost' | 'Editor Pick'>('Standard Featured');
  const [duration, setDuration] = useState<number>(7);
  const [placementRequest, setPlacementRequest] = useState<string>('trending_section');
  const [toast, setToast] = useState<string | null>(null);

  const myRequests = promotionRequests.filter(r => r.requesterId === (profile?.id || 'creator_001'));

  const handleOpenPromote = (id: string, name: string, type: 'RECOMMENDATION' | 'POST') => {
    setPromotingItem({ id, name, type });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingItem) return;

    await addPromotionRequest({
      requesterId: profile?.id || 'creator_001',
      requesterRole: 'creator',
      requesterName: profile?.displayName || 'Sumaiya Akter',
      contentType: promotingItem.type,
      contentId: promotingItem.id,
      contentName: promotingItem.name,
      requestedPromotionType: requestedPromoType,
      featurePriority: requestedTier,
      duration: duration,
      placementRequest: placementRequest
    });

    setPromotingItem(null);
    showToast('Guide boost request successfully submitted! Pending editor validation.');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-8 text-white pb-16">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-app-sidebar to-app-accent rounded-[2rem] p-10 overflow-hidden relative group border border-app-accent/20 shadow-2xl">
         <div className="relative z-10 max-w-2xl">
            <span className="inline-block px-3 py-1 bg-app-accent/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest mb-4 border border-app-accent/30">Creator Program Active</span>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-4 leading-tight">
               Your creativity, <br/> Bangladesh's discovery.
            </h1>
            <p className="text-white/80 text-sm leading-relaxed mb-8 font-medium">
               Connect with 12+ premium brands this week. New campaigns are waiting for your unique perspective.
            </p>
         </div>
         <div className="absolute right-[-5%] top-[-10%] w-[400px] h-[400px] bg-app-accent/10 rounded-full blur-3xl group-hover:bg-app-accent/20 transition-all duration-1000" />
      </div>

      {/* Analytics Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         <div className="xl:col-span-2 space-y-8">
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-app-text-primary tracking-tight">Engagement Hub</h3>
                    <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">Content performance last 30 days</p>
                  </div>
                  <div className="flex gap-2">
                     <div className="flex flex-col items-end">
                        <span className="text-green-500 text-xs font-bold font-mono">+24%</span>
                        <span className="text-[9px] text-app-text-secondary font-bold uppercase">vs last month</span>
                     </div>
                  </div>
               </div>

               <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={engagementData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#888888" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                           cursor={{fill: 'transparent'}}
                           contentStyle={{ 
                               backgroundColor: '#0F172A', 
                               border: '1px solid #1E293B', 
                               borderRadius: '12px',
                               color: '#fff'
                           }} 
                        />
                        <Bar 
                           dataKey="value" 
                           radius={[8, 8, 0, 0]}
                           barSize={60}
                        >
                           {engagementData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Core Recommendation Posts (with Sponsor Boosting Actions built in) */}
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-app-border">
                  <div>
                     <h3 className="text-lg font-bold">📢 Boost Recommendation Guides</h3>
                     <p className="text-xs text-app-text-secondary">Request featured placement, visibility boosts or sponsored guide ranks across Bangladesh.</p>
                  </div>
                  <span className="px-3 py-1 bg-app-accent/15 border border-app-accent/20 rounded-full text-[9px] font-black uppercase text-app-accent-light self-start">Organic & Sponsored Mix</span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendations.map((item) => (
                    <div key={item.id} className="group cursor-pointer bg-app-bg border border-app-border rounded-[1.5rem] overflow-hidden shadow-xl hover:border-app-accent/30 transition-all flex flex-col justify-between">
                       <div>
                          <div className="h-40 relative overflow-hidden">
                             <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                          </div>
                          <div className="p-6 pb-2">
                             <h4 className="text-sm font-bold text-white mb-2 line-clamp-1">{item.title}</h4>
                             <div className="flex items-center justify-between text-[10px] text-app-text-secondary font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1.5"><Play className="w-3 h-3" /> {item.views} views</span>
                                <span>{item.date}</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-6 pt-2">
                          <button 
                            onClick={() => handleOpenPromote(item.id, item.title, 'RECOMMENDATION')}
                            className="w-full py-2.5 bg-app-accent hover:bg-app-accent-light text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow shadow-app-accent/20 active:scale-95 flex items-center justify-center gap-2"
                          >
                             <Zap className="w-3.5 h-3.5" /> Boost Guide Visibility
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Sidebar Stats & Tracking */}
         <div className="space-y-8">
            {/* Active creator sponsorships */}
            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                 <Megaphone className="text-app-accent w-4 h-4" /> Active Guide Boosts
               </h3>
               {myRequests.length === 0 ? (
                 <div className="text-center py-8 text-app-text-secondary italic border border-dashed border-app-border/40 rounded-2xl">
                   No ongoing booster campaigns.
                 </div>
               ) : (
                 <div className="space-y-4">
                    {myRequests.map((req) => (
                      <div key={req.id} className="p-4 bg-app-bg border border-app-border rounded-xl">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-extrabold text-app-accent-light truncate max-w-[150px]">{req.contentName}</span>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                              req.approvalStatus === 'APPROVED' ? 'bg-green-500/10 text-green-500' :
                              req.approvalStatus === 'PENDING' ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                              {req.approvalStatus}
                            </span>
                         </div>
                         <div className="text-[9px] text-app-text-secondary uppercase">{req.requestedPromotionType} • {req.duration} Days</div>
                         <div className="text-[8px] font-mono mt-1 text-app-text-secondary">Target: {req.placementRequest}</div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <h3 className="text-sm font-bold text-app-text-primary mb-6">Collaboration Invites</h3>
               <div className="space-y-4">
                  {[
                    { brand: 'Aarong Digital', type: 'Product Review', reward: '৳ 5k + Keepable' },
                    { brand: 'Yellow', type: 'Lookbook Shoot', reward: '৳ 12k' },
                    { brand: 'Apex', type: 'Unboxing Video', reward: '৳ 3.5k' },
                  ].map((invite, i) => (
                    <div key={i} className="p-4 bg-app-bg border border-app-border rounded-xl group hover:bg-app-accent/5 transition-all">
                       <div className="text-[11px] font-bold text-app-text-primary mb-1">{invite.brand}</div>
                       <div className="text-[10px] text-app-text-secondary mb-3">{invite.type}</div>
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-app-accent-light">{invite.reward}</span>
                          <button className="text-[9px] font-extrabold uppercase text-app-accent hover:text-app-text-primary transition-colors">Apply Now</button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[2rem] p-8 shadow-2xl">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Affiliate Tracking</h3>
                  <TrendingUp className="w-4 h-4 text-app-accent" />
               </div>
               <div className="space-y-4">
                  {[
                    { product: 'iPhone 15 Case', clicks: 420, sales: 12, earned: '৳ 2,400' },
                    { product: 'Leather Wallet', clicks: 180, sales: 5, earned: '৳ 850' },
                    { product: 'Organic Honey', clicks: 95, sales: 3, earned: '৳ 450' },
                  ].map((link, i) => (
                    <div key={i} className="p-3 bg-app-bg border border-app-border rounded-xl flex items-center justify-between">
                       <div className="min-w-0">
                          <div className="text-[11px] font-bold text-app-text-primary mb-0.5 truncate">{link.product}</div>
                          <div className="text-[9px] text-app-text-secondary uppercase font-bold tracking-widest">{link.clicks} clicks • {link.sales} sales</div>
                       </div>
                       <div className="text-right text-app-accent-light font-bold text-[11px]">{link.earned}</div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* Boost Guide Form Modal */}
      {promotingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-app-card border border-app-border w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setPromotingItem(null)} 
              className="absolute top-6 right-6 p-2 text-app-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-app-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white leading-tight">Boost Recommendation visibility</h4>
                <p className="text-[11px] text-app-text-secondary uppercase mt-0.5">Submit to editor panel for sponsorship validation</p>
              </div>
            </div>

            <div className="p-4 bg-app-bg border border-app-border rounded-xl mb-6">
              <span className="text-[8px] uppercase tracking-widest font-black text-app-text-secondary">Guide selected</span>
              <div className="text-[13px] font-extrabold text-app-accent-light mt-1">{promotingItem.name}</div>
              <div className="text-[10px] text-app-text-secondary font-mono mt-0.5">ID: {promotingItem.id}</div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Promotion Type</label>
                  <select 
                    value={requestedPromoType}
                    onChange={(e: any) => setRequestedPromoType(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="Featured">Featured Guides Slot</option>
                    <option value="Sponsored">Sponsored Tag</option>
                    <option value="Trending">Trending Boost</option>
                    <option value="Editor Pick">Editor's Choice Highlight</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Target Placement</label>
                  <select 
                    value={placementRequest}
                    onChange={(e) => setPlacementRequest(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="trending_section">Homepage Trending Guides</option>
                    <option value="homepage_banner">Homepage Top Banner Carousel</option>
                    <option value="category_top">Category Top Highlights Panel</option>
                    <option value="recommendations_boost">Creator Guides Spotlights</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Duration</label>
                  <select 
                    value={duration} 
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value={3}>3 Days Visibility Boost</option>
                    <option value={7}>7 Days Visibility Boost</option>
                    <option value={30}>30 Days Visibility Boost</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block mb-1.5">Priority Tier</label>
                  <select 
                    value={requestedTier}
                    onChange={(e: any) => setRequestedTier(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-app-accent"
                  >
                    <option value="Standard Featured">Standard Featured (+30 score)</option>
                    <option value="Trending Boost">Trending Boost (+45 score)</option>
                    <option value="Premium Featured">Premium Featured (+60 score)</option>
                    <option value="Editor Pick">Editor Pick (+80 score)</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-app-text-secondary border border-app-border/40 p-3.5 rounded-xl bg-app-bg/50 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-app-accent shrink-0 mt-0.5" />
                <p className="leading-normal">
                  Creator promotion requests are reviewed strictly. Spoofed metrics will result in permanent ban and request rejection. Keep guides high-quality to gain score weight.
                </p>
              </div>

              <button 
                type="submit"
                className="w-full bg-app-accent text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-app-accent/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 uppercase tracking-wider"
              >
                Request visibility boost
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 bg-app-accent text-white rounded-2xl shadow-2xl shadow-app-accent/30 font-bold text-sm flex items-center gap-3 z-[100] animate-bounce">
          <CheckCircle className="w-5 h-5 text-white" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
