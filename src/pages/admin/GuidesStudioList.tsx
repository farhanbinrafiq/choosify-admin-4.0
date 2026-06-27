import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, Search, Filter, ShieldCheck, FileText, LayoutGrid, List,
  Trash2, Edit3, Star, Award, Heart, HelpCircle, Archive, ClipboardList,
  BookOpen, Clock, Tag
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

const defaultGuides: GuideStudioItem[] = [
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

export default function GuidesStudioList() {
  const [guides, setGuides] = useState<GuideStudioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Live" | "Draft" | "Archived">("All");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(CHC_GUIDES_KEY);
    if (cached) {
      try {
        setGuides(JSON.parse(cached));
      } catch (_) {
        setGuides(defaultGuides);
      }
    } else {
      setGuides(defaultGuides);
      localStorage.setItem(CHC_GUIDES_KEY, JSON.stringify(defaultGuides));
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteGuide = (id: string) => {
    const updated = guides.filter((g) => g.id !== id);
    setGuides(updated);
    localStorage.setItem(CHC_GUIDES_KEY, JSON.stringify(updated));
    triggerToast("✓ Buying guide removed from trust index.");
  };

  const filteredGuides = guides.filter((guide) => {
    const matchesSearch = 
      guide.guideTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      guide.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
      guide.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || guide.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="guides-studio-list" className="space-y-6 pb-12 text-left bg-[#F9FAFB] text-[#111827] -m-6 p-6 min-h-screen">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-8 right-8 z-[300] bg-white border border-[#E5E7EB] px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 bg-[#F97316] rounded-full animate-ping" />
            <span className="text-xs font-bold text-[#111827] uppercase tracking-wider">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Container - Pure White with Soft Shadows & Deep Navy / Orange CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#F97316]/10 text-[#F97316] p-1.5 rounded-lg border border-[#F97316]/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#111827] tracking-tight">
              Guide Studio & Editorial CMS
            </h1>
          </div>
          <p className="text-[#6B7280] text-[12px]">
            Build premium product rankings, expert roundups, and authoritative buying guides that establish real trust.
          </p>
        </div>

        <div>
          {/* Accent CTA - Orange */}
          <Link
            id="btn-create-guide"
            to="/dashboard/content-studio/guides/new"
            className="flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Buying Guide
          </Link>
        </div>
      </div>

      {/* Metric Grid - All White Cards with minimal gray boundaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-[#F97316]" /> Active Guides
          </div>
          <div className="text-3xl font-extrabold text-[#111827] mt-2">{guides.length} Roundups</div>
          <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-mono font-bold">
            ● {guides.filter(g => g.status === "Live").length} PUBLISHED LIVE
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#0B1F3B]" /> Total Reviewed Pool
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F3B] mt-2">
            {guides.reduce((acc, curr) => acc + curr.productsReviewed, 0)} Items
          </div>
          <p className="text-[10px] text-[#6B7280] mt-1 font-mono">In-depth benchmark verified</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Editorial Score
          </div>
          <div className="text-3xl font-extrabold text-[#111827] mt-2">100% Vetted</div>
          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1 font-mono font-bold">
            ★ HIGH CONVICTION TRUST
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider font-bold font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#F97316]" /> BD Market Fit
          </div>
          <div className="text-3xl font-extrabold text-[#F97316] mt-2 font-mono">CMS v3.0</div>
          <p className="text-[10px] text-[#6B7280] mt-1 font-mono font-bold">Bangladesh Standards Active</p>
        </div>

      </div>

      {/* Toolbar Container */}
      <div className="bg-white border border-[#E5E7EB] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input - Light */}
        <div className="w-full md:w-96 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center px-3.5 gap-2.5">
          <Search className="w-4 h-4 text-[#6B7280]" />
          <input 
            id="guide-search"
            placeholder="Search guides by title, category, author..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 py-2.5 text-xs bg-transparent outline-none text-[#111827] placeholder-[#9CA3AF]" 
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          <div className="flex gap-1 bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl">
            {(["All", "Live", "Draft", "Archived"] as const).map((st) => (
              <button
                key={st}
                id={`btn-filter-${st.toLowerCase()}`}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === st 
                    ? "bg-[#0B1F3B] text-white" 
                    : "text-[#6B7280] hover:text-[#111827] hover:bg-slate-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-6 bg-[#E5E7EB]" />

          {/* Layout Switcher buttons */}
          <div className="flex p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl gap-0.5">
            <button 
              id="layout-grid"
              onClick={() => setViewLayout("grid")}
              className={`p-1.5 rounded-lg transition-colors ${viewLayout === "grid" ? "bg-white text-[#0B1F3B] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button 
              id="layout-list"
              onClick={() => setViewLayout("list")}
              className={`p-1.5 rounded-lg transition-colors ${viewLayout === "list" ? "bg-white text-[#0B1F3B] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Main content grid/list */}
      <AnimatePresence mode="popLayout">
        {filteredGuides.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-[#E5E7EB] rounded-3xl p-16 text-center text-[#6B7280] flex flex-col items-center justify-center gap-4 shadow-sm"
          >
            <BookOpen className="w-12 h-12 text-[#9CA3AF] animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#111827] uppercase tracking-wider">No Editorial Guides Found</h4>
              <p className="text-[11px] text-[#6B7280] max-w-sm">
                No buying guides match your current search queries. Hit the "Create Buying Guide" button to write a new one.
              </p>
            </div>
          </motion.div>
        ) : viewLayout === "grid" ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredGuides.map((guide) => (
              <div 
                key={guide.id}
                id={`guide-card-${guide.id}`}
                className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:border-[#F97316]/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative text-left"
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className={`text-[8px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase border ${
                    guide.status === "Live"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : guide.status === "Draft"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]"
                  }`}>
                    {guide.status}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Category & Title */}
                  <div className="text-left space-y-1 mt-2">
                    <span className="text-[9px] font-mono text-[#F97316] font-bold uppercase tracking-wider block">
                      {guide.category}
                    </span>
                    <h3 className="font-extrabold text-[#111827] text-sm group-hover:text-[#F97316] transition-colors tracking-tight line-clamp-2 pr-12">
                      {guide.guideTitle}
                    </h3>
                  </div>

                  {/* Winner / Budget Pick display */}
                  <div className="space-y-2 bg-[#F9FAFB] border border-[#E5E7EB] p-3 rounded-xl">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#6B7280] font-mono font-semibold">🏆 Overall #1 Pick:</span>
                      <span className="font-bold text-[#111827] truncate max-w-[140px]">{guide.winnerProduct}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] border-t border-[#E5E7EB] pt-1.5 mt-1.5">
                      <span className="text-[#6B7280] font-mono font-semibold">💼 Best Budget Pick:</span>
                      <span className="font-semibold text-[#111827] truncate max-w-[140px]">{guide.bestBudgetPick}</span>
                    </div>
                  </div>

                  {/* Author profile row */}
                  <div className="flex items-center gap-3 bg-[#F9FAFB] border border-[#E5E7EB]/60 p-2.5 rounded-xl">
                    <img 
                      src={guide.authorAvatar} 
                      alt={guide.authorName}
                      className="w-8 h-8 rounded-full border border-[#E5E7EB] object-cover"
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-[#111827] flex items-center gap-1">
                        {guide.authorName}
                        {guide.verifiedContributor && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <div className="text-[8px] font-bold text-[#0B1F3B] tracking-wide font-mono uppercase">
                        {guide.contributorBadgeLevel}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <span className="text-[9px] font-mono text-[#6B7280] block">Reviewed</span>
                      <span className="text-xs font-extrabold text-[#111827]">{guide.productsReviewed} Picks</span>
                    </div>
                  </div>
                </div>

                {/* Edit Controls - Primary Navy CTA */}
                <div className="flex gap-2 border-t border-[#E5E7EB] pt-4 mt-4">
                  <Link 
                    id={`btn-edit-${guide.id}`}
                    to={`/dashboard/content-studio/guides/${guide.id}/edit`}
                    className="flex-1 py-2.5 bg-[#0B1F3B] hover:bg-[#1E3A5F] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editorial Editor
                  </Link>
                  <button 
                    id={`btn-delete-${guide.id}`}
                    onClick={() => setConfirmingId(guide.id)}
                    className="p-2.5 bg-[#F9FAFB] hover:bg-rose-50 border border-[#E5E7EB] hover:border-rose-200 text-[#6B7280] hover:text-rose-600 rounded-xl transition-colors"
                    title="Delete Guide Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {confirmingId === guide.id && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2">
                    <span className="text-[10px] font-black text-red-600">Are you sure? This cannot be undone.</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { handleDeleteGuide(guide.id); setConfirmingId(null); }}
                        className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-colors"
                      >Confirm</button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg hover:bg-gray-200 transition-colors"
                      >Cancel</button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">Guide title & category</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">Author Expert</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">🏆 overall #1 Winner</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">Reviewed items</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">Audience Type</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">Status</th>
                  <th className="p-4.5 text-[9px] font-bold uppercase text-[#6B7280] tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/60">
                {filteredGuides.map((guide) => (
                  <tr key={guide.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4.5">
                      <div className="text-xs font-bold text-[#111827] tracking-tight leading-snug max-w-xs block">
                        {guide.guideTitle}
                      </div>
                      <div className="text-[9px] font-bold text-[#F97316] font-mono uppercase tracking-wider mt-1">
                        {guide.category}
                      </div>
                    </td>
                    <td className="p-4.5">
                      <div className="flex items-center gap-2">
                        <img 
                          src={guide.authorAvatar} 
                          alt={guide.authorName}
                          className="w-6 h-6 rounded-full border border-[#E5E7EB]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#111827]">{guide.authorName}</p>
                          <p className="text-[8px] font-black text-emerald-600 uppercase font-mono">{guide.contributorBadgeLevel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4.5 font-bold text-[#0B1F3B] text-xs max-w-[150px] truncate">
                      {guide.winnerProduct}
                    </td>
                    <td className="p-4.5 font-mono text-xs text-[#111827]">{guide.productsReviewed} Picks</td>
                    <td className="p-4.5 text-xs text-[#6B7280]">{guide.audienceType}</td>
                    <td className="p-4.5">
                      <span className={`px-2.5 py-0.5 text-[8px] font-bold tracking-wider uppercase rounded border ${
                        guide.status === "Live" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {guide.status}
                      </span>
                    </td>
                    <td className="p-4.5 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex justify-end gap-2">
                          <Link 
                            to={`/dashboard/content-studio/guides/${guide.id}/edit`}
                            className="p-1.5 bg-slate-100 hover:bg-[#0B1F3B] text-[#0B1F3B] hover:text-white rounded-lg transition-colors border border-[#E5E7EB]"
                            title="Edit Guide"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                          <button 
                            onClick={() => setConfirmingId(guide.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-[#6B7280] hover:text-rose-600 rounded-lg transition-colors border border-[#E5E7EB]"
                            title="Delete Guide"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {confirmingId === guide.id && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-xl flex flex-col items-end gap-1.5 z-10">
                            <span className="text-[9px] font-black text-red-600">Delete this guide?</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { handleDeleteGuide(guide.id); setConfirmingId(null); }}
                                className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded hover:bg-red-600 transition-colors"
                              >Confirm</button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-[8px] font-black uppercase rounded hover:bg-gray-200 transition-colors"
                              >Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guide Info - Clean white border message */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl flex items-center gap-4 text-left shadow-sm">
        <HelpCircle className="w-10 h-10 text-[#F97316] shrink-0" />
        <div className="space-y-1">
          <h4 className="text-[13px] font-bold text-[#111827] uppercase tracking-wider">Trust Engine Integration Rules</h4>
          <p className="text-[11px] text-[#6B7280] leading-relaxed max-w-4xl">
            Guides in Choosify.bd are rendered on public pages with live-synced affiliate deals and user profile rankings. When editing rankings inside Guide Studio, changes are persisted immediately and will bubble up scores inside the consumer recommendations query interface.
          </p>
        </div>
      </div>
    </div>
  );
}
