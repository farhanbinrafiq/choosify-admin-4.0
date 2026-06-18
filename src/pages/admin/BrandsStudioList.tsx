import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, Search, Filter, ShieldCheck, TrendingUp, Users, 
  Globe, Eye, Award, Settings, Trash2, Edit3, ArrowUpRight, 
  Heart, Star, HelpCircle, LayoutGrid, List,
  Building2, Calendar, CreditCard, Activity, Check, X, Clock,
  FileCheck, FileSignature, Database, FileText, Mail, Phone,
  MapPin, Sparkles, AlertTriangle, ChevronRight, CheckSquare,
  ShieldCheck as VerifiedIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useTrust } from "../../contexts/TrustContext";
import BrandEditStudio from "./BrandEditStudio";

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
  const { profile, activeBrandId, setActiveBrandId, allBrands, sellerBrands, requestNewBrand } = useAuth();
  const { verificationRequests, trustScores, trustAlerts, submitVerificationRequest } = useTrust();

  // Sub-tab selection state for Seller Dashboard context
  const [activeSubTab, setActiveSubTab] = useState<"storefronts" | "operational" | "verification">("storefronts");

  // Editable Contact States saved in localStorage
  const [contactEmail, setContactEmail] = useState(() => {
    return localStorage.getItem("choosify_seller_contact_email") || profile?.email || "rahim@aarong.com";
  });
  const [contactPhone, setContactPhone] = useState(() => {
    return localStorage.getItem("choosify_seller_contact_phone") || "01711-654321";
  });
  const [contactAddress, setContactAddress] = useState(() => {
    return localStorage.getItem("choosify_seller_contact_address") || "H-84, Road-11, Banani, Dhaka, Bangladesh";
  });

  const [brands, setBrands] = useState<BrandStudioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Live" | "Draft" | "Archived">("All");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(COMPILATION_KEY);
    let loaded: BrandStudioItem[] = [];
    if (cached) {
      try {
        loaded = JSON.parse(cached);
      } catch (_) {
        loaded = defaultBrands;
      }
    } else {
      loaded = defaultBrands;
      localStorage.setItem(COMPILATION_KEY, JSON.stringify(defaultBrands));
    }

    // Enrich with any brands missing from allBrands
    let updated = [...loaded];
    let changed = false;
    allBrands.forEach(b => {
      if (!updated.some(u => u.id === b.id)) {
        const initials = b.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const colors = [
          "bg-[#0A2540] text-[#00D4B2]",
          "bg-orange-950 text-orange-400",
          "bg-blue-950 text-blue-400",
          "bg-purple-950 text-purple-400",
          "bg-green-950 text-emerald-400"
        ];
        // simple hash code or random selection
        const color = colors[Math.abs(b.name.length + b.id.length) % colors.length];
        updated.push({
          id: b.id,
          brandName: b.name,
          category: b.category,
          status: "Live",
          followersCount: b.id.startsWith('brand_') ? "2,120" : "8,500",
          loveCount: b.id.startsWith('brand_') ? "1,450" : "6,200",
          trustScore: 4.8,
          initials: initials || "B",
          color: color,
          lastUpdated: "June 14, 2026"
        });
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(COMPILATION_KEY, JSON.stringify(updated));
    }
    setBrands(updated);
  }, [allBrands]);

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

  const handleCreateBrandExperience = () => {
    const name = prompt("Enter new brand experience name:");
    if (!name || !name.trim()) return;
    
    const category = prompt("Enter brand category (e.g. Fashion, Electronics):") || "Retail & Lifestyle";
    
    const newBrandRef = requestNewBrand(name.trim(), category.trim());
    const newId = newBrandRef?.id || `brand_${Math.random().toString(36).substr(2, 9)}`;
    
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const colors = [
      "bg-[#0A2540] text-[#00D4B2]",
      "bg-orange-950 text-orange-400",
      "bg-blue-950 text-blue-400",
      "bg-purple-950 text-purple-400",
      "bg-green-950 text-emerald-400"
    ];
    const color = colors[Math.abs(name.length + newId.length) % colors.length];
    
    const newItem: BrandStudioItem = {
      id: newId,
      brandName: name.trim(),
      category: category.trim(),
      status: "Draft",
      followersCount: "0",
      loveCount: "0",
      trustScore: 5.0,
      initials: initials || "B",
      color: color,
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
    };
    
    const updated = [newItem, ...brands];
    setBrands(updated);
    localStorage.setItem(COMPILATION_KEY, JSON.stringify(updated));
    
    triggerToast(`✓ Brand '${name.trim()}' experience draft created.`);
  };

  const handleSaveContactDetails = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("choosify_seller_contact_email", contactEmail);
    localStorage.setItem("choosify_seller_contact_phone", contactPhone);
    localStorage.setItem("choosify_seller_contact_address", contactAddress);
    triggerToast("✓ Contact alterations successfully saved & cached in seller registry.");
  };

  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map(r => r.brand_id);
  const ownedBrandNames = allBrands.filter(b => ownedBrandIds.includes(b.id)).map(b => b.name.toLowerCase());

  const filteredBrands = brands.filter((brand) => {
    if (profile?.role === 'seller') {
      const bName = brand.brandName.toLowerCase();
      const isOwnedName = ownedBrandNames.some(name => bName === name || bName.includes(name) || name.includes(bName));
      const isOwnedId = ownedBrandIds.includes(brand.id);
      if (!isOwnedId && !isOwnedName) return false;
    }

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
              My Brand Studio (Visual Brand Profile CMS)
            </h1>
          </div>
          <p className="text-app-text-secondary text-[12px] opacity-80">
            Design pristine brand storefront homepages, reputation meters, and verified ambassador streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {profile?.role === 'seller' ? (
            <button
              onClick={handleCreateBrandExperience}
              className="flex items-center gap-2 bg-[#F4631E] hover:bg-orange-500 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create Brand Experience
            </button>
          ) : (
            <Link
              to="/dashboard/content-studio/brands/new"
              className="flex items-center gap-2 bg-[#F4631E] hover:bg-orange-500 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create Brand Experience
            </Link>
          )}
        </div>
      </div>

      {/* SECTION SELECTOR / BRAND INTELLIGENCE TAB ROW */}
      {profile?.role === 'seller' && (
        <div className="bg-app-card border border-app-border rounded-[2rem] p-2 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveSubTab("storefronts")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
              activeSubTab === "storefronts"
                ? "bg-app-accent text-white shadow-lg shadow-app-accent/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Edit3 className="w-4 h-4" /> Visual Builder
          </button>
          
          <button
            onClick={() => setActiveSubTab("operational")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
              activeSubTab === "operational"
                ? "bg-app-accent text-white shadow-lg shadow-app-accent/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Operational Intelligence
          </button>
          
          <button
            onClick={() => setActiveSubTab("verification")}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
              activeSubTab === "verification"
                ? "bg-app-accent text-white shadow-lg shadow-app-accent/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Verification & Compliance
          </button>
        </div>
      )}

      {/* BRAND STOREFRONTS CATALOG SUB-TAB */}
      {activeSubTab === "storefronts" && (
        profile?.role === 'seller' ? (
          <div className="space-y-4">
            {allBrands.filter(b => sellerBrands.filter(r => r.seller_user_id === profile?.id).map(r => r.brand_id).includes(b.id)).length > 1 && (
              <div className="bg-app-card border border-app-border p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-left space-y-1">
                  <h3 className="text-sm font-bold text-white">Active Brand Content Editor</h3>
                  <p className="text-[11px] text-slate-400">Select which brand store you are currently designing with the Visual Builder.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Select Brand:</span>
                  <select
                    value={activeBrandId || ""}
                    onChange={(e) => {
                      setActiveBrandId(e.target.value || null);
                      triggerToast(`✓ Switched brand editor context.`);
                    }}
                    className="bg-[#05055C] border border-orange-500/20 text-xs font-bold text-white px-4 py-2 rounded-xl outline-none focus:border-orange-500/50"
                  >
                    {allBrands.filter(b => sellerBrands.filter(r => r.seller_user_id === profile?.id).map(r => r.brand_id).includes(b.id)).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <BrandEditStudio overrideId={activeBrandId || undefined} isNested={true} />
          </div>
        ) : (
          <>
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

                {/* Active Context Setter */}
                {profile?.role === 'seller' && (
                  <div className="mb-3">
                    {activeBrandId === brand.id ? (
                      <span className="w-full py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1.5 shadow-md">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Context
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveBrandId(brand.id);
                          triggerToast(`✓ Active Brand context switched to '${brand.brandName}'.`);
                        }}
                        className="w-full py-2 bg-[#05050C] hover:bg-emerald-500/10 border border-[#202030] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1.5 transition-all shadow-inner"
                      >
                        Set Active Context
                      </button>
                    )}
                  </div>
                )}

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
                      <div className="flex justify-end items-center gap-3">
                        {profile?.role === 'seller' && (
                          activeBrandId === brand.id ? (
                            <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveBrandId(brand.id);
                                triggerToast(`✓ Active Brand context switched.`);
                              }}
                              className="px-3 py-1 bg-[#05050C] hover:bg-emerald-500/10 border border-[#202030] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                            >
                              Select
                            </button>
                          )
                        )}
                        <div className="flex justify-end gap-2">
                          <Link 
                            to={`/dashboard/content-studio/brands/${brand.id}/edit`}
                            className="p-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent hover:text-white rounded-lg transition-colors border border-transparent"
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
          </>
        )
      )}

      {/* OPERATIONAL INTELLIGENCE SECTION */}
      {activeSubTab === "operational" && (
        <div className="space-y-6">
          {/* Header Block with Active Profile name */}
          <div className="bg-[#05050C] border border-[#202030] rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-left">
            <div className="flex items-center gap-4.5">
              <div className="w-14 h-14 bg-gradient-to-tr from-app-accent to-orange-500 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-lg">
                {(profile?.displayName || 'RU').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  {profile?.displayName || 'Rahim Uddin'} 
                  <span className="text-[9px] bg-app-accent/15 border border-app-accent/20 text-app-accent px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                    Verified Merchant
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Registered Seller Node: <span className="text-blue-400">{profile?.id || 'seller_001'}</span> | Security Credentials Synced
                </p>
              </div>
            </div>
            
            {/* Live active context display */}
            <div className="text-right space-y-1 bg-white/5 px-4.5 py-3 rounded-2xl border border-white/10 self-stretch md:self-auto flex flex-col justify-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selected Active Context</div>
              <div className="text-sm font-bold text-[#F4631E] flex items-center gap-1.5 justify-end">
                <VerifiedIcon className="w-4 h-4 text-emerald-400" />
                {allBrands.find(b => b.id === activeBrandId)?.name || 'All Brands'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Intelligent Analytics and Risk metrics */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* OPERATIONAL STATUS & CRITICAL KPI METRICS */}
              <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-5 text-left">
                <div className="border-b border-[#202030] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-app-accent" /> Operational Compliance & Audit Scores
                  </h3>
                  
                  {/* Operational Risk Health Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest font-mono">Risk Status:</span>
                    <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider">
                      COMPLIANT
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  {/* KPI card 1 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fulfillment Rate</div>
                    <div className="text-2xl font-black text-white mt-1.5 font-mono">98.4%</div>
                    <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[98.4%]" />
                    </div>
                  </div>

                  {/* KPI card 2 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Return Ratio</div>
                    <div className="text-2xl font-black text-red-400 mt-1.5 font-mono">1.8%</div>
                    <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-red-500 h-full w-[1.8%]" />
                    </div>
                  </div>

                  {/* KPI card 3 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Audit Trust Score</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1.5 font-mono flex items-baseline gap-1">
                      94 <span className="text-[10px] text-slate-500 font-normal">/ 100</span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                      <div className="bg-emerald-400 h-full w-[94%]" />
                    </div>
                  </div>

                  {/* KPI card 4 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Settlement Code</div>
                    <div className="text-xs font-bold text-slate-100 mt-2">T+3 Clearing Cycle</div>
                    <p className="text-[8px] text-slate-500 uppercase font-black font-mono mt-1">Bi-Weekly Automated</p>
                  </div>

                  {/* KPI card 5 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Revenue Performance</div>
                    <div className="text-sm font-black text-emerald-400 mt-2">৳ 1,482,000</div>
                    <p className="text-[8px] text-[#00D4B2] uppercase font-black font-mono mt-1">+14.8% MTD Growth</p>
                  </div>

                  {/* KPI card 6 */}
                  <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Active Catalog States</div>
                    <div className="text-xs font-bold text-white mt-2">32 SKUs Listed</div>
                    <p className="text-[8px] text-slate-500 uppercase font-black font-mono mt-1">4.2% Conv Ratio</p>
                  </div>

                </div>
              </div>

              {/* RECENT AUDIT TRAIL LOGS */}
              <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-4 text-left">
                <div className="border-b border-[#202030] pb-2">
                  <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-app-accent" /> Recent Activity Trail & Audit Records
                  </h3>
                  <p className="text-[10px] text-slate-500">Verified activities completed by brand employees and automated system jobs.</p>
                </div>

                <div className="space-y-3.5 font-mono text-xs">
                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between flex-wrap gap-2">
                        <span className="font-bold text-white uppercase text-[10px]">Updated store representations</span>
                        <span className="text-[9px] text-slate-500">Today, 05:30 AM</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Edited secondary visual panels, ambassador slider widgets, and verified rating meters.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#F4631E] mt-1.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between flex-wrap gap-2">
                        <span className="font-bold text-white uppercase text-[10px]">Dual fulfillment dispatch checks</span>
                        <span className="text-[9px] text-slate-500">Yesterday, 04:12 PM</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Pushed bulk stock batch standard metrics to B2C logistics container #102.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between flex-wrap gap-2">
                        <span className="font-bold text-white uppercase text-[10px]">BIN-VAT Certificate Updated</span>
                        <span className="text-[9px] text-slate-500">June 11, 2026</span>
                      </div>
                      <p className="text-[11px] text-slate-400">Lodged certified trade and NBR BIN validation document into corporate audit registry.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right side: Contact modification form (Partially editable) */}
            <div className="lg:col-span-4">
              <form onSubmit={handleSaveContactDetails} className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-5 text-left">
                <div className="border-b border-[#202030] pb-2">
                  <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-app-accent" /> Merchant Registry Editor
                  </h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Modify your contact details safely. These fields sync instantly with platform customer assistance teams.</p>
                </div>

                <div className="space-y-4">
                  {/* Field 1: Contact Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-[#8E9BAE] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Contact Email Address
                    </label>
                    <input 
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full bg-[#05050C] border border-[#202030] focus:border-app-accent/40 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>

                  {/* Field 2: Phone number */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-[#8E9BAE] flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Direct Telephone Number
                    </label>
                    <input 
                      type="text"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-[#05050C] border border-[#202030] focus:border-app-accent/40 rounded-xl px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>

                  {/* Field 3: Address */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-[#8E9BAE] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Registered business address
                    </label>
                    <textarea 
                      rows={3}
                      required
                      value={contactAddress}
                      onChange={(e) => setContactAddress(e.target.value)}
                      className="w-full bg-[#05050C] border border-[#202030] focus:border-app-accent/40 rounded-xl p-4 text-xs text-white outline-none transition-all placeholder:text-slate-600 resize-none animate-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#F4631E] hover:bg-orange-500 text-white font-extrabold uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Update Merchant Records
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION & COMPLIANCE SECTION */}
      {activeSubTab === "verification" && (() => {
        const matchedRequest = verificationRequests.find((r: any) => r.brand_id === activeBrandId) || 
                               verificationRequests.find((r: any) => ownedBrandIds.includes(r.brand_id)) || 
                               verificationRequests[0];
        
        return (
          <div className="space-y-6">
            
            {/* TOP TRACKING CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Main Application Summary */}
              <div className="bg-app-card border border-[#202030] rounded-3xl p-5 shadow-xl flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-app-accent/15 border border-app-accent/25 flex items-center justify-center shrink-0">
                  <FileSignature className="w-6 h-6 text-app-accent" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verification Request Code</div>
                  <div className="text-sm font-black text-white mt-1 font-mono uppercase">
                    {matchedRequest ? `APP-2026-${matchedRequest.id.toUpperCase()}` : 'APP-2026-VR_002'}
                  </div>
                  <p className="text-[9px] text-[#00D4B2] font-mono mt-0.5">Application active in system registry</p>
                </div>
              </div>

              {/* Approval Progress Status */}
              <div className="bg-app-card border border-[#202030] rounded-3xl p-5 shadow-xl flex items-center gap-4 text-left">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  matchedRequest?.status === 'Approved' ? 'bg-emerald-500/15 border border-emerald-500/25' :
                  matchedRequest?.status === 'Rejected' ? 'bg-red-500/15 border border-red-500/25' :
                  'bg-yellow-500/15 border border-yellow-500/25 animate-pulse'
                }`}>
                  <Clock className={`w-6 h-6 ${
                    matchedRequest?.status === 'Approved' ? 'text-emerald-400' :
                    matchedRequest?.status === 'Rejected' ? 'text-red-400' : 'text-yellow-500'
                  }`} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pipeline Validation Status</div>
                  <div className="text-sm font-black text-white mt-1 uppercase flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      matchedRequest?.status === 'Approved' ? 'bg-emerald-400' :
                      matchedRequest?.status === 'Rejected' ? 'bg-red-400' : 'bg-yellow-400'
                    }`} />
                    {matchedRequest?.status || 'Under Review'}
                  </div>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">Last updated: {matchedRequest ? new Date(matchedRequest.updated_at).toLocaleDateString() : 'June 14, 2026'}</p>
                </div>
              </div>

              {/* Compliance Badge indicator */}
              <div className="bg-app-card border border-[#202030] rounded-3xl p-5 shadow-xl flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <FileCheck className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Compliance Validity</div>
                  <div className="text-sm font-black text-white mt-1 uppercase">
                    {(matchedRequest?.status === 'Approved') ? 'Fully Verified' : 'Under Assessment'}
                  </div>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">Annual corporate audit is active</p>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left view: Dossier details & document suite panel */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* APPLICANT INFO PANEL */}
                <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-4 text-left">
                  <div className="border-b border-[#202030] pb-2 text-left">
                    <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-app-accent" /> Applicant Organization Information
                    </h3>
                    <p className="text-[10px] text-slate-500">Formal corporate registry parameters stored in secured system database.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-left font-sans">
                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Legal Representative</div>
                      <div className="text-white font-bold">{profile?.displayName || 'Rahim Uddin'}</div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Registered Business Name</div>
                      <div className="text-[#F4631E] font-extrabold font-sans">
                        {matchedRequest?.brand_name || allBrands.find(b => b.id === activeBrandId)?.name || 'Apex Brand Group'}
                      </div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Corporate Hotline Telephone</div>
                      <div className="text-slate-300 font-mono">{contactPhone}</div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Registry Email Node</div>
                      <div className="text-slate-300 font-mono">{contactEmail}</div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl md:col-span-2 space-y-1 font-sans">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Physical Business Address</div>
                      <div className="text-slate-300 leading-relaxed">{contactAddress}</div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1 font-sans">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">NID / Business Registration Code</div>
                      <div className="text-white font-mono font-extrabold">NID-1992088219012</div>
                    </div>

                    <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl space-y-1 font-sans">
                      <div className="text-[9px] uppercase font-mono font-black text-slate-500">Audit Dossier Sub Date</div>
                      <div className="text-white font-mono">
                        {matchedRequest ? new Date(matchedRequest.created_at).toLocaleString() : 'June 01, 2026 09:12 AM'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DOCUMENTS PANEL */}
                <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-4 text-left">
                  <div className="border-b border-[#202030] pb-2 text-left">
                    <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-[#00D4B2]" /> Audited Compliance Document Dossier
                    </h3>
                    <p className="text-[10px] text-slate-500">View regulatory documents submitted for validation. Status corresponds to direct admin approval checks.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-left">
                    {[
                      { type: 'National ID Card (Front)', name: 'Rahim_NID_Front_scan.jpeg', status: 'approved', notes: 'Biometric profile validation passed successfully.' },
                      { type: 'National ID Card (Back)', name: 'Rahim_NID_Back_scan.jpeg', status: 'approved', notes: 'Voter registry check confirms standard Banani address coordinates.' },
                      { type: 'Trade License', name: matchedRequest?.documents?.find((d: any) => d.type === 'Trade License')?.name || 'Apex_Trade_License_No_8819.pdf', status: matchedRequest?.documents?.find((d: any) => d.type === 'Trade License')?.status || 'approved', notes: matchedRequest?.documents?.find((d: any) => d.type === 'Trade License')?.notes || 'Government certified Trade certificate is active and valid.' },
                      { type: 'Bank Statement / VAT Certificate', name: 'Apex_BankStatement_CityBank_MTD.pdf', status: (matchedRequest?.status === 'Approved') ? 'approved' : 'pending', notes: (matchedRequest?.status === 'Approved') ? 'Bank clearing records verified.' : 'Corporate financial clearing history checks under validation.' },
                      { type: 'Store Logo / Private Trademark Proof', name: matchedRequest?.documents?.find((d: any) => d.type === 'Brand Ownership Proof')?.name || 'Apex_Official_Trademark_Registration.pdf', status: matchedRequest?.documents?.find((d: any) => d.type === 'Brand Ownership Proof')?.status || 'approved', notes: matchedRequest?.documents?.find((d: any) => d.type === 'Brand Ownership Proof')?.notes || 'Trademark design has been filed accurately in Intellectual Holding index.' }
                    ].map((doc, i) => (
                      <div 
                        key={i} 
                        className={`p-4 bg-white/[0.01] rounded-2xl border shadow-md flex flex-col justify-between space-y-3.5 transition-all ${
                          doc.status === 'approved' ? 'border-emerald-500/15 bg-emerald-500/[0.01]' :
                          doc.status === 'rejected' ? 'border-red-500/15 bg-red-500/[0.01]' : 'border-[#202030]'
                        }`}
                      >
                        <div className="space-y-1.5 font-sans">
                          <div className="flex items-center justify-between gap-1.5 font-sans">
                            <span className="font-extrabold text-white text-[10px] uppercase tracking-wide truncate">{doc.type}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-mono font-black uppercase tracking-widest border ${
                              doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                              doc.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/15' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/15'
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 font-sans truncate">{doc.name}</p>
                        </div>

                        {doc.notes && (
                          <div className="p-3 bg-slate-900/40 rounded-xl text-[10px] text-slate-400 leading-relaxed border border-white/[0.02]">
                            <strong>Review note:</strong> {doc.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right view: Compliance checklists & Application Timeline */}
              <div className="lg:col-span-4 space-y-6 text-left">
                
                {/* REVIEW STATUS LABELS */}
                <div className="bg-app-card border border-[#202030] rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-[#202030] pb-2">
                    <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                      <FileSignature className="w-4 h-4 text-emerald-400" /> Compliance Checklist
                    </h3>
                    <p className="text-[10px] text-slate-500">Verification criteria evaluation state.</p>
                  </div>

                  <div className="space-y-3 text-xs text-left font-sans">
                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
                      <span className="text-slate-300 font-medium">1. Identity Verified</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        <Check className="w-4 h-4 text-emerald-400" /> Confirmed
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl font-sans">
                      <span className="text-slate-300 font-medium font-sans">2. Trade License Valid</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        <Check className="w-4 h-4 text-emerald-400" /> Confirmed
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl font-sans">
                      <span className="text-slate-300 font-medium">3. Bank Info Confirmed</span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-mono ${
                        matchedRequest?.status === 'Approved' ? 'text-emerald-400' : 'text-yellow-500'
                      }`}>
                        {matchedRequest?.status === 'Approved' ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" /> Confirmed
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-yellow-500 animate-pulse" /> Pending
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl font-sans">
                      <span className="text-slate-300 font-medium">4. Contact Verified</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                        <Check className="w-4 h-4 text-emerald-400" /> Confirmed
                      </span>
                    </div>
                  </div>

                  {matchedRequest?.reviews && matchedRequest.reviews.length > 0 && (
                    <div className="mt-4 p-3.5 bg-slate-900/60 rounded-xl border border-white/[0.03] space-y-1 text-xs text-left">
                      <div className="text-[9px] uppercase font-black text-slate-400">Official Admin Action Message</div>
                      <p className="text-slate-300 leading-relaxed italic">"{matchedRequest.reviews[0].feedback}"</p>
                      <div className="text-[8px] text-[#00D4B2] font-mono text-right">- reviewed by {matchedRequest.reviews[0].reviewer_name}</div>
                    </div>
                  )}
                </div>

                {/* DYNAMIC TIMELINE / AUDIT TRAIL REPLICATION */}
                <div className="bg-app-card border border-[#202030] rounded-3xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-[#202030] pb-2">
                    <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-app-accent" /> Timeline & Audits Logs
                    </h3>
                    <p className="text-[10px] text-slate-500">System generated events ledger chronologically ordered.</p>
                  </div>

                  <div className="relative border-l border-white/[0.06] pl-4 ml-2 space-y-5 py-1 text-left">
                    {matchedRequest ? (
                      matchedRequest.audit_trail.map((trail: any, idx: number) => (
                        <div key={idx} className="relative text-xs font-mono">
                          <div className="absolute -left-[22.5px] top-1 w-2.5 h-2.5 bg-app-accent border border-app-card rounded-full" />
                          <div className="flex items-center gap-1 flex-wrap mb-0.5">
                            <span className="text-white font-bold text-[11px]">{trail.action}</span>
                            <span className="text-[11px] text-slate-500">({trail.actor})</span>
                          </div>
                          <p className="text-slate-400 text-[10.5px] leading-relaxed mb-0.5">{trail.details}</p>
                          <span className="text-[9px] text-slate-500 block font-sans">
                            {new Date(trail.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="relative text-xs font-mono">
                          <div className="absolute -left-[22.5px] top-1 w-2.5 h-2.5 bg-emerald-500 border border-app-card rounded-full" />
                          <div className="text-white font-bold">Dossier Completed</div>
                          <p className="text-slate-400 text-[11px]">Submission details logged and verified.</p>
                          <span className="text-[9px] text-slate-500 block">June 01, 2026</span>
                        </div>
                        <div className="relative text-xs font-mono">
                          <div className="absolute -left-[22.5px] top-1 w-2.5 h-2.5 bg-yellow-500 border border-app-card rounded-full animate-pulse" />
                          <div className="text-white font-bold">In Compliance Queue</div>
                          <p className="text-slate-400 text-[11px]">Audit pipeline review under validation.</p>
                          <span className="text-[9px] text-slate-500 block">June 01, 2026</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Seller Resubmission is blocked as requested by permission rule */}
                  <div className="pt-2 border-t border-white/[0.04]">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-xl text-center cursor-not-allowed"
                      title="Active applications are locked in assessment state"
                    >
                      Resubmission Locked In Review State
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        );
      })()}

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
