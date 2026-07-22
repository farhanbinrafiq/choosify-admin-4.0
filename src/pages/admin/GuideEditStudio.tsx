import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, Eye, Save, Globe, Settings, FileText, Sparkles, Check, 
  Trash2, User, Trophy, ShieldCheck, Star, AlertCircle, RefreshCw, 
  ChevronRight, AlignLeft, BarChart2, Plus, Image as ImageIcon, Sparkle,
  MessageSquare, Heart, Bookmark, Share2, HelpCircle, Laptop, Smartphone,
  ExternalLink, PenTool, CheckCircle, Flame, Calendar, BookOpen, ShieldAlert,
  Search, Sliders, Hash, Layers, CheckSquare, Sparkles as SparklesIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { catalogApi } from "../../services/catalogApi";

const CHC_GUIDES_KEY = "choosify_guides_studio_list";
const CHC_VERSIONS_KEY = "choosify_guides_versions";

// Realistic Catalog Products 
interface CatalogProduct {
  id: string;
  name: string;
  price: string;
  rating: number;
  image: string;
  badge: "RECOMMENDED" | "BEST VALUE" | "CHAMPION" | "NEW" | "EDITORS CHOICE" | "POPULAR";
}

const catalogProducts: CatalogProduct[] = [
  { id: "p1", name: "Samsung Galaxy S24 Ultra", price: "৳1,35,000", rating: 4.9, image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=400&q=80", badge: "CHAMPION" },
  { id: "p2", name: "iPhone 15 Pro Max", price: "৳1,48,000", rating: 4.8, image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=400&q=80", badge: "RECOMMENDED" },
  { id: "p3", name: "Xiaomi 14 Ultra", price: "৳1,15,000", rating: 4.7, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80", badge: "NEW" },
  { id: "p4", name: "OnePlus 12 5G", price: "৳84,000", rating: 4.7, image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80", badge: "BEST VALUE" },
  { id: "p5", name: "Xiaomi Redmi Note 13 Pro+", price: "৳42,000", rating: 4.6, image: "https://images.unsplash.com/photo-1565630916779-e303be97b6f5?auto=format&fit=crop&w=400&q=80", badge: "BEST VALUE" },
  { id: "p6", name: "Google Pixel 8 Pro", price: "৳95,000", rating: 4.6, image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80", badge: "EDITORS CHOICE" },
  { id: "p7", name: "Nothing Phone (2)", price: "৳68,000", rating: 4.5, image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=400&q=80", badge: "POPULAR" }
];

export interface ReasoningTag {
  id: string;
  label: string;
  colorType: "green" | "blue" | "red" | "orange" | "purple";
}

export interface MetricScore {
  label: string;
  score: number; // 0 to 10
}

interface VersionSnapshot {
  timestamp: string;
  label: string;
  data: string; // JSON String of GuideData
}

interface GuideData {
  id: string;
  guideTitle: string;
  slug: string;
  category: string;
  publishDate: string;
  readTime: string;
  audienceType: string;
  status: "Draft" | "Under Review" | "Scheduled" | "Published" | "Archived";
  lastUpdated: string;

  // HERO SECTION
  heroImage: string;
  galleryImages: string[];
  submitSampleBadge: string;
  myLoved: boolean;
  totalLovedCount: number;
  awarenessScore: number;

  // CREATOR INFO
  authorName: string;
  authorAvatar: string;
  authorVerified: boolean;
  authorRole: string;
  authorBio: string;
  authorTwitter: string;
  authorLinkedIn: string;
  followButtonLabel: string;
  quickTipText: string;

  // PERFORMANCE BAR (SECTION 2 - READ ONLY)
  perfViews: number;
  perfLoved: number;
  perfHelpful: number;
  perfPurchases: number;
  perfCtr: string;
  perfConvRate: string;
  perfRevInfluenced: string;

  // SECTION 3 LEFT: GUIDE META
  rankedProductIds: string[];
  methodologyDescription: string;
  methodologyChecklist: { id: string; text: string; checked: boolean }[];

  // SECTION 3 CENTER: WINNER PRODUCT
  winnerProductId: string;
  winnerPriceOverride: string;
  winnerCtaLabel: string;
  winnerCtaUrl: string;
  winnerMetrics: MetricScore[];

  // SECTION 4: WHY THIS WON TAGS
  whyThisWonTags: ReasoningTag[];

  // SECTION 5: RECOMMENDATION & QUICK VERDICT
  verdictHeaders: {
    bestFor: string;
    notFor: string;
    pros: string;
    cons: string;
    valueVerdict: string;
    performanceVerdict: string;
  };
  verdictBestFor: string[];
  verdictNotFor: string[];
  verdictPros: string[];
  verdictCons: string[];
  verdictValueBody: string;
  verdictPerformanceBody: string;

  // SECTION 6: DETAIL EVALUATION
  evalBody: string;

  // SECTION 7: KEY TAKEAWAYS
  takeawayHeadline: string;
  takeawayBody: string;
  takeawayBgStyle: "slate" | "navy" | "charcoal" | "amber";
  takeawayAccentTheme: "orange" | "cyan" | "emerald" | "purple";

  // SECTION 8: OTHER PRODUCTS MENTIONED
  otherMentionedIds: string[];
  otherNotes: Record<string, string>; // productId -> Custom Note text
  otherPriceOverrides: Record<string, string>; // productId -> Price override
  otherRanks: Record<string, number>; // productId -> custom display rank

  /**
   * Content Detail optional sections — toggled when publishing.
   * Frontend Guide Details page renders only enabled entries (in order).
   */
  detailSections: { id: string; enabled: boolean; order: number }[];

  // SECTION 9: SEO SETTINGS
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoCanonicalUrl: string;
  seoOgImage: string;

  // SECTION 10: DISCLOSURE & TRUST
  disclosureAffiliate: boolean;
  disclosureSponsored: boolean;
  disclosureSampleReceived: boolean;
  disclosureIndependentlyPurchased: boolean;
  disclosureCreatorTested: boolean;
  disclosureFactChecked: boolean;
  disclosureEditorReviewed: boolean;

  // SECTION 11: ANALYTICS PERFORMANCE (READ ONLY)
  analyticsViews: number;
  analyticsHelpfulVotes: number;
  analyticsLovedCount: number;
  analyticsPurchasesCount: number;
  analyticsCtrRate: string;
  analyticsRevenue: string;
  analyticsAvgReadTime: string;
  analyticsBounceRate: string;
  analyticsCreatorEarnings: string;
}

const defaultNewGuide: GuideData = {
  id: "temp",
  guideTitle: "TOP 10 FLAGSHIP SMARTPHONES TO BUY IN BANGLADESH (2026 EDITION)",
  slug: "top-flagship-smartphones-bangladesh-2026",
  category: "Mobile Phones",
  publishDate: "June 13, 2026",
  readTime: "9 min read",
  audienceType: "Power Users & Heavy Mobile App Builders",
  status: "Draft",
  lastUpdated: "June 13, 2026 12:45 PM",

  // Section 1: Hero
  heroImage: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
  galleryImages: [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1565630916779-e303be97b6f5?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80"
  ],
  submitSampleBadge: "VERIFIED LAB TESTING UNIT",
  myLoved: true,
  totalLovedCount: 412,
  awarenessScore: 94,

  // Creator profile
  authorName: "Farhan Bin Rafiq",
  authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
  authorVerified: true,
  authorRole: "Chief Mobile hardware benchmarks analyst",
  authorBio: "Hardware writer & benchmark engineer. Spends hundreds of continuous system hours testing mobile chips and battery thermal margins in Bangladesh's climate.",
  authorTwitter: "@farhan_choosify",
  authorLinkedIn: "linkedin.com/in/farhan-rafiq-tech",
  followButtonLabel: "Follow Farhan's reviews",
  quickTipText: "When shopping for high-end flagships in Dhaka, prioritize sellers providing authorized Bangladesh warranty cards. Extreme thermal heat and humidity heavily impact panel laminations, making localized warranty support indispensable.",

  // Performance (read only)
  perfViews: 12450,
  perfLoved: 1980,
  perfHelpful: 1420,
  perfPurchases: 450,
  perfCtr: "14.2%",
  perfConvRate: "3.61%",
  perfRevInfluenced: "৳6,07,50,000",

  // Left Column Guide Meta
  rankedProductIds: ["p1", "p2", "p3", "p4", "p5"],
  methodologyDescription: "Every single hardware unit listed on our buying pages is procured independently. We spent a rigorous 45+ hours running high fidelity gaming stresses and measuring screen luminance glare.",
  methodologyChecklist: [
    { id: "mc1", text: "45+ Continuous laboratory testing hours under direct sunlight", checked: true },
    { id: "mc2", text: "Independent diagnostic screen calibration checks", checked: true },
    { id: "mc3", text: "Verified local warranty availability audits in Dhaka IDB", checked: true },
    { id: "mc4", text: "Thermal dissipation thresholds evaluated at 33°C ambient", checked: true }
  ],

  // Winner section
  winnerProductId: "p1",
  winnerPriceOverride: "৳1,32,000",
  winnerCtaLabel: "Buy local official outlet",
  winnerCtaUrl: "https://shop.samsung.com/bd",
  winnerMetrics: [
    { label: "Hours You Benefit", score: 9.8 },
    { label: "Performance", score: 9.9 },
    { label: "Camera Benchmarks", score: 9.7 },
    { label: "AI Score", score: 9.2 },
    { label: "Display Luminance", score: 9.6 }
  ],

  // Why this won tags
  whyThisWonTags: [
    { id: "wt1", label: "Snapdragon 8 Gen 3 peak game clocks", colorType: "green" },
    { id: "wt2", label: "Spectacular daylight glare rejection coating", colorType: "blue" },
    { id: "wt3", label: "Tough Titanium drop resistant chassis", colorType: "purple" },
    { id: "wt4", label: "Included stylus real-time multitasking", colorType: "orange" }
  ],

  // Recommendation Grid
  verdictHeaders: {
    bestFor: "Best For",
    notFor: "Not Suitable For",
    pros: "Core Advantages",
    cons: "Potential Drawbacks",
    valueVerdict: "Value Assessment",
    performanceVerdict: "Performance Verdict"
  },
  verdictBestFor: [
    "Gamers requiring high sustained clock rates during intense sessions",
    "Professionals looking for note-taking stylus utility",
    "Content creators shooting high-quality UHD videos"
  ],
  verdictNotFor: [
    "Casual screen users looking for light weight compact footprints",
    "Extreme budget-conscious buyers"
  ],
  verdictPros: [
    "S-Pen allows versatile annotation productivity on the fly",
    "Flat panel form factor eliminates touch mistriggers",
    "Best software upgrade roadmap in the current industry (7 years)"
  ],
  verdictCons: [
    "Power brick adapter excluded from retail box packages",
    "Standard power rate limited to 45 Watts maximum"
  ],
  verdictValueBody: "While the price point demands absolute premium investment, the prolonged support lifespan and exceptional durability indexes make this a fantastic value proposition for multi-year users.",
  verdictPerformanceBody: "Nothing short of breathtaking. The gaming stress benchmarks outperform comparable elite chips with zero visual microstutter or dangerous core thermal throttling.",

  // Detail eval
  evalBody: "Our physical hands-on benchmarks began by placing the top three devices side-by-side inside Dhaka's extreme outdoor afternoon sun glare to verify real display limits. The anti-reflective armor screen recorded a massive 75% flare mitigation compared to the mirror-like glass on standard models.\n\nFor internal performance, we ran successive loops of graphic-heavy frameworks for four continuous hours. We observed optimal vapor chamber dissipation with maximum outer temperatures peaking nicely under 41°C.",

  // Takeaways
  takeawayHeadline: "THE AUTHORITATIVE VERDICT ON FLAGSHIP INVESTMENT",
  takeawayBody: "If your goal is absolute screen legibility in Bangladesh glare, complete productivity stylus tools, and heavy software upgrades that stretch until the next decade, the Galaxy S24 Ultra is your undisputed overall winner.",
  takeawayBgStyle: "charcoal",
  takeawayAccentTheme: "orange",

  // Other mentioned
  otherMentionedIds: ["p2", "p3", "p4", "p5"],
  otherNotes: {
    p2: "Superb alternative option for absolute iOS ecosystem loyalty.",
    p3: "Incredible Leica optical system, best for professional DSLR lovers.",
    p4: "Incredibly fast charging and great screen clarity for visual enthusiasts.",
    p5: "The absolute master of high-tier budget compromises, supreme display for less."
  },
  otherPriceOverrides: {
    p2: "৳1,45,000",
    p3: "৳1,14,000",
    p4: "৳82,500",
    p5: "৳41,000"
  },
  otherRanks: {
    p2: 2,
    p3: 3,
    p4: 4,
    p5: 5
  },

  detailSections: [
    { id: "winner", enabled: true, order: 0 },
    { id: "why_it_won", enabled: true, order: 1 },
    { id: "verdict", enabled: true, order: 2 },
    { id: "takeaways", enabled: true, order: 3 },
    { id: "items_mentioned", enabled: true, order: 4 },
    { id: "brands_mentioned", enabled: false, order: 5 },
    { id: "how_review_was_made", enabled: true, order: 6 },
  ],

  // SEO
  seoTitle: "Best Flagship Smartphone to Buy in Bangladesh (June 2026)",
  seoDescription: "Exhaustive hands-on lab comparisons of elite mobile flagships. Find out why the Galaxy S24 Ultra took our platinum overall champion seal.",
  seoKeywords: "best phones bangladesh, s24 ultra bd price, top camera mobile dhaka, phone buying guide bd",
  seoCanonicalUrl: "https://choosify.bd/guides/top-flagship-smartphones-bangladesh-2026",
  seoOgImage: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",

  // Disclosure
  disclosureAffiliate: true,
  disclosureSponsored: false,
  disclosureSampleReceived: true,
  disclosureIndependentlyPurchased: false,
  disclosureCreatorTested: true,
  disclosureFactChecked: true,
  disclosureEditorReviewed: true,

  // Content performance (read only)
  analyticsViews: 12450,
  analyticsHelpfulVotes: 1420,
  analyticsLovedCount: 1980,
  analyticsPurchasesCount: 450,
  analyticsCtrRate: "14.2%",
  analyticsRevenue: "৳23,45,000",
  analyticsAvgReadTime: "4m 42s",
  analyticsBounceRate: "28.4%",
  analyticsCreatorEarnings: "৳1,87,600"
};

export default function GuideEditStudio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = id !== "new" && id !== undefined;
  
  const [guide, setGuide] = useState<GuideData>(defaultNewGuide);
  const [viewportMode, setViewportMode] = useState<"desktop" | "mobile">("desktop");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Versions state
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [savingState, setSavingState] = useState<"Saved" | "Saving..." | "Changes pending">("Saved");
  
  // RIGHT SIDE SYSTEM-SCOPED SLIDING DRAWER WIDTH: 480px
  const [activeDrawerSection, setActiveDrawerSection] = useState<string | null>(null);

  // Load from local storage or set defaults
  useEffect(() => {
    let currentGuidesList: GuideData[] = [];
    const cachedGuides = localStorage.getItem(CHC_GUIDES_KEY);
    if (cachedGuides) {
      try {
        currentGuidesList = JSON.parse(cachedGuides);
      } catch (_) {
        currentGuidesList = [];
      }
    }

    if (isEditing) {
      const match = currentGuidesList.find(g => g.id === id);
      if (match) {
        setGuide({ ...defaultNewGuide, ...match });
      } else {
        triggerToast("⚠️ Custom guide not found in local catalog registry. Instantiating demo draft.");
        const tempGuide = { ...defaultNewGuide, id: id as string };
        setGuide(tempGuide);
      }
    } else {
      const tempId = "guide_" + Math.random().toString(36).substring(2, 9);
      setGuide({ ...defaultNewGuide, id: tempId, guideTitle: "NEW UNTITLED BUYING GUIDE STUDY" });
    }

    // Load custom versions
    const cachedVersions = localStorage.getItem(CHC_VERSIONS_KEY);
    if (cachedVersions) {
      try {
        const parsed = JSON.parse(cachedVersions);
        setVersions(parsed[id || "temp"] || []);
      } catch (_) {
        setVersions([]);
      }
    }
  }, [id, isEditing]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncGuideToCatalog = async (guideData: GuideData, publishLive = false) => {
    const guideId = String(guideData.id).startsWith('guide') ? String(guideData.id) : `guide-${guideData.id}`;
    const status =
      publishLive || guideData.status === 'Published'
        ? 'live'
        : guideData.status === 'Archived'
          ? 'archived'
          : 'draft';
    await catalogApi.upsertGuide(guideId, {
      id: guideId,
      slug: guideData.slug || guideId,
      title: guideData.guideTitle,
      author: guideData.authorName,
      authorAvatar: guideData.authorAvatar,
      category: guideData.category,
      excerpt: guideData.takeawayBody || guideData.methodologyDescription,
      image: guideData.heroImage,
      type: 'article',
      readTime: guideData.readTime,
      views: String(guideData.perfViews || 0),
      tags: guideData.whyThisWonTags?.map((tag) => tag.label) || [],
      productIds: guideData.rankedProductIds || [],
      whatWeLike: guideData.verdictPros || [],
      whatToConsider: guideData.verdictCons || [],
      sections: (guideData.detailSections || []).map((s, i) => ({
        id: s.id,
        enabled: s.enabled !== false,
        order: typeof s.order === "number" ? s.order : i,
      })),
      seoTitle: guideData.seoTitle,
      seoDescription: guideData.seoDescription,
      seoKeywords: guideData.seoKeywords,
      seoOgImage: guideData.seoOgImage,
      seoCanonicalUrl: guideData.seoCanonicalUrl,
      status,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleFieldChange = (field: keyof GuideData, value: any) => {
    setGuide(prev => ({
      ...prev,
      [field]: value
    }));
    setSavingState("Changes pending");
  };

  // Section Scoped Save System
  const handleSaveSection = (sectionName: string) => {
    // Save to LocalStorage list
    let currentGuidesList: any[] = [];
    const cachedGuides = localStorage.getItem(CHC_GUIDES_KEY);
    if (cachedGuides) {
      try {
        currentGuidesList = JSON.parse(cachedGuides);
      } catch (_) {}
    }

    const matchIdx = currentGuidesList.findIndex(g => g.id === guide.id);
    if (matchIdx >= 0) {
      currentGuidesList[matchIdx] = guide;
    } else {
      currentGuidesList.push(guide);
    }

    localStorage.setItem(CHC_GUIDES_KEY, JSON.stringify(currentGuidesList));
    setSavingState("Saved");
    syncGuideToCatalog(guide).catch(() => undefined);
    triggerToast(`✓ Section [${sectionName.toUpperCase()}] saved independently & catalog updated.`);
    
    // Auto backup checkpoint
    createCheckpointVersion(`Backup: Edited ${sectionName}`);
    setActiveDrawerSection(null);
  };

  const createCheckpointVersion = (label: string) => {
    const freshVersion: VersionSnapshot = {
      timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
      label: label,
      data: JSON.stringify(guide)
    };
    const updatedVersions = [freshVersion, ...versions].slice(0, 8); // cap size
    setVersions(updatedVersions);

    const cachedVersions = localStorage.getItem(CHC_VERSIONS_KEY);
    let vMap: Record<string, VersionSnapshot[]> = {};
    if (cachedVersions) {
      try { vMap = JSON.parse(cachedVersions); } catch (_) {}
    }
    vMap[guide.id] = updatedVersions;
    localStorage.setItem(CHC_VERSIONS_KEY, JSON.stringify(vMap));
  };

  const restoreVersionSnapshot = (snap: VersionSnapshot) => {
    try {
      const parsed = JSON.parse(snap.data);
      setGuide(parsed);
      triggerToast("✓ Restored successfully from snapshot revision.");
      setSavingState("Changes pending");
    } catch (_) {
      triggerToast("❌ Failed parsing snapshot content.");
    }
  };

  // Helpers
  const getProductById = (pid: string): CatalogProduct | null => {
    return catalogProducts.find(p => p.id === pid) || null;
  };

  const getPillColorClasses = (color: string) => {
    switch(color) {
      case "green": return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "blue": return "bg-blue-50 text-blue-800 border-blue-200";
      case "red": return "bg-rose-50 text-rose-800 border-rose-200";
      case "orange": return "bg-orange-50 text-orange-850 border-orange-200";
      case "purple": return "bg-purple-50 text-purple-800 border-purple-200";
      default: return "bg-slate-50 text-slate-800 border-slate-200";
    }
  };

  // Dynamic products reference
  const winnerProduct = getProductById(guide.winnerProductId) || catalogProducts[0];

  return (
    <div id="guide-edit-studio" className="pb-24 text-slate-800 min-h-screen bg-[#F8FAFC] -m-6 p-6 font-sans select-none relative overflow-x-hidden">
      
      {/* Dynamic Toast System */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-8 right-8 z-[300] bg-app-card border border-orange-500/30 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-app-text-secondary">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STICKY TOP ACTION BAR */}
      <div className="sticky top-0 z-40 bg-[#0B1528] text-app-text-primary px-6 py-3.5 rounded-2xl shadow-md flex items-center justify-between mb-8 border border-app-border">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/dashboard/content-studio/guides")}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-app-border text-app-text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="bg-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-orange-500/30">
                Guide Studio V3
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase${guide.status === "Published" ? "text-emerald-400" : "text-amber-400"}`}>
                ● {guide.status} ({savingState})
              </span>
            </div>
            <h2 className="text-sm font-black text-app-text-primary truncate max-w-[150px] md:max-w-[450px]">
              {guide.guideTitle}
            </h2>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-3">
          {/* Viewport swap */}
          <div className="hidden lg:flex p-1 bg-white/10 border border-app-border rounded-xl gap-1">
            <button
              onClick={() => setViewportMode("desktop")}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider${viewportMode === "desktop" ? "bg-white/20 text-orange-400" : "text-slate-300 hover:text-white"}`}
            >
              <Laptop className="w-3.5 h-3.5" /> Desktop
            </button>
            <button
              onClick={() => setViewportMode("mobile")}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider${viewportMode === "mobile" ? "bg-white/20 text-orange-400" : "text-slate-300 hover:text-white"}`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile View
            </button>
          </div>

          <button
            onClick={async () => {
              handleFieldChange("status", "Published");
              try {
                await syncGuideToCatalog({ ...guide, status: 'Published' }, true);
                triggerToast("✓ Guide published to catalog API successfully!");
              } catch {
                triggerToast("✓ Guide status updated locally (catalog sync failed).");
              }
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Publish
          </button>

          <button
            onClick={() => {
              handleFieldChange("status", "Draft");
              triggerToast("✓ Guide saved to draft workspace.");
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-app-text-primary rounded-xl text-xs font-bold uppercase tracking-wider border border-app-border transition-all"
          >
            Save Draft
          </button>

          <button
            onClick={() => {
              setActiveDrawerSection("seo");
              triggerToast("Opening global settings drawer.");
            }}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-app-border text-app-text-primary"
            title="SEO Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* LAST REVISION CHECKPOINT BAR */}
      <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl mb-6 flex justify-between items-center text-xs text-slate-600 shadow-sm animate-fade-in">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-600" />
          <span>Last Saved revision: <strong className="text-slate-950">{guide.lastUpdated}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-app-text-secondary font-mono uppercase">Sync snapshots: {versions.length} available</span>
          <button 
            onClick={() => setActiveDrawerSection("versions")}
            className="text-orange-600 hover:text-orange-700 hover:underline uppercase text-[9px] font-black"
          >
            Rollback History ⏎
          </button>
        </div>
      </div>

      {/* THE ACTUAL WEB APP WORKSPACE CONTENT AREA */}
      {/* This adjusts fluidly with custom margins mimicking the chosen viewport mode */}
      <div className={`transition-all duration-300 mx-auto${viewportMode === "mobile" ? "max-w-[440px] border-x-4 border-slate-200 p-4 bg-white rounded-[2.5rem] shadow-2xl" : "w-full"}`}>
        
        {/* ================= SECTION 1: GUIDE HERO ================= */}
        <div id="section-1-hero" className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm mb-6 text-left relative group overflow-hidden flex flex-col gap-6">
          
          {/* Edit Trigger - Pencil with Orange Accent */}
          <button 
            id="edit-trigger-hero"
            onClick={() => setActiveDrawerSection("hero")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all shadow-sm z-20 border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          {/* Submit Sample badge overlay */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="bg-[#0B1528] text-app-text-primary font-mono font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-md shadow-sm">
              ● {guide.submitSampleBadge}
            </span>
            <span className="bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[8px] uppercase tracking-wider px-2 py-1 rounded">
              {guide.category}
            </span>
            <span className="text-app-text-secondary text-[10px] font-mono whitespace-nowrap">{guide.readTime}</span>
          </div>

          {/* Hero title overlay body */}
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight max-w-4xl font-sans">
              {guide.guideTitle}
            </h1>
          </div>

          {/* Featured Image display block */}
          <div className="relative w-full h-[280px] md:h-[400px] rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50">
            <img src={guide.heroImage} className="w-full h-full object-cover" alt="Featured hero banner" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 flex items-center justify-between">
              <span className="text-white/80 text-[10px] font-mono bg-app-card/20 px-2 py-1 rounded backdrop-blur-sm">Featured Representation Unit</span>
            </div>
          </div>

          {/* Thumbnail navigation list for Gallery Strip */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 border-b border-slate-100 pb-4">
            {guide.galleryImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => handleFieldChange("heroImage", img)}
                className={`w-14 h-10 rounded-lg overflow-hidden border transition-all${guide.heroImage === img ? "border-orange-500 ring-4 ring-orange-100" : "border-slate-200 opacity-70 hover:opacity-100"}`}
              >
                <img src={img} className="w-full h-full object-cover" alt="Thumb" />
              </button>
            ))}
            <span className="text-[9px] uppercase font-mono tracking-widest text-app-text-secondary ml-4 font-bold">Interactive Gallery Strip</span>
          </div>

          {/* Sub content: Creator preview info, love buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={guide.authorAvatar} className="w-10 h-10 rounded-full object-cover border border-slate-100 shadow-sm" alt="Author" />
              <div className="text-left">
                <span className="text-app-text-secondary text-[9px] block font-mono uppercase font-bold tracking-wider">Vetted by Lead editor</span>
                <span className="text-slate-800 text-xs font-black font-sans flex items-center gap-1.5">
                  {guide.authorName} 
                  {guide.authorVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />}
                </span>
              </div>
            </div>

            {/* Loved state stats inside Hero */}
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-150">
              <button 
                onClick={() => handleFieldChange("myLoved", !guide.myLoved)}
                className={`flex items-center gap-1.5 text-xs font-bold uppercase transition-all${guide.myLoved ? "text-rose-650" : "text-slate-400 hover:text-slate-600"}`}
              >
                <Heart className={`w-4 h-4${guide.myLoved ? "fill-rose-500 text-rose-600" : ""}`} /> 
                <span>{guide.myLoved ? "Loved" : "Love Brand?"}</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-200" />
              <div className="text-[10px] font-mono leading-none text-left">
                <span className="text-slate-900 block font-black">{guide.totalLovedCount}</span>
                <span className="text-slate-450">Total Lovers</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-200" />
              <div className="text-[10px] font-mono text-left">
                <span className="text-emerald-600 block font-black">{guide.awarenessScore}%</span>
                <span className="text-slate-455">Awareness</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 2: GUIDE PERFORMANCE BAR ================= */}
        <div id="section-2-performance" className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-left shadow-sm">
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Est Views</span>
            <span className="text-sm font-black text-slate-900">{guide.perfViews.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Loved Count</span>
            <span className="text-sm font-black text-rose-600">❤ {guide.perfLoved}</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Helpful Votes</span>
            <span className="text-sm font-black text-emerald-600">✓ {guide.perfHelpful}</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Purchases</span>
            <span className="text-sm font-black text-slate-900">{guide.perfPurchases} Units</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Click Through Rate</span>
            <span className="text-sm font-black text-orange-600">{guide.perfCtr}</span>
          </div>
          <div>
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Conv. Rate</span>
            <span className="text-sm font-black text-slate-900">{guide.perfConvRate}</span>
          </div>
          <div className="col-span-2 md:col-span-1">
            <span className="text-[8px] font-mono text-app-text-secondary uppercase tracking-wider block font-bold">Revenue Influenced</span>
            <span className="text-sm font-black text-emerald-600">{guide.perfRevInfluenced}</span>
          </div>
        </div>

        {/* ================= SECTION 3: THREE COLUMN LAYOUT ================= */}
        <div id="section-3-columns" className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          
          {/* LEFT 25% COLUMN: GUIDE META */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-left relative group">
            
            <button 
              id="edit-trigger-meta"
              onClick={() => setActiveDrawerSection("meta")}
              className="absolute top-4 right-4 p-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-all border border-orange-500/20"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3">
              ● SECTION 3A: GUIDE METRIC REVIEW
            </span>

            {/* List of Ranked Products */}
            <div className="space-y-2.5 mb-5 select-none">
              <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block mb-1.5">Ranked Products Linkage</span>
              {guide.rankedProductIds.map((pid, idx) => {
                const prod = getProductById(pid);
                return (
                  <div key={pid} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="w-5 h-5 bg-slate-250 rounded-md text-[10px] font-bold text-center flex items-center justify-center text-orange-600 font-mono">#{idx+1}</span>
                    <span className="text-xs text-slate-700 truncate font-semibold">{prod?.name || "Product"}</span>
                  </div>
                );
              })}
            </div>

            <div className="w-full h-[1px] bg-slate-100 my-4" />

            {/* Methodology check list */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 font-bold block">Testing Methodology</span>
              <p className="text-[11px] text-slate-500 leading-normal mb-2.5 font-serif">{guide.methodologyDescription}</p>
              
              <div className="space-y-1.5">
                {guide.methodologyChecklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 text-[10px] text-slate-600">
                    <span className="text-emerald-500 mt-0.5 font-bold">✓</span>
                    <span className="leading-tight font-serif">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER 45% COLUMN: WINNER PRODUCT (APPROVED EXCLUSIVE DARK SECTION) */}
          <div className="lg:col-span-6 bg-app-card text-app-text-primary rounded-2xl p-6 border border-app-border text-left relative group">
            
            <button 
              id="edit-trigger-winner"
              onClick={() => setActiveDrawerSection("winner")}
              className="absolute top-4 right-4 p-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-all border border-orange-500/20"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            <div className="absolute top-4 left-6 bg-emerald-500 text-slate-950 font-black text-[9px] tracking-widest px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-md">
              <Trophy className="w-3 h-3 fill-slate-950" /> #1 OVERALL LABORATORY CHAMPION
            </div>

            <div className="flex flex-col md:flex-row gap-6 mt-10">
              <div className="w-full md:w-36 shrink-0 text-center">
                <div className="bg-app-card rounded-xl p-3 border border-app-border aspect-square flex items-center justify-center relative">
                  <img src={winnerProduct?.image} className="w-full h-full object-contain scale-105" alt="Winner product icon" />
                  <span className="absolute bottom-1 right-1 bg-orange-600 font-mono font-black text-[8px] px-1.5 rounded uppercase">{winnerProduct?.badge}</span>
                </div>
                
                <div className="mt-4">
                  <span className="text-[8px] font-mono text-app-text-secondary block">LOCAL RETAIL DEAL</span>
                  <span className="text-base font-black text-[#00D4B2]">{guide.winnerPriceOverride}</span>
                </div>
              </div>

              {/* Info details and scoring benchmarks */}
              <div className="flex-1 space-y-3.5">
                <h3 className="text-base md:text-lg font-black text-app-text-primary leading-none tracking-tight">
                  {winnerProduct?.name}
                </h3>
                <p className="text-[11px] text-app-text-secondary leading-normal font-serif">
                  Our rigorous thermal stresses run within Bangladesh's extreme summer conditions confirm this unit holds exceptional high sustained benchmarks. Retains unmatched specifications retention.
                </p>

                {/* Score meters */}
                <div className="space-y-1.5 bg-[#0F0F1D] border border-app-border p-3 rounded-xl mt-3">
                  {guide.winnerMetrics.map((met, idx) => (
                    <div key={idx} className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between font-bold text-app-text-secondary">
                        <span>{met.label}</span>
                        <span className="text-orange-400 font-mono">{met.score.toFixed(1)} / 10</span>
                      </div>
                      <div className="w-full h-1 bg-app-bg rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${met.score * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <a 
                    href={guide.winnerCtaUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-2.5 block text-center bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform shadow-lg shadow-orange-500/10"
                  >
                    {guide.winnerCtaLabel} ↗
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 30% COLUMN: CREATOR PROFILE */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-left relative group flex flex-col justify-between">
            
            <button 
              id="edit-trigger-creator"
              onClick={() => setActiveDrawerSection("creator")}
              className="absolute top-4 right-4 p-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-all border border-orange-500/20"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>

            <div>
              <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3.5">
                ● TRUSTED LAB CONTRIBUTOR
              </span>

              <div className="flex items-center gap-3 mb-3.5">
                <img src={guide.authorAvatar} className="w-10 h-10 rounded-full object-cover border border-slate-100 shadow-sm" alt="Creator avatar" />
                <div>
                  <h6 className="text-xs font-black text-slate-900 leading-tight">{guide.authorName}</h6>
                  <p className="text-[9px] text-[#00D4B2] font-semibold font-mono whitespace-nowrap overflow-hidden text-ellipsis w-[140px]" title={guide.authorRole}>{guide.authorRole}</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-normal mb-4 font-serif">
                {guide.authorBio}
              </p>
            </div>

            {/* Social credentials */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 border-t border-slate-100 pt-3.5">
                <span>{guide.authorTwitter}</span>
                <span className="text-[#00D4B2] font-extrabold">★ Verifier</span>
              </div>

              <button className="w-full py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors rounded-xl text-[10px] font-bold text-slate-700">
                {guide.followButtonLabel}
              </button>
            </div>

          </div>

        </div>

        {/* QUICK TIP SUBSIDIARY BANNER */}
        <div className="bg-amber-50/70 border border-amber-150 p-5 rounded-2xl mb-6 text-left relative group">
          <button 
            id="edit-trigger-tip"
            onClick={() => setActiveDrawerSection("creator")}
            className="absolute top-4 right-4 p-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-all"
          >
            <PenTool className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-bold font-mono text-orange-700 uppercase tracking-widest block mb-1">LOCAL BUYING TIP & TRICKS</span>
          <p className="text-xs text-slate-800 leading-relaxed font-serif">
            "{guide.quickTipText}"
          </p>
        </div>

        {/* ================= SECTION 4: WHY THIS WON ================= */}
        <div id="section-4-reasons" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          
          <button 
            id="edit-trigger-reasons"
            onClick={() => setActiveDrawerSection("reasons")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-2 text-left">
            ● SECTION 4: DECISION REASONING SIGNALS
          </span>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4 text-left">
            How The Overall Winner Secured the Gold Spotlight
          </h4>

          {/* Tags grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {guide.whyThisWonTags.map((tag, idx) => (
              <div key={tag.id} className={`flex items-start gap-3 p-3 rounded-xl border${getPillColorClasses(tag.colorType)}`}>
                <span className="w-5 h-5 rounded bg-white/60 shadow-sm flex items-center justify-center font-mono text-[9px] font-black text-slate-700 mt-0.5">{idx+1}</span>
                <div className="text-left">
                  <span className="text-[11px] font-bold text-slate-900 block">{tag.label}</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider block mt-0.5">Verified lab stress vetting</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= SECTION 5: RECOMMENDATION & QUICK VERDICT ================= */}
        <div id="section-5-verdict" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          
          <button 
            id="edit-trigger-verdict"
            onClick={() => setActiveDrawerSection("verdict")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3 text-left">
            ● SECTION 5: COMPARATIVE VERDICT GRID
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Best For */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
              <span className="text-[9px] font-mono font-black text-emerald-700 uppercase tracking-widest block mb-2">★ {guide.verdictHeaders.bestFor}</span>
              <ul className="space-y-1.5 font-serif">
                {guide.verdictBestFor.map((t, idx) => (
                  <li key={idx} className="text-[11px] text-slate-800 flex items-start gap-1"><span className="text-emerald-600 font-bold shrink-0">✓</span> <span>{t}</span></li>
                ))}
              </ul>
            </div>

            {/* Not For */}
            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl font-serif">
              <span className="text-[9px] font-mono font-black text-rose-700 uppercase tracking-widest block mb-2">✕ {guide.verdictHeaders.notFor}</span>
              <ul className="space-y-1.5">
                {guide.verdictNotFor.map((t, idx) => (
                  <li key={idx} className="text-[11px] text-slate-800 flex items-start gap-1"><span className="text-rose-600 font-bold shrink-0">✕</span> <span>{t}</span></li>
                ))}
              </ul>
            </div>

            {/* Pros */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
              <span className="text-[9px] font-mono font-black text-slate-600 uppercase tracking-widest block mb-2">● {guide.verdictHeaders.pros}</span>
              <ul className="space-y-1.5 font-serif">
                {guide.verdictPros.map((t, idx) => (
                  <li key={idx} className="text-[11px] text-slate-800 flex items-start gap-1"><span className="text-emerald-600 font-semibold">★</span> <span>{t}</span></li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
              <span className="text-[9px] font-mono font-black text-slate-600 uppercase tracking-widest block mb-2">▲ {guide.verdictHeaders.cons}</span>
              <ul className="space-y-1.5 font-serif">
                {guide.verdictCons.map((t, idx) => (
                  <li key={idx} className="text-[11px] text-slate-800 flex items-start gap-1"><span className="text-amber-600">⚠</span> <span>{t}</span></li>
                ))}
              </ul>
            </div>

            {/* Value Assessment */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <span className="text-[9px] font-mono text-orange-700 block uppercase tracking-widest mb-1 font-bold">{guide.verdictHeaders.valueVerdict}</span>
              <p className="text-[11px] text-slate-700 leading-normal font-serif">{guide.verdictValueBody}</p>
            </div>

            {/* Performance Verdict */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
              <span className="text-[9px] font-mono text-emerald-750 block uppercase tracking-widest mb-1 font-bold">{guide.verdictHeaders.performanceVerdict}</span>
              <p className="text-[11px] text-slate-700 leading-normal font-serif">{guide.verdictPerformanceBody}</p>
            </div>
          </div>
        </div>

        {/* ================= SECTION 6: DETAIL EVALUATION ================= */}
        <div id="section-6-evaluation" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          
          <button 
            id="edit-trigger-evaluation"
            onClick={() => setActiveDrawerSection("evaluation")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3 text-left">
            ● SECTION 6: DETAILED BENCHMARK EVALULATION STREAM
          </span>

          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500">Content Body & Hands-on Lab Diagnostics</h4>
            <span className="bg-emerald-500/10 text-emerald-600 text-[8px] tracking-widest uppercase font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              🛡 ZERO AI CONTENT DETECTED
            </span>
          </div>

          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif whitespace-pre-wrap">
            {guide.evalBody}
          </p>
        </div>

        {/* ================= SECTION 7: KEY TAKEAWAYS ================= */}
        <div id="section-7-takeaways" className="bg-orange-50/45 border border-orange-100/80 rounded-3xl p-6 md:p-8 text-center relative group overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-655/10 rounded-full blur-xl" />
          
          <button 
            id="edit-trigger-takeaways"
            onClick={() => setActiveDrawerSection("takeaways")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-orange-600 text-[9px] font-mono font-black uppercase tracking-widest block mb-2">
            ★ EDITORS SUMMARY STAMP
          </span>

          <h4 className="text-sm md:text-base font-black text-[#0B1528] uppercase tracking-wider mb-2">
            {guide.takeawayHeadline}
          </h4>

          <div className="w-8 h-[2px] bg-orange-500 mx-auto my-3" />

          <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-serif font-medium max-w-2xl mx-auto italic">
            "{guide.takeawayBody}"
          </p>

        </div>

        {/* ================= SECTION 8: OTHER PRODUCTS MENTIONED ================= */}
        <div id="section-8-others" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          
          <button 
            id="edit-trigger-others"
            onClick={() => setActiveDrawerSection("others")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3 text-left">
            ● SECTION 8: ALTERNATIVE PRODUCTS MENTIONED IN THIS EXPERT ROUNDUP
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top alternatives list in grid layout */}
            {guide.otherMentionedIds.map((pid, idx) => {
              const p = getProductById(pid);
              if (!p) return null;
              const displayPrice = guide.otherPriceOverrides[pid] || p.price;
              const displayRank = guide.otherRanks[pid] || (idx + 2);
              const noteText = guide.otherNotes[pid] || "Good alternative specification pick.";

              return (
                <div key={pid} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-4">
                  <div className="w-16 h-16 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 relative shadow-sm">
                    <img src={p.image} className="w-full h-full object-contain" alt="" />
                    <span className="absolute -top-2.5 -left-2 bg-[#0B1528] text-orange-400 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-app-border font-mono">
                      #{displayRank}
                    </span>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <h5 className="text-xs font-black text-slate-900 truncate max-w-[150px]">{p.name}</h5>
                      <span className="text-[10px] text-[#00D4B2] font-mono font-bold">{displayPrice}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-normal font-serif">{noteText}</p>
                    <div className="flex gap-2 pt-1 font-mono text-[9px] text-[#00D4B2]">
                      <span>★ Rating: {p.rating} / 5</span>
                      <span>● Verified Alternative Candidate</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= CONTENT DETAIL SECTION TOGGLES ================= */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left">
          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-1">
            CONTENT DETAIL PAGE — OPTIONAL SECTIONS
          </span>
          <h5 className="text-xs font-bold text-slate-900 mb-1">
            Toggle which blocks appear on the universal Content Detail page
          </h5>
          <p className="text-[10px] text-slate-500 mb-4">
            Fixed sections (Hero, Gallery, What Is Discussed, You May Also Like, Profile) always render.
            Enable only the optional blocks that apply to this guide.
          </p>
          <ul className="space-y-2">
            {(guide.detailSections || []).map((section, idx) => {
              const labels: Record<string, string> = {
                winner: "Winner / Top Pick(s)",
                why_it_won: "Why This Won",
                verdict: "Recommendation & Quick Verdict",
                takeaways: "Key Takeaways",
                items_mentioned: "Items Mentioned",
                brands_mentioned: "Brands Mentioned",
                how_review_was_made: "How This Review Was Made",
              };
              return (
                <li
                  key={section.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-slate-400 w-5">{idx + 1}</span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {labels[section.id] || section.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...(guide.detailSections || [])];
                      next[idx] = { ...next[idx], enabled: !next[idx].enabled };
                      handleFieldChange("detailSections", next);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                      section.enabled
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {section.enabled ? "On" : "Off"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ================= SECTION 9: SEO SETTINGS ================= */}
        <div id="section-9-seo-card" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          <button 
            id="edit-trigger-seo"
            onClick={() => setActiveDrawerSection("seo")}
            className="absolute top-4 right-4 p-2 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-lg transition-all"
          >
            <PenTool className="w-3.5 h-3.5" />
          </button>
          
          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-1">SECTION 9: PUBLIC DISCOVERY & GOOGLE SEO SETTINGS</span>
          <h5 className="text-xs font-bold text-slate-900 mb-3">Collapsible Discovery Meta Info</h5>
          
          <div className="space-y-2.5 text-xs text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-app-text-secondary font-mono uppercase block">Google SEO Title:</span>
                <span className="font-semibold text-slate-900">{guide.seoTitle}</span>
              </div>
              <div>
                <span className="text-[9px] text-app-text-secondary font-mono uppercase block">Url Slug:</span>
                <span className="font-mono text-[#00D4B2] font-bold">/{guide.slug}</span>
              </div>
            </div>
            <div className="w-full h-[1px] bg-slate-200 my-2" />
            <div>
              <span className="text-[9px] text-app-text-secondary font-mono uppercase block">Meta Description:</span>
              <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{guide.seoDescription}</p>
            </div>
          </div>
        </div>

        {/* ================= SECTION 10: DISCLOSURE & TRUST ================= */}
        <div id="section-10-disclosure" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 text-left relative group">
          
          <button 
            id="edit-trigger-disclosure"
            onClick={() => setActiveDrawerSection("disclosure")}
            className="absolute top-4 right-4 p-2.5 bg-orange-500/10 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition-all border border-orange-500/20"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <span className="text-[9px] font-mono font-black text-[#0B1528] block uppercase tracking-widest mb-3 text-left">
            ● SECTION 10: CONVICTION DISCLOSURE & PUBLIC TRUST STAMPS
          </span>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureAffiliate ? "bg-orange-505/10 border-orange-200 text-orange-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Affiliate Links
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureSponsored ? "bg-[#d4b200]/10 border-[#d4b200]/20 text-yellow-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Sponsored content
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureSampleReceived ? "bg-indigo-50/10 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Sample Received
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureIndependentlyPurchased ? "bg-emerald-50/10 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Indep. Purchased
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureCreatorTested ? "bg-emerald-50/10 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Creator Tested
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase${guide.disclosureFactChecked ? "bg-emerald-50/10 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Fact Checked
            </div>
            <div className={`p-2.5 rounded-xl border text-center font-mono text-[9px] font-black uppercase text-ellipsis overflow-hidden${guide.disclosureEditorReviewed ? "bg-emerald-50/10 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
              Editor Reviewed
            </div>
          </div>
        </div>

        {/* ================= SECTION 11: CONTENT PERFORMANCE ================= */}
        <div id="section-11-analytics" className="bg-white border border-slate-200 rounded-2xl p-6 text-left relative shadow-sm">
          <span className="text-[9px] font-mono font-black text-rose-600 block uppercase tracking-widest mb-3">
            ● SECTION 11: CONTENT PERFORMANCE REPORT (OFFICIAL ANALYTICS PORTAL)
          </span>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl">
              <span className="text-[9px] text-app-text-secondary font-mono block">Clicks & views:</span>
              <span className="text-sm font-black text-slate-900">{guide.analyticsViews.toLocaleString()} Hits</span>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl">
              <span className="text-[9px] text-app-text-secondary font-mono block">Helpful ratio:</span>
              <span className="text-sm font-black text-emerald-600">{guide.analyticsHelpfulVotes.toLocaleString()} Votes</span>
            </div>
            <span className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl">
              <span className="text-[9px] text-app-text-secondary font-mono block">Average Read Time:</span>
              <span className="text-sm font-black text-slate-900">{guide.analyticsAvgReadTime}</span>
            </span>
            <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl">
              <span className="text-[9px] text-app-text-secondary font-mono block">Total Purchases:</span>
              <span className="text-sm font-black text-slate-900">{guide.analyticsPurchasesCount} Sales</span>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl col-span-2 lg:col-span-1">
              <span className="text-[9px] text-app-text-secondary font-mono block">Revenue:</span>
              <span className="text-sm font-black text-slate-900">{guide.analyticsRevenue}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ======================================================= */}
      {/* RIGHT SIDE SYSTEM-SCOPED SLIDING DRAWER WIDTH: 480px */}
      {/* ======================================================= */}
      <AnimatePresence>
        {activeDrawerSection && (
          <>
            {/* Dark overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawerSection(null)}
              className="fixed inset-0 bg-app-card z-50 cursor-pointer"
            />

            {/* Slide over drawer panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[480px] bg-app-card border-l border-app-border text-left text-app-text-secondary z-50 shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-app-border bg-app-bg flex items-center justify-between">
                <div>
                  <span className="bg-orange-500/10 text-orange-500 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                    Independent Config Drawer
                  </span>
                  <h3 className="text-sm font-black text-app-text-primary uppercase tracking-wider mt-1">
                    Edit Scoped: {activeDrawerSection}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveDrawerSection(null)}
                  className="p-2 bg-app-card hover:bg-slate-800 text-app-text-secondary hover:text-white rounded-xl transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Scroll body inputs */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-slate-905">
                
                {/* SECTION 1: HERO CONFIG */}
                {activeDrawerSection === "hero" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">GUIDE WORKSPACE TITLE</label>
                      <input 
                        type="text"
                        value={guide.guideTitle}
                        onChange={(e) => handleFieldChange("guideTitle", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">FEATURED HERO IMAGE URL</label>
                      <input 
                        type="text"
                        value={guide.heroImage}
                        onChange={(e) => handleFieldChange("heroImage", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">SUBMIT SAMPLE BADGE TEXT</label>
                      <input 
                        type="text"
                        value={guide.submitSampleBadge}
                        onChange={(e) => handleFieldChange("submitSampleBadge", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                      />
                    </div>
                    <div className="p-3 bg-app-bg/10 rounded-xl border border-app-border space-y-1.5">
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">Active Gallery Image Strips</span>
                      {guide.galleryImages.map((g, idx) => (
                        <input
                          key={idx}
                          value={g}
                          onChange={(e) => {
                            const copy = [...guide.galleryImages];
                            copy[idx] = e.target.value;
                            handleFieldChange("galleryImages", copy);
                          }}
                          className="w-full bg-app-bg border border-app-border p-2 rounded text-[10px] text-app-text-secondary font-mono outline-none"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* HISTORICAL VERSION SNAPSHOT ROLLBACK MODULE */}
                {activeDrawerSection === "versions" && (
                  <div className="space-y-4">
                    <span className="text-[10px] text-app-text-secondary font-mono block uppercase">Restore historical snapshot sandbox revisions</span>
                    {versions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 italic bg-app-bg rounded-xl border border-app-border">No backup records. Revisions auto capture during sectional saves.</div>
                    ) : (
                      <div className="space-y-2">
                        {versions.map((snap, idx) => (
                          <div key={idx} className="p-3.5 bg-app-bg border border-app-border hover:border-slate-700 rounded-xl transition-all flex items-center justify-between">
                            <div className="text-left max-w-[280px]">
                              <span className="text-xs font-black text-app-text-secondary block">{snap.label}</span>
                              <span className="text-[9px] font-mono text-slate-500 block">{snap.timestamp}</span>
                            </div>
                            <button
                              onClick={() => {
                                restoreVersionSnapshot(snap);
                                setActiveDrawerSection(null);
                              }}
                              className="px-3 py-1.5 bg-orange-650 hover:bg-orange-500 text-white font-mono text-[9px] font-black uppercase rounded-lg"
                            >
                              Restore ⏎
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 3 LEFT: GUIDE META PROPERTIES */}
                {activeDrawerSection === "meta" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">METHODOLOGY DESCRIPTION SUMMARY</label>
                      <textarea 
                        value={guide.methodologyDescription}
                        onChange={(e) => handleFieldChange("methodologyDescription", e.target.value)}
                        className="w-full h-24 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none resize-none"
                      />
                    </div>
                    
                    <div className="p-4 bg-app-bg/10 rounded-xl border border-app-border space-y-2.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-app-text-secondary font-mono uppercase block">Diagnostic Vetting Checklist:</span>
                        <button
                          onClick={() => {
                            const newCheck = { id: "mc_" + Date.now(), text: "New laboratory verification benchmark audit", checked: true };
                            handleFieldChange("methodologyChecklist", [...guide.methodologyChecklist, newCheck]);
                          }}
                          className="text-[8px] bg-app-card border border-app-border hover:bg-slate-800 text-orange-500 px-2 py-0.5 rounded font-black uppercase font-mono"
                        >
                          + Add checklist key
                        </button>
                      </div>
                      {guide.methodologyChecklist.map((item, index) => (
                        <div key={item.id} className="flex gap-2">
                          <input 
                            value={item.text}
                            onChange={(e) => {
                              const copy = [...guide.methodologyChecklist];
                              copy[index].text = e.target.value;
                              handleFieldChange("methodologyChecklist", copy);
                            }}
                            className="flex-1 bg-app-bg border border-app-border p-2 rounded text-xs text-app-text-secondary outline-none"
                          />
                          <button
                            onClick={() => {
                              const copy = guide.methodologyChecklist.filter(i => i.id !== item.id);
                              handleFieldChange("methodologyChecklist", copy);
                            }}
                            className="text-xs text-rose-500 px-1 hover:bg-rose-500/10 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 3 CENTER: WINNER PRODUCT SECTION */}
                {activeDrawerSection === "winner" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">SELECT EXPERT WINNER PRODUCT</label>
                      <select
                        value={guide.winnerProductId}
                        onChange={(e) => handleFieldChange("winnerProductId", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none"
                      >
                        {catalogProducts.map(cp => (
                          <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">PRICE OVERRIDE DISPLAY</label>
                        <input 
                          type="text"
                          value={guide.winnerPriceOverride}
                          onChange={(e) => handleFieldChange("winnerPriceOverride", e.target.value)}
                          className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CTA ACCENT BUTTON LABEL</label>
                        <input 
                          type="text"
                          value={guide.winnerCtaLabel}
                          onChange={(e) => handleFieldChange("winnerCtaLabel", e.target.value)}
                          className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CTA URL ADDRESS</label>
                      <input 
                        type="text"
                        value={guide.winnerCtaUrl}
                        onChange={(e) => handleFieldChange("winnerCtaUrl", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none"
                      />
                    </div>

                    <div className="p-3 bg-app-bg/10 rounded-xl border border-app-border space-y-3">
                      <span className="text-[9px] font-mono text-app-text-secondary uppercase tracking-wider block">Adjust Winner Score Card parameters:</span>
                      {guide.winnerMetrics.map((met, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                          <span className="w-28 text-app-text-secondary font-medium truncate">{met.label}</span>
                          <input 
                            type="range"
                            min="0"
                            max="10"
                            step="0.1"
                            value={met.score}
                            onChange={(e) => {
                              const copy = [...guide.winnerMetrics];
                              copy[idx].score = parseFloat(e.target.value);
                              handleFieldChange("winnerMetrics", copy);
                            }}
                            className="flex-1 accent-orange-500 h-1 rounded bg-app-bg"
                          />
                          <span className="font-mono text-orange-500 font-bold w-12 text-right">{met.score.toFixed(1)}/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 3 RIGHT: CREATOR IDENTITIES */}
                {activeDrawerSection === "creator" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CREATOR PIC AVATAR</label>
                        <input 
                          type="text"
                          value={guide.authorAvatar}
                          onChange={(e) => handleFieldChange("authorAvatar", e.target.value)}
                          className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CREATOR FULL NAME</label>
                        <input 
                          type="text"
                          value={guide.authorName}
                          onChange={(e) => handleFieldChange("authorName", e.target.value)}
                          className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">ROLE / CREDENTIALS SUMMARY</label>
                      <input 
                        type="text"
                        value={guide.authorRole}
                        onChange={(e) => handleFieldChange("authorRole", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CREATOR BIOGRAPHY STATEMENT</label>
                      <textarea 
                        value={guide.authorBio}
                        onChange={(e) => handleFieldChange("authorBio", e.target.value)}
                        className="w-full h-20 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CREATOR HOUSES QUICK TIP</label>
                      <textarea 
                        value={guide.quickTipText}
                        onChange={(e) => handleFieldChange("quickTipText", e.target.value)}
                        className="w-full h-24 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none font-serif resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* SECTION 4: WHY THIS WON REASON PILLS */}
                {activeDrawerSection === "reasons" && (
                  <div className="space-y-4">
                    <span className="text-[10px] text-app-text-secondary font-mono block uppercase">Vetting index Reasoning Pills Customizer</span>
                    {guide.whyThisWonTags.map((tag, idx) => (
                      <div key={tag.id} className="p-3 bg-app-bg border border-app-border rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-550">Reason Tag #{idx+1}</span>
                          <span className="text-orange-500">Pill color type</span>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            value={tag.label}
                            onChange={(e) => {
                              const copy = [...guide.whyThisWonTags];
                              copy[idx].label = e.target.value;
                              handleFieldChange("whyThisWonTags", copy);
                            }}
                            className="flex-1 bg-app-card border border-app-border p-2 rounded text-xs text-app-text-primary outline-none"
                          />
                          <select
                            value={tag.colorType}
                            onChange={(e) => {
                              const copy = [...guide.whyThisWonTags];
                              copy[idx].colorType = e.target.value as any;
                              handleFieldChange("whyThisWonTags", copy);
                            }}
                            className="bg-app-card border border-app-border text-[10px] font-mono rounded text-app-text-secondary"
                          >
                            <option value="green">Green</option>
                            <option value="blue">Blue</option>
                            <option value="red">Red</option>
                            <option value="orange">Orange</option>
                            <option value="purple">Purple</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SECTION 5: COMPARATIVE VERDICT GRID */}
                {activeDrawerSection === "verdict" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">VALUE VERDICT SUMMARY STATEMENT</label>
                      <textarea 
                        value={guide.verdictValueBody}
                        onChange={(e) => handleFieldChange("verdictValueBody", e.target.value)}
                        className="w-full h-20 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CHIPS & SUSATAINED SPEED VERDICT BODY</label>
                      <textarea 
                        value={guide.verdictPerformanceBody}
                        onChange={(e) => handleFieldChange("verdictPerformanceBody", e.target.value)}
                        className="w-full h-20 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary outline-none resize-none"
                      />
                    </div>

                    {/* Best for dynamic list */}
                    <div className="p-3.5 bg-[#05110B] border border-emerald-900/40 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                        <span className="text-emerald-400 uppercase font-black">Best For Bullet List</span>
                        <button 
                          onClick={() => handleFieldChange("verdictBestFor", [...guide.verdictBestFor, ""])}
                          className="text-[9px] bg-app-card border border-app-border hover:bg-slate-800 text-orange-500 px-2 py-0.5 rounded"
                        >
                          + Row
                        </button>
                      </div>
                      {guide.verdictBestFor.map((r, ri) => (
                        <div key={ri} className="flex gap-2">
                          <input 
                            value={r}
                            onChange={(e) => {
                              const copy = [...guide.verdictBestFor];
                              copy[ri] = e.target.value;
                              handleFieldChange("verdictBestFor", copy);
                            }}
                            className="flex-1 bg-app-bg border border-app-border p-2 rounded text-xs text-app-text-secondary outline-none"
                          />
                          <button
                            onClick={() => {
                              const copy = guide.verdictBestFor.filter((_, i) => i !== ri);
                              handleFieldChange("verdictBestFor", copy);
                            }}
                            className="text-xs text-rose-500 font-mono"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Not For list */}
                    <div className="p-3.5 bg-[#120509] border border-rose-900/40 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                        <span className="text-rose-400 uppercase font-black">Not Suitable Bullet List</span>
                        <button 
                          onClick={() => handleFieldChange("verdictNotFor", [...guide.verdictNotFor, ""])}
                          className="text-[9px] bg-app-card border border-app-border hover:bg-slate-800 text-orange-500 px-2 py-0.5 rounded"
                        >
                          + Row
                        </button>
                      </div>
                      {guide.verdictNotFor.map((r, ri) => (
                        <div key={ri} className="flex gap-2">
                          <input 
                            value={r}
                            onChange={(e) => {
                              const copy = [...guide.verdictNotFor];
                              copy[ri] = e.target.value;
                              handleFieldChange("verdictNotFor", copy);
                            }}
                            className="flex-1 bg-app-bg border border-app-border p-2 rounded text-xs text-app-text-secondary outline-none"
                          />
                          <button
                            onClick={() => {
                              const copy = guide.verdictNotFor.filter((_, i) => i !== ri);
                              handleFieldChange("verdictNotFor", copy);
                            }}
                            className="text-xs text-rose-500 font-mono"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 6: DETAILED EVALUATION BODY */}
                {activeDrawerSection === "evaluation" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1 font-black">EDITORIAL RICH BODY PARAGRAPHS</label>
                      <textarea 
                        value={guide.evalBody}
                        onChange={(e) => handleFieldChange("evalBody", e.target.value)}
                        className="w-full h-80 bg-app-bg border border-app-border focus:border-orange-500 p-3 rounded-xl text-xs text-app-text-secondary outline-none resize-none font-serif leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* SECTION 7: KEY TAKEAWAYS EDIT PANEL */}
                {activeDrawerSection === "takeaways" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">TAKEAWAYS HEADER LINE</label>
                      <input 
                        type="text"
                        value={guide.takeawayHeadline}
                        onChange={(e) => handleFieldChange("takeawayHeadline", e.target.value.toUpperCase())}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">CONCISE TAKEAWAY SUMMARY STATEMENT</label>
                      <textarea 
                        value={guide.takeawayBody}
                        onChange={(e) => handleFieldChange("takeawayBody", e.target.value)}
                        className="w-full h-28 bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary resize-none font-serif"
                      />
                    </div>
                  </div>
                )}

                {/* SECTION 8: OTHER PRODUCTS MENTIONED PROPERTIES */}
                {activeDrawerSection === "others" && (
                  <div className="space-y-4">
                    <span className="text-[10px] text-app-text-secondary font-mono block uppercase">Alternate contender products linking</span>
                    
                    {guide.otherMentionedIds.map((pid) => {
                      const p = getProductById(pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="p-3.5 bg-app-bg border border-app-border rounded-xl space-y-3">
                          <div className="flex justify-between items-center text-xs font-bold text-app-text-primary">
                            <span>{p.name}</span>
                            <span className="text-orange-500 font-mono text-[10px]">Rank display: #{guide.otherRanks[pid] || 2}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-mono text-slate-500 block mb-0.5">Price Override</label>
                              <input 
                                value={guide.otherPriceOverrides[pid] || ""}
                                onChange={(e) => {
                                  const copy = { ...guide.otherPriceOverrides };
                                  copy[pid] = e.target.value;
                                  handleFieldChange("otherPriceOverrides", copy);
                                }}
                                className="w-full bg-app-card border border-app-border p-1.5 rounded text-[10px] text-app-text-secondary outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-mono text-slate-500 block mb-0.5">Custom Rank Badge</label>
                              <input 
                                type="number"
                                value={guide.otherRanks[pid] || 2}
                                onChange={(e) => {
                                  const copy = { ...guide.otherRanks };
                                  copy[pid] = parseInt(e.target.value) || 2;
                                  handleFieldChange("otherRanks", copy);
                                }}
                                className="w-full bg-app-card border border-app-border p-1.5 rounded text-[10px] text-app-text-secondary outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[8px] font-mono text-slate-500 block mb-0.5">Editorial candidate note</label>
                            <input 
                              value={guide.otherNotes[pid] || ""}
                              onChange={(e) => {
                                const copy = { ...guide.otherNotes };
                                copy[pid] = e.target.value;
                                handleFieldChange("otherNotes", copy);
                              }}
                              className="w-full bg-app-card border border-app-border p-1.5 rounded text-[10px] text-app-text-secondary outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SECTION 9: SEO & METADATA CONFIG */}
                {activeDrawerSection === "seo" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">GOOGLE OUTLET TITLE TAG</label>
                      <input 
                        type="text"
                        value={guide.seoTitle}
                        onChange={(e) => handleFieldChange("seoTitle", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">SEARCH META DESCRIPTION FIELD</label>
                      <input 
                        type="text"
                        value={guide.seoDescription}
                        onChange={(e) => handleFieldChange("seoDescription", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-app-text-secondary font-mono block mb-1">SEARCH ENGINE RETRIEVAL KEYWORDS</label>
                      <input 
                        type="text"
                        value={guide.seoKeywords}
                        onChange={(e) => handleFieldChange("seoKeywords", e.target.value)}
                        className="w-full bg-app-bg border border-app-border focus:border-orange-500 p-2.5 rounded-xl text-xs text-app-text-secondary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">URL SLUG LINK</label>
                        <input 
                          type="text"
                          value={guide.slug}
                          onChange={(e) => handleFieldChange("slug", e.target.value.toLowerCase().replace(/ /g, "-"))}
                          className="w-full bg-app-bg border border-app-border p-2.5 rounded-xl text-xs text-app-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-app-text-secondary font-mono block mb-1">GUIDE CATEGORY</label>
                        <input 
                          type="text"
                          value={guide.category}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          className="w-full bg-app-bg border border-app-border p-2.5 rounded-xl text-xs text-app-text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 10: CONVICTION DISCLOSURE & PUBLIC TRUST BADGES */}
                {activeDrawerSection === "disclosure" && (
                  <div className="space-y-4">
                    <span className="text-[10px] text-app-text-secondary font-mono block uppercase">Disclosure Integrity Badges Checklist</span>
                    
                    <div className="space-y-3 bg-app-bg/10 p-4 border border-app-border rounded-xl">
                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureAffiliate}
                          onChange={(e) => handleFieldChange("disclosureAffiliate", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Affiliate Link Commission tags</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureSponsored}
                          onChange={(e) => handleFieldChange("disclosureSponsored", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Brand Sponsored / Paid post</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureSampleReceived}
                          onChange={(e) => handleFieldChange("disclosureSampleReceived", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Diagnostic Vetting Unit Sample received</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureIndependentlyPurchased}
                          onChange={(e) => handleFieldChange("disclosureIndependentlyPurchased", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Independently Purchased directly</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureCreatorTested}
                          onChange={(e) => handleFieldChange("disclosureCreatorTested", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Tested completely by designated bio author</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureFactChecked}
                          onChange={(e) => handleFieldChange("disclosureFactChecked", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Fact Checked / Lab data cross verified</span>
                      </label>

                      <label className="flex items-center gap-3 text-xs text-app-text-secondary font-medium cursor-pointer py-1 block">
                        <input 
                          type="checkbox"
                          checked={guide.disclosureEditorReviewed}
                          onChange={(e) => handleFieldChange("disclosureEditorReviewed", e.target.checked)}
                          className="accent-orange-500 w-4 h-4 rounded"
                        />
                        <span>Senior editorial board review seal</span>
                      </label>
                    </div>
                  </div>
                )}

              </div>

              {/* Drawer Sticky Save Footer */}
              <div className="p-6 border-t border-app-border bg-app-bg flex items-center justify-end">
                <button
                  onClick={() => handleSaveSection(activeDrawerSection)}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Section Changes
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
