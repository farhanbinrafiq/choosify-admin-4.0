import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Award,
  PlayCircle,
  ThumbsUp,
  MessageSquare,
  Share2,
  ExternalLink,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';

export default function RecommendationPreview() {
  const { id } = useParams();

  const recommendation = {
    id: id,
    title: 'Top 5 Flagship Smartphones for Content Creators in 2025',
    creator: {
      name: 'Sifat Tanvir',
      handle: '@sifat_reviews',
      avatar: 'ST'
    },
    status: 'Pending Review',
    submittedAt: 'Today, 11:24 AM',
    category: 'Technology',
    subCategory: 'Mobile Portfolio',
    products: [
      { id: 'p1', name: 'Samsung Galaxy S24 Ultra', price: '৳ 145,000', brand: 'Samsung' },
      { id: 'p2', name: 'iPhone 15 Pro Max', price: '৳ 158,000', brand: 'Apple' },
      { id: 'p3', name: 'Google Pixel 9 Pro', price: '৳ 115,000', brand: 'Google' },
    ],
    content: `Choosing the right smartphone for content creation in Bangladesh can be challenging. You need a device that doesn't just have a great camera, but also has the processing power for quick mobile exports and a battery that lasts all day during outdoor shoots. 

In this list, I'm focusing on "Video Dynamic Range" and "Microphone Quality" which are often overlooked but crucial for 2025 content formats like high-fidelity Reels and long-form YouTube cinematic vlogs. I've personally tested these models across Dhaka's varying lighting conditions — from the bright daylight of Dhanmondi Lake to the tricky indoor neon of Banani's cafes.`,
    tags: ['TechReview', 'ContentCreator', 'BDTech', 'Flagship2025']
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Moderation Controls Sticky Top */}
      <div className="sticky top-0 z-20 bg-app-card/95 backdrop-blur border border-app-border rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Link to="/admin/recommendations" className="p-2 border border-app-border rounded-lg text-app-text-secondary hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
           </Link>
           <div>
              <h4 className="text-sm font-bold text-white">Content Moderation Terminal</h4>
              <p className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest text-orange-500">
                PENDING ACTION • {recommendation.submittedAt}
              </p>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <button className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Approve Recommendation
           </button>
           <button className="px-6 py-2.5 bg-white/5 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Reject & Feedback
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommendation Content Preview */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-app-card border border-app-border rounded-[2rem] overflow-hidden shadow-2xl relative">
              <div className="h-64 bg-gradient-to-br from-app-accent to-blue-700 opacity-30" />
              <div className="absolute top-48 left-0 w-full p-8 pt-0">
                 <div className="bg-app-card border border-app-border rounded-[1.5rem] p-8 shadow-2xl">
                    <div className="flex items-center gap-2 text-app-accent-light text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                       <Award className="w-4 h-4" /> Expert Recommendation
                    </div>
                    <h1 className="text-3xl font-extrabold text-white leading-tight mb-6">{recommendation.title}</h1>
                    
                    <div className="flex items-center justify-between border-t border-b border-app-border py-4 mb-8">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 font-bold border border-green-500/20">
                             {recommendation.creator.avatar}
                          </div>
                          <div>
                             <h5 className="text-sm font-bold text-white">{recommendation.creator.name}</h5>
                             <p className="text-[11px] text-app-text-secondary">{recommendation.creator.handle}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 text-app-text-secondary">
                          <div className="flex items-center gap-1.5 text-xs"><ThumbsUp className="w-4 h-4" /> 0</div>
                          <div className="flex items-center gap-1.5 text-xs"><MessageSquare className="w-4 h-4" /> 0</div>
                          <div className="flex items-center gap-1.5 text-xs"><Share2 className="w-4 h-4" /></div>
                       </div>
                    </div>

                    <div className="prose prose-invert max-w-none">
                       <p className="text-[15px] leading-8 text-app-text-primary mb-8 whitespace-pre-wrap">
                          {recommendation.content}
                       </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-8 font-mono text-[11px]">
                       {recommendation.tags.map(tag => (
                         <span key={tag} className="text-app-text-secondary opacity-50 hover:opacity-100 transition-opacity cursor-default">#{tag}</span>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="pt-64" h-full /> {/* Spacer for relative overlay */}
              <div className="h-[400px]" /> {/* Extra spacer for overlay content overflow */}
           </div>

           {/* Embedded Products Section */}
           <div className="bg-app-card border border-app-border rounded-[1.5rem] p-8 mt-24">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                 <ShoppingBag className="w-6 h-6 text-app-accent" />
                 Recommended Products
              </h3>
              <div className="space-y-4">
                 {recommendation.products.map((p, i) => (
                   <div key={i} className="group bg-app-sidebar/50 border border-app-border p-5 rounded-2xl flex items-center justify-between hover:border-app-accent/40 transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-app-card rounded-xl flex items-center justify-center border border-app-border text-white font-bold text-xs">
                            BG
                         </div>
                         <div>
                            <h5 className="text-[14px] font-bold text-white group-hover:text-app-accent-light transition-colors">{p.name}</h5>
                            <p className="text-[11px] text-app-text-secondary">{p.brand} Official Store</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-[14px] font-extrabold text-app-accent-light">{p.price}</div>
                         <button className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest flex items-center gap-1.5 mt-1 hover:text-white transition-colors">
                            View Product <ExternalLink className="w-3 h-3" />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Moderation Panel Sidebar */}
        <div className="space-y-6">
           <div className="bg-app-card border border-app-border rounded-2xl p-6">
              <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-app-accent-light" />
                 Moderation Checklist
              </h4>
              <div className="space-y-4">
                 {[
                   { label: 'Creator Verified', check: true },
                   { label: 'Language Compatibility', check: true },
                   { label: 'Product Availability', check: true },
                   { label: 'AI Review Pass', check: true },
                   { label: 'Image Guidelines', check: false },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-app-text-secondary">{item.label}</span>
                      {item.check ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-orange-500" />}
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-app-card border border-app-border rounded-2xl p-6">
              <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-4">Metadata Overview</h4>
              <div className="space-y-3">
                 <div className="text-[12px]">
                    <span className="text-app-text-secondary block opacity-50 uppercase font-bold tracking-tighter mb-0.5">Primary Category</span>
                    <span className="text-white font-semibold">{recommendation.category}</span>
                 </div>
                 <div className="text-[12px]">
                    <span className="text-app-text-secondary block opacity-50 uppercase font-bold tracking-tighter mb-0.5">Sub Category</span>
                    <span className="text-white font-semibold">{recommendation.subCategory}</span>
                 </div>
              </div>
           </div>

           <div className="bg-app-card border border-app-border rounded-2xl p-6">
              <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-4">Internal History</h4>
              <div className="space-y-4">
                 <div className="border-l-2 border-app-accent pl-4 py-1">
                    <p className="text-[11px] font-bold text-white">Submitted for Review</p>
                    <p className="text-[10px] text-app-text-secondary">Today, 11:24 AM by Sifat Tanvir</p>
                 </div>
                 <div className="border-l-2 border-app-border pl-4 py-1">
                    <p className="text-[11px] font-bold text-app-text-secondary">AI Content Check</p>
                    <p className="text-[10px] text-app-text-secondary opacity-50">Passed auto-moderation gates</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
