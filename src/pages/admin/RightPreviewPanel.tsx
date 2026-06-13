// RightPreviewPanel.tsx
import React, { useState } from "react";
import {
  Laptop, Tablet as TabletIcon, Smartphone, RotateCw, ExternalLink, ShieldCheck, Heart, Star, MapPin, Mail, Phone, Clock, Play, Copy, AlertCircle, ShoppingBag, EyeOff, LayoutGrid, Check, CopyCheck
} from "lucide-react";
import { BrandCMSModel, CreatorVideoItem, BrandProductItem, BrandDealItem } from "./brandSeeds";

interface RightPreviewPanelProps {
  model: BrandCMSModel;
  visitorMode: boolean;
  setVisitorMode: (val: boolean) => void;
  devicePreview: "desktop" | "tablet" | "mobile";
  setDevicePreview: (val: "desktop" | "tablet" | "mobile") => void;
  triggerLeftEditFocus: (sec: string) => void;
}

export const RightPreviewPanel: React.FC<RightPreviewPanelProps> = ({
  model,
  visitorMode,
  setVisitorMode,
  devicePreview,
  setDevicePreview,
  triggerLeftEditFocus
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [loved, setLoved] = useState(false);

  // Copy code simulation tool
  const triggerCopyPromo = (id: string, code: string) => {
    navigator.clipboard?.writeText?.(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Helper calculation
  const getContainerWidth = () => {
    if (devicePreview === "mobile") return "max-w-[390px]";
    if (devicePreview === "tablet") return "max-w-[768px]";
    return "w-full";
  };

  // Helper render for overlays
  const renderOverlay = (sectionKey: string, sectionTitle: string) => {
    if (visitorMode) return null;
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          triggerLeftEditFocus(sectionKey);
        }}
        className="absolute inset-0 bg-transparent group-hover:bg-[#F97316]/[0.03] border-2 border-transparent group-hover:border-dashed group-hover:border-[#F97316]/40 rounded-xl cursor-all-scroll transition-all flex items-start justify-end p-2 z-[60]"
      >
        <span className="opacity-0 group-hover:opacity-100 bg-[#F97316] text-[#FFFFFF] text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg flex items-center gap-1 shrink-0 select-none animate-fade-in">
          ✎ Edit {sectionTitle}
        </span>
      </div>
    );
  };

  // Helper render for hidden state warnings in editor mode
  const renderHiddenAlert = (sectionKey: keyof typeof model.visibility, label: string) => {
    const isVisible = model.visibility?.[sectionKey];
    if (isVisible) return null;
    if (visitorMode) return "HIDDEN_ENTIRELY";
    
    return (
      <div className="border-2 border-dashed border-gray-300 bg-gray-50/50 rounded-xl p-4 flex flex-col items-center justify-center text-center text-gray-400 my-2 select-none">
        <EyeOff className="w-5 h-5 text-gray-400 mb-1" />
        <span className="text-[11px] font-bold text-[#6B7280]">🔒 {label} Hidden From Visitor View</span>
        <button 
          onClick={(e) => { e.stopPropagation(); triggerLeftEditFocus("visibility"); }}
          className="text-[#F97316] font-black text-[10px] uppercase tracking-wider mt-1 hover:underline"
        >
          Enable in Visibility Controls
        </button>
      </div>
    );
  };

  // Extract featured and standard products from model
  const featuredProds = model.products?.filter(p => p.featured && p.status === "Live") || [];
  const standardProds = model.products?.filter(p => !p.featured && p.status === "Live") || [];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F5F5F5]">
      {/* 1. Simulated Browser Chrome Top-bar */}
      <div className="h-12 bg-[#FFFFFF] border-b border-gray-200 px-4 shrink-0 flex items-center justify-between z-10 shadow-sm text-[#111827]">
        {/* URL Bar Area */}
        <div className="flex-1 max-w-lg bg-[#F5F5F5] border border-gray-200 rounded-lg px-3 py-1 flex items-center gap-2">
          <span className="text-gray-400 text-xs">🔒</span>
          <span className="text-xs font-mono select-all truncate text-slate-600">
            https://choosify.bd/brand/{model.slug || (model.brandName || "brand").toLowerCase().replace(/\s+/g, "-")}
          </span>
        </div>

        {/* Browser actions */}
        <div className="flex items-center gap-3">
          {/* Workspace scale tools */}
          <div className="bg-[#F5F5F5] p-0.5 rounded-lg border border-gray-200 flex gap-0.5 shrink-0">
            <button 
              onClick={() => setDevicePreview("desktop")} 
              className={`p-1.5 rounded-md transition-colors ${devicePreview === "desktop" ? "bg-white text-[#F97316] shadow-sm" : "text-gray-540 text-gray-500 hover:text-gray-900"}`}
              title="Desktop View"
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setDevicePreview("tablet")} 
              className={`p-1.5 rounded-md transition-colors ${devicePreview === "tablet" ? "bg-white text-[#F97316] shadow-sm" : "text-gray-540 text-gray-500 hover:text-gray-900"}`}
              title="Tablet View"
            >
              <TabletIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setDevicePreview("mobile")} 
              className={`p-1.5 rounded-md transition-colors ${devicePreview === "mobile" ? "bg-white text-[#F97316] shadow-sm" : "text-gray-540 text-gray-500 hover:text-gray-900"}`}
              title="Mobile (390px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="w-px h-5 bg-gray-200" />

          {/* Core toggle: preview vs visitor preview */}
          <div className="flex items-center gap-1.5 bg-[#FFF4ED] px-2.5 py-1 rounded-lg border border-orange-100">
            <span className="text-[10px] font-black uppercase text-[#F97316] tracking-wide shrink-0">
              {visitorMode ? "👁 Visitor Mode" : "✎ Editor Mode"}
            </span>
            <button 
              onClick={() => setVisitorMode(!visitorMode)}
              className="text-[#F97316] text-[10px] font-semibold underline hover:text-[#EA6C0A] shrink-0"
            >
              Switches
            </button>
          </div>
        </div>
      </div>

      {/* 2. Scalable Preview Frame Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex justify-center custom-scrollbar scroll-smooth">
        <div className={`w-full ${getContainerWidth()} bg-[#FFFFFF] min-h-[90%] rounded-2xl shadow-xl border border-gray-200 h-fit overflow-hidden transition-all duration-300 relative`}>
          
          {/* STATIC BRAND WEBSITE HERO (Preview identity) */}
          <div className="relative group min-h-[160px] md:min-h-[220px]">
            {renderOverlay("identity", "Cover & Logo")}
            
            {/* Cover image background */}
            <div className="absolute inset-0 bg-[#1A1A2E]">
              {model.coverImage ? (
                <img src={model.coverImage} alt="" className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-[#1A1A2E] to-[#2D2D4E] flex items-center justify-center text-white text-xs opacity-50">
                  Select cover in Identity section
                </div>
              )}
              {/* Gradient bottom dim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
            </div>

            {/* Profile overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 text-white">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
                <img 
                  src={model.logo || "https://images.unsplash.com/photo-1622434641406-a158123450f9?w=120&auto=format&fit=crop&q=80"} 
                  alt="" 
                  className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border-4 border-white shadow-xl shrink-0 bg-[#FFFFFF]" 
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    <h2 className="text-lg md:text-xl font-bold tracking-tight">{model.brandName || "Samsung Bangladesh"}</h2>
                    {model.verificationStatus === "Verified" && (
                      <span className="p-0.5 bg-green-500 rounded-full text-white" title="Verified Choosify Brand Seal">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-gray-300 italic font-medium">{model.tagline || "Inspire the World, Create the Future"}</p>
                </div>
              </div>

              {/* Action indicators */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setLoved(!loved)} 
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    loved ? "bg-[#F97316] text-[#FFFFFF]" : "bg-[#FFFFFF]/10 backdrop-blur-md text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${loved ? "fill-white" : ""}`} /> {loved ? "Loved ✓" : "Love Brand"}
                </button>
                <div className="text-right text-[10px] font-mono opacity-80 hidden md:block">
                  <span className="block font-bold text-white text-xs">{model.followersCount || "12,410"}</span>
                  Followers
                </div>
              </div>
            </div>
          </div>

          {/* MAIN PAGE BODY (Render modules with visibility overrides) */}
          <div className="p-5 md:p-6 space-y-7 text-left text-[#111827]">
            
            {/* OVERVIEW INTRO NARRATIVE */}
            {renderHiddenAlert("overview", "Narrative Block") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.overview && (
                <div className="relative group bg-white rounded-xl p-4 border border-gray-100 hover:shadow-sm">
                  {renderOverlay("identity", "Narrative Overview")}
                  <p className="text-[13px] leading-relaxed text-[#6B7280]">{model.description}</p>
                  
                  {/* Mission Statement block */}
                  {model.missionStatement && (
                    <div className="mt-4 border-t border-gray-150 pt-3.5 flex gap-2">
                      <span className="text-lg text-[#F97316]">🎯</span>
                      <div className="text-xs text-gray-700 font-medium">
                        <span className="font-extrabold uppercase tracking-wider block text-[9px] text-[#F97316]">Core Mission Statement</span>
                        "{model.missionStatement}"
                      </div>
                    </div>
                  )}
                  {model.brandStory && (
                    <div className="mt-4 border-t border-gray-105 pt-3.5 text-xs text-gray-700">
                      <span className="font-extrabold uppercase tracking-wider block text-[9px] text-gray-400 mb-1">Our Heritage Legacy</span>
                      {model.brandStory}
                    </div>
                  )}
                </div>
              )
            )}

            {/* TRUST CERTIFICATE ROW SCORE SPLIT (Navy anchors) */}
            {renderHiddenAlert("trustSection", "Choosify Scorecard") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.trustSection && (
                <div className="relative group bg-[#1A1A2E] text-white p-5 rounded-2xl border border-[#2D2D4E] shadow-lg flex flex-col md:flex-row items-center gap-5 justify-between">
                  {renderOverlay("trust", "Trust Score Audit")}
                  
                  <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="p-4 bg-[#FFFFFF]/5 rounded-full border border-[#FFFFFF]/10 shrink-0">
                      🏅
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[15px] leading-tight text-[#FFFFFF]">Choosify Verified Scorecard</h4>
                      <p className="text-[11px] text-gray-400 font-light mt-0.5">Continuous automated background logs trace this verified merchant seal.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 md:gap-6 shrink-0 w-full md:w-auto justify-around border-t md:border-t-0 border-[#2D2D4E] pt-3 md:pt-0">
                    <div className="text-center">
                      <div className="text-xl font-black font-mono text-[#F97316]">{model.choosifyScore}</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Trust Score</div>
                    </div>
                    <div className="text-center border-l border-[#2D2D4E] pl-4 md:pl-6">
                      <div className="text-xl font-black font-mono text-[#22C55E]">{model.verifiedPurchasePercentage}%</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">Verified Purchases</div>
                    </div>
                    <div className="text-center border-l border-[#2D2D4E] pl-4 md:pl-6">
                      <div className="text-xl font-black font-mono text-amber-405 text-amber-400">{model.responseTime}</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold font-mono">Response Time</div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* FEATURED PRODUCTS SHELF SECTION */}
            {renderHiddenAlert("featuredProducts", "Featured Deck") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.featuredProducts && featuredProds.length > 0 && (
                <div className="relative group space-y-4">
                  {renderOverlay("products", "Featured Items")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Featured Highlights</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {featuredProds.map((p) => (
                      <div key={p.id} className="border border-amber-100 bg-amber-50/[0.04] p-3 rounded-xl relative hover:shadow-md transition-all flex flex-col justify-between">
                        <span className="absolute top-2 left-2 bg-[#F97316] text-[#FFFFFF] text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow z-10">
                          Featured ⭐
                        </span>
                        <div className="space-y-2">
                          <img src={p.thumbnail} alt="" className="w-full h-32 object-cover rounded-lg border border-gray-100" />
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-[#6B7280] font-mono leading-none">{p.category}</span>
                            <h4 className="text-xs font-bold truncate text-[#111827]">{p.name}</h4>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                          <span className="font-extrabold font-mono text-xs text-[#F97316]">৳{p.price.toLocaleString()}</span>
                          <span className="text-[9px] text-[#6B7280] font-mono bg-white px-1.5 py-0.5 border border-gray-100 rounded">Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* PRODUCT CATALOG LIST */}
            {renderHiddenAlert("products", "Product Catalog") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.products && standardProds.length > 0 && (
                <div className="relative group space-y-4">
                  {renderOverlay("products", "Storefront Catalog")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Browse Product Catalog</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {standardProds.map((p) => (
                      <div key={p.id} className="border border-gray-200 bg-white p-2.5 rounded-xl flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="space-y-1.5">
                          <img src={p.thumbnail} alt="" className="w-full h-24 object-cover rounded-lg" />
                          <h4 className="text-[11px] font-bold truncate text-slate-800">{p.name}</h4>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[10px] mt-1.5">
                          <span className="font-bold text-[#111827]">৳{p.price.toLocaleString()}</span>
                          <span className="text-gray-400 font-mono">Qty: {p.stock}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* DEALS PROMOTION CAMPAIGNS */}
            {renderHiddenAlert("deals", "Promotions & Offers") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.deals && model.deals?.filter(d => d.status === "Active").length > 0 && (
                <div className="relative group space-y-3">
                  {renderOverlay("deals", "Active Campaign Deals")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Current Campaigns & Promotions</h3>
                  </div>

                  <div className="space-y-2">
                    {model.deals.filter(d => d.status === "Active").map((dl) => (
                      <div key={dl.id} className="bg-gradient-to-r from-orange-50 to-[#FFF4ED] p-4 rounded-xl border border-orange-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl shrink-0">🎁</span>
                          <div>
                            <span className="font-extrabold text-[13px] text-orange-950 block leading-tight">{dl.title}</span>
                            <span className="text-[10px] text-[#6B7280] font-mono block mt-0.5">Active discount ends {dl.endDate}</span>
                          </div>
                        </div>
                        <div className="bg-[#F97316] text-[#FFFFFF] font-mono font-black py-1.5 px-4 rounded-lg text-sm shrink-0">
                          CLAIM {dl.discountValue}{dl.discountType === "Percentage" ? "%" : " BDT"} OFF
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* ACTIVE PROMO CODES (VOUCHERS) CONTAINER DISPLAY */}
            {renderHiddenAlert("promoCodes", "Storefront Vouchers") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.promoCodes && model.promoCodes?.filter(pr => pr.enabled).length > 0 && (
                <div className="relative group space-y-3">
                  {renderOverlay("deals", "Promo Vouchers")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Verified Vouchers & Coupon Codes</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {model.promoCodes.filter(pr => pr.enabled).map((pr) => (
                      <div key={pr.id} className="border-2 border-dashed border-[#F97316]/30 bg-orange-50/10 rounded-xl p-3 flex justify-between items-center gap-2 relative">
                        <div>
                          <span className="text-[11px] font-black text-[#1a1a2e] uppercase block">{pr.code}</span>
                          <span className="text-[10px] text-[#6B7280]">
                            Save {pr.discountValue}{pr.discountType === "Percentage" ? "%" : " BDT"} flat
                          </span>
                        </div>
                        <button
                          onClick={() => triggerCopyPromo(pr.id, pr.code)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors ${
                            copiedCodeId === pr.id 
                              ? "bg-green-600 text-white" 
                              : "bg-[#EA6C0A] text-[#FFFFFF] hover:bg-[#F97316]"
                          }`}
                        >
                          {copiedCodeId === pr.id ? <Check className="w-3 h-3" /> : null}
                          {copiedCodeId === pr.id ? "COPIED" : "COPY CODE"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* CREATOR & INFLUENCER VIDEOS STREAM */}
            {renderHiddenAlert("creatorReviews", "Creator Reviews") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.creatorReviews && model.creators?.filter(c => c.status === "Approved").length > 0 && (
                <div className="relative group space-y-3">
                  {renderOverlay("creator", "Creator Content")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Creator Reviews & Hand-on Clips</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {model.creators.filter(c => c.status === "Approved").map((cr) => (
                      <div key={cr.id} className="border border-gray-150 bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                        {/* Thumbnail overlay */}
                        <div className="relative h-28 bg-[#101117] shrink-0">
                          <img src={cr.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-75" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-9 h-9 bg-[#F97316] text-white rounded-full flex items-center justify-center text-xs shadow-lg transition-transform hover:scale-110 cursor-pointer">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </span>
                          </div>
                          <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 text-[9px] text-[#FFFFFF] font-mono rounded">
                            {cr.duration}
                          </span>
                        </div>
                        {/* Block descriptors */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <h4 className="text-[11px] font-extrabold text-[#111827] line-clamp-2 leading-snug">{cr.title}</h4>
                          <span className="text-[9px] text-[#6B7280] font-mono block mt-2">@{cr.creatorName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* PUBLIC REVIEWS TESTIMONIAL LOOPS */}
            {renderHiddenAlert("publicReviews", "Visitor Feedback Logs") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.publicReviews && model.reviews?.length > 0 && (
                <div className="relative group space-y-3">
                  {renderOverlay("reviews", "Buyer Feedback Logs")}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-[#F97316] rounded" />
                    <h3 className="text-sm font-black uppercase text-[#1a1a2e] tracking-wider">Recent Buyer Experiences</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {model.reviews.map((rv) => (
                      <div key={rv.id} className="bg-[#F5F5F5] rounded-xl p-3 border border-gray-150 text-[11px] space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-[#111827] block text-[11px]">{rv.author}</span>
                            <span className="text-[9px] text-[#6B7280]">{rv.date}</span>
                          </div>
                          <div className="text-amber-500 font-bold font-mono">
                            {"★".repeat(rv.rating)}
                          </div>
                        </div>
                        <p className="italic text-gray-700 leading-snug">"{rv.text}"</p>
                        <div className="text-[9px] text-[#6B7280] border-t border-gray-200 pt-1.5 flex justify-between">
                          <span className="text-green-600 font-bold">✓ Verified purchase reviewer</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* EXTENDED SPECIFICATIONS AND OPERATING INFORMATION */}
            {renderHiddenAlert("brandInformation", "Operating Contacts") !== "HIDDEN_ENTIRELY" && (
              model.visibility?.brandInformation && (
                <div className="relative group bg-gray-50 rounded-xl p-4 border border-gray-200 text-[11px] leading-relaxed space-y-3.5">
                  {renderOverlay("info", "Operations Specs")}
                  <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                    <span className="text-lg">🏢</span>
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#1a1a2e]">Operating Address & Customer Desk</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span className="truncate">{model.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span className="font-mono">{model.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span>{model.phone}</span>
                      </div>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-gray-200 pt-2.5 sm:pt-0 sm:pl-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span>Hours: {model.customerServiceHours}</span>
                      </div>
                      <div className="text-[10px] text-gray-540 text-gray-500">
                        <span className="font-bold text-[#111827] block">Nationwide Delivery Target:</span>
                        {model.deliveryCoverage}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

          </div>

          {/* SIMULATED PLATFORM COMPLIANCE STATIC FOOTER */}
          <div className="bg-gray-100 border-t border-gray-200 p-4 text-center text-[10px] text-gray-400 font-mono select-none">
            Choosify Customer Protection Guarantee Program desk portal. All rights reserved.
          </div>

        </div>
      </div>
    </div>
  );
};
