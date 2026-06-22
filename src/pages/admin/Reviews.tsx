import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Star, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Ban, 
  Search, 
  CornerDownRight, 
  Send, 
  ShieldAlert, 
  Edit3, 
  EyeOff, 
  UserX,
  Filter
} from 'lucide-react';

interface ReviewResponse {
  id: string;
  author: string;
  comment: string;
  timestamp: string;
}

interface Review {
  id: string;
  user: string;
  product: string;
  store: string;
  rating: number;
  comment: string;
  status: 'Flagged' | 'Published' | 'Deleted' | 'Hidden';
  reports: number;
  flags?: string[];
  response?: ReviewResponse;
}

const initialMockReviews: Review[] = [
  { 
    id: '1', 
    user: 'Mehedi Rahman', 
    product: 'Samsung Galaxy S25 Ultra', 
    store: 'TechZone BD', 
    rating: 1, 
    comment: '"This phone is absolute garbage. The seller is a cheat and scammer. I will make sure everyone knows this shop is a fraud. Complete waste of money and time..."', 
    status: 'Flagged', 
    reports: 4, 
    flags: ['Personal Threats', 'Abusive Language'] 
  },
  { 
    id: '2', 
    user: 'Anonymous K.', 
    product: 'Walton 2-Door Fridge', 
    store: 'ElectroBD', 
    rating: 5, 
    comment: '"Amazing product! Buy from this link: [bit.ly/xyz] for best price! This seller is the best. Everyone should buy here. [Affiliate link spam suspected]"', 
    status: 'Flagged', 
    reports: 2, 
    flags: ['External Links', 'Suspected Spam'] 
  },
  { 
    id: '3', 
    user: 'Rifat Hasan', 
    product: 'Aarong Jamdani Saree', 
    store: 'Aarong Digital', 
    rating: 3, 
    comment: '"Fabric quality is good but delivery took 5 days longer than promised. The color was slightly different but acceptable. Would buy again."', 
    status: 'Published', 
    reports: 0 
  },
];

export default function ReviewsPage() {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(initialMockReviews);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Flagged' | 'Published' | 'Deleted' | 'Hidden'>('All');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [sellerReplyText, setSellerReplyText] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Identify Roles
  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = isSuperAdmin || profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const roleDisplayLabel = isAdmin ? 'Platform Admin Review Console' : 'Merchant Review Desk';

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Admin Actions
  const handleDelete = (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'Deleted' } : r));
    showToast('Review marked as Deleted successfully.', 'success');
  };

  const handleHide = (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'Hidden' } : r));
    showToast('Review status set to Hidden (Not visible on product page).', 'info');
  };

  const handleApprove = (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'Published', reports: 0 } : r));
    showToast('Review approved as Published.', 'success');
  };

  const handleRestrictCustomer = (username: string) => {
    showToast(`Consumer ${username}'s review privileges have been locked.`, 'info');
  };

  const startEditing = (review: Review) => {
    setEditingReviewId(review.id);
    setEditCommentText(review.comment);
  };

  const saveEditValue = (id: string) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, comment: editCommentText } : r));
    setEditingReviewId(null);
    showToast('Review content amended successfully.', 'success');
  };

  // Seller Action: Submit Single Reply
  const handleSellerReply = (id: string) => {
    const text = sellerReplyText[id]?.trim();
    if (!text) return;

    setReviews(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          response: {
            id: `resp-${id}`,
            author: profile?.name || 'Authorized Store Manager',
            comment: text,
            timestamp: new Date().toLocaleDateString()
          }
        };
      }
      return r;
    }));

    // Clear state
    setSellerReplyText(prev => ({ ...prev, [id]: '' }));
    showToast('Reply submitted. Reviews can only be replied to once.', 'success');
  };

  // Filter & Search Logic
  const filteredReviews = reviews.filter(r => {
    if (activeTab !== 'All' && r.status !== activeTab) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.user.toLowerCase().includes(query) ||
      r.product.toLowerCase().includes(query) ||
      r.store.toLowerCase().includes(query) ||
      r.comment.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 text-app-text-primary font-sans animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-[#F4631E]" />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Path */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[9.5px] font-black uppercase tracking-widest text-[#F4631E] block">Unified Review Logistics</span>
          <h1 className="text-xl font-bold text-white tracking-tight">{roleDisplayLabel}</h1>
          <p className="text-app-text-secondary text-[11.5px]">Manage client reviews, moderate flags, or reply as seller.</p>
        </div>
      </div>

      {/* Stats Block */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Platform Feed', val: reviews.length, color: 'border-l-indigo-500' },
          { label: 'Published (Active)', val: reviews.filter(r => r.status === 'Published').length, color: 'border-l-green-500' },
          { label: 'Flagged Spams', val: reviews.filter(r => r.status === 'Flagged').length, color: 'border-l-red-500' },
          { label: 'Deleted Archive', val: reviews.filter(r => r.status === 'Deleted').length, color: 'border-l-gray-500' },
          { label: 'Hidden from Public', val: reviews.filter(r => r.status === 'Hidden').length, color: 'border-l-amber-500' },
        ].map(s => (
          <div key={s.label} className={`bg-app-card p-4 rounded-[4px] border border-app-border border-l-[3px] shadow-lg ${s.color}`}>
             <div className="text-[20px] font-bold text-white font-mono">{s.val}</div>
             <div className="text-[9px] text-app-text-secondary tracking-widest font-extrabold uppercase mt-1 opacity-75">{s.label}</div>
          </div>
        ))}
      </div>

      {/* TAB CONTROLLERS & SEARCH INPUT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-app-border pb-1">
        <div className="flex overflow-x-auto scrollbar-hide gap-1 bg-app-card rounded-[4px] p-0.5 border border-app-border">
          {(['All', 'Flagged', 'Published', 'Deleted', 'Hidden'] as const).map(tab => {
            const count = tab === 'All' ? reviews.length : reviews.filter(r => r.status === tab).length;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest cursor-pointer transition-all rounded-[3px] ${
                  activeTab === tab 
                    ? 'bg-[#F4631E]/10 text-[#F4631E] border border-[#F4631E]/20' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative group w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#F4631E]" />
          <input 
            type="text" 
            placeholder="Search reviews by store name, reviewer, comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-[#F4631E]/40 text-white placeholder-slate-500"
          />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-[#1A1A2E] text-white px-4 py-3 rounded-xl flex items-center justify-between gap-3 mb-3 text-[12px] font-bold border border-white/10 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-app-accent/20 text-app-accent-light px-2.5 py-1 rounded-lg font-mono">
              {selectedIds.size} reviews selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setReviews(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, status: 'Hidden' } : r));
                  showToast(`Headed Hidden to ${selectedIds.size} reviews`, 'info');
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Hide All
              </button>
              <button
                onClick={() => {
                  setReviews(prev => prev.filter(r => !selectedIds.has(r.id)));
                  showToast(`Deleted ${selectedIds.size} reviews from state`, 'success');
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Delete All
              </button>
              <button
                onClick={() => {
                  setReviews(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, status: 'Published', reports: 0 } : r));
                  showToast(`Published ${selectedIds.size} reviews successfully`, 'success');
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors uppercase font-extrabold cursor-pointer"
              >
                Approve All
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white px-3 py-1 cursor-pointer transition-colors uppercase text-[10px]"
          >
            ✕ Clear selection
          </button>
        </div>
      )}

      {/* Select All in tab Option */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-app-card border border-app-border rounded-xl">
        <input 
          type="checkbox" 
          id="select-all-reviews"
          className="rounded border-white/10 bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
          checked={filteredReviews.length > 0 && filteredReviews.every(r => selectedIds.has(r.id))}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set([...selectedIds, ...filteredReviews.map(r => r.id)]));
            } else {
              const newSelected = new Set(selectedIds);
              filteredReviews.forEach(r => newSelected.delete(r.id));
              setSelectedIds(newSelected);
            }
          }}
        />
        <label htmlFor="select-all-reviews" className="text-[11px] text-slate-400 font-bold uppercase tracking-wider cursor-pointer select-none">
          Select All visible ({filteredReviews.length} reviews)
        </label>
      </div>

      {/* REVIEWS GRID LEAF */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-app-card rounded-xl border border-app-border text-slate-500 text-sm">
            No reviews matching selected search criteria.
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <div 
              key={rev.id} 
              className={`bg-app-card border rounded-[4px] p-5 shadow-xl transition-all ${
                rev.status === 'Flagged' 
                  ? 'border-red-500/30 border-l-[3px] border-l-red-500' 
                  : rev.status === 'Deleted'
                  ? 'border-gray-500/20 opacity-60'
                  : 'border-app-border'
              }`}
            >
              
              {/* Reviewer Details */}
              <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                <div className="flex gap-3 items-center">
                  <input 
                    type="checkbox"
                    className="rounded border-white/10 bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                    checked={selectedIds.has(rev.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedIds);
                      if (e.target.checked) {
                        newSelected.add(rev.id);
                      } else {
                        newSelected.delete(rev.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                  />
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {rev.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">{rev.user}</h4>
                    <p className="text-[10px] text-app-text-secondary mt-0.5">
                      Target SKU: <span className="text-slate-300 font-semibold">{rev.product}</span> · Merchant: <span className="font-bold text-[#F4631E]">{rev.store}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5 text-[#F4631E]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-[2px] font-black uppercase tracking-wider border ${
                    rev.status === 'Flagged'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : rev.status === 'Published'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : rev.status === 'Hidden'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {rev.status} {rev.reports > 0 && `· ${rev.reports} Flags`}
                  </span>
                </div>
              </div>

              {/* Review Comment Text */}
              {editingReviewId === rev.id ? (
                <div className="space-y-2 mb-4 bg-slate-950 p-3 rounded-lg border border-app-border">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modify Vulgar/Spam expressions</label>
                  <textarea 
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    className="w-full bg-slate-900 border border-app-border rounded p-2 text-xs text-white focus:outline-none focus:border-[#F4631E]"
                    rows={2}
                  />
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => setEditingReviewId(null)}
                      className="px-3 py-1 bg-[#1A1A2E] text-slate-400 text-[11px] rounded"
                    >
                      Dismiss
                    </button>
                    <button 
                      onClick={() => saveEditValue(rev.id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold rounded"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-200 leading-relaxed italic mb-4 font-normal bg-white/[0.01] p-3 rounded border border-white/[0.01]">{rev.comment}</p>
              )}

              {/* Spams classification tags */}
              {rev.flags && rev.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {rev.flags.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-[8.5px] font-extrabold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-[2px] border border-red-500/10 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" /> {f}
                    </span>
                  ))}
                </div>
              )}

              {/* RESPONSE RULE SECTION: Direct Seller Reply */}
              <div className="space-y-3.5 pt-4 border-t border-white/[0.04] bg-white/[0.01] p-3 rounded-b-lg">
                {rev.response ? (
                  /* SINGLE MERCHANT REPLY RENDER - NO MULTI-THREAD */
                  <div className="flex gap-2 items-start text-xs border-l-[2px] border-l-[#F4631E] pl-3.5 py-1">
                    <CornerDownRight className="w-4 h-4 text-[#F4631E] shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-[11px]">{rev.response.author}</span>
                        <span className="bg-[#F4631E]/10 text-[#F4631E] px-1 py-0.1 text-[7.5px] font-black rounded uppercase tracking-wider">Official Response</span>
                        <span className="text-[10px] text-slate-500 font-mono italic">{rev.response.timestamp}</span>
                      </div>
                      <p className="text-slate-300 italic mt-1 font-medium bg-black/20 p-2.5 rounded border border-white/5">{rev.response.comment}</p>
                    </div>
                  </div>
                ) : (
                  /* REPLY BOX FOR SELLER - SINGLE REPLY LOCK */
                  isSeller && (
                    <div className="space-y-2">
                      <div className="relative group">
                        <input 
                          type="text"
                          placeholder="Respond to this review here. Single response locks permanently, no threading..."
                          value={sellerReplyText[rev.id] || ''}
                          onChange={(e) => setSellerReplyText(prev => ({ ...prev, [rev.id]: e.target.value }))}
                          className="w-full bg-slate-900 border border-app-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F4631E] placeholder-slate-500 pr-10 font-medium"
                        />
                        <button 
                          onClick={() => handleSellerReply(rev.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F4631E] hover:text-[#F4631E]-light cursor-pointer"
                          title="Submit Response"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* CONTROLS AREA */}
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/[0.02] flex-wrap gap-3">
                <span className="text-[9.5px] text-slate-500 font-mono">Posted Year 2026 · Platform audit index normal.</span>
                
                {/* ADMIN MODERATION ACTIONS */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    {rev.status === 'Flagged' && (
                      <button 
                        onClick={() => handleApprove(rev.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10.5px] font-semibold text-green-400 bg-green-500/10 border border-green-500/25 hover:bg-green-500/20 transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Keep & Approve
                      </button>
                    )}
                    <button 
                      onClick={() => startEditing(rev)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10.5px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Content
                    </button>
                    <button 
                      onClick={() => handleHide(rev.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10.5px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 transition-all cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Hide Review
                    </button>
                    {rev.status !== 'Deleted' && (
                      <button 
                        onClick={() => handleDelete(rev.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10.5px] font-semibold text-red-400 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                    <button 
                      onClick={() => handleRestrictCustomer(rev.user)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[10.5px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                      title="Restrict user from posting reviews"
                    >
                      <UserX className="w-3.5 h-3.5" /> Restrict Privileges
                    </button>
                  </div>
                )}
                
                {/* SELLER HAS NO MODULATION POWERS */}
                {isSeller && !rev.response && (
                  <span className="text-[10px] text-slate-400 font-mono block italic">You have reply permissions. Moderate actions restricted.</span>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
