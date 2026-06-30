import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useReviewModeration } from '../../contexts/ReviewModeration';
import { Review } from '../../contexts/OrdersContext';
import { 
  Star, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Search, 
  CornerDownRight, 
  Send, 
  ShieldAlert, 
  Edit3, 
  EyeOff, 
  UserX,
  Filter,
  Activity,
  Keyboard,
  Info,
  X,
  FileText,
  ThumbsUp,
  Sliders,
  ShieldCheck,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ReviewsPage() {
  const { profile } = useAuth();
  const {
    reviews,
    toasts,
    removeToast,
    approveReview,
    rejectReview,
    flagReview,
    markAsSpam,
    addSellerResponse,
    deleteReview,
    runBatchAnalysis,
    updateReviewComment,
    toggleReviewStatus
  } = useReviewModeration();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'pending' | 'Flagged' | 'Published' | 'Deleted' | 'Hidden'>('All');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [sellerReplyText, setSellerReplyText] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('choosify_review_internal_notes');
    return saved ? JSON.parse(saved) : {};
  });

  // Filters state
  const [filterRating, setFilterRating] = useState<number | 'All'>('All');
  const [filterAuthenticity, setFilterAuthenticity] = useState<'All' | 'Authentic Only' | 'Flagged/Spam Only'>('All');
  
  // Interactive scanning simulation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Keyboard shortcut state
  const [focusedReviewId, setFocusedReviewId] = useState<string | null>(null);
  const [showShortcutsHUD, setShowShortcutsHUD] = useState(true);

  // Identify Roles
  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = isSuperAdmin || profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const roleDisplayLabel = isAdmin ? 'Platform Admin Review Console' : 'Merchant Review Desk';

  // Persist notes
  useEffect(() => {
    localStorage.setItem('choosify_review_internal_notes', JSON.stringify(reviewNotes));
  }, [reviewNotes]);

  // Handle single note update
  const handleSaveNote = (id: string, noteText: string) => {
    setReviewNotes(prev => ({
      ...prev,
      [id]: noteText
    }));
  };

  // Filter & Search Logic
  const filteredReviews = reviews.filter(r => {
    // Status check (case-insensitive fallback since mock statuses vary)
    if (activeTab !== 'All') {
      if (r.status.toLowerCase() !== activeTab.toLowerCase()) return false;
    }
    
    // Rating check
    if (filterRating !== 'All' && r.rating !== filterRating) return false;

    // Authenticity check
    if (filterAuthenticity === 'Authentic Only' && r.isAuthentic === false) return false;
    if (filterAuthenticity === 'Flagged/Spam Only' && r.isAuthentic !== false) return false;

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.user.toLowerCase().includes(query) ||
      r.product.toLowerCase().includes(query) ||
      r.store.toLowerCase().includes(query) ||
      r.comment.toLowerCase().includes(query);
  });

  // Setup index for keyboard shortcut navigation
  const currentFocusedIndex = filteredReviews.findIndex(r => r.id === focusedReviewId);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys if focused on any input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        // Cycle focused review
        if (filteredReviews.length === 0) return;
        if (focusedReviewId === null) {
          setFocusedReviewId(filteredReviews[0].id);
        } else {
          const nextIndex = (currentFocusedIndex + 1) % filteredReviews.length;
          setFocusedReviewId(filteredReviews[nextIndex].id);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        if (filteredReviews.length === 0) return;
        const nextIndex = currentFocusedIndex === -1 || currentFocusedIndex === filteredReviews.length - 1 
          ? 0 
          : currentFocusedIndex + 1;
        setFocusedReviewId(filteredReviews[nextIndex].id);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        if (filteredReviews.length === 0) return;
        const prevIndex = currentFocusedIndex <= 0 
          ? filteredReviews.length - 1 
          : currentFocusedIndex - 1;
        setFocusedReviewId(filteredReviews[prevIndex].id);
      } else if (e.key === 'q' || e.key === 'Q') {
        if (focusedReviewId && isAdmin) {
          e.preventDefault();
          approveReview(focusedReviewId);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (focusedReviewId && isAdmin) {
          e.preventDefault();
          rejectReview(focusedReviewId);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (focusedReviewId && isAdmin) {
          e.preventDefault();
          markAsSpam(focusedReviewId);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setFocusedReviewId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedReviewId, filteredReviews, currentFocusedIndex, isAdmin]);

  // Trigger batch scan with gorgeous layout progress bar animation
  const triggerBatchScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            runBatchAnalysis();
            setIsScanning(false);
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 120);
  };

  const handleRestrictCustomer = (username: string) => {
    alert(`Mock Request dispatched: Privileges restricted for user "${username}". Security policy updated.`);
  };

  const startEditing = (review: Review) => {
    setEditingReviewId(review.id);
    setEditCommentText(review.comment);
  };

  const saveEditValue = (id: string) => {
    updateReviewComment(id, editCommentText);
    setEditingReviewId(null);
  };

  const handleSellerReply = (id: string) => {
    const text = sellerReplyText[id]?.trim();
    if (!text) return;
    addSellerResponse(id, profile?.name || 'Authorized Merchant Manager', text);
    setSellerReplyText(prev => ({ ...prev, [id]: '' }));
  };

  return (
    <div className="space-y-6 text-app-text-primary font-sans animate-in fade-in duration-300">
      
      {/* Toast Overlay */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none max-w-sm">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="pointer-events-auto flex items-start gap-3 bg-app-card border border-app-border rounded-xl p-4 shadow-2xl"
            >
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                t.type === 'success' ? 'bg-green-500' :
                t.type === 'error' ? 'bg-red-500' :
                t.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1">
                <p className="text-xs font-bold text-white leading-tight">{t.message}</p>
              </div>
              <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-white shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header and Path */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[9.5px] font-black uppercase tracking-widest text-[#F4631E] block">Unified Trust & Review Moderation</span>
          <h1 className="text-xl font-bold text-white tracking-tight">{roleDisplayLabel}</h1>
          <p className="text-app-text-secondary text-[11.5px]">Manage client reviews, verify content authenticity, detect fake feedback, and lock spam agents.</p>
        </div>

        {/* AI Action Command */}
        {isAdmin && (
          <button
            onClick={triggerBatchScan}
            disabled={isScanning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              isScanning 
                ? 'bg-slate-800 text-slate-400 border border-slate-700' 
                : 'bg-gradient-to-r from-[#F4631E] to-[#EB4501] text-white hover:opacity-90 active:scale-95 shadow-[#F4631E]/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? `Spam scan progress: ${scanProgress}%` : 'Run Batch Spam Scan'}
          </button>
        )}
      </div>

      {/* Progress Scanning Interface Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#1A1A2E]/60 border border-[#F4631E]/20 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#F4631E] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Review Corpus Spam Auditing Engine Active...</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#F4631E]">{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#F4631E] to-amber-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${scanProgress}%` }}
                  transition={{ ease: 'easeInOut' }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-mono italic">Auditing syntactic features, repetitive burst signatures, cross-IP duplicate submissions, and commercial outbound click redirections.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Collapsible Help HUD */}
      {isAdmin && (
        <div className="bg-[#1A1A2E]/30 border border-app-border/70 p-4 rounded-xl">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowShortcutsHUD(!showShortcutsHUD)}>
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-[#F4631E]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Keyboard Interactive Terminal Shortcuts</span>
            </div>
            <span className="text-[10px] text-slate-400 hover:text-white uppercase font-bold tracking-widest">{showShortcutsHUD ? '[Collapse HUD]' : '[Expand HUD]'}</span>
          </div>

          <AnimatePresence>
            {showShortcutsHUD && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-[11px] font-mono border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-0.5 bg-slate-900 border border-white/10 rounded text-[#F4631E]">Tab</kbd>
                    <span className="text-slate-400">Cycle focused review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-0.5 bg-slate-900 border border-white/10 rounded text-[#F4631E]">Q</kbd>
                    <span className="text-slate-400">Approve & Publish review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-0.5 bg-slate-900 border border-white/10 rounded text-[#F4631E]">R</kbd>
                    <span className="text-slate-400">Reject & Archive review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-0.5 bg-slate-900 border border-white/10 rounded text-[#F4631E]">F</kbd>
                    <span className="text-slate-400">Flag as Deceptive Spam</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-full text-[10px] text-amber-500 italic">
                    <Info className="w-3.5 h-3.5" /> Navigate using <kbd className="px-1.5 py-0.2 bg-slate-950 rounded text-white">ArrowUp / ArrowDown</kbd> or <kbd className="px-1.5 py-0.2 bg-slate-950 rounded text-white">J / K</kbd> to change focus. Focused review glows gold.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Stats Block */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Platform Feed', val: reviews.length, color: 'border-l-indigo-500' },
          { label: 'Pending Moderation', val: reviews.filter(r => r.status.toLowerCase() === 'pending').length, color: 'border-l-yellow-500' },
          { label: 'Published (Active)', val: reviews.filter(r => r.status.toLowerCase() === 'published').length, color: 'border-l-green-500' },
          { label: 'Flagged Spams', val: reviews.filter(r => r.status.toLowerCase() === 'flagged').length, color: 'border-l-red-500' },
          { label: 'Deleted Archive', val: reviews.filter(r => r.status.toLowerCase() === 'deleted').length, color: 'border-l-gray-500' },
          { label: 'Hidden from Public', val: reviews.filter(r => r.status.toLowerCase() === 'hidden').length, color: 'border-l-amber-500' },
        ].map(s => (
          <div key={s.label} className={`bg-app-card p-4 rounded-[4px] border border-app-border border-l-[3px] shadow-lg ${s.color}`}>
             <div className="text-[20px] font-bold text-white font-mono">{s.val}</div>
             <div className="text-[9px] text-app-text-secondary tracking-widest font-extrabold uppercase mt-1 opacity-75">{s.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER & ADVANCED CONTROLLERS BAR */}
      <div className="space-y-4 bg-app-card p-4 rounded-xl border border-app-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Main Tab Selectors */}
          <div className="flex overflow-x-auto scrollbar-hide gap-1 p-0.5 bg-slate-950 rounded-[4px] border border-white/5">
            {(['All', 'pending', 'Flagged', 'Published', 'Deleted', 'Hidden'] as const).map(tab => {
              const count = tab === 'All' ? reviews.length : reviews.filter(r => r.status.toLowerCase() === tab.toLowerCase()).length;
              return (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-widest cursor-pointer transition-all rounded-[3px] whitespace-nowrap ${
                    activeTab === tab 
                      ? 'bg-[#F4631E]/10 text-[#F4631E] border border-[#F4631E]/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'pending' ? 'Pending Queue' : tab} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Query */}
          <div className="relative group w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[#F4631E]" />
            <input 
              type="text" 
              placeholder="Search reviewer, SKU, comment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-950 border border-white/5 rounded-[4px] text-xs w-full focus:outline-none focus:border-[#F4631E]/40 text-white placeholder-slate-500 font-medium"
            />
          </div>
        </div>

        {/* Detailed Filters (Rating and Authenticity) */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/[0.03] text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Refinement Filters:</span>
          </div>

          {/* Rating filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">Rating:</span>
            <div className="flex gap-1 bg-slate-950 px-2 py-1 rounded border border-white/5">
              {(['All', 1, 2, 3, 4, 5] as const).map(rate => (
                <button
                  key={rate}
                  onClick={() => setFilterRating(rate)}
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded ${
                    filterRating === rate ? 'bg-[#F4631E]/20 text-[#F4631E]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate} {typeof rate === 'number' && '★'}
                </button>
              ))}
            </div>
          </div>

          {/* Authenticity Index filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">AI Trust Score:</span>
            <div className="flex gap-1 bg-slate-950 px-2 py-1 rounded border border-white/5">
              {(['All', 'Authentic Only', 'Flagged/Spam Only'] as const).map(auth => (
                <button
                  key={auth}
                  onClick={() => setFilterAuthenticity(auth)}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                    filterAuthenticity === auth ? 'bg-[#F4631E]/20 text-[#F4631E]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {auth}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#1A1A2E] text-white px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-[12px] font-bold border border-white/10 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-app-accent/20 text-app-accent-light px-2.5 py-1 rounded-lg font-mono text-[11px]">
              {selectedIds.size} reviews selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  reviews.forEach(r => {
                    if (selectedIds.has(r.id)) {
                      toggleReviewStatus(r.id, 'Hidden');
                    }
                  });
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Hide Selected
              </button>
              <button
                onClick={() => {
                  reviews.forEach(r => {
                    if (selectedIds.has(r.id)) {
                      deleteReview(r.id);
                    }
                  });
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Delete Selected
              </button>
              <button
                onClick={() => {
                  reviews.forEach(r => {
                    if (selectedIds.has(r.id)) {
                      approveReview(r.id);
                    }
                  });
                  setSelectedIds(new Set());
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Approve Selected
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

      {/* Select All Bar */}
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
          Select All visible ({filteredReviews.length} reviews matching filters)
        </label>
      </div>

      {/* REVIEWS GRID LIST */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main List */}
        <div className="xl:col-span-2 space-y-4">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-16 bg-app-card rounded-xl border border-app-border text-slate-500 text-sm italic">
              No reviews matching active search query or refinement filters.
            </div>
          ) : (
            filteredReviews.map((rev) => {
              const isFocused = focusedReviewId === rev.id;
              const hasLowScore = rev.authenticityScore !== undefined && rev.authenticityScore < 50;

              return (
                <div 
                  key={rev.id} 
                  onClick={() => setFocusedReviewId(rev.id)}
                  className={`bg-app-card border rounded-xl p-5 shadow-xl transition-all relative ${
                    isFocused 
                      ? 'border-amber-500 ring-1 ring-amber-500 shadow-amber-500/5' 
                      : rev.status.toLowerCase() === 'flagged' 
                      ? 'border-red-500/30 border-l-[4px] border-l-red-500' 
                      : rev.status.toLowerCase() === 'deleted'
                      ? 'border-gray-500/20 opacity-60'
                      : 'border-app-border'
                  }`}
                >
                  
                  {/* Focus Ribbon Label */}
                  {isFocused && (
                    <div className="absolute -top-2.5 right-6 bg-amber-500 text-slate-950 font-mono text-[8px] font-black uppercase px-2 py-0.5 rounded shadow">
                      Keyboard Focus Target
                    </div>
                  )}

                  {/* Reviewer Details */}
                  <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <div className="flex gap-3 items-center">
                      <input 
                        type="checkbox"
                        className="rounded border-white/10 bg-white/5 text-app-accent focus:ring-app-accent cursor-pointer"
                        checked={selectedIds.has(rev.id)}
                        onClick={(e) => e.stopPropagation()}
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
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {rev.user.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">{rev.user}</h4>
                        <p className="text-[10px] text-app-text-secondary mt-0.5">
                          SKU: <span className="text-slate-300 font-semibold">{rev.product}</span> · Merchant: <span className="font-bold text-[#F4631E]">{rev.store}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-current text-amber-400' : 'opacity-25'}`} />
                        ))}
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${
                        rev.status.toLowerCase() === 'flagged' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        rev.status.toLowerCase() === 'published' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        rev.status.toLowerCase() === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        rev.status.toLowerCase() === 'deleted' ? 'bg-gray-800 text-gray-400 border-gray-700' :
                        'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {rev.status} {rev.reports > 0 && `· ${rev.reports} Reports`}
                      </span>
                    </div>
                  </div>

                  {/* Review Text Area */}
                  {editingReviewId === rev.id ? (
                    <div className="space-y-2 mb-4 bg-slate-950 p-3 rounded-lg border border-app-border" onClick={(e) => e.stopPropagation()}>
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
                          className="px-3 py-1 bg-slate-800 text-slate-300 text-[10px] uppercase font-bold rounded"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => saveEditValue(rev.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] uppercase font-bold rounded"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-200 leading-relaxed italic mb-4 font-normal bg-white/[0.01] p-3 rounded border border-white/[0.01]">{rev.comment}</p>
                  )}

                  {/* Authenticity Detail Panel */}
                  {rev.authenticityScore !== undefined && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-white/[0.03] space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[9.5px] uppercase font-extrabold tracking-wider text-slate-400">
                          {hasLowScore ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                          )}
                          AI Authenticity Analysis
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          rev.authenticityScore >= 75 ? 'text-green-400 bg-green-500/10' :
                          rev.authenticityScore >= 50 ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10'
                        }`}>
                          Score: {rev.authenticityScore}/100
                        </span>
                      </div>
                      
                      {/* Authenticity Meter */}
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className={`h-full rounded-full ${
                            rev.authenticityScore >= 75 ? 'bg-green-500' :
                            rev.authenticityScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${rev.authenticityScore}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{rev.authenticityReason}</p>
                    </div>
                  )}

                  {/* Flag classification labels */}
                  {rev.flags && rev.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {rev.flags.map((f, i) => (
                        <span key={i} className="flex items-center gap-1 text-[8.5px] font-extrabold bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-[2px] border border-red-500/10 uppercase tracking-wider">
                          <AlertTriangle className="w-3 h-3" /> {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Merchant Response thread block */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.03]" onClick={(e) => e.stopPropagation()}>
                    {rev.response ? (
                      <div className="flex gap-2 items-start text-xs border-l-2 border-[#F4631E] pl-3.5 py-1">
                        <CornerDownRight className="w-3.5 h-3.5 text-[#F4631E] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-[11px]">{rev.response.author}</span>
                            <span className="bg-[#F4631E]/15 text-[#F4631E] px-1.5 py-0.2 text-[7px] font-black rounded uppercase tracking-wider">Official Response</span>
                            <span className="text-[9px] text-slate-500 font-mono italic">{rev.response.timestamp}</span>
                          </div>
                          <p className="text-slate-300 italic mt-1 font-medium bg-black/20 p-2.5 rounded border border-white/5 text-[11.5px]">{rev.response.comment}</p>
                        </div>
                      </div>
                    ) : (
                      (isSeller || isAdmin) && (
                        <div className="space-y-2">
                          <div className="relative flex items-center bg-slate-950 p-1.5 rounded-lg border border-white/5 focus-within:border-[#F4631E]/30">
                            <input 
                              type="text"
                              placeholder="Submit merchant reply official statement..."
                              value={sellerReplyText[rev.id] || ''}
                              onChange={(e) => setSellerReplyText(prev => ({ ...prev, [rev.id]: e.target.value }))}
                              className="bg-transparent text-xs text-white outline-none placeholder-slate-500 flex-1 px-2 py-1 font-medium"
                            />
                            <button 
                              onClick={() => handleSellerReply(rev.id)}
                              className="p-1.5 text-[#F4631E] hover:text-[#F4631E]-light cursor-pointer"
                              title="Submit Response"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Actions buttons panel */}
                  {isAdmin && (
                    <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/[0.02] flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] text-slate-500 font-mono">Platform ID: {rev.id}</span>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {rev.status.toLowerCase() !== 'published' && (
                          <button 
                            onClick={() => approveReview(rev.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                        )}
                        <button 
                          onClick={() => startEditing(rev)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        {rev.status.toLowerCase() !== 'hidden' && (
                          <button 
                            onClick={() => toggleReviewStatus(rev.id, 'Hidden')}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <EyeOff className="w-3 h-3" /> Hide
                          </button>
                        )}
                        {rev.status.toLowerCase() !== 'deleted' ? (
                          <button 
                            onClick={() => rejectReview(rev.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Reject
                          </button>
                        ) : (
                          <button 
                            onClick={() => deleteReview(rev.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-red-400 hover:bg-red-600 hover:text-white transition-all text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Erase
                          </button>
                        )}
                        <button 
                          onClick={() => handleRestrictCustomer(rev.user)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[9.5px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          <UserX className="w-3 h-3" /> Lock Privileges
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Sidebar details panel */}
        <div className="space-y-6">
          
          {/* Active focus detail box */}
          <div className="bg-app-card p-5 rounded-xl border border-app-border space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#F4631E]" />
              Interactive Audit Inspector
            </h3>

            {focusedReviewId ? (() => {
              const r = reviews.find(item => item.id === focusedReviewId);
              if (!r) return <p className="text-xs text-slate-400 italic">No focused review context.</p>;

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-950 rounded-lg space-y-2 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-mono">ACTIVE TARGET PROFILE</div>
                    <div className="text-xs font-extrabold text-white">{r.user}</div>
                    <div className="text-[10px] text-slate-400 leading-relaxed font-mono mt-1">
                      Posted via Web Ingress Node · Verified Client Purchase ID: <span className="text-[#F4631E]">ORD-9283-REK</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Internal Moderation Notes (Private)</label>
                    <textarea
                      placeholder="Write custom administrative logs or dispute notes regarding this client action..."
                      value={reviewNotes[r.id] || ''}
                      onChange={(e) => handleSaveNote(r.id, e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#F4631E] min-h-[90px] font-medium"
                    />
                    <div className="flex justify-end">
                      <span className="text-[9px] text-[#F4631E] font-mono font-bold uppercase tracking-wider">Auto-Saved to Local Node Logs</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-lg space-y-3 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">TrustCenter Sync Score</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">Brand reputation impact:</span>
                      <span className={`text-xs font-mono font-bold ${
                        r.status.toLowerCase() === 'published' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {r.status.toLowerCase() === 'published' ? '+5 points' : '-10 points'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">Reputation ledger logs actions in real-time. Approved posts improve merchant overall score index; flagged and deleted spams deduct standing points.</p>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                <Info className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                Select any review from the feed to load detailed administrative audits, private ledger notes, and reputation impact.
              </div>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-app-card p-5 rounded-xl border border-app-border space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F4631E]" />
              Policy Summary
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F4631E] shrink-0 mt-1.5" />
                <span>Any review flagged with score under <strong className="text-white">50</strong> is automatically quarantined and hidden.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F4631E] shrink-0 mt-1.5" />
                <span>Merchant replies are frozen once submitted to prevent multi-thread client disputes.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F4631E] shrink-0 mt-1.5" />
                <span>Removing a valid review results in automated <strong className="text-amber-500">-10</strong> reputation ledger deduction.</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
