import React, { useState, useEffect } from "react";
import { 
  Plus, Search, Filter, ShieldCheck, FileText, LayoutGrid, List,
  Trash2, Edit3, Star, Award, Heart, HelpCircle, Archive, ClipboardList,
  BookOpen, Clock, Tag, ArrowLeft, Save, Sparkles, CheckCircle, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const CHC_GUIDES_KEY = "choosify_guides_studio_list";

export interface GuideStudioItem {
  id: string;
  guideTitle: string;
  slug: string;
  category: string;
  status: "Draft" | "Live" | "Archived";
  publishDate: string;
  readTime: string;
  audienceType: string;
  authorName: string;
  authorAvatar: string;
  verifiedContributor: boolean;
  contributorBadgeLevel: string;
  winnerProduct: string;
  bestBudgetPick: string;
  productsReviewed: number;
  lastUpdated: string;
}

interface GuideStudioCMSProps {
  mode?: "embedded" | "standalone";
  entity?: "creator" | "admin";
  authorName?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  guides?: GuideStudioItem[];
  onChange?: (updated: GuideStudioItem[]) => void;
}

export default function GuideStudioCMS({
  mode = "embedded",
  entity = "creator",
  authorName = "Rifat Hasan",
  authorAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256",
  authorVerified = true,
  guides: propGuides,
  onChange
}: GuideStudioCMSProps) {
  const [localGuides, setLocalGuides] = useState<GuideStudioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Live" | "Draft" | "Archived">("All");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("list");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Editing state
  const [editingGuide, setEditingGuide] = useState<GuideStudioItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Traditional Wear");
  const [formStatus, setFormStatus] = useState<"Draft" | "Live" | "Archived">("Draft");
  const [formReadTime, setFormReadTime] = useState("5m read");
  const [formAudience, setFormAudience] = useState("General Buyers & Wedding Seekers");
  const [formWinner, setFormWinner] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formProductsReviewed, setFormProductsReviewed] = useState(5);

  const categories = [
    "Traditional Wear",
    "Traditional Fabrics",
    "Premium Wear",
    "Heritage Wear",
    "Mobile Phones",
    "Audio Equipment",
    "Laptops & Computing"
  ];

  // Helper load
  const loadGuides = () => {
    const cached = localStorage.getItem(CHC_GUIDES_KEY);
    let allGuides: GuideStudioItem[] = [];
    if (cached) {
      try {
        allGuides = JSON.parse(cached);
      } catch (_) {
        allGuides = [];
      }
    }
    
    // Fallback if empty and prop is available
    if (allGuides.length === 0 && propGuides && propGuides.length > 0) {
      allGuides = propGuides;
      localStorage.setItem(CHC_GUIDES_KEY, JSON.stringify(allGuides));
    }

    setLocalGuides(allGuides);
  };

  useEffect(() => {
    loadGuides();
  }, [propGuides]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync back helper
  const syncGuides = (newGuides: GuideStudioItem[]) => {
    localStorage.setItem(CHC_GUIDES_KEY, JSON.stringify(newGuides));
    setLocalGuides(newGuides);
    if (onChange) {
      onChange(newGuides);
    }
  };

  // Filter to show only guides belonging to CURRENT creator
  const creatorGuides = localGuides.filter(
    (g) => g.authorName.toLowerCase() === authorName.toLowerCase()
  );

  const filteredGuides = creatorGuides.filter((guide) => {
    const matchesSearch = 
      guide.guideTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      guide.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || guide.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteGuide = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}" from your portfolio?`)) return;
    const updated = localGuides.filter((g) => g.id !== id);
    syncGuides(updated);
    triggerToast("✓ Guide removed from your trust index portfolio.");
  };

  const handleOpenEdit = (guide: GuideStudioItem) => {
    setEditingGuide(guide);
    setIsCreatingNew(false);
    setFormTitle(guide.guideTitle);
    setFormCategory(guide.category);
    setFormStatus(guide.status);
    setFormReadTime(guide.readTime);
    setFormAudience(guide.audienceType);
    setFormWinner(guide.winnerProduct);
    setFormBudget(guide.bestBudgetPick);
    setFormProductsReviewed(guide.productsReviewed);
  };

  const handleOpenCreate = () => {
    setEditingGuide(null);
    setIsCreatingNew(true);
    setFormTitle("");
    setFormCategory("Traditional Wear");
    setFormStatus("Draft");
    setFormReadTime("6m read");
    setFormAudience("General Buyers & Saree Lovers");
    setFormWinner("");
    setFormBudget("");
    setFormProductsReviewed(5);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Please provide a guide title");
      return;
    }

    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    if (isCreatingNew) {
      const newId = `GUIDE-${Math.floor(100 + Math.random() * 900)}`;
      const newGuide: GuideStudioItem = {
        id: newId,
        guideTitle: formTitle.toUpperCase(),
        slug: formTitle.toLowerCase().replace(/\s+/g, "-"),
        category: formCategory,
        status: formStatus,
        publishDate: formattedDate,
        readTime: formReadTime,
        audienceType: formAudience,
        authorName: authorName,
        authorAvatar: authorAvatar,
        verifiedContributor: authorVerified,
        contributorBadgeLevel: authorVerified ? "VERIFIED EXPERT" : "CONTRIBUTOR",
        winnerProduct: formWinner || "To Be Disclosed",
        bestBudgetPick: formBudget || "To Be Disclosed",
        productsReviewed: formProductsReviewed,
        lastUpdated: formattedDate
      };

      const updated = [newGuide, ...localGuides];
      syncGuides(updated);
      triggerToast("✓ Fresh editorial buying guide deployed successfully.");
    } else if (editingGuide) {
      const updated = localGuides.map((g) => {
        if (g.id === editingGuide.id) {
          return {
            ...g,
            guideTitle: formTitle,
            category: formCategory,
            status: formStatus,
            readTime: formReadTime,
            audienceType: formAudience,
            winnerProduct: formWinner,
            bestBudgetPick: formBudget,
            productsReviewed: formProductsReviewed,
            lastUpdated: formattedDate
          };
        }
        return g;
      });
      syncGuides(updated);
      triggerToast("✓ Guide metadata and editorial choices synchronized.");
    }

    // Reset view
    setEditingGuide(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="space-y-6 text-left font-sans text-slate-200">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-8 right-8 z-[300] bg-zinc-900 border border-white/10 px-5 py-3 rounded-[4px] shadow-2xl flex items-center gap-3 font-sans"
          >
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embedded Title with Accent Border */}
      <div className="border border-white/5 bg-white/[0.01] p-5 rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="bg-[#F4631E]/10 text-[#F4631E] p-1.5 rounded-[2px] border border-[#F4631E]/20">
              <BookOpen className="w-4 h-4" />
            </span>
            <h3 id="gds001" className="text-sm font-bold text-white uppercase tracking-wider">
              Guide Studio & Editorial CMS
            </h3>
          </div>
          <p className="text-[10px] text-app-text-secondary">
            Manage your verified shopping guides, product ranking matrixes, and digital roundups.
          </p>
        </div>

        {!isCreatingNew && !editingGuide && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-[#F4631E]/90 hover:bg-[#F4631E] text-white px-4 py-2 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 font-sans"
          >
            <Plus className="w-3.5 h-3.5" /> Create Buying Guide
          </button>
        )}

        {(isCreatingNew || editingGuide) && (
          <button
            onClick={() => {
              setIsCreatingNew(false);
              setEditingGuide(null);
            }}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer font-sans"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
          </button>
        )}
      </div>

      {/* Editor or List switch */}
      <AnimatePresence mode="wait">
        {isCreatingNew || editingGuide ? (
          <motion.div
            key="workspace-editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl"
          >
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border-b border-white/[0.04] pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#F4631E] uppercase tracking-wider">
                    {isCreatingNew ? "★ Publish New Buying Guide" : "✏ Edit Guide Metadata"}
                  </h4>
                  <p className="text-[10px] text-app-text-secondary mt-0.5">Define category structure, audience filters, and score metrics.</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-[#F4631E]/10 text-[#F4631E] border border-[#F4631E]/20 rounded-[2px] font-black uppercase">
                  {isCreatingNew ? "New Draft" : `Editing: ${editingGuide?.id}`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Guide Title */}
                <div className="space-y-1.5 text-left col-span-2">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Buying Guide Title</span>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="E.G., THE ULTIMATE HANDLOOM SAREE BUYERS MARKET REPORT"
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

                {/* Category Selector */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Sourcing Category</span>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 tag-select rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900 text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Selection */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Portfolio Visibility State</span>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 tag-select rounded-[2px] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  >
                    <option value="Draft" className="bg-slate-900 text-white">Draft (Internal Work-in-progress)</option>
                    <option value="Live" className="bg-slate-900 text-white">Live (Published Publicly on Feed)</option>
                    <option value="Archived" className="bg-slate-900 text-white">Archived (Withdrawn from Market)</option>
                  </select>
                </div>

                {/* Audience filter */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Ideal Consumer Cohort</span>
                  <input
                    type="text"
                    required
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value)}
                    placeholder="E.G., Traditional Brides & Heritage Aficionados"
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

                {/* Read time */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Estimated Read Duration</span>
                  <input
                    type="text"
                    required
                    value={formReadTime}
                    onChange={(e) => setFormReadTime(e.target.value)}
                    placeholder="E.G., 6m read"
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

                {/* Overall Winner */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">🥇 Elite Choice / Overall Winner Pick</span>
                  <input
                    type="text"
                    required
                    value={formWinner}
                    onChange={(e) => setFormWinner(e.target.value)}
                    placeholder="E.G., Aarong Premium Silk Cotton Blend"
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

                {/* Budget pick */}
                <div className="space-y-1.5 text-left">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">💼 Smart Budget Alternative Pick</span>
                  <input
                    type="text"
                    required
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    placeholder="E.G., Rajshahi Loom Saree Outlet Pick"
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

                {/* Products Reviewed */}
                <div className="space-y-1.5 text-left col-span-2 md:col-span-1">
                  <span className="text-[9px] text-app-text-secondary uppercase block font-bold tracking-wider">Total Evaluated Benchmarks Pool</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formProductsReviewed}
                    onChange={(e) => setFormProductsReviewed(parseInt(e.target.value) || 5)}
                    className="w-full bg-[#0B1F3B]/30 border border-white/5 rounded-[2px] px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-[#F4631E]/40"
                  />
                </div>

              </div>

              {/* Action Rows */}
              <div className="border-t border-white/[0.04] pt-4.5 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingGuide(null);
                  }}
                  className="px-4 py-2 border border-white/10 rounded-[2px] text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F4631E] hover:bg-[#ea5616] text-white rounded-[2px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Guide Draft
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="workspace-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Quick Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans flex flex-col justify-between">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Total Creator Guides</span>
                <span className="text-xl font-black text-white block mt-1.5">{creatorGuides.length} Items</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans flex flex-col justify-between">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Live Guides</span>
                <span className="text-xl font-black text-emerald-400 block mt-1.5">
                  {creatorGuides.filter(g => g.status === "Live").length} Published
                </span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans flex flex-col justify-between">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Work-in-progress</span>
                <span className="text-xl font-black text-amber-500 block mt-1.5">
                  {creatorGuides.filter(g => g.status === "Draft").length} Drafts
                </span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans flex flex-col justify-between">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Benchmark Items</span>
                <span className="text-xl font-black text-indigo-400 block mt-1.5">
                  {creatorGuides.reduce((acc, curr) => acc + (curr.productsReviewed || 0), 0)} Picked
                </span>
              </div>
            </div>

            {/* Filter controls */}
            <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Query bar */}
              <div className="w-full md:w-80 bg-white/[0.01] border border-white/5 rounded-[2px] flex items-center px-3 gap-2">
                <Search className="w-3.5 h-3.5 text-app-text-secondary shrink-0" />
                <input 
                  placeholder="Filter guides by title or Category..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-2 text-[11px] bg-transparent outline-none text-white placeholder-slate-500 font-sans" 
                />
              </div>

              {/* Status button array */}
              <div className="flex gap-1.5 flex-wrap">
                {(["All", "Live", "Draft", "Archived"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-[2px] text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      statusFilter === st 
                        ? "bg-[#F4631E] text-white" 
                        : "bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {st}
                  </button>
                ))}

                <div className="w-[1px] h-6 bg-white/5 mx-1" />

                {/* Layout switch */}
                <div className="flex bg-white/5 rounded-[2px] p-0.5">
                  <button
                    onClick={() => setViewLayout("list")}
                    className={`p-1 rounded-[2px] transition-colors ${viewLayout === "list" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                    title="Compact Row Layout"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewLayout("grid")}
                    className={`p-1 rounded-[2px] transition-colors ${viewLayout === "grid" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                    title="Card Grid Layout"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* List / Grid Render */}
            {filteredGuides.length === 0 ? (
              <div className="bg-app-card border border-app-border rounded-[4px] p-12 text-center text-slate-400">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-xs font-bold text-white uppercase tracking-wider">No Guides Found</p>
                <p className="text-[10px] text-app-text-secondary mt-1">There are no buying guides for the current credentials match.</p>
              </div>
            ) : viewLayout === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className="bg-app-card border border-app-border rounded-[4px] p-5 hover:border-white/10 transition-all flex flex-col justify-between group text-left relative"
                  >
                    <span className={`absolute top-4 right-4 text-[8px] font-mono px-2 py-0.5 rounded-[2px] border font-black uppercase ${
                      guide.status === "Live" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : guide.status === "Draft" 
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    }`}>
                      {guide.status}
                    </span>

                    <div className="space-y-4">
                      <div className="space-y-1 text-left">
                        <span className="text-[9px] font-mono text-[#F4631E] font-bold uppercase tracking-wider block">
                          {guide.category} • {guide.readTime}
                        </span>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#F4631E] transition-colors leading-snug tracking-tight pr-12 line-clamp-2">
                          {guide.guideTitle}
                        </h4>
                        <span className="text-[10px] text-app-text-secondary block">Ideal for: {guide.audienceType}</span>
                      </div>

                      {/* Best pick values */}
                      <div className="space-y-1.5 p-3 bg-white/[0.01] border border-white/5 rounded-[2px] font-sans text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-semibold">🏆 Overall #1 Pick:</span>
                          <span className="font-bold text-white truncate max-w-[150px]">{guide.winnerProduct}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-1.5 mt-1.5">
                          <span className="text-slate-400 font-semibold">💼 Best Budget Pick:</span>
                          <span className="font-semibold text-white truncate max-w-[150px]">{guide.bestBudgetPick}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer edit controls */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(guide)}
                        className="flex-1 py-1.5 bg-[#0B1F3B]/40 hover:bg-[#0B1F3B]/80 text-white rounded-[2px] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors border border-white/5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editorial Editor
                      </button>
                      <button
                        onClick={() => handleDeleteGuide(guide.id, guide.guideTitle)}
                        className="p-1.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/20 rounded-[2px] cursor-pointer transition-all"
                        title="Delete Guide Draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider">Guide title & category</th>
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider">🏆 Overall #1 Winner</th>
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider">Reviewed items</th>
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider">Audience Type</th>
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider">Status</th>
                      <th className="p-4 text-[9px] font-bold uppercase text-app-text-secondary tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {filteredGuides.map((guide) => (
                      <tr key={guide.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="p-4">
                          <span className="text-[10px] uppercase font-bold text-app-text-secondary block font-mono">ID: {guide.id}</span>
                          <span className="text-xs font-bold text-white leading-snug block mt-0.5 max-w-sm">
                            {guide.guideTitle}
                          </span>
                          <span className="text-[9px] font-bold text-[#F4631E] block mt-1 font-mono tracking-wider uppercase">
                            {guide.category} • {guide.readTime}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-semibold text-white block">{guide.winnerProduct}</span>
                          <span className="text-[10px] text-indigo-400 block mt-0.5">Budget: {guide.bestBudgetPick}</span>
                        </td>
                        <td className="p-4 text-xs font-mono font-bold text-white">
                          {guide.productsReviewed} Picks
                        </td>
                        <td className="p-4 text-xs text-app-text-secondary">
                          {guide.audienceType}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[8px] font-mono font-black uppercase rounded-[2px] border ${
                            guide.status === "Live" 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}>
                            {guide.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => handleOpenEdit(guide)}
                              className="p-1.5 bg-[#0B1F3B]/30 hover:bg-[#0B1F3B]/80 text-[#F4631E] border border-white/5 hover:border-[#F4631E]/20 rounded-[2px] transition-colors cursor-pointer"
                              title="Edit Guide"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteGuide(guide.id, guide.guideTitle)}
                              className="p-1.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/20 rounded-[2px] transition-colors cursor-pointer"
                              title="Delete Guide"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guide Info Footer - Clean white border message */}
      <div className="bg-app-card border border-app-border p-5 rounded-[4px] flex items-center gap-4 text-left shadow-md">
        <HelpCircle className="w-8 h-8 text-[#F4631E] shrink-0" />
        <div className="space-y-1">
          <h4 className="text-[12px] font-bold text-white uppercase tracking-wider">Expert Buying Guide Sourcing Standards</h4>
          <p className="text-[11px] text-app-text-secondary leading-relaxed max-w-4xl">
            Verified Shopping Guides published on Choosify must be built using real, non-mock hands-on benchmarking. Your recommended winner and budget picks will sync live inside the public Expert Guides feed tab, establishing extreme conviction scores with patrons.
          </p>
        </div>
      </div>

    </div>
  );
}
