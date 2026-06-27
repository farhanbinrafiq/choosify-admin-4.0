import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Award,
  ThumbsUp,
  MessageSquare,
  Share2,
  ExternalLink,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import { sharedRecommendations } from '../Recommendations';

export default function RecommendationPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("Does not meet community quality/source verification guidelines");

  // Look up the recommendation from shared state repository
  const foundRec = sharedRecommendations.find(r => r.id === id);

  if (!foundRec) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 text-center bg-app-card border border-app-border rounded-3xl space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-white text-lg font-bold">Recommendation Guide Not Found</h3>
        <p className="text-app-text-secondary text-xs">The requested curation record might have been removed or does not exist.</p>
        <Link 
          to="/admin/recommendations" 
          className="inline-block px-6 py-2 bg-app-accent hover:bg-app-accent-light text-white rounded-xl text-xs font-bold transition"
        >
          Go back to moderation board
        </Link>
      </div>
    );
  }

  // Model-level format mapper for render safety
  const recommendation = {
    id: foundRec.id,
    title: foundRec.title,
    creator: {
      name: foundRec.creator,
      handle: foundRec.creatorHandle || `@${foundRec.creator.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: foundRec.initials
    },
    status: foundRec.status === 'Pending' ? 'Pending Review' : foundRec.status,
    submittedAt: new Date(foundRec.submittedAt).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' ' + new Date(foundRec.submittedAt).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    }),
    category: foundRec.category || 'Technology',
    subCategory: foundRec.subCategory || 'General Curated',
    products: foundRec.products || [
       { id: 'p1', name: 'Premium Verified Gear', price: '৳ 3,500', brand: 'Genuine Retailer' }
    ],
    content: foundRec.body,
    tags: foundRec.tags
  };

  const handleApprove = () => {
    navigate('/admin/recommendations', {
      state: {
        action: 'approve',
        id: foundRec.id
      }
    });
  };

  const handleReject = (reason: string) => {
    navigate('/admin/recommendations', {
      state: {
        action: 'reject',
        id: foundRec.id,
        reason: reason || 'Rejected via interactive moderation preview'
      }
    });
  };

  return (
    <div className="space-y-6 pb-24 text-left">
      {/* Moderation Controls Sticky Top */}
      <div className="sticky top-0 z-20 bg-app-card/95 backdrop-blur border border-app-border rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Link to="/admin/recommendations" className="p-2 border border-app-border rounded-lg text-app-text-secondary hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
           </Link>
           <div>
              <h4 className="text-sm font-bold text-white">Content Moderation Terminal</h4>
              <p className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest text-orange-500">
                {recommendation.status.toUpperCase()} • {recommendation.submittedAt}
              </p>
           </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => {
                 handleApprove();
                 setShowRejectForm(false);
               }}
               className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer border-none"
             >
                <CheckCircle2 className="w-4 h-4" /> Approve Recommendation
             </button>
             <button 
               onClick={() => setShowRejectForm(prev => !prev)}
               className="px-6 py-2.5 bg-white/5 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
             >
                <XCircle className="w-4 h-4" /> Reject &amp; Feedback
             </button>
          </div>
          {showRejectForm && (
            <div className="p-4 bg-app-card border border-red-500/30 rounded-2xl flex flex-col gap-3 w-96 max-w-full shadow-2xl animate-fade-in text-left">
              <span className="text-xs font-black text-red-400 uppercase tracking-wider">Provide Rejection Feedback</span>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs outline-none focus:border-red-500 text-slate-300 font-semibold"
                placeholder="Explain the rejection reasons..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    handleReject(rejectReason);
                    setShowRejectForm(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >Confirm Reject</button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
                >Cancel</button>
              </div>
            </div>
          )}
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
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 font-bold border border-green-500/20 text-sm">
                             {recommendation.creator.avatar}
                          </div>
                          <div>
                             <h5 className="text-sm font-bold text-white">{recommendation.creator.name}</h5>
                             <p className="text-[11px] text-app-text-secondary">{recommendation.creator.handle}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 text-app-text-secondary">
                          <div className="flex items-center gap-1.5 text-xs"><ThumbsUp className="w-4 h-4" /> {foundRec.views > 200 ? Math.floor(foundRec.views / 25) : 0}</div>
                          <div className="flex items-center gap-1.5 text-xs"><MessageSquare className="w-4 h-4" /> {foundRec.views > 500 ? Math.floor(foundRec.views / 110) : 0}</div>
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
              <div className="pt-64" h-full="true" /> {/* Spacer for relative overlay */}
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
                   <div key={i} className="group bg-app-sidebar/50 border border-app-border p-5 rounded-2xl flex items-center justify-between hover:border-app-accent/40 transition-all text-left">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-app-card rounded-xl flex items-center justify-center border border-app-border text-white font-bold text-xs uppercase">
                            {p.brand.slice(0, 2)}
                         </div>
                         <div>
                            <h5 className="text-[14px] font-bold text-white group-hover:text-app-accent-light transition-colors">{p.name}</h5>
                            <p className="text-[11px] text-app-text-secondary">{p.brand} Official Store</p>
                         </div>
                      </div>
                      <div className="text-right font-medium">
                         <div className="text-[14px] font-extrabold text-app-accent-light">{p.price}</div>
                         <button className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest flex items-center gap-1.5 mt-1 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
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
                   { label: 'Creator Verified', check: foundRec.creatorId !== '11' },
                   { label: 'Language Compatibility', check: true },
                   { label: 'Product Availability', check: true },
                   { label: 'AI Review Pass', check: foundRec.creatorId !== '11' },
                   { label: 'Image Guidelines', check: foundRec.creatorId !== '11' },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between text-[12px] font-medium">
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
                    <p className="text-[10px] text-app-text-secondary">Submitted on {new Date(foundRec.submittedAt).toLocaleDateString()}</p>
                 </div>
                 <div className="border-l-2 border-app-border pl-4 py-1">
                    <p className="text-[11px] font-bold text-app-text-secondary">AI Content Check</p>
                    <p className="text-[10px] text-app-text-secondary opacity-50">{foundRec.creatorId === '11' ? 'Failed confidence flags threshold check' : 'Passed auto-moderation gates setup'}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
