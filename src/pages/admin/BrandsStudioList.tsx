import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, Search, Filter, ShieldCheck, TrendingUp, Users, 
  Globe, Eye, Award, Settings, Trash2, Edit3, ArrowUpRight, 
  Heart, Star, HelpCircle, LayoutGrid, List
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Local storage key for persistent brands list in visual brand studio
const COMPILATION_KEY = "choosify_brand_studio_list";

interface BrandStudioItem {
  id: string;
  brandName: string;
  category: string;
  status: "Draft" | "Live" | "Archived";
  followersCount: string;
  loveCount: string;
  trustScore: number;
  initials: string;
  color: string;
  lastUpdated: string;
}

const defaultBrands: BrandStudioItem[] = [
  { id: "1", brandName: "Samsung Bangladesh", category: "Electronics & Mobile", status: "Live", followersCount: "12,400", loveCount: "8,900", trustScore: 4.8, initials: "SB", color: "bg-[#0A2540] text-[#00D4B2]", lastUpdated: "June 12, 2026" },
  { id: "2", brandName: "Aarong", category: "Fashion & Lifestyle", status: "Live", followersCount: "8,920", loveCount: "6,540", trustScore: 4.9, initials: "AB", color: "bg-orange-950 text-orange-400", lastUpdated: "June 13, 2026" },
  { id: "3", brandName: "Walton", category: "Electronics & Home Appliances", status: "Live", followersCount: "7,310", loveCount: "4,120", trustScore: 4.6, initials: "WB", color: "bg-blue-950 text-blue-400", lastUpdated: "June 11, 2026" },
  { id: "4", brandName: "Xiaomi Bangladesh", category: "Mobile & Smart Home", status: "Draft", followersCount: "3,840", loveCount: "2,200", trustScore: 4.7, initials: "XM", color: "bg-amber-950 text-amber-500", lastUpdated: "June 10, 2026" },
  { id: "5", brandName: "Unilever BD", category: "Beauty & FMCG", status: "Live", followersCount: "5,200", loveCount: "3,950", trustScore: 4.8, initials: "UB", color: "bg-green-950 text-green-400", lastUpdated: "June 08, 2026" },
];

export default function BrandsStudioList() {
  const [brands, setBrands] = useState<BrandStudioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Live" | "Draft" | "Archived">("All");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(COMPILATION_KEY);
    if (cached) {
      try {
        setBrands(JSON.parse(cached));
      } catch (_) {
        setBrands(defaultBrands);
      }
    } else {
      setBrands(defaultBrands);
      localStorage.setItem(COMPILATION_KEY, JSON.stringify(defaultBrands));
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteBrand = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this brand visual profile template?")) return;
    const updated = brands.filter((b) => b.id !== id);
    setBrands(updated);
    localStorage.setItem(COMPILATION_KEY, JSON.stringify(updated));
    triggerToast("✓ Brand visual blueprint removed from CMS registry.");
  };

  const filteredBrands = brands.filter((brand) => {
    const matchesSearch = brand.brandName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          brand.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || brand.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 text-left text-slate-100">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-8 right-8 z-[300] bg-slate-900 border border-app-accent/30 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 bg-app-accent rounded-full animate-ping" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-app-card border border-app-border p-6 rounded-[2rem] shadow-xl">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-app-accent/15 text-app-accent p-1.5 rounded-lg border border-app-accent/20">
              <Globe className="w-5 h-5 text-app-accent" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Brand Studio (Visual Brand Profile CMS)
            </h1>
          </div>
          <p className="text-app-text-secondary text-[12px] opacity-80">
            Design pristine brand storefront homepages, reputation meters, and verified ambassador streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/content-studio/brands/new"
            className="flex items-center gap-2 bg-[#F4631E] hover:bg-orange-500 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create Brand Experience
          </Link>
        </div>
      </div>

      {/* Analytics stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-card border border-app-border p-4 rounded-2xl">
          <div className="text-xs text-app-text-secondary uppercase tracking-widest font-semibold">Registered Experiences</div>
          <div className="text-2xl font-black text-white mt-1.5">{brands.length} Brands</div>
          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
            ● {brands.filter(b => b.status === "Live").length} LIVE AT CHOOSIFY.BD
          </p>
        </div>

        <div className="bg-app-card border border-app-border p-4 rounded-2xl">
          <div className="text-xs text-app-text-secondary uppercase tracking-widest font-semibold">Total Followers Pool</div>
          <div className="text-2xl font-black text-[#00D4B2] mt-1.5">39.6K</div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Organic brand fans linked</p>
        </div>

        <div className="bg-app-card border border-app-border p-4 rounded-2xl">
          <div className="text-xs text-app-text-secondary uppercase tracking-widest font-semibold">Reputation Rating Pool</div>
          <div className="text-2xl font-black text-slate-100 mt-1.5 flex items-center gap-1.5">
            4.82 <Star className="w-5 h-5 fill-amber-400 text-amber-400 shrink-0" />
          </div>
          <p className="text-[10px] text-[#00D4B2] mt-1 font-mono">Passed enterprise standard</p>
        </div>

        <div className="bg-app-card border border-app-border p-4 rounded-2xl">
          <div className="text-xs text-app-text-secondary uppercase tracking-widest font-semibold">Sandbox Schema Version</div>
          <div className="text-2xl font-black text-white mt-1.5 font-mono text-app-accent">v2.10.4</div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">Production Engine Synced</p>
        </div>
      </div>

      {/* Filter and layout triggers */}
      <div className="bg-app-card border border-app-border p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="w-full md:w-96 bg-[#05050C] border border-[#202030] rounded-xl flex items-center px-3.5 gap-2.5">
          <Search className="w-4 h-4 text-app-text-secondary" />
          <input 
            placeholder="Search CMS brands by name or segment..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 py-2.5 text-xs bg-transparent outline-none text-white placeholder:text-slate-500" 
          />
        </div>

        {/* Filters and Layout controls */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          <div className="flex gap-1 bg-[#05050C] border border-[#202030] p-1 rounded-xl">
            {(["All", "Live", "Draft", "Archived"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === st 
                    ? "bg-app-accent text-white" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-6 bg-[#202030]" />

          <div className="flex p-1 bg-[#05050C] border border-[#202030] rounded-xl gap-0.5">
            <button 
              onClick={() => setViewLayout("grid")}
              className={`p-1.5 rounded-lg transition-colors ${viewLayout === "grid" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewLayout("list")}
              className={`p-1.5 rounded-lg transition-colors ${viewLayout === "list" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Brands representation container */}
      <AnimatePresence mode="popLayout">
        {filteredBrands.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-app-card border border-app-border rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-4"
          >
            <Globe className="w-12 h-12 text-slate-600 animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">No brand experiences registered</h4>
              <p className="text-[11px] text-slate-500 max-w-sm">No items match your active search terms or category parameters. Try resetting your filter state or create a visual blueprint from template.</p>
            </div>
          </motion.div>
        ) : viewLayout === "grid" ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredBrands.map((brand) => (
              <div 
                key={brand.id}
                className="bg-app-card border border-app-border rounded-2xl p-5 hover:border-app-accent/30 transition-all flex flex-col justify-between group relative"
              >
                {/* Ribbon decoration */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className={`text-[8px] px-2.5 py-0.5 rounded-full font-black tracking-widest uppercase border ${
                    brand.status === "Live"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : brand.status === "Draft"
                      ? "bg-app-accent/15 text-app-accent border-app-accent/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}>
                    {brand.status}
                  </span>
                </div>

                <div className="flex gap-4 items-start">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base uppercase shrink-0 border border-slate-700 ${brand.color}`}>
                    {brand.initials}
                  </div>
                  <div className="space-y-1 text-left">
                    <h3 className="font-bold text-sm text-white group-hover:text-app-accent transition-colors flex items-center gap-1.5 pr-12">
                      {brand.brandName}
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </h3>
                    <p className="text-[10px] text-slate-400">{brand.category}</p>
                    <p className="text-[9px] font-mono text-slate-500">Updated: {brand.lastUpdated}</p>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-3 gap-2 my-4 bg-[#05050C] border border-[#202030] rounded-xl p-2 font-mono text-center">
                  <div>
                    <div className="text-[11px] font-bold text-white flex items-center justify-center gap-0.5">
                      <Users className="w-3 h-3 text-slate-400" /> {brand.followersCount}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase font-black">Followers</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white flex items-center justify-center gap-0.5">
                      <Heart className="w-3 h-3 text-red-500" /> {brand.loveCount}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase font-black">Loves</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white flex items-center justify-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {brand.trustScore}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase font-black">Score</div>
                  </div>
                </div>

                {/* Edit Controls */}
                <div className="flex gap-2 border-t border-[#202030] pt-4.5 mt-2">
                  <Link 
                    to={`/dashboard/content-studio/brands/${brand.id}/edit`}
                    className="flex-1 py-2.5 bg-app-accent hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Visual Builder
                  </Link>
                  <button 
                    onClick={() => handleDeleteBrand(brand.id)}
                    className="p-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                    title="Delete Brand Configuration"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-app-card border border-app-border rounded-3xl overflow-hidden shadow-xl"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#202030] bg-[#05050C]">
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">Brand visual detail</th>
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">Followers</th>
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">Loves count</th>
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">Trust Score</th>
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider">Content Status</th>
                  <th className="p-4.5 text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202030]/60">
                {filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4.5 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs uppercase border border-slate-700 shrink-0 ${brand.color}`}>
                        {brand.initials}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {brand.brandName}
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="text-[10px] text-slate-400">{brand.category}</div>
                      </div>
                    </td>
                    <td className="p-4.5 font-mono text-xs">{brand.followersCount}</td>
                    <td className="p-4.5 font-mono text-xs text-red-400">{brand.loveCount}</td>
                    <td className="p-4.5 font-mono text-xs text-amber-400">{brand.trustScore} / 5.0</td>
                    <td className="p-4.5">
                      <span className={`px-2 py-0.5 text-[8px] font-black tracking-widest uppercase rounded border ${
                        brand.status === "Live" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-app-accent/10 text-app-accent border-app-accent/20"
                      }`}>
                        {brand.status}
                      </span>
                    </td>
                    <td className="p-4.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Link 
                          to={`/dashboard/content-studio/brands/${brand.id}/edit`}
                          className="p-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent hover:text-white rounded-lg transition-colors"
                          title="Edit Experience"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteBrand(brand.id)}
                          className="p-1.5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-white/10 hover:border-red-500/20"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guide widget banner info */}
      <div className="bg-app-card border border-app-border p-5 rounded-2xl flex items-center gap-4 text-left">
        <HelpCircle className="w-10 h-10 text-app-accent shrink-0 opacity-75" />
        <div className="space-y-1">
          <h4 className="text-[13px] font-black text-white uppercase tracking-wider">How to manage brand storefront templates</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-4xl">
            In our <strong>Visual Content Studio</strong>, brands are modeled with active reputational trust cards, integrated video review matrices, and complete retail services breakdowns. Sellers can adjust score bars and layout presets, then publish directly to trigger automatic customer-facing storefront rendering.
          </p>
        </div>
      </div>
    </div>
  );
}
