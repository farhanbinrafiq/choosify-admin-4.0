import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Check, 
  X, 
  AlertTriangle, 
  Search, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Tag, 
  Sparkles, 
  CheckSquare, 
  Square,
  AlertCircle
} from 'lucide-react';

export interface Submission {
  id: string;
  title: string;
  brand: string;
  category: string;
  description: string;
  price: number; // in BDT
  originalPrice: number; // in BDT
  discount: number; // percentage
  imageUrl: string; 
  productType: 'standard' | 'deal' | 'creator';
  promoCode?: string;
  validUntil?: string; // ISO date string
  socialProof?: string; // e.g. "Highly active on BD Tech community Facebook group"
  submittedAt: string; // ISO date string
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  submitterName: string;
  submitterEmail: string;
  rejectionReason?: string;
  adminNotes?: string;
}

export default function CommunitySubmissions() {
  // Initialize with 6 realistic product submission entries from Bangladeshi consumers
  const [submissions, setSubmissions] = useState<Submission[]>([
    {
      id: 'sub-001',
      title: 'MSI G241V E2 23.8" IPS Gaming Monitor',
      brand: 'MSI',
      category: 'Electronics',
      description: 'Excellent budget IPS monitor with 75Hz refresh rate and wide viewing angles. Highly sought after by students and entry level gamers in BD.',
      price: 16500,
      originalPrice: 18500,
      discount: 10,
      imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=150&auto=format&fit=crop&q=60',
      productType: 'deal',
      promoCode: 'MSIMONITORBD',
      validUntil: '2026-07-15T23:59:59.000Z',
      socialProof: 'Most recommended budget IPS monitor under 20k BDT in PC Builders Bangladesh.',
      submittedAt: '2026-06-20T10:15:00.000Z',
      status: 'pending',
      submitterName: 'Farhan bin Rafiq',
      submitterEmail: 'farhanbinrafiq.me@gmail.com'
    },
    {
      id: 'sub-002',
      title: 'Baseus GaN5 Pro 65W Fast Charger',
      brand: 'Baseus',
      category: 'Accessories',
      description: 'Ultra-compact multi-port charger supporting dual USB-C laptops and smartphones simultaneously. Includes high-efficiency smart temperature protection cooling.',
      price: 2400,
      originalPrice: 3200,
      discount: 25,
      imageUrl: 'https://images.unsplash.com/photo-1622445262465-24819af52162?w=150&auto=format&fit=crop&q=60',
      productType: 'standard',
      promoCode: 'BASEUSGAN65',
      validUntil: '2026-08-01T23:59:59.000Z',
      socialProof: 'Voted best dual port traveling charger by members in Deshi Tech Enthusiasts Hub.',
      submittedAt: '2026-06-21T08:30:00.000Z',
      status: 'pending',
      submitterName: 'Rifat Hasan',
      submitterEmail: 'rifat.hasan@yahoo.com'
    },
    {
      id: 'sub-003',
      title: 'Aarong Hand-Embroidered Jamdani Motif Kurta',
      brand: 'Aarong',
      category: 'Fashion',
      description: 'Traditional cotton kurta embellished with fine local artisan hand embroidery mirroring classic Jamdani weave patterns. Perfect summer wear fabric structure.',
      price: 3600,
      originalPrice: 4200,
      discount: 14,
      imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=150&auto=format&fit=crop&q=60',
      productType: 'creator',
      submittedAt: '2026-06-19T14:45:00.000Z',
      status: 'pending',
      submitterName: 'Tahmina Begum',
      submitterEmail: 'tahmina.begum@design.org'
    },
    {
      id: 'sub-004',
      title: 'Anker Soundcore R50i True Wireless Earbuds',
      brand: 'Anker',
      category: 'Gadget',
      description: 'Signature bass booster earbuds with customized app EQ support, 30-hour battery playtime duration and IPX5 rated sweat resistance framework.',
      price: 1850,
      originalPrice: 2200,
      discount: 15,
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150&auto=format&fit=crop&q=60',
      productType: 'standard',
      socialProof: 'Over 1,200 organic ratings and high praise in Bangladesh Gadget Buyers community.',
      submittedAt: '2026-06-18T09:00:00.000Z',
      status: 'approved',
      submitterName: 'Sifat Tanvir',
      submitterEmail: 'sifat.tanvir@gmail.com',
      adminNotes: 'Verified dealer listing and catalog pricing is aligned.'
    },
    {
      id: 'sub-005',
      title: 'RGB Light-up Copycat Pro Gaming Mouse',
      brand: 'Unbranded',
      category: 'Electronics',
      description: 'Extremely cheap plastic counterfeit gaming mouse falsely labeled as Razer sensor technology to mislead general buyers on public classified lists.',
      price: 450,
      originalPrice: 1500,
      discount: 70,
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=150&auto=format&fit=crop&q=60',
      productType: 'deal',
      submittedAt: '2026-06-15T11:20:00.000Z',
      status: 'rejected',
      submitterName: 'Spam Bot Detection',
      submitterEmail: 'moderator-bot@choosify.bd',
      rejectionReason: 'Counterfeit unbranded clone hardware violating listing policies.',
      adminNotes: 'Flagged by automated heuristics.'
    },
    {
      id: 'sub-006',
      title: 'Super Ultra Cheap Genuine Apple Adapter',
      brand: 'Apple Cloners',
      category: 'Accessories',
      description: 'Claimed to be original OEM standard block adapter costing a fraction of real shop prices, shipped in blank generic static bags from unverified sources.',
      price: 600,
      originalPrice: 2500,
      discount: 76,
      imageUrl: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=150&auto=format&fit=crop&q=60',
      productType: 'standard',
      socialProof: 'Highly toxic reviews, reported multiple times as scam clones.',
      submittedAt: '2026-06-14T19:40:00.000Z',
      status: 'flagged',
      submitterName: 'Nadia Akter',
      submitterEmail: 'nadia.akter@hotmail.com',
      adminNotes: 'Highly suspect. Restrict seller registration mapping immediately.'
    }
  ]);

  // UI state managers
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'pending' | 'approved' | 'rejected' | 'flagged'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Track open rejection textareas for individual submissions
  const [rejectionIds, setRejectionIds] = useState<Record<string, string>>({});
  const [rejectingBoxId, setRejectingBoxId] = useState<string | null>(null);
  const [showBulkRejectForm, setShowBulkRejectForm] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("Doesn't comply with Customer Favorites premium catalog layout guidelines");

  // Admin notes inline saving
  const [adminNotesStates, setAdminNotesStates] = useState<Record<string, string>>({});

  // Dynamic Stats Row computed from state
  const totalSubmissions = submissions.length;
  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  // Filter and Search Memo
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesSearch = 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.brand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = activeTab === 'All' || s.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [submissions, searchTerm, activeTab]);

  // Handlers
  const handleApprove = (id: string) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
  };

  const handleRejectInit = (id: string) => {
    setRejectingBoxId(prev => id === prev ? null : id);
  };

  const handleRejectConfirm = (id: string) => {
    const reason = rejectionIds[id]?.trim() || 'Declined due to failure in catalog quality standards verification';
    setSubmissions(prev => prev.map(s => s.id === id ? { 
      ...s, 
      status: 'rejected', 
      rejectionReason: reason 
    } : s));
    setRejectingBoxId(null);
  };

  const handleFlag = (id: string) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'flagged' } : s));
  };

  const handleUpdateAdminNotes = (id: string, notes: string) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, adminNotes: notes } : s));
  };

  // Bulk execution
  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setSubmissions(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, status: 'approved' } : s));
    setSelectedIds([]);
  };

  const handleBulkReject = (reason: string) => {
    if (selectedIds.length === 0) return;
    setSubmissions(prev => prev.map(s => selectedIds.includes(s.id) ? { 
      ...s, 
      status: 'rejected', 
      rejectionReason: reason || 'Declined globally via supervisor dashboard review' 
    } : s));
    setSelectedIds([]);
  };

  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredSubmissions.map(s => s.id);
    const allSelected = currentFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !currentFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...currentFilteredIds])]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // CSV Generator plain JS Blob
  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Brand', 'Category', 'Price (BDT)', 'Original Price (BDT)', 'Discount %', 'Type', 'Submitter', 'Email', 'Status', 'Submitted At'];
    const rows = filteredSubmissions.map(s => [
      s.id,
      s.title,
      s.brand,
      s.category,
      s.price,
      s.originalPrice,
      s.discount,
      s.productType,
      s.submitterName,
      s.submitterEmail,
      s.status,
      new Date(s.submittedAt).toISOString().slice(0, 10)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `community_favorites_submissions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFormattedDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 text-[#1A1A2E] bg-gray-50/50 min-h-screen p-1 text-left">
      
      {/* Header and Path */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[9.5px] font-black uppercase tracking-widest text-[#F97316] block mb-1">Consumer Moderation Logs</span>
          <h1 className="text-xl font-bold text-[#1A1A2E] tracking-tight">Community Product Submissions</h1>
          <p className="text-gray-500 text-[11.5px]">Approve, deny or flag products flagged for Customer Favorites lists.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#1A1A2E]" /> Export CSV
          </button>
        </div>
      </div>

      {/* Dynamic Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Submissions', val: totalSubmissions, badge: 'Platform Volume', subtitle: 'All entries recorded', color: 'border-l-blue-600 text-blue-600' },
          { label: 'Pending Review', val: pendingCount, badge: 'In Queue', subtitle: 'Pending action', color: 'border-l-amber-600 text-amber-600' },
          { label: 'Approved This Week', val: approvedCount, badge: 'Live Favorites', subtitle: 'Accepted submissions', color: 'border-l-green-600 text-green-600' },
          { label: 'Rejected Entries', val: rejectedCount, badge: 'Policy Decline', subtitle: 'Spam/Irrelevant matches', color: 'border-l-rose-600 text-rose-600' },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 rounded-xl border border-gray-150 border-l-[4px] shadow-sm flex flex-col justify-between">
             <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-2xl font-bold text-[#1A1A2E] leading-none mb-2">{s.val}</div>
             </div>
             <div className="flex items-center justify-between border-t border-gray-50 pt-2 text-[10px]">
                <span className="text-gray-400">{s.subtitle}</span>
                <span className={`font-black uppercase tracking-tighter ${s.color}`}>{s.badge}</span>
             </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Tabs style filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto scrollbar-none">
          {[
            { key: 'All', label: 'All Items' },
            { key: 'pending', label: 'Pending Review' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'flagged', label: 'Flagged' }
          ].map((tab) => {
            const count = tab.key === 'All' 
              ? submissions.length 
              : submissions.filter(s => s.status === tab.key).length;
            
            return (
              <button 
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key as any);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-1.5 text-[10.5px] font-bold rounded-lg transition-all ${
                  activeTab === tab.key 
                    ? 'bg-[#1A1A2E] text-white' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label} <span className="opacity-60 font-medium ml-0.5">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Searching text */}
        <div className="relative w-full lg:w-72 bg-[#F8F9FA] border border-gray-200 rounded-lg flex items-center px-3 py-1.5 gap-2 focus-within:border-[#F97316] transition-colors">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or brand..."
            className="w-full bg-transparent outline-none text-[12px] text-[#1A1A2E]"
          />
        </div>

      </div>

      {/* Bulk Action Panel floating */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="bg-[#1A1A2E] p-4 rounded-xl shadow-lg flex items-center justify-between text-white animate-fade-in">
            <div className="flex items-center gap-2.5 text-xs">
              <CheckSquare className="w-4 h-4 text-[#F97316]" />
              <span className="font-bold">
                Bulk Actions: <strong className="text-[#F97316] font-extrabold">{selectedIds.length}</strong> items selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] uppercase tracking-wider rounded-lg border-none shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve Selected
              </button>
              <button
                onClick={() => setShowBulkRejectForm(prev => !prev)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] uppercase tracking-wider rounded-lg border-none shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Reject Selected
              </button>
              <button
                onClick={() => { setSelectedIds([]); setShowBulkRejectForm(false); }}
                className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
          {showBulkRejectForm && (
            <div className="bg-[#1F1F35] p-4 rounded-xl border border-rose-500/30 text-white flex flex-col gap-3 shadow-2xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Specify Bulk Rejection Reason</span>
                <span className="text-[9px] text-slate-400">All selected {selectedIds.length} submissions will be rejected with this description:</span>
              </div>
              <textarea
                value={bulkRejectReason}
                onChange={e => setBulkRejectReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold outline-none focus:border-rose-500 text-slate-200"
                placeholder="Enter rejection reason..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    handleBulkReject(bulkRejectReason);
                    setShowBulkRejectForm(false);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-colors"
                >Confirm Reject ({selectedIds.length})</button>
                <button
                  onClick={() => setShowBulkRejectForm(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submissions queue cards container */}
      <div className="space-y-4">
        
        {/* Simple Select-All Header if entries exist */}
        {filteredSubmissions.length > 0 && (
          <div className="flex items-center px-4 py-2 bg-white/40 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-wider justify-between border border-gray-100">
             <button 
               onClick={handleToggleSelectAll}
               className="flex items-center gap-2 bg-transparent border-none text-gray-500 hover:text-gray-900 cursor-pointer font-extrabold"
             >
                {filteredSubmissions.every(idObj => selectedIds.includes(idObj.id)) ? (
                  <CheckSquare className="w-4 h-4 text-[#1A1A2E]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>Toggle Current Page Batch Selection</span>
             </button>
             <span>Displaying {filteredSubmissions.length} user submissions</span>
          </div>
        )}

        {/* Dynamic Card Iteration */}
        {filteredSubmissions.map((sub) => {
          const isSelected = selectedIds.includes(sub.id);
          const isExpanded = expandedId === sub.id;
          const isFlagged = sub.status === 'flagged';
          const rejectionText = rejectionIds[sub.id] || '';

          return (
            <div 
              key={sub.id}
              className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                isFlagged 
                  ? 'border-red-500 ring-1 ring-red-100' 
                  : isSelected 
                    ? 'border-[#F97316] bg-amber-50/5' 
                    : 'border-gray-150 hover:border-gray-300'
              }`}
            >
              
              {/* Primary Header Row card */}
              <div className="p-5 flex flex-col md:flex-row items-start gap-4 md:items-center justify-between">
                
                {/* Left product details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  
                  {/* Row selector checkmark */}
                  <button 
                    onClick={() => handleToggleSelectRow(sub.id)}
                    className="mt-2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer self-start"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#F97316]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>

                  {/* Image container */}
                  <div className="relative shrink-0">
                    <img 
                      src={sub.imageUrl} 
                      referrerPolicy="no-referrer"
                      alt={sub.title}
                      className="w-20 h-20 object-cover rounded-xl border border-gray-100 bg-slate-50"
                    />
                    <span className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur text-white text-[8px] px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">
                      {sub.productType}
                    </span>
                  </div>

                  {/* Texts details content */}
                  <div className="space-y-1 text-left flex-1 min-w-0">
                    
                    {/* Brand + Category flag */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{sub.brand}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-[9px] font-black uppercase text-gray-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {sub.category}
                      </span>
                    </div>

                    {/* Submission Core Title */}
                    <h3 className="text-sm font-bold text-[#1A1A2E] leading-snug tracking-tight truncate">
                      {sub.title}
                    </h3>

                    {/* Price structure + Discount Tag badge */}
                    <div className="flex items-center gap-2">
                       <span className="text-[12px] font-black text-[#1A1A2E]">৳ {sub.price.toLocaleString()}</span>
                       <span className="text-[10px] text-gray-400 line-through">৳ {sub.originalPrice.toLocaleString()}</span>
                       <span className="text-[9px] bg-amber-50 text-[#F97316] font-black px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">
                         {sub.discount}% OFF
                       </span>
                    </div>

                    {/* Truncated description helper */}
                    <p className="text-[11.5px] text-gray-500 leading-relaxed line-clamp-2 italic max-w-2xl">
                      "{sub.description}"
                    </p>

                    {/* Social proof optional citation */}
                    {sub.socialProof && (
                      <div className="text-[10px] text-gray-400 italic flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#F97316] shrink-0" />
                        <span>* "{sub.socialProof}"</span>
                      </div>
                    )}

                    {/* Creator / Submitter footprint */}
                    <div className="text-[9.5px] text-gray-400 font-bold uppercase tracking-widest pt-1">
                      Submitted by <strong className="text-gray-600">{sub.submitterName}</strong> ({sub.submitterEmail}) • {getFormattedDate(sub.submittedAt)}
                    </div>

                  </div>

                </div>

                {/* Right side operational details and badges actions */}
                <div className="flex flex-col items-end gap-3 shrink-0 self-center md:self-auto w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  
                  {/* Status Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter block text-center ${
                    sub.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    sub.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                    sub.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                    'bg-purple-50 text-purple-700 border-purple-100'
                  }`}>
                    {sub.status}
                  </span>

                  {/* Actions matrix */}
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    
                    {sub.status !== 'approved' && (
                      <button 
                        onClick={() => handleApprove(sub.id)}
                        className="p-1 px-2 text-[10px] font-bold text-center uppercase tracking-wider text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100/50 rounded cursor-pointer border border-green-200 transition-all active:scale-95"
                        title="Approve Submission"
                      >
                        Approve
                      </button>
                    )}

                    {sub.status !== 'rejected' && (
                      <button 
                        onClick={() => handleRejectInit(sub.id)}
                        className="p-1 px-2 text-[10px] font-bold text-center uppercase tracking-wider text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/50 rounded cursor-pointer border border-red-200 transition-all active:scale-95"
                        title="Decline Submission"
                      >
                        Reject
                      </button>
                    )}

                    {sub.status !== 'flagged' && (
                      <button 
                        onClick={() => handleFlag(sub.id)}
                        className="p-1 px-2 text-[10px] font-bold text-center uppercase tracking-wider text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100/50 rounded cursor-pointer border border-amber-200 transition-all active:scale-95"
                        title="Flag Submission"
                      >
                        Flag
                      </button>
                    )}

                    <button 
                      onClick={() => setExpandedId(prev => prev === sub.id ? null : sub.id)}
                      className="p-1 px-2 text-[10px] font-bold text-center text-gray-500 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1 transition-all"
                    >
                      <span>{isExpanded ? 'Hide' : 'View Detail'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                  </div>

                </div>

              </div>

              {/* Inline Reason Input overlay */}
              {rejectingBoxId === sub.id && (
                <div className="bg-rose-50/50 p-4 border-t border-red-100 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs animate-fade-in">
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-red-600 block">Feedback rejection reason context:</label>
                    <input 
                      type="text"
                      placeholder="e.g. Broken listing page, low merchant score, duplicate entries suspected..."
                      value={rejectionText}
                      onChange={(e) => setRejectionIds(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      className="w-full bg-white border border-red-200 rounded-lg p-2 text-xs focus:outline-none focus:border-red-500 text-gray-800 font-medium"
                    />
                  </div>
                  <div className="flex gap-2 self-end shrink-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => setRejectingBoxId(null)}
                      className="px-2.5 py-1.5 text-[10px] font-bold uppercase text-gray-500 rounded hover:bg-gray-150 bg-white"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleRejectConfirm(sub.id)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase rounded-lg border-none cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Detailed drawer section with state elements */}
              {isExpanded && (
                <div className="border-t border-gray-150 p-5 bg-slate-50/40 text-xs space-y-4 text-left animate-slide-in">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Item parameters & descriptive block */}
                    <div className="space-y-3">
                      
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Full Description Context</span>
                        <p className="text-[12px] bg-white border border-gray-100 rounded-lg p-3 text-gray-700 leading-relaxed font-medium">
                          {sub.description}
                        </p>
                      </div>

                      {/* Display rejection feedback history if present */}
                      {sub.rejectionReason && (
                        <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-[11px] text-red-700 font-medium">
                           <strong className="uppercase font-extrabold tracking-wider block text-[9.5px] text-red-500 mb-0.5">Prior Rejection Reason</strong>
                           {sub.rejectionReason}
                        </div>
                      )}

                      {/* Code coupon, validity parameters */}
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                         <div className="bg-white p-2 rounded-lg border border-gray-150">
                            <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest block">Promo Coupon Code</span>
                            <span className="font-mono font-bold text-[#F97316]">
                              {sub.promoCode || 'NO PROMO APPLIES'}
                            </span>
                         </div>
                         <div className="bg-white p-2 rounded-lg border border-gray-150">
                            <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest block">Valid Until</span>
                            <span className="text-gray-700 font-mono font-bold">
                              {sub.validUntil ? getFormattedDate(sub.validUntil) : 'INDEFINITE'}
                            </span>
                         </div>
                      </div>

                    </div>

                    {/* Admin internals ledger note section */}
                    <div className="space-y-3 flex flex-col justify-between">
                      
                      <div className="space-y-1 flex-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Internal Admin Notes</span>
                        <textarea 
                          placeholder="Write verification audit markers, courier checks or warehouse logistics constraints updates..."
                          value={adminNotesStates[sub.id] !== undefined ? adminNotesStates[sub.id] : (sub.adminNotes || '')}
                          onChange={(e) => setAdminNotesStates(prev => ({ ...prev, [sub.id]: e.target.value }))}
                          rows={3}
                          className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs outline-none focus:border-[#F97316] text-[#1A1A2E] font-medium resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 text-right pt-2 border-t border-gray-100">
                        <button
                          onClick={() => {
                            const noteVal = adminNotesStates[sub.id] !== undefined 
                              ? adminNotesStates[sub.id] 
                              : (sub.adminNotes || '');
                            handleUpdateAdminNotes(sub.id, noteVal);
                            alert("Internal admin audit notes mapped for persistence successfully.");
                          }}
                          className="px-3 py-1.5 bg-[#1A1A2E] hover:bg-indigo-950 text-white text-[10px] uppercase font-bold tracking-wider rounded-md border-none cursor-pointer transition-colors"
                        >
                          Save Admin Note
                        </button>
                      </div>

                    </div>

                  </div>

                </div>
              )}

            </div>
          );
        })}

        {filteredSubmissions.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-xs text-gray-400 italic">
            No community submissions record was found matching selected tab filters parameters.
          </div>
        )}

      </div>

    </div>
  );
}
