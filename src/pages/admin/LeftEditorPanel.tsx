// LeftEditorPanel.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, ShieldCheck, ShoppingBag, Plus, Sparkles, SlidersHorizontal,
  PlusCircle, RefreshCcw, Trash, Copy, Edit2, Play, Circle, Video,
  Users2, MapPin, Mail, Phone, Clock, Eye, AlertTriangle, Check, ShieldAlert,
  ArrowUpRight, Star
} from "lucide-react";
import { BrandCMSModel, CreatorVideoItem, BrandProductItem, BrandDealItem, PromoCodeItem, TeamMemberItem } from "./brandSeeds";

interface LeftEditorPanelProps {
  model: BrandCMSModel;
  setModel: React.Dispatch<React.SetStateAction<BrandCMSModel | null>>;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  updateModelField: <K extends keyof BrandCMSModel>(field: K, value: BrandCMSModel[K]) => void;
  setHasUnsavedChanges: (val: boolean) => void;
}

export const LeftEditorPanel: React.FC<LeftEditorPanelProps> = ({
  model,
  setModel,
  activeSection,
  setActiveSection,
  updateModelField,
  setHasUnsavedChanges
}) => {
  const navigate = useNavigate();
  // Local form inputs
  const [newTag, setNewTag] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [editingProduct, setEditingProduct] = useState<BrandProductItem | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Simulated product fields
  const [prodForm, setProdForm] = useState({ name: "", sku: "", category: "Accessories", price: 0, stock: 10, status: "Live" as const });

  // Deal state
  const [isAddingDeal, setIsAddingDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: "", discountType: "Percentage" as const, discountValue: 10, startDate: "2026-06-13", endDate: "2026-06-30" });

  // Promo state
  const [promoForm, setPromoForm] = useState({ code: "", discountType: "Percentage" as const, discountValue: 10, startDate: "2026-06-13", endDate: "2026-06-30", usageLimit: 500 });

  // Creator state
  const [creatorPlatform, setCreatorPlatform] = useState<"youtube" | "instagram" | "tiktok">("youtube");
  const [creatorForm, setCreatorForm] = useState({ title: "", sourceUrl: "", creatorName: "", views: 1200 });

  // Team state
  const [teamForm, setTeamForm] = useState({ name: "", email: "", role: "Marketing Manager" as any });

  // Accordion toggle helper
  const toggleSection = (sec: string) => {
    setActiveSection(activeSection === sec ? "" : sec);
  };

  // 1. IDENTITY HANDLERS
  const addCategoryTag = () => {
    if (!newTag.trim()) return;
    const currentTags = model.bestForTags || [];
    if (!currentTags.includes(newTag.trim())) {
      updateModelField("bestForTags", [...currentTags, newTag.trim()]);
      setHasUnsavedChanges(true);
    }
    setNewTag("");
  };

  const removeCategoryTag = (tag: string) => {
    const currentTags = model.bestForTags || [];
    updateModelField("bestForTags", currentTags.filter(t => t !== tag));
    setHasUnsavedChanges(true);
  };

  // 2. PRODUCT ACTIONS
  const handleFeatureProduct = (prodId: string) => {
    const featuredCount = model.products.filter(p => p.featured).length;
    const item = model.products.find(p => p.id === prodId);
    if (!item) return;

    if (!item.featured && featuredCount >= 3) {
      alert("❌ Maximum of 3 featured products reached. Disable another featured product first.");
      return;
    }

    const updated = model.products.map(p => p.id === prodId ? { ...p, featured: !p.featured } : p);
    updateModelField("products", updated);
    setHasUnsavedChanges(true);
  };

  const handleToggleProductStatus = (prodId: string) => {
    const updated = model.products.map(p => {
      if (p.id === prodId) {
        const nextStatus = p.status === "Live" ? "Hidden" : p.status === "Hidden" ? "Draft" : "Live";
        return { ...p, status: nextStatus };
      }
      return p;
    });
    updateModelField("products", updated);
    setHasUnsavedChanges(true);
  };

  const handleDuplicateProduct = (prod: BrandProductItem) => {
    const copy: BrandProductItem = {
      ...prod,
      id: "p_" + Date.now(),
      name: `${prod.name} (Copy)`,
      sku: `${prod.sku}-COPY`,
      featured: false
    };
    updateModelField("products", [copy, ...model.products]);
    setHasUnsavedChanges(true);
  };

  const handleDeleteProduct = (prodId: string) => {
    if (window.confirm("Delete this product from your Brand catalog?")) {
      updateModelField("products", model.products.filter(p => p.id !== prodId));
      setHasUnsavedChanges(true);
    }
  };

  const executeAddProduct = () => {
    if (!prodForm.name.trim()) return;
    const newItem: BrandProductItem = {
      id: "p_" + Date.now(),
      name: prodForm.name,
      sku: prodForm.sku || `PROD-${Date.now().toString().slice(-4)}`,
      category: prodForm.category,
      price: Number(prodForm.price) || 999,
      stock: Number(prodForm.stock) || 10,
      featured: false,
      status: prodForm.status,
      thumbnail: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150"
    };
    updateModelField("products", [newItem, ...model.products]);
    setHasUnsavedChanges(true);
    setIsAddingProduct(false);
    setProdForm({ name: "", sku: "", category: "Accessories", price: 0, stock: 10, status: "Live" });
  };

  // 3. DEALS & PROMOS ACTIONS
  const executeAddDeal = () => {
    if (!dealForm.title.trim()) return;
    const item: BrandDealItem = {
      id: "d_" + Date.now(),
      title: dealForm.title,
      discountType: dealForm.discountType,
      discountValue: Number(dealForm.discountValue) || 10,
      status: "Active",
      startDate: dealForm.startDate,
      endDate: dealForm.endDate
    };
    updateModelField("deals", [item, ...model.deals]);
    setHasUnsavedChanges(true);
    setIsAddingDeal(false);
    setDealForm({ title: "", discountType: "Percentage", discountValue: 10, startDate: "2026-06-13", endDate: "2026-06-30" });
  };

  const handleDeleteDeal = (dealId: string) => {
    updateModelField("deals", model.deals.filter(d => d.id !== dealId));
    setHasUnsavedChanges(true);
  };

  const autoGeneratePromo = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randLetters = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * 26)]).join("");
    const randNum = Math.floor(100 + Math.random() * 900);
    const code = `${model.brandName.split(" ")[0].toUpperCase()}${randLetters}${randNum}`;
    setPromoForm(prev => ({ ...prev, code }));
  };

  const executeAddPromo = () => {
    if (!promoForm.code.trim()) return;
    const item: PromoCodeItem = {
      id: "pr_" + Date.now(),
      code: promoForm.code.toUpperCase(),
      discountType: promoForm.discountType,
      discountValue: Number(promoForm.discountValue) || 15,
      startDate: promoForm.startDate,
      endDate: promoForm.endDate,
      usageLimit: Number(promoForm.usageLimit) || 500,
      enabled: true
    };
    updateModelField("promoCodes", [item, ...model.promoCodes]);
    setHasUnsavedChanges(true);
    setPromoForm({ code: "", discountType: "Percentage", discountValue: 10, startDate: "2026-06-13", endDate: "2026-06-30", usageLimit: 500 });
  };

  const togglePromoCode = (id: string) => {
    const updated = model.promoCodes.map(pr => pr.id === id ? { ...pr, enabled: !pr.enabled } : pr);
    updateModelField("promoCodes", updated);
    setHasUnsavedChanges(true);
  };

  const deletePromoCode = (id: string) => {
    updateModelField("promoCodes", model.promoCodes.filter(pr => pr.id !== id));
    setHasUnsavedChanges(true);
  };

  // 4. CREATOR EXPERIENCES ACTIONS
  const executeAddCreator = () => {
    if (!creatorForm.title.trim() || !creatorForm.sourceUrl.trim()) return;
    const item: CreatorVideoItem = {
      id: "cr_" + Date.now(),
      title: creatorForm.title,
      sourceUrl: creatorForm.sourceUrl,
      platform: creatorPlatform,
      thumbnailUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400",
      duration: "3:45",
      creatorName: creatorForm.creatorName || "CreatorPartner",
      views: Number(creatorForm.views) || 500,
      clicks: 12,
      status: "Pending" // Require approval prior to live broadcast
    };
    updateModelField("creators", [item, ...model.creators]);
    setHasUnsavedChanges(true);
    setCreatorForm({ title: "", sourceUrl: "", creatorName: "", views: 1200 });
    alert("✓ Influencer video submitted. Standard requirement dictates review & approval before public broadcast.");
  };

  const setCreatorStatus = (id: string, status: "Approved" | "Rejected") => {
    const updated = model.creators.map(c => c.id === id ? { ...c, status } : c);
    updateModelField("creators", updated);
    setHasUnsavedChanges(true);
  };

  const removeCreator = (id: string) => {
    updateModelField("creators", model.creators.filter(c => c.id !== id));
    setHasUnsavedChanges(true);
  };

  // 5. REVIEW ACTIONS
  const toggleFlagReview = (id: string) => {
    const updated = model.reviews.map(r => r.id === id ? { ...r, flagged: !r.flagged } : r);
    updateModelField("reviews", updated);
    setHasUnsavedChanges(true);
    alert("Review flagged for internal admin investigation.");
  };

  // 6. TEAM MANAGEMENT ACTIONS
  const inviteTeamMember = () => {
    if (!teamForm.name.trim() || !teamForm.email.trim()) return;
    const item: TeamMemberItem = {
      id: "tm_" + Date.now(),
      name: teamForm.name,
      email: teamForm.email,
      role: teamForm.role,
      status: "Invited"
    };
    updateModelField("team", [...model.team, item]);
    setHasUnsavedChanges(true);
    setTeamForm({ name: "", email: "", role: "Marketing Manager" });
  };

  const removeTeamMember = (id: string) => {
    updateModelField("team", model.team.filter(t => t.id !== id));
    setHasUnsavedChanges(true);
  };

  const toggleSuspendTeam = (id: string) => {
    const updated = model.team.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "Active" ? "Suspended" as const : "Active" as const;
        return { ...t, status: nextStatus };
      }
      return t;
    });
    updateModelField("team", updated);
    setHasUnsavedChanges(true);
  };

  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* SECTION 1: IDENTITY */}
      <div id="editor-section-identity" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("identity")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "identity" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">1. Identity & Narrative</h3>
              <p className="text-[11px] text-[#6B7280]">Logo, covers, story, categorical tagging</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "identity" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "identity" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            {/* Read-only verification */}
            <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 border border-green-100">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <div className="text-[11px]">
                <span className="font-extrabold block">Verification Status: READ-ONLY ({model.verificationStatus})</span>
                Registered under Choosify corporate compliance program.
              </div>
            </div>

            {/* Approval constraint */}
            <div className="p-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg flex items-start gap-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Brand Name Change Controls</span>
                Modifying the registered Business Legal Title requires secondary audit desk approvals.
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Brand Name</label>
                <input
                  type="text"
                  value={model.brandName}
                  onChange={(e) => { updateModelField("brandName", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-[12px] font-bold text-[#111827] focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Custom Tagline</label>
                <input
                  type="text"
                  value={model.tagline}
                  onChange={(e) => { updateModelField("tagline", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none"
                  placeholder="The leading pulse in ethical styling..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={model.logo}
                    onChange={(e) => { updateModelField("logo", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none font-mono text-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Cover Image URL</label>
                  <input
                    type="text"
                    value={model.coverImage}
                    onChange={(e) => { updateModelField("coverImage", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none font-mono text-[10px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Official eCommerce Website</label>
                <input
                  type="text"
                  value={model.website}
                  onChange={(e) => { updateModelField("website", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Brand Pitch Description</label>
                <textarea
                  rows={3}
                  value={model.description}
                  onChange={(e) => { updateModelField("description", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Mission Statement</label>
                <input
                  type="text"
                  value={model.missionStatement}
                  onChange={(e) => { updateModelField("missionStatement", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Brand Legacy Story</label>
                <textarea
                  rows={2}
                  value={model.brandStory}
                  onChange={(e) => { updateModelField("brandStory", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg focus:outline-none leading-relaxed text-[11px]"
                />
              </div>

              {/* Best For Tags (Category tags) */}
              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Category & Audience Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add brand tag..."
                    className="flex-1 bg-[#F5F5F5] border border-gray-200 px-3 py-1.5 rounded-lg text-[12px] focus:outline-none"
                  />
                  <button onClick={addCategoryTag} className="px-3 bg-[#F97316] text-white rounded-lg font-bold text-xs">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {model.bestForTags?.map((tag, idx) => (
                    <span key={idx} className="bg-orange-50 text-[#F97316] font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-orange-100">
                      {tag}
                      <button onClick={() => removeCategoryTag(tag)} className="text-[#F97316] hover:text-red-500 font-black">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Social URLs */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Social Handles</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-[#6B7280] uppercase tracking-wide block mb-0.5">Facebook</label>
                    <input
                      type="text"
                      value={model.socialFbUrl}
                      onChange={(e) => { updateModelField("socialFbUrl", e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6B7280] uppercase tracking-wide block mb-0.5">Instagram</label>
                    <input
                      type="text"
                      value={model.socialInstaUrl}
                      onChange={(e) => { updateModelField("socialInstaUrl", e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6B7280] uppercase tracking-wide block mb-0.5">Youtube</label>
                    <input
                      type="text"
                      value={model.socialYtUrl}
                      onChange={(e) => { updateModelField("socialYtUrl", e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6B7280] uppercase tracking-wide block mb-0.5">TikTok</label>
                    <input
                      type="text"
                      value={model.socialTiktokUrl}
                      onChange={(e) => { updateModelField("socialTiktokUrl", e.target.value); setHasUnsavedChanges(true); }}
                      className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-[11px]"
                      placeholder="https://tiktok.com/@..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: TRUST CENTER */}
      <div id="editor-section-trust" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("trust")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "trust" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">2. Choosify Trust Center</h3>
              <p className="text-[11px] text-[#6B7280]">Read-only audits, score breakdowns, recent alerts</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "trust" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "trust" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            <div className="p-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <div className="text-[11px]">
                <span className="font-extrabold block">Official Compliance Dashboard</span>
                Scores are aggregated from real buyer audits and verified shipping checks. Non-editable.
              </div>
            </div>

            {/* Global Scores matrix */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[#F5F5F5] p-3 rounded-lg border border-gray-100">
                <span className="text-[20px] font-black font-mono block text-[#1a1a2e]">{model.choosifyScore}</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#6B7280]">Total Trust Score</span>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-lg border border-gray-100">
                <span className="text-[20px] font-black font-mono block text-green-500">{model.recommendationScore}%</span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#6B7280]">Recommendation Ratio</span>
              </div>
            </div>

            {/* Score Metrics detailed */}
            <div className="space-y-2">
              <span className="block text-[10px] uppercase font-black text-[#1a1a2e] tracking-wider mb-1">Score Breakdown</span>
              {[
                { label: "Product & Fabric Quality", val: model.qualityScore },
                { label: "Customer Care Response", val: model.serviceScore },
                { label: "Courier Dispatch Speed", val: model.deliveryScore },
                { label: "Ecological Packaging Seal", val: model.packagingScore },
              ].map((sc, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] py-1 border-b border-gray-100">
                  <span className="text-[#6B7280]">{sc.label}</span>
                  <span className="font-black font-mono text-[#111827]">{sc.val}%</span>
                </div>
              ))}
            </div>

            {/* Score Explanations */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-[11px] text-[#6B7280] leading-relaxed">
              <span className="font-extrabold text-[#111827] block mb-1">Verified Audit Definitions</span>
              Our background engines monitor real-time shipping logs and purchase trails to verify quality. The target benchmark requires keeping service rates above 90% in Bangladesh.
            </div>

            {/* Trust Timeline Logs */}
            <div className="space-y-3">
              <span className="block text-[10px] uppercase font-black text-[#1a1a2e] tracking-wider">Recent Verified System Alerts</span>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {model.recentTrustAlerts?.map((al, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg border flex gap-2 items-start justify-between ${
                    al.type === "positive" 
                      ? "bg-green-50/50 border-green-100 text-green-800" 
                      : "bg-red-50/50 border-red-100 text-red-800"
                  }`}>
                    <div className="flex gap-2 items-start">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-black font-mono ${
                        al.type === "positive" ? "bg-green-150 bg-green-200 text-green-800" : "bg-red-150 bg-red-200 text-red-850 text-red-800"
                      }`}>
                        {al.scoreChange}
                      </span>
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold block">{al.message}</span>
                        <span className="text-[9px] opacity-65 font-mono">{al.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: PRODUCT CATALOG */}
      <div id="editor-section-products" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("products")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "products" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">3. Brand Product Catalog</h3>
              <p className="text-[11px] text-[#6B7280]">Search registry, catalog tables, featured toggling</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "products" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "products" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            {/* Limit Warning banner */}
            {model.products?.filter(p => p.featured).length >= 3 && (
              <div className="p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Featured limit of 3 products active. Further highlight selections are restricted.</span>
              </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="flex-1 bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
              />
              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value)}
                className="bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs text-[#111827]"
              >
                <option value="all">All States</option>
                <option value="Live">Live</option>
                <option value="Hidden">Hidden</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="font-extrabold text-[#111827]">Products List ({model.products?.length || 0})</span>
              <button
                onClick={() => navigate("/dashboard/content-studio/products/new")}
                className="px-2.5 py-1.5 bg-[#EA6C0A] hover:bg-[#F97316] text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add Product to Catalog
              </button>
            </div>

            {/* Add product simulator embedded */}
            {isAddingProduct && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                <div className="text-[11px] font-black text-[#111827] uppercase">Designated Item Details</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Item Title"
                    value={prodForm.name}
                    onChange={(e) => setProdForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-[11px]"
                  />
                  <input
                    type="text"
                    placeholder="SKU Code"
                    value={prodForm.sku}
                    onChange={(e) => setProdForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-[11px]"
                  />
                  <input
                    type="number"
                    placeholder="Price BDT"
                    onChange={(e) => setProdForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-[11px]"
                  />
                  <input
                    type="number"
                    placeholder="Stock Qty"
                    onChange={(e) => setProdForm(prev => ({ ...prev, stock: Number(e.target.value) }))}
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-[11px]"
                  />
                </div>
                <div className="flex gap-2.5 pt-1.5 justify-end">
                  <button onClick={() => setIsAddingProduct(false)} className="px-3 py-1 bg-gray-200 rounded-lg font-bold text-[11px]">Cancel</button>
                  <button onClick={executeAddProduct} className="px-3 open-link py-1 bg-green-600 text-white rounded-lg font-bold text-[11px]">Save Product</button>
                </div>
              </div>
            )}

            {/* Product Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[#6B7280]">
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-center">Status</th>
                    <th className="p-2 text-center">Featured</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {model.products
                    ?.filter(p => {
                      const matName = p.name.toLowerCase().includes(productSearch.toLowerCase());
                      const matStat = productStatusFilter === "all" || p.status === productStatusFilter;
                      return matName && matStat;
                    })
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="p-2 flex gap-1.5 items-center">
                          <img src={p.thumbnail} alt="" className="w-7 h-7 object-cover rounded-md border border-gray-100 shrink-0" />
                          <div className="truncate max-w-[120px]">
                            <span className="font-bold block truncate text-[#111827]">{p.name}</span>
                            <span className="text-[9px] text-[#6B7280]">{p.sku}</span>
                          </div>
                        </td>
                        <td className="p-2 text-right font-black font-mono text-[#111827]">৳{p.price.toLocaleString()}</td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleToggleProductStatus(p.id)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              p.status === "Live" 
                                ? "bg-green-50 text-green-700 border border-green-100" 
                                : p.status === "Hidden" 
                                ? "bg-gray-100 text-gray-700" 
                                : "bg-orange-50 text-orange-700 border border-orange-100"
                            }`}
                          >
                            {p.status}
                          </button>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleFeatureProduct(p.id)}
                            className={`p-1.5 rounded-md ${
                              p.featured 
                                ? "bg-amber-100 text-[#F97316] border border-amber-200" 
                                : "bg-gray-50 text-gray-400 hover:text-[#111827]"
                            }`}
                            title="Feature this product (Maximum of 3)"
                          >
                            ⭐
                          </button>
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => handleDuplicateProduct(p)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Duplicate copy">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title="Delete product">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: DEALS & PROMOTIONS */}
      <div id="editor-section-deals" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("deals")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "deals" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">4. Deals & Promo Codes</h3>
              <p className="text-[11px] text-[#6B7280]">Active campaigns, auto-generating codes</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "deals" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "deals" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            {/* Deals campaigns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-[#1a1a2e]">Active Campaigns & Deals</span>
                <button
                  onClick={() => setIsAddingDeal(!isAddingDeal)}
                  className="px-2 py-1 bg-[#EA6C0A] hover:bg-[#F97316] text-white rounded text-[10px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Start Deal
                </button>
              </div>

              {isAddingDeal && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                  <span className="block text-[10px] uppercase font-black text-[#111827]">New campaign campaign setup</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Special discount label description..."
                      value={dealForm.title}
                      onChange={(e) => setDealForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={dealForm.discountType}
                        onChange={(e) => setDealForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                        className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                      >
                        <option value="Percentage">Percentage %</option>
                        <option value="Flat">Flat rate BDT</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Discount Value"
                        value={dealForm.discountValue}
                        onChange={(e) => setDealForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                        className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setIsAddingDeal(false)} className="px-2.5 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                    <button onClick={executeAddDeal} className="px-2.5 py-1 bg-green-600 text-white rounded font-bold text-xs">Save</button>
                  </div>
                </div>
              )}

              {/* Deals List */}
              <div className="space-y-2">
                {model.deals?.map((dl) => (
                  <div key={dl.id} className="p-3 bg-[#F5F5F5] border border-gray-200 rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-extrabold block text-[#111827]">{dl.title}</span>
                      <span className="text-[10px] text-[#6B7280]">
                        Mode: {dl.discountType} Discount ({dl.discountValue}{dl.discountType === "Percentage" ? "%" : " BDT"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full">{dl.status}</span>
                      <button onClick={() => handleDeleteDeal(dl.id)} className="p-1 hover:bg-red-50 text-red-500 rounded">
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo code manager */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <span className="block text-[11px] font-black uppercase text-[#1a1a2e]">Voucher & Promo Code Generator</span>
              
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="PROMOOFFER20"
                    value={promoForm.code}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="flex-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold"
                  />
                  <button onClick={autoGeneratePromo} className="px-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs font-bold font-mono">Auto</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={promoForm.discountType}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                    className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs"
                  >
                    <option value="Percentage">Percentage %</option>
                    <option value="Flat">Flat rate Flat BDT</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Value"
                    value={promoForm.discountValue}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                    className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-xs"
                  />
                </div>
                <button onClick={executeAddPromo} className="w-full py-1.5 bg-[#EA6C0A] text-white rounded-lg font-bold text-xs">Create Promo Code</button>
              </div>

              {/* Promo code database table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left text-[11px] bg-white">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[#6B7280]">
                      <th className="p-2">Code</th>
                      <th className="p-2">Discount</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.promoCodes?.map((pr) => (
                      <tr key={pr.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="p-2 font-mono font-bold text-[#111827]">{pr.code}</td>
                        <td className="p-2 font-black text-[#1a1a2e]">
                          {pr.discountValue}{pr.discountType === "Percentage" ? "%" : " BDT"}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => togglePromoCode(pr.id)}
                            className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              pr.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {pr.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td className="p-2 text-right">
                          <button onClick={() => deletePromoCode(pr.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: CREATOR CONTENT */}
      <div id="editor-section-creator" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("creator")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "creator" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <Video className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">5. Creator & Influencer Videos</h3>
              <p className="text-[11px] text-[#6B7280]">Video review curation, click tracking, approval flow</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "creator" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "creator" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            <div className="bg-amber-50 border border-amber-100 text-amber-700 p-3 rounded-lg text-[11px]">
              <span className="font-extrabold block">Policy Requirement Checklist</span>
              Social influencer clips are audited for authenticity prior to live broadcast in Bangladesh storefronts. Include the correct social asset address below.
            </div>

            {/* Form list adding */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5">
              <span className="block text-[10px] uppercase font-black text-[#111827]">Import Ambassador Video</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Clip / Review title"
                  value={creatorForm.title}
                  onChange={(e) => setCreatorForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Ambassador Name (@...)"
                  value={creatorForm.creatorName}
                  onChange={(e) => setCreatorForm(prev => ({ ...prev, creatorName: e.target.value }))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="Video URL address"
                  value={creatorForm.sourceUrl}
                  onChange={(e) => setCreatorForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs col-span-2"
                />
                <select
                  value={creatorPlatform}
                  onChange={(e) => setCreatorPlatform(e.target.value as any)}
                  className="bg-white border border-gray-200 p-2 rounded-lg text-xs"
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
                <button onClick={executeAddCreator} className="px-3 bg-[#EA6C0A] text-white rounded-lg font-black text-xs">Import review</button>
              </div>
            </div>

            {/* List with approval action buttons */}
            <div className="space-y-3">
              <span className="block text-[10px] uppercase font-black text-[#6B7280]">Curation Review Queue</span>
              {model.creators?.map((cr) => (
                <div key={cr.id} className="p-3 border border-gray-100 rounded-xl bg-white space-y-2.5">
                  <div className="flex gap-2.5 items-start">
                    <img src={cr.thumbnailUrl} alt="" className="w-12 h-12 object-cover rounded-md border border-gray-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-extrabold text-[#111827] block truncate leading-tight">{cr.title}</span>
                      <span className="text-[10px] text-[#6B7280]">Platform: {cr.platform.toUpperCase()} | Host: @{cr.creatorName}</span>
                      <span className="text-[9px] text-[#6B7280] block font-mono">Views: {cr.views.toLocaleString()} | Clicks: {cr.clicks}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Status:</span>
                      <span className={`font-black uppercase text-[9px] ${
                        cr.status === "Approved" ? "text-green-600" : cr.status === "Pending" ? "text-amber-500" : "text-red-500"
                      }`}>{cr.status}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {cr.status !== "Approved" && (
                        <button onClick={() => setCreatorStatus(cr.id, "Approved")} className="px-2 py-1 bg-green-500 text-white rounded font-bold text-[9px]" title="Allow clip on PDP">
                          Approve
                        </button>
                      )}
                      {cr.status !== "Rejected" && (
                        <button onClick={() => setCreatorStatus(cr.id, "Rejected")} className="px-2 py-1 bg-red-500 text-white rounded font-bold text-[9px]" title="Block clip from PDP">
                          Reject
                        </button>
                      )}
                      <button onClick={() => removeCreator(cr.id)} className="px-2 py-1 bg-gray-100 text-slate-600 rounded font-bold text-[9px]">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 6: PUBLIC REVIEWS */}
      <div id="editor-section-reviews" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("reviews")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "reviews" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <Star className="w-4 h-4 text-[#F97316]" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">6. Verified Buyer Reviews</h3>
              <p className="text-[11px] text-[#6B7280]">Rating averages, star breakdowns, auditing comments</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "reviews" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "reviews" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            <div className="p-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[11px]">
              <span className="font-extrabold block">Read-Only Moderation Mode</span>
              Brands are strictly blocked from editing or deleting buyer reviews to maintain transparent buyer metrics. You may flag comments for abuse audits.
            </div>

            {/* Summary details */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="text-center bg-gray-50 p-3 rounded-xl border border-gray-150">
                <span className="text-[24px] font-black font-mono text-[#1a1a2e] block">4.8 / 5</span>
                <span className="text-[10px] text-[#6B7280] font-mono">Average (384 reviews)</span>
              </div>
              <div className="space-y-1">
                {[
                  { star: 5, pct: 85 },
                  { star: 4, pct: 10 },
                  { star: 3, pct: 3 },
                  { star: 2, pct: 1 },
                  { star: 1, pct: 1 }
                ].map((st, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-500 font-bold shrink-0">{st.star}★</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full mx-2 overflow-hidden">
                      <div className="bg-amber-400 h-full" style={{ width: `${st.pct}%` }} />
                    </div>
                    <span className="text-gray-500 shrink-0">{st.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews display with flag buttons */}
            <div className="space-y-3 pt-2">
              <span className="block text-[10px] uppercase font-black text-[#1a1a2e] tracking-wider mb-1">Recent Feedbacks</span>
              {model.reviews?.map((rv) => (
                <div key={rv.id} className="p-3 border border-gray-100 bg-[#F5F5F5] rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-extrabold text-[#111827] block text-[11px]">{rv.author}</span>
                      <span className="text-[9px] text-[#6B7280]">{rv.date}</span>
                    </div>
                    <div className="text-amber-500 font-mono text-[10px] font-bold">
                      {"★".repeat(rv.rating)}
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed italic text-gray-700">"{rv.text}"</p>
                  <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-gray-200">
                    <span className="text-green-600 font-semibold">✓ Verified Purchase</span>
                    <div className="flex gap-2">
                      <button className="text-[#6B7280] hover:text-[#111827] flex items-center gap-1 font-mono">
                        Helpful ({rv.helpfulCount})
                      </button>
                      <button onClick={() => toggleFlagReview(rv.id)} className={`font-bold ${rv.flagged ? "text-red-600" : "text-gray-400 hover:text-red-500"}`}>
                        Flag {rv.flagged && "✓"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 7: TEAM MANAGEMENT */}
      <div id="editor-section-team" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("team")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "team" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <Users2 className="w-4 h-4 text-[#F97316]" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">7. Organization & Team Seatings</h3>
              <p className="text-[11px] text-[#6B7280]">Role lists, permission matrices, invites</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "team" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "team" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            {/* Invite seat form */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2.5">
              <span className="block text-[10px] uppercase font-black text-[#111827]">Invite organization seat</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full Name Name"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                />
                <input
                  type="email"
                  placeholder="Member email"
                  value={teamForm.email}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs"
                />
                <select
                  value={teamForm.role}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, role: e.target.value as any }))}
                  className="bg-white border border-gray-200 p-2 rounded-lg text-xs col-span-2 text-[#111827]"
                >
                  <option value="Admin">Admin</option>
                  <option value="Marketing Manager">Marketing Manager</option>
                  <option value="Product Manager">Product Manager</option>
                  <option value="Support Manager">Support Manager</option>
                  <option value="Creator Manager">Creator Manager</option>
                </select>
                <button onClick={inviteTeamMember} className="w-full py-1.5 bg-[#EA6C0A] text-white rounded-lg font-black text-xs col-span-2">Send invitation link</button>
              </div>
            </div>

            {/* Seats table list */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg text-[11px]">
              <table className="w-full text-left bg-white">
                <thead>
                  <tr className="bg-gray-50 text-[#6B7280] border-b border-gray-200">
                    <th className="p-2">Name / Email</th>
                    <th className="p-2">Designation</th>
                    <th className="p-2 text-center">Seat</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {model.team?.map((tm) => (
                    <tr key={tm.id} className="hover:bg-gray-50/50">
                      <td className="p-2">
                        <span className="font-bold block text-[#111827]">{tm.name}</span>
                        <span className="text-[10px] text-[#6B7280]">{tm.email}</span>
                      </td>
                      <td className="p-1.5 font-bold text-gray-700">{tm.role}</td>
                      <td className="p-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                          tm.status === "Active" ? "bg-green-100 text-green-700" : tm.status === "Suspended" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {tm.status}
                        </span>
                      </td>
                      <td className="p-1.5 text-right">
                        <div className="flex gap-1 justify-end">
                          {tm.role !== "Owner" && (
                            <>
                              <button onClick={() => toggleSuspendTeam(tm.id)} className="px-1.5 py-0.5 bg-gray-100 text-slate-700 hover:bg-[#F97316] hover:text-white rounded text-[9px] font-bold">
                                {tm.status === "Active" ? "Suspend" : "Unsuspend"}
                              </button>
                              <button onClick={() => removeTeamMember(tm.id)} className="p-1 hover:bg-red-50 text-red-500 rounded">
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Read-only Permissions Matrix */}
            <div className="space-y-2.5 pt-2.5 border-t border-gray-100">
              <span className="block text-[10px] uppercase font-black text-[#1a1a2e] tracking-wider mb-1">Corporate Permissions reference matrix</span>
              <div className="overflow-x-auto border border-gray-200 rounded-lg text-[10px] font-mono leading-relaxed p-3 bg-gray-50 text-[#6B7280]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-150 text-[#111827] font-bold">
                      <th className="pb-1">Role Type</th>
                      <th className="pb-1 text-center">Modify Content</th>
                      <th className="pb-1 text-center">Deals / Promos</th>
                      <th className="pb-1 text-center">User seat invitation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-155">
                    <tr>
                      <td className="py-1 font-bold">Owner / Admin</td>
                      <td className="py-1 text-center text-green-600 font-black">✓</td>
                      <td className="py-1 text-center text-green-600 font-black">✓</td>
                      <td className="py-1 text-center text-green-600 font-black">✓</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">Marketing Manager</td>
                      <td className="py-1 text-center text-green-650 text-green-600">✓</td>
                      <td className="py-1 text-center text-green-600 font-black">✓</td>
                      <td className="py-1 text-center text-red-500 font-black">✗</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold">Support / Creator</td>
                      <td className="py-1 text-center text-amber-500">Only Reviews</td>
                      <td className="py-1 text-center text-red-500 font-black">✗</td>
                      <td className="py-1 text-center text-red-500 font-black">✗</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 8: BRAND INFORMATION */}
      <div id="editor-section-info" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("info")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "info" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">8. Operations & Customer Service Desk</h3>
              <p className="text-[11px] text-[#6B7280]">Contacts, shipping hours, guarantees, warrenties</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "info" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "info" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-4 text-[12px] text-[#111827]">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Corporate HQ Dispatch Address</label>
                <input
                  type="text"
                  value={model.address}
                  onChange={(e) => { updateModelField("address", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Representative Desk Email</label>
                  <input
                    type="email"
                    value={model.contactEmail}
                    onChange={(e) => { updateModelField("contactEmail", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">hotline Contact Phone</label>
                  <input
                    type="text"
                    value={model.phone}
                    onChange={(e) => { updateModelField("phone", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Map Direction Marker Link</label>
                <input
                  type="text"
                  value={model.mapLink}
                  onChange={(e) => { updateModelField("mapLink", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-xs"
                  placeholder="https://maps.google.com/?q=..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Pricing Catalog tier Category</label>
                  <input
                    type="text"
                    value={model.priceRange}
                    onChange={(e) => { updateModelField("priceRange", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Hours Of Hotline Desk</label>
                  <input
                    type="text"
                    value={model.customerServiceHours}
                    onChange={(e) => { updateModelField("customerServiceHours", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Demographics Audience Type</label>
                  <input
                    type="text"
                    value={model.audienceType}
                    onChange={(e) => { updateModelField("audienceType", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Target Age range bounds</label>
                  <input
                    type="text"
                    value={model.ageRange}
                    onChange={(e) => { updateModelField("ageRange", e.target.value); setHasUnsavedChanges(true); }}
                    className="w-full bg-[#F5F5F5] border border-gray-200 p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Standard Guarantee Return Claim Policy</label>
                <textarea
                  rows={2}
                  value={model.returnPolicy}
                  onChange={(e) => { updateModelField("returnPolicy", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-xs leading-normal"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Customer warranties coverage Details</label>
                <input
                  type="text"
                  value={model.warrantyInfo}
                  onChange={(e) => { updateModelField("warrantyInfo", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider mb-1">Delivery / Courier fleet logistics coverage bounds</label>
                <input
                  type="text"
                  value={model.deliveryCoverage}
                  onChange={(e) => { updateModelField("deliveryCoverage", e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full bg-[#F5F5F5] border border-gray-200 px-3 py-2 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 9: VISIBILITY MANAGEMENT */}
      <div id="editor-section-visibility" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => toggleSection("visibility")}
          className={`w-full px-5 py-4 border-l-4 flex items-center justify-between text-left transition-colors ${
            activeSection === "visibility" ? "border-[#F97316] bg-orange-50/10" : "border-transparent bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-orange-50 text-[#F97316] rounded-md">
              <Eye className="w-4 h-4 text-[#F97316]" />
            </span>
            <div>
              <h3 className="text-[13px] font-black text-[#111827] uppercase tracking-wide">9. Page Visibility Controls</h3>
              <p className="text-[11px] text-[#6B7280]">Toggle block visibility on public storefront profiles</p>
            </div>
          </div>
          <span className="text-xs font-black text-gray-400">{activeSection === "visibility" ? "▲" : "▼"}</span>
        </button>

        {activeSection === "visibility" && (
          <div className="p-5 border-t border-gray-100 bg-white space-y-3.5 text-[12px] text-[#111827]">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] leading-relaxed">
              Toggling controls here only adjusts immediate frontend block overlays. Content data is carefully preserved in databases safely.
            </div>

            <div className="space-y-2.5 pt-1 text-[#111827]">
              {[
                { k: "overview" as const, l: "Show Brand Pitch Story & Narrative" },
                { k: "products" as const, l: "Show Complete Catalog list" },
                { k: "featuredProducts" as const, l: "Show Featured Items shelf (maximum of 3)" },
                { k: "deals" as const, l: "Show Active Promo campaign banners" },
                { k: "promoCodes" as const, l: "Show Direct Shopper Vouchers dashboard" },
                { k: "creatorReviews" as const, l: "Show Creator video review stream" },
                { k: "publicReviews" as const, l: "Show Verified Buyers review cards" },
                { k: "trustSection" as const, l: "Show verified scorecard trust metrics" },
                { k: "brandInformation" as const, l: "Show hq address, email, telephone contact lines" }
              ].map(({ k, l }) => (
                <label key={k} className="flex items-center gap-2.5 py-1 text-[12px] font-bold text-gray-700 cursor-pointer hover:text-[#111827] select-none">
                  <input
                    type="checkbox"
                    checked={model.visibility?.[k]}
                    onChange={(e) => {
                      const updatedVis = { ...model.visibility, [k]: e.target.checked };
                      updateModelField("visibility", updatedVis);
                      setHasUnsavedChanges(true);
                    }}
                    className="accent-[#F97316] w-4 h-4 rounded"
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
