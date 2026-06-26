import React, { useState } from "react";
import { 
  ShoppingBag, Star, Share2, Bookmark, Heart, ShieldCheck, 
  ArrowRight, Truck, RefreshCw, MapPin, Edit3, Sparkles,
  ExternalLink, MessageSquare, Tag, Youtube, Play, FileText,
  AlertCircle, DollarSign, Store, HelpCircle, CheckCircle2,
  ChevronDown, Layers, Clipboard, Box, Zap, Award, Clock, Smartphone
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface Spec {
  key: string;
  value: string;
}

export interface SizeRow {
  size: string;
  chest: string;
  length: string;
  waist: string;
  shoulder: string;
  sleeve: string;
  [customKey: string]: string;
}

export interface StoreListing {
  id: string;
  storeName: string;
  storeLogo: string;
  storeUrl: string;
  price: number;
  availability: "In Stock" | "Out of Stock" | "Pre-Order";
  storeRating: number;
}

export interface InfluencerVideo {
  id: string;
  platform: "YouTube" | "Facebook" | "Instagram" | "TikTok" | "LinkedIn" | "Custom";
  url: string;
  title: string;
  thumbnail: string;
}

export interface OverviewBlock {
  id: string;
  title: string;
  bullets: string[];
  richText?: string;
  enabled: boolean;
}

export interface VersionOption {
  name: string;
  priceDelta: number;
}

export interface ProductOptions {
  colorVariants: { enabled: boolean; values: string[] };
  sizeVariants: { enabled: boolean; values: string[] };
  versionVariants: { enabled: boolean; values: VersionOption[] };
  storageVariants: { enabled: boolean; values: string[] };
  capacityVariants: { enabled: boolean; values: string[] };
  materialVariants: { enabled: boolean; values: string[] };
  weightVariants: { enabled: boolean; values: string[] };
  servicePackages: { enabled: boolean; values: string[] };
  subscriptionPlans: { enabled: boolean; values: string[] };
  customOptions: { enabled: boolean; name: string; values: string[] };
}

export interface ProductData {
  brandName: string;
  productName: string;
  category: string;
  actualPrice: number;
  discountedPrice: number;
  stockLimit: number;
  soldCount: number;
  slug?: string;
  status: "Draft" | "Live" | "Flagged" | "Archived";
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;

  images: string[];
  coverImage?: string;
  videoUrl?: string;
  view360Url?: string;
  brochureUrl?: string;
  
  about: string;
  tags: string[];
  pros: string[];
  cons: string[];
  specs: Spec[];

  enableOptions?: boolean;
  options: ProductOptions;

  enableSizeGuide: boolean;
  sizeGuideColumns: string[];
  sizeGuideRows: SizeRow[];

  purchaseOptions: {
    addToCart: boolean;
    buyNow: boolean;
    buyOfficial: boolean;
    officialUrl: string;
    contactSeller: boolean;
    requestQuotation: boolean;
    preOrder: boolean;
  };

  enableSpecs: boolean;

  enableStoreComparison: boolean;
  storeComparisonList: StoreListing[];

  enableInfluencerReviews: boolean;
  influencerVideos: InfluencerVideo[];

  enableOverviewSection: boolean;
  overviewBlocks: OverviewBlock[];

  enableBestForTags: boolean;
  bestForTags: string[];

  enableBoxContents?: boolean;
  boxContents?: {
    id: string;
    title: string;
    icon?: string;
    description?: string;
    displayOrder: number;
  }[];

  optionGroups?: {
    id: string;
    name: string;
    displayType: "Button" | "Color Swatch" | "Dropdown";
    values: string[];
  }[];
  productVariants?: {
    id: string;
    options: { [groupName: string]: string };
    sku: string;
    price: number;
    stock: number;
    weight?: string;
    images?: string[];
    enabled: boolean;
  }[];

  enableSizeChart?: boolean;
  sizeChartType?: "table" | "image" | "html";
  sizeChartImage?: string;
  sizeChartHtml?: string;
  sizeChartColumns?: string[];
  sizeChartRows?: any[];
  
  storeAvailability: string;
  returnPolicy: string;
  deliveryInfo: string;
}

interface ProductDetailViewProps {
  data: ProductData;
  mode?: "view" | "edit";
  focusedSection?: string | null;
  onSelectSection?: (sectionId: string, tabId: string) => void;
  onTriggerOrder?: (notes?: string) => void;
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

export function ProductDetailView({
  data,
  mode = "view",
  focusedSection = null,
  onSelectSection,
  onTriggerOrder
}: ProductDetailViewProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<VersionOption | null>(null);
  const [selectedStorage, setSelectedStorage] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedSubPlan, setSelectedSubPlan] = useState("");
  const [liked, setLiked] = useState(false);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);
  const [selectedCustomOptions, setSelectedCustomOptions] = useState<{ [key: string]: string }>({});

  const imagesList = data.images && data.images.length > 0 ? data.images : [PLACEHOLDER_IMAGE];
  const currentImg = imagesList[activePhotoIndex] || PLACEHOLDER_IMAGE;
  const isEdit = mode === "edit";

  const getHighlightClass = (sectionId: string) => {
    if (!isEdit) return "my-4";
    const isFocused = focusedSection === sectionId;
    return `relative group/edit cursor-pointer rounded-2xl border-2 transition-all p-3.5 my-3 ${
      isFocused
        ? "border-app-accent bg-app-accent/5 ring-4 ring-app-accent/10"
        : "border-dashed border-slate-200/50 hover:border-app-accent/40 hover:bg-slate-50/70"
    }`;
  };

  const editLabel = (sectionId: string, titleName: string, tabId: string) => {
    if (!isEdit) return null;
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onSelectSection?.(sectionId, tabId);
        }}
        className="absolute -top-3 right-4 z-40 bg-app-accent text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white shadow-md flex items-center gap-1 hover:bg-orange-600 transition-all cursor-pointer"
      >
        <Edit3 size={10} />
        <span>{titleName}</span>
      </div>
    );
  };

  // Find matching variant based on custom options selection
  const matchingVariant = (() => {
    if (!data.optionGroups || data.optionGroups.length === 0 || !data.productVariants) return null;
    // If nothing selected yet, pre-initialize first combinations
    return data.productVariants.find(variant => {
      return Object.entries(selectedCustomOptions).every(([groupName, value]) => {
        return !value || variant.options[groupName] === value;
      });
    });
  })();

  const actualDispPrice = (() => {
    if (matchingVariant) {
      return matchingVariant.price;
    }
    return selectedVersion 
      ? data.discountedPrice + selectedVersion.priceDelta 
      : data.discountedPrice || data.actualPrice;
  })();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans leading-relaxed">
      
      {/* 1. HERO HEADER BANNER */}
      <section className="bg-slate-950 text-white relative pt-8 pb-12 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-5 blur-3xl pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-app-accent rounded-full translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 w-full">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40 italic mb-6">
            <span>Home</span>
            <ArrowRight size={8} />
            <span>Products</span>
            <ArrowRight size={8} />
            <span className="text-app-accent uppercase">{data.category || "General"}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Left Column: Media Gallery & Metadata attachments */}
            <div 
              className={getHighlightClass("media")}
              onClick={() => isEdit && onSelectSection?.("media", "Overview & Content")}
              id="view-media"
            >
              {editLabel("media", "Product Media Library", "Overview & Content")}
              
              <div className="space-y-4">
                {/* Main Image viewer */}
                <div className="w-full aspect-[4/3] bg-slate-900 rounded-[20px] border border-white/10 overflow-hidden shadow-2xl relative flex items-center justify-center group/img">
                  <img
                    src={currentImg}
                    alt="Active Preview"
                    className="max-h-full max-w-full object-contain p-4 transition-transform duration-300 group-hover/img:scale-[1.01]"
                  />
                  <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md text-white rounded-full text-[9px] font-mono tracking-widest font-bold">
                    {activePhotoIndex + 1} / {imagesList.length} PHOTO
                  </div>
                </div>

                {/* Thumbnails list */}
                <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar justify-start">
                  {imagesList.map((img, i) => (
                    <button
                      key={img + i}
                      onClick={() => setActivePhotoIndex(i)}
                      type="button"
                      className={`w-14 h-14 rounded-xl border-2 overflow-hidden bg-slate-900 transition-all duration-150 shrink-0 p-1 flex items-center justify-center ${
                        activePhotoIndex === i ? "border-app-accent" : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <img src={img} className="max-w-full max-h-full object-contain" alt="thumbnail" />
                    </button>
                  ))}
                </div>

                {/* Accessory files display */}
                {(data.view360Url || data.brochureUrl) && (
                  <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2">
                    {data.view360Url && (
                      <a href={data.view360Url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white border border-white/5">
                        <Sparkles size={11} className="text-app-accent shrink-0 animate-pulse" />
                        <span>Interactive 360° VR View</span>
                      </a>
                    )}
                    {data.brochureUrl && (
                      <a href={data.brochureUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white border border-white/5">
                        <FileText size={11} className="text-cyan-400 shrink-0" />
                        <span>Specifications PDF Brochure</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Title block, Dynamic options, Pricing & purchase toggles */}
            <div className="space-y-6">
              
              {/* BRAND, TITLE & SEO */}
              <div 
                className={getHighlightClass("hero")}
                onClick={() => isEdit && onSelectSection?.("hero", "Overview & Content")}
                id="view-hero"
              >
                {editLabel("hero", "Header, Slug & Status", "Overview & Content")}
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-app-accent font-mono">
                    {data.brandName || "VERIFIED SELLER"}
                  </span>
                  <span className="w-1 h-1 bg-white/25 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-white/50">{data.category}</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight mb-2.5">
                  {data.productName || "Untitled Product"}
                </h1>

                {/* Dynamic Status Badges for Sourcing Hub */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={11} className="fill-app-accent text-app-accent" />
                    ))}
                  </div>
                  <span className="w-1 h-1 bg-white/15 rounded-full" />
                  <span className="text-[8.5px] font-black tracking-widest text-[#4DBC15] uppercase bg-[#4DBC15]/10 px-2 py-0.5 rounded border border-[#4DBC15]/20">
                    {data.status || "LIVE"} PORTAL SKU
                  </span>
                </div>

                {data.slug && (
                  <div className="text-[9px] text-white/40 font-mono mt-2 truncate">
                    Slug Link: <span className="text-app-accent">/products/{data.slug}</span>
                  </div>
                )}
              </div>
              {/* DYNAMIC PRODUCT OPTIONS SELECTORS SYSTEM */}
              {data.enableOptions && (
                <div 
                  className={getHighlightClass("options")}
                  onClick={() => isEdit && onSelectSection?.("options", "Overview & Content")}
                  id="view-options"
                >
                  {editLabel("options", "Toggle Variant Attributes", "Overview & Content")}
                  
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4.5 space-y-4 text-left">
                    <span className="text-[8.5px] font-black uppercase text-app-accent/80 tracking-widest block font-mono">VARIANT ATTRIBUTES SELECTION</span>
                    
                    {data.optionGroups && data.optionGroups.length > 0 ? (
                      // RENDER DYNAMIC CUSTOM OPTION GROUPS
                      <div className="space-y-4">
                        {data.optionGroups.map((group) => {
                          const selectedValue = selectedCustomOptions[group.name] || "";
                          return (
                            <div key={group.id} className="space-y-2">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">
                                {group.name} {selectedValue && `(${selectedValue})`}
                              </label>

                              {group.displayType === "Dropdown" ? (
                                <select
                                  value={selectedValue}
                                  onChange={(e) => {
                                    setSelectedCustomOptions({
                                      ...selectedCustomOptions,
                                      [group.name]: e.target.value
                                    });
                                  }}
                                  className="w-full bg-slate-900 border border-white/10 text-white font-semibold text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-app-accent"
                                >
                                  <option value="">Select {group.name}...</option>
                                  {group.values.map(val => (
                                    <option key={val} value={val}>{val}</option>
                                  ))}
                                </select>
                              ) : group.displayType === "Color Swatch" ? (
                                <div className="flex flex-wrap gap-2">
                                  {group.values.map(val => {
                                    const isSelected = selectedValue === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCustomOptions({
                                            ...selectedCustomOptions,
                                            [group.name]: val
                                          });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                          isSelected 
                                            ? "bg-app-accent border-app-accent text-white" 
                                            : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20"
                                        }`}
                                      >
                                        <span 
                                          className="w-3 h-3 rounded-full border border-white/20 block"
                                          style={{ backgroundColor: val.toLowerCase().replace(/\s+/g, '') }}
                                        />
                                        <span>{val}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                // Default is Button / Badge Capsules
                                <div className="flex flex-wrap gap-1.5">
                                  {group.values.map(val => {
                                    const isSelected = selectedValue === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCustomOptions({
                                            ...selectedCustomOptions,
                                            [group.name]: val
                                          });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                                          isSelected 
                                            ? "bg-app-accent border-app-accent text-white" 
                                            : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {matchingVariant && (
                          <div className="pt-2 border-t border-white/5 space-y-1">
                            <span className="text-[8.5px] uppercase font-black tracking-wider text-slate-400 block font-mono">VARIANT SPECIFICATION SUMMARY</span>
                            <div className="text-[10px] text-white/70 font-mono space-y-0.5">
                              <div>SKU: <span className="text-app-accent font-bold">{matchingVariant.sku}</span></div>
                              {matchingVariant.weight && <div>WEIGHT: <span className="text-slate-300 font-bold">{matchingVariant.weight}</span></div>}
                              <div>AVAILABILITY: <span className={matchingVariant.stock > 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                {matchingVariant.stock > 0 ? `IN STOCK (${matchingVariant.stock} units)` : "OUT OF STOCK"}
                              </span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // RENDER FALLBACK LEGACY OPTIONS
                      data.options && (
                        <div className="space-y-4">
                          {/* Color Variants */}
                          {data.options.colorVariants?.enabled && data.options.colorVariants.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Available Color Variant ({selectedColor || "None selected"})</label>
                              <div className="flex flex-wrap gap-1.5">
                                {data.options.colorVariants.values.map(color => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setSelectedColor(color)}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                                      selectedColor === color 
                                        ? "bg-app-accent border-app-accent text-white" 
                                        : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                                    }`}
                                  >
                                    {color}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Size Variants */}
                          {data.options.sizeVariants?.enabled && data.options.sizeVariants.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Available Size Specs</label>
                              <div className="flex flex-wrap gap-1.5">
                                {data.options.sizeVariants.values.map(sz => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => setSelectedSize(sz)}
                                    className={`w-9 h-9 rounded-lg border text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center ${
                                      selectedSize === sz 
                                        ? "bg-app-accent border-app-accent text-white" 
                                        : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                                    }`}
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Version Variants with dynamic pricing delta updates! */}
                          {data.options.versionVariants?.enabled && data.options.versionVariants.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Core Device Version Model</label>
                              <div className="flex flex-col gap-1.5">
                                {data.options.versionVariants.values.map((ver, vIdx) => (
                                  <button
                                    key={ver.name + vIdx}
                                    type="button"
                                    onClick={() => setSelectedVersion(ver)}
                                    className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                                      selectedVersion?.name === ver.name 
                                        ? "bg-app-accent/10 border-app-accent text-white" 
                                        : "bg-slate-900 border-white/5 text-white/70 hover:border-white/20"
                                    }`}
                                  >
                                    <span className="font-extrabold uppercase tracking-wide">{ver.name}</span>
                                    <span className="text-[10px] font-sans text-app-accent bg-app-accent/5 px-2 py-0.5 rounded-md font-extrabold">
                                      {ver.priceDelta >= 0 ? `+ ৳${ver.priceDelta.toLocaleString()}` : `- ৳${Math.abs(ver.priceDelta).toLocaleString()}`}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Storage Variant Options */}
                          {data.options.storageVariants?.enabled && data.options.storageVariants.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Available Storage Size</label>
                              <div className="flex flex-wrap gap-1.5">
                                {data.options.storageVariants.values.map(storage => (
                                  <button
                                    key={storage}
                                    onClick={() => setSelectedStorage(storage)}
                                    type="button"
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                                      selectedStorage === storage 
                                        ? "bg-app-accent border-app-accent text-white" 
                                        : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                                    }`}
                                  >
                                    {storage}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Capacity Variant Options */}
                          {data.options.capacityVariants?.enabled && data.options.capacityVariants.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Functional Capacity Limits</label>
                              <div className="flex flex-wrap gap-1.5">
                                {data.options.capacityVariants.values.map(cap => (
                                  <button
                                    key={cap}
                                    onClick={() => setSelectedCapacity(cap)}
                                    type="button"
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                                      selectedCapacity === cap 
                                        ? "bg-app-accent border-app-accent text-white" 
                                        : "bg-slate-900 border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                                    }`}
                                  >
                                    {cap}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Subscription Plans */}
                          {data.options.subscriptionPlans?.enabled && data.options.subscriptionPlans.values?.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Available Contract Plans</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {data.options.subscriptionPlans.values.map((plan, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedSubPlan(plan)}
                                    type="button"
                                    className={`p-3 border rounded-xl text-left font-bold transition-all cursor-pointer ${
                                      selectedSubPlan === plan 
                                        ? "bg-app-accent/10 border-app-accent text-white" 
                                        : "bg-slate-900 border-white/5 text-white/60 hover:text-white"
                                    }`}
                                  >
                                    <span className="block text-[8px] text-app-secondary uppercase tracking-widest font-mono mb-0.5">PLAN SCHEME {idx + 1}</span>
                                    <span className="upper tracking-tight line-clamp-1">{plan}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* PRICING BLOCK */}
              <div 
                className={getHighlightClass("pricing")}
                onClick={() => isEdit && onSelectSection?.("pricing", "Overview & Content")}
                id="view-pricing"
              >
                {editLabel("pricing", "Pricing & Stockslab", "Overview & Content")}

                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-end justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block mb-0.5">EST. MARKET RETAIL</span>
                      <div className="text-2xl font-black text-app-accent font-sans italic">
                        ৳{actualDispPrice.toLocaleString()}
                      </div>
                      {data.actualPrice > data.discountedPrice && (
                        <div className="text-xs text-white/45 line-through font-bold font-mono mt-0.5">
                          ৳{data.actualPrice.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[8px] font-black text-[#50DC17] uppercase tracking-widest block mb-0.5">PLATFORM ASSURED STOCK</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {matchingVariant ? matchingVariant.stock : data.stockLimit} Items Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PURCHASE COMPLIANT ACTIONS (DYNAMIC GENERATOR) */}
              <div 
                className={getHighlightClass("purchase")}
                onClick={() => isEdit && onSelectSection?.("purchase", "Overview & Content")}
                id="view-purchase"
              >
                {editLabel("purchase", "Purchase Action Settings", "Overview & Content")}
                
                <div className="space-y-3 flex flex-col">
                  {/* Option 1: Main Order triggers mapping */}
                  {(data.purchaseOptions?.addToCart || data.purchaseOptions?.buyNow) && (
                    <button
                      type="button"
                      onClick={() => onTriggerOrder?.("Standard checkout requested")}
                      className="w-full py-4.5 bg-gradient-to-r from-app-accent to-orange-550 hover:from-app-accent-light hover:to-orange-450 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-app-accent/15 active:scale-95 cursor-pointer uppercase font-sans text-center"
                    >
                      {data.purchaseOptions.preOrder ? "Pre-Order Sourcing Unit" : "Create Trust Sourcing Order"}
                    </button>
                  )}

                  {/* Option 2: Buy from Official URL Link */}
                  {data.purchaseOptions?.buyOfficial && data.purchaseOptions.officialUrl && (
                    <a
                      href={data.purchaseOptions.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-4.5 bg-white text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>Buy From Official Brand Portal</span>
                      <ExternalLink size={14} className="text-app-accent" />
                    </a>
                  )}

                  {/* Option 3: Contact Seller & Quotation splits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.purchaseOptions?.contactSeller && (
                      <button
                        type="button"
                        onClick={() => onTriggerOrder?.("Inquiry Notes: Requesting immediate brand representative contact.")}
                        className="py-3 px-4 bg-slate-900 border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare size={13} className="text-app-accent shrink-0" />
                        <span>Chat Sourcing Desk</span>
                      </button>
                    )}

                    {data.purchaseOptions?.requestQuotation && (
                      <button
                        type="button"
                        onClick={() => onTriggerOrder?.("Inquiry Notes: Requesting official B2B wholesale quotation volume pricing slab.")}
                        className="py-3 px-4 bg-slate-900 border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                      >
                        <DollarSign size={13} className="text-[#4DBC15] shrink-0" />
                        <span>Request Bulk Quote</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 2. SPECIFICATION LIST MANAGER */}
      {data.enableSpecs && data.specs && data.specs.length > 0 && (
        <section className="bg-white border-b border-slate-200/60 py-10 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div 
              className={getHighlightClass("specsSection")}
              onClick={() => isEdit && onSelectSection?.("specsSection", "Specifications")}
              id="view-specs-section"
            >
              {editLabel("specsSection", "Specification Parameters", "Specifications")}

              <div className="mb-6">
                <span className="text-[8.5px] font-black text-app-accent uppercase tracking-widest block font-mono mb-1">DATA PARAMETERS MATRIX</span>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Product Specifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {data.specs.map((item, idx) => (
                  <div key={idx} className="border-b border-slate-100 pb-2 text-xs flex justify-between items-center pr-3">
                    <div className="text-left font-medium">
                      <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest font-mono mb-0.5">{item.key}</span>
                      <span className="text-slate-900 font-extrabold uppercase tracking-wide">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Box Contents / Complimentary Features Section */}
      {data.enableBoxContents && data.boxContents && data.boxContents.length > 0 && (
        <section className="bg-slate-50 border-b border-slate-200/60 py-10 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div 
              className={getHighlightClass("boxContents")}
              onClick={() => isEdit && onSelectSection?.("boxContents", "Specifications")}
              id="view-box-contents"
            >
              {editLabel("boxContents", "Box Contents / Features", "Specifications")}

              <div className="mb-6">
                <span className="text-[8.5px] font-black text-app-accent uppercase tracking-widest block font-mono mb-1">COMPLIMENTARY PACKAGE DETAILS</span>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">📦 Box Contents & Extras</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.boxContents
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map((item, idx) => {
                    // Match icons
                    let IconComponent = Box;
                    const icName = item.icon?.toLowerCase() || "";
                    if (icName.includes("cable") || icName.includes("wire")) IconComponent = RefreshCw;
                    else if (icName.includes("charger") || icName.includes("battery") || icName.includes("power")) IconComponent = Zap;
                    else if (icName.includes("spark") || icName.includes("compliment")) IconComponent = Sparkles;
                    else if (icName.includes("phone") || icName.includes("mobile")) IconComponent = Smartphone;
                    else if (icName.includes("heart") || icName.includes("care")) IconComponent = Heart;
                    else if (icName.includes("shield") || icName.includes("warranty")) IconComponent = ShieldCheck;
                    else if (icName.includes("award") || icName.includes("premium")) IconComponent = Award;
                    else if (icName.includes("clock") || icName.includes("time")) IconComponent = Clock;

                    return (
                      <div key={item.id || idx} className="bg-white border border-slate-150 p-4.5 rounded-2xl flex items-start gap-3.5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-xl bg-app-accent/5 text-app-accent flex items-center justify-center shrink-0 border border-app-accent/10">
                          <IconComponent size={18} />
                        </div>
                        <div className="text-left space-y-0.5">
                          <span className="font-extrabold text-slate-900 text-xs block uppercase tracking-wide">{item.title}</span>
                          {item.description && (
                            <span className="text-[10px] text-slate-500 font-medium block leading-relaxed">{item.description}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. SIZE GUIDE SYSTEM SPECIFICATIONS TABLE */}
      {data.enableSizeGuide && data.sizeGuideColumns && data.sizeGuideRows && (
        <section className="bg-slate-50 border-b border-slate-200/60 py-10 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div 
              className={getHighlightClass("sizeGuide")}
              onClick={() => isEdit && onSelectSection?.("sizeGuide", "Specifications")}
              id="view-size-guide"
            >
              {editLabel("sizeGuide", "Size Guide Matrix Table", "Specifications")}

              <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
                <div>
                  <span className="text-[8.5px] font-black text-app-accent uppercase tracking-widest block font-mono mb-1">SIZE ANALYSIS SHEET</span>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Standard Size Chart</h3>
                </div>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-3 py-1 bg-white border border-slate-200 rounded-full">
                  All measurements listed in inches
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm scrollbar-hide">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold font-mono text-[9px] uppercase text-slate-400 tracking-wider">
                      {data.sizeGuideColumns.map((col, idx) => (
                        <th key={idx} className="py-3 px-5 text-[#1A1D4E]">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {data.sizeGuideRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                        {data.sizeGuideColumns.map((col, cIdx) => {
                          const colKey = col.toLowerCase();
                          return (
                            <td key={cIdx} className="py-3 px-5 uppercase font-bold tracking-wide">
                              {row[colKey] !== undefined ? row[colKey] : row[col] || "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. PRICE COMPARISON ACROSS STORES SECTION */}
      {data.enableStoreComparison && data.storeComparisonList && data.storeComparisonList.length > 0 && (
        <section className="bg-white border-b border-slate-200/60 py-10 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div 
              className={getHighlightClass("storeComparison")}
              onClick={() => isEdit && onSelectSection?.("storeComparison", "Specifications")}
              id="view-store-comparison"
            >
              {editLabel("storeComparison", "Retail Store Comparison", "Specifications")}

              <div className="mb-6 text-left">
                <span className="text-[8.5px] font-black text-app-accent uppercase tracking-widest block font-mono mb-1">STORES PRICE GRID</span>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Price Comparisons Across Stores</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {data.storeComparisonList.map((store, idx) => (
                  <div key={store.id || idx} className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-xs flex items-center justify-center text-[#1A1D4E] capitalize p-1">
                            {store.storeLogo ? <img src={store.storeLogo} alt="Logo" className="max-h-full max-w-full object-contain" /> : store.storeName.substring(0, 2)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs block truncate max-w-[120px]">{store.storeName}</span>
                            <div className="flex items-center gap-0.5">
                              <Star size={10} className="fill-orange-400 text-orange-400" />
                              <span className="text-[9px] font-bold text-slate-500 font-mono italic">{store.storeRating} / 5</span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          store.availability === "In Stock" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-500 border border-red-200"
                        }`}>
                          {store.availability}
                        </span>
                      </div>

                      <div className="mt-2 pl-1.5 border-l-2 border-app-accent">
                        <span className="text-[8px] text-slate-400 font-black tracking-widest block font-mono">LISTED RET PRICE</span>
                        <span className="text-base font-black text-slate-900">৳{store.price.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 text-right">
                      {store.storeUrl ? (
                        <a 
                          href={store.storeUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1"
                        >
                          <span>Buy Store Pack</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-[8px] text-slate-400 font-bold font-mono">DIRECT STORE INBOUND</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. INFLUENCER & SOCIAL REVIEWS VIDEO COMPONENT */}
      {data.enableInfluencerReviews && data.influencerVideos && data.influencerVideos.length > 0 && (
        <section className="bg-slate-950 text-white py-12 text-left relative overflow-hidden border-b border-white/5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-app-accent/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 w-full">
            <div 
              className={getHighlightClass("influencers")}
              onClick={() => isEdit && onSelectSection?.("influencers", "Specifications")}
              id="view-influencers"
            >
              {editLabel("influencers", "Influencer Videos Embeds", "Specifications")}

              <div className="mb-8 text-left">
                <span className="text-[8.5px] font-black text-app-accent uppercase tracking-widest block font-mono mb-1">CREATOR BRAND CAMPAIGNS</span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Social & Influencer Reviews</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {data.influencerVideos.map((vid, idx) => (
                  <div 
                    key={vid.id || idx} 
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group/vid relative hover:border-white/20 transition-all flex flex-col justify-between"
                  >
                    
                    <div className="relative aspect-video bg-slate-900 w-full flex items-center justify-center overflow-hidden">
                      {vid.thumbnail ? (
                        <img src={vid.thumbnail} className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-500" alt="" />
                      ) : (
                        <div className="text-white/20 font-bold text-xs uppercase tracking-widest italic flex flex-col items-center gap-1">
                          <Youtube size={20} className="text-red-500" />
                          <span>Video Frame</span>
                        </div>
                      )}
                      
                      {/* Play Action overlays */}
                      <button
                        onClick={() => {
                          setActiveEmbedUrl(vid.url);
                        }}
                        type="button"
                        className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all group-hover/vid:bg-black/55 cursor-pointer border-0"
                      >
                        <div className="w-12 h-12 rounded-full bg-app-accent text-white flex items-center justify-center shadow-lg transform group-hover/vid:scale-110 transition-transform">
                          <Play size={18} fill="currentColor" className="ml-1" />
                        </div>
                      </button>

                      {/* Source badge */}
                      <span className="absolute top-3 left-3 bg-red-600 font-mono font-black text-[7.5px] text-white tracking-widest px-2 py-0.5 rounded-full shadow-md uppercase">
                        {vid.platform} VIDEO
                      </span>
                    </div>

                    <div className="p-4 text-left">
                      <span className="text-[8px] text-[#50DC17] font-black uppercase tracking-widest block mb-0.5 font-mono">VERIFIED PRODUCT RECON</span>
                      <h4 className="text-xs font-semibold text-white tracking-tight line-clamp-2 leading-snug">{vid.title || "Social Video Content Preview"}</h4>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Social Embed Overlay Popups */}
          {activeEmbedUrl && (
            <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="absolute inset-0" onClick={() => setActiveEmbedUrl(null)} />
              <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-2xl relative z-10 shadow-2xl p-4 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-app-accent font-mono">Active Embed Gateway</span>
                  <button onClick={() => setActiveEmbedUrl(null)} className="text-slate-400 hover:text-white text-xs font-bold font-mono">X CLOSE</button>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center space-y-2 text-xs text-white/70">
                  <p>In accordance with platform playground constraints, external iframe videos are simulated.</p>
                  <p className="font-mono text-app-accent font-bold break-all bg-black/20 p-2.5 rounded-md text-[10px] select-all uppercase">
                    🔗 Destination Video: {activeEmbedUrl}
                  </p>
                  <button onClick={() => {
                    navigator.clipboard.writeText(activeEmbedUrl);
                    alert("Link copied! Open in new tab to play full video.");
                  }} className="px-4 py-2 bg-app-accent text-white rounded font-bold text-[10px] uppercase">Copy Embed Link</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. PRODUCT STORY AND OVERVIEW REORDERABLE BLOCKS */}
      <section className="bg-white border-b border-slate-200/60 py-12 text-left">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            
            {/* Left side column: BIO DESCRIPTION */}
            <div className="md:col-span-1 space-y-4">
              <div 
                className={getHighlightClass("biography")}
                onClick={() => isEdit && onSelectSection?.("biography", "Overview & Content")}
                id="view-biography"
              >
                {editLabel("biography", "Bio Paragraph", "Overview & Content")}
                
                <span className="text-[8.5px] text-app-accent font-black uppercase tracking-widest block mb-1 font-mono">
                  Sourcing Narrative
                </span>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">
                  About the Item
                </h3>
                
                <p className="text-xs text-slate-600 leading-relaxed font-semibold uppercase">
                  {data.about || "Enter descriptions for this authentic local brand highlight."}
                </p>

                {/* Pros and cons analysis arrays */}
                <div className="space-y-4 pt-4 mt-4 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <span className="text-[8px] text-emerald-600 font-extrabold uppercase tracking-widest block font-mono">✓ PLATFORM RECOMMENDATIONS</span>
                    {data.pros && data.pros.length > 0 ? (
                      <div className="space-y-1">
                        {data.pros.map((p, pIdx) => (
                          <div key={pIdx} className="text-[10px] font-extrabold text-slate-800 flex items-start gap-1">
                            <span className="text-emerald-500 font-bold font-sans">✔</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No custom benefits listed.</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[8px] text-red-500 font-extrabold uppercase tracking-widest block font-mono">✗ SEGMENT DOWNSIDES</span>
                    {data.cons && data.cons.length > 0 ? (
                      <div className="space-y-1">
                        {data.cons.map((c, cIdx) => (
                          <div key={cIdx} className="text-[10px] font-extrabold text-slate-800 flex items-start gap-1">
                            <span className="text-red-500 font-bold font-sans">✘</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">No caveats listed.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side column: PRODUCT OVERVIEW BLOCKS */}
            <div className="md:col-span-2">
              {data.enableOverviewSection && data.overviewBlocks && (
                <div 
                  className={getHighlightClass("overview")}
                  onClick={() => isEdit && onSelectSection?.("overview", "Overview & Content")}
                  id="view-overview"
                >
                  {editLabel("overview", "Overview Blocks List", "Overview & Content")}

                  <div className="space-y-8">
                    {data.overviewBlocks.filter(b => b.enabled).map((blk, idx) => (
                      <div key={blk.id || idx} className="bg-slate-50 border border-slate-150 p-6 rounded-2xl">
                        <span className="text-[8px] text-[#EB4501] font-black tracking-widest uppercase block mb-1 font-mono">BLOCK MODULE {idx + 1}</span>
                        <h4 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase border-b border-slate-200 pb-2 mb-3.5 italic">{blk.title}</h4>
                        
                        {blk.bullets && blk.bullets.length > 0 && (
                          <ul className="space-y-2 text-left">
                            {blk.bullets.map((bullet, bIdx) => (
                              <li key={bIdx} className="text-xs font-bold text-slate-700 flex items-start gap-2 uppercase tracking-wide">
                                <span className="text-[#EB4501] font-bold text-xs shrink-0 mt-0.5">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {blk.richText && (
                          <p className="text-xs text-slate-500 italic font-semibold leading-relaxed mt-4 pt-3 border-t border-dashed border-slate-200">
                            {blk.richText}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 7. BEST FOR TAGS & KEYWORD METADATA PILLS */}
      {data.enableBestForTags && data.bestForTags && data.bestForTags.length > 0 && (
        <section className="bg-slate-50 border-b border-slate-200/60 py-8 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div 
              className={getHighlightClass("bestForTags")}
              onClick={() => isEdit && onSelectSection?.("bestForTags", "Overview & Content")}
              id="view-bestfor-tags"
            >
              {editLabel("bestForTags", "Best For Tags Selection", "Overview & Content")}

              <div className="flex bg-white/20 border border-slate-200 rounded-2xl p-5 items-center justify-between gap-6 flex-wrap">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest font-mono">IDEAL MATURATION MATCHING</span>
                  <span className="font-extrabold text-slate-900 text-sm italic uppercase block mt-0.5">Best Suited Categories</span>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {data.bestForTags.map((tag, idx) => (
                    <span key={idx} className="text-[9px] font-black uppercase tracking-wider text-[#FF5B00] bg-[#FFF0E8] border border-[#FF5B00]/15 px-3 py-1.5 rounded-full">
                      🔥 {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 8. STANDARD PLATFORM LOGISTIC FOOTER COMPONENT */}
      <footer className="bg-slate-950 py-12 px-4 text-center border-t border-white/5 font-mono text-[9px] text-white/30 tracking-widest uppercase font-bold select-none">
        🛡️ VERIFIED AUTHENTIC BRANDED SKU • SECURITY ENCRYPTED WITH CHOOSIFY DIGITAL ID SYSTEM
      </footer>
    </div>
  );
}
