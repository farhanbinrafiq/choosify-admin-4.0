// BrandEditStudio.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, RotateCw, Check, AlertCircle, History, Sparkles, ShieldAlert,
  Lock, EyeOff, Heart, Eye, Trash2, Plus, Pencil, Facebook, Instagram,
  Youtube, Phone, Mail, MapPin, Globe, Clock, Copy, PlusCircle, ExternalLink,
  Calendar, Users, Award, Play, Star, Sparkles as SparkleIcon, ArrowUp, ArrowDown, ShieldCheck, Video, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BrandCMSModel, CreatorVideoItem, PromoCodeItem, initialBrandSeeds } from "./brandSeeds";
import { useAuth } from "../../contexts/AuthContext";
import { useBrandProfiles } from "../../contexts/BrandProfilesContext";
import { catalogApi } from "../../services/catalogApi";

const COMPILATION_KEY = "choosify_brand_studio_list";

interface BrandEditStudioProps {
  overrideId?: string;
  isNested?: boolean;
}

export default function BrandEditStudio({ overrideId, isNested }: BrandEditStudioProps = {}) {
  const { id } = useParams<{ id: string }>();
  const { activeBrandId, allBrands } = useAuth();
  const navigate = useNavigate();
  const activeId = overrideId || id || activeBrandId || "1";

  const brandProfilesRef = useRef<any>(null);
  try {
    brandProfilesRef.current = useBrandProfiles();
  } catch (e) {}

  useEffect(() => {
    try {
      brandProfilesRef.current = useBrandProfiles();
    } catch (e) {}
  });

  // Brand Model state
  const [model, setModel] = useState<BrandCMSModel | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Versions and historical rollbacks state
  const [versions, setVersions] = useState<{ timestamp: string; label: string; snapshot: BrandCMSModel }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Exit Modal, Publish Modal, and Drawer state
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"header" | "creators" | "promos" | "overview" | null>(null);

  // --- DRAWER WORKSPACE FORM STATES ---
  // Header editing temporal state
  const [headerForm, setHeaderForm] = useState({
    brandName: "",
    category: "",
    logo: "",
    coverImage: "",
    tagline: "",
    socialFbUrl: "",
    socialInstaUrl: "",
    socialTiktokUrl: "",
    socialYtUrl: "",
    website: ""
  });

  // Creators list temporal copy
  const [tempCreators, setTempCreators] = useState<CreatorVideoItem[]>([]);
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null);
  const [creatorForm, setCreatorForm] = useState({
    title: "",
    sourceUrl: "",
    platform: "youtube" as "youtube" | "instagram" | "tiktok" | "facebook",
    thumbnailUrl: "",
    duration: "",
    creatorName: "",
    views: 0,
    clicks: 0
  });

  // Promo Vouchers list temporal copy
  const [tempPromos, setTempPromos] = useState<PromoCodeItem[]>([]);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discountType: "Percentage" as "Percentage" | "Flat",
    discountValue: 0,
    startDate: "",
    endDate: "",
    usageLimit: 500,
    enabled: true,
    targetAudience: "All Customers" as "New Customers" | "Existing Customers" | "All Customers"
  });

  // Brand Overview temporal state
  const [overviewForm, setOverviewForm] = useState({
    address: "",
    website: "",
    mapLink: "",
    contactEmail: "",
    phone: "",
    priceRange: "",
    minPrice: 0,
    maxPrice: 0,
    ageRange: "",
    genders: [] as string[],
    services: [] as string[],
    bestForTags: [] as string[]
  });

  // Load state on mount
  useEffect(() => {
    const draftKey = `choosify_brand_draft_${activeId}`;
    const pubKey = `choosify_brand_published_${activeId}`;
    const versionsKey = `choosify_brand_versions_${activeId}`;
    
    let loaded: BrandCMSModel | null = null;
    const cacheDraft = localStorage.getItem(draftKey);
    if (cacheDraft) {
      try { loaded = JSON.parse(cacheDraft); } catch (_) {}
    }
    if (!loaded) {
      const cachePub = localStorage.getItem(pubKey);
      if (cachePub) {
        try { loaded = JSON.parse(cachePub); } catch (_) {}
      }
    }
    if (!loaded) {
      const seed = initialBrandSeeds[activeId];
      if (seed) {
        loaded = JSON.parse(JSON.stringify(seed));
      } else {
        const fallSeed = initialBrandSeeds["1"] || Object.values(initialBrandSeeds)[0];
        if (fallSeed) {
          loaded = JSON.parse(JSON.stringify(fallSeed));
          if (loaded) {
            loaded.id = activeId;
            const matchedBrand = allBrands.find(b => b.id === activeId);
            if (matchedBrand) {
              loaded.brandName = matchedBrand.name;
              loaded.category = matchedBrand.category;
            }
          }
        }
      }
    }
    if (loaded) {
      setModel(loaded);
    }

    const cachedVersions = localStorage.getItem(versionsKey);
    if (cachedVersions) {
      try { setVersions(JSON.parse(cachedVersions)); } catch (_) {}
    }
  }, [activeId]);

  // Toast notifier trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- DRAWER SEED TRIGGER ACTIONS ---
  const openEditDrawer = (type: "header" | "creators" | "promos" | "overview") => {
    if (!model) return;
    setActiveDrawer(type);

    if (type === "header") {
      setHeaderForm({
        brandName: model.brandName || "",
        category: model.category || "",
        logo: model.logo || "",
        coverImage: model.coverImage || "",
        tagline: model.tagline || "",
        socialFbUrl: model.socialFbUrl || "",
        socialInstaUrl: model.socialInstaUrl || "",
        socialTiktokUrl: model.socialTiktokUrl || "",
        socialYtUrl: model.socialYtUrl || "",
        website: model.website || ""
      });
    } else if (type === "creators") {
      setTempCreators(JSON.parse(JSON.stringify(model.creators || [])));
      setEditingCreatorId(null);
      resetCreatorForm();
    } else if (type === "promos") {
      setTempPromos(JSON.parse(JSON.stringify(model.promoCodes || [])));
      setEditingPromoId(null);
      resetPromoForm();
    } else if (type === "overview") {
      // Map gender focus checklist
      const gendersList: string[] = [];
      if (model.genderFocus) {
        if (model.genderFocus.includes("Male")) gendersList.push("Male");
        if (model.genderFocus.includes("Female")) gendersList.push("Female");
        if (model.genderFocus.includes("Youth")) gendersList.push("Youth");
        if (model.genderFocus.includes("Kids")) gendersList.push("Kids");
        if (model.genderFocus.includes("Unisex")) gendersList.push("Unisex");
      }
      setOverviewForm({
        address: model.address || "",
        website: model.website || "",
        mapLink: model.mapLink || "",
        contactEmail: model.contactEmail || "",
        phone: model.phone || "",
        priceRange: model.priceRange || "",
        minPrice: 500,
        maxPrice: 350000,
        ageRange: model.ageRange || "18 - 55 Years",
        genders: gendersList,
        services: [...(model.services || [])],
        bestForTags: [...(model.bestForTags || [])]
      });
    }
  };

  const resetCreatorForm = () => {
    setCreatorForm({
      title: "",
      sourceUrl: "",
      platform: "youtube",
      thumbnailUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
      duration: "10:00",
      creatorName: "",
      views: 12000,
      clicks: 800
    });
  };

  const resetPromoForm = () => {
    setPromoForm({
      code: "",
      discountType: "Percentage",
      discountValue: 10,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      usageLimit: 1000,
      enabled: true,
      targetAudience: "All Customers"
    });
  };

  const autoGeneratePromoCode = () => {
    if (!model) return;
    const tag = (model.brandName || "SAM").toUpperCase().slice(0, 4).replace(/\s+/g, "");
    const randomValue = Math.floor(100 + Math.random() * 900);
    const generated = `${tag}${randomValue}`;
    setPromoForm(prev => ({ ...prev, code: generated }));
  };

  // --- SAVE PORTAL STATE WRITERS ---
  const saveHeaderSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      brandName: headerForm.brandName,
      category: headerForm.category,
      logo: headerForm.logo,
      coverImage: headerForm.coverImage,
      tagline: headerForm.tagline,
      socialFbUrl: headerForm.socialFbUrl,
      socialInstaUrl: headerForm.socialInstaUrl,
      socialTiktokUrl: headerForm.socialTiktokUrl,
      socialYtUrl: model.socialYtUrl,
      website: headerForm.website
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Brand Header Information Updated");
  };

  const saveCreatorsSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      creators: tempCreators
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Creator Content Updated Successfully");
  };

  const savePromosSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      promoCodes: tempPromos
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Promo Codes Updated Successfully");
  };

  const saveOverviewSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      address: overviewForm.address,
      website: overviewForm.website,
      mapLink: overviewForm.mapLink,
      contactEmail: overviewForm.contactEmail,
      phone: overviewForm.phone,
      priceRange: overviewForm.priceRange,
      ageRange: overviewForm.ageRange,
      genderFocus: overviewForm.genders.join(", "),
      services: overviewForm.services,
      bestForTags: overviewForm.bestForTags
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Brand Overview Saved Successfully");
  };

  // --- PERSISTENCE: SAVE DRAFT & LIVE PUBLISH HANDLERS ---
  const handleSaveDraft = () => {
    if (!model) return;
    const draftKey = `choosify_brand_draft_${activeId}`;
    localStorage.setItem(draftKey, JSON.stringify(model));
    setHasUnsavedChanges(false);

    // Save state version history snapshot
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nextVer = {
      timestamp: timeStr,
      label: `Draft Saved: ${model.brandName}`,
      snapshot: model
    };
    const updatedVersions = [nextVer, ...versions.slice(0, 8)];
    setVersions(updatedVersions);
    const versionsKey = `choosify_brand_versions_${activeId}`;
    localStorage.setItem(versionsKey, JSON.stringify(updatedVersions));

    triggerToast("✓ Draft Saved Locally!");
  };

  const handlePublishChanges = () => {
    if (!model) return;
    setIsPublishing(true);
    setShowPublishModal(false);

    setTimeout(() => {
      const pubKey = `choosify_brand_published_${activeId}`;
      const draftKey = `choosify_brand_draft_${activeId}`;
      localStorage.setItem(pubKey, JSON.stringify(model));
      localStorage.setItem(draftKey, JSON.stringify(model));
      setHasUnsavedChanges(false);

      catalogApi
        .updateBrand(activeId, {
          name: model.brandName,
          category: model.category,
          description: model.description,
          logo: model.logoUrl,
        })
        .catch((err) => console.warn('[BrandEditStudio] Catalog brand sync failed', err));

      // Write updates into standard dashboard brands registry
      const cachedList = localStorage.getItem(COMPILATION_KEY);
      if (cachedList) {
        try {
          const list = JSON.parse(cachedList);
          const updatedList = list.map((item: any) => {
            if (item.id === activeId) {
              return {
                ...item,
                brandName: model.brandName,
                category: model.category,
                status: "Live" as const,
                lastUpdated: "Just Now",
                trustScore: model.choosifyScore
              };
            }
            return item;
          });
          localStorage.setItem(COMPILATION_KEY, JSON.stringify(updatedList));
        } catch (_) {}
      }

      // Also update BrandProfilesContext so the brands list reflects this edit
      try {
        const { updateProfile } = brandProfilesRef.current || {};
        if (updateProfile && activeId) {
          updateProfile(activeId, {
            name: model.brandName,
            category: model.category,
            logo: model.logo,
            coverImage: model.coverImage,
            websiteUrl: model.website,
            facebookUrl: model.socialFbUrl,
            instagramUrl: model.socialInstaUrl,
            youtubeUrl: model.socialYtUrl,
            description: model.tagline,
          });
        }
      } catch (err) {
        // Context update is best-effort; localStorage is the source of truth for now
      }

      setIsPublishing(false);
      triggerToast("🚀 Brand Profile Published Live in Bangladesh!");
    }, 1200);
  };

  const restoreVersion = (snapshot: BrandCMSModel) => {
    setModel(JSON.parse(JSON.stringify(snapshot)));
    setHasUnsavedChanges(true);
    setShowVersions(false);
    triggerToast("✓ Snapshot restored successfully!");
  };

  // --- DYNAMIC CREATORS ENGINE: REORDER, DEFINE, OR FEATURE ---
  const toggleFeatureCreator = (id: string) => {
    setTempCreators(prev => prev.map(c => ({
      ...c,
      status: (c.id === id ? "Approved" : c.status) as any // Mark approved for feature view
    })));
  };

  const deleteCreatorItem = (id: string) => {
    setTempCreators(prev => prev.filter(c => c.id !== id));
  };

  const moveCreatorOrder = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === tempCreators.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const next = [...tempCreators];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setTempCreators(next);
  };

  const addOrUpdateCreator = () => {
    if (!creatorForm.title || !creatorForm.creatorName) {
      alert("Please fill Title and Creator Handle");
      return;
    }

    if (editingCreatorId) {
      setTempCreators(prev => prev.map(c => c.id === editingCreatorId ? {
        ...c,
        title: creatorForm.title,
        sourceUrl: creatorForm.sourceUrl,
        platform: creatorForm.platform,
        thumbnailUrl: creatorForm.thumbnailUrl,
        duration: creatorForm.duration,
        creatorName: creatorForm.creatorName,
        views: Number(creatorForm.views),
        clicks: Number(creatorForm.clicks)
      } : c));
      setEditingCreatorId(null);
    } else {
      const newItem: CreatorVideoItem = {
        id: "cr_" + Math.random().toString(36).substr(2, 9),
        title: creatorForm.title,
        sourceUrl: creatorForm.sourceUrl,
        platform: creatorForm.platform,
        thumbnailUrl: creatorForm.thumbnailUrl || "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
        duration: creatorForm.duration || "12:00",
        creatorName: creatorForm.creatorName,
        views: Number(creatorForm.views) || 24000,
        clicks: Number(creatorForm.clicks) || 500,
        status: "Approved"
      };
      setTempCreators(prev => [newItem, ...prev]);
    }
    resetCreatorForm();
  };

  // --- DYNAMIC PROMOS ENGINE: DEACTIVATE, COPY, DUPLICATE ---
  const changePromoEnabled = (id: string, enabled: boolean) => {
    setTempPromos(prev => prev.map(p => p.id === id ? { ...p, enabled } : p));
  };

  const deletePromoItem = (id: string) => {
    setTempPromos(prev => prev.filter(p => p.id !== id));
  };

  const duplicatePromoItem = (id: string) => {
    const target = tempPromos.find(p => p.id === id);
    if (!target) return;
    const copied: PromoCodeItem = {
      ...target,
      id: "pr_" + Math.random().toString(36).substr(2, 9),
      code: `${target.code}-COPY`,
      enabled: false
    };
    setTempPromos(prev => [...prev, copied]);
  };

  const addOrUpdatePromo = () => {
    if (!promoForm.code || !promoForm.discountValue) {
      alert("Please enter Promo Code and discount values");
      return;
    }

    const valueObject = {
      code: promoForm.code.toUpperCase(),
      discountType: promoForm.discountType,
      discountValue: Number(promoForm.discountValue),
      startDate: promoForm.startDate,
      endDate: promoForm.endDate,
      usageLimit: Number(promoForm.usageLimit),
      enabled: promoForm.enabled
    };

    if (editingPromoId) {
      setTempPromos(prev => prev.map(p => p.id === editingPromoId ? { ...p, ...valueObject } : p));
      setEditingPromoId(null);
    } else {
      const newItem: PromoCodeItem = {
        id: "pr_" + Math.random().toString(36).substr(2, 9),
        ...valueObject
      };
      setTempPromos(prev => [...prev, newItem]);
    }
    resetPromoForm();
  };

  // --- FILTERED CREATOR LIST FOR FRONTEND VIEW ---
  const activeCreator = useMemo(() => {
    if (!model) return null;
    const pool = model.creators || [];
    const approved = pool.filter(c => c.status === "Approved");
    return approved[0] || pool[0] || null;
  }, [model]);

  const filteredCreatorsList = useMemo(() => {
    if (!model) return [];
    const pool = model.creators || [];
    const filtered = pool.filter(c => {
      if (creatorFilter === "ALL") return true;
      return c.platform.toLowerCase() === creatorFilter.toLowerCase();
    });
    // Skip the featured one at the top is fine or show all. Let's show all in the filter list!
    return filtered;
  }, [model, creatorFilter]);

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-slate-500">
        <RotateCw className="w-10 h-10 animate-spin text-[#F97316]" />
        <span className="text-xs font-mono">Loading Choosify Enterprise Workspace...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-slate-900 select-none pb-12 relative overflow-x-hidden">
      
      {/* TOP HEADER STATUS TOOLBAR */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => hasUnsavedChanges ? setShowExitModal(true) : navigate(isNested ? "/dashboard/content-studio/brands" : "/admin/brands")}
            className="p-2 bg-slate-100 text-slate-750 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 text-[#1a1a2e]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-[#1a1a2e]">{model.brandName}</h1>
              <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold px-1.5 flex items-center gap-0.5">
                ● LIVE PROFILE
              </span>
            </div>
            <p className="text-[10px] text-slate-550 font-mono tracking-wider">Choosify V3 Dashboard Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-[#EF3C23] text-[10px] font-mono font-bold animate-pulse">
              ● UNSAVED DRAFT CHANGES
            </span>
          )}

          {/* VersionsDropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-[#1a1a2e] hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <History className="w-4 h-4 text-[#EF3C23]" />
              <span>Snapshots ({versions.length})</span>
            </button>
            {showVersions && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80 z-40 text-left text-slate-800">
                <p className="text-xs font-black uppercase text-[#EF3C23] border-b border-slate-100 pb-2">History Logs & Revisions</p>
                {versions.length === 0 ? (
                  <p className="text-[11px] font-mono text-slate-450 py-4">No snapshots registered in this session.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto mt-2 custom-scrollbar">
                    {versions.map((ver, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-150 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>{ver.timestamp}</span>
                          <button 
                            onClick={() => setConfirmingId(ver.timestamp)}
                            className="font-bold text-[#EF3C23] hover:underline text-[10px]"
                          >
                            RESTORE
                          </button>
                        </div>
                        <span className="text-xs font-semibold truncate text-[#1a1a2e]">{ver.label}</span>

                        {confirmingId === ver.timestamp && (
                          <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-red-600">Restore snapshot? Current draft will become unsaved.</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { restoreVersion(ver.snapshot); setConfirmingId(null); }}
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#1a1a2e] font-bold text-xs rounded-xl transition"
          >
            Save Draft
          </button>

          <button
            onClick={() => setShowPublishModal(true)}
            className="px-5 py-2 bg-[#EF3C23] hover:bg-red-600 text-app-text-primary font-black rounded-xl text-xs shadow-md transition"
          >
            Publish Live Profile
          </button>
        </div>
      </header>

      {/* --- CORE SECTON PROFILE MANAGEMENT WORKSPACE --- */}
      <main className="max-w-6xl mx-auto w-full px-4 pt-8 space-y-8">
        
        {/* ========================================================== */}
        {/* SECTION 1: BRAND HEADER HERO CARD */}
        {/* ========================================================== */}
        <div className="bg-white text-[#1a1a2e] rounded-3xl overflow-hidden relative border border-slate-200 group shadow-sm">
          
          {/* Edit icon overlay bottom/top */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => openEditDrawer("header")}
              className="p-2.5 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT</span>
            </button>
          </div>

          {/* Banner cover background */}
          <div className="h-44 md:h-56 relative bg-slate-100">
            {model.coverImage ? (
              <img src={model.coverImage} alt="" className="w-full h-full object-cover filter brightness-95" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-slate-100 to-slate-200 flex items-center justify-center text-xs text-slate-450">
                Choosify Banner Cover Photo Placeholder
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
          </div>

          {/* Identity details with Split structure */}
          <div className="px-6 pb-8 -mt-16 relative flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            
            {/* Left side details */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <img 
                src={model.logo || "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=120"} 
                alt="" 
                className="w-24 h-24 object-cover rounded-2xl border-4 border-white bg-white shadow-md shrink-0"
              />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                  <h2 className="text-xl md:text-2xl font-black text-[#1a1a2e] tracking-tight">{model.brandName}</h2>
                  {model.verificationStatus === "Verified" ? (
                    <span className="p-1 px-2 text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-black uppercase flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> VERIFIED BRAND
                    </span>
                  ) : (
                    <span className="p-1 bg-slate-100 text-slate-600 text-[9px] font-mono leading-none rounded">
                      Standard Profile
                    </span>
                  )}
                </div>
                <p className="text-[#EF3C23] text-[11px] font-extrabold uppercase tracking-widest">{model.category}</p>
                <div className="flex items-center gap-1.5 justify-center sm:justify-start text-xs text-slate-600">
                  <Heart className="w-3.5 h-3.5 text-[#EF3C23] fill-[#EF3C23]" />
                  <span className="font-extrabold text-[#1a1a2e]">50,050 SHOPPERS</span>
                  <span className="text-slate-500 font-medium">LOVES THE BRANDS</span>
                </div>
              </div>
            </div>

            {/* CTA action buttons representation */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 md:mt-0">
              <div className="flex flex-col items-center">
                <button className="px-5 py-2.5 bg-[#EF3C23] hover:bg-red-650 text-app-text-primary text-xs font-black uppercase tracking-wider rounded-xl shadow transition flex items-center gap-1 border-none cursor-pointer">
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span>LOVE BRAND</span>
                </button>
                <span className="text-[10px] text-slate-500 font-mono font-bold mt-1">50,000 LOVES</span>
              </div>
              <div className="flex flex-col items-center">
                <button className="px-5 py-2.5 bg-white text-[#1a1a2e] border border-slate-200 hover:bg-slate-50 text-xs font-black uppercase tracking-wider rounded-xl shadow transition cursor-pointer">
                  FOLLOW THE BRAND
                </button>
                <span className="text-[10px] text-slate-500 font-mono font-bold mt-1">50,000 FOLLOWERS</span>
              </div>
            </div>

            {/* Right side Score Panel display representation from Image layout */}
            <div className="flex flex-col items-end text-right w-full md:w-auto border-t md:border-t-0 border-slate-150 pt-4 md:pt-0">
              <div className="bg-[#f8f9fb] border border-slate-200 rounded-2xl p-4 w-full md:w-56 text-center relative overflow-hidden shadow-sm">
                <span className="absolute -top-1 -left-1 text-[8px] bg-emerald-500 text-white font-mono uppercase px-1.5 rounded">AUTO</span>
                <p className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-wider">TRUST SCORE</p>
                <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono my-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <span>{model.choosifyScore * 20 || 92} / 100</span>
                </div>
                <button className="text-[10px] text-[#EF3C23] hover:text-red-700 font-black uppercase hover:underline flex items-center gap-1 mx-auto mt-1 cursor-pointer bg-transparent border-none">
                  <span>VIEW SCORE BOARD</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Read only stats visual indicators with lock icon */}
              <div className="flex gap-4 mt-3 w-full justify-center md:justify-end text-[10px] text-slate-500">
                <span className="flex items-center gap-1 border border-slate-200 bg-[#f8f9fb] px-2 py-1 rounded" title="Calculated Automatically. Read only.">
                  <Lock className="w-2.5 h-2.5 text-app-text-secondary" /> Validation Status: <span className="font-bold text-slate-650 text-slate-600">{model.verificationStatus}</span>
                </span>
              </div>
            </div>

          </div>

          {/* Social Icons footer area inside card banner */}
          <div className="border-t border-slate-200 px-6 py-4 bg-[#f8f9fb] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">FIND US ON</span>
              <div className="flex items-center gap-2">
                {model.socialFbUrl && (
                  <a href={model.socialFbUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-650 hover:text-[#EF3C23] transition" title="Facebook">
                    <Facebook className="w-3.5 h-3.5" />
                  </a>
                )}
                {model.socialInstaUrl && (
                  <a href={model.socialInstaUrl} target="_blank" rel="noreferrer" className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-650 hover:text-[#EF3C23] transition" title="Instagram">
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                )}
                {model.website && (
                  <a href={model.website} target="_blank" rel="noreferrer" className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-650 hover:text-[#EF3C23] transition" title="Official Storefront Website">
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            {model.tagline && (
              <p className="text-xs text-slate-500 italic">"{model.tagline}"</p>
            )}
          </div>

        </div>

        {/* ========================================================== */}
        {/* SECTION 2: BRAND STATS BAR (Read-Only) */}
        {/* ========================================================== */}
        <div className="bg-white text-[#1a1a2e] border border-slate-200 rounded-3xl py-4 px-6 grid grid-cols-3 divide-x divide-slate-200 shadow-sm select-none">
          <div className="text-center relative">
            <span className="absolute top-0 left-2 text-[8px] bg-slate-100 text-slate-500 p-0.5 rounded font-mono leading-none flex items-center gap-0.5" title="Calculated Automatically">
              <Lock className="w-2 h-2" /> AUTO
            </span>
            <p className="text-[10px] uppercase font-black tracking-widest text-[#1a1a2e]">TOTAL DEALS LISTED</p>
            <p className="text-xl md:text-2xl font-black text-[#EF3C23] font-mono mt-0.5">{model.deals?.length || 20}</p>
          </div>
          
          <div className="text-center relative">
            <span className="absolute top-0 left-2 text-[8px] bg-slate-100 text-slate-500 p-0.5 rounded font-mono leading-none flex items-center gap-0.5" title="Calculated Automatically">
              <Lock className="w-2 h-2" /> AUTO
            </span>
            <p className="text-[10px] uppercase font-black tracking-widest text-[#1a1a2e]">TOTAL PRODUCTS LISTED</p>
            <p className="text-xl md:text-2xl font-black text-[#EF3C23] font-mono mt-0.5">{model.products?.length || 300}</p>
          </div>

          <div className="text-center relative">
            <span className="absolute top-0 left-2 text-[8px] bg-slate-100 text-slate-500 p-0.5 rounded font-mono leading-none flex items-center gap-0.5" title="Calculated Automatically">
              <Lock className="w-2 h-2" /> AUTO
            </span>
            <p className="text-[10px] uppercase font-black tracking-widest text-[#1a1a2e]">TOTAL PROMO CODES LISTED</p>
            <p className="text-xl md:text-2xl font-black text-[#EF3C23] font-mono mt-0.5">{model.promoCodes?.length || 5}</p>
          </div>
        </div>

        {/* ========================================================== */}
        {/* SECTION 3: CREATOR EXPERIENCES (65%) + PROMO CODES (35%) */}
        {/* ========================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: CREATOR EXPERIENCES (Light Card Layout) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 text-[#1a1a2e] rounded-3xl p-6 relative group shadow-sm">
            
            {/* Edit pencil icon */}
            <button
              onClick={() => openEditDrawer("creators")}
              className="absolute top-5 right-5 p-2 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-xl transition duration-200 cursor-pointer"
              title="Edit Creator Reviews"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <span className="text-[9px] font-black tracking-widest text-[#EF3C23] uppercase">BRAND CAMPAIGNS & INFLUENCERS</span>
            <h3 className="text-md font-black text-[#1a1a2e] mt-1 tracking-tight">
              CREATOR EXPERIENCES WITH {model.brandName.toUpperCase()}
            </h3>

            {/* Filter platforms tabs */}
            <div className="flex flex-wrap items-center gap-1.5 mt-5 border-b border-slate-100 pb-4">
              {["ALL", "YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCreatorFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition cursor-pointer${
                    creatorFilter === tab 
                      ? "bg-[#EF3C23] text-white" 
                      : "bg-[#f8f9fb] text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Feature Content card visualization */}
            {activeCreator ? (
              <div className="mt-6 bg-[#f8f9fb] border border-slate-200 rounded-2xl overflow-hidden p-4 relative group/video">
                <span className="absolute top-4 left-4 z-10 bg-red-650 bg-[#EF3C23] text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                  <Play className="w-2 h-2 fill-white" /> {activeCreator.platform.toUpperCase()} PARTNERSHIP
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-5 aspect-video md:aspect-[4/3] relative rounded-xl overflow-hidden bg-app-card group-hover:shadow-md transition">
                    <img src={activeCreator.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-12 h-12 bg-[#EF3C23] hover:scale-110 duration-250 cursor-pointer shadow-2xl text-app-text-primary rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-app-card/20 text-[10px] text-app-text-primary px-2 py-0.5 rounded font-mono font-bold">
                      {activeCreator.duration}
                    </span>
                  </div>

                  <div className="md:col-span-7 space-y-3 text-left">
                    <h4 className="text-sm font-bold text-[#1a1a2e] leading-snug">{activeCreator.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-light line-clamp-3">
                      Empowered by standard Choosify distribution and partner endorsement campaigns inside Bangladesh.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {(activeCreator.views || 124000).toLocaleString()} Views</span>
                      <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current text-orange-400" /> Authorized</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <div className="w-8 h-8 rounded-full bg-[#EF3C23] flex items-center justify-center font-black text-app-text-primary text-[10px]">
                        {activeCreator.creatorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1a1a2e]">@{activeCreator.creatorName}</p>
                        <p className="text-[10px] text-slate-500">Collaborator Partner • Dhaka</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-8">No approved creator content found.</p>
            )}

            {/* Additional Creator Content Grid (3 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {filteredCreatorsList.slice(0, 3).map((v) => (
                <div key={v.id} className="bg-[#f8f9fb] border border-slate-200 p-3 rounded-2xl flex flex-col justify-between hover:border-slate-300 transition space-y-3 text-left">
                  <div className="aspect-video relative rounded-lg overflow-hidden bg-slate-100">
                    <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover filter brightness-90" />
                    <span className="absolute bottom-1 right-1 bg-app-card/20 text-app-text-primary p-0.5 rounded text-[8px] font-mono leading-none">
                      {v.duration}
                    </span>
                    <div className="absolute top-1 left-1 bg-app-card/20 text-app-text-primary px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">
                      {v.platform}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#1a1a2e] line-clamp-2 leading-tight">{v.title}</h5>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">@{v.creatorName}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action button at bottom */}
            <div className="mt-8 border-t border-slate-200 pt-4 text-center">
              <button
                onClick={() => openEditDrawer("creators")}
                className="w-full py-3 bg-white hover:bg-[#f8f9fb] border border-[#EF3C23] text-xs text-[#EF3C23] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add / Manage Creator Review</span>
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: PROMO CODES (Light Card Layout) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 relative group shadow-sm text-left">
            
            {/* Edit pencil icon */}
            <button
              onClick={() => openEditDrawer("promos")}
              className="absolute top-5 right-5 p-2 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-xl transition duration-200 cursor-pointer"
              title="Edit Promo Vouchers"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-black text-[#EF3C23] tracking-widest uppercase">PROMO VOUCHERS</span>
            <div className="flex items-center gap-1.5 mt-1 border-b border-rose-50 pb-3">
              <h3 className="text-md font-black text-[#1a1a2e]">PROMO CODES</h3>
              <span className="p-0.5 px-2 bg-orange-50 text-[#EF3C23] rounded-full text-[9px] font-extrabold border border-orange-200">
                {model.promoCodes?.filter(p => p.enabled).length || 3} verified
              </span>
            </div>

            {/* Promo coupons details list */}
            <div className="space-y-4 mt-6">
              {(model.promoCodes || []).map((code) => (
                <div 
                  key={code.id}
                  className={`border rounded-2xl p-4 text-center relative overflow-hidden transition${
                    code.enabled ? "bg-[#f8f9fb] border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
                  }`}
                >
                  <span className="text-[9px] bg-white text-[#EF3C23] font-extrabold uppercase px-2 py-0.5 rounded-full absolute top-2 left-2 border border-slate-200">
                    {code.discountType === "Percentage" ? `${code.discountValue}% OFF` : `BDT ${code.discountValue} FLAT`}
                  </span>

                  <div className="mt-4">
                    <p className="text-xs font-black uppercase text-[#1a1a2e]">
                      {code.discountType === "Percentage" ? `${code.discountValue}% SAVINGS GIFT` : `BDT ${code.discountValue} FLAT DISCOUNT`}
                    </p>
                    <p className="text-[10px] text-slate-550 mt-1">Minimum purchase requirement apply</p>
                  </div>

                  {/* Promo Box highlighted inside code box */}
                  <div className="mt-4 border-2 border-dashed border-[#EF3C23]/40 bg-orange-50/20 p-2.5 rounded-xl font-mono text-sm font-black text-[#EF3C23] flex items-center justify-between gap-1">
                    <span>{code.code}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard?.writeText(code.code);
                        triggerToast("Coupon Code Copied to Clipboard!");
                      }}
                      className="p-1 text-slate-500 hover:text-[#EF3C23] rounded bg-transparent border-none cursor-pointer"
                      title="Copy Coupon Code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[9px] text-[#1a1a2e] font-mono mt-3">Valid till {code.endDate || "Dec 31, 2026"}</p>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* ========================================================== */}
        {/* SECTION 4: BRAND OVERVIEW DETAILS */}
        {/* ========================================================== */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 relative group shadow-sm text-left">
          
          {/* Edit icon pencil */}
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={() => openEditDrawer("overview")}
              className="p-2.5 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-xl transition duration-200 flex items-center gap-1.5 text-xs font-black uppercase shadow-sm cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT OVERVIEW</span>
            </button>
          </div>

          <span className="text-[10px] font-black tracking-widest text-[#EF3C23] uppercase">OUR HERITAGE BRAND SPECIFICATIONS</span>
          <h3 className="text-lg font-black text-[#1a1a2e] mt-1">BRAND OVERVIEW</h3>
          <p className="text-xs text-app-text-secondary font-mono mt-0.5">{model.brandName}</p>

          {/* Overview Grid sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            
            {/* Card 1: Shop Address & Links */}
            <div className="bg-[#F8FAFC] border border-slate-250 border-slate-200 p-5 rounded-2xl min-h-[160px] flex flex-col justify-between relative">
              <span className="absolute top-2 right-2 text-md">🏢</span>
              <div className="space-y-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#F97316] block">SHOP ADDRESS & LINKS</span>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed font-mono">{model.address}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200">
                <a 
                  href={model.mapLink || "#"} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs font-extrabold uppercase text-[#F97316] hover:underline flex items-center gap-1.5"
                >
                  <span>OPEN ON MAPS</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Card 2: Contact Info */}
            <div className="bg-[#F8FAFC] border border-slate-200 p-5 rounded-2xl min-h-[160px] flex flex-col justify-between relative">
              <span className="absolute top-2 right-2 text-md">📞</span>
              <div className="space-y-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#F97316] block">CONTACT INFORMATIONS</span>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-bold font-mono">EMAIL DESK:</p>
                  <p className="text-xs font-semibold text-slate-850 font-mono text-slate-800">{model.contactEmail}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-bold font-mono">PHONE SERVICE:</p>
                  <p className="text-xs font-semibold text-slate-850 font-mono text-slate-800">{model.phone}</p>
                </div>
              </div>
            </div>

            {/* Card 3: Price & Audience */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-5 rounded-2xl min-h-[160px] flex flex-col justify-between relative col-span-1 md:col-span-1">
              <span className="absolute top-2 right-2 text-md">🎯</span>
              <div className="space-y-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#F97316] block">PRICE & AUDIENCE</span>
                <div className="space-y-1 text-xs">
                  <p className="text-app-text-secondary font-bold">BDT RANGE: <span className="text-slate-850 font-black text-slate-800">{model.priceRange || "General / Medium"}</span></p>
                  <p className="text-app-text-secondary font-bold">AGE FOCUS: <span className="text-[#0B122C] font-black">{model.ageRange}</span></p>
                  <p className="text-slate-450 font-black text-[#F97316] tracking-wide mt-1 uppercase text-[10px]">{model.genderFocus || "Unisex focus"}</p>
                </div>
              </div>
            </div>

            {/* Card 4: Services Specialties */}
            <div className="bg-[#F8FAFC] border border-slate-200 p-5 rounded-2xl min-h-[160px] col-span-1 md:col-span-2 relative">
              <span className="absolute top-2 right-2 text-md">🏅</span>
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#F97316] block">SERVICES & SPECIALTIES</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {(model.services || []).map((srv, idx) => (
                  <li key={idx} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#F97316] rounded-full" />
                    <span>{srv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 5: Best For Tags */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-5 rounded-2xl min-h-[160px] col-span-1 md:col-span-1 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#F97316] block">BEST FOR TAGS</span>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {(model.bestForTags || []).map((tag, idx) => (
                    <span key={idx} className="p-1 px-2.5 bg-transparent text-[#8A00C4] rounded-lg text-[10px] font-bold uppercase">
                      #{tag}
                    </span>
                  ))}
                  {(!model.bestForTags || model.bestForTags.length === 0) && (
                    <p className="text-xs text-app-text-secondary italic">No brand tags added.</p>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* --- FLOATING MODULAR SLIDING DRAWER SYSTEM (480px) --- */}
      <AnimatePresence>
        {activeDrawer && (
          <>
            {/* Backdrop cover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-app-card z-40"
            />

            {/* Slide-out Panel Right Side */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto px-6 py-6 text-left flex flex-col justify-between custom-scrollbar"
            >
              
              {/* Drawer Title Header */}
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      {activeDrawer === "header" && "Edit Brand Header"}
                      {activeDrawer === "creators" && "Manage Creator Hub"}
                      {activeDrawer === "promos" && "Manage Vouchers"}
                      {activeDrawer === "overview" && "Edit Overview Specs"}
                    </h3>
                    <p className="text-[10px] text-slate-405 font-mono text-slate-500">Live Workspace Profile Control Panel</p>
                  </div>
                  <button 
                    onClick={() => setActiveDrawer(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-app-text-secondary"
                  >
                    ✕
                  </button>
                </div>

                {/* DRAWERS SECTON: 1. BRAND HEADER */}
                {activeDrawer === "header" && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Brand Corporate Name</label>
                      <input 
                        type="text"
                        value={headerForm.brandName}
                        onChange={e => setHeaderForm(prev => ({ ...prev, brandName: e.target.value }))}
                        className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 border-slate-200 font-bold focus:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Brand Focus Category</label>
                      <input 
                        type="text"
                        value={headerForm.category}
                        onChange={e => setHeaderForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 border-slate-200 focus:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Logo URL Address</label>
                      <input 
                        type="text"
                        value={headerForm.logo}
                        onChange={e => setHeaderForm(prev => ({ ...prev, logo: e.target.value }))}
                        className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 border-slate-200 focus:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cover Banner Image URL</label>
                      <input 
                        type="text"
                        value={headerForm.coverImage}
                        onChange={e => setHeaderForm(prev => ({ ...prev, coverImage: e.target.value }))}
                        className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 border-slate-200 focus:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Brand Tagline</label>
                      <input 
                        type="text"
                        value={headerForm.tagline}
                        onChange={e => setHeaderForm(prev => ({ ...prev, tagline: e.target.value }))}
                        className="w-full p-2.5 border rounded-xl text-xs bg-slate-50 border-slate-200 focus:ring-[#F97316]"
                      />
                    </div>
                    
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <p className="text-[9px] font-black text-app-text-secondary uppercase">Social Connectivity Coordinates</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Facebook URL</label>
                          <input 
                            type="text"
                            value={headerForm.socialFbUrl}
                            onChange={e => setHeaderForm(prev => ({ ...prev, socialFbUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-slate-50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Instagram URL</label>
                          <input 
                            type="text"
                            value={headerForm.socialInstaUrl}
                            onChange={e => setHeaderForm(prev => ({ ...prev, socialInstaUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-slate-50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Official Storefront Website Domain</label>
                        <input 
                          type="text"
                          value={headerForm.website}
                          onChange={e => setHeaderForm(prev => ({ ...prev, website: e.target.value }))}
                          className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-slate-50"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1 relative">
                      <span className="block text-[10px] font-bold text-app-text-secondary">READ ONLY SECTOR</span>
                      <p className="text-xs text-slate-500">Verification Seal: <span className="font-bold text-red-600">{model.verificationStatus}</span></p>
                      <span className="absolute top-2 right-2 text-app-text-secondary"><Lock className="w-3.5 h-3.5" /></span>
                    </div>
                  </div>
                )}

                {/* DRAWERS SECTON: 2. CREATORS EXPERIENCES LIST EDITOR */}
                {activeDrawer === "creators" && (
                  <div className="space-y-5">
                    
                    {/* Creators list visual editor list */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto space-y-2">
                      <span className="block text-[9px] font-black text-app-text-secondary uppercase">Creator Library Items ({tempCreators.length})</span>
                      {tempCreators.map((cr, idx) => (
                        <div key={cr.id} className="p-2 bg-white border rounded-xl flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-xs font-black p-1 bg-[#12182F] text-app-text-primary rounded text-[9px] uppercase">{cr.platform}</span>
                            <span className="text-xs font-bold text-slate-800 truncate">@{cr.creatorName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => {
                                setEditingCreatorId(cr.id);
                                setCreatorForm({
                                  title: cr.title,
                                  sourceUrl: cr.sourceUrl,
                                  platform: cr.platform,
                                  thumbnailUrl: cr.thumbnailUrl,
                                  duration: cr.duration,
                                  creatorName: cr.creatorName,
                                  views: cr.views,
                                  clicks: cr.clicks
                                });
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-amber-600"
                              title="Edit Item"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => deleteCreatorItem(cr.id)}
                              className="p-1 hover:bg-slate-100 rounded text-red-600"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => moveCreatorOrder(idx, "up")}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Creator detail add form */}
                    <div className="border border-indigo-100 bg-orange-50/5 p-4 rounded-2xl space-y-3">
                      <p className="text-xs font-black text-[#F97316] uppercase border-b border-indigo-100/40 pb-1.5">
                        {editingCreatorId ? "📝 Update Creator Review Details" : "➕ Add Brand Partner Creator content"}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Platform Link type</label>
                          <select
                            value={creatorForm.platform}
                            onChange={e => setCreatorForm(prev => ({ ...prev, platform: e.target.value as any }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          >
                            <option value="youtube">YouTube</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="facebook">Facebook</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Creator Handle Name</label>
                          <input 
                            type="text"
                            placeholder="e.g. atcbd"
                            value={creatorForm.creatorName}
                            onChange={e => setCreatorForm(prev => ({ ...prev, creatorName: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Review/Campaign Title</label>
                        <input 
                          type="text"
                          placeholder="e.g. S26 Ultra BD Longtest Review"
                          value={creatorForm.title}
                          onChange={e => setCreatorForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Video Source URL Link</label>
                        <input 
                          type="text"
                          placeholder="e.g. https://youtube.com/watch?..."
                          value={creatorForm.sourceUrl}
                          onChange={e => setCreatorForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Custom Thumbnail Image Address</label>
                        <input 
                          type="text"
                          value={creatorForm.thumbnailUrl}
                          onChange={e => setCreatorForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Duration</label>
                          <input 
                            type="text"
                            placeholder="e.g. 14:20"
                            value={creatorForm.duration}
                            onChange={e => setCreatorForm(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Views count</label>
                          <input 
                            type="number"
                            value={creatorForm.views}
                            onChange={e => setCreatorForm(prev => ({ ...prev, views: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Likes / Clicks</label>
                          <input 
                            type="number"
                            value={creatorForm.clicks}
                            onChange={e => setCreatorForm(prev => ({ ...prev, clicks: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <button
                        onClick={addOrUpdateCreator}
                        className="w-full mt-2 py-2 bg-app-card text-app-text-primary rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-800"
                      >
                        {editingCreatorId ? "💾 Save Review Item" : "＋ Add Creator Review"}
                      </button>
                    </div>

                  </div>
                )}

                {/* DRAWERS SECTON: 3. PROMO VOUCHERS LIST EDITOR */}
                {activeDrawer === "promos" && (
                  <div className="space-y-5">
                    
                    {/* Exiting voucher coupons list */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto space-y-2">
                      <span className="block text-[9px] font-black text-app-text-secondary uppercase">Promo Vouchers list ({tempPromos.length})</span>
                      {tempPromos.map((p) => (
                        <div key={p.id} className="p-2.5 bg-white border rounded-xl flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-center bg-slate-50 p-1 rounded">
                            <span className="font-mono font-black text-orange-950 font-mono text-xs">{p.code}</span>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => {
                                  setEditingPromoId(p.id);
                                  setPromoForm({
                                    code: p.code,
                                    discountType: p.discountType,
                                    discountValue: p.discountValue,
                                    startDate: p.startDate,
                                    endDate: p.endDate,
                                    usageLimit: p.usageLimit,
                                    enabled: p.enabled,
                                    targetAudience: "All Customers"
                                  });
                                }}
                                className="font-bold text-amber-600 text-[10px]"
                              >
                                EDIT
                              </button>
                              <button 
                                onClick={() => duplicatePromoItem(p.id)}
                                className="font-bold text-blue-600 text-[10px]"
                              >
                                CLONE
                              </button>
                              <button 
                                onClick={() => deletePromoItem(p.id)}
                                className="font-bold text-red-650 text-[11px] text-red-600"
                              >
                                DELETE
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                            <span>Status: {p.enabled ? "Active ✓" : "Inactive 🔒"}</span>
                            <span>Target: All Customers</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vouchers add Form wrapper details */}
                    <div className="border border-indigo-100 bg-orange-50/5 p-4 rounded-2xl space-y-3 text-left">
                      <p className="text-xs font-black text-[#F97316] uppercase border-b pb-1.5">
                        {editingPromoId ? "📝 Update Promo Voucher" : "➕ CREATE PROMO VOUCHER"}
                      </p>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Target Audience Options</label>
                        <select
                          value={promoForm.targetAudience}
                          onChange={e => setPromoForm(prev => ({ ...prev, targetAudience: e.target.value as any }))}
                          className="w-full p-2 border rounded-lg text-xs text-slate-800"
                        >
                          <option value="New Customers">New Customers Only</option>
                          <option value="Existing Customers">Existing Customers Only</option>
                          <option value="All Customers">All Customers General</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Promo Voucher Code</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="e.g. SAMSUNGFREE"
                            value={promoForm.code}
                            onChange={e => setPromoForm(prev => ({ ...prev, code: e.target.value }))}
                            className="flex-1 p-2 border rounded-lg text-xs font-mono font-bold uppercase"
                          />
                          <button
                            onClick={autoGeneratePromoCode}
                            className="px-3 py-2 bg-app-card text-app-text-primary rounded-lg text-[10px] uppercase font-black tracking-wi"
                          >
                            GENERATE
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Discount type</label>
                          <select
                            value={promoForm.discountType}
                            onChange={e => setPromoForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          >
                            <option value="Percentage">Percentage %</option>
                            <option value="Flat">Flat value BDT</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Discount amount</label>
                          <input 
                            type="number"
                            value={promoForm.discountValue}
                            onChange={e => setPromoForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Valid Until Date</label>
                          <input 
                            type="date"
                            value={promoForm.endDate}
                            onChange={e => setPromoForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Usage limits count</label>
                          <input 
                            type="number"
                            value={promoForm.usageLimit}
                            onChange={e => setPromoForm(prev => ({ ...prev, usageLimit: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input 
                          type="checkbox"
                          id="promo-enabled"
                          checked={promoForm.enabled}
                          onChange={e => setPromoForm(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <label htmlFor="promo-enabled" className="text-xs font-bold text-slate-800">Activate coupon instantly</label>
                      </div>

                      <button
                        onClick={addOrUpdatePromo}
                        className="w-full mt-2 py-2.5 bg-app-card text-app-text-primary rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-800"
                      >
                        {editingPromoId ? "💾 Update Coupon Voucher" : "＋ Create Coupon Voucher"}
                      </button>
                    </div>

                  </div>
                )}

                {/* DRAWERS SECTON: 4. BRAND OVERVIEWS BENTO BOX DETAILS */}
                {activeDrawer === "overview" && (
                  <div className="space-y-5">
                    
                    {/* Card 1 Links inputs */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-550 block text-orange-600">CARD 1: SHOP ADDRESS & LINKS</span>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Physical shop address</label>
                        <textarea 
                          rows={2}
                          value={overviewForm.address}
                          onChange={e => setOverviewForm(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Google maps link location</label>
                        <input 
                          type="text"
                          value={overviewForm.mapLink}
                          onChange={e => setOverviewForm(prev => ({ ...prev, mapLink: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {/* Card 2 Contacts info */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 2: CONTACT INFORMATION</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Customer Support Email</label>
                          <input 
                            type="text"
                            value={overviewForm.contactEmail}
                            onChange={e => setOverviewForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Support Desk Phone</label>
                          <input 
                            type="text"
                            value={overviewForm.phone}
                            onChange={e => setOverviewForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 3 Price & Target Audience */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 3: PRICE RANGE & DEMOGRAPHIC</span>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 font-mono">Price range description (e.g. 1,000 - 30,000 BDT)</label>
                        <input 
                          type="text"
                          value={overviewForm.priceRange}
                          onChange={e => setOverviewForm(prev => ({ ...prev, priceRange: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Age Range focus description</label>
                        <input 
                          type="text"
                          value={overviewForm.ageRange}
                          onChange={e => setOverviewForm(prev => ({ ...prev, ageRange: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                      
                      {/* Checkbox checklist genders */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                        <label className="text-[9px] font-black text-app-text-secondary block uppercase">GENDER AUDIENCE CHECKLIST</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {["Unisex", "Male", "Female", "Youth", "Kids"].map((gender) => {
                            const selected = overviewForm.genders.includes(gender);
                            return (
                              <label key={gender} className="flex items-center gap-1.5 text-xs text-slate-800">
                                <input 
                                  type="checkbox"
                                  checked={selected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setOverviewForm(prev => ({ ...prev, genders: [...prev.genders, gender] }));
                                    } else {
                                      setOverviewForm(prev => ({ ...prev, genders: prev.genders.filter(g => g !== gender) }));
                                    }
                                  }}
                                  className="rounded text-orange-600 focus:ring-orange-500"
                                />
                                <span>{gender}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card 4 Bullet Specialties */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 4: SERVICES & SPECIALTIES BULLET LIST</span>
                      <div className="space-y-2">
                        {overviewForm.services.map((srv, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input 
                              type="text"
                              value={srv}
                              onChange={e => {
                                const nextList = [...overviewForm.services];
                                nextList[idx] = e.target.value;
                                setOverviewForm(prev => ({ ...prev, services: nextList }));
                              }}
                              className="flex-1 p-2 border rounded-lg text-xs"
                            />
                            <button
                              onClick={() => setOverviewForm(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }))}
                              className="p-1 hover:bg-red-50 text-red-650 hover:underline text-xs text-red-650 text-red-600"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setOverviewForm(prev => ({ ...prev, services: [...prev.services, "New Official Warranty"] }))}
                          className="text-[10px] text-orange-600 font-bold hover:underline"
                        >
                          ＋ Add custom bullet spec...
                        </button>
                      </div>
                    </div>

                    {/* Card 5 Tag Pills */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 5: BEST FOR TAG COLLECTION</span>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {overviewForm.bestForTags.map(tag => (
                          <span key={tag} className="p-1 px-2.5 bg-transparent text-[#8A00C4] rounded text-[10px] font-bold flex items-center gap-1">
                            <span>#{tag}</span>
                            <button 
                              onClick={() => setOverviewForm(prev => ({ ...prev, bestForTags: prev.bestForTags.filter(t => t !== tag) }))}
                              className="font-black hover:text-red-700 text-[#8A00C4]"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Autocomplete Quick Suggested selection pills */}
                      <p className="text-[9px] font-black text-app-text-secondary uppercase">Suggested Category tags (Click to Add)</p>
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
                        {["Fashion", "Premium", "Lifestyle", "HolidayWear", "WeddingCollection", "Gifts", "Electronics", "Artisanal", "Durable", "Corporate"].map(suggested => {
                          const exist = overviewForm.bestForTags.includes(suggested);
                          if (exist) return null;
                          return (
                            <button
                              key={suggested}
                              onClick={() => setOverviewForm(prev => ({ ...prev, bestForTags: [...prev.bestForTags, suggested] }))}
                              className="p-1 px-2.5 bg-slate-50 border hover:bg-slate-100 rounded-lg text-[9px] text-slate-650 text-slate-600 font-bold"
                            >
                              ＋ #{suggested}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Drawer Save Section Bottom Action */}
              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeDrawer === "header") saveHeaderSection();
                    if (activeDrawer === "creators") saveCreatorsSection();
                    if (activeDrawer === "promos") savePromosSection();
                    if (activeDrawer === "overview") saveOverviewSection();
                  }}
                  className="flex-1 py-2.5 bg-[#EA6C0A] hover:bg-[#F97316] text-app-text-primary text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                >
                  Save Section
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- FLOATING TOAST SUCCESS MSG --- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[600] bg-[#12182F] text-app-text-primary border border-green-500/30 p-4.5 p-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 bg-green-550 bg-green-500 rounded-full animate-ping shrink-0" />
            <div className="text-left text-xs bg-transparent">
              <span className="font-extrabold text-orange-400 block uppercase text-[10px]">Information Saved</span>
              <p className="text-[11px] text-app-text-secondary font-medium mt-0.5">{toastMessage}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-app-text-secondary hover:text-white font-mono ml-4 text-xs font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DRAFT UNSAVED EXIT WARNING OVERLAY --- */}
      {showExitModal && (
        <div className="fixed inset-0 z-[1000] bg-app-card/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <span className="text-3xl">⚠️</span>
            <h3 className="text-sm font-black uppercase text-[#111827]">Unsaved Profile changes exist</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Exiting without saving will destroy temporary changes made in this session. Protect your brand modifications.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setShowExitModal(false);
                  navigate(isNested ? "/dashboard/content-studio/brands" : "/admin/brands");
                }}
                className="w-full py-2 bg-red-50 text-red-650 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs"
              >
                Discard changes & Exit
              </button>
              <button 
                onClick={() => {
                  handleSaveDraft();
                  setShowExitModal(false);
                  navigate(isNested ? "/dashboard/content-studio/brands" : "/admin/brands");
                }}
                className="w-full py-2 bg-green-600 text-app-text-primary hover:bg-green-700 rounded-xl font-bold text-xs"
              >
                Save Draft first then Exit
              </button>
              <button 
                onClick={() => setShowExitModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-slate-700"
              >
                Continue Designing Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE PUBLISH CONFIRM WARNING OVERLAY --- */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[1000] bg-app-card/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <span className="text-3xl">🚀</span>
            <h3 className="text-sm font-black uppercase">Publish Profile updates Live?</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              This compiles the live storefront profile for public visitor reviews. All active deals and verified vouchers go live immediately inside Bangladesh.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-slate-700"
              >
                Keep Reviewing
              </button>
              <button 
                onClick={handlePublishChanges}
                className="flex-1 py-2 bg-[#EA6C0A] hover:bg-[#F97316] text-[#FFFFFF] rounded-xl font-black text-xs"
              >
                Publish Live Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE BROADCAST SPINNER BACKGROUND --- */}
      {isPublishing && (
        <div className="fixed inset-0 bg-app-card/20 backdrop-blur-sm z-[1500] flex flex-col items-center justify-center gap-3 text-app-text-primary">
          <RotateCw className="w-12 h-12 animate-spin text-[#F97316]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">Compiling live production content logs...</span>
        </div>
      )}

    </div>
  );
}
